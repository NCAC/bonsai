# ADR-0012 : Virtualized Lists

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-19 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0003](../rfc/5-rendu.md) §6, §11 (D40) |

---

## Contexte

Les listes avec un grand nombre d'items (1000+) posent des problèmes de performance :

| Items | Nœuds DOM (~10/item) | Problèmes |
|-------|----------------------|-----------|
| 50 | 500 | ✅ Aucun |
| 200 | 2 000 | ⚠️ Rendu initial lent |
| 1 000 | 10 000 | ❌ Scroll saccadé, mémoire |
| 10 000 | 100 000 | ❌ Inutilisable |

**La virtualisation** consiste à ne rendre que les items visibles dans le viewport,
plus un buffer de quelques items au-dessus/en-dessous.

### Question

`ProjectionList` (RFC-0003 §6) doit-elle gérer la virtualisation ?

---

## Décision

**Option A : `VirtualizedList` est une API séparée.**

`ProjectionList` reste simple et gère 90% des cas d'usage.
`VirtualizedList` est une classe distincte, opt-in, pour les listes volumineuses.

---

## Justification

### Séparation des concerns

| Classe | Responsabilité | Complexité |
|--------|----------------|------------|
| `ProjectionList` | Réconciliation keyed | Simple |
| `VirtualizedList` | Réconciliation + viewport tracking + scroll handling | Complexe |

Mélanger les deux alourdirait `ProjectionList` pour un cas d'usage minoritaire.

### Opt-in explicite

Le développeur sait ce qu'il utilise :

```pug
//- Liste simple (90% des cas)
ul.Cart-items(@ui="items")
  each item in items
    li.Cart-item(data-item-id=item.id)

//- Liste virtualisée (cas spécifiques)
ul.Feed-posts(@ui="posts" @virtualized)
  each post in posts
    li.Feed-post(data-item-id=post.id)
```

### Complexité de la virtualisation

La virtualisation nécessite :
- Calcul de la hauteur des items (fixe ou variable)
- Gestion du scroll (throttling, direction)
- Placeholder pour maintenir la hauteur totale
- Buffer au-dessus/en-dessous du viewport
- Recyclage des nœuds DOM (optionnel)

Cette complexité ne doit pas polluer `ProjectionList`.

---

## Conséquences

### Positives

- `ProjectionList` reste simple et performante pour les cas courants
- API claire : le dev choisit explicitement la virtualisation
- Évolution indépendante des deux classes

### Négatives

- Deux APIs à apprendre (si besoin de virtualisation)
- Migration `ProjectionList` → `VirtualizedList` si les données grossissent

### Neutres

- La directive `@virtualized` dans le template Pug déclenche l'utilisation de `VirtualizedList`

---

## Implémentation (esquisse)

### API `VirtualizedList`

```typescript
class VirtualizedList<TItem, TItemNodes> {
  constructor(
    container: HTMLElement,
    options: TVirtualizedListOptions<TItem, TItemNodes>
  );
  
  /**
   * Met à jour les données. Recalcule les items visibles.
   */
  setItems(items: TItem[]): void;
  
  /**
   * Force un recalcul du viewport (après resize, etc.)
   */
  refresh(): void;
  
  /**
   * Scroll vers un item par sa clé.
   */
  scrollToItem(key: string, position?: 'start' | 'center' | 'end'): void;
  
  dispose(): void;
}

type TVirtualizedListOptions<TItem, TItemNodes> = {
  // Hauteur d'un item (fixe) ou fonction (variable)
  itemHeight: number | ((item: TItem) => number);
  
  // Nombre d'items à rendre au-dessus/en-dessous du viewport
  overscan?: number;  // default: 3
  
  // Hérité de TProjectionListOptions
  keyAttr: string;
  itemSetup: (el: HTMLElement) => TItemNodes;
  itemCreate: (item: TItem) => HTMLElement;
}
```

### Utilisation dans la View

```typescript
class FeedView extends View {
  get templates() {
    return {
      posts: {
        template: FeedPostsTemplate,
        select: (data) => data.feed?.posts,
        virtualized: {
          itemHeight: 120,  // ou (post) => post.hasImage ? 300 : 120
          overscan: 5,
        },
      },
    };
  }
}
```

### Template Pug

```pug
//- La directive @virtualized indique au compilateur d'utiliser VirtualizedList
ul.Feed-posts(@ui="posts" @virtualized)
  each post in posts
    li.Feed-post(data-item-id=post.id)
      //- ...
```

---

## Cas d'usage

| Cas | API recommandée |
|-----|-----------------|
| Panier (5-20 items) | `ProjectionList` |
| Liste produits (50-200) | `ProjectionList` |
| Sélecteur pays (~200) | `ProjectionList` |
| Feed social (1000+) | `VirtualizedList` |
| Tableau données (10 000+) | `VirtualizedList` |
| Logs en temps réel | `VirtualizedList` |

---

## Alternatives rejetées

### Option B : `ProjectionList` avec `virtualize: true`

**Rejeté** : Ajoute de la complexité à `ProjectionList` pour un cas minoritaire.
Le flag `virtualize` rendrait le code conditionnel partout.

### Option C : Reporté

**Rejeté** : La question est tranchée maintenant pour clarifier l'architecture.
L'implémentation de `VirtualizedList` peut être reportée, mais la décision est prise.

---

## Références

- [RFC-0003 §6 — ProjectionList](../rfc/5-rendu.md)
- [react-window](https://github.com/bvaughn/react-window) — Virtualisation React
- [Lit virtualizer](https://github.com/nickel-chrome/lit-virtualizer)
- [Tanstack Virtual](https://tanstack.com/virtual/latest)
