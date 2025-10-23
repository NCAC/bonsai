import { z } from "zod";
import minimist from "minimist";
import { Logger } from "@build/monitoring/logger.class";

/**
 * Schéma de validation pour les options de build
 */
export const buildOptionsSchema = z.object({
  // Options de mode de build
  watch: z
    .boolean()
    .default(true)
    .describe("Surveiller les fichiers pour reconstruire automatiquement"),

  // Options de nettoyage
  clean: z
    .boolean()
    .default(false)
    .describe("Nettoyer les dossiers dist avant la construction"),
  forceRebuild: z
    .boolean()
    .default(false)
    .describe("Forcer la reconstruction de tous les packages"),

  // Options de verbosité
  verbose: z.boolean().default(false).describe("Afficher plus d'informations"),
  silent: z.boolean().default(false).describe("Réduire les messages de log"),

  // Options de cache
  useCache: z.boolean().default(true).describe("Utiliser le cache de build"),
  clearCache: z.boolean().default(false).describe("Vider le cache de build")
});

/**
 * Type dérivé du schéma pour les options de build
 */
export type TBuildOptions = z.infer<typeof buildOptionsSchema>;

/**
 * Classe pour gérer les options de build
 */
export class BuildOptions {
  private static instance: BuildOptions;
  private options: TBuildOptions;
  private logger: Logger;

  /**
   * Constructeur privé pour le singleton
   */
  private constructor() {
    this.logger = Logger.me();
    this.options = this.parseCommandLineArgs();
  }

  /**
   * Obtenir l'instance des options de build
   */
  public static me(): BuildOptions {
    if (!BuildOptions.instance) {
      BuildOptions.instance = new BuildOptions();
    }
    return BuildOptions.instance;
  }

  /**
   * Analyser les arguments de ligne de commande
   */
  private parseCommandLineArgs(): TBuildOptions {
    const args = minimist(process.argv.slice(2));

    // Conversion des arguments en options valides
    const rawOptions: Partial<TBuildOptions> = {
      watch: args.hasOwnProperty("no-watch") ? !args["no-watch"] : true,
      clean: args.clean || false,
      forceRebuild: args["force-rebuild"] || false,
      verbose: args.verbose || false,
      silent: args.silent || false,
      useCache: args.hasOwnProperty("no-cache") ? !args["no-cache"] : true,
      clearCache: args["clear-cache"] || false
    };

    try {
      // Validation du schéma
      const validatedOptions = buildOptionsSchema.parse(rawOptions);

      if (validatedOptions.silent && validatedOptions.verbose) {
        this.logger.warn(
          "Les options silent et verbose sont mutuellement exclusives. silent sera ignoré."
        );
        validatedOptions.silent = false;
      }

      this.logger.info("Options de build validées:");

      return validatedOptions;
    } catch (error) {
      this.logger.error(
        "Erreur lors de la validation des options de build:",
        error
      );
      // Retourner les options par défaut en cas d'erreur
      return buildOptionsSchema.parse({});
    }
  }

  /**
   * Obtenir toutes les options de build
   */
  public get all(): TBuildOptions {
    return this.options;
  }

  /**
   * Mise à jour des options de build
   */
  public update(newOptions: Partial<TBuildOptions>): void {
    try {
      this.options = buildOptionsSchema.parse({
        ...this.options,
        ...newOptions
      });
    } catch (error) {
      this.logger.error(
        "Erreur lors de la mise à jour des options de build:",
        error
      );
    }
  }

  /**
   * Afficher un résumé des options de build
   */
  public displaySummary(): void {
    this.logger.info("=== Options de build ===");

    // Afficher les autres options
    if (this.options.clean) {
      this.logger.info("Nettoyage préalable: Activé");
    }
    if (this.options.forceRebuild) {
      this.logger.info("Reconstruction forcée: Activée");
    }
    if (this.options.verbose) {
      this.logger.info("Mode verbeux: Activé");
    }
    if (!this.options.useCache) {
      this.logger.info("Cache: Désactivé");
    }
    if (this.options.clearCache) {
      this.logger.info("Vidage du cache: Activé");
    }

    // Surveillance des fichiers
    this.logger.info(
      `Surveillance des fichiers pour rebuild: ${
        this.options.watch ? "Activée" : "Désactivée"
      }`
    );
  }
}
