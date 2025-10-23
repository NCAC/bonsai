// Classe de gestion du cache pour les composants de type `library`
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
    // Forcer la lecture asynchrone au démarrage et la rendre accessible
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
   * Récupère la version d'une librairie (robuste, pnpm list --json prioritaire)
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
    // 1. Méthode principale : pnpm list --json
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
   * Vérifie si la version de la librairie a changé depuis le dernier build
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
   * Met à jour la version de la librairie dans le cache
   */
  public updateCache(libName: string, version: string) {
    this.cacheStore.set(libName, version);
  }

  /**
   * Récupère la version stockée dans le cache
   */
  public getCachedVersion(libName: string): string | undefined {
    return this.cacheStore.get(libName);
  }

  /**
   * Vérifie si le cache est valide pour la librairie (version inchangée)
   */
  public async isValid(target: { libName: string }): Promise<boolean> {
    const lastVersion = this.getCachedVersion(target.libName);
    if (!lastVersion) return false;
    const currentVersion = await this.getLibraryVersion(target.libName);
    return !!currentVersion && currentVersion === lastVersion;
  }

  /**
   * Récupère les artefacts du cache (ici, rien à faire, car le cache ne stocke que la version)
   */
  public async read(target: { libName: string }): Promise<boolean> {
    // Pour une lib, le cache ne stocke que la version, pas d'artefact à restaurer
    return this.isValid(target);
  }

  /**
   * Écrit la version courante dans le cache et log le contenu de la Map
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
   * Vide le cache pour la librairie donnée
   */
  public async clear(target: { libName: string }): Promise<void> {
    this.cacheStore.delete(target.libName);
    await this.saveCacheToDisk();
  }

  /**
   * Permet d'attendre explicitement que le cache soit prêt (lecture terminée)
   */
  public async waitReady(): Promise<void> {
    // On attend que la promesse de chargement soit terminée
    if (this._loadPromise) {
      await this._loadPromise;
    }
  }
}
