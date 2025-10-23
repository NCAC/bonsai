# ADR-0008 : Collection Patterns

| Champ | Valeur |
|-------|--------|
| **Statut** | ⚪ Superseded |
| **Date** | 2026-03-18 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0002-api-contrats-typage §9.4](../rfc/6-transversal/conventions-typage.md), D24 |
| **Superseded par** | [RFC-0003 §6.4–6.8](../rfc/5-rendu.md) |

> ⚪ **Superseded** : Le contenu normatif de cette ADR a été absorbé dans
> [RFC-0003 §6.4–6.8](../rfc/5-rendu.md) (Collection patterns,
> event delegation, anti-patterns, helper `getItemData()`).
> Ce document est conservé à titre historique.

---

## Contexte

Les **listes** sont le cas d'usage #1 en UI. Cependant, la documentation est lacunaire :

- D24 dit "pas de CollectionComposer"
- `ProjectionList.reconcile()` est mentionné mais pas spécifié
- Le pattern slots × Composers ne couvre pas explicitement les listes

### Questions clés

1. Comment rendre une liste d'items ?
2. Comment réconcilier efficacement (ajout, suppression, réordonnancement) ?
3. Comment gérer les child Views dans une liste ?
4. Quelle stratégie de keying ?

---

## Contraintes

### Architecturales

- **D24** : Un Composer gère 0 ou 1 View (pas de CollectionComposer)
- **I41** : Source de mutation unique par @ui
- **PDR** : Projection DOM Réactive, pas de VDOM

### Performance

- Listes potentiellement longues (1000+ items)
- Updates fréquents (real-time, typing)
- Pas de re-render complet

---

## Options considérées

### Option A — ProjectionList dans la View

**Description** : La View utilise `ProjectionList` pour gérer les éléments DOM de la liste.

```typescript
class CartView extends View {
  // Template pour un item
  private itemTemplate = compileTemplate<CartItem>(`
    <li class="cart-item" data-id="{{id}}">
      <span class="name">{{name}}</span>
      <span class="qty">{{quantity}}</span>
      <button class="remove">×</button>
    </li>
  `);
  
  get uiElements() {
    return {
      itemList: '.cart-items',  // <ul>
      // Pas de référence aux items individuels
    };
  }
  
  onCartItemsChanged(items: CartItem[]) {
    // ProjectionList gère le reconcile
    this.projectList('itemList', items, {
      template: this.itemTemplate,
      key: (item) => item.id,  // Clé unique
    });
  }
}
```

```typescript
// API ProjectionList
type TProjectionList<T> = {
  reconcile(
    container: Element,
    items: T[],
    options: {
      template: CompiledTemplate<T>;
      key: (item: T) => string;
      onInsert?: (el: Element, item: T) => void;
      onRemove?: (el: Element, item: T) => void;
      onMove?: (el: Element, item: T, fromIndex: number, toIndex: number) => void;
    }
  ): void;
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Simple API | - Items = DOM brut, pas de View |
| + Performant (keyed reconcile) | - Pas de child Views |
| + Cohérent avec PDR | - Events via delegation uniquement |

---

### Option B — Slots dynamiques × Composers

**Description** : La View crée des slots dynamiquement, chaque slot a un Composer.

```typescript
class CartView extends View {
  // La View gère les slots
  onCartItemsChanged(items: CartItem[]) {
    // Crée/supprime des slots selon les items
    this.reconcileSlots('itemsContainer', items, {
      key: (item) => item.id,
      slotTemplate: '<div class="item-slot" data-item-id="{{id}}"></div>'
    });
  }
  
  get composers() {
    // Composer pour chaque slot
    return {
      '[data-item-id]': CartItemComposer
    };
  }
}

class CartItemComposer extends Composer {
  resolve(slot: Element): typeof View {
    // Décide quelle View instancier
    return CartItemView;
  }
}

class CartItemView extends View {
  // Vue complète pour un item
  // Avec son propre cycle de vie, events, etc.
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Child Views complètes | - **Overhead** (1 Composer + 1 View par item) |
| + Lifecycle propre par item | - Complexe |
| + Conforme D24 (1 Composer : 0-1 View) | - Performance sur grandes listes |

---

### Option C — Hybrid : ProjectionList + Views légères

**Description** : ProjectionList pour le DOM, ViewFragments légers pour l'interactivité.

```typescript
class CartView extends View {
  onCartItemsChanged(items: CartItem[]) {
    this.projectList('itemList', items, {
      template: this.itemTemplate,
      key: (item) => item.id,
      // Callback après insertion/update
      onBind: (el, item) => {
        // Attacher un ViewFragment léger (pas une View complète)
        this.attachFragment(el, CartItemFragment, { item });
      },
      onUnbind: (el) => {
        this.detachFragment(el);
      }
    });
  }
}

// Fragment = mini-View sans le overhead complet
class CartItemFragment extends ViewFragment {
  // Pas de lifecycle complet, pas de Channel declarations
  // Juste des handlers délégués depuis la View parente
  
  onRemoveClick() {
    // Utilise le Channel de la View parente
    this.parent.trigger('cart:removeItem', { itemId: this.props.item.id });
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Performant (pas de View overhead) | - Nouveau concept (Fragment) |
| + Interactivité par item | - Complexité API |
| + Scalable | |

---

### Option D — ProjectionList + Event Delegation (recommandé)

**Description** : ProjectionList pour le rendu, event delegation pour l'interactivité.

```typescript
class CartView extends View {
  get uiElements() {
    return {
      itemList: '.cart-items',
    };
  }
  
  get uiEvents() {
    return {
      // Delegation sur le container, pas sur chaque item
      '.cart-items': {
        'click .remove-btn': 'onRemoveClick',
        'click .qty-btn': 'onQtyClick',
        'input .qty-input': 'onQtyChange'
      }
    };
  }
  
  onCartItemsChanged(items: CartItem[]) {
    this.projectList('itemList', items, {
      template: this.itemTemplate,
      key: (item) => item.id
    });
  }
  
  onRemoveClick(e: Event) {
    const itemId = this.getItemId(e.target);
    this.trigger('cart:removeItem', { itemId });
  }
  
  private getItemId(target: EventTarget): string {
    const el = (target as Element).closest('[data-item-id]');
    return el?.dataset.itemId ?? '';
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Simple** | - Pas de child Views |
| + **Performant** (1 listener par type) | - Extraction itemId manuelle |
| + **Scalable** (1000+ items OK) | - Logique dans la View parente |
| + Event delegation = pattern standard | |

---

## Analyse comparative

| Critère | A (ProjectionList) | B (Slots×Composers) | C (Hybrid) | D (Delegation) |
|---------|-------------------|---------------------|------------|----------------|
| **Simplicité** | ⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Performance** | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Child Views** | ❌ | ✅ | ⚠️ Fragments | ❌ |
| **Scalabilité** | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Complexité API** | ⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## Décision

**⚪ Superseded** — Absorbé par [RFC-0003 §6.4–6.8](../rfc/5-rendu.md) (D45)

### Option retenue (avant absorption) : Option D (ProjectionList + Delegation)

Justification :

1. **Simple** : un seul pattern à apprendre
2. **Performant** : keyed reconcile + event delegation
3. **Scalable** : 1000+ items sans problème
4. **Standard** : event delegation = pattern DOM classique

### API ProjectionList proposée

```typescript
// Dans View
class View {
  /**
   * Projette une liste d'items dans un container
   */
  protected projectList<T>(
    uiKey: keyof TUIMap,
    items: T[],
    options: TProjectionListOptions<T>
  ): void;
}

type TProjectionListOptions<T> = {
  // Template compilé pour un item
  template: CompiledTemplate<T>;
  
  // Fonction de keying (obligatoire pour reconcile efficace)
  key: (item: T) => string;
  
  // Comparaison pour skip update (optionnel)
  equals?: (a: T, b: T) => boolean;
  
  // Callbacks lifecycle (optionnel)
  onInsert?: (el: Element, item: T, index: number) => void;
  onUpdate?: (el: Element, item: T, index: number) => void;
  onRemove?: (el: Element, item: T) => void;
  onMove?: (el: Element, item: T, fromIndex: number, toIndex: number) => void;
}
```

### Algorithme de reconcile

```typescript
// Keyed reconcile (similaire à React/Vue)
function reconcile<T>(
  container: Element,
  newItems: T[],
  options: TProjectionListOptions<T>
) {
  const { template, key, equals = Object.is } = options;
  
  // Map des éléments existants par key
  const existing = new Map<string, Element>();
  for (const child of container.children) {
    const k = child.dataset.key;
    if (k) existing.set(k, child);
  }
  
  // Traitement des nouveaux items
  let lastInserted: Element | null = null;
  
  for (const item of newItems) {
    const k = key(item);
    const existingEl = existing.get(k);
    
    if (existingEl) {
      // Update existant
      template.patch(existingEl, item);
      existing.delete(k); // Marquer comme traité
      
      // Déplacer si nécessaire
      if (lastInserted?.nextSibling !== existingEl) {
        container.insertBefore(existingEl, lastInserted?.nextSibling ?? null);
      }
      lastInserted = existingEl;
    } else {
      // Créer nouveau
      const newEl = template.create(item);
      newEl.dataset.key = k;
      container.insertBefore(newEl, lastInserted?.nextSibling ?? null);
      lastInserted = newEl;
      options.onInsert?.(newEl, item, [...container.children].indexOf(newEl));
    }
  }
  
  // Supprimer les éléments qui n'existent plus
  for (const [k, el] of existing) {
    options.onRemove?.(el, /* item */);
    el.remove();
  }
}
```

### Pattern d'utilisation

```typescript
// 1. Template
const itemTemplate = compileTemplate<CartItem>(`
  <li class="cart-item" data-item-id="{{id}}">
    <img src="{{imageUrl}}" alt="{{name}}">
    <div class="info">
      <h3>{{name}}</h3>
      <p class="price">{{price | currency}}</p>
    </div>
    <div class="actions">
      <button class="qty-minus">-</button>
      <span class="qty">{{quantity}}</span>
      <button class="qty-plus">+</button>
      <button class="remove">×</button>
    </div>
  </li>
`);

// 2. View
class CartView extends View {
  get uiElements() {
    return { items: '.cart-items' };
  }
  
  get uiEvents() {
    return {
      '.cart-items': {
        'click .qty-minus': 'onDecrease',
        'click .qty-plus': 'onIncrease',
        'click .remove': 'onRemove'
      }
    };
  }
  
  get templates() {
    return { item: itemTemplate };
  }
  
  // Listen pour les changements
  onCartUpdated(cart: TCartState) {
    this.projectList('items', cart.items, {
      template: this.templates.item,
      key: item => item.id
    });
    
    // Update autres éléments
    this.getUI('total').text(formatCurrency(cart.total));
  }
  
  // Handlers
  private getItemId(e: Event): string {
    const li = (e.target as Element).closest('[data-item-id]');
    return li?.dataset.itemId ?? '';
  }
  
  onDecrease(e: Event) {
    this.trigger('cart:decreaseQty', { itemId: this.getItemId(e) });
  }
  
  onIncrease(e: Event) {
    this.trigger('cart:increaseQty', { itemId: this.getItemId(e) });
  }
  
  onRemove(e: Event) {
    this.trigger('cart:removeItem', { itemId: this.getItemId(e) });
  }
}
```

---

## Cas avancés

### Liste avec child Views (Option B quand nécessaire)

Pour les cas où une vraie child View est requise (composant complexe avec son propre state, Behaviors, etc.) :

```typescript
class DashboardView extends View {
  onWidgetsChanged(widgets: WidgetConfig[]) {
    // Crée des slots pour chaque widget
    this.reconcileSlots('widgetContainer', widgets, {
      key: w => w.id,
      slotClass: 'widget-slot'
    });
  }
  
  get composers() {
    return {
      '.widget-slot': WidgetComposer
    };
  }
}

class WidgetComposer extends Composer {
  resolve(slot: Element): typeof View | null {
    const config = this.getSlotData(slot);
    // Choisit la View selon le type de widget
    switch (config.type) {
      case 'chart': return ChartWidget;
      case 'table': return TableWidget;
      case 'kpi': return KpiWidget;
      default: return null;
    }
  }
}
```

### Liste virtualisée (performance extrême)

```typescript
class VirtualizedListView extends View {
  private virtualizer: Virtualizer;
  
  onAttach() {
    this.virtualizer = new Virtualizer({
      container: this.getUI('scrollContainer').node,
      itemHeight: 48, // ou fonction
      overscan: 5,
      onRender: (startIndex, endIndex) => {
        const visibleItems = this.items.slice(startIndex, endIndex);
        this.projectList('viewport', visibleItems, {
          template: this.itemTemplate,
          key: item => item.id
        });
      }
    });
  }
  
  onItemsChanged(items: Item[]) {
    this.items = items;
    this.virtualizer.setTotalCount(items.length);
  }
}
```

---

## Anti-patterns

### ❌ Muter les données pour filtrer/trier

**Contexte** : Une View affiche 300 produits, l'utilisateur change le tri par popularité.

```typescript
// ❌ MAUVAIS — Muter les items dans l'Entity
onFilterByPopularity(payload) {
  this.entity.mutate("products:filterByPopularity", draft => {
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
1. **Explosion des patches** — 300 patches pour une opération logique
2. **Sémantique incorrecte** — les données n'ont pas changé, seule la *présentation* change
3. **Performance** — re-render complet de la liste
4. **Event Sourcing** — stocker "tri changé" ≠ stocker 300 déplacements

```typescript
// ✅ BON — Muter les CRITÈRES, pas les données
type TProductsState = {
  items: Product[];              // Données brutes (rarement mutées)
  sortCriteria: SortCriteria;    // Critère actif (muté fréquemment)
  filters: FilterCriteria;       // Filtres actifs
}

onFilterByPopularity(payload) {
  this.entity.mutate("products:setSortCriteria", draft => {
    draft.sortCriteria = { field: "popularity", order: "desc" };
  });
}
// → 1 seul patch : { op: "replace", path: ["sortCriteria"], value: {...} }
```

```typescript
// La View applique les critères lors du rendu
class ProductsView extends View {
  onProductsUpdated(state: TProductsState) {
    // Calcul dérivé : appliquer sort/filter sur les données brutes
    const visibleProducts = this.computeVisibleProducts(state);
    
    this.projectList('products', visibleProducts, {
      template: this.productTemplate,
      key: p => p.id
    });
  }
  
  private computeVisibleProducts(state: TProductsState): Product[] {
    let result = [...state.items];
    
    // Appliquer les filtres
    if (state.filters) {
      result = result.filter(p => matchesFilters(p, state.filters));
    }
    
    // Appliquer le tri
    if (state.sortCriteria) {
      result = sortBy(result, state.sortCriteria);
    }
    
    return result;
  }
}
```

### Principe : Données vs Critères vs Dérivées

| Type | Fréquence mutation | Stockage Entity | Exemple |
|------|-------------------|-----------------|---------|
| **Données brutes** | Rare (CRUD serveur) | `items: Product[]` | Liste de produits |
| **Critères de vue** | Fréquent (UI) | `sortCriteria`, `filters`, `page` | Tri, filtres, pagination |
| **Données dérivées** | Jamais | Calculé (View/getter) | Liste filtrée et triée |

### Quand muter les données ?

Les mutations sur `items[]` sont légitimes pour :
- **Ajout** : `items.push(newProduct)`
- **Suppression** : `items.splice(index, 1)`
- **Modification d'un item** : `items[i].price = newPrice`
- **Données reçues du serveur** : `items = serverResponse.products`

---

## Conséquences

### Positives

- ✅ Pattern simple et performant pour 90% des cas
- ✅ Event delegation = scalable
- ✅ Keyed reconcile = updates efficaces
- ✅ Option B disponible pour cas complexes

### Négatives (acceptées)

- ⚠️ Pas de child Views pour les listes simples — mitigé par delegation
- ⚠️ Extraction itemId manuelle — helper possible

---

## Helper proposé

```typescript
// Helper pour simplifier l'extraction d'ID
class View {
  protected getItemData<T = string>(
    event: Event, 
    selector: string,
    attribute: string = 'data-id'
  ): T | null {
    const el = (event.target as Element).closest(selector);
    const value = el?.getAttribute(attribute);
    return value as T | null;
  }
}

// Usage
onRemove(e: Event) {
  const itemId = this.getItemData(e, '[data-item-id]', 'data-item-id');
  if (itemId) {
    this.trigger('cart:removeItem', { itemId });
  }
}
```

---

## Actions de suivi

- [ ] Implémenter `projectList()` avec keyed reconcile
- [ ] Implémenter `reconcileSlots()` pour cas complexes
- [ ] Benchmark : 1000 items, updates fréquents
- [ ] Documenter patterns dans PATTERNS.md
- [ ] Exemple : VirtualizedList

---

## Références

- [React Reconciliation](https://reactjs.org/docs/reconciliation.html)
- [Vue v-for with key](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key)
- [Lit repeat directive](https://lit.dev/docs/templates/lists/#the-repeat-directive)
- [Event Delegation](https://javascript.info/event-delegation)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) — ProjectionList recommandé |
| 2026-03-26 | Superseded — Absorbé par RFC-0003 §6.4–6.8 (D45 COLLECTION-PATTERN) |






## Exemple de template pour une liste
```
.Cart
  h2.Cart-title Mon panier
  
  ul.Cart-items
    each product in items
      li.Cart-item
        //- code de chaque item
  
  .Cart-footer
    span.Cart-total Total: #{total}
    button.Cart-checkout Valider
```