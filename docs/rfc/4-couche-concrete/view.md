# View — Composant de rendu et d'interaction UI

> **Projection DOM Reactive, UIMap typee, delegation d'evenements, localState**

[<- Retour couche concrete](README.md) | [-> Behavior](behavior.md) | [5-rendu.md (PDR complete)](../5-rendu.md)

---

| Champ | Valeur |
|-------|--------|
| **Composant** | View |
| **Couche** | Concrete (ephemere) |
| **Source**    | Historique : RFC-0002-api-contrats-typage §9 |
| **Statut** | Stable |
| **ADRs liees** | ADR-0009 (formulaires), ADR-0013 (code reuse), ADR-0014 (SSR/hydratation), ADR-0015 (localState), ADR-0017 (PDR vs VDOM), ADR-0020 (N-instances) |

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

```typescript
/**
 * TViewParams -- contrainte de validation pour l'objet params View (ADR-0024).
 * Utilise avec `as const satisfies TViewParams<TUI, TOptions>`.
 *
 * rootElement N'EST PAS dans TViewParams (ADR-0026) :
 * il est fourni par le Composer via TResolveResult.rootElement.
 *
 * @template TUI — type-level : types d'elements HTML + evenements DOM.
 * @template TOptions — type des options custom de la View.
 */
type TViewParams<
  TUI extends TUIMap<any>,
  TOptions extends Record<string, unknown> = Record<string, never>
> = {
  readonly listen:     readonly TChannelDefinition[];
  readonly trigger:    readonly TChannelDefinition[];
  readonly request:    readonly TChannelDefinition[];
  readonly uiElements: { readonly [K in keyof TUI]: string };
  readonly behaviors:  readonly (typeof Behavior)[];
  readonly options:    TOptions;
};

/**
 * TViewCapabilities -- type derive complet (ADR-0024 value-first).
 * Fusionne les types narrow de la valeur (typeof params) et le type
 * purement type-level (TUI) qui n'est pas dans l'objet runtime.
 */
type TViewCapabilities<
  TUI extends TUIMap<any>,
  TParams extends TViewParams<TUI, any>
> = {
  readonly listen:     TParams['listen'];
  readonly trigger:    TParams['trigger'];
  readonly request:    TParams['request'];
  readonly ui:         TUI;                    // type-level uniquement
  readonly uiElements: TParams['uiElements'];
  readonly behaviors:  TParams['behaviors'];
  readonly options:    TParams['options'];
};

abstract class View<TCapabilities extends TViewCapabilities<TUIMap<any>, any>> {
  /**
   * Declaration de la View -- identite et configuration (ADR-0024 value-first).
   * Abstract = obligatoire. Chaque View concrete le definit.
   *
   * Le const params est valide par `satisfies TViewParams<TUI, TOptions>`
   * puis le type derive `TViewCapabilities<TUI, typeof params>` est passe
   * en generic de la classe.
   *
   * rootElement n'est PAS dans params (ADR-0026) --
   * le Composer le fournit via TResolveResult.rootElement.
   *
   * Le Composer peut override les options via resolve() -> options (D34).
   */
  abstract get params(): TCapabilities;

  // PAS de abstract get uiEvents() -- D48 (AUTO-UI-EVENT-DISCOVERY)
  // Le framework auto-derive les handlers depuis TUIMap.
  // Les handlers conventionnels (on${Key}${Event}) sont detectes au bootstrap.

  /**
   * Map des templates de projection (compiles depuis .pug).
   * Trois modes mutuellement exclusifs :
   * - null           -> Mode A : pas de template, projection via getUI()
   * - { root: B }    -> Mode B : template complet, possede tout this.el
   * - { [K]: B }     -> Mode C : fragments (ilots), cles issues de TUI
   *                   ou B = { template: TProjectionTemplate, select?: fn }
   */
  get templates(): TViewTemplates<TCapabilities['ui']> { return null; }

  /** Options effectives = merge(this.params.options, composerOptions). Readonly apres onAttach(). */
  protected readonly resolvedOptions: Readonly<TCapabilities['options']>;

  /** Element DOM racine -- fourni par le Composer via rootElement (ADR-0026), resolu par le framework */
  protected readonly el!: HTMLElement;

  /**
   * Nodes de projection -- peuple automatiquement par le framework
   * dans onAttach() a partir de get templates().
   * Chaque cle correspond a une cle de templates().
   */
  protected readonly nodes!: TViewNodes<TCapabilities['ui']>;

  /**
   * Resout un @ui par son nom logique.
   * Le type de retour est TProjectionNode<TUI[K]['el']> ou TProjectionRead<TUI[K]['el']>
   * selon que le @ui est couvert par un template ou non (I41, D32).
   * Le type d'element HTML (D35) est propage depuis TUIMap.
   */
  protected getUI<K extends keyof TCapabilities['ui'] & string>(key: K):
    TProjectionNode<TCapabilities['ui'][K]['el']> | TProjectionRead<TCapabilities['ui'][K]['el']>;

  /**
   * Behaviors attaches a cette View (plugins UI reutilisables).
   * Retourne un tableau de classes Behavior. Le framework instancie
   * chaque Behavior au onAttach() et le detruit au onDetach().
   */
  get behaviors(): readonly (typeof Behavior)[] { return []; }
}
```

> **I30** : la View ne possede **aucun domain state**. Projection pure.
> **I42** : la View **peut** declarer un state local de presentation (D33) -- type, reactif, encapsule, non-broadcastable.
> **I31** : le `rootElement` doit exister dans le DOM au moment de `onAttach()` (ADR-0026 : fourni par le Composer, resolu par le framework).
> **I39** : la View accede au DOM **exclusivement** via `getUI(key)` -- aucun acces DOM brut.
> **I40** : le scope DOM de la View exclut les sous-arbres des slots declares (D31).
> **I41** : chaque @ui a une source de mutation unique -- `TProjectionNode` ou `template.project()`, jamais les deux (D32).
> **D34** : la View declare ses options via `params.options` -- le Composer override via `resolve().options`.
> **D35** : `TUIMap` contraint le type d'element HTML (`el`), pas le selecteur CSS.
> **ADR-0024** : pattern value-first (`as const satisfies`) pour la declaration des capacites.
> **ADR-0026** : `rootElement` n'est **PAS** dans `params` -- il vient du Composer.

---

## 2. Declaration des capacites (ADR-0024)

Les capacites d'une View (Channels ecoutes, declenchables, interrogeables,
elements UI, Behaviors, options) sont declarees dans un **objet params
value-first** valide par `as const satisfies` (ADR-0024).

Le pattern value-first elimine la double saisie -- la valeur est ecrite une seule
fois dans un `const`, le type est derive via `typeof`, et le getter `get params()`
renvoie le const :

```typescript
const cartViewParams = {
  listen:     [Cart.channel, Inventory.channel],
  trigger:    [Cart.channel],
  request:    [Cart.channel, Pricing.channel],
  uiElements: {
    addButton:    '.Cart-addButton',
    totalDisplay: '.Cart-totalDisplay',
  },
  behaviors:  [],
  options:    {},
} as const satisfies TViewParams<TCartViewUI>;

type TCartViewCapabilities = TViewCapabilities<TCartViewUI, typeof cartViewParams>;

class CartView extends View<TCartViewCapabilities> {
  get params() { return cartViewParams; }
}
```

> **Enforcement compile-time** : `abstract get params()` est herite de `View`.
> Un oubli de `get params()` dans une sous-classe est une erreur de compilation
> immediate (`TS2515: Non-abstract class does not implement inherited abstract member`).
> Les `static readonly` ne sont plus utilises (ADR-0024 §Rejet Option A).

> Voir §4.2 pour l'exemple complet CartView avec templates et handlers.

---

## 3. Types mappes View

Les types suivants permettent au compilateur de verifier que les appels
`trigger()` et `request()` d'une View ne referencent que des Channels
declares dans le manifeste `params`, avec les bons payloads et types de retour.

```typescript
/**
 * Contraint les appels trigger() d'une View aux Commands
 * des Channels declares dans params.trigger (ADR-0024).
 */
type TViewTriggerCapability<
  TChannels extends readonly TChannelDefinition[]
> = {
  trigger<
    TTarget extends TChannels[number],
    K extends keyof TTarget['commands'] & string
  >(
    channel: { namespace: TTarget['namespace'] },
    commandName: K,
    payload: TTarget['commands'][K]
  ): void;
};

/**
 * Contraint les appels request() d'une View aux Requests
 * des Channels declares dans params.request (ADR-0024).
 *
 * Retourne T | null **synchrone** (ADR-0023, I29) :
 * le replier ne peut qu'acceder a l'etat de son Entity, deja en memoire.
 */
type TViewRequestCapability<
  TChannels extends readonly TChannelDefinition[]
> = {
  request<
    TTarget extends TChannels[number],
    K extends keyof TTarget['requests'] & string
  >(
    channel: { namespace: TTarget['namespace'] },
    requestName: K
  ): (TTarget['requests'][K] extends { result: infer R } ? R : never) | null;
};

/**
 * Genere les handlers Event optionnels pour une View,
 * depuis les Channels declares dans params.listen (ADR-0024).
 *
 * Reutilise le meme pattern que TEventHandlers (Feature),
 * mais applique au tuple TChannels de la View.
 */
type TViewEventHandlers<
  TChannels extends readonly TChannelDefinition[]
> = TEventHandlers<TChannels>;
```

> **Garanties compile-time** :
> - `trigger()` ne reference que des Commands de Channels declares dans `params.trigger`
> - `request()` ne reference que des Requests de Channels declares dans `params.request`
> - Les event handlers `on<Ns><Event>Event()` sont verifies contre les Channels declares dans `params.listen`
> - `emit()` n'est **jamais** disponible sur une View (I4, D7) -- absent du type

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

### 4.2 UIElements et UIEvents

La View **DOIT** declarer ses noeuds d'interaction DOM et leurs evenements.

```typescript
// -- 1. Contrat de type -- quels noeuds, quel type HTML, quels evenements possibles --

/**
 * TUIMap : contrat structurel de la View.
 * - `el`    : type d'element HTML (HTMLButtonElement, HTMLInputElement, etc.)
 * - `event` : evenements DOM autorises (tuple de noms d'evenements)
 *
 * La cle `root` est INTERDITE -- reservee pour get templates().
 * Le selecteur CSS n'est PAS dans TUIMap -- c'est un detail d'implementation
 * qui vit dans params.uiElements (D34, D35).
 */
type TUIMap<T extends Record<string, { el: HTMLElement; event: string[] }>> =
  'root' extends keyof T ? never : T;

// Exemple concret :
type TCartViewUI = TUIMap<{
  addButton:    { el: HTMLButtonElement;  event: ['click'] };
  totalDisplay: { el: HTMLSpanElement;    event: [] };
  searchInput:  { el: HTMLInputElement;   event: ['input', 'change'] };
  itemList:     { el: HTMLUListElement;   event: [] };
}>;

// -- 2. Auto-discovery des handlers (D48 -- AUTO-UI-EVENT-DISCOVERY) --
// La recompense directe du contrat TUIMap : le framework derive automatiquement
// les handlers -- aucun mapping manuel requis.
//   cle 'addButton' + event 'click'  -> methode onAddButtonClick
//   cle 'searchInput' + event 'input' -> methode onSearchInputInput
//
// Convention : on${Capitalize<Key>}${Capitalize<Event>}
// Meme pattern que D12 (handlers Feature auto-decouverts via onXXX).
// get uiEvents() N'EXISTE PLUS -- le mapping est automatique.

/**
 * TAutoUIEventHandlers -- genere automatiquement les signatures de handlers
 * depuis le TUIMap. Chaque combinaison (cle x event) produit un handler optionnel.
 */
type TAutoUIEventHandlers<TUI extends TUIMap<any>> = Partial<{
  [K in keyof TUI as TUI[K]['event'] extends readonly (infer E extends string)[]
    ? `on${Capitalize<K & string>}${Capitalize<E>}`
    : never
  ]: (event: TUIEventFor<TUI, K & string, TUI[K]['event'][number]>) => void;
}>;

// -- 3. Helper -- type d'evenement DOM infere depuis TUIMap --

/**
 * Resout le type d'evenement DOM + currentTarget type par l'element HTML declare.
 * Ex: TUIEventFor<TCartViewUI, 'addButton', 'click'>
 *   -> MouseEvent & { currentTarget: HTMLButtonElement }
 */
type TUIEventFor<
  TUI extends TUIMap<any>,
  K extends keyof TUI & string,
  E extends TUI[K]['event'][number] & keyof HTMLElementEventMap
> = HTMLElementEventMap[E] & { currentTarget: TUI[K]['el'] };

// -- 4. Resolution -- selecteurs CSS associes aux noms logiques --

type TUIElements<TUI extends TUIMap<any>> = {
  [K in keyof TUI]: string;
};
```

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

  onAddButtonClick(event: MouseEvent & { currentTarget: HTMLButtonElement }): void {
    this.trigger(Cart.channel, 'addItem', { productId: '...' });
  }

  onSearchInputInput(event: InputEvent & { currentTarget: HTMLInputElement }): void {
    this.trigger(Cart.channel, 'search', { query: event.currentTarget.value });
  }

  onSearchInputChange(event: Event & { currentTarget: HTMLInputElement }): void {
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
  this.getUI('totalDisplay').text(`${payload.total} EUR`);
}

onCartItemAddedEvent(payload: { count: number }): void {
  this.getUI('badgeCount').text(payload.count);
  this.getUI('badgeCount').toggleClass('has-items', payload.count > 0);
}

// Lecture de valeur d'un input (formulaire) -- TProjectionRead
onSubmitClick(): void {
  const username = this.getUI('usernameInput').value();
  const remember = this.getUI('rememberCheckbox').checked();
  this.trigger(Auth.channel, 'login', { username, remember });
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
