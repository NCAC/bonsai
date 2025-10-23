# ADR-0028 : Stratégie de phasage d'implémentation — Kernel-first en 3 strates

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-08 |
| **Décideurs** | @ncac |
| **RFC liées** | Toutes — ce document coupe transversalement l'ensemble du corpus |
| **Déclencheur** | Revue architecturale 2026-04-08 — 3 hotspots de complexité runtime identifiés |

---

## Contexte

### Le problème

Le corpus Bonsai spécifie **quoi** implémenter et **pourquoi**, mais pas **dans quel ordre**. Les 27 ADR et les RFC détaillent chaque composant avec exhaustivité, y compris des mécaniques sophistiquées (ré-entrance Entity FIFO, dual N1/N2-N3 localState, diff d'attachement Composer N-instances). Aucun document ne formalise l'ordre d'implémentation.

Or l'ordre impacte directement le **risque** :

- **Hotspot A — Entity + notifications** : 7 mécaniques interdépendantes dans un seul composant (`mutate()`, Immer patches, `changedKeys`, per-key handlers, catch-all handler, ré-entrance FIFO, metas). Implémenter tout d'un bloc accumule de la dette de comportement invisible.
- **Hotspot B — localState dual N1/N2-N3** (ADR-0015) : deux chemins de réactivité à temporalité différente (callbacks synchrones N1, re-projection microtask N2/N3). Cas pathologiques non-trivaux : ré-entrance, double effet N1+N2, detach entre callback et microtask.
- **Hotspot C — Composer + diff d'attachement** (ADR-0020, ADR-0027) : machine à 5 états, diff N-instances par rootElement+viewClass, cascade de destruction récursive, couplage avec PDR et SSR.

Le corpus contient déjà 66 marqueurs de périmètre (✅ Contrat v1, 🔵 Extension, ⏳ Post-v1, 🚫 Hors scope) répartis dans les RFC et ADR. Mais ces marqueurs sont **locaux** à chaque document — il n'existe pas de vue transversale définissant l'ordre de construction.

### Pourquoi un ADR et pas un simple document technique

L'ordre d'implémentation est une **décision architecturale** : il définit quels contrats intermédiaires sont testables, quels couplages sont exposés en premier, et quelles simplifications temporaires sont acceptées. C'est irréversible au sens où un mauvais ordre produit des abstractions compensatoires qu'il faut ensuite démolir.

---

## Contraintes

| # | Contrainte | Source |
|---|-----------|--------|
| C1 | Chaque strate DOIT produire un **round-trip testable E2E** — pas de strate « infrastructure seule » | Principe Bonsai : Compile-time > Runtime |
| C2 | Les strates DOIVENT respecter les marqueurs de périmètre existants (✅ Contrat v1, ⏳ Post-v1) | Corpus normatif |
| C3 | Chaque strate DOIT être **incrémentale** — la strate N+1 étend la strate N sans casser ses contrats | Stabilité API |
| C4 | Le framework DOIT être **utilisable** (démo, test, feedback) dès la strate 0 — pas d'attente jusqu'à la strate 2 | DX |
| C5 | L'ordre DOIT isoler les hotspots identifiés pour permettre un test ciblé avant intégration | Maîtrise du risque |
| C6 | L'ordre DOIT permettre le **parallélisme de développement** entre composants indépendants | Efficacité |

---

## Options considérées

### Option A — Big bang : tout le contrat v1 en une passe

**Description** : implémenter l'ensemble du scope v1 (les 10 composants, tous les ADR Accepted) en un seul lot, sans phasage intermédiaire.

| Avantages | Inconvénients |
|-----------|---------------|
| + Pas de contrats intermédiaires à maintenir | - Aucun feedback avant la fin du développement |
| + Pas de simplifications temporaires | - Hotspots A/B/C exposés simultanément — bugs d'interaction invisibles |
| | - Impossible de tester un round-trip tant que tout n'est pas prêt |
| | - Aucun parallélisme possible — tout dépend de tout |
| | - Viole C1, C4, C5 |

---

### Option B — Phasage par couche (abstraite → concrète)

**Description** : implémenter d'abord la couche abstraite complète (Radio, Channel, Entity, Feature, Application), puis la couche concrète complète (Foundation, Composer, View, Behavior).

| Avantages | Inconvénients |
|-----------|---------------|
| + Séparation nette entre les deux couches | - La couche abstraite seule n'a pas de round-trip E2E visible (pas de DOM) |
| + Respect du flux unidirectionnel conceptuel | - L'Entity complète (avec ré-entrance) est dans la première phase — pas d'isolation du hotspot A |
| | - Le localState et le Composer N-instances sont dans la même phase — pas d'isolation des hotspots B/C |
| | - Viole C1 (pas de round-trip testable en phase 1), partiellement C5 |

---

### Option C — Phasage par strates de profondeur (kernel-first)

**Description** : découper l'implémentation en 3 strates de **profondeur croissante**, chacune produisant un round-trip E2E testable. Chaque strate ajoute de la sophistication aux composants existants plutôt que de nouveaux composants.

| Avantages | Inconvénients |
|-----------|---------------|
| + Round-trip E2E dès la strate 0 | - Contrats intermédiaires à maintenir (simplifications temporaires) |
| + Hotspots isolés dans des strates distinctes | - Le développeur doit savoir « à quelle strate on est » |
| + Chaque strate est testable indépendamment | - Certains ADR sont « coupés » entre deux strates |
| + Feedback utilisable dès la strate 0 | |
| + Parallélisme possible entre composants d'une même strate | |
| + Aligné sur les marqueurs ✅/🔵/⏳ existants | |

---

## Analyse comparative

| Critère | Option A (big bang) | Option B (par couche) | Option C (kernel-first) |
|---------|--------------------|-----------------------|-------------------------|
| Round-trip E2E précoce (C1) | ❌ | ❌ | ⭐⭐⭐ |
| Isolation des hotspots (C5) | ❌ | ⭐ | ⭐⭐⭐ |
| Feedback utilisable tôt (C4) | ❌ | ⭐ | ⭐⭐⭐ |
| Parallélisme (C6) | ❌ | ⭐⭐ | ⭐⭐⭐ |
| Incrémentalité (C3) | ❌ | ⭐⭐ | ⭐⭐⭐ |
| Simplicité de gestion | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Respect des marqueurs (C2) | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## Décision

🟢 **Option C retenue** — Phasage kernel-first en 3 strates de profondeur croissante.

### Justification

1. **C1 satisfait** : chaque strate a un critère de validation E2E explicite — un `trigger()` qui traverse le framework de bout en bout
2. **C5 satisfait** : chaque hotspot identifié est isolé dans une strate dédiée, testable avant intégration avec les strates suivantes
3. **C4 satisfait** : la strate 0 produit un framework fonctionnel minimal utilisable pour une démo ou un prototype
4. Le découpage par strates de profondeur est **aligné avec le corpus** — les marqueurs ✅ Contrat v1 couvrent la strate 0+1, les 🔵 Extensions la strate 2, les ⏳ Post-v1 sont explicitement hors strates

### Rejet des autres options

- **Option A** rejetée : « tout d'un coup » est incompatible avec les 3 hotspots identifiés. Aucune visibilité sur les bugs d'interaction avant la fin.
- **Option B** rejetée : le découpage par couche ne résout pas le problème — l'Entity complète avec ré-entrance est dans la première phase, et la couche abstraite seule ne permet pas de test E2E visible.

---

## Spécification des strates

### Strate 0 — Kernel minimal

> **Objectif** : le plus petit ensemble de code qui produit un **round-trip complet** —
> un `trigger()` de View qui arrive dans un `handle()` de Feature, mute une Entity,
> émet un Event, et re-projette une View dans le DOM.

#### Périmètre

| Composant | Inclus | Exclus (reporté en strate 1 ou 2) |
|-----------|--------|-----------------------------------|
| **Radio** | Singleton, registres des 3 lanes (command handlers, event listeners, request repliers) | — |
| **Channel** | `trigger()` → handler 1:1, `emit()` → listeners 1:N, `request()` → replier sync `T \| null` (ADR-0023). Détection `trigger()` sans handler en mode dev (I10). | Pas de metas causales (hop fixe à 0, correlationId stub). Pas de `noHandler` configurable. Pas d'anti-boucle I9 (une seule profondeur en strate 0). |
| **Entity** | `mutate(intent, params?, recipe)` via Immer `produce()` (pas `produceWithPatches`). Dérivation de `changedKeys` par comparaison shallow avant/après. Notification catch-all `onAnyEntityUpdated(event)` uniquement. Détection no-op (aucune notification si state inchangé). `initialState` getter (D17). | Pas de per-key handlers `on${Key}EntityUpdated`. Pas de ré-entrance FIFO. Pas de `patches`/`inversePatches` exposés. Pas d'`eventLog`. Pas de `toJSON()`/`fromJSON()`. |
| **Feature** | Les 5 capacités : `handle` (C2), `emit` (C1), `listen` (C3), `reply` (C4), `request` (C5). Auto-découverte des handlers (D12). `onInit()` appelé au bootstrap. | Pas de metas propagées (stub `TMessageMetas`). Pas de lifecycle `onDestroy()` (ajouté en strate 1 avec `stop()`). |
| **View** | `trigger()`, `getUI(key)` → `TProjectionNode` (N1 : `text()`, `attr()`, `toggleClass()`, `visible()`, `style()`). Handlers UI auto-dérivés depuis `TUIMap` (D48). `onAttach()` hook. `get params()` manifeste value-first (ADR-0024). | Pas de templates N2/N3. Pas de localState. Pas de Behaviors. Pas de Composers déclarés. Pas de `onDetach()` (ajouté en strate 1). |
| **Application** | `register(FeatureClass)`. `start()` en 4 phases simplifiées : channels → entities → features → views. | Pas de `stop()`. Pas de SSR (`serverState`). Pas de DevTools. Pas de `BonsaiRegistry` ESM. Pas de `TBootstrapOptions`. |
| **Foundation** | Instance unique, `rootElement = document.body`. Déclare les Composers racines. | Pas d'event delegation globale (ajouté strate 1). Pas de TUIMap (ADR-0018 🟠 Suspended). |
| **Composer** | `resolve(event \| null)` — cas simple (0/1 View, retour `TResolveResult \| null`). Machine à états minimal : `idle → active → idle`. `rootElement` string-only (ADR-0026). Création d'élément DOM si absent (D30). | Pas de retour tableau `TResolveResult[]`. Pas de diff N-instances. Pas de cascade de destruction (un seul niveau de Composer). |

#### Simplifications temporaires acceptées

| Simplification | Justification | Contrat strate 0 | Contrat final (strate 1+) |
|----------------|---------------|-------------------|---------------------------|
| `changedKeys` par comparaison shallow (pas Immer patches) | `produceWithPatches` est nécessaire pour les per-key handlers et l'Event Sourcing — inutile tant qu'on n'a que le catch-all | `changedKeys: string[]` | Identique (dérivé des patches Immer) |
| Metas stub (`{ id: ulid(), correlationId: '', causationId: '', hop: 0, ... }`) | La traçabilité causale n'est utile que quand les chaînes de réactions existent réellement | `TMessageMetas` (type complet, valeurs stub) | `TMessageMetas` (valeurs réelles) |
| Un seul niveau de Composer (pas de récursion) | La cascade de destruction est le hotspot C — l'isoler dans la strate 1 | Foundation → Composer → View (pas de View → Composer enfant) | Foundation → Composer → View → Composer → View (récursion) |

#### Critère de validation E2E — Strate 0

```
Test "CartView → addItem round-trip" :

1. Application.register(CartFeature)
2. Application.start()
3. CartView est montée dans le DOM (via Foundation → MainComposer → CartView)
4. Simuler click sur @ui.addButton
   → D48 auto-derive → CartView.onAddButtonClick()
   → CartView.trigger(cart:addItem, { productId: '123', qty: 1 })
5. CartFeature.onAddItemCommand() est appelé
   → this.entity.mutate('cart:addItem', draft => { draft.items.push(...) })
   → onAnyEntityUpdated() est appelé (changedKeys = ['items', 'total'])
   → this.emit('itemAdded', { item })
6. CartView écoute cart:itemAdded (listen)
   → handler met à jour la projection N1 : this.getUI('itemCount').text(String(count))
7. Assertion DOM : le compteur d'items est mis à jour
```

---

### Strate 1 — Enrichissement Entity + rendu + composition

> **Objectif** : amener l'Entity, les metas, le rendu PDR et la composition
> à leur niveau de contrat v1 complet. Isoler et tester les hotspots A et C.

#### Périmètre

| Composant | Ajout par rapport à la strate 0 | Hotspot ciblé |
|-----------|-------------------------------|---------------|
| **Entity** | Migration vers `produceWithPatches()`. Per-key handlers `on${Key}EntityUpdated(prev, next, patches)`. Détection no-op par patches vides. `TEntityEvent` complet avec `patches`, `inversePatches`, `timestamp`. | **Hotspot A — phase 1** |
| **Entity** | Ré-entrance FIFO : mutation pendant un cycle de notification → file d'attente, `maxEntityNotificationDepth` (défaut : 3). | **Hotspot A — phase 2** (isolé et testable unitairement) |
| **Entity** | `toJSON()`, `fromJSON()`, `eventLog` (🔵 Extension optionnelle). | Contrat v1 complet |
| **Metas** | `TMessageMetas` complet : `correlationId` créé au point d'entrée UI, `causationId` chaîné, `hop` incrémenté, `origin` (kind + namespace). Propagation explicite ADR-0016 : `emit(name, payload, { metas })`, `request(channel, name, params, { metas })`, `mutate(intent, { payload, metas }, recipe)`. | — |
| **Channel** | Anti-boucle I9 (`hop > maxHops` → rejet). `noHandler` configurable par mode (dev: throw, prod: warn). Isolation des erreurs entre listeners (ADR-0002). | — |
| **View** | Templates N2/N3 : pipeline selector → `project()`. `get templates()` manifeste. Event `any` (re-projection globale). `onDetach()` hook. Déclaration de Composers enfants via `get composers()`. | — |
| **Composer** | Retour tableau `TResolveResult[]` — diff N-instances (ADR-0020 SS6.3). Cascade de destruction récursive (§5 composer.md). Machine à états complète : `idle → resolving → active → detaching → destroyed`. Détection disparition de slot post-projection. | **Hotspot C** |
| **Foundation** | Event delegation globale sur `<html>` / `<body>`. Capacités Channel complètes (listen, trigger, request). | — |
| **Application** | `stop()` — shutdown en ordre inverse. 6 phases complètes (ADR-0010). `BootstrapError` localisé par phase. | — |
| **Validation** | `TEntitySchema<T>` via Valibot (ADR-0022). Validation modale : `__DEV__` au `mutate()`, silencieuse en prod. | — |
| **Erreurs** | Taxonomie `BonsaiError` (ADR-0002). `ErrorReporter` transversal. Ring buffer. | — |

#### Ordre interne de la strate 1

La strate 1 n'est pas monolithique. L'ordre interne recommandé isole les hotspots :

```
Strate 1a — Entity enrichie (Hotspot A)
  ├── produceWithPatches() + per-key handlers
  ├── Tests unitaires : ordre alphabétique, no-op, types
  ├── Ré-entrance FIFO + maxEntityNotificationDepth
  └── Tests unitaires : mutation dans handler, profondeur max, FIFO

Strate 1b — Metas + Channel enrichi
  ├── TMessageMetas complet + propagation ADR-0016
  ├── Anti-boucle I9
  ├── ADR-0002 isolation erreurs
  └── Tests : chaîne causale sur 3+ hops, erreur isolée

Strate 1c — Rendu PDR complet
  ├── Templates N2/N3 + pipeline selector + project()
  ├── Event `any` → re-projection
  └── Tests : template réactif, selector filtrant, any event

Strate 1d — Composition complète (Hotspot C)
  ├── Composer N-instances + diff
  ├── View → get composers() → Composer enfant (récursion)
  ├── Cascade de destruction
  └── Tests : slot qui disparaît, N→M instances, re-resolve
```

> **Parallélisme** : les strates 1a et 1b sont indépendantes entre elles.
> La strate 1c dépend de 1b (metas dans les Events). La strate 1d dépend de 1c (projection dans le Composer).

#### Critère de validation E2E — Strate 1

```
Test "Multi-feature chorégraphie avec metas traçables" :

1. CartFeature + PricingFeature + InventoryFeature enregistrées
2. CartView déclenche trigger(cart:addItem)
3. CartFeature.onAddItemCommand() :
   → entity.mutate() → onItemsEntityUpdated() (per-key) + onAnyEntityUpdated()
   → emit('itemAdded', { item }, { metas })
4. PricingFeature.onCartItemAddedEvent() (listen cross-domain) :
   → entity.mutate('pricing:recalculate') → emit('totalRecalculated', { total }, { metas })
5. CartView reçoit pricing:totalRecalculated → template N2 re-projeté
6. Assertions :
   - correlationId identique sur les 3 messages
   - hop = 0 (command), 1 (cartEvent), 2 (pricingEvent)
   - per-key handler 'items' appelé mais pas 'lastUpdated' (pas changé)
   - Template N2 mis à jour avec le bon total

Test "Composer N-instances + cascade" :

1. ProductListView avec get composers() déclarant un Composer par produit
2. Composer.resolve() retourne [ProductView, ProductView, ProductView]
3. Retirer un produit de l'Entity → re-projection → slot disparaît
4. Assertion : le Composer détecte la disparition, détache la ProductView orpheline
```

---

### Strate 2 — Extensions sophistiquées

> **Objectif** : ajouter les mécaniques qui dépendent d'un pipeline PDR et
> d'une composition déjà stables. Cibler le hotspot B (localState).

#### Périmètre

| Composant | Ajout | Hotspot ciblé | Dépendance strate 1 |
|-----------|-------|---------------|---------------------|
| **localState** | `updateLocal(recipe)`, `get local`, `get localState()`. Dual N1/N2-N3 : callbacks synchrones `onLocal${Key}Updated(TLocalUpdate<T>)` + re-projection microtask via `data.local`. Namespace `local` réservé (I57). Nettoyage au `onDetach()`. | **Hotspot B** | Pipeline PDR (strate 1c) doit être stable pour que le chemin N2/N3 soit testable |
| **Behavior** | Classe `Behavior<TChannels, TUI>`. Clés ui propres (I43 — pas de collision avec la View). Handlers auto-dérivés D48. Capacités Channel propres (trigger, listen, request — jamais emit, D7). localState propre (D37, mêmes 5 contraintes I42). | — | localState (strate 2), View complète (strate 1) |
| **SSR hydration** | `populateFromServer(state)` sur Entity (ADR-0014 H5). `TBootstrapOptions.serverState`. Détection mode SSR/SPA par nœud (H1). `setup()` vs `create()` (H2). | — | Entity complète (strate 1a), Composer (strate 1d) |
| **DevTools** | `TBonsaiDevTools` : `onMessage()`, `onEntityMutation()`, `getSnapshot()`, `restoreSnapshot()`, `getChannelRegistry()`, `getCausalChain()`, `onError()`, `getErrors()`, `clearLog()`. Event Ledger. `enableDevTools` dans `TApplicationConfig`. | — | Metas complètes (strate 1b), Entity complète (strate 1a), ErrorReporter (strate 1) |
| **Mode ESM** | `BonsaiRegistry` singleton (ADR-0019). `registerFeature()`, `registerView()` au top-level. `collect()` → snapshot immuable. Verrouillage post-collect. | — | Application.register() (strate 0) |
| **FormBehavior** | Behavior spécialisé formulaires (ADR-0009). Validation via `TEntitySchema` (ADR-0022). Dirty tracking. Interaction champs DOM. | — | Behavior (strate 2), Validation Valibot (strate 1) |

#### Ordre interne de la strate 2

```
Strate 2a — localState (Hotspot B)
  ├── updateLocal() + Immer produce
  ├── Callbacks N1 synchrones (onLocal${Key}Updated)
  ├── Re-projection N2/N3 via microtask
  ├── Tests critiques :
  │   ├── Callback N1 qui fait updateLocal() → ré-entrance
  │   ├── Même clé en N1 callback ET template N2 → pas de double effet
  │   ├── detach() entre callback N1 (sync) et microtask N2 → pas d'état mort
  │   └── updateLocal() dans un handler listen + Event any simultané → cohérence
  └── Nettoyage au onDetach(), réinitialisation au re-attach

Strate 2b — Behavior
  ├── Classe Behavior + TUIMap propre
  ├── Vérification I43 (pas de collision clés ui)
  ├── localState Behavior (même API)
  └── Tests : Behavior aveugle (pas de this.view), D7 (pas d'emit)

Strate 2c — SSR + DevTools + ESM (parallélisables)
  ├── SSR : populateFromServer(), serverState, mode détection
  ├── DevTools : hooks, Event Ledger, snapshot/restore
  └── ESM : BonsaiRegistry, collect(), verrouillage
```

#### Critère de validation E2E — Strate 2

```
Test "localState dual N1/N2-N3 avec Behavior" :

1. WizardView avec localState { currentStep: number, errors: string[] }
2. Click "Next" → updateLocal(draft => { draft.currentStep += 1 })
3. Callback N1 onLocalCurrentStepUpdated() → attr('data-step', '2') (synchrone)
4. Template N2 re-projeté en microtask → contenu de l'étape mis à jour
5. TrackingBehavior attaché → reçoit click → trigger(analytics:track)
6. Assertions :
   - N1 callback exécuté AVANT la microtask N2
   - Template N2 reflète le nouvel état
   - Behavior aveugle — pas d'accès this.view
   - detach() de la View nettoie le localState (this.local inaccessible)
```

---

## Matrice de dépendances inter-composants

```
Strate 0                    Strate 1                         Strate 2
────────                    ────────                         ────────

Radio ──────────────────────────────────────────────────────────────────
  │
Channel (basic) ──→ Channel (metas+I9+errors) ─────────────────────────
  │                    │
Entity (produce,  ──→ Entity (produceWithPatches, ──→ DevTools (hooks,
 catch-all)           per-key, FIFO, eventLog)        snapshot, ledger)
  │                    │
Feature (5 caps) ──→ Feature (metas propag., ───────→ SSR (serverState,
                      onDestroy)                      populateFromServer)
  │                    │
View (N1 only,   ──→ View (N2/N3, templates, ──────→ localState
 getUI, trigger)      onDetach, composers)            (N1 sync + N2/N3
  │                    │                               microtask)
Foundation       ──→ Foundation (delegation,  ──────→     │
 (minimal)            Channel complet)                    ↓
  │                    │                              Behavior
Composer         ──→ Composer (N-instances,           (TUIMap propre,
 (0/1 View)           diff, cascade)                  localState, D48)
                       │                                  │
                       │                                  ↓
                       │                              FormBehavior
                       │                              (ADR-0009, Valibot)
                       │
                       └──→ Validation (Valibot, ADR-0022)
                       └──→ Erreurs (BonsaiError, ADR-0002)
                                                      ESM (BonsaiRegistry,
                                                       ADR-0019)
```

---

## Correspondance avec les marqueurs de périmètre existants

| Marqueur corpus | Strate |
|-----------------|--------|
| ✅ Contrat v1 (Entity §1–6, §7 sérialisation) | Strate 0 (mutate, catch-all) + Strate 1 (per-key, toJSON) |
| ✅ Contrat v1 (DevTools scope v1) | Strate 2 |
| ✅ Contrat v1 (Router API minimale) | Strate 1 (une Feature comme les autres) |
| ✅ Contrat v1 (SSR hydratation) | Strate 2 |
| 🔵 Extension optionnelle v1 (`eventLog`) | Strate 1 (disponible, non requis) |
| ⏳ Post-v1 (`undo()`, `_history`, Event Sourcing L2–L3) | Hors strates (post-v1) |
| ⏳ Post-v1 (Time-travel, UI DevTools, Profiling) | Hors strates (post-v1) |
| 🟠 Suspended (ADR-0011 Event Sourcing) | Hors strates (post-v1) |
| 🟠 Suspended (ADR-0018 Foundation TUIMap globale) | Hors strates (évaluer post-strate 2) |
| 🟡 Proposed (ADR-0021 monde ouvert, extension points) | Hors strates (v2+) |
| 🚫 Hors scope v1 (rendu serveur Node, streaming, transactions distribuées) | Hors strates |

---

## Conséquences

### Positives

- ✅ **Feedback dès la strate 0** : un prototype fonctionnel avec trigger/handle/mutate/emit/projectionN1 est possible en quelques jours
- ✅ **Hotspots isolés** : ré-entrance Entity (strate 1a), Composer N-instances (strate 1d), localState dual (strate 2a) sont chacun testables séparément
- ✅ **Parallélisme** : au sein de chaque strate, les sous-lots indépendants (1a//1b, 2c parallélisable) peuvent avancer en parallèle
- ✅ **Incrémentalité** : chaque strate étend la précédente sans casser — les contrats intermédiaires sont des sous-ensembles du contrat final
- ✅ **Alignement corpus** : les marqueurs de périmètre existants (✅/🔵/⏳) sont respectés sans exception

### Négatives (acceptées)

- ⚠️ **Simplification Entity strate 0** : `produce()` au lieu de `produceWithPatches()` puis migration en strate 1. Accepté : le contrat public (`changedKeys: string[]`) est identique — seule l'implémentation interne change
- ⚠️ **Metas stub en strate 0** : les `TMessageMetas` existent dans le type mais les valeurs sont des stubs. Accepté : aucun composant de la strate 0 ne dépend des metas réelles — et le type est correct dès le départ
- ⚠️ **Un seul niveau de Composer en strate 0** : Foundation → Composer → View sans récursion. Accepté : couvre 80% des cas d'usage (page avec des panels). La récursion arrive en strate 1d

### Risques identifiés

- 🔶 **Migration produce → produceWithPatches** : le passage en strate 1 change l'implémentation interne de `mutate()`. Mitigation : le contrat public est identique, les tests E2E de strate 0 doivent passer sans modification
- 🔶 **Contrats intermédiaires dans la doc** : les marqueurs ⏳/✅ existants ne distinguent pas strate 0/1/2. Mitigation : ce document EST la source de vérité pour le phasage — les marqueurs existants indiquent v1 vs post-v1, ce document détaille l'ordre au sein de v1
- 🔶 **localState en strate 2 retarde le FormBehavior** : ADR-0009 (Forms) dépend du localState. Mitigation : le FormBehavior est un pattern applicatif, pas un composant kernel — le retarder ne bloque pas le développement de Features métier

---

## Actions de suivi

- [ ] Créer les suites de tests E2E pour le critère de validation de chaque strate
- [ ] Commencer l'implémentation de la strate 0 (kernel minimal)
- [ ] Marquer dans les RFC les composants qui sont « strate 0 simplifié » vs « strate 1 complet » (optionnel — ce document suffit comme référence)
- [ ] Réviser ce phasage après la strate 0 si des dépendances imprévues émergent

---

## Références

- [Entity — contrat et notifications](../rfc/3-couche-abstraite/entity.md) — Hotspot A
- [ADR-0001 — Entity mutation strategy](ADR-0001-entity-diff-notification-strategy.md) — Immer, patches
- [ADR-0015 — localState mechanism](ADR-0015-local-state-mechanism.md) — Hotspot B, dual N1/N2-N3
- [ADR-0020 — Composer N-instances](ADR-0020-composers-n-instances-composition-heterogene.md) — Hotspot C
- [ADR-0027 — Composer resolve(event)](ADR-0027-composer-resolve-event-argument.md) — Hotspot C
- [ADR-0010 — Bootstrap order](ADR-0010-bootstrap-order.md) — 6 phases séquentielles
- [ADR-0016 — Metas handler signature](ADR-0016-metas-handler-signature.md) — Propagation explicite
- [ADR-0023 — request/reply sync](ADR-0023-request-reply-sync-vs-async.md) — Request Lane synchrone
- [ADR-0002 — Error propagation](ADR-0002-error-propagation-strategy.md) — Taxonomie erreurs
- [ADR-0022 — Entity schema validation](ADR-0022-entity-schema-validation.md) — Valibot
- [ADR-0014 — SSR hydration](ADR-0014-ssr-hydration-strategy.md) — serverState
- [ADR-0019 — Mode ESM](ADR-0019-mode-esm-modulaire.md) — BonsaiRegistry
- [RFC-0004 — DevTools](../rfc/devtools.md) — Instrumentation, scope v1

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-08 | Création (Proposed) — issue de la revue architecturale identifiant 3 hotspots de complexité runtime |
| 2026-04-08 | 🟢 **Accepted** — Option C (kernel-first, 3 strates). Matrice de dépendances, critères de validation E2E, correspondance avec les 66 marqueurs de périmètre existants |
