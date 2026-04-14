# Changelog

Toutes les modifications notables du framework Bonsai sont documentées dans ce fichier.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
Versioning : [SemVer](https://semver.org/lang/fr/)
Workflow : [ADR-0033](docs/adr/ADR-0033-git-workflow-versioning-strategy.md)

---

## [Unreleased]

### Added

### Changed

### Fixed

---

## [0.1.0] — 2026-04-14 — Baseline

> Premier jalon formalisé — squash de l'historique exploratoire (ADR-0033 §8).

### Added

- **Corpus documentaire** : RFC-0001 à RFC-0003 (architecture fondamentale, API & contrats de typage, rendu avancé)
- **Décisions architecturales** : ADR-0001 à ADR-0033 (entity mutation, channels, validation, build pipeline, git workflow…)
- **Guides** : BUILD-CODING-STYLE (pipeline de build), FRAMEWORK-STYLE-GUIDE (framework applicatif), TESTING (stratégie de test)
- **Références** : invariants (I1–I58), décisions historiques (D1–D32), glossaire, anti-patterns, index des types
- **Infrastructure de build** : pipeline Rollup dans `lib/build/` (prototype — réécriture planifiée ADR-0032)
- **Infrastructure de test** : Jest (framework), Vitest (build pipeline), tests rouge/skip strate 0
- **Packages fondations** :
  - `@bonsai/types` — types utilitaires TypeScript (`TJsonObject`, `TDictionary`, `TConstructor`…)
  - `@bonsai/event` — Channel tri-lane, Radio singleton, Event trigger
  - `@bonsai/rxjs` — wrapper RxJS (observable interne, Tier 3)
  - `@bonsai/valibot` — wrapper Valibot (validation Entity, Tier 1 — ADR-0022)
- **Barrel** : `@bonsai/core` (`core/src/bonsai.ts`) — point d'entrée unique du framework
- **Agents IA** : `dev-framework.agent.md`, `build-framework.agent.md` (`.github/agents/`)
- **Outillage** : `pug-to-ts-template` (compilateur Pug → TypeScript), `build-bonsai-package` (outil de build packages)
- **Workflow Git** : Git Flow adapté (ADR-0033) — `main` + `develop` + `feature/*`
- **Versioning** : SemVer `0.x.y` pré-v1 (ADR-0033) — `0.2.0` = strate 0, `0.3.0` = strate 1, `0.4.0` = strate 2

---

[Unreleased]: https://github.com/nicmusic/bonsai/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nicmusic/bonsai/releases/tag/v0.1.0
