# Changelog

Toutes les modifications notables du framework Bonsai sont documentées dans ce fichier.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
Versioning : [SemVer](https://semver.org/lang/fr/)
Workflow : [ADR-33](docs/adr/ADR-33-workflow-git-ci.md)

---

## [Unreleased]

Depuis le tag `v0.1.0-strate-0` (l'historique complet est dans `git log`).

### Added

- **Strate 1a — Entity** : `Immer.produceWithPatches`, `TEntityEvent` enrichi (`patches`, `inversePatches`, `previousState`, `nextState`), file FIFO de ré-entrance bornée par `maxEntityNotificationDepth` (`EntityReentrancyError`, I98), handlers `on<Key>EntityUpdated` / `onAnyEntityUpdated` auto-découverts par la Feature (`BroadcastError` isolée, I96)
- **Contrat Feature `Feature<TEntity, TChannelDef, TSelfNS>`** : namespace porté par le manifest applicatif (`StrictManifest<M>`), `static readonly channel`, `get listens()` / `get queries()` d'instance, `TFeatureCallbacks`, constructeur inerte, phases 0a–0c du bootstrap (ADR-08, ADR-09)
- **Pattern modulaire de View** : `TFeatureContract` / `TUIContract` / `TUIElements`, `ui<TEl>()(events)`, `TEventsFor<TEl>`, `TViewCallbacks` (ADR-14, ADR-15)
- **Documentation** : 34 ADR vivants (`docs/adr/`), spécification par chapitres (`docs/spec/`), `docs/ROADMAP.md` ; ancien corpus archivé dans `docs/archive/adr-v0/`

### Changed

- JSDoc et commentaires de `packages/` et `core/` traduits en anglais (ADR-34)
- Documentation alignée sur le code livré : les écarts connus sont consignés dans la ligne **Livré** de chaque ADR

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

[Unreleased]: https://github.com/NCAC/bonsai/compare/v0.1.0-strate-0...HEAD
[0.1.0-strate-0]: https://github.com/NCAC/bonsai/releases/tag/v0.1.0-strate-0
[0.1.0]: https://github.com/NCAC/bonsai/releases/tag/v0.1.0
