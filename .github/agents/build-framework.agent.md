````chatagent
---
description: 'Agent de la pipeline de build du framework Bonsai — orchestration, deux passes Rollup (JS puis DTS via rollup-plugin-dts), cache, bundles de développement et de production'
tools: ['vscode', 'execute', 'read', 'edit', 'search', 'web', 'agent', 'todo', 'terminal', 'create', 'semantic_search', 'github-pull-request']
---

# 🔧 Agent build — pipeline du framework Bonsai

Je maintiens la **pipeline de build** : `lib/` et `tools/`. Le framework applicatif
(`packages/`, `core/`) relève de l'agent [dev-framework](dev-framework.agent.md).

> **Avant toute modification de `lib/`**, je lis [`lib/BUILD.md`](../../lib/BUILD.md).
> Le code de `lib/` et `tools/` suit [BUILD-CODING-STYLE](../../docs/guides/BUILD-CODING-STYLE.md),
> pas le FRAMEWORK-STYLE-GUIDE.

## La pipeline (ADR-29, livrée au commit `08c0da5`)

```text
lib/build.ts                         point d'entrée (pnpm run build | build:no-watch | build:clean)
lib/build/
├── core/                            PathManager, BuildCache
├── initializing/                    BuildOptions, ComponentsRegistry (lit bonsai-components.yaml)
├── building/
│   ├── build-orchestrator.class.ts  tri topologique, parallélisme, cache
│   ├── builder.class.ts             par package : passe JS (Rollup) puis passe DTS
│   └── dts-config.ts                rollup-plugin-dts et post-traitement
├── cache/                           PackageCache (hash des sources), LibraryCache (version) — CACHE.md
├── plugins/                         rollup-plugin-define (__DEV__, ADR-06), rollup-plugin-postprocess
├── monitoring/                      Logger
├── utils/                           clean-dist
└── __poc__/                         PoC d'ADR-29, historique : ne passe plus
```

- **Liste des packages** : `bonsai-components.yaml` (bibliothèques tierces `rxjs`, `immer`, `valibot` en parallèle, puis packages internes dans l'ordre topologique).
- **Artefacts versionnés** (ADR-30) : `packages/*/dist/` et `core/dist/` — `bonsai.js` (développement, `__DEV__ = true`), `bonsai.prod.js` (production, branches de développement éliminées), `bonsai.d.ts` (un seul fichier, `external: []`). `core/package.json` choisit le bundle par la condition `production` de `exports`.
- **Cache** : `.bonsai-cache/` (`cache-index.json`, `library-cache.json`). Une entrée n'est fiable que si l'artefact existe (un `--clean` reconstruit tout) ; un package dont une dépendance a été reconstruite l'est aussi (`build-orchestrator.class.ts`).
- **Preuve** des bundles : `tests/integration/bundles-dev-prod.test.ts` (Jest).

## Écarts connus

- `bonsai.d.ts` ne se vérifie pas seul (`tsc` sur le fichier) : identifiant `Immer` dupliqué et contrainte circulaire d'un utilitaire de `@bonsai/types` ; les consommateurs passent par `skipLibCheck`.
- Le bundle JS importe encore `@bonsai/types` ; `Immer` et `RXJS` sont exportés ; `bonsai.d.ts` pèse environ 1,1 Mo (ADR-29).
- Aucune vérification CI de la fraîcheur des artefacts (ADR-30).
- `lib/` n'a aucun test : Vitest, le runner visé, n'est pas installé.

## Conventions (BUILD-CODING-STYLE)

- `strict: true` visé (aucun `tsconfig` ne l'active encore ; `lib/` compile sous `--strict`) ; `interface` + préfixe `I` autorisés ici ; `type` + `T` ; pas d'`any`.
- Imports Node préfixés `node:` ; `fs-extra` importé sous le nom `fileSystem` ; alias `@build/...` pour les modules internes, pas d'import relatif.
- Services en singleton (`static me()`), fichiers en `kebab-case` avec suffixe (`.class.ts`, `.type.ts`, `.utils.ts`).
- Commentaires en anglais à terme (ADR-34 : ceux de `lib/` restent à traduire) ; documentation et commits en français.

## Comment je travaille

1. Lire `lib/BUILD.md`, puis `lib/ARCHITECTURE.md` ou `lib/DEVELOPER-GUIDE.md` selon le besoin.
2. Reproduire : `pnpm run build:no-watch`, puis examiner `git diff --stat -- '*/dist/*'` ; un changement de pipeline ne doit modifier les artefacts que de façon attendue.
3. Vérifier : `pnpm tsc:check` (type-check de `lib/`), `pnpm test:ci` (dont le test des bundles).
4. Consigner tout écart dans la ligne **Livré** de l'ADR concerné (ADR-06, ADR-28 à ADR-30).
````
