# Rendu — PDR, compilateur Pug, ProjectionList

> 🟠 **Conception cible (strate 1c), relue contre la théorie V0.9.5 et l'API livrée (4 novembre 2026).** Seules les primitives N1 de `getUI()` sont livrées ([view.md](4-couche-concrete/view.md)). Les exemples utilisent les contextes de handler livrés (`ctx.trigger`, `ctx.mutate`, `TFact`) ; tout le reste (templates, `ProjectionList`, selectors, hydratation) est cible. Toute réalisation devra respecter trois contraintes de la théorie : une projection, y compris `template.project()`, est un **effet** engagé après la validation de l'unité (C.3) ; la View n'observe le domaine que par les Events qu'elle reçoit et par Query, dans une unité (G5, A5.a) ; elle ne lit jamais le DOM (I39), les données d'un fait étant capturées avec lui (C.5). En cas d'écart, la [théorie](../theorie.md) prévaut ([règle de confiance](../README.md#règle-de-confiance-et-dalignement)).

> ## TL;DR
>
> Bonsai utilise la **Projection DOM Réactive (PDR)** : pas de VDOM, pas de diff d'arbre.
> Les templates Pug sont compilés en fonctions TypeScript qui projettent les données sur
> un DOM existant via des mutations chirurgicales O(Δ). Trois niveaux d'alteration :
> **N1** (primitives `text()`, `attr()`, `visible()`), **N2** (templates partiels),
> **N3** (templates complets). `ProjectionList` gère les listes par réconciliation keyée.

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Stable |
| **Prérequis** | [1-philosophie.md](1-philosophie.md), [view.md §4](4-couche-concrete/view.md#4-projection--getui) |
| **ADR** | [ADR-22](../adr/ADR-22-pdr.md) PDR · [ADR-23](../adr/ADR-23-listes.md) listes · [ADR-24](../adr/ADR-24-hydratation-ssr.md) hydratation · [ADR-26](../adr/ADR-26-souscription-view.md) souscription (🟡) |
| **Prototype** | `tools/pug-to-ts-template` génère du VDOM, l'option rejetée par ADR-22 : à réécrire |

> ### Statut normatif
>
> Ce document est **stable et normatif** pour les mécanismes de rendu PDR,
> les templates Pug, l'API `ProjectionList`, le Render Contract (§7bis), et les
> collection patterns (§6.4–6.8). Les ADR-22 à ADR-26 y font foi.
> Ce document dépend de [view.md](4-couche-concrete/view.md), [communication.md](2-architecture/communication.md) et [entity.md](3-couche-abstraite/entity.md) pour les contrats View, Channel et Entity.

---

> ### ⏳ Périmètre d'implémentation
>
> Ce document décrit le **contrat cible** du rendu. **Aucun mécanisme de ce document n'est encore implémenté**, hormis les primitives N1 de `getUI()` décrites dans [view.md](4-couche-concrete/view.md) :
>
> | Élément | Strate cible | Sections concernées |
> | --- | --- | --- |
> | Compilateur Pug → PDR (`setup`/`project`/`create`), `ProjectionList`, réconciliation keyed | Strate 1c | §4, §5, §6, §8 |
> | Templates réactifs (Query déclarée, `on`, `select`), Render Contract | Strate 1c | §2, §7, §7bis |
> | Hydratation SSR (H1–H5) | Strate 2c | §7bis.3 |
> | Callbacks d'animation de liste (ADR-22) | Strate 1c | §11 |
> | `VirtualizedList` (ADR-23) | Hors v1 ([roadmap](../ROADMAP.md)) | §11 |
>
> Seul un prototype de compilation existe (`tools/pug-to-ts-template`). Le modèle de données des templates est tranché par l'[ADR-26](../adr/ADR-26-souscription-view.md) : chaque binding déclare la Query qui l'alimente et les Events qui la relancent (§7) ; les handlers granulaires `on{NS}{Event}Event` d'ADR-14 restent.

## 1. Résumé exécutif

Ce document définit le **compilateur Pug → PDR** et les mécanismes de rendu avancés :

- Comment un template Pug est transformé en fonctions `setup()`, `project()`, `create()`
- Comment `each item in items` génère automatiquement du code de réconciliation keyed
- L'API `ProjectionList` pour les listes dynamiques
- Les stratégies de cache et d'optimisation

---

## 2. Principes fondamentaux

> ⚠️ **Ces principes sont structurants pour toute l'architecture de rendu.**

### 2.1 Trois niveaux d'altération DOM — Choix du développeur

Le développeur choisit le niveau d'abstraction approprié à son cas d'usage :

| Niveau | Cas d'usage | Mécanisme | Template ? |
| --- | --- | --- | --- |
| **N1 — Mutation d'attributs** | Carrousel, modale `hidden`, badge count, toggle class | `getUI().text()`, `.toggleClass()`, `.attr()` | ❌ Non — overhead inutile |
| **N2 — Mutation par zones** | Liste de produits, formulaire dynamique, onglets | Template sur clés `@ui` spécifiques | ✅ Oui — sur zones ciblées |
| **N3 — Mutation complète** | Page entière change, dashboard reconfigurable | Template sur `root` | ✅ Oui — toute la View |

**Principe** : on ne sur-ingénierie pas. Un carrousel n'a pas besoin d'un template, un `getUI("slide").attr("data-active", "false")` suffit (I39 — jamais de `setAttribute` brut, toujours via `getUI()`).

### 2.2 Template = Délégation totale du rendu

> **Règle fondamentale** : Si une View délègue le rendu à un template, alors elle
> délègue **100%** du rendu de cette zone au template. Pas de `this.project()` manuel.

**Conséquence architecturale** :

```typescript
// ❌ INTERDIT — mélange template + manipulation manuelle
class CartView extends View {
  get templates() {
    return {
      items: {
        template: CartItemsTemplate,
      },
    };
  }
  
  onCartUpdated(cart: Cart) {
    this.project('items', cart);        // ❌ Appel manuel
    this.getUI('total').text(cart.total); // OK — 'total' n'a pas de template
  }
}

// ✅ CORRECT — le template est auto-réactif
class CartView extends View {
  get templates() {
    return { 
      items: {
        template: CartItemsTemplate,
        select: (data) => data.cart?.items,
      },
    };
  }
  
  // Pas de onCartUpdated() pour 'items' — le template s'en charge
  // Seuls les @ui SANS template ont des handlers manuels
}
```

### 2.3 Le template est réactif par déclaration — dans la View

Le template est **pur** (pas de métadonnées de réactivité).
La **View** déclare la réactivité dans `get templates()` : chaque binding nomme
la **Query** qui l'alimente, les **Events** qui la relancent et un `select`
facultatif ([ADR-26](../adr/ADR-26-souscription-view.md)).

```pug
//- cart-items.template.pug
//- Template pur — reçoit items[] depuis le selector

ul.Cart-items
  each item in items
    li.Cart-item(data-item-id=item.id)
      span.name #{item.name}
```

```typescript
class CartView extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract> {
  get features()   { return cartViewFeatures; }   // cart : listens itemAdded/itemRemoved, queries items
  get uiEvents()   { return cartViewUiEvents; }
  get uiElements() { return cartViewUiElements; }

  get templates() {
    return {
      items: {
        template: CartItemsTemplate,
        query: "cart:items",
        on: ["cart:itemAdded", "cart:itemRemoved"]
      }
    };
  }
}
```

**Fonctionnement** (✅ strate 1c, lot 2) :

1. À la création de la View, le framework exécute `cart:items`, applique `select` et prépare la projection initiale.
2. Quand `cart:itemAdded` est délivré à la View, après son handler s'il existe, le framework relance `cart:items` dans l'unité de l'Event.
3. Si la sortie de `select` est `shallowEqual` à la dernière projetée, rien n'est préparé ; sinon le template est re-projeté, en effet engagé après validation (C.3).

**Avantages** :

- ✅ L'état se lit par Query, comme partout ailleurs (G5) : la View n'a aucun accès à l'Entity (I6)
- ✅ Le template reste du Pug pur, portable
- ✅ Les dépendances d'un binding sont explicites et vérifiées à la description de la View (O2)
- ✅ Pas de handler vide : un Event référencé par un `on` n'exige plus de handler (I82 amendé)

> **Note** : Le projet [pugx](../pugx/) explore une extension de Pug avec typage natif,
> mais c'est **hors scope** de Bonsai. Cette spec suppose des templates Pug standard.

---

## 3. Contexte et motivation

### 3.1 Ce qui est défini ([view.md §4](4-couche-concrete/view.md#4-projection--getui))

[view.md §4](4-couche-concrete/view.md#4-projection--getui) a établi les fondations de la **Projection DOM Réactive (PDR)** :

| Concept | Statut | Source |
| --- | --- | --- |
| Stratégie PDR (ADR-22) | ✅ Défini | view.md §4 |
| `getUI()` → `TProjectionNode` | ✅ Défini | view.md §4 |
| `TProjectionTemplate` type | ✅ Défini | view.md §4 |
| 3 modes de rendu (A, B, C) | ✅ Défini | view.md §4 |

### 3.2 Ce qui manque

| Concept | Statut | Besoin |
| --- | --- | --- |
| Compilateur Pug → PDR | ❌ | Comment génère-t-on `setup/project/create` ? |
| `each` → reconcile | ❌ | Comment `each item in items` devient du keyed reconcile ? |
| `ProjectionList` API | ❌ | Interface complète et algorithme |
| Auto-réactivité template | ❌ | Comment le template se branche aux Events ? |

### 3.3 Héritage du prototype Pug → VDOM

Un compilateur Pug → VDOM (Snabbdom) avait été protétypé en amont. L'architecture de pipeline reste pertinente :

```text
.pug → Lexer → Parser → AST → Compiler → .ts (VDOM functions)
```

**Ce qui change pour Bonsai** :

- VDOM → PDR (mutations directes, pas de diff d'arbre)
- `VNode` → `TProjectionNode` / `ProjectionList`
- Réactivité implicite (pas d'appel manuel à `render()`)

### 3.4 Le edge case des listes longues

Le cas le plus complexe : une liste de 500+ items sur laquelle l'utilisateur :

- Applique des filtres (affiche 50 items sur 500)
- Change le tri (réordonne les 50 items)
- Modifie un item (met à jour 1 item)

**Exigences** :

- Le filtrage/tri ne doit PAS muter les données (ADR-23 anti-pattern)
- La réconciliation doit être O(n) avec keyed diffing
- Les mutations individuelles doivent être O(1)

---

## 4. Principes de conception du compilateur

### 4.1 Le template Pug est la source de vérité — pour la structure

Le développeur écrit du Pug **idiomatique** pour la **structure DOM**.
La **réactivité** est déclarée dans la View via des selectors namespacés.

```pug
//- Le développeur écrit ceci (naturel, Pug pur)
ul.Cart-items
  each item in items
    li.Cart-item(data-item-id=item.id)
      span.name #{item.name}
```

```typescript
// Le compilateur génère la mécanique de projection
const CartItemsTemplate: TProjectionTemplate = {
  setup(container) { /* ... */ },
  project(nodes, data) { /* keyed reconcile */ },
  create(data) { /* factory */ }
};

// La View déclare la réactivité via selector namespacé
class CartView extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract> {
  get features()   { return cartViewFeatures; }
  get uiEvents()   { return cartViewUiEvents; }
  get uiElements() { return cartViewUiElements; }
  
  get templates() {
    return {
      items: {
        template: CartItemsTemplate,
        select: (data) => data.cart?.items,  // Namespace 'cart'
      }
    };
  }
}
```

### 4.2 Compilation statique, pas runtime

Le compilateur tourne au **build time** (via Rollup/Vite plugin), pas au runtime.
Cela garantit :

- Zéro parsing Pug au runtime
- Bundle optimisé (tree-shaking des parties non utilisées)
- Erreurs de template détectées au build

### 4.3 Keyed reconcile par défaut pour `each`

Toute boucle `each` **DOIT** avoir une clé explicite ou inférée :

```pug
//- Clé explicite via data-key
each product in items
  li(data-key=product.id) #{product.name}

//- Clé inférée via data-item-id (convention)
each product in items
  li(data-item-id=product.id) #{product.name}

//- ❌ Erreur de compilation si pas de clé
each product in items
  li #{product.name}  //- Error: List requires a key for reconciliation
```

### 4.4 Pas d'appel manuel à `project()` — Auto-réactivité

La View déclare `query`, `on` et `select` dans `get templates()` ; le framework
relance la Query après les Events listés et projette (§7). Le code applicatif
n'appelle jamais `project()`.

**Conséquence** : la View n'a **jamais** de handler manuel pour une clé dont un template s'occupe (I41).

---

## 5. Architecture du compilateur

> Inspiré du prototype Pug → VDOM interne, adapté à PDR (pas VDOM).

### 5.1 Pipeline de compilation

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  .pug file  │────▶│  Pug AST    │────▶│  IR Bonsai  │────▶│  .ts file   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                  │                   │                    │
   Source Pug        pug-lexer           Analyse des          Génération
   idiomatique       pug-parser          directives           TypeScript
                                         @listen, @data       setup/project/create
                                         each, @ui
```

**Composants du prototype Pug → VDOM** (à adapter) :

- `lexer.ts` / `lexer.types.ts` — Tokenization
- `parser.ts` / `token-stream.ts` — AST construction
- `base-compiler.class.ts` — Visiteur d'AST
- `template-compiler.class.ts` — Génération de code
- `writer.class.ts` — Buffer d'écriture de code

**Différences clés avec le prototype VDOM** :

| Aspect | Prototype VDOM | Bonsai |
| --- | --- | --- |
| Output | VDOM (Snabbdom `VNode`) | PDR (`TProjectionNode`, `ProjectionList`) |
| Réactivité | Manuelle (`render()`) | Déclarée dans View (`listen`, `dataPath`) |
| Diff | Runtime (VDOM diff) | Build-time (keyed reconcile généré) |
| Events | Dans le template (`VNodeOn`) | Délégation (séparé du template) |
| Métadonnées | Dans le template | Dans la View (TypeScript typé) |

### 5.2 Représentation intermédiaire (IR)

L'IR Bonsai capture les informations nécessaires à la génération.
**Note** : l'IR ne contient **pas** de métadonnées de réactivité (elles sont dans la View).

```typescript
type TBonsaiIR = {
  // Éléments statiques (HTML pur)
  staticNodes: StaticNode[];
  
  // Zones dynamiques (interpolations, bindings)
  dynamicBindings: DynamicBinding[];
  
  // Listes (each)
  lists: TListDirective[];
  
  // Références @ui (optionnel, pour validation)
  uiRefs: UIRef[];
}

type TListDirective = {
  // Variable d'itération
  itemVar: string;        // 'product'
  
  // Expression source
  sourceExpr: string;     // 'items'
  
  // Clé pour reconcile
  keyExpr: string;        // 'product.id'
  
  // Template de l'item
  itemTemplate: TBonsaiIR;
}
```

### 5.3 Génération de code

Pour chaque template, le compilateur génère **uniquement** la mécanique de projection
(pas de métadonnées de réactivité — elles sont dans la View) :

```typescript
// Généré automatiquement depuis cart-items.template.pug
export const CartItemsTemplate: TProjectionTemplate<CartItemsNodes, CartItem[]> = {
  /**
   * Localise les nœuds dynamiques dans le conteneur existant (SSR/hydratation)
   */
  setup(container: HTMLElement): CartItemsNodes {
    return {
      list: new ProjectionList(container, {
        keyAttr: 'data-item-id',
        itemSetup: (el) => ({
          name: el.querySelector('.name')!,
          qty: el.querySelector('.qty')!,
        })
      })
    };
  },
  
  /**
   * Projette les données sur les nœuds (mise à jour)
   */
  project(nodes: CartItemsNodes, items: CartItem[]): void {
    nodes.list.reconcile(items, {
      key: item => item.id,
      update: (itemNodes, item) => {
        if (itemNodes.name.textContent !== item.name) {
          itemNodes.name.textContent = item.name;
        }
        if (itemNodes.qty.textContent !== String(item.quantity)) {
          itemNodes.qty.textContent = String(item.quantity);
        }
      }
    });
  },
  
  /**
   * Crée le DOM complet (mode SPA, pas de SSR)
   */
  create(items: CartItem[]): HTMLElement {
    const ul = document.createElement('ul');
    ul.className = 'Cart-items';
    
    for (const item of items) {
      ul.appendChild(this.createItem(item));
    }
    
    return ul;
  },
  
  // Helper interne pour créer un item
  createItem(item: CartItem): HTMLElement {
    const li = document.createElement('li');
    li.className = 'Cart-item';
    li.dataset.itemId = item.id;
    li.innerHTML = `
      <span class="name">${escapeHtml(item.name)}</span>
      <span class="qty">${item.quantity}</span>
    `;
    return li;
  }
};
```

---

## 6. API ProjectionList

> Décision : [ADR-23](../adr/ADR-23-listes.md). ✅ strate 1c, lot 3.

### 6.1 Interface (`@bonsai/view`)

```typescript
type TProjectionListOptions<TItem, TItemNodes> = {
  /** Attribut qui porte la clé de chaque élément d'item, ex. "data-item-id". */
  readonly keyAttr: string;
  /** Clé unique d'un item. */
  readonly key: (item: TItem) => string;
  /** Crée l'élément d'un nouvel item ; la liste y pose `keyAttr`. */
  readonly create: (item: TItem) => HTMLElement;
  /** Localise les nœuds dynamiques d'un élément d'item. */
  readonly setup: (el: HTMLElement) => TItemNodes;
  /**
   * Met à jour les nœuds d'un item, appelé pour chaque item à chaque
   * réconciliation, qu'il ait changé ou non : gardé par nœud
   * (`if (node.textContent !== value)`), ne crée ni ne supprime de nœud (R5).
   */
  readonly update: (nodes: TItemNodes, item: TItem, index: number) => void;
};

class ProjectionList<TItem, TItemNodes> {
  /** Adopte les enfants du conteneur qui portent `keyAttr` (rendu de `create()` ou serveur). */
  constructor(container: HTMLElement, options: TProjectionListOptions<TItem, TItemNodes>);
  /** Réconcilie le conteneur avec `items`, dans cet ordre. */
  reconcile(items: readonly TItem[]): void;
  /** Nœuds d'un item par sa clé. */
  nodes(key: string): TItemNodes | undefined;
}
```

La liste s'emploie dans un `TProjectionTemplate` (§7) : construite dans
`setup()`, réconciliée dans `project()`. Elle ne s'exécute donc qu'à
l'engagement, après validation (C.3), et ne pose aucun écouteur : la part de la
View délègue déjà un écouteur par type d'événement déclaré (§6.4).

```typescript
const CartItemsTemplate: TProjectionTemplate<readonly TCartItem[], ProjectionList<TCartItem, TRowNodes>> = {
  create: (items) => { const ul = document.createElement("ul"); for (const i of items) ul.append(row(i)); return ul; },
  setup: (container) => new ProjectionList(container.querySelector("ul")!, rowOptions),
  project: (list, items) => list.reconcile(items)
};
```

### 6.2 Algorithme de réconciliation

1. Pour chaque item, dans l'ordre : clé dupliquée → erreur (`DUPLICATE_KEY`) ; item connu → `update`, puis déplacement par `insertBefore` s'il n'est pas à sa place ; item nouveau → `create`, `keyAttr` posé, `setup`, insertion à sa place, `update`.
2. Les éléments dont la clé a disparu sont retirés, avec leurs nœuds.

Seuls les items mal placés reçoivent un `insertBefore` ; les nœuds texte entre
éléments sont ignorés. Une erreur pendant la réconciliation est une erreur
d'engagement : elle ferme la ressource de la View pour la suite de la liste
d'effets (C.3), sans revenir sur la validation.

### 6.3 Complexité

| Opération | Complexité |
| --- | --- |
| Réconciliation complète | O(n) |
| Insertion, suppression, mise à jour, déplacement d'un item | O(1) |

### 6.4 Collection patterns — ProjectionList + Event Delegation

> **Contrat normatif** — [ADR-23](../adr/ADR-23-listes.md).
> Ce document fait désormais foi pour les patterns de listes.

**Décision (ADR-23)** : Le pattern canonique pour les listes dans Bonsai
est **ProjectionList + Event Delegation**.

Justification :

1. **Simple** — un seul pattern à apprendre (pas de `ViewFragment`, pas de `CollectionComposer`)
2. **Performant** — keyed reconcile O(n) + un seul listener par type d'événement
3. **Scalable** — 1000+ items sans dégradation (un listener ≠ mille listeners)
4. **Standard** — event delegation = pattern DOM natif, pas d'abstraction Bonsai spécifique

#### Pattern : Event delegation sur le conteneur

La View gère les interactions utilisateur sur les items **via delegation sur le conteneur**,
jamais via des listeners individuels sur chaque élément.

> L'exemple ci-dessous se concentre sur l'auto-discovery DOM (ADR-15) — le pattern
> modulaire complet (avec `TFeatureContract` et `implements TViewCallbacks`) est
> documenté dans [view.md §2](4-couche-concrete/view.md#2-déclarations).

```typescript
import { View, ui, type TUIContract, type TUIElements } from "@bonsai/view";

// ── Module 2 — TUIContract : contrat structurel de la CartView (ADR-14) ──
// Chaque clé = un nœud d'interaction ; `ui<TEl>()(events)` déclare le
// sous-type HTML ET les events DOM (I85). Le framework auto-dérive les
// handlers depuis cette déclaration (ADR-15).
const cartViewUiEvents = {
  items:              ui<HTMLUListElement>()([]),           // Conteneur liste — non-interactif (I86)
  removeButton:       ui<HTMLButtonElement>()(["click"], { data: ["itemId"] }), // → onRemoveButtonClick
  increaseQtyButton:  ui<HTMLButtonElement>()(["click"], { data: ["itemId"] }), // → onIncreaseQtyButtonClick
  decreaseQtyButton:  ui<HTMLButtonElement>()(["click"], { data: ["itemId"] }), // → onDecreaseQtyButtonClick
} satisfies TUIContract;

// ── Module 3 — TUIElements : sélecteurs CSS, 1:1 avec uiEvents ──
const cartViewUiElements = {
  items:              "[data-ui='items']",
  removeButton:       "[data-ui='removeButton']",
  increaseQtyButton:  "[data-ui='increaseQtyButton']",
  decreaseQtyButton:  "[data-ui='decreaseQtyButton']",
} satisfies TUIElements<typeof cartViewUiEvents>;

class CartView extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract> {
  get features()   { return cartViewFeatures;   }
  get uiEvents()   { return cartViewUiEvents;   }
  get uiElements() { return cartViewUiElements; }

  // ══════════════════════════════════════════════════════════════════
  // `get uiEvents()` expose le contrat (value-first, ADR-14) — ce
  // N'EST PAS la map manuelle nom→handler que ADR-15 supprimait à l'origine.
  // Le framework introspecte `TUIContract` et découvre les handlers par
  // convention :
  //   clé 'increaseQtyButton' + event 'click'
  //   → cherche méthode on${Capitalize<key>}${Capitalize<event>}
  //   → onIncreaseQtyButtonClick
  //
  // La délégation est automatique : le framework attache UN listener 'click'
  // sur this.el et dispatche via closest() vers le bon @ui.
  // ══════════════════════════════════════════════════════════════════

  get templates() {
    return {
      items: bind<TCartViewContract>()({
        template: CartItemsTemplate,
        query: "cart:items",
        params: null,
        on: ["cart:itemAdded", "cart:itemRemoved", "cart:qtyChanged"]
      })
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Handlers auto-dérivés depuis `uiEvents` (ADR-15)
  // Noms conventionnels : on${Capitalize<key>}${Capitalize<event>}
  // Le framework vérifie leur existence quand la View est décrite au noyau (I84)
  // ────────────────────────────────────────────────────────────────────

  // removeButton + click → onRemoveButtonClick
  onRemoveButtonClick(fact: TFact<"itemId">, ctx: TFactContext<TCartViewContract>): void {
    const { itemId } = fact.data; // capturé à l'admission sur l'ancêtre data-item-id (C.5)
    if (itemId !== null) ctx.trigger('cart:removeItem', { itemId });
  }

  // decreaseQtyButton + click → onDecreaseQtyButtonClick
  onDecreaseQtyButtonClick(fact: TFact<"itemId">, ctx: TFactContext<TCartViewContract>): void {
    const { itemId } = fact.data; // capturé à l'admission sur l'ancêtre data-item-id (C.5)
    if (itemId !== null) ctx.trigger('cart:decreaseQty', { itemId });
  }

  // increaseQtyButton + click → onIncreaseQtyButtonClick
  onIncreaseQtyButtonClick(fact: TFact<"itemId">, ctx: TFactContext<TCartViewContract>): void {
    const { itemId } = fact.data; // capturé à l'admission sur l'ancêtre data-item-id (C.5)
    if (itemId !== null) ctx.trigger('cart:increaseQty', { itemId });
  }
}
```

```pug
//- cart-items.template.pug
ul.Cart-items(@ui="items")
  each item in items
    li.Cart-item(data-item-id=item.id)
      img(src=item.imageUrl alt=item.name)
      .info
        h3 #{item.name}
        p.price #{item.price} €
      .actions
        button.CartItem-decreaseQty -
        button.CartItem-increaseQty +
        button.CartItem-remove ×
```

#### ✅ / ❌ — Auto-discovery ADR-15 vs listeners individuels

```typescript
// ❌ INTERDIT — un listener par item (n'existe pas dans Bonsai)
items.forEach(item => {
  item.el.addEventListener('click', () => this.onRemove(item.id));
});

// ❌ OBSOLÈTE — mapping manuel nom→handler (abandonné, ADR-15)
class LegacyView {
  getUIEvents() {
    return {
      'click @ui.removeButton': 'onRemoveButtonClick',
    } as const;
  }
}
// Problème : mapping manuel redondant avec la déclaration UI, source de
// désynchronisation. C'est CE pattern que ADR-15 a supprimé — pas `get uiEvents()`
// en tant que tel, réintroduit par ADR-14 avec un sens différent
// (voir encadré « Terminologie » en tête de §6.4).

// ✅ CORRECT — ADR-15 : `get uiEvents()` expose le TUIContract,
// le framework câble automatiquement les handlers depuis cette déclaration
const cartViewUiEvents = {
  removeButton: ui<HTMLButtonElement>()(["click"]),
  //                                      ^^^^^^^
  // Le framework dérive : onRemoveButtonClick(event: MouseEvent)
  // et attache via délégation sur this.el + closest(@ui.removeButton)
} satisfies TUIContract;
```

### 6.5 Anti-pattern : muter les données pour filtrer/trier

> **Décision ADR-10 (NO-DERIVED-STATE)** — [ADR-22](../adr/ADR-22-pdr.md)
>
> **Les données dérivées (filtrées, triées, paginées) ne sont JAMAIS stockées dans
> l'Entity.** L'Entity stocke les données brutes et les critères de vue. Les dérivées
> sont calculées dans le selector de la View — c'est une projection, pas un état.
>
> **Règle** : On ne mute **jamais** les données brutes dans l'Entity pour satisfaire
> un changement de présentation. On mute les **critères** et on calcule les dérivées
> dans le selector.

**Contexte** : Une View affiche 300 produits, l'utilisateur change le tri par popularité.

```typescript
// ❌ MAUVAIS — Muter les items dans l'Entity
onFilterByPopularityCommand(payload: null, ctx: TFeatureContext<TProductsDef, ProductsEntity>) {
  ctx.mutate('products:filterByPopularity', (draft) => {
    draft.items.sort((a, b) => b.popularity - a.popularity);
  });
}
// Problème : génère ~300 patches de réordonnancement !
// [
//   { op: "replace", path: ["items", 0], value: {...} },
//   { op: "replace", path: ["items", 1], value: {...} },
//   ... × 300
// ]
```

**Pourquoi c'est un anti-pattern :**

| # | Raison |
| --- | --- |
| 1 | **Explosion des patches** — 300 patches pour une opération logique |
| 2 | **Sémantique incorrecte** — les données n'ont pas changé, seule la _présentation_ change |
| 3 | **Performance** — re-render complet de la liste |
| 4 | **Event Sourcing** — stocker « tri changé » ≠ stocker 300 déplacements |

```typescript
// ✅ BON — Muter les CRITÈRES, pas les données
type TProductsState = {
  items: Product[];              // Données brutes (rarement mutées)
  sortCriteria: TSortCriteria;   // Critère actif (muté fréquemment)
  filters: TFilterCriteria;      // Filtres actifs
};

onFilterByPopularityCommand(payload: null, ctx: TFeatureContext<TProductsDef, ProductsEntity>) {
  ctx.mutate('products:setSortCriteria', (draft) => {
    draft.sortCriteria = { field: 'popularity', order: 'desc' };
  });
}
// → 1 seul patch : { op: "replace", path: ["sortCriteria"], value: {...} }
```

```typescript
// La View applique les critères lors du rendu via le selector
class ProductsView extends View {
  get templates() {
    return {
      products: {
        template: ProductListTemplate,
        select: (data) => {
          const state = data.catalog;
          if (!state) return undefined;

          // Calcul dérivé : appliquer sort/filter sur les données brutes
          return this.computeVisibleProducts(state);
        },
      },
    };
  }

  private computeVisibleProducts(state: TProductsState): Product[] {
    let result = [...state.items];

    // Appliquer les filtres
    if (state.filters) {
      result = result.filter((p) => matchesFilters(p, state.filters));
    }

    // Appliquer le tri
    if (state.sortCriteria) {
      result = sortBy(result, state.sortCriteria);
    }

    return result;
  }
}
```

### 6.6 Données vs Critères vs Dérivées

| Type | Fréquence mutation | Stockage Entity | Exemple |
| --- | --- | --- | --- |
| **Données brutes** | Rare (CRUD serveur) | `items: Product[]` | Liste de produits |
| **Critères de vue** | Fréquent (UI) | `sortCriteria`, `filters`, `page` | Tri, filtres, pagination |
| **Données dérivées** | **Jamais** | Calculé dans le selector de la View | Liste filtrée et triée |

**Quand muter les données brutes ?**

Les mutations sur `items[]` sont légitimes uniquement pour des changements de **données métier** :

- **Ajout** : `items.push(newProduct)` — nouveau produit reçu du serveur
- **Suppression** : `items.splice(index, 1)` — produit supprimé
- **Modification d'un item** : `items[i].price = newPrice` — prix mis à jour
- **Données reçues du serveur** : `items = serverResponse.products` — rechargement

### 6.7 Cas avancé : child Views via Slots × Composers

Pour les cas où chaque item de la liste est un **composant complexe** avec son propre
cycle de vie, Behaviors et Channels (ex : widget de dashboard configurable),
le pattern Slots × Composers est disponible :

```typescript
class DashboardView extends View<TDashboardViewContract> implements TViewCallbacks<TDashboardViewContract> {
  get features()   { return dashboardViewFeatures; }
  get uiEvents()   { return dashboardViewUiEvents; }
  get uiElements() { return dashboardViewUiElements; }

  get templates() {
    return {
      widgets: {
        template: WidgetSlotsTemplate,
        select: (data) => data.dashboard?.widgets,
      },
    };
  }

  /**
   * Un slot, un Composer : le Composer compose une View par widget, sous la
   * clé du widget (I37). Un sélecteur de slot désigne exactement un élément.
   */
  get composers() {
    return { widgets: { slot: '#widgets-slot', composer: WidgetComposer } } as const;
  }
}

const widgetComposerViews = { chart: ChartWidgetView, table: TableWidgetView, kpi: KpiWidgetView };

class WidgetComposer extends Composer<TWidgetComposerContract> {
  get features() { return widgetComposerFeatures; } // dashboard : listens ["widgetsChanged"], queries ["widgets"]
  get views() { return widgetComposerViews; }

  resolve(ctx: TComposeContext<TWidgetComposerContract>): TComposition<TWidgetComposerContract> {
    // Le type de chaque widget vient du domaine, pas d'un attribut du DOM.
    return ctx.query('dashboard:widgets', null).map((w) => ({
      view: w.type,              // "chart" | "table" | "kpi"
      key: w.id,
      params: { widgetId: w.id }
    }));
  }
}
```

> **Attention** : Ce pattern a un **overhead** significatif (une View, avec sa part et
> ses abonnements, par item). Il est réservé aux cas où l'item a une complexité intrinsèque justifiant
> un composant autonome. Pour les listes simples (90% des cas), utiliser
> ProjectionList + Event Delegation (§6.4).

| Pattern | Cas d'usage | Overhead |
| --- | --- | --- |
| ProjectionList + Event Delegation (§6.4) | Listes simples, items template-only | Faible (1 listener par type) |
| Slot × Composer (§6.7) | Items complexes avec leur propre View | Élevé (n Views) |

### 6.8 Identifier l'item : capture déclarée dans le fait

> Décision : [ADR-23](../adr/ADR-23-listes.md). ✅ strate 1c, lot 3.

Avec la délégation, le traitement doit savoir **quel item** a été touché. Il
ne lit pas le DOM (I39) : la valeur est **capturée avec le fait**, au préambule
de son admission (C.5), puis portée comme donnée.

Une clé UI déclare les noms à capturer (`data`, camelCase). Pour chaque nom, le
noyau lit l'attribut `data-*` correspondant (`itemId` → `data-item-id`) sur
l'ancêtre le plus proche de la cible qui le porte, dans la part ; à défaut, la
valeur est `null`. Le fait est `{ type, ui, data }`.

```typescript
const uiEvents = {
  rows:   ui<HTMLUListElement>()([]),
  remove: ui<HTMLButtonElement>()(["click"], { data: ["itemId"] }),
  cell:   ui<HTMLTableCellElement>()(["click"], { data: ["rowId", "colId"] })
} satisfies TUIContract;

onCellClick(fact: TFact<"rowId" | "colId">, ctx: TFactContext<TTableViewContract>): void {
  const { rowId, colId } = fact.data;
  if (rowId !== null && colId !== null) ctx.trigger("table:selectCell", { rowId, colId });
}
```

Un nom capturé sur une clé sans événement déclaré, ou qui n'est pas en
camelCase de lettres, est refusé quand la View est décrite (O2). La capture de
la valeur d'une saisie suivra le même canal (strate 2, formulaires).

---

## 7. Intégration avec la View

> Décision : [ADR-26](../adr/ADR-26-souscription-view.md). Théorie : A4.d (une information présentée vient d'un message ou d'une réponse du domaine), G5 (l'état se lit par Query), C.3 (effets engagés après validation), D18 (une réaction à un Event n'ouvre aucun droit de commander).

### 7.1 Principe : une Query déclarée par binding, relancée par des Events explicites

Un binding de template déclare :

| Champ | Rôle |
| --- | --- |
| `template` | Template compilé (`setup()`/`create()`/`project()`). |
| `query` | Clé `"ns:query"` d'une Query déclarée dans `features[ns].queries`. Absent : template statique, projeté une fois sans données. |
| `params` | Facultatif : valeur fixe, ou fonction des paramètres de création de la View (capturés, A3.d). |
| `on` | Clés `"ns:event"` d'Events déclarés dans `features[ns].listens`. Obligatoire et non vide quand `query` est présent. |
| `select` | Facultatif, pur : dérivation de présentation du résultat (tri, filtre, format), sans autorité métier (A4.d). Par défaut, l'identité. |

La Feature expose une Query par vue de ses données dont un template a besoin ;
les données dérivées ne sont jamais stockées dans l'Entity (§6.5, §6.6).

### 7.2 Exemple complet, deux namespaces

```typescript
// orderSummaryViewFeatures :
//   cart  : listens itemAdded, itemRemoved ; queries items, total
//   promo : listens discountApplied ; queries discount
class OrderSummaryView extends View<TOrderSummaryViewContract> implements TViewCallbacks<TOrderSummaryViewContract> {
  get features()   { return orderSummaryViewFeatures; }
  get uiEvents()   { return orderSummaryViewUiEvents; }
  get uiElements() { return orderSummaryViewUiElements; }

  get templates() {
    return {
      items: {
        template: CartItemsTemplate,
        query: "cart:items",
        on: ["cart:itemAdded", "cart:itemRemoved"],
        select: (items) => [...items].sort((a, b) => a.name.localeCompare(b.name))
      },
      total: {
        template: TotalTemplate,
        query: "cart:total",
        on: ["cart:itemAdded", "cart:itemRemoved"]
      },
      discount: {
        template: DiscountTemplate,
        query: "promo:discount",
        on: ["promo:discountApplied"]
      },
      header: { template: OrderHeaderTemplate } // statique
    };
  }

  // Facultatif : un handler reste possible pour un effet N1 ponctuel (sur une clé sans template)
  onCartItemAddedEvent(payload: { item: TItem }, ctx: TEventContext<TOrderSummaryViewContract>): void {
    this.getUI("flash").text(`${payload.item.name} ajouté`);
  }
}
```

Un binding combine les données d'un seul namespace ; une présentation qui
croise deux namespaces se découpe en deux clés, ou s'appuie sur une Query de la
Feature qui fait autorité sur le calcul (A4.d).

### 7.3 Template Pug

Le template reçoit la sortie de `select` (ou le résultat de la Query) :

```pug
//- cart-items.template.pug
ul.Cart-items
  each item in items
    li.Cart-item(data-item-id=item.id)
      span.name #{item.name}
      span.qty ×#{item.qty}
```

### 7.4 Types TypeScript (`@bonsai/view`)

```typescript
type TProjectionTemplate<TData = unknown, TNodes = unknown> = {
  create(data: TData): Node;                 // contenu de la zone (SPA)
  setup(container: HTMLElement): TNodes;     // localise les nœuds dynamiques
  project(nodes: TNodes, data: TData): void; // mutations gardées par nœud (R5)
};

type TQueryBinding<TVC, K extends TFlatQueries<TVC["features"]> & string, TData, TOn> = {
  readonly template: TProjectionTemplate<TData>;
  readonly query: K;
  readonly params?: TQueryParamsFor<TVC["features"], K>
    | ((viewParams: Readonly<Record<string, unknown>>) => TQueryParamsFor<TVC["features"], K>);
  readonly on: TOn;                          // readonly [TFlatListens, ...TFlatListens[]]
  readonly select?: (result: TQueryResultFor<TVC["features"], K>) => TData;
};

type TStaticBinding = { readonly template: TProjectionTemplate<undefined> };

type TViewTemplates<TVC extends TViewContract> =
  | null                                                   // mode A
  | { readonly root: TTemplateBinding<TVC> }               // mode B
  | { readonly [K in keyof TVC["ui"] & string]?: TTemplateBinding<TVC> }; // mode C
```

`bind<TVC>()({ ... })` construit un `TQueryBinding` en inférant `K`, `TOn`
(littéral) et `TData` : `select` est typé par le résultat de la Query, le
template par la sortie de `select`. `TViewCallbacks<TVC, typeof templates>`
rend facultatif le handler de chaque Event cité dans un `on` (I82 amendé).
Sans `params`, la Query reçoit `null`.

### 7.5 Exécution par le framework

1. **Description de la View** (O2) : les clés sont des clés UI, ou `root` seule (sans `template` initial) ; chaque `query` et chaque Event de `on` sont déclarés dans le contrat ; un binding avec `query` a un `on` non vide. Codes : `UNKNOWN_TEMPLATE_KEY`, `ROOT_TEMPLATE_EXCLUSIVE`, `MISSING_TEMPLATE`, `MISSING_QUERY`, `UNDECLARED_QUERY`, `MISSING_ON`, `UNDECLARED_LISTEN`. Un appel de `getUI()` sur une clé couverte (toutes sous `root`) fait échouer l'unité (`TEMPLATE_OWNED_KEY`, I41).
2. **Création** : dans l'unité qui crée la View, pour chaque binding, Query → `select` (rien pour un binding statique) → effet préparé qui insère `create(data)` dans la zone puis y appelle `setup()`. L'adoption d'une part pré-rendue par `setup()` seul relève de la strate 2c (ADR-24).
3. **Event délivré** : handler `on{NS}{Event}Event` s'il existe, puis **une passe** sur les bindings dont `on` contient cet Event : Query (une seule exécution par couple Query/paramètres dans la passe) → `select` → `shallowEqual` avec la dernière sortie projetée → projection préparée si différente.
4. **Validation** : les projections sont engagées après la validation de l'unité (C.3) ; si l'unité échoue, elles ne le sont pas et la mémoire des dernières sorties est restaurée (G7).

Une Query refusée ou en échec fait échouer l'unité, comme toute Query (G7, `UNRECOVERABLE`) ; la projection n'ouvre aucun droit de commander (D18).

### 7.6 Séparation des audiences

| Audience | Reçoit | Pour |
| --- | --- | --- |
| **Features** | Events granulaires, payload métier | Réactions inter-Feature |
| **Handlers de View** | Events granulaires, payload | Effets N1 ponctuels (`getUI()`) |
| **Templates** | Résultat d'une Query, relancée par les Events de `on` | Projection N2/N3 |

### 7.7 Résumé des responsabilités

| Qui | Responsabilité |
| --- | --- |
| **Feature** | Expose les Queries dont les templates ont besoin ; émet les Events qui signalent leurs changements |
| **View** | Déclare `templates` : `query`, `params`, `on`, `select` |
| **Selector** | Dérivation de présentation pure du résultat de Query (A4.d) |
| **Framework** | Relance les Queries après les Events de `on`, saute si `shallowEqual`, prépare la projection |
| **Template** | Projette les données reçues sur le DOM via `project()` |
| **Guards per-nœud** | Évitent les mutations DOM inutiles (compilés dans `update()`) |

---

## 7bis. Render Contract complet — How Rendering Works

> **Section normative** — Source de vérité pour le cycle de rendu PDR de bout en bout.
> Décisions associées : [ADR-22](../adr/ADR-22-pdr.md) (PDR), [ADR-26](../adr/ADR-26-souscription-view.md) (données d'un template), ADR-10 (pas de state dérivé).

Bonsai utilise la **Projection DOM Réactive (PDR)** : mutations chirurgicales sur le DOM
existant, sans arbre virtuel intermédiaire (pas de VDOM). Cette section décrit le cycle
complet, du changement de données à la mutation DOM finale.

### 7bis.1 Pipeline de rendu : 6 étapes

```text
┌────────────────── Pipeline de rendu PDR ───────────────────┐
│                                                          │
│  1. MUTATION     ctx.mutate() modifie le state (unité)    │
│       │                                                   │
│       ▼                                                   │
│  2. EMISSION     ctx.emit(event, payload), différé (G5)   │
│       │                                                   │
│       ▼                                                   │
│  3. QUERY        Event délivré à la View : pour chaque     │
│       │          binding dont `on` le contient,            │
│       │          result = query(binding.query, params)     │
│       ▼          (ADR-26, une exécution par passe)         │
│  4. SELECTOR     data = binding.select(result)            │
│       │          └─ shallowEqual(dernière, data) → SKIP    │
│       ▼          └─ différent → continuer               │
│  5. PROJECT      template.project(nodes, data)             │
│       │          ├─ scalaires : guards per-nœud            │
│       │          └─ listes : ProjectionList.reconcile()    │
│       ▼                                                   │
│  6. DOM          Effets engagés après validation (C.3) :   │
│                  seuls les nœuds CHANGÉS sont mutés        │
│                  (textContent, setAttribute, insertBefore, │
│                   removeChild)                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 7bis.2 Les 4 couches de protection contre les mutations inutiles

Bonsai élimine les mutations DOM inutiles à **4 niveaux** successifs. Chaque couche
agit comme un filtre — seules les mutations réellement nécessaires atteignent le DOM.

| Couche | Nom | Où | Ce qu'elle filtre | Exemple |
| --- | --- | --- | --- | --- |
| **L1** | **`on`** | `get templates()` | Ne relance que les bindings concernés par l'Event délivré | `promo:discountApplied` ne relance pas `cart:items` |
| **L2** | **shallowEqual** | Framework, après le selector | Rejette les projections quand les données n'ont pas changé | Première projection après SSR : données identiques → skip complet (ADR-24 H4) |
| **L3** | **Guards per-nœud** | `update()` dans `project()` (compilé) | Rejette les mutations de contenu quand la valeur est identique | `if (node.textContent !== item.name)` — évite le re-layout navigateur |
| **L4** | **Keyed reconcile** | `ProjectionList.reconcile()` | Ne déplace/crée/supprime que les items nécessaires | Tri : seuls les items mal positionnés reçoivent un `insertBefore` |

> **Analogie avec un VDOM** : L1+L2+L3 remplacent le diff d'arbre. L4 remplace le keyed
> reconciliation. Le résultat (mutations DOM finales) est strictement identique. La différence :
> PDR ne construit pas d'arbres virtuels intermédiaires.

### 7bis.3 Schéma SSR → Hydratation → Projection

> Référence normative : [ADR-24](../adr/ADR-24-hydratation-ssr.md) H1–H5.

#### Règles d'hydratation (H1–H5)

| Règle | Nom | Énoncé |
| --- | --- | --- |
| **H1** | Détection par nœud | ⏳ À la matérialisation de la part d'une View, le noyau chercherait dans le slot un élément pré-rendu de sa clé (`keyAttr`) → **trouvé** = adopté (mode SSR, `setup()`), **absent** = créé (`<div data-bonsai-part>`, livré). La détection est **par nœud**, pas globale. |
| **H2** | `setup()` = hydratation | `setup()` localise les nœuds dynamiques dans un DOM existant. Il n'y a **pas** de procédure d'hydratation séparée — `setup()` EST l'hydratation. Pas de branche `if (SSR)` dans le code applicatif. |
| **H3** | ProjectionList par `keyAttr` | `ProjectionList.setup()` indexe les items existants par `keyAttr` (`data-item-id` / `data-key`). Les items sont adoptés, jamais recréés. Résultat : `Map<key, { el, nodes }>` — zéro création DOM. |
| **H4** | Première projection = no-op | Après la création de la View, la première projection passe dans le pipeline L1→L2. Le selector retourne des données identiques au DOM servi → `shallowEqual` → **SKIP**. Zéro mutation DOM après bootstrap. |
| **H5** | `serverState` unique | `TBootstrapOptions.serverState` est le **seul** mécanisme d'état sérialisé du framework. Le framework ne lit **jamais** le DOM pour extraire du state (esprit I39). Le développeur contrôle l'injection (JSON inline, fetch, localStorage, etc.). |

```text
T0 ─── SSR ──────────────────────────────────────────────────────────────
       Serveur rend le HTML complet (structure + contenu)
       DOM = source de vérité structurelle (ADR-22)

T1 ─── Bootstrap (setup) ───────────────────────────────────────────────
       élément pré-rendu de la part → TROUVÉ → adopté, mode SSR (H1)
       template.setup(container) → localise nœuds dynamiques (H2)
       ProjectionList.setup() → indexe items existants par keyAttr (H3)
       Résultat : Map<key, { el, nodes }> — zéro création DOM

T2 ─── Première projection ─────────────────────────────────────────────
       Feature.onInit(ctx) → ctx.query / Entity peuplée → Event délivré après le démarrage
       Selector → données identiques au DOM → shallowEqual → SKIP (H4)
       ✅ Zéro mutation DOM après bootstrap

T3 ─── Interaction utilisateur (ex: tri) ────────────────────────────────
       ctx.trigger(command) → Feature → ctx.mutate(critères) → ctx.emit(event)
       Query catalog:products → select (tri) → liste réordonnée
       shallowEqual → différent → project()
       ProjectionList.reconcile(items) → déplacements + guards
       ✅ Seuls les nœuds nécessaires sont déplacés/mutés
```

### 7bis.4 Implémentation framework (schéma du livré, `View.#projectBindings`)

```typescript
// INTERNE FRAMEWORK — pendant le traitement d'un Event délivré à la View (ADR-26)
function refreshTemplates(view: View, event: string, ctx: TUnitContext): void {
  const results = new Map<string, unknown>();               // une Query par couple query/params dans la passe
  for (const [uiKey, binding] of view.bindingsListening(event)) {
    const params = view.paramsOf(binding);
    const id = `${binding.query} ${stableKey(params)}`;
    if (!results.has(id)) results.set(id, ctx.query(binding.query, params));
    const data = (binding.select ?? identity)(results.get(id));
    if (shallowEqual(view.lastProjected(uiKey), data)) continue;   // L2
    view.rememberProjected(uiKey, data, ctx);                       // journalisé : défait avec l'unité (G7)
    ctx.prepareEffect(view.part, () => binding.template.project(view.nodes[uiKey], data)); // engagé après validation (C.3)
  }
}
```

### 7bis.5 Règles normatives du Render Contract

| # | Règle | Source |
| --- | --- | --- |
| **R1** | PDR est la stratégie de rendu **unique** de Bonsai. Pas de VDOM. | ADR-22 |
| **R2** | Un template tire ses données d'une Query déclarée, relancée par les Events de son `on` ; jamais d'accès direct à l'Entity. | ADR-26 |
| **R3** | Les données dérivées (filtre, tri) sont calculées dans le selector, **jamais** stockées dans l'Entity. | ADR-10 |
| **R4** | `shallowEqual` compare la **sortie** du selector (pas l'input). Si identique, la projection est skippée. | §7bis.4 |
| **R5** | `update()` dans `project()` **DOIT** inclure des guards per-nœud (`if (val !== newVal)`). | §6.1 |
| **R6** | `ProjectionList.reconcile()` est l'unique mécanisme de réconciliation keyed. | ADR-23, ADR-22 |
| **R7** | `setup()` est l'hydratation SSR. `create()` est le fallback SPA. Même API. | ADR-24 H2 |
| **R8** | Pas de pool de recyclage pour les items supprimés. `itemCreate()` est le seul mécanisme de création. | ADR-22 |

---

## 8. Syntaxe Pug (standard)

> Le template Pug reste **100% standard** — aucune extension de syntaxe.
> La réactivité est déclarée dans la View (TypeScript).

### 8.1 Directive `each` avec clé (inférée)

Le compilateur Bonsai **infère la clé** depuis un attribut de l'élément racine de la boucle.
Cela reste du Pug standard tout en garantissant une réconciliation performante.

**Attributs reconnus** (par ordre de priorité) :

1. `data-item-id` — Convention Bonsai (sémantique)
2. `data-key` — Alternative générique
3. `id` — Fallback si unique par item

```pug
//- ✅ Clé via data-item-id (recommandé)
each product in items
  li.Cart-item(data-item-id=product.id)
    span.name #{product.name}

//- ✅ Clé via data-key (alternative)
each product in items
  li.Cart-item(data-key=product.id)
    span.name #{product.name}

//- ✅ Clé via id (si unique par item)
each product in items
  li.Cart-item(id="product-" + product.id)
    span.name #{product.name}

//- ❌ Erreur de compilation — pas de clé détectable
each product in items
  li.Cart-item
    span.name #{product.name}
//- Error: List requires a key. Add 'data-item-id' or 'data-key' attribute.
```

> **Note** : Contrairement à d'autres frameworks qui acceptent un `key=` dans la boucle,
> Bonsai utilise uniquement des attributs HTML standards pour rester compatible Pug.

### 8.2 Directive `@ui` (obligatoire)

Chaque élément référencé dans `uiElements` de la View **doit** avoir un attribut `@ui`
correspondant dans le template. Cela garantit la synchronisation Template ↔ View au build time.

```pug
//- ✅ Chaque uiElement a son @ui correspondant
.Cart
  ul.Cart-items(@ui="items")
    each product in items
      li.Cart-item(data-item-id=product.id)
        span.name #{product.name}
  
  span.Cart-total(@ui="total") #{total} €
```

```typescript
// La View déclare les mêmes clés dans son contrat UI (ADR-14)
const cartViewUiEvents = {
  items: ui<HTMLUListElement>()([]),
  total: ui<HTMLSpanElement>()([]),
} satisfies TUIContract;

const cartViewUiElements = {
  items: '@ui',   // sentinelle : résolu via @ui="items" dans le template
  total: '@ui',   // sentinelle : résolu via @ui="total" dans le template
} satisfies TUIElements<typeof cartViewUiEvents>;

class CartView extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract> {
  get features()   { return cartViewFeatures; }
  get uiEvents()   { return cartViewUiEvents; }
  get uiElements() { return cartViewUiElements; }
}
```

> **Note** : La valeur `'@ui'` est une **valeur sentinelle** (pas un sélecteur CSS).
> Elle indique au framework de résoudre l'élément via l'attribut `@ui` correspondant
> dans le template Pug, plutôt que via `querySelector()`. Les `uiElements` dont la valeur
> est un sélecteur CSS classique (ex: `'.Cart-total'`) restent valides pour les Views
> sans template (Mode A, N1).

**Erreurs de compilation** :

| Cas | Message |
| --- | --- |
| `@ui` dans Pug sans `uiElement` | `Error: @ui 'foo' in template but not declared in uiElements` |
| `uiElement` sans `@ui` dans Pug | `Error: uiElement 'bar' requires @ui="bar" in template` |

> **Philosophie** : Un petit effort de discipline (ajouter `@ui`) pour une garantie forte
> de synchronisation. Les erreurs de typo/refactoring sont détectées au build, pas en production.

### 8.3 Bindings conditionnels

```pug
//- Classe conditionnelle
li.Cart-item(class={'is-selected': product.selected})

//- Attribut conditionnel
button.remove(disabled=product.locked)

//- Visibilité
.error-message(hidden=!hasError) #{errorMessage}
```

---

## 9. Stratégies de cache

### 9.1 Cache des templates compilés

Les templates sont compilés au build time et bundlés. Pas de cache runtime nécessaire.

### 9.2 Cache des nœuds résolus

`ProjectionList` maintient une `Map<key, TItemNodes>` pour éviter de re-résoudre les nœuds.

### 9.3 Skip update

Le code généré inclut des guards pour éviter les mutations inutiles :

```typescript
// Généré par le compilateur
if (nodes.name.textContent !== item.name) {
  nodes.name.textContent = item.name;
}
```

---

## 10. Gestion des erreurs

### 10.1 Erreurs de compilation

| Erreur | Message |
| --- | --- |
| `each` sans clé | `Error: List directive requires a key. Add 'key=expr' or use 'data-item-id' / 'data-key' attribute.` |
| @ui non résolu | `Error: @ui 'foo' referenced but not found in uiElements declaration.` |
| Syntaxe invalide | `Error: Invalid Pug syntax at line X.` |

### 10.2 Erreurs runtime

| Erreur | Cause | Message |
| --- | --- | --- |
| Clé dupliquée | Deux items avec la même clé | `[DUPLICATE_KEY] ProjectionList — duplicate key "X"` : erreur d'engagement (C.3) |
| Élément manquant | DOM modifié hors framework | `Error: Expected element with key 'X' not found.` |

---

## 11. Listes : patterns, animations, virtualisation

> Décisions : [ADR-22](../adr/ADR-22-pdr.md), [ADR-23](../adr/ADR-23-listes.md).

### 11.1 Collection patterns — ProjectionList + délégation

**Décision** : Le pattern canonique pour les listes est `ProjectionList` + event delegation
(§6.4). Les child Views via Slots × Composers (§6.7) sont réservées aux cas complexes
(composants autonomes avec lifecycle propre). Voir [ADR-23](../adr/ADR-23-listes.md).

| Pattern | Cas d'usage | Overhead |
| --- | --- | --- |
| ProjectionList + Delegation | 90% — listes simples, items template-only | Faible |
| Slots × Composers | 10% — items complexes (dashboard widgets) | Élevé |

**Anti-patterns associés** (§6.5) :

- ❌ Muter les données brutes pour filtrer/trier
- ❌ Un listener par item au lieu de delegation
- ❌ `CollectionComposer` (ADR-18 interdit)

### 11.2 Animations de liste — callbacks + CSS

> ⏳ **Reporté après la v1** ([ROADMAP](../ROADMAP.md), ADR-23) : `ProjectionList` ne livre pas ces callbacks au lot 3. Une sortie animée laisse l'élément dans le DOM après l'engagement ; son articulation avec C.3 reste à concevoir. La suite de cette section décrit la piste, non un contrat.

**Piste** : Les animations sont gérées via les callbacks `onInsert`, `onRemove`, `onMove`
de `TReconcileHandlers`, combinés avec des transitions CSS natives.

#### Signatures

```typescript
type TReconcileHandlers<TItem, TItemNodes> = {
  key: (item: TItem) => string;
  update: (nodes: TItemNodes, item: TItem, index: number) => void;
  
  // Callbacks d'animation (optionnels)
  onInsert?: (el: HTMLElement, item: TItem, index: number) => void;
  onRemove?: (el: HTMLElement, item: TItem) => void | Promise<void>;  // Promise pour async
  onMove?: (el: HTMLElement, item: TItem, fromIndex: number, toIndex: number) => void;
}
```

#### Exemple d'utilisation

```typescript
class CartView extends View {
  get templates() {
    return {
      items: {
        template: CartItemsTemplate,
        select: (data) => data.cart?.items,
        // Callbacks d'animation passés au reconcile
        reconcileOptions: {
          onInsert: (el) => {
            el.dataset.transition = 'entering';
            void el.offsetHeight;  // Force reflow
            el.dataset.transition = 'entered';
          },
          onRemove: (el) => new Promise((resolve) => {
            el.dataset.transition = 'leaving';
            el.addEventListener('transitionend', resolve, { once: true });
            setTimeout(resolve, 300);  // Fallback
          }),
        },
      },
    };
  }
}
```

```css
.Cart-item {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.Cart-item[data-transition="entering"] { opacity: 0; transform: translateX(-20px); }
.Cart-item[data-transition="entered"]  { opacity: 1; transform: translateX(0); }
.Cart-item[data-transition="leaving"]  { opacity: 0; transform: translateX(20px); }
```

#### Clarification : `el` = l'item individuel

```text
┌─────────────────────────────────────────────────────────────┐
│  ul.Cart-items (@ui="items")     ← Conteneur (View.nodes)  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  li.Cart-item (data-item-id="1")  ← el dans onInsert│   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  li.Cart-item (data-item-id="2")  ← el dans onRemove│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Les callbacks opèrent sur les **éléments individuels** (`<li>`), pas sur le conteneur (`<ul>`).

#### Clarification : Nommage Pug découplé

Le nommage dans le template Pug est **local** — aucun couplage avec la View :

```typescript
// View — retourne un tableau typé
select: (data) => data.cart?.items  // CartItem[]
```

```pug
//- Template — nomme librement le tableau et l'item
each card in cards              //- ✅ OK
each product in products        //- ✅ OK
each x in data                  //- ✅ OK (peu lisible)
```

```typescript
// Callback — reçoit l'objet data (pas le nom de variable)
onInsert: (el, item: CartItem) => { /* item = { id, name, qty } */ }
```

**Le contrat est la structure des données (`CartItem`), pas le nommage.**

### 11.3 Listes virtualisées — API séparée

**Décision** : `VirtualizedList` est une API séparée de `ProjectionList`.

⏳ Hors v1 ([roadmap](../ROADMAP.md)).

| Classe | Cas d'usage | Complexité |
| --- | --- | --- |
| `ProjectionList` | Listes courtes (< 500 items) | Simple |
| `VirtualizedList` | Listes longues (1000+ items) | Complexe |

```pug
//- Liste simple (défaut)
ul.Cart-items(@ui="items")
  each item in items
    li.Cart-item(data-item-id=item.id)

//- Liste virtualisée (opt-in)
ul.Feed-posts(@ui="posts" @virtualized)
  each post in posts
    li.Feed-post(data-item-id=post.id)
```

### 11.4 `each` imbriqués — support natif

**Décision** : Le compilateur supporte nativement les boucles `each` imbriquées.
Chaque niveau génère une `ProjectionList` imbriquée avec réconciliation keyed.

#### Exemple

```pug
//- Template avec each imbriqué
each category in categories
  .Product-category(data-item-id=category.id)
    h2 #{category.name}
    each product in category.products
      .Product-item(data-item-id=product.id) #{product.name}
```

#### Code généré

```typescript
// Le compilateur génère des ProjectionList imbriquées
export const CatalogTemplate: TProjectionTemplate<CatalogNodes, Category[]> = {
  project(nodes, categories) {
    nodes.categoryList.reconcile(categories, {
      key: cat => cat.id,
      update: (catNodes, category) => {
        catNodes.name.textContent = category.name;
        
        // ProjectionList imbriquée pour les produits
        catNodes.productList.reconcile(category.products, {
          key: prod => prod.id,
          update: (prodNodes, product) => {
            prodNodes.name.textContent = product.name;
          }
        });
      }
    });
  }
};
```

#### Contrainte : Clé à chaque niveau

```pug
//- ✅ Valide — clé à chaque niveau
each category in categories
  .Category(data-item-id=category.id)
    each product in category.products
      .Product(data-item-id=product.id)

//- ❌ Erreur de compilation — clé manquante au niveau 2
each category in categories
  .Category(data-item-id=category.id)
    each product in category.products
      .Product #{product.name}
//- Error: Nested list requires a key. Add 'data-item-id' or 'data-key' attribute.
```

#### Cas d'usage

- Menus avec sous-menus
- Catalogues avec catégories
- Arbres de fichiers
- Tableaux groupés
- Commentaires avec réponses

---

## 12. Références

- [view.md §4 — PDR](4-couche-concrete/view.md#4-projection--getui) — Contrat de base
- [pugx](../pugx/) — Projet séparé d'extension de Pug avec typage (hors scope)
- [React Reconciliation](https://reactjs.org/docs/reconciliation.html)
- [Vue v-for with key](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key)
- [Lit repeat directive](https://lit.dev/docs/templates/lists/)
- [Pug Language Reference](https://pugjs.org/language/iteration.html)
- [Event Delegation](https://javascript.info/event-delegation) — pattern DOM utilisé par §6.4
