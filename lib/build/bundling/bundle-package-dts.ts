/**
 * Bundles TypeScript definition files (.d.ts) for internal packages
 *
 * This module generates a single .d.ts file that aggregates all type definitions
 * of an internal package, preserving standard named exports.
 */

import * as path from "node:path";
import fileSystem from "fs-extra";
import { Project, SourceFile } from "ts-morph";
import { TPackage } from "@lib/build/build.type";
import { Logger } from "@build/monitoring/logger.class";

/**
 * Bundles all .d.ts files for a package into a single index.d.ts
 * Handles type-only packages and ensures correct re-exports
 *
 * @param pkg - TPackage representing the source package
 */
export async function bundlePackageDts(pkg: TPackage): Promise<void> {
  const logger = Logger.me();

  logger.info(`🔄 Bundling types for package ${pkg.name}`);

  const project = new Project({
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      skipLibCheck: true
    }
  });

  // Retrieve all .d.ts files from the package
  const dtsFiles = getAllDtsFiles(pkg);

  if (dtsFiles.length === 0) {
    throw new Error(`No .d.ts files found for ${pkg.name}`);
  }

  // Add files to the project
  project.addSourceFilesAtPaths(dtsFiles);

  const outputFilePath = pkg.outDtsFile;
  logger.debug(`📝 Creating output file: ${outputFilePath}`);

  // Collections to avoid duplicates
  const declaredNames = new Set<string>();
  const importedModules = new Set<string>();
  const typeDeclarations: string[] = [];
  const importStatements: string[] = [];
  const exportsToInclude: string[] = [];

  // Process each source file in two passes
  // Pass 1: process all non-entry files to collect declarations
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

  // Pass 2: process the entry file for re-exports
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

  // Generate the bundle file content
  const bundleContent = generateBundleContent(
    importStatements,
    typeDeclarations,
    exportsToInclude
  );

  // Write the file
  await fileSystem.ensureDir(path.dirname(outputFilePath));
  await fileSystem.writeFile(outputFilePath, bundleContent, "utf-8");
  logger.info(`✅ Bundled .d.ts file written: ${outputFilePath}`);

  // Clean up individual .d.ts files (except the bundle)
  await cleanIndividualDtsFiles(pkg, outputFilePath);

  logger.success(`✅ DTS bundle generated for ${pkg.name}: ${outputFilePath}`);
}

/**
 * Reads and returns all .d.ts files in the package src directory
 */
function getAllDtsFiles(pkg: TPackage): string[] {
  const logger = Logger.me();
  const distPath = pkg.distPath;

  if (!fileSystem.existsSync(distPath)) {
    return [];
  }

  const files = fileSystem.readdirSync(distPath, { recursive: true });
  return files
    .filter((file: any) => typeof file === "string" && file.endsWith(".d.ts"))
    .map((file: any) => {
      logger.info(`📄 Found .d.ts file: ${file}`);
      return path.join(distPath, file);
    });
}

/**
 * Checks if a source file is the package entry point
 */
function isEntryPointFile(sourceFile: SourceFile, pkg: TPackage): boolean {
  const fileName = path.basename(sourceFile.getFilePath());
  const expectedEntryName = path.basename(pkg.outDtsFile);
  return fileName === expectedEntryName;
}

/**
 * Processes a source file to extract its declarations and exports
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
  // If it's the entry file, handle re-exports differently
  const isEntryPoint = isEntryPointFile(sourceFile, pkg);

  // Handle imports
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
    // For non-entry files, extract declarations

    // Handle type aliases
    sourceFile.getTypeAliases().forEach((typeAlias) => {
      const name = typeAlias.getName();
      if (!declaredNames.has(name)) {
        declaredNames.add(name);
        typeDeclarations.push(typeAlias.getText());
      }
    });

    // Handle interfaces
    sourceFile.getInterfaces().forEach((iface) => {
      const name = iface.getName();
      if (!declaredNames.has(name)) {
        declaredNames.add(name);
        typeDeclarations.push(iface.getText());
      }
    });

    // Handle classes
    sourceFile.getClasses().forEach((cls) => {
      const name = cls.getName();
      if (name && !declaredNames.has(name)) {
        declaredNames.add(name);
        // Check if the class is already exported in its declaration
        const classText = cls.getText();
        if (classText.startsWith("export ")) {
          // Already exported, add as is
          typeDeclarations.push(classText);
        } else {
          // Add export to the declaration
          typeDeclarations.push(`export ${classText}`);
        }
      }
    });

    // Handle enums
    sourceFile.getEnums().forEach((enumDecl) => {
      const name = enumDecl.getName();
      if (!declaredNames.has(name)) {
        declaredNames.add(name);
        typeDeclarations.push(enumDecl.getText());
      }
    });
  } else {
    // For the entry file, collect exports not already declared
    sourceFile.getExportDeclarations().forEach((exportDecl) => {
      const namedExports = exportDecl.getNamedExports();
      namedExports.forEach((namedExport) => {
        const exportName = namedExport.getName();
        // Do not re-export if the item is already declared with export
        if (!declaredNames.has(exportName)) {
          exportsToInclude.push(exportName);
        }
      });
    });
  }
}

/**
 * Generates correct re-exports for type-only packages
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

  // Exports (only for items not already exported in declarations)
  if (exportsToInclude.length > 0) {
    parts.push("// Re-exports");
    exportsToInclude.forEach((exportName) => {
      parts.push(`export { ${exportName} };`);
    });
  }

  return parts.join("\n");
}

/**
 * Cleans up individual .d.ts files
 */
async function cleanIndividualDtsFiles(
  pkg: TPackage,
  bundleFilePath: string
): Promise<void> {
  const logger = Logger.me();
  const distPath = pkg.distPath;
  const bundleFileName = path.basename(bundleFilePath);

  if (!fileSystem.existsSync(distPath)) {
    return;
  }

  const files = await fileSystem.readdir(distPath);

  for (const file of files) {
    if (file.endsWith(".d.ts") && file !== bundleFileName) {
      const filePath = path.join(distPath, file);
      try {
        await fileSystem.unlink(filePath);
      } catch (error) {
        logger.error(`❌ Error reading .d.ts file: ${filePath}`, error);
      }
    }
  }
}
