import { TBuildOptions } from "@lib/build/initializing/build-options.class";

/**
 * Configuration par défaut pour le système de build
 */
export const DEFAULT_BUILD_CONFIG: TBuildOptions = {
  watch: false,
  forceRebuild: false
};

/**
 * Configuration des plugins par défaut
 */
export const DEFAULT_PLUGINS_CONFIG = {
  typescript: {
    useTscCheck: true,
    tsconfigOverride: {
      compilerOptions: {
        sourceMap: true,
        declaration: false,
        declarationMap: false
      }
    }
  },
  rollup: {
    preserveModules: true,
    external: [
      "rxjs",
      "remeda",
      "@bonsai-labs/event",
      "@bonsai-labs/types",
      "zod"
    ]
  }
};

/**
 * Configuration des chemins par défaut
 */
export const DEFAULT_PATHS_CONFIG = {
  coreDir: "core",
  packagesDir: "packages",
  distDir: "dist",
  srcDir: "src",
  entryFile: "bonsai.ts"
};
