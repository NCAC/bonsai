# Changelog

Toutes les modifications notables du framework Bonsai sont documentées dans ce fichier.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
Versioning : [SemVer](https://semver.org/lang/fr/)
Workflow : [ADR-33](docs/adr/ADR-33-workflow-git-ci.md)

---

## [Unreleased]

### Added

- **Strate 1c — rendu PDR** : templates N2/N3 alimentés par une Query déclarée et relancés par les Events de `on` (`get templates()`, `bind<TVC>()`, ADR-26) ; `ProjectionList` et item capturé dans le fait (`ui()(events, { data })`, ADR-23) ; compilateur Pug `tools/pug-compiler` (`pnpm pug`, `pnpm pug:check`) qui produit un `TProjectionTemplate` typé par `//- @data`, et `ProjectionSwitch` pour les `if` (ADR-22)

### Changed

- `bind<TVC>()` : sans `select`, le résultat de la Query doit être le type des données du template
- `ProjectionList` : `create(item, index)` reçoit l'index de l'item

### Removed

- Prototype `tools/pug-to-ts-template` (compilateur Pug → VDOM), remplacé par `tools/pug-compiler`

---

## [0.2.0] — 2026-11-04 — Noyau d'exécution

Depuis le tag `v0.1.0-strate-0` (l'historique complet est dans `git log`). Ce jalon recale la numérotation d'ADR-33 : le jalon de la strate 0 aurait dû porter `0.2.0`.

### Added

- **Théorie V0.9.5** (`docs/theorie.md`, fait autorité) : vocabulaire, axiomes A0–A5, garanties G1–G8, décisions D1–D20, annexes A et B (navigateur) et C (protocole d'exécution) ; index de traçabilité, table des gardes, fiches des adaptateurs de l'hôte, guide pédagogique
- **Noyau d'exécution `@bonsai/kernel`** (`Root`, lots M1 à M5) : unités de validation et retour arrière (G7), file des messages différés et vidage synchrone (ADR-35), Queries synchrones (G5), capture par copie (G2), contextes causaux (G8) et borne causale (D9), Entity sur le journal d'unité et invariants (A4.a), démarrage depuis un Manifest avec dépendances initiales (C.1), parts et désignations, matérialisation et effets engagés après validation (C.3), admission des faits du DOM, monde fermé et droit de commander (C.4, D18), trace des engagements et sortie console (`reportToConsole`, O2)
- **Composants sur le noyau** (lot M6) : Feature, Entity et Application (M6.1) ; Foundation, Composer et View (M6.2), dont la composition de plusieurs Views par clé, les slots d'une View (`composers`) et l'annulation déclarée de l'action par défaut (`ui()(events, { cancelDefault })`, D20)
- **`@bonsai/router`** (M6.3a) : Feature `router` fournie par le framework (D15) et adaptateur d'historique (D7, annexe B) ; gate E2E `tests/e2e/navigation-round-trip.test.ts`
- **Strate 1a — Entity** : `Immer.produceWithPatches`, `TEntityEvent` enrichi (`patches`, `inversePatches`, `previousState`, `nextState`), handlers `on<Key>EntityUpdated` / `onAnyEntityUpdated` auto-découverts par la Feature (I96) ; la notification est un message local différé, délivré dans sa propre unité, et une boucle de notifications est arrêtée par la borne causale (I98, D9)
- **Contrat Feature `Feature<TEntity, TChannelDef, TSelfNS>`** : namespace porté par le manifest applicatif (`StrictManifest<M>`), `static readonly channel`, `get listens()` / `get queries()` d'instance, `TFeatureCallbacks`, constructeur inerte, phases 0a–0c du bootstrap (ADR-08, ADR-09)
- **Pattern modulaire de View** : `TFeatureContract` / `TUIContract` / `TUIElements`, `ui<TEl>()(events)`, `TEventsFor<TEl>`, `TViewCallbacks` (ADR-14, ADR-15)
- **Build** : `__DEV__` défini par la pipeline, bundles `core/dist/bonsai.js` (développement) et `bonsai.prod.js` (production) (ADR-06) ; `@bonsai/router` dans la pipeline (`dist/` versionné)
- **Barrel `@bonsai/core`** : ré-exporte aussi `@bonsai/entity`, `@bonsai/error` et `@bonsai/router` (ADR-28, `tests/integration/core-barrel.test.ts`)
- **Documentation** : 35 ADR vivants (`docs/adr/`), spécification par chapitres (`docs/spec/`), `docs/ROADMAP.md` ; ancien corpus archivé dans `docs/archive/adr-v0/`

### Changed

- **`@bonsai/event` renommé `@bonsai/kernel`** : le package ne contient plus que le noyau d'exécution (`Root`) et les types de contrat des Channels ; ADR-28 mis à jour
- **Contextes de handler** : une Feature mute et émet par son contexte (`ctx.mutate`, `ctx.emit`) ; une View commande depuis le handler d'un fait (`ctx.trigger`) et interroge par `ctx.query` ; un handler d'Event ne commande jamais (D18)
- **Query** : une valeur synchrone, jamais un `null` de substitution ; une Query en échec fait échouer l'unité de l'auteur (G7, ADR-02) — remplace `request()` → `T | null`
- **Entity** : l'état est détenu par le noyau et n'est modifiable que par `ctx.mutate` ; `entity.mutate()` et la file de ré-entrance propre à l'Entity sont retirés (ADR-10)
- **Composition** : le Composer décide par `resolve(ctx)` une composition ordonnée par clé ; la View occupe une part attribuée, créée par le noyau ; `rootElement`, `mount()`, `onAttach()`/`onDetach()` et les getters `html`/`body` de la Foundation sont retirés (ADR-16, ADR-18 à ADR-20)
- **ADR** réécrits depuis le code livré (ADR-01 à ADR-05, ADR-09, ADR-10, ADR-13, ADR-16, ADR-18 à ADR-20), lignes **Livré** corrigées (ADR-07, ADR-14, ADR-15, ADR-21, ADR-25, ADR-26, ADR-28, ADR-31, ADR-32, ADR-35) ; règle des ADR vivants, réécrits en place, rendue unique (`docs/README.md`, `docs/adr/README.md`)
- **Seuils de couverture** relevés au niveau mesuré (100 % hors `kernel`, `router` et `view`) ; 435 tests
- **Versions** : tous les `package.json` du workspace alignés sur `0.2.0`
- JSDoc et commentaires de `packages/` et `core/` traduits en anglais (ADR-34)
- Documentation alignée sur le code livré : les écarts connus sont consignés dans la ligne **Livré** de chaque ADR
- **Registre des invariants requalifié après le noyau** : I7, I8, I9, I13, I19, I20, I27, I28, I31, I33 à I37, I39, I58, I65, I66, I67 et I81 livrés, chacun cité par un test ; nouveaux tests du noyau (origine de démarrage, borne causale d'un Event, refus d'une Command, signalement d'une Query en échec) et des composants (lectures uniques des déclarations, typage de la composition)
- **Spécification et guides réécrits sur l'API du noyau** : `1-philosophie`, `2-architecture` (vue d'ensemble, `state`, `lifecycle`, `erreurs`, `distribution`), `validation`, `conventions-typage`, `formulaires`, `devtools`, références (`glossaire`, `types-index`, `anti-patterns`, `invariants`) et guides `FRAMEWORK-STYLE-GUIDE` et `FORMS-GUIDE` : contextes de handler, Queries sans `null` de substitution, refus du noyau, part créée par le noyau, slots aux clés distinctes des clés d'interface (D13), composition par clé ; `5-rendu` et les annexes de `view.md` restent des conceptions cibles, relues contre la théorie

### Fixed

- **Cache de build** : une entrée n'est plus tenue pour valide quand l'artefact a disparu (`--clean` reconstruit tout) ; un package dont une dépendance a été reconstruite est reconstruit (les bundles embarquent leurs dépendances) ; le premier package n'est plus testé contre un cache encore en chargement

### Removed

- **`Channel` et `Radio`** (lot M6.3b) : la racine du noyau, propre à chaque Application, les remplace (G6)

---

## [0.1.0-strate-0] — 2026-04-21 — Strate 0

### Added

- **`@bonsai/event`** : `Channel` tri-lane (Commands 1:1, Events 1:N, Requests synchrones) et singleton `Radio`
- **`@bonsai/entity`** : classe abstraite `Entity<TStructure>` — `mutate()` via Immer, détection des mutations sans effet, `onAnyEntityUpdated()` (I6, I46, I51, I52)
- **`@bonsai/immer`** : wrapper opaque (Tier 3) d'Immer
- **`@bonsai/feature`**, **`@bonsai/view`**, **`@bonsai/composer`**, **`@bonsai/foundation`**, **`@bonsai/application`** : kernel minimal (Feature avec les 5 capacités, View N1, Composer 0/1 View avec diff de `resolve()`, Foundation sur `<body>`, `Application.start()` en phases)
- **Gate E2E** `tests/e2e/strate-0.cart-round-trip.test.ts` : clic → Command → mutation → Event → projection, sans mock, avec jsdom
- **Seuils de couverture** figés dans `jest.config.ts` (baseline strate 0)
- **Husky** : `pre-commit` (`tsc --noEmit` + régression), `commit-msg` (Conventional Commits), `pre-push` (suite complète) ; **CI** `.github/workflows/regression.yml` ; **gate de régression cumulative** `tests/unit/strate-0/strate-0.regression.test.ts`
- **Agents Copilot** : `.github/agents/` (dev-framework, build-framework, rfc-architect)

### Changed

- **Pipeline de build réécrite** : deux passes Rollup (JS puis DTS via `rollup-plugin-dts`), suppression du code DTS maison ; 21 dépendances orphelines supprimées
- `core/dist/bonsai.d.ts` et `core/dist/bonsai.js` reconstruits depuis les sources

---

## [0.1.0] — 2026-04-14 — Baseline

> Premier jalon formalisé — squash de l'historique exploratoire (ADR-33).

### Added

- **Corpus documentaire** : RFC-0001 à RFC-0003 (architecture fondamentale, API & contrats de typage, rendu avancé)
- **Décisions architecturales** : ADR-0001 à ADR-0033 (entity mutation, channels, validation, build pipeline, git workflow…)
- **Guides** : BUILD-CODING-STYLE (pipeline de build), FRAMEWORK-STYLE-GUIDE (framework applicatif), TESTING (stratégie de test)
- **Références** : invariants (I1–I58), décisions historiques (D1–D32), glossaire, anti-patterns, index des types
- **Infrastructure de build** : pipeline Rollup dans `lib/build/` (prototype — réécriture planifiée ADR-29)
- **Infrastructure de test** : Jest (framework), Vitest (build pipeline), tests rouge/skip strate 0
- **Packages fondations** :
  - `@bonsai/types` — types utilitaires TypeScript (`TJsonObject`, `TDictionary`, `TConstructor`…)
  - `@bonsai/event` — Channel tri-lane, Radio singleton, Event trigger
  - `@bonsai/rxjs` — wrapper RxJS (observable interne, Tier 3)
  - `@bonsai/valibot` — wrapper Valibot (validation Entity, Tier 1 — ADR-0022)
- **Barrel** : `@bonsai/core` (`core/src/bonsai.ts`) — point d'entrée unique du framework
- **Agents IA** : `dev-framework.agent.md`, `build-framework.agent.md` (`.github/agents/`)
- **Outillage** : `pug-to-ts-template` (compilateur Pug → TypeScript), `build-bonsai-package` (outil de build packages)
- **Workflow Git** : Git Flow adapté (ADR-33) — `main` + `develop` + `feature/*`
- **Versioning** : SemVer `0.x.y` pré-v1 (ADR-33) — `0.2.0` = strate 0, `0.3.0` = strate 1, `0.4.0` = strate 2

---

[Unreleased]: https://github.com/NCAC/bonsai/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/NCAC/bonsai/compare/v0.1.0-strate-0...v0.2.0
[0.1.0-strate-0]: https://github.com/NCAC/bonsai/releases/tag/v0.1.0-strate-0
[0.1.0]: https://github.com/NCAC/bonsai/releases/tag/v0.1.0
