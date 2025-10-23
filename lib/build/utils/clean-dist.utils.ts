import fs from "fs-extra";
import path from "path";
import { TOrganizedComponents } from "@lib/build/initializing/components-registry";

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
 * Nettoie tous les dossiers dist des packages et du framework à partir des informations de ComponentsAnalyzer
 *
 * @param components Résultat de ComponentsAnalyzer.analyze()
 * @returns Promise qui se résout quand le nettoyage est terminé
 */
export async function cleanAllDistFromComponents(
  components: TOrganizedComponents
): Promise<void> {
  try {
    console.log("Démarrage du nettoyage de tous les dossiers dist...");

    // Nettoyer le framework
    if (components.framework?.rootPath) {
      await cleanPackageDist(components.framework.rootPath);
    }

    // Nettoyer tous les packages
    const cleanPromises = components.packages.map((pkg) =>
      cleanPackageDist(pkg.rootPath)
    );

    await Promise.all(cleanPromises);

    console.log("Nettoyage de tous les dossiers dist terminé avec succès");
  } catch (error) {
    console.error("Erreur lors du nettoyage des dossiers dist:", error);
    throw error;
  }
}
