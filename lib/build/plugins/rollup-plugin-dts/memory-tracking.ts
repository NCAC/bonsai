/**
 * Fonctions d'utilitaire pour améliorer la surveillance et le nettoyage de la mémoire
 * Ce fichier ajoute des outils supplémentaires pour mieux gérer la mémoire dans rollup-plugin-dts
 */

import { cleanupAllCaches } from "./memory-utils.js";
import { startStep, endStep, captureHeapSnapshot } from "./memory-monitor.js";
import * as path from "path";

/**
 * Seuil (en MB) pour considérer qu'une augmentation de mémoire est significative
 */
const MEMORY_INCREASE_THRESHOLD_MB = 50;

/**
 * Seuil (en MB) pour le nettoyage automatique de la mémoire
 */
const MEMORY_CLEANUP_THRESHOLD_MB = 100;

/**
 * Seuil (en MB) pour considérer une consommation de mémoire comme critique
 */
const CRITICAL_MEMORY_THRESHOLD_MB = 3000;

/**
 * Nombre maximal de fichiers à traiter en parallèle
 */
const MAX_PARALLEL_FILES = 10;

/**
 * Liste des fichiers en cours de traitement
 */
const filesInProgress = new Set<string>();

/**
 * Mesure l'utilisation de la mémoire avant et après l'exécution d'une fonction
 */
export async function withMemoryTracking<T>(
  fn: () => Promise<T> | T,
  stepName: string,
  fileName: string
): Promise<T> {
  startStep(stepName, fileName);

  try {
    const startMem = process.memoryUsage();
    const result = await Promise.resolve(fn());
    const endMem = process.memoryUsage();

    // Calculer la différence d'utilisation de la mémoire
    const heapDiffMB = (endMem.heapUsed - startMem.heapUsed) / (1024 * 1024);

    // Si l'augmentation est significative, nettoyer la mémoire
    if (heapDiffMB > MEMORY_INCREASE_THRESHOLD_MB) {
      console.log(
        `[Memory] Augmentation significative de la mémoire heap détectée: +${heapDiffMB.toFixed(
          2
        )}MB`
      );
      console.log(
        `[Memory] Exécution d'un nettoyage après ${stepName} pour ${fileName}`
      );
      cleanupMemoryIfNeeded(heapDiffMB, fileName);
    }

    return result;
  } finally {
    endStep(stepName, fileName);
  }
}

/**
 * Vérifie si le traitement d'un nouveau fichier peut commencer
 * en fonction de la charge actuelle et des limites de mémoire
 */
export function canProcessFile(fileName: string): boolean {
  const currentHeapUsed = process.memoryUsage().heapUsed / (1024 * 1024);

  // Si la mémoire est déjà proche de la limite, attendre
  if (currentHeapUsed > CRITICAL_MEMORY_THRESHOLD_MB) {
    console.log(
      `[Memory] Mémoire proche de la limite (${currentHeapUsed.toFixed(
        2
      )}MB). Nettoyage requis avant de traiter ${fileName}`
    );
    cleanupMemory();
    return false;
  }

  // Si trop de fichiers sont en cours de traitement, attendre
  if (filesInProgress.size >= MAX_PARALLEL_FILES) {
    console.log(
      `[Memory] Nombre maximal de fichiers en traitement atteint (${filesInProgress.size}). En attente pour ${fileName}`
    );
    return false;
  }

  // Ajouter le fichier à la liste des fichiers en cours
  filesInProgress.add(fileName);
  return true;
}

/**
 * Marque un fichier comme terminé
 */
export function fileProcessingComplete(fileName: string): void {
  filesInProgress.delete(fileName);
}

/**
 * Nettoie la mémoire si nécessaire, en fonction de l'augmentation de mémoire
 */
export function cleanupMemoryIfNeeded(
  heapIncreaseMB: number,
  context: string
): void {
  if (heapIncreaseMB > MEMORY_CLEANUP_THRESHOLD_MB) {
    console.log(
      `[Memory] Augmentation importante de la mémoire heap: +${heapIncreaseMB.toFixed(
        2
      )}MB pour ${context}`
    );
    console.log(`[Memory] Exécution d'un nettoyage approfondi...`);

    // Nettoyage plus agressif pour les augmentations importantes
    cleanupMemory();

    // Capture optionnelle d'un snapshot heap
    if (process.env.CAPTURE_MEMORY_SNAPSHOTS === "true") {
      captureHeapSnapshot(`high-memory-increase-${path.basename(context)}`);
    }
  } else if (heapIncreaseMB > MEMORY_INCREASE_THRESHOLD_MB) {
    console.log(
      `[Memory] Nettoyage standard après augmentation de mémoire de ${heapIncreaseMB.toFixed(
        2
      )}MB`
    );

    // Nettoyage standard
    cleanupAllCaches();

    // Forcer le GC si disponible
    if (typeof global.gc === "function") {
      setTimeout(() => {
        global.gc();
      }, 0);
    }
  }
}

/**
 * Effectue un nettoyage complet de la mémoire
 */
export function cleanupMemory(): void {
  console.log(`[Memory] Exécution d'un nettoyage complet de la mémoire...`);

  // Vider tous les caches
  cleanupAllCaches();

  // Exécuter le GC plusieurs fois pour un nettoyage plus complet
  if (typeof global.gc === "function") {
    global.gc();

    // Deuxième passage après un court délai
    setTimeout(() => {
      console.log(`[Memory] Deuxième passage du garbage collector...`);
      global.gc();

      const memAfterCleanup = process.memoryUsage().heapUsed / (1024 * 1024);
      console.log(
        `[Memory] Mémoire heap après nettoyage: ${memAfterCleanup.toFixed(2)}MB`
      );
    }, 100);
  }
}

/**
 * Fonction utilitaire pour retarder l'exécution en cas de manque de mémoire
 */
export async function waitForMemoryAvailability(): Promise<void> {
  const memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024);

  if (memoryUsage > CRITICAL_MEMORY_THRESHOLD_MB) {
    console.log(
      `[Memory] Mémoire critique détectée (${memoryUsage.toFixed(
        2
      )}MB). Pause et nettoyage...`
    );

    // Nettoyage de la mémoire
    cleanupMemory();

    // Attendre un moment pour laisser le temps au GC de faire son travail
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }

  return Promise.resolve();
}

export default {
  withMemoryTracking,
  canProcessFile,
  fileProcessingComplete,
  cleanupMemoryIfNeeded,
  cleanupMemory,
  waitForMemoryAvailability
};
