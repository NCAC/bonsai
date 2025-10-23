import { rollup, watch, RollupOptions, RollupWatchOptions } from "rollup";
import fs from "fs-extra";
import { join, dirname } from "node:path";
import { Logger } from "@build/monitoring/logger.class";
import { BuildOptions } from "@lib/build/initializing/build-options.class";
import { PathManager } from "@build/core/path-manager.class";
import { TFramework, TPackage } from "@build/build.type";

import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import { bundleLibraryDts } from "@build/bundling/bundle-library-dts";
import { bundlePackageDts } from "@build/bundling/bundle-package-dts";
import { bundleFrameworkDts } from "@build/bundling/bundle-framework-dts";

/**
 * Classe principale pour le build des composants
 */
export class Builder {
  private static instance: Builder;
  private logger: Logger;
  private buildOptions: BuildOptions;
  private pathManager: PathManager = PathManager.me();
  private watchers: Map<string, { close: () => Promise<void> }> = new Map();

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {
    this.logger = Logger.me();
    this.buildOptions = BuildOptions.me();
  }

  /**
   * Obtenir l'instance du builder
   */
  public static me(): Builder {
    if (!Builder.instance) {
      Builder.instance = new Builder();
    }
    return Builder.instance;
  }

  /**
   * Nettoyer le dossier de sortie d'un composant
   */
  private async cleanOutputDir(path: string): Promise<void> {
    try {
      await fs.mkdir(path, { recursive: true });
      const files = await fs.readdir(path);

      for (const file of files) {
        const filePath = join(path, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          await this.cleanOutputDir(filePath);
          await fs.rmdir(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }

      this.logger.debug(`Dossier nettoyé: ${path}`);
    } catch (error) {
      this.logger.error(`Erreur lors du nettoyage de ${path}:`, error);
    }
  }

  /**
   * S'assurer que le dossier de sortie existe
   */
  private async ensureOutputDirExists(path: string): Promise<void> {
    try {
      await fs.mkdir(dirname(path), { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Construire une bibliothèque externe
   * Génère un bundle JS et DTS isolé dans une IIFE avec toutes les fonctionnalités exportées à plat
   */
  public async buildLibrary(component: TPackage): Promise<boolean> {
    const componentName = component.name;
    this.logger.info(`Building library: ${componentName}`);

    try {
      // Nettoyer le dossier de sortie si demandé
      if (this.buildOptions.all.clean) {
        await this.cleanOutputDir(component.distPath);
      }

      // S'assurer que le dossier de sortie existe
      await this.ensureOutputDirExists(component.outJsFile);

      // Définir le namespace (nom global pour l'export)
      // Utiliser external_name du package.json ou tomber sur le namespace
      const namespace =
        component.packageJson.namespace ||
        component.namespace ||
        componentName.replace(/[^a-zA-Z0-9_]/g, "_");

      // Créer la configuration Rollup pour le bundle JS
      const jsRollupConfig: RollupOptions = {
        input: component.srcFile,
        output: {
          // Utiliser le chemin dist + nom de fichier sans le "dist/" au milieu
          file: join(
            component.distPath,
            component.outJsFile.split("/").pop() || ""
          ),
          format: "es", // Format ES pour pouvoir utiliser export const
          sourcemap: false,
          // Préserver les modules mais les exporter comme propriétés d'un objet unique
          preserveModules: false,
          // Ajouter un banner pour documenter le bundle
          banner: `/**
 * ${componentName} - Version ${component.packageJson.version}
 * Bundled by Bonsai Build System
 * Date: ${new Date().toISOString()}
 */`
        },
        plugins: [
          // Résoudre les dépendances externes
          nodeResolve({
            extensions: [".ts", ".js", ".json"],
            preferBuiltins: true
          }),
          // Convertir CommonJS en ES modules
          commonjs(),
          // Compiler TypeScript
          typescript({
            tsconfig: join(this.pathManager.rootPath, "tsconfig.json"),
            tsconfigOverride: {
              compilerOptions: {
                declaration: false, // Nous générerons les déclarations séparément
                target: "es2020",
                module: "esnext",
                importHelpers: true // Ajout explicite pour forcer l'import depuis tslib
              },
              include: [`${component.srcPath}/**/*`],
              exclude: ["node_modules", "**/*.test.ts", "**/*.spec.ts"]
            },
            clean: true
          }),
          // Transformer le code pour exposer toutes les exportations selon le format souhaité
          {
            name: "flatten-exports",
            renderChunk(code, chunk) {
              if (chunk.isEntry) {
                // Nettoyer tous les exports nommés et default
                let cleaned = code
                  .replace(/export\s+\{[^}]+\};?/g, "")
                  .replace(/export\s+default\s+[^;]+;?/g, "")
                  .replace(
                    /export\s+(const|let|var|function|class)\s+/g,
                    "$1 "
                  );

                // Générer dynamiquement la liste des objets d'agrégation explicitement exportés
                // On cherche les objets (const/let/var) présents dans chunk.exports
                const exportNames = chunk.exports.filter(
                  (e) => e !== "default"
                );
                const exportObjects = [];
                const declRegex =
                  /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:Object\.freeze\()?\{/g;
                let m;
                while ((m = declRegex.exec(cleaned)) !== null) {
                  if (exportNames.includes(m[1])) {
                    exportObjects.push(m[1]);
                  }
                }
                // Si aucun objet d'agrégation trouvé, fallback sur tous les exports à plat
                let returnLine = "";
                if (exportObjects.length > 0) {
                  returnLine = `return { ${exportObjects
                    .map((n) => `...${n}`)
                    .join(", ")} };`;
                } else if (exportNames.length > 0) {
                  // Exports à plat (fonctions, classes, etc.)
                  const objectProps = exportNames
                    .map((name) => `${name}: ${name}`)
                    .join(",\n  ");
                  returnLine = `return {\n  ${objectProps}\n};`;
                } else {
                  returnLine = `return {};`;
                }
                // Export nommé, return à plat ou spread
                return `export const ${namespace} = (function () {\n${cleaned}\n  ${returnLine}\n})();`;
              }
              return null;
            }
          }
        ],
        // Externaliser les dépendances spécifiées
        external: component.dependencies
      };

      // Effectuer le build JS
      this.logger.info(`Génération du bundle JS pour ${componentName}...`);
      const jsBundle = await rollup(jsRollupConfig);
      await jsBundle.write(jsRollupConfig.output as any);
      await jsBundle.close();

      // Effectuer le build DTS plat (API plate, sans namespace)
      try {
        await bundleLibraryDts(component);
        this.logger.success(`Bundle DTS plat généré pour ${componentName}`);
      } catch (dtsError) {
        this.logger.error(
          `Erreur lors de la génération du bundle DTS plat pour ${componentName}:`,
          dtsError
        );
        return false;
      }

      this.logger.success(`Library ${componentName} built successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors du build de la library ${componentName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Build a types-only package (no JavaScript compilation needed)
   * Simply copies existing .d.ts files to the dist folder
   */
  public async buildTypesOnlyPackage(component: TPackage): Promise<boolean> {
    const componentName = component.name;
    this.logger.info(`📝 Building types-only package: ${componentName}`);

    try {
      // Nettoyer le dossier de sortie si demandé
      if (this.buildOptions.all.clean) {
        await this.cleanOutputDir(component.distPath);
      }

      // S'assurer que le dossier de sortie existe
      await this.ensureOutputDirExists(component.outDtsFile);

      // For types-only packages, we need to copy the existing index.d.ts
      // The package should already have a properly structured index.d.ts file
      const sourceIndexDts = join(component.rootPath, "index.d.ts");
      const targetIndexDts = component.outDtsFile;

      try {
        // Check if the source index.d.ts exists
        await fs.access(sourceIndexDts);
        
        // Copy the index.d.ts file to the dist folder
        await fs.copyFile(sourceIndexDts, targetIndexDts);
        
        this.logger.success(`📄 Types file copied: ${sourceIndexDts} → ${targetIndexDts}`);
      } catch (copyError) {
        this.logger.error(
          `Failed to copy types file from ${sourceIndexDts} to ${targetIndexDts}:`,
          copyError
        );
        return false;
      }

      // Also copy any additional .d.ts files from src/ if they exist
      const srcPath = component.srcPath;
      try {
        await fs.access(srcPath);
        const srcFiles = await fs.readdir(srcPath, { withFileTypes: true });
        
        for (const file of srcFiles) {
          if (file.isFile() && file.name.endsWith(".d.ts")) {
            const sourcePath = join(srcPath, file.name);
            const targetPath = join(component.distPath, file.name);
            
            await fs.copyFile(sourcePath, targetPath);
            this.logger.debug(`📄 Additional types file copied: ${file.name}`);
          }
        }
      } catch {
        // src folder might not exist or be accessible, which is fine for types-only packages
        this.logger.debug(`No src folder found for types-only package ${componentName}, which is normal`);
      }

      this.logger.success(`✅ Types-only package ${componentName} processed successfully`);
      return true;
      
    } catch (error) {
      this.logger.error(
        `Erreur lors du build du package types-only ${componentName}:`,
        error
      );
      return false;
    }
  }

  public async buildPackage(component: TPackage): Promise<boolean> {
    const componentName = component.name;
    this.logger.info(`Building package: ${componentName}`);

    try {
      // Check if this is a types-only package
      if (component.isTypesOnly) {
        return await this.buildTypesOnlyPackage(component);
      }

      // Nettoyer le dossier de sortie si demandé
      if (this.buildOptions.all.clean) {
        await this.cleanOutputDir(component.distPath);
      }

      // S'assurer que le dossier de sortie existe
      await this.ensureOutputDirExists(component.outJsFile);

      // Créer la configuration Rollup pour le bundle JS
      const jsRollupConfig: RollupOptions = {
        input: component.srcFile,
        output: {
          file: component.outJsFile,
          format: "es", // Format ES modules
          sourcemap: false,
          preserveModules: false,
          // Ajouter un banner pour documenter le bundle
          banner: `/**
 * ${componentName} - Version ${component.packageJson.version}
 * Bundled by Bonsai Build System
 * Date: ${new Date().toISOString()}
 */`
        },
        plugins: [
          // Résoudre les dépendances externes
          nodeResolve({
            extensions: [".ts", ".js", ".json"],
            preferBuiltins: true
          }),
          // Convertir CommonJS en ES modules
          commonjs(),
          // Compiler TypeScript avec génération des déclarations
          typescript({
            tsconfig: join(this.pathManager.rootPath, "tsconfig.json"),
            tsconfigOverride: {
              compilerOptions: {
                declaration: true,
                declarationDir: component.distPath,
                target: "es2020",
                module: "esnext",
                importHelpers: true
              },
              include: [`${component.srcPath}/**/*`],
              exclude: ["node_modules", "**/*.test.ts", "**/*.spec.ts"]
            },
            clean: true
          })
        ],
        // Externaliser les dépendances spécifiées
        external: component.dependencies
      };

      // Effectuer le build JS et DTS
      this.logger.info(`Génération du bundle pour ${componentName}...`);
      const bundle = await rollup(jsRollupConfig);
      await bundle.write(jsRollupConfig.output as any);
      await bundle.close();

      // TODO: Effectuer le bundling des types DTS
      try {
        await bundlePackageDts(component);
        this.logger.success(`Bundle DTS généré pour ${componentName}`);
      } catch (dtsError) {
        this.logger.error(
          `Erreur lors de la génération du bundle DTS pour ${componentName}:`,
          dtsError
        );
        return false;
      }

      this.logger.success(`Package ${componentName} built successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors du build du package ${componentName}:`,
        error
      );
      return false;
    }
  }

  public async buildFramework(framework: TFramework): Promise<boolean> {
    const frameworkName = framework.packageJson.name || "bonsai";
    this.logger.info(`Building framework: ${frameworkName}`);

    try {
      // Nettoyer le dossier de sortie si demandé
      if (this.buildOptions.all.clean) {
        await this.cleanOutputDir(framework.distPath);
      }

      // S'assurer que le dossier de sortie existe
      await this.ensureOutputDirExists(framework.outJsFile);

      // Créer la configuration Rollup pour le framework
      const jsRollupConfig: RollupOptions = {
        input: framework.srcFile,
        output: {
          file: framework.outJsFile,
          format: "es", // Format ES modules
          sourcemap: false,
          preserveModules: false,
          // Banner pour documenter le bundle du framework
          banner: `/**
 * ${frameworkName} Framework - Version ${framework.packageJson.version}
 * Bundled by Bonsai Build System
 * Date: ${new Date().toISOString()}
 */`
        },
        plugins: [
          // Résoudre les dépendances externes
          nodeResolve({
            extensions: [".ts", ".js", ".json"],
            preferBuiltins: true,
            // Pour le framework, on veut résoudre les dépendances internes
            // pour créer un bundle plat
            exportConditions: ["node", "default"]
          }),
          // Convertir CommonJS en ES modules
          commonjs(),
          // Compiler TypeScript avec génération des déclarations
          typescript({
            tsconfig: join(this.pathManager.rootPath, "tsconfig.json"),
            tsconfigOverride: {
              compilerOptions: {
                declaration: true,
                declarationDir: framework.distPath,
                target: "es2020",
                module: "esnext",
                importHelpers: true
              },
              include: [`${framework.srcPath}/**/*`],
              exclude: ["node_modules", "**/*.test.ts", "**/*.spec.ts"]
            },
            clean: true
          })
        ],
        // Pour le framework, ne pas externaliser les packages internes
        // afin de créer un bundle plat avec tous les exports
        external: (id) => {
          // Garder externes seulement les vraies dépendances externes
          return (
            !id.startsWith("@bonsai/") &&
            !id.startsWith(".") &&
            !id.startsWith("/")
          );
        }
      };

      // Effectuer le build JS et DTS
      this.logger.info(
        `Génération du bundle pour le framework ${frameworkName}...`
      );
      const bundle = await rollup(jsRollupConfig);
      await bundle.write(jsRollupConfig.output as any);
      await bundle.close();

      // Bundling des types DTS pour le framework
      try {
        await bundleFrameworkDts(framework);
        this.logger.success(
          `Bundle DTS généré pour le framework ${frameworkName}`
        );
      } catch (dtsError) {
        this.logger.error(
          `Erreur lors de la génération du bundle DTS pour le framework ${frameworkName}:`,
          dtsError
        );
        return false;
      }

      this.logger.success(`Framework ${frameworkName} built successfully`);
      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors du build du framework ${frameworkName}:`,
        error
      );
      return false;
    }
  }
}

// Exporter l'instance
export const builder = Builder.me();
