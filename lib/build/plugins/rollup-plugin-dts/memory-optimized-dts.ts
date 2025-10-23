/**
 * Implémentation de la transformation optimisée pour la mémoire du plugin rollup-plugin-dts.
 * Ce fichier étend le plugin original en ajoutant des optimisations pour gérer
 * les bibliothèques volumineuses comme RxJS plus efficacement.
 */

import * as path from "node:path";
import type { Plugin } from "rollup";
import { transform } from "./transform/index.js";
import {
  DEFAULT_BATCH_CONFIG,
  shouldBatchProcess,
  processBatches
} from "./batch-processing.js";
import { startStep, endStep } from "./memory-monitor.js";
import { forceGarbageCollection } from "./memory-utils.js";
import ts from "typescript";

/**
 * Options pour le plugin DTS optimisé pour la mémoire
 */
export interface MemoryOptimizedDtsOptions {
  // Active le traitement par lots pour les gros fichiers
  enableBatchProcessing?: boolean;

  // Configuration du traitement par lots
  batchConfig?: {
    // Taille maximale d'un lot (nombre de fichiers)
    batchSize?: number;

    // Délai en ms entre le traitement de chaque lot
    delayBetweenBatches?: number;

    // Bibliothèques à traiter par lots
    targetLibraries?: string[];
  };

  // Active la libération forcée de mémoire après le traitement de fichiers volumineux
  enableForcedGC?: boolean;

  // Seuil de mémoire (en MB) à partir duquel forcer le GC
  memoryThreshold?: number;

  // Limite le nombre de fichiers d'une même bibliothèque à traiter en même temps
  throttleLibraryFiles?: boolean;
}

/**
 * Version optimisée pour la mémoire du plugin rollup-plugin-dts
 *
 * @param options Options de configuration
 * @returns Plugin Rollup optimisé pour la mémoire
 */
export function memoryOptimizedDts(
  options: MemoryOptimizedDtsOptions = {}
): Plugin {
  const {
    enableBatchProcessing = true,
    batchConfig = {},
    enableForcedGC = true,
    memoryThreshold = 1024,
    throttleLibraryFiles = true
  } = options;

  // Fusionner la configuration par défaut avec celle fournie
  const batchProcessingConfig = {
    ...DEFAULT_BATCH_CONFIG,
    ...batchConfig
  };

  // Obtenir le plugin de base
  const basePlugin = transform();

  // Compteur pour suivre le nombre de fichiers traités
  let filesProcessed = 0;

  // Garde une trace des bibliothèques en cours de traitement
  const libraryProcessingCount = new Map<string, number>();

  /**
   * Extraire le nom de la bibliothèque à partir du chemin du fichier
   */
  function getLibraryName(filePath: string): string {
    if (filePath.includes("node_modules")) {
      const parts = filePath.split("node_modules/");
      if (parts.length > 1) {
        const modulePath = parts[1];
        return modulePath.split("/")[0];
      }
    }

    // Si ce n'est pas un module node, utiliser le dossier parent
    const parsed = path.parse(filePath);
    return parsed.dir.split(path.sep).pop() || "unknown";
  }

  /**
   * Vérifie si le traitement d'un fichier d'une bibliothèque doit être reporté
   */
  function shouldThrottleLibrary(filePath: string): boolean {
    if (!throttleLibraryFiles) return false;

    const libraryName = getLibraryName(filePath);
    const currentCount = libraryProcessingCount.get(libraryName) || 0;

    // Limiter à 3 fichiers simultanés pour une même bibliothèque (au lieu de 5)
    return currentCount >= 3;
  }

  /**
   * Incrémente le compteur de traitement pour une bibliothèque
   */
  function startLibraryProcessing(filePath: string): void {
    const libraryName = getLibraryName(filePath);
    libraryProcessingCount.set(
      libraryName,
      (libraryProcessingCount.get(libraryName) || 0) + 1
    );
  }

  /**
   * Décrémente le compteur de traitement pour une bibliothèque
   */
  function endLibraryProcessing(filePath: string): void {
    const libraryName = getLibraryName(filePath);
    const currentCount = libraryProcessingCount.get(libraryName) || 0;

    if (currentCount > 0) {
      libraryProcessingCount.set(libraryName, currentCount - 1);
    }
  }

  /**
   * Vérifie si le garbage collector doit être forcé
   */
  function checkAndForceGC(): void {
    if (!enableForcedGC) return;

    filesProcessed++;

    // Forcer le GC tous les X fichiers ou si la mémoire dépasse le seuil
    if (filesProcessed % 10 === 0) {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      if (heapUsedMB > memoryThreshold) {
        console.log(
          `🧹 Forçage du garbage collector (${heapUsedMB}MB utilisés)`
        );
        forceGarbageCollection();
      }
    }
  }

  // Modifier le plugin de base pour ajouter nos optimisations
  return {
    ...basePlugin,
    name: "memory-optimized-dts-transform",

    transform(code, id) {
      startStep("transform", id);

      // Vérifier si ce fichier doit être traité par lots
      if (
        enableBatchProcessing &&
        shouldBatchProcess(id, batchProcessingConfig)
      ) {
        console.log(`🔍 Traitement optimisé pour ${id}`);

        // Si on doit limiter le traitement des fichiers d'une même bibliothèque
        if (shouldThrottleLibrary(id)) {
          console.log(
            `⏳ Report du traitement de ${id} (trop de fichiers en cours)`
          );
          return null;
        }

        startLibraryProcessing(id);

        // Optimiser l'utilisation de la mémoire pendant la transformation
        try {
          // Appeler la transformation d'origine
          const result = basePlugin.transform?.call(this, code, id);

          // Forcer le GC si nécessaire
          checkAndForceGC();

          return result;
        } finally {
          endLibraryProcessing(id);
          endStep("transform", id);
        }
      } else {
        // Comportement normal pour les fichiers non concernés
        try {
          return basePlugin.transform?.call(this, code, id);
        } finally {
          endStep("transform", id);
        }
      }
    }, // Assurer le nettoyage de la mémoire entre les builds
    buildEnd() {
      // Pas besoin de vérifier basePlugin.buildEnd car il n'existe pas dans transform()

      // Réinitialiser les compteurs
      filesProcessed = 0;
      libraryProcessingCount.clear();

      // Forcer le GC à la fin du build
      if (enableForcedGC) {
        console.log("🧹 Nettoyage de la mémoire à la fin du build");
        forceGarbageCollection();
      }
    }
  };
}
