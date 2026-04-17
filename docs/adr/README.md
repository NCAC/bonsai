# Architecture Decision Records (ADR)

> Les ADRs documentent les décisions architecturales importantes de Bonsai.
> Chaque ADR capture le contexte, les options considérées et le choix final.

---

## Index des ADRs

| #                                                                    | Titre                                                                                   | Statut        | Date                            | RFC liée                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------- | ------------------------------- | ---------------------------------------------------------------- |
| [ADR-0001](ADR-0001-entity-diff-notification-strategy.md)            | Entity mutation & notification strategy                                                 | 🟢 Accepted   | 2026-03-18                      | RFC-0002-entity                                                  |
| [ADR-0002](ADR-0002-error-propagation-strategy.md)                   | Error propagation strategy                                                              | 🟢 Accepted   | 2026-03-18                      | RFC-0002-feature                                                 |
| [ADR-0003](ADR-0003-channel-runtime-semantics.md)                    | Channel runtime semantics                                                               | 🟢 Accepted   | 2026-03-18                      | RFC-0002-channel                                                 |
| [ADR-0004](ADR-0004-validation-modes.md)                             | Validation modes                                                                        | 🟢 Accepted   | 2026-03-18                      | RFC-0002-api                                                     |
| [ADR-0005](ADR-0005-meta-lifecycle.md)                               | Meta lifecycle                                                                          | 🟢 Accepted   | 2026-03-18                      | RFC-0001 §10                                                     |
| [ADR-0006](ADR-0006-testing-strategy.md)                             | Testing strategy                                                                        | 🟢 Accepted   | 2026-03-18                      | —                                                                |
| [ADR-0007](ADR-0007-behavior-contract.md)                            | Behavior contract                                                                       | ⚪ Superseded | 2026-03-23                      | RFC-0001 D36                                                     |
| [ADR-0008](ADR-0008-collection-patterns.md)                          | Collection patterns                                                                     | ⚪ Superseded | 2026-03-17                      | RFC-0003 §6.4–6.8                                                |
| [ADR-0009](ADR-0009-forms-pattern.md)                                | Forms pattern — localState, FormBehavior, Hybride                                       | 🟢 Accepted   | 2026-04-01                      | ADR-0001, ADR-0007, ADR-0015, ADR-0016                           |
| [ADR-0010](ADR-0010-bootstrap-order.md)                              | Bootstrap order & dependencies                                                          | 🟢 Accepted   | 2026-03-18                      | RFC-0001 §5.1                                                    |
| [ADR-0011](ADR-0011-event-sourcing-support.md)                       | Event Sourcing support                                                                  | 🟠 Suspended  | 2026-03-17                      | RFC-0002-entity                                                  |
| [ADR-0012](ADR-0012-virtualized-list.md)                             | Virtualized lists                                                                       | 🟢 Accepted   | 2026-03-19                      | RFC-0003 §6, §12                                                 |
| [ADR-0013](ADR-0013-view-code-reuse.md)                              | View code reuse                                                                         | ⚪ Superseded | 2026-03-25                      | D34–D38 (RFC-0001)                                               |
| [ADR-0014](ADR-0014-ssr-hydration-strategy.md)                       | SSR hydration strategy                                                                  | 🟢 Accepted   | 2026-03-24                      | RFC-0002 §7.2, §9.4, §9.4.7, §12.4 · RFC-0003 §5.3, §6, §7.5     |
| [ADR-0015](ADR-0015-local-state-mechanism.md)                        | Local state mechanism (View & Behavior)                                                 | 🟢 Accepted   | 2026-03-25                      | RFC-0001-composants §7–8, RFC-0003 §2.1/§7.4, I42, I57, D33, D37 |
| [ADR-0016](ADR-0016-metas-handler-signature.md)                      | Metas handler signature (explicite vs auto-injectée)                                    | 🟢 Accepted   | 2026-03-25                      | RFC-0001 §10, RFC-0002 §13, ADR-0005                             |
| [ADR-0017](ADR-0017-rendering-strategy-vdom-vs-pdr.md)               | Rendering strategy — VDOM vs PDR chirurgicale                                           | 🟢 Accepted   | 2026-03-26                      | RFC-0001 (D19), RFC-0002 §9.4, RFC-0003, ADR-0012, ADR-0014      |
| [ADR-0018](ADR-0018-foundation-contract.md)                          | Foundation contract — TUIMap globale, données serveur, persistance concrète             | 🟠 Suspended  | 2026-03-27                      | RFC-0002 §11, RFC-0001-composants §9                             |
| [ADR-0019](ADR-0019-mode-esm-modulaire.md)                           | Mode ESM Modulaire — BonsaiRegistry, bootstrap dynamique                                | 🟢 Accepted   | 2026-04-01                      | RFC-0002 §7 Application                                          |
| [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) | Sémantique N-instances Composer & CDH périmètre réduit                                  | 🟢 Accepted   | 2026-04-01                      | RFC-0002 §9 Composer                                             |
| [ADR-0021](ADR-0021-composition-monde-ouvert-plateforme.md)          | Composition monde ouvert — Plateforme & extension points                                | 🟡 Proposed   | 2026-03-27 (renommé 2026-04-01) | RFC-0001-composants, RFC-0002 §7                                 |
| [ADR-0022](ADR-0022-entity-schema-validation.md)                     | Entity Schema Validation — Valibot imposé, `abstract get schema()`, validation modale   | 🟢 Accepted   | 2026-04-01                      | RFC-0002-entity, ADR-0004, ADR-0009                              |
| [ADR-0023](ADR-0023-request-reply-sync-vs-async.md)                  | Sémantique request()/reply() — sync vs async                                            | 🟢 Accepted   | 2026-04-01                      | Communication (tri-lane)                                         |
| [ADR-0024](ADR-0024-component-capabilities-manifest-pattern.md)      | Déclaration capacités composants — Pattern Manifeste value-first (`as const satisfies`) | 🟢 Accepted   | 2026-04-03                      | Couche concrète, Feature                                         |
| [ADR-0025](ADR-0025-composer-no-lifecycle-hooks.md)                  | Retrait des hooks de lifecycle du Composer (`onMount`/`onUnmount` supprimés)            | � Accepted    | 2026-04-07                      | composer.md, lifecycle.md                                        |
| [ADR-0026](ADR-0026-root-element-css-selector-from-composer.md)      | `rootElement` — sélecteur CSS unique, fourni exclusivement par le Composer              | � Accepted    | 2026-04-07                      | composer.md, view.md, ADR-0020 §6.2                              |
| [ADR-0027](ADR-0027-composer-resolve-event-argument.md)              | `resolve(event)` — l'événement déclencheur comme argument unique du Composer            | 🟢 Accepted   | 2026-04-07                      | composer.md, communication.md §8, ADR-0025                       |
| [ADR-0028](ADR-0028-implementation-phasing-strategy.md)              | Stratégie de phasage d'implémentation — Kernel-first en 3 strates                       | 🟢 Accepted   | 2026-04-08                      | Transversal (toutes RFC/ADR)                                     |
| [ADR-0029](ADR-0029-v1-scope-freeze.md)                              | Périmètre gelé v1 — Ce qui entre, ce qui attend                                         | 🟢 Accepted   | 2026-04-08                      | ADR-0028, ADR-0012, ADR-0021                                     |
| [ADR-0030](ADR-0030-testing-as-architecture-proof.md)                | Tests comme preuve d'architecture — Spécification exécutable par strate                 | 🟢 Accepted   | 2026-04-10                      | ADR-0028, ADR-0029, ADR-0006                                     |
| [ADR-0031](ADR-0031-monorepo-package-topology.md)                    | Topologie des packages du monorepo — 1 package par composant                            | 🟢 Accepted   | 2026-04-10                      | RFC 2-architecture, distribution                                 |
| [ADR-0032](ADR-0032-build-pipeline-toolchain.md)                     | Build Pipeline — Toolchain, artefacts et stratégie de bundling DTS                      | 🟡 Proposed   | 2026-04-14                      | ADR-0019, ADR-0028, ADR-0029, ADR-0031                           |
| [ADR-0033](ADR-0033-git-workflow-versioning-strategy.md)             | Workflow Git & stratégie de versioning — Git Flow adapté, SemVer `0.x.y`                | � Accepted    | 2026-04-17                      | ADR-0028, ADR-0029, ADR-0032                                     |
| [ADR-0034](ADR-0034-cumulative-regression-gate.md)                   | Gate de non-régression cumulative par strate — fichier d'entrée explicite + CI          | 🟡 Proposed   | 2026-04-17                      | ADR-0028, ADR-0030, ADR-0006                                     |

---

## Statuts

| Icône | Statut         | Description                                    |
| ----- | -------------- | ---------------------------------------------- |
| 🟡    | **Proposed**   | ADR rédigé, en attente de décision             |
| 🟢    | **Accepted**   | Décision prise, ADR figé                       |
| 🟠    | **Suspended**  | ADR proposé, bloqué par une dépendance externe |
| ⚪    | **Superseded** | Remplacé par un autre ADR                      |
| ⏳    | **À rédiger**  | Identifié comme nécessaire                     |

---

## Processus

```
1. PROPOSED   → ADR rédigé, options documentées
2. REVIEW     → Discussion, ajustements
3. ACCEPTED   → Décision prise, ADR figé (date + décideurs)
4. SUPERSEDED → Remplacé par un autre ADR (lien vers successeur)
```

**Règle fondamentale** : Un ADR ACCEPTED ne se modifie plus. Si la décision change, on crée un nouvel ADR qui SUPERSEDES l'ancien.

---

## Template

Voir [TEMPLATE.md](TEMPLATE.md) pour le format standard d'un ADR.

---

## Priorités

D'après la [Roadmap de consolidation](../archive/ROADMAP-CONSOLIDATION.md) :

### 🔴 P1 — Bloquants pour v1

- ~~ADR-0001 Entity diff strategy~~ → 🟢 Accepted
- ~~ADR-0002 Error propagation~~ → 🟢 Accepted
- ~~ADR-0003 Channel runtime semantics~~ → 🟢 Accepted
- ~~ADR-0006 Testing strategy~~ → 🟢 Accepted

### 🟡 P2 — Nécessaires pour v1 complète

- ~~ADR-0004 Validation modes~~ → 🟢 Accepted
- ~~ADR-0005 Meta lifecycle~~ → 🟢 Accepted
- ~~ADR-0008 Collection patterns~~ → ⚪ Superseded (RFC-0003 §6.4–6.8)

### 🟢 P3 — Post-v1

- ~~ADR-0009 Forms pattern~~ → 🟢 Accepted
- ~~ADR-0010 Bootstrap order~~ → 🟢 Accepted
- ~~ADR-0011 Event Sourcing support~~ → 🟠 Suspended (post-v1)
- ~~ADR-0012 Listes virtualisées~~ → 🟢 Accepted
- ~~ADR-0013 Réutilisation de code entre Views~~ → ⚪ Superseded (D34–D38)
- ~~ADR-0014 SSR hydration strategy~~ → 🟢 Accepted

### 🟡 P2 — Ajouts récents

- ~~ADR-0015 Local state mechanism (View & Behavior)~~ → 🟢 Accepted
- ~~ADR-0016 Metas handler signature~~ → 🟢 Accepted

### 🔴 P1 — Ajouts stratégiques

- ~~ADR-0017 Rendering strategy (VDOM vs PDR)~~ → 🟢 Accepted
- ~~ADR-0018 Foundation contract (TUIMap globale, données serveur, persistance concrète)~~ → 🟠 Suspended
- ~~ADR-0019 Mode ESM Modulaire (BonsaiRegistry, bootstrap dynamique)~~ → 🟢 Accepted
- ~~ADR-0020 N-instances Composer & CDH périmètre réduit~~ → 🟢 Accepted
- ~~ADR-0021 Composition monde ouvert (plateforme & extension points)~~ → 🟡 Proposed (réflexion pré-ADR)
- ~~ADR-0022 Entity Schema Validation (Valibot imposé, `abstract get schema()`, validation modale)~~ → 🟢 Accepted
- ~~ADR-0023 Sémantique request()/reply() — sync vs async~~ → 🟢 Accepted
- ~~ADR-0024 Pattern Manifeste value-first (déclaration capacités composants)~~ → 🟢 Accepted
- ~~ADR-0025 Retrait hooks lifecycle Composer~~ → 🟢 Accepted
- ~~ADR-0026 `rootElement` string-only, CSS parseable, fourni par Composer~~ → 🟢 Accepted
- ~~ADR-0027 `resolve(event)` — événement comme argument unique du Composer~~ → 🟢 Accepted
- ~~ADR-0028 Stratégie de phasage d'implémentation — Kernel-first en 3 strates~~ → 🟢 Accepted
- ~~ADR-0029 Périmètre gelé v1 — 16 ADR IN, 4 Accepted OUT~~ → 🟢 Accepted
- ~~ADR-0030 Tests comme preuve d'architecture — spécification exécutable par strate~~ → 🟢 Accepted

---

## Références

- [Index des RFCs](../rfc/README.md)
- [Philosophie et principes](../rfc/1-philosophie.md)
- [Architecture](../rfc/2-architecture/README.md)
- [Couche abstraite](../rfc/3-couche-abstraite/README.md)
- [Couche concrète](../rfc/4-couche-concrete/README.md)
- [Rendu avancé](../rfc/5-rendu.md)
- [DevTools et observabilité](../rfc/devtools.md)

### Documents archivés

- [Roadmap de consolidation](../archive/ROADMAP-CONSOLIDATION.md)
- [Audit RFC (2026-03-17)](../archive/analyses/audit-rfc-2026-03-17.md)
- [Analyse RFC (2026-03-19)](../archive/analyses/analyse-rfc-2026-03-19.md)
