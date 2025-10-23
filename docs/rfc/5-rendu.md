# RFC-0003 : Rendu Avancé — Compilateur Pug → PDR

> ### TL;DR
> Bonsai utilise la **Projection DOM Réactive (PDR)** : pas de VDOM, pas de diff d'arbre.
> Les templates Pug sont compilés en fonctions TypeScript qui projettent les données sur
> un DOM existant via des mutations chirurgicales O(Δ). Trois niveaux d'alteration :
> **N1** (primitives `text()`, `attr()`, `visible()`), **N2** (templates partiels),
> **N3** (templates complets). `ProjectionList` gère les listes par réconciliation keyée.

| Champ             | Valeur                                      |
|-------------------|---------------------------------------------|
| **RFC**           | 0003                                        |
| **Titre**         | Rendu Avancé — Compilateur Pug → PDR        |
| **Statut**        | 🟢 Stable                                   |
| **Date**          | 2026-03-18                                  |
| **Auteur**        | @architecte                                 |
| **Prérequis**     | [RFC-0001](1-philosophie.md), [RFC-0002 §9.4](6-transversal/conventions-typage.md) |
| **Absorbe**       | [ADR-0008](../adr/ADR-0008-collection-patterns.md) (⚪ Superseded → §6.4–6.8) |
| **Héritage**      | Inspiré d'un compilateur Pug → VDOM protétypé en amont (VDOM → PDR) |

> ### Statut normatif
> Ce document est **stable et normatif** pour les mécanismes de rendu PDR,
> les templates Pug, l'API `ProjectionList`, le Render Contract (§7bis), et les
> collection patterns (§6.4–6.8). Les décisions D39–D48 y documentées font foi.
> Ce document dépend de [RFC-0002](6-transversal/conventions-typage.md) pour les contrats View, Channel et Entity.

---

## 1. Résumé exécutif

Cette RFC définit le **compilateur Pug → PDR** et les mécanismes de rendu avancés :

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
|--------|-------------|-----------|------------|
| **N1 — Mutation d'attributs** | Carrousel, modale `hidden`, badge count, toggle class | `getUI().text()`, `.toggleClass()`, `.attr()` | ❌ Non — overhead inutile |
| **N2 — Mutation par zones** | Liste de produits, formulaire dynamique, onglets | Template sur clés `@ui` spécifiques | ✅ Oui — sur zones ciblées |
| **N3 — Mutation complète** | Page entière change, dashboard reconfigurable | Template sur `root` | ✅ Oui — toute la View |

**Principe** : on ne sur-ingénierie pas. Un carrousel n'a pas besoin d'un template, un `.setAttribute("data-active", false)` suffit.

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
La **View** déclare la réactivité dans `get templates()` via un **selector**
qui filtre les clés de state **namespacées** par Channel.

```pug
//- cart-items.template.pug
//- Template pur — reçoit items[] depuis le selector

ul.Cart-items
  each item in items
    li.Cart-item(data-item-id=item.id)
      span.name #{item.name}
```

```typescript
// La View déclare la réactivité via un selector namespacé
class CartView extends View<TCartViewCapabilities> {
  get params() { return cartViewParams; }  // Capacités déclarées via ADR-0024
  
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

**Fonctionnement** :
1. Le Channel émet `any` automatiquement après chaque Event granulaire
2. Le payload contient uniquement les **clés changées**
3. Le framework **namespace** le payload par le Channel source
4. Le selector filtre les données pertinentes (ex: `data.cart?.items`)
5. Si les données ont changé (shallow equal), le template est re-projeté

**Avantages** :
- ✅ Un seul abonnement par Channel (événement `any`)
- ✅ Le template reste du Pug pur, portable
- ✅ Le selector filtre par clé de state, pas par nom d'Event
- ✅ Ajout d'un nouvel Event → View fonctionne sans modification

> **Note** : Le projet [pugx](../pugx/) explore une extension de Pug avec typage natif,
> mais c'est **hors scope** de Bonsai. Cette RFC assume des templates Pug standard.

---

## 3. Contexte et motivation

### 3.1 Ce qui est défini (RFC-0002 §9.4)

RFC-0002 a établi les fondations de la **Projection DOM Réactive (PDR)** :

| Concept | Statut | RFC-0002 |
|---------|--------|----------|
| Stratégie PDR (D19) | ✅ Défini | §9.4 |
| `getUI()` → `TProjectionNode` | ✅ Défini | §9.4.4 |
| `TProjectionTemplate` type | ✅ Défini | §9.4.5 |
| 3 modes de rendu (A, B, C) | ✅ Défini | §9.4.5 |

### 3.2 Ce qui manque

| Concept | Statut | Besoin |
|---------|--------|--------|
| Compilateur Pug → PDR | ❌ | Comment génère-t-on `setup/project/create` ? |
| `each` → reconcile | ❌ | Comment `each item in items` devient du keyed reconcile ? |
| `ProjectionList` API | ❌ | Interface complète et algorithme |
| Auto-réactivité template | ❌ | Comment le template se branche aux Events ? |

### 3.3 Héritage du prototype Pug → VDOM

Un compilateur Pug → VDOM (Snabbdom) avait été protétypé en amont. L'architecture de pipeline reste pertinente :

```
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
- Le filtrage/tri ne doit PAS muter les données (ADR-0008 anti-pattern)
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
class CartView extends View<TCartViewCapabilities> {
  get params() { return cartViewParams; }  // Capacités déclarées via ADR-0024
  
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

La View déclare un `select` dans `get templates()`. Le framework s'abonne à `any`
et dispatch automatiquement via les selectors.

```typescript
// INTERNE FRAMEWORK — dans attachView() (simplifié, voir §7bis.4 pour la version normative)
for (const channel of view.listen) {
  channel.on('any', ({ event, changes }) => {
    // D46 : state complet par référence live (pas juste les changes)
    const namespacedData = { [channel.namespace]: channel.entity.state };
    
    for (const [uiKey, binding] of Object.entries(view.templates)) {
      if (!binding.select) continue;
      
      const data = binding.select(namespacedData);
      if (data === undefined) continue;
      if (shallowEqual(view._cache[uiKey], data)) continue;
      
      view._cache[uiKey] = data;
      binding.template.project(view.nodes[uiKey], data);
    }
  });
}
```

**Conséquence** : la View n'a **jamais** de handler manuel pour une clé de state dont un template s'occupe.

---

## 5. Architecture du compilateur

> Inspiré du prototype Pug → VDOM interne, adapté à PDR (pas VDOM).

### 5.1 Pipeline de compilation

```
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
|--------|------------------|--------|
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

### 6.1 Interface

```typescript
/**
 * Gestionnaire de liste dynamique avec réconciliation keyed.
 * Utilisé en interne par les templates compilés.
 */
class ProjectionList<TItem, TItemNodes> {
  constructor(
    container: HTMLElement,
    options: TProjectionListOptions<TItem, TItemNodes>
  );
  
  /**
   * Réconcilie la liste avec les nouvelles données.
   * Algorithme O(n) avec map de clés.
   */
  reconcile(
    items: TItem[],
    handlers: TReconcileHandlers<TItem, TItemNodes>
  ): void;
  
  /**
   * Retourne les nœuds d'un item par sa clé.
   */
  getItemNodes(key: string): TItemNodes | undefined;
  
  /**
   * Détruit proprement (cleanup listeners, références)
   */
  dispose(): void;
}

type TProjectionListOptions<TItem, TItemNodes> = {
  // Attribut contenant la clé (ex: 'data-item-id')
  keyAttr: string;
  
  // Setup des nœuds internes d'un item
  itemSetup: (el: HTMLElement) => TItemNodes;
  
  // Factory pour créer un nouvel élément (mode SPA)
  itemCreate?: (item: TItem) => HTMLElement;
}

type TReconcileHandlers<TItem, TItemNodes> = {
  // Fonction de clé — extrait l'identifiant unique d'un item
  key: (item: TItem) => string;
  
  /**
   * Met à jour les nœuds DOM d'un item existant avec les nouvelles données.
   *
   * **Contrat normatif** :
   * - Appelé pour **chaque** item présent dans la liste, qu'il ait changé ou non.
   * - L'implémentation **DOIT** inclure des guards per-nœud pour éviter les
   *   mutations DOM inutiles (ex: `if (node.textContent !== val)`).
   * - Les guards sont la responsabilité du **code généré par le compilateur**,
   *   pas du développeur (le dev écrit du Pug, le compilateur émet les guards).
   * - Ne doit **jamais** créer/supprimer des nœuds DOM — seulement muter
   *   le contenu (textContent, attributs, classes) des nœuds existants.
   *
   * @param nodes  — Les références DOM de l'item (retournées par `itemSetup`)
   * @param item   — Les nouvelles données de l'item
   * @param index  — L'index de l'item dans la liste (0-based)
   *
   * @example
   * ```typescript
   * update: (nodes, item, index) => {
   *   // Guard per-nœud : ne mute que si la valeur a changé
   *   if (nodes.name.textContent !== item.name)
   *     nodes.name.textContent = item.name;
   *   if (nodes.price.textContent !== formatPrice(item.price))
   *     nodes.price.textContent = formatPrice(item.price);
   * }
   * ```
   */
  update: (nodes: TItemNodes, item: TItem, index: number) => void;
  
  // Callbacks optionnels (lifecycle de réconciliation)
  onInsert?: (el: HTMLElement, item: TItem, index: number) => void;
  onRemove?: (el: HTMLElement, item: TItem) => void | Promise<void>;
  onMove?: (el: HTMLElement, item: TItem, fromIndex: number, toIndex: number) => void;
}
```

### 6.2 Algorithme de réconciliation

```typescript
reconcile(items: TItem[], handlers: TReconcileHandlers<TItem, TItemNodes>): void {
  const { key, update, onInsert, onRemove, onMove } = handlers;
  
  // 1. Construire la map des éléments existants par clé
  const existing = new Map<string, { el: HTMLElement; nodes: TItemNodes; index: number }>();
  let idx = 0;
  for (const child of this.container.children) {
    const k = (child as HTMLElement).dataset[this.keyAttrName];
    if (k && this.itemNodesMap.has(k)) {
      existing.set(k, { el: child as HTMLElement, nodes: this.itemNodesMap.get(k)!, index: idx });
    }
    idx++;
  }
  
  // 2. Traiter les nouveaux items dans l'ordre
  let prevEl: HTMLElement | null = null;
  const seen = new Set<string>();
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const k = key(item);
    seen.add(k);
    
    const entry = existing.get(k);
    
    if (entry) {
      // Item existant — mettre à jour
      update(entry.nodes, item, i);
      
      // Déplacer si nécessaire
      const expectedNext = prevEl ? prevEl.nextElementSibling : this.container.firstElementChild;
      if (entry.el !== expectedNext) {
        this.container.insertBefore(entry.el, expectedNext);
        onMove?.(entry.el, item, entry.index, i);
      }
      
      prevEl = entry.el;
    } else {
      // Nouvel item — créer et insérer
      const newEl = this.options.itemCreate!(item);
      newEl.dataset[this.keyAttrName] = k;
      
      const nodes = this.options.itemSetup(newEl);
      this.itemNodesMap.set(k, nodes);
      
      const insertBefore = prevEl ? prevEl.nextSibling : this.container.firstChild;
      this.container.insertBefore(newEl, insertBefore);
      
      update(nodes, item, i);
      onInsert?.(newEl, item, i);
      
      prevEl = newEl;
    }
  }
  
  // 3. Supprimer les éléments qui n'existent plus
  for (const [k, entry] of existing) {
    if (!seen.has(k)) {
      onRemove?.(entry.el, /* item */);
      entry.el.remove();
      this.itemNodesMap.delete(k);
    }
  }
}
```

### 6.3 Complexité

| Opération | Complexité |
|-----------|------------|
| Réconciliation complète | O(n) |
| Insertion d'un item | O(1) amortie |
| Suppression d'un item | O(1) |
| Mise à jour d'un item | O(1) |
| Déplacement d'un item | O(1) |

### 6.4 Collection patterns — ProjectionList + Event Delegation

> **Contrat normatif** — Absorbe [ADR-0008 (Collection Patterns)](../adr/ADR-0008-collection-patterns.md).
> Ce document fait désormais foi pour les patterns de listes.

**Décision D45 (COLLECTION-PATTERN)** : Le pattern canonique pour les listes dans Bonsai
est **ProjectionList + Event Delegation** (Option D de l'ADR-0008).

Justification :
1. **Simple** — un seul pattern à apprendre (pas de `ViewFragment`, pas de `CollectionComposer`)
2. **Performant** — keyed reconcile O(n) + un seul listener par type d'événement
3. **Scalable** — 1000+ items sans dégradation (un listener ≠ mille listeners)
4. **Standard** — event delegation = pattern DOM natif, pas d'abstraction Bonsai spécifique

#### Pattern : Event delegation sur le conteneur

La View gère les interactions utilisateur sur les items **via delegation sur le conteneur**,
jamais via des listeners individuels sur chaque élément.

```typescript
// ── TUIMap : contrat structurel de la CartView ──
// Chaque clé = un nœud d'interaction, le framework auto-dérive les handlers (D48)
type TCartViewUI = TUIMap<{
  items:              { el: HTMLUListElement;   event: [] };              // Conteneur liste
  removeButton:       { el: HTMLButtonElement;  event: ['click'] };       // → onRemoveButtonClick
  increaseQtyButton:  { el: HTMLButtonElement;  event: ['click'] };       // → onIncreaseQtyButtonClick
  decreaseQtyButton:  { el: HTMLButtonElement;  event: ['click'] };       // → onDecreaseQtyButtonClick
  qtyInput:           { el: HTMLInputElement;   event: ['input'] };       // → onQtyInputInput
}>;

class CartView extends View<TCartViewCapabilities> {
  get params() { return cartViewParams; }

  // ══════════════════════════════════════════════════════════════════
  // PAS DE get uiEvents() — D48 (AUTO-UI-EVENT-DISCOVERY)
  //
  // Le framework introspecte TUIMap et découvre les handlers par convention :
  //   clé 'increaseQtyButton' + event 'click'
  //   → cherche méthode on${Capitalize<key>}${Capitalize<event>}
  //   → onIncreaseQtyButtonClick
  //
  // La délégation est automatique : le framework attache UN listener 'click'
  // sur this.el et dispatche via closest() vers le bon @ui.
  // ══════════════════════════════════════════════════════════════════

  get templates() {
    return {
      items: {
        template: CartItemsTemplate,
        select: (data) => data.cart?.items,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Handlers auto-dérivés depuis TUIMap (D48)
  // Noms conventionnels : on${Capitalize<key>}${Capitalize<event>}
  // Le framework vérifie leur existence au bootstrap
  // ────────────────────────────────────────────────────────────────────

  // removeButton + click → onRemoveButtonClick
  onRemoveButtonClick(event: MouseEvent & { currentTarget: HTMLButtonElement }): void {
    const itemId = this.getItemData(event, '[data-item-id]', 'data-item-id');
    if (itemId) {
      this.trigger(Cart.channel, 'removeItem', { itemId });
    }
  }

  // decreaseQtyButton + click → onDecreaseQtyButtonClick
  onDecreaseQtyButtonClick(event: MouseEvent & { currentTarget: HTMLButtonElement }): void {
    const itemId = this.getItemData(event, '[data-item-id]', 'data-item-id');
    if (itemId) {
      this.trigger(Cart.channel, 'decreaseQty', { itemId });
    }
  }

  // increaseQtyButton + click → onIncreaseQtyButtonClick
  onIncreaseQtyButtonClick(event: MouseEvent & { currentTarget: HTMLButtonElement }): void {
    const itemId = this.getItemData(event, '[data-item-id]', 'data-item-id');
    if (itemId) {
      this.trigger(Cart.channel, 'increaseQty', { itemId });
    }
  }

  // qtyInput + input → onQtyInputInput
  onQtyInputInput(event: InputEvent & { currentTarget: HTMLInputElement }): void {
    const itemId = this.getItemData(event, '[data-item-id]', 'data-item-id');
    if (itemId) {
      this.trigger(Cart.channel, 'setQty', { itemId, qty: Number(event.currentTarget.value) });
    }
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
        input.CartItem-qtyInput(type="number" value=item.quantity)
        button.CartItem-increaseQty +
        button.CartItem-remove ×
```

#### ✅ / ❌ — Auto-discovery D48 vs listeners individuels

```typescript
// ❌ INTERDIT — un listener par item (n'existe pas dans Bonsai)
items.forEach(item => {
  item.el.addEventListener('click', () => this.onRemove(item.id));
});

// ❌ OBSOLÈTE — get uiEvents() manuel (avant D48)
get uiEvents() {
  return {
    'click @ui.removeButton': 'onRemoveButtonClick',
  } as const;
}
// Problème : mapping manuel redondant avec TUIMap, source de désynchronisation.

// ✅ CORRECT — D48 : TUIMap déclare tout, le framework câble automatiquement
type TCartViewUI = TUIMap<{
  removeButton: { el: HTMLButtonElement; event: ['click'] };
  //                                             ^^^^^^^^^
  // Le framework dérive : onRemoveButtonClick(event: MouseEvent)
  // et attache via délégation sur this.el + closest(@ui.removeButton)
}>;
```

### 6.5 Anti-pattern : muter les données pour filtrer/trier

> **Décision D47 (NO-DERIVED-STATE)** — [ADR-0017](../adr/ADR-0017-rendering-strategy-vdom-vs-pdr.md)
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
onFilterByPopularity(payload) {
  this.entity.mutate('products:filterByPopularity', (draft) => {
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
|---|--------|
| 1 | **Explosion des patches** — 300 patches pour une opération logique |
| 2 | **Sémantique incorrecte** — les données n'ont pas changé, seule la *présentation* change |
| 3 | **Performance** — re-render complet de la liste |
| 4 | **Event Sourcing** — stocker « tri changé » ≠ stocker 300 déplacements |

```typescript
// ✅ BON — Muter les CRITÈRES, pas les données
type TProductsState = {
  items: Product[];              // Données brutes (rarement mutées)
  sortCriteria: TSortCriteria;   // Critère actif (muté fréquemment)
  filters: TFilterCriteria;      // Filtres actifs
};

onFilterByPopularity(payload) {
  this.entity.mutate('products:setSortCriteria', (draft) => {
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
|------|-------------------|-----------------|---------|
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
// Params déclarés selon ADR-0024 (listen: [Dashboard.channel], uiElements: {...}, ...)
class DashboardView extends View<TDashboardViewCapabilities> {
  get params() { return dashboardViewParams; }

  get templates() {
    return {
      widgets: {
        template: WidgetSlotsTemplate,
        select: (data) => data.dashboard?.widgets,
      },
    };
  }

  /**
   * Composers dynamiques — chaque slot contient une child View complète
   * avec son propre lifecycle, Behaviors, Channels.
   */
  get composers() {
    return {
      '[data-widget-slot]': WidgetComposer,
    };
  }
}

class WidgetComposer extends Composer {
  resolve(): TResolveResult | null {
    const widgetType = (this.slot as HTMLElement).dataset.widgetType;
    const ViewClass = this.resolveViewForType(widgetType);
    return ViewClass ? { view: ViewClass, rootElement: this.slot } : null;
  }

  private resolveViewForType(type: string | null): typeof View | null {
    switch (type) {
      case 'chart':  return ChartWidgetView;
      case 'table':  return TableWidgetView;
      case 'kpi':    return KpiWidgetView;
      default:       return null;
    }
  }
}
```

> **Attention** : Ce pattern a un **overhead** significatif (1 Composer + 1 View + 1 Entity
> par item). Il est réservé aux cas où l'item a une complexité intrinsèque justifiant
> un composant autonome. Pour les listes simples (90% des cas), utiliser
> ProjectionList + Event Delegation (§6.4).

| Pattern | Cas d'usage | Overhead |
|---------|-------------|----------|
| ProjectionList + Event Delegation (§6.4) | Listes simples, items template-only | Faible (1 listener par type) |
| Slots × Composers (§6.7) | Items complexes avec lifecycle propre | Élevé (n Composers + n Views) |

### 6.8 Helper `getItemData()`

La classe `View` expose un helper pour extraire les données d'un item depuis un événement
DOM délégué. Ce helper simplifie le pattern d'extraction via `closest()`.

```typescript
class View {
  /**
   * Extrait la valeur d'un attribut data depuis l'ancêtre le plus proche
   * correspondant au sélecteur. Utilisé avec l'event delegation pour
   * identifier l'item source d'un événement.
   *
   * @param event - L'événement DOM délégué
   * @param selector - Sélecteur CSS de l'élément portant la donnée
   * @param attribute - Nom de l'attribut data (défaut: 'data-item-id')
   * @returns La valeur de l'attribut ou null si non trouvé
   */
  protected getItemData<TValue = string>(
    event: Event,
    selector: string,
    attribute: string = 'data-item-id',
  ): TValue | null {
    const el = (event.target as Element).closest(selector);
    const value = el?.getAttribute(attribute);
    return (value as TValue) ?? null;
  }
}
```

**Usage idiomatique :**

```typescript
// Convention Bonsai : data-item-id sur chaque élément de liste
onRemoveClick(event: Event): void {
  const itemId = this.getItemData(event, '[data-item-id]', 'data-item-id');
  if (itemId) {
    this.trigger(Cart.channel, 'removeItem', { itemId });
  }
}

// Avec un attribut custom
onCellClick(event: Event): void {
  const rowId = this.getItemData(event, '[data-row-id]', 'data-row-id');
  const colId = this.getItemData(event, '[data-col-id]', 'data-col-id');
  if (rowId && colId) {
    this.trigger(Table.channel, 'cellSelected', { rowId, colId });
  }
}
```

---

## 7. Intégration avec la View

> **Décision D42 (VIEW-SUBSCRIPTION)** : Les Views s'abonnent aux Channels via l'événement `any`
> (auto-émis par le Channel après chaque Event). Les Events granulaires sont destinés
> à la communication inter-Feature. Les selectors des templates filtrent les clés
> de state pertinentes dans le payload **namespacé**.

### 7.1 Principe : Abonnement `any` + State complet par référence

> **Décision D46 (FULL-STATE-SELECTOR)** — [ADR-0017](../adr/ADR-0017-rendering-strategy-vdom-vs-pdr.md)
>
> Le selector de la View reçoit le **state complet** de chaque Channel écouté,
> pas seulement les clés changées par le dernier Event. Le framework passe une
> **référence live** vers le state frozen (Immer) de l'Entity — zéro copie,
> zéro coût. Le payload `any` continue d'exister en interne pour l'optimisation
> (`shallowEqual` sur la **sortie** du selector, pas sur l'input).

La View déclare les Channels qu'elle écoute. Le framework s'abonne **une seule fois**
à l'événement `any` de chaque Channel.

**Contrat `NamespacedData`** :
- Contient le **state complet** de chaque Channel écouté, par référence (frozen)
- Est **namespacé** par le Channel source (ex: `data.cart`, `data.promo`)
- Inclut le namespace réservé `local` pour le localState (I57, ADR-0015)

```typescript
// Quand CartFeature mute { items, total }, le Channel émet 'any'.
// Le framework construit NamespacedData avec le STATE COMPLET :

// data = {
//   cart: { items: [...], total: 42, sortCriteria: {...}, filters: {...} }
//         └────────────── state complet de l'Entity Cart (ref live) ──────────────┘
// }

// Le selector peut accéder à TOUT le state :
select: (data) => {
  const catalog = data.catalog; // State complet de l'Entity Catalog
  if (!catalog) return undefined;
  // Calcul dérivé : filtre + tri sur données brutes + critères
  return deriveVisibleProducts(catalog);
}
```

### 7.2 Exemple complet avec namespace

```typescript
// Params déclarés selon ADR-0024
// listen: [Cart.channel, Promo.channel] → deux namespaces
// uiElements: { items, summary, header } déclarés dans orderSummaryViewParams
class OrderSummaryView extends View<TOrderSummaryViewCapabilities> {
  get params() { return orderSummaryViewParams; }
  
  get templates() {
    return {
      // ══════════════════════════════════════════════════════════════
      // SELECTOR avec namespace — accède à cart.items
      // ══════════════════════════════════════════════════════════════
      items: {
        template: CartItemsTemplate,
        select: (data) => data.cart?.items,  // Namespace 'cart'
      },
      
      // ══════════════════════════════════════════════════════════════
      // SELECTOR multi-namespace — combine cart + promo
      // Le framework skip automatiquement si toutes les valeurs sont undefined
      // ══════════════════════════════════════════════════════════════
      summary: {
        template: OrderSummaryTemplate,
        select: (data) => ({
          total: data.cart?.total,
          discount: data.promo?.discount,
        }),
        // Pas besoin de guard — le framework gère :
        // { total: undefined, discount: undefined } → skip automatique
      },
      
      // ══════════════════════════════════════════════════════════════
      // TEMPLATE STATIQUE — Pas de réactivité auto
      // ══════════════════════════════════════════════════════════════
      header: {
        template: OrderHeaderTemplate,
        // Pas de select → projection initiale seulement
      },
    };
  }
  // uiElements déclarés dans orderSummaryViewParams (ADR-0024)
}
```

### 7.3 Template Pug avec données namespacées

Le template reçoit les données déjà extraites par le selector.
Les variables dans le template correspondent au retour du selector :

```pug
//- order-summary.template.pug
//- Reçoit { total, discount } depuis le selector

.Order-summary
  .total Total: #{total} €
  if discount
    .discount Réduction: -#{discount} €
    .final Final: #{total - discount} €
```

```pug
//- cart-items.template.pug
//- Reçoit items[] depuis le selector (data.cart.items)

ul.Cart-items
  each item in items
    li.Cart-item(data-item-id=item.id)
      span.name #{item.name}
      span.qty ×#{item.qty}
```

### 7.4 Types TypeScript

```typescript
// Payload de l'événement 'any' (interne framework — pas exposé au développeur)
type TChannelAnyPayload = {
  event: string;                  // Nom de l'Event granulaire
  changes: TJsonSerializable;     // Clés changées (pour optimisation interne)
}

// Données reçues par le selector (après namespace par le framework)
// D46 (FULL-STATE-SELECTOR) : le state est COMPLET, pas juste les changes.
// Le framework passe une référence live vers le state frozen de l'Entity.
// Inclut le namespace réservé 'local' pour le localState (I57, ADR-0015)
type NamespacedData<TChannels extends Channel[], TLocal = never> = 
  & { [C in TChannels[number] as C['namespace']]?: C['state'] }
  & ([TLocal] extends [never] ? {} : { local?: Partial<TLocal> });

// Note : le namespace 'local' est réservé par le framework (I57).
// Aucun Channel développeur ne peut utiliser 'local' comme namespace.
// Le framework injecte { local: changedKeys } après chaque updateLocal().

// Template binding
type TTemplateBindingStatic = {
  template: TProjectionTemplate<any, any>;
}

type TTemplateBindingReactive<TData> = TTemplateBindingStatic & {
  /**
   * Extrait les données du payload namespacé.
   * @param data - Payload namespacé par Channel + localState
   *               (ex: { cart: {...}, promo: {...}, local: {...} })
   * @returns Données pour le template, ou undefined pour skip
   */
  select: (data: NamespacedData<any, any>) => TData | undefined;
}

type TViewTemplateBinding<TData = unknown> = {
  template: TProjectionTemplate<any, TData>;
  select?: (data: NamespacedData<any, any>) => TData | undefined;
}

type TViewTemplates<TUI extends TUIMap<any>> =
  | null
  | { root: TViewTemplateBinding }
  | { [K in keyof TUI & string]?: TViewTemplateBinding };
```

### 7.5 Auto-branchement par le framework

> **Implémentation normative** : voir **§7bis.4** pour le code complet de `attachView()`
> intégrant D46 (FULL-STATE-SELECTOR), les 4 couches de protection (L1–L4),
> et les helpers `isAllUndefined()` / `shallowEqual()`.

**Résumé du mécanisme** :
1. Le framework appelle `template.setup(container)` pour localiser les nœuds dynamiques
2. Un **seul** abonnement `any` par Channel (pas un listener par Event)
3. Le framework namespace le state complet par Channel (D46 : référence live, zéro copie)
4. Chaque selector filtre les données pertinentes → `shallowEqual` → `project()` si changé

> **Note** : Le développeur écrit simplement `select: (data) => ({ total: data.cart?.total })`.
> Le framework gère automatiquement le skip quand toutes les valeurs sont `undefined`.

> **localState et selectors** (I57, ADR-0015) : Le même pipeline de selectors est utilisé pour le
> localState. Après un `updateLocal()`, le framework injecte `{ local: changedPartial }` dans le
> `namespacedData` et dispatch aux templates via leurs selectors. Le développeur écrit
> `select: (data) => data.local?.currentStep` — même syntaxe que pour les Channels.
> Les callbacks N1 (`onLocal{Key}Updated`) sont gérés séparément (voir ADR-0015).

### 7.6 Séparation des audiences

| Audience | Écoute | Payload | Cas d'usage |
|----------|--------|---------|-------------|
| **Features** | Events granulaires (`item-added`) | Payload métier | Réactions inter-Feature |
| **Views** | Event `any` (auto-émis) | `{ changes }` namespacé | Réactivité UI |

```
Feature.emit('item-added', payload)
        │
        ▼
    Channel
        ├─► emit('item-added', payload)      → Autres Features
        │
        └─► emit('any', { event, changes })  → Views (selector filtre)
```

> **Avantage clé** : Si la Feature ajoute un nouvel Event (`item-quantity-changed`),
> la View **fonctionne toujours** sans modification — le selector filtre sur les clés,
> pas sur les noms d'Events.

### 7.7 Résumé des responsabilités

| Qui | Responsabilité |
|-----|----------------|
| **Channel** | Émet automatiquement `any` après chaque Event granulaire |
| **View** | Déclare `listen` (Channels) et `templates` avec selectors |
| **Selector** | Extrait / dérive les données pertinentes depuis le state complet (D46) |
| **Framework** | Namespace le state, appelle les selectors, skip si unchanged |
| **Template** | Projette les données reçues sur le DOM via `project()` |
| **Guards per-nœud** | Évitent les mutations DOM inutiles (compilés dans `update()`) |

---

## 7bis. Render Contract complet — How Rendering Works

> **Section normative** — Source de vérité pour le cycle de rendu PDR de bout en bout.
> Décisions associées : D19 (PDR), D42 (VIEW-SUBSCRIPTION), D46 (FULL-STATE-SELECTOR),
> D47 (NO-DERIVED-STATE), [ADR-0017](../adr/ADR-0017-rendering-strategy-vdom-vs-pdr.md).

Bonsai utilise la **Projection DOM Réactive (PDR)** : mutations chirurgicales sur le DOM
existant, sans arbre virtuel intermédiaire (pas de VDOM). Cette section décrit le cycle
complet, du changement de données à la mutation DOM finale.

### 7bis.1 Pipeline de rendu : 6 étapes

```
┌────────────────── Pipeline de rendu PDR ───────────────────┐
│                                                          │
│  1. MUTATION     entity.mutate() modifie le state         │
│       │                                                   │
│       ▼                                                   │
│  2. EMISSION     Channel.emit(event, payload)             │
│       │          Channel.emit('any', { event, changes })  │
│       ▼                                                   │
│  3. NAMESPACE    Framework construit NamespacedData :      │
│       │          { [channel.namespace]: entity.state }    │
│       │          (D46 : state complet par réf live)       │
│       ▼                                                   │
│  4. SELECTOR     Pour chaque template avec select() :     │
│       │          data = binding.select(namespacedData)     │
│       │          └─ undefined → SKIP (pas concerné)        │
│       │          └─ shallowEqual(cache, data) → SKIP       │
│       ▼          └─ différent → continuer               │
│  5. PROJECT      template.project(nodes, data)             │
│       │          ├─ scalaires : guards per-nœud            │
│       │          └─ listes : ProjectionList.reconcile()    │
│       ▼                                                   │
│  6. DOM          Seuls les nœuds CHANGÉS sont mutés        │
│                  (textContent, setAttribute, insertBefore, │
│                   removeChild)                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 7bis.2 Les 4 couches de protection contre les mutations inutiles

Bonsai élimine les mutations DOM inutiles à **4 niveaux** successifs. Chaque couche
agit comme un filtre — seules les mutations réellement nécessaires atteignent le DOM.

| Couche | Nom | Où | Ce qu'elle filtre | Exemple |
|--------|-----|-----|-------------------|----------|
| **L1** | **Selector** | `select()` dans `get templates()` | Rejette les Events non pertinents pour ce template | `data.catalog?.items` retourne `undefined` quand seul `promo` a changé → skip |
| **L2** | **shallowEqual** | Framework, après le selector | Rejette les projections quand les données n'ont pas changé | Premier `any` après SSR : données identiques → skip complet (ADR-0014 H4) |
| **L3** | **Guards per-nœud** | `update()` dans `project()` (compilé) | Rejette les mutations de contenu quand la valeur est identique | `if (node.textContent !== item.name)` — évite le re-layout navigateur |
| **L4** | **Keyed reconcile** | `ProjectionList.reconcile()` | Ne déplace/crée/supprime que les items nécessaires | Tri : seuls les items mal positionnés reçoivent un `insertBefore` |

> **Analogie avec un VDOM** : L1+L2+L3 remplacent le diff d'arbre. L4 remplace le keyed
> reconciliation. Le résultat (mutations DOM finales) est strictement identique. La différence :
> PDR ne construit pas d'arbres virtuels intermédiaires.

### 7bis.3 Schéma SSR → Hydratation → Projection

> Référence normative : [ADR-0014](../adr/ADR-0014-ssr-hydration-strategy.md) H1–H5.

#### Règles d'hydratation (H1–H5)

| Règle | Nom | Énoncé |
|-------|-----|--------|
| **H1** | Détection par nœud | Pour chaque `rootElement` : `querySelector()` dans le scope → **trouvé** = mode SSR (`setup()`), **absent** = le framework **parse le sélecteur CSS** et crée l'élément (SPA, D30 révisé, ADR-0026). Si le sélecteur n'est pas parseable (combinateurs, pseudo-classes) → ERREUR. La détection est **par nœud**, pas globale. |
| **H2** | `setup()` = hydratation | `setup()` localise les nœuds dynamiques dans un DOM existant. Il n'y a **pas** de procédure d'hydratation séparée — `setup()` EST l'hydratation. Pas de branche `if (SSR)` dans le code applicatif. |
| **H3** | ProjectionList par `keyAttr` | `ProjectionList.setup()` indexe les items existants par `keyAttr` (`data-item-id` / `data-key`). Les items sont adoptés, jamais recréés. Résultat : `Map<key, { el, nodes }>` — zéro création DOM. |
| **H4** | Premier `any` = no-op | Après `onAttach()`, le premier `any` passe dans le pipeline L1→L2. Le selector retourne des données identiques au DOM servi → `shallowEqual` → **SKIP**. Zéro mutation DOM après bootstrap. |
| **H5** | `serverState` unique | `TBootstrapOptions.serverState` est le **seul** mécanisme d'état sérialisé du framework. Le framework ne lit **jamais** le DOM pour extraire du state (esprit I39). Le développeur contrôle l'injection (JSON inline, fetch, localStorage, etc.). |

```
T0 ─── SSR ──────────────────────────────────────────────────────────────
       Serveur rend le HTML complet (structure + contenu)
       DOM = source de vérité structurelle (D19)

T1 ─── Bootstrap (setup) ───────────────────────────────────────────────
       querySelector(rootElement) → TROUVÉ → mode SSR (H1)
       template.setup(container) → localise nœuds dynamiques (H2)
       ProjectionList.setup() → indexe items existants par keyAttr (H3)
       Résultat : Map<key, { el, nodes }> — zéro création DOM

T2 ─── Premier any ──────────────────────────────────────────────────────
       Feature.onAttach() → request / Entity peuplée → emit('any')
       Selector → données identiques au DOM → shallowEqual → SKIP (H4)
       ✅ Zéro mutation DOM après bootstrap

T3 ─── Interaction utilisateur (ex: tri) ────────────────────────────────
       View.trigger(command) → Feature.mutate(critères) → emit('any')
       Selector → deriveVisibleProducts(fullState) → liste réordonnée
       shallowEqual → différent → project()
       ProjectionList.reconcile(items) → déplacements + guards
       ✅ Seuls les nœuds nécessaires sont déplacés/mutés
```

### 7bis.4 Implémentation framework : `attachView()` avec D46

```typescript
// INTERNE FRAMEWORK — dans attachView()
// Mise à jour normative intégrant D46 (FULL-STATE-SELECTOR)

function attachView(view: View): void {
  // ... résolution rootElement, uiElements, delegation ...

  const templates = view.templates;

  // Setup des nodes selon le mode de rendu (H1, H2)
  if (templates === null) {
    view.nodes = {};
  } else if ('root' in templates) {
    view.nodes = {
      root: templates.root.template.setup(view.el),
    };
  } else {
    for (const [uiKey, binding] of Object.entries(templates)) {
      if (!binding) continue;
      const container = view._resolveUIElement(uiKey);
      view.nodes[uiKey] = binding.template.setup(container);
    }
  }
  
  // UN SEUL abonnement par Channel — événement 'any'
  for (const channel of view.listen) {
    channel.on('any', ({ event, changes }) => {
      
      // D46 : Namespace le STATE COMPLET (réf live, pas copie)
      const namespacedData = {
        [channel.namespace]: channel.entity.state   // Ref frozen (Immer)
      };
      
      // Dispatch à chaque template via son selector
      if (templates === null || 'root' in templates) return;

      for (const [uiKey, binding] of Object.entries(templates)) {
        if (!binding) continue;
        if (!('select' in binding)) continue;
        
        // L1 — Selector : extrait / dérive les données pertinentes
        const data = binding.select(namespacedData);
        if (data === undefined) continue;               // L1 skip
        if (isAllUndefined(data)) continue;              // L1 skip multi-ns
        
        // L2 — shallowEqual : skip si données identiques
        if (shallowEqual(view._dataCache[uiKey], data)) continue;
        
        // Mise à jour du cache + projection
        view._dataCache[uiKey] = data;
        binding.template.project(view.nodes[uiKey], data);
        // L3 (guards) et L4 (reconcile) opèrent à l'intérieur de project()
      }
    });
  }
}
```

### 7bis.5 Règles normatives du Render Contract

| # | Règle | Source |
|---|-------|--------|
| **R1** | PDR est la stratégie de rendu **unique** de Bonsai. Pas de VDOM. | ADR-0017, D19 |
| **R2** | Le selector reçoit le **state complet** de chaque Channel par référence live (frozen). | D46 |
| **R3** | Les données dérivées (filtre, tri) sont calculées dans le selector, **jamais** stockées dans l'Entity. | D47 |
| **R4** | `shallowEqual` compare la **sortie** du selector (pas l'input). Si identique, la projection est skippée. | §7bis.4 |
| **R5** | `update()` dans `project()` **DOIT** inclure des guards per-nœud (`if (val !== newVal)`). | §6.1 |
| **R6** | `ProjectionList.reconcile()` est l'unique mécanisme de réconciliation keyed. | D45, ADR-0017 |
| **R7** | `setup()` est l'hydratation SSR. `create()` est le fallback SPA. Même API. | ADR-0014 H2 |
| **R8** | Pas de pool de recyclage pour les items supprimés. `itemCreate()` est le seul mécanisme de création. | ADR-0017 Q2-A |

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
// La View déclare les mêmes clés dans ses params (ADR-0024)
const cartViewParams = {
  // ...listen, trigger, request, behaviors, options...
  uiElements: {
    items: '@ui',   // Résolu via @ui="items" dans le template
    total: '@ui',   // Résolu via @ui="total" dans le template
  },
} as const satisfies TViewParams<TCartViewUI>;

class CartView extends View<TCartViewCapabilities> {
  get params() { return cartViewParams; }
}
```

> **Note** : La valeur `'@ui'` est une **valeur sentinelle** (pas un sélecteur CSS).
> Elle indique au framework de résoudre l'élément via l'attribut `@ui` correspondant
> dans le template Pug, plutôt que via `querySelector()`. Les `uiElements` dont la valeur
> est un sélecteur CSS classique (ex: `'.Cart-total'`) restent valides pour les Views
> sans template (Mode A, N1).
```

**Erreurs de compilation** :

| Cas | Message |
|-----|---------|
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
|--------|---------|
| `each` sans clé | `Error: List directive requires a key. Add 'key=expr' or use 'data-item-id' / 'data-key' attribute.` |
| @ui non résolu | `Error: @ui 'foo' referenced but not found in uiElements declaration.` |
| Syntaxe invalide | `Error: Invalid Pug syntax at line X.` |

### 10.2 Erreurs runtime

| Erreur | Cause | Message |
|--------|-------|---------|
| Clé dupliquée | Deux items avec la même clé | `Warning: Duplicate key 'X' in list. Reconciliation may be incorrect.` |
| Élément manquant | DOM modifié hors framework | `Error: Expected element with key 'X' not found.` |

---

## 11. Décisions architecturales

### D45 : Collection patterns — ProjectionList + Event Delegation

**Décision** : Le pattern canonique pour les listes est `ProjectionList` + event delegation
(§6.4). Les child Views via Slots × Composers (§6.7) sont réservées aux cas complexes
(composants autonomes avec lifecycle propre). Absorbe [ADR-0008](../adr/ADR-0008-collection-patterns.md).

| Pattern | Cas d'usage | Overhead |
|---------|-------------|----------|
| ProjectionList + Delegation | 90% — listes simples, items template-only | Faible |
| Slots × Composers | 10% — items complexes (dashboard widgets) | Élevé |

**Anti-patterns associés** (§6.5) :
- ❌ Muter les données brutes pour filtrer/trier
- ❌ Un listener par item au lieu de delegation
- ❌ `CollectionComposer` (D24 interdit)

### D39 : Animations de liste — Callbacks + CSS

**Décision** : Les animations sont gérées via les callbacks `onInsert`, `onRemove`, `onMove`
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
            el.classList.add('is-entering');
            void el.offsetHeight;  // Force reflow
            el.classList.add('is-entered');
          },
          onRemove: (el) => new Promise((resolve) => {
            el.classList.add('is-leaving');
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
.Cart-item.is-entering { opacity: 0; transform: translateX(-20px); }
.Cart-item.is-entered  { opacity: 1; transform: translateX(0); }
.Cart-item.is-leaving  { opacity: 0; transform: translateX(20px); }
```

#### Clarification : `el` = l'item individuel

```
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

### D40 : Listes virtualisées — API séparée

**Décision** : `VirtualizedList` est une API séparée de `ProjectionList`.

Voir [ADR-0012 — Listes Virtualisées](../adr/ADR-0012-virtualized-list.md) pour les détails.

| Classe | Cas d'usage | Complexité |
|--------|-------------|------------|
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

### D41 : Nested `each` — Support natif

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

- [RFC-0002 §9.4 — PDR](6-transversal/conventions-typage.md) — Contrat de base
- [pugx](../pugx/) — Projet séparé d'extension de Pug avec typage (hors scope)
- [React Reconciliation](https://reactjs.org/docs/reconciliation.html)
- [Vue v-for with key](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key)
- [Lit repeat directive](https://lit.dev/docs/templates/lists/)
- [Pug Language Reference](https://pugjs.org/language/iteration.html)
- [Event Delegation](https://javascript.info/event-delegation) — pattern DOM utilisé par §6.4

---

## 13. Historique

| Date | Changement |
|------|------------|
| 2026-03-18 | Création (Draft) |
| 2026-03-19 | **D42 (VIEW-SUBSCRIPTION)** : Views s'abonnent à `any` + selectors namespacés (§7 réécrit) |
| 2026-03-19 | **D39** : Animations via Callbacks + CSS (§11) |
| 2026-03-19 | **D40** : `VirtualizedList` API séparée → ADR-0012 |
| 2026-03-19 | **D41** : Nested `each` supporté nativement |
| 2026-03-19 | `@ui` devient obligatoire (§8.2) |
| 2026-03-19 | Syntaxe `key=` retirée — clé inférée via attributs Pug standard (§8.1) |
| 2026-03-26 | **D45 (COLLECTION-PATTERN)** : Absorption ADR-0008 — §6.4–6.8 collection patterns, event delegation, anti-patterns |
| 2026-03-26 | **D46 (FULL-STATE-SELECTOR)** : `NamespacedData` passe le state complet par ref live (ADR-0017 Q1-B) — §7.1, §7.4 réécrits |
| 2026-03-26 | **D47 (NO-DERIVED-STATE)** : Données dérivées interdites dans l'Entity (ADR-0017) — §6.5–6.6 renforcés |
| 2026-03-26 | **§7bis Render Contract complet** : pipeline PDR normatif, 4 couches de protection, schéma SSR (ADR-0017) |
| 2026-03-26 | **§6.1 update()** : signature formalisée avec JSDoc normative, guards per-nœud documentés |
| 2026-03-26 | **D48 (AUTO-UI-EVENT-DISCOVERY)** : suppression de `get uiEvents()` — le framework auto-dérive les handlers depuis `TUIMap` (clé+event → `on${Key}${Event}`) — §6.4 réécrit |
| 2026-04-01 | **Stabilisation 🟡 → 🟢** : correction §4.4 pré-D46, §6.7 `resolve()` aligné ADR-0020 (`TResolveResult`, `this.slot`), §6.8 `trigger()` avec channel token (2 occurrences), §7.5 dédupliqué vers §7bis.4, §7bis.5 R4 réf corrigée. Statut normatif réécrit. |
| 2026-04-01 | **Absorption ADR-0014 H1–H5** : §7bis.3 — tableau normatif H1–H5 inliné (détection par nœud, setup()=hydratation, ProjectionList keyAttr, premier any no-op, serverState unique). |
