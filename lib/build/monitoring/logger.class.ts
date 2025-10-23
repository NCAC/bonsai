// 2. Dépendances externes
import chalk from "chalk";
import prettyHrTime from "pretty-hrtime";

/**
 * Niveaux de log supportés
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Class Logger pour centraliser la gestion des logs
 */
export class Logger {
  private static instance: Logger;
  private currentLogLevel: LogLevel = LogLevel.INFO;
  private startTime: [number, number] | null = null;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {}

  /**
   * Obtenir l'instance du logger
   */
  public static me(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Définir le niveau de log
   */
  public setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  /**
   * Démarrer le chronomètre pour mesurer le temps d'exécution
   */
  public startTimer(): void {
    this.startTime = process.hrtime();
  }

  /**
   * Obtenir le temps écoulé depuis le démarrage du chronomètre
   */
  public getElapsedTime(): string {
    if (!this.startTime) {
      return "Timer not started";
    }
    return prettyHrTime(process.hrtime(this.startTime));
  }

  /**
   * Log de niveau debug
   */
  public debug(message: string): void {
    if (this.currentLogLevel <= LogLevel.DEBUG) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  /**
   * Log de niveau info
   */
  public info(message: string): void {
    if (this.currentLogLevel <= LogLevel.INFO) {
      console.log(chalk.blue(`[INFO] ${message}`));
    }
  }

  /**
   * Log de niveau warn
   */
  public warn(message: string): void {
    if (this.currentLogLevel <= LogLevel.WARN) {
      console.log(chalk.yellow(`[WARN] ${message}`));
    }
  }

  /**
   * Log de niveau error
   */
  public error(message: string, error?: unknown): void {
    if (this.currentLogLevel <= LogLevel.ERROR) {
      console.error(chalk.red(`[ERROR] ${message}`));
      if (error) {
        if (error instanceof Error) {
          console.error(chalk.red(error.stack || error.message));
        } else {
          console.error(chalk.red(String(error)));
        }
      }
    }
  }

  /**
   * Log de succès (toujours affiché)
   */
  public success(message: string): void {
    console.log(chalk.green(`[SUCCESS] ${message}`));
  }

  /**
   * Log de progression avec pourcentage
   */
  public progress(current: number, total: number, message: string): void {
    if (this.currentLogLevel <= LogLevel.INFO) {
      const percentage = Math.round((current / total) * 100);
      console.log(
        chalk.cyan(`[${percentage}%] ${message} (${current}/${total})`)
      );
    }
  }
}
