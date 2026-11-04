# ADR-09 — Contrat Feature : `Feature<TEntity, TChannelDef, TSelfNS>`

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I48, I51, I74, I88, I92, I93, I94, I95, I96 |
| **Livré** | ✅ · ⏳ contexte causal lisible par les handlers (strate 1b, ADR-04) |
| **Spec** | [feature.md](../spec/3-couche-abstraite/feature.md) |

## Contexte

La Feature est l'unité métier : elle possède un Channel, une Entity, et réagit
aux messages. Son contrat doit être **complet au compile-time** : un handler
oublié, un `listens` absent ou une Entity mal liée doivent échouer à la
compilation, pas en production — avec la même mécanique que la View (ADR-14).

## Décision

```ts
// cart.feature.ts — Channel, Entity et Feature co-localisés (I74)
const cartListens = [InventoryFeature.channel] as const;

export class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens, CartEntity>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart", events: ["itemAdded"] };
  get listens() { return cartListens; }
  get queries() { return [PricingFeature.channel] as const; }
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: TAddItem, ctx: TFeatureContext<TCartDef, CartEntity>): void { … }
  onTotalQuery(_params: null, ctx: TFeatureQueryContext): number { … }
  onInventoryStockUpdatedEvent(payload: TStock, ctx: TFeatureContext<TCartDef, CartEntity>): void { … }
  onItemsEntityUpdated(previous, next, patches, ctx): void { … }
}
```

1. **Générique principal = classe Entity** (`TEntity`), pas la forme du state : `this.entity` est typé sans cast et la relation 1:1:1 (I22) est encodée au type-level. `TEntityState<E>` extrait la structure.
2. **Déclarations en `abstract get` d'instance** : `listens`, `queries` (I93) et `Entity` ; `dependsOn` facultatif ordonne le démarrage (C.1). Un oubli est une erreur TS2515.
3. **`implements TFeatureCallbacks<TDef, TListens, TEntity>`** obligatoire (I92) : chaque `on{K}Command`, `on{K}Query`, `on{NS}{Event}Event` dérivé du contrat est imposé avec sa signature. Toute paire `T{X}Contract` a son `T{X}Callbacks` (I88, symétrie avec la View).
4. **Handlers auto-découverts par convention de nommage** (I48), hérités compris, sans décorateurs ni enregistrement manuel. Le suffixe discrimine la voie.
5. **Capacités par le contexte** : `TFeatureContext` offre `emit` (propre Channel), `mutate` et `query` ; `TFeatureQueryContext`, reçu par une Query, n'offre que `query` (A3.g). Pas de `trigger` (D17). `entity` est `protected` (I6).
6. **Notifications Entity** auto-découvertes : `on{Key}EntityUpdated(previous, next, patches, ctx)` par clé racine, puis `onAnyEntityUpdated(event, ctx)` (I51, I96), chacune dans sa propre unité, après la mutation. Une clé inconnue est refusée avant le démarrage.
7. **Constructeur inerte** (I94) : seulement `assertValidNamespace` + assignation ; l'Entity et les handlers sont décrits au noyau par `Application.start()`.
8. **`TStrictFeatureClass<NS>`** (I95) : `static channel` présent et `channel.namespace === NS`, vérifié au `satisfies StrictManifest` (ADR-08).

## Alternatives rejetées

- **`Feature<TStructure, TChannel>`** — impose `(this.entity as CartEntity)` partout, I22 reste runtime.
- **Mono-générique, Channel inféré depuis l'Entity** — l'Entity ne connaît pas le Channel ; inverserait la dépendance.
- **`static listens` / `static queries`** — oubli non détecté (pas d'`abstract static` en TS).
- **Capacités en méthodes `protected` (`this.emit`, `this.request`)** (strate 0) — utilisables hors de toute unité ; le contexte les lie à l'unité du handler (A5.a).
- **Singleton `ConcreteFeature.me()` + CRTP** — casse les call-sites `[CartFeature.channel] as const` et complique les tests.
- **Décorateurs `@Handle('addItem')`** — magie implicite, contraire à « Explicit > Implicit ».

## Conséquences

- Couverture des handlers **strictement compile-time** : pas de filet runtime symétrique à la View, car `listens` ne porte pas les noms d'événements. Un `as any` qui omet un handler passe inaperçu (I92).
- `Application` lit `listens`/`queries`/`dependsOn` sur l'**instance** en phase 0c, d'où l'exigence d'un ctor inerte.
- Une Feature se teste démarrée, par l'Application ou le harnais `drive()` (`tests/helpers/drive.ts`).
