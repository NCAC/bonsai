import { Logger } from "./logger.class";

/**
 * Interface pour les étapes du build
 */
export interface IBuildStep {
  name: string;
  weight: number; // Poids relatif de l'étape dans le processus total
  completed: boolean;
  progress: number; // 0 à 1
}

/**
 * Classe pour suivre et reporter la progression du build
 */
export class ProgressReporter {
  private static instance: ProgressReporter;
  private steps: IBuildStep[] = [];
  private logger: Logger;
  private totalWeight: number = 0;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Obtenir l'instance du rapporteur de progression
   */
  public static getInstance(): ProgressReporter {
    if (!ProgressReporter.instance) {
      ProgressReporter.instance = new ProgressReporter();
    }
    return ProgressReporter.instance;
  }

  /**
   * Initialiser les étapes du build
   */
  public initSteps(steps: Array<{ name: string; weight: number }>): void {
    this.steps = steps.map((step) => ({
      ...step,
      completed: false,
      progress: 0
    }));

    this.totalWeight = this.steps.reduce((sum, step) => sum + step.weight, 0);
  }

  /**
   * Mettre à jour la progression d'une étape
   */
  public updateStepProgress(stepName: string, progress: number): void {
    const stepIndex = this.steps.findIndex((step) => step.name === stepName);
    if (stepIndex !== -1) {
      this.steps[stepIndex].progress = Math.min(1, Math.max(0, progress));
      this.reportOverallProgress();
    }
  }

  /**
   * Marquer une étape comme complétée
   */
  public completeStep(stepName: string): void {
    const stepIndex = this.steps.findIndex((step) => step.name === stepName);
    if (stepIndex !== -1) {
      this.steps[stepIndex].completed = true;
      this.steps[stepIndex].progress = 1;
      this.reportOverallProgress();
    }
  }

  /**
   * Calculer et reporter la progression globale
   */
  private reportOverallProgress(): void {
    if (this.totalWeight === 0) return;

    const weightedProgress = this.steps.reduce(
      (sum, step) => sum + step.progress * step.weight,
      0
    );

    const overallProgress = weightedProgress / this.totalWeight;
    const completedSteps = this.steps.filter((step) => step.completed).length;

    this.logger.progress(
      completedSteps,
      this.steps.length,
      `Progression globale: ${Math.round(overallProgress * 100)}%`
    );
  }

  /**
   * Obtenir la progression actuelle
   */
  public getProgress(): number {
    if (this.totalWeight === 0) return 0;

    const weightedProgress = this.steps.reduce(
      (sum, step) => sum + step.progress * step.weight,
      0
    );

    return weightedProgress / this.totalWeight;
  }
}
