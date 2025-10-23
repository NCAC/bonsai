import v8 from "v8";
import fs from "fs";
import path from "path";

export class MemoryLogger {
  private logFile: string;
  private interval: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor(logFilename = "memory-usage.log") {
    this.logFile = path.join(process.cwd(), logFilename);
    this.startTime = Date.now();
    // Initialiser le fichier de log
    fs.writeFileSync(
      this.logFile,
      "Timestamp,Package,Heap Used (MB),Heap Total (MB),RSS (MB),External (MB)\n"
    );
  }

  /**
   * Commence la journalisation de la mémoire à intervalles réguliers
   */
  start(intervalMs = 1000) {
    this.interval = setInterval(() => {
      this.logMemoryUsage();
    }, intervalMs);
  }

  /**
   * Arrête la journalisation de la mémoire
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Enregistre une entrée ponctuelle pour un package spécifique
   */
  logPackageStart(packageName: string) {
    this.logEntry(packageName, "START");
  }

  logPackageEnd(packageName: string) {
    this.logEntry(packageName, "END");
  }

  private logEntry(packageName: string, state: string) {
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotal = memoryUsage.heapTotal / 1024 / 1024;
    const rss = memoryUsage.rss / 1024 / 1024;
    const external = memoryUsage.external / 1024 / 1024;

    // Récupérer les statistiques détaillées de la heap V8
    const heapStats = v8.getHeapStatistics();

    const entry = `${
      Date.now() - this.startTime
    },${packageName}-${state},${heapUsed.toFixed(2)},${heapTotal.toFixed(
      2
    )},${rss.toFixed(2)},${external.toFixed(2)}\n`;
    fs.appendFileSync(this.logFile, entry);

    // Journaliser les informations détaillées de la heap pour les étapes importantes
    console.log(
      `[Memory] ${packageName}-${state}: Heap Used: ${heapUsed.toFixed(
        2
      )}MB, Heap Total: ${heapTotal.toFixed(2)}MB, RSS: ${rss.toFixed(2)}MB`
    );
    console.log(
      `[V8 Heap] Total Size: ${(
        heapStats.total_heap_size /
        1024 /
        1024
      ).toFixed(2)}MB, Used: ${(heapStats.used_heap_size / 1024 / 1024).toFixed(
        2
      )}MB, Limit: ${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)}MB`
    );
  }

  private logMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotal = memoryUsage.heapTotal / 1024 / 1024;
    const rss = memoryUsage.rss / 1024 / 1024;
    const external = memoryUsage.external / 1024 / 1024;

    const entry = `${Date.now() - this.startTime},monitoring,${heapUsed.toFixed(
      2
    )},${heapTotal.toFixed(2)},${rss.toFixed(2)},${external.toFixed(2)}\n`;
    fs.appendFileSync(this.logFile, entry);
  }

  /**
   * Force une collecte des déchets explicite (à utiliser avec précaution)
   */
  forceGC() {
    if (global.gc) {
      console.log("[Memory] Forçage de la collecte des déchets...");
      global.gc();
    } else {
      console.log(
        "[Memory] La collecte des déchets explicite n'est pas disponible. Exécutez avec: tsx --expose-gc ./lib/build.ts"
      );
    }
  }

  /**
   * Journalise un message personnalisé dans le fichier de log
   */
  logCustomMessage(message: string) {
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotal = memoryUsage.heapTotal / 1024 / 1024;
    const rss = memoryUsage.rss / 1024 / 1024;
    const external = memoryUsage.external / 1024 / 1024;

    const entry = `${
      Date.now() - this.startTime
    },message:${message},${heapUsed.toFixed(2)},${heapTotal.toFixed(
      2
    )},${rss.toFixed(2)},${external.toFixed(2)}\n`;
    fs.appendFileSync(this.logFile, entry);

    console.log(
      `[Memory] ${message} - Heap Used: ${heapUsed.toFixed(
        2
      )}MB, RSS: ${rss.toFixed(2)}MB`
    );
  }

  /**
   * Nettoyage spécifique après les packages avec namespace
   * qui sont connus pour causer des fuites mémoire
   */
  cleanupAfterPackage(packageName: string) {
    console.log(`[Memory] Nettoyage après le package: ${packageName}`);

    // Forcer une collecte de déchets plus agressive
    if (global.gc) {
      // Exécuter plusieurs cycles de GC pour être sûr
      console.log(
        `[Memory] Exécution d'un premier cycle de GC pour ${packageName}`
      );
      global.gc();

      // Attendre un peu pour donner le temps au GC de faire son travail
      setTimeout(() => {
        // Exécuter un second cycle de GC
        console.log(
          `[Memory] Exécution d'un second cycle de GC pour ${packageName}`
        );
        global.gc();

        const memoryUsage = process.memoryUsage();
        const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
        console.log(`[Memory] Après GC: Heap Used: ${heapUsed.toFixed(2)}MB`);
        this.logEntry(packageName, "AFTER_GC");
      }, 100);
    } else {
      console.log(
        "[Memory] La collecte des déchets explicite n'est pas disponible. Exécutez avec: tsx --expose-gc ./lib/build.ts"
      );
    }
  }

  /**
   * Génère un résumé de l'utilisation de la mémoire
   */
  logSummary() {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
      const heapTotal = memoryUsage.heapTotal / 1024 / 1024;
      const rss = memoryUsage.rss / 1024 / 1024;

      console.log("\n📊 Résumé de l'utilisation de la mémoire:");
      console.log(
        `Durée d'exécution: ${((Date.now() - this.startTime) / 1000).toFixed(
          2
        )}s`
      );
      console.log(`Mémoire heap utilisée finale: ${heapUsed.toFixed(2)}MB`);
      console.log(`Mémoire heap totale finale: ${heapTotal.toFixed(2)}MB`);
      console.log(`Mémoire RSS finale: ${rss.toFixed(2)}MB`);
      console.log(`Détails enregistrés dans: ${this.logFile}`);
    } catch (error) {
      console.error(
        "Erreur lors de la génération du résumé de la mémoire:",
        error
      );
    }
  }
}

// Singleton pour être utilisé dans toute l'application
export const memoryLogger = new MemoryLogger();
