# ADR-0042 : Pattern modulaire de contrat consommateur — `TFeatureContract` Feature-groupé + `TUIContract` + `TUIElements`

| Champ                  | Valeur |
| ---------------------- | ------ |
| **Statut**             | 🟢 Accepted |
| **Date**               | 2026-05-06 |
| **Décideurs**          | @ncac |
| **RFC liées**          | [view.md](../rfc/4-couche-concrete/view.md), [invariants.md](../rfc/reference/invariants.md), [glossaire.md](../rfc/reference/glossaire.md) |
| **ADR liées**          | [ADR-0041](ADR-0041-consumer-pattern-feature-as-public-unit.md) (supersédée pour les types `TConsumerDeps` / `TConsumerContract` / `TListenCallbacks`), [ADR-0040](ADR-0040-channel-as-only-public-channel-token.md), [ADR-0039](ADR-0039-application-manifest-namespace-authority.md), [ADR-0029](ADR-0029-v1-scope-freeze.md) |
| **Décisions amendées** | ADR-0041 — `TConsumerDeps` (lane-groupé) → `TFeatureContract` (Feature-groupé) ; `TConsumerContract<TDeps>` fusionné dans `TFeatureContract` ; `TListenCallbacks` remplacé par `TViewCallbacks` (qui couvre channel + DOM). ADR-0029 — entrée « View basic » strate 1 enrichie ; pattern modulaire `TXxxContract` ajouté en fondation strate 1+. |
| **Invariants impactés** | I81, I82, I83 (reformulés) — I84, I85, I86, I87 (nouveaux) |

---

## Contexte

ADR-0041 a établi le pattern consommateur unifié pour la couche channels (`TConsumerDeps` / `TConsumerContract<TDeps>` / `TListenCallbacks<TDeps, TContract>`). Trois surfaces sont restées non résolues à l'usage.

### Surface 1 — `TConsumerDeps` lane-groupé sépare ce qui appartient à une même Feature

```ts
type TMyViewDeps = {
  listens:  [typeof CartFeature, typeof UserFeature];
  triggers: [typeof CartFeature];
  requests: [typeof UserFeature];
};
```

`CartFeature` apparaît deux fois (listens + triggers), `UserFeature` deux fois (listens + requests). Le développeur doit reconstituer mentalement « qu'est-ce que ma View consomme de CartFeature » en croisant trois listes. Le coût d'audit cognitif augmente linéairement avec le nombre de Features consommées.

### Surface 2 — `getUI()` non typé au sous-type HTMLElement

```ts
getUI("addBtn")  // → TProjectionNode (HTMLElement générique)
getUI("total")   // → TProjectionNode (même type — HTMLSpanElement perdu)
```

Toute opération nécessitant le sous-type (`HTMLInputElement.value`) exige un cast manuel — perte de la garantie « le type EST le contrat ».

### Surface 3 — Handlers DOM D48 non vérifiés à la compilation

`uiElements: Record<string, string>` ne porte aucune information sur les events DOM gérés. La convention auto-discovery D48 (`on{UIKey}{DomEvent}`) génère les handlers depuis les noms de méthodes présents — mais aucun mécanisme compile-time n'impose qu'un élément déclaré comme interactif (par exemple `addBtn` pour un click) ait son handler.

### Surface 4 — Multiplicité de génériques et de clauses `implements`

Le pattern ADR-0041 :

```ts
class MyView
  extends View<TMyDeps, TMyContract>                     // 2 génériques
  implements TListenCallbacks<TMyDeps, TMyContract>       // 1 clause implements
  // Toute extension UI typée ajouterait un 2ème implements
```

L'ajout de l'enforcement DOM augmenterait à 3 génériques + 2 clauses `implements`. La signature de classe se fragmente.

---

## Contraintes

| #  | Contrainte | Source |
|----|-----------|--------|
| C1 | Le pattern doit être **modulaire** : chaque sous-contrat (Feature, UI events, UI selectors) est un module réutilisable | Q4 — chaque composant compose ses propres modules |
| C2 | **Un seul générique** sur `View<>` — pas de `View<TDeps, TContract, TUIMap>` | Q1 — DX de première classe |
| C3 | **Une seule clause `implements`** — `TViewCallbacks<TContract>` couvre channel + DOM | Q1 |
| C4 | Toute interaction DOM déclarée (`events: ['click']`) DOIT avoir son handler implémenté | Q1 — la déclaration est l'engagement |
| C5 | `events` est **obligatoire** dans une entrée UI — pas de champ optionnel | Q1 + ADR-0042 v1 |
| C6 | `getUI(key)` retourne un `TProjectionNode<TEl>` typé au sous-type HTMLElement déclaré | « Le type EST le contrat » |
| C7 | Les **sélecteurs CSS** ne sont **pas** dans le contrat type-level — ils vivent dans `get uiElements()` overridable par le Composer | view.md §4.2 (D34, D35) |
| C8 | Les events DOM (`["click"]`) **sont** dans le contrat — nécessaires pour TViewCallbacks et `addEventListener` | C4 → enforcement compile-time |
| C9 | Pour les channels, on raisonne **par Feature** (Feature-groupé), pas par lane | Q2 — `proposition.md` §B |
| C10 | La clé d'objet d'une entrée Feature DOIT correspondre au namespace de la Feature — incohérence → erreur compile | Q4 (« absolument ») |
| C11 | Les types `TConsumerDeps`, `TConsumerContract`, `TListenCallbacks` (ADR-0041) sont **supprimés** — pas de période de dépréciation | Q5 |
| C12 | L'API runtime conserve les clés **flat-préfixées** : `this.trigger("cart:addItem", payload)` | I80, ADR-0040 — Channel privé, accès via clé namespacée |
| C13 | Convention D48 channel : `on{NS}{EventName}Event` (suffixe `Event` conservé pour anti-collision avec les handlers DOM) | Q1 |
| C14 | Convention D48 UI : `on{UIKey}{DomEvent}` (sans suffixe) | Existant |
| C15 | **Symétrie Contract/Callbacks** : pour tout `T{Component}Contract`, un `T{Component}Callbacks` correspondant impose au compile-time les handlers `on*` dérivés du contrat. Un contrat sans son Callbacks est interdit. | Discussion architecturale — « on respecte toujours un contrat signé » |

---

## Options considérées

### Option A — Garder ADR-0041 lane-groupé, ajouter `TUIMap` en troisième générique (rejetée)

`TConsumerDeps` reste lane-groupé. `TUIMap` est un type séparé. Trois génériques sur `View<>`. Deux clauses `implements`.

```ts
type TMyViewDeps = {
  listens:  [typeof CartFeature, typeof UserFeature];
  triggers: [typeof CartFeature];
  requests: [typeof UserFeature];
};

const myContract = {
  uiElements: { total: ".total", addBtn: "#btn" } as const,
  listens:    ["cart:itemAdded", "user:profileUpdated"] as const,
  triggers:   ["cart:addItem"] as const,
  requests:   ["user:getProfile"] as const,
} satisfies TViewContract<TMyViewDeps>;
type TMyContract = typeof myContract;

type TMyUIMap = {
  total:  { el: HTMLSpanElement;   events: [] };
  addBtn: { el: HTMLButtonElement; events: ["click"] };
};

class MyView
  extends View<TMyViewDeps, TMyContract, TMyUIMap>           // 3 génériques
  implements TListenCallbacks<TMyViewDeps, TMyContract>      // 1er implements
  implements TUICallbacks<TMyUIMap>                           // 2ème implements
{ ... }
```

**Problèmes :**
- Viole C1, C2, C3, C9.
- `TMyUIMap` (type pur) et `uiElements` (valeur) décrivent les mêmes clés sous deux formes — risque de désynchronisation.
- Sélecteurs CSS dans le contrat type-level → viole C7 (overridability D34).
- `TConsumerDeps` reste lane-groupé → viole C9.

---

### Option B — Pattern modulaire Feature-groupé `TFeatureContract` + `TUIContract` + composition ✅

**Principe** — trois modules contractuels indépendants, composés par chaque composant selon ses capacités :

| Module | Rôle | Composants concernés |
|--------|------|----------------------|
| `TFeatureContract` | Interactions channel par Feature (listens / triggers / requests Feature-groupés) | View, Behavior, Composer |
| `TUIContract` | Nœuds DOM avec type HTML + events DOM (sans sélecteurs) | View, Behavior |
| `TUIElements<TUI>` | Map nom → sélecteur CSS (overridable D34) | View, Behavior |

Chaque composant **compose son propre `TXxxContract`** :

```ts
type TViewContract<F, U>     = { features: F; ui: U }   // F + U
type TBehaviorContract<F, U> = { features: F; ui: U }   // F + U + spécificités strate 2
type TComposerContract<F>    = { features: F }          // F seul (I35 : pas d'UI)
type TFoundationContract     = {}                        // strate 0 — vide
```

Le développeur déclare **trois valeurs** dans le header (chacune validée par `satisfies`), un alias type composé, puis attache **un seul générique** à la classe.

#### Étape 1 — `TFeatureContract` Feature-groupé

```ts
// Header — valeur Feature-groupée, type inféré par typeof
const cartViewFeatures = {
  cart: {
    feature:  CartFeature,                              // runtime ref — extrait channel/events/...
    listens:  ["itemAdded", "itemRemoved"] as const,    // sans préfixe — la clé EST le namespace
    triggers: ["addItem"]                  as const,
    requests: []                           as const,
  },
  user: {
    feature:  UserFeature,
    listens:  ["profileUpdated"]           as const,
    triggers: []                           as const,
    requests: ["getProfile"]               as const,
  },
} satisfies TFeatureContract;
//          ↑ "invalidEvent" sur cart.listens → ❌ erreur compile
//          ↑ cart: { feature: UserFeature } → ❌ erreur compile (clé !== namespace)
```

#### Étape 2 — `TUIContract` (events DOM + phantom TEl, sans sélecteurs)

```ts
const cartViewUiEvents = {
  total:    ui<HTMLSpanElement>([]),                    // C5 : non-interactif explicite
  addBtn:   ui<HTMLButtonElement>(["click"]),           // C4 : onAddBtnClick requis
  qtyInput: ui<HTMLInputElement>(["input", "change"]),  // C4 : 2 handlers requis
} satisfies TUIContract;
```

`ui<TEl>(events)` est le helper qui encode :
- `TEl` (phantom `_el?`) — compile-time uniquement, pour le typage de `getUI(k).element() → TEl`
- `events` (runtime + compile-time) — pour `addEventListener` D48 et la dérivation des handlers requis

Aucun sélecteur — il vit dans le getter séparé (C7).

#### Étape 3 — `TUIElements<TUI>` (sélecteurs CSS, overridable D34)

```ts
const cartViewUiElements = {
  total:    ".cart-total",
  addBtn:   "#add-btn",
  qtyInput: ".qty-input",
} satisfies TUIElements<typeof cartViewUiEvents>;
//          ↑ contraint les clés à matcher cartViewUiEvents — pas d'orphelin possible
```

#### Étape 4 — Type composé + classe (un générique, un implements)

```ts
type TCartViewContract = TViewContract<
  typeof cartViewFeatures,
  typeof cartViewUiEvents
>;

class CartView
  extends View<TCartViewContract>
  implements TViewCallbacks<TCartViewContract>
{
  get features()   { return cartViewFeatures; }
  get uiEvents()   { return cartViewUiEvents; }
  get uiElements() { return cartViewUiElements; }   // ← overridable par Composer (D34)

  // ── Channel handlers — D48 channel : on{NS}{Event}Event ─────────────
  onCartItemAddedEvent(p: { id: string; qty: number }, m: TEventMetas): void {
    this.getUI("total").text(`${p.qty} items`);     // → TProjectionNode<HTMLSpanElement>
    this.getUI("addBtn").element();                  // → HTMLButtonElement
  }
  onCartItemRemovedEvent(p: { id: string }, m: TEventMetas): void { ... }
  onUserProfileUpdatedEvent(p: { name: string }, m: TEventMetas): void { ... }

  // ── DOM handlers — D48 UI : on{UIKey}{DomEvent} ─────────────────────
  onAddBtnClick(e: MouseEvent): void {
    this.trigger("cart:addItem", { id: "p1", qty: 1 });  // ✅ inféré
  }
  onQtyInputInput(e: Event): void { ... }
  onQtyInputChange(e: Event): void { ... }
  // Aucun handler requis pour `total` (events: [])
}
```

---

## Analyse comparative

| Critère | A — 3 génériques, 2 implements, lane-groupé | B — Modulaire, 1 générique, 1 implements, Feature-groupé |
|---------|-------------|-------------|
| Nombre de génériques sur `View<>` | ❌ 3 | ✅ 1 |
| Nombre de clauses `implements` | ❌ 2 | ✅ 1 |
| Co-localisation Feature ↔ events | ❌ Mélangé par lane | ✅ Groupé par Feature |
| Préfixe namespace dans déclarations | ❌ Répété (`"cart:itemAdded"` ×N) | ✅ Éliminé (la clé EST le namespace) |
| Sélecteurs CSS overridables (D34) | ❌ Dans le contrat type-level | ✅ Dans `get uiElements()` séparé |
| Handlers DOM enforcement compile-time | ⭐ Via `TUICallbacks<TUIMap>` | ✅ Via `TViewCallbacks<TVC>` unifié |
| `getUI(key)` retourne sous-type typé | ✅ Via `TUIMap[key]['el']` | ✅ Via `ui[key]` phantom |
| Réutilisabilité pour Composer/Behavior | ❌ `TViewContract` non décomposable | ✅ `TFeatureContract` + `TUIContract` réutilisables |
| Strict clé/namespace `cart: { feature: UserFeature }` | ❌ N/A (pas de mapping) | ✅ Erreur compile |
| Alignement avec C1–C14 | ❌ Viole C1, C2, C3, C7, C9 | ✅ Toutes |

---

## Décision

Nous choisissons **Option B**.

### Argument 1 — Le contrat est modulaire par construction

Une View consomme des Features (channel) et manipule du DOM (UI). Un Composer ne consomme que des Features (I35). Une Foundation ne fait ni l'un ni l'autre (strate 0). Plutôt qu'un type monolithique par composant, **trois modules réutilisables** se composent selon les capacités. La matrice (proposition.md §484) donne directement la composition.

### Argument 2 — Feature-groupé reflète la réalité cognitive

Le développeur pense « qu'est-ce que ma View consomme de CartFeature ? », pas « quels sont mes listens, indépendamment de la Feature d'origine ? ». La forme `cart: { listens: [...]; triggers: [...]; requests: [...] }` co-localise tout ce qui concerne CartFeature en un seul bloc. Le préfixe `"cart:"` disparaît des déclarations (la clé est déjà le namespace).

### Argument 3 — La déclaration EST l'engagement (extension de I82)

`events: ["click"]` sur `addBtn` n'est pas une suggestion — c'est un contrat. Le compilateur doit refuser l'absence de `onAddBtnClick`. La distinction « contrat inter-composants vs intra-View » n'a pas lieu d'être : dans les deux cas, déclarer une capacité oblige à honorer. `TViewCallbacks<TVC>` traite les handlers channel et DOM symétriquement.

### Argument 4 — Suffixe `Event` pour les handlers channel (anti-collision)

`onCartItemAdded` (sans suffixe) collisionnerait avec un futur `ui = { cart: { ... } }` + `events: ['itemAdded']` (improbable mais possible). `onCartItemAddedEvent` rend l'intention non-ambiguë. Les handlers DOM gardent la forme courte `onAddBtnClick` (un click DOM est un click DOM, pas de risque).

### Argument 5 — Symétrie `TXxxContract` / `TXxxCallbacks` (C15)

Un contrat sans son contrat d'implémentation est une déclaration sans engagement. Pour chaque `T{Component}Contract` (ce que le composant déclare), il existe un `T{Component}Callbacks` (ce que le composant doit implémenter) :

| Contract (déclaration) | Callbacks (implémentation forcée) |
|------------------------|-----------------------------------|
| `TViewContract<F, U>` | `TViewCallbacks<TVC> = TChannelCallbacks<F> & TUICallbacks<U>` |
| `TBehaviorContract<F, U, ...>` | `TBehaviorCallbacks<TBC> = TChannelCallbacks<F> & TUICallbacks<U> & ...` |
| `TComposerContract<F>` | `TComposerCallbacks<TCC> = TChannelCallbacks<F>` |
| `TFoundationContract` | `TFoundationCallbacks<TFC>` (vide en strate 0, peuplé en strate 1+) |

La règle s'écrit : **on respecte toujours un contrat signé**. Le développeur écrit deux choses dans la déclaration de classe — `extends X<TXxxContract>` et `implements TXxxCallbacks<TXxxContract>` — et le compilateur fait le reste.

Conséquence pratique : tout nouveau composant Bonsai introduit AU MINIMUM deux types publics côtés `@bonsai/<component>` : son `Contract` et son `Callbacks`. Les modules contractuels intermédiaires (`TFeatureContract`, `TUIContract`, …) sont des briques internes ; les types qu'un développeur applicatif manipule sont la paire `T{Component}Contract` + `T{Component}Callbacks`.

### Pourquoi rejeter A

L'Option A empile génériques et clauses `implements` sans simplifier la déclaration. Elle laisse `TConsumerDeps` lane-groupé (C9 violée), maintient les sélecteurs dans le contrat type-level (C7 violée), et ne décompose pas le contrat en modules réutilisables (C1 violée).

---

## Types utilitaires — signatures complètes

Ces types sont définis dans **`packages/feature/src/types.ts`** (modules contractuels Feature) et **`packages/view/src/bonsai-view.ts`** (modules contractuels UI + composition View).

### Module Feature (dans `@bonsai/feature`)

```ts
// ─── TFeatureContract ────────────────────────────────────────────────────────

/**
 * Module contractuel Feature — Feature-groupé.
 * Une entrée par Feature consommée. La clé d'objet DOIT correspondre au
 * namespace de la Feature référencée par `feature` (C10).
 *
 * Pour chaque Feature :
 *   - `feature`  : ref runtime (typeof CartFeature) — extrait channel/events/commands/requests
 *   - `listens`  : noms d'events sans préfixe namespace
 *   - `triggers` : noms de commands sans préfixe namespace
 *   - `requests` : noms de requests sans préfixe namespace
 */
export type TFeatureContract = {
  readonly [NS in string]: {
    readonly feature:  TFeatureRefForNS<NS>;
    readonly listens:  readonly string[];
    readonly triggers: readonly string[];
    readonly requests: readonly string[];
  };
};

/**
 * Contraint un Feature ref à matcher un namespace donné (C10).
 * `cart: { feature: UserFeature, ... }` → erreur compile.
 */
export type TFeatureRefForNS<NS extends string> =
  abstract new (...args: any[]) => {
    readonly channel: TChannelToken<TChannelDefinition, NS>;
  };

// ─── Helpers d'extraction ────────────────────────────────────────────────────

/** Aplatit toutes les listens en union de clés flat-préfixées. */
export type TFlatListens<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["listens"][number] extends infer E
    ? E extends string ? `${NS}:${E}` : never
    : never
}[keyof F & string];

/** Aplatit toutes les triggers en union de clés flat-préfixées. */
export type TFlatTriggers<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["triggers"][number] extends infer C
    ? C extends string ? `${NS}:${C}` : never
    : never
}[keyof F & string];

/** Aplatit toutes les requests en union de clés flat-préfixées. */
export type TFlatRequests<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["requests"][number] extends infer R
    ? R extends string ? `${NS}:${R}` : never
    : never
}[keyof F & string];

/** Payload d'un event depuis une clé "ns:event" et le contrat Feature. */
export type TEventPayloadFor<F extends TFeatureContract, K extends string> =
  K extends `${infer NS}:${infer E}`
    ? NS extends keyof F
      ? F[NS]["feature"] extends abstract new (...a: any) => { readonly channel: infer Ch }
        ? Ch extends TChannelToken<infer D, NS>
          ? E extends keyof D["events"] ? D["events"][E] : never
          : never : never : never : never;

/** Payload d'une command depuis une clé "ns:cmd". */
export type TCommandPayloadFor<F extends TFeatureContract, K extends string> =
  K extends `${infer NS}:${infer C}`
    ? NS extends keyof F
      ? F[NS]["feature"] extends abstract new (...a: any) => { readonly channel: infer Ch }
        ? Ch extends TChannelToken<infer D, NS>
          ? C extends keyof D["commands"] ? D["commands"][C] : never
          : never : never : never : never;

/** Params d'une request. */
export type TRequestParamsFor<F extends TFeatureContract, K extends string> = /* idem */;
/** Résultat d'une request. */
export type TRequestResultFor<F extends TFeatureContract, K extends string> = /* idem */;

// ─── Channel handlers (D48 channel) ──────────────────────────────────────────

/** Dérive `"cart:itemAdded"` → `"onCartItemAddedEvent"` (C13). */
export type TChannelHandlerName<NS extends string, E extends string> =
  `on${Capitalize<NS>}${Capitalize<E>}Event`;

/**
 * Handlers channel REQUIS — un par event déclaré dans `listens` de chaque Feature.
 * Utilise UnionToIntersection pour produire l'intersection de tous les handlers.
 */
export type TChannelCallbacks<F extends TFeatureContract> = UnionToIntersection<{
  [NS in keyof F & string]: {
    [E in F[NS]["listens"][number] as TChannelHandlerName<NS, E & string>]:
      (payload: TEventPayloadFor<F, `${NS}:${E & string}`>, metas: TEventMetas) => void
  }
}[keyof F & string]>;
```

### Module UI (dans `@bonsai/view`)

```ts
// ─── TUIEntry + ui() helper ──────────────────────────────────────────────────

/**
 * Entrée UI typée.
 *  - `events` : événements DOM déclarés (OBLIGATOIRE — C5)
 *  - `_el?`   : phantom TEl (compile-time only, jamais alloué au runtime)
 *
 * AUCUN sélecteur ici (C7 — vit dans get uiElements()).
 */
export type TUIEntry<
  TEl extends HTMLElement = HTMLElement,
  TEvts extends readonly string[] = readonly string[]
> = {
  readonly events: TEvts;
  readonly _el?:   TEl;
};

/**
 * Helper de construction.
 *
 * @example ui<HTMLButtonElement>(["click"])     // interactif
 * @example ui<HTMLSpanElement>([])              // non-interactif explicite
 * @example ui<HTMLInputElement>(["input", "change"])
 */
export function ui<
  TEl extends HTMLElement = HTMLElement,
  const TEvts extends readonly string[] = readonly string[]
>(events: TEvts): TUIEntry<TEl, TEvts> {
  return { events } as TUIEntry<TEl, TEvts>;
}

// ─── TUIContract + TUIElements ───────────────────────────────────────────────

/** Module contractuel UI — clés → entrées typées. */
export type TUIContract = Readonly<Record<string, TUIEntry>>;

/**
 * Module sélecteurs CSS — overridable par Composer (D34).
 * Contraint les clés à matcher TUI : aucun orphelin possible.
 */
export type TUIElements<TUI extends TUIContract> = {
  readonly [K in keyof TUI]: string;
};

/** Extrait le sous-type HTMLElement d'une TUIEntry via le phantom. */
export type ExtractEl<TEntry extends TUIEntry> =
  TEntry extends TUIEntry<infer TEl, any> ? TEl : HTMLElement;

// ─── TProjectionNode<TEl> générique ──────────────────────────────────────────

export type TProjectionNode<TEl extends HTMLElement = HTMLElement> = {
  text(value: string): void;
  attr(name: string, value: string): void;
  toggleClass(className: string, force: boolean): void;
  visible(show: boolean): void;
  style(property: string, value: string): void;
  element(): TEl;
};

// ─── UI handlers (D48 UI) ────────────────────────────────────────────────────

export type TDOMEventFor<S extends string> =
  S extends keyof HTMLElementEventMap ? HTMLElementEventMap[S] : Event;

/**
 * Handlers DOM REQUIS pour une entrée UI : un par event déclaré (C14).
 * Convention : on{UIKey}{DomEvent} (sans suffixe `Event` — un click reste un click).
 */
export type TUIEntryHandlers<TKey extends string, TEntry extends TUIEntry> =
  TEntry extends TUIEntry<any, infer TEvts>
    ? { [E in TEvts[number] as `on${Capitalize<TKey>}${Capitalize<E & string>}`]:
          (e: TDOMEventFor<E & string>) => void }
    : never;

export type TUICallbacks<U extends TUIContract> = UnionToIntersection<{
  [K in keyof U]: TUIEntryHandlers<K & string, U[K]>
}[keyof U]>;
```

### Composition View (dans `@bonsai/view`)

```ts
// ─── TViewContract ───────────────────────────────────────────────────────────

/**
 * Contrat View composé — features + ui.
 * Un seul générique sur la classe : `View<TViewContract<F, U>>`.
 */
export type TViewContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract     = TUIContract
> = {
  readonly features: F;
  readonly ui:       U;
};

// ─── TViewCallbacks ──────────────────────────────────────────────────────────

/**
 * Clause `implements` unique pour une View (C3, C15).
 * Fusionne handlers channel (D48 channel) et handlers DOM (D48 UI).
 *
 * Symétrie Contract/Callbacks : pour tout `T{Component}Contract`, il existe
 * `T{Component}Callbacks` qui impose les handlers correspondants.
 */
export type TViewCallbacks<TVC extends TViewContract> =
  & TChannelCallbacks<TVC["features"]>
  & TUICallbacks<TVC["ui"]>;
```

### Symétrie pour les autres composants (réservation des noms)

Les composants futurs déclarent leur paire `Contract` / `Callbacks` selon le même pattern (C15) :

```ts
// ── Composer (strate 1+) ────────────────────────────────────────────────────
export type TComposerContract<F extends TFeatureContract = TFeatureContract> = {
  readonly features: F;
  // pas d'UI (I35)
};
export type TComposerCallbacks<TCC extends TComposerContract> =
  TChannelCallbacks<TCC["features"]>;

// ── Behavior (strate 2) ─────────────────────────────────────────────────────
export type TBehaviorContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract     = TUIContract
  // + extensions strate 2 (templating, lifecycle, ...)
> = {
  readonly features: F;
  readonly ui:       U;
};
export type TBehaviorCallbacks<TBC extends TBehaviorContract> =
  & TChannelCallbacks<TBC["features"]>
  & TUICallbacks<TBC["ui"]>;

// ── Foundation (strate 0 → strate 1+) ───────────────────────────────────────
export type TFoundationContract = {};
export type TFoundationCallbacks<TFC extends TFoundationContract> = {};
// Vides en strate 0 ; peuvent gagner des handlers d'orchestration en strate 1+.
```

Ces types (autres que View) ne sont **pas implémentés** par ADR-0042 — leur définition concrète vit dans l'ADR du composant correspondant. ADR-0042 réserve les noms et garantit que la symétrie sera respectée.

### Signature `View<TVC>` — un seul générique

```ts
export abstract class View<TVC extends TViewContract = TViewContract> {
  abstract get features():   TVC["features"];
  abstract get uiEvents():   TVC["ui"];
  abstract get uiElements(): TUIElements<TVC["ui"]>;

  protected trigger<K extends TFlatTriggers<TVC["features"]>>(
    key: K,
    payload: TCommandPayloadFor<TVC["features"], K>
  ): void { ... }

  protected request<K extends TFlatRequests<TVC["features"]>>(
    key: K,
    params: TRequestParamsFor<TVC["features"], K>
  ): TRequestResultFor<TVC["features"], K> | null { ... }

  getUI<K extends keyof TVC["ui"] & string>(
    key: K
  ): TProjectionNode<ExtractEl<TVC["ui"][K]>> { ... }
}

// TViewClass simplifié — un seul any
export type TViewClass = abstract new () => View<any>;
```

---

## Exemple applicatif complet

```ts
// ── CartView.view.ts ────────────────────────────────────────────────────────

// === IMPORTS ===
import { CartFeature } from "../Cart/cart.feature";
import { UserFeature } from "../User/user.feature";
import {
  View, ui,
  type TViewContract,
  type TViewCallbacks,
  type TFeatureContract,
  type TUIContract,
  type TUIElements,
} from "@bonsai/view";
import type { TEventMetas } from "@bonsai/event";

// === HEADER : 3 valeurs satisfying des modules contractuels, 1 type composé ===

const cartViewFeatures = {
  cart: {
    feature:  CartFeature,
    listens:  ["itemAdded", "itemRemoved"] as const,
    triggers: ["addItem"]                  as const,
    requests: []                           as const,
  },
  user: {
    feature:  UserFeature,
    listens:  ["profileUpdated"]           as const,
    triggers: []                           as const,
    requests: ["getProfile"]               as const,
  },
} satisfies TFeatureContract;

const cartViewUiEvents = {
  total:    ui<HTMLSpanElement>([]),
  addBtn:   ui<HTMLButtonElement>(["click"]),
  qtyInput: ui<HTMLInputElement>(["input", "change"]),
} satisfies TUIContract;

const cartViewUiElements = {
  total:    ".cart-total",
  addBtn:   "#add-btn",
  qtyInput: ".qty-input",
} satisfies TUIElements<typeof cartViewUiEvents>;

type TCartViewContract = TViewContract<
  typeof cartViewFeatures,
  typeof cartViewUiEvents
>;

// === CLASS ===

class CartView
  extends View<TCartViewContract>
  implements TViewCallbacks<TCartViewContract>
{
  get features()   { return cartViewFeatures; }
  get uiEvents()   { return cartViewUiEvents; }
  get uiElements() { return cartViewUiElements; }

  // ── Channel handlers (D48 channel : on{NS}{EventName}Event) ───────────────
  onCartItemAddedEvent(p: { id: string; qty: number }, m: TEventMetas): void {
    this.getUI("total").text(`${p.qty} items`);     // → TProjectionNode<HTMLSpanElement>
    this.getUI("addBtn").element();                  // → HTMLButtonElement ✅
  }
  onCartItemRemovedEvent(p: { id: string }, m: TEventMetas): void {
    this.getUI("total").text("...");
  }
  onUserProfileUpdatedEvent(p: { name: string }, m: TEventMetas): void {
    this.getUI("total").attr("data-user", p.name);
  }

  // ── DOM handlers (D48 UI : on{UIKey}{DomEvent}) ───────────────────────────
  onAddBtnClick(e: MouseEvent): void {
    this.trigger("cart:addItem", { id: "p1", qty: 1 });   // ✅ payload inféré
  }
  onQtyInputInput(e: Event): void {
    const input = this.getUI("qtyInput").element();        // → HTMLInputElement
    const qty = parseInt(input.value, 10);
  }
  onQtyInputChange(e: Event): void { ... }

  // Aucun handler requis pour `total` (events: [])
}
```

**Erreurs compile-time produites :**

```ts
cart: { feature: UserFeature, ... }          // ❌ namespace "cart" ≠ UserFeature.namespace "user"
cart: { listens: ["unknownEvent"], ... }      // ❌ "unknownEvent" pas dans CartFeature.channel.events
this.trigger("cart:itemAdded", ...)          // ❌ "itemAdded" est un listen, pas un trigger
this.trigger("cart:unknownCmd", ...)         // ❌ "unknownCmd" pas dans CartFeature.channel.commands
this.getUI("unknownKey")                     // ❌ "unknownKey" pas dans cartViewUiEvents
class CartView ... { /* sans onAddBtnClick */ }  // ❌ TViewCallbacks impose onAddBtnClick
```

---

## Conséquences

### Positives

- ✅ **Un seul générique** sur `View<>` : `View<TViewContract<F, U>>`. `TViewClass = new () => View<any>` au lieu de `<any, any>`.
- ✅ **Une seule clause `implements`** : `TViewCallbacks<TVC>` couvre channel + DOM.
- ✅ **Co-localisation Feature ↔ events** : tout ce qui concerne CartFeature dans un seul bloc.
- ✅ **Préfixe namespace éliminé** dans les déclarations (`"itemAdded"` au lieu de `"cart:itemAdded"`).
- ✅ **API runtime préservée** : `this.trigger("cart:addItem", ...)` reste flat-préfixée (C12).
- ✅ **Sélecteurs séparés** : `get uiElements()` overridable par Composer (D34, D35), respectant la séparation type-level / runtime.
- ✅ **Sous-type HTMLElement typé** : `getUI(k).element() → TEl` via phantom.
- ✅ **Handlers DOM enforcement** : `events: ["click"]` impose `onAddBtnClick` au compile-time.
- ✅ **Validation clé/namespace stricte** : incohérence Feature/clé → erreur compile.
- ✅ **Modules réutilisables** : `TFeatureContract` et `TUIContract` partagés entre View, Behavior, Composer.
- ✅ **Symétrie inter-composants** : `TViewContract<F, U>`, `TBehaviorContract<F, U, ...>`, `TComposerContract<F>` composent les mêmes briques.

### Négatives (acceptées)

- ⚠️ **Trois `satisfies` dans le header** au lieu d'un. Coût justifié par la séparation des préoccupations (channels / UI events / sélecteurs) et l'overridability des sélecteurs (D34).
- ⚠️ **Migration cassante de `@bonsai/feature`** : suppression nette de `TConsumerDeps`, `TConsumerContract`, `TListenCallbacks`, `TNSEventKeys`, `TNSCommandKeys`, `TNSRequestKeys` (C11). Tous les consommateurs migrent dans le PR ADR-0042.
- ⚠️ **Type utilitaires plus complexes** : `TFlatListens`, `TChannelCallbacks` requièrent `UnionToIntersection` et conditional types imbriqués. Coût isolé dans `@bonsai/feature` ; pas exposé au développeur applicatif.
- ⚠️ **Helper `ui()` obligatoire** pour le phantom `_el?`. Écriture directe `{ events: [] }` perd le typage `TEl` dans `getUI()`.

### Nouveaux invariants

| Réf  | Contenu |
| ---- | ------- |
| I84  | Tout élément UI déclaré dans `contract.ui` avec `events: [E, ...]` non-vide DOIT avoir ses handlers DOM implémentés via `implements TViewCallbacks<TVC>`. `events: []` déclare explicitement un élément non-interactif — aucun handler requis. |
| I85  | `ui<TEl>(events)` est l'unique helper pour déclarer une entrée UI. L'écriture directe `{ events: [...] }` est admise mais perd le phantom `TEl` — `getUI()` retourne `TProjectionNode<HTMLElement>` au lieu du sous-type. Préférer `ui<HTMLElement>(...)` pour l'exhaustivité. |
| I86  | `TUIEntry["events"]` est TOUJOURS présent et TOUJOURS un tableau (possiblement vide). L'absence du champ est une erreur compile (pas d'optionnel). |
| I87  | Dans `TFeatureContract`, la clé d'objet (`cart`, `user`) DOIT correspondre au `namespace` de la Feature référencée par `feature`. Incohérence (`cart: { feature: UserFeature, ... }`) → erreur compile via `TFeatureRefForNS<NS>`. |
| I88  | **Symétrie Contract/Callbacks** : pour tout type `T{Component}Contract` exposé par un package Bonsai, le même package DOIT exposer un type `T{Component}Callbacks<TC>` qui dérive les handlers `on*` requis. Un composant concret écrit toujours la paire `extends X<TXxxContract>` + `implements TXxxCallbacks<TXxxContract>`. Un contrat sans Callbacks (déclaration sans engagement) est interdit. |

### Invariants reformulés

| Réf  | Formulation précédente (ADR-0041) | Formulation renforcée (ADR-0042) |
| ---- | --------------------------------- | -------------------------------- |
| I81  | `get contract()` source de vérité runtime — `listens`, `triggers`, `requests`, `uiElements` | `get features() / get uiEvents() / get uiElements()` sont les sources de vérité runtime. `features` (channel) et `uiEvents` (UI structurel) sont structurels et non-overridables ; `uiElements` (sélecteurs) est overridable par Composer (D34). |
| I82  | `implements TListenCallbacks<TDeps, TContract>` impose les handlers channel | `implements TViewCallbacks<TVC>` impose les handlers channel **et** les handlers DOM déclarés dans `contract.ui`. Symétrie totale : la déclaration EST l'engagement. |
| I83  | Pattern 4 étapes : `type TMyDeps` → `const myContract` → `type TMyContract` → `class extends View<TDeps, TContract> implements TListenCallbacks` | Pattern modulaire : (1) `const features satisfies TFeatureContract` (2) `const uiEvents satisfies TUIContract` (3) `const uiElements satisfies TUIElements<typeof uiEvents>` (4) `type TVC = TViewContract<typeof features, typeof uiEvents>` (5) `class extends View<TVC> implements TViewCallbacks<TVC>`. Chaque composant compose son propre `TXxxContract` à partir des modules. |

### Amendement ADR-0029 — Strate 1

L'entrée « View basic » de la strate 1 devient :

| Composant | ADR source | Description |
|-----------|-----------|-------------|
| View modulaire | **ADR-0042** | `TViewContract<F, U>` composé de `TFeatureContract` (Feature-groupé) + `TUIContract` (UI events typés) + `TUIElements` (sélecteurs overridables). `getUI(k).element() → TEl` typé. Handlers channel + DOM enforcement compile-time via `TViewCallbacks<TVC>`. Un générique, un implements. |

Note : Behavior (strate 2) et Composer (strate 1+) réutiliseront `TFeatureContract` (et `TUIContract` pour Behavior) — pas de réécriture nécessaire au moment de leur implémentation, seulement composition.

### Impact sur le code existant

| Fichier | Changement requis |
|---------|------------------|
| `packages/feature/src/types.ts` | **Suppression nette** : `TConsumerDeps`, `TConsumerContract`, `TNSEventKeys`, `TNSCommandKeys`, `TNSRequestKeys`, `TEventPayload`, `TCommandPayload`, `TRequestParams`, `TRequestResult`, `THandlerName`, `TListenCallbacks`. **Ajout** : `TFeatureContract`, `TFeatureRefForNS`, `TFlatListens`, `TFlatTriggers`, `TFlatRequests`, `TEventPayloadFor`, `TCommandPayloadFor`, `TRequestParamsFor`, `TRequestResultFor`, `TChannelHandlerName`, `TChannelCallbacks`. |
| `packages/view/src/bonsai-view.ts` | Réécrire `View<TVC>` (un seul générique) ; `TViewContract<F, U>` composé ; `TViewCallbacks<TVC>` ; `TUIEntry`, `ui()`, `TUIContract`, `TUIElements`, `TProjectionNode<TEl>`, `TUICallbacks`, `ExtractEl`. Trois getters abstraits : `features`, `uiEvents`, `uiElements`. D48 lit `uiEvents[k].events` pour `addEventListener`. Subscriptions channel construites depuis `features[NS].listens` × `features[NS].feature.channel`. |
| `packages/view/src/bonsai-view.ts` | `TViewClass = abstract new () => View<any>` (un seul `any`). |
| `tests/fixtures/cart-feature.fixture.ts` | Migrer vers `const cartViewFeatures satisfies TFeatureContract` + `cartViewUiEvents` + `cartViewUiElements` ; classe `extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract>`. |
| `tests/unit/strate-0/view.basic.test.ts` | Idem — `TestView` et vues locales. |
| `tests/unit/strate-0/foundation.basic.test.ts` | Idem. |
| `tests/unit/strate-0/composer.basic.test.ts` | Idem. |
| `tests/types/strate-0/view-contract.types.test.ts` | Adapter aux nouveaux types ; ajouter `@ts-expect-error` sur (a) handler manquant avec `events` non-vide, (b) clé Feature ≠ namespace, (c) trigger d'un nom déclaré uniquement en listens. |
| `docs/rfc/4-couche-concrete/view.md` | Réécrire §4.2 (UIElements et UIEvents) — pattern modulaire ; nouveaux types ; `get uiEvents()` séparé de `get uiElements()`. |
| `docs/rfc/3-couche-abstraite/feature.md` | Mise à jour des exemples consommateur — `TFeatureContract` au lieu de `TConsumerDeps`/`TConsumerContract`. |
| `docs/rfc/reference/invariants.md` | I81–I83 reformulés ; I84–I87 ajoutés. |
| `docs/rfc/reference/glossaire.md` | Ajouter : « Module contractuel », « Feature-groupé », « `TFeatureContract` », « `TUIContract` », « `TUIElements` », « `TViewCallbacks` ». Retirer : « `TConsumerDeps` », « `TConsumerContract` », « `TListenCallbacks` ». |
| `docs/guides/FRAMEWORK-STYLE-GUIDE.md` | §1 « Types d'abord » illustré avec le pattern header/getters/classe. Pattern modulaire `TXxxContract` documenté comme convention transversale. |

---

## Hors-scope explicite

- **Implémentation `Behavior<TBehaviorContract<F, U, ...>>`** — strate 2. ADR-0042 définit le pattern modulaire que Behavior utilisera ; l'ADR Behavior dédié spécifie ses extensions (templating N2/N3, etc.).
- **Implémentation `Composer<TComposerContract<F>>`** — adaptation strate 1+ ; ADR-0042 ne livre que View. Le module `TFeatureContract` est déjà réutilisable.
- **Validation runtime des `events` au mount** — vérifier que `uiEvents[k].events[i]` correspond à un vrai event DOM activable est un garde-fou strate 2 (DevTools / strict mode).
- **Override de `uiElements` par Composer** — le mécanisme D34 (resolve → options.uiElements) reste applicable. Son enrichissement (override partiel par clé, validation au mount) est traité avec l'ADR Composer dédié.
- **Migration auto-gen** — pas d'outil de codemod livré ; la migration des fixtures et tests strate 0 se fait manuellement dans le PR ADR-0042 (5 fichiers concernés).

---

## Actions de suivi

- [ ] **`@bonsai/feature`** — supprimer `TConsumerDeps` / `TConsumerContract` / `TListenCallbacks` & co ; ajouter `TFeatureContract` + helpers + `TChannelCallbacks`.
- [ ] **`@bonsai/view`** — réécrire `View<TVC>` (un générique) ; ajouter `TUIEntry`, `ui()`, `TUIContract`, `TUIElements`, `TProjectionNode<TEl>`, `TUICallbacks`, `TViewContract<F, U>`, `TViewCallbacks<TVC>` ; mettre à jour D48 pour lire `uiEvents`.
- [ ] **Migration fixtures** — `tests/fixtures/cart-feature.fixture.ts`.
- [ ] **Migration tests strate 0** — `view.basic.test.ts`, `foundation.basic.test.ts`, `composer.basic.test.ts`.
- [ ] **Tests types** — `tests/types/strate-0/view-contract.types.test.ts` : compile-time errors (handler manquant, clé/namespace, trigger d'un listen).
- [ ] **RFC** — `view.md` §4.2, `feature.md` (exemples), `invariants.md` (I81–I83 reformulés, I84–I87 nouveaux), `glossaire.md`.
- [ ] **Guide** — `FRAMEWORK-STYLE-GUIDE.md` §1 illustré.
- [ ] **ADR-0029** — entrée strate 1 « View modulaire » mise à jour.
- [ ] **Validation** — `pnpm tsc:check` + `pnpm test:unit` + gate E2E `strate-0.cart-round-trip.test.ts` vert après migration.

---

## Historique

| Date       | Changement |
|------------|-----------|
| 2026-05-04 | v1 — `TViewContract` unifié (deps + listens + triggers + requests + ui), `ui<TEl>(selector, events)` avec sélecteur dans le contrat (Proposed) |
| 2026-05-06 | v2 — Réécriture complète. Pattern modulaire (`TFeatureContract` Feature-groupé + `TUIContract` + `TUIElements`). Sélecteurs sortis du contrat (D34). `ui<TEl>(events)` sans sélecteur. Trois getters séparés (`features`, `uiEvents`, `uiElements`). Suffixe `Event` conservé sur D48 channel. Validation stricte clé/namespace. Suppression nette des types ADR-0041 (`TConsumerDeps`, `TConsumerContract`, `TListenCallbacks`). |
| 2026-05-07 | 🟢 **Accepted** — code mergé sur `develop` (PR #15 et #16) |
