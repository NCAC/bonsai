/**
 * Bundle des définitions TypeScript pour le framework
 *
 * Ce module génère un fichier .d.ts à plat contenant directement
 * tous les types des packages @bonsai/xxx inclus dans le framework.
 */

import * as path from "node:path";
import fileSystem from "fs-extra";
import { TFramework } from "@lib/build/build.type";
import { Logger } from "@build/monitoring/logger.class";
import { PathManager } from "@build/core/path-manager.class";
import { generateFlatFrameworkDts } from "@build/bundling/generate-flat-framework-dts";

/**
 * Génère un fichier bundle de définitions TypeScript (.d.ts) pour le framework
 * en incluant directement tous les types des packages (bundle à plat).
 *
 * @param framework - TFramework représentant le framework
 */
export async function bundleFrameworkDts(framework: TFramework): Promise<void> {
  const logger = Logger.me();
  const pathManager = PathManager.me();

  logger.info(
    `🔄 Bundling des types pour le framework ${framework.packageJson.name}`
  );

  try {
    // Utiliser le générateur de types à plat dynamique
    await generateFlatFrameworkDts(
      framework.srcFile,
      framework.outDtsFile,
      pathManager.rootPath
    );

    logger.success(
      `✅ Bundle DTS généré pour le framework: ${framework.outDtsFile}`
    );
  } catch (error) {
    logger.error(`❌ Erreur lors de la génération du bundle DTS:`, error);
    throw error;
  }
}
