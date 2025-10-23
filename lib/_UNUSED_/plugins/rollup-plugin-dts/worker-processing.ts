/**
 * Worker Thread pour le traitement isolé des fichiers .d.ts
 * Ce fichier permet de traiter les bibliothèques volumineuses dans des processus séparés
 * pour éviter la consommation excessive de mémoire dans le processus principal
 */

import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import * as path from "node:path";
import ts from "typescript";
import { getCompilerOptions, createProgram } from "./program.js";
import { transform } from "./transform/index.js";
import { preProcess } from "./transform/preprocess.js";
import { convert } from "./transform/Transformer.js";
import { cleanupAllCaches } from "./memory-utils.js";
import memoryMonitor from "./memory-monitor.js";

// Type pour les données échangées avec les workers
interface WorkerInput {
  // Nom du paquet à traiter
  packageName: string;
  // Fichier d'entrée à traiter
  entryFile: string;
  // Options du compilateur
  compilerOptions?: ts.CompilerOptions;
  // Chemin du tsconfig
  tsconfig?: string;
  // Taille maximale du lot (nombre de fichiers)
  batchSize?: number;
}

interface WorkerOutput {
  success: boolean;
  result?: any;
  error?: string;
  memoryStats?: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
}

// Fonction principale pour traiter un package dans un worker thread
async function processPackageInWorker(
  input: WorkerInput
): Promise<WorkerOutput> {
  try {
    // Démarrer le monitoring de la mémoire
    memoryMonitor.startMemoryMonitoring(500);

    // Mesurer l'utilisation de la mémoire pour tout le traitement
    return await memoryMonitor.measureMemoryUsage(async () => {
      console.log(
        `[Worker] Traitement du package: ${input.packageName}, fichier d'entrée: ${input.entryFile}`
      );

      // Obtenir les options du compilateur
      const options =
        input.compilerOptions ||
        getCompilerOptions(input.entryFile, {}, input.tsconfig).compilerOptions;

      // Créer un programme TypeScript
      memoryMonitor.startStep("createProgram", input.entryFile);
      const program = createProgram(input.entryFile, options, input.tsconfig);
      memoryMonitor.endStep("createProgram", input.entryFile);

      // Récupérer tous les fichiers sources
      const sourceFiles = program
        .getSourceFiles()
        .filter(
          (sf) =>
            !sf.fileName.includes("node_modules") &&
            !sf.fileName.includes("lib.d.ts")
        );

      console.log(
        `[Worker] Nombre de fichiers sources à traiter: ${sourceFiles.length}`
      );

      // Traiter les fichiers par lots pour économiser la mémoire
      const batchSize = input.batchSize || 5; // Réduit de 10 à 5
      const results = [];
      const allTypeReferences = new Map<string, Set<string>>();
      const allFileReferences = new Map<string, Set<string>>();

      // Limiter le nombre total de fichiers traités pour éviter les boucles infinies
      const maxFilesToProcess = 500; // Limite de sécurité
      const filesToProcess = sourceFiles.slice(0, maxFilesToProcess);

      if (sourceFiles.length > maxFilesToProcess) {
        console.log(
          `[Worker] ⚠️ Limitation à ${maxFilesToProcess} fichiers sur ${sourceFiles.length} pour éviter une boucle infinie`
        );
      }

      for (let i = 0; i < sourceFiles.length; i += batchSize) {
        memoryMonitor.captureHeapSnapshot(`batch-start-${i}`);

        const batch = sourceFiles.slice(i, i + batchSize);
        console.log(
          `[Worker] Traitement du lot ${i / batchSize + 1}/${Math.ceil(
            sourceFiles.length / batchSize
          )}, ${batch.length} fichiers`
        );

        // Limiter le nombre total de fichiers traités pour éviter les boucles infinies
        if (i >= 500) {
          // Limite de sécurité
          console.log(
            `[Worker] ⚠️ Arrêt du traitement après 500 fichiers pour éviter une boucle infinie`
          );
          break;
        }

        for (const sourceFile of batch) {
          memoryMonitor.startStep("transformFile", sourceFile.fileName);

          try {
            // Extraire le code source
            const code = sourceFile.getFullText();

            // Transformer le code
            // Pour éviter les problèmes de contexte 'this', nous n'utilisons pas directement
            // la fonction transform() du plugin, mais une version simplifiée
            const sourceFileName = sourceFile.fileName;
            const sourceCode = code;

            try {
              // Utiliser les fonctions du module transform
              const name = sourceFileName.replace(/\.[^/.]+$/, ""); // Enlever l'extension
              const isEntry = false; // Définir en fonction du contexte
              const isJSON = sourceFileName.endsWith(".json");

              // Prétraitement (préprocessing)
              memoryMonitor.startStep("preprocess", sourceFileName);
              const sourceFile = ts.createSourceFile(
                sourceFileName,
                sourceCode,
                ts.ScriptTarget.Latest,
                true
              );
              const preprocessed = preProcess({ sourceFile, isEntry, isJSON });
              memoryMonitor.endStep("preprocess", sourceFileName);

              // Conversion
              memoryMonitor.startStep("convert", sourceFileName);
              const sourceFileAfterPreprocess = ts.createSourceFile(
                sourceFileName,
                preprocessed.code.toString(),
                ts.ScriptTarget.Latest,
                true
              );

              // Utilisez la fonction convert importée directement
              const converted = convert({
                sourceFile: sourceFileAfterPreprocess
              });
              memoryMonitor.endStep("convert", sourceFileName);

              const transformedCode = sourceCode; // On garde le code source original pour ce test

              results.push({
                fileName: sourceFileName,
                code: transformedCode,
                typeReferences: preprocessed.typeReferences,
                fileReferences: preprocessed.fileReferences
              });
            } catch (err) {
              console.error(
                `[Worker] Erreur de transformation pour ${sourceFileName}:`,
                err
              );
              // En cas d'erreur, utiliser le code d'origine
              results.push({
                fileName: sourceFileName,
                code: sourceCode,
                typeReferences: new Set(),
                fileReferences: new Set()
              });
            }
          } catch (err) {
            console.error(
              `[Worker] Erreur lors de la transformation de ${sourceFile.fileName}:`,
              err
            );
          } finally {
            memoryMonitor.endStep("transformFile", sourceFile.fileName);

            // Collecter les références pour les utiliser plus tard
            for (const result of results) {
              if (result.typeReferences) {
                allTypeReferences.set(result.fileName, result.typeReferences);
              }
              if (result.fileReferences) {
                allFileReferences.set(result.fileName, result.fileReferences);
              }
            }
          }
        }

        // Nettoyage après chaque lot
        cleanupAllCaches();
        if (global.gc) global.gc();

        memoryMonitor.captureHeapSnapshot(`batch-end-${i}`);
      }

      // Nettoyer après le traitement
      cleanupAllCaches();
      if (global.gc) global.gc();

      // Obtenir les statistiques de mémoire actuelles
      const memoryStats = process.memoryUsage();

      return {
        success: true,
        result: {
          files: results,
          typeReferences: allTypeReferences,
          fileReferences: allFileReferences
        },
        memoryStats: {
          heapUsed: memoryStats.heapUsed,
          heapTotal: memoryStats.heapTotal,
          rss: memoryStats.rss,
          external: memoryStats.external
        }
      };
    }, `processPackage-${input.packageName}`);
  } catch (error) {
    console.error("[Worker] Erreur dans le worker:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      memoryStats: process.memoryUsage()
    };
  } finally {
    // Arrêter et analyser le monitoring
    memoryMonitor.stopAndAnalyzeMemory(
      `memory-worker-${input.packageName}.csv`
    );
  }
}

// Code exécuté dans le worker thread
if (!isMainThread && parentPort) {
  // Recevoir les données du thread principal
  const input = workerData as WorkerInput;

  // Traiter les données
  processPackageInWorker(input)
    .then((result) => {
      // Envoyer le résultat au thread principal
      parentPort!.postMessage(result);
    })
    .catch((error) => {
      // Envoyer l'erreur au thread principal
      parentPort!.postMessage({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        memoryStats: process.memoryUsage()
      });
    });
}

// Fonction pour créer et exécuter un worker
export function runInWorker(input: WorkerInput): Promise<WorkerOutput> {
  return new Promise((resolve, reject) => {
    // Créer un worker avec les données d'entrée
    const worker = new Worker(new URL(import.meta.url), {
      workerData: input
    });

    // Gérer les messages du worker
    worker.on("message", resolve);

    // Gérer les erreurs
    worker.on("error", reject);

    // Gérer la fin du worker
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

// Fonction pour traiter un package complet
export async function processPackage(
  packageName: string,
  entryFile: string,
  options?: {
    compilerOptions?: ts.CompilerOptions;
    tsconfig?: string;
    batchSize?: number;
  }
): Promise<any> {
  console.log(
    `[Main] Début du traitement du package ${packageName} dans un worker`
  );

  const result = await runInWorker({
    packageName,
    entryFile,
    compilerOptions: options?.compilerOptions,
    tsconfig: options?.tsconfig,
    batchSize: options?.batchSize
  });

  if (!result.success) {
    throw new Error(`Échec du traitement de ${packageName}: ${result.error}`);
  }

  console.log(
    `[Main] Traitement du package ${packageName} terminé avec succès`
  );
  console.log(
    `[Main] Statistiques mémoire: ${JSON.stringify(result.memoryStats)}`
  );

  return result.result;
}

// Fonction pour traiter plusieurs packages en parallèle, mais avec un nombre limité de workers simultanés
export async function processPackagesInParallel(
  packages: Array<{ name: string; entryFile: string }>,
  options?: {
    compilerOptions?: ts.CompilerOptions;
    tsconfig?: string;
    batchSize?: number;
    maxConcurrent?: number;
  }
): Promise<Record<string, any>> {
  const maxConcurrent = options?.maxConcurrent || 2;
  const results: Record<string, any> = {};

  // Traiter les packages par lots pour limiter l'utilisation de la mémoire
  for (let i = 0; i < packages.length; i += maxConcurrent) {
    const batch = packages.slice(i, i + maxConcurrent);
    console.log(
      `[Main] Traitement du lot de packages ${
        i / maxConcurrent + 1
      }/${Math.ceil(packages.length / maxConcurrent)}`
    );

    // Traiter chaque package du lot en parallèle
    const batchPromises = batch.map((pkg) =>
      processPackage(pkg.name, pkg.entryFile, options)
        .then((result) => {
          results[pkg.name] = result;
          return { name: pkg.name, success: true };
        })
        .catch((error) => {
          console.error(
            `[Main] Erreur lors du traitement de ${pkg.name}:`,
            error
          );
          return { name: pkg.name, success: false, error };
        })
    );

    // Attendre que tous les packages du lot soient traités
    await Promise.all(batchPromises);

    // Forcer le GC après chaque lot
    if (global.gc) {
      console.log(
        "[Main] Forçage du GC après le traitement du lot de packages"
      );
      global.gc();
    }
  }

  return results;
}

export default {
  processPackage,
  processPackagesInParallel
};
