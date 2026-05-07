# View — Composant de rendu et d'interaction UI

> **Projection DOM Reactive, UIMap typee, delegation d'evenements, localState**

[<- Retour couche concrete](README.md) | [-> Behavior](behavior.md) | [5-rendu.md (PDR complete)](../5-rendu.md)

---

| Champ | Valeur |
|-------|--------|
| **Composant** | View |
| **Couche** | Concrete (ephemere) |
| **Source**    | Historique : RFC-0002-api-contrats-typage §9 |
| **Statut** | Stable (sections 1–3 en cours de réécriture post-ADR-0042) |
| **ADRs liees** | **ADR-0042 (pattern modulaire — actuel)**, ADR-0024 (value-first), ADR-0026 (rootElement), ADR-0040 (Channel générique), ADR-0041 (pattern consommateur unifié — superseded pour les types par ADR-0042), ADR-0009, ADR-0013, ADR-0014, ADR-0015, ADR-0017, ADR-0020 |

> **⚠ Mise à jour ADR-0042 (2026-05-06)**
>
> Le pattern documenté dans les sections **1–3** (`TConsumerDeps`, `TListenCallbacks`,
> `View<TDeps, TContract>`, `uiElements: Record<string, string>`) est **superseded**.
> Le pattern courant — modulaire, Feature-groupé, un seul générique, un seul `implements` —
> est documenté en **§4.2** et complètement spécifié dans
> [ADR-0042](../../adr/ADR-0042-view-contract-unified-ui-deps-single-generic.md).
>
> La réécriture complète des §1–3 est planifiée comme suite des actions de l'ADR-0042 ;
> en attendant, **§4.2 fait foi** sur le pattern d'API consommateur applicable.

---

## Table des matieres

1. [Classe abstraite View](#1-classe-abstraite-view)
2. [Declarations statiques](#2-declarations-statiques)
3. [Types mappes View](#3-types-mappes-view)
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

La View est paramétrée par deux génériques issus du **pattern consommateur unifié** (ADR-0041) :

```typescript
import type {
  TConsumerDeps,
  TConsumerContract,
  TListenCallbacks,
  TCommandPayload,
  TRequestParams,
  TRequestResult,
} from "@bonsai/feature";

/**
 * Contrat View -- etend TConsumerContract<TDeps> avec la map uiElements.
 *
 * uiElements : cle logique → selecteur CSS resoluble dans rootElement.
 * listens / triggers / requests : cles namespacees "ns:name" validees
 * compile-time par satisfies contre les Features declarees dans TDeps.
 */
type TViewContract<TDeps extends TConsumerDeps> = TConsumerContract<TDeps> & {
  readonly uiElements: Readonly<Record<string, string>>;
};

/**
 * Surface minimale d'une classe View — utilisee par Composer (variance).
 * Le code applicatif n'utilise jamais ce type directement.
 */
type TViewClass = abstract new () => View<any, any>;

abstract class View<
  TDeps extends TConsumerDeps,
  TContract extends TViewContract<TDeps>
> {
  /**
   * Manifeste de la View (ADR-0024 value-first + ADR-0041).
   * Evalue UNE SEULE FOIS au mount() -- le framework stocke le resultat.
   * Type TContract preserve les types litteraux des tableaux de cles.
   */
  abstract get contract(): TContract;

  /**
   * Le selecteur rootElement injecte au mount (I31).
   * Fourni par le Composer via TResolveResult.rootElement (ADR-0026).
   */
  get rootElement(): string | null;

  /**
   * Element DOM racine apres mount (I34).
   * Accessible dans onAttach() et les handlers.
   * Permet de lire les data-* attributes contextuels (ADR-0024).
   */
  protected get el(): HTMLElement | null;

  /**
   * Monte la View sur un rootElement. Appele par le Composer (I20).
   * Idempotent -- un second appel est un no-op.
   *
   * Sequence :
   *   1. Lecture unique de get contract() (ADR-0024)
   *   2. Resolution rootElement dans le DOM
   *   3. Validation I34 (pas document.body)
   *   4. Auto-discovery UI handlers D48 (on{UiKey}{DomEvent})
   *   5. Auto-discovery Event listeners I48 (on{Ns}{Event}Event)
   *      → throw I82 si handler manquant pour une cle dans contract.listens
   *   6. onAttach() lifecycle hook
   */
  mount(rootSelector: string): void;

  /**
   * Acces DOM type via getUI(key). Resolution dans le scope rootElement (I40).
   * Cle invalide (hors uiElements) → erreur compile-time.
   * Element absent du DOM → throw runtime.
   * (I39 — aucun querySelector direct autorise)
   */
  getUI<K extends keyof TContract["uiElements"] & string>(key: K): TProjectionNode;

  /**
   * Envoie un Command type via Channel (I4 — View n'a jamais emit()).
   * key : cle namespacee "ns:cmd" declaree dans contract.triggers.
   * payload : infere depuis TDeps via TCommandPayload<TDeps, K>.
   * Cle hors contrat → erreur compile-time.
   */
  protected trigger<K extends TContract["triggers"][number] & string>(
    key: K,
    payload: TCommandPayload<TDeps, K>
  ): void;

  /**
   * Effectue une Request synchrone typee (ADR-0023, I29).
   * key : cle namespacee "ns:req" declaree dans contract.requests.
   * Retourne le resultat type ou null si aucun replier enregistre (D44).
   */
  protected request<K extends TContract["requests"][number] & string>(
    key: K,
    params: TRequestParams<TDeps, K>
  ): TRequestResult<TDeps, K> | null;

  /** Hook appele apres le mount. Override dans les sous-classes. */
  onAttach(): void;
}
```

> **I4** : la View n'a **jamais** `emit()` — absent du type.
> **I30** : la View ne possede **aucun domain state** — projection pure.
> **I31** : `rootElement` est un selecteur CSS fourni par le Composer (ADR-0026).
> **I34** : `rootElement` ne peut pas etre `document.body`.
> **I39** : acces DOM **exclusivement** via `getUI(key)` — aucun acces brut.
> **I40** : scope DOM = rootElement, hors sous-arbres des slots declares.
> **I80** : aucun `TChannelToken` dans la surface publique — Channel prive derriere Feature.
> **I81** : `get contract()` evalue une seule fois au mount, source de verite runtime.
> **I82** : handler manquant pour une cle `listens` → erreur compile + throw runtime.
> **ADR-0024** : pattern value-first (`satisfies`) pour la declaration du contrat.
> **ADR-0026** : `rootElement` n'est **pas** dans `contract` — il vient du Composer.

---

## 2. Pattern consommateur unifie (ADR-0041)

Le pattern s'applique en **4 etapes** a chaque View concrete.
Il est identique pour Composer et Behavior (I83).

### 2.1 Vue d'ensemble des 4 etapes

```
Etape 1 — TDeps   : type pur, zero runtime, declare les Feature classes par lane
Etape 2 — contract : objet runtime valide par satisfies → cles namespacees verifiees
Etape 3 — TContract : type derive par typeof → preserve les types litteraux
Etape 4 — classe   : extends + implements → handlers requis par le compilateur
```

### 2.2 Exemple complet — CartView

```typescript
import { View, type TViewContract } from "@bonsai/view";
import { type TListenCallbacks } from "@bonsai/feature";
import { CartFeature } from "../Cart/cart.feature";

// ─── Etape 1 — TDeps : Features par lane (type pur) ────────────────────────
// Aucun import runtime ici — types uniquement.

type TCartViewDeps = {
  readonly listens:  [typeof CartFeature];   // Events ecoutes
  readonly triggers: [typeof CartFeature];   // Commands envoyees
  readonly requests: [typeof CartFeature];   // Requests effectuees
};

// ─── Etape 2 — Contrat : cles namespacees validees par satisfies ────────────
// satisfies TViewContract<TDeps> verifie compile-time que :
//   - chaque cle "ns:name" correspond a un Event/Command/Request
//     de la Feature declaree dans TDeps pour cette lane
//   - les cles hors contrat sont refusees

const cartViewContract = {
  uiElements: {
    addButton:    "[data-ui='addButton']",
    totalDisplay: "[data-ui='totalDisplay']",
    emptyMessage: "[data-ui='emptyMessage']",
  },
  listens:  ["cart:itemAdded"]  as const,
  triggers: ["cart:addItem"]    as const,
  requests: ["cart:getTotal"]   as const,
} satisfies TViewContract<TCartViewDeps>;

// ─── Etape 3 — Type derive : preserve les types litteraux ──────────────────
// typeof preserve les valeurs exactes des tableaux (tuple de string literals)
// pour que TListenCallbacks puisse generer les bons noms de handlers.

type TCartViewContract = typeof cartViewContract;

// ─── Etape 4 — Classe : implements rend les handlers obligatoires ───────────
// TListenCallbacks<TDeps, TContract> genere une interface avec une methode
// obligatoire par cle de contract.listens :
//   "cart:itemAdded" → onCartItemAddedEvent(payload: { productId: string }): void
//
// Handler absent → erreur TS2420 immediate.
// Payload incorrect → erreur TS immediate.

class CartView
  extends View<TCartViewDeps, TCartViewContract>
  implements TListenCallbacks<TCartViewDeps, TCartViewContract>
{
  get contract() { return cartViewContract; }

  // ── D48 — UI handler : on{UiKey}{DomEvent} ──────────────────────────────
  // Auto-decouvert depuis uiElements. Aucun mapping manuel.
  onAddButtonClick(_event: Event): void {
    // trigger : cle namespacee compilee contre contract.triggers
    // payload : infere depuis CartFeature.channel (TCartChannelDef.commands.addItem)
    this.trigger("cart:addItem", { productId: "abc", qty: 1 });
  }

  // ── I48 / I82 — Event listener : on{Namespace}{EventName}Event ──────────
  // Requis par implements TListenCallbacks — erreur compile si absent.
  // payload : infere depuis CartFeature.channel (TCartChannelDef.events.itemAdded)
  onCartItemAddedEvent(payload: { productId: string }): void {
    this.getUI("totalDisplay").text(payload.productId);
  }

  onAttach(): void {
    // Lecture du contexte DOM — data-* attributes disponibles via this.el
    const productId = this.el?.dataset.productId ?? "";
    this.getUI("emptyMessage").visible(productId === "");
  }
}
```

> **Enforcement compile-time** :
> - `abstract get contract()` : oubli → `TS2515` immediat.
> - `satisfies TViewContract<TDeps>` : cle hors contrat → erreur compile.
> - `implements TListenCallbacks<TDeps, TContract>` : handler manquant → `TS2420`.
> - `trigger("ns:cmd", payload)` : cle hors `contract.triggers` → erreur compile.
> - `getUI("key")` : cle hors `contract.uiElements` → erreur compile.

### 2.3 Principe : Channel prive derriere Feature (I80)

Le Channel n'est jamais manipule directement par le consommateur.
Le code applicatif ne voit que les **noms de Features** (`typeof CartFeature`)
et des **cles namespacees** (`"cart:addItem"`).

```typescript
// ✅ BON — surface consommateur : classe Feature + cle namespacee
type TCartViewDeps = { triggers: [typeof CartFeature] };
this.trigger("cart:addItem", { productId, qty });

// ❌ INTERDIT — exposition directe du token (I80)
import { CartFeature } from "../Cart/cart.feature";
const token: TChannelToken<TCartDef, "cart"> = CartFeature.channel; // non
this.trigger(CartFeature.channel, "addItem", { productId, qty });   // non
```

---

## 3. Types utilitaires du pattern consommateur

Ces types sont exportes par `@bonsai/feature` et `@bonsai/view`.
Ils sont utilises dans les 4 etapes du pattern — le developpeur les consomme
directement (etapes 2 et 4), le compilateur les utilise implicitement (inferences).

### 3.1 Types de l'etape 1 — TDeps

```typescript
/** Contrainte structurelle minimale : tout objet avec un channel type. */
type TFeatureRef<TDef = TChannelDefinition, TNS extends string = string> = {
  readonly channel: TChannelToken<TDef, TNS>;
};

/**
 * Shape de TDeps : trois lanes, chacune un tuple de TFeatureRef.
 * Le developpeur ecrit :
 *   type TMyDeps = { listens: [typeof CartFeature]; triggers: [typeof CartFeature]; requests: [] }
 */
type TConsumerDeps = {
  readonly listens:  readonly TFeatureRef[];
  readonly triggers: readonly TFeatureRef[];
  readonly requests: readonly TFeatureRef[];
};
```

### 3.2 Types de l'etape 2 — satisfies TViewContract

```typescript
/**
 * Extrait les cles "ns:eventName" valides depuis un TFeatureRef.
 * Exemple : TFeatureRef<TCartDef, "cart"> → "cart:itemAdded" | "cart:..."
 */
type TNSEventKeys<FC extends TFeatureRef>   = /* ... */;
type TNSCommandKeys<FC extends TFeatureRef> = /* ... */;
type TNSRequestKeys<FC extends TFeatureRef> = /* ... */;

/**
 * Contrat consommateur : trois tableaux de cles namespacees.
 * Utilise avec satisfies pour valider compile-time les cles declarees.
 */
type TConsumerContract<TDeps extends TConsumerDeps> = {
  readonly listens:  readonly TNSEventKeys<TDeps["listens"][number]>[];
  readonly triggers: readonly TNSCommandKeys<TDeps["triggers"][number]>[];
  readonly requests: readonly TNSRequestKeys<TDeps["requests"][number]>[];
};

/**
 * Contrat View = TConsumerContract + uiElements.
 * Utilise dans : const myContract = { ... } satisfies TViewContract<TDeps>
 */
type TViewContract<TDeps extends TConsumerDeps> = TConsumerContract<TDeps> & {
  readonly uiElements: Readonly<Record<string, string>>;
};
```

### 3.3 Types de l'etape 4 — implements TListenCallbacks

```typescript
/**
 * "cart:itemAdded" → "onCartItemAddedEvent"
 * Genere le nom de handler par template literal.
 */
type THandlerName<K extends string> =
  K extends `${infer NS}:${infer Ev}`
    ? `on${Capitalize<NS>}${Capitalize<Ev>}Event` : never;

/**
 * Payload d'un event depuis TDeps.
 * Exemple : TEventPayload<TCartViewDeps, "cart:itemAdded"> → { productId: string }
 */
type TEventPayload<TDeps, K extends string> = /* distribue sur union de TFeatureRef */;

/**
 * Interface generee automatiquement depuis contract.listens.
 * Une methode par cle — obligatoire sur la classe (I82).
 *
 * Exemple pour contract.listens = ["cart:itemAdded"] :
 *   { onCartItemAddedEvent(payload: { productId: string }): void }
 */
type TListenCallbacks<
  TDeps,
  TContract extends { readonly listens: readonly string[] }
> = {
  [K in TContract["listens"][number] as THandlerName<K>]:
    (payload: TEventPayload<TDeps, K>) => void;
};
```

> **Garanties compile-time** :
> - `trigger("ns:cmd", payload)` : cle hors `contract.triggers` → erreur compile.
> - `request("ns:req", params)` : cle hors `contract.requests` → erreur compile.
> - Payload de `trigger()` et `request()` : infere exactement depuis `TDeps`.
> - Handler manquant pour une cle `listens` → `TS2420` via `implements`.
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
