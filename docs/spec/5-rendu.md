# Rendu — PDR, compilateur Pug, ProjectionList

> 🟢 **Livré en strate 1c (5 novembre 2026), relu contre la théorie V0.9.5.** Templates alimentés par Query (lot 2, ADR-26), `ProjectionList` et capture (lot 3, ADR-23), compilateur Pug `tools/pug-compiler` et `ProjectionSwitch` (lot 4, ADR-22). Restent cibles : l'hydratation d'un rendu serveur (strate 2c), la directive `@ui`, les animations de liste et `VirtualizedList` ([roadmap](../ROADMAP.md)). Toute réalisation devra respecter trois contraintes de la théorie : une projection, y compris `template.project()`, est un **effet** engagé après la validation de l'unité (C.3) ; la View n'observe le domaine que par les Events qu'elle reçoit et par Query, dans une unité (G5, A5.a) ; elle ne lit jamais le DOM (I39), les données d'un fait étant capturées avec lui (C.5). En cas d'écart, la [théorie](../theorie.md) prévaut ([règle de confiance](../README.md#règle-de-confiance-et-dalignement)).

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
| **Compilateur** | `tools/pug-compiler` — `pnpm pug` compile chaque `*.template.pug` en `*.template.ts` (§5) |

> ### Statut normatif
>
> Ce document est **stable et normatif** pour les mécanismes de rendu PDR,
> les templates Pug, l'API `ProjectionList`, le Render Contract (§7bis), et les
> collection patterns (§6.4–6.8). Les ADR-22 à ADR-26 y font foi.
> Ce document dépend de [view.md](4-couche-concrete/view.md), [communication.md](2-architecture/communication.md) et [entity.md](3-couche-abstraite/entity.md) pour les contrats View, Channel et Entity.

---

> ### Périmètre d'implémentation
>
> | Élément | État | Sections concernées |
> | --- | --- | --- |
> | Templates réactifs (Query déclarée, `on`, `select`), Render Contract | ✅ Strate 1c, lot 2 | §2, §7, §7bis |
> | `ProjectionList`, réconciliation keyed, capture de l'item | ✅ Strate 1c, lot 3 | §6 |
> | Compilateur Pug → PDR (`create`/`setup`/`project`), `ProjectionSwitch` | ✅ Strate 1c, lot 4 | §4, §5, §8, §10 |
> | Hydratation SSR (H1–H5) | ⏳ Strate 2c | §7bis.3 |
> | Directive `@ui`, callbacks d'animation de liste, `VirtualizedList` | Hors v1 ([roadmap](../ROADMAP.md)) | §8.2, §11 |

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

### 3.2 Ce que la strate 1c a ajouté

| Concept | Livré | Section |
| --- | --- | --- |
| Compilateur Pug → PDR | ✅ lot 4 | §5, §8 |
| `each` → reconcile | ✅ lot 4 (`ProjectionList`, lot 3) | §4.3, §8.1 |
| `if` → zone conditionnelle | ✅ lot 4 (`ProjectionSwitch`) | §8.4 |
| Auto-réactivité template | ✅ lot 2 | §7 |

### 3.3 Héritage du prototype Pug → VDOM

Un compilateur Pug → VDOM (Snabbdom) avait été prototypé en amont (`tools/pug-to-ts-template`, supprimé au lot 4). Son lexer et son parser, un fork TypeScript de `pug-lexer`/`pug-parser`, sont repris dans `tools/pug-compiler/src/pug/`. La génération est réécrite : elle produit `create`/`setup`/`project` au lieu de VNodes.

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

Toute boucle `each` **DOIT** avoir une clé, portée par l'élément racine de son corps (§8.1) :

```pug
//- Clé par data-item-id (convention, lue aussi par la capture `itemId`, ADR-23)
each product in items
  li(data-item-id=product.id) #{product.name}

//- Clé par data-key
each product in items
  li(data-key=product.id) #{product.name}

//- ❌ Erreur de compilation PUG:EACH_KEY
each product in items
  li #{product.name}
```

### 4.4 Pas d'appel manuel à `project()` — Auto-réactivité

La View déclare `query`, `on` et `select` dans `get templates()` ; le framework
relance la Query après les Events listés et projette (§7). Le code applicatif
n'appelle jamais `project()`.

**Conséquence** : la View n'a **jamais** de handler manuel pour une clé dont un template s'occupe (I41).

---

## 5. Architecture du compilateur

> Livré au lot 4 de la strate 1c : `tools/pug-compiler/`. Le compilateur tourne au build, jamais au runtime.

### 5.1 Pipeline de compilation

```text
.template.pug ──▶ lexer + parser ──▶ AST Pug ──▶ IR (fragments) ──▶ .template.ts
                  src/pug/ (fork)                 src/ir.ts           src/generate.ts
```

- `src/pug/` — lexer et parser forkés de Pug (TypeScript), erreurs `PugError` avec code `PUG:*`, position et extrait du source.
- `src/expression.ts` — analyse des expressions JavaScript avec le parser de TypeScript : identifiants libres et renommage.
- `src/ir.ts` — AST → représentation intermédiaire, et toutes les vérifications du §10.1.
- `src/generate.ts` — IR → module TypeScript.
- `cli.ts` — `pnpm pug [chemins]` écrit `x.template.ts` à côté de chaque `x.template.pug` ; `pnpm pug:check` échoue si un module généré est périmé (pre-commit et CI).

Le module généré est versionné à côté de son template et vérifié par `tsc` comme le reste du code : les expressions du template sont typées contre le type déclaré par `//- @data` (§8).

### 5.2 Représentation intermédiaire (IR)

L'IR découpe le template en **fragments** : la racine, le corps de chaque `each` (un par item) et chaque branche d'un `if`. Un fragment reçoit `$data` et les variables de portée de son parent (variable et index de boucle, paramètres de mixin, renommés en noms uniques).

```typescript
type TFragment = {
  kind: "root" | "item" | "branch";
  params: TVar[];        // variables reçues du fragment parent
  locals: TLocal[];      // paramètres des mixins appelés dans ce fragment
  slots: TSlot[];        // valeurs dynamiques : texte, attribut, test d'un if, source d'un each
  nodes: TNode[];        // element | text | dyntext | switch | list
  key: TKey | null;      // pour un item : sa clé, calculée sans l'index
};
```

Les mixins sont **inlinés** à la compilation : leurs paramètres deviennent des locaux du fragment appelant, leur `block` est compilé dans la portée de l'appelant.

### 5.3 Génération de code

Pour chaque fragment `F`, le module contient cinq fonctions :

| Fonction | Rôle |
| --- | --- |
| `$eF(...)` | évaluateur : toutes les valeurs dynamiques de F, fonction pure de ses paramètres |
| `$cF(...)` | `create` : construit le DOM de F par l'API DOM (`createElement`, `textContent`, jamais `innerHTML`) |
| `$sF(…)` | `setup` : localise les nœuds dynamiques de F dans un DOM existant, par parcours des frères |
| `$pF(n, …)` | `project` : mutations gardées (`if (n.x.textContent !== v) …`) |
| `$kF(...)` | pour un item : sa clé, sans l'index |

Le type de chaque variable de boucle est **inféré** par TypeScript depuis l'évaluateur du parent (`$Item<ReturnType<typeof $e0>["s1"]>`) : un item imbriqué est typé sans annotation. Extrait généré depuis `tests/fixtures/templates/todo-list.template.pug` :

```typescript
export type TTodoListTemplateData = import("./todo.types").TTodoListData;

const $e0 = ($data: TData) => {
  const { todos } = $data;
  return { s0: todos.length, s1: todos };
};

function $p0($n: ReturnType<typeof $s0>, $data: TData): void {
  const $v = $e0($data);
  $attr($n.n1, "data-count", $v.s0);
  $n.l1.$ = [$data];
  $n.l1.list.reconcile($v.s1);       // ProjectionList, clé data-item-id
}

export const TodoListTemplate: TProjectionTemplate<TData, ReturnType<typeof $s0>> = {
  create: (data) => $c0(data),
  setup: (container) => $s0(container),
  project: (nodes, data) => $p0(nodes, data)
};
```

Le code généré n'importe que `ProjectionList`, `ProjectionSwitch` et `TProjectionTemplate` de `@bonsai/view` (option `--runtime` pour un autre module) ; il compile en mode `strict`.

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
//- @data import("./cart.types").TCartItemsData
ul.Cart-items
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

## 8. Syntaxe Pug

> Pug standard, réduit à ce qui se projette chirurgicalement, plus une déclaration de type en commentaire.
> La réactivité (Query, `on`, `select`) est déclarée dans la View (§7) ; le template ne porte que la structure.

**Type des données.** Un commentaire non rendu en tête déclare le type TypeScript des données : la sortie de `select`, ou le résultat de la Query. Les noms libres des expressions sont les champs de ce type (les *locals* de Pug) ; les globales ECMAScript (`Math`, `JSON`, `String`…) restent des globales.

```pug
//- @data import("./cart.types").TCartItemsData
ul.Cart-items
  each item in items
    li(data-item-id=item.id) #{item.name.toUpperCase()}
```

Le compilateur recopie ce type dans le module généré (`export type TCartItemsTemplateData`) ; `tsc` vérifie chaque expression contre lui, et `bind<TVC>()` vérifie la sortie de `select` contre lui. Sans `select`, le résultat de la Query doit être ce type (`select` devient obligatoire sinon). Un template sans `@data` ne lit aucune donnée (`PUG:NO_DATA_TYPE` sinon).

**Périmètre.**

| Construction | Support |
| --- | --- |
| Tags, `.classe`, `#id`, attributs statiques, texte, `\|`, `#[…]` | ✅ |
| `= expr`, `#{expr}`, `attr=expr` : expressions JavaScript libres, typées | ✅ |
| `each x, i in expr` à clé, imbriqué | ✅ §8.1 |
| `if` / `else if` / `else`, `unless` | ✅ §8.4 |
| `mixin`, `+appel(args)`, `block` | ✅ §8.5 |
| Commentaires `//` et `//-` | ignorés (aucun nœud créé) |
| `class=expr` dynamique | ❌ `PUG:DYNAMIC_CLASS` : une classe est un rôle stable, l'état passe par `data-*` |
| `!=`, `!{}`, HTML brut dans le texte | ❌ un template projette du texte, jamais du HTML |
| `- code`, `case`, `while`, `include`, `extends`/`block` nommé, `&attributes`, `each … else`, `svg`/`math` | ❌ erreur de compilation (§10.1) |

Une valeur d'attribut contenant des espaces s'écrit entre parenthèses : `data-state=(done ? "done" : "open")`.

### 8.1 `each` avec clé

Le corps d'un `each` est **un seul élément**, la racine de l'item, qui porte sa clé dans `data-item-id` (convention, lue aussi par la capture `itemId`, ADR-23) ou `data-key`. La clé dépend de l'item, jamais de l'index. Le `each` est le **seul contenu** de son élément parent (le conteneur de la `ProjectionList`), ou du template entier.

```pug
//- ✅
ul
  each product, i in items
    li.Cart-item(data-item-id=product.id data-pos=i)
      span.name #{product.name}

//- ❌ PUG:EACH_KEY — pas de clé
//- ❌ PUG:KEY_USES_INDEX — data-key=i
//- ❌ PUG:EACH_SINGLE_ROOT — deux éléments dans le corps
//- ❌ PUG:EACH_NOT_ALONE — un frère du each dans le même parent
```

> **Note** : `id` n'est pas une clé d'item : un `id` est un ancrage stable de la page (conventions DOM).

### 8.2 Directive `@ui` (non livrée)

La vérification au build de la correspondance entre les clés UI de la View et des marqueurs `@ui` du template demande de compiler le template avec le contrat de la View. Elle est reportée ([roadmap](../ROADMAP.md)) : les clés UI restent résolues par les sélecteurs de `uiElements`. Un attribut `@ui` est refusé (`PUG:ATTRIBUTE_NAME`).

### 8.3 Attributs

```pug
//- Attribut d'état : true → présent vide, false/null/undefined → absent, sinon String(valeur)
li.Cart-item(data-state=product.state disabled=product.locked)

//- Visibilité
.error-message(hidden=!hasError) #{errorMessage}
```

### 8.4 `if` / `else` — zone conditionnelle

Une chaîne `if` / `else if` / `else` devient une `ProjectionSwitch` (`@bonsai/view`) : la branche active est encadrée par deux commentaires, `<!--bonsai-if:N-->` (N = index de la branche, `-1` pour aucune) et `<!--/bonsai-if-->`. Garder la même branche ne fait que la projeter ; en changer recrée les nœuds de la nouvelle branche. `setup()` lit l'index de branche dans le marqueur ; un DOM sans ces marqueurs est une erreur `TEMPLATE_MISMATCH`.

```pug
if cart.items.length === 0
  p.empty Panier vide
else
  ul
    each item in cart.items
      li(data-item-id=item.id)= item.name
```

Un `each` sous un `if` doit avoir un élément parent dans la branche (`PUG:EACH_IN_BRANCH`).

### 8.5 Mixins

Inlinés à la compilation. Les paramètres sont des noms simples, évalués dans la portée de l'appelant ; `block` insère le contenu de l'appel, compilé dans la portée de l'appelant. Un paramètre peut porter la clé d'un item :

```pug
mixin row(it)
  li(data-item-id=it.id)= it.name

ul
  each item in items
    +row(item)
```

Refusés : définition hors du niveau racine, récursion, paramètre par défaut ou *rest*, attributs sur l'appel.

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

Toute erreur est une `PugError` : code `PUG:*`, ligne, colonne et extrait du template avec un curseur. Les erreurs de type des expressions sont celles de `tsc` sur le module généré.

| Code | Cause |
| --- | --- |
| `EACH_KEY` | `each` sans `data-item-id` / `data-key` dynamique sur la racine de l'item |
| `KEY_USES_INDEX` | clé d'item dépendant de l'index (directement ou par un paramètre de mixin) |
| `EACH_SINGLE_ROOT` · `EACH_NOT_ALONE` · `EACH_IN_BRANCH` · `EACH_ELSE` | forme d'un `each` (§8.1, §8.4) |
| `NO_DATA_TYPE` · `DUPLICATE_DATA` · `EMPTY_DATA` | déclaration `//- @data` absente alors que le template lit des données, double, ou vide |
| `CODE` · `UNESCAPED` · `INLINE_HTML` · `ENTITY` | code non bufferisé, sortie non échappée, HTML brut, entité HTML inconnue |
| `DYNAMIC_CLASS` · `ATTRIBUTE_NAME` · `DUPLICATE_ATTRIBUTE` · `TAG_NAME` | attributs et balises |
| `UNKNOWN_MIXIN` · `RECURSIVE_MIXIN` · `DUPLICATE_MIXIN` · `NESTED_MIXIN` · `MIXIN_PARAMS` · `MIXIN_ARGUMENTS` · `MIXIN_ATTRIBUTES` | mixins (§8.5) |
| `EXPRESSION` | expression JavaScript invalide |
| `UNSUPPORTED` | construction hors périmètre (`case`, `while`, `include`, `extends`, `doctype`…) |
| codes du lexer/parser | syntaxe Pug invalide (`UNEXPECTED_TEXT`, `BLOCK_OUTSIDE_MIXIN`…) |

### 10.2 Erreurs runtime

| Erreur | Cause | Message |
| --- | --- | --- |
| Clé dupliquée | Deux items avec la même clé | `[DUPLICATE_KEY] ProjectionList — duplicate key "X"` : erreur d'engagement (C.3) |
| DOM non conforme | Zone conditionnelle sans ses marqueurs (DOM modifié hors framework, rendu serveur différent) | `[TEMPLATE_MISMATCH] ProjectionSwitch — the DOM does not match the template` |

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
│  ul.Cart-items                   ← Conteneur de la liste   │
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
ul.Cart-items
  each item in items
    li.Cart-item(data-item-id=item.id)

//- Liste virtualisée (opt-in, hors v1 : syntaxe à définir)
ul.Feed-posts
  each post in posts
    li.Feed-post(data-item-id=post.id)
```

### 11.4 `each` imbriqués — support natif

**Décision** : Le compilateur supporte nativement les boucles `each` imbriquées.
Chaque niveau génère une `ProjectionList` imbriquée avec réconciliation keyed.

#### Exemple

```pug
//- @data { categories: readonly TCategory[] }
each category in categories
  .Product-category(data-item-id=category.id)
    h2 #{category.name}
    .Product-items
      each product in category.products
        .Product-item(data-item-id=product.id) #{category.name} / #{product.name}
```

#### Code généré

Chaque niveau a sa `ProjectionList`, construite dans le `setup` de l'item parent. Ses
callbacks reçoivent la portée englobante (`$data`, l'item parent) par une cellule que le
`project` du parent renseigne avant `reconcile` : l'item interne lit l'item externe.

```typescript
function $p1($n: ReturnType<typeof $s1>, $data: TData, category$1: $Item<ReturnType<typeof $e0>["s0"]>, index$2: number): void {
  const $v = $e1($data, category$1, index$2);
  if ($n.n1.textContent !== $v.s2) $n.n1.textContent = $v.s2;
  $n.l3.$ = [$data, category$1, index$2];   // portée transmise aux items internes
  $n.l3.list.reconcile($v.s3);              // category.products
}
```

#### Contrainte : Clé à chaque niveau

```pug
//- ✅ Valide — clé à chaque niveau
each category in categories
  .Category(data-item-id=category.id)
    each product in category.products
      .Product(data-item-id=product.id)

//- ❌ PUG:EACH_KEY — clé manquante au niveau 2
each category in categories
  .Category(data-item-id=category.id)
    each product in category.products
      .Product #{product.name}
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
