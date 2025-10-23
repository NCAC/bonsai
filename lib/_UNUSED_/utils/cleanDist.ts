import fs from "fs-extra";
import path from "path";
import { BuildStoreConfig } from "@lib/_UNUSED_/BuildStoreConfig";

/**
 * Nettoie le dossier dist d'un package spécifique
 *
 * @param packagePath Chemin absolu vers le package
 * @returns Promise qui se résout quand le nettoyage est terminé
 */
async function cleanPackageDist(packagePath: string): Promise<void> {
  try {
    const distPath = path.join(packagePath, "dist");

    // Vérifier si le dossier dist existe
    if (await fs.pathExists(distPath)) {
      console.log(`Nettoyage du dossier: ${distPath}`);
      // Supprimer le dossier dist
      await fs.remove(distPath);
      // Recréer un dossier dist vide
      await fs.ensureDir(distPath);
    }
  } catch (error) {
    console.error(`Erreur lors du nettoyage de ${packagePath}/dist:`, error);
    throw error;
  }
}

/**
 * Nettoie tous les dossiers dist des packages et du framework
 *
 * @param buildStoreConfig Configuration du build
 * @returns Promise qui se résout quand le nettoyage est terminé
 */
export async function cleanAllDist(
  buildStoreConfig: BuildStoreConfig
): Promise<void> {
  try {
    console.log("Démarrage du nettoyage de tous les dossiers dist...");

    // Nettoyer le framework
    if (buildStoreConfig.framework) {
      await cleanPackageDist(buildStoreConfig.framework.rootPath);
    }

    // Nettoyer tous les packages
    // Convertir le Set en Array pour pouvoir utiliser map
    const cleanPromises = [...buildStoreConfig.packages].map((pkg) =>
      cleanPackageDist(pkg.rootPath)
    );

    await Promise.all(cleanPromises);

    console.log("Nettoyage de tous les dossiers dist terminé avec succès");
  } catch (error) {
    console.error("Erreur lors du nettoyage des dossiers dist:", error);
    throw error;
  }
}

/**
 * Nettoie tous les dossiers dist dans les packages sans nécessiter la configuration du build
 * Utile pour les appels depuis package.json
 *
 * @param packagesRootPath Chemin vers le dossier racine contenant tous les packages
 * @returns Promise qui se résout quand le nettoyage est terminé
 */
export async function cleanDistFromRootPath(
  packagesRootPath: string
): Promise<void> {
  try {
    console.log(`Recherche de packages dans: ${packagesRootPath}`);

    // Lire tous les sous-dossiers qui pourraient être des packages
    const entries = await fs.readdir(packagesRootPath, { withFileTypes: true });
    const packageDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((dir) => path.join(packagesRootPath, dir.name));

    // Nettoyer le dossier dist de chaque package
    const cleanPromises = packageDirs.map((pkgDir) => cleanPackageDist(pkgDir));
    await Promise.all(cleanPromises);

    console.log("Nettoyage des dossiers dist terminé avec succès");
  } catch (error) {
    console.error("Erreur lors du nettoyage des dossiers dist:", error);
    throw error;
  }
}
