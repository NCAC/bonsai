# Feature

> **Unité métier : classe abstraite, 5 capacités, handlers auto-découverts, déclaration Channel, cycle de vie**

[← Retour à la couche abstraite](README.md) · [← Communication](../2-architecture/communication.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Feature |
| **Couche** | Abstraite (persistante) |
| **Statut** | 🟢 Stable |

> ## Statut normatif
>
> Décisions : [ADR-01](../../adr/ADR-01-channels-tri-lane.md) (5 capacités), [ADR-09](../../adr/ADR-09-feature-contract.md) (contrat), [ADR-14](../../adr/ADR-14-contrats-types.md) (contrats typés).
>
> Ce document fait foi pour le **contrat Feature** : classe abstraite, 5 capacités, handlers `onXXX`, cycle de vie.
> Il fait également foi pour la **pratique de déclaration Channel** : `TChannelDefinition`, `TChannelToken`, `static readonly channel` (ADR-14), co-localisation (ADR-09, I74).
> Les mutations Entity utilisent `mutate(intent, recipe)` **ou** `mutate(intent, { payload?, metas? }, recipe)` — les deux overloads sont **livrés** (strate 1a, `packages/entity/src/bonsai-entity.ts`), pas une cible future ([ADR-10](../../adr/ADR-10-entity-mutation.md)). Ce qui reste **cible strate 1** : la propagation de `metas: TMessageMetas` dans la signature des handlers `onXXXCommand`/`onXXXEvent`/`onXXXRequest` (§4, §5) — non encore câblée dans `packages/feature/src/bonsai-feature.ts`.
> L'identité de la Feature (namespace) est portée par le **manifest applicatif** (I68–I72, [ADR-08](../../adr/ADR-08-namespace-manifest.md)) : pas de `static namespace` sur la classe.
> Le contrat des handlers — `listens`/`queries` en `abstract get` d'instance, `implements TFeatureCallbacks<TDef, TListens>`, `TStrictFeatureClass` (I92–I95) — est détaillé en §3 et §3bis.
> Pour le **concept Channel** (tri-lane, événement `any`, sémantiques runtime) → voir [communication.md](../2-architecture/communication.md).

---

> ### ⏳ Périmètre d'implémentation (ADR-31)
>
> Ce document décrit le **contrat cible** de Feature. Les éléments suivants ne sont **pas encore implémentés** :
>
> | Élément | Strate cible | Sections concernées |
> | --- | --- | --- |
> | Paramètre `metas` des handlers et option `{ metas }` de `emit()`/`request()` | Strate 1b | §4, §5, §8 |
> | Isolation des exceptions de handlers Command (`CommandError`) | Strate 1b | §8 |
> | `onDestroy()`, états `destroying`/`destroyed`, `onInit()` asynchrone attendu | Strate 1 | §7, §8 |
> | Hook `onError()` et `ErrorReporter` | Strate 1 | §8 (modèle d'erreurs) |
>
> **Périmètre effectif livré (strate 0 + ADR-09)** : `Feature<TEntity, TChannelDef, TSelfNS>` ; `static readonly channel` ; `abstract get listens()`/`get queries()` ; `implements TFeatureCallbacks` (compile-time) ; constructeur inerte (I94) ; `bootstrap()` (Channel, Entity, auto-découverte des handlers Command/Request/Event/Entity sur le **prototype direct** de la classe, puis `onInit()`) ; `emit(eventName, payload)` et `request(token, name, params)` **sans metas** ; getter public `namespace`, getter `protected` `entity` (I6) ; `onInit()` synchrone, public, sans support async.
>
> **I92 — portée exacte** : la couverture des handlers de listen est garantie **uniquement au compile-time** (`implements TFeatureCallbacks`, TS2515/TS2416). Il n'existe **pas** de filet runtime symétrique à celui de View (I82) et il n'est **pas prévu d'en construire un** : `get listens()` ne porte que des tokens de Channel (pas les noms d'événements attendus), donc l'auto-discovery runtime (`#registerEventListeners`, I48) n'a aucune liste indépendante à laquelle comparer les méthodes présentes — elle peut enregistrer un handler mal nommé qui ne matche rien, jamais détecter une omission. Un contournement du typage (`as any`, JS pur) omettant un handler passe donc inaperçu au runtime. Voir §3bis.

## 📋 Table des matières

1. [Classe abstraite Feature](#1-classe-abstraite-feature)
2. [Déclaration Channel — pratique (ADR-09, ADR-14)](#2-déclaration-channel--pratique-adr-09-adr-14)
3. [Déclaration du contrat — `channel` statique, `listens`/`queries` d'instance](#3-déclaration-du-contrat--channel-statique-listensqueries-dinstance)
   - 3bis. [`TFeatureCallbacks` et `TStrictFeatureClass` (ADR-09)](#3bis-tfeaturecallbacks-et-tstrictfeatureclass-adr-09)
4. [Les 5 capacités — signatures](#4-les-5-capacités--signatures)
5. [Méthodes auto-découvertes `onXXX`](#5-méthodes-auto-découvertes-onxxx)
6. [Accès à l'Entity](#6-accès-à-lentity)
7. [Cycle de vie](#7-cycle-de-vie)
8. [Sémantiques lifecycle et échecs](#8-sémantiques-lifecycle-et-échecs)

---

## 1. Classe abstraite Feature

La Feature est paramétrée par sa structure Entity et sa définition Channel.

Le framework **infère et vérifie** les méthodes `onXXX` à la compilation
via les mapped types définis dans [conventions-typage.md §5.2](../6-transversal/conventions-typage.md#52-mapped-types--handlers-requis-dérivés-du-contrat-adr-09-adr-14).

```typescript
/**
 * Classe abstraite Feature — paramétrée par la classe Entity concrete, le Channel
 * et le namespace self-type (I68–I72, ADR-08).
 *
 * TEntity est contraint à Entity<TJsonSerializable> (ADR-09, ADR-10) :
 * la Feature est typée par sa CLASSE Entity, pas par la forme du state.
 * Cela encode I22 (1:1:1 namespace ↔ Feature ↔ Entity) au type-level
 * et élimine tout cast `as ConcreteEntity` dans le code applicatif.
 *
 * TChannelDef est contraint à TChannelDefinition.
 *
 * TSelfNS est le namespace auquel cette Feature s'attend à être enregistrée
 * dans le manifest applicatif (ADR-08, I72). La classe reste **anonyme en
 * valeur** (aucun littéral n'apparaît dans son code hors annotation de type)
 * mais **typée en signature** : le manifest vérifie au compile-time via
 * `StrictManifest<M>` que la clé d'enregistrement == TSelfNS.
 *
 * Les trois génériques ont une valeur par défaut (`Entity<TJsonSerializable>`,
 * `TChannelDefinition`, `string`) pour un usage non paramétré ; une Feature
 * concrète les renseigne toujours.
 *
 * Pas de F-bounded polymorphism récursif (pas de Self-type).
 */
abstract class Feature<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> {
  // ❌ Plus de `static readonly namespace` — I68, ADR-08.
  //    Le namespace est porté par la clé du manifest applicatif et injecté
  //    au constructeur (option c d'ADR-08).

  /**
   * Tokens des Channels externes écoutés / interrogés (I93, ADR-09) : `abstract get`
   * d'INSTANCE, obligatoires sur toute Feature concrète (TS2515 sinon). Lus par
   * `Application.start()` en Phase 0c (I70).
   */
  abstract get listens(): readonly TChannelToken<TChannelDefinition, string>[];
  abstract get queries(): readonly TChannelToken<TChannelDefinition, string>[];

  /**
   * Namespace injecté au constructeur et immuable dès construction (I68, ADR-08).
   * Typé par TSelfNS (chaîne littérale) — l'IDE propose la valeur exacte.
   */
  readonly #namespace: TSelfNS;

  /** Lecture du namespace — typée par TSelfNS de la sous-classe. */
  get namespace(): TSelfNS {
    return this.#namespace;
  }

  /**
   * Constructeur de l'Entity concrète — getter abstrait obligatoire
   * ([ADR-09](../../adr/ADR-09-feature-contract.md)).
   */
  protected abstract get Entity(): new () => TEntity;

  /**
   * L'Entity de cette Feature — typée par la classe concrète (I22, ADR-09).
   * `protected` : inaccessible hors de la Feature et de ses sous-classes (I6).
   * Instanciée par `bootstrap()` (Phase 3) — jamais dans le constructeur (I94).
   */
  protected get entity(): TEntity;

  /**
   * Constructeur — **inerte** (I94, [ADR-09](../../adr/ADR-09-feature-contract.md)).
   * Reçoit le namespace injecté par `Application.start()` en **Phase 0b**
   * (option c d'ADR-08) et ne fait rien d'autre que le valider et
   * l'assigner. Aucun side-effect Radio/Entity n'est autorisé ici — un
   * sentinel runtime (snapshot `Radio.me().getChannelNames()` avant/après
   * `new FeatureClass(ns)`) le vérifie au bootstrap et throw en cas de dérive.
   *
   * L'Entity est instanciée **plus tard**, en Phase 3 (`bootstrap()`), pas
   * dans le constructeur — voir §6.
   *
   * Le framework appelle ce constructeur au bootstrap. Le développeur ne
   * l'appelle jamais directement.
   */
  constructor(namespace: TSelfNS) {
    assertValidNamespace(namespace); // filet runtime (ADR-08)
    this.#namespace = namespace;
  }

  /**
   * Bootstrap (Phase 3, appelé par Application — ou à la main dans un test) :
   * récupère le Channel propre, instancie l'Entity, câble les handlers
   * Command/Request/Event/Entity (I48, I96), puis appelle `onInit()`.
   * Idempotent : un second appel est un no-op.
   */
  bootstrap(): void;

  // Capacités sortantes `emit()` (C1) et `request()` (C5) : `protected`, voir §4.

  /**
   * Cycle de vie — cf. §7. Seul `onInit()` est livré : public, synchrone,
   * sans support async (`onDestroy()` est une cible strate 1, cf. bandeau
   * de périmètre en tête de document).
   */
  onInit(): void;
}
```

> **Invariants respectés** : I21 (namespace unique via manifest), I22 (1:1:1),
> I6 (seule la Feature modifie son Entity), I68–I72 (autorité manifest,
> ADR-08), I94 (ctor inerte, [ADR-09](../../adr/ADR-09-feature-contract.md)).
>
> **Pas de self-type récursif (`Feature<Self, ...>`)** :
> Contrairement au pattern `Class<Child extends Class<Child>>` où la classe
> abstraite reçoit le type concret en générique (nécessaire quand la
> vérification des handlers introspecte les méthodes de la classe concrète
> via `keyof Child`), Bonsai dérive les contrats **uniquement** depuis la
> `TChannelDefinition` — sans connaître le type concret de la Feature.
>
> Côté **View** (ADR-14, I88), la cohérence est imposée compile-time via
> `implements TViewCallbacks<TVC>` (handlers DOM + channel dérivés du
> contrat). Côté **Feature**, depuis [ADR-09](../../adr/ADR-09-feature-contract.md)
> (I88 élargi, I92), la même symétrie s'applique : `implements
> TFeatureCallbacks<TDef, TListens>` impose au compilateur la présence et la
> signature exactes de `on{Cmd}Command`, `on{Req}Request` et
> `on{NS}{Event}Event` pour chaque message déclaré. Handler manquant → TS2515 ;
> signature fautive → TS2416. Cette garantie est **strictement compile-time** :
> l'auto-discovery runtime (I48) enregistre les handlers présents mais n'a
> aucune liste indépendante des noms attendus pour détecter une omission —
> contrairement à View, dont `features[ns].listens: string[]` explicite permet
> cette vérification (I82). Voir §3bis pour le détail de `TFeatureCallbacks`
> et la portée exacte de cette garantie (I92).
>
> Résultat : `Feature<TEntity, TChannelDef, TSelfNS>` — trois génériques
> (Entity, Channel, namespace), zéro récursion. Pour les cas où un retour
> typé `this` est nécessaire (chaînage), TypeScript fournit le type
> polymorphe `this` nativement, sans F-bounded.

---

## 2. Déclaration Channel — pratique (ADR-09, ADR-14)

> Pour le **concept Channel** (tri-lane, événement `any`, sémantiques runtime) → voir [communication.md](../2-architecture/communication.md).
> Cette section couvre la **pratique** : comment déclarer un Channel, le type `TChannelDefinition`,
> le pattern token statique sur la classe Feature (ADR-14) et la co-localisation (ADR-09).

### Type `TChannelDefinition`

Un Channel a **trois facettes** distinctes :

| Facette | Nature | Visibilité |
| --- | --- | --- |
| `TChannelDefinition` (type) | Contrat tri-lane (commands / events / requests) | Public — co-localisé dans `*.feature.ts` (I74) |
| `TChannelToken<TDef, NS>` (type) | Pont typé classe Feature ↔ contrat (ADR-14, I73) | Public — exposé via `static readonly channel` |
| `Channel<TDef>` (classe runtime) | Registres de handlers, dispatch | Interne framework — non exporté par `@bonsai/core` (ADR-14, I80) |

Le développeur applicatif manipule **uniquement** le type `TChannelDefinition` et le token statique. L'instance runtime `Channel<TDef>` est un détail d'implémentation, créé au bootstrap par `Application` depuis le manifest (ADR-08).

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

> **Le `namespace` n'est PAS sur `TChannelDefinition`** — il vit sur `TChannelToken<TDef, NS>` (paramètre de type `NS`). Cette séparation découple le contrat de communication (les lanes typées) de l'identité applicative (la clé du manifest, ADR-08 — I68).

### Pattern `Channel<TDef>` typé sur la classe Feature (ADR-14, ADR-08)

> La classe Feature porte directement son token statique ; il n'y a pas de wrapper `namespace` TypeScript ni d'utilitaire `declareChannel()`.

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
    itemCount: { params: void; result: number };
    total:     { params: void; result: number };
  };
};

// Entity co-localisée (ADR-09).
class CartEntity extends Entity<{ items: TCartItem[]; total: number }> {
  protected defineInitialState() { return { items: [], total: 0 }; }
}

// Feature paramétrée par <TEntityClass, TChannelDef, TSelfNS> (ADR-14, ADR-09).
// `TSelfNS = "cart"` ancre la classe à la clé du manifest applicatif (ADR-08, I72).
// AUCUN `static namespace` (I68) — le namespace est injecté au constructeur.
// (`implements TFeatureCallbacks<…>` omis ici pour rester centré sur la
//  déclaration Channel — voir l'exemple complet en §3bis.)
export class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  // Token typé exposé en `static readonly channel` (ADR-14, I73) —
  // référencé par les consommateurs via `TFeatureContract.{ns}.feature` (ADR-14).
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };

  // Tokens des Channels externes ÉCOUTÉS — Events entrants (C3, I2).
  // `abstract get` d'INSTANCE depuis ADR-09 (I93) — plus un `static readonly`.
  get listens(): readonly TChannelToken<TChannelDefinition, string>[] { return []; }

  // Tokens des Channels externes INTERROGÉS — Requests sortantes (C5, I79).
  get queries(): readonly TChannelToken<TChannelDefinition, string>[] { return []; }

  protected get Entity() { return CartEntity; }

  // C2 — Command handler auto-découvert par convention de nommage (I48).
  // Strate 0 : signature `(payload) => void` sans metas (ADR-14).
  onAddItemCommand(payload: TCartDef["commands"]["addItem"]): void {
    this.entity.mutate("addItem", (draft) => { /* ... */ });
    this.emit("itemAdded", { productId: payload.productId, qty: payload.qty });
  }

  // C4 — Reply auto-découvert. Requête "itemCount" → handler onItemCountRequest
  // (convention nominale ADR-09 : la clé de TDef['requests'] porte déjà le nom complet).
  onItemCountRequest(_params: void): number {
    return this.entity.state.items.length;
  }
}
```

> **Où vit chaque élément** — le manifest applicatif (ADR-08) est l'autorité unique des namespaces ; aucun regroupement « types + valeurs » sous un nom commun n'est nécessaire :
>
> - Le **type Channel** (`TCartDef`) reste compile-time, importé directement.
> - Le **token runtime** (`CartFeature.channel`) est porté par la classe elle-même (ADR-14, I73).
> - Le **namespace** (`"cart"`) vit comme `TSelfNS` paramétré sur la classe (I72) ET comme clé du manifest (I68).
> - Les **consommateurs** (View/Behavior/Composer) référencent `typeof CartFeature` dans `TFeatureContract.{ns}.feature` (ADR-14) — pas de `Cart.Channel` à propager.

### Co-localisation Channel/Feature (ADR-09)

> **ADR-09** : le Channel, le State et le token sont définis dans le **même fichier** que la Feature.

| Aspect | Fichier séparé | Co-localisé (ADR-09) |
| --- | --- | --- |
| Cohérence | 2 fichiers à modifier | 1 seul fichier |
| Navigation IDE | 2 onglets | 1 onglet |
| Import | 2 imports | 1 import |
| Risque de désync | Oui | Non |

```text
Cart/
  cart.feature.ts       ← Cart namespace + CartFeature class
  cart.entity.ts        ← CartEntity class
```

> Le seul fichier qui exporte des types publics est `*.feature.ts`.
> L'Entity est un détail d'implémentation interne de la Feature.

---

## 3. Déclaration du contrat — `channel` statique, `listens`/`queries` d'instance

> **[ADR-14](../../adr/ADR-14-contrats-types.md) et [ADR-09](../../adr/ADR-09-feature-contract.md)** : chaque Feature expose son contrat via un `static readonly channel: TChannelToken<TDef, NS>` (I73, toujours statique). Les Channels externes consommés sont déclarés via `abstract get listens()` (Events) et `abstract get queries()` (Requests) — **getters d'instance**, pas des `static readonly` (I93). La sémantique « tokens portés par `listens`/`queries` » est inchangée depuis ADR-14 ; seule la syntaxe change (I79 amendé).
>
> **Amendement [ADR-08](../../adr/ADR-08-namespace-manifest.md)** : la classe Feature ne déclare **plus** de `static readonly namespace` (I68). L'identité est portée par la **clé du manifest applicatif** (I68, I69) et **injectée au constructeur** (I68, option c). Le paramètre de type `TSelfNS` déclare en signature le namespace attendu, vérifié contre la clé du manifest par `StrictManifest<M>` au `satisfies` (I72).

```typescript
import { Feature, type TFeatureCallbacks } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { InventoryFeature } from "../Inventory/inventory.feature";
import { PricingFeature } from "../Pricing/pricing.feature";
import { UserFeature } from "../User/user.feature";

const cartListens = [
  InventoryFeature.channel,
  PricingFeature.channel,
] as const;

class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  // ❌ Plus de `static readonly namespace = "cart"` — I68, ADR-08.
  //    Le namespace est injecté au constructeur via le manifest applicatif.

  /** Token du Channel propre (I73, ADR-14) — pont typé vers `TCartDef`. Reste `static`. */
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };

  /** Channels externes écoutés — Events uniquement (C3, I2). `abstract get` d'instance (I93). */
  get listens() { return cartListens; }

  /** Channels externes interrogés — Requests uniquement (C5, I79). `abstract get` d'instance (I93). */
  get queries(): readonly TChannelToken<TChannelDefinition, string>[] {
    return [UserFeature.channel];
  }

  /** Liaison Feature → Entity concrète (ADR-09). */
  protected get Entity() { return CartEntity; }

  // ... les méthodes onXXX requises par `implements TFeatureCallbacks<…>` (voir §3bis et §5)
}
```

> **`channel` reste `static` — `listens`/`queries` sont des `abstract get` d'instance** : cette asymétrie est volontaire. `channel` identifie la _classe_ (consommé sans instance, ex. `CartFeature.channel` par une View — I73) ; `listens`/`queries` alimentent le contrat `TFeatureCallbacks` (I92), qui a besoin d'un type d'instance pour la clause `implements`. `static readonly channel` reste donc la seule déclaration sans garde-fou `abstract static` (limitation TypeScript — `abstract static` n'existe pas) : filets de sécurité pour `channel` uniquement — type `TStrictFeatureClass<NS>` (§3bis), validation runtime au bootstrap (Phase 0a), tests de type (`tests/types/`). `listens`/`queries`, eux, sont garantis par le compilateur : une sous-classe qui omet l'un des deux getters lève `TS2515` (« Non-abstract class does not implement inherited abstract member »).

### Manifest applicatif (ADR-08)

L'enregistrement de la Feature se fait via un **manifest applicatif** typé
(I69, pattern A bis — type-manifest séparé du value-manifest) :

```typescript
// app/manifest.ts — TYPE-MANIFEST (`type` explicite — pas `interface`,
// conventions-typage.md §3 : ADR-08 lui-même utilise `type AppManifest`,
// zéro classe importée)
// `StrictManifest<M>` n'est PAS redéfini ici : il vient de `@bonsai/feature`
// (packages/feature/src/types.ts), la seule source de vérité — une redéfinition
// locale perdrait les vérifications camelCase (I21) et namespace réservé
// (I57, I71) portées par `StrictManifest<M>` réel (`K extends CamelCaseNamespace<K>
// ? K extends ReservedNamespace ? never : TStrictFeatureClass<K, TDef> : never`).
// `AppNamespace` et `ExternalOf` sont, eux, de simples helpers d'application :
// le framework ne les exporte pas.
export type AppManifest = {
  user: unknown;
  cart: unknown;
};
export type AppNamespace = keyof AppManifest;
export type ExternalOf<TSelfNS extends AppNamespace> = Exclude<
  AppNamespace,
  TSelfNS
>;
```

```typescript
// app/main.ts — VALUE-MANIFEST (satisfies vérifie la cohérence)
import type { AppManifest } from "@app/manifest.js";
import type { StrictManifest } from "@bonsai/feature";
import { UserFeature } from "@user/user.feature.js";
import { CartFeature } from "@cart/cart.feature.js";

const features = {
  user: UserFeature,
  cart: CartFeature
  // cart: AnotherFeature,  ← TS1117 : clé dupliquée → I21
  // Cart: CartFeature,     ← clé non camelCase → never → I21
  // local: SomethingFeature ← réservé → never → I57, I71
  // user: CartFeature,     ← TSelfNS "cart" ≠ clé "user" → erreur satisfies → I72
} satisfies StrictManifest<AppManifest>;

const app = new Application({ foundation: AppFoundation, features });
app.start();
```

> Il n'y a pas d'`Application.register()` (I69) : l'enregistrement passe
> exclusivement par le manifest passé au constructeur d'Application.
>
> **Note ([ADR-14](../../adr/ADR-14-contrats-types.md), [ADR-09](../../adr/ADR-09-feature-contract.md))** : `listens`/`queries` sont lus sur l'**instance** (`abstract get`), pas sur la classe. `Application.start()` les lit en **phase 0c**, après l'instanciation inerte (I94) et avant tout effet sur Radio, pour valider les références croisées (I70). C'est le même principe value-first que côté View (`get features()`, `get uiEvents()`, `get uiElements()`).
>
> **Symétrie compile-time avec View** : comme View avec `implements TViewCallbacks<TVC>` (ADR-14), Feature dispose de `implements TFeatureCallbacks<TDef, TListens>` (I88 élargi, I92) — handlers `on{Cmd}Command` / `on{Req}Request` / `on{NS}{Event}Event` vérifiés **compile-time** (TS2515 si absent, TS2416 si signature fautive). Cette garantie ne va pas jusqu'au runtime : l'auto-discovery (I48) enregistre les handlers présents mais ne détecte pas une omission (cf. §3bis, I92). Voir §3bis.

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

### 3bis. `TFeatureCallbacks` et `TStrictFeatureClass` (ADR-09)

> Cette section documente le contrat introduit par [ADR-09](../../adr/ADR-09-feature-contract.md)
> (I88 élargi, I92–I95) : la symétrie Contract/Callbacks, déjà en place côté View
> (ADR-14), portée à Feature.

#### `TFeatureCallbacks<TDef, TListens>` — enforcement compile-time des handlers (I92)

`implements TFeatureCallbacks<TDef, TListens>` impose au compilateur la présence
**et** la signature exacte de tous les handlers dérivés du contrat Channel :

| Handlers dérivés | Pour chaque… | Type intermédiaire |
| --- | --- | --- |
| `on{Cmd}Command` | `K ∈ keyof TDef["commands"]` | `TCommandCallbacks<TDef>` |
| `on{Req}Request` | `K ∈ keyof TDef["requests"]` | `TRequestCallbacks<TDef>` |
| `on{NS}{Evt}Event` | `(token, event) ∈ TListens[number]` | `TListenCallbacks<TListens>` |

```typescript
// packages/feature/src/types.ts (extrait, signatures réelles)
type TFeatureCallbacks<
  TDef extends TChannelDefinition,
  TListens extends readonly TChannelToken<TChannelDefinition, string>[] = readonly []
> = TCommandCallbacks<TDef> & TRequestCallbacks<TDef> & TListenCallbacks<TListens>;
```

Handler oublié → `TS2515` (« Non-abstract class does not implement inherited abstract
member »). Signature fautive (payload/retour incorrect) → `TS2416`.

> **`TListenCallbacks` et `UnionToIntersection`** : sans ce wrapper, la distributivité
> d'un type conditionnel sur `TListens[number]` produirait une **union** d'objets
> `{ …cart } | { …wishlist }` — que TypeScript refuse comme cible `implements`
> (`TS2422`). `UnionToIntersection` fusionne l'union en intersection, seule forme
> utilisable par `implements`.

#### `TStrictFeatureClass<NS, TDef>` — contrainte du manifest applicatif (I95)

Contrainte compile-time appliquée à chaque entrée du manifest via `StrictManifest<M>` :

```typescript
// packages/feature/src/types.ts (extrait, signature réelle)
type TStrictFeatureClass<
  TNS extends string,
  TDef extends TChannelDefinition = TChannelDefinition
> = (new (namespace: TNS) => Feature<Entity<TJsonSerializable>, TDef, TNS>) & {
  readonly channel: TChannelToken<TDef, TNS>;
};
```

Exige : un constructeur `(namespace: TNS) => Feature<…, TDef, TNS>` (force
`TSelfNS === TNS`, I72) et un `static channel: TChannelToken<TDef, TNS>` présent
**et** aligné (`channel.namespace === TNS`, I73/I22).

> **I95 ne couvre PAS la couverture des handlers** — un type-manifest à valeurs
> `unknown` ([ADR-08](../../adr/ADR-08-namespace-manifest.md))
> ne permet pas d'extraire `TDef` par clé, donc aucune inférence de handlers n'est
> possible au point manifest. C'est `implements TFeatureCallbacks<…>` (I92), porté
> par chaque classe concrète, qui garantit cette couverture — pas `StrictManifest<M>`.

#### Exemple complet — `CartFeature` conforme (I92, I93, I95)

```typescript
import { Feature, type TFeatureCallbacks } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { Entity } from "@bonsai/entity";

type TCartDef = {
  readonly commands: { addItem: { productId: string; qty: number } };
  readonly events: { itemAdded: { productId: string; qty: number } };
  readonly requests: { total: { params: null; result: number } };
};

class CartEntity extends Entity<{ items: unknown[]; total: number }> {
  protected defineInitialState() { return { items: [], total: 0 }; }
}

const cartListens = [] as const; // aucun Channel externe écouté ici

class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  // static — I73, identifie la CLASSE, consommable sans instance.
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };

  // abstract get d'INSTANCE — I93.
  get listens() { return cartListens; }
  get queries() { return [] as const; }

  protected get Entity() { return CartEntity; }

  // Requis par TCommandCallbacks<TCartDef> — omis → TS2515.
  onAddItemCommand(payload: { productId: string; qty: number }): void {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push(payload);
    });
    this.emit("itemAdded", payload);
  }

  // Requis par TRequestCallbacks<TCartDef> — omis → TS2515.
  onTotalRequest(_params: null): number {
    return this.entity.state.total;
  }
}
```

> Si `TCartDef.commands` gagne une clé `removeItem` sans que `CartFeature`
> implémente `onRemoveItemCommand` : erreur de compilation immédiate, sans
> attendre le bootstrap.

---

## 4. Les 5 capacités — signatures

Les 5 capacités (C1–C5) d'une Feature, telles qu'elles sont
disponibles via `this` dans le contexte d'une Feature :

### C1 — `emit()` : émettre un Event sur son propre Channel

```typescript
/**
 * Émet un Event sur le Channel propre de la Feature (I1).
 *
 * - eventName : doit correspondre à une clé de TChannel['events']
 * - payload : typé depuis TChannel['events'][eventName]
 * - Cardinalité : 1:N (broadcast vers tous les listeners)
 *
 * Strate 0 : signature sans metas. La strate 1b ajoutera un 3ᵉ paramètre
 * `options: { metas: TMessageMetas }` (cf. bandeau de périmètre en tête de document).
 */
protected emit<K extends keyof TChannel['events'] & string>(
  eventName: K,
  payload: TChannel['events'][K]
): void;
```

> Seule la Feature propriétaire peut `emit()` sur son Channel (I1).
> Les Views/Behaviors n'ont **jamais** accès à `emit()` (I4, ADR-01).

### C2 — `handle` : implicite via convention `onXXX` (§5)

Pas de méthode `handle()` explicite — les Commands entrants sont routés automatiquement vers les méthodes `onXxxCommand()` (ADR-09, I48). Auto-discovery au bootstrap (`#registerCommandHandlers()`). La présence de ces méthodes est en outre imposée **compile-time** via `implements TFeatureCallbacks<TDef, TListens>` depuis [ADR-09](../../adr/ADR-09-feature-contract.md) — voir §3bis.

### C3 — `listen` : implicite via convention `onXXX` (§5)

Pas de méthode `listen()` explicite — les Events des Channels déclarés via `get listens()` (I93) sont routés vers `on<Namespace><EventName>Event()` (ADR-09, I48). Auto-discovery au bootstrap (`#registerEventListeners()`).

### C4 — `reply` : implicite via convention `onXXX` (§5)

Pas de méthode `reply()` explicite — les Requests entrantes sont routées vers `onXxxRequest()` qui retourne `T | null` synchrone (ADR-02). Auto-discovery au bootstrap (`#registerRequestRepliers()`).

### C5 — `request()` : interroger une Feature externe

Signature actuelle (cf. `packages/feature/src/bonsai-feature.ts:270-280`) :

```typescript
/**
 * Interroge un Channel externe via son token (I79, ADR-14).
 *
 * - token       : `TChannelToken<TDef, TNS>` — typiquement `OtherFeature.channel`
 * - requestName : clé de TDef['requests'] (vérifiée compile-time, I76)
 * - params      : typé depuis TDef['requests'][K]['params']
 * - Retourne    : TDef['requests'][K]['result'] | null
 *                 `null` si le replier throw ou si le Channel n'est pas enregistré (ADR-02)
 *
 * Strate 0 : signature sans metas (ADR-14). Strate 1 ajoutera
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
>
> **Comparaison avec `View.trigger("ns:cmd", payload)`** : côté View/Behavior, l'API consommateur passe par une **clé namespacée flat** (ADR-14) au lieu d'un token explicite — voir [view.md §1](../4-couche-concrete/view.md). L'asymétrie est volontaire : Feature a un import direct de la classe consommée (couplage de code accepté), View consomme exclusivement via `TFeatureContract` (Channel privé derrière Feature, I80).

---

## 5. Méthodes auto-découvertes `onXXX`

> **Décision ADR-09** : les handlers sont des **méthodes conventionnelles auto-découvertes**
> par le framework. Le suffixe (`Command`, `Event`, `Request`) discrimine le type de message.
> Les paramètres et le retour sont typés depuis la déclaration Channel.

### Convention de nommage

| Type | Pattern | Paramètre | Retour | Exemple |
| --- | --- | --- | --- | --- |
| **Command** (C2 handle) | `on<MessageName>Command` | `payload: T` (strate 0) — `payload: T, metas: TMessageMetas` (cible strate 1) | `void` | `onAddItemCommand(payload: AddItemPayload)` |
| **Event** (C3 listen) | `on<ChannelName><EventName>Event` | `payload: T` (strate 0) — `payload: T, metas: TMessageMetas` (cible strate 1) | `void` | `onInventoryStockUpdatedEvent(payload: StockPayload)` |
| **Request** (C4 reply) | `on<RequestName>Request` | `params: P` ou `void` (strate 0) — `+ metas: TMessageMetas` (cible strate 1) | `T \| null` (ADR-02) | `onTotalRequest(params: void): number \| null` |
| **Entity per-key** (ADR-09) | `on<Key>EntityUpdated` | `prev: T, next: T, patches: Patch[]` | `void` | `onItemsEntityUpdated(prev: CartItem[], next: CartItem[], patches: Patch[])` |
| **Entity catch-all** (ADR-09) | `onAnyEntityUpdated` | `event: TEntityEvent` | `void` | `onAnyEntityUpdated(event: TEntityEvent)` |

> **Phasage strate 0 → strate 1 sur les metas** (ADR-31, ADR-14) : en strate 0 actuelle, les handlers Command/Event/Request reçoivent uniquement le payload (1 paramètre). Le second paramètre `metas: TMessageMetas` (`correlationId`, `causationId`, `hop`, `origin`, `timestamp` — cf. [glossaire](../reference/glossaire.md)) sera ajouté en strate 1 via un ADR dédié amendant ADR-14. Les exemples ci-dessous montrent la signature **strate 0 actuelle**.
>
> Pour les Entity handlers, voir [entity.md §6 Notifications](../3-couche-abstraite/entity.md#6-notifications-entity--feature).

### Exemples

```typescript
import { Feature, type TFeatureCallbacks } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { InventoryFeature } from "../Inventory/inventory.feature";
import { PricingFeature } from "../Pricing/pricing.feature";

const cartListens = [InventoryFeature.channel] as const;

class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  // namespace injecté au constructeur via le manifest applicatif (ADR-08, I68)
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
  get listens() { return cartListens; }
  get queries(): readonly TChannelToken<TChannelDefinition, string>[] {
    return [PricingFeature.channel];
  }

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

  /** Répond au Request cart:itemCount — délègue à l'Entity */
  onItemCountRequest(_params: void): number | null {
    return this.entity.query.getItemCount();
  }

  /** Répond au Request cart:total — délègue à l'Entity */
  onTotalRequest(_params: void): number | null {
    return this.entity.query.getTotal();
  }
}
```

### Workflow complet : types → implémentation → récompense

Exemple end-to-end illustrant la philosophie TypeScript-first (ADR-14, ADR-08) :

```typescript
// ────────────────────────────────────────────────────────────
// ÉTAPE 1 — Déclarer le type Channel (co-localisé, ADR-09, I74)
// ────────────────────────────────────────────────────────────

import { Feature, type TFeatureCallbacks } from "@bonsai/feature";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { Entity } from "@bonsai/entity";

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

// 1b. L'état (Entity) — structure concrète, contrainte à TJsonSerializable
//     par `Entity<TStructure extends TJsonSerializable>`.
type TCartState = {
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
// Depuis ADR-09 (I88 élargi, I92) : `implements TFeatureCallbacks<TDef, TListens>`
// impose au compilateur la présence de TOUS les handlers dérivés du contrat
// Channel — symétrie avec View et son `TViewCallbacks` (ADR-14).
// ────────────────────────────────────────────────────────────

const cartListens = [] as const; // aucun Channel externe écouté ici

class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  // namespace injecté au constructeur via le manifest applicatif (ADR-08, I68)
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
  get listens() { return cartListens; }
  get queries(): readonly TChannelToken<TChannelDefinition, string>[] { return []; }

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
//     tous les consommateurs qui le listen via TFeatureContract (ADR-14)
//   ✓ Autocomplétion des clés de TCartDef.events / .requests dans
//     this.emit(…) et this.entity.mutate(…)
//
// ✓ Depuis ADR-09 (I92) — handler manquant détecté COMPILE-TIME :
//   Si on oublie onClearCommand alors que TCartDef.commands.clear existe,
//   `implements TFeatureCallbacks<TCartDef, …>` lève TS2515 immédiatement —
//   cette garantie reste strictement compile-time (l'auto-discovery I48 ne
//   détecte pas une omission au runtime, cf. §3bis, I92).
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
   * (ADR-09). Chaque Feature concrète retourne sa classe
   * Entity. Le retour est typé par TEntity : `this.entity` est typé par
   * la classe concrète, plus aucun cast nécessaire pour accéder à `query`.
   */
  protected abstract get Entity(): new () => TEntity;

  /** Accès direct à l'Entity — Feature est le seul propriétaire (I6, I22). */
  protected get entity(): TEntity { /* ... */ }

  /**
   * Constructeur (cf. §1) — reçoit le namespace injecté par Application
   * au bootstrap (ADR-08, I68 option c). L'Entity est créée par
   * `bootstrap()` (Phase 3), pas par le constructeur lui-même.
   */
  constructor(namespace: TSelfNS) { /* ... */ }
}
```

<!--
  La Feature accède à son Entity directement via `this.entity`.
  C'est la seule exception au découplage par Channel :
  la relation Feature ↔ Entity est directe, pas événementielle.

  Le getter `abstract get Entity()` (ADR-09) garantit
  au compile-time que chaque Feature concrète fournit son constructeur
  Entity. La base class instancie via `new EntityCtor()` lors de
  `bootstrap()` (cf. packages/feature/src/bonsai-feature.ts:222-242).

  Le getter (et non une propriété) est nécessaire car les
  initialiseurs de propriétés s'exécutent après super() —
  un getter sur le prototype est déjà résolu dans le constructeur parent.

  Aucun autre composant n'a accès à `this.entity` :
  - Les Views/Behaviors lisent le state via request() (C5)
  - Les autres Features lisent via request() (C5, ADR-01)
  - Personne ne mute l'Entity sauf la Feature propriétaire (I6)
-->

---

## 7. Cycle de vie

Les hooks de cycle de vie sont des **méthodes framework internes** (L1),
pas des Events sur un Channel. Le framework les appelle directement.

| Hook | Quand | Usage typique | État |
| --- | --- | --- | --- |
| `onInit()` | Fin de `bootstrap()` (Phase 3), après câblage des handlers | Chargement initial de données, setup | ✅ livré — public, synchrone, sans support async |
| `onDestroy()` | Avant destruction au shutdown | Cleanup, sauvegarde, libération de ressources | ⏳ cible strate 1 — n'existe pas |

```typescript
abstract class Feature<
  TEntity extends Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition,
  TSelfNS extends string = string
> {
  protected abstract get Entity(): new () => TEntity;
  protected get entity(): TEntity { /* ... */ }

  constructor(namespace: TSelfNS) { /* ... cf. §1 ... */ }

  /**
   * Appelé par `bootstrap()` (Phase 3), après l'auto-découverte des handlers
   * Command/Request/Event/Entity. Public, synchrone — aucun support async :
   * si `onInit()` fait un travail asynchrone, `bootstrap()` ne l'attend pas.
   */
  onInit(): void {}

  // onDestroy() n'existe pas — cible strate 1 (cf. bandeau de périmètre en
  // tête de document). Aucun hook de shutdown n'est appelé aujourd'hui.
}
```

> Ces hooks ne passent pas par les Channels — ce sont des appels directs
> du framework : aucun Channel de cycle de vie (voir [application.md §6](application.md#6-pas-de-channel-app)).

`onInit()` est appelé pour chaque Feature dans l'ordre du manifest, de façon
strictement synchrone (phase 3 du bootstrap).

---

## 8. Sémantiques lifecycle et échecs

### 8.1 Machine à états de la Feature 🧭 cible — non livrée

> **Écart avec le code** : `Feature` ne porte aucune machine à états. Le seul
> indicateur interne est un booléen privé `#bootstrapped` (`bootstrap()` est
> idempotent : un second appel est un no-op). L'enregistrement passe
> exclusivement par le manifest (§3) et `Application.stop()` n'existe pas encore.
> Le schéma ci-dessous est le modèle **cible**.

```text
registered → wired → initialized → active → destroying → [destroyed]
```

| État | Entrée (déclencheur) | Sorties possibles | Notes |
| --- | --- | --- | --- |
| `registered` | Entrée dans le manifest applicatif | → `wired` (bootstrap) | Validation namespace (I21) |
| `wired` | Câblage Radio — Channels résolus, handlers indexés | → `initialized` | Erreur si handler dupliqué (I10) ; handler manquant non détecté au runtime (I92, §3bis) |
| `initialized` | `onInit()` terminé | → `active` | `onInit()` synchrone — pas d'attente possible (§7) |
| `active` | Bootstrap complet | → `destroying` (shutdown) | Phase nominale — traite Commands, émet Events, répond à Requests |
| `destroying` | ⏳ non livré (`onDestroy()` inexistant) | → `destroyed` | ⏳ cible strate 1 |
| `destroyed` | ⏳ non livré | — (terminal) | ⏳ cible strate 1 |

> **Garantie de séquence effectivement livrée** : une Feature ne peut pas recevoir de
> Command avant que son propre `bootstrap()` ait câblé ses handlers. Le bootstrap de
> `Application` instancie et câble intégralement la couche abstraite (Phases 0b/0c/1/3)
> avant de créer la Foundation et les Views (Phase 4, cf. [lifecycle.md](../2-architecture/lifecycle.md)).

### 8.2 Gestion des erreurs dans les handlers

#### Erreurs dans `onXxxCommand`

Un Command handler peut échouer pour deux raisons distinctes :

| Situation | Comportement **livré** | Exemple |
| --- | --- | --- |
| **Refus métier** | Le handler n'exécute pas la mutation et n'émet pas d'Event. Il peut émettre un Event d'erreur métier dédié. | `cart:addItem` avec `qty <= 0` — ne pas muter, émettre `cart:itemRejected` |
| **Exception inattendue** | **Non capturée** : `Channel.trigger()` invoque le handler sans `try/catch` (`packages/event/src/channel.class.ts`) — l'exception **se propage** jusqu'à l'appelant de `trigger()` (typiquement une View). `CommandError` est définie dans `@bonsai/error` mais n'est **jamais levée** par le code livré. L'isolation décrite par [ADR-05](../../adr/ADR-05-propagation-erreurs.md) est une **cible strate 1b** (cf. bandeau de périmètre). | Erreur réseau dans un handler d'IO Feature |

> **Convention de refus métier** : ne pas lever d'exception pour un refus métier prévisible.
> Préférer un Event dédié (`xxx:rejected`, `xxx:failed`) avec le motif dans le payload.
> Les exceptions sont pour les cas vraiment inattendus (erreurs de programmation, pannes) —
> mais tant que l'isolation n'est pas livrée, une exception inattendue casse l'appelant.

```typescript
// ✅ Refus métier via Event dédié — strate 0 : signature sans metas (cf. bandeau de périmètre)
onAddItemCommand(payload: { productId: string; qty: number }): void {
  if (payload.qty <= 0) {
    this.emit('itemRejected', { productId: payload.productId, reason: 'invalid-qty' });
    return; // pas de mutation, pas d'exception
  }
  this.entity.mutate('cart:addItem', { payload }, draft => {
    draft.items.push({ productId: payload.productId, qty: payload.qty });
  });
  this.emit('itemAdded', payload);
}
```

#### Erreurs dans `onXxxRequest`

Un request handler retourne `T | null` synchrone (ADR-02). Si le handler throw,
`Channel.request()` capture l'erreur (`console.error`, sans lever de `RequestError`), et retourne
`null` au consommateur (ADR-02, I55) — ce comportement **est** livré.

```typescript
// ✅ Gestion explicite dans le handler — strate 0 : signature sans metas
onTotalRequest(params: void): number | null {
  try {
    return this.entity.query.getTotal();
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
| --- | --- | --- |
| **Idempotent strict** | Deux exécutions = même state final | ✅ Préféré (ex: `setX`, `markAs`) |
| **Non-idempotent contrôlé** | Effet cumulatif explicite et voulu | ✅ Acceptable (ex: `addItem`, `increment`) |
| **Non-idempotent involontaire** | Duplication d'état par inattention | ❌ Anti-pattern (ex: push sans check d'existance) |

```typescript
// ✅ Non-idempotent contrôlé — addItem ajoute, c'est attendu (strate 0 : sans metas)
onAddItemCommand({ productId, qty }: AddItemPayload): void {
  this.entity.mutate('cart:addItem', { payload: { productId, qty } }, draft => {
    const existing = draft.items.find(i => i.productId === productId);
    if (existing) {
      existing.qty += qty; // cumul explicite
    } else {
      draft.items.push({ productId, qty });
    }
  });
}

// ✅ Idempotent strict — setStatus écrase, pas de duplication
onSetStatusCommand({ status }: { status: string }): void {
  this.entity.mutate('user:setStatus', { payload: { status } }, draft => {
    draft.status = status; // idempotent : même résultat si appelé N fois
  });
}
```

### 8.3 Granularité des Features — lignes directrices

> La section suivante est **informative** — voir [Framework Style Guide](../../guides/FRAMEWORK-STYLE-GUIDE.md)
> pour les conventions détaillées.

| Indicateur | Seuil d'alerte | Action recommandée |
| --- | --- | --- |
| Nombre de Commands > 10 | God Feature potentielle | Découper en Features par sous-domaine |
| Nombre de `listen` > 5 | Dépendances croisées excessives | Créer une Feature d'intégration dédiée |
| Handler > 30 lignes | Logique mal placée | Extraire dans des méthodes privées ou dans l'Entity |
| Entity avec > 15 propriétés | State trop large | Découper en deux Features avec Entities séparées |

> **Anti-pattern God Feature** — voir [Anti-patterns](../reference/anti-patterns.md#-god-feature).
> Une Feature bien calibrée répond à une seule question : "de quoi suis-je responsable ?"

### 8.4 Modèle d'erreurs — hiérarchie `BonsaiError`

> **Absorbé depuis** : [ADR-05](../../adr/ADR-05-propagation-erreurs.md) (Accepted).
> La taxonomie et la hiérarchie TypeScript ci-dessous sont **livrées** (`@bonsai/error`,
> `packages/error/src/bonsai-error.class.ts`) : les 10 classes existent et sont exportées.
> En revanche, seule une partie est **effectivement levée** par le code — voir la matrice
> de comportement, qui distingue les deux.

#### Taxonomie des erreurs Bonsai (10 classes, livrées)

```text
┌─────────────────────────────────────────────────────────────────┐
│                        ERREURS BONSAI                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENTITY LAYER (State) — LEVÉES (packages/entity)                │
│  ├── MutationError        : recipe throw → Immer rollback       │
│  └── EntityReentrancyError : mutate() en ré-entrance excessive  │
│                              (ADR-31 strate 1a, I98)           │
│                                                                 │
│  FEATURE LAYER (Logic)                                         │
│  ├── CommandError      : onXxxCommand() throw — définie, JAMAIS │
│  │                       levée par le code livré (cf. §8.2)     │
│  ├── RequestError      : onXxxRequest() throw/reject — définie, │
│  │                       JAMAIS levée (Channel.request() capture│
│  │                       et journalise via console.error)       │
│  └── BroadcastError    : onXxxEntityUpdated() throw — LEVÉE     │
│                          (#dispatchEntityEvent, I96)             │
│                                                                 │
│  CHANNEL LAYER (Communication)                                 │
│  ├── ListenerError        : Event listener throw — LEVÉE        │
│  ├── NoHandlerError       : trigger() sans handle() — LEVÉE     │
│  └── DuplicateHandlerError : handle()/reply() en double — LEVÉE │
│                              (I10)                               │
│                                                                 │
│  VIEW LAYER (UI)                                               │
│  ├── RenderError       : Projection/template throw — définie,  │
│  │                       pas de mécanisme de capture livré      │
│  └── BehaviorError     : Behavior throw — définie ; le package  │
│                          Behavior n'existe pas encore           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

> Pas de `TimeoutError` : `request()` est synchrone (ADR-02), aucune notion
> de délai n'existe.

#### Classe de base `BonsaiError`

```typescript
// packages/error/src/bonsai-error.class.ts (signature réelle)
export class BonsaiError extends Error {
  override readonly name: string = "BonsaiError";

  constructor(
    message: string,
    readonly invariantId: string,
    readonly component: string = "",
    readonly suggestion: string = ""
  ) {
    super(
      `[${invariantId}]${component ? ` ${component}` : ""} — ${message}${suggestion ? `\n  → ${suggestion}` : ""}`
    );
  }
}
```

> `BonsaiError` est **concrète** (pas `abstract`), sans champ `code` ni `cause` :
> le contexte causal est porté par `invariantId` (identifiant d'invariant ou d'ADR,
> ex. `"I10"`) et `component` (namespace concerné), pas par des `metas`. Chaque
> sous-classe ne fait qu'hériter — aucune n'ajoute de champ contextuel additionnel
> dans le code livré (contrairement à ce qu'impliquerait une hiérarchie à 9 classes
> avec champs typés par classe — la hiérarchie livrée compte 10 classes plates).

#### Matrice de comportement

| Erreur | Levée par le code livré ? | State | Continue ? | Comportement réel |
| --- | --- | --- | --- | --- |
| **MutationError** | ✅ Oui (`Entity#runCycle`) | ❌ Rollback (Immer n'a jamais appliqué le recipe qui a throw) | Non — throw | Propage à l'appelant de `mutate()` (la Feature) |
| **EntityReentrancyError** | ✅ Oui (`Entity`, profondeur de ré-entrance, I98) | — | Non — throw | Propage à l'appelant de `mutate()` ; ⚠️ levée depuis un handler de Feature (`on<Key>EntityUpdated`, `onAnyEntityUpdated`), elle est attrapée par `#dispatchEntityEvent` et journalisée en `BroadcastError` |
| **CommandError** | ❌ Jamais | — | — | Exception non capturée : propage jusqu'à l'appelant de `trigger()` (§8.2) |
| **RequestError** | ❌ Jamais | — | — | `Channel.request()` capture le throw, journalise via `console.error`, retourne `null` |
| **BroadcastError** | ✅ Oui (`#dispatchEntityEvent`, I96) | ✅ Conservé (mutation déjà appliquée) | ✅ Oui — notification suivante non interrompue | `console.error` |
| **ListenerError** | ✅ Oui (`Channel.listen`) | — | ✅ Oui — autres listeners non affectés | `console.error` |
| **NoHandlerError** | ✅ Oui (`Channel.trigger`) | — | Non — throw | Propage à l'appelant |
| **DuplicateHandlerError** | ✅ Oui (`Channel.handle`/`reply`, I10) | — | Non — throw au bootstrap | Propage |
| **RenderError** | ⏳ Pas de mécanisme de capture livré | — | — | — |
| **BehaviorError** | ⏳ Package Behavior non livré | — | — | — |

> Les modes « dev »/« prod » différenciés (`throw` en dev, `log`/`warn` en prod)
> décrits par ADR-05 ne sont **pas** livrés : le comportement ci-dessus est
> unique, indépendant de `__DEV__`.

#### Principe clé : séparation Mutation vs Broadcast

Ce principe **est** livré :

```typescript
// MUTATION : erreur dans recipe → state intact — comportement livré
onAddItemCommand(payload: { productId: string; qty: number }): void {
  this.entity.mutate("cart:addItem", { payload }, draft => {
    throw new Error("Validation failed");
    // → Immer rollback automatique → MutationError levée par Entity#runCycle
    //   → State INTACT → propage jusqu'ici (non catchée par le Command
    //     handler dans cet exemple) → propage à son tour à l'appelant de
    //     trigger() (§8.2, cible strate 1b pour l'isolation)
  });
}

// BROADCAST : erreur dans handler Entity → state CONSERVÉ — comportement livré (I96)
onItemsEntityUpdated(prev, next, patches) {
  this.emit('itemsUpdated', { items: next });
  throw new Error("Analytics failed");
  // → State DÉJÀ MODIFIÉ (mutation réussie)
  // → BroadcastError loguée via console.error (#dispatchEntityEvent)
  // → Les autres handlers per-key et le catch-all sont quand même appelés
}
```

#### Recovery Hook — `onError()`

> ⏳ Cible strate 1, non livré.
>
> `onError()` n'existe pas sur `Feature`. Aucun mécanisme de recovery
> configurable par sous-classe n'est livré aujourd'hui — les erreurs listées
> dans la matrice ci-dessus soit propagent, soit sont journalisées via
> `console.error` sans point d'extension. L'API suivante est une **proposition
> non implémentée**, à ne pas utiliser dans le code applicatif actuel :
>
> ```typescript
> // ⏳ Cible — n'existe pas dans le code livré
> class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
>   protected onError(error: BonsaiError): void {
>     if (error instanceof MutationError) {
>       this.emit("itemRejected", { reason: "mutation-failed" });
>       return;
>     }
>     super.onError(error); // Comportement par défaut — hypothétique
>   }
> }
> ```

#### ErrorReporter — infrastructure transversale

> ⏳ Cible strate 1, non livré.
>
> Aucun `ErrorReporter` n'existe dans le code livré — les erreurs sont soit
> propagées à l'appelant, soit journalisées directement via `console.error`
> aux points de capture listés dans la matrice ci-dessus (pas de registre
> centralisé, pas de hook DevTools `onError`/`getErrors`). Voir
> [ADR-05](../../adr/ADR-05-propagation-erreurs.md)
> pour le contrat cible.
