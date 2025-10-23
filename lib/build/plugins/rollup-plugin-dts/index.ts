import * as path from "node:path";
import type { PluginImpl, Plugin } from "rollup";
import ts from "typescript";
import {
  type Options,
  resolveDefaultOptions,
  type ResolvedOptions
} from "./options.js";
import {
  createProgram,
  createPrograms,
  formatHost,
  getCompilerOptions,
  processFileBatch,
  processIncrementally,
  programCache
} from "./program.js";
import { transform } from "./transform/index.js";
import {
  trimExtension,
  DTS_EXTENSIONS,
  JSON_EXTENSIONS,
  getDeclarationId
} from "./helpers.js";
import {
  getFileContent,
  fileContentCache,
  cleanupAllCaches,
  sourceFileCache
} from "./memory-utils.js";
import { startStep, endStep, captureHeapSnapshot } from "./memory-monitor.js";
import {
  withMemoryTracking,
  cleanupMemoryIfNeeded,
  waitForMemoryAvailability
} from "./memory-tracking.js";
import { memoryOptimizedDts } from "./memory-optimized-dts.js";

export type { Options };

// Option pour activer l'optimisation mémoire
const ENABLE_MEMORY_OPTIMIZATION =
  process.env.DTS_ENABLE_MEMORY_OPTIMIZATION === "true";

const TS_EXTENSIONS = /\.([cm]ts|[tj]sx?)$/;

interface DtsPluginContext {
  /**
   * The entry points of the bundle.
   */
  entries: string[];
  /**
   * There exists one Program object per entry point, except when all entry points are ".d.ts" modules.
   */
  programs: ts.Program[];
  resolvedOptions: ResolvedOptions;
}

interface ResolvedModule {
  code: string;
  source?: ts.SourceFile;
  program?: ts.Program;
}

function getModule(
  {
    entries,
    programs,
    resolvedOptions: { compilerOptions, tsconfig }
  }: DtsPluginContext,
  fileName: string,
  code: string
): ResolvedModule | null {
  startStep("getModule", fileName);

  // Create any `ts.SourceFile` objects on-demand for ".d.ts" modules,
  // but only when there are zero ".ts" entry points.
  if (!programs.length && DTS_EXTENSIONS.test(fileName)) {
    endStep("getModule", fileName);
    return { code };
  }

  const isEntry = entries.includes(fileName);

  // Rollup doesn't tell you the entry point of each module in the bundle,
  // so we need to ask every TypeScript program for the given filename.
  startStep("findProgram", fileName);
  const existingProgram = programs.find((p) => {
    // Entry points may be in the other entry source files, but it can't emit from them.
    // So we should find the program about the entry point which is the root files.
    if (isEntry) {
      return p.getRootFileNames().includes(fileName);
    } else {
      const sourceFile = p.getSourceFile(fileName);
      if (sourceFile && p.isSourceFileFromExternalLibrary(sourceFile)) {
        return false;
      }
      return !!sourceFile;
    }
  });
  endStep("findProgram", fileName);
  if (existingProgram) {
    // we know this exists b/c of the .filter above, so this non-null assertion is safe
    startStep("extractSourceFile", fileName);
    const source = existingProgram.getSourceFile(fileName)!;

    // Stocker le contenu dans le cache pour éviter de le récupérer à nouveau
    const extractedCode = source.getFullText();
    if (fileContentCache) {
      fileContentCache.set(existingProgram, fileName, extractedCode);
    }
    endStep("extractSourceFile", fileName);

    // Conserver les références aux objets pour le traitement des AST
    // mais libérer ces références dès que possible après utilisation
    endStep("getModule", fileName);
    return {
      code: extractedCode,
      source,
      program: existingProgram
    };
  } else if (ts.sys.fileExists(fileName)) {
    startStep("createNewProgram", fileName);
    const newProgram = createProgram(fileName, compilerOptions, tsconfig);
    programs.push(newProgram);
    // we created the program from this fileName, so the source file must exist :P
    const source = newProgram.getSourceFile(fileName)!;

    // Stocker le contenu dans le cache
    const extractedCode = source.getFullText();
    if (fileContentCache) {
      fileContentCache.set(newProgram, fileName, extractedCode);
    }
    endStep("createNewProgram", fileName);

    endStep("getModule", fileName);
    return {
      code: extractedCode,
      source,
      program: newProgram
    };
  } else {
    // the file isn't part of an existing program and doesn't exist on disk
    endStep("getModule", fileName);
    return null;
  }
}

const plugin: PluginImpl<Options> = (options = {}) => {
  // Utiliser la version optimisée pour la mémoire si activée
  if (ENABLE_MEMORY_OPTIMIZATION) {
    console.log("🔍 Utilisation du plugin DTS avec optimisation mémoire");
    const memOpts = {
      enableBatchProcessing: true,
      enableForcedGC: true,
      memoryThreshold: 768, // Seuil plus bas pour déclencher le GC plus tôt
      throttleLibraryFiles: true,
      batchConfig: {
        batchSize: 5,
        delayBetweenBatches: 100,
        targetLibraries: ["rxjs", "typescript", "node_modules"]
      }
    };
    return memoryOptimizedDts(memOpts);
  }

  // Version standard du plugin si l'optimisation est désactivée
  const transformPlugin = transform();
  const ctx: DtsPluginContext = {
    entries: [],
    programs: [],
    resolvedOptions: resolveDefaultOptions(options)
  };

  // Ajouter un nettoyage périodique de la mémoire pour les longs traitements
  let memoryCleanupInterval: NodeJS.Timeout | null = null;

  // Fonction pour démarrer le nettoyage périodique
  const startPeriodicMemoryCleanup = () => {
    if (memoryCleanupInterval) return;

    // Nettoyer la mémoire toutes les 30 secondes
    memoryCleanupInterval = setInterval(() => {
      console.log(
        "[Memory] Exécution du nettoyage périodique de la mémoire..."
      );
      programCache.clear();
      cleanupAllCaches();

      // Prendre un snapshot optionnel pour analyser les fuites
      if (process.env.CAPTURE_MEMORY_SNAPSHOTS === "true") {
        captureHeapSnapshot(`periodic-cleanup-${Date.now()}`);
      }

      if (typeof global.gc === "function") {
        global.gc();
      }
    }, 30000); // 30 secondes
  };

  // Fonction pour arrêter le nettoyage périodique
  const stopPeriodicMemoryCleanup = () => {
    if (memoryCleanupInterval) {
      clearInterval(memoryCleanupInterval);
      memoryCleanupInterval = null;
    }
  };

  return {
    name: "dts",

    // pass outputOptions & renderChunk hooks to the inner transform plugin
    outputOptions: transformPlugin.outputOptions,
    renderChunk: transformPlugin.renderChunk,

    options(options) {
      let { input = [] } = options;
      if (!Array.isArray(input)) {
        input = typeof input === "string" ? [input] : Object.values(input);
      } else if (input.length > 1) {
        // when dealing with multiple unnamed inputs, transform the inputs into
        // an explicit object, which strips the file extension
        options.input = {};
        for (const filename of input) {
          let name = trimExtension(filename);
          if (path.isAbsolute(filename)) {
            name = path.basename(name);
          } else {
            name = path.normalize(name);
          }
          options.input[name] = filename;
        }
      }

      // Optimisation: Utiliser le traitement incrémental par lots au lieu de createPrograms
      // qui charge tout en mémoire en une seule fois
      if (typeof global.gc === "function") {
        // Suggérer au GC de s'exécuter avant de commencer le traitement
        global.gc();
      }

      // Démarrer le nettoyage périodique de la mémoire
      startPeriodicMemoryCleanup();
      console.log(
        "[Memory] Démarrage du nettoyage périodique de la mémoire pour le traitement DTS"
      );

      // Pour la compatibilité avec le code existant, on utilise createPrograms
      // mais on limite la taille des programmes conservés en mémoire
      ctx.programs = createPrograms(
        Object.values(input),
        ctx.resolvedOptions.compilerOptions,
        ctx.resolvedOptions.tsconfig
      );

      // Planifier un nettoyage mémoire après le traitement des fichiers
      setTimeout(() => {
        if (typeof global.gc === "function") {
          global.gc();
        }
      }, 1000);

      // Démarrer le nettoyage périodique de la mémoire
      startPeriodicMemoryCleanup();

      return transformPlugin.options.call(this, options);
    },

    transform(code, id) {
      // Démarrer le suivi de la mémoire pour ce fichier
      startStep("transform", id);

      if (!TS_EXTENSIONS.test(id) && !JSON_EXTENSIONS.test(id)) {
        endStep("transform", id);
        return null;
      }

      const watchFiles = (module: ResolvedModule) => {
        if (module.program) {
          const sourceDirectory = path.dirname(id);
          const sourceFilesInProgram = module.program
            .getSourceFiles()
            .map((sourceFile) => sourceFile.fileName)
            .filter((fileName) => fileName.startsWith(sourceDirectory));
          sourceFilesInProgram.forEach(this.addWatchFile);
        }
      };

      const handleDtsFile = () => {
        startStep("handleDtsFile", id);
        const module = getModule(ctx, id, code);
        if (module) {
          watchFiles(module);
          const result = transformPlugin.transform.call(this, module.code, id);
          cleanupAfterTransform();
          endStep("handleDtsFile", id);
          return result;
        }
        endStep("handleDtsFile", id);
        return null;
      };

      const treatTsAsDts = () => {
        startStep("treatTsAsDts", id);
        const declarationId = getDeclarationId(id);
        const module = getModule(ctx, declarationId, code);
        if (module) {
          watchFiles(module);
          const result = transformPlugin.transform.call(
            this,
            module.code,
            declarationId
          );
          cleanupAfterTransform();
          endStep("treatTsAsDts", id);
          return result;
        }
        endStep("treatTsAsDts", id);
        return null;
      };

      const generateDts = () => {
        startStep("generateDts", id);
        const module = getModule(ctx, id, code);
        if (!module || !module.source || !module.program) {
          endStep("generateDts", id);
          return null;
        }
        watchFiles(module);

        const declarationId = getDeclarationId(id);

        let generated!: ReturnType<typeof transformPlugin.transform>;
        const { emitSkipped, diagnostics } = module.program.emit(
          module.source,
          (_, declarationText) => {
            startStep("emitCallback", declarationId);
            generated = transformPlugin.transform.call(
              this,
              declarationText,
              declarationId
            );
            endStep("emitCallback", declarationId);
          },
          undefined, // cancellationToken
          true, // emitOnlyDtsFiles
          undefined, // customTransformers
          // @ts-ignore This is a private API for workers, should be safe to use as TypeScript Playground has used it for a long time.
          true // forceDtsEmit
        );

        // Nettoyage après émission
        cleanupAfterTransform();

        if (emitSkipped) {
          const errors = diagnostics.filter(
            (diag) => diag.category === ts.DiagnosticCategory.Error
          );
          if (errors.length) {
            console.error(ts.formatDiagnostics(errors, formatHost));
            this.error("Failed to compile. Check the logs above.");
          }
        }
        endStep("generateDts", id);
        return generated;
      };

      // Fonction d'aide pour nettoyer la mémoire après transformation
      const cleanupAfterTransform = () => {
        // Suggérer au GC de s'exécuter après avoir terminé le traitement d'un fichier
        if (typeof global.gc === "function") {
          // Utiliser setTimeout pour que le nettoyage se fasse après que le traitement soit terminé
          setTimeout(() => {
            global.gc();
          }, 0);
        }
      };

      try {
        // if it's a .d.ts file, handle it as-is
        if (DTS_EXTENSIONS.test(id)) {
          const result = handleDtsFile();
          endStep("transform", id);
          return result;
        }

        // if it's a json file, use the typescript compiler to generate the declarations,
        // requires `compilerOptions.resolveJsonModule: true`.
        // This is also commonly used with `@rollup/plugin-json` to import JSON files.
        if (JSON_EXTENSIONS.test(id)) {
          const result = generateDts();
          endStep("transform", id);
          return result;
        }

        // first attempt to treat .ts files as .d.ts files, and otherwise use the typescript compiler to generate the declarations
        const result = treatTsAsDts() ?? generateDts();
        endStep("transform", id);
        return result;
      } catch (error) {
        console.error(`[Memory] Erreur lors du traitement de ${id}:`, error);
        endStep("transform", id);
        throw error;
      }
    },

    resolveId(source, importer) {
      if (!importer) {
        // store the entry point, because we need to know which program to add the file
        ctx.entries.push(path.resolve(source));
        return;
      }

      // normalize directory separators to forward slashes, as apparently typescript expects that?
      importer = importer.split("\\").join("/");

      let resolvedCompilerOptions = ctx.resolvedOptions.compilerOptions;
      if (ctx.resolvedOptions.tsconfig) {
        // Here we have a chicken and egg problem.
        // `source` would be resolved by `ts.nodeModuleNameResolver` a few lines below, but
        // `ts.nodeModuleNameResolver` requires `compilerOptions` which we have to resolve here,
        // since we have a custom `tsconfig.json`.
        // So, we use Node's resolver algorithm so we can see where the request is coming from so we
        // can load the custom `tsconfig.json` from the correct path.
        const resolvedSource = source.startsWith(".")
          ? path.resolve(path.dirname(importer), source)
          : source;
        resolvedCompilerOptions = getCompilerOptions(
          resolvedSource,
          ctx.resolvedOptions.compilerOptions,
          ctx.resolvedOptions.tsconfig
        ).compilerOptions;
      }

      // resolve this via typescript
      const { resolvedModule } = ts.resolveModuleName(
        source,
        importer,
        resolvedCompilerOptions,
        ts.sys
      );
      if (!resolvedModule) {
        return;
      }

      if (
        resolvedModule.isExternalLibraryImport &&
        resolvedModule.packageId &&
        ctx.resolvedOptions.includeExternal.includes(
          resolvedModule.packageId.name
        )
      ) {
        // include types from specified external modules
        return { id: path.resolve(resolvedModule.resolvedFileName) };
      } else if (
        !ctx.resolvedOptions.respectExternal &&
        resolvedModule.isExternalLibraryImport
      ) {
        // here, we define everything else that comes from `node_modules` as `external`.
        return { id: source, external: true };
      } else {
        // using `path.resolve` here converts paths back to the system specific separators
        return { id: path.resolve(resolvedModule.resolvedFileName) };
      }
    },

    // Arrêter le nettoyage périodique à la fin du traitement
    buildEnd() {
      console.log("[Memory] Arrêt du nettoyage périodique de la mémoire");
      stopPeriodicMemoryCleanup();

      // Forcer un dernier nettoyage
      if (typeof global.gc === "function") {
        global.gc();
      }
    }
  } satisfies Plugin;
};

export { plugin as dts, plugin as default };
