// 1. Bibliothèques standard Node.js
import { join } from "node:path";
// 2. Dépendances externes
import fileSystem from "fs-extra";
// 3. Modules internes du framework
import { PathManager } from "@build/core/path-manager.class";
import { Logger } from "@build/monitoring/logger.class";
import { hashFileContent } from "@build/cache/hash-utils";
import { LibraryCache } from "@build/cache/library-cache.class";
import { PackageCache } from "@build/cache/package-cache.class";
import {
  ComponentsRegistry,
  componentsRegistry
} from "@build/initializing/components-registry";

/**
 * Interface pour une entrée de cache
 */
interface ICacheEntry {
  hash: string;
  timestamp: number;
  dependencies: string[];
  dependenciesHashes: Record<string, string>;
}

/**
 * Classe pour gérer le cache de build
 */
export class BuildCache {
  private static instance: BuildCache;
  private cacheDir: string;
  private cacheMap: Map<string, ICacheEntry> = new Map();
  private logger: Logger;
  private pathManager: PathManager;
  private cacheEnabled: boolean = true;
  private static libraryCacheInstance: LibraryCache | null = null;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor(cacheDir: string = ".bonsai-cache") {
    this.pathManager = PathManager.me();
    this.cacheDir = join(this.pathManager.rootPath, cacheDir);
    this.logger = Logger.me();
    // Suppression de l'appel à la méthode synchrone initCache()
    // L'initialisation doit être faite via waitReady() (asynchrone)
  }

  /**
   * Obtenir l'instance du cache
   */
  public static me(cacheDir?: string): BuildCache {
    if (!BuildCache.instance) {
      BuildCache.instance = new BuildCache(cacheDir);
    }
    return BuildCache.instance;
  }

  /**
   * Initialiser le cache de façon asynchrone et robuste.
   * Cette méthode est appelée au démarrage pour charger le cache depuis le disque.
   * Elle garantit la création du dossier cache et la lecture du fichier index si présent.
   * Utilise fs-extra pour la robustesse et la compatibilité cross-plateforme.
   * \u26a0\ufe0f Utilisez toujours waitReady() pour garantir l'initialisation asynchrone du cache avant tout accès. L'appel direct au constructeur est interdit (singleton).
   */
  private async initCacheAsync(): Promise<void> {
    try {
      await fileSystem.ensureDir(this.cacheDir);
      const cacheIndexPath = join(this.cacheDir, "cache-index.json");

      if (await fileSystem.pathExists(cacheIndexPath)) {
        const cacheIndex = await fileSystem.readJSON(cacheIndexPath);
        this.cacheMap = new Map(Object.entries(cacheIndex));
      }
    } catch (error) {
      this.logger.warn(`Erreur lors de l'initialisation du cache: ${error}`);
      this.cacheEnabled = false;
    }
  }

  /**
   * Attendre que le cache soit prêt (asynchrone, à utiliser dans le build orchestrator).
   * Permet de garantir que le cache est chargé avant tout accès.
   */
  public async waitReady(): Promise<void> {
    await this.initCacheAsync();
  }

  /**
   * Activer ou désactiver le cache
   */
  public setEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }

  /**
   * Vérifier si une entrée est valide dans le cache
   */
  public isValid(
    key: string,
    filePath: string,
    dependencies: string[] = []
  ): boolean {
    if (!this.cacheEnabled) return false;

    const entry = this.cacheMap.get(key);
    if (!entry) return false;

    try {
      // Vérifier si le fichier a été modifié
      const currentHash = hashFileContent(filePath);
      if (currentHash !== entry.hash) return false;

      // Vérifier si les dépendances ont été modifiées
      for (const dep of dependencies) {
        if (!fileSystem.existsSync(dep)) continue;

        const depHash = hashFileContent(dep);
        if (
          !entry.dependenciesHashes[dep] ||
          entry.dependenciesHashes[dep] !== depHash
        ) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.debug(
        `Erreur lors de la vérification du cache pour ${key}: ${error}`
      );
      return false;
    }
  }

  /**
   * Mettre à jour une entrée dans le cache
   */
  public update(
    key: string,
    filePath: string,
    dependencies: string[] = []
  ): void {
    if (!this.cacheEnabled) return;

    try {
      const hash = hashFileContent(filePath);
      const dependenciesHashes: Record<string, string> = {};

      // Calculer les hashes des dépendances
      for (const dep of dependencies) {
        if (fileSystem.existsSync(dep)) {
          dependenciesHashes[dep] = hashFileContent(dep);
        }
      }

      // Mettre à jour l'entrée de cache
      this.cacheMap.set(key, {
        hash,
        timestamp: Date.now(),
        dependencies,
        dependenciesHashes
      });

      // Enregistrer périodiquement le cache
      this.saveCacheAsync();
    } catch (error) {
      this.logger.debug(
        `Erreur lors de la mise à jour du cache pour ${key}: ${error}`
      );
    }
  }

  /**
   * Sauvegarder le cache sur disque (asynchrone, robuste, atomique).
   */
  public async saveCacheAsync(): Promise<void> {
    if (!this.cacheEnabled) return;
    try {
      const cacheIndexPath = join(this.cacheDir, "cache-index.json");
      await fileSystem.writeJSON(
        cacheIndexPath,
        Object.fromEntries(this.cacheMap),
        {
          spaces: 2
        }
      );
      // Log supprimé : sauvegarde normale
    } catch (error) {
      this.logger.warn(`Erreur lors de la sauvegarde du cache: ${error}`);
    }
  }

  /**
   * Nettoyer les entrées obsolètes du cache
   */
  public cleanOldEntries(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    if (!this.cacheEnabled) return;

    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cacheMap.entries()) {
      if (now - entry.timestamp > maxAgeMs) {
        this.cacheMap.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(
        `Nettoyage du cache: ${removedCount} entrées obsolètes supprimées`
      );
      // Remplacer saveCache() par saveCacheAsync() (asynchrone)
      this.saveCacheAsync();
    }
  }

  /**
   * Obtenir une statistique du cache
   */
  public getStats(): { size: number; entriesCount: number } {
    let totalSize = 0;

    try {
      if (fileSystem.existsSync(this.cacheDir)) {
        const files = fileSystem.readdirSync(this.cacheDir);

        for (const file of files) {
          const filePath = join(this.cacheDir, file);
          const stats = fileSystem.statSync(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      this.logger.debug(
        `Erreur lors du calcul des statistiques du cache: ${error}`
      );
    }

    return {
      size: totalSize,
      entriesCount: this.cacheMap.size
    };
  }

  /**
   * Vider complètement le cache
   */
  public clearCache(): void {
    try {
      fileSystem.emptyDirSync(this.cacheDir);
      this.cacheMap.clear();
      this.logger.info("Cache vidé avec succès");
    } catch (error) {
      this.logger.error("Erreur lors du vidage du cache:", error);
    }
  }

  /**
   * Obtenir l'instance singleton de LibraryCache
   */
  public static getLibraryCacheSingleton(): LibraryCache {
    // Utilise le singleton global du registry et le chemin lockfile par défaut
    const lockFilePath = PathManager.me().resolve("pnpm-lock.yaml");
    return LibraryCache.me(lockFilePath, componentsRegistry);
  }
}
