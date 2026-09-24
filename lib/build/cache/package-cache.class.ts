// Cache management class for `package` components
import { join } from "node:path";
import { createHash } from "node:crypto";
import fileSystem from "fs-extra";

import { ICacheStrategy } from "@build/cache/cache-strategy.interface";

export class PackageCache implements ICacheStrategy<{ packageRoot: string }> {
  private static instance: PackageCache;
  private cacheStore: Map<string, string> = new Map(); // Map<packageRoot, hash>

  /**
   * Computes a global hash over all the source files of a package
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
   * Recursively collects every file of a directory
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
   * Checks whether the hash changed since the last build
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
   * Updates the hash in the cache
   */
  public updateCache(packageRoot: string, hash: string) {
    this.cacheStore.set(packageRoot, hash);
  }

  /**
   * Reads the hash stored in the cache
   */
  public getCachedHash(packageRoot: string): string | undefined {
    return this.cacheStore.get(packageRoot);
  }

  /**
   * Checks whether the cache is valid for the package (hash unchanged)
   */
  public async isValid(target: { packageRoot: string }): Promise<boolean> {
    const lastHash = this.getCachedHash(target.packageRoot);
    if (!lastHash) return false;
    const currentHash = await this.computeSourcesHash(target.packageRoot);
    return currentHash === lastHash;
  }

  /**
   * Restores the artifacts from the cache (nothing to do here: the cache only stores the hash)
   */
  public async read(target: { packageRoot: string }): Promise<boolean> {
    // For a package the cache only stores the hash, there is no artifact to restore
    return this.isValid(target);
  }

  /**
   * Writes the current hash to the cache and logs the content of the Map
   */
  public async write(target: { packageRoot: string }): Promise<boolean> {
    const currentHash = await this.computeSourcesHash(target.packageRoot);
    this.updateCache(target.packageRoot, currentHash);
    // Temporary debug log
    // eslint-disable-next-line no-console
    console.info(
      `[DEBUG] Cache écrit pour le package: ${target.packageRoot}, hash: ${currentHash}`
    );
    // Log the Map content right before saving
    // eslint-disable-next-line no-console
    console.info(
      "[DEBUG] Contenu cacheStore avant save:",
      Array.from(this.cacheStore.entries())
    );
    return true;
  }

  /**
   * Clears the cache for the given package
   */
  public async clear(target: { packageRoot: string }): Promise<void> {
    this.cacheStore.delete(target.packageRoot);
  }

  /**
   * Loads the package cache from disk (cache-index.json)
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
   * Saves the package cache to disk (in .bonsai-cache/cache-index.json)
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
   * Loads the cache automatically on instantiation
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
