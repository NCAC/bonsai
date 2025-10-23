import { join, dirname, resolve } from "node:path";
import prettyHrTime from "pretty-hrtime";
import fileSystem from "fs-extra";
import chalk from "chalk";
import { IPackageJson } from "package-json-type";
import {
  InputOptions,
  InputPluginOption,
  OutputOptions,
  RollupOptions,
  RollupError
} from "rollup";
import alias, { RollupAliasOptions } from "@rollup/plugin-alias";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";
import commonJs from "@rollup/plugin-commonjs";
import { dts } from "@build/plugins/rollup-plugin-dts";
import postprocess from "@build/plugins/rollup-plugin-postprocess";
import { watch, FSWatcher } from "chokidar";
import {
  TFramework,
  TPackage,
  TPackagesAndFrameWork
} from "@build/getFrameworkPackages";

import { BuildEventManager } from "@build/BuildEventManager";

export function onwarn({ loc, frame, message }: RollupError) {
  if (loc) {
    console.warn(`${loc.file} (${loc.line}:${loc.column}) ${message}`);
    if (frame) console.warn(frame);
  } else {
    console.warn(message);
  }
}

export type TStoredPackage = {
  rootPath: string;
  packageName: string;
  distPath: string;
  srcPath: string;
  outJsFile: string;
  outDtsFile: string;
  srcFile: string;
  externalName?: string; // Propriété optionnelle pour les packages externes
  rollupOptions: {
    js: { input: RollupOptions; output: OutputOptions };
    dts: { input: RollupOptions; output: OutputOptions };
  };
};

export type TStoredFramework = TStoredPackage & {
  tmpOutDtsFile: string;
};

export class BuildStoreConfig {
  private static _instance: BuildStoreConfig;

  private _start: [number, number] = [0, 0];

  private _events: BuildEventManager;

  // Propriétés pour stocker les catégories de packages
  private _librariesPackages: TStoredPackage[] = [];
  private _internalPackages: TStoredPackage[] = [];

  // Méthodes pour accéder aux catégories
  public getLibrariesPackages(): TStoredPackage[] {
    return this._librariesPackages;
  }

  public getInternalPackages(): TStoredPackage[] {
    return this._internalPackages;
  }

  public get events() {
    return this._events;
  }

  // Stocker les références aux observateurs
  private _watchers: FSWatcher[] = [];

  private _rootPath: string;

  get rootPath() {
    return this._rootPath;
  }

  public static getInstance(): BuildStoreConfig {
    return BuildStoreConfig._instance;
  }

  public static async initWork(packagesAndFramework: TPackagesAndFrameWork) {
    if (!BuildStoreConfig._instance) {
      try {
        BuildStoreConfig._instance = new BuildStoreConfig(packagesAndFramework);
        const buildStoreConfig = BuildStoreConfig._instance;
        buildStoreConfig._events = new BuildEventManager();

        // const hasTest = await promptIfTest();
        // if (hasTest) {
        //   const test = await promptUserTest(buildStoreConfig);
        //   buildStoreConfig._setTest(test);
        // } else {
        //   buildStoreConfig._test = null;
        // }
        return buildStoreConfig;
      } catch (error) {
        throw error;
      }
    }
    return BuildStoreConfig._instance;
  }

  // public static async initTest(packagesAndFramework: TPackagesAndFrameWork) {
  //   if (!BuildStoreConfig._instance) {
  //     try {
  //       BuildStoreConfig._instance = new BuildStoreConfig(packagesAndFramework);
  //       const buildStoreConfig = BuildStoreConfig._instance;
  //       buildStoreConfig._events = new BuildEventManager();
  //       const test = await promptUserTest(buildStoreConfig);
  //       buildStoreConfig._setTest(test);
  //       return buildStoreConfig;
  //     } catch (error) {
  //       throw error;
  //     }
  //   }
  //   return BuildStoreConfig._instance;
  // }

  private constructor(packagesAndFramework: TPackagesAndFrameWork) {
    this._rootPath = packagesAndFramework.rootPath;
    this._setPackages(packagesAndFramework.packages);
    this._setFramework(packagesAndFramework.framework);

    // Stocker les catégories définies dans le fichier YAML
    this._librariesPackages = packagesAndFramework.phases.libraries.map(
      (pkg) => {
        // Trouver le package correspondant dans this._packages
        return [...this._packages].find(
          (p) => p.packageName === pkg.name
        ) as TStoredPackage;
      }
    );

    this._internalPackages = packagesAndFramework.phases.packages.map((pkg) => {
      // Trouver le package correspondant dans this._packages
      return [...this._packages].find(
        (p) => p.packageName === pkg.name
      ) as TStoredPackage;
    });
  }

  //#region framework
  private _framework: TStoredFramework;
  get framework() {
    return this._framework;
  }

  private _setFramework(framework: TFramework) {
    const rootPath = framework.rootPath;
    const srcPath = join(framework.rootPath, "src");
    const distPath = join(framework.rootPath, "dist");
    const srcFile = join(rootPath, framework.src);
    const outJsFile = join(rootPath, framework.out);
    const aliasEntries: RollupAliasOptions["entries"] = [...this.packages].map(
      (storedPackage) => {
        return {
          find: storedPackage.packageName,
          replacement: storedPackage.outJsFile
        };
      }
    );

    const inputJsOptions: InputOptions = {
      input: srcFile,
      onwarn,
      plugins: [
        // alias({ entries: aliasEntries }),
        nodeResolve({
          preferBuiltins: false
        }),
        typescript({
          tsconfig: join(this.rootPath, "tsconfig.json")
        })
      ]
    };
    const outputJsOptions: OutputOptions = {
      file: outJsFile,
      format: "esm"
    };

    const tmpOutDtsFile = join(distPath, `tmp_${framework.name}.d.ts`);
    const outDtsFile = join(rootPath, framework.types);
    const inputDtsOptions: InputOptions = {
      input: srcFile,
      onwarn,
      plugins: [dts({ respectExternal: true })]
    };
    const outputDtsOptions: OutputOptions = {
      file: outDtsFile,
      format: "es"
    };

    this._framework = {
      rootPath,
      packageName: framework.name,
      srcFile,
      distPath,
      srcPath,
      outJsFile,
      tmpOutDtsFile,
      outDtsFile,
      externalName: undefined, // Le framework n'est pas un package externe
      rollupOptions: {
        js: {
          input: inputJsOptions,
          output: outputJsOptions
        },
        dts: {
          input: inputDtsOptions,
          output: outputDtsOptions
        }
      }
    };
  }
  //#endregion

  //#region packages
  private _packages: Set<TStoredPackage> = new Set();
  get packages() {
    return this._packages;
  }
  private _setPackages(packages: Set<TPackage>) {
    packages.forEach((myPackage) => {
      const tsconfig = join(myPackage.rootPath, "tsconfig.json");
      const inputJsOptions: InputOptions = {
        input: myPackage.src,
        onwarn,
        plugins: [nodeResolve(), commonJs(), typescript({ tsconfig })]
      };
      const outputJsOptions: OutputOptions = {
        file: myPackage.out,
        format: "esm"
      };

      // Utiliser externalName au lieu de external_name pour plus de clarté
      const externalName = myPackage.external_name;

      if (externalName) {
        outputJsOptions.inlineDynamicImports = true;
        outputJsOptions.name = externalName;
        outputJsOptions.esModule = true;
        outputJsOptions.banner = `export const ${externalName} = (function () {`;
        outputJsOptions.footer = "})();";
        outputJsOptions.exports = "named";

        // Créer la regex une seule fois par package pour éviter des recréations coûteuses
        const regexPattern = String.raw`^\s*export\s*\{\s*(\S*)\s+as\s+${externalName}\s*\};*$`;
        const regex = new RegExp(regexPattern, "m");

        outputJsOptions.plugins = [
          postprocess([{ find: regex, replace: `return $1;` }])
        ];
      }

      const inputDtsOptions: RollupOptions = {
        input: myPackage.src,
        onwarn,
        plugins: externalName
          ? [
              dts({
                respectExternal: true,
                tsconfig
              })
            ]
          : [
              dts({
                tsconfig
              })
            ]
      };

      // Configuration spécifique pour les DTS des packages externes
      if (
        externalName &&
        (myPackage.name === "@bonsai/rxjs" ||
          myPackage.name === "@bonsai/remeda" ||
          myPackage.name === "@bonsai/zod")
      ) {
        console.log(
          `Configuration spéciale des DTS pour le package externe: ${myPackage.name}`
        );

        // Configurer les options DTS spécifiques pour les packages externes
        inputDtsOptions.external = []; // Ne pas traiter les imports comme externes pour générer un bundle autonome
      }
      const outputDtsOptions: OutputOptions = {
        file: myPackage.types,
        format: "es"
      };

      if (myPackage.dependencies.length) {
        inputJsOptions.external = myPackage.dependencies;
      }

      const rollupOptions = {
        js: {
          input: inputJsOptions,
          output: outputJsOptions
        },
        dts: {
          input: inputDtsOptions,
          output: outputDtsOptions
        }
      };

      this._packages.add({
        rootPath: myPackage.rootPath,
        packageName: myPackage.name,
        distPath: join(myPackage.rootPath, "dist"),
        srcPath: join(myPackage.rootPath, "src"),
        outJsFile: myPackage.out,
        srcFile: myPackage.src,
        outDtsFile: myPackage.types,
        externalName: externalName || undefined,
        rollupOptions
      });
    });
  }
  //#endregion

  get start() {
    return this._start;
  }
  set start(time: [number, number]) {
    this._start = time;
  }

  public watch() {
    // Nettoyer les anciens observateurs avant d'en créer de nouveaux
    this.closeWatchers();

    // Grouper les packages par type pour une meilleure lisibilité dans les logs
    const externalPackages = [...this._packages].filter(
      (pkg) => pkg.externalName !== undefined
    );
    const internalPackages = [...this._packages].filter(
      (pkg) => pkg.externalName === undefined
    );

    // Log des packages surveillés
    console.log("\n=== Configuration de la surveillance des fichiers ===");
    console.log(
      "Packages externes surveillés:",
      externalPackages.map((p) => p.packageName).join(", ")
    );
    console.log(
      "Packages internes surveillés:",
      internalPackages.map((p) => p.packageName).join(", ")
    );

    // Configurer les observateurs pour tous les packages
    [...this._packages].forEach((pkg) => {
      const isExternalPackage = pkg.externalName !== undefined;
      const packageType = isExternalPackage ? "externe" : "interne";

      console.log(
        `Configuration de l'observateur pour ${pkg.packageName} (package ${packageType})`
      );

      const watcher = watch(pkg.srcPath);
      watcher.on("change", (updated) => {
        console.log(
          `Fichier modifié détecté: ${updated} dans le package ${pkg.packageName}`
        );
        this._events.emit("package:updated", {
          pkg: pkg.packageName,
          file: updated
        });
      });
      this._watchers.push(watcher);
    });

    console.log("=== Surveillance des fichiers activée ===\n");

    // if (isNonNull(this._test)) {
    //   watch(`${this._test.srcPath}/**/*.ts`).on("change", (updated) => {
    //     console.log(updated);
    //     this._events.emit("test:ts:updated", updated);
    //   });
    //   watch(`${this._test.srcPath}/**/*.pug`).on("change", (updated) => {
    //     this._events.emit("test:pug:updated", updated);
    //   });
    // }
  }

  public log(...messages: string[]) {
    const args = Array.prototype.slice.call(arguments) as string[];
    const sig = chalk.green(`[${this.framework.packageName}]`);
    args.unshift(sig);
    console.log.apply(console, args);
    return this;
  }

  public logError(...messages: string[]) {
    const args = Array.prototype.slice.call(arguments) as string[];
    const sig = `${chalk.green(
      "[" + this.framework.packageName + "]"
    )} ${chalk.red("Error !")}`;
    args.unshift(sig);
    console.trace.apply(console, args);
    return this;
  }

  public duration(start: [number, number]) {
    return chalk.magenta(prettyHrTime(process.hrtime(start)));
  }

  // Méthode pour fermer tous les observateurs
  public closeWatchers() {
    this._watchers.forEach((watcher) => {
      watcher.close();
    });
    this._watchers = [];
  }

  // Méthode pour nettoyer toutes les ressources
  public cleanup() {
    this.closeWatchers();
    this._events.removeAllListeners();
    // Nettoyage d'autres ressources...
  }
}
