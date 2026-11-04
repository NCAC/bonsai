# ADR-10 — Entity : mutation Immer, notification par patches, pas de state dérivé

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I46, I52, I97, I98 |
| **Livré** | ✅ · ⏳ `toJSON`/`fromJSON`/`populateFromServer` (strate 2, ADR-24) |
| **Spec** | [entity.md](../spec/3-couche-abstraite/entity.md) · [state.md](../spec/2-architecture/state.md) |

## Contexte

L'Entity décrit le domain state d'une Feature. Chaque mutation doit être
traçable (intention métier), produire une notification précise (quelles clés
ont changé) pour alimenter la réactivité, être annulable avec son unité (G7)
et rester compatible avec undo/redo, DevTools et un éventuel event sourcing.

## Décision

**State JSON-sérialisable** (I46) : `Entity<TStructure extends TJsonSerializable>`.
Pas de `Date`, `Map`, `Set`, classe ni fonction. L'état initial est fourni par
`protected abstract defineInitialState()` ; `initialState` reste lisible.

**Le noyau détient l'état** : l'Entity le décrit (état initial, invariants,
méthodes de lecture) mais ne le contient pas et n'a pas de `mutate`.
**Une seule API d'écriture**, le contexte d'un handler de la Feature propriétaire :

```ts
ctx.mutate("addItem", { payload }, (draft) => {
  draft.items.push(payload.item);
});
```

- Implémentation `Immer.produceWithPatches` (I97). Le `TEntityEvent` rendu porte `intent`, `payload`, `metas`, `changedKeys` (1er segment des paths), `patches`, `inversePatches`, `previousState`, `nextState`, `timestamp`.
- **Sans effet** (aucun patch) : ni notification, `mutate()` rend `null`.
- **Annulation** : la mutation est journalisée dans l'unité ; une recette qui lève, un invariant violé à la fin de l'unité (`InvariantError`, A4.a) ou tout autre échec restaure l'état (G7).
- **Notification différée** (I98) : chaque mutation effective envoie à la Feature un message local, délivré après la validation de l'unité, dans sa propre unité ; une mutation faite pendant une notification produit la sienne, bornée par la profondeur causale (D9).

**Lecture** : `entity.state`, gelé, n'est lisible que pendant un handler de la
Feature ; hors handler, l'état s'observe par une Query (G5). L'Entity expose des
méthodes de lecture pures pour les Queries de sa Feature (I52).

**Pas de state dérivé** : l'Entity stocke les données brutes et les critères
(`sortCriteria`, `filters`, `page`), jamais la liste filtrée, triée ou paginée.

## Alternatives rejetées

- **Snapshot + deep diff** — coût O(n) à chaque mutation, aucune intention métier.
- **Proxy ES6 + dirty tracking** — magie exposée, fuites de proxy hors du scope de mutation.
- **`entity.mutate()` sur l'Entity elle-même** (strate 0) — mutation possible hors unité, sans annulation ; contraire à A5.a et G7.
- **File FIFO de ré-entrance propre à l'Entity et `EntityReentrancyError`** (strate 1a) — doublait la file différée du noyau et sa borne D9.
- **Stocker les données dérivées** — explosion de patches, désynchronisation brut/dérivé.

## Conséquences

- Dépendance Immer (inlinée dans le bundle, `@bonsai/immer`), acceptée pour la valeur des patches.
- Intent porteur de sens : c'est la clé de l'audit, des DevTools et de l'undo (`inversePatches`). Typage de l'intent : question ouverte (ADR-12).
- Seule la Feature propriétaire mute son Entity (I6) : `entity` est `protected` côté Feature, absent des Views et Behaviors.
