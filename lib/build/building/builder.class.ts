import { rollup, RollupOptions } from "rollup";
import fs from "fs-extra";
import { join, dirname, relative } from "node:path";
import { execSync } from "node:child_process";
import { Logger } from "@build/monitoring/logger.class";
import { BuildOptions } from "@lib/build/initializing/build-options.class";
import { PathManager } from "@build/core/path-manager.class";
import { TFramework, TPackage } from "@build/build.type";
import { ComponentsRegistry } from "@lib/build/initializing/components-registry";

import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import { createDtsRollupConfig, postProcessDts } from "./dts-config";

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

      // Créer la configuration Rollup — passe JS uniquement (format ES)
      // La passe DTS est effectuée globalement dans buildFramework (ADR-0032)
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
          })
        ],
        external: component.dependencies
      };

      // Effectuer le build JS
      this.logger.info(`Génération du bundle JS pour ${componentName}...`);
      const jsBundle = await rollup(jsRollupConfig);
      await jsBundle.write(jsRollupConfig.output as any);
      await jsBundle.close();

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

        this.logger.success(
          `📄 Types file copied: ${sourceIndexDts} → ${targetIndexDts}`
        );
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
        this.logger.debug(
          `No src folder found for types-only package ${componentName}, which is normal`
        );
      }

      this.logger.success(
        `✅ Types-only package ${componentName} processed successfully`
      );
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
          typescript({
            tsconfig: join(this.pathManager.rootPath, "tsconfig.json"),
            tsconfigOverride: {
              compilerOptions: {
                declaration: false,
                target: "es2020",
                module: "esnext"
              },
              include: [`${component.srcPath}/**/*`],
              exclude: ["node_modules", "**/*.test.ts", "**/*.spec.ts"]
            },
            clean: true
          })
        ],
        external: component.dependencies
      };

      // Effectuer le build JS
      this.logger.info(`Génération du bundle pour ${componentName}...`);
      const bundle = await rollup(jsRollupConfig);
      await bundle.write(jsRollupConfig.output as any);
      await bundle.close();

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
      if (this.buildOptions.all.clean) {
        await this.cleanOutputDir(framework.distPath);
      }

      await this.ensureOutputDirExists(framework.outJsFile);

      // ── Passe 1 : JS — bundle ESM (ADR-0032) ──────────────
      const jsRollupConfig: RollupOptions = {
        input: framework.srcFile,
        output: {
          file: framework.outJsFile,
          format: "es",
          sourcemap: false
        },
        plugins: [
          nodeResolve({
            extensions: [".ts", ".js", ".json"],
            preferBuiltins: false
          }),
          commonjs(),
          typescript({
            tsconfig: join(this.pathManager.rootPath, "tsconfig.json"),
            tsconfigOverride: {
              compilerOptions: {
                declaration: false,
                target: "es2020",
                module: "esnext"
              },
              include: [`${framework.srcPath}/**/*`],
              exclude: ["node_modules", "**/*.test.ts", "**/*.spec.ts"]
            },
            clean: true
          })
        ],
        // ADR-0032 §3 : TOUT inliner — zéro dépendance transitive
        // valibot (Tier 1), immer (Tier 2), rxjs (Tier 3) + tous les @bonsai/*
        external: [],
        onwarn(warning, defaultHandler) {
          if (warning.code === "CIRCULAR_DEPENDENCY") return;
          defaultHandler(warning);
        }
      };

      this.logger.info(
        `Passe JS — Génération du bundle ESM pour ${frameworkName}...`
      );
      const jsBundle = await rollup(jsRollupConfig);
      await jsBundle.write(jsRollupConfig.output as any);
      await jsBundle.close();
      this.logger.success(`Passe JS terminée — ${framework.outJsFile}`);

      // ── Passe 2 : DTS — bundle des déclarations TypeScript ──
      this.logger.info("Passe DTS — Bundling des déclarations TypeScript...");
      await this.buildFrameworkDts(framework);
      this.logger.success(`Passe DTS terminée — ${framework.outDtsFile}`);

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

  /**
   * Passe DTS du framework — génère un bonsai.d.ts flat via rollup-plugin-dts
   *
   * Flux (reproduit le PoC ADR-0032 §11) :
   *   1. tsc --emitDeclarationOnly → .d.ts individuels dans .dts-temp/
   *   2. rollup + rollup-plugin-dts → bonsai.d.ts (bundle unique, tout inliné)
   *   3. Post-processing : suppression des /// <reference path> parasites
   *   4. Nettoyage du répertoire temporaire
   */
  private async buildFrameworkDts(framework: TFramework): Promise<void> {
    const rootPath = this.pathManager.rootPath;
    const tempDir = join(rootPath, ".dts-temp");
    const tempTsconfig = join(rootPath, ".dts-tsconfig.json");

    try {
      // Récupérer tous les composants depuis le registry
      const components = ComponentsRegistry.me().organizedComponents;
      if (!components) {
        throw new Error(
          "ComponentsRegistry non initialisé — appeler collect() d'abord"
        );
      }

      const allPackages = [...components.libraries, ...components.packages];

      // ── 1. Construire les paths tsc et les includes ───────
      const tscPaths: Record<string, string[]> = {};
      const includes: string[] = [
        relative(rootPath, framework.srcPath) + "/**/*.ts"
      ];

      for (const pkg of allPackages) {
        if (pkg.isTypesOnly) {
          // Types-only : résolution vers l'index.d.ts original (convention)
          const indexRel = relative(rootPath, join(pkg.rootPath, "index"));
          tscPaths[pkg.name] = [`./${indexRel}`];
        } else {
          const srcRel = relative(rootPath, pkg.srcFile).replace(/\.ts$/, "");
          tscPaths[pkg.name] = [`./${srcRel}`];
          includes.push(relative(rootPath, pkg.srcPath) + "/**/*.ts");
        }
      }

      // ── 2. Écrire le tsconfig temporaire ──────────────────
      const tsconfigContent = {
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
          outDir: "./.dts-temp",
          rootDir: ".",
          module: "ESNext",
          moduleResolution: "node",
          target: "ES2020",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          baseUrl: ".",
          paths: tscPaths
        },
        include: includes
      };

      await fs.writeJson(tempTsconfig, tsconfigContent, { spaces: 2 });

      // ── 3. tsc --emitDeclarationOnly ──────────────────────
      this.logger.debug("Génération des .d.ts individuels (tsc)...");
      try {
        execSync(`npx tsc -p "${tempTsconfig}"`, {
          cwd: rootPath,
          stdio: "pipe",
          encoding: "utf-8"
        });
      } catch (tscError: any) {
        // tsc peut émettre des .d.ts même avec des erreurs non-bloquantes
        const barrelDts = join(
          tempDir,
          relative(rootPath, framework.srcFile).replace(/\.ts$/, ".d.ts")
        );
        if (fs.existsSync(barrelDts)) {
          this.logger.warn(
            "tsc a émis des erreurs mais les .d.ts ont été générés — on continue"
          );
        } else {
          throw new Error(
            `tsc --emitDeclarationOnly a échoué sans produire de .d.ts : ${
              tscError.stderr?.toString().slice(0, 500) || tscError.message
            }`
          );
        }
      }

      // ── 4. Construire les paths rollup-plugin-dts ─────────
      // Types-only : résolution originale (déjà .d.ts)
      // Réguliers : pointer vers les .d.ts générés dans .dts-temp/
      const dtsPaths: Record<string, string[]> = {};
      for (const pkg of allPackages) {
        if (pkg.isTypesOnly) {
          const indexRel = relative(rootPath, join(pkg.rootPath, "index"));
          dtsPaths[pkg.name] = [`./${indexRel}`];
        } else {
          const srcRel = relative(rootPath, pkg.srcFile).replace(/\.ts$/, "");
          dtsPaths[pkg.name] = [`./.dts-temp/${srcRel}`];
        }
      }

      // ── 5. rollup + rollup-plugin-dts ─────────────────────
      const barrelDts = join(
        tempDir,
        relative(rootPath, framework.srcFile).replace(/\.ts$/, ".d.ts")
      );

      const { input, output } = createDtsRollupConfig({
        inputDts: barrelDts,
        outputDts: framework.outDtsFile,
        tsconfig: tempTsconfig,
        compilerOptions: {
          baseUrl: rootPath,
          paths: dtsPaths
        },
        external: [] // ADR-0032 §3 : tout inliner
      });

      const dtsBundle = await rollup(input);
      await dtsBundle.write(output);
      await dtsBundle.close();

      // ── 6. Post-processing ────────────────────────────────
      // Collecter les namespaces publics des wrappers (champ `namespace` du package.json)
      // Ex : ["RXJS", "Valibot"] — utilisé pour renommer les alias rollup internes
      const knownNamespaces = allPackages
        .map((p) => p.namespace)
        .filter((ns): ns is string => typeof ns === "string" && ns.length > 0);

      const { removedRefs, renamedNamespaces } = postProcessDts(
        framework.outDtsFile,
        knownNamespaces
      );
      if (removedRefs > 0) {
        this.logger.debug(
          `Post-processing : ${removedRefs} triple-slash reference(s) supprimée(s)`
        );
      }
      if (Object.keys(renamedNamespaces).length > 0) {
        this.logger.info(
          `Post-processing : namespaces renommés — ${Object.entries(
            renamedNamespaces
          )
            .map(([k, v]) => `${k} → ${v}`)
            .join(", ")}`
        );
      }

      // ── 7. Statistiques ───────────────────────────────────
      const stat = await fs.stat(framework.outDtsFile);
      this.logger.info(`bonsai.d.ts — ${Math.round(stat.size / 1024)} KB`);
    } finally {
      // ── 8. Nettoyage ──────────────────────────────────────
      await fs.remove(tempDir).catch(() => {});
      await fs.remove(tempTsconfig).catch(() => {});
    }
  }
}

// Exporter l'instance
export const builder = Builder.me();
