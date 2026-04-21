# Changelog

Toutes les modifications notables du framework Bonsai sont documentées dans ce fichier.

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
Versioning : [SemVer](https://semver.org/lang/fr/)
Workflow : [ADR-0033](docs/adr/ADR-0033-git-workflow-versioning-strategy.md)

---

## [Unreleased]

### Added

- **`@bonsai/entity`** : abstract `Entity<TStructure>` base class — `mutate(intent, recipe)` via Immer, no-op detection, `onAnyEntityUpdated()` catch-all (I6, I46, I51, I52)
- **`@bonsai/immer`** : opaque Tier 3 wrapper for Immer (`produce`, `Draft`)
- **ADR-0034** : Continuous verification strategy — Husky pre-commit + CI GitHub Actions
- **ADR-0035** : Build artifacts versioning strategy — all versioned, systematic rebuild, `main` authoritative
- **ADR-0036** : Documentation internationalization — FR source, EN derived (`-EN.md`)
- **Husky hooks** : pre-commit (`tsc --noEmit` + regression), commit-msg (Conventional Commits), pre-push (full tests)
- **CI workflow** : `.github/workflows/regression.yml` — continuous verification on PR → `develop`
- **Regression gate** : 39 cumulative tests (Channel + Radio + Entity)
- **GitHub Copilot agents** : `.github/agents/` (dev-framework, build-framework, rfc-architect)

### Changed

- `core/dist/bonsai.d.ts` and `core/dist/bonsai.js` rebuilt from current sources
- `.gitignore` : added `*.tsbuildinfo`
- Documentation cleanup : ADR index updated (36 entries), governance matrix corrected

### Fixed

- Broken cross-reference in ADR-0035 (old ADR-0034 filename)
- ADR-0007 status in RFC governance matrix (🟢 → ⚪ Superseded)
- DevTools RFC status in docs hub (🟢 Stable → 🟡 Draft)
- ADR count in docs hub (23 → 36)

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

[Unreleased]: https://github.com/NCAC/bonsai/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/NCAC/bonsai/releases/tag/v0.1.0
