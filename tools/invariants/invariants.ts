/**
 * Registre des invariants — génération et contrôle.
 *
 *   pnpm invariants         régénère docs/invariants/generated/arbre.md
 *   pnpm invariants:check   échoue si le registre est incohérent ou si le fichier généré n'est pas à jour
 *
 * Sources : docs/invariants/principes.yaml et docs/invariants/P*.yaml.
 * Les citations `I<n>` sont détectées dans tous les fichiers *.test.ts / *.test-d.ts du dépôt.
 */
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync
} from "node:fs";
import { join, relative, dirname } from "node:path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const DIR = join(ROOT, "docs/invariants");
const OUT = join(DIR, "generated/arbre.md");
const TEST_ROOTS = ["tests", "packages", "core"];
const IGNORED = new Set(["node_modules", "dist", ".git", "build"]);

const NATURES = ["E", "C", "D", "V"] as const;
const MODES = ["type", "boot", "type+boot", "run", "revue"] as const;
const ETATS = ["livre", "partiel", "cible", "convention"] as const;
const ETAT_ICON: Record<string, string> = {
  livre: "✅",
  partiel: "⚠️",
  cible: "⏳",
  convention: "📐"
};

type Principe = {
  id: string;
  titre: string;
  enonce: string;
  meta?: boolean;
  "question-ouverte"?: string;
};
type Ligne = {
  id: string;
  nature: (typeof NATURES)[number];
  parents: string[];
  alias?: string[];
  enonce: string;
  pourquoi?: string;
  mode: (typeof MODES)[number] | null;
  etat: (typeof ETATS)[number] | null;
  preuves?: string[];
};

const errors: string[] = [];
const warnings: string[] = [];

// ---------- chargement ----------
const principes = yaml.load(
  readFileSync(join(DIR, "principes.yaml"), "utf8")
) as Principe[];
const branches = readdirSync(DIR)
  .filter((f) => /^P\d+\.yaml$/.test(f))
  .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const lignes: Ligne[] = branches.flatMap(
  (f) => (yaml.load(readFileSync(join(DIR, f), "utf8")) as Ligne[]) ?? []
);

// ---------- validation du schéma ----------
const ids = new Set<string>(principes.map((p) => p.id));
for (const l of lignes) {
  if (!/^I\d+$/.test(l.id)) errors.push(`${l.id} : identifiant invalide`);
  if (ids.has(l.id)) errors.push(`${l.id} : doublon`);
  ids.add(l.id);
}
for (const l of lignes) {
  for (const a of l.alias ?? []) {
    if (!/^I\d+$/.test(a)) errors.push(`${l.id} : alias invalide "${a}"`);
    if (ids.has(a))
      errors.push(`${l.id} : alias ${a} entre en collision avec un identifiant existant`);
    ids.add(a);
  }
}
for (const l of lignes) {
  const at = `${l.id} :`;
  if (!NATURES.includes(l.nature))
    errors.push(`${at} nature invalide "${l.nature}"`);
  if (!l.parents?.length) errors.push(`${at} aucun parent`);
  for (const p of l.parents ?? [])
    if (!ids.has(p)) errors.push(`${at} parent inconnu ${p}`);
  if (!l.enonce) errors.push(`${at} énoncé manquant`);
  if (l.nature === "D" && !l.pourquoi)
    errors.push(`${at} décision sans "pourquoi"`);
  if (l.pourquoi?.startsWith("À compléter"))
    warnings.push(`${at} "pourquoi" à compléter`);
  if (l.mode !== null && !MODES.includes(l.mode))
    errors.push(`${at} mode invalide "${l.mode}"`);
  if (l.etat !== null && !ETATS.includes(l.etat))
    errors.push(`${at} état invalide "${l.etat}"`);
  if (l.mode === null || l.etat === null)
    warnings.push(`${at} mode/état non qualifiés`);
}

// ---------- citations dans les tests ----------
function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    if (IGNORED.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.test(-d)?\.tsx?$/.test(e)) acc.push(p);
  }
  return acc;
}
/** Test de type : fichier *.test-d.ts ou situé sous un dossier contenant "type". */
const isTypeTest = (f: string) =>
  /\.test-d\.tsx?$/.test(f) ||
  /(^|\/)[^/]*types?[^/]*\//.test(relative(ROOT, f));

const citations = new Map<string, { T: Set<string>; R: Set<string> }>();
for (const f of TEST_ROOTS.flatMap((r) => walk(join(ROOT, r)))) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bI(\d+)\b/g)) {
    const id = `I${m[1]}`;
    const c = citations.get(id) ?? { T: new Set(), R: new Set() };
    c[isTypeTest(f) ? "T" : "R"].add(relative(ROOT, f));
    citations.set(id, c);
  }
}
// une citation d'un alias (ancien ID fusionné) compte pour la ligne canonique
for (const l of lignes) {
  for (const a of l.alias ?? []) {
    const ac = citations.get(a);
    if (!ac) continue;
    warnings.push(
      `${a} : alias de ${l.id} encore cité (${[...ac.T, ...ac.R].join(", ")}) — citer ${l.id}`
    );
    const c = citations.get(l.id) ?? { T: new Set(), R: new Set() };
    ac.T.forEach((f) => c.T.add(f));
    ac.R.forEach((f) => c.R.add(f));
    citations.set(l.id, c);
  }
}
// une preuve explicite (test qui prouve sans citer l'ID) compte comme une citation
for (const l of lignes) {
  for (const p of l.preuves ?? []) {
    if (!existsSync(join(ROOT, p))) {
      errors.push(`${l.id} : preuve introuvable ${p}`);
      continue;
    }
    const c = citations.get(l.id) ?? { T: new Set(), R: new Set() };
    c[isTypeTest(p) ? "T" : "R"].add(p);
    citations.set(l.id, c);
  }
}

// ---------- cohérence état / preuves ----------
for (const l of lignes) {
  const c = citations.get(l.id);
  const n = (c?.T.size ?? 0) + (c?.R.size ?? 0);
  if (l.etat === "livre" && l.mode !== "revue" && n === 0)
    errors.push(`${l.id} : déclaré livré sans aucun test qui le cite`);
  if (l.etat === "livre" && l.mode === "type" && !c?.T.size)
    warnings.push(`${l.id} : mode "type" sans test de type`);
  if (
    (l.mode === "boot" || l.mode === "run") &&
    l.etat === "livre" &&
    !c?.R.size
  )
    warnings.push(`${l.id} : mode "${l.mode}" sans test runtime`);
}

// ---------- génération ----------
const children = (id: string) => lignes.filter((l) => l.parents[0] === id);
const tag = (l: Ligne) => {
  const c = citations.get(l.id);
  const t =
    [c?.R.size ? "R" : "", c?.T.size ? "T" : ""].filter(Boolean).join(" ") ||
    "·";
  return `⟨${l.mode ?? "—"} · ${l.etat ? ETAT_ICON[l.etat] : "∅"} · ${t}⟩`;
};
const render = (id: string, depth: number): string[] =>
  children(id).flatMap((l) => [
    `${"  ".repeat(depth)}- \`${l.nature}\` ${[l.id, ...(l.alias ?? [])].join(" = ")} — ${l.enonce}` +
      l.parents
        .slice(1)
        .map((p) => ` ↔ ${p}`)
        .join("") +
      ` ${tag(l)}`,
    ...render(l.id, depth + 1)
  ]);

const secondary = (id: string) =>
  lignes.filter((l) => l.parents.slice(1).includes(id)).map((l) => l.id);

const migrated = new Set(branches.map((f) => f.replace(".yaml", "")));
const md = [
  "<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->",
  "",
  "# Arbre des invariants",
  "",
  "⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention · ∅ non qualifié ;",
  "tests : `R` runtime · `T` type · `·` aucun (détection automatique des citations).",
  "",
  ...principes.flatMap((p) => [
    `## ${p.id} — ${p.titre}${p.meta ? " *(méta-principe)*" : ""}`,
    "",
    `**${p.enonce}**`,
    "",
    ...(p["question-ouverte"] ? [`> ❓ ${p["question-ouverte"]}`, ""] : []),
    ...(migrated.has(p.id)
      ? render(p.id, 0)
      : ["*Branche non encore migrée.*"]),
    ...(secondary(p.id).length
      ? ["", `*Rattachés en second parent :* ${secondary(p.id).join(", ")}`]
      : []),
    ""
  ])
].join("\n");

if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== md)
    errors.push(
      `${relative(ROOT, OUT)} n'est pas à jour : lancer "pnpm invariants"`
    );
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md);
  console.log(
    `✔ ${relative(ROOT, OUT)} (${lignes.length} lignes, ${branches.length} branche(s))`
  );
}

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
process.exit(errors.length ? 1 : 0);
