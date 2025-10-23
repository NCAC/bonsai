# Entity

> **Structure de données encapsulée : TEntityStructure, mutations, query, notifications**

[← Retour à la couche abstraite](README.md) · [Feature](feature.md) · [Application](application.md)

---

| Champ             | Valeur                                           |
|-------------------|--------------------------------------------------|
| **Chapitre**      | 3 — Couche abstraite                             |
| **Composant**     | Entity                                           |
| **Couche**        | Abstraite (persistante)                          |
| **Statut**        | 🟢 Stable                                        |
| **Mis à jour**    | 2026-04-01                                       |
| **ADRs liées**    | [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md), [ADR-0005](../adr/ADR-0005-meta-lifecycle.md), [ADR-0014](../adr/ADR-0014-ssr-hydration-strategy.md) |

> ### Statut normatif
> Ce document fait foi pour le **contrat Entity** : TEntityStructure, `mutate()`, notifications, sérialisation.
> Le modèle de mutation retenu est `mutate(intent, params?, recipe)` (ADR-0001 Accepted).
>
> **Périmètre par version** :
> | Périmètre | Statut |
> |-----------|--------|
> | §1–6 : TEntityStructure, `mutate()`, query, notifications | ✅ **Contrat v1** |
> | §7 : Sérialisation (`toJSON`, `fromJSON`) | ✅ **Contrat v1** |
> | §7 : `eventLog` (historique des mutations) | 🔵 **Extension optionnelle v1** — présent mais non requis |
> | §4 implémentation : `undo()`, `_history` | ⏳ **Post-v1** — illustratif seulement |
> | §8 : Event Sourcing (niveaux 2–3) | ⏳ **Post-v1** — voir ADR-0011 |

---

## 📋 Table des matières

1. [Type `TEntityStructure` et classe abstraite Entity](#1-type-tentitystructure-et-classe-abstraite-entity)
2. [Contrainte jsonifiable](#2-contrainte-jsonifiable)
3. [Stockage de l'état](#3-stockage-de-létat)
4. [API de mutation : `mutate(intent, params?, recipe)`](#4-api-de-mutation--mutateintent-params-recipe)
5. [Méthodes de requête (query)](#5-méthodes-de-requête-query)
6. [Notifications Entity → Feature](#6-notifications-entity--feature)
7. [Sérialisation et snapshot](#7-sérialisation-et-snapshot)
8. [Event Sourcing Compatibility](#8-event-sourcing-compatibility)

---

## 1. Type `TEntityStructure` et classe abstraite Entity

### Type `TEntityStructure`

`TEntityStructure` est le type qui décrit la **structure de données** d'une Entity.
C'est un plain object jsonifiable (D10) qui formalise la forme du state
géré par la Feature.

```typescript
/**
 * TEntityStructure — type décrivant la structure de données d'une Entity.
 *
 * Contraint à TJsonSerializable (D10).
 * Définit la « forme » du state : quelles propriétés, quels types.
 *
 * Convention : dans les génériques des classes, abrégé en TStructure
 * pour la lisibilité (Feature<TStructure, TChannel>).
 */
type TEntityStructure = TJsonSerializable;
```

> **Convention de nommage** : `TEntityStructure` est le nom formel du concept.
> Dans les signatures de classes (`Entity<TStructure>`, `Feature<TStructure, TChannel>`),
> le générique est abrégé en `TStructure` pour la concision. Les deux désignent
> le même contrat.

### Exemple concret

```typescript
export namespace Cart {
  /**
   * Cart.State — TEntityStructure concrète du panier.
   *
   * Plain object jsonifiable : pas de Date, pas de Map,
   * pas de méthodes, pas de cycles.
   */
  export type State = TEntityStructure & {
    items: Array<{ productId: string; qty: number }>;
    total: number;
    lastUpdated: number; // timestamp, pas Date
  };
}
```

### Classe abstraite Entity

```typescript
/**
 * Entity — structure de données encapsulée, typée et observable.
 *
 * L'Entity est le dépôt exclusif du state d'une Feature (I6, I22).
 * Elle est paramétrée par TStructure (alias de TEntityStructure)
 * contraint à TJsonSerializable (D10).
 *
 * L'Entity a deux catégories de méthodes :
 * - Méthodes de mutation : modifient this.state, déclenchent une notification
 * - Méthodes de requête (query) : lisent this.state, retournent des données dérivées
 *
 * L'Entity n'a JAMAIS accès aux Channels, ne peut jamais emit/trigger/listen.
 * Sa seule relation est avec sa Feature propriétaire (1:1:1, I22).
 */
abstract class Entity<TStructure extends TJsonSerializable> {
  // ── Stockage de l'état ──

  /**
   * Le state courant — seule source de vérité.
   *
   * Protégé : accessible uniquement par l'Entity elle-même
   * et ses sous-classes. Jamais exposé directement à l'extérieur.
   * Typé par TStructure et contraint à TJsonSerializable (D10).
   */
  protected state: TStructure;

  /**
   * État initial — getter abstrait obligatoire (D17).
   *
   * Chaque Entity concrète DOIT définir ce getter pour fournir
   * les valeurs de départ. Dans la majorité des cas, ce sont
   * des valeurs « zéro » (null, [], 0, false, '') reflétant
   * l'absence de toute commande reçue.
   *
   * Le getter (et non une propriété) est nécessaire car les
   * initialiseurs de propriétés de la classe fille s'exécutent
   * APRÈS super() — un getter sur le prototype est accessible
   * dès le constructeur de la classe abstraite.
   */
  protected abstract get initialState(): TStructure;

  /**
   * Constructeur — assigne automatiquement this.state depuis initialState.
   *
   * Appelé par la Feature propriétaire dans son constructeur (D17).
   * Le développeur n'appelle jamais ce constructeur directement.
   */
  constructor() {
    this.state = this.initialState;
  }

  // ── Méthodes de mutation (à définir par la sous-classe) ──
  // Voir §4 — méthodes nommées qui modifient this.state
  // et déclenchent une notification Entity → Feature.

  // ── Méthodes de requête (query) (à définir par la sous-classe) ──
  // Voir §5 — méthodes de lecture qui servent les request handlers.

  // ── Sérialisation ──

  /** Retourne une copie profonde du state courant (lecture seule) */
  toJSON(): TStructure;

  /** Restaure le state depuis un snapshot */
  fromJSON(snapshot: TStructure): void;

  // ── Pré-peuplement SSR (ADR-0014 H5) ──

  /**
   * Pré-peuple l'Entity avec un state sérialisé côté serveur.
   *
   * Appelé **uniquement par le framework** pendant la phase 3 (`'entities'`)
   * du bootstrap, si `TBootstrapOptions.serverState` contient une entrée
   * pour le namespace de cette Feature.
   *
   * **Différences avec `fromJSON()`** :
   * - `populateFromServer()` est **silencieux** : aucun Event émis,
   *   aucune notification Entity → Feature, aucun `any` Channel.
   * - Appelé **avant** `onAttach()` des Features (phase 4) et donc
   *   avant toute View (phase 5).
   * - Conçu pour le scénario SSR où le DOM contient déjà les données
   *   rendues — le state doit correspondre sans déclencher de re-rendu.
   *
   * `fromJSON()` en revanche est un mécanisme de restauration généraliste
   * (snapshot, undo/redo, DevTools) qui **peut** déclencher des notifications.
   *
   * @param state — le state sérialisé, typé `TStructure`
   * @internal — framework only, jamais appelé par le développeur
   *
   * @see ADR-0014 H5 (serverState est le SEUL mécanisme d'état sérialisé)
   * @see RFC-0002 §7.1 TBootstrapOptions
   */
  populateFromServer(state: TStructure): void;
}
```

> **Invariants respectés** : I6 (seule la Feature modifie via les méthodes de mutation),
> I22 (1:1:1 namespace ↔ Feature ↔ Entity), I46 (TStructure jsonifiable).

---

## 2. Contrainte jsonifiable

> **Décision D10** : `TStructure` est **jsonifiable obligatoire**.
> Pas de classes imbriquées, pas de fonctions, pas de cycles, pas de `undefined`.

```typescript
/**
 * Contrainte de type : valeurs sérialisables en JSON.
 * Permet : string, number, boolean, null, arrays, plain objects.
 * Interdit : classes, fonctions, undefined, symbols, Date, Map, Set, cycles.
 */
type TJsonSerializable =
  | string
  | number
  | boolean
  | null
  | TJsonSerializable[]
  | { [key: string]: TJsonSerializable };
```

<!--
  Avantages de la contrainte jsonifiable :
  - Snapshot trivial (JSON.stringify)
  - Persistance (localStorage, sessionStorage, serveur)
  - Time-travel / undo-redo dans les DevTools (RFC-0004)
  - Sérialisation pour les Web Workers
  - Deep equality par JSON comparison (pour le diff)
  - Pas de surprises (pas de méthodes cachées, pas de prototypes)
  
  La contrainte porte sur TStructure (le state), pas sur l'Entity
  elle-même. L'Entity peut avoir des méthodes (mutation, query) —
  c'est le *state* qui est jsonifiable, pas la *classe*.
-->

---

## 3. Stockage de l'état

L'Entity stocke son état dans une propriété unique `protected state: TStructure`.

### Principes de stockage

| Aspect | Règle |
|--------|-------|
| **Source unique** | `this.state` est la seule source de vérité du state de la Feature |
| **Protégé** | `protected` — accessible par l'Entity et ses sous-classes, jamais de l'extérieur |
| **Initialisé** | Via `abstract get initialState()` (D17) — assigné dans le constructeur de la base class. Pas de state `undefined` possible |
| **Jsonifiable** | Toujours un plain object conforme à `TJsonSerializable` (D10) |
| **Immutable de l'extérieur** | Seules les méthodes de mutation de l'Entity peuvent modifier `this.state` |

### Accès au state depuis la Feature

La Feature interagit avec son Entity de deux manières :

- **Lecture** : via les **méthodes query** de l'Entity (jamais d'accès direct à `this.entity.state`)
- **Écriture** : via **`this.entity.mutate()`** exclusivement (ADR-0001)

```typescript
// ✅ Bonsai — query via méthode Entity, mutation via mutate()
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  onItemsRequest(params: void, metas: TMessageMetas): CartItem[] | null {
    return this.entity.getItems(); // méthode query ✅
  }

  onAddItemCommand(payload: { productId: string; qty: number }, metas: TMessageMetas): void {
    this.entity.mutate(                              // mutation via mutate() ✅
      'cart:addItem',
      { payload, metas },
      draft => {
        draft.items.push({ productId: payload.productId, qty: payload.qty });
        draft.total += payload.qty;
      }
    );
    this.emit('itemAdded', payload, { metas });
  }
}

// ❌ Anti-pattern — accès direct au state
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  onItemsRequest(): CartItem[] | null {
    return this.entity.state.items; // NON — state protégé
  }
}
```

> **Règle** : la Feature passe toujours par les méthodes de l'Entity.
> Les méthodes **query** (lecture) encapsulent la logique de données.
> Les **mutations** passent exclusivement par `mutate()` (ADR-0001).
> L'Entity encapsule les détails de stockage et peut évoluer
> (indexation, cache interne, dérivations) sans impacter la Feature.

<!--
  Implémentation interne (framework) :
  
  Le framework pourrait utiliser un BehaviorSubject<TStructure> (rxjs)
  en interne pour stocker le state et notifier les changements.
  Mais c'est un détail d'implémentation — le contrat est :
  - this.state est un TStructure
  - les méthodes de mutation modifient this.state
  - les méthodes query lisent this.state
  - les notifications sont émises automatiquement
  
  Options de stockage interne :
  - Plain object (this.state = { ... }) — simple, performant
  - Immer-like avec patches — pour le diff granulaire (RFC-0003)
  - structuredClone avant mutation — pour l'historique (RFC-0004)
  
  La RFC-0002 ne contraint pas l'implémentation du stockage.
-->

---

## 4. API de mutation : `mutate(intent, params?, recipe)`

> **Décision ADR-0001** : l'Entity expose une **méthode unique `mutate()`**
> qui utilise le pattern Immer pour les mutations et capture l'intention métier.
> Le premier argument est le **discriminant** (intent), suivi d'un objet params optionnel.
> Voir [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) pour le détail des alternatives évaluées.

### Signature

```typescript
abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * Mutate state via Immer draft.
   * 
   * @param intent - Intention métier (discriminant, ex: "cart:addItem")
   * @param params - Payload et metas pour traçabilité (optionnel)
   * @param recipe - Fonction de mutation sur le draft
   * @returns TEntityEvent avec patches pour Event Sourcing
   */
  mutate(
    intent: string,
    params: TMutationParams | null,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent;
  
  // Overload sans params
  mutate(
    intent: string,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent;
}

/**
 * Paramètres de mutation — payload et metas pour traçabilité.
 * Les metas sont propagées explicitement par le développeur depuis
 * le handler (ADR-0005, ADR-0016). Le framework les utilise pour
 * la traçabilité causale dans l'historique et les DevTools.
 */
type TMutationParams = {
  /** Payload associé (optionnel) */
  payload?: unknown;
  /** Metas causales propagées depuis le handler (ADR-0016, I54) */
  metas?: TMessageMetas;
}

/**
 * TEntityEvent — voir §6 pour la définition canonique unique.
 * Source of truth : §6 Notifications Entity → Feature.
 */
```

### Usage canonique

```typescript
class CartEntity extends Entity<Cart.State> {
  protected get initialState(): Cart.State {
    return { items: [], total: 0, lastUpdated: 0 };
  }

  // Pas de méthodes de mutation individuelles.
  // Toute mutation passe par mutate() depuis la Feature.
}

// Dans la Feature
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  onAddItemCommand({ productId, qty }: AddItemPayload, metas: TMessageMetas): void {
    this.entity.mutate(
      "cart:addItem",
      { payload: { productId, qty }, metas },
      draft => {
        draft.items.push({ productId, qty });
        draft.total += qty;
        draft.lastUpdated = Date.now();
      }
    );
  }

  onRemoveItemCommand({ productId }: { productId: string }, metas: TMessageMetas): void {
    this.entity.mutate(
      "cart:removeItem",
      { payload: { productId }, metas },
      draft => {
        const index = draft.items.findIndex(i => i.productId === productId);
        if (index >= 0) {
          draft.total -= draft.items[index].qty;
          draft.items.splice(index, 1);
          draft.lastUpdated = Date.now();
        }
      }
    );
  }

  onClearCartCommand(payload: void, metas: TMessageMetas): void {
    // Forme simplifiée sans params
    this.entity.mutate("cart:clear", draft => {
      draft.items = [];
      draft.total = 0;
      draft.lastUpdated = Date.now();
    });
  }
}
```

### Pourquoi Immer ?

| Critère | Sans Immer | Avec Immer |
|---------|-----------|------------|
| **Mutations profondes** | Spread hell `{ ...state, items: [...] }` | `draft.items.push(item)` |
| **Patches automatiques** | Implémentation manuelle complexe | Natif |
| **Structural sharing** | Manuel et error-prone | Automatique |
| **Undo/redo** | Snapshots complets (mémoire) | inversePatches (compact) |
| **Maturité** | — | 5+ ans, 25k+ stars, Redux Toolkit |

> **Coût accepté** : Immer ajoute ~12KB gzip. La valeur (patches, undo, ergonomie)
> justifie ce coût. Voir ADR-0001 §Pourquoi Immer.

### Implémentation interne

> ⚠️ **Note de périmètre** : l'implémentation ci-dessous montre la mécanique complète
> incluant `_history`, `undo()` et `inversePatches`. Ces éléments sont **illustratifs**
> de la direction post-v1 (time-travel, undo/redo). Le **contrat v1** se limite à
> `mutate()` + notifications + `changedKeys`. Les membres `_history` et `undo()`
> ne font pas partie du contrat public v1.

```typescript
import { produceWithPatches, enablePatches, Patch, Draft } from 'immer';

enablePatches();

abstract class Entity<TStructure extends TJsonSerializable> {
  private _state: TStructure;
  private _history: TEntityEvent[] = [];
  
  // Overload signatures
  mutate(
    intent: string,
    params: TMutationParams | null,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent;
  mutate(
    intent: string,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent;
  
  // Implementation
  mutate(
    intent: string,
    paramsOrRecipe: TMutationParams | null | ((draft: Draft<TStructure>) => void),
    maybeRecipe?: (draft: Draft<TStructure>) => void
  ): TEntityEvent {
    // Résoudre les arguments (overload)
    const params = typeof paramsOrRecipe === 'function' ? null : paramsOrRecipe;
    const recipe = typeof paramsOrRecipe === 'function' ? paramsOrRecipe : maybeRecipe!;
    
    const payload = params?.payload;
    const metas = params?.metas;
    
    const [nextState, patches, inversePatches] = produceWithPatches(
      this._state,
      recipe
    );
    
    const changedKeys = [...new Set(patches.map(p => String(p.path[0])))];
    
    const event: TEntityEvent = {
      intent,
      payload,
      metas,
      patches,
      inversePatches,
      timestamp: Date.now(),
      changedKeys
    };
    
    this._state = nextState;
    this._history.push(event);
    this._notifyFeature(event);
    
    return event;
  }
  
  undo(): TEntityEvent | null {
    const lastEvent = this._history.pop();
    if (!lastEvent) return null;
    
    this._state = applyPatches(this._state, lastEvent.inversePatches);
    return lastEvent;
  }
}
```

### Anti-patterns

#### ❌ Mutation sans intent clair

```typescript
// ❌ MAUVAIS — intent générique
this.entity.mutate("update", draft => {
  draft.count++;
});

// ✅ BON — intent explicite et métier
this.entity.mutate("counter:increment", draft => {
  draft.count++;
});
```

#### ❌ Muter les données pour filtrer/trier

Voir [ADR-0008 Anti-patterns](../adr/ADR-0008-collection-patterns.md#anti-patterns).

```typescript
// ❌ MAUVAIS — mute les items pour trier → ~300 patches !
this.entity.mutate("products:sort", draft => {
  draft.items.sort((a, b) => b.popularity - a.popularity);
});

// ✅ BON — mute les critères → 1 patch
this.entity.mutate("products:setSortCriteria", draft => {
  draft.sortCriteria = { field: "popularity", order: "desc" };
});
// La View applique le tri lors du rendu
```

### Sémantique des mutations sans effet (no-op)

Si la `recipe` passée à `mutate()` ne modifie pas le draft (Immer détecte zéro patch) :

| Aspect | Comportement |
|--------|-------------|
| **State** | Inchangé |
| **`patches`** | `[]` (array vide) |
| **`changedKeys`** | `[]` |
| **Notifications** | **Non émises** — aucun handler per-key ni `onAnyEntityUpdated` n'est appelé |
| **`TEntityEvent` retourné** | Retourné avec `patches: []` et `changedKeys: []` |
| **Events Channel** | Dépend entièrement du code du command handler — si `this.emit()` est appelé explicitement après `mutate()`, l'Event est émis même si la mutation est un no-op |

> **Conséquence architecturale** : un command handler qui émet systématiquement un Event
> sans vérifier le résultat de la mutation peut émettre un Event pour une opération
> sans effet réel (ex: `clear` sur un panier déjà vide). Il est recommandé de vérifier
> `changedKeys.length > 0` avant d'émettre si l'Event doit refléter un changement réel :
>
> ```typescript
> onClearCartCommand(payload: void, metas: TMessageMetas): void {
>   const event = this.entity.mutate("cart:clear", draft => {
>     draft.items = [];
>   });
>   // N'émet que si quelque chose a vraiment changé
>   if (event.changedKeys.length > 0) {
>     this.emit('cleared', undefined, { metas });
>   }
> }
> ```

---

## 5. Méthodes de requête (query)

L'Entity peut contenir de la **logique de données** — des méthodes
qui dérivent, filtrent, trient, agrègent ou transforment le state
pour répondre aux besoins de la Feature.

> **Distinction clé** :
> - **Logique métier** (Feature) : orchestration, décisions, réactions aux commands/events
> - **Logique de données** (Entity) : calcul, filtrage, tri, agrégation sur le state
>
> La Feature reçoit une demande métier (request) et la **traduit** en
> interrogation du state. L'Entity **répond** avec les données,
> potentiellement calculées. L'Entity ne sait pas *pourquoi* on lui
> demande — elle sait *comment* répondre à partir de son state.

> **Règle** : les méthodes query **ne modifient jamais** `this.state`.
> Elles sont pures : même entrée → même sortie.

Ces méthodes servent principalement aux **request handlers** de la Feature :
la Feature reçoit un request et délègue la lecture à son Entity.

```typescript
class InventoryEntity extends Entity<Inventory.State> {
  protected get initialState(): Inventory.State {
    return { products: [] };
  }

  // ── Méthodes de requête (query) ──

  /** Retourne les produits dont le stock est > 0 */
  getAvailableProducts(): Product[] {
    return this.state.products.filter(p => p.stock > 0);
  }

  /** Retourne le stock d'un produit spécifique */
  getStockLevel(productId: string): number {
    const product = this.state.products.find(p => p.id === productId);
    return product?.stock ?? 0;
  }

  /** Retourne le nombre total de références en stock */
  getAvailableCount(): number {
    return this.state.products.filter(p => p.stock > 0).length;
  }
}
```

### Utilisation dans les request handlers de Feature

La Feature **délègue** la logique de lecture à son Entity :

```typescript
class InventoryFeature
  extends Feature<Inventory.State, Inventory.Channel>
  implements TRequiredRequestHandlers<Inventory.Channel>
{
  // La Feature reçoit le request, l'Entity fournit la réponse

  onAvailableProductsRequest(params: void, metas: TMessageMetas): Product[] | null {
    return this.entity.getAvailableProducts();
  }

  onStockLevelRequest(params: { productId: string }, metas: TMessageMetas): number | null {
    return this.entity.getStockLevel(params.productId);
  }
}
```

> **Séparation des responsabilités** :
> - **Feature** : reçoit les requests métier (via Channel), traduit en interrogation du state, orchestre, émet les events
> - **Entity** : encapsule le state, fournit les données (query, potentiellement calculées) et les mutations
>
> La Feature ne contient pas de logique de calcul/filtrage/tri du state.
> L'Entity ne connaît pas les Channels et ne prend aucune décision métier.
> Chacun dans son rôle.

### Typage des méthodes query

Les méthodes query ne sont **pas contraintes par un type générique**
au niveau de la classe abstraite `Entity`. Elles sont libres dans
la sous-classe concrète. Cependant, le type de retour d'une méthode
query DOIT être `TJsonSerializable` (puisqu'il transite via un Channel
en `T | null` synchrone pour les requests — D9 révisé par ADR-0023).

```typescript
/**
 * Contrainte implicite sur les retours de méthodes query :
 * tout ce qui est retourné via un request handler transite
 * en T | null (synchrone) où T est déclaré dans TChannelDefinition.requests.
 * T est donc contraint à TJsonSerializable par construction.
 */
```

<!--
  Distinction mutation vs query — conventions de nommage :
  
  | Catégorie | Convention | Retour | Side-effect |
  |-----------|-----------|--------|-------------|
  | Mutation  | verbe d'action : add, remove, update, set, clear, mark... | void | Oui (modifie state) |
  | Query     | get, find, has, is, count, compute... | T (jsonifiable) | Non (lecture seule) |
  
  Le framework pourrait vérifier que les méthodes préfixées par 'get'
  ne modifient pas this.state (en mode debug, via Proxy). À évaluer.
-->

---

## 6. Notifications Entity → Feature

Quand le state d'une Entity change (via `mutate()`), la Feature
propriétaire doit en être informée. Ce mécanisme est un
**protocole framework interne** (L1) — pas un Channel.

> **Inspiration** : le pattern est directement inspiré du Model de
> **Marionette.js / Backbone.js**, qui émet des événements `change:key`
> (pour une propriété spécifique) et `change` (pour tout changement).
> Bonsai adapte ce pattern à la convention `onXXX` auto-découverte (D12).

### Deux types de handlers Entity

Le framework fournit **deux granularités** de notification, toutes deux
optionnelles et auto-découvertes par la convention `onXXX` :

| Type | Pattern | Paramètres | Quand déclenché |
|------|---------|-----------|-----------------|
| **Per-key** | `on<Key>EntityUpdated` | `prev: T, next: T, patches: Patch[]` | Quand la propriété `key` de `TStructure` change |
| **Catch-all** | `onAnyEntityUpdated` | `event: TEntityEvent` | Quand n'importe quelle propriété change |

> **Pourquoi `any` plutôt que `all`** : `onAllEntityUpdated` est ambigu —
> on pourrait lire « quand TOUTES les clés changent simultanément ».
> `onAnyEntityUpdated` est sans ambiguïté : « quand N'IMPORTE QUELLE clé change ».

### TEntityEvent — type canonique

```typescript
/**
 * TEntityEvent — notification de mutation de state.
 *
 * Émis automatiquement après chaque appel à mutate().
 * Contient l'intention métier ET les patches techniques.
 * Voir ADR-0001 pour les détails.
 */
type TEntityEvent = {
  /** Intention métier (ex: "cart:addItem") */
  readonly intent: string;
  
  /** Payload capturé pour traçabilité */
  readonly payload: unknown;

  /** Metas causales associées à la mutation (ADR-0016) */
  readonly metas?: TMessageMetas;
  
  /** Patches Immer (granulaires, JSON-compatible) */
  readonly patches: Patch[];
  
  /** Patches inverses pour undo */
  readonly inversePatches: Patch[];
  
  /** Timestamp de la mutation */
  readonly timestamp: number;
  
  /** Clés de premier niveau affectées */
  readonly changedKeys: string[];
}
```

### Template literal types — génération des noms de handlers Entity

```typescript
/**
 * Génère le nom de handler per-key depuis une clé de TStructure.
 * "items" → "onItemsEntityUpdated"
 * "total" → "onTotalEntityUpdated"
 */
type ExtractEntityKeyHandlerName<
  TKey extends string
> = `on${Capitalize<TKey>}EntityUpdated`;

/**
 * Mapped type — signatures optionnelles des handlers Entity per-key.
 */
type TEntityKeyHandlers<TStructure extends TJsonSerializable> = Partial<{
  [K in keyof TStructure as ExtractEntityKeyHandlerName<K & string>]: (
    prev: TStructure[K],
    next: TStructure[K],
    patches: Patch[]
  ) => void;
}>;
```

### Flux de notification

```
  Feature                              Entity
  ───────                              ──────
  this.entity.mutate(                  │
    "cart:addItem",                    │
    { payload: {...} },                │
    draft => {                         │
    draft.items.push(item);            │
    draft.total += item.qty;           │
  });                                  │
                                       ├─ 1. produceWithPatches() — Immer
                                       │     → génère patches + inversePatches
                                       ├─ 2. changedKeys = ['items', 'total']
                                       ├─ 3. crée TEntityEvent
                                       └─ 4. notifications :
  ← onItemsEntityUpdated(prev, next, patches)   a) per-key 'items'
  ← onTotalEntityUpdated(prev, next, patches)   b) per-key 'total'
  ← onAnyEntityUpdated(event)                   c) catch-all
```

> **Ordre de notification** : per-key d'abord (ordre alphabétique de `changedKeys`),
> puis catch-all. Le catch-all reçoit l'`TEntityEvent` complet avec intent et patches.

### Ré-entrance, cascades et déduplication

#### Ré-entrance — mutation pendant un cycle de notification

Si un entity handler (per-key ou catch-all) **re-mute l'Entity**
pendant le cycle de notification, la mutation est **mise en file**
(queued). Elle n'est pas appliquée immédiatement — elle sera
exécutée **après** la fin du cycle courant, déclenchant un
nouveau cycle.

Un compteur de **profondeur de cycle** protège contre les boucles :
si la profondeur dépasse un seuil configurable (`maxEntityNotificationDepth`,
défaut : 3), le framework rejette la mutation avec une erreur explicite.

```
  Cycle 1 : mutate("cart:addItem", ...) → Immer → onItemsEntityUpdated()
                                                     └─ this.entity.mutate("cart:recalculate", ...)  ← MIS EN FILE
            onAnyEntityUpdated()
  Cycle 2 : mutate("cart:recalculate", ...) → Immer → onTotalEntityUpdated()
            onAnyEntityUpdated()
  (fin — pas de nouvelle mutation en file)
```

> **Règle** : les mutations en file sont appliquées dans l'ordre
> FIFO. Chaque mutation produit son propre cycle complet.
> Le state évolue de façon prévisible, sans récursion incontrôlée.

#### Cascades via Channel — couvertes par I9

Un entity handler peut émettre un Event (`this.emit(...)`).
Cet Event traverse les Channels et peut déclencher des réactions
dans d'autres Features, qui peuvent elles-mêmes muter leurs Entities,
émettre d'autres Events, etc.

Ce scénario est **déjà couvert par I9** (anti-boucle `hop > maxHops`).
Chaque `emit()` incrémente le `hop` dans les metas (I7), et le
framework rejette le message si la profondeur maximale est atteinte.
Aucun mécanisme supplémentaire n'est nécessaire.

#### Déduplication — responsabilité du développeur

Le framework **ne déduplique pas** les Events émis par les handlers.
Si un per-key handler ET le catch-all émettent le même Event,
ce sont deux Events distincts (avec des metas distinctes).

> **Guidance** : pour une réaction donnée, choisir **une seule approche**
> (voir tableau ci-dessous). Ne pas émettre le même Event depuis
> un per-key ET un catch-all — c'est un anti-pattern qui produit
> des notifications redondantes.

#### Per-key handlers — réagir à une propriété spécifique

```typescript
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  protected get Entity() { return CartEntity; }

  // ── Per-key : réagir quand 'items' change ──

  onItemsEntityUpdated(
    prev: Array<{ productId: string; qty: number }>,
    next: Array<{ productId: string; qty: number }>,
    patches: Patch[]
  ): void {
    // Émettre un Event avec le delta
    // Note : les entity handlers n'ont pas de paramètre metas —
    // les metas sont portées par le TEntityEvent (catch-all)
    // ou par le command handler qui a déclenché la mutation.
    // Préférer l'émission depuis le command handler (voir §6 tableau).
    const added = next.filter(
      item => !prev.some(p => p.productId === item.productId)
    );
    if (added.length > 0) {
      // Emission sans metas — le framework dérive les metas
      // depuis le TEntityEvent.metas de la mutation courante
      this.emit('itemAdded', added[0]);
    }
  }

  // ── Per-key : réagir quand 'total' change ──

  onTotalEntityUpdated(prev: number, next: number): void {
    this.emit('totalUpdated', { total: next, previous: prev });
  }
}
```

#### Catch-all handler — réagir à tout changement

```typescript
class UserFeature extends Feature<User.State, User.Channel> {
  protected get Entity() { return UserEntity; }

  /**
   * Déclenché pour TOUT changement de state.
   * Reçoit l'TEntityEvent complet avec intent, payload et patches.
   * Utile pour : logging, analytics, persistance, broadcast.
   */
  onAnyEntityUpdated(event: TEntityEvent): void {
    // Logging : quelle intention et quelles clés ?
    console.debug('[User]', event.intent, event.changedKeys);

    // Persistance automatique après toute mutation
    localStorage.setItem('user', JSON.stringify(this.entity.state));

    // Broadcaster aux Views — metas disponibles via event.metas
    if (event.metas) {
      this.emit('profileUpdated', { state: this.entity.state }, { metas: event.metas });
    }
  }
}
```

#### Combinaison : command handler + entity handler

```typescript
class InventoryFeature extends Feature<Inventory.State, Inventory.Channel> {
  protected get Entity() { return InventoryEntity; }

  // ── Command handler : traite l'intention ──

  onReserveStockCommand(payload: { productId: string; qty: number }, metas: TMessageMetas): void {
    // La Feature mute l'Entity via mutate().
    // Les handlers per-key se déclenchent ensuite.
    this.entity.mutate(
      "inventory:reserveStock",
      { payload, metas },
      draft => {
      const product = draft.products.find(p => p.id === payload.productId);
      if (product) {
        product.stock -= payload.qty;
      }
    });
    // Pas de this.emit() ici — c'est le handler per-key qui s'en charge.
  }

  // ── Entity per-key handler : réagit au changement ──

  onProductsEntityUpdated(
    prev: Product[],
    next: Product[],
    patches: Patch[]
  ): void {
    // Un produit est passé en rupture de stock ?
    const nowOutOfStock = next.filter(
      p => p.stock === 0 && prev.find(pp => pp.id === p.id)?.stock !== 0
    );
    for (const product of nowOutOfStock) {
      this.emit('stockDepleted', { productId: product.id });
    }
  }
}
```

> **Philosophie : séparation intention / réaction** :
> - Le **command handler** (`onReserveStockCommand`) traite l'intention et mute l'Entity
> - Le **entity handler** (`onProductsEntityUpdated`) réagit au changement de state et émet les Events
>
> Cette séparation évite la duplication : si 3 commands différents modifient `products`,
> le handler `onProductsEntityUpdated` centralise la logique de réaction.

### Relation avec les command handlers — quand utiliser quoi ?

| Approche | Quand l'utiliser | Avantage | Exemple |
|----------|-----------------|----------|---------|
| **Emit dans le command handler** | Relation 1:1 entre un command et un event | Explicite, linéaire | `onAddItemCommand(payload, metas) { ... this.emit('itemAdded', payload, { metas }) }` |
| **Entity per-key handler** | Plusieurs commands modifient la même propriété | Centralise la réaction | `onProductsEntityUpdated() { ... }` |
| **Entity catch-all** | Réaction transversale (logging, persistance) | Un seul point | `onAnyEntityUpdated() { ... }` |

> Les trois approches sont **compatibles** et peuvent coexister dans la même Feature.
> L'emit dans le command handler s'exécute **avant** les entity handlers
> (puisqu'il est appelé explicitement dans le corps du command handler,
> tandis que les entity handlers sont déclenchés après la mutation).

### Auto-découverte — cohérence avec D12

Les entity handlers suivent exactement le même mécanisme d'auto-découverte
que les Channel handlers (D12) :

```
  Suffixe                  Mécanisme          Source de vérité
  ─────────────────────    ─────────────────   ─────────────────────────
  onXxxCommand             Channel handler     TChannel['commands']
  onXxxEvent               Channel handler     listen[].TChannel['events']
  onXxxRequest             Channel handler     TChannel['requests']
  on<Key>EntityUpdated     Entity handler      keyof TStructure
  onAnyEntityUpdated       Entity handler      (catch-all, pas de source)
```

Au bootstrap, le framework :
1. Introspecte les méthodes de la Feature
2. Les méthodes terminant par `EntityUpdated` sont identifiées comme entity handlers
3. Pour les per-key : le framework vérifie que `<Key>` correspond à une clé de `TStructure`
4. Pour le catch-all : `onAnyEntityUpdated` est câblé sans vérification de clé
5. Si un handler `on<Key>EntityUpdated` référence une clé inexistante → erreur bootstrap

<!--
  Implémentation interne des notifications :
  
  Le framework utilise rxjs en interne (voir RFC-0002-channel §5 note rxjs) :
  - Un Subject par Entity pour les notifications de changement
  - Le framework wrap les méthodes de mutation de l'Entity
    (via Proxy sur this.state ou wrapping explicite au bootstrap)
  - Après chaque mutation, le framework :
    a) Calcule le diff (changedKeys)
    b) Pour chaque changedKey, appelle le handler per-key s'il existe
    c) Appelle le handler catch-all s'il existe
  - Les souscriptions sont gérées par le framework (subscribe au
    bootstrap, unsubscribe au shutdown)
  
  Ré-entrance :
  - Les mutations déclenchées pendant un cycle de notification sont
    mises en file (queue FIFO), pas exécutées immédiatement.
  - Après le cycle courant (tous les per-key + catch-all appelés),
    le framework dépile la file et exécute chaque mutation en
    déclenchant un nouveau cycle complet.
  - Un compteur de profondeur (maxEntityNotificationDepth, défaut 3)
    protège contre les boucles infinies.
  - Ce mécanisme est transparent pour le développeur — il appelle
    this.entity.mutate() normalement, le framework gère la file.
  
  Cascades inter-Features :
  - Couvertes par I9 (hop > maxHops). Pas de mécanisme supplémentaire.
  
  Déduplication :
  - Le framework ne déduplique PAS les Events émis.
  - Si le développeur émet le même Event dans un per-key ET un
    catch-all, ce sont deux Events distincts avec metas distinctes.
  - Déduplication automatique = magie imprévisible, rejetée.
  
  Le catch-all `onAnyEntityUpdated` est inspiré du `change` de
  Backbone/Marionette, renommé `any` pour éviter l'ambiguïté de `all`.
  Les per-key sont inspirés de `change:attribute`.
  
  ⚠️ Tout ce mécanisme est de la mécanique interne.
  Le contrat de typage est :
  - Per-key : on<Key>EntityUpdated(prev, next, patches)
  - Catch-all : onAnyEntityUpdated(TEntityEvent)
  L'implémentation (Immer, rxjs, callback) est interne.
-->

---

## 7. Sérialisation et snapshot

> ✅ **Contrat v1** : `toJSON()` et `fromJSON()` sont des contrats v1 requis pour
> le snapshot DevTools et la persistance.
>
> ✅ **Contrat v1** : `populateFromServer()` est le mécanisme de pré-peuplement SSR
> (ADR-0014 H5). Usage interne framework uniquement.
>
> 🔵 **Extension optionnelle v1** : `eventLog` est exposé pour les DevTools
> mais non requis par les composants applicatifs.

```typescript
abstract class Entity<TStructure extends TJsonSerializable> {
  /** Retourne une copie profonde du state courant */
  toJSON(): TStructure {
    return structuredClone(this.state);
  }

  /** Restaure le state depuis un snapshot — peut déclencher des notifications */
  fromJSON(snapshot: TStructure): void;

  /**
   * Pré-peuple silencieusement le state depuis un état sérialisé serveur.
   *
   * Appelé uniquement par le framework en phase 3 ('entities') du bootstrap,
   * si `TBootstrapOptions.serverState` contient une entrée pour ce namespace.
   *
   * **Silencieux** : aucun Event, aucune notification, aucun `any`.
   * Conçu pour le SSR où le DOM reflète déjà ces données (ADR-0014 H4/H5).
   *
   * @param state — le state sérialisé côté serveur
   * @internal — framework only
   * @see ADR-0014 H5, RFC-0002 §7.1 TBootstrapOptions
   */
  populateFromServer(state: TStructure): void;
  
  /** Retourne l'historique des events (lecture seule) — extension optionnelle v1 */
  get eventLog(): readonly TEntityEvent[] {
    return this._history;
  }
}
```

<!--
  toJSON() retourne une copie profonde pour garantir l'encapsulation (I6) :
  le consommateur ne peut pas muter le state en modifiant le résultat.
  
  fromJSON() permet la restauration d'un snapshot (DevTools, persistance).
  
  eventLog expose l'historique des mutations pour debugging et Event Sourcing.
  
  Ces méthodes sont la base du time-travel (RFC-0004).
-->

---

## 8. Event Sourcing Compatibility

> ⏳ **Post-v1** : cette section documente la compatibilité de l'architecture
> avec Event Sourcing, mais les niveaux 2 et 3 (undo/redo, persistence)
> ne font pas partie du contrat v1. Les niveaux 0 et 1 (mutations trackées,
> eventLog accessible) sont inclus en v1 comme base extensible.
>
> Voir [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) et
> [ADR-0011](../adr/ADR-0011-event-sourcing-support.md) pour les décisions sous-jacentes.

L'architecture de mutation permet une évolution progressive vers Event Sourcing :

### Niveaux de support

| Niveau | Nom | Description | Bonsai v1 |
|--------|-----|-------------|-----------|
| **0** | Base | Mutations trackées mais pas persistées | ✅ Inclus |
| **1** | EventLog | Events accessibles via `entity.eventLog` | ✅ Inclus |
| **2** | Replay | Undo/redo via `inversePatches` | ⏳ Extension |
| **3** | Persistence | Stockage et reconstruction depuis events | ⏳ Extension |

### Structure du TEntityEvent (Event Sourcing ready)

```typescript
{
  // Niveau SÉMANTIQUE (pour Event Sourcing, logs, analytics)
  intent: "cart:addItem",
  payload: { productId: "abc", quantity: 2 },
  timestamp: 1710765432000,
  
  // Niveau TECHNIQUE (pour undo, DevTools, time-travel local)
  patches: [{ op: "add", path: ["items", 2], value: {...} }],
  inversePatches: [{ op: "remove", path: ["items", 2] }],
  changedKeys: ["items", "itemCount"]
}
```

### Exemple : replay depuis eventLog

```typescript
// Time-travel : rejouer l'état à un moment donné
function replayTo(entity: Entity, timestamp: number): void {
  const events = entity.eventLog.filter(e => e.timestamp <= timestamp);
  entity.fromJSON(entity.initialState);
  for (const event of events) {
    applyPatches(entity.state, event.patches);
  }
}

// Undo : annuler la dernière mutation
const undoneEvent = entity.undo();
// → applique inversePatches, retire l'event de l'historique
```

### Interopérabilité avec CQRS/Event Sourcing

Pour un système Event Sourcing complet, l'`intent` + `payload` constituent
l'**événement métier** tandis que les `patches` sont l'**état dérivé**.

```typescript
// Event Store — stocke uniquement intent + payload
eventStore.append({
  aggregateId: "cart-123",
  eventType: event.intent,       // "cart:addItem"
  payload: event.payload,        // { productId, qty }
  timestamp: event.timestamp
});

// Reconstruction — rejoue les events pour reconstruire l'état
const events = await eventStore.getEvents("cart-123");
const state = events.reduce((state, event) => {
  return applyBusinessEvent(state, event);
}, initialState);
```

<!--
  toJSON() retourne une copie profonde pour garantir l'encapsulation (I6) :
  le consommateur ne peut pas muter le state en modifiant le résultat.
  
  fromJSON() permet la restauration d'un snapshot (DevTools, persistance).
  
  Ces deux méthodes sont la base du time-travel (RFC-0004).
-->
