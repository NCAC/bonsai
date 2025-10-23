# ADR-0029 : Périmètre gelé v1 — Ce qui entre, ce qui attend

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-08 |
| **Décideurs** | @ncac |
| **RFC liées** | Toutes |
| **ADR liées** | ADR-0028 (phasage), ADR-0012 (VirtualizedList), ADR-0021 (monde ouvert) |
| **Déclencheur** | Revue architecturale 2026-04-08 — besoin de durcir la frontière v1 / post-v1 |

---

## Contexte

### Le problème

Le corpus Bonsai comprend 22 ADR Accepted, 3 Superseded, 2 Suspended et 1 Proposed. Les RFC contiennent 66+ marqueurs de périmètre (✅ Contrat v1, 🔵 Extension, ⏳ Post-v1, 🚫 Hors scope). L'ADR-0028 définit l'**ordre** d'implémentation en 3 strates.

Mais **aucun document ne dit explicitement** : « cette ADR Accepted est hors du périmètre v1 ». Un développeur qui lit ADR-0012 (VirtualizedList, 🟢 Accepted) peut légitimement penser qu'il faut l'implémenter pour v1. C'est faux — mais rien ne le dit formellement.

La richesse documentaire de Bonsai est un atout pour la conception. C'est un risque pour l'implémentation si elle pousse à coder « le framework tel qu'imaginé à terme » au lieu du kernel v1 nécessaire et suffisant.

### Pourquoi un ADR

La décision de **geler** un périmètre est un arbitrage architectural : elle définit quels contrats Accepted sont implémentés en v1 et lesquels sont **reportés malgré leur statut Accepted**. C'est irréversible au sens où un scope trop large produit un v1 qui ne sort jamais, et un scope trop étroit produit un v1 inutile.

### Distinction Accepted vs v1

Un ADR Accepted signifie : **la décision architecturale est prise** — si/quand on implémente cette mécanique, on le fera de cette façon. Cela ne signifie PAS que cette mécanique doit être dans v1.

---

## Contraintes

| # | Contrainte | Source |
|---|-----------|--------|
| C1 | Le périmètre v1 DOIT produire un framework **utilisable** pour une application métier réelle (pas un prototype académique) | Viabilité |
| C2 | Le périmètre v1 DOIT couvrir les strates 0 et 1 d'ADR-0028 **au minimum** | ADR-0028 |
| C3 | Le périmètre v1 NE DOIT PAS inclure de mécaniques dont aucune Feature métier ne dépend | Pragmatisme |
| C4 | Le périmètre gelé est **non-négociable** : aucun ajout post-gel sans un nouvel ADR qui amende celui-ci | Discipline |
| C5 | Les ADR Accepted reportées hors v1 restent Accepted — leur contrat reste valide pour une implémentation future | Stabilité décisionnelle |

---

## Options considérées

### Option A — v1 = tout ce qui est Accepted

**Description** : implémenter tous les ADR Accepted dans v1, y compris ADR-0012 (VirtualizedList), ADR-0009 (FormBehavior complet), ADR-0019 (ESM BonsaiRegistry), ADR-0014 (SSR complet).

| Avantages | Inconvénients |
|-----------|---------------|
| + Aucune ambiguïté — Accepted = implémenté | - Périmètre trop large : 22 ADR, dont des mécaniques sophistiquées non nécessaires au kernel |
| + Pas de gestion « v1 vs v1.x » | - VirtualizedList et FormBehavior sont des patterns applicatifs, pas du kernel |
| | - Risque élevé de v1 qui ne sort jamais |
| | - Viole C3 |

### Option B — v1 = strates 0+1 uniquement (kernel strict)

**Description** : limiter v1 aux strates 0 et 1 d'ADR-0028. Exclure toute la strate 2 (localState, Behavior, SSR, DevTools, ESM).

| Avantages | Inconvénients |
|-----------|---------------|
| + Périmètre très serré, livrable rapide | - Pas de Behavior → pas de réutilisation de logique UI (D34-D38 inapplicables) |
| + Hotspot B (localState) totalement exclu | - Pas de SSR → en contradiction avec le postulat PDR (DOM préexiste) |
| | - Pas de DevTools → pas d'observabilité, debug artisanal |
| | - Application métier réelle difficile sans localState ni Behavior |
| | - Viole C1 |

### Option C — v1 = strates 0+1+2 d'ADR-0028, avec exclusions explicites

**Description** : le périmètre v1 couvre les 3 strates d'ADR-0028 mais **exclut explicitement** les mécaniques Accepted qui ne sont pas nécessaires au kernel. Chaque exclusion est justifiée.

| Avantages | Inconvénients |
|-----------|---------------|
| + Framework complet : Entity, Channel, Feature, View, Composer, Behavior, localState, SSR, DevTools | - Strate 2 reste ambitieuse (hotspot B) |
| + Exclusions chirurgicales et justifiées | - Certains ADR Accepted ne sont pas dans v1 → peut surprendre |
| + Chaque exclusion est réversible sans impact architectural | - Gestion « v1 vs v1.x » nécessaire |
| + Aligné avec C1 (framework utilisable) et C3 (pas de superflu) | |

---

## Analyse comparative

| Critère | Option A (tout Accepted) | Option B (strates 0+1) | Option C (strates 0+1+2 avec exclusions) |
|---------|------------------------|----------------------|----------------------------------------|
| Livrable dans un délai raisonnable | ❌ | ⭐⭐⭐ | ⭐⭐ |
| Application métier réelle possible | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| Pas de superflu (C3) | ❌ | ⭐⭐⭐ | ⭐⭐⭐ |
| Framework utilisable (C1) | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| Discipline de périmètre (C4) | ❌ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## Décision

🟢 **Option C retenue** — v1 = strates 0+1+2 d'ADR-0028, avec exclusions explicites.

---

## Périmètre gelé v1 — Liste exhaustive

### 🟩 IN — Implémenté en v1

> **Règle** : tout ce qui est listé ici DOIT être implémenté et testé pour que v1 soit considéré comme livré.

#### Strate 0 — Kernel minimal

| Composant | ADR source | Description |
|-----------|-----------|-------------|
| Radio singleton | — | Registres des 3 lanes |
| Channel basic | ADR-0003, ADR-0023 | trigger() 1:1, emit() 1:N, request() sync T\|null |
| Entity basic | ADR-0001 | mutate() + Immer produce, catch-all, no-op, initialState |
| Feature | ADR-0024 | 5 capacités, auto-découverte handlers, onInit() |
| View basic | ADR-0024, ADR-0017 | trigger(), getUI() N1, handlers D48, onAttach(), params manifeste |
| Application basic | ADR-0010 | register(), start() 4 phases |
| Foundation minimal | — | rootElement = document.body, Composers racines |
| Composer basic | ADR-0025, ADR-0026, ADR-0027 | resolve(event), 0/1 View, rootElement string CSS |

#### Strate 1 — Enrichissement

| Composant | ADR source | Description |
|-----------|-----------|-------------|
| Entity full | ADR-0001 | produceWithPatches, per-key handlers, ré-entrance FIFO, toJSON/fromJSON, eventLog (opt-in) |
| Metas complet | ADR-0005, ADR-0016 | correlationId, causationId, hop, origin — propagation explicite |
| Channel enrichi | ADR-0003, ADR-0002 | Anti-boucle I9, isolation erreurs listeners, noHandler configurable |
| View templates | ADR-0017 | N2/N3, pipeline selector → project(), event `any`, onDetach() |
| Composer N-instances | ADR-0020, ADR-0027 | Retour tableau, diff rootElement+viewClass, cascade destruction, 5 états |
| Foundation complète | — | Event delegation globale, capacités Channel |
| Application complète | ADR-0010 | stop(), 6 phases, BootstrapError par phase |
| Validation Entity | ADR-0022 | TEntitySchema via Valibot, validation modale (__DEV__/prod) |
| Erreurs | ADR-0002 | Taxonomie BonsaiError, ErrorReporter, ring buffer |
| Validation modes | ADR-0004 | dev/prod/strict |

#### Strate 2 — Extensions

| Composant | ADR source | Description |
|-----------|-----------|-------------|
| localState | ADR-0015 | updateLocal(), dual N1/N2-N3, nettoyage onDetach() |
| Behavior | ADR-0015 | Classe Behavior, TUIMap propre (I43), localState propre (D37), D48 |
| SSR hydration | ADR-0014 | populateFromServer(), serverState, détection mode SSR/SPA |
| DevTools v1 | — | onMessage, onEntityMutation, getSnapshot/restoreSnapshot, Event Ledger, enableDevTools |

#### Transversal

| Item | ADR source | Description |
|------|-----------|-------------|
| Phasage d'implémentation | ADR-0028 | Ordre strate 0 → 1 → 2 |
| Périmètre gelé | ADR-0029 | Ce document |

---

### 🟥 OUT — Explicitement exclu de v1

> **Règle** : tout ce qui est listé ici NE DOIT PAS être implémenté en v1.
> Les ADR Accepted concernées restent Accepted — leur contrat est valide pour une implémentation future.
> Un ajout au périmètre v1 nécessite un nouvel ADR qui amende ADR-0029.

#### ADR Accepted reportées

| ADR | Titre | Raison de l'exclusion | Impact de l'exclusion |
|-----|-------|----------------------|----------------------|
| **ADR-0012** | VirtualizedList | Pattern applicatif, pas du kernel. L'API est explicitement séparée de `ProjectionList` (D40). Aucune Feature métier standard ne dépend de listes virtualisées. Absent des 3 strates ADR-0028. | **Nul** — `ProjectionList` couvre les listes normales. Les listes de 10 000+ items sont un besoin edge-case. |
| **ADR-0009** | FormBehavior complet | Pattern applicatif construit sur Behavior + localState + Valibot. ADR-0028 le qualifie de « pattern applicatif, pas un composant kernel ». | **Faible** — les formulaires fonctionnent via Behavior brut + localState + validation manuelle. Le pattern FormBehavior est du sucre d'abstraction. |
| **ADR-0019** | Mode ESM BonsaiRegistry | Mécanisme de distribution, pas de runtime. `Application.register()` (strate 0) couvre le cas monolithique. BonsaiRegistry est nécessaire uniquement pour les projets multi-modules/lazy-loading. | **Faible** — les applications monolithiques fonctionnent sans. Report en v1.1 ou v1.2 quand le besoin multi-modules se matérialise. |
| **ADR-0006** | Testing strategy (helpers publics) | Stratégie de test — définit des helpers publics (`createTestFeature()`, `mockChannel()`), pas un composant runtime. Le framework est testable sans helpers dédiés (Jest/Vitest standard). | **Moyen sur la DX** — les développeurs écrivent des helpers ad hoc. Mais le runtime n'est pas impacté. |

#### Features post-v1 (pas d'ADR Accepted correspondante)

| Feature | Source documentaire | Raison de l'exclusion |
|---------|-------------------|----------------------|
| Time-travel (undo/redo via inversePatches) | Entity RFC §8, DevTools RFC ⏳ | Nécessite un Event Store durable — mécanique v2 |
| Extension navigateur DevTools | DevTools RFC ⏳ | UI complexe, non nécessaire — console.log + Event Ledger suffisent en v1 |
| Profiling (temps d'exécution par handler) | DevTools RFC ⏳ | Optimisation prématurée — le framework n'a pas encore de vrais utilisateurs |
| Replay de session | DevTools RFC ⏳ | Dépend du time-travel et de l'Event Store |
| Visualisation graphe interactif | DevTools RFC ⏳ | UI complexe, valeur incertaine en v1 |
| Event Sourcing niveaux 2-3 (Event Store, projections, replay) | ADR-0011 🟠 Suspended | Architecturalement préparé (patches, TEntityEvent, metas) mais implémentation post-v1 |
| Foundation TUIMap globale | ADR-0018 🟠 Suspended | Foundation v1 est minimale (rootElement, Composers racines) |
| Monde ouvert / ContributionRegistry | ADR-0021 🟡 Proposed | Pas encore décidé — v2+ |
| Rendu serveur Node.js (SSR côté serveur) | RFC ⏳ 🚫 | v1 SSR = hydration côté client uniquement (populateFromServer) |
| Streaming SSR | RFC 🚫 | Hors scope |
| Transactions distribuées | RFC 🚫 | Hors scope |
| Micro-apps / multi-Application | RFC 🚫 | Hors scope |

---

## Matrice de traçabilité ADR → v1

> Référence rapide : pour chaque ADR existante, son statut v1.

| ADR | Statut ADR | Statut v1 | Strate ADR-0028 |
|-----|-----------|-----------|-----------------|
| 0001 | 🟢 Accepted | 🟩 **IN** | 0 + 1 |
| 0002 | 🟢 Accepted | 🟩 **IN** | 1 |
| 0003 | 🟢 Accepted | 🟩 **IN** | 0 + 1 |
| 0004 | 🟢 Accepted | 🟩 **IN** | 1 |
| 0005 | 🟢 Accepted | 🟩 **IN** | 0 + 1 |
| 0006 | 🟢 Accepted | 🟥 **OUT** | — |
| 0007 | ⚪ Superseded | — | — |
| 0008 | ⚪ Superseded | — | — |
| 0009 | 🟢 Accepted | 🟥 **OUT** | (2) |
| 0010 | 🟢 Accepted | 🟩 **IN** | 0 + 1 |
| 0011 | 🟠 Suspended | 🟥 **OUT** | — |
| 0012 | 🟢 Accepted | 🟥 **OUT** | — |
| 0013 | ⚪ Superseded | — | — |
| 0014 | 🟢 Accepted | 🟩 **IN** | 2 |
| 0015 | 🟢 Accepted | 🟩 **IN** | 2 |
| 0016 | 🟢 Accepted | 🟩 **IN** | 1 |
| 0017 | 🟢 Accepted | 🟩 **IN** | 0 + 1 |
| 0018 | 🟠 Suspended | 🟥 **OUT** | — |
| 0019 | 🟢 Accepted | 🟥 **OUT** | — |
| 0020 | 🟢 Accepted | 🟩 **IN** | 1 |
| 0021 | 🟡 Proposed | 🟥 **OUT** | — |
| 0022 | 🟢 Accepted | 🟩 **IN** | 1 |
| 0023 | 🟢 Accepted | 🟩 **IN** | 0 |
| 0024 | 🟢 Accepted | 🟩 **IN** | 0 |
| 0025 | 🟢 Accepted | 🟩 **IN** | 0 |
| 0026 | 🟢 Accepted | 🟩 **IN** | 0 |
| 0027 | 🟢 Accepted | 🟩 **IN** | 1 |
| 0028 | 🟢 Accepted | 🟩 **IN** | (meta) |
| 0029 | 🟢 Accepted | 🟩 **IN** | (meta) |

**Comptage** : 16 Accepted IN, 4 Accepted OUT, 2 Suspended OUT, 1 Proposed OUT, 3 Superseded.

---

## Conséquences

### Positives

- ✅ **Frontière non-ambiguë** : chaque ADR a un statut v1 explicite (IN ou OUT). Pas d'interprétation possible.
- ✅ **Périmètre réaliste** : 16 ADR Accepted couvrent Entity, Channel, Feature, View, Composer, Behavior, localState, SSR hydration, DevTools v1, Validation — c'est un framework complet.
- ✅ **Les exclusions sont réversibles** : les 4 ADR Accepted exclues (0006, 0009, 0012, 0019) restent Accepted. Leur implémentation en v1.1/v1.2 ne nécessite aucune re-décision architecturale.
- ✅ **Discipline de gel** : la contrainte C4 interdit tout ajout sans un nouvel ADR — pas de scope creep informel.

### Négatives (acceptées)

- ⚠️ **VirtualizedList reportée** : les cas d'usage avec 10 000+ items ne sont pas couverts en v1. Accepté : `ProjectionList` standard couvre les cas normaux.
- ⚠️ **FormBehavior reporté** : les développeurs doivent construire manuellement le pattern formulaire en v1. Accepté : Behavior + localState + Valibot donnent tous les outils nécessaires.
- ⚠️ **Pas de helpers de test publics** (ADR-0006) : chaque projet écrit ses propres helpers. Accepté : c'est la norme dans les frameworks récents en v1. Les helpers publics viendront avec le retour utilisateur.
- ⚠️ **Pas de BonsaiRegistry ESM** : les projets multi-modules avec lazy-loading doivent utiliser `Application.register()` manuellement. Accepté : couvre 90% des cas.

### Risques

- 🔶 **SSR en strate 2 mais IN** : l'hydration SSR est dans la dernière strate mais dans le périmètre v1. Si la strate 2 prend du retard, SSR pourrait retarder la sortie. Mitigation : le mode SPA fonctionne indépendamment. Au pire, v1 sort sans SSR et on l'ajoute en v1.1 (l'architecture le permet — `populateFromServer()` est un add-on).
- 🔶 **Perception de régression** : un lecteur qui a lu ADR-0012 pourrait être déçu de ne pas trouver VirtualizedList en v1. Mitigation : ce document est explicite et justifie chaque exclusion.

---

## Actions de suivi

- [ ] Communiquer ce périmètre gelé à toute personne contribuant à l'implémentation
- [ ] Lors de l'implémentation de chaque strate, vérifier la conformité avec les listes IN/OUT
- [ ] Après la livraison de la strate 2, évaluer quelles ADR OUT intègrent v1.1

---

## Références

- [ADR-0028 — Stratégie de phasage](ADR-0028-implementation-phasing-strategy.md) — Ordre d'implémentation
- [ADR-0012 — VirtualizedList](ADR-0012-virtualized-list.md) — Reportée (OUT)
- [ADR-0009 — FormBehavior](ADR-0009-forms-pattern.md) — Reportée (OUT)
- [ADR-0019 — Mode ESM](ADR-0019-mode-esm-modulaire.md) — Reportée (OUT)
- [ADR-0006 — Testing strategy](ADR-0006-testing-strategy.md) — Reportée (OUT)
- [ADR-0011 — Event Sourcing](ADR-0011-event-sourcing-support.md) — Suspended (OUT)
- [ADR-0018 — Foundation contract](ADR-0018-foundation-contract.md) — Suspended (OUT)
- [ADR-0021 — Monde ouvert](ADR-0021-composition-monde-ouvert-plateforme.md) — Proposed (OUT)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-08 | Création — périmètre gelé v1 : 16 ADR IN, 4 Accepted OUT, 2 Suspended OUT, 1 Proposed OUT |
| 2026-04-08 | 🟢 **Accepted** — Option C (strates 0+1+2 avec exclusions chirurgicales) |
