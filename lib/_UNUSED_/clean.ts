import path from "path";
import { cleanDistFromRootPath } from "@build/utils/cleanDist";

/**
 * Script principal pour le nettoyage des dossiers dist de tous les packages
 */
async function main() {
  try {
    // Chemin vers le répertoire racine du projet
    const rootPath = process.cwd();

    // Chemin vers le dossier des packages
    const packagesPath = path.join(rootPath, "packages");

    // Nettoyer les dossiers dist des packages
    await cleanDistFromRootPath(packagesPath);

    // Nettoyer aussi le dossier dist du framework/core si nécessaire
    const corePath = path.join(rootPath, "core");
    await cleanDistFromRootPath(corePath);

    console.log("Nettoyage complet terminé");
    process.exit(0);
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error);
    process.exit(1);
  }
}

// Exécuter le script
main();
