# Roadmap de consolidation Bonsai

> **Objectif** : Transformer les RFC de "vision robuste" en "contrat d'implémentation sans ambiguïté"
>
> Ce document consolide l'[audit externe](audit-rfc-2026-03-17.md), l'[analyse interne](analyse-rfc-2026-03-17.md)
> et les observations issues du travail de documentation pour établir un plan d'action priorisé.

---

| Champ | Valeur |
|-------|--------|
| **Créé le** | 2026-03-17 |
| **Statut** | 🟢 Actif |
| **Prochaine revue** | À définir |

---

## 📋 Table des matières

1. [Synthèse des constats](#1-synthèse-des-constats)
2. [ADRs à produire](#2-adrs-à-produire)
3. [Sections RFC à renforcer](#3-sections-rfc-à-renforcer)
4. [Nouveaux documents à créer](#4-nouveaux-documents-à-créer)
5. [Questions architecturales ouvertes](#5-questions-architecturales-ouvertes)
6. [Backlog priorisé](#6-backlog-priorisé)

---

## 1. Synthèse des constats

### 1.1 Ce qui est très mûr (audit)

| Domaine | Évaluation |
|---------|-----------|
| Philosophie générale | ✅ Solide |
| Séparation couche abstraite / concrète | ✅ Solide |
| Modèle Feature / Entity / Channel | ✅ Solide |
| Communication tri-lane | ✅ Solide |
| Approche TypeScript-first | ✅ Solide |
| Interdiction state local UI | ✅ Solide |

### 1.2 Ce qui reste à verrouiller (audit)

| Domaine | Statut | Risque |
|---------|--------|--------|
| Sémantique runtime des erreurs | 🔴 Non spécifié | Élevé |
| Mécanique exacte des metas | 🔴 Partiellement spécifié | Moyen |
| Stratégie Entity diff/notifications/perf | 🔴 Non spécifié | Élevé |
| Validation runtime (debug/strict/prod) | 🔴 Non spécifié | Moyen |
| PDR/Rendu comme domaine propre | 🟡 Dense, à extraire | Moyen |

### 1.3 Zones critiques non couvertes par l'audit (observations internes)

| Zone | Observation | Impact |
|------|-------------|--------|
| **Testing strategy** | Aucune mention de stratégie de test | DX majeur, adoption |
| **Error boundaries** | Erreur de rendu → cascade ? | Robustesse production |
| **Collection patterns** | `ProjectionList.reconcile()` non spécifié | Cas d'usage #1 |
| **Forms** | Pattern ultra-courant, non documenté | Crédibilité framework |
| **HMR / SSR / Interop** | Non adressés | Adoption moderne |

### 1.4 Questions architecturales en suspens

| Question | Contexte |
|----------|----------|
| View stateless → projections fréquentes ? | Performance UI hautement interactives |
| Granularité Feature | Explosion du nombre de Features ? |
| Channel backpressure | Throttle/debounce framework ou applicatif ? |
| Entity mutations imbriquées | `cart.items[0].quantity++` → diff précis ? |
| Behavior générique vs View-aware | Modèle MarionetteJS contraignant ? |
| Dépendances inter-Features au bootstrap | Ordre ? Deadlock ? |
| Async cascade dans handlers | Queue ? Race conditions ? |

---

## 2. ADRs à produire

Les ADRs (Architecture Decision Records) capturent les décisions ponctuelles avec contexte, options et choix final.

### Structure cible

```
docs/adr/
├── ADR-0001-entity-diff-notification-strategy.md
├── ADR-0002-error-propagation-strategy.md
├── ADR-0003-channel-runtime-semantics.md
├── ADR-0004-validation-modes.md
├── ADR-0005-meta-lifecycle.md
├── ADR-0006-testing-strategy.md
├── ADR-0007-behavior-contract.md
├── ADR-0008-collection-patterns.md
├── ADR-0009-forms-pattern.md
├── ADR-0010-bootstrap-order.md
├── ADR-0011-event-sourcing-support.md
├── ADR-0012-virtualized-list.md
├── ADR-0013-view-code-reuse.md
└── README.md
```

### Détail des ADRs

#### ADR-0001 : Entity diff/notification strategy 🔴 P1

| Champ | Valeur |
|-------|--------|
| **Problème** | Comment détecter et notifier les changements dans une Entity ? |
| **Options** | Proxy ES6, Immer patches, Snapshot + deep diff, Dirty flags manuels |
| **Enjeux** | Performance (mémoire, CPU), Granularité du diff, Ergonomie debug |
| **RFC liée** | RFC-0002-entity |
| **Risque si non résolu** | Perf catastrophique ou API inutilisable |

#### ADR-0002 : Error propagation strategy 🔴 P1

| Champ | Valeur |
|-------|--------|
| **Problème** | Que se passe-t-il quand un handler throw ? Un render échoue ? |
| **Questions** | Handler command throw → Event émis ? Request reject → propagation ? View crash → isolation ? |
| **Options** | Fail-fast, Error boundaries, Silent logging, Retry policies |
| **RFC liée** | RFC-0002-feature, RFC-0002-api |
| **Risque si non résolu** | Bugs silencieux ou crashes en cascade |

#### ADR-0003 : Channel runtime semantics 🔴 P1

| Champ | Valeur |
|-------|--------|
| **Problème** | Comportements runtime non spécifiés |
| **Questions** | No handler → erreur ou silent ? No replier → reject ou timeout ? Teardown → quand/comment ? Ordre garanti ? |
| **Options** | Strict (erreurs partout), Lenient (warnings), Configurable |
| **RFC liée** | RFC-0002-channel |
| **Risque si non résolu** | Comportements imprévisibles, fuites mémoire |

#### ADR-0004 : Validation modes 🟡 P2

| Champ | Valeur |
|-------|--------|
| **Problème** | Quelles validations en debug vs strict vs production ? |
| **Questions** | Invariants vérifiés quand ? Coût runtime acceptable ? Stripping en prod ? |
| **Options** | Compile-time only, Runtime always, Mode-dependent |
| **RFC liée** | RFC-0002-api |

#### ADR-0005 : Meta lifecycle 🟡 P2

| Champ | Valeur |
|-------|--------|
| **Problème** | Création, propagation, contexte async des metas |
| **Questions** | Qui crée le correlationId ? Propagation dans les Promises ? Contexte perdu en async ? |
| **Options** | AsyncLocalStorage, Explicit passing, Zone.js-like |
| **RFC liée** | RFC-0001 §10, RFC-0002-api |

#### ADR-0006 : Testing strategy 🔴 P1

| Champ | Valeur |
|-------|--------|
| **Problème** | Comment tester chaque type de composant ? |
| **Questions** | Feature isolée ? View sans DOM réel ? Channel mock ? Composer ? |
| **Livrables** | Helpers de test, fixtures, patterns recommandés |
| **Impact** | DX, adoption, confiance |

#### ADR-0007 : Behavior contract 🟡 P2

| Champ | Valeur |
|-------|--------|
| **Problème** | Périmètre exact du Behavior (Q7 non résolu) |
| **Questions** | Niveau DOM (N1/N2) ? Capacités Channel propres ? Scope (rootElement, @ui) ? |
| **Modèle** | MarionetteJS — générique, branchable sur any View |
| **RFC liée** | RFC-0001-glossaire Q7 |

#### ADR-0008 : Collection patterns 🟡 P2

| Champ | Valeur |
|-------|--------|
| **Problème** | Listes = cas d'usage #1, peu documenté |
| **Questions** | ProjectionList.reconcile() ? Keying strategy ? Slot multiplication ? |
| **RFC liée** | RFC-0002-api §9.4, D24 |

#### ADR-0009 : Forms pattern 🟢 P3

| Champ | Valeur |
|-------|--------|
| **Problème** | Forms ultra-courant, pas de pattern officiel |
| **Questions** | Validation dans Entity ou Feature ? Dirty state ? Submit flow ? |
| **Livrable** | Pattern documenté + exemple |

#### ADR-0010 : Bootstrap order & dependencies 🟢 P3

| Champ | Valeur |
|-------|--------|
| **Problème** | Feature A dépend du state de Feature B au init |
| **Questions** | Ordre de bootstrap ? Dépendances déclarées ? Deadlock detection ? |
| **RFC liée** | RFC-0001 §5.1 (bootstrap sequence) |

---

## 3. Sections RFC à renforcer

### RFC-0001 Architecture Fondamentale

| Section | Action |
|---------|--------|
| Toutes | Transformer formulations descriptives en **DOIT / NE DOIT PAS / PEUT** |
| §3 Principes | Ajouter "Ce que Bonsai optimise / n'optimise pas" |
| §5 Composants | Clarifier rôle exact Foundation au runtime |
| Annexe | Ajouter glossaire des cas limites (slider, modale, animation) |

### RFC-0002 API et Contrats

| Section | Action |
|---------|--------|
| §? Errors | Ajouter matrice "si handler X échoue → comportement Y" |
| §? Bootstrap | Spécifier ordre, dépendances inter-Features |
| §9.4 PDR | Envisager extraction vers RFC-0003 |
| §? Validation | Formaliser modes debug/strict/prod |

### RFC-0002 Feature

| Section | Action |
|---------|--------|
| Handlers | Spécifier handlers fantômes, orphelins, dupliqués |
| Errors | Matrice erreurs (throw, reject, silent) |
| Examples | Ajouter exemples multi-Features chorégraphie |

### RFC-0002 Entity

| Section | Action |
|---------|--------|
| Performance | Définir budgets ou cibles qualitatives |
| Heuristics | Qu'est-ce qui va dans Entity vs Feature ? |
| Deep mutations | Spécifier comportement `cart.items[0].quantity++` |

### RFC-0002 Channel

| Section | Action |
|---------|--------|
| Runtime | No handler, no replier, teardown, ordre |
| Errors | Propagation, timeout, retry |

---

## 4. Nouveaux documents à créer

### 4.1 RFCs

| Document | Contenu | Priorité | Statut |
|----------|---------|----------|--------|
| **RFC-0003 Rendu Avancé** | PDR, compilateur Pug, ProjectionList, VirtualizedList, View subscription | P2 | ✅ Fait |
| **RFC-0004 DevTools** | Event Ledger, format metas visualisation, graphe causal | P3 | ⏳ À faire |

### 4.2 Guides

| Document | Contenu | Priorité |
|----------|---------|----------|
| **TESTING.md** | Stratégie par composant, mocks Channel, fixtures, exemples | P1 |
| **PATTERNS.md** | Forms, collections, modales, routing avancé, cas limites | P2 |
| **MIGRATION.md** | Intégration dans app existante, cohabitation React/Vue | P3 |

### 4.3 ADR infrastructure

| Document | Contenu |
|----------|---------|
| **docs/adr/README.md** | Index des ADRs, template, processus de décision |
| **docs/adr/TEMPLATE.md** | Template ADR standard |

---

## 5. Questions architecturales ouvertes

Questions qui nécessitent réflexion et potentiellement un ADR dédié.

### 5.1 Performance & Scale

| Question | Contexte | Piste |
|----------|----------|-------|
| **Projections fréquentes** | View stateless → chaque micro-interaction passe par le cycle complet ? | Batching ? Microtask queue ? |
| **Granularité Feature** | 1 Feature par composant UI stateful → explosion ? | Patterns de regroupement ? |
| **Channel backpressure** | 1000 events/sec → listeners suivent ? | Throttle framework ? |
| **Entity mutations profondes** | Diff précis ou dirty flag global ? | Voir ADR-0001 |

### 5.2 DX & Tooling

| Question | Contexte | Piste |
|----------|----------|-------|
| **HMR** | Hot reload des Features/Views | State preservation ? |
| **SSR** | Hydration, rootElement SSR vs SPA | RFC dédiée ? |
| **TypeScript namespace pattern** | Validé contre bundlers réels ? | Test early |

### 5.3 Cas limites

| Question | Contexte | Piste |
|----------|----------|-------|
| **Composer error** | `resolve()` throw ou View inexistante | Error boundary ? Fallback ? |
| **Request vs Listen** | "Items du cart" → lequel utiliser ? | Heuristiques documentées |
| **Async cascade** | Event pendant await d'un handler | Queue FIFO ? |

---

## 6. Backlog priorisé

### 🔴 P1 — Bloquants pour implémentation v1

| ID | Item | Type | Effort estimé | Statut |
|----|------|------|---------------|--------|
| P1-01 | ADR-0001 Entity diff strategy | ADR | M | ✅ Accepted |
| P1-02 | ADR-0002 Error propagation | ADR | M | ✅ Accepted |
| P1-03 | ADR-0003 Channel runtime semantics | ADR | S | ✅ Accepted |
| P1-04 | ADR-0006 Testing strategy | ADR | L | ✅ Accepted |
| P1-05 | TESTING.md | Guide | L | ⏳ À faire |
| P1-06 | Matrice erreurs handlers (RFC-0002-feature) | RFC update | S | ⏳ À faire |
| P1-07 | Prérequis TypeScript dans RFC-0001 | RFC update | S | ✅ Fait |

### 🟡 P2 — Nécessaires pour v1 complète

| ID | Item | Type | Effort estimé | Statut |
|----|------|------|---------------|--------|
| P2-01 | ADR-0004 Validation modes | ADR | S | ✅ Accepted |
| P2-02 | ADR-0005 Meta lifecycle | ADR | M | ✅ Accepted |
| P2-03 | ADR-0007 Behavior contract | ADR | M | ✅ Accepted |
| P2-04 | ADR-0008 Collection patterns | ADR | M | ✅ Rédigé |
| P2-05 | RFC-0003 Rendu Avancé | RFC | L | ✅ Fait |
| P2-06 | PATTERNS.md | Guide | L | ⏳ À faire |
| P2-08 | ADR-0012 Virtualized List | ADR | S | ✅ Accepted |
| P2-09 | ADR-0013 View Code Reuse | ADR | M | ✅ Rédigé |
| P2-07 | Normativité RFC-0001 (DOIT/PEUT) | RFC update | M | ⏳ À faire |

### 🟢 P3 — Améliorations post-v1

| ID | Item | Type | Effort estimé | Statut |
|----|------|------|---------------|--------|
| P3-01 | ADR-0009 Forms pattern | ADR | S | ✅ Rédigé |
| P3-02 | ADR-0010 Bootstrap order | ADR | S | ✅ Rédigé |
| P3-03 | RFC-0004 DevTools | RFC | L | ⏳ À faire |
| P3-04 | MIGRATION.md | Guide | M | ⏳ À faire |
| P3-05 | Cas limites (slider, modale, animation) | Doc | M | ⏳ À faire |
| P3-06 | Positionnement explicite Bonsai | RFC-0001 update | S | ⏳ À faire |

### Légende effort

- **S** (Small) : < 1 jour
- **M** (Medium) : 1-3 jours
- **L** (Large) : > 3 jours

---

## Annexe A : Template ADR

```markdown
# ADR-XXXX : [Titre de la décision]

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟡 Proposed / 🟢 Accepted / ⚪ Superseded |
| **Date** | YYYY-MM-DD |
| **Décideurs** | @auteur |
| **RFC liée** | RFC-XXXX |

## Contexte

[Quel problème devons-nous résoudre ? Pourquoi maintenant ?]

## Contraintes

[Contraintes techniques, architecturales, ou organisationnelles]

## Options considérées

### Option A — [Nom]

**Description** : [...]

| Avantages | Inconvénients |
|-----------|---------------|
| ... | ... |

### Option B — [Nom]

**Description** : [...]

| Avantages | Inconvénients |
|-----------|---------------|
| ... | ... |

## Décision

Nous choisissons **Option X** parce que :

1. [Raison 1]
2. [Raison 2]
3. [Raison 3]

## Conséquences

### Positives

- [...]

### Négatives (acceptées)

- [...]

### Actions de suivi

- [ ] [Action 1]
- [ ] [Action 2]

## Références

- [Lien 1]
- [Lien 2]
```

---

## Annexe B : Processus de décision ADR

```
1. PROPOSED   → ADR rédigé, options documentées
2. REVIEW     → Discussion, ajustements
3. ACCEPTED   → Décision prise, ADR figé
4. SUPERSEDED → Remplacé par un autre ADR (lien vers successeur)
```

**Règle** : Un ADR ACCEPTED ne se modifie plus. Si la décision change, on crée un nouvel ADR qui SUPERSEDES l'ancien.

---

## Prochaines étapes immédiates

### ✅ Complété (2026-03-18)

1. ✅ Créer ce document (ROADMAP-CONSOLIDATION.md)
2. ✅ Créer `docs/adr/README.md` avec template
3. ✅ Rédiger tous les ADRs P1 :
   - ✅ ADR-0001 Entity diff strategy
   - ✅ ADR-0002 Error propagation strategy
   - ✅ ADR-0003 Channel runtime semantics
   - ✅ ADR-0006 Testing strategy
4. ✅ Rédiger tous les ADRs P2 :
   - ✅ ADR-0004 Validation modes
   - ✅ ADR-0005 Meta lifecycle
   - ✅ ADR-0007 Behavior contract
   - ✅ ADR-0008 Collection patterns
5. ✅ Rédiger tous les ADRs P3 :
   - ✅ ADR-0009 Forms pattern
   - ✅ ADR-0010 Bootstrap order
6. ✅ ADR bonus :
   - ✅ ADR-0011 Event Sourcing support

### ⏳ À faire

1. ⏳ Créer TESTING.md (structure initiale)
2. ⏳ Passer les ADRs de Proposed → Accepted après review
3. ✅ RFC-0003 Rendu Avancé (créé 2026-03-19)
4. ⏳ Créer PATTERNS.md
5. ⏳ Renforcer normativité RFC-0001 (DOIT/PEUT)
6. ✅ ADR-0012 Virtualized List (créé 2026-03-19)
7. ✅ ADR-0013 View Code Reuse (renuméroté depuis ADR-0011)

---

## Résumé des ADRs

| Priorité | ADRs | Statut |
|----------|------|--------|
| **P1** | 0001, 0002, 0003, 0006 | ✅ 4/4 rédigés (🟡 Proposed) |
| **P2** | 0004, 0005, 0007, 0008, 0012, 0013 | ✅ 6/6 rédigés |
| **P3** | 0009, 0010 | ✅ 2/2 rédigés (🟡 Proposed) |
| **Bonus** | 0011 (Event Sourcing) | ✅ Rédigé (🟡 Proposed) |

**Total : 13 ADRs rédigés**, prêts pour review et passage en Accepted.

---

*Document vivant — mis à jour au fil des décisions prises.*

*Dernière mise à jour : 2026-03-19*
