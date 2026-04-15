/**
 * Configuration utilitaire pour la passe DTS via rollup-plugin-dts.
 *
 * Extrait du PoC ADR-0032 §11 — encapsule la configuration Rollup
 * nécessaire pour produire un .d.ts flat à partir des déclarations
 * individuelles générées par tsc.
 *
 * @module dts-config
 */

import { RollupOptions, OutputOptions } from "rollup";
import dts from "rollup-plugin-dts";
import { readFileSync, writeFileSync } from "node:fs";
import { Logger } from "@build/monitoring/logger.class";

/**
 * Résultat du post-processing d'un .d.ts
 */
export type TPostProcessResult = {
  /** Nombre de directives triple-slash supprimées */
  removedRefs: number;
  /**
   * Alias rollup renommés vers leur namespace public.
   * Ex : { "index_d$1": "RXJS", "index_d": "Valibot" }
   */
  renamedNamespaces: Record<string, string>;
};

/**
 * Options pour la génération d'un bundle .d.ts
 */
export type TDtsRollupOptions = {
  /** Fichier .d.ts d'entrée (barrel généré par tsc) */
  inputDts: string;
  /** Fichier .d.ts de sortie (bundle flat) */
  outputDts: string;
  /** Chemin vers le tsconfig à utiliser pour la résolution des paths */
  tsconfig: string;
  /** Override des compiler options (paths, baseUrl, etc.) */
  compilerOptions?: Record<string, unknown>;
  /** Modules à considérer comme externes (par défaut : [] = tout inliner) */
  external?: string[];
};

/**
 * Crée la configuration Rollup pour la passe DTS.
 *
 * Utilise rollup-plugin-dts (npm ^6.2.1) pour résoudre et inliner
 * toutes les déclarations TypeScript en un seul fichier .d.ts.
 *
 * @param options Configuration de la passe DTS
 * @returns Un tuple [inputOptions, outputOptions] prêt pour rollup()
 */
export function createDtsRollupConfig(options: TDtsRollupOptions): {
  input: RollupOptions;
  output: OutputOptions;
} {
  const {
    inputDts,
    outputDts,
    tsconfig,
    compilerOptions = {},
    external = []
  } = options;

  const inputOptions: RollupOptions = {
    input: inputDts,
    plugins: [
      dts({
        tsconfig,
        compilerOptions: compilerOptions as any,
        respectExternal: true
      })
    ],
    external,
    onwarn(warning, defaultHandler) {
      // Supprimer les warnings de dépendances circulaires
      // (fréquent avec rxjs/valibot — inoffensif pour les .d.ts)
      if (warning.code === "CIRCULAR_DEPENDENCY") return;
      defaultHandler(warning);
    }
  };

  const outputOptions: OutputOptions = {
    file: outputDts,
    format: "es"
  };

  return { input: inputOptions, output: outputOptions };
}

/**
 * Post-processing du fichier .d.ts généré.
 *
 * **Passe 1 — suppression des triple-slash references** :
 * Supprime les directives `/// <reference path="..." />` parasites
 * injectées par certaines librairies (notamment rxjs) qui pointent
 * vers des fichiers inexistants dans le bundle et cassent la compilation.
 *
 * **Passe 2 — renommage des alias rollup internes** (optionnelle) :
 * `rollup-plugin-dts` génère des alias internes comme `index_d$1` ou
 * `index_d` pour les `export * as Namespace from "pkg"`. Ces noms
 * apparaissent dans les tooltips IDE, dégradant la DX :
 *   `(alias) new index_d$1.Subject<string>()`  → mauvais
 *   `(alias) new RXJS.Subject<string>()`        → correct
 *
 * Si `knownNamespaces` est fourni, la passe parse la ligne d'export
 * final du bundle pour trouver les paires `internalAlias as PublicName`
 * et remplace tous les occurrences de `internalAlias` par `PublicName`.
 *
 * ⚠️ Les noms sont triés par longueur décroissante avant remplacement
 * pour éviter les collisions de préfixes (ex: `index_d$1` avant `index_d`).
 *
 * @param dtsPath        Chemin absolu vers le fichier .d.ts à nettoyer
 * @param knownNamespaces Noms publics des namespaces déclarés dans les
 *                        package.json des wrappers (champ `namespace`).
 *                        Ex : ["RXJS", "Valibot"]
 * @returns Résultat du post-processing
 */
export function postProcessDts(
  dtsPath: string,
  knownNamespaces: string[] = []
): TPostProcessResult {
  const logger = Logger.me();
  const REF_PATTERN = /^\s*\/\/\/\s*<reference\s/;

  let content = readFileSync(dtsPath, "utf-8");
  const lines = content.split("\n");

  // ── Passe 1 : suppression des triple-slash references ───────────────
  const refLines = lines.filter((l) => REF_PATTERN.test(l));
  if (refLines.length > 0) {
    content = lines.filter((l) => !REF_PATTERN.test(l)).join("\n");
    logger.debug(
      `Post-processing : ${refLines.length} triple-slash reference(s) supprimée(s) dans ${dtsPath}`
    );
  }

  // ── Passe 2 : renommage des alias rollup internes ────────────────────
  const renamedNamespaces: Record<string, string> = {};

  if (knownNamespaces.length > 0) {
    // Extraire les paires "internalAlias as PublicName" depuis toutes les
    // clauses export { ... } du fichier (rollup peut en générer plusieurs)
    const exportBlockPattern = /export\s*\{([^}]+)\}/g;
    let blockMatch: RegExpExecArray | null;

    // internalName → publicName, filtré sur knownNamespaces
    const aliasMap = new Map<string, string>();

    while ((blockMatch = exportBlockPattern.exec(content)) !== null) {
      const body = blockMatch[1];
      const pairPattern = /([\w$]+)\s+as\s+(\w+)/g;
      let pairMatch: RegExpExecArray | null;
      while ((pairMatch = pairPattern.exec(body)) !== null) {
        const [, internalName, publicName] = pairMatch;
        if (
          knownNamespaces.includes(publicName) &&
          internalName !== publicName
        ) {
          aliasMap.set(internalName, publicName);
        }
      }
    }

    if (aliasMap.size > 0) {
      // Trier par longueur décroissante pour éviter les collisions de préfixes
      // ex : "index_d$1" (9 chars) avant "index_d" (7 chars)
      const sortedEntries = [...aliasMap.entries()].sort(
        ([a], [b]) => b.length - a.length
      );

      for (const [internalName, publicName] of sortedEntries) {
        content = content.replaceAll(internalName, publicName);
        renamedNamespaces[internalName] = publicName;
        logger.debug(
          `Post-processing : namespace '${internalName}' → '${publicName}'`
        );
      }

      // ── Passe 3 : nettoyage des auto-alias `X as X` ─────
      // Le replaceAll global transforme `index_d$1 as RXJS` en `RXJS as RXJS`.
      // On simplifie en `RXJS` dans toutes les clauses export { }.
      content = content.replace(/\b(\w+)\s+as\s+\1\b/g, "$1");

      writeFileSync(dtsPath, content);
      logger.info(
        `Post-processing : ${aliasMap.size} namespace(s) renommé(s) → ${[...aliasMap.values()].join(", ")}`
      );
    }
  }

  // Écrire uniquement si la passe 1 a modifié le contenu (passe 2 écrit elle-même)
  if (refLines.length > 0 && Object.keys(renamedNamespaces).length === 0) {
    writeFileSync(dtsPath, content);
  }

  return { removedRefs: refLines.length, renamedNamespaces };
}
