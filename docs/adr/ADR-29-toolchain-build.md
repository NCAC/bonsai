# ADR-29 — Toolchain de build : Rollup JS + `rollup-plugin-dts`, zéro dépendance transitive

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — pipeline réécrite (commit `08c0da5`) ; le bundle JS importe encore `@bonsai/types` ; `Immer` et `RXJS` sont exportés ; `bonsai.d.ts` pèse 1,1 Mo ; le script PoC ne passe plus ; CLI `bonsai build` ⏳ |
| **Spec** | [lib/BUILD.md](../../lib/BUILD.md) · [BUILD-CODING-STYLE.md](../guides/BUILD-CODING-STYLE.md) |

## Contexte

Le bundle de déclarations reposait sur ~5 900 lignes de code maison (un fork de
`rollup-plugin-dts` et un bundler ts-morph), non testées, avec des branches
codées en dur par package : chaque nouveau package de l'ADR-28 cassait la
logique. Il faut produire `bonsai.js` + un `bonsai.d.ts` plat avec un outillage
standard, et décider du sort des trois bibliothèques tierces.

## Décision

**Deux passes Rollup par build framework** : JS (format ES) puis DTS via
`rollup-plugin-dts` (paquet npm non modifié), sur les `.d.ts` émis par `tsc`.
Le cache (`PackageCache`, `LibraryCache`) et l'orchestrateur à tri topologique
sont conservés ; le code DTS maison est supprimé.

**Zéro dépendance transitive** (`external: []`) : l'application installe
`@bonsai/core` et rien d'autre. Les tierces sont classées :

| Bibliothèque | Rôle | JS | Exportée ? |
| --- | --- | --- | --- |
| `valibot` | intégrée : schemas d'Entity (ADR-11) | inlinée | ✅ `Valibot` |
| `immer` | transparente : on expose un type de draft, pas la lib (aucun `TDraft` n'existe encore) | inlinée | ❌ |
| `rxjs` | opaque : mécanique interne des Channels | inlinée | ❌ |

Deux builds distincts : **Build 1**, le framework (ci-dessus) ; **Build 2**,
une CLI `bonsai build --mode=esm|iife` pour les applications (ADR-27), à venir.

## Alternatives rejetées

- **Garder le code maison** — dette non testée, cassée à chaque package ajouté.
- **`@microsoft/api-extractor`** — surdimensionné en v1 (rapports d'API, suivi des ruptures) ; à reconsidérer avec des consommateurs externes.
- **`tsc` seul, sans bundle DTS** — expose `@bonsai/entity`, `@bonsai/feature`… dans les types publics : l'architecture interne fuit.
- **Réécriture totale de `lib/build/`** — jette un cache et un orchestrateur qui fonctionnent.

## Conséquences

- ~20 lignes de configuration remplacent le code maison ; `rollup-plugin-dts` est LGPL-3.0, utilisé sans modification (compatible MIT).
- **Écarts livrés** : `core/dist/bonsai.js` commence par `export * from '@bonsai/types'` (import irrésoluble chez un consommateur) ; `Immer` et `RXJS` figurent dans les exports publics, contrairement au tableau ; le `.d.ts` dépasse l'heuristique de 500 Ko ; `lib/build/__poc__/run-poc.ts` échoue désormais (il lit `packages/entity/src/*.ts` comme un `.d.ts`).
