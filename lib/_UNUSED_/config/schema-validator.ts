import { z } from "zod";
import {
  TBuildOptions,
  buildOptionsSchema
} from "../phases/initialization/build-options.class";

/**
 * Valide les options de build
 *
 * @param options Options de build à valider
 * @returns Options de build validées
 */
export function validateBuildOptions(
  options: Partial<TBuildOptions>
): TBuildOptions {
  try {
    // Assurer que toutes les propriétés requises sont présentes
    const fullOptions = {
      watch: options.watch ?? true,
      forceRebuild: options.forceRebuild ?? false,
      clean: options.clean ?? false,
      verbose: options.verbose ?? false,
      silent: options.silent ?? false,
      useCache: options.useCache ?? true,
      clearCache: options.clearCache ?? false
    };
    return buildOptionsSchema.parse(fullOptions) as TBuildOptions;
  } catch (error) {
    console.error("Erreur de validation des options de build:", error);
    // Retourner les options par défaut en cas d'erreur
    return {
      watch: true,
      forceRebuild: false,
      clean: false,
      verbose: false,
      silent: false,
      useCache: true,
      clearCache: false
    } as TBuildOptions;
  }
}

/**
 * Schéma de validation pour un package.json
 */
export const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  main: z.string().optional(),
  module: z.string().optional(),
  types: z.string().optional(),
  exports: z.record(z.any()).optional()
});

/**
 * Valide un package.json
 *
 * @param packageJson Contenu du package.json à valider
 * @returns Boolean indiquant si le package.json est valide
 */
export function validatePackageJson(packageJson: unknown): boolean {
  try {
    packageJsonSchema.parse(packageJson);
    return true;
  } catch (error) {
    return false;
  }
}
