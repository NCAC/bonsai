import * as path from "node:path";
import ts from "typescript";
import { DTS_EXTENSIONS } from "./helpers.js";

export const formatHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getNewLine: () => ts.sys.newLine,
  getCanonicalFileName: ts.sys.useCaseSensitiveFileNames
    ? (f) => f
    : (f) => f.toLowerCase()
};

const DEFAULT_OPTIONS: ts.CompilerOptions = {
  // Ensure ".d.ts" modules are generated
  declaration: true,
  // Skip ".js" generation
  noEmit: false,
  emitDeclarationOnly: true,
  // Skip code generation when error occurs
  noEmitOnError: true,
  // Avoid extra work
  checkJs: false,
  declarationMap: false,
  skipLibCheck: true,
  // Ensure TS2742 errors are visible
  preserveSymlinks: true,
  // Ensure we can parse the latest code
  target: ts.ScriptTarget.ESNext,
  // Allows importing `*.json`
  resolveJsonModule: true
};

const configByPath = new Map<string, ts.ParsedCommandLine>();

const logCache = (...args: unknown[]) =>
  process.env.DTS_LOG_CACHE ? console.log("[cache]", ...args) : null;

/**
 * Caches the config for every path between two given paths.
 *
 * It starts from the first path and walks up the directory tree until it reaches the second path.
 */
function cacheConfig(
  [fromPath, toPath]: [from: string, to: string],
  config: ts.ParsedCommandLine
) {
  logCache(fromPath);
  configByPath.set(fromPath, config);
  while (
    fromPath !== toPath &&
    // make sure we're not stuck in an infinite loop
    fromPath !== path.dirname(fromPath)
  ) {
    fromPath = path.dirname(fromPath);
    logCache("up", fromPath);
    if (configByPath.has(fromPath)) return logCache("has", fromPath);
    configByPath.set(fromPath, config);
  }
}

export function getCompilerOptions(
  input: string,
  overrideOptions: ts.CompilerOptions,
  overrideConfigPath?: string
): {
  dtsFiles: Array<string>;
  dirName: string;
  compilerOptions: ts.CompilerOptions;
} {
  const compilerOptions = { ...DEFAULT_OPTIONS, ...overrideOptions };
  let dirName = path.dirname(input);
  let dtsFiles: Array<string> = [];

  // if a custom config is provided we'll use that as the cache key since it will always be used
  const cacheKey = overrideConfigPath || dirName;
  if (!configByPath.has(cacheKey)) {
    logCache("miss", cacheKey);
    const configPath = overrideConfigPath
      ? path.resolve(process.cwd(), overrideConfigPath)
      : ts.findConfigFile(dirName, ts.sys.fileExists);
    if (!configPath) {
      return { dtsFiles, dirName, compilerOptions };
    }
    const inputDirName = dirName;
    dirName = path.dirname(configPath);
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) {
      console.error(ts.formatDiagnostic(error, formatHost));
      return { dtsFiles, dirName, compilerOptions };
    }
    logCache("tsconfig", config);
    const configContents = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      dirName
    );
    if (overrideConfigPath) {
      // if a custom config is provided, we always only use that one
      cacheConfig([overrideConfigPath, overrideConfigPath], configContents);
    } else {
      // cache the config for all directories between input and resolved config path
      cacheConfig([inputDirName, dirName], configContents);
    }
  } else {
    logCache("HIT", cacheKey);
  }
  const { fileNames, options, errors } = configByPath.get(cacheKey)!;

  dtsFiles = fileNames.filter((name) => DTS_EXTENSIONS.test(name));
  if (errors.length) {
    console.error(ts.formatDiagnostics(errors, formatHost));
    return { dtsFiles, dirName, compilerOptions };
  }
  return {
    dtsFiles,
    dirName,
    compilerOptions: {
      ...options,
      ...compilerOptions
    }
  };
}

export function createProgram(
  fileName: string,
  overrideOptions: ts.CompilerOptions,
  tsconfig?: string
) {
  // Générer une clé de cache basée sur le nom du fichier et les options
  const cacheKey = `${fileName}|${tsconfig || ""}`;

  // Vérifier si le programme est dans le cache
  const cachedProgram = programCache.get(cacheKey);
  if (cachedProgram) {
    return cachedProgram;
  }

  // Optimisation: Forcer le GC avant de créer un nouveau programme volumineux
  if (typeof global.gc === "function" && fileName.includes("rxjs")) {
    global.gc();
  }

  // Créer un nouveau programme s'il n'est pas dans le cache
  const { dtsFiles, compilerOptions } = getCompilerOptions(
    fileName,
    overrideOptions,
    tsconfig
  );

  // Utiliser un ensemble de fichiers plus petit pour les gros fichiers comme rxjs
  const filesToProcess = [fileName];

  // Pour les fichiers volumineux, ne pas charger tous les fichiers .d.ts en même temps
  const isLargeLibrary =
    fileName.includes("rxjs") || fileName.includes("node_modules");

  // Limiter le nombre de fichiers à traiter simultanément pour les grandes bibliothèques
  const maxFilesToInclude = isLargeLibrary ? 10 : Number.MAX_SAFE_INTEGER;

  // Ne pas inclure plus de X fichiers .d.ts pour les grandes bibliothèques
  if (isLargeLibrary && dtsFiles.length > maxFilesToInclude) {
    console.log(
      `🔍 Traitement par lots pour ${fileName} (${dtsFiles.length} fichiers .d.ts)`
    );
  } else {
    filesToProcess.push(...Array.from(dtsFiles));
  }

  const newProgram = ts.createProgram(
    filesToProcess,
    compilerOptions,
    ts.createCompilerHost(compilerOptions, true)
  );

  // Mettre le programme dans le cache
  programCache.set(cacheKey, newProgram);

  return newProgram;
}

export function createPrograms(
  input: Array<string>,
  overrideOptions: ts.CompilerOptions,
  tsconfig?: string
) {
  const programs = [];
  const dtsFiles: Set<string> = new Set();
  let inputs: Array<string> = [];
  let dirName = "";
  let compilerOptions: ts.CompilerOptions = {};

  for (let main of input) {
    if (DTS_EXTENSIONS.test(main)) {
      continue;
    }

    main = path.resolve(main);
    const options = getCompilerOptions(main, overrideOptions, tsconfig);
    options.dtsFiles.forEach(dtsFiles.add, dtsFiles);

    if (!inputs.length) {
      inputs.push(main);
      ({ dirName, compilerOptions } = options);
      continue;
    }

    if (options.dirName === dirName) {
      inputs.push(main);
    } else {
      const host = ts.createCompilerHost(compilerOptions, true);
      const program = ts.createProgram(
        inputs.concat(Array.from(dtsFiles)),
        compilerOptions,
        host
      );
      programs.push(program);

      inputs = [main];
      ({ dirName, compilerOptions } = options);
    }
  }

  if (inputs.length) {
    const host = ts.createCompilerHost(compilerOptions, true);
    const program = ts.createProgram(
      inputs.concat(Array.from(dtsFiles)),
      compilerOptions,
      host
    );
    programs.push(program);
  }

  return programs;
}

/**
 * Traite un lot de fichiers avec libération de mémoire explicite après utilisation
 * Cette fonction est optimisée pour réduire l'utilisation de la mémoire
 * en évitant de conserver des références aux objets Program de TypeScript
 */
export function processFileBatch(
  fileNames: string[],
  overrideOptions: ts.CompilerOptions,
  tsconfig?: string
): { fileName: string; code: string }[] {
  const results: { fileName: string; code: string }[] = [];

  for (const fileName of fileNames) {
    // Ignorer les fichiers de définition existants
    if (DTS_EXTENSIONS.test(fileName)) {
      continue;
    }

    // Créer un programme dédié uniquement pour ce fichier
    const { dtsFiles, compilerOptions } = getCompilerOptions(
      fileName,
      overrideOptions,
      tsconfig
    );
    const host = ts.createCompilerHost(compilerOptions, true);
    const program = ts.createProgram(
      [fileName].concat(Array.from(dtsFiles)),
      compilerOptions,
      host
    );

    // Extraire le contenu du fichier
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile) {
      results.push({
        fileName,
        code: sourceFile.getFullText()
      });
    }

    // Aucune référence à program n'est conservée, permettant au GC de le libérer
  }

  // Suggérer au garbage collector de s'exécuter (si disponible)
  if (typeof global.gc === "function") {
    global.gc();
  }

  return results;
}

/**
 * Traite une liste de fichiers de manière incrémentale, par lots
 * Cette approche permet au garbage collector de libérer la mémoire entre chaque lot
 */
export async function processIncrementally(
  input: string[],
  overrideOptions: ts.CompilerOptions,
  tsconfig?: string,
  batchSize = 10
): Promise<{ fileName: string; code: string }[]> {
  const results: { fileName: string; code: string }[] = [];

  // Phase 1 : Analyser les fichiers d'entrée pour déterminer l'ensemble complet des fichiers à traiter
  const allFiles = new Set<string>();

  for (const inputFile of input) {
    if (DTS_EXTENSIONS.test(inputFile)) {
      continue;
    }

    allFiles.add(path.resolve(inputFile));

    // On pourrait ajouter ici une logique pour identifier les dépendances
    // et les ajouter à allFiles si nécessaire
  }

  // Phase 2 : Traiter les fichiers par lots
  const fileBatches: string[][] = [];
  let currentBatch: string[] = [];

  for (const file of allFiles) {
    currentBatch.push(file);

    if (currentBatch.length >= batchSize) {
      fileBatches.push([...currentBatch]);
      currentBatch = [];
    }
  }

  // Ajouter le dernier lot s'il n'est pas vide
  if (currentBatch.length > 0) {
    fileBatches.push(currentBatch);
  }

  // Phase 3 : Traiter chaque lot séquentiellement
  for (const batch of fileBatches) {
    const batchResults = processFileBatch(batch, overrideOptions, tsconfig);
    results.push(...batchResults);

    // Vider le cache après chaque lot pour libérer la mémoire
    programCache.clear();

    // Forcer le GC si disponible
    if (typeof global.gc === "function") {
      global.gc();
    }

    // Pause courte pour donner au GC une chance de faire son travail
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return results;
}

/**
 * Cache intelligent pour les objets Program de TypeScript
 * Utilise une stratégie LRU (Least Recently Used) pour limiter
 * le nombre d'objets Program conservés en mémoire
 */
class ProgramCache {
  private programs = new Map<string, WeakRef<ts.Program>>();
  private usageCount = new Map<string, number>();
  private maxSize: number;
  private registry = new FinalizationRegistry<string>((key) => {
    // Nettoyage lorsqu'un programme est collecté par le GC
    this.usageCount.delete(key);
    console.log(`🧹 Programme libéré par le GC: ${key}`);
  });

  constructor(maxSize = 5) {
    this.maxSize = maxSize;
  }

  /**
   * Récupère un programme du cache
   * @param key La clé identifiant le programme
   * @returns Le programme s'il existe dans le cache, sinon undefined
   */
  get(key: string): ts.Program | undefined {
    const programRef = this.programs.get(key);
    if (programRef) {
      const program = programRef.deref();
      if (program) {
        // Incrémenter le compteur d'utilisation
        this.usageCount.set(key, (this.usageCount.get(key) || 0) + 1);
        return program;
      } else {
        // Si l'objet a été collecté par le GC, nettoyer les entrées
        this.programs.delete(key);
        this.usageCount.delete(key);
      }
    }
    return undefined;
  }

  /**
   * Ajoute un programme au cache
   * @param key La clé identifiant le programme
   * @param program L'objet Program à mettre en cache
   */
  set(key: string, program: ts.Program): void {
    // Si le cache est plein, supprimer le programme le moins utilisé
    if (this.programs.size >= this.maxSize) {
      let leastUsedKey = "";
      let leastUsedCount = Infinity;

      for (const [k, count] of this.usageCount.entries()) {
        if (count < leastUsedCount) {
          leastUsedKey = k;
          leastUsedCount = count;
        }
      }

      if (leastUsedKey) {
        this.programs.delete(leastUsedKey);
        this.usageCount.delete(leastUsedKey);
      }

      // Forcer le GC lorsque nous atteignons la limite de cache
      this.triggerGarbageCollection();
    }

    // Stocker le programme avec une référence faible
    const programRef = new WeakRef(program);
    this.programs.set(key, programRef);
    this.usageCount.set(key, 1);
    this.registry.register(program, key);
  }

  /**
   * Vide le cache et libère la mémoire
   */
  clear(): void {
    this.programs.clear();
    this.usageCount.clear();
    this.triggerGarbageCollection();
  }

  /**
   * Déclenche le garbage collector si disponible
   */
  private triggerGarbageCollection(): void {
    if (typeof global.gc === "function") {
      global.gc();
    }
  }

  /**
   * Retourne le nombre de programmes dans le cache
   */
  get size(): number {
    // Compter uniquement les programmes qui n'ont pas été collectés par le GC
    let activeCount = 0;
    for (const programRef of this.programs.values()) {
      if (programRef.deref()) {
        activeCount++;
      }
    }
    return activeCount;
  }
}

// Instance globale du cache pour les programmes
export const programCache = new ProgramCache(2); // Limiter à 2 programmes en mémoire pour réduire l'empreinte mémoire
