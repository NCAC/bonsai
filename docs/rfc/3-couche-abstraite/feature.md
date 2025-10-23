# Feature

> **Unité métier : classe abstraite, 5 capacités, handlers auto-découverts, déclaration Channel, cycle de vie**

[← Retour à la couche abstraite](README.md) · [← Communication](../2-architecture/communication.md)

---

| Champ             | Valeur                                           |
|-------------------|--------------------------------------------------|
| **Composant**     | Feature                                          |
| **Couche**        | Abstraite (persistante)                          |
| **Statut**        | 🟢 Stable                                        |
| **Mis à jour**    | 2026-04-02                                       |

> ### Statut normatif
> Ce document fait foi pour le **contrat Feature** : classe abstraite, 5 capacités, handlers `onXXX`, cycle de vie.
> Il fait également foi pour la **pratique de déclaration Channel** : `TChannelDefinition`, `declareChannel`,
> pattern namespace TS (D14), co-localisation (D13).
> Les mutations Entity utilisent `mutate(intent, params?, recipe)` conformément à [ADR-0001](../../adr/ADR-0001-entity-diff-notification-strategy.md).
> Pour le **concept Channel** (tri-lane, événement `any`, sémantiques runtime) → voir [communication.md](../2-architecture/communication.md).

---

## 📋 Table des matières

1. [Classe abstraite Feature](#1-classe-abstraite-feature)
2. [Déclaration Channel — pratique (D13, D14)](#2-déclaration-channel--pratique-d13-d14)
3. [Déclarations statiques](#3-déclarations-statiques)
4. [Les 5 capacités — signatures](#4-les-5-capacités--signatures)
5. [Méthodes auto-découvertes `onXXX`](#5-méthodes-auto-découvertes-onxxx)
6. [Accès à l'Entity](#6-accès-à-lentity)
7. [Cycle de vie](#7-cycle-de-vie)
8. [Sémantiques lifecycle et échecs](#8-sémantiques-lifecycle-et-échecs)

---

## 1. Classe abstraite Feature

La Feature est paramétrée par sa structure Entity et sa définition Channel.

Le framework **infère et vérifie** les méthodes `onXXX` à la compilation
via les mapped types définis dans [RFC-0002 §3 Conventions de typage](../6-transversal/conventions-typage.md#3-conventions-de-typage).

```typescript
/**
 * Classe abstraite Feature — paramétrée par la structure Entity et le Channel.
 *
 * TStructure est contraint à TJsonSerializable (D10).
 * TChannel est contraint à TChannelDefinition.
 * Les génériques sont *contraints* : le développeur ne peut pas instancier
 * une Feature avec un Channel arbitraire.
 *
 * Pas de F-bounded polymorphism récursif (pas de Self-type) :
 * chaque Feature est une classe concrète finale, pas une base d'héritage
 * entre Features concrètes. Le seul héritage utilisé est le pattern
 * abstract → concret (Feature → CartFeature), qui justifie l'accès
 * `protected` sur entity, onInit, onDestroy, etc.
 */
abstract class Feature<
  TStructure extends TJsonSerializable,
  TChannel extends TChannelDefinition
> {
  /** Namespace unique — dérivé du token Namespace.channel (D5, I21, D14) */
  static readonly namespace: string;

  /**
   * Constructeur de l'Entity concrète — getter abstrait obligatoire (D17).
   *
   * Chaque Feature concrète DOIT fournir ce getter retournant le
   * constructeur de son Entity. La base class l'utilise pour
   * instancier this.entity dans son constructeur.
   *
   * Le getter (et non une propriété) est nécessaire car les
   * initialiseurs de propriétés de la classe fille s'exécutent
   * APRÈS super() — un getter sur le prototype est accessible
   * dès le constructeur de la classe abstraite.
   */
  protected abstract get Entity(): new () => Entity<TStructure>;

  /** L'Entity de cette Feature — relation 1:1:1 (I22) */
  protected readonly entity: Entity<TStructure>;

  /**
   * Constructeur — instancie l'Entity automatiquement via D17.
   *
   * Le framework appelle ce constructeur au bootstrap (RFC-0001 §5.1 étape 5).
   * Le développeur ne l'appelle jamais directement.
   */
  constructor() {
    this.entity = new this.Entity();
  }

  /** Cycle de vie */
  protected onInit(): void | Promise<void>;
  protected onDestroy(): void | Promise<void>;
}
```

> **Invariants respectés** : I21 (namespace unique), I22 (1:1:1),
> I6 (seule la Feature modifie son Entity).

> **Pas de self-type récursif (`Feature<Self, ...>`)** :
> Contrairement au pattern `Class<Child extends Class<Child>>` où la classe
> abstraite reçoit le type concret en générique (nécessaire quand la
> vérification des handlers introspection les méthodes de la classe concrète
> via `keyof Child`), Bonsai utilise `implements TRequiredCommandHandlers<TChannel>`.
>
> La différence clé :
> - **Introspection du type concret** : `RequiredHandlers<Self, Channel>` — a besoin de `Self`
> - **Génération depuis le contrat** : `RequiredHandlers<Channel>` — le Channel seul suffit
>
> Bonsai choisit la seconde approche. Les signatures des méthodes `onXXX`
> sont générées **uniquement depuis la `TChannelDefinition`**, sans connaître
> le type concret de la Feature. Le `implements` vérifie que la classe
> satisfait ces signatures. Résultat : `Feature<TStructure, TChannel>`
> — deux génériques au lieu de trois, zéro récursion.
>
> Pour les cas où un retour typé `this` est nécessaire (chaînage, etc.),
> TypeScript fournit le type polymorphe `this` nativement, sans F-bounded.

---

## 2. Déclaration Channel — pratique (D13, D14)

> Pour le **concept Channel** (tri-lane, événement `any`, sémantiques runtime) → voir [communication.md](../2-architecture/communication.md).
> Cette section couvre la **pratique** : comment déclarer un Channel, le type `TChannelDefinition`,
> l'utilitaire `declareChannel`, le pattern namespace TS et la co-localisation.

### Type `TChannelDefinition`

Un Channel a **deux facettes** :

| Facette | Nature | Visibilité |
|---------|--------|------------|
| `TChannelDefinition` (type) | Contrat de communication tri-lane | Public — exporté dans le TS `namespace` |
| `Channel` (classe runtime) | Registres de handlers, dispatch | Interne framework — jamais exposé (D15) |

Le développeur ne manipule que le **type** et le **token**. L'instance runtime est un détail d'implémentation.

```typescript
type TChannelDefinition = {
  readonly namespace: string;
  readonly commands: Record<string, unknown>;
  readonly events: Record<string, unknown>;
  readonly requests: Record<string, { params: unknown; result: unknown }>;
}
```

### Utilitaire `declareChannel`

```typescript
/**
 * Crée un token de référence Channel typé.
 * Léger à runtime ({ namespace }), complet au type-level (TChannel).
 */
function declareChannel<T extends TChannelDefinition>(ns: T['namespace']): T {
  return { namespace: ns } as T;
}
```

### Pattern namespace TypeScript (D14)

Chaque Feature exporte un **TS `namespace`** qui regroupe Channel, State et token :

```typescript
export namespace Cart {
  export type Channel = TChannelDefinition & {
    readonly namespace: 'cart';
    readonly commands: {
      addItem: { productId: string; qty: number };
      removeItem: { productId: string };
      clear: void;
    };
    readonly events: {
      itemAdded: { productId: string; qty: number };
      itemRemoved: { productId: string };
      cleared: void;
    };
    readonly requests: {
      items: { params: void; result: CartItem[] };
      total: { params: void; result: number };
    };
  };

  export type State = TEntityStructure & {
    items: Array<{ productId: string; qty: number }>;
    total: number;
  };

  export const channel = declareChannel<Channel>('cart');
}
```

> `Cart.Channel` pour le type, `Cart.channel` pour le token runtime.
> Un seul import `{ Cart }` suffit pour tout.

**Pourquoi le mot-clé `namespace` ?** C'est le seul construct TypeScript qui
réunit **types et valeurs** sous un même nom. Un objet plain ne peut pas
contenir de types ; une déclaration `type` ne peut pas contenir de valeurs.

### Co-localisation Channel/Feature (D13)

> **D13** : le Channel, le State et le token sont définis dans le **même fichier** que la Feature.

| Aspect | Fichier séparé | Co-localisé (D13) |
|--------|---------------|-------------------|
| Cohérence | 2 fichiers à modifier | 1 seul fichier |
| Navigation IDE | 2 onglets | 1 onglet |
| Import | 2 imports | 1 import |
| Risque de désync | Oui | Non |

```
Cart/
  cart.feature.ts       ← Cart namespace + CartFeature class
  cart.entity.ts        ← CartEntity class
```

> Le seul fichier qui exporte des types publics est `*.feature.ts`.
> L'Entity est un détail d'implémentation interne de la Feature.

---

## 3. Déclarations statiques

> **Décision D11** : les déclarations Channel se font via le **token
> `Namespace.channel`** (D14), pas via la classe Feature elle-même.

```typescript
class CartFeature
  extends Feature<Cart.State, Cart.Channel>
  implements
    TRequiredCommandHandlers<Cart.Channel>,
    TRequiredRequestHandlers<Cart.Channel>
{
  static readonly namespace = Cart.channel.namespace;

  /** Liaison Feature → Entity concrète (D17) */
  protected get Entity() { return CartEntity; }

  /** Channels externes écoutés — Events uniquement (C3) */
  static readonly listen = [Inventory.channel, Pricing.channel] as const;

  /** Channels externes interrogeables — Requests uniquement (C5) */
  static readonly request = [User.channel] as const;

  // ... les méthodes onXXX requises par implements (voir §4)
}
```

> **Note ADR-0024** : les Features conservent `static readonly listen` et `static readonly request`
> car le framework lit ces déclarations depuis la **classe** (pas l'instance) lors du câblage
> au bootstrap (étape 5, D6). Ce pattern est distinct du value-first ADR-0024 qui s'applique
> aux composants de la couche concrète (View, Composer, Behavior, Foundation) dont les
> déclarations sont lues depuis l'instance via `get params()`.

> **DX** : grâce à `implements TRequiredCommandHandlers<Cart.Channel>`,
> l'IDE signale immédiatement si un handler manque ou si un
> payload a le mauvais type. L'autocomplétion propose les méthodes
> `onAddItemCommand`, `onRemoveItemCommand`, `onClearCommand`
> directement depuis la définition du Channel.

<!--
  Le Channel propre est toujours implicite pour emit (C1),
  handle (C2) et reply (C4).
  
  Seules les dépendances EXTERNES sont déclarées :
  - listen : Channels dont la Feature écoute les Events
  - request : Channels dont la Feature peut lire le state
  
  Le framework (Radio) résout ces déclarations au bootstrap
  pour câbler les Channels automatiquement.
  
  Note : pas de déclaration `emit` ni `handle` ni `reply` —
  ces capacités sont implicites sur le Channel propre.
-->

---

## 4. Les 5 capacités — signatures

Les 5 capacités (C1–C5) d'une Feature, telles qu'elles sont
disponibles via `this` dans le contexte d'une Feature :

### C1 — `emit()` : émettre un Event sur son propre Channel

```typescript
/**
 * Émet un Event sur le Channel propre de la Feature (I1, I12).
 *
 * - eventName : doit correspondre à une clé de TChannel['events']
 * - payload : typé depuis TChannel['events'][eventName]
 * - options.metas : metas reçues par le handler, propagées explicitement (ADR-0005, ADR-0016, I54)
 * - Cardinalité : 1:N (broadcast vers tous les listeners)
 */
protected emit<K extends keyof TChannel['events'] & string>(
  eventName: K,
  payload: TChannel['events'][K],
  options: { metas: TMessageMetas }
): void;
```

> Seule la Feature propriétaire peut `emit()` sur son Channel (I1, I12).
> Les Views/Behaviors n'ont **jamais** accès à `emit()` (I4, D7).

### C2 — `handle` : implicite via convention `onXXX` (§4)

Pas de méthode `handle()` explicite — les Commands entrants sont
routés automatiquement vers les méthodes `onXxxCommand()` (D12).
Les signatures sont forcées par `implements TRequiredCommandHandlers<TChannel>`.

### C3 — `listen` : implicite via convention `onXXX` (§4)

Pas de méthode `listen()` explicite — les Events des Channels
déclarés en `static readonly listen` sont routés vers `on<Namespace><EventName>Event()` (D12).

### C4 — `reply` : implicite via convention `onXXX` (§4)

Pas de méthode `reply()` explicite — les Requests entrantes
sont routées vers `onXxxRequest()` qui retourne `T | null` synchrone (D9 révisé par ADR-0023).
Les signatures sont forcées par `implements TRequiredRequestHandlers<TChannel>`.

### C5 — `request()` : lire le state d'une Feature externe

```typescript
/**
 * Interroge un Channel externe déclaré en `static readonly request`.
 *
 * - channel : token du Channel cible (Namespace.channel)
 * - requestName : clé de TTargetChannel['requests']
 * - options.metas : metas reçues par le handler, propagées explicitement (ADR-0016, I7, I54)
 * - Retourne `T | null` synchrone (D9 révisé par ADR-0023, I29 révisé)
 *   `null` si le replier throw ou si le Channel n'est pas enregistré (D44 révisé)
 */
protected request<
  TTarget extends TChannelDefinition,
  K extends keyof TTarget['requests'] & string
>(
  channel: { namespace: TTarget['namespace'] },
  requestName: K,
  params: TTarget['requests'][K] extends { params: infer P } ? P : never,
  options: { metas: TMessageMetas }
): (TTarget['requests'][K] extends { result: infer R } ? R : never) | null;
```

> `request()` est la seule capacité **sortante** explicite (avec `emit`).
> Les 3 autres (handle, listen, reply) sont implicites via les conventions `onXXX`.

### Signature de `trigger()` — côté View/Behavior

Pour complétude, voici la signature de `trigger()` disponible
dans le contexte d'une View ou d'un Behavior (pas d'une Feature) :

```typescript
/**
 * Envoie un Command sur un Channel déclaré dans `params.trigger` de la View/Behavior (ADR-0024).
 *
 * - channel : token du Channel cible (Namespace.channel)
 * - commandName : clé de TTargetChannel['commands']
 * - payload : typé depuis TTargetChannel['commands'][commandName]
 * - Les metas sont créées automatiquement par le framework (corrélation racine, ADR-0016, I54)
 * - Cardinalité : 1:1 (un seul handler = la Feature propriétaire)
 */
protected trigger<
  TTarget extends TChannelDefinition,
  K extends keyof TTarget['commands'] & string
>(
  channel: { namespace: TTarget['namespace'] },
  commandName: K,
  payload: TTarget['commands'][K]
): void;
```

> `trigger()` est la primitive de la couche concrète (D7).
> Elle crée une nouvelle chaîne causale (correlationId, hop=0).

---

## 5. Méthodes auto-découvertes `onXXX`

> **Décision D12** : les handlers sont des **méthodes conventionnelles auto-découvertes**
> par le framework. Le suffixe (`Command`, `Event`, `Request`) discrimine le type de message.
> Les paramètres et le retour sont typés depuis la déclaration Channel.

### Convention de nommage

| Type | Pattern | Paramètre | Retour | Exemple |
|------|---------|-----------|--------|---------|
| **Command** (C2 handle) | `on<MessageName>Command` | `payload: T, metas: TMessageMetas` | `void` | `onAddItemCommand(payload: AddItemPayload, metas: TMessageMetas)` |
| **Event** (C3 listen) | `on<ChannelName><EventName>Event` | `payload: T, metas: TMessageMetas` | `void` | `onInventoryStockUpdatedEvent(payload: StockPayload, metas: TMessageMetas)` |
| **Request** (C4 reply) | `on<RequestName>Request` | `void` ou `payload: T, metas: TMessageMetas` | `T \| null` (D9 révisé, ADR-0023) | `onTotalRequest(params: void, metas: TMessageMetas): number \| null` |
| **Entity per-key** (D16) | `on<Key>EntityUpdated` | `prev: T, next: T, patches: Patch[]` | `void` | `onItemsEntityUpdated(prev: CartItem[], next: CartItem[], patches: Patch[])` |
| **Entity catch-all** (D16) | `onAnyEntityUpdated` | `event: TEntityEvent` | `void` | `onAnyEntityUpdated(event: TEntityEvent)` |

> Pour les Entity handlers, voir [RFC-0002-entity §6 Notifications](../3-couche-abstraite/entity.md#6-notifications-entity--feature).

### Exemples

```typescript
class CartFeature
  extends Feature<Cart.State, Cart.Channel>
  implements
    TRequiredCommandHandlers<Cart.Channel>,
    TRequiredRequestHandlers<Cart.Channel>
{
  static readonly namespace = Cart.channel.namespace;
  protected get Entity() { return CartEntity; }
  static readonly listen = [Inventory.channel] as const;
  static readonly request = [Pricing.channel] as const;

  // ── C2 handle : Commands entrants sur son propre Channel ──

  /** Reçoit le Command cart:addItem — déclenché par une View via trigger() */
  onAddItemCommand(payload: { productId: string; qty: number }, metas: TMessageMetas): void {
    // Mute l'Entity via mutate(), puis émet un Event
    this.entity.mutate('cart:addItem', { payload, metas }, draft => {
      draft.items.push({ productId: payload.productId, qty: payload.qty });
    });
    this.emit('itemAdded', { productId: payload.productId, qty: payload.qty }, { metas });
  }

  /** Reçoit le Command cart:removeItem */
  onRemoveItemCommand(payload: { productId: string }, metas: TMessageMetas): void {
    this.entity.mutate('cart:removeItem', { payload, metas }, draft => {
      draft.items = draft.items.filter(i => i.productId !== payload.productId);
    });
    this.emit('itemRemoved', { productId: payload.productId }, { metas });
  }

  // ── C3 listen : Events d'autres Features ──

  /** Écoute l'Event inventory:stockUpdated */
  onInventoryStockUpdatedEvent(payload: { productId: string; stock: number }, metas: TMessageMetas): void {
    if (payload.stock === 0) {
      this.entity.mutate('cart:markOutOfStock', { payload, metas }, draft => {
        const item = draft.items.find(i => i.productId === payload.productId);
        if (item) item.outOfStock = true;
      });
      this.emit('itemOutOfStock', { productId: payload.productId }, { metas });
    }
  }

  // ── C4 reply : Requests entrantes sur son propre Channel ──

  /** Répond au Request cart:items — délègue à l'Entity (§5 query) */
  onItemsRequest(params: void, metas: TMessageMetas): CartItem[] | null {
    return this.entity.getItems();
  }

  /** Répond au Request cart:total — délègue à l'Entity (§5 query) */
  onTotalRequest(params: void, metas: TMessageMetas): number | null {
    return this.entity.getTotal();
  }
}
```

### Workflow complet : types → implémentation → récompense

Exemple end-to-end illustrant la philosophie TypeScript-first :

```typescript
// ────────────────────────────────────────────────────────────
// ÉTAPE 1 — Déclarer les types dans un namespace TS
// ────────────────────────────────────────────────────────────

export namespace Cart {
  // 1a. Le contrat de communication (Channel)
  export type Channel = TChannelDefinition & {
    readonly namespace: 'cart';
    readonly commands: {
      addItem: { productId: string; qty: number };
      removeItem: { productId: string };
      clear: void;
    };
    readonly events: {
      itemAdded: { productId: string; qty: number };
      itemRemoved: { productId: string };
      itemOutOfStock: { productId: string };
      totalUpdated: { total: number; previous: number };
      cleared: void;
    };
    readonly requests: {
      items: { params: void; result: Array<{ productId: string; qty: number }> };
      total: { params: void; result: number };
    };
  };

  // 1b. L'état (Entity) — TEntityStructure concrète (= TJsonSerializable)
  export type State = TEntityStructure & {
    items: Array<{ productId: string; qty: number }>;
    total: number;
    lastUpdated: number;
  };

  // 1c. Token de référence
  export const channel = declareChannel<Channel>('cart');
}

// ────────────────────────────────────────────────────────────
// ÉTAPE 2 — Implémenter la classe
//   Le compilateur vérifie que CHAQUE méthode requise
//   par implements est présente avec le bon type.
// ────────────────────────────────────────────────────────────

class CartFeature
  extends Feature<Cart.State, Cart.Channel>
  implements
    TRequiredCommandHandlers<Cart.Channel>,
    TRequiredRequestHandlers<Cart.Channel>
{
  static readonly namespace = Cart.channel.namespace;
  protected get Entity() { return CartEntity; }

  // ── Commands (obligatoires par implements) ──

  onAddItemCommand(payload: { productId: string; qty: number }, metas: TMessageMetas): void {
    this.entity.mutate('cart:addItem', { payload, metas }, draft => {
      draft.items.push({ productId: payload.productId, qty: payload.qty });
    });
    this.emit('itemAdded', payload, { metas });
  }

  onRemoveItemCommand(payload: { productId: string }, metas: TMessageMetas): void {
    this.entity.mutate('cart:removeItem', { payload, metas }, draft => {
      draft.items = draft.items.filter(i => i.productId !== payload.productId);
    });
    this.emit('itemRemoved', payload, { metas });
  }

  onClearCommand(payload: void, metas: TMessageMetas): void {
    this.entity.mutate('cart:clear', draft => {
      draft.items = [];
    });
    this.emit('cleared', undefined, { metas });
  }

  // ── Requests (obligatoires par implements) ──

  onItemsRequest(params: void, metas: TMessageMetas): Array<{ productId: string; qty: number }> | null {
    return this.entity.getItems();
  }

  onTotalRequest(params: void, metas: TMessageMetas): number | null {
    return this.entity.getTotal();
  }
}

// ────────────────────────────────────────────────────────────
// ÉTAPE 3 — Récompense (DX gratuite)
//
//   ✓ Si on oublie onClearCommand → erreur TS compile-time
//   ✓ Si on met le mauvais type de payload → erreur TS
//   ✓ Si on emit un Event non déclaré → erreur TS
//   ✓ Si on renomme un Command dans Cart.Channel
//     → erreur dans toutes les classes qui l'implémentent
//   ✓ Autocomplétion des noms de méthodes dans l'IDE
// ────────────────────────────────────────────────────────────
```

<!--
  Mécanisme de découverte (framework interne) :
  
  Au bootstrap, le framework :
  1. Introspecte les méthodes de la Feature
  2. Filtre celles qui commencent par `on` et finissent par
     `Command`, `Event` ou `Request`
  3. Pour les *Command : vérifie que le nom correspond à un
     Command déclaré dans le Channel propre (TChannel.commands)
  4. Pour les *Event : vérifie que le préfixe correspond à un
     Channel déclaré en `listen` et que l'event existe
  5. Pour les *Request : vérifie que le nom correspond à un
     Request déclaré dans le Channel propre (TChannel.requests)
  6. Câble automatiquement les handlers via Radio
  
  Si une méthode onXXX ne correspond à aucun message connu :
  → erreur au bootstrap (validation dynamique)
  
  Si un message déclaré n'a pas de handler onXXX :
  → warning en mode debug, erreur en mode strict (à décider)
  
  Typage compile-time :
  Le framework fournit des types utilitaires qui vérifient
  la correspondance entre les méthodes onXXX et les déclarations
  Channel. Une erreur de compilation est levée si :
  - Le payload ne correspond pas au type déclaré
  - Le retour d'un onXxxRequest n'est pas T | null
  - Un onXxxCommand retourne une valeur (doit être void)
-->

---

## 6. Accès à l'Entity

```typescript
abstract class Feature<
  TStructure extends TJsonSerializable,
  TChannel extends TChannelDefinition
> {
  /**
   * Constructeur de l'Entity concrète — obligatoire (D17).
   * La Feature concrète retourne sa classe Entity via ce getter.
   */
  protected abstract get Entity(): new () => Entity<TStructure>;

  /** Accès direct à l'Entity — Feature est le seul propriétaire (I6) */
  protected readonly entity: Entity<TStructure>;

  /** Instanciation automatique dans le constructeur (D17) */
  constructor() {
    this.entity = new this.Entity();
  }
}
```

<!--
  La Feature accède à son Entity directement via `this.entity`.
  C'est la seule exception au découplage par Channel :
  la relation Feature ↔ Entity est directe, pas événementielle.
  
  Le getter `abstract get Entity()` (D17) garantit au compile-time
  que chaque Feature concrète fournit son constructeur Entity.
  La base class instancie automatiquement via `new this.Entity()`.
  
  Le getter (et non une propriété) est nécessaire car les
  initialiseurs de propriétés s'exécutent après super() —
  un getter sur le prototype est déjà résolu dans le constructeur parent.
  
  Aucun autre composant n'a accès à `this.entity` :
  - Les Views/Behaviors lisent le state via request() (C5)
  - Les autres Features lisent via request() (C5, D3)
  - Personne ne mute l'Entity sauf la Feature propriétaire (I6)
-->

---

## 7. Cycle de vie

Les hooks de cycle de vie sont des **méthodes framework internes** (L1),
pas des Events sur un Channel. Le framework les appelle directement.

| Hook | Quand | Usage typique |
|------|-------|---------------|
| `onInit()` | Après instanciation, après câblage des Channels | Chargement initial de données, setup |
| `onDestroy()` | Avant destruction au shutdown | Cleanup, sauvegarde, libération de ressources |

```typescript
abstract class Feature<
  TStructure extends TJsonSerializable,
  TChannel extends TChannelDefinition
> {
  protected abstract get Entity(): new () => Entity<TStructure>;
  protected readonly entity: Entity<TStructure>;

  constructor() {
    this.entity = new this.Entity();
  }

  /** Appelé par le framework après instanciation et câblage (bootstrap étape 5) */
  protected onInit(): void | Promise<void> {}

  /** Appelé par le framework au shutdown avant destruction */
  protected onDestroy(): void | Promise<void> {}
}
```

> Ces hooks ne passent pas par les Channels — ce sont des appels directs
> du framework. Voir RFC-0001 §7.2 note et Q9 analyse.

<!--
  Pourquoi pas des Events Channel ?
  
  RFC-0001 Q9 a démontré que les Events lifecycle sont structurellement
  inutiles : au moment où `onInit` est appelé (bootstrap étape 5),
  aucune View n'existe encore pour écouter. Et quand les Views existent
  (étape 6+), les Features sont déjà initialisées.
  
  Les hooks sont synchrones ou async (Promise<void>) pour permettre
  un chargement initial de données (fetch, localStorage, etc.).
  
  Ordre d'appel :
  - onInit() : appelé pour chaque Feature dans l'ordre d'enregistrement
  - Si un onInit() retourne une Promise, le bootstrap attend sa résolution
    avant de passer à la Feature suivante (→ séquentiel, D18)
  - onDestroy() : appelé dans l'ordre inverse d'enregistrement
-->

---

## 8. Sémantiques lifecycle et échecs

### 7.1 Machine à états de la Feature

```
registered → wired → initialized → active → destroying → [destroyed]
```

| État | Entrée (déclencheur) | Sorties possibles | Notes |
|------|----------------------|-------------------|-------|
| `registered` | `app.register(FeatureClass)` | → `wired` (bootstrap) | Validation namespace (I21) |
| `wired` | Câblage Radio — Channels résolus, handlers indexés | → `initialized` | Erreur si handler manquant ou duplicate |
| `initialized` | `onInit()` terminé | → `active` | `onInit()` async attendu (D18) |
| `active` | Bootstrap complet | → `destroying` (shutdown) | Phase nominale — traite Commands, émet Events, répond à Requests |
| `destroying` | `app.stop()` | → `destroyed` | `onDestroy()` appelé. Ordre : inverse de registration |
| `destroyed` | Nettoyage complet | — (terminal) | Entity déréférencée, subscriptions supprimées |

> **Garantie de séquence** : une Feature ne peut pas recevoir de Command avant d'être
> en état `active`. Le bootstrap garantit que la couche abstraite est intégralement
> initialisée avant que la couche concrète (Views) ne soit créée (RFC-0001 §5.1).

### 7.2 Gestion des erreurs dans les handlers

#### Erreurs dans `onXxxCommand`

Un Command handler peut échouer pour deux raisons distinctes :

| Situation | Comportement attendu | Exemple |
|-----------|---------------------|---------|
| **Refus métier** | Le handler n'exécute pas la mutation et n'émet pas d'Event. Il peut émettre un Event d'erreur métier dédié. | `cart:addItem` avec `qty <= 0` — ne pas muter, émettre `cart:itemRejected` |
| **Exception inattendue** | Capturée par le framework, logguée avec contexte causal complet. L'exception ne propage pas aux autres composants. Voir [ADR-0002](../adr/ADR-0002-error-propagation-strategy.md). | Erreur réseau dans un handler d'IO Feature |

> **Convention de refus métier** : ne pas lever d'exception pour un refus métier prévisible.
> Préférer un Event dédié (`xxx:rejected`, `xxx:failed`) avec le motif dans le payload.
> Les exceptions sont pour les cas vraiment inattendus (erreurs de programmation, pannes).

```typescript
// ✅ Refus métier via Event dédié
onAddItemCommand(payload: { productId: string; qty: number }, metas: TMessageMetas): void {
  if (payload.qty <= 0) {
    this.emit('itemRejected', { productId: payload.productId, reason: 'invalid-qty' }, { metas });
    return; // pas de mutation, pas d'exception
  }
  this.entity.mutate('cart:addItem', { payload, metas }, draft => {
    draft.items.push({ productId: payload.productId, qty: payload.qty });
  });
  this.emit('itemAdded', payload, { metas });
}
```

#### Erreurs dans `onXxxRequest`

Un request handler retourne `T | null` synchrone (D9 révisé par ADR-0023). Si le handler throw,
le framework capture l'erreur et retourne `null` au consommateur (D44 révisé, I55).

```typescript
// ✅ Gestion explicite dans le handler
onTotalRequest(params: void, metas: TMessageMetas): number | null {
  try {
    return this.entity.getTotal();
  } catch {
    return 0; // valeur de repli — l'erreur ne doit pas atteindre l'appelant
  }
}
```

> **Règle** : les request handlers NE DOIVENT PAS laisser des erreurs non gérées
> remonter. La couche Channel capture et retourne `null`, mais il est préférable
> que le handler lui-même définisse une valeur de repli sémantique.

#### Idempotence des handlers

> **Recommandation** : les Command handlers DEVRAIENT être idempotents quand le
> domaine le permet — appliquer deux fois le même Command produit le même état final.

| Niveau | Description | Recommandation |
|--------|-------------|----------------|
| **Idempotent strict** | Deux exécutions = même state final | ✅ Préféré (ex: `setX`, `markAs`) |
| **Non-idempotent contrôlé** | Effet cumulatif explicite et voulu | ✅ Acceptable (ex: `addItem`, `increment`) |
| **Non-idempotent involontaire** | Duplication d'état par inattention | ❌ Anti-pattern (ex: push sans check d'existance) |

```typescript
// ✅ Non-idempotent contrôlé — addItem ajoute, c'est attendu
onAddItemCommand({ productId, qty }: AddItemPayload, metas: TMessageMetas): void {
  this.entity.mutate('cart:addItem', { payload: { productId, qty }, metas }, draft => {
    const existing = draft.items.find(i => i.productId === productId);
    if (existing) {
      existing.qty += qty; // cumul explicite
    } else {
      draft.items.push({ productId, qty });
    }
  });
}

// ✅ Idempotent strict — setStatus écrase, pas de duplication
onSetStatusCommand({ status }: { status: string }, metas: TMessageMetas): void {
  this.entity.mutate('user:setStatus', { payload: { status }, metas }, draft => {
    draft.status = status; // idempotent : même résultat si appelé N fois
  });
}
```

### 7.3 Granularité des Features — lignes directrices

> La section suivante est **informative** — voir [Framework Style Guide](../guides/FRAMEWORK-STYLE-GUIDE.md)
> pour les conventions détaillées.

| Indicateur | Seuil d'alerte | Action recommandée |
|-----------|---------------|-------------------|
| Nombre de Commands > 10 | God Feature potentielle | Découper en Features par sous-domaine |
| Nombre de `listen` > 5 | Dépendances croisées excessives | Créer une Feature d'intégration dédiée |
| Handler > 30 lignes | Logique mal placée | Extraire dans des méthodes privées ou dans l'Entity |
| Entity avec > 15 propriétés | State trop large | Découper en deux Features avec Entities séparées |

> **Anti-pattern God Feature** — voir [RFC-0001-invariants-decisions §2](../reference/invariants.md#-god-feature).
> Une Feature bien calibrée répond à une seule question : "de quoi suis-je responsable ?"

### 7.4 Modèle d'erreurs — hiérarchie `BonsaiError`

> **Absorbé depuis** : [ADR-0002](../adr/ADR-0002-error-propagation-strategy.md) (Accepted).
> Cette section fait désormais foi pour la taxonomie, la hiérarchie TypeScript et la matrice de comportement.

#### Taxonomie des erreurs Bonsai

```
┌─────────────────────────────────────────────────────────────────┐
│                        ERREURS BONSAI                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENTITY LAYER (State)                                          │
│  └── MutationError     : recipe throw → Immer rollback          │
│                                                                 │
│  FEATURE LAYER (Logic)                                         │
│  ├── CommandError      : onXxxCommand() throw                   │
│  ├── RequestError      : onXxxRequest() throw/reject            │
│  └── BroadcastError    : onXxxEntityUpdated() throw             │
│                                                                 │
│  CHANNEL LAYER (Communication)                                 │
│  ├── ListenerError     : Event listener throw                   │
│  ├── TimeoutError      : Request sans réponse                   │
│  └── NoHandlerError    : Command/Request sans handler           │
│                                                                 │
│  VIEW LAYER (UI)                                               │
│  ├── RenderError       : Projection/template throw              │
│  └── BehaviorError     : Behavior throw                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Classe de base `BonsaiError`

```typescript
/**
 * Base class pour toutes les erreurs Bonsai.
 * Porte le contexte causal (metas) et le code d'erreur structuré.
 */
abstract class BonsaiError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly metas: TMessageMetas | null,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

> Chaque sous-classe ajoute des champs contextuels typés (voir [ADR-0002 §Hiérarchie TypeScript](../adr/ADR-0002-error-propagation-strategy.md) pour les signatures complètes des 9 classes).

#### Matrice de comportement

| Erreur | State | Historique | Continue ? | Mode dev | Mode prod |
|--------|-------|------------|------------|----------|-----------|
| **MutationError** | ❌ Rollback | ❌ Non ajouté | Non | throw | throw |
| **CommandError** | ❌ Pas muté | — | Non | throw | throw |
| **RequestError** | — | — | Non | reject | reject |
| **BroadcastError** | ✅ Conservé | ✅ Conservé | ✅ Oui | throw | log |
| **ListenerError** | — | — | ✅ Oui | throw | log |
| **TimeoutError** | — | — | Non | reject | reject |
| **NoHandlerError** | — | — | — | throw | warn |
| **RenderError** | — | — | ✅ Boundary | throw | boundary |
| **BehaviorError** | — | — | ✅ Oui | throw | log |

#### Principe clé : séparation Mutation vs Broadcast

```typescript
// MUTATION : erreur dans recipe → state intact
this.entity.mutate("cart:addItem", { payload }, draft => {
  throw new Error("Validation failed");
  // → Immer rollback automatique → MutationError remontée → State INTACT
});

// BROADCAST : erreur dans handler → state CONSERVÉ
onItemsEntityUpdated(prev, next, patches) {
  this.emit('cart:updated', { items: next });
  throw new Error("Analytics failed");
  // → State DÉJÀ MODIFIÉ (mutation réussie)
  // → BroadcastError loggée → Autres handlers quand même appelés
}
```

#### Recovery Hook — `onError()`

Chaque Feature (et View) peut surcharger `onError()` pour un comportement custom :

```typescript
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  protected onError(error: BonsaiError): void {
    if (error instanceof RequestError && error.request === 'pricing:getPrice') {
      this.useCachedPrice(); // Retry avec cache
      return;
    }
    if (error instanceof MutationError) {
      this.emit('cart:error', { message: 'Action failed, please retry' });
      return;
    }
    super.onError(error); // Comportement par défaut
  }
}
```

#### ErrorReporter — infrastructure transversale

> Les erreurs ne sont **pas** un domaine métier. Elles ne sont **pas** modélisées
> comme Feature + Entity + Channel. L'ErrorReporter est une **infrastructure framework
> transversale** (comme Radio). Voir [ADR-0002 §ErrorReporter](../adr/ADR-0002-error-propagation-strategy.md)
> et [RFC-0004 §5](../devtools.md) pour les hooks DevTools (`onError`, `getErrors`).
