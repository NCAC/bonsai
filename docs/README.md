# 📖 Documentation Bonsai

> Point d'entrée de toute la documentation technique du framework Bonsai.

---

## 📁 Structure

```
docs/
├── rfc/                    ← Spécifications (le QUOI)
├── adr/                    ← Décisions architecturales (le POURQUOI)
├── guides/                 ← Conventions et mode d'emploi (le COMMENT)
├── pugx/                   ← Sous-projet PugX (WIP)
└── archive/                ← Documents passés (mémoire)
    ├── analyses/           ← Audits et analyses ponctuelles
    └── explorations/       ← Notes de réflexion brutes
```

---

## 📐 Documents de référence

### [RFCs — Spécifications](rfc/README.md)

Les RFCs définissent l'architecture et les contrats techniques. C'est la **source de vérité**.

| RFC | Sujet | Statut |
|-----|-------|--------|
| RFC-0001 | Architecture fondamentale (composants, invariants, flux) | 🟢 Stable |
| RFC-0002 | API, contrats TypeScript (Channel, Feature, Entity) | 🟢 Stable |
| RFC-0003 | Rendu avancé (PDR, templates, ProjectionList) | 🟢 Stable |
| RFC-0004 | DevTools et observabilité (Event Ledger, hooks, perf) | 🟢 Stable |

### [ADRs — Décisions](adr/README.md)

Les ADRs documentent les choix architecturaux non triviaux : contexte, options évaluées, décision finale.

- **23 ADRs** (ADR-0001 à ADR-0023)
- **16 Accepted**, 3 Superseded, 2 Proposed, 2 Suspended
- [Voir l'index complet →](adr/README.md)

### [Guides — Conventions](guides/)

| Guide | Périmètre | Description |
|-------|-----------|-------------|
| [BUILD-CODING-STYLE.md](guides/BUILD-CODING-STYLE.md) | `lib/`, `tools/` | Conventions pour la pipeline de build (TypeScript, imports, nommage, singleton) |
| [FRAMEWORK-STYLE-GUIDE.md](guides/FRAMEWORK-STYLE-GUIDE.md) | Code applicatif | Conventions du framework (DOM, HTML, CSS, API TypeScript, patterns) |
| [FORMS-GUIDE.md](guides/FORMS-GUIDE.md) | Formulaires | 4 patterns de formulaires (localState, FormBehavior, Entity, Hybride) — ADR-0009 |
| [TESTING.md](guides/TESTING.md) | Tests | Stratégie de test (unit, intégration, e2e) — ADR-0006 |

---

## 🔍 Errata et audits

| Document | Date | Statut |
|----------|------|--------|
| [ERRATA-2026-03-23](ERRATA-2026-03-23.md) | 2026-03-23 | 🟢 Clos — 36 constats, tous corrigés |
| [Audit sévère (v1)](audit-2026-04-01.md) | 2026-04-01 | 🟡 Actif — 19 recommandations, 11 résolues |

---

## 📦 Archive

Documents ayant servi à alimenter les RFC/ADR. Conservés comme **mémoire de raisonnement**, 
mais ne sont plus des documents de référence actifs.

| Dossier | Contenu |
|---------|---------|
| [archive/analyses/](archive/analyses/) | Audits et analyses RFC (mars 2026) |
| [archive/explorations/](archive/explorations/) | Notes de réflexion, conversations, comparatifs |
| [archive/ROADMAP-CONSOLIDATION.md](archive/ROADMAP-CONSOLIDATION.md) | Plan de travail consolidation RFC |

---

## 🧭 Comment naviguer

| Je veux… | Je lis… |
|----------|---------|
| Comprendre l'architecture Bonsai | [Philosophie](rfc/1-philosophie.md) + [Architecture](rfc/2-architecture/README.md) |
| Connaître les règles non-négociables | [Invariants I1–I58](rfc/reference/invariants.md) |
| Savoir pourquoi tel choix a été fait | [ADRs](adr/README.md) |
| Écrire du code framework (build) | [BUILD-CODING-STYLE](guides/BUILD-CODING-STYLE.md) |
| Écrire du code applicatif Bonsai | [FRAMEWORK-STYLE-GUIDE](guides/FRAMEWORK-STYLE-GUIDE.md) |
| Implémenter un formulaire | [FORMS-GUIDE](guides/FORMS-GUIDE.md) |
| Retrouver une ancienne réflexion | [Archive](archive/) |

---

## 🌱 Genèse

[**GENESIS.md**](GENESIS.md) — L'histoire de Bonsai : de Backbone.Marionette à marionext, du TypeScript révélateur à la naissance d'un framework.

---

## 📏 Conventions de documentation

| Type de document | Rôle | Durée de vie | Modifiable ? |
|------------------|------|-------------|-------------|
| **RFC** | Spécification (quoi + comment) | Vivant → se stabilise | Oui, jusqu'à stabilisation |
| **ADR** | Décision (pourquoi) | Immutable une fois accepté | Non — on crée un nouvel ADR |
| **Guide** | Mode d'emploi | Vivant | Oui |
| **Analyse/Audit** | Input temporaire | Éphémère | Archivé une fois intégré |
