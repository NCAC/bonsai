// Cache management class for `library` components
import { join } from "node:path";
import fileSystem from "fs-extra";
import { load as loadYaml } from "js-yaml";
import { ICacheStrategy } from "@build/cache/cache-strategy.interface";
import { PathManager } from "@build/core/path-manager.class";
import { ComponentsRegistry } from "@build/initializing/components-registry";
import { execa } from "execa";

export class LibraryCache implements ICacheStrategy<{ libName: string }> {
  private static instance: LibraryCache;
  private lockFilePath: string;
  private cacheStore: Map<string, string> = new Map(); // Map<libName, version>
  private pathManager = PathManager.me();
  private cacheFilePath: string;
  private componentsRegistry: ComponentsRegistry;
  private _loadPromise: Promise<void>;

  private constructor(
    lockFilePath: string,
    componentsRegistry: ComponentsRegistry
  ) {
    this.lockFilePath = lockFilePath;
    this.componentsRegistry = componentsRegistry;
    this.cacheFilePath = join(
      this.pathManager.rootPath,
      ".bonsai-cache",
      "library-cache.json"
    );
    // Force the asynchronous read at startup and make it awaitable
    this._loadPromise = this.loadCacheFromDisk();
  }

  static me(
    lockFilePath: string,
    componentsRegistry: ComponentsRegistry
  ): LibraryCache {
    if (!LibraryCache.instance) {
      LibraryCache.instance = new LibraryCache(
        lockFilePath,
        componentsRegistry
      );
    }
    return LibraryCache.instance;
  }

  private async loadCacheFromDisk() {
    try {
      await fileSystem.ensureDir(
        join(this.pathManager.rootPath, ".bonsai-cache")
      );
      if (await fileSystem.pathExists(this.cacheFilePath)) {
        const data = await fileSystem.readFile(this.cacheFilePath, "utf-8");
        this.cacheStore = new Map(Object.entries(JSON.parse(data)));
        // eslint-disable-next-line no-console
        console.info(
          `[CACHE][DEBUG] library-cache.json chargé (${this.cacheStore.size} entrées)`
        );
      } else {
        // eslint-disable-next-line no-console
        console.info(
          `[CACHE][DEBUG] library-cache.json absent, initialisation vide.`
        );
        this.cacheStore = new Map();
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[CACHE][DEBUG] Erreur lors du chargement du cache:`, e);
      this.cacheStore = new Map();
    }
  }

  private async saveCacheToDisk() {
    await fileSystem.ensureDir(
      join(this.pathManager.rootPath, ".bonsai-cache")
    );
    try {
      await fileSystem.writeFile(
        this.cacheFilePath,
        JSON.stringify(Object.fromEntries(this.cacheStore), null, 2)
      );
      // eslint-disable-next-line no-console
      console.info(
        `[CACHE][DEBUG] library-cache.json écrit (${this.cacheStore.size} entrées)`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[CACHE] Erreur lors de l'écriture du cache library-cache.json :`,
        err
      );
    }
  }

  /**
   * Reads a library's version (robust, `pnpm list --json` first)
   */
  public async getLibraryVersion(libName: string): Promise<string | null> {
    const organized = this.componentsRegistry.organizedComponents;
    if (!organized)
      throw new Error("Le registry n'a pas encore collecté les composants");
    const pkg = [...organized.libraries, ...organized.packages].find(
      (p) => p.name === libName
    );
    if (!pkg) {
      return null;
    }
    const depName = pkg.upstreamDependency || libName;
    // 1. Main method: pnpm list --json
    try {
      const { stdout } = await execa("pnpm", ["list", depName, "--json"]);
      const list = JSON.parse(stdout);
      if (Array.isArray(list) && list[0]?.version) {
        return list[0].version;
      }
    } catch (e) {
      // fallback minimal : node_modules
      try {
        const nodeModulesPath = join(
          this.pathManager.rootPath,
          "node_modules",
          depName.replace(/^@/, "@")
        );
        const pkgJsonPath = join(nodeModulesPath, "package.json");
        if (await fileSystem.pathExists(pkgJsonPath)) {
          const pkgJson = await fileSystem.readJSON(pkgJsonPath);
          if (pkgJson.version) {
            return pkgJson.version;
          }
        }
      } catch {}
    }
    return null;
  }

  /**
   * Checks whether the library version changed since the last build
   */
  public async shouldRebuild(
    libName: string,
    lastVersion: string
  ): Promise<boolean> {
    const currentVersion = await this.getLibraryVersion(libName);
    if (!currentVersion) return true;
    return currentVersion !== lastVersion;
  }

  /**
   * Updates the library version in the cache
   */
  public updateCache(libName: string, version: string) {
    this.cacheStore.set(libName, version);
  }

  /**
   * Reads the version stored in the cache
   */
  public getCachedVersion(libName: string): string | undefined {
    return this.cacheStore.get(libName);
  }

  /**
   * Checks whether the cache is valid for the library (version unchanged)
   */
  public async isValid(target: { libName: string }): Promise<boolean> {
    const lastVersion = this.getCachedVersion(target.libName);
    if (!lastVersion) return false;
    const currentVersion = await this.getLibraryVersion(target.libName);
    return !!currentVersion && currentVersion === lastVersion;
  }

  /**
   * Restores the artifacts from the cache (nothing to do here: the cache only stores the version)
   */
  public async read(target: { libName: string }): Promise<boolean> {
    // For a library the cache only stores the version, there is no artifact to restore
    return this.isValid(target);
  }

  /**
   * Writes the current version to the cache and logs the content of the Map
   */
  public async write(target: { libName: string }): Promise<boolean> {
    const currentVersion = await this.getLibraryVersion(target.libName);
    if (!currentVersion) return false;
    this.updateCache(target.libName, currentVersion);
    try {
      await this.saveCacheToDisk();
    } catch (err) {
      console.error(
        `[CACHE] Erreur lors de l'écriture du cache library-cache.json :`,
        err
      );
      return false;
    }
    return true;
  }

  /**
   * Clears the cache for the given library
   */
  public async clear(target: { libName: string }): Promise<void> {
    this.cacheStore.delete(target.libName);
    await this.saveCacheToDisk();
  }

  /**
   * Lets callers explicitly wait until the cache is ready (read finished)
   */
  public async waitReady(): Promise<void> {
    // Wait for the loading promise to settle
    if (this._loadPromise) {
      await this._loadPromise;
    }
  }
}
