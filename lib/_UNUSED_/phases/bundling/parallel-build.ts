import { BuildStoreConfig } from "@lib/_UNUSED_/BuildStoreConfig";
import { BuildScheduler } from "@build/BuildScheduler";

/**
 * Construit les packages en parallèle selon leurs dépendances
 *
 * Cette fonction utilise le BuildScheduler pour optimiser l'ordre de construction
 * et maximiser la parallélisation tout en respectant les dépendances.
 *
 * @param buildStoreConfig Configuration du build
 * @param isTest Indique si le build est en mode test
 * @returns Promesse résolue avec un booléen indiquant si tous les builds ont réussi
 */
export async function buildPackagesInParallel(
  buildStoreConfig: BuildStoreConfig,
  isTest: boolean = false
): Promise<boolean> {
  try {
    // Démarrer le chronomètre pour mesurer le temps de build
    const startTime = process.hrtime();

    // Initialiser le scheduler avec les packages à construire
    const scheduler = new BuildScheduler(
      [...buildStoreConfig.packages],
      isTest
    );

    // Construire les packages dans un ordre optimisé
    const results = await scheduler.buildInOptimalOrder();

    // Calculer le temps total
    const timeDiff = process.hrtime(startTime);
    const timeInMs = Math.round((timeDiff[0] * 1e9 + timeDiff[1]) / 1e6);

    // Vérifier si tous les builds ont réussi
    const allSucceeded = results.every((result) => result === true);

    if (allSucceeded) {
      buildStoreConfig.log(
        `Tous les packages ont été construits avec succès en ${timeInMs}ms`
      );
    } else {
      buildStoreConfig.log(
        `Certains packages n'ont pas pu être construits (temps écoulé: ${timeInMs}ms)`
      );
    }

    return allSucceeded;
  } catch (error) {
    buildStoreConfig.log(
      `Erreur lors de la construction parallèle des packages:`,
      error
    );
    return false;
  }
}
