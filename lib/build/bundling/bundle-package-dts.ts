/**
 * Bundle des fichiers de définition TypeScript (.d.ts) pour les packages internes
 *
 * Ce module génère un fichier .d.ts unique qui regroupe toutes les définitions
 * de types d'un package interne en préservant les exports nommés standards.
 */

import * as path from "node:path";
import fileSystem from "fs-extra";
import { Project, SourceFile } from "ts-morph";
import { TPackage } from "@lib/build/build.type";
import { Logger } from "@build/monitoring/logger.class";

/**
 * Génère un fichier bundle de définitions TypeScript (.d.ts) pour un package interne
 * en regroupant toutes les définitions de types avec des exports nommés standards.
 *
 * @param pkg - TPackage représentant le package source
 */
export async function bundlePackageDts(pkg: TPackage): Promise<void> {
  const logger = Logger.me();

  logger.info(`🔄 Bundling des types pour le package ${pkg.name}`);

  const project = new Project({
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      skipLibCheck: true
    }
  });

  // Récupérer tous les fichiers .d.ts du package
  const dtsFiles = getAllDtsFiles(pkg);

  if (dtsFiles.length === 0) {
    throw new Error(`Aucun fichier .d.ts trouvé pour ${pkg.name}`);
  }

  // Ajouter les fichiers au projet
  project.addSourceFilesAtPaths(dtsFiles);

  const outputFilePath = pkg.outDtsFile;
  logger.debug(`📝 Création du fichier de sortie: ${outputFilePath}`);

  // Collections pour éviter les doublons
  const declaredNames = new Set<string>();
  const importedModules = new Set<string>();
  const typeDeclarations: string[] = [];
  const importStatements: string[] = [];
  const exportsToInclude: string[] = [];

  // Traiter chaque fichier source en deux passes
  // Passe 1: traiter tous les fichiers non-entrée pour collecter les déclarations
  for (const sourceFile of project.getSourceFiles()) {
    const isEntryPoint = isEntryPointFile(sourceFile, pkg);
    if (!isEntryPoint) {
      await processSourceFile(
        sourceFile,
        pkg,
        declaredNames,
        importedModules,
        typeDeclarations,
        importStatements,
        exportsToInclude
      );
    }
  }

  // Passe 2: traiter le fichier d'entrée pour les re-exports
  for (const sourceFile of project.getSourceFiles()) {
    const isEntryPoint = isEntryPointFile(sourceFile, pkg);
    if (isEntryPoint) {
      await processSourceFile(
        sourceFile,
        pkg,
        declaredNames,
        importedModules,
        typeDeclarations,
        importStatements,
        exportsToInclude
      );
    }
  }

  // Générer le contenu du fichier bundle
  const bundleContent = generateBundleContent(
    importStatements,
    typeDeclarations,
    exportsToInclude
  );

  // Écrire le fichier
  await fileSystem.ensureDir(path.dirname(outputFilePath));
  await fileSystem.writeFile(outputFilePath, bundleContent, "utf-8");

  // Nettoyer les fichiers .d.ts individuels (sauf le bundle)
  await cleanIndividualDtsFiles(pkg, outputFilePath);

  logger.success(`✅ Bundle DTS généré pour ${pkg.name}: ${outputFilePath}`);
}

/**
 * Récupère tous les fichiers .d.ts d'un package
 */
function getAllDtsFiles(pkg: TPackage): string[] {
  const distPath = pkg.distPath;

  if (!fileSystem.existsSync(distPath)) {
    return [];
  }

  const files = fileSystem.readdirSync(distPath, { recursive: true });
  return files
    .filter((file: any) => typeof file === "string" && file.endsWith(".d.ts"))
    .map((file: any) => path.join(distPath, file));
}

/**
 * Vérifie si un fichier source est le point d'entrée du package
 */
function isEntryPointFile(sourceFile: SourceFile, pkg: TPackage): boolean {
  const fileName = path.basename(sourceFile.getFilePath());
  const expectedEntryName = path.basename(pkg.outDtsFile);
  return fileName === expectedEntryName;
}

/**
 * Traite un fichier source pour extraire ses déclarations et exports
 */
async function processSourceFile(
  sourceFile: SourceFile,
  pkg: TPackage,
  declaredNames: Set<string>,
  importedModules: Set<string>,
  typeDeclarations: string[],
  importStatements: string[],
  exportsToInclude: string[]
): Promise<void> {
  // Si c'est le fichier d'entrée, on traite les re-exports différemment
  const isEntryPoint = isEntryPointFile(sourceFile, pkg);

  // Traiter les imports
  sourceFile.getImportDeclarations().forEach((importDecl) => {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    if (
      moduleSpecifier &&
      !moduleSpecifier.startsWith(".") &&
      !importedModules.has(moduleSpecifier)
    ) {
      importedModules.add(moduleSpecifier);
      importStatements.push(importDecl.getText());
    }
  });

  if (!isEntryPoint) {
    // Pour les fichiers non-entrée, extraire les déclarations

    // Traiter les déclarations de types
    sourceFile.getTypeAliases().forEach((typeAlias) => {
      const name = typeAlias.getName();
      if (!declaredNames.has(name)) {
        declaredNames.add(name);
        typeDeclarations.push(typeAlias.getText());
      }
    });

    // Traiter les interfaces
    sourceFile.getInterfaces().forEach((iface) => {
      const name = iface.getName();
      if (!declaredNames.has(name)) {
        declaredNames.add(name);
        typeDeclarations.push(iface.getText());
      }
    });

    // Traiter les classes
    sourceFile.getClasses().forEach((cls) => {
      const name = cls.getName();
      if (name && !declaredNames.has(name)) {
        declaredNames.add(name);
        // Vérifier si la classe a déjà un export dans sa déclaration
        const classText = cls.getText();
        if (classText.startsWith("export ")) {
          // La classe est déjà exportée, on l'ajoute telle quelle
          typeDeclarations.push(classText);
        } else {
          // Ajouter export à la déclaration
          typeDeclarations.push(`export ${classText}`);
        }
      }
    });

    // Traiter les enums
    sourceFile.getEnums().forEach((enumDecl) => {
      const name = enumDecl.getName();
      if (!declaredNames.has(name)) {
        declaredNames.add(name);
        typeDeclarations.push(enumDecl.getText());
      }
    });
  } else {
    // Pour le fichier d'entrée, collecter les exports qui ne sont pas déjà déclarés
    sourceFile.getExportDeclarations().forEach((exportDecl) => {
      const namedExports = exportDecl.getNamedExports();
      namedExports.forEach((namedExport) => {
        const exportName = namedExport.getName();
        // Ne pas re-exporter si l'élément est déjà déclaré avec export
        if (!declaredNames.has(exportName)) {
          exportsToInclude.push(exportName);
        }
      });
    });
  }
}

/**
 * Génère le contenu du fichier bundle
 */
function generateBundleContent(
  importStatements: string[],
  typeDeclarations: string[],
  exportsToInclude: string[]
): string {
  const parts: string[] = [];

  // Header
  parts.push("/**");
  parts.push(" * Bundled TypeScript definitions");
  parts.push(` * Generated: ${new Date().toISOString()}`);
  parts.push(" */");
  parts.push("");

  // Imports
  if (importStatements.length > 0) {
    parts.push("// External imports");
    parts.push(...importStatements);
    parts.push("");
  }

  // Type declarations
  if (typeDeclarations.length > 0) {
    parts.push("// Type declarations");
    parts.push(...typeDeclarations);
    parts.push("");
  }

  // Exports (seulement pour les éléments non déjà exportés dans les déclarations)
  if (exportsToInclude.length > 0) {
    parts.push("// Re-exports");
    exportsToInclude.forEach((exportName) => {
      parts.push(`export { ${exportName} };`);
    });
  }

  return parts.join("\n");
}

/**
 * Nettoie les fichiers .d.ts individuels
 */
async function cleanIndividualDtsFiles(
  pkg: TPackage,
  bundleFilePath: string
): Promise<void> {
  const distPath = pkg.distPath;
  const bundleFileName = path.basename(bundleFilePath);

  if (!fileSystem.existsSync(distPath)) {
    return;
  }

  const files = await fileSystem.readdir(distPath);

  for (const file of files) {
    if (file.endsWith(".d.ts") && file !== bundleFileName) {
      const filePath = path.join(distPath, file);
      await fileSystem.unlink(filePath);
    }
  }
}
