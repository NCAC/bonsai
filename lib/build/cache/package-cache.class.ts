// Classe de gestion du cache pour les composants de type `package`
import { join } from "node:path";
import { createHash } from "node:crypto";
import fileSystem from "fs-extra";

import { ICacheStrategy } from "@build/cache/cache-strategy.interface";

export class PackageCache implements ICacheStrategy<{ packageRoot: string }> {
  private static instance: PackageCache;
  private cacheStore: Map<string, string> = new Map(); // Map<packageRoot, hash>

  /**
   * Calcule un hash global pour tous les fichiers sources d'un package
   */
  public async computeSourcesHash(packageRoot: string): Promise<string> {
    const srcDir = join(packageRoot, "src");
    const files = await this.getAllFiles(srcDir);
    const hash = createHash("md5");
    for (const file of files) {
      const content = await fileSystem.readFile(file);
      hash.update(content);
    }
    return hash.digest("hex");
  }

  /**
   * Récupère récursivement tous les fichiers d'un dossier
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    const list = await fileSystem.readdir(dir);
    for (const file of list) {
      const filePath = join(dir, file);
      const fileStat = await fileSystem.stat(filePath);
      if (fileStat.isDirectory()) {
        results = results.concat(await this.getAllFiles(filePath));
      } else {
        results.push(filePath);
      }
    }
    return results;
  }

  /**
   * Vérifie si le hash a changé depuis le dernier build
   */
  public async shouldRebuild(
    packageRoot: string,
    lastHash: string
  ): Promise<boolean> {
    return this.computeSourcesHash(packageRoot).then(
      (currentHash) => currentHash !== lastHash
    );
  }

  /**
   * Met à jour le hash dans le cache
   */
  public updateCache(packageRoot: string, hash: string) {
    this.cacheStore.set(packageRoot, hash);
  }

  /**
   * Récupère le hash stocké dans le cache
   */
  public getCachedHash(packageRoot: string): string | undefined {
    return this.cacheStore.get(packageRoot);
  }

  /**
   * Vérifie si le cache est valide pour le package (hash inchangé)
   */
  public async isValid(target: { packageRoot: string }): Promise<boolean> {
    const lastHash = this.getCachedHash(target.packageRoot);
    if (!lastHash) return false;
    const currentHash = await this.computeSourcesHash(target.packageRoot);
    return currentHash === lastHash;
  }

  /**
   * Récupère les artefacts du cache (ici, rien à faire, car le cache ne stocke que le hash)
   */
  public async read(target: { packageRoot: string }): Promise<boolean> {
    // Pour un package, le cache ne stocke que le hash, pas d'artefact à restaurer
    return this.isValid(target);
  }

  /**
   * Écrit le hash courant dans le cache et log le contenu de la Map
   */
  public async write(target: { packageRoot: string }): Promise<boolean> {
    const currentHash = await this.computeSourcesHash(target.packageRoot);
    this.updateCache(target.packageRoot, currentHash);
    // Log temporaire pour debug
    // eslint-disable-next-line no-console
    console.info(
      `[DEBUG] Cache écrit pour le package: ${target.packageRoot}, hash: ${currentHash}`
    );
    // Log du contenu de la Map juste avant la sauvegarde
    // eslint-disable-next-line no-console
    console.info(
      "[DEBUG] Contenu cacheStore avant save:",
      Array.from(this.cacheStore.entries())
    );
    return true;
  }

  /**
   * Vide le cache pour le package donné
   */
  public async clear(target: { packageRoot: string }): Promise<void> {
    this.cacheStore.delete(target.packageRoot);
  }

  /**
   * Charge le cache des packages depuis le disque (cache-index.json)
   */
  public async loadCacheFromDisk(): Promise<void> {
    const cacheDir = join(process.cwd(), ".bonsai-cache");
    const cacheFile = join(cacheDir, "cache-index.json");
    await fileSystem.ensureDir(cacheDir);
    try {
      if (await fileSystem.pathExists(cacheFile)) {
        const data = await fileSystem.readFile(cacheFile, "utf-8");
        this.cacheStore = new Map(Object.entries(JSON.parse(data)));
        // eslint-disable-next-line no-console
        console.info(
          `[CACHE][DEBUG] cache-index.json chargé (${this.cacheStore.size} entrées)`
        );
      } else {
        this.cacheStore = new Map();
        // eslint-disable-next-line no-console
        console.info(
          `[CACHE][DEBUG] cache-index.json absent, initialisation vide.`
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[CACHE][DEBUG] Erreur lors du chargement du cache package:`,
        e
      );
      this.cacheStore = new Map();
    }
  }

  /**
   * Sauvegarde le cache des packages sur disque (dans .bonsai-cache/cache-index.json)
   */
  public async saveCacheToDisk(): Promise<void> {
    const cacheDir = join(process.cwd(), ".bonsai-cache");
    const cacheFile = join(cacheDir, "cache-index.json");
    await fileSystem.ensureDir(cacheDir);
    try {
      await fileSystem.writeFile(
        cacheFile,
        JSON.stringify(Object.fromEntries(this.cacheStore), null, 2)
      );
      // eslint-disable-next-line no-console
      console.info(
        `[CACHE][DEBUG] cache-index.json écrit (${this.cacheStore.size} entrées)`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[CACHE] Erreur lors de l'écriture du cache cache-index.json :`,
        err
      );
    }
  }

  /**
   * Appeler automatiquement le chargement du cache à l'instanciation
   */
  private constructor() {
    this.loadCacheFromDisk();
  }
  static me(): PackageCache {
    if (!PackageCache.instance) {
      PackageCache.instance = new PackageCache();
    }
    return PackageCache.instance;
  }
}
