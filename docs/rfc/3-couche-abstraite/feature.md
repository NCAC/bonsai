# Feature

> **Unité métier : classe abstraite, 5 capacités, handlers auto-découverts, déclaration Channel, cycle de vie**

[← Retour à la couche abstraite](README.md) · [← Communication](../2-architecture/communication.md)

---

| Champ          | Valeur                  |
| -------------- | ----------------------- |
| **Composant**  | Feature                 |
| **Couche**     | Abstraite (persistante) |
| **Statut**     | 🟢 Stable               |
| **Mis à jour** | 2026-04-21              |

> ### Statut normatif
>
> Ce document fait foi pour le **contrat Feature** : classe abstraite, 5 capacités, handlers `onXXX`, cycle de vie.
> Il fait également foi pour la **pratique de déclaration Channel** : `TChannelDefinition`, `TChannelToken`, `static readonly channel` (ADR-0040), co-localisation (D13, I74).
> Les mutations Entity utilisent `mutate(intent, recipe)` (strate 0) — la signature `(intent, params?, recipe)` avec metas est cible strate 1 ([ADR-0001](../../adr/ADR-0001-entity-diff-notification-strategy.md), ADR-0028 §148).
> L'identité de la Feature (namespace) est portée par le **manifest applicatif** (I68–I72) conformément à [ADR-0039](../../adr/ADR-0039-namespace-authority-and-uniqueness.md) — la classe Feature ne déclare **plus** de `static readonly namespace`.
> Le **pattern historique D14** (`export namespace Cart {…}` + `declareChannel`) est **supersédé** par ADR-0040 (token statique direct sur la classe).
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
 * Classe abstraite Feature — paramétrée par la classe Entity concrete, le Channel
 * et le namespace self-type (I68–I72, ADR-0039).
 *
 * TEntityClass est contraint à Entity<TJsonSerializable> (ADR-0037, D10) :
 * la Feature est typée par sa CLASSE Entity, pas par la forme du state.
 * Cela encode I22 (1:1:1 namespace ↔ Feature ↔ Entity) au type-level
 * et élimine tout cast `as ConcreteEntity` dans le code applicatif.
 *
 * TChannel est contraint à TChannelDefinition.
 *
 * TSelfNS est le namespace auquel cette Feature s'attend à être enregistrée
 * dans le manifest applicatif (ADR-0039, I72). La classe reste **anonyme en
 * valeur** (aucun littéral n'apparaît dans son code hors annotation de type)
 * mais **typée en signature** : le manifest vérifie au compile-time via
 * `StrictManifest<M>` que la clé d'enregistrement == TSelfNS.
 *
 * Les génériques sont *contraints* : le développeur ne peut pas instancier
 * une Feature avec un Channel arbitraire.
 *
 * Pas de F-bounded polymorphism récursif (pas de Self-type).
 */
abstract class Feature<
  TEntityClass extends Entity<TJsonSerializable>,
  TChannel extends TChannelDefinition,
  TSelfNS extends string = string
> {
  // ❌ Plus de `static readonly namespace` — I68, ADR-0039.
  //    Le namespace est porté par la clé du manifest applicatif et injecté
  //    au constructeur (option c d'ADR-0039).

  /**
   * Namespace injecté au constructeur et immuable dès construction (I68, ADR-0039).
   * Typé par TSelfNS (chaîne littérale) — l'IDE propose la valeur exacte.
   */
  readonly #namespace: TSelfNS;

  /** Lecture du namespace — typée par TSelfNS de la sous-classe. */
  get namespace(): TSelfNS {
    return this.#namespace;
  }

  /**
   * Constructeur de l'Entity concrète — getter abstrait obligatoire
   * (D17 amendé par [ADR-0037](../../adr/ADR-0037-feature-generic-entity-class.md)).
   */
  protected abstract get Entity(): new () => TEntityClass;

  /** L'Entity de cette Feature — typée par la classe concrète (I22, ADR-0037) */
  protected readonly entity: TEntityClass;

  /**
   * Constructeur — reçoit le namespace injecté par Application au bootstrap
   * (option c d'ADR-0039) et instancie l'Entity via D17.
   *
   * Le framework appelle ce constructeur au bootstrap (RFC-0001 §5.1 étape 5)
   * en lisant la clé du manifest applicatif. Le développeur ne l'appelle jamais
   * directement.
   */
  constructor(namespace: TSelfNS) {
    assertValidNamespace(namespace); // filet runtime (ADR-0039 §Filet)
    this.#namespace = namespace;
    this.entity = new this.Entity();
  }

  /** Cycle de vie */
  protected onInit(): void | Promise<void>;
  protected onDestroy(): void | Promise<void>;
}
```

> **Invariants respectés** : I21 (namespace unique via manifest), I22 (1:1:1),
> I6 (seule la Feature modifie son Entity), I68–I72 (autorité manifest,
> ADR-0039).

> **Pas de self-type récursif (`Feature<Self, ...>`)** :
> Contrairement au pattern `Class<Child extends Class<Child>>` où la classe
> abstraite reçoit le type concret en générique (nécessaire quand la
> vérification des handlers introspecte les méthodes de la classe concrète
> via `keyof Child`), Bonsai dérive les contrats **uniquement** depuis la
> `TChannelDefinition` — sans connaître le type concret de la Feature.
>
> Côté **View** (ADR-0042, I88), la cohérence est imposée compile-time via
> `implements TViewCallbacks<TVC>` (handlers DOM + channel dérivés du
> contrat). Côté **Feature**, en strate 0, il n'y a pas de clause
> `implements` équivalente — la cohérence des handlers `on{Cmd}Command` /
> `on{Req}Request` / `on{NS}{Event}Event` est vérifiée au bootstrap par
> auto-discovery (I48). Une cohérence compile-time côté Feature
> (`TCommandHandlers<TDef>` / `TRequestHandlers<TDef>`) est un sujet
> strate 1+ — voir hors-scope ADR-0040.
>
> Résultat : `Feature<TEntity, TChannelDef, TSelfNS>` — trois génériques
> (Entity, Channel, namespace), zéro récursion. Pour les cas où un retour
> typé `this` est nécessaire (chaînage), TypeScript fournit le type
> polymorphe `this` nativement, sans F-bounded.

---

## 2. Déclaration Channel — pratique (D13, ADR-0040)

> Pour le **concept Channel** (tri-lane, événement `any`, sémantiques runtime) → voir [communication.md](../2-architecture/communication.md).
> Cette section couvre la **pratique** : comment déclarer un Channel, le type `TChannelDefinition`,
> le pattern token statique sur la classe Feature (ADR-0040) et la co-localisation (D13).

### Type `TChannelDefinition`

Un Channel a **trois facettes** distinctes :

| Facette                          | Nature                                              | Visibilité                                  |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| `TChannelDefinition` (type)      | Contrat tri-lane (commands / events / requests)     | Public — co-localisé dans `*.feature.ts` (I74) |
| `TChannelToken<TDef, NS>` (type) | Pont typé classe Feature ↔ contrat (ADR-0040, I73)  | Public — exposé via `static readonly channel` |
| `Channel<TDef>` (classe runtime) | Registres de handlers, dispatch                     | Interne framework — jamais exposé (D15, I80) |

Le développeur applicatif manipule **uniquement** le type `TChannelDefinition` et le token statique. L'instance runtime `Channel<TDef>` est un détail d'implémentation, créé au bootstrap par `Application` depuis le manifest (ADR-0039).

```typescript
// @bonsai/event — packages/event/src/channel.class.ts
type TChannelDefinition = {
  readonly commands: Record<string, unknown>;
  readonly events:   Record<string, unknown>;
  readonly requests: Record<string, { params: unknown; result: unknown }>;
};

type TChannelToken<TDef extends TChannelDefinition, NS extends string = string> = {
  readonly namespace: NS;
  readonly _def?: TDef;   // phantom — jamais assigné runtime, sert au compile-time
};
```

> **Le `namespace` n'est PAS sur `TChannelDefinition`** — il vit sur `TChannelToken<TDef, NS>` (paramètre de type `NS`). Cette séparation découple le contrat de communication (les lanes typées) de l'identité applicative (la clé du manifest, ADR-0039 — I68).

### Pattern `Channel<TDef>` typé sur la classe Feature (ADR-0040, ADR-0039, ADR-0042)

> **Le pattern historique « TS `namespace` regroupant Channel/State/token » (D14, pré-ADR-0040) est supersédé.** Plus de `export namespace Cart {…}`, plus de `declareChannel<T>(ns)`. La classe Feature porte directement son token statique.

```typescript
import { Feature } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { Entity } from "@bonsai/entity";

// Type Channel (compile-time uniquement) — co-localisé au fichier.
type TCartDef = {
  readonly commands: {
    addItem:    { productId: string; qty: number };
    removeItem: { productId: string };
  };
  readonly events: {
    itemAdded:   { productId: string; qty: number };
    itemRemoved: { productId: string };
  };
  readonly requests: {
    getItemCount: { params: void; result: number };
    getTotal:     { params: void; result: number };
  };
};

// Entity co-localisée (D13).
class CartEntity extends Entity<{ items: TCartItem[]; total: number }> {
  protected defineInitialState() { return { items: [], total: 0 }; }
}

// Feature paramétrée par <TEntityClass, TChannelDef, TSelfNS> (ADR-0040, ADR-0037).
// `TSelfNS = "cart"` ancre la classe à la clé du manifest applicatif (ADR-0039, I72).
// AUCUN `static namespace` (I68) — le namespace est injecté au constructeur.
export class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  // Token typé exposé en `static readonly channel` (ADR-0040, I73) —
  // référencé par les consommateurs via `TFeatureContract.{ns}.feature` (ADR-0042).
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };

  // Tokens des Channels externes ÉCOUTÉS — Events entrants (C3, I77).
  static readonly listens: readonly TChannelToken<TChannelDefinition, string>[] = [];

  // Tokens des Channels externes INTERROGÉS — Requests sortantes (C5, I79).
  static readonly queries: readonly TChannelToken<TChannelDefinition, string>[] = [];

  protected get Entity() { return CartEntity; }

  // C2 — Command handler auto-découvert par convention de nommage (I48).
  // Strate 0 : signature `(payload) => void` sans metas (ADR-0040 §615).
  onAddItemCommand(payload: TCartDef["commands"]["addItem"]): void {
    this.entity.mutate("addItem", (draft) => { /* ... */ });
    this.emit("itemAdded", { productId: payload.productId, qty: payload.qty });
  }

  // C4 — Reply auto-découvert.
  onGetItemCountRequest(_params: void): number {
    return this.entity.state.items.length;
  }
}
```

> **Pourquoi plus de `namespace Cart` ni de `declareChannel`** ? Le manifest applicatif (ADR-0039) est désormais l'autorité unique des namespaces. Il n'y a plus besoin de regrouper « types + valeurs » sous un nom commun :
> - Le **type Channel** (`TCartDef`) reste compile-time, importé directement.
> - Le **token runtime** (`CartFeature.channel`) est porté par la classe elle-même (ADR-0040, I73).
> - Le **namespace** (`"cart"`) vit comme `TSelfNS` paramétré sur la classe (I72) ET comme clé du manifest (I68).
> - Les **consommateurs** (View/Behavior/Composer) référencent `typeof CartFeature` dans `TFeatureContract.{ns}.feature` (ADR-0042) — pas de `Cart.Channel` à propager.

### Co-localisation Channel/Feature (D13)

> **D13** : le Channel, le State et le token sont définis dans le **même fichier** que la Feature.

| Aspect           | Fichier séparé        | Co-localisé (D13) |
| ---------------- | --------------------- | ----------------- |
| Cohérence        | 2 fichiers à modifier | 1 seul fichier    |
| Navigation IDE   | 2 onglets             | 1 onglet          |
| Import           | 2 imports             | 1 import          |
| Risque de désync | Oui                   | Non               |

```
Cart/
  cart.feature.ts       ← Cart namespace + CartFeature class
  cart.entity.ts        ← CartEntity class
```

> Le seul fichier qui exporte des types publics est `*.feature.ts`.
> L'Entity est un détail d'implémentation interne de la Feature.

---

## 3. Déclarations statiques

> **Décision D11 amendée par [ADR-0040](../../adr/ADR-0040-typescript-first-api-channel-definition-typed.md)** : chaque Feature expose son contrat via un `static readonly channel: TChannelToken<TDef, NS>` (I73). Les Channels externes consommés sont déclarés via `static readonly listens` (Events) et `static readonly queries` (Requests) — listes de `TChannelToken`.
>
> **Amendement [ADR-0039](../../adr/ADR-0039-namespace-authority-and-uniqueness.md)** : la classe Feature ne déclare **plus** de `static readonly namespace` (I68). L'identité est portée par la **clé du manifest applicatif** (I68, I69) et **injectée au constructeur** (I68, option c). Le paramètre de type `TSelfNS` déclare en signature le namespace attendu, vérifié contre la clé du manifest par `StrictManifest<M>` au `satisfies` (I72).

```typescript
import { Feature } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { InventoryFeature } from "../Inventory/inventory.feature";
import { PricingFeature } from "../Pricing/pricing.feature";
import { UserFeature } from "../User/user.feature";

class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  // ❌ Plus de `static readonly namespace = "cart"` — I68, ADR-0039.
  //    Le namespace est injecté au constructeur via le manifest applicatif.

  /** Token du Channel propre (I73, ADR-0040) — pont typé vers `TCartDef`. */
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };

  /** Channels externes écoutés — Events uniquement (C3, I77). Pluriel. */
  static readonly listens: readonly TChannelToken<TChannelDefinition, string>[] = [
    InventoryFeature.channel,
    PricingFeature.channel,
  ];

  /** Channels externes interrogés — Requests uniquement (C5, I79). Pluriel. */
  static readonly queries: readonly TChannelToken<TChannelDefinition, string>[] = [
    UserFeature.channel,
  ];

  /** Liaison Feature → Entity concrète (D17 amendé par ADR-0037). */
  protected get Entity() { return CartEntity; }

  // ... les méthodes onXXX auto-découvertes (voir §5)
}
```

> **Limitation TypeScript — `abstract static` n'existe pas** : la présence de `static readonly channel`, `listens`, `queries` ne peut pas être imposée compile-time aux sous-classes. Filets de sécurité : type `TFeatureClass` (constructeur typé), validation runtime au bootstrap, tests de type (`tests/types/`). Cf. `packages/feature/src/bonsai-feature.ts:144-167`.

### Manifest applicatif (ADR-0039)

L'enregistrement de la Feature se fait via un **manifest applicatif** typé
(I69, pattern A bis — type-manifest séparé du value-manifest) :

```typescript
// app/manifest.ts — TYPE-MANIFEST (interface explicite, zéro classe importée)
export interface AppManifest {
  user: unknown;
  cart: unknown;
}
export type AppNamespace = keyof AppManifest;
export type ExternalOf<TSelfNS extends AppNamespace> = Exclude<
  AppNamespace,
  TSelfNS
>;
export type StrictManifest<M> = {
  [K in keyof M & string]: new (namespace: K) => Feature<any, any, K>;
};
```

```typescript
// app/main.ts — VALUE-MANIFEST (satisfies vérifie la cohérence)
import type { AppManifest, StrictManifest } from "@app/manifest.js";
import { UserFeature } from "@user/user.feature.js";
import { CartFeature } from "@cart/cart.feature.js";

const features = {
  user: UserFeature,
  cart: CartFeature
  // cart: AnotherFeature,  ← TS1117 : clé dupliquée → I21, I24
  // Cart: CartFeature,     ← clé non camelCase → never → I21
  // local: SomethingFeature ← réservé → never → I57, I71
  // user: CartFeature,     ← TSelfNS "cart" ≠ clé "user" → erreur satisfies → I72
} satisfies StrictManifest<AppManifest>;

const app = new Application({ foundation: AppFoundation, features });
app.start();
```

> **`Application.register()` est supprimée** (I69, D-η ADR-0039). L'enregistrement
> se fait exclusivement via le manifest passé au constructeur d'Application.

> **Note ADR-0024** : les Features conservent les déclarations `static readonly listens` et `static readonly queries` car le framework les lit depuis la **classe** (pas l'instance) au bootstrap (étape 5, D6). Ce pattern est distinct du value-first ADR-0024 qui s'applique aux composants de la couche concrète (View, Composer, Behavior, Foundation) dont les déclarations sont lues depuis l'instance via `get features()` / `get uiEvents()` / `get uiElements()` (ADR-0042).

> **DX — asymétrie compile-time avec View** : contrairement à View qui dispose de `implements TViewCallbacks<TVC>` (ADR-0042 — handlers vérifiés compile-time), Feature **n'a pas** d'`implements` pour les handlers `on{Cmd}Command` / `on{Req}Request`. La présence des handlers est vérifiée au bootstrap (auto-discovery I48, filets runtime). Une cohérence compile-time côté Feature est un sujet strate 1+ — voir hors-scope ADR-0040 §549. Pour l'instant : autocomplétion IDE limitée aux signatures dérivées du `TChannelDefinition` consommé dans `this.emit(name, payload)` et `this.entity.mutate(intent, recipe)`.

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

### C2 — `handle` : implicite via convention `onXXX` (§5)

Pas de méthode `handle()` explicite — les Commands entrants sont routés automatiquement vers les méthodes `onXxxCommand()` (D12, I48). Auto-discovery au bootstrap (`#registerCommandHandlers()`). Pas d'`implements` côté Feature en strate 0 — voir asymétrie compile-time avec View documentée en §3.

### C3 — `listen` : implicite via convention `onXXX` (§5)

Pas de méthode `listen()` explicite — les Events des Channels déclarés en `static readonly listens` sont routés vers `on<Namespace><EventName>Event()` (D12, I48). Auto-discovery au bootstrap (`#registerEventListeners()`).

### C4 — `reply` : implicite via convention `onXXX` (§5)

Pas de méthode `reply()` explicite — les Requests entrantes sont routées vers `onXxxRequest()` qui retourne `T | null` synchrone (D9 révisé par ADR-0023). Auto-discovery au bootstrap (`#registerRequestRepliers()`).

### C5 — `request()` : interroger une Feature externe

Signature actuelle (cf. `packages/feature/src/bonsai-feature.ts:260-269`) :

```typescript
/**
 * Interroge un Channel externe via son token (I79, ADR-0040).
 *
 * - token       : `TChannelToken<TDef, TNS>` — typiquement `OtherFeature.channel`
 * - requestName : clé de TDef['requests'] (vérifiée compile-time, I76)
 * - params      : typé depuis TDef['requests'][K]['params']
 * - Retourne    : TDef['requests'][K]['result'] | null
 *                 `null` si le replier throw ou si le Channel n'est pas enregistré (D44 révisé)
 *
 * Strate 0 : signature sans metas (ADR-0040 §615). Strate 1 ajoutera
 *            `options: { metas: TMessageMetas }` via un ADR dédié.
 */
protected request<
  TDef extends TChannelDefinition,
  TNS extends string,
  K extends keyof TDef['requests'] & string
>(
  token: TChannelToken<TDef, TNS>,
  requestName: K,
  params: TDef['requests'][K]['params']
): TDef['requests'][K]['result'] | null;
```

> `request()` est la **seule capacité sortante explicite** côté Feature (avec `emit` qui agit sur le propre Channel). Les trois autres (handle, listen, reply) sont implicites via les conventions `onXXX` auto-découvertes (I48).

> **Comparaison avec `View.trigger("ns:cmd", payload)`** : côté View/Behavior, l'API consommateur passe par une **clé namespacée flat** (ADR-0042) au lieu d'un token explicite — voir [view.md §1](../4-couche-concrete/view.md). L'asymétrie est volontaire : Feature a un import direct de la classe consommée (couplage de code accepté), View consomme exclusivement via `TFeatureContract` (Channel privé derrière Feature, I80).

---

## 5. Méthodes auto-découvertes `onXXX`

> **Décision D12** : les handlers sont des **méthodes conventionnelles auto-découvertes**
> par le framework. Le suffixe (`Command`, `Event`, `Request`) discrimine le type de message.
> Les paramètres et le retour sont typés depuis la déclaration Channel.

### Convention de nommage

| Type                       | Pattern                           | Paramètre                                    | Retour                            | Exemple                                                                      |
| -------------------------- | --------------------------------- | -------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| **Command** (C2 handle)    | `on<MessageName>Command`          | `payload: T` (strate 0) — `payload: T, metas: TMessageMetas` (cible strate 1) | `void`                            | `onAddItemCommand(payload: AddItemPayload)`                                  |
| **Event** (C3 listen)      | `on<ChannelName><EventName>Event` | `payload: T` (strate 0) — `payload: T, metas: TMessageMetas` (cible strate 1) | `void`                            | `onInventoryStockUpdatedEvent(payload: StockPayload)`                        |
| **Request** (C4 reply)     | `on<RequestName>Request`          | `params: P` ou `void` (strate 0) — `+ metas: TMessageMetas` (cible strate 1)  | `T \| null` (D9 révisé, ADR-0023) | `onTotalRequest(params: void): number \| null`                               |
| **Entity per-key** (D16)   | `on<Key>EntityUpdated`            | `prev: T, next: T, patches: Patch[]`         | `void`                            | `onItemsEntityUpdated(prev: CartItem[], next: CartItem[], patches: Patch[])` |
| **Entity catch-all** (D16) | `onAnyEntityUpdated`              | `event: TEntityEvent`                        | `void`                            | `onAnyEntityUpdated(event: TEntityEvent)`                                    |

> **Phasage strate 0 → strate 1 sur les metas** (ADR-0028 §148, ADR-0040 §615) : en strate 0 actuelle, les handlers Command/Event/Request reçoivent uniquement le payload (1 paramètre). Le second paramètre `metas: TMessageMetas` (`correlationId`, `causationId`, `hop`, `origin`, `timestamp` — cf. [glossaire](../reference/glossaire.md)) sera ajouté en strate 1 via un ADR dédié amendant ADR-0040. Les exemples ci-dessous montrent la signature **strate 0 actuelle**.

> Pour les Entity handlers, voir [RFC-0002-entity §6 Notifications](../3-couche-abstraite/entity.md#6-notifications-entity--feature).

### Exemples

```typescript
import { Feature } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { InventoryFeature } from "../Inventory/inventory.feature";
import { PricingFeature } from "../Pricing/pricing.feature";

class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  // namespace injecté au constructeur via le manifest applicatif (ADR-0039, I68)
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
  static readonly listens: readonly TChannelToken<TChannelDefinition, string>[] = [
    InventoryFeature.channel,
  ];
  static readonly queries: readonly TChannelToken<TChannelDefinition, string>[] = [
    PricingFeature.channel,
  ];

  protected get Entity() { return CartEntity; }

  // ── C2 handle : Commands entrants sur son propre Channel ──

  /** Reçoit le Command cart:addItem — déclenché par une View via trigger() */
  onAddItemCommand(payload: { productId: string; qty: number }): void {
    // Mute l'Entity via mutate(), puis émet un Event
    this.entity.mutate("addItem", (draft) => {
      draft.items.push({ productId: payload.productId, qty: payload.qty });
    });
    this.emit("itemAdded", { productId: payload.productId, qty: payload.qty });
  }

  /** Reçoit le Command cart:removeItem */
  onRemoveItemCommand(payload: { productId: string }): void {
    this.entity.mutate("removeItem", (draft) => {
      draft.items = draft.items.filter(
        (i) => i.productId !== payload.productId
      );
    });
    this.emit("itemRemoved", { productId: payload.productId });
  }

  // ── C3 listen : Events d'autres Features ──

  /** Écoute l'Event inventory:stockUpdated */
  onInventoryStockUpdatedEvent(payload: { productId: string; stock: number }): void {
    if (payload.stock === 0) {
      this.entity.mutate("markOutOfStock", (draft) => {
        const item = draft.items.find((i) => i.productId === payload.productId);
        if (item) item.outOfStock = true;
      });
      this.emit("itemOutOfStock", { productId: payload.productId });
    }
  }

  // ── C4 reply : Requests entrantes sur son propre Channel ──

  /** Répond au Request cart:items — délègue à l'Entity */
  onItemsRequest(_params: void): CartItem[] | null {
    return this.entity.query.getItems();
  }

  /** Répond au Request cart:total — délègue à l'Entity */
  onTotalRequest(_params: void): number | null {
    return this.entity.query.getTotal();
  }
}
```

### Workflow complet : types → implémentation → récompense

Exemple end-to-end illustrant la philosophie TypeScript-first (ADR-0040, ADR-0039, ADR-0042) :

```typescript
// ────────────────────────────────────────────────────────────
// ÉTAPE 1 — Déclarer le type Channel (co-localisé, D13, I74)
// ────────────────────────────────────────────────────────────

import { Feature } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { Entity, type TEntityStructure } from "@bonsai/entity";

// 1a. Le contrat de communication (TChannelDefinition pur — sans namespace).
type TCartDef = {
  readonly commands: {
    addItem:    { productId: string; qty: number };
    removeItem: { productId: string };
    clear:      void;
  };
  readonly events: {
    itemAdded:      { productId: string; qty: number };
    itemRemoved:    { productId: string };
    itemOutOfStock: { productId: string };
    totalUpdated:   { total: number; previous: number };
    cleared:        void;
  };
  readonly requests: {
    items: { params: void; result: Array<{ productId: string; qty: number }> };
    total: { params: void; result: number };
  };
};

// 1b. L'état (Entity) — TEntityStructure concrète (= TJsonSerializable).
type TCartState = TEntityStructure & {
  items: Array<{ productId: string; qty: number; outOfStock?: boolean }>;
  total: number;
  lastUpdated: number;
};

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0, lastUpdated: 0 };
  }
}

// ────────────────────────────────────────────────────────────
// ÉTAPE 2 — Implémenter la classe Feature
//
// Note : pas d'`implements` côté Feature en strate 0 (asymétrie
// volontaire avec View qui dispose de `TViewCallbacks`). La présence
// des handlers est vérifiée au bootstrap (auto-discovery I48).
// ────────────────────────────────────────────────────────────

class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  // namespace injecté au constructeur via le manifest applicatif (ADR-0039, I68)
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
  static readonly listens: readonly TChannelToken<TChannelDefinition, string>[] = [];
  static readonly queries: readonly TChannelToken<TChannelDefinition, string>[] = [];

  protected get Entity() { return CartEntity; }

  // ── Commands ──

  onAddItemCommand(payload: { productId: string; qty: number }): void {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push({ productId: payload.productId, qty: payload.qty });
    });
    this.emit("itemAdded", payload);
  }

  onRemoveItemCommand(payload: { productId: string }): void {
    this.entity.mutate("removeItem", (draft) => {
      draft.items = draft.items.filter(
        (i) => i.productId !== payload.productId
      );
    });
    this.emit("itemRemoved", payload);
  }

  onClearCommand(_payload: void): void {
    this.entity.mutate("clear", (draft) => { draft.items = []; });
    this.emit("cleared", undefined);
  }

  // ── Requests ──

  onItemsRequest(
    _params: void
  ): Array<{ productId: string; qty: number }> | null {
    return this.entity.query.getItems();
  }

  onTotalRequest(_params: void): number | null {
    return this.entity.query.getTotal();
  }
}

// ────────────────────────────────────────────────────────────
// ÉTAPE 3 — Récompense (DX TypeScript-first)
//
//   ✓ this.emit("foo", …)     → erreur TS si "foo" ∉ TCartDef.events
//   ✓ this.emit("itemAdded", { qty: "1" }) → erreur TS sur le payload
//   ✓ Si on renomme un event dans TCartDef → erreur en cascade chez
//     tous les consommateurs qui le listen via TFeatureContract (ADR-0042)
//   ✓ Autocomplétion des clés de TCartDef.events / .requests dans
//     this.emit(…) et this.entity.mutate(…)
//
// ⚠ Limitation strate 0 — handler manquant côté Feature :
//   Si on oublie onClearCommand alors que TCartDef.commands.clear existe,
//   le compilateur ne le signale pas (pas d'`implements TCommandHandlers`).
//   Le bootstrap throw au mount (I48 — auto-discovery échoue à câbler
//   "clear"). Cohérence compile-time côté Feature = sujet strate 1+.
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
  TEntity extends Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition,
  TSelfNS extends string = string
> {
  /**
   * Constructeur de l'Entity concrète — getter abstrait obligatoire
   * (D17 amendé par ADR-0037). Chaque Feature concrète retourne sa classe
   * Entity. Le retour est typé par TEntity : `this.entity` est typé par
   * la classe concrète, plus aucun cast nécessaire pour accéder à `query`.
   */
  protected abstract get Entity(): new () => TEntity;

  /** Accès direct à l'Entity — Feature est le seul propriétaire (I6, I22). */
  get entity(): TEntity { /* ... */ }

  /**
   * Constructeur (cf. §1) — reçoit le namespace injecté par Application
   * au bootstrap (ADR-0039, I68 option c). L'Entity est créée par
   * `bootstrap()` (Phase 3), pas par le constructeur lui-même.
   */
  constructor(namespace: TSelfNS) { /* ... */ }
}
```

<!--
  La Feature accède à son Entity directement via `this.entity`.
  C'est la seule exception au découplage par Channel :
  la relation Feature ↔ Entity est directe, pas événementielle.

  Le getter `abstract get Entity()` (D17 amendé par ADR-0037) garantit
  au compile-time que chaque Feature concrète fournit son constructeur
  Entity. La base class instancie via `new EntityCtor()` lors de
  `bootstrap()` (cf. packages/feature/src/bonsai-feature.ts:222-242).

  Le getter (et non une propriété) est nécessaire car les
  initialiseurs de propriétés s'exécutent après super() —
  un getter sur le prototype est déjà résolu dans le constructeur parent.

  Aucun autre composant n'a accès à `this.entity` :
  - Les Views/Behaviors lisent le state via callRequest() (C5)
  - Les autres Features lisent via request() (C5, D3)
  - Personne ne mute l'Entity sauf la Feature propriétaire (I6)
-->

---

## 7. Cycle de vie

Les hooks de cycle de vie sont des **méthodes framework internes** (L1),
pas des Events sur un Channel. Le framework les appelle directement.

| Hook          | Quand                                           | Usage typique                                 |
| ------------- | ----------------------------------------------- | --------------------------------------------- |
| `onInit()`    | Après instanciation, après câblage des Channels | Chargement initial de données, setup          |
| `onDestroy()` | Avant destruction au shutdown                   | Cleanup, sauvegarde, libération de ressources |

```typescript
abstract class Feature<
  TEntity extends Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition,
  TSelfNS extends string = string
> {
  protected abstract get Entity(): new () => TEntity;
  get entity(): TEntity { /* ... */ }

  constructor(namespace: TSelfNS) { /* ... cf. §1 ... */ }

  /** Appelé par le framework après instanciation et câblage (bootstrap étape 5). */
  protected onInit(): void | Promise<void> {}

  /** Appelé par le framework au shutdown avant destruction. */
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

| État          | Entrée (déclencheur)                               | Sorties possibles         | Notes                                                            |
| ------------- | -------------------------------------------------- | ------------------------- | ---------------------------------------------------------------- |
| `registered`  | `app.register(FeatureClass)`                       | → `wired` (bootstrap)     | Validation namespace (I21)                                       |
| `wired`       | Câblage Radio — Channels résolus, handlers indexés | → `initialized`           | Erreur si handler manquant ou duplicate                          |
| `initialized` | `onInit()` terminé                                 | → `active`                | `onInit()` async attendu (D18)                                   |
| `active`      | Bootstrap complet                                  | → `destroying` (shutdown) | Phase nominale — traite Commands, émet Events, répond à Requests |
| `destroying`  | `app.stop()`                                       | → `destroyed`             | `onDestroy()` appelé. Ordre : inverse de registration            |
| `destroyed`   | Nettoyage complet                                  | — (terminal)              | Entity déréférencée, subscriptions supprimées                    |

> **Garantie de séquence** : une Feature ne peut pas recevoir de Command avant d'être
> en état `active`. Le bootstrap garantit que la couche abstraite est intégralement
> initialisée avant que la couche concrète (Views) ne soit créée (RFC-0001 §5.1).

### 7.2 Gestion des erreurs dans les handlers

#### Erreurs dans `onXxxCommand`

Un Command handler peut échouer pour deux raisons distinctes :

| Situation                | Comportement attendu                                                                                                                                                               | Exemple                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Refus métier**         | Le handler n'exécute pas la mutation et n'émet pas d'Event. Il peut émettre un Event d'erreur métier dédié.                                                                        | `cart:addItem` avec `qty <= 0` — ne pas muter, émettre `cart:itemRejected` |
| **Exception inattendue** | Capturée par le framework, logguée avec contexte causal complet. L'exception ne propage pas aux autres composants. Voir [ADR-0002](../adr/ADR-0002-error-propagation-strategy.md). | Erreur réseau dans un handler d'IO Feature                                 |

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

| Niveau                          | Description                        | Recommandation                                    |
| ------------------------------- | ---------------------------------- | ------------------------------------------------- |
| **Idempotent strict**           | Deux exécutions = même state final | ✅ Préféré (ex: `setX`, `markAs`)                 |
| **Non-idempotent contrôlé**     | Effet cumulatif explicite et voulu | ✅ Acceptable (ex: `addItem`, `increment`)        |
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

| Indicateur                  | Seuil d'alerte                  | Action recommandée                                  |
| --------------------------- | ------------------------------- | --------------------------------------------------- |
| Nombre de Commands > 10     | God Feature potentielle         | Découper en Features par sous-domaine               |
| Nombre de `listen` > 5      | Dépendances croisées excessives | Créer une Feature d'intégration dédiée              |
| Handler > 30 lignes         | Logique mal placée              | Extraire dans des méthodes privées ou dans l'Entity |
| Entity avec > 15 propriétés | State trop large                | Découper en deux Features avec Entities séparées    |

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

| Erreur             | State       | Historique    | Continue ?  | Mode dev | Mode prod |
| ------------------ | ----------- | ------------- | ----------- | -------- | --------- |
| **MutationError**  | ❌ Rollback | ❌ Non ajouté | Non         | throw    | throw     |
| **CommandError**   | ❌ Pas muté | —             | Non         | throw    | throw     |
| **RequestError**   | —           | —             | Non         | reject   | reject    |
| **BroadcastError** | ✅ Conservé | ✅ Conservé   | ✅ Oui      | throw    | log       |
| **ListenerError**  | —           | —             | ✅ Oui      | throw    | log       |
| **TimeoutError**   | —           | —             | Non         | reject   | reject    |
| **NoHandlerError** | —           | —             | —           | throw    | warn      |
| **RenderError**    | —           | —             | ✅ Boundary | throw    | boundary  |
| **BehaviorError**  | —           | —             | ✅ Oui      | throw    | log       |

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
class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  protected onError(error: BonsaiError): void {
    if (error instanceof RequestError && error.request === "pricing:getPrice") {
      this.useCachedPrice(); // Retry avec cache
      return;
    }
    if (error instanceof MutationError) {
      this.emit("cart:error", { message: "Action failed, please retry" });
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
