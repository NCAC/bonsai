/**
 * Utilitaire pour le traitement par lots de fichiers volumineux dans rollup-plugin-dts
 * Ce fichier contient des fonctions pour diviser le traitement des gros fichiers TypeScript
 * en lots plus petits afin de réduire la consommation mémoire
 */

import ts from "typescript";
import path from "path";
import { DTS_EXTENSIONS } from "./helpers.js";

/**
 * Configuration du traitement par lots
 */
export interface BatchProcessingConfig {
  // Taille maximale d'un lot (nombre de fichiers)
  batchSize: number;

  // Délai en ms entre le traitement de chaque lot
  delayBetweenBatches: number;

  // Bibliothèques à traiter par lots
  targetLibraries: string[];
}

// Configuration par défaut
export const DEFAULT_BATCH_CONFIG: BatchProcessingConfig = {
  batchSize: 5,
  delayBetweenBatches: 200,
  targetLibraries: ["rxjs", "typescript", "node_modules"]
};

/**
 * Détermine si un fichier doit être traité par lots
 */
export function shouldBatchProcess(
  fileName: string,
  config = DEFAULT_BATCH_CONFIG
): boolean {
  return config.targetLibraries.some((lib) => fileName.includes(lib));
}

/**
 * Divise un ensemble de fichiers en lots
 */
export function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Attends un délai spécifié (utile entre les lots)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Traite un ensemble de fichiers par lots
 * @param files Liste de fichiers à traiter
 * @param processor Fonction de traitement à appliquer à chaque lot
 * @param config Configuration du traitement par lots
 */
export async function processBatches<T, R>(
  files: T[],
  processor: (batch: T[]) => Promise<R[]>,
  config = DEFAULT_BATCH_CONFIG
): Promise<R[]> {
  const batches = createBatches(files, config.batchSize);
  const results: R[] = [];

  console.log(
    `🔄 Traitement de ${files.length} fichiers en ${batches.length} lots de ${config.batchSize} fichiers maximum`
  );

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(
      `  ⏳ Traitement du lot ${i + 1}/${batches.length} (${
        batch.length
      } fichiers)`
    );

    const batchResults = await processor(batch);
    results.push(...batchResults);

    // Forcer le GC entre les lots pour libérer la mémoire
    if (typeof global.gc === "function") {
      global.gc();
    }

    // Attendre un peu entre les lots pour permettre au GC de travailler
    if (i < batches.length - 1) {
      await delay(config.delayBetweenBatches);
    }
  }

  return results;
}
