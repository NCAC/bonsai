/**
 * Registre des invariants — génération et contrôle.
 *
 *   pnpm invariants         régénère docs/invariants/generated/ (arbre.md et roles/*.md)
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
const ROLES_DIR = join(DIR, "generated/roles");
const TEST_ROOTS = ["tests", "packages", "core"];
const IGNORED = new Set(["node_modules", "dist", ".git", "build"]);

const NATURES = ["E", "C", "D", "V"] as const;
const MODES = ["type", "boot", "type+boot", "run", "revue"] as const;
const STATES = ["livre", "partiel", "cible", "convention"] as const;
/** One role per package (ADR-28); "*" marks a cross-cutting rule. */
const ROLES = [
  "Application",
  "Feature",
  "Entity",
  "Channel",
  "View",
  "Behavior",
  "Composer",
  "Foundation"
] as const;
const STATE_ICON: Record<string, string> = {
  livre: "✅",
  partiel: "⚠️",
  cible: "⏳",
  convention: "📐"
};

type TPrinciple = {
  id: string;
  titre: string;
  enonce: string;
  meta?: boolean;
  "question-ouverte"?: string;
};
type TLine = {
  id: string;
  nature: (typeof NATURES)[number];
  parents: string[];
  roles?: string[];
  alias?: string[];
  enonce: string;
  why?: string;
  mode: (typeof MODES)[number] | null;
  state: (typeof STATES)[number] | null;
  proofs?: string[];
};

const errors: string[] = [];
const warnings: string[] = [];

// ---------- chargement ----------
const principles = yaml.load(
  readFileSync(join(DIR, "principes.yaml"), "utf8")
) as TPrinciple[];
const branches = readdirSync(DIR)
  .filter((f) => /^P\d+\.yaml$/.test(f))
  .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const lines: TLine[] = branches.flatMap(
  (f) => (yaml.load(readFileSync(join(DIR, f), "utf8")) as TLine[]) ?? []
);

/** YAML comments attached to each line (indented `#` lines inside its entry). */
const remarks = new Map<string, string[]>();
for (const f of branches) {
  let id: string | null = null;
  for (const raw of readFileSync(join(DIR, f), "utf8").split("\n")) {
    const m = /^- id: (I\d+)$/.exec(raw);
    if (m) id = m[1];
    else if (/^\S/.test(raw)) id = null;
    else if (id && /^\s+# ?/.test(raw))
      remarks.set(id, [...(remarks.get(id) ?? []), raw.replace(/^\s+# ?/, "")]);
  }
}

// ---------- validation du schéma ----------
const ids = new Set<string>(principles.map((p) => p.id));
for (const l of lines) {
  if (!/^I\d+$/.test(l.id)) errors.push(`${l.id} : identifiant invalide`);
  if (ids.has(l.id)) errors.push(`${l.id} : doublon`);
  ids.add(l.id);
}
for (const l of lines) {
  for (const a of l.alias ?? []) {
    if (!/^I\d+$/.test(a)) errors.push(`${l.id} : alias invalide "${a}"`);
    if (ids.has(a))
      errors.push(
        `${l.id} : alias ${a} entre en collision avec un identifiant existant`
      );
    ids.add(a);
  }
}
for (const l of lines) {
  const at = `${l.id} :`;
  if (!NATURES.includes(l.nature))
    errors.push(`${at} nature invalide "${l.nature}"`);
  if (!l.parents?.length) errors.push(`${at} aucun parent`);
  for (const p of l.parents ?? [])
    if (!ids.has(p)) errors.push(`${at} parent inconnu ${p}`);
  if (!l.enonce) errors.push(`${at} énoncé manquant`);
  if (!l.roles?.length) errors.push(`${at} aucun rôle`);
  else if (l.roles.includes("*") && l.roles.length > 1)
    errors.push(`${at} "*" ne se combine pas avec d'autres rôles`);
  for (const r of l.roles ?? [])
    if (r !== "*" && !(ROLES as readonly string[]).includes(r))
      errors.push(`${at} rôle inconnu "${r}"`);
  if (l.nature === "D" && !l.why) errors.push(`${at} décision sans "pourquoi"`);
  if (l.why?.startsWith("À compléter"))
    warnings.push(`${at} "why" à compléter`);
  if (l.mode !== null && !MODES.includes(l.mode))
    errors.push(`${at} mode invalide "${l.mode}"`);
  if (l.state !== null && !STATES.includes(l.state))
    errors.push(`${at} état invalide "${l.state}"`);
  if (l.mode === null || l.state === null)
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
for (const l of lines) {
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
for (const l of lines) {
  for (const p of l.proofs ?? []) {
    if (!existsSync(join(ROOT, p))) {
      errors.push(`${l.id} : preuve introuvable ${p}`);
      continue;
    }
    const c = citations.get(l.id) ?? { T: new Set(), R: new Set() };
    c[isTypeTest(p) ? "T" : "R"].add(p);
    citations.set(l.id, c);
  }
}

// ---------- cohérence state / proofs ----------
for (const l of lines) {
  const c = citations.get(l.id);
  const n = (c?.T.size ?? 0) + (c?.R.size ?? 0);
  if (l.state === "livre" && l.mode !== "revue" && n === 0)
    errors.push(`${l.id} : déclaré livré sans aucun test qui le cite`);
  if (l.state === "livre" && l.mode === "type" && !c?.T.size)
    warnings.push(`${l.id} : mode "type" sans test de type`);
  if (
    (l.mode === "boot" || l.mode === "run") &&
    l.state === "livre" &&
    !c?.R.size
  )
    warnings.push(`${l.id} : mode "${l.mode}" sans test runtime`);
}

// ---------- génération ----------
const children = (id: string) => lines.filter((l) => l.parents[0] === id);
const tag = (l: TLine) => {
  const c = citations.get(l.id);
  const t =
    [c?.R.size ? "R" : "", c?.T.size ? "T" : ""].filter(Boolean).join(" ") ||
    "·";
  return `⟨${l.mode ?? "—"} · ${l.state ? STATE_ICON[l.state] : "∅"} · ${t}⟩`;
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
  lines.filter((l) => l.parents.slice(1).includes(id)).map((l) => l.id);

const migrated = new Set(branches.map((f) => f.replace(".yaml", "")));
const md = [
  "<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->",
  "",
  "# Arbre des invariants",
  "",
  "⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention · ∅ non qualifié ;",
  "tests : `R` runtime · `T` type · `·` aucun (détection automatique des citations).",
  "",
  ...principles.flatMap((p) => [
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

// ---------- vues par rôle ----------
const GENERATED =
  "<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->";
const byId = new Map(lines.map((l) => [l.id, l]));
/** Principle reached by following the principal parent. */
const principeOf = (l: TLine): string => {
  let p = l.parents[0];
  while (byId.has(p)) p = byId.get(p)!.parents[0];
  return p;
};
const num = (id: string) => parseInt(id.slice(1));
const item = (l: TLine) => `- \`${l.nature}\` ${l.id} — ${l.enonce} ${tag(l)}`;
const count = (ls: TLine[]) =>
  Object.fromEntries(
    STATES.map((e) => [e, ls.filter((l) => l.state === e).length])
  ) as Record<(typeof STATES)[number], number>;
const transversal = lines.filter((l) => l.roles?.includes("*"));
const fileOf = (r: string) => `${r.toLowerCase()}.md`;

const views = new Map<string, string>();
for (const r of ROLES) {
  const own = lines.filter((l) => l.roles?.includes(r));
  const c = count(own);
  const ecarts = own
    .filter((l) => l.state === "partiel" || l.state === "cible")
    .sort(
      (a, b) =>
        STATES.indexOf(a.state!) - STATES.indexOf(b.state!) ||
        num(a.id) - num(b.id)
    );
  views.set(
    fileOf(r),
    [
      GENERATED,
      "",
      `# ${r} — invariants`,
      "",
      "[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)",
      "",
      "⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;",
      "tests : `R` runtime · `T` type · `·` aucun.",
      "",
      "| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |",
      "| --- | --- | --- | --- | --- |",
      `| ${own.length} | ${c.livre} | ${c.partiel} | ${c.cible} | ${c.convention} |`,
      "",
      "## Écarts",
      "",
      ...(ecarts.length
        ? ecarts.flatMap((l) => [
            item(l),
            ...(remarks.get(l.id) ?? []).map((m) => `  > ${m}`)
          ])
        : ["*Aucun écart.*"]),
      "",
      "## Invariants par principe",
      "",
      ...principles.flatMap((p) => {
        const ls = own.filter((l) => principeOf(l) === p.id);
        return ls.length
          ? [`### ${p.id} — ${p.titre}`, "", ...ls.map(item), ""]
          : [];
      }),
      "## Règles transversales",
      "",
      ...transversal.map(item),
      ""
    ].join("\n")
  );
}
views.set(
  "README.md",
  [
    GENERATED,
    "",
    "# Invariants par rôle",
    "",
    "Vues générées depuis le registre (`docs/invariants/P*.yaml`, champ `roles`) —",
    "[arbre complet](../arbre.md). Un invariant peut concerner plusieurs rôles.",
    "",
    "| Rôle | Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |",
    "| --- | --- | --- | --- | --- | --- |",
    ...ROLES.map((r) => {
      const own = lines.filter((l) => l.roles?.includes(r));
      const c = count(own);
      return `| [${r}](${fileOf(r)}) | ${own.length} | ${c.livre} | ${c.partiel} | ${c.cible} | ${c.convention} |`;
    }),
    "",
    `Règles transversales (\`*\`, reprises dans chaque vue) : ${transversal.map((l) => l.id).join(", ")}.`,
    ""
  ].join("\n")
);

// ---------- écriture / contrôle ----------
const outputs = new Map<string, string>([[OUT, md]]);
for (const [f, content] of views) outputs.set(join(ROLES_DIR, f), content);

if (process.argv.includes("--check")) {
  for (const [path, content] of outputs)
    if (!existsSync(path) || readFileSync(path, "utf8") !== content)
      errors.push(
        `${relative(ROOT, path)} n'est pas à jour : lancer "pnpm invariants"`
      );
  if (existsSync(ROLES_DIR))
    for (const f of readdirSync(ROLES_DIR))
      if (!views.has(f))
        errors.push(
          `${relative(ROOT, join(ROLES_DIR, f))} n'est plus généré : le supprimer`
        );
} else {
  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(
    `✔ ${relative(ROOT, OUT)} + ${views.size} vue(s) par rôle (${lines.length} lignes, ${branches.length} branche(s))`
  );
}

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
process.exit(errors.length ? 1 : 0);
