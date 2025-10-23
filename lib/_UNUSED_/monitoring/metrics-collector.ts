import { join } from "node:path";
import fs from "fs-extra";
import { Logger } from "./logger.class";

/**
 * Interface pour les métriques de build
 */
export interface IBuildMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    final?: NodeJS.MemoryUsage;
    peak?: NodeJS.MemoryUsage;
  };
  packageMetrics: Record<
    string,
    {
      name: string;
      buildTime: number;
      bundleSize?: number; // en octets
      dtsSize?: number; // en octets
      dependenciesCount: number;
    }
  >;
  errors: Array<{
    package?: string;
    message: string;
    stack?: string;
    phase: string;
  }>;
  warnings: Array<{
    package?: string;
    message: string;
    phase: string;
  }>;
}

/**
 * Classe pour collecter des métriques de build
 */
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: IBuildMetrics;
  private logger: Logger;
  private peakMemory: NodeJS.MemoryUsage;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {
    this.logger = Logger.getInstance();
    this.metrics = {
      startTime: Date.now(),
      memoryUsage: {
        initial: process.memoryUsage()
      },
      packageMetrics: {},
      errors: [],
      warnings: []
    };
    this.peakMemory = { ...this.metrics.memoryUsage.initial };
  }

  /**
   * Obtenir l'instance du collecteur de métriques
   */
  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Mettre à jour l'utilisation de la mémoire et suivre les pics
   */
  public updateMemoryUsage(): void {
    const currentMemory = process.memoryUsage();

    // Vérifier si c'est un nouveau pic de mémoire
    if (currentMemory.heapUsed > this.peakMemory.heapUsed) {
      this.peakMemory = { ...currentMemory };
      this.metrics.memoryUsage.peak = this.peakMemory;
    }
  }

  /**
   * Ajouter des métriques pour un package
   */
  public addPackageMetrics(
    packageName: string,
    metrics: {
      buildTime: number;
      bundleSize?: number;
      dtsSize?: number;
      dependenciesCount: number;
    }
  ): void {
    this.metrics.packageMetrics[packageName] = {
      name: packageName,
      ...metrics
    };
  }

  /**
   * Enregistrer une erreur
   */
  public recordError(
    error: Error,
    packageName?: string,
    phase: string = "unknown"
  ): void {
    this.metrics.errors.push({
      package: packageName,
      message: error.message,
      stack: error.stack,
      phase
    });
  }

  /**
   * Enregistrer un avertissement
   */
  public recordWarning(
    message: string,
    packageName?: string,
    phase: string = "unknown"
  ): void {
    this.metrics.warnings.push({
      package: packageName,
      message,
      phase
    });
  }

  /**
   * Finaliser les métriques à la fin du build
   */
  public finalizeBuild(): void {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    this.metrics.memoryUsage.final = process.memoryUsage();
  }

  /**
   * Obtenir toutes les métriques
   */
  public getMetrics(): IBuildMetrics {
    return this.metrics;
  }

  /**
   * Sauvegarder les métriques dans un fichier JSON
   */
  public saveMetricsToFile(outputPath?: string): void {
    const finalPath = outputPath || join(process.cwd(), "build-metrics.json");

    try {
      fs.writeJSONSync(finalPath, this.metrics, { spaces: 2 });
      this.logger.info(`Métriques de build sauvegardées dans ${finalPath}`);
    } catch (error) {
      this.logger.error(`Erreur lors de la sauvegarde des métriques:`, error);
    }
  }

  /**
   * Afficher un résumé des métriques
   */
  public printSummary(): void {
    if (!this.metrics.duration) {
      this.finalizeBuild();
    }

    this.logger.info("=== Résumé du Build ===");
    this.logger.info(
      `Durée totale: ${(this.metrics.duration! / 1000).toFixed(2)} secondes`
    );
    this.logger.info(
      `Packages traités: ${Object.keys(this.metrics.packageMetrics).length}`
    );
    this.logger.info(`Erreurs: ${this.metrics.errors.length}`);
    this.logger.info(`Avertissements: ${this.metrics.warnings.length}`);

    // Afficher l'utilisation de la mémoire
    const initialMB = Math.round(
      this.metrics.memoryUsage.initial.heapUsed / 1024 / 1024
    );
    const finalMB = Math.round(
      this.metrics.memoryUsage.final!.heapUsed / 1024 / 1024
    );
    const peakMB = Math.round(
      this.metrics.memoryUsage.peak!.heapUsed / 1024 / 1024
    );

    this.logger.info(
      `Mémoire utilisée: ${initialMB}MB → ${finalMB}MB (pic: ${peakMB}MB)`
    );

    // Afficher les packages les plus lents
    const slowestPackages = Object.values(this.metrics.packageMetrics)
      .sort((a, b) => b.buildTime - a.buildTime)
      .slice(0, 3);

    if (slowestPackages.length > 0) {
      this.logger.info("Packages les plus lents:");
      slowestPackages.forEach((pkg) => {
        this.logger.info(
          `  - ${pkg.name}: ${(pkg.buildTime / 1000).toFixed(2)} secondes`
        );
      });
    }
  }
}
