# ADR-23 — Listes : `ProjectionList` + délégation d'événements, `VirtualizedList` séparée

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⏳ strate 1c (`ProjectionList`) et au-delà (`VirtualizedList`) |
| **Spec** | [5-rendu.md §6](../spec/5-rendu.md) |

## Contexte

Les listes dynamiques sont le cas de rendu le plus fréquent et le plus coûteux :
insertion, suppression, réordonnancement, 1000+ éléments, un handler par
ligne. Plusieurs mécanismes étaient envisageables (child Views par item,
`CollectionComposer`, fragment dédié) ; il en faut **un** par défaut, et une
réponse séparée pour les volumes extrêmes.

## Décision

**Pattern canonique : `ProjectionList` + délégation d'événements.**

```pug
ul.Cart-items(@ui="items")
  each item in items
    li.Cart-item(data-item-id=item.id)
      span.name= item.name
```

- `ProjectionList.reconcile({ items, key, create, update, remove })` : réconciliation par clé en O(n), déplacements par `insertBefore`, mises à jour gardées par nœud.
- En SSR, les enfants existants sont **adoptés** via leur attribut de clé (`keyAttr`, ex. `data-item-id`), pas recréés (ADR-24).
- **Un seul listener** sur le conteneur (délégation), pas un par ligne.
- Les **child Views** via slots + Composers sont réservées aux items qui sont de vrais composants autonomes (cycle de vie, Channels propres).

**`VirtualizedList` est une API distincte**, opt-in (`@virtualized`) : suivi du
viewport, gestion du scroll, placeholders, tampon avant/après. `ProjectionList`
reste simple pour les ~90 % de cas courants.

## Alternatives rejetées

- **Child View par item** comme mécanisme par défaut — coût de cycle de vie disproportionné pour une ligne.
- **`CollectionComposer`** — un type de Composer de plus (ADR-18) pour un besoin de rendu.
- **`ViewFragment` dédié** — abstraction redondante avec `ProjectionList`.
- **Virtualisation intégrée à `ProjectionList`** (option) — alourdit le cas simple pour un cas minoritaire.
- **Pool de recyclage** — voir ADR-22.

## Conséquences

- Un seul chemin de création d'item (`create`) : un seul endroit à déboguer.
- Le filtre/tri se fait dans le selector (ADR-22) et aboutit à un `reconcile()`.
- Passer d'une liste simple à une liste virtualisée change l'API utilisée : choix explicite.
