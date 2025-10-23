/**
 * Utilitaire avancé pour surveiller l'utilisation de la mémoire dans rollup-plugin-dts
 * Ce fichier fournit des outils pour une instrumentation détaillée de l'utilisation de la mémoire
 * à différentes étapes du processus de génération des fichiers .d.ts
 */

import v8 from "v8";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MemoryLogger } from "../../utils/memoryLogger.js";

// Récupérer le chemin du répertoire actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Créer un logger spécifique pour le plugin DTS
const dtsMemoryLogger = new MemoryLogger("dts-memory-detailed.log");

// Initialiser le suivi d'étapes
const stepTimers = new Map<
  string,
  { start: number; memory: NodeJS.MemoryUsage }
>();

/**
 * Commence le suivi d'une étape de traitement
 * @param stepName Nom de l'étape
 * @param fileName Nom du fichier traité
 */
export function startStep(stepName: string, fileName: string): void {
  const key = `${stepName}:${fileName}`;
  stepTimers.set(key, {
    start: performance.now(),
    memory: process.memoryUsage()
  });

  // Utiliser la méthode publique au lieu de logEntry privée
  dtsMemoryLogger.logPackageStart(`START ${stepName}-file:${fileName}`);
  console.log(`[Memory] Début de l'étape "${stepName}" pour ${fileName}`);
}

/**
 * Termine le suivi d'une étape et enregistre les métriques
 * @param stepName Nom de l'étape
 * @param fileName Nom du fichier traité
 */
export function endStep(stepName: string, fileName: string): void {
  const key = `${stepName}:${fileName}`;
  const startData = stepTimers.get(key);

  if (!startData) {
    console.warn(
      `[Memory] Aucune donnée de départ pour l'étape "${stepName}" sur ${fileName}`
    );
    return;
  }

  const endTime = performance.now();
  const duration = endTime - startData.start;
  const endMemory = process.memoryUsage();

  // Calculer les différences de mémoire
  const heapUsedDiff =
    (endMemory.heapUsed - startData.memory.heapUsed) / (1024 * 1024);
  const rssDiff = (endMemory.rss - startData.memory.rss) / (1024 * 1024);

  // Utiliser la méthode publique au lieu de logEntry privée
  dtsMemoryLogger.logPackageEnd(
    `END ${stepName}-file:${fileName} (Durée: ${duration.toFixed(
      2
    )}ms, Diff: ${heapUsedDiff.toFixed(2)}MB)`
  );

  // Loguer les détails dans la console
  console.log(
    `[Memory] Fin de l'étape "${stepName}" pour ${fileName} - ` +
      `Durée: ${duration.toFixed(2)}ms, ` +
      `Diff mémoire: ${heapUsedDiff > 0 ? "+" : ""}${heapUsedDiff.toFixed(2)}MB`
  );

  console.log(
    `[Memory] Fin de l'étape "${stepName}" pour ${fileName}`,
    `- Durée: ${duration.toFixed(2)}ms`,
    `- Différence heap: ${heapUsedDiff.toFixed(2)}MB`,
    `- Différence RSS: ${rssDiff.toFixed(2)}MB`
  );

  // Nettoyer
  stepTimers.delete(key);

  // Si la différence de heap est importante, suggérer un nettoyage
  if (Math.abs(heapUsedDiff) > 50) {
    console.log(
      `[Memory] Différence significative de heap détectée pour "${stepName}" sur ${fileName}`
    );

    // Suggérer au GC de s'exécuter
    if (typeof global.gc === "function") {
      console.log(
        `[Memory] Exécution du garbage collector après une étape à haute consommation...`
      );
      global.gc();
    }

    // Capturer un snapshot si demandé via variable d'environnement
    if (process.env.CAPTURE_MEMORY_SNAPSHOTS === "true") {
      captureHeapSnapshot(`high-memory-${stepName}-${path.basename(fileName)}`);
    }
  }
}

/**
 * Capture un snapshot de la heap pour analyse ultérieure
 * @param label Étiquette pour identifier le snapshot
 */
export function captureHeapSnapshot(label: string): void {
  const timestamp = Date.now();
  const snapshotPath = path.join(
    __dirname,
    `../../../heap-snapshots/${label}-${timestamp}.heapsnapshot`
  );

  // S'assurer que le répertoire existe
  const dir = path.dirname(snapshotPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`[Memory] Capture d'un snapshot heap: ${snapshotPath}`);

  try {
    // Forcer le GC avant de prendre le snapshot
    if (global.gc) global.gc();

    // Prendre le snapshot
    const heapSnapshot = v8.writeHeapSnapshot(snapshotPath);

    console.log(`[Memory] Snapshot heap capturé avec succès: ${snapshotPath}`);
    return;
  } catch (error) {
    console.error(
      `[Memory] Erreur lors de la capture du snapshot heap:`,
      error
    );
  }
}

/**
 * Mesure l'utilisation de la mémoire pour une fonction spécifique
 * @param fn Fonction à mesurer
 * @param label Étiquette pour identifier la mesure
 * @returns Le résultat de la fonction
 */
export async function measureMemoryUsage<T>(
  fn: () => Promise<T> | T,
  label: string
): Promise<T> {
  // Forcer le GC avant la mesure si disponible
  if (global.gc) global.gc();

  const memBefore = process.memoryUsage();
  console.log(
    `[Memory] Début de la mesure pour "${label}": Heap=${(
      memBefore.heapUsed /
      1024 /
      1024
    ).toFixed(2)}MB, RSS=${(memBefore.rss / 1024 / 1024).toFixed(2)}MB`
  );

  startStep(label, "global");

  try {
    const result = await Promise.resolve(fn());
    return result;
  } finally {
    const memAfter = process.memoryUsage();
    endStep(label, "global");

    const heapDiff = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);
    const rssDiff = (memAfter.rss - memBefore.rss) / (1024 * 1024);

    console.log(
      `[Memory] Fin de la mesure pour "${label}":`,
      `Heap=${(memAfter.heapUsed / 1024 / 1024).toFixed(2)}MB (${
        heapDiff > 0 ? "+" : ""
      }${heapDiff.toFixed(2)}MB)`,
      `RSS=${(memAfter.rss / 1024 / 1024).toFixed(2)}MB (${
        rssDiff > 0 ? "+" : ""
      }${rssDiff.toFixed(2)}MB)`
    );

    // Si la différence est importante, prendre un snapshot
    if (Math.abs(heapDiff) > 50 || Math.abs(rssDiff) > 100) {
      captureHeapSnapshot(`${label}-large-diff`);
    }
  }
}

/**
 * Moniteur avancé pour l'utilisation de la mémoire
 * Permet de suivre l'évolution de la mémoire sur une période
 */
export class AdvancedMemoryMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private samples: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  }> = [];

  /**
   * Commence le monitoring de la mémoire
   * @param intervalMs Intervalle entre les échantillons en ms
   */
  start(intervalMs = 1000): void {
    this.stop(); // S'assurer qu'il n'y a pas déjà un monitoring en cours

    this.intervalId = setInterval(() => {
      const mem = process.memoryUsage();
      this.samples.push({
        timestamp: Date.now(),
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
        external: mem.external
      });

      // Limiter le nombre d'échantillons pour éviter une fuite de mémoire
      if (this.samples.length > 10000) {
        this.samples = this.samples.slice(this.samples.length - 10000);
      }
    }, intervalMs);
  }

  /**
   * Arrête le monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Exporte les données collectées vers un fichier CSV
   * @param filePath Chemin du fichier de sortie
   */
  exportToCSV(filePath: string): void {
    const lines = ["timestamp,heapUsed,heapTotal,rss,external"];

    for (const sample of this.samples) {
      lines.push(
        `${sample.timestamp},${sample.heapUsed},${sample.heapTotal},${sample.rss},${sample.external}`
      );
    }

    fs.writeFileSync(filePath, lines.join("\n"));
    console.log(`[Memory] Données exportées vers ${filePath}`);
  }

  /**
   * Analyse les données et identifie les tendances
   * @returns Un résumé de l'analyse
   */
  analyzeTrends(): {
    averageHeapGrowth: number;
    peakRSS: number;
    potentialLeaks: boolean;
    recommendations: string[];
  } {
    if (this.samples.length < 10) {
      return {
        averageHeapGrowth: 0,
        peakRSS: 0,
        potentialLeaks: false,
        recommendations: ["Pas assez de données pour l'analyse"]
      };
    }

    // Calculer la croissance moyenne du heap
    let totalHeapGrowth = 0;
    for (let i = 1; i < this.samples.length; i++) {
      totalHeapGrowth +=
        this.samples[i].heapUsed - this.samples[i - 1].heapUsed;
    }
    const averageHeapGrowth = totalHeapGrowth / (this.samples.length - 1);

    // Trouver le pic de RSS
    const peakRSS = Math.max(...this.samples.map((s) => s.rss));

    // Détecter les fuites potentielles
    const firstQuarter = this.samples.slice(
      0,
      Math.floor(this.samples.length / 4)
    );
    const lastQuarter = this.samples.slice(
      Math.floor((this.samples.length * 3) / 4)
    );

    const avgHeapFirstQuarter =
      firstQuarter.reduce((sum, s) => sum + s.heapUsed, 0) /
      firstQuarter.length;
    const avgHeapLastQuarter =
      lastQuarter.reduce((sum, s) => sum + s.heapUsed, 0) / lastQuarter.length;

    const potentialLeaks = avgHeapLastQuarter > avgHeapFirstQuarter * 1.5;

    // Recommandations
    const recommendations: string[] = [];
    if (potentialLeaks) {
      recommendations.push(
        "Croissance constante du heap détectée, indiquant une fuite de mémoire potentielle"
      );
    }
    if (averageHeapGrowth > 1024 * 1024) {
      recommendations.push(
        "Taux de croissance du heap élevé. Considérer un traitement par lots plus petits"
      );
    }
    if (peakRSS > 3.5 * 1024 * 1024 * 1024) {
      recommendations.push(
        "Utilisation de RSS proche de la limite. Réduire la taille des programmes TypeScript"
      );
    }

    return {
      averageHeapGrowth,
      peakRSS,
      potentialLeaks,
      recommendations:
        recommendations.length > 0
          ? recommendations
          : ["Aucun problème majeur détecté"]
    };
  }
}

// Singleton pour le monitoring avancé
export const memoryMonitor = new AdvancedMemoryMonitor();

// Exporter une fonction pour démarrer facilement le monitoring
export function startMemoryMonitoring(interval = 1000): void {
  memoryMonitor.start(interval);
  dtsMemoryLogger.start(interval);
  console.log(
    `[Memory] Monitoring avancé démarré avec un intervalle de ${interval}ms`
  );
}

// Exporter une fonction pour arrêter le monitoring et analyser les résultats
export function stopAndAnalyzeMemory(
  outputFile = "memory-analysis-result.csv"
): void {
  memoryMonitor.stop();
  dtsMemoryLogger.stop();

  memoryMonitor.exportToCSV(path.join(process.cwd(), outputFile));

  const analysis = memoryMonitor.analyzeTrends();
  console.log("\n[Memory] Analyse de l'utilisation de la mémoire :");
  console.log(
    `- Croissance moyenne du heap: ${(
      analysis.averageHeapGrowth /
      (1024 * 1024)
    ).toFixed(2)}MB par échantillon`
  );
  console.log(
    `- Pic de RSS: ${(analysis.peakRSS / (1024 * 1024 * 1024)).toFixed(2)}GB`
  );
  console.log(
    `- Fuites potentielles: ${analysis.potentialLeaks ? "OUI" : "NON"}`
  );
  console.log("- Recommandations:");
  analysis.recommendations.forEach((rec) => console.log(`  * ${rec}`));
}

// API principale
export default {
  startStep,
  endStep,
  captureHeapSnapshot,
  measureMemoryUsage,
  startMemoryMonitoring,
  stopAndAnalyzeMemory,
  monitor: memoryMonitor
};
