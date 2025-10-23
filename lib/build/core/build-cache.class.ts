import { promises as fs } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Logger } from "@build/monitoring/logger.class";
import { PathManager } from "@build/core/path-manager.class";

/**
 * Structure d'une entrée de cache
 */
type TCacheEntry = {
  hash: string;
  timestamp: number;
};

/**
 * Classe gérant le cache de build pour éviter de reconstruire des fichiers inchangés
 */
export class BuildCache {
  private static instance: BuildCache;
  private cachePath: string;
  private cache: Map<string, TCacheEntry> = new Map();
  private logger: Logger;
  private pathManager: PathManager;
  private initialized = false;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {
    this.logger = Logger.me();
    this.pathManager = PathManager.me();
    this.cachePath = join(
      this.pathManager.rootPath,
      ".bonsai-cache",
      "build-cache.json"
    );
  }

  /**
   * Obtenir l'instance du cache
   */
  public static me(): BuildCache {
    if (!BuildCache.instance) {
      BuildCache.instance = new BuildCache();
    }
    return BuildCache.instance;
  }

  /**
   * Initialiser le cache
   */
  public async initialize(clearCache = false): Promise<void> {
    if (this.initialized && !clearCache) return;

    try {
      // Créer le dossier de cache s'il n'existe pas
      await fs.mkdir(join(this.pathManager.rootPath, ".bonsai-cache"), {
        recursive: true
      });

      if (clearCache) {
        this.logger.info(
          "[CACHE] Vidage explicite du cache de build (--clear-cache)"
        );
        this.cache.clear();
        await this.saveCache();
        this.initialized = true;
        return;
      }

      // Charger le cache existant
      try {
        const cacheContent = await fs.readFile(this.cachePath, "utf-8");
        const cacheData = JSON.parse(cacheContent);

        // Convertir l'objet en Map
        this.cache = new Map(Object.entries(cacheData));
        this.logger.debug(
          `[CACHE] Cache chargé depuis le disque avec ${this.cache.size} entrées`
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          this.logger.warn(
            `[CACHE] Erreur lors du chargement du cache: ${error}`
          );
        }
        this.logger.info(
          "[CACHE] Aucun cache trouvé, création d'un cache vierge (premier build ou cache supprimé)"
        );
      }

      this.initialized = true;
    } catch (error) {
      this.logger.error(
        `[CACHE] Erreur lors de l'initialisation du cache: ${error}`
      );
      // Continuer sans cache en cas d'erreur
      this.initialized = true;
    }
  }

  /**
   * Sauvegarder le cache sur disque
   */
  private async saveCache(): Promise<void> {
    try {
      // Convertir la Map en objet pour le JSON
      const cacheObject = Object.fromEntries(this.cache.entries());
      await fs.writeFile(this.cachePath, JSON.stringify(cacheObject, null, 2));
      this.logger.debug(`Cache sauvegardé avec ${this.cache.size} entrées`);
    } catch (error) {
      this.logger.error(`Erreur lors de la sauvegarde du cache: ${error}`);
    }
  }

  /**
   * Calculer le hash d'un fichier
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath);
      return createHash("md5").update(content).digest("hex");
    } catch (error) {
      this.logger.error(
        `Erreur lors du calcul du hash pour ${filePath}: ${error}`
      );
      // En cas d'erreur, retourner un hash unique pour forcer un rebuild
      return Date.now().toString();
    }
  }

  /**
   * Vérifier si un fichier doit être rebuilder
   */
  public async shouldRebuild(
    filePath: string,
    outPath: string
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Si le fichier de sortie n'existe pas, rebuild
    try {
      await fs.access(outPath);
    } catch {
      return true;
    }

    // Calculer le hash actuel du fichier
    const currentHash = await this.calculateFileHash(filePath);

    // Vérifier s'il existe dans le cache
    const cacheEntry = this.cache.get(filePath);

    if (!cacheEntry || cacheEntry.hash !== currentHash) {
      // Mettre à jour le cache
      this.cache.set(filePath, {
        hash: currentHash,
        timestamp: Date.now()
      });

      // Sauvegarder le cache (de manière asynchrone)
      this.saveCache().catch(() => {});

      return true;
    }

    return false;
  }

  /**
   * Invalider une entrée du cache
   */
  public async invalidateEntry(filePath: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.cache.delete(filePath);
    this.saveCache().catch(() => {});
  }

  /**
   * Invalider toutes les entrées du cache pour un dossier
   */
  public async invalidateFolder(folderPath: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Supprimer toutes les entrées dont le chemin commence par folderPath
    for (const path of this.cache.keys()) {
      if (path.startsWith(folderPath)) {
        this.cache.delete(path);
      }
    }

    this.saveCache().catch(() => {});
  }
}

// Exporter l'instance
export const buildCache = BuildCache.me();
