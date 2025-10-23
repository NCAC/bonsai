import { PathManager } from "@build/core/path-manager.class";
import { Logger, LogLevel } from "@build/monitoring/logger.class";
import { BuildOptions } from "@build/initializing/build-options.class";
import {
  componentsRegistry,
  TOrganizedComponents
} from "@lib/build/initializing/components-registry";
import chalk from "chalk";
import { buildCache } from "@build/core/build-cache.class";
import { BuildOrchestrator } from "@build/building/build-orchestrator.class";
import { cleanAllDistFromComponents } from "@build/utils/clean-dist.utils";
import { BuildCache } from "@build/cache/build-cache.class";

/**
 * Main entry point for the new Bonsai build system (v2)
 * This version uses a more modular and organized architecture
 */

// Initialize the path manager
const pathManager = PathManager.me();

/**
 * Display basic information about the build environment
 */
function displayPathsInfo() {
  console.log(chalk.blue("=== Bonsai Build System v2 ==="));
  console.log(
    chalk.blue(`Build start date: ${new Date().toLocaleString("fr-FR")}`)
  );
  console.log(chalk.blue(`Root path: ${pathManager.rootPath}`));

  // Check that essential paths exist
  const paths = [
    { name: "Packages", path: pathManager.packagesPath },
    { name: "Framework", path: pathManager.frameworkPath },
    { name: "Library", path: pathManager.libPath },
    { name: "Tools", path: pathManager.toolsPath }
  ];

  let allPathsValid = true;
  console.log(chalk.blue("Checking paths:"));

  paths.forEach(({ name, path }) => {
    const exists = pathManager.exists(path);
    console.log(
      `  ${name}: ${path} ${
        exists ? chalk.green("✓") : chalk.red("✗ (not found)")
      }`
    );
    if (!exists) allPathsValid = false;
  });

  if (!allPathsValid) {
    console.warn(
      chalk.yellow("⚠️ Some required paths were not found. The build may fail.")
    );
  }

  return allPathsValid;
}

/**
 * Main build function
 */
async function main() {
  try {
    // Display initial information and check paths
    const pathsValid = displayPathsInfo();
    if (!pathsValid) {
      console.error(
        chalk.red("Critical error: Cannot continue with missing paths.")
      );
      process.exit(1);
    }

    // Initialize the logging system
    const logger = Logger.me();
    logger.setLogLevel(LogLevel.INFO);
    logger.startTimer();

    // Load build options from command line arguments
    logger.info("Loading build options...");
    const buildOptions = BuildOptions.me();

    // If verbose mode is enabled, increase log detail level
    if (buildOptions.all.verbose) {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.debug("Verbose mode enabled");
    }

    // Display a summary of build options
    buildOptions.displaySummary();

    // Retrieve components (framework, libraries, packages)
    logger.info("Retrieving Bonsai components...");
    let components: TOrganizedComponents;

    try {
      components = await componentsRegistry.collect();

      logger.info("=== Component Summary ===");
      logger.info(`Framework: ${components.framework.packageJson.name}`);
      logger.info(`External libraries: ${components.libraries.length}`);
      logger.info(`Internal packages: ${components.packages.length}`);

      if (buildOptions.all.verbose) {
        logger.debug("Library details:");
        components.libraries.forEach((lib) => {
          logger.debug(
            `- ${lib.name}${
              lib.namespace ? ` (namespace: ${lib.namespace})` : ""
            }`
          );
        });

        logger.debug("Package details (build order):");
        components.packages.forEach((pkg, index) => {
          logger.debug(`${index + 1}. ${pkg.name}`);
        });
      }
    } catch (error) {
      logger.error(`Error analyzing components: ${error}`);
      process.exit(1);
    }

    // Clean dist folders if --clean is enabled
    if (buildOptions.all.clean) {
      logger.info("Option --clean detected: cleaning dist folders...");
      await cleanAllDistFromComponents(components);
    }

    // Initialize build cache
    logger.info("Initializing build cache...");
    await buildCache.initialize(buildOptions.all.clearCache);
    // Explicitly wait for the library cache to be ready (singleton)
    await BuildCache.getLibraryCacheSingleton().waitReady();

    // Prepare the build orchestrator
    logger.info("Preparing build orchestrator...");
    const orchestrator = BuildOrchestrator.me();

    // Execute the build
    const buildSuccess = await orchestrator.build(components);

    if (buildOptions.all.watch) {
      logger.info("Watch mode active: monitoring files for automatic rebuild");
      // Handle clean termination with signals
      process.on("SIGINT", async () => {
        logger.info("Interruption detected, stopping processes...");
        // await orchestrator.stopAllWatchers();
        process.exit(0);
      });
    } else {
      // If not in watch mode, stop the process immediately
      process.exit(buildSuccess ? 0 : 1);
    }
  } catch (error) {
    console.error(chalk.red("Fatal error during build:"), error);
    process.exit(1);
  }
}

// Execute the main function
main().catch((error) => {
  console.error(chalk.red("Unhandled error:"), error);
  process.exit(1);
});
