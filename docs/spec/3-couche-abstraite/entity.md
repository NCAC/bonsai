# Entity

> **Description de l'état d'une Feature : état initial, invariants, lectures. Le noyau détient l'état.**

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lot M6.1, 1er novembre 2026).** Hors périmètre : schema Valibot, snapshot, Event Sourcing (§7). En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

[← Retour à la couche abstraite](README.md) · [Feature](feature.md) · [Application](application.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Entity |
| **Couche** | Abstraite (persistante) |
| **Paquet** | `@bonsai/entity` |
| **Décisions** | [ADR-10](../../adr/ADR-10-entity-mutation.md) (mutation), [ADR-11](../../adr/ADR-11-entity-schema-valibot.md) (schema, cible), [ADR-12](../../adr/ADR-12-entity-intent-typing.md) (intent, 🟡), [ADR-04](../../adr/ADR-04-metas-explicites.md) (contexte causal) ; théorie 11.3, A4.a, D4 |

## Table des matières

1. [Rôle](#1-rôle)
2. [Le state](#2-le-state)
3. [Écrire : `ctx.mutate`](#3-écrire--ctxmutate)
4. [Lire](#4-lire)
5. [Invariants](#5-invariants)
6. [Notifications](#6-notifications)
7. [Non livré](#7-non-livré)

---

## 1. Rôle

L'Entity **décrit** l'état du domaine d'une Feature ; elle ne le détient pas. Le **noyau** crée l'état à partir de `defineInitialState()`, le modifie seulement dans une unité de validation (`ctx.mutate`), le journalise (G7) et vérifie les invariants à la fin de l'unité (A4.a).

- Une Feature a **exactement une** Entity (D4, I22) ; l'Entity ne connaît pas sa Feature (I6).
- L'Entity ne contient **aucun état mutable** et n'a pas de méthode `mutate` : une mutation hors unité n'est pas exprimable (A5.a).
- L'état est **gelé en profondeur** ; le modifier autrement que par `ctx.mutate` est impossible.

## 2. Le state

```typescript
type TCartState = { items: TCartItem[]; total: number };   // `type`, pas `interface` (I46)

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}
```

- `TStructure extends TJsonSerializable` (I46) : chaînes, nombres, booléens, `null`, tableaux et objets simples. Ni classe, ni fonction, ni `Date`, `Map`, `Set`. Une `interface` est rejetée (pas de signature d'index implicite) : déclarer l'état par `type`.
- Limites du type : les cycles ne sont pas détectables à la compilation, et les champs `undefined` ou optionnels, supprimés par `JSON.stringify`, sont à éviter par revue.
- `TEntityState<E>` extrait le type du state d'une classe d'Entity.
- `initialState` renvoie la copie de l'état initial prise à la construction (ADR-10).

## 3. Écrire : `ctx.mutate`

Seul un handler de la Feature propriétaire écrit, par son contexte ([feature.md §3](feature.md#3-handlers-et-contextes)) :

```typescript
onAddItemCommand(payload: TCartItem, ctx: TFeatureContext<TCartChannelDef, CartEntity>): void {
  const event = ctx.mutate("addItem", (draft) => {
    draft.items.push(payload);
    draft.total += payload.price * payload.qty;
  });
  // event : TEntityEvent | null
}
```

- Deux formes : `mutate(intent, recipe)` et `mutate(intent, { payload? }, recipe)` (ADR-10).
- La recette s'applique à un brouillon Immer ; le résultat est un nouvel état gelé.
- **Sans effet** : une recette qui ne change rien renvoie `null`, ne modifie pas l'état et ne notifie personne.
- **Annulation** : si l'unité échoue (une recette qui lève, un invariant violé, un autre handler qui lève), l'état est restauré tel qu'il était (G7) ; l'erreur est celle de la recette.
- Le retour est un `TEntityEvent` :

```typescript
type TEntityEvent<S> = {
  intent: string; payload?: unknown;
  context: TCausalContext;          // contexte causal de l'unité, posé par le noyau (ADR-04)
  changedKeys: string[];
  patches: Patch[]; inversePatches: Patch[];
  previousState: S; nextState: S;
  timestamp: number;
};
```

## 4. Lire

`entity.state` est lisible **seulement pendant un handler de la Feature propriétaire** ; ailleurs il lève une erreur explicite (le state courant s'observe par une Query, G5). Les méthodes de lecture de l'Entity s'appuient sur lui :

```typescript
class CartEntity extends Entity<TCartState> {
  get query() {
    return {
      getTotal: () => this.state.total,
      getItemCount: () => this.state.items.length
    };
  }
}

// dans la Feature
onGetItemCountQuery(_params: null, _ctx: TFeatureQueryContext): number {
  return this.entity.query.getItemCount();
}
```

Une méthode de lecture est pure et ne retourne que du jsonifiable ou un dérivé de l'état ; elle ne mute rien. Pendant une Query, l'état lu est celui de l'unité en cours si elle l'a modifié (G7), sinon l'état validé.

## 5. Invariants

```typescript
override get invariants() {
  return [{ name: "total-never-negative", check: (s: TCartState) => s.total >= 0 }];
}
```

Chaque invariant `{ name, check(state) }` est vérifié **à la fin de toute unité qui a touché l'état** et à la fin du démarrage. Une violation fait échouer l'unité (`InvariantError`) : tout est annulé. Une violation intermédiaire réparée avant la fin est acceptée.

## 6. Notifications

Le noyau ne notifie personne directement. Chaque mutation effective envoie à la **Feature** un message local différé (G5, D8), que celle-ci reçoit dans `on<Clé>EntityUpdated(previous, next, patches, ctx)` puis `onAnyEntityUpdated(event, ctx)` ([feature.md §4](feature.md#4-lentity-et-ses-notifications)). Aucun autre composant ne s'abonne à une Entity : il écoute l'Event que la Feature décide d'émettre (A3.e).

| Ancien mécanisme | Aujourd'hui |
| --- | --- |
| `entity.mutate(…)` | `ctx.mutate(…)` |
| `entity.onAnyEntityUpdated(listener)` | handlers de la Feature, message local différé |
| File FIFO de ré-entrance et profondeur maximale (I98) | file différée du noyau, borne causale D9 |
| `MutationError`, `EntityReentrancyError`, `BroadcastError` (supprimées, ADR-05) | l'erreur de la recette ; échec de l'unité ; un handler de notification qui lève échoue seul |

## 7. Non livré

| Élément | Statut |
| --- | --- |
| Schema de validation Valibot de l'état ([ADR-11](../../adr/ADR-11-entity-schema-valibot.md)) | Cible : les règles métier passent aujourd'hui par `invariants` |
| `toJSON`, `fromJSON`, `populateFromServer` (snapshot, SSR, [ADR-24](../../adr/ADR-24-hydratation-ssr.md)) | Cible |
| Event Sourcing (`eventLog`, replay) : `TEntityEvent` porte déjà `patches` et `inversePatches` | Cible |
| Typage de l'`intent` ([ADR-12](../../adr/ADR-12-entity-intent-typing.md)) | Proposé |

---

## Lecture suivante

→ [Application](application.md) — démarrage et Manifest
