/**
 * Utilitaires pour la gestion de la mémoire dans le plugin rollup-plugin-dts
 * Ce fichier contient des fonctions et classes qui utilisent des références faibles
 * pour permettre au garbage collector de libérer les objets TypeScript
 */

import ts from "typescript";

/**
 * Force l'exécution du garbage collector si disponible
 * @returns true si le GC a été forcé, false sinon
 */
export function forceGarbageCollection(): boolean {
  if (typeof global.gc === "function") {
    global.gc();
    return true;
  }
  return false;
}

/**
 * Cache utilisant des références faibles pour les objets SourceFile
 * Permet au garbage collector de libérer les objets même s'ils sont dans le cache
 */
export class WeakSourceFileCache {
  private cache = new WeakMap<
    ts.Program,
    Map<string, WeakRef<ts.SourceFile>>
  >();
  private registry = new FinalizationRegistry((key: string) => {
    // Cette fonction est appelée lorsque l'objet référencé est collecté par le GC
    // On pourrait ajouter ici du code pour nettoyer d'autres ressources si nécessaire
  });

  /**
   * Récupère un SourceFile du cache
   */
  get(program: ts.Program, fileName: string): ts.SourceFile | undefined {
    const programCache = this.cache.get(program);
    if (!programCache) return undefined;

    const sourceFileRef = programCache.get(fileName);
    if (!sourceFileRef) return undefined;

    return sourceFileRef.deref();
  }

  /**
   * Met un SourceFile dans le cache
   */
  set(program: ts.Program, fileName: string, sourceFile: ts.SourceFile): void {
    let programCache = this.cache.get(program);
    if (!programCache) {
      programCache = new Map<string, WeakRef<ts.SourceFile>>();
      this.cache.set(program, programCache);
    }

    const ref = new WeakRef(sourceFile);
    programCache.set(fileName, ref);
    this.registry.register(sourceFile, fileName);
  }

  /**
   * Nettoie le cache entier
   */
  clearAll() {
    // Créer une nouvelle WeakMap pour forcer la libération des références
    this.cache = new WeakMap<ts.Program, Map<string, WeakRef<ts.SourceFile>>>();

    // Forcer le GC si disponible
    if (typeof global.gc === "function") {
      global.gc();
    }
  }
}

/**
 * Cache de contenu des fichiers basé sur des WeakMap
 * Stocke le contenu des fichiers sans empêcher les objets Program d'être collectés
 */
export class WeakFileContentCache {
  private cache = new WeakMap<ts.Program, Map<string, string>>();

  /**
   * Récupère le contenu d'un fichier du cache
   */
  get(program: ts.Program, fileName: string): string | undefined {
    const programCache = this.cache.get(program);
    if (!programCache) return undefined;
    return programCache.get(fileName);
  }

  /**
   * Met le contenu d'un fichier dans le cache
   */
  set(program: ts.Program, fileName: string, content: string): void {
    let programCache = this.cache.get(program);
    if (!programCache) {
      programCache = new Map<string, string>();
      this.cache.set(program, programCache);
    }
    programCache.set(fileName, content);
  }

  /**
   * Récupère ou extrait le contenu d'un fichier
   * Si le contenu n'est pas dans le cache, il est extrait du SourceFile
   * puis mis en cache pour les utilisations futures
   */
  getOrExtract(program: ts.Program, fileName: string): string | undefined {
    // Vérifier d'abord le cache
    const cachedContent = this.get(program, fileName);
    if (cachedContent !== undefined) {
      return cachedContent;
    }

    // Si non trouvé dans le cache, extraire du SourceFile
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) return undefined;

    // Extraire le contenu et le mettre en cache
    const content = sourceFile.getFullText();
    this.set(program, fileName, content);

    return content;
  }

  /**
   * Nettoie le cache entier
   */
  clearAll() {
    // Créer une nouvelle WeakMap pour forcer la libération des références
    this.cache = new WeakMap<ts.Program, Map<string, string>>();

    // Forcer le GC si disponible
    if (typeof global.gc === "function") {
      global.gc();
    }
  }
}

// Instances globales des caches
export const sourceFileCache = new WeakSourceFileCache();
export const fileContentCache = new WeakFileContentCache();

/**
 * Extrait le contenu d'un fichier de manière optimisée pour la mémoire
 * @param program L'objet Program TypeScript
 * @param fileName Le nom du fichier
 * @returns Le contenu du fichier, ou undefined si le fichier n'existe pas
 */
export function getFileContent(
  program: ts.Program,
  fileName: string
): string | undefined {
  return fileContentCache.getOrExtract(program, fileName);
}

/**
 * Nettoie tous les caches de mémoire
 * Cette fonction est utile pour libérer la mémoire entre les traitements
 */
export function cleanupAllCaches() {
  // Nettoyer tous les caches
  sourceFileCache.clearAll();
  fileContentCache.clearAll();

  // Forcer le GC si disponible
  if (typeof global.gc === "function") {
    global.gc();
  }
}
