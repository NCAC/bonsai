/**
 * Vérification informative — ADRs candidats au statut `🔵 Tested` (ADR-0043).
 *
 * Pour chaque ADR `🟢 Accepted` ayant une ligne `Invariants impactés` non vide :
 *   - extrait les ID `I<N>` de cette ligne
 *   - vérifie que chaque ID est cité par convention `[I<N>]` dans au moins un
 *     fichier sous `tests/`
 *   - signale l'ADR comme candidat à la promotion `Tested`
 *
 * Le critère C-Sem (sémantique sans invariants) n'est pas mécaniquement
 * vérifiable — ces ADRs sont juste listés comme "review manuelle requise".
 *
 * Le critère C-Proc (process/structurel) est ignoré ici — par définition pas
 * de promotion à attendre.
 *
 * Sortie : 0 toujours (script informatif, jamais bloquant).
 *
 * Usage : `npx tsx lib/check-adr-tested-status.ts`
 *
 * @see ADR-0043 — Statut `Tested` comme gate de preuve d'architecture
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const ADR_DIR = join(ROOT, "docs", "adr");
const TESTS_DIR = join(ROOT, "tests");

type AdrInfo = {
  id: string;          // "0042"
  file: string;        // "ADR-0042-...md"
  status: "Proposed" | "Accepted" | "Tested" | "Suspended" | "Superseded" | "Unknown";
  invariants: number[];
  hasInvariantsLine: boolean;
};

// ─── Parsing ADR ─────────────────────────────────────────────────────────────

/**
 * Étend une description textuelle d'invariants en liste d'IDs.
 * Reconnaît :
 *   - tokens isolés : `I82`
 *   - ranges français : `I68 à I72` → [I68, I69, I70, I71, I72]
 *   - ranges avec tirets : `I68-I72` ou `I68–I72` → idem
 */
function expandInvariantList(raw: string): number[] {
  const ids = new Set<number>();
  // Matche d'abord les ranges : `I<N>` séparé par "à", "-", "–" puis `I<M>`
  const rangeRe = /I(\d+)\s*(?:à|-|–|—)\s*I(\d+)/g;
  const rangeMatches: [number, number][] = [];
  for (const m of raw.matchAll(rangeRe)) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (b >= a && b - a < 100) {
      for (let i = a; i <= b; i++) ids.add(i);
      rangeMatches.push([a, b]);
    }
  }
  // Puis les tokens isolés (sans interférer avec les ranges déjà capturés)
  const consumed = raw.replace(rangeRe, " ");
  for (const m of consumed.matchAll(/I(\d+)/g)) {
    ids.add(parseInt(m[1], 10));
  }
  return [...ids].sort((x, y) => x - y);
}

function readAllAdrs(): AdrInfo[] {
  const files = readdirSync(ADR_DIR).filter(
    (f) => /^ADR-\d{4}-.+\.md$/.test(f)
  );

  return files.map((file) => {
    const content = readFileSync(join(ADR_DIR, file), "utf-8");
    const id = file.match(/^ADR-(\d{4})/)![1];

    const statusLine = content.match(/\*\*Statut\*\*\s*\|\s*([^\n|]+)\|?/);
    const rawStatus = statusLine ? statusLine[1].trim() : "";
    const status: AdrInfo["status"] =
      rawStatus.includes("Tested")     ? "Tested"
    : rawStatus.includes("Accepted")   ? "Accepted"
    : rawStatus.includes("Proposed")   ? "Proposed"
    : rawStatus.includes("Suspended")  ? "Suspended"
    : rawStatus.includes("Superseded") ? "Superseded"
    : "Unknown";

    const invLine = content.match(/\*\*Invariants impactés\*\*\s*\|\s*([^\n]+)/);
    const rawInv = invLine ? invLine[1].replace(/\|\s*$/, "").trim() : "";
    const hasInvariantsLine = rawInv !== "" && rawInv !== "—";
    const invariants = hasInvariantsLine ? expandInvariantList(rawInv) : [];

    return { id, file, status, invariants, hasInvariantsLine };
  });
}

// ─── Scan des tests ──────────────────────────────────────────────────────────

function readAllTestContent(): string {
  const acc: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const s = statSync(path);
      if (s.isDirectory()) walk(path);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry)) acc.push(readFileSync(path, "utf-8"));
    }
  }
  try {
    walk(TESTS_DIR);
  } catch {
    return "";
  }
  return acc.join("\n");
}

// ─── Vérification ────────────────────────────────────────────────────────────

function findCitedInvariants(testContent: string): Set<number> {
  const cited = new Set<number>();
  // Convention ADR-0043 — bare `I<N>` avec frontière de mot, ou `[I<N>]`
  for (const m of testContent.matchAll(/\bI(\d+)\b/g)) {
    cited.add(parseInt(m[1], 10));
  }
  return cited;
}

// ─── Rapport ─────────────────────────────────────────────────────────────────

function main(): void {
  const adrs = readAllAdrs();
  const tests = readAllTestContent();
  const cited = findCitedInvariants(tests);

  const candidates: AdrInfo[] = [];
  const partial:    { adr: AdrInfo; missing: number[] }[] = [];
  const semCandidates: AdrInfo[] = [];
  const tested: AdrInfo[] = adrs.filter((a) => a.status === "Tested");

  for (const adr of adrs) {
    if (adr.status !== "Accepted") continue;

    if (adr.hasInvariantsLine && adr.invariants.length > 0) {
      const missing = adr.invariants.filter((i) => !cited.has(i));
      if (missing.length === 0) candidates.push(adr);
      else if (missing.length < adr.invariants.length) partial.push({ adr, missing });
      // else: aucun invariant cité — silencieux (ADR sans couverture, normal en cours d'implémentation)
    } else {
      // C-Sem ou C-Proc — review manuelle
      semCandidates.push(adr);
    }
  }

  const lines: string[] = [];
  lines.push("📋 ADR Tested status check (ADR-0043)");
  lines.push("");

  if (candidates.length > 0) {
    lines.push(`🔵 ${candidates.length} ADR(s) candidat(s) à la promotion Accepted → Tested :`);
    for (const adr of candidates) {
      lines.push(
        `   ADR-${adr.id} — invariants prouvés : [I${adr.invariants.join(", I")}]`
      );
    }
    lines.push("");
  }

  if (partial.length > 0) {
    lines.push(`⚠️  ${partial.length} ADR(s) avec couverture partielle :`);
    for (const { adr, missing } of partial) {
      lines.push(
        `   ADR-${adr.id} — manquants : [I${missing.join(", I")}]`
      );
    }
    lines.push("");
  }

  if (tested.length > 0) {
    lines.push(`🔵 ${tested.length} ADR(s) déjà Tested.`);
  }

  if (candidates.length === 0 && partial.length === 0) {
    lines.push("✅ Aucun ADR Accepted avec invariants impactés en attente de promotion.");
  }

  console.log(lines.join("\n"));

  // Toujours exit 0 — script purement informatif (cf. ADR-0043 §Conséquences).
  process.exit(0);
}

main();
