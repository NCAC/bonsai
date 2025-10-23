import { join, dirname } from "node:path";
import fileSystem from "fs-extra";

/**
 * Gestionnaire de chemins pour l'application Bonsai.
 * Cette classe est responsable de fournir les chemins vers les différentes
 * parties de l'application de manière centralisée.
 *
 * Elle est implémentée comme un singleton pour garantir l'unicité
 * des chemins dans toute l'application.
 */
export class PathManager {
  private static instance: PathManager;

  /**
   * Chemin racine de l'application Bonsai
   */
  private readonly _rootPath: string;

  /**
   * Chemin vers le dossier des packages
   */
  private readonly _packagesPath: string;

  /**
   * Chemin vers le dossier des outils
   */
  private readonly _toolsPath: string;

  /**
   * Chemin vers le dossier lib
   */
  private readonly _libPath: string;

  /**
   * Chemin vers le framework Bonsai
   */
  private readonly _frameworkPath: string;

  /**
   * Constructeur privé pour empêcher l'instanciation directe
   */
  private constructor() {
    // Déterminer le chemin racine de façon fiable
    this._rootPath = this.findRootPath();

    // Initialiser les autres chemins
    this._packagesPath = join(this._rootPath, "packages");
    this._toolsPath = join(this._rootPath, "tools");
    this._libPath = join(this._rootPath, "lib");
    this._frameworkPath = join(this._rootPath, "core");

    console.log(
      `PathManager initialisé avec le chemin racine: ${this._rootPath}`
    );
  }

  /**
   * Méthode pour accéder à l'instance unique du PathManager
   */
  public static me(): PathManager {
    if (!PathManager.instance) {
      PathManager.instance = new PathManager();
    }
    return PathManager.instance;
  }

  /**
   * Trouve le chemin racine de l'application Bonsai
   * en recherchant des fichiers/dossiers caractéristiques
   */
  private findRootPath(): string {
    // Commencer par le répertoire de travail actuel
    let currentDir = process.cwd();

    // Monter dans l'arborescence jusqu'à trouver le dossier racine
    while (currentDir !== "/") {
      // Vérifier si c'est le dossier racine de bonsai en cherchant des fichiers/dossiers caractéristiques
      if (
        fileSystem.existsSync(join(currentDir, "bonsai-components.yaml")) &&
        fileSystem.existsSync(join(currentDir, "packages")) &&
        fileSystem.existsSync(join(currentDir, "lib"))
      ) {
        return currentDir;
      }

      // Remonter d'un niveau
      const parentDir = dirname(currentDir);

      // Si on ne peut plus remonter, arrêter la recherche
      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
    }

    // Si on n'a pas trouvé, utiliser le répertoire courant
    // avec un avertissement
    console.warn(
      `⚠️ Impossible de déterminer le chemin racine de Bonsai. Utilisation de ${process.cwd()} par défaut.`
    );
    return process.cwd();
  }

  /**
   * Chemin racine de l'application
   */
  get rootPath(): string {
    return this._rootPath;
  }

  /**
   * Chemin vers le dossier des packages
   */
  get packagesPath(): string {
    return this._packagesPath;
  }

  /**
   * Chemin vers le dossier des outils
   */
  get toolsPath(): string {
    return this._toolsPath;
  }

  /**
   * Chemin vers le dossier lib
   */
  get libPath(): string {
    return this._libPath;
  }

  /**
   * Chemin vers le framework Bonsai
   */
  get frameworkPath(): string {
    return this._frameworkPath;
  }

  /**
   * Crée un chemin absolu à partir d'un chemin relatif à la racine de l'application
   *
   * @param relativePath Chemin relatif à la racine de l'application
   * @returns Chemin absolu
   */
  public resolve(...relativePath: string[]): string {
    return join(this._rootPath, ...relativePath);
  }

  /**
   * Crée un chemin absolu vers un package à partir du nom du package
   *
   * @param packageName Nom du package (avec ou sans @bonsai/)
   * @returns Chemin absolu vers le package
   */
  public resolvePackage(packageName: string): string {
    // Supprimer le préfixe @bonsai/ s'il existe
    const normalizedName = packageName.replace(/^@bonsai\//, "");
    return join(this._packagesPath, normalizedName);
  }

  /**
   * Crée un chemin absolu vers un fichier dans un package
   *
   * @param packageName Nom du package (avec ou sans @bonsai/)
   * @param relativePath Chemin relatif dans le package
   * @returns Chemin absolu vers le fichier dans le package
   */
  public resolvePackageFile(
    packageName: string,
    ...relativePath: string[]
  ): string {
    return join(this.resolvePackage(packageName), ...relativePath);
  }

  /**
   * Vérifie si un chemin existe
   *
   * @param filePath Chemin à vérifier
   * @returns true si le chemin existe, false sinon
   */
  public exists(filePath: string): boolean {
    return fileSystem.existsSync(filePath);
  }
}
