# View — Composant de rendu et d'interaction UI

> **Projection DOM Reactive, UIMap typee, delegation d'evenements, localState**

[<- Retour couche concrete](README.md) | [-> Behavior](behavior.md) | [5-rendu.md (PDR complete)](../5-rendu.md)

---

| Champ | Valeur |
|-------|--------|
| **Composant** | View |
| **Couche** | Concrete (éphémère) |
| **Source**    | Historique : RFC-0002-api-contrats-typage §9 |
| **Statut** | Stable — pattern modulaire ADR-0042 (Tested via `tests/unit/strate-0/view.basic.test.ts`) |
| **ADRs liées** | **ADR-0042 (pattern modulaire courant)**, ADR-0024 (value-first), ADR-0026 (rootElement), ADR-0040 (Channel générique), ADR-0041 (pattern consommateur unifié — superseded par ADR-0042 pour les types `TConsumerDeps`/`TConsumerContract`/`TListenCallbacks`), ADR-0009, ADR-0013, ADR-0014, ADR-0015, ADR-0017, ADR-0020 |

---

## Table des matieres

1. [Classe abstraite View](#1-classe-abstraite-view)
2. [Pattern modulaire ADR-0042](#2-pattern-modulaire-adr-0042)
3. [Types utilitaires du pattern modulaire](#3-types-utilitaires-du-pattern-modulaire)
4. [Contrat de rendu PDR](#4-contrat-de-rendu-pdr)
   - [Point d'ancrage DOM](#41-point-dancrage-dom)
   - [UIElements et UIEvents](#42-uielements-et-uievents)
   - [Delegation d'evenements](#43-delegation-devenements)
   - [getUI()](#44-getui--primitive-de-projection-typee)
   - [get templates()](#45-get-templates--trois-modes-de-rendu)
   - [TProjectionTemplate](#46-tprojectiontemplate)
   - [Templates partiels Mode C](#47-templates-partiels-mode-c)
   - [Flux d'execution complet](#48-flux-dexecution-complet)
5. [Cycle de vie passif](#5-cycle-de-vie-passif)
6. [Declaration des Composers](#6-declaration-des-composers)
7. [API localState](#7-api-localstate)

---

## 1. Classe abstraite View

La View est paramétrée par **un seul générique** : son `TViewContract` (ADR-0042). Ce contrat compose deux modules indépendants — `features` (canal) et `ui` (DOM) — et la classe l'utilise pour générer les exigences typage des handlers (`TViewCallbacks<TVC>`).

```typescript
import type { TFeatureContract, TFlatTriggers, TFlatRequests,
  TCommandPayloadFor, TRequestParamsFor, TRequestResultFor } from "@bonsai/feature";

/** Contrat View composé — `features` (channel) + `ui` (DOM). */
export type TViewContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract = TUIContract
> = {
  readonly features: F;
  readonly ui: U;
};

/**
 * Clause `implements` unique — fusion des handlers channel et UI.
 * Symétrie Contract/Callbacks (I88) : `extends View<TVC>` + `implements TViewCallbacks<TVC>`.
 */
export type TViewCallbacks<TVC extends TViewContract> =
  TChannelCallbacks<TVC["features"]> & TUICallbacks<TVC["ui"]>;

/** Surface structurelle d'une classe View — utilisée par Composer (variance). */
export type TViewClass = abstract new (...args: any[]) => View<any>;

abstract class View<TVC extends TViewContract = TViewContract> {
  /**
   * Module Features (manifest applicatif des channels).
   * Évalué UNE SEULE FOIS au mount() — ADR-0024 value-first.
   */
  abstract get features(): TVC["features"];

  /**
   * Module UI events — clés UI → entrées typées (`TUIEntry`).
   * Évalué UNE SEULE FOIS au mount(). Utilisé pour générer les handlers DOM requis.
   */
  abstract get uiEvents(): TVC["ui"];

  /**
   * Module UI elements — clés UI → sélecteurs CSS résolus dans `rootElement`.
   * Surchargeable par le Composer via `TResolveResult.uiElementsOverride` (D34).
   * Toute clé manquante du module `uiEvents` → erreur compile (`TUIElements<TUI>`).
   */
  abstract get uiElements(): TUIElements<TVC["ui"]>;

  /** Sélecteur racine, injecté au mount par le Composer (I31, ADR-0026). */
  get rootElement(): string | null;

  /** Élément DOM racine après mount (I34). Permet `el?.dataset` pour le contrat contextuel. */
  protected get el(): HTMLElement | null;

  /**
   * Monté par le Composer (I20). Idempotent — un second appel est un no-op.
   *
   * Séquence :
   *   1. Lecture unique de `features`, `uiEvents`, `uiElements` (ADR-0024)
   *   2. Résolution `rootElement` dans le DOM
   *   3. Validation I34 (pas `document.body`)
   *   4. Auto-discovery UI handlers D48 (on{UIKey}{DomEvent})
   *      → throw I84 si selector absent d'`uiElements` ou handler DOM manquant
   *   5. Auto-discovery channel listeners I48 (on{NS}{Event}Event)
   *      → throw I82 si handler manquant pour une clé dans `features[NS].listens`
   *   6. onAttach() lifecycle hook
   */
  mount(rootSelector: string): void;

  /**
   * Accès DOM typé — résolution dans le scope `rootElement` (I40).
   * Clé invalide (hors `uiEvents`) → erreur compile-time.
   * Élément absent → throw runtime. Aucun querySelector direct (I39).
   * Le sous-type DOM (`TEl`) est préservé via `ExtractEl<TUIEntry>`.
   */
  getUI<K extends keyof TVC["ui"] & string>(
    key: K
  ): TProjectionNode<ExtractEl<TVC["ui"][K]>>;

  /**
   * Envoie un Command via Channel (I4 — View n'a jamais `emit()`).
   * Clé namespacée `"ns:cmd"` validée contre `TFlatTriggers<F>`. Payload inféré.
   * `protected` — appelée depuis les handlers UI de la sous-classe.
   */
  protected trigger<K extends TFlatTriggers<TVC["features"]> & string>(
    key: K,
    payload: TCommandPayloadFor<TVC["features"], K>
  ): void;

  /**
   * Effectue une Request synchrone (ADR-0023, I29). Retour `T | null` si pas de replier.
   * `protected` — appelée depuis les handlers UI de la sous-classe.
   */
  protected request<K extends TFlatRequests<TVC["features"]> & string>(
    key: K,
    params: TRequestParamsFor<TVC["features"], K>
  ): TRequestResultFor<TVC["features"], K> | null;

  /** Hook appelé après le mount complet. Override dans les sous-classes. */
  onAttach(): void;
}
```

> **I4** : la View n'a **jamais** `emit()` — absent du type.
> **I30** : la View ne possède **aucun domain state** — projection pure.
> **I31** : `rootElement` est un sélecteur CSS fourni par le Composer (ADR-0026).
> **I34** : `rootElement` ne peut pas être `document.body`.
> **I39** : accès DOM **exclusivement** via `getUI(key)` — aucun accès brut.
> **I40** : scope DOM = `rootElement`, hors sous-arbres des slots déclarés.
> **I80** : aucun `TChannelToken` dans la surface publique — Channel privé derrière Feature.
> **I81** : `features` / `uiEvents` / `uiElements` lus une seule fois au mount, sources de vérité runtime.
> **I82** : handler manquant pour une clé `features[NS].listens` → erreur compile (via `implements TViewCallbacks`) + throw runtime au mount (filet de sécurité).
> **I84** : `events: [...]` non-vide impose les handlers DOM correspondants (`on{Key}{Event}`) — symétrie compile via `TUICallbacks` + filet runtime.
> **I85** : `ui<TEl>()(events)` est l'unique helper pour construire une `TUIEntry`.
> **I86** : `events` est toujours présent dans une `TUIEntry` (jamais optionnel — `[]` = non-interactif explicite).
> **I87** : la clé d'objet dans `features` ≡ namespace de la Feature référencée.
> **I88** : symétrie Contract/Callbacks — toute clé du contrat impose son handler côté `implements`.
> **ADR-0024** : pattern value-first (`as const satisfies`) pour la déclaration des trois modules.
> **ADR-0026** : `rootElement` n'appartient à **aucun** des trois modules — il vient du Composer.
> **ADR-0042** : pattern modulaire — `features` / `uiEvents` / `uiElements` sont composés dans `TViewContract`.

---

## 2. Pattern modulaire ADR-0042

Le pattern s'applique à chaque View concrète. Il est identique pour Behavior (I83) et accepte les mêmes briques de base (`TFeatureContract`, `TUIContract`, `TUIElements`).

### 2.1 Trois modules, un contrat

```
Module 1 — TFeatureContract : map { namespace → { feature, listens, triggers, requests } }
Module 2 — TUIContract       : map { uiKey → ui<TEl>()(events) }  (TUIEntry)
Module 3 — TUIElements<TUI>  : map { uiKey → selector CSS }      (1:1 avec TUIContract)
Composé  — TViewContract<F,U> = { features: F; ui: U }
Classe   — class extends View<TVC> implements TViewCallbacks<TVC>
```

Chaque module est typé indépendamment et déclaré via `as const satisfies`. Le compilateur vérifie :
- les clés `features[NS].listens / triggers / requests` correspondent à des Events/Commands/Requests de la Feature référencée par `feature` (ADR-0040 — `Channel<TDef>` est typé)
- les clés d'`uiElements` sont **exactement** celles d'`uiEvents` (mapped type contraint)
- chaque event DOM listé dans `events: [...]` impose un handler `on{Key}{Event}` sur la classe (ADR-0042 C15, I88)
- chaque clé `features[NS].listens` impose un handler `on{NS}{Event}Event` (D48 channel)

### 2.2 Exemple complet — CartView

```typescript
import {
  View, ui,
  type TViewContract, type TViewCallbacks,
  type TUIContract, type TUIElements,
} from "@bonsai/view";
import type { TFeatureContract } from "@bonsai/feature";
import { CartFeature } from "../Cart/cart.feature";

// ─── Module 1 — TFeatureContract : Features groupées par namespace ──────────

const cartViewFeatures = {
  cart: {
    feature:  CartFeature,
    listens:  ["itemAdded"]  as const,
    triggers: ["addItem"]    as const,
    requests: ["getTotal"]   as const,
  },
} satisfies TFeatureContract;

// ─── Module 2 — TUIContract : UI events typés ───────────────────────────────
// `ui<TEl>()(events)` est l'unique helper (I85). `events: []` = non-interactif (I86).

const cartViewUiEvents = {
  totalDisplay: ui<HTMLSpanElement>()([]),
  emptyMessage: ui<HTMLDivElement>()([]),
  addButton:    ui<HTMLButtonElement>()(["click"]),
} satisfies TUIContract;

// ─── Module 3 — TUIElements : sélecteurs CSS, 1:1 avec uiEvents ─────────────

const cartViewUiElements = {
  totalDisplay: "[data-ui='totalDisplay']",
  emptyMessage: "[data-ui='emptyMessage']",
  addButton:    "[data-ui='addButton']",
} satisfies TUIElements<typeof cartViewUiEvents>;

// ─── Composition — TViewContract dérivé par typeof ──────────────────────────

type TCartViewContract = TViewContract<
  typeof cartViewFeatures,
  typeof cartViewUiEvents
>;

// ─── Classe — un seul générique, un seul implements ─────────────────────────
// `implements TViewCallbacks<TCartViewContract>` impose à la fois :
//   • les handlers channel (D48 channel) : `on{NS}{Event}Event`
//   • les handlers DOM     (D48 UI)      : `on{UIKey}{DomEvent}`
//
// Handler absent → erreur TS2420 immédiate. Symétrie Contract/Callbacks (I88).

class CartView
  extends View<TCartViewContract>
  implements TViewCallbacks<TCartViewContract>
{
  get features()   { return cartViewFeatures;   }
  get uiEvents()   { return cartViewUiEvents;   }
  get uiElements() { return cartViewUiElements; }

  // ── D48 UI — handler imposé par events: ["click"] sur addButton ─────────
  onAddButtonClick(_event: MouseEvent): void {
    // Clé namespacée vérifiée contre TFlatTriggers<typeof cartViewFeatures>.
    // Payload inféré depuis CartFeature.channel (TCartDef.commands.addItem).
    this.trigger("cart:addItem", { productId: "abc", qty: 1 });
  }

  // ── D48 channel — handler imposé par cart.listens: ["itemAdded"] ─────────
  onCartItemAddedEvent(payload: { item: { qty: number } }): void {
    this.getUI("totalDisplay").text(String(payload.item.qty));
  }

  onAttach(): void {
    // `el` permet de lire le contrat contextuel (data-* attributes) — ADR-0024.
    const productId = this.el?.dataset.productId ?? "";
    this.getUI("emptyMessage").visible(productId === "");
  }
}
```

> **Enforcement compile-time** :
> - `extends View<TVC>` ET `implements TViewCallbacks<TVC>` : couple obligatoire (I88).
> - `satisfies TFeatureContract` : clé hors d'un Channel → erreur compile.
> - `satisfies TUIElements<typeof uiEvents>` : clé orpheline ou manquante → erreur compile.
> - `trigger("ns:cmd", payload)` : clé hors `TFlatTriggers<F>` → erreur compile.
> - `request("ns:req", params)` : clé hors `TFlatRequests<F>` → erreur compile.
> - `getUI("key")` : clé hors `TVC["ui"]` → erreur compile ; sous-type `TEl` préservé.

### 2.3 Principe : Channel privé derrière Feature (I80)

Le Channel n'est jamais manipulé directement par le consommateur. Le code applicatif ne voit que les **noms de Features** (`typeof CartFeature`, référencés dans `TFeatureContract.{ns}.feature`) et des **clés namespacées** (`"cart:addItem"`).

```typescript
// ✅ BON — surface consommateur : référence Feature + clé namespacée
const features = { cart: { feature: CartFeature, listens: [...], ... } };
this.trigger("cart:addItem", { productId, qty });

// ❌ INTERDIT — exposition directe du token (I80)
const token: TChannelToken<TCartDef, "cart"> = CartFeature.channel; // non
this.trigger(CartFeature.channel, "addItem", { productId, qty }); // non
```

---

## 3. Types utilitaires du pattern modulaire

Ces types sont exportés par `@bonsai/feature` et `@bonsai/view`. Le développeur les consomme directement (modules 1-3) ; le compilateur les utilise implicitement (résolution des handlers et des payloads).

### 3.1 Types du Module 1 — `TFeatureContract`

```typescript
/** Référence Feature : classe statique exposant un `channel` typé (ADR-0040). */
type TFeatureRef<TDef = TChannelDefinition, TNS extends string = string> = {
  readonly channel: TChannelToken<TDef, TNS>;
};

/** Référence Feature dont le namespace est imposé par la clé d'objet (I87). */
type TFeatureRefForNS<NS extends string> = TFeatureRef<TChannelDefinition, NS>;

/**
 * Contrat Feature-groupé : un seul objet par namespace, contenant
 * la classe Feature + les trois lanes (`listens`, `triggers`, `requests`).
 *
 * La clé du record est le namespace (I87) — vérifié contre
 * `TFeatureRefForNS<NS>` : la classe Feature doit avoir `channel.namespace === clé`.
 */
type TFeatureContract = {
  readonly [NS in string]: {
    readonly feature:  TFeatureRefForNS<NS>;
    readonly listens:  readonly string[];
    readonly triggers: readonly string[];
    readonly requests: readonly string[];
  };
};
```

### 3.2 Aplatisseurs et payloads dérivés

```typescript
/** Aplatit en map des clés `"ns:event"` → payload de l'event. */
type TFlatListens<F extends TFeatureContract>;
type TFlatTriggers<F extends TFeatureContract>;
type TFlatRequests<F extends TFeatureContract>;

/** Payload de Command pour une clé `"ns:cmd"` du contrat. */
type TCommandPayloadFor<F extends TFeatureContract, K extends string>;

/** Payload d'Event pour une clé `"ns:event"` du contrat. */
type TEventPayloadFor<F extends TFeatureContract, K extends string>;

/** Params / Result d'une Request pour une clé `"ns:req"` du contrat. */
type TRequestParamsFor<F extends TFeatureContract, K extends string>;
type TRequestResultFor<F extends TFeatureContract, K extends string>;
```

Ces aplatisseurs alimentent la signature des méthodes `trigger` / `request` côté View et la signature des handlers `on{NS}{Event}Event` côté `TChannelCallbacks`.

### 3.3 Types du Module 2 — `TUIContract` et `ui<TEl>()`

```typescript
/**
 * Entrée UI typée — phantom `_el?` encode `TEl`, `events` capturé runtime.
 * AUCUN sélecteur ici (D34 — il vit dans `uiElements`).
 */
type TUIEntry<
  TEl extends HTMLElement = HTMLElement,
  TEvts extends readonly string[] = readonly string[]
> = {
  readonly events: TEvts;
  readonly _el?: TEl;
};

/**
 * Helper de construction (I85 — unique mécanisme).
 *
 * Forme curryfiée pour préserver l'inférence littérale de `events` tout en
 * permettant la spécification explicite de `TEl` (limitation TypeScript :
 * `const T` sur un paramètre ne préserve pas le littéral si un autre
 * paramètre est passé explicitement avec un défaut).
 *
 * @example ui<HTMLButtonElement>()(["click"])           // interactif
 * @example ui<HTMLSpanElement>()([])                    // non-interactif (I86)
 * @example ui<HTMLInputElement>()(["input", "change"])  // 2 handlers requis
 */
function ui<TEl extends HTMLElement = HTMLElement>():
  <const TEvts extends readonly string[]>(events: TEvts) => TUIEntry<TEl, TEvts>;

type TUIContract = Readonly<Record<string, TUIEntry>>;

/** Extrait `TEl` d'une `TUIEntry` via le phantom — utilisé par `getUI()`. */
type ExtractEl<TEntry extends TUIEntry>;
```

### 3.4 Types du Module 3 — `TUIElements<TUI>`

```typescript
/**
 * Sélecteurs CSS — clés contraintes au mapped type sur `TUI` (D34, I85).
 * Toute clé orpheline ou manquante → erreur compile.
 */
type TUIElements<TUI extends TUIContract> = {
  readonly [K in keyof TUI]: string;
};
```

### 3.5 Composition — `TViewContract` et `TViewCallbacks`

```typescript
type TViewContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract = TUIContract
> = {
  readonly features: F;
  readonly ui: U;
};

/**
 * Handlers DOM générés par symétrie depuis `TUIContract` (D48 UI).
 * `events: ["click"]` sur `addBtn` → exige `onAddBtnClick(e: MouseEvent): void`.
 */
type TUICallbacks<U extends TUIContract>;

/**
 * Handlers channel générés par symétrie depuis `TFeatureContract` (D48 channel).
 * `cart.listens: ["itemAdded"]` → exige `onCartItemAddedEvent(p): void`.
 */
type TChannelCallbacks<F extends TFeatureContract>;

/**
 * Clause `implements` unique pour une View (I88).
 * Fusion des handlers channel et UI.
 */
type TViewCallbacks<TVC extends TViewContract> =
  TChannelCallbacks<TVC["features"]> & TUICallbacks<TVC["ui"]>;
```

> **Garanties compile-time** :
> - `trigger("ns:cmd", payload)` : clé hors `TFlatTriggers<F>` → erreur compile.
> - `request("ns:req", params)` : clé hors `TFlatRequests<F>` → erreur compile.
> - Payload inféré exactement depuis le `Channel<TDef>` de la Feature référencée.
> - Handler manquant pour une clé `listens` → `TS2420` via `implements TViewCallbacks`.
> - Handler manquant pour un event DOM (`events: ["click"]`) → `TS2420` via `implements TViewCallbacks`.
> - `emit()` **jamais** disponible sur une View (I4) — absent du type.

---

## 4. Contrat de rendu PDR

> **Decision D19** : Bonsai adopte la **Projection DOM Reactive** (PDR) comme
> strategie de rendu. La View ne "re-rend" pas -- elle **projette** des donnees
> sur un DOM existant via des mutations chirurgicales, sans VDOM, sans diff d'arbre.
>
> **Motivations** :
> - Le DOM preexiste dans 99% des cas (rendu serveur SSR, CMS, HTML statique)
> - Les notifications per-key (D16) fournissent deja l'information "quoi a change"
> - Zero allocation, zero diff runtime -- O(delta) mutations directes
> - Pas de double template (front + back)
> - Coherent avec I30 (View = projection pure) et I42 (local state reactif alimente les memes selectors)

### 4.1 Point d'ancrage DOM

Le `rootElement` d'une View est fourni par le **Composer** via `TResolveResult.rootElement`
(ADR-0026). La View elle-meme ne declare PAS son rootElement dans `params`.

> **Invariant I31 (reformule ADR-0026)** : le `rootElement` est un selecteur CSS `string`,
> toujours fourni par le Composer via `TResolveResult`. Le framework le resout dans le slot :
> - Si l'element existe → hydratation (SSR, H1)
> - Si l'element n'existe pas → le framework parse le selecteur CSS et cree l'element (D30, ADR-0026 §3)

### 4.2 UIElements et UIEvents (ADR-0042 — pattern modulaire)

La View **DOIT** déclarer ses nœuds d'interaction DOM et leurs événements.
ADR-0042 introduit trois **modules contractuels** complémentaires :

| Module | Rôle | Mutable au runtime ? |
|--------|------|---------------------|
| `TFeatureContract` | Interactions channel par Feature (listens / triggers / requests Feature-groupés) | Non — structurel |
| `TUIContract` | Nœuds DOM avec **type HTML** + **events DOM déclarés** (sans sélecteurs) | Non — structurel |
| `TUIElements<TUI>` | Map nom → **sélecteur CSS** (overridable par Composer D34) | Oui — overridable au mount |

La séparation `TUIContract` ↔ `TUIElements` est essentielle :
- Les **events DOM** (`["click"]`) sont compile-time + runtime — ils pilotent `TViewCallbacks` (handlers requis) ET `addEventListener` au mount. Ils vivent dans le contrat type-level.
- Les **sélecteurs CSS** (`"#add-btn"`) sont uniquement runtime — un détail d'implémentation que le Composer peut surcharger via `resolve() → options.uiElements` (D34, D35). Ils vivent dans un getter concret séparé.

```typescript
// ── Module TUIContract — entrées UI typées (sans sélecteurs) ──────────────
//
// Chaque entrée porte :
//   - events : événements DOM déclarés (OBLIGATOIRE — `[]` = non-interactif)
//   - _el?   : phantom TEl (compile-time only) pour le typage de getUI(k).element() → TEl
//
// Helper `ui<TEl>()(events)` (forme curryfiée pour préserver l'inférence littérale) :

const cartViewUiEvents = {
  addButton:    ui<HTMLButtonElement>()(["click"]),                // interactif
  totalDisplay: ui<HTMLSpanElement>()([]),                          // non-interactif explicite
  searchInput:  ui<HTMLInputElement>()(["input", "change"]),        // 2 handlers requis
  itemList:     ui<HTMLUListElement>()([])
} satisfies TUIContract;

// ── Module TUIElements — sélecteurs CSS overridables (D34) ────────────────
//
// Les clés sont contraintes à matcher TUIContract — aucun orphelin possible.

const cartViewUiElements = {
  addButton:    ".Cart-addButton",
  totalDisplay: ".Cart-totalDisplay",
  searchInput:  ".Cart-searchInput",
  itemList:     ".Cart-itemList"
} satisfies TUIElements<typeof cartViewUiEvents>;

// ── Auto-discovery D48 UI ──────────────────────────────────────────────────
//
// Le framework dérive les handlers DOM requis depuis `uiEvents[k].events` :
//   addButton + "click"  → onAddButtonClick(e: MouseEvent)
//   searchInput + "input" → onSearchInputInput(e: Event)
//
// Convention : on{UIKey}{DomEvent} (sans suffixe — un click reste un click).
// `events: []` ne génère aucun handler requis.
//
// Symétrie Contract/Callbacks (I84/I88) : déclarer `events: ["click"]` est un
// engagement compile-time — `implements TViewCallbacks<TVC>` impose la méthode.
```

**Sémantique `querySelectorAll`** : le framework résout chaque sélecteur de `uiElements` via `querySelectorAll` dans le scope de la View. Une clé correspond donc à 0, 1 ou N éléments DOM :

- Pour les **events DOM** : la délégation s'applique à TOUS les éléments matchés. Un seul handler `onProductItemAddToBasketClick` couvre N éléments `.ProductItem-addToBasket`.
- Pour `get composers()` : si une clé est déclarée dans `get composers()`, le framework instancie N Composers — un par élément matché (ADR-0020).

**Override par Composer (D34)** :

```typescript
// Le Composer peut surcharger les sélecteurs via resolve()
class MainComposer extends Composer {
  resolve(_event: unknown | null): TResolveResult | null {
    return {
      view: CartView,
      rootElement: "[data-view='cart']",
      options: { uiElements: { addButton: "#new-add-btn" } }   // override
    };
  }
}
```

Le développeur applicatif n'écrit **jamais** de cast manuel — le pattern modulaire garantit que :
1. `getUI("addButton").element() → HTMLButtonElement` (typage du sous-type via phantom)
2. `onAddButtonClick(e: MouseEvent)` est requis si `events: ["click"]`
3. Les sélecteurs sont overridables sans toucher au contrat type-level

Pour le pattern complet (5 étapes : `features` + `uiEvents` + `uiElements` + alias `TVC` + classe), voir [ADR-0042](../../adr/ADR-0042-view-contract-unified-ui-deps-single-generic.md) §Exemple applicatif complet.

**Semantique querySelectorAll** : le framework resout chaque selecteur via `querySelectorAll` dans le scope de la View. Une cle TUIMap correspond donc a 0, 1, ou N elements DOM :

- Pour **uiEvents** : la delegation d'evenements s'applique a TOUS les elements matches. Un seul handler `onProductItemAddToBasketClick` couvre N elements `.ProductItem-addToBasket`.
- Pour **get composers()** : si une cle est declaree dans `get composers()`, le framework instancie N Composers -- un par element matche (ADR-0020).

La View expose `params` via un getter (ADR-0024 value-first). **`get uiEvents()` n'existe plus** -- le framework auto-derive les handlers depuis `TUIMap` (D48) :

```typescript
type TCartViewUI = TUIMap<{
  addButton:    { el: HTMLButtonElement;  event: ['click'] };
  totalDisplay: { el: HTMLSpanElement;    event: [] };
  searchInput:  { el: HTMLInputElement;   event: ['input', 'change'] };
}>;

const cartViewParams = {
  listen:     [Cart.channel],
  trigger:    [Cart.channel],
  request:    [],
  uiElements: {
    addButton:    '.Cart-addButton',
    totalDisplay: '.Cart-totalDisplay',
    searchInput:  '.Cart-searchInput',
  },
  behaviors:  [],
  options:    {},
} as const satisfies TViewParams<TCartViewUI>;

type TCartViewCapabilities = TViewCapabilities<TCartViewUI, typeof cartViewParams>;

class CartView extends View<TCartViewCapabilities> {
  get params() { return cartViewParams; }

  // PAS DE get uiEvents() -- D48 (AUTO-UI-EVENT-DISCOVERY)
  // TUIMap declare :
  //   addButton   + ['click']           -> onAddButtonClick
  //   searchInput + ['input', 'change'] -> onSearchInputInput, onSearchInputChange
  //   totalDisplay + []                 -> aucun handler

  onAddButtonClick(_event: Event): void {
    this.trigger("cart:addItem", { productId: "..." });
  }

  onSearchInputInput(event: InputEvent & { currentTarget: HTMLInputElement }): void {
    this.trigger("cart:search", { query: event.currentTarget.value });
  }

  onSearchInputChange(_event: Event): void {
    // Validation finale a la perte de focus
  }
}
```

> **Garanties** :
> - `TUIMap` contraint au niveau type que seuls les evenements declares peuvent etre branches
> - `TUIMap` interdit la cle `root` (reservee pour `get templates()`)
> - `TUIMap` type l'element HTML -- `getUI()` retourne `TProjectionNode<HTMLButtonElement>` (D35)
> - **D48** : `TAutoUIEventHandlers<TUI>` genere les signatures de handlers depuis `TUIMap` -- TypeScript verifie la signature de chaque handler
> - Le framework verifie au **bootstrap** que chaque combinaison (cle x event) a un handler correspondant. Absence = erreur explicite
> - Les selecteurs CSS vivent dans `params.uiElements`, overridables par le Composer (D34)

### 4.3 Delegation d'evenements

Le framework utilise la **delegation d'evenements** : un seul listener par type
d'evenement est attache sur `this.el`. Quand un evenement DOM bulle, le framework
teste `event.target.closest(selector)` contre chaque `@ui` declare.

```
UN seul listener "click" attache sur this.el
         |
    +----+----------------------------+
    |      this.el (#cart)            |
    |                                 |
    |  +-- @ui.addButton --+          |
    |  |  <button>         |          |
    |  |  click ici ----+  |          |
    |  +----------------+  |          |
    |                       |          |
    +-----------------------+          |
                |
     bulle remonte -> intercepte par this.el
     -> closest('.Cart-addButton') match
     -> appelle onAddButtonClick(event)
```

Avantages :
- **Elements crees dynamiquement** (fragments, `reconcile`) : les nouveaux enfants sont couverts automatiquement sans rebind
- **Performance** : 3 listeners (click, input, submit) au lieu de N x 3
- **Cleanup** : 3 `removeEventListener` dans `onDetach()` au lieu de N x 3

### 4.4 getUI() -- Primitive de projection typee

La View accede aux noeuds DOM **exclusivement** via `getUI(key)`, jamais via
`querySelector`, `getElementById` ou tout autre acces DOM brut (I39).

> **Scope DOM (I40)** : le framework resout chaque `uiElement` dans le scope
> du `rootElement`, en **excluant les sous-arbres des slots** declares dans
> `get composers()`. Si un selecteur resout vers un element a l'interieur
> d'un slot, c'est une erreur au bootstrap.

```typescript
abstract class View<TCapabilities extends TViewCapabilities<TUIMap<any>, any>> {
  /**
   * Resout un @ui par son nom logique.
   * Resolution paresseuse + cache : querySelector une seule fois.
   * Si le noeud n'existe pas dans le DOM, jette une erreur.
   *
   * Le type de retour depend de la couverture template :
   * - @ui SANS template -> TProjectionNode (lecture + mutation N1)
   * - @ui AVEC template -> TProjectionRead (lecture seule)
   *
   * Source de mutation unique par @ui garanti par le type system (I41).
   *
   * Le framework derive les overloads a partir des cles presentes
   * dans get templates(). TCapabilities['ui'] contraint les cles autorisees.
   */
  protected getUI<K extends keyof TCapabilities['ui'] & string>(
    key: K
  ): TProjectionNode<TCapabilities['ui'][K]['el']> | TProjectionRead;
}
```

**TProjectionRead** -- acces en lecture seule (disponible pour tous les @ui) :

```typescript
type TProjectionRead = {
  /** Lit la valeur d'un input/select/textarea */
  value(): string;

  /** Lit l'etat checked d'un checkbox/radio */
  checked(): boolean;

  /** Lit un attribut */
  getAttr(name: string): string | null;

  /** Lit le textContent */
  getText(): string;

  /** Teste la presence d'une classe CSS */
  hasClass(className: string): boolean;
}
```

**TProjectionNode** -- lecture + mutation N1 (uniquement pour les @ui **non** couverts par un template) :

```typescript
type TProjectionNode = TProjectionRead & {
  /** Met a jour le textContent (no-op si inchange) */
  text(value: string | number): this;

  /** Met a jour un attribut (data-*, aria-*, etc.) -- null = remove */
  attr(name: string, value: string | boolean | null): this;

  /** Toggle/ajoute/retire une classe CSS */
  toggleClass(className: string, force?: boolean): this;

  /** Show/hide via attribut hidden */
  visible(show: boolean): this;

  /** Met a jour une propriete CSS inline */
  style(prop: string, value: string): this;
}
```

> **Note** : `TProjectionNode` effectue un check d'identite avant chaque mutation
> (ex: `if (node.textContent !== str)`) pour eviter les ecritures DOM inutiles.
>
> **Invariant I41 (D32)** : chaque @ui a une **source de mutation unique**.
> Si un @ui est couvert par un template, `getUI(key)` retourne `TProjectionRead` (lecture seule) --
> la mutation passe exclusivement par `template.project()`. Sinon, `getUI(key)` retourne `TProjectionNode`.
> Ceci est garanti par le type system (surcharges de `getUI()`).
>
> **Consequence** : `TProjectionNode` n'expose **pas** `.node` (acces brut au
> HTMLElement). Aucune fuite DOM, I39 garanti par construction.

Usage en Mode A (pas de template -- mutations N1 uniquement) :

```typescript
// Le developpeur utilise getUI() -> TProjectionNode dans ses handlers Event
onCartTotalUpdatedEvent(payload: { total: number }): void {
  this.getUI("totalDisplay").text(`${payload.total} EUR`);
}

onCartItemAddedEvent(payload: { count: number }): void {
  this.getUI("badgeCount").text(String(payload.count));
  this.getUI("badgeCount").toggleClass("has-items", payload.count > 0);
}

// trigger : cle namespacee compilee contre contract.triggers
onSubmitClick(): void {
  this.trigger("auth:login", { username: "...", remember: true });
}
```

### 4.5 get templates() -- Trois modes de rendu

La View declare ses templates de projection via `get templates()`.
Trois modes **mutuellement exclusifs** :

```typescript
/**
 * Mode A : null -- pas de template.
 *   La View utilise getUI() manuellement dans ses handlers.
 *
 * Mode B : { root: Binding } -- template complet.
 *   Le template possede TOUT le contenu de this.el.
 *   Aucune autre cle autorisee.
 *
 * Mode C : { [K in keyof TUI]?: Binding } -- fragments (ilots).
 *   Chaque cle est un @ui declare dans TUIMap.
 *   Le template possede le contenu INTERIEUR de l'element @ui.
 *   Le reste du DOM serveur est intouche.
 *   La cle `root` est interdite (gardee par TUIMap).
 */
type TViewTemplateBinding<TData = unknown> = {
  template: TProjectionTemplate<any, TData>;
  /**
   * Selector optionnel : active l'auto-reactivite (RFC-0003 SS2.3/SS7.2).
   * Si absent, le template est statique (projection initiale seulement).
   */
  select?: (data: Record<string, any>) => TData | undefined;
};

type TViewTemplates<TUI extends TUIMap<any>> =
  | null                                                 // Mode A
  | { root: TViewTemplateBinding }                       // Mode B
  | { [K in keyof TUI & string]?: TViewTemplateBinding }; // Mode C
```

> **Regle normative** : des qu'une zone est declaree dans `get templates()`,
> le rendu de cette zone est delegue au framework via `template.project()`.
> Un handler View ne doit pas appeler `template.project()` manuellement pour
> cette meme zone (coherence avec RFC-0003 SS2.2).

### 4.6 TProjectionTemplate

Un template compile (`TProjectionTemplate`) expose trois fonctions :

```typescript
type TProjectionTemplate<TNodes = any, TData = any> = {
  /** Localise les noeuds dynamiques dans le conteneur, retourne un objet de references */
  setup(container: HTMLElement): TNodes;

  /** Effectue les mutations DOM chirurgicales depuis les donnees */
  project(nodes: TNodes, data: TData): void;

  /** Factory DOM -- cree le fragment HTML complet (si pas de SSR) */
  create(data: TData): HTMLElement;
}
```

Le framework peuple automatiquement `this.nodes` dans `onAttach()` :

```typescript
// INTERNE FRAMEWORK -- le developpeur ne voit jamais ce code

function attachView(view: View, rootElement: string, composerOptions?: Partial<TViewOptions>): void {
  // 1. Merge options <- composerOptions (D34)
  view.resolvedOptions = { ...view.params.options, ...composerOptions };

  // 2. Resoudre rootElement -> el (ADR-0026 : string du Composer)
  view.el = slot.querySelector(rootElement);
  if (!view.el) {
    // Element absent -> parser le selecteur CSS et creer l'element (ADR-0026 §3, D30)
    view.el = parseCssSelectorAndCreateElement(rootElement);
    slot.appendChild(view.el);
  }

  // 3. Peupler nodes depuis templates()
  const templates = view.templates;

  if (templates === null) {
    // Mode A -- pas de nodes auto-peuples
    view.nodes = {};
  } else if ('root' in templates) {
    // Mode B -- setup sur this.el directement
    view.nodes = { root: templates.root.template.setup(view.el) };
  } else {
    // Mode C -- setup sur chaque @ui correspondant
    const nodes: Record<string, any> = {};
    for (const [key, binding] of Object.entries(templates)) {
      if (binding) {
        nodes[key] = binding.template.setup(view._resolveUIElement(key));
      }
    }
    view.nodes = nodes;
  }

  // 3. Delegation d'evenements + cablage onXXX
  bindUIEvents(view);
  view.onAttach();
}
```

### 4.7 Templates partiels Mode C -- Syntaxe PugJS `@ui.xxx`

En Mode C, le developpeur ecrit un ou plusieurs **fragments PugJS** qui ciblent
chacun un `@ui` specifique. Le reste du DOM serveur est intouche.

La syntaxe `@ui.xxx` dans le `.pug` indique au compilateur :
*"tu possedes le contenu interieur de cet element, pas la View entiere"*.

```pug
_data
  isLogged Boolean
  username String
  itemCount Number

@ui.loginContainer
  if data.isLogged
    p.welcome Bonjour #{data.username}
    button.logout(type="button") Deconnexion
  else
    form.login-form
      input.login-input(type="text" placeholder="Identifiant")
      button.login-submit(type="button") Connexion

@ui.cartBadge
  span.count= data.itemCount
  if data.itemCount > 0
    span.badge-dot
```

Le compilateur genere un fichier `.template.ts` contenant un `TProjectionTemplate`
par `@ui` declare, avec l'analyse de dependance sur `data.*` :
- Noeuds **statiques** -> ignores (existent dans le DOM serveur)
- Noeuds **dynamiques** -> inclus dans `setup()` + `project()`
- Noeuds **conditionnels** (`if/else`) -> gestion de bascule de branche

Usage dans la View :

```typescript
import {
  loginContainerTemplate,
  cartBadgeTemplate
} from './AccountView.template';

type TAccountViewUI = TUIMap<{
  loginContainer: { el: HTMLDivElement;    event: [] };
  loginInput:     { el: HTMLInputElement;  event: [] };
  loginButton:    { el: HTMLButtonElement; event: ['click'] };
  logoutButton:   { el: HTMLButtonElement; event: ['click'] };
  cartBadge:      { el: HTMLSpanElement;   event: [] };
  nav:            { el: HTMLElement;       event: ['click'] };
}>;

// ═══ ETAPE 1 -- Valeur concrete (ecrite UNE SEULE FOIS, ADR-0024) ═══

const accountViewParams = {
  listen:     [Auth.channel, Cart.channel],
  trigger:    [Auth.channel],
  request:    [],
  uiElements: {
    loginContainer: '.AccountView-loginZone',
    loginInput:     '.AccountView-loginInput',
    loginButton:    '.AccountView-loginButton',
    logoutButton:   '.AccountView-logoutButton',
    cartBadge:      '.AccountView-cartBadge',
    nav:            '.AccountView-nav',
  },
  behaviors:  [],
  options:    {},
} as const satisfies TViewParams<TAccountViewUI>;

// ═══ ETAPE 2 -- Type derive (ZERO repetition) ═══

type TAccountViewCapabilities = TViewCapabilities<TAccountViewUI, typeof accountViewParams>;

// ═══ ETAPE 3 -- Classe (getter trivial) ═══

class AccountView extends View<TAccountViewCapabilities> {
  get params() { return accountViewParams; }

  // Mode C -- seules les zones reactives ont un template
  get templates() {
    return {
      loginContainer: {
        template: loginContainerTemplate,
        select: (data) => data.auth
          ? { isLogged: data.auth.isLogged, username: data.auth.username }
          : undefined,
      },
      cartBadge: {
        template: cartBadgeTemplate,
        select: (data) => data.cart
          ? { itemCount: data.cart.itemCount }
          : undefined,
      },
      // pas de `nav` -> la nav est SSR pur, aucune projection
    };
  }

  // this.nodes est auto-peuple par le framework :
  // this.nodes.loginContainer -> setup() appele sur getUI('loginContainer')
  // this.nodes.cartBadge      -> setup() appele sur getUI('cartBadge')

  // loginInput n'a PAS de template -> getUI retourne TProjectionNode
  onLoginButtonClick(): void {
    const username = this.getUI('loginInput').value();
    this.trigger(Auth.channel, 'login', { username });
  }

  onLogoutButtonClick(): void {
    this.trigger(Auth.channel, 'logout', {});
  }

  // loginContainer a un template -> getUI retourne TProjectionRead
  // this.getUI('loginContainer').text('...') -> ERREUR compile-time
  // (Property 'text' does not exist on type 'TProjectionRead')
}
```

> **Separation des responsabilites** :
> ```
> .view.ts           = QUOI -> types TUI, uiElements, uiEvents, handlers, templates()
> .template.pug      = COMMENT -> logique de rendu (projections, conditions, boucles)
> ```
>
> En Mode C, le DOM serveur est la source de verite structurelle.
> Les fragments `.pug` ne decrivent que les **ilots reactifs**.
> Le reste du HTML (nav, footer, contenu statique) est 100% SSR, intouche.

### 4.8 Flux d'execution complet

```
+------------------ BOOTSTRAP -------------------+
|                                                  |
|  1. DOM serveur existe (SSR/CMS/statique)        |
|  2. Foundation/Composer cree la View (D34)       |
|  3. Framework merge params <- options (shallow)   |
|  4. Framework resout rootElement (ADR-0026) :    |
|     4a. querySelector(rootElement) dans scope     |
|     4b. TROUVE  -> el = existant (mode SSR)       |
|     4c. ABSENT  -> parse selecteur CSS et cree    |
|         l'element (SPA, D30 revise, ADR-0026)     |
|     4d. Non parseable -> ERREUR (combinateurs,    |
|         pseudo-classes non supportes)              |
|  5. Framework resout uiElements -> cache @ui      |
|     (scope = el, excluant sous-arbres slots I40) |
|  6. Framework resout templates() :               |
|     - null  -> nodes = {} (Mode A)                |
|     - root  -> nodes.root = setup(el) (Mode B)    |
|     - @ui   -> nodes[k] = setup(getUI(k)) (C)    |
|     setup() = hydratation SSR (H2)               |
|     create() = fallback SPA (D30)                |
|  7. Framework branche uiEvents par delegation    |
|  8. View.onAttach() -- hook developpeur           |
|                                                  |
|  Note : si TBootstrapOptions.serverState fourni  |
|  (ADR-0014 H5), les Entities sont pre-peuplees   |
|  silencieusement en phase 3 ('entities')         |
|  AVANT toute View -- pas d'Event, pas de notif.   |
|                                                  |
+--------------------------------------------------+
                        |
                        v
+------------------ RUNTIME ----------------------+
|                                                  |
|  Event recu via Channel (listen) :               |
|  1. Framework evalue les selectors (SS9.4.5)      |
|  2. Mode A : getUI('key').text(...)  (N1)        |
|     Mode B : binding.template.project(...) (auto)  |
|     Mode C : binding.template.project(...) (auto)  |
|  = mutations DOM chirurgicales, 0 diff, 0 alloc  |
|  Source de mutation unique par @ui (I41)          |
|                                                  |
|  Lecture de valeur (tous modes) :                 |
|  getUI('input').value() -> TProjectionRead          |
|                                                  |
|  Interaction utilisateur :                        |
|  1. click sur @ui.addButton                      |
|  2. Delegation -> View.onAddButtonClick(event)    |
|  3. this.trigger(Cart.channel, 'addItem', {...}) |
|                                                  |
+--------------------------------------------------+
                        |
                        v
+------------------ TEARDOWN ---------------------+
|                                                  |
|  1. View.onDetach()                              |
|  2. Framework nettoie event listeners delegues   |
|  3. nodes = null (references liberees)           |
|  4. _uiCache vide                                |
|                                                  |
+--------------------------------------------------+
```

---

## 5. Cycle de vie passif

Les hooks de cycle de vie des Views sont des **appels directs du framework** (L2),
pas des Events Channel. Ils sont declenches par la Foundation ou les Composers.

| Hook | Quand | Usage typique |
|------|-------|---------------|
| `onAttach()` | Apres insertion dans le DOM | Resolution `rootElement` -> `el`, `setup()`, branchement `uiEvents` |
| `onDetach()` | Avant retrait du DOM | Cleanup event listeners DOM, liberation `nodes` |
| `onRender()` | Apres chaque projection | Post-processing DOM (focus, scroll, animations) |

```typescript
abstract class View<TCapabilities extends TViewCapabilities<TUIMap<any>, any>> {
  /** Appele par Foundation/Composer apres insertion dans le DOM */
  protected onAttach(): void {}

  /** Appele par Foundation/Composer avant retrait du DOM */
  protected onDetach(): void {}

  /** Appele apres chaque rendu */
  protected onRender(): void {}
}
```

> **RFC-0001 D4, I19** : la View ne decide ni de sa creation,
> ni de sa destruction. Ces hooks sont des **notifications passives**,
> pas des decisions.

### 5.1 Machine a etats

```
created -> wired -> attached -> detached -> [destroyed]
```

| Etat | Entree (declencheur) | Sorties possibles | Hooks disponibles |
|------|----------------------|-------------------|-------------------|
| `created` | Instanciation par le Composer | -> `wired` | `constructor` |
| `wired` | Cablage Channels (bootstrap) | -> `attached` | -- |
| `attached` | `el` resolu, DOM pret | -> `detached` | `onAttach()` |
| `detached` | Slot disparu, remplacement ou shutdown | -> `destroyed` | `onDetach()` |
| `destroyed` | Nettoyage complet (subscriptions, references DOM) | -- (terminal) | -- |

> **Invariants de transition** :
> - `onAttach()` n'est appele qu'en etat `wired` -- `el` DOIT exister dans le DOM (I31)
> - `onDetach()` est appele avant toute destruction -- pas de destruction sans detach
> - Un etat `detached` peut repasser a `attached` si le Composer monte a nouveau la meme instance (cas rare)
> - `localState` (I42) est initialise au premier `attached`, nettoye au `detached`
> - Les subscriptions Channel sont attachees au `wired`, nettoyees au `detached`

---

## 6. Declaration des Composers

> **ADR-0020 (Accepted)** : la semantique de `get composers()` est etendue
> au N-instances. Si un selecteur `uiElements` matche N elements DOM,
> et que la cle est dans `get composers()`, le framework instancie **N Composers**
> -- un par element matche. Chaque instance recoit son element DOM comme scope.

La View declare des **slots de composition** via `get composers()` :

```typescript
const mainViewParams = {
  listen:     [Cart.channel],
  trigger:    [], request: [], behaviors: [], options: {},
  uiElements: {
    sidebarSlot: '#sidebar-slot',
    contentSlot: '#content-slot',
    itemList:    '.MainView-itemList',
  },
} as const satisfies TViewParams<TMainViewUI>;

type TMainViewCapabilities = TViewCapabilities<TMainViewUI, typeof mainViewParams>;

class MainView extends View<TMainViewCapabilities> {
  get params() { return mainViewParams; }

  /**
   * Declaration des Composers de composition.
   *
   * Cles : DOIVENT correspondre a des entrees dans get uiElements().
   * Valeurs : constructeurs de Composer importes.
   *
   * Le framework resout l'element @ui correspondant comme slot
   * pour le Composer. Le Composer decide ensuite quelle View instancier.
   *
   * Semantique N-instances (ADR-0020) : si querySelectorAll(selecteur) matche
   * N elements, le framework instancie N Composers -- un par element matche.
   */
  get composers() {
    return {
      sidebarSlot: SidebarComposer,
      contentSlot: ContentComposer,
    };
  }
}
```

#### Semantique N-instances -- composition typee par attribut (ADR-0020)

```typescript
const nodeEditFormViewParams = {
  listen:     [], trigger: [], request: [], behaviors: [], options: {},
  uiElements: {
    formActions:  '.node-form__actions',
    editorJsSlot: '[data-field-type="editorjs"]',
    // querySelectorAll -> 2 elements
    mediaSlot:    '[data-field-type="media"]',
    // querySelectorAll -> 1 element
  },
} as const satisfies TViewParams<TNodeEditFormViewUI>;

type TNodeEditFormViewCapabilities = TViewCapabilities<TNodeEditFormViewUI, typeof nodeEditFormViewParams>;

class NodeEditFormView extends View<TNodeEditFormViewCapabilities> {
  get params() { return nodeEditFormViewParams; }

  get composers() {
    return {
      editorJsSlot: EditorJsComposer,   // -> 2 instances (2 elements matches)
      mediaSlot:    MediaFieldComposer,  // -> 1 instance (1 element matche)
    };
  }
}
```

> **Ce que ce mecanisme n'est PAS** : ce n'est pas de la composition cachee.
> `TUIMap` est compile-time, `uiElements` est resolu au bootstrap,
> `composers` est statique, la logique de composition est dans le Composer (D21).
> La View reste aveugle au nombre d'elements matches au runtime.

> **I36** : la View **ne compose jamais** d'autres Views.
> Elle declare des slots et des Composers associes, mais la decision
> d'instanciation est entierement portee par le Composer (D21).
>
> **Contrat** :
> - Les cles de `get composers()` sont typees par `keyof TUI` -- le compilateur verifie que chaque cle existe dans `get uiElements()`
> - Les valeurs sont des constructeurs de Composer (`typeof Composer`)
> - Le getter est coherent avec les autres getters View (D17) : `rootElement`, `uiElements`, `uiEvents`, `templates`, `composers`

---

## 7. API localState

> **ADR-0015 (Accepted)** -- Le localState est une "Entity sans Channel" :
> Immer produit un etat immutable, et deux mecanismes complementaires
> assurent la reactivite (dual N1/N2-N3).

### 7.0 Arbre de decision : localState vs domain state

```
Q1. Ce state pourrait-il interesser un autre composant ?
    |   (autre View, Behavior, Feature, DevTools, analytics...)
    |
    +-- OUI --> domain state (Feature + Entity + Channel)
    |           Justification : la View n'a pas emit() (I1, I4).
    |           Elle ne peut pas diffuser de changement observable.
    |           Le localState est encapsule (I42.3) et non-broadcastable (I42.4).
    |
    +-- NON --> Q2

Q2. Ce state doit-il survivre a la destruction de la View ?
    |   (navigation, remplacement par un Composer, re-montage)
    |
    +-- OUI --> domain state (Feature + Entity + Channel)
    |           Justification : le localState est lie a l'instance --
    |           nettoye au onDetach() (I42.5). Il ne survit pas.
    |
    +-- NON --> localState suffit
                Utiliser this.updateLocal(recipe) -- ADR-0015.
                Ex : currentStep d'un wizard, isEditing d'un toggle,
                validationErrors d'un formulaire.
```

> **Critere de migration** (I42) : si un localState doit etre observe par un autre
> composant, il **DOIT** etre migre vers Feature + Entity. Le localState est
> strictement intra-View (ou intra-Behavior, D37).

### 7.1 Types localState

```typescript
/**
 * Payload passe aux callbacks `onLocal{Key}Updated()` (mecanisme N1).
 */
type TLocalUpdate<T> = {
  /** Valeur apres mutation */
  readonly actual: T;
  /** Valeur avant mutation */
  readonly previous: T;
};

/**
 * Derive le nom du callback N1 pour une cle donnee du localState.
 * TLocalKeyHandlerName<'isOpen'>      -> 'onLocalIsOpenUpdated'
 * TLocalKeyHandlerName<'currentStep'> -> 'onLocalCurrentStepUpdated'
 */
type TLocalKeyHandlerName<TKey extends string> = `onLocal${Capitalize<TKey>}Updated`;

/**
 * Mappe chaque cle du localState vers son callback N1 optionnel.
 * Le framework auto-decouvre ces methodes (convention `onXXX`, D12).
 */
type TLocalKeyHandlers<TLocal extends TJsonSerializable> = {
  [K in keyof TLocal & string as TLocalKeyHandlerName<K>]?: (
    update: TLocalUpdate<TLocal[K]>
  ) => void;
};
```

### 7.2 Classe View -- API localState complete

La declaration **COMPLETE** de View avec le localState.
La classe prend un generic `TCapabilities` (ADR-0024) et un generic optionnel
`TLocal` pour le state de presentation local (I42, ADR-0015).

```typescript
abstract class View<
  TCapabilities extends TViewCapabilities<TUIMap<any>, any>,
  TLocal extends TJsonSerializable = never
> {
  /**
   * Declaration optionnelle du state local.
   * Retourne l'etat initial -- appele une fois au premier `attached`.
   * Un `detached -> attached` (re-montage par le Composer) reinitialise
   * le localState en rappelant cette methode (I42.5).
   */
  protected get localState(): TLocal { /* @abstract optionnel */ }

  /**
   * Mute le localState via une recipe Immer.
   * Declanche le mecanisme dual N1/N2-N3 si l'etat a change.
   *
   * - **Synchrone** : `this.local` est a jour immediatement apres l'appel
   * - **No-op** : si les patches sont vides (etat inchange), aucun callback ni re-projection
   * - **Batch** : un seul appel = une seule re-projection
   * - **Re-projection en microtask** : callbacks N1 synchrones, re-projection N2/N3 planifiee
   * - **Erreur dans recipe** : Immer rollback, etat inchange, `MutationError` (ADR-0002) sans metas
   */
  protected updateLocal(recipe: (draft: Draft<TLocal>) => void): void;

  /**
   * Lecture de l'etat courant du localState (frozen / readonly).
   * Disponible apres le premier `attached`, `undefined` avant.
   */
  protected get local(): Readonly<TLocal>;
}
```

### 7.3 Mecanisme dual N1/N2-N3

| Niveau | Mecanisme | Quand utiliser | Declenchement |
|--------|-----------|----------------|---------------|
| **N1** | Callbacks `onLocal{Key}Updated(update: TLocalUpdate<T>)` | Mutation DOM directe (attributs, classes, texte) | **Synchrone** -- appele immediatement apres `updateLocal()` |
| **N2/N3** | Selector `select: (data) => data.local?.xxx` dans `get templates()` | Re-projection automatique via pipeline PDR | **Microtask** -- planifie apres les callbacks N1 |

Les deux mecanismes **ne s'excluent pas**. Un meme `updateLocal()` peut declencher
un callback N1 **et** une re-projection N2/N3 si les cles concernent des zones differentes.

> **Namespace `local` reserve** (I57) : le data key `local` dans `NamespacedData` est
> reserve par le framework. Aucun Channel ne peut utiliser le namespace `local`.

### 7.4 Pipeline de mutation

```
updateLocal(recipe)
  -> Immer produce(oldState, recipe)
  -> patches vides ?
    +-- OUI -> no-op (ni callback, ni re-projection)
    +-- NON -> changedKeys = extraire les cles des patches
              |
              +-- N1 path (synchrone) :
              |   pour chaque cle K dans changedKeys
              |     si this.onLocal{K}Updated existe
              |     -> appeler avec { actual: newState[K], previous: oldState[K] }
              |
              +-- N2/N3 path (microtask) :
                  injecter { local: changedPartial } dans le pipeline selector
                  -> chaque template avec select() filtre via data.local?.xxx
                  -> si donnees changees (shallow equal) -> template.project()
```

### 7.5 Cycle de vie du localState

| Phase | Comportement |
|-------|-------------|
| `created` | localState non initialise |
| `wired` | localState non initialise |
| `attached` | `get localState()` est appele -> etat initial frozen stocke. `this.local` est accessible. |
| `detached` | localState nettoye (reference supprimee). `this.local` n'est plus accessible. |
| `destroyed` | GC libere la memoire |

### 7.6 Observabilite (DevTools)

Le localState **N'EST PAS** dans `app.snapshot()` (etat volatile, RFC-0004).
En mode `debug: true`, les mutations localState sont logguees dans la console
avec le nom de la View et les cles modifiees.

### 7.7 Exemple complet

```typescript
type TWizardLocalState = {
  currentStep: number;
  validationErrors: string[];
  isSubmitting: boolean;
};

// ═══ Value-first (ADR-0024) ═══

const wizardViewParams = {
  listen:     [Wizard.channel],
  trigger:    [Wizard.channel],
  request:    [],
  uiElements: {
    stepIndicator: '.WizardView-stepIndicator',
    progressBar:   '.WizardView-progressBar',
    nextButton:    '.WizardView-next',
    prevButton:    '.WizardView-prev',
    submitButton:  '.WizardView-submit',
  },
  behaviors:  [],
  options:    {},
} as const satisfies TViewParams<TWizardUI>;

type TWizardViewCapabilities = TViewCapabilities<TWizardUI, typeof wizardViewParams>;

class WizardView extends View<TWizardViewCapabilities, TWizardLocalState> {
  get params() { return wizardViewParams; }

  protected get localState(): TWizardLocalState {
    return { currentStep: 0, validationErrors: [], isSubmitting: false };
  }

  // -- Callbacks N1 (optionnels -- auto-decouverts par le framework, D12) --

  onLocalCurrentStepUpdated({ actual, previous }: TLocalUpdate<number>): void {
    this.getUI('stepIndicator').dataset.step = String(actual);
    this.getUI('progressBar').style.width = `${(actual / 3) * 100}%`;
  }

  // -- Templates avec selectors N2/N3 --

  get templates() {
    return {
      stepContent: {
        template: stepContentTemplate,
        select: (data: TNamespacedData) => data.local?.currentStep,
      },
      errorList: {
        template: errorListTemplate,
        select: (data: TNamespacedData) => data.local?.validationErrors,
      },
    };
  }

  // -- Mutations --

  onNextClick(): void {
    this.updateLocal(draft => {
      draft.currentStep += 1;
      draft.validationErrors = [];
    });
  }

  onPrevClick(): void {
    this.updateLocal(draft => { draft.currentStep -= 1; });
  }

  async onSubmitClick(): Promise<void> {
    this.updateLocal(draft => { draft.isSubmitting = true; });
    this.trigger(Wizard.channel, 'submit', { step: this.local.currentStep });
  }
}
```

> Le Behavior utilise le meme mecanisme (`get localState()` + `updateLocal()`)
> avec les memes 5 contraintes (D37, I42). Voir [behavior.md](behavior.md) SS3.

---

## Lecture suivante

-> [behavior.md](behavior.md) -- plugins UI reutilisables
-> [5-rendu.md](../5-rendu.md) -- PDR complete, templates PugJS, ProjectionList
