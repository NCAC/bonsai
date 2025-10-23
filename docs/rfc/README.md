# Request for Comments (RFC)

> Les RFCs définissent l'architecture et les spécifications techniques de Bonsai.
> Ce sont les documents de référence — le **quoi** et le **comment**.

---

## Structure documentaire

La documentation RFC est organisée en **chapitres** suivant un parcours de lecture progressif, des principes fondateurs jusqu'aux détails d'implémentation.

```
rfc/
├── 1-philosophie.md              ← Pourquoi Bonsai existe
├── 2-architecture/               ← Comment c'est structuré
│   ├── communication.md
│   ├── state.md
│   ├── lifecycle.md
│   ├── metas.md
│   ├── distribution.md
│   └── erreurs.md
├── 3-couche-abstraite/           ← Composants persistants (métier)
│   ├── application.md
│   ├── feature.md
│   ├── entity.md
│   └── router.md
├── 4-couche-concrete/            ← Composants éphémères (DOM)
│   ├── foundation.md
│   ├── composer.md
│   ├── view.md
│   └── behavior.md
├── 5-rendu.md                    ← PDR, templates, ProjectionList
├── 6-transversal/                ← Sujets transversaux
│   ├── conventions-typage.md
│   ├── formulaires.md
│   └── validation.md
├── devtools.md                   ← Instrumentation et observabilité
└── reference/                    ← Documents de référence
    ├── invariants.md
    ├── decisions.md
    ├── anti-patterns.md
    ├── glossaire.md
    └── types-index.md
```

---

## Index des chapitres

### Chapitre 1 — Philosophie

| Document | Description | Statut |
|----------|-------------|--------|
| [1-philosophie](1-philosophie.md) | Contexte, objectifs et principes fondateurs | 🟢 Stable |

### Chapitre 2 — Architecture

| Document | Description | Statut |
|----------|-------------|--------|
| [Vue d'ensemble](2-architecture/README.md) | Taxonomie des composants, couches, principes structurants | 🟢 Stable |
| [Communication](2-architecture/communication.md) | Flux unidirectionnel, tri-lane (command/event/request), Radio, namespaces | 🟢 Stable |
| [State](2-architecture/state.md) | Entity comme seul state, ownership strict, store logique distribué | 🟢 Stable |
| [Lifecycle](2-architecture/lifecycle.md) | Persistants vs volatils, nettoyage déterministe, garanties framework | 🟢 Stable |
| [Metas](2-architecture/metas.md) | Traçabilité, ULID, correlationId, propagation explicite | 🟢 Stable |
| [Distribution](2-architecture/distribution.md) | Mode IIFE vs ESM Modulaire, BonsaiRegistry | 🟢 Stable |
| [Erreurs](2-architecture/erreurs.md) | Catégories d'erreurs, propagation, diagnostics | 🟢 Stable |

### Chapitre 3 — Couche abstraite (composants persistants)

| Document | Description | Statut |
|----------|-------------|--------|
| [Vue d'ensemble](3-couche-abstraite/README.md) | Application, Feature, Entity, Router — ce qui vit toute la session | 🟢 Stable |
| [Application](3-couche-abstraite/application.md) | Orchestrateur bootstrap/shutdown, configuration, BonsaiRegistry | 🟢 Stable |
| [Feature](3-couche-abstraite/feature.md) | Unité métier, 5 capacités, handlers auto-découverts, Channel | 🟢 Stable |
| [Entity](3-couche-abstraite/entity.md) | Structure de données, mutations Immer, query, notifications | 🟢 Stable |
| [Router](3-couche-abstraite/router.md) | Spécialisation Feature pour la navigation, namespace réservé | 🟢 Stable |

### Chapitre 4 — Couche concrète (composants éphémères)

| Document | Description | Statut |
|----------|-------------|--------|
| [Vue d'ensemble](4-couche-concrete/README.md) | Foundation, Composer, View, Behavior — ce qui touche le DOM | 🟢 Stable |
| [Foundation](4-couche-concrete/foundation.md) | Singleton, écoute DOM globale, Composers racines, altération N1 | 🟢 Stable |
| [Composer](4-couche-concrete/composer.md) | Décideur de composition, resolve(), scope DOM fixe | 🟢 Stable |
| [View](4-couche-concrete/view.md) | Projection DOM Réactive, UIMap typée, délégation d'événements, localState | 🟢 Stable |
| [Behavior](4-couche-concrete/behavior.md) | Plugin UI réutilisable, handlers auto-dérivés, localState | 🟢 Stable |

### Chapitre 5 — Rendu avancé

| Document | Description | Statut |
|----------|-------------|--------|
| [Rendu avancé](5-rendu.md) | Compilateur Pug → PDR, templates, ProjectionList, réconciliation | 🟢 Stable |

### Chapitre 6 — Transversal

| Document | Description | Statut |
|----------|-------------|--------|
| [Conventions de typage](6-transversal/conventions-typage.md) | Préfixes, contraintes, patterns TypeScript fondamentaux | 🟢 Stable |
| [Formulaires](6-transversal/formulaires.md) | 4 patterns de formulaire, du simple au complexe | 🟢 Stable |
| [Validation](6-transversal/validation.md) | Compile-time, bootstrap, runtime — garanties et garde-fous | 🟢 Stable |

### DevTools

| Document | Description | Statut |
|----------|-------------|--------|
| [DevTools et observabilité](devtools.md) | Instrumentation, Event Ledger, inspection, hooks, perf policy | 🟡 Draft |

### Référence

| Document | Description | Statut |
|----------|-------------|--------|
| [Invariants](reference/invariants.md) | Règles non négociables (I1–I58) | 🟢 Stable |
| [Décisions historiques](reference/decisions.md) | Journal chronologique (D1–D48) | 🟢 Stable |
| [Anti-patterns](reference/anti-patterns.md) | Patterns explicitement interdits | 🟢 Stable |
| [Glossaire](reference/glossaire.md) | Terminologie officielle | 🟢 Stable |
| [Index des types](reference/types-index.md) | Glossaire exhaustif des types TypeScript | 🟢 Stable |

---

## Statuts

| Icône | Statut | Description |
|-------|--------|-------------|
| 🟢 | **Stable** | Architecture définie, amendements mineurs possibles |
| 🟡 | **Draft** | Rédaction/révision active |
| ⚪ | **Brouillon** | Exploration, non normatif |

---

## Comment lire les RFCs

**Ordre de lecture recommandé** :

1. **[Philosophie](1-philosophie.md)** — Pourquoi Bonsai existe, principes fondateurs
2. **[Architecture](2-architecture/README.md)** — Vue d'ensemble → [Communication](2-architecture/communication.md) → [State](2-architecture/state.md) → [Lifecycle](2-architecture/lifecycle.md)
3. **[Couche abstraite](3-couche-abstraite/README.md)** — [Feature](3-couche-abstraite/feature.md) → [Entity](3-couche-abstraite/entity.md) → [Application](3-couche-abstraite/application.md)
4. **[Couche concrète](4-couche-concrete/README.md)** — [Foundation](4-couche-concrete/foundation.md) → [Composer](4-couche-concrete/composer.md) → [View](4-couche-concrete/view.md) → [Behavior](4-couche-concrete/behavior.md)
5. **[Rendu avancé](5-rendu.md)** — PDR et templates Pug
6. **[Référence](reference/invariants.md)** — Invariants, décisions, anti-patterns

**Relation RFC ↔ ADR** : Les RFCs décrivent *quoi* construire. Quand un point nécessite un choix non trivial entre plusieurs options, on crée un [ADR](../adr/README.md) qui documente *pourquoi* ce choix.

---

## Références

- [ADRs — Décisions architecturales](../adr/README.md)
- [Guides — Conventions et mode d'emploi](../guides/)

---

## Matrice de gouvernance documentaire

En cas de divergence entre documents, le **document source de vérité** prévaut.

> **Règles de prévalence** :
> 1. Les documents dédiés (feature.md, entity.md, communication.md…) prévalent sur les vues d'ensemble (README.md chapitres).
> 2. Les ADR Accepted prévalent sur les décisions historiques (D1–D48).
> 3. Un ADR reste la source de vérité **tant que** son contenu n'est pas absorbé dans la RFC dédiée.

### Architecture et principes

| Sujet | RFC source de vérité | ADR active | Statut absorption | Action |
|-------|---------------------|------------|-------------------|--------|
| Principes, flux, frontières | [Philosophie](1-philosophie.md) + [Architecture](2-architecture/README.md) | — | — | ✅ Complet |
| Composants (10) | [Couche abstraite](3-couche-abstraite/README.md) + [Couche concrète](4-couche-concrete/README.md) | — | — | ✅ Complet |
| Invariants (I1–I58) | [Invariants](reference/invariants.md) | — | — | ✅ Complet |
| Vocabulaire officiel | [Glossaire](reference/glossaire.md) | — | — | ✅ Complet |
| Métadonnées causales (metas) | [Metas](2-architecture/metas.md) | [ADR-0005](../adr/ADR-0005-meta-lifecycle.md) 🟢 / [ADR-0016](../adr/ADR-0016-metas-handler-signature.md) 🟢 | ✅ 80% | ULID, `usr-`/`sys-`, `origin.kind` absorbés. |
| Bootstrap & lifecycle | [Lifecycle](2-architecture/lifecycle.md) | [ADR-0010](../adr/ADR-0010-bootstrap-order.md) 🟢 | ✅ 80% | `PhaseKey`, `TAppContext`, 6 phases, shutdown inverse absorbés |

### API, contrats et typage

| Sujet | RFC source de vérité | ADR active | Statut absorption | Action |
|-------|---------------------|------------|-------------------|--------|
| Conventions de typage | [Conventions de typage](6-transversal/conventions-typage.md) | — | — | ✅ Complet |
| Contrat Feature | [Feature](3-couche-abstraite/feature.md) | — | — | ✅ Complet |
| Contrat Entity | [Entity](3-couche-abstraite/entity.md) | [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) 🟢 | ✅ 80% | ✅ Quasi-complet (`mutate()` absorbé) |
| Schema Entity (validation domaine) | [Entity](3-couche-abstraite/entity.md) | [ADR-0022](../adr/ADR-0022-entity-schema-validation.md) 🟢 | 🔴 0% | **Nouveau** — `abstract get schema()`, Valibot imposé |
| Contrat Channel | [Communication](2-architecture/communication.md) | [ADR-0003](../adr/ADR-0003-channel-runtime-semantics.md) 🟢 | 🟡 70% | Absorber config runtime, `ListenerPriority`, `AbortController` |
| Sémantique request/reply | [Communication](2-architecture/communication.md) | [ADR-0023](../adr/ADR-0023-request-reply-sync-vs-async.md) 🟢 | 🔴 0% | **Nouveau** — `reply()` sync strict, D9/D44 révisés |
| Validation & assertions | [Validation](6-transversal/validation.md) | [ADR-0004](../adr/ADR-0004-validation-modes.md) 🟢 | 🔴 10% | Absorber `invariant()`, `__DEV__`, tree-shaking |
| Propagation d'erreurs | [Erreurs](2-architecture/erreurs.md) | [ADR-0002](../adr/ADR-0002-error-propagation-strategy.md) 🟢 | 🟡 50% | Absorber `BonsaiError`, matrice, `ErrorReporter` |

### Rendu et UI

| Sujet | RFC source de vérité | ADR active | Statut absorption | Action |
|-------|---------------------|------------|-------------------|--------|
| PDR, templates, ProjectionList | [Rendu avancé](5-rendu.md) | — | — | ✅ RFC 🟢 Stable (D39–D48) |
| Collections & listes | [Rendu avancé §6.4–6.8](5-rendu.md) | [ADR-0008](../adr/ADR-0008-collection-patterns.md) ⚪ | ✅ 100% | ✅ Absorbé — ADR superseded (D45) |
| Listes virtualisées | [Rendu avancé §6, §12](5-rendu.md) | [ADR-0012](../adr/ADR-0012-virtualized-list.md) 🟢 | 🟡 50% | Absorber API `Virtualizer` |
| Local state (View & Behavior) | [View](4-couche-concrete/view.md) / [Behavior](4-couche-concrete/behavior.md) | [ADR-0015](../adr/ADR-0015-local-state-mechanism.md) 🟢 | ✅ 80% | `updateLocal()`, `get local`, dual N1/N2-N3 absorbés |
| SSR & hydration | [Rendu avancé](5-rendu.md) | [ADR-0014](../adr/ADR-0014-ssr-hydration-strategy.md) 🟢 | ✅ 80% | H1–H5 absorbés |
| Contrat Behavior | [Behavior](4-couche-concrete/behavior.md) | [ADR-0007](../adr/ADR-0007-behavior-contract.md) 🟢 | ✅ 80% | Contrat absorbé dans le chapitre dédié |

### Transversal

| Sujet | RFC source de vérité | ADR active | Statut absorption | Action |
|-------|---------------------|------------|-------------------|--------|
| DevTools & observabilité | [DevTools](devtools.md) | — | — | 🟡 Promouvoir Draft → Stable |
| Testing & `@bonsai/testing` | *Aucune RFC* — [Guide](../guides/TESTING.md) | [ADR-0006](../adr/ADR-0006-testing-strategy.md) 🟢 | 🟡 50% | Guide créé. Reste : implémenter `@bonsai/testing` |
| Formulaires | [Formulaires](6-transversal/formulaires.md) + [Guide](../guides/FORMS-GUIDE.md) | [ADR-0009](../adr/ADR-0009-forms-pattern.md) 🟢 | ✅ 100% | Patterns absorbés + guide dédié |
| Event Sourcing | *Aucune RFC* | [ADR-0011](../adr/ADR-0011-event-sourcing-support.md) 🟠 | — | Post-v1 (🟠 Suspended) |
| Réutilisation code View | [Décisions D38](reference/decisions.md) | [ADR-0013](../adr/ADR-0013-view-code-reuse.md) ⚪ | — | ⚪ Superseded (→ D38) |
| Distribution ESM | [Distribution](2-architecture/distribution.md) | [ADR-0019](../adr/ADR-0019-esm-modulaire.md) 🟢 | 🟡 50% | BonsaiRegistry, chargement dynamique absorbés |
| Extension Points | [Architecture](2-architecture/README.md) | [ADR-0021](../adr/ADR-0021-extension-points.md) 🟡 | 🔴 0% | Proposed — en attente d'acceptation |

### Légende

| Icône | Signification |
|-------|---------------|
| ✅ | Absorption complète — la RFC fait foi |
| 🟡 | Absorption partielle — l'ADR reste co-normative |
| 🔴 | Non absorbé — l'ADR est seule source de vérité |
| ⬜ | Pas encore absorbé (ADR en attente ou récent) |

---

## Index thématique des invariants

Les invariants I1–I45, I57 et I58 sont définis dans [Invariants architecturaux](reference/invariants.md).
Les invariants I46–I56 sont définis dans [Conventions de typage](6-transversal/conventions-typage.md) (invariants spécifiques aux contrats TypeScript).

> **Total : 58 invariants** (I1–I58) répartis entre les invariants architecturaux (I1–I45, I57, I58)
> et les invariants de contrats TypeScript (I46–I56).

| Thème | Invariants |
|-------|------------|
| **Communication / Channels** | I1, I2, I3, I4, I7, I8, I9, I10, I11, I12, I14, I15, I16 |
| **State / Encapsulation** | I5, I6, I17, I22, I29, I30, I42, I57 |
| **View / DOM** | I13, I18, I19, I31, I32, I34, I36, I38, I39, I40, I41 |
| **Behavior** | I43, I44, I45 |
| **Foundation** | I20, I33, I38 |
| **Composer** | I20, I35, I36, I37, I38, I40, I58 |
| **Lifecycle** | I19, I20, I23, I24 |
| **Nommage / Namespace** | I21, I25, I26, I27, I28, I57 |
| **Contrats TypeScript** | I46, I47, I48, I49, I50, I51, I52, I53, I54, I55, I56 |

---

## Correspondance avec les anciens noms de fichiers

> Table de correspondance entre les anciens noms de fichiers RFC et la structure actuelle.

| Ancien fichier | Nouveau chemin |
|---------------|----------------|
| `RFC-0001-architecture-fondamentale.md` | [1-philosophie.md](1-philosophie.md) + [2-architecture/](2-architecture/README.md) |
| `RFC-0001-composants.md` | [3-couche-abstraite/](3-couche-abstraite/README.md) + [4-couche-concrete/](4-couche-concrete/README.md) |
| `RFC-0001-invariants-decisions.md` | [reference/invariants.md](reference/invariants.md) + [reference/decisions.md](reference/decisions.md) |
| `RFC-0001-glossaire.md` | [reference/glossaire.md](reference/glossaire.md) |
| `RFC-0002-api-contrats-typage.md` | [6-transversal/conventions-typage.md](6-transversal/conventions-typage.md) + [reference/types-index.md](reference/types-index.md) |
| `RFC-0002-channel.md` | [2-architecture/communication.md](2-architecture/communication.md) |
| `RFC-0002-feature.md` | [3-couche-abstraite/feature.md](3-couche-abstraite/feature.md) |
| `RFC-0002-entity.md` | [3-couche-abstraite/entity.md](3-couche-abstraite/entity.md) |
| `RFC-0003-rendu-avance.md` | [5-rendu.md](5-rendu.md) |
| `RFC-0004-devtools.md` | [devtools.md](devtools.md) |
