# ADR-10 — Entity : mutation Immer, notification par patches, pas de state dérivé

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I46, I52, I97, I98 |
| **Livré** | ✅ · ⏳ `toJSON`/`fromJSON`/`populateFromServer` (strate 2, ADR-24) |
| **Spec** | [entity.md](../spec/3-couche-abstraite/entity.md) · [state.md](../spec/2-architecture/state.md) |

## Contexte

L'Entity détient le domain state d'une Feature. Chaque mutation doit être
traçable (intention métier), produire une notification précise (quelles clés
ont changé) pour alimenter la réactivité, et rester compatible avec undo/redo,
DevTools et un éventuel event sourcing — sans magie exposée au développeur.

## Décision

**State JSON-sérialisable** (I46) : `Entity<TStructure extends TJsonSerializable>`.
Pas de `Date`, `Map`, `Set`, classe ni fonction. Le state initial est fourni par
`protected abstract defineInitialState()`, et `initialState` reste lisible pour
un reset ou une comparaison.

**Une seule API d'écriture**, discriminant en premier :

```ts
this.entity.mutate("cart:addItem", { payload, metas }, draft => {
  draft.items.push(payload.item);
});
```

- Implémentation `Immer.produceWithPatches`. Le `TEntityEvent` retourné porte `intent`, `payload`, `metas`, `changedKeys` (1er segment des paths), `patches`, `inversePatches`, `previousState`, `nextState`, `timestamp` (I97).
- **No-op** (aucun patch) : ni notification ni event, `mutate()` retourne `null`.
- **Recipe qui throw** : `MutationError`, state intact (rollback Immer).
- **Ré-entrance** : une mutation déclenchée pendant une notification est mise en **file FIFO** et exécutée dans son propre cycle. Au-delà de `maxEntityNotificationDepth` (défaut 3, `protected get` overridable), `mutate()` lève `EntityReentrancyError` (I98) : elle se propage à l'appelant tant que le listener est un `onAnyEntityUpdated` brut de l'Entity ; dans un handler de Feature (`on<Key>EntityUpdated`, `onAnyEntityUpdated`), le dispatch de la Feature l'attrape et la journalise en `BroadcastError` (ADR-05).
- **Écoute** : un seul listener catch-all `onAnyEntityUpdated()`. Le routage par clé est fait par la Feature (ADR-09).

**Lecture** : `state` est en lecture seule. L'Entity peut exposer des méthodes
query pures pour les repliers de sa Feature (I52).

**Pas de state dérivé** : l'Entity stocke les données brutes et les critères
(`sortCriteria`, `filters`, `page`), jamais la liste filtrée, triée ou paginée.
La dérivation est une projection calculée côté View. Un changement de tri produit
un patch, pas N.

## Alternatives rejetées

- **Snapshot + deep diff** — coût O(n) à chaque mutation, aucune intention métier.
- **Proxy ES6 + dirty tracking** — magie exposée, fuites de proxy hors du scope de mutation.
- **Mutations explicites + dirty flags manuels** — verbeux, oubli silencieux d'un flag.
- **API hybride `set()` + `mutate()`** — deux chemins d'écriture pour une seule garantie.
- **Stocker les données dérivées** — explosion de patches, désynchronisation brut/dérivé, sémantique fausse (seule la présentation change).

## Conséquences

- Dépendance Immer (inlinée dans le bundle, `@bonsai/immer`), acceptée pour la valeur des patches.
- Intent verbeux mais porteur de sens : c'est la clé de l'audit, des DevTools et de l'undo (`inversePatches`). Typage de l'intent : question ouverte (ADR-12).
- Seule la Feature propriétaire mute son Entity (I6) : `entity` est `protected` côté Feature, absent des Views et Behaviors.
