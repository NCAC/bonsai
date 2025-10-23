import { Logger } from "@build/monitoring/logger.class";
import { Builder } from "./builder.class";
import { TFramework, TPackage } from "@build/build.type";
import { TOrganizedComponents } from "@lib/build/initializing/components-registry";
import { CacheStrategyFactory } from "@build/cache/cache-strategy.factory";

/**
 * Classe responsable d'orchestrer le build des différents composants
 * dans le bon ordre et avec la stratégie appropriée (parallèle ou séquentielle)
 */
export class BuildOrchestrator {
  private static instance: BuildOrchestrator;
  private logger: Logger;
  private builder: Builder;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {
    this.logger = Logger.me();
    this.builder = Builder.me();
  }

  /**
   * Obtenir l'instance de l'orchestrateur
   */
  public static me(): BuildOrchestrator {
    if (!BuildOrchestrator.instance) {
      BuildOrchestrator.instance = new BuildOrchestrator();
    }
    return BuildOrchestrator.instance;
  }

  /**
   * Exécuter le build complet dans l'ordre approprié
   */
  public async build(components: TOrganizedComponents): Promise<boolean> {
    try {
      this.logger.info("=== Démarrage du build complet ===");

      // 1. Build parallèle des bibliothèques externes
      this.logger.info("Étape 1: Build des bibliothèques externes (parallèle)");
      const librariesSuccess = await this.buildLibraries(components.libraries);
      if (!librariesSuccess) {
        this.logger.warn(
          "Des erreurs sont survenues lors du build des bibliothèques."
        );
      }

      // 2. Build séquentiel des packages internes
      this.logger.info("Étape 2: Build des packages internes (séquentiel)");
      const packagesSuccess = await this.buildPackages(components.packages);
      if (!packagesSuccess) {
        this.logger.warn(
          "Des erreurs sont survenues lors du build des packages."
        );
      }

      // 3. Build du framework (en dernier car il dépend de tous les autres composants)
      this.logger.info("Étape 3: Build du framework");
      const frameworkSuccess = await this.buildFramework(components.framework);
      if (!frameworkSuccess) {
        this.logger.error("Échec du build du framework.");
        return false;
      }

      const overallSuccess =
        frameworkSuccess && librariesSuccess && packagesSuccess;

      if (overallSuccess) {
        this.logger.success("Build complet terminé avec succès!");
      } else {
        this.logger.warn(
          "Build complet terminé avec des avertissements ou erreurs."
        );
      }

      return overallSuccess;
    } catch (error) {
      this.logger.error("Erreur critique pendant le build:", error);
      return false;
    }
  }

  /**
   * Build du framework (en dernier car il dépend de tous les autres composants)
   */
  private async buildFramework(framework: TFramework): Promise<boolean> {
    this.logger.info(`Building framework: ${framework.packageJson.name}`);
    return await this.builder.buildFramework(framework);
  }

  /**
   * Build parallèle des bibliothèques externes avec gestion du cache
   */
  private async buildLibraries(libraries: TPackage[]): Promise<boolean> {
    if (libraries.length === 0) {
      this.logger.info("Aucune bibliothèque à builder.");
      return true;
    }

    this.logger.info(`Building ${libraries.length} libraries en parallèle...`);

    // Build avec gestion du cache
    const buildPromises = libraries.map(async (lib) => {
      const cache = CacheStrategyFactory.create("library");
      const target = { libName: lib.name };
      if (await cache.isValid(target)) {
        this.logger.info(
          `Cache valide pour la bibliothèque ${lib.name}, build ignoré.`
        );
        await cache.read(target); // (optionnel, ici pas d'artefact à restaurer)
        // Correction : forcer l'écriture du cache sur disque si jamais il n'existe pas encore
        await cache.write(target);
        return true;
      }
      const result = await this.builder.buildLibrary(lib);
      if (result) {
        await cache.write(target);
      }
      return result;
    });

    const results = await Promise.all(buildPromises);
    const allSucceeded = results.every((result) => result === true);

    // Forcer la persistance du cache library après le build des bibliothèques
    try {
      const libraryCache = CacheStrategyFactory.create("library");
      if (typeof (libraryCache as any).saveCacheToDisk === "function") {
        await (libraryCache as any).saveCacheToDisk();
        this.logger.info(
          "[CACHE] library-cache.json sauvegardé après build des bibliothèques."
        );
      }
    } catch (e) {
      this.logger.warn(
        "[CACHE] Erreur lors de la sauvegarde du cache library-cache.json : " +
          e
      );
    }

    if (allSucceeded) {
      this.logger.success(
        "Toutes les bibliothèques ont été buildées avec succès."
      );
    } else {
      const failedCount = results.filter((result) => !result).length;
      this.logger.warn(
        `${failedCount} bibliothèque(s) n'ont pas pu être buildées correctement.`
      );
    }

    return allSucceeded;
  }

  /**
   * Build séquentiel des packages internes avec gestion du cache
   */
  private async buildPackages(packages: TPackage[]): Promise<boolean> {
    if (packages.length === 0) {
      this.logger.info("Aucun package à builder.");
      return true;
    }

    // Trier les packages selon leurs dépendances
    const sortedPackages = this.sortPackagesByDependencies(packages);

    this.logger.info(
      `Building ${sortedPackages.length} packages séquentiellement...`
    );

    let allSucceeded = true;

    for (let i = 0; i < sortedPackages.length; i++) {
      const pkg = sortedPackages[i];
      this.logger.info(
        `Building package ${i + 1}/${sortedPackages.length}: ${pkg.name}`
      );
      const cache = CacheStrategyFactory.create("package");
      const target = { packageRoot: pkg.rootPath };
      if (await cache.isValid(target)) {
        this.logger.info(
          `Cache valide pour le package ${pkg.name}, build ignoré.`
        );
        await cache.read(target);
        continue;
      }
      const success = await this.builder.buildPackage(pkg);
      if (success) {
        await cache.write(target);
      } else {
        this.logger.error(`Échec du build du package ${pkg.name}`);
        allSucceeded = false;
      }
    }

    // Forcer la persistance du cache package après le build des packages
    try {
      const packageCache = CacheStrategyFactory.create("package");
      if (typeof (packageCache as any).saveCacheToDisk === "function") {
        await (packageCache as any).saveCacheToDisk();
        this.logger.info(
          "[CACHE] cache-index.json sauvegardé après build des packages."
        );
      } else if (typeof (packageCache as any).saveCacheAsync === "function") {
        await (packageCache as any).saveCacheAsync();
        this.logger.info(
          "[CACHE] cache-index.json sauvegardé après build des packages."
        );
      }
    } catch (e) {
      this.logger.warn(
        "[CACHE] Erreur lors de la sauvegarde du cache package : " + e
      );
    }

    if (allSucceeded) {
      this.logger.success("Tous les packages ont été buildés avec succès.");
    } else {
      this.logger.warn(
        "Certains packages n'ont pas pu être buildés correctement."
      );
    }

    return allSucceeded;
  }

  /**
   * Trier les packages selon leurs dépendances (tri topologique)
   * Les packages sans dépendances internes sont construits en premier
   */
  private sortPackagesByDependencies(packages: TPackage[]): TPackage[] {
    const packageMap = new Map<string, TPackage>();
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: TPackage[] = [];

    // Créer une map des packages par nom
    packages.forEach((pkg) => {
      packageMap.set(pkg.packageJson.name!, pkg);
    });

    const visit = (packageName: string): void => {
      if (visited.has(packageName)) {
        return;
      }

      if (visiting.has(packageName)) {
        this.logger.warn(
          `Dépendance circulaire détectée impliquant ${packageName}`
        );
        return;
      }

      const pkg = packageMap.get(packageName);
      if (!pkg) {
        // Dépendance externe ou non trouvée, on ignore
        return;
      }

      visiting.add(packageName);

      // Visiter d'abord toutes les dépendances de ce package
      if (pkg.packageJson.dependencies) {
        Object.keys(pkg.packageJson.dependencies).forEach((dep) => {
          // Ne traiter que les dépendances qui sont des packages internes
          if (packageMap.has(dep)) {
            visit(dep);
          }
        });
      }

      visiting.delete(packageName);
      visited.add(packageName);
      sorted.push(pkg);
    };

    // Visiter tous les packages
    packages.forEach((pkg) => {
      if (pkg.packageJson.name) {
        visit(pkg.packageJson.name);
      }
    });

    this.logger.info(
      `Ordre de construction des packages: ${sorted
        .map((p) => p.name)
        .join(" → ")}`
    );
    return sorted;
  }
}

// Exporter l'instance
export const buildOrchestrator = BuildOrchestrator.me();
