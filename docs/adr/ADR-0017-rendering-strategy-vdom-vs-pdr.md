# ADR-0017 : Stratégie de rendu — VDOM global vs PDR chirurgicale vs VDOM local par template

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-26 |
| **Décideurs** | @ncac |
| **RFC liées** | [RFC-0001](../rfc/1-philosophie.md) (D19, I31, I38, I39, I40, I41), [RFC-0002 §9.4](../rfc/6-transversal/conventions-typage.md) (PDR), [RFC-0003](../rfc/5-rendu.md) (compilateur, ProjectionList, selectors), [ADR-0012](ADR-0012-virtualized-list.md) (VirtualizedList), [ADR-0014](ADR-0014-ssr-hydration-strategy.md) (SSR hydration), [ADR-0015](ADR-0015-local-state-mechanism.md) (localState) |
| **Invariants** | I31, I38, I39, I40, I41, I42 |
| **Décisions** | D19 (PDR), D26 (N1/N2/N3), D30 (fallback SPA), D32 (source unique), D42 (VIEW-SUBSCRIPTION) |

---

## Contexte

### L'hésitation fondatrice

L'intuition initiale du framework était d'utiliser un **VDOM** (Virtual DOM) pour le moteur de rendu. Cette intuition est rationnelle : Bonsai conçoit un framework structuré, typé, déterministe — et un VDOM semble être l'outil naturel pour formaliser un rendu purement déclaratif. Un compilateur Pug → Snabbdom (VDOM) avait d'ailleurs été protétypé en amont de la conception de Bonsai.

Au fil de l'élaboration de l'architecture, la direction s'est éloignée du VDOM au profit de la **Projection DOM Réactive (PDR)** — mutations chirurgicales sur le DOM existant, sans arbre virtuel intermédiaire. Ce choix s'est cristallisé dans D19, formalisé dans RFC-0002 §9.4, et implémenté conceptuellement dans RFC-0003 (compilateur, `setup()`/`project()`/`create()`, `ProjectionList`).

**Néanmoins**, l'hésitation persiste. Cette ADR a pour objectif de **trancher définitivement** la question en analysant les trois options avec rigueur, en les confrontant aux invariants existants, et en traitant en profondeur le cas d'usage le plus exigeant : **le rendu de listes avec filtre/tri sur un DOM SSR préexistant**.

### Le cas d'usage déclencheur : filtre/tri sur liste SSR

Le scénario qui cristallise le doute :

1. Le serveur rend une liste de 50 produits, triée par date (SEO), dans le HTML
2. L'utilisateur arrive sur la page — le DOM existe, lisible, indexable
3. L'utilisateur clique « Trier par popularité » ou sélectionne une taxonomie
4. La liste doit se réordonner/filtrer **en place**, sans recharger la page

**En VDOM**, le flux mental est clair :
```
DOM SSR → construire VDOM₀ (miroir du DOM actuel)
Utilisateur change le tri → construire VDOM₁ (nouveau tri)
diff(VDOM₀, VDOM₁) → patches → appliquer au DOM réel
```

**En PDR**, le flux semble moins évident au premier abord. Cette ADR va démontrer qu'il est **au moins aussi clair**, et **plus performant**.

### Questions subsidiaires

Cette ADR tranche également deux questions liées :

1. **Que stocke-t-on dans l'Entity ?** Seulement les critères de tri/filtre, ou aussi la liste dérivée (filtrée/triée) ?
2. **Le Render Contract PDR est-il complet ?** Manque-t-il un document unifié pour le process de réconciliation hors listes ?

---

## Contraintes

Les contraintes suivantes sont **non négociables** — elles découlent des invariants et décisions existants :

| # | Contrainte | Source |
|---|-----------|--------|
| **C1** | Le DOM préexiste (SSR/CMS/statique) — hypothèse fondatrice | D19, I31 |
| **C2** | Pas de VDOM, pas de diff d'arbre — le framework mute chirurgicalement le DOM existant | ADR-0014 C5, D19 |
| **C3** | La View accède au DOM exclusivement via `getUI()` — pas de `querySelector` ad hoc | I39 |
| **C4** | Chaque `@ui` a une source de mutation unique (template ou N1 manuel) | I41, D32 |
| **C5** | Le scope DOM d'une View exclut les sous-arbres des slots | I40 |
| **C6** | Les niveaux N1/N2/N3 contraignent chaque composant | I38, D26 |
| **C7** | Le state d'une Entity est `JsonSerializable`, relation 1:1:1 | I22, D10 |
| **C8** | Les Behaviors 60fps (drag, slider) opèrent en N1 direct sur le DOM | I45, D36 |
| **C9** | `setup()` est l'hydratation — pas de phase séparée | ADR-0014 H2 |
| **C10** | `ProjectionList` hydrate par `keyAttr` en SSR | ADR-0014 H3 |
| **C11** | Les Views s'abonnent via `any` + selectors namespacés | D42 |

---

## Options considérées

### Option A — VDOM global (Snabbdom-like)

**Description** : Un arbre virtuel complet (VNode) est maintenu en mémoire pour chaque View. À chaque changement de données, un nouvel arbre virtuel est construit via le template, puis un algorithme de diff compare l'ancien et le nouveau VNode et produit des patches à appliquer au DOM réel.

```
┌─────────────────── Cycle de rendu VDOM ───────────────────┐
│                                                            │
│  1. Données changent (Event / localState)                  │
│  2. Template exécuté → VNode₁ (arbre virtuel complet)      │
│  3. diff(VNode₀, VNode₁) → patches[]                      │
│  4. patches.forEach(p => applyToDom(p))                    │
│  5. VNode₀ = VNode₁ (pour le prochain cycle)              │
│                                                            │
│  Coût : O(taille du template) pour chaque Event,           │
│         même si 1 seul nœud a changé                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Hydratation SSR** : Au `onAttach()`, le template est exécuté une première fois pour construire VNode₀ qui **doit** correspondre exactement au DOM serveur. Si ce n'est pas le cas (mismatch), deux options : (a) ignorer et risquer des incohérences, (b) remplacer tout le sous-arbre.

```typescript
// ── VDOM global : cycle de rendu ──

class CartView extends View {
  // Le framework maintient :
  private _vnode: VNode | null = null;

  // À chaque Event 'any' :
  onUpdate(data: NamespacedData): void {
    const items = data.cart?.items;
    if (!items) return;

    // 1. Construire le nouvel arbre complet
    const newVNode = CartItemsTemplate.render(items);
    
    // 2. Diff + patch
    if (this._vnode) {
      const patches = diff(this._vnode, newVNode);
      patch(this.el, patches);
    } else {
      // Premier rendu : hydratation (créer le vnode depuis le DOM existant)
      this._vnode = vnodeFromDom(this.el); // Coûteux !
      const patches = diff(this._vnode, newVNode);
      patch(this.el, patches);
    }
    
    this._vnode = newVNode;
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Modèle mental simple : « je déclare un arbre, le framework diff » | - Arbre complet en mémoire pour chaque View |
| + Pas besoin de spécifier quoi patcher — le diff le découvre | - Diff O(n) à chaque mise à jour, même pour 1 nœud changé |
| + Écosystème prouvé (React, Preact, Snabbdom, Inferno) | - Pression GC : arbres VNode éphémères à chaque cycle |
| + Rassure cognitivement : « tout est pur, déclaratif » | - **Hydratation SSR problématique** : construire VNode₀ depuis le DOM existant est coûteux et fragile (mismatch) |
| | - **Contradicts D19** : crée une copie de la vérité structurelle du DOM |
| | - **Contradicts I39** : le VDOM doit parcourir le DOM pour construire VNode₀ |
| | - **Contradicts I41** : la source de mutation devient le diff engine, pas le composant |
| | - **Incompatible avec N1 (I38)** : les mutations d'attributs simples passent par un cycle complet |
| | - **Incompatible avec Behaviors 60fps** : chaque interaction génère un re-render |
| | - **ProjectionList redondante** : le VDOM a son propre keyed diff → doublon |
| | - Taille du bundle : moteur VDOM (~5-10kB gzip) |

---

### Option B — PDR chirurgicale (status quo formalisé)

**Description** : Le modèle actuel, formalisé dans D19, RFC-0002 §9.4 et RFC-0003. Pas d'arbre virtuel. Le compilateur Pug génère des fonctions `setup()`/`project()`/`create()` qui opèrent **directement** sur les nœuds DOM. `ProjectionList` gère la réconciliation keyed des listes. Les selectors namespacés (D42) déterminent **quoi** projeter et **quand**.

```
┌─────────────────── Cycle de rendu PDR ────────────────────┐
│                                                            │
│  1. Données changent (Event / localState)                  │
│  2. Selector filtre les clés pertinentes                   │
│  3. shallowEqual skip si données identiques                │
│  4. template.project(nodes, data) →                        │
│     - scalaires : if (node.textContent !== val) set        │
│     - listes : ProjectionList.reconcile(items, handlers)   │
│  5. Seuls les nœuds changés sont touchés                   │
│                                                            │
│  Coût : O(nœuds changés) — jamais O(taille du template)   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

```typescript
// ── PDR : code généré par le compilateur ──

export const CartItemsTemplate: TProjectionTemplate<CartItemsNodes, CartItem[]> = {
  setup(container: HTMLElement): CartItemsNodes {
    // Localise les nœuds dynamiques dans le DOM existant (SSR/hydratation)
    return {
      list: new ProjectionList(container, {
        keyAttr: 'data-item-id',
        itemSetup: (el) => ({
          name: el.querySelector('.name')!,
          qty: el.querySelector('.qty')!,
        }),
        itemCreate: (item) => {
          const li = document.createElement('li');
          li.className = 'Cart-item';
          li.dataset.itemId = item.id;
          li.innerHTML = `<span class="name">${escapeHtml(item.name)}</span>
                          <span class="qty">${item.quantity}</span>`;
          return li;
        }
      })
    };
  },

  project(nodes: CartItemsNodes, items: CartItem[]): void {
    nodes.list.reconcile(items, {
      key: item => item.id,
      update: (itemNodes, item) => {
        if (itemNodes.name.textContent !== item.name)
          itemNodes.name.textContent = item.name;
        if (itemNodes.qty.textContent !== String(item.quantity))
          itemNodes.qty.textContent = String(item.quantity);
      }
    });
  },

  create(items: CartItem[]): HTMLElement { /* ... factory SPA ... */ }
};
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **O(nœuds changés)** — jamais O(taille du template) | - Modèle mental moins « magique » : le développeur doit comprendre setup/project |
| + **Zéro allocation intermédiaire** — pas d'arbre VNode à construire/diff/GC | - Le code généré est plus verbeux qu'un VDOM render() |
| + **SSR natif** : `setup()` = hydratation, H2 (ADR-0014) | - Le compilateur est plus complexe (doit générer des guards par nœud) |
| + **Compatible N1** : mutations d'attributs sans cycle de rendu | - Pas de « safety net » d'un diff global (le compilateur doit être correct) |
| + **Compatible Behaviors 60fps** : N1 direct, pas de re-render | |
| + **Pas de doublon** : `ProjectionList` est l'unique outil de réconciliation | |
| + **Cohérent avec D19, I31, I38, I39, I41** — aucun invariant violé | |
| + **Bundle minimal** : pas de moteur VDOM | |
| + `shallowEqual` skip les projections inutiles (§7.5) | |

---

### Option C — VDOM local par template (voie médiane)

**Description** : Un arbre virtuel est maintenu **uniquement pour chaque template island** (zone `@ui` avec template), jamais pour l'ensemble de la View ni pour l'application. Le VDOM est un détail d'implémentation interne du template compilé — invisible pour le développeur.

En pratique :
- Chaque template PugX est compilé en fonction Snabbdom (comme dans l'approche VDOM prototypée en amont)
- Mais le VDOM n'est utilisé que pour calculer les mutations d'une sous-arborescence template
- PDR reste le modèle dominant pour les mutations N1 (attributs, classes)
- `ProjectionList` reste l'outil pour les listes (pas le keyed diff du VDOM)
- SSR `setup()` reste intact
- Aucune logique métier n'est couplée au mini-VDOM

```
┌─────────────────── Cycle VDOM local ──────────────────────┐
│                                                            │
│  View.el (DOM réel)                                        │
│  ├── .header      ← N1 : mutations directes, pas de VDOM  │
│  ├── .items (@ui) ← VDOM local : template → VNode → diff  │
│  │   └── ProjectionList pour les <li> keyed                │
│  └── .footer      ← statique, jamais touché                │
│                                                            │
│  Le VDOM couvre UNIQUEMENT la zone @ui="items"             │
│  Le reste de la View n'a pas de VNode                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

```typescript
// ── VDOM local : hybride ──

export const CartItemsTemplate: TProjectionTemplate<CartItemsNodes, CartItem[]> = {
  setup(container: HTMLElement): CartItemsNodes {
    // SSR : construire VNode₀ depuis le DOM existant
    const initialVNode = vnodeFromDom(container);
    return { vnode: initialVNode, container };
  },

  project(nodes: CartItemsNodes, items: CartItem[]): void {
    // Construire le nouvel arbre pour cette zone seulement
    const newVNode = h('ul.Cart-items',
      items.map(item =>
        h('li.Cart-item', { key: item.id, dataset: { itemId: item.id } }, [
          h('span.name', item.name),
          h('span.qty', String(item.quantity)),
        ])
      )
    );
    // Diff local + patch
    patch(nodes.vnode, newVNode);
    nodes.vnode = newVNode;
  },

  create(items: CartItem[]): HTMLElement { /* ... */ }
};
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Sécurité cognitive : diff garanti correct pour chaque island | - **Deux modèles de rendu** : VDOM pour les templates, N1 direct pour le reste |
| + Compatible SSR (VNode₀ depuis DOM existant) | - `vnodeFromDom()` à l'hydratation : coût O(taille island) par template |
| + Isolé : ne contamine pas N1 ni Behaviors | - **Contradiction avec ProjectionList** : le VDOM a son propre keyed diff |
| + Compilateur plus simple (émet des `h()` au lieu de guards per-nœud) | - Pression GC : VNodes éphémères à chaque projection, même locale |
| + Plus proche de Vue 3, Lit, Solid dans l'esprit | - **Deux algorithmes de réconciliation de listes** : VDOM diff + ProjectionList |
| | - Dépendance Snabbdom ou moteur VDOM (~3-5kB) |
| | - `setup()` n'est plus juste « localiser les nœuds » — il doit construire un VNode |
| | - ADR-0014 H2 (`setup()` = hydratation) partiellement invalidé |
| | - Complexité conceptuelle : quand VDOM local, quand PDR direct ? |

---

## Analyse comparative

| Critère | Option A — VDOM global | Option B — PDR chirurgicale | Option C — VDOM local |
|---------|------------------------|----------------------------|----------------------|
| **Performance** (mutation) | ⭐ O(template) | ⭐⭐⭐ O(nœuds changés) | ⭐⭐ O(island) |
| **Performance** (mémoire) | ⭐ Arbre VNode complet | ⭐⭐⭐ Refs DOM directes | ⭐⭐ VNodes par island |
| **Performance** (GC) | ⭐ VNodes éphémères fréquents | ⭐⭐⭐ Zéro allocation | ⭐⭐ VNodes locaux |
| **SSR / Hydratation** | ⭐ vnodeFromDom coûteux, mismatch risk | ⭐⭐⭐ setup() = localiser, naturel | ⭐⭐ vnodeFromDom par island |
| **Comportement N1 / 60fps** | ⭐ Tout passe par re-render | ⭐⭐⭐ Direct, découplé | ⭐⭐⭐ N1 découplé |
| **Cohérence invariants** | ⭐ Viole D19, I39, I41 | ⭐⭐⭐ Aucune violation | ⭐⭐ Tension avec H2, ProjectionList |
| **Complexité compilateur** | ⭐⭐⭐ Simple (émet h()) | ⭐⭐ Complexe (guards) | ⭐⭐ Hybride |
| **Complexité framework** | ⭐⭐ Moteur VDOM à intégrer | ⭐⭐⭐ Rien de nouveau | ⭐ Deux modèles en parallèle |
| **DX développeur** | ⭐⭐⭐ Familier (React-like) | ⭐⭐ Nécessite comprendre PDR | ⭐⭐ Lequel s'applique quand ? |
| **Bundle size** | ⭐ +5-10kB (VDOM engine) | ⭐⭐⭐ Zéro dépendance | ⭐⭐ +3-5kB (mini VDOM) |
| **Unicité du modèle** | ⭐⭐⭐ Un seul modèle | ⭐⭐⭐ Un seul modèle | ⭐ Deux modèles coexistent |
| **Type-safety** | ⭐⭐ VNodes non typés fin | ⭐⭐⭐ Refs typés par TUIMap | ⭐⭐ Hybride |
| **Maintenabilité** | ⭐⭐ | ⭐⭐⭐ | ⭐ |

---

## Le cas d'usage critique : filtre/tri sur liste SSR — Démonstration PDR

> Ce cas est le **point de doute** principal. Il est traité ici en profondeur,
> pas-à-pas, pour démontrer que PDR le gère **au moins aussi bien** qu'un VDOM,
> et avec des avantages mesurables.

### Scénario

| Étape | État |
|-------|------|
| **T0 — SSR** | Le serveur rend 50 produits triés par date (SEO). Le HTML existe dans le DOM. |
| **T1 — Hydratation** | Bonsai bootstrap. La View s'attache. `setup()` indexe les 50 `<li>` existants. |
| **T2 — Tri** | L'utilisateur clique « Trier par popularité ». |
| **T3 — Filtre** | L'utilisateur sélectionne la catégorie « Électronique » (20 produits sur 50). |

### Architecture : que stocke l'Entity ?

> **Règle fondamentale (déjà dans RFC-0003 §6.5–6.6)** : on ne mute **jamais** les
> données brutes pour satisfaire un changement de présentation. On mute les **critères**
> et on calcule les dérivées dans le selector de la View.

```typescript
// ── Entity : données brutes + critères ──
// On NE STOCKE PAS les items dérivés (filtrés/triés) dans l'Entity.

type TProductCatalogState = {
  /** Données brutes — mutées uniquement par CRUD serveur */
  items: TProduct[];
  
  /** Taxonomies disponibles — reçues du serveur, immuables en pratique */
  taxonomies: TTaxonomy[];
  
  /** Critère de tri actif — muté par l'UI */
  sortCriteria: TSortCriteria;
  
  /** Filtres actifs — mutés par l'UI */
  filters: TFilterCriteria;
};

type TSortCriteria = {
  field: 'date' | 'popularity' | 'price' | 'name';
  order: 'asc' | 'desc';
};

type TFilterCriteria = {
  taxonomy?: string;       // null = pas de filtre taxonomie
  priceRange?: [number, number];
  searchTerm?: string;
};
```

**Pourquoi on ne stocke pas la liste dérivée dans l'Entity :**

| Stocker les items dérivés ? | Conséquence |
|-|-|
| ❌ **Non** — c'est une donnée **calculée**, pas une donnée **métier** | Le tri/filtre ne change pas les données. Stocker `filteredItems` dans l'Entity crée une dénormalisation, un risque de désynchronisation, et **génère des patches inutiles** (RFC-0003 §6.5). Si 50 items sont réordonnés, l'Entity verrait 50 patches `replace` alors que seul le critère a changé. |
| ✅ **Stocker uniquement les critères** | Un changement de tri = 1 patch (`sortCriteria`). Le calcul dérivé vit dans le selector de la View — c'est une projection, pas un état. |

### Étape T1 — Hydratation SSR : `setup()` + `ProjectionList`

Au bootstrap, le DOM serveur contient 50 `<li>` déjà rendus. `ProjectionList.setup()` les scanne et les indexe :

```html
<!-- DOM serveur (T0) — 50 produits triés par date -->
<ul class="ProductList" data-ui="products">
  <li class="ProductItem" data-item-id="p42">
    <span class="ProductItem-name">Widget Pro</span>
    <span class="ProductItem-price">42 €</span>
  </li>
  <li class="ProductItem" data-item-id="p17">
    <span class="ProductItem-name">Gadget Ultra</span>
    <span class="ProductItem-price">89 €</span>
  </li>
  <!-- ... 48 autres items ... -->
</ul>
```

```typescript
// T1 — setup() localise les nœuds dans le DOM existant (ADR-0014 H2)
setup(container: HTMLElement): ProductListNodes {
  return {
    list: new ProjectionList(container, {
      keyAttr: 'data-item-id',
      itemSetup: (el) => ({
        name: el.querySelector('.ProductItem-name')!,
        price: el.querySelector('.ProductItem-price')!,
      }),
      itemCreate: (item) => { /* factory pour items nouveaux (SPA ou ajout dynamique) */ }
    })
  };
}

// ProjectionList.setup() fait (en interne, ADR-0014 H3) :
// - Parcourt les 50 <li> enfants
// - Pour chaque <li>, lit data-item-id → clé
// - Indexe dans this.itemNodesMap : Map<"p42", { el, nodes: { name, price } }>
// 
// Résultat : une MAP INDEXÉE de 50 items avec leurs refs DOM directes.
// Coût : O(50) — une seule passe, pas d'arbre virtuel.
```

**Point clé** : à ce stade, `ProjectionList` a une `Map<key, { el, nodes }>` de 50 items. Elle connaît la **position actuelle** de chaque `<li>` dans le conteneur et a des **références directes** vers chaque nœud dynamique (`.ProductItem-name`, `.ProductItem-price`). C'est l'équivalent fonctionnel du VNode₀ d'un VDOM — mais sans arbre en mémoire, juste une map plate.

### Étape T2 — Tri : l'utilisateur clique « Trier par popularité »

```
User → click "Tri: Popularité"
  → View.trigger('catalog:setSortCriteria', { field: 'popularity', order: 'desc' })
  → CatalogFeature.handle('setSortCriteria', payload)
    → entity.mutate('catalog:setSortCriteria', (draft) => {
        draft.sortCriteria = { field: 'popularity', order: 'desc' };
      })
    → Channel.emit('sort-criteria-changed', { sortCriteria })
    → Channel.emit('any', { event: 'sort-criteria-changed', changes: { sortCriteria } })
```

**Ce qui se passe dans la View :**

```typescript
class ProductCatalogView extends View {
  static readonly listen = [Catalog.channel] as const;

  get templates() {
    return {
      products: {
        template: ProductListTemplate,
        // ══════════════════════════════════════════════════════════
        // LE SELECTOR : c'est ici que vit la logique de dérivation.
        // Il reçoit le STATE COMPLET du Channel via NamespacedData (D46).
        // ══════════════════════════════════════════════════════════
        select: (data) => {
          const state = data.catalog;
          if (!state) return undefined;
          return this.deriveVisibleProducts(state);
        },
      },
    };
  }

  /**
   * Calcul dérivé — PAS stocké dans l'Entity.
   * Identique à un useMemo() React, mais sans hook.
   * 
   * Reçoit les données brutes + critères, retourne la liste à afficher.
   */
  private deriveVisibleProducts(state: TProductCatalogState): TProduct[] | undefined {
    // Le selector reçoit le state COMPLET du Channel (D46 — FULL-STATE-SELECTOR).
    // Le framework passe une référence live vers le state frozen de l'Entity.
    // Zéro coût : pas de copie, pas de reconstruction.
    
    const items = state.items;
    const filters = state.filters;
    const sort = state.sortCriteria;
    
    if (!items) return undefined;

    let result = [...items];

    // Appliquer les filtres
    if (filters?.taxonomy) {
      result = result.filter(p => p.taxonomies.includes(filters.taxonomy!));
    }
    if (filters?.priceRange) {
      const [min, max] = filters.priceRange;
      result = result.filter(p => p.price >= min && p.price <= max);
    }

    // Appliquer le tri
    if (sort) {
      result.sort((a, b) => {
        const cmp = compare(a[sort.field], b[sort.field]);
        return sort.order === 'desc' ? -cmp : cmp;
      });
    }

    return result;
  }
}
```

**Ce qui se passe dans `ProjectionList.reconcile()` :**

```typescript
// Le selector retourne items[] dans le NOUVEL ORDRE (trié par popularité).
// ProjectionList.reconcile() reçoit cette liste et opère :

reconcile(items: TProduct[], handlers): void {
  // items = [p17, p42, p03, ...] (ordre popularité — différent de l'ordre DOM actuel)
  
  // 1. Map existante : { "p42" → { el: <li>, nodes }, "p17" → { el: <li>, nodes }, ... }
  //    (indexée au setup ou au reconcile précédent)
  
  // 2. Pour chaque item dans le NOUVEL ORDRE :
  //    - p17 : trouvé dans la map → update(nodes, item) → patch textContent si changé
  //            → est-il au bon endroit dans le DOM ? Non → insertBefore pour le déplacer
  //    - p42 : trouvé → update → déplacer si nécessaire
  //    - ... etc.
  
  // 3. Items dans la map mais PAS dans items[] → remove du DOM
  //    (cas filtre : items passant de 50 à 20)
  
  // COÛT TOTAL :
  // - 50 lookups dans la Map : O(1) chacun → O(50)
  // - K déplacements DOM (insertBefore) : K ≤ 50
  // - 0 créations (tous les items existent déjà)
  // - M suppressions DOM (filtre) : M ≤ 50
  // - 50 comparaisons textContent (guards) : O(50)
  // 
  // Total : O(n) avec n = nombre d'items. IDENTIQUE au VDOM keyed diff.
  // Mais SANS avoir construit deux arbres virtuels en mémoire.
}
```

### Comparaison pas-à-pas : VDOM vs PDR pour le même tri

| Étape | VDOM global | PDR chirurgicale |
|-------|-------------|------------------|
| **1. Détecter le changement** | Re-exécuter le template complet → VNode₁ | Selector filtre `sortCriteria` changé → `shallowEqual` détecte la différence |
| **2. Calculer les mutations** | `diff(VNode₀, VNode₁)` : parcourir les deux arbres complets, comparer nœud par nœud | `ProjectionList.reconcile(items)` : parcourir la liste, lookup par clé |
| **3. Appliquer au DOM** | `patch(dom, patches)` : appliquer les patches | `insertBefore()` pour déplacer, `textContent =` pour les valeurs | 
| **4. Mettre à jour l'état interne** | `VNode₀ = VNode₁` : remplacer l'arbre complet | Rien — la map et les refs sont mutées en place |
| **Allocations mémoire** | 50 VNodes × ~5 champs = ~250 objets créés + GC de VNode₀ | 0 objets créés |
| **Complexité algorithmique** | O(n) pour le diff keyed + O(n) pour la construction VNode | O(n) pour le reconcile |
| **Nœuds DOM touchés (tri pur)** | K `insertBefore` (identique) | K `insertBefore` (identique) |
| **Nœuds DOM touchés (filtre)** | K `insertBefore` + M `removeChild` | K `insertBefore` + M `removeChild` |

**Résultat** : Les opérations DOM sont **strictement identiques**. La seule différence est l'overhead mémoire du VDOM (construction + GC des arbres virtuels).

### Étape T3 — Filtre : l'utilisateur sélectionne « Électronique »

Même flux. Le selector retourne 20 items au lieu de 50. `ProjectionList.reconcile()` :

1. **Garde les 20 items** qui matchent → `update()` pour chacun (avec guards, donc no-op si rien n'a changé)
2. **Supprime les 30 items** qui ne matchent plus → `el.remove()` pour chacun, nettoyage de la map
3. **Réordonne** si nécessaire → `insertBefore()` pour les items pas au bon endroit

Si l'utilisateur retire le filtre, les 30 items supprimés seront **recréés** via `itemCreate()` (Q2 résolu : pas de pool de recyclage, cf. Q2-A). C'est le même coût qu'un VDOM qui recréerait les VNodes et les nœuds DOM correspondants.

### Schéma temporel complet

```
T0 ─── SSR ──────────────────────────────────────────────────
       Serveur rend 50 <li> triés par date
       DOM = [p01, p02, ..., p50] (ordre date)

T1 ─── Bootstrap ────────────────────────────────────────────
       setup() → ProjectionList.setup()
       Map = { p01: {el, nodes}, p02: {el, nodes}, ..., p50: {el, nodes} }
       Feature.onAttach() → request données → Entity peuplée
       Premier any → selector → deriveVisibleProducts()
       → items identiques au DOM → shallowEqual → SKIP (no-op, H4)
       ✅ Zéro mutation DOM

T2 ─── Tri popularité ──────────────────────────────────────
       User click → trigger('catalog:setSortCriteria', { field: 'popularity' })
       Feature → mutate(sortCriteria) → emit('any', { changes: { sortCriteria } })
       View → selector → deriveVisibleProducts() → [p17, p42, p03, ...]
       shallowEqual → différent → project()
       ProjectionList.reconcile([p17, p42, p03, ...])
       → 0 créations, 0 suppressions, K déplacements (insertBefore)
       → 50 update() avec guards → N mutations textContent (0 si rien n'a changé)
       ✅ Optimal : seuls les déplacements DOM nécessaires

T3 ─── Filtre « Électronique » ─────────────────────────────
       User click → trigger('catalog:setFilter', { taxonomy: 'electronics' })
       Feature → mutate(filters) → emit('any', { changes: { filters } })
       View → selector → deriveVisibleProducts() → [p17, p42, ...] (20 items)
       ProjectionList.reconcile([p17, p42, ...])
       → 0 créations, 30 suppressions (remove), K déplacements
       → 20 update() avec guards
       ✅ Optimal : seuls les items filtrés sont supprimés

T4 ─── Retrait filtre ──────────────────────────────────────
       Feature → mutate(filters: {}) → emit('any')
       View → selector → 50 items
       ProjectionList.reconcile([p01, ..., p50])
       → 30 créations (itemCreate), 0 suppressions, K déplacements
       → 50 update()
       ✅ Items recréés via itemCreate() — coût identique au VDOM
```

### Réponse à la question : « En PDR, c'est plus obscur ? »

**Non.** Le flux PDR pour le filtre/tri est :

1. **L'Entity stocke les critères** (pas les items dérivés) → 1 patch
2. **Le selector dans la View calcule la dérivée** (filtre + tri) → liste ordonnée
3. **`ProjectionList.reconcile()` reçoit la liste dans le bon ordre** et :
   - Déplace les items existants (par clé)
   - Supprime les items absents
   - Crée les items nouveaux
4. **Les guards per-nœud** évitent les mutations inutiles sur le contenu textuel

C'est **exactement** ce qu'un VDOM fait, moins la construction et le diff de deux arbres virtuels. L'algorithme de réconciliation keyed de `ProjectionList` **est** l'équivalent du keyed diff d'un VDOM — mais sans l'arbre intermédiaire.

> **Analogie** : Un VDOM est comme un GPS qui recalcule l'itinéraire complet à chaque virage.
> PDR est comme un GPS qui ne recalcule que la portion modifiée de l'itinéraire.
> Le résultat (les instructions de conduite) est le même. Le coût de calcul est différent.

---

## Décision

Nous choisissons **Option B — PDR chirurgicale** comme stratégie de rendu **unique et définitive** de Bonsai.

### Justification principale

#### 1. Cohérence totale avec le corpus existant

L'Option B est **déjà intégralement spécifiée** dans le corpus :
- D19 pose l'hypothèse fondatrice (DOM préexiste)
- RFC-0002 §9.4 définit le contrat PDR
- RFC-0003 définit le compilateur, `ProjectionList`, les selectors
- ADR-0014 formalise l'hydratation SSR
- ADR-0012 couvre la virtualisation
- D42 formalise le mécanisme de souscription `any` + selectors

Choisir le VDOM (Option A ou C) **invaliderait** une partie significative de ce corpus et nécessiterait de réécrire D19, I31, I39, I41, ADR-0014, et les sections 5-7 de RFC-0003.

#### 2. Le cas filtre/tri est parfaitement couvert

Comme démontré ci-dessus (§ cas d'usage critique) :
- Les opérations DOM finales sont **strictement identiques** entre VDOM et PDR
- `ProjectionList.reconcile()` est l'équivalent algorithmique du keyed diff d'un VDOM
- La complexité est O(n) dans les deux cas
- PDR a un overhead mémoire **nul** (pas d'arbres VNode à construire/GC)

#### 3. Incompatibilité structurelle du VDOM avec les invariants Bonsai

| Invariant | VDOM global (A) | VDOM local (C) | PDR (B) |
|-----------|-----------------|-----------------|---------|
| D19 (DOM préexiste) | ❌ VDOM = copie | ⚠️ Copie partielle | ✅ DOM = source |
| I31 (rootElement existe) | ⚠️ vnodeFromDom | ⚠️ vnodeFromDom | ✅ setup() localise |
| I38 (niveaux N1/N2/N3) | ❌ Tout passe par re-render | ⚠️ N1 découplé mais N2/N3 via VDOM | ✅ Chaque niveau distinct |
| I39 (accès via getUI) | ❌ VDOM parcourt le DOM | ⚠️ vnodeFromDom parcourt | ✅ setup() conforme |
| I41 (source unique) | ❌ Diff engine = source | ⚠️ Deux sources coexistent | ✅ Template unique |
| I45 (Behavior 60fps) | ❌ Re-render à 60fps | ✅ N1 découplé | ✅ N1 découplé |
| ADR-0014 H2 | ❌ setup() ≠ hydratation | ⚠️ setup() modifié | ✅ setup() = hydratation |

#### 4. Le VDOM est un outil de réconciliation — `ProjectionList` en est un meilleur

Le bénéfice réel d'un VDOM est son **algorithme de réconciliation keyed**. `ProjectionList` fournit exactement ce bénéfice, sans l'overhead :

| Capacité | VDOM keyed diff | ProjectionList.reconcile() |
|----------|-----------------|---------------------------|
| Insertion | ✅ | ✅ |
| Suppression | ✅ | ✅ |
| Réordonnancement | ✅ | ✅ (insertBefore) |
| Mise à jour de contenu | ✅ (diff récursif) | ✅ (guards per-nœud) |
| Complexité | O(n) | O(n) |
| Allocation mémoire | 2 arbres VNode | 0 (Map en place) |
| Callbacks lifecycle (onInsert, onRemove, onMove) | Via hooks VNode | ✅ Natif |

#### 5. Identité de Bonsai

Un VDOM transformerait Bonsai en « un framework de plus » parmi React/Vue/Solid — moins optimisé, moins mature, moins soutenu. PDR est l'**identité architecturale** de Bonsai : mutations chirurgicales sur DOM préexistant, zéro copie, zéro overhead intermédiaire.

### Rejet de l'Option A — VDOM global

- Viole D19, I39, I41 — nécessiterait de réécrire les fondations
- Incompatible avec les Behaviors 60fps (I45)
- `ProjectionList` deviendrait redondante → confusion DX
- Overhead mémoire et GC sans bénéfice proportionnel
- Perd l'identité de Bonsai (PDR)
- Hydratation SSR fragile (vnodeFromDom + mismatch)

### Rejet de l'Option C — VDOM local par template

L'Option C est la plus séduisante car elle semble offrir le « meilleur des deux mondes ». En réalité, elle introduit le **pire des deux mondes** :

- **Deux modèles de rendu** coexistent : N1 direct + VDOM local → le développeur (et le compilateur) doivent savoir lequel s'applique quand
- **Deux algorithmes de réconciliation** : VDOM keyed diff + ProjectionList → quelle liste utilise quel algorithme ?
- **`setup()` change de sémantique** : ne localise plus les nœuds, construit un VNode → ADR-0014 H2 partiellement invalidé
- **Aucun bénéfice mesurable** : comme démontré, les opérations DOM finales sont identiques. Le « safety net » du diff est un faux avantage — si le compilateur PDR est correct (et il est vérifiable au build-time), les guards per-nœud sont tout aussi sûrs qu'un diff

Le confort cognitif du « diff me protège » ne justifie pas la complexité d'un modèle hybride.

---

## Réponse aux questions subsidiaires

### Q1 — Que stocke-t-on dans l'Entity ?

**Règle normative (renforce RFC-0003 §6.5-6.6)** :

| Donnée | Stockage | Muté par |
|--------|----------|----------|
| **Items bruts** (`items: TProduct[]`) | ✅ Entity | CRUD serveur (rare) |
| **Critères de tri** (`sortCriteria`) | ✅ Entity | UI (fréquent) |
| **Critères de filtre** (`filters`) | ✅ Entity | UI (fréquent) |
| **Items dérivés** (filtrés + triés) | ❌ **JAMAIS dans l'Entity** | Calculé dans le selector de la View |

**Justification** :
- Un changement de tri génère **1 patch** (`sortCriteria`) au lieu de **50 patches** (items réordonnés)
- La liste dérivée est une **projection**, pas un **état** — elle vit dans le selector, pas dans l'Entity
- Compatible Event Sourcing : l'événement est « critère changé », pas « 50 items déplacés »
- Pas de risque de désynchronisation entre items bruts et items dérivés

**Exception : `localState` pour les critères ?**

Si les critères de tri/filtre sont **purement locaux** à la View (pas besoin d'URL sync, pas besoin de persistance, pas besoin d'accès depuis une autre Feature) :

```typescript
// ✅ Critères dans localState (cas simple, mono-View)
class ProductCatalogView extends View<[Catalog.Channel], TLocalState> {
  get localState(): TLocalState {
    return {
      sortField: 'date' as const,
      sortOrder: 'desc' as const,
      taxonomyFilter: null,
    };
  }
  
  get templates() {
    return {
      products: {
        template: ProductListTemplate,
        select: (data) => {
          const items = data.catalog?.items;
          const sort = data.local;  // localState (I57)
          if (!items || !sort) return undefined;
          return this.deriveVisibleProducts(items, sort);
        },
      },
    };
  }
}
```

```typescript
// ✅ Critères dans Entity (cas avancé : URL sync, multi-View, persistance)
// Le CatalogFeature gère les critères comme du domain state.
// Nécessaire si : l'URL reflète le filtre, une sidebar affiche le filtre actif,
// les analytics trackent les filtres, etc.
```

**Critère de décision** (arbre I42) :
- Les critères intéressent un autre composant ? → Entity
- Les critères doivent survivre au unmount ? → Entity
- Sinon → localState suffit

### Q2 — Le Render Contract PDR est-il complet ?

**Pas encore totalement.** Deux éléments manquent dans le corpus et doivent être formalisés :

1. **Accès au state complet dans le selector** : ~~RFC-0003 §7.1 spécifie que `any` contient les « clés changées ».~~ **Résolu (D46 FULL-STATE-SELECTOR)** : le framework passe le state complet par référence live dans `NamespacedData`. Le selector a toujours accès à l'intégralité du state de chaque Channel.

2. **Render Contract unifié** : le corpus couvre le rendu par morceaux (`setup`, `project`, `create`, `ProjectionList`, selectors, `shallowEqual`) mais il manque un document qui décrit **le cycle de rendu complet de bout en bout** (du `any` émis au DOM muté). Ce document existe *de facto* dans RFC-0003 §7.5 (`attachView`) mais mérite une section normative dédiée. **À extraire dans RFC-0003.**

---

## Conséquences

### Positives

- ✅ **Décision définitive** — l'hésitation VDOM est close. PDR est le modèle unique de Bonsai.
- ✅ **Corpus préservé** — aucune RFC, aucun ADR, aucun invariant n'est invalidé.
- ✅ **Identité affirmée** — Bonsai se distingue clairement de React/Vue/Solid par son approche PDR.
- ✅ **Filtre/tri SSR couvert** — `ProjectionList.reconcile()` gère le cas avec des performances optimales.
- ✅ **Règle Entity clarifiée** — stockage des critères (pas des dérivées) formalisé.
- ✅ **Bundle minimal** — pas de dépendance VDOM.

### Négatives (acceptées)

- ⚠️ **DX moins « familière »** — les développeurs venant de React/Vue devront comprendre le modèle PDR (setup/project/reconcile) au lieu du modèle VDOM (render → diff → patch). Mitigation : documentation, exemples, et le fait que le compilateur PugX génère le code PDR — le développeur écrit du Pug, pas du `reconcile()`.
- ⚠️ **Compilateur plus complexe** — le compilateur doit générer des guards per-nœud (`if (textContent !== val)`) au lieu de simplement émettre des `h()`. Mitigation : la complexité est dans le compilateur (build-time), pas dans le runtime ni dans le code utilisateur.
- ⚠️ **Pas de « safety net » du diff** — si le compilateur génère du code incorrect, le DOM peut diverger. Mitigation : tests du compilateur, validation build-time, DevTools.

### Invariants impactés

| Invariant | Impact |
|-----------|--------|
| D19 | ✅ Confirmé et renforcé — PDR est définitif |
| I38 | ✅ Confirmé — les trois niveaux N1/N2/N3 restent distincts |
| I41 | ✅ Confirmé — source de mutation unique par @ui |

### RFCs impactées

| RFC | Action | Statut |
|-----|--------|--------|
| RFC-0003 | Ajouté §7bis « Render Contract complet » — cycle `any` → selector → shallowEqual → project → guards → DOM | ✅ Fait |
| RFC-0003 §6.5-6.6 | Renforcé la règle « critères dans Entity, dérivées dans selector » (D47 NO-DERIVED-STATE) | ✅ Fait |
| RFC-0003 §6.1 | Formalisé la signature `update(itemNodes, item, index)` avec contrat normatif | ✅ Fait |
| RFC-0003 §7.1, §7.4 | Intégré D46 (FULL-STATE-SELECTOR) : `NamespacedData` = state complet par ref live | ✅ Fait |
| RFC-0003 §7.5 | Formalisé le schéma SSR/setup (T0→T4) en version normative condensée | ✅ Fait |
| RFC-0001-invariants-decisions | Ajouté D46, D47 dans l'historique des décisions | ✅ Fait |

### ADRs impactées

| ADR | Impact |
|-----|--------|
| ADR-0014 | ✅ Non impacté — H1-H5 restent valides |
| ADR-0012 | ✅ Non impacté — `VirtualizedList` comme API séparée reste valide |

---

## Questions résolues

### ✅ Q1 — Accès au state complet dans le selector (résolu : Q1-B)

**Problème** : Le selector de filtre/tri a besoin du state complet (items + critères), pas seulement des clés changées par le dernier Event.

**Décision → D46 (FULL-STATE-SELECTOR)** : Le framework passe toujours le **state complet** de chaque Channel dans `NamespacedData`, pas seulement les clés changées. Le payload `any` continue de contenir les `changes` pour l'optimisation interne (skip `shallowEqual`), mais le selector de la View reçoit une **référence live** vers le state complet de l'Entity.

```typescript
// Le framework construit NamespacedData avec le state COMPLET,
// pas juste les changes du dernier Event.
// C'est une référence live (frozen) — pas de copie, pas de coût.

select: (data) => {
  const full = data.catalog;  // State complet de l'Entity Catalog (frozen ref)
  // full.items, full.sortCriteria, full.filters — tout est accessible
  if (!full) return undefined;
  return this.deriveVisibleProducts(full);
}
```

**Justification** :
- **DX la moins surprenante** : `data.catalog` retourne le state, point. Pas de `$changes` ni de getter exotique.
- **Zéro coût** : le framework passe une référence vers le state frozen de l'Entity, pas une copie. L'Entity est déjà immutable (Immer) — la référence est safe.
- **Compatible avec le skip** : le framework utilise `shallowEqual` sur la **sortie du selector** (pas sur l'input). Si le selector retourne la même liste dérivée, la projection est skippée.
- **Rétrocompatible** : les selectors simples (`data.catalog?.items`) fonctionnent sans changement.

**Impact** : RFC-0003 §7.1, §7.4, §7.5 — le payload `NamespacedData` passe le state complet.

### ✅ Q2 — Recréation vs recyclage des items filtrés (résolu : Q2-A)

**Problème** : Quand un filtre est retiré, les items supprimés doivent être recréés via `itemCreate()`. Faut-il un pool de recyclage ?

**Décision** : Pas de pool — `itemCreate()` est le seul mécanisme de création.

**Justification** :
- **Simplicité** : Bonsai est un framework généraliste, pas un moteur de jeu. Un pool introduit de la complexité (invalidation, sizing, lifecycle) disproportionnée pour le bénéfice.
- **`VirtualizedList`** (ADR-0012) couvre les cas haute fréquence. Si la recréation de 30 `<li>` pose un problème de performance, la réponse est la virtualisation, pas le pooling.
- **Le coût de `itemCreate()`** est faible pour des éléments simples. Le bottleneck est le layout/paint du navigateur, pas la création DOM.
- **Maintenabilité** : un seul chemin de création = un seul endroit à débugger.

**Impact** : Aucun — RFC-0003 §6 et ADR-0012 restent inchangés.

---

## Références

- [RFC-0001 Architecture Fondamentale](../rfc/1-philosophie.md) — Principes fondateurs
- [RFC-0001 Invariants et Décisions](../rfc/reference/invariants.md) — D19, I31, I38, I39, I41
- [RFC-0002 §9.4 — PDR](../rfc/6-transversal/conventions-typage.md) — Contrat de base
- [RFC-0003 — Rendu Avancé](../rfc/5-rendu.md) — Compilateur, ProjectionList, selectors
- [RFC-0003 §6.5-6.6](../rfc/5-rendu.md) — Anti-pattern mutation données pour filtre/tri
- [ADR-0012 — Virtualized Lists](ADR-0012-virtualized-list.md) — API séparée
- [ADR-0014 — SSR Hydration](ADR-0014-ssr-hydration-strategy.md) — H1-H5
- [ADR-0015 — localState](ADR-0015-local-state-mechanism.md) — Mécanisme pour critères locaux
- [Snabbdom](https://github.com/snabbdom/snabbdom) — Référence VDOM (rejeté)
- [Lit](https://lit.dev/) — Approche template result (inspiration pour Option C)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-26 | Création (Proposed) — formalisation de la décision VDOM vs PDR |
| 2026-03-26 | **Accepted** — Q1 résolu (Q1-B : state complet par ref live → D46), Q2 résolu (Q2-A : pas de pool) |
