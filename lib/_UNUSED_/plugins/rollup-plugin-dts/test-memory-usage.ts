/**
 * Script pour tester l'utilisation de la mémoire dans rollup-plugin-dts
 * Ce script exécute le plugin avec une instrumentation détaillée de la mémoire
 * pour identifier les points problématiques.
 */

import { rollup } from "rollup";
import dts from "./index.js";
import path from "path";
import fs from "fs";
import {
  memoryMonitor,
  startMemoryMonitoring,
  stopAndAnalyzeMemory,
  captureHeapSnapshot
} from "./memory-monitor.js";
import { fileURLToPath } from "url";

// Obtenir le chemin actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

// Vérifier que l'option --expose-gc est activée
if (typeof global.gc !== "function") {
  console.error("ERREUR: Veuillez exécuter avec --expose-gc");
  console.error(
    "Exemple: tsx --expose-gc lib/build/plugins/rollup-plugin-dts/test-memory-usage.ts"
  );
  process.exit(1);
}

// Configuration
const TEST_PACKAGE = process.argv[2] || "rxjs"; // Par défaut, tester RxJS qui pose problème
const CAPTURE_SNAPSHOTS = true;
const OUTPUT_DIR = path.join(cwd, "memory-analysis-results");

// Créer le répertoire de sortie
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Trouver le chemin du package à tester
const packagePath = path.join(cwd, "packages", TEST_PACKAGE);
if (!fs.existsSync(packagePath)) {
  console.error(
    `ERREUR: Le package ${TEST_PACKAGE} n'existe pas dans ${packagePath}`
  );
  process.exit(1);
}

// Identifier le fichier d'entrée principal
let entryFile;
if (fs.existsSync(path.join(packagePath, "dist", `${TEST_PACKAGE}.d.ts`))) {
  entryFile = path.join(packagePath, "dist", `${TEST_PACKAGE}.d.ts`);
} else if (fs.existsSync(path.join(packagePath, "dist", "index.d.ts"))) {
  entryFile = path.join(packagePath, "dist", "index.d.ts");
} else {
  console.error(
    `ERREUR: Impossible de trouver le fichier d'entrée pour ${TEST_PACKAGE}`
  );
  process.exit(1);
}

console.log(`\n📦 Test d'utilisation de la mémoire pour ${TEST_PACKAGE}`);
console.log(`🔍 Fichier d'entrée: ${entryFile}`);
console.log(`📊 Les résultats seront enregistrés dans: ${OUTPUT_DIR}\n`);

// Prendre un snapshot de la heap au début
if (CAPTURE_SNAPSHOTS) {
  captureHeapSnapshot(`${TEST_PACKAGE}-before`);
}

async function testMemoryUsage() {
  // Démarrer le monitoring de la mémoire
  startMemoryMonitoring(1000); // 1 échantillon par seconde

  console.log(`\n🚀 Démarrage du traitement de ${TEST_PACKAGE}...`);

  try {
    // Forcer un GC avant de commencer
    global.gc();

    // Phase 1: Rollup avec plugin dts
    console.log(`\n📝 Phase 1: Rollup avec plugin dts`);
    const startTime = Date.now();

    const bundle = await rollup({
      input: entryFile,
      external: () => true,
      plugins: [
        dts({
          respectExternal: true,
          compilerOptions: {
            baseUrl: packagePath,
            paths: {
              "*": ["*"]
            }
          }
        })
      ]
    });

    // Phase 2: Génération du résultat
    console.log(`\n📝 Phase 2: Génération du fichier .d.ts`);
    await bundle.write({
      file: path.join(OUTPUT_DIR, `${TEST_PACKAGE}.d.ts`),
      format: "es"
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Traitement terminé en ${duration.toFixed(2)} secondes`);
  } catch (error) {
    console.error(`\n❌ ERREUR pendant le traitement:`, error);
  } finally {
    // Arrêter le monitoring et analyser les résultats
    stopAndAnalyzeMemory(
      path.join(OUTPUT_DIR, `${TEST_PACKAGE}-memory-analysis.csv`)
    );

    // Prendre un snapshot final
    if (CAPTURE_SNAPSHOTS) {
      captureHeapSnapshot(`${TEST_PACKAGE}-after`);
    }

    console.log(
      `\n📊 Analyse terminée. Vérifiez les fichiers dans ${OUTPUT_DIR}`
    );
  }
}

// Exécuter le test
testMemoryUsage().catch((err) => {
  console.error("Erreur non gérée:", err);
  process.exit(1);
});
