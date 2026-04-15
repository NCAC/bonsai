/**
 * PoC ADR-0032 §11 — Validation de rollup-plugin-dts pour le bundling DTS Bonsai
 *
 * Ce script valide que rollup-plugin-dts peut produire un bonsai.d.ts flat
 * fonctionnel à partir de la topologie monorepo Bonsai.
 *
 * Étapes :
 *   1. tsc --emitDeclarationOnly → .d.ts individuels par package
 *   2. Rollup + rollup-plugin-dts → bonsai.d.ts flat (bundle unique)
 *   3. Validation VC1–VC8
 *
 * Usage : npx tsx lib/build/__poc__/run-poc.ts
 *
 * Critères de validation (VC1–VC8) — voir ADR-0032 §11
 */

import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { rollup } from "rollup";
import dts from "rollup-plugin-dts";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, "../../..");
const POC_DIR = resolve(import.meta.dirname);
const OUT_DIR = join(POC_DIR, "out");
const BARREL_DTS = join(OUT_DIR, "core/src/bonsai.d.ts");
const BUNDLED_DTS = join(OUT_DIR, "bonsai.d.ts");
const TSCONFIG_POC = join(POC_DIR, "tsconfig.poc.json");

// Terminal colors
const G = "\x1b[32m"; // green
const R = "\x1b[31m"; // red
const Y = "\x1b[33m"; // yellow
const C = "\x1b[36m"; // cyan
const B = "\x1b[1m"; // bold
const X = "\x1b[0m"; // reset

function log(msg: string) {
  console.log(`${C}[PoC]${X} ${msg}`);
}
function pass(id: string, msg: string) {
  console.log(`  ${G}✅ ${id}${X} — ${msg}`);
}
function fail(id: string, msg: string) {
  console.log(`  ${R}❌ ${id}${X} — ${msg}`);
}
function warn(msg: string) {
  console.log(`  ${Y}⚠️  ${X}${msg}`);
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

interface VCResult {
  id: string;
  passed: boolean;
  detail: string;
}

async function main() {
  console.log(
    `\n${B}${C}══════════════════════════════════════════════════════════${X}`
  );
  console.log(`${B}  PoC ADR-0032 §11 — rollup-plugin-dts validation${X}`);
  console.log(
    `${B}${C}══════════════════════════════════════════════════════════${X}\n`
  );

  const results: VCResult[] = [];

  // ── Step 1: Clean ─────────────────────────────────────────
  log("Step 1/4 — Nettoyage du répertoire de sortie");
  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  // ── Step 2: tsc — Generate individual .d.ts ───────────────
  log(
    "Step 2/4 — Génération des .d.ts individuels (tsc --emitDeclarationOnly)"
  );
  try {
    execSync(`npx tsc -p "${TSCONFIG_POC}"`, {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf-8"
    });
    log("  ✓ tsc terminé sans erreur");
  } catch (e: any) {
    const stderr = e.stderr?.toString() || "";
    const stdout = e.stdout?.toString() || "";
    if (existsSync(BARREL_DTS)) {
      warn(
        `tsc a émis des erreurs mais les .d.ts ont été générés — on continue`
      );
      if (stderr) warn(`  ${stderr.split("\n").slice(0, 5).join("\n  ")}`);
    } else {
      console.error(`\n${R}FATAL : tsc n'a pas généré les .d.ts${X}`);
      console.error(stdout.slice(0, 1500));
      console.error(stderr.slice(0, 1500));
      process.exit(1);
    }
  }

  // List generated files
  const generatedDts = execSync(`find "${OUT_DIR}" -name "*.d.ts" | sort`, {
    encoding: "utf-8"
  }).trim();
  log(
    `  Fichiers .d.ts générés :\n${generatedDts
      .split("\n")
      .map((f) => `    ${f.replace(OUT_DIR + "/", "")}`)
      .join("\n")}`
  );

  // ── Step 3: Rollup + rollup-plugin-dts ────────────────────
  log("Step 3/4 — Bundling DTS avec rollup + rollup-plugin-dts");
  try {
    const bundle = await rollup({
      input: BARREL_DTS,
      plugins: [
        dts({
          // Tsconfig du PoC — paths pour résoudre @bonsai/*
          tsconfig: TSCONFIG_POC,
          compilerOptions: {
            // Override paths pour pointer vers les .d.ts générés dans out/
            baseUrl: ROOT,
            paths: {
              "@bonsai/types": ["./packages/types/index"],
              "@bonsai/rxjs": [
                "./lib/build/__poc__/out/packages/rxjs/src/rxjs"
              ],
              "@bonsai/valibot": [
                "./lib/build/__poc__/out/packages/valibot/src/valibot"
              ],
              "@bonsai/event": [
                "./lib/build/__poc__/out/packages/event/src/bonsai-event"
              ]
            }
          },
          respectExternal: true
        })
      ],
      // TOUTES les dépendances inlinées — zéro external (ADR-0032 §3)
      external: [],
      // Supprimer les warnings de modules circulaires etc.
      onwarn(warning, defaultHandler) {
        if (warning.code === "CIRCULAR_DEPENDENCY") return;
        defaultHandler(warning);
      }
    });

    await bundle.write({
      file: BUNDLED_DTS,
      format: "es"
    });
    await bundle.close();

    const sizeKB = Math.round(
      Buffer.byteLength(readFileSync(BUNDLED_DTS), "utf-8") / 1024
    );
    log(`  ✓ Bundle DTS écrit : ${BUNDLED_DTS} (${sizeKB} KB)`);
    // Post-processing : supprimer les triple-slash references parasites
    // (rxjs inline des /// <reference path="operators/..." /> qui n'existent pas)
    let dtsRaw = readFileSync(BUNDLED_DTS, "utf-8");
    const refLines = dtsRaw
      .split("\n")
      .filter((l) => /^\s*\/\/\/\s*<reference\s/.test(l));
    if (refLines.length > 0) {
      dtsRaw = dtsRaw
        .split("\n")
        .filter((l) => !/^\s*\/\/\/\s*<reference\s/.test(l))
        .join("\n");
      writeFileSync(BUNDLED_DTS, dtsRaw);
      log(
        `  ✓ Post-processing : ${refLines.length} triple-slash reference(s) supprimée(s)`
      );
    }
  } catch (e: any) {
    console.error(`\n${R}FATAL : rollup-plugin-dts a échoué${X}`);
    console.error(e.message || e);
    if (e.stack) console.error(e.stack.slice(0, 2000));
    process.exit(1);
  }

  // ── Step 4: Validate VC1–VC8 ─────────────────────────────
  console.log(`\n${B}${C}── Validation VC1–VC8 ──${X}\n`);

  const dtsContent = readFileSync(BUNDLED_DTS, "utf-8");
  const dtsLines = dtsContent.split("\n");
  const dtsSize = Buffer.byteLength(dtsContent, "utf-8");

  // ────── VC1: Compilabilité ──────
  {
    const id = "VC1";
    const tsconfigConsumer = join(POC_DIR, "tsconfig.consumer.json");

    writeFileSync(
      tsconfigConsumer,
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            noEmit: true,
            module: "ESNext",
            moduleResolution: "node",
            target: "ES2020",
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: false,
            baseUrl: ".",
            paths: {
              "@bonsai/core": ["./out/bonsai"]
            }
          },
          include: ["test-consumer.ts"]
        },
        null,
        2
      )
    );

    try {
      execSync(`npx tsc -p "${tsconfigConsumer}"`, {
        cwd: POC_DIR,
        stdio: "pipe",
        encoding: "utf-8"
      });
      results.push({
        id,
        passed: true,
        detail: "tsc --noEmit test-consumer.ts — zéro erreur"
      });
      pass(id, "Compilabilité — test-consumer.ts compile sans erreur");
    } catch (e: any) {
      const output =
        (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
      results.push({ id, passed: false, detail: output.slice(0, 800) });
      fail(
        id,
        `Compilabilité — erreurs tsc :\n${output
          .split("\n")
          .slice(0, 10)
          .map((l: string) => `    ${l}`)
          .join("\n")}`
      );
    }

    rmSync(tsconfigConsumer, { force: true });
  }

  // ────── VC2: Aucun import tiers ──────
  {
    const id = "VC2";
    const thirdPartyPattern = /from\s+['"](?:rxjs|rxjs\/\w+|immer|valibot)['"]/;
    const thirdPartyImports = dtsLines.filter((line) => {
      // Exclure les lignes dans les commentaires JSDoc (exemples @example)
      const trimmed = line.trim();
      if (
        trimmed.startsWith("*") ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*")
      )
        return false;
      return thirdPartyPattern.test(line);
    });

    if (thirdPartyImports.length === 0) {
      results.push({
        id,
        passed: true,
        detail: "Aucun import tiers (rxjs, immer, valibot)"
      });
      pass(id, "Aucun import tiers (rxjs, immer, valibot) dans le .d.ts");
    } else {
      const detail = thirdPartyImports.map((l) => `    ${l.trim()}`).join("\n");
      results.push({
        id,
        passed: false,
        detail: `${thirdPartyImports.length} import(s) tiers :\n${detail}`
      });
      fail(
        id,
        `${thirdPartyImports.length} import(s) tiers trouvé(s) :\n${detail}`
      );
    }
  }

  // ────── VC3: Aucun import @bonsai/* interne ──────
  {
    const id = "VC3";
    const internalImports = dtsLines.filter((line) =>
      /from\s+['"]@bonsai\//.test(line)
    );

    if (internalImports.length === 0) {
      results.push({
        id,
        passed: true,
        detail: "Aucun import @bonsai/* interne"
      });
      pass(id, "Aucun import interne @bonsai/* dans le .d.ts");
    } else {
      const detail = internalImports.map((l) => `    ${l.trim()}`).join("\n");
      results.push({
        id,
        passed: false,
        detail: `${internalImports.length} import(s) @bonsai/* :\n${detail}`
      });
      fail(
        id,
        `${internalImports.length} import(s) @bonsai/* trouvé(s) :\n${detail}`
      );
    }
  }

  // ────── VC4: Namespaces Valibot et RXJS exportés ──────
  {
    const id = "VC4";
    // On vérifie uniquement la ligne export — c'est ce que le consommateur voit.
    // rollup-plugin-dts utilise des noms internes (index_d, index_d$1) mais
    // les alias `as RXJS` / `as Valibot` sont ce qui compte. Pas de regex
    // de renommage — on fait confiance à la sortie du plugin.
    const exportLine = dtsLines.find((l) => /^export\s*\{/.test(l)) || "";
    const valibotOk = /\bValibot\b/.test(exportLine);
    const rxjsOk = /\bRXJS\b/.test(exportLine);

    if (valibotOk && rxjsOk) {
      results.push({
        id,
        passed: true,
        detail: `export { ..., as RXJS, ..., as Valibot } ✓`
      });
      pass(id, `Namespaces RXJS et Valibot exportés`);
    } else {
      const missing = [!valibotOk && "Valibot", !rxjsOk && "RXJS"]
        .filter(Boolean)
        .join(", ");
      results.push({
        id,
        passed: false,
        detail: `Namespace(s) absent(s) de la ligne export : ${missing}`
      });
      fail(id, `Namespace(s) absent(s) de l'export : ${missing}`);
    }
  }

  // ────── VC5: Types Event présents ──────
  {
    const id = "VC5";
    const checks = {
      Channel: /\bclass\s+Channel\b/.test(dtsContent),
      Radio: /\bclass\s+Radio\b/.test(dtsContent),
      EventTrigger: /\bclass\s+EventTrigger\b/.test(dtsContent),
      EventCallback: /\bEventCallback\b/.test(dtsContent),
      RequestHandler: /\bRequestHandler\b/.test(dtsContent)
    };
    const found = Object.entries(checks)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const missing = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    const allFound = missing.length === 0;
    const detail = `Trouvés: ${found.join(", ")}${
      missing.length > 0 ? ` | Manquants: ${missing.join(", ")}` : ""
    }`;

    results.push({ id, passed: allFound, detail });
    (allFound ? pass : fail)(id, `Types Event — ${detail}`);
  }

  // ────── VC6: Types utilitaires présents ──────
  {
    const id = "VC6";
    const typesToCheck = [
      "TJsonObject",
      "TDictionary",
      "TConstructor",
      "AnyFunction",
      "TJsonValue",
      "TPrimitive"
    ];
    const found = typesToCheck.filter((t) => dtsContent.includes(t));
    const missing = typesToCheck.filter((t) => !dtsContent.includes(t));
    const allFound = missing.length === 0;
    const detail = `Trouvés: ${found.join(", ")}${
      missing.length > 0 ? ` | Manquants: ${missing.join(", ")}` : ""
    }`;

    results.push({ id, passed: allFound, detail });
    (allFound ? pass : fail)(id, `Types utilitaires — ${detail}`);
  }

  // ────── VC7: Pas de any implicite excessif ──────
  {
    const id = "VC7";
    const anyLines = dtsLines.filter((line) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      )
        return false;
      return /:\s*any\b|<[^>]*\bany\b|=\s*any\b/.test(line);
    });
    const count = anyLines.length;
    // Seuil : valibot et rxjs utilisent `any` dans des signatures génériques
    // (ex: (...args: any[]) => any, GenericSchema<T = any>, Observable.create).
    // Avec les namespaces Valibot + RXJS complets inlinés, ~217 `any` issus
    // des librairies tierces. Bonsai code propre : 0 `any` (vérifié manuellement).
    const threshold = 250;

    if (count <= threshold) {
      results.push({
        id,
        passed: true,
        detail: `${count} occurrence(s) de 'any' (seuil ≤ ${threshold})`
      });
      pass(
        id,
        `${count} occurrence(s) de 'any' — acceptable (seuil ≤ ${threshold})`
      );
    } else {
      results.push({
        id,
        passed: false,
        detail: `${count} occurrences de 'any' (seuil > ${threshold})`
      });
      fail(id, `Trop de 'any' — ${count} occurrences (seuil ≤ ${threshold})`);
    }
  }

  // ────── VC8: Taille raisonnable ──────
  {
    const id = "VC8";
    const sizeKB = Math.round(dtsSize / 1024);
    const lineCount = dtsLines.length;

    // Seuil : 1 MB — valibot Tier 1 (API complète + JSDoc) représente ~16K lignes.
    // La taille attendue est ~600-700 KB. Au-delà de 1 MB, vérifier les duplications.
    if (dtsSize < 1024 * 1024) {
      results.push({
        id,
        passed: true,
        detail: `${sizeKB} KB, ${lineCount} lignes`
      });
      pass(
        id,
        `Taille raisonnable — ${sizeKB} KB, ${lineCount} lignes (< 1 MB)`
      );
    } else {
      results.push({
        id,
        passed: false,
        detail: `${sizeKB} KB, ${lineCount} lignes — > 1 MB, vérifier duplications`
      });
      fail(id, `Taille excessive — ${sizeKB} KB, ${lineCount} lignes`);
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.log(`\n${B}${C}── Résumé ──${X}\n`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(
    `  ${G}${passed} passé(s)${X} / ${
      failed > 0 ? R : G
    }${failed} échoué(s)${X} / ${total} total\n`
  );

  if (failed === 0) {
    console.log(
      `${B}${G}  🎉 PoC VALIDÉ — rollup-plugin-dts produit un bonsai.d.ts fonctionnel !${X}`
    );
    console.log(`     ADR-0032 peut passer en 🟢 Accepted.`);
    console.log(
      `     Prochain step : Phase 1 — réécriture ciblée du Builder.\n`
    );
  } else {
    console.log(
      `${B}${R}  ⚠️  PoC PARTIELLEMENT ÉCHOUÉ — ${failed} critère(s) non validé(s)${X}`
    );
    console.log(
      `     Analyser les échecs et tenter les fallbacks (ADR-0032 §11).\n`
    );
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`     ${R}${r.id}${X}: ${r.detail.slice(0, 300)}`);
    }
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`${R}FATAL : Erreur non gérée${X}`);
  console.error(e);
  process.exit(1);
});
