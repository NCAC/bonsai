import { join } from "node:path";
import { IPackageJson } from "package-json-type";
import fileSystem from "fs-extra";
import { load as yamlLoad } from "js-yaml";
import { Logger } from "@build/monitoring/logger.class";
import { PathManager } from "@build/core/path-manager.class";
import { TFramework, TPackage } from "@build/build.type";

/**
 * Type représentant la structure du fichier bonsai-components.yaml
 */
export type TComponentsConfig = {
  libraries: string[];
  packages: string[];
};

/**
 * Type représentant les composants organisés après analyse
 */
export type TOrganizedComponents = {
  framework: TFramework;
  libraries: TPackage[];
  packages: TPackage[];
  allPackages: Set<TPackage>;
};

/**
 * Classe responsable de l'analyse des composants Bonsai
 */
export class ComponentsRegistry {
  private static instance: ComponentsRegistry;
  private logger: Logger;
  private pathManager: PathManager;
  private _organizedComponents: TOrganizedComponents | null = null;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {
    this.logger = Logger.me();
    this.pathManager = PathManager.me();
  }

  /**
   * Obtenir l'instance de l'analyseur
   */
  public static me(): ComponentsRegistry {
    if (!ComponentsRegistry.instance) {
      ComponentsRegistry.instance = new ComponentsRegistry();
    }
    return ComponentsRegistry.instance;
  }

  /**
   * Collecter tous les composants Bonsai
   */
  public async collect(): Promise<TOrganizedComponents> {
    this.logger.info("Collecte des composants Bonsai...");

    // Charger le fichier de configuration des composants
    const componentsConfig = await this.loadComponentsConfig();

    // Récupérer le framework
    const framework = await this.collectFramework();

    // Récupérer les bibliothèques
    const libraries = await this.collectComponents(
      componentsConfig.libraries,
      true
    );

    // Récupérer les packages internes
    const packages = await this.collectComponents(
      componentsConfig.packages,
      false
    );

    // Créer un Set avec tous les packages
    const allPackages = new Set<TPackage>([...libraries, ...packages]);

    this.logger.info(
      `Collecte terminée: 1 framework, ${libraries.length} bibliothèques, ${packages.length} packages`
    );

    // Stocker le résultat organisé
    this._organizedComponents = {
      framework,
      libraries,
      packages,
      allPackages
    };

    return this._organizedComponents;
  }

  /**
   * Accès au dernier résultat de collecte organisé (null si non collecté)
   */
  public get organizedComponents(): TOrganizedComponents | null {
    return this._organizedComponents;
  }

  /**
   * Charger la configuration des composants depuis le fichier YAML
   */
  private async loadComponentsConfig(): Promise<TComponentsConfig> {
    const configPath = join(
      this.pathManager.rootPath,
      "bonsai-components.yaml"
    );

    try {
      // Vérifier que le fichier existe
      await fileSystem.access(configPath);
      this.logger.info(
        `Fichier de configuration des composants trouvé: ${configPath}`
      );

      // Lire et parser le fichier YAML
      const configContent = await fileSystem.readFile(configPath, "utf-8");
      const config = yamlLoad(configContent) as Partial<TComponentsConfig>;

      // S'assurer que les sections libraries et packages existent, même si elles sont vides
      const librariesList = Array.isArray(config.libraries)
        ? config.libraries
        : [];
      const packagesList = Array.isArray(config.packages)
        ? config.packages
        : [];

      // Retourner la configuration normalisée
      const result: TComponentsConfig = {
        libraries: librariesList,
        packages: packagesList
      };

      this.logger.debug(
        `Configuration chargée: ${librariesList.length} bibliothèques, ${packagesList.length} packages`
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors du chargement de la configuration: ${error}`
      );
      throw new Error(
        `Impossible de charger la configuration des composants: ${error}`
      );
    }
  }

  /**
   * Récupérer le framework
   */
  private async collectFramework(): Promise<TFramework> {
    const frameworkPath = this.pathManager.frameworkPath;

    try {
      // Vérifier que le dossier existe
      await fileSystem.access(frameworkPath);

      // Lire le package.json
      const packageJsonPath = join(frameworkPath, "package.json");
      const packageJsonContent = await fileSystem.readFile(
        packageJsonPath,
        "utf-8"
      );
      const packageJson: IPackageJson = JSON.parse(packageJsonContent);

      // Valider le nom
      if (!packageJson.name) {
        throw new Error("Le framework n'a pas de nom dans son package.json");
      }

      // Extraire les dépendances
      const packages: string[] = [];
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach((dep) => {
          packages.push(dep);
        });
      }

      // Déterminer les chemins
      const srcPath = join(frameworkPath, "src");
      const distPath = join(frameworkPath, "dist");
      const srcFile = join(srcPath, "bonsai.ts");
      const outJsFile = join(distPath, "bonsai.js");
      const outDtsFile = join(distPath, "bonsai.d.ts");

      this.logger.info(`Framework analysé: ${packageJson.name}`);

      return {
        rootPath: frameworkPath,
        distPath,
        srcPath,
        outJsFile,
        outDtsFile,
        srcFile,
        packages,
        packageJson
      };
    } catch (error) {
      this.logger.error(`Erreur lors de l'analyse du framework: ${error}`);
      throw new Error(`Impossible d'analyser le framework: ${error}`);
    }
  }

  /**
   * Récupérer une liste de composants
   */
  private async collectComponents(
    componentNames: string[],
    isLibrary: boolean
  ): Promise<TPackage[]> {
    const components: TPackage[] = [];
    const componentType = isLibrary ? "bibliothèque" : "package";

    for (const name of componentNames) {
      try {
        // Extraire le nom du package sans le préfixe @bonsai/
        const packageName = name.replace(/^@bonsai\//, "");
        const component = await this.collectComponent(packageName, isLibrary);
        components.push(component);
        this.logger.debug(`${componentType} analysé(e): ${name}`);
      } catch (error) {
        this.logger.warn(
          `Erreur lors de l'analyse du ${componentType} ${name}: ${error}`
        );
      }
    }

    this.logger.info(`${components.length} ${componentType}s analysé(e)s`);
    return components;
  }

  /**
   * Récupérer un composant spécifique
   */
  private async collectComponent(
    packageName: string,
    isLibrary: boolean
  ): Promise<TPackage> {
    const packagePath = join(this.pathManager.packagesPath, packageName);

    try {
      // Vérifier que le dossier existe
      await fileSystem.access(packagePath);

      // Lire le package.json
      const packageJsonPath = join(packagePath, "package.json");
      const packageJsonContent = await fileSystem.readFile(
        packageJsonPath,
        "utf-8"
      );
      const packageJson: IPackageJson = JSON.parse(packageJsonContent);

      // Valider le nom
      if (!packageJson.name) {
        throw new Error(
          `Le composant ${packageName} n'a pas de nom dans son package.json`
        );
      }

      // Extraire les dépendances
      const dependencies: string[] = [];
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach((dep) => {
          dependencies.push(dep);
        });
      }

      // Déterminer les chemins
      const srcPath = join(packagePath, "src");
      const distPath = join(packagePath, "dist");

      // Déterminer les noms de fichiers en fonction du package.json si possible
      const mainFile = packageJson.main
        ? packageJson.main.replace(/^\.\/dist\//, "").replace(/^\.\//, "")
        : `${packageName}.js`;
      const typesFile = packageJson.types
        ? packageJson.types.replace(/^\.\/dist\//, "").replace(/^\.\//, "")
        : `${packageName}.d.ts`;

      // Déterminer le fichier source
      let srcFileName = `${packageName}.ts`;
      // Si src est spécifié dans package.json, l'utiliser
      if (packageJson.src) {
        srcFileName = packageJson.src.replace(/^\.\/src\//, "");
      }

      const srcFile = join(srcPath, srcFileName);
      const outJsFile = join(distPath, mainFile);
      const outDtsFile = join(distPath, typesFile);

      // Extraire le namespace
      const namespace = packageJson.namespace || null;

      // Détecter la dépendance amont (upstream)
      const upstreamDependency =
        ComponentsRegistry.detectUpstreamDependency(packageJson);

      return {
        rootPath: packagePath,
        name: packageJson.name,
        distPath,
        srcPath,
        outJsFile,
        outDtsFile,
        srcFile,
        dependencies,
        packageJson,
        isLibrary,
        namespace,
        upstreamDependency
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'analyse du composant ${packageName}: ${error}`
      );
      throw new Error(
        `Impossible d'analyser le composant ${packageName}: ${error}`
      );
    }
  }

  /**
   * Détecte le nom de la dépendance amont (upstream) d'un wrapper Bonsai.
   *
   * Priorité :
   * 1. Champ custom "bonsaiUpstream" dans le package.json (string)
   * 2. Première dépendance déclarée dans "dependencies"
   * 3. Nom du package (champ "name")
   *
   * @param packageJson Le package.json du wrapper analysé
   * @returns Le nom du package upstream à tracker pour la version
   */
  public static detectUpstreamDependency(packageJson: IPackageJson): string {
    // 1. Champ custom explicite
    if (
      typeof (packageJson as any).bonsaiUpstream === "string" &&
      (packageJson as any).bonsaiUpstream.trim()
    ) {
      return (packageJson as any).bonsaiUpstream.trim();
    }
    // 2. Première dépendance déclarée
    if (
      packageJson.dependencies &&
      Object.keys(packageJson.dependencies).length > 0
    ) {
      return Object.keys(packageJson.dependencies)[0];
    }
    // 3. Fallback sur le nom du package
    if (packageJson.name) {
      return packageJson.name;
    }
    throw new Error(
      "Impossible de détecter la dépendance amont du wrapper (package.json incomplet)"
    );
  }
}

// Exporter l'instance et les types
export const componentsRegistry = ComponentsRegistry.me();

/**
 * Fonction utilitaire pour collecter les composants Bonsai
 */
export async function collectComponents(): Promise<TOrganizedComponents> {
  return componentsRegistry.collect();
}
