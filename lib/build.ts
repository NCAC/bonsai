import { PathManager } from "@build/core/path-manager.class";
import { Logger, LogLevel } from "@build/monitoring/logger.class";
import { BuildOptions } from "@build/initializing/build-options.class";
import {
  componentsRegistry,
  TOrganizedComponents
} from "@lib/build/initializing/components-registry";
import chalk from "chalk";
import { buildCache } from "@build/core/build-cache.class";
import { LibraryCache } from "@build/cache/library-cache.class";
import { BuildOrchestrator } from "@build/building/build-orchestrator.class";
import { cleanAllDistFromComponents } from "@build/utils/clean-dist.utils";
import { BuildCache } from "@build/cache/build-cache.class";

/**
 * Point d'entrée principal pour le nouveau système de build de Bonsai (v2)
 * Cette version utilise une architecture plus modulaire et organisée
 */

// Initialisation du gestionnaire de chemins
const pathManager = PathManager.me();

/**
 * Afficher les informations de base sur l'environnement de build
 */
function displayPathsInfo() {
  console.log(chalk.blue("=== Bonsai Build System v2 ==="));
  console.log(
    chalk.blue(`Date de lancement: ${new Date().toLocaleString("fr-FR")}`)
  );
  console.log(chalk.blue(`Chemin racine: ${pathManager.rootPath}`));

  // Vérifier que les chemins essentiels existent
  const paths = [
    { name: "Packages", path: pathManager.packagesPath },
    { name: "Framework", path: pathManager.frameworkPath },
    { name: "Library", path: pathManager.libPath },
    { name: "Tools", path: pathManager.toolsPath }
  ];

  let allPathsValid = true;
  console.log(chalk.blue("Vérification des chemins:"));

  paths.forEach(({ name, path }) => {
    const exists = pathManager.exists(path);
    console.log(
      `  ${name}: ${path} ${
        exists ? chalk.green("✓") : chalk.red("✗ (introuvable)")
      }`
    );
    if (!exists) allPathsValid = false;
  });

  if (!allPathsValid) {
    console.warn(
      chalk.yellow(
        "⚠️ Certains chemins requis n'ont pas été trouvés. Le build pourrait échouer."
      )
    );
  }

  return allPathsValid;
}

/**
 * Fonction principale du build
 */
async function main() {
  try {
    // Afficher les informations initiales et vérifier les chemins
    const pathsValid = displayPathsInfo();
    if (!pathsValid) {
      console.error(
        chalk.red(
          "Erreur critique: Impossible de continuer avec des chemins manquants."
        )
      );
      process.exit(1);
    }

    // Initialiser le système de logging
    const logger = Logger.me();
    logger.setLogLevel(LogLevel.INFO);
    logger.startTimer();

    // Charger les options de build depuis les arguments de ligne de commande
    logger.info("Chargement des options de build...");
    const buildOptions = BuildOptions.me();

    // Si le mode verbose est activé, augmenter le niveau de détail des logs
    if (buildOptions.all.verbose) {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.debug("Mode verbose activé");
    }

    // Afficher un résumé des options de build
    buildOptions.displaySummary();

    // Récupérer les composants (framework, bibliothèques, packages)
    logger.info("Récupération des composants Bonsai...");
    let components: TOrganizedComponents;

    try {
      components = await componentsRegistry.collect();

      logger.info("=== Résumé des composants ===");
      logger.info(`Framework: ${components.framework.packageJson.name}`);
      logger.info(`Bibliothèques externes: ${components.libraries.length}`);
      logger.info(`Packages internes: ${components.packages.length}`);

      if (buildOptions.all.verbose) {
        logger.debug("Détail des bibliothèques:");
        components.libraries.forEach((lib) => {
          logger.debug(
            `- ${lib.name}${
              lib.namespace ? ` (namespace: ${lib.namespace})` : ""
            }`
          );
        });

        logger.debug("Détail des packages (dans l'ordre de build):");
        components.packages.forEach((pkg, index) => {
          logger.debug(`${index + 1}. ${pkg.name}`);
        });
      }
    } catch (error) {
      logger.error(`Erreur lors de l'analyse des composants: ${error}`);
      process.exit(1);
    }

    // Nettoyage des dossiers dist si --clean est activé
    if (buildOptions.all.clean) {
      logger.info("Option --clean détectée : nettoyage des dossiers dist...");
      await cleanAllDistFromComponents(components);
    }

    // Initialiser le cache de build
    logger.info("Initialisation du cache de build...");
    await buildCache.initialize(buildOptions.all.clearCache);
    // Attendre explicitement que le cache des bibliothèques soit prêt (singleton)
    await BuildCache.getLibraryCacheSingleton().waitReady();

    // Préparer l'orchestrateur de build
    logger.info("Préparation de l'orchestrateur de build...");
    const orchestrator = BuildOrchestrator.me();

    // Exécuter le build
    const buildSuccess = await orchestrator.build(components);

    if (buildOptions.all.watch) {
      logger.info(
        "Mode watch actif: surveillance des fichiers pour rebuild automatique"
      );
      // Gérer la terminaison propre avec les signaux
      process.on("SIGINT", async () => {
        logger.info("Interruption détectée, arrêt des processus...");
        // await orchestrator.stopAllWatchers();
        process.exit(0);
      });
    } else {
      // Si pas en mode watch, arrêter le process immédiatement
      process.exit(buildSuccess ? 0 : 1);
    }
  } catch (error) {
    console.error(chalk.red("Erreur fatale lors du build:"), error);
    process.exit(1);
  }
}

// Exécuter la fonction principale
main().catch((error) => {
  console.error(chalk.red("Erreur non gérée:"), error);
  process.exit(1);
});
