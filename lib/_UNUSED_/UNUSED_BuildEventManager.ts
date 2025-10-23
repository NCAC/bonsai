import EventEmitter from "events";
import { isNonNull } from "remeda";
import {
  BuildStoreConfig,
  TStoredPackage
} from "../_UNUSED_/BuildStoreConfig.js";
import {
  bundleFramework,
  bundlePackages,
  buildPackage
  // transformPugInTs,
  // bundleTest
} from "./bundle.js";
import browserSync from "browser-sync";

export class BuildEventManager extends EventEmitter {
  isFrameworkBuilding: boolean = false;
  isTestTSBuilding: boolean = false;
  isTestPUGBuilding: boolean = false;
  isPackagesBuilding: boolean = false;
  _maxListeners: 256;
}

export function initBuildEventManagerListenings(
  buildStoreConfig: BuildStoreConfig
) {
  const eventManager = buildStoreConfig.events as BuildEventManager;
  eventManager.on(
    "package:updated",
    async (updated: { pkg: string; file: string }) => {
      buildStoreConfig.log(
        `Le fichier ${updated.file} dans le package ${updated.pkg} a été mis à jour, nous devons reconstruire ce package et tous les packages qui en dépendent`
      );

      // Déterminer si le package modifié est un package externe (avec externalName)
      const updatedPackage = [...buildStoreConfig.packages].find(
        (pkg) => pkg.packageName === updated.pkg
      );

      if (updatedPackage) {
        const isExternalPackage = updatedPackage.externalName !== undefined;

        if (isExternalPackage) {
          // Si c'est un package externe, nous pouvons simplement le reconstruire
          buildStoreConfig.log(
            `${updated.pkg} est un package externe, reconstruction isolée`
          );
          const result = await buildPackage({
            package: updatedPackage,
            isTest: false
          });

          if (result) {
            eventManager.emit("package:bundled", updated.pkg);
            // Reconstruire le framework après
            await bundleFramework(buildStoreConfig);
          }
        } else {
          // Si c'est un package interne, nous devons reconstruire tous les packages qui en dépendent
          buildStoreConfig.log(
            `${updated.pkg} est un package interne, reconstruction séquentielle nécessaire`
          );
          const bundled = await bundlePackages(buildStoreConfig, updated.pkg);
          if (bundled) {
            eventManager.emit("packages:bundled");
          }
        }
      }
    }
  );
  eventManager.on("package:bundled", (packageName: string) => {
    buildStoreConfig.log(
      `The package ${packageName} has been succesfully bundled`
    );
  });

  eventManager.on("packages:bundled", async () => {
    buildStoreConfig.log(
      "All the necessary packages have been bundled. Now it is the time to bundle the framework"
    );
    setTimeout(async () => {
      await bundleFramework(buildStoreConfig);
    }, 1500);
  });

  eventManager.on("framework:updated", (updatedFile: string) => {
    if (!eventManager.isFrameworkBuilding) {
      eventManager.isFrameworkBuilding = true;
    }
    buildStoreConfig.log(
      `The file ${updatedFile} has been updated, we have to rebuild the framework`
    );
  });
  eventManager.on("framework:bundled", async () => {
    eventManager.isFrameworkBuilding = false;
    buildStoreConfig.log(
      `The framework ${buildStoreConfig.framework.packageName} has been succesfully bundled`
    );
    // if (isNonNull(buildStoreConfig.test)) {
    //   await bundleTest(buildStoreConfig);
    // }
  });
  // eventManager.on("test:ts:updated", async (updatedFile: string) => {
  //   console.log("updatedFile: ", updatedFile);
  //   console.log(
  //     "eventManager.isTestTSBuilding: ",
  //     eventManager.isTestTSBuilding
  //   );
  //   if (!eventManager.isTestTSBuilding) {
  //     eventManager.isTestTSBuilding = true;
  //     buildStoreConfig.log(
  //       `The file ${updatedFile} has been updated, we have to rebuild the test ${
  //         (buildStoreConfig.test as TStoredPackage).packageName
  //       }`
  //     );
  //     await bundleTest(buildStoreConfig);
  //   }
  // });
  // eventManager.on("test:ts:bundled", async () => {
  //   eventManager.isFrameworkBuilding = false;
  //   eventManager.isTestTSBuilding = false;
  //   buildStoreConfig.log(
  //     `The test ${
  //       (buildStoreConfig.test as TStoredPackage).packageName
  //     } has been succesfully bundled`
  //   );
  //   const testName = (buildStoreConfig.test as TStoredPackage).packageName;
  //   browserSync.get(testName).reload();
  // });

  // eventManager.on("test:pug:updated", async (updatedFile: string) => {
  //   if (!eventManager.isTestPUGBuilding) {
  //     eventManager.isTestPUGBuilding = true;
  //     buildStoreConfig.log(
  //       `The file ${updatedFile} has been updated, we have to rebuild the test ${
  //         (buildStoreConfig.test as TStoredPackage).packageName
  //       }`
  //     );
  //     await transformPugInTs(buildStoreConfig, updatedFile);
  //   }
  // });
  // eventManager.on("test:pug:bundled", (updatedFile: string) => {
  //   eventManager.isTestPUGBuilding = false;
  //   buildStoreConfig.log(`the file ${updatedFile} has been succesfully built.`);
  // });
}
