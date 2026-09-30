# ADR-09 — Contrat Feature : `Feature<TEntity, TChannelDef, TSelfNS>`

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I48, I51, I74, I88, I92, I93, I94, I95, I96 |
| **Livré** | ✅ · ⏳ metas en 2ᵉ paramètre des handlers (strate 1b, ADR-04) |
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
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
  get listens() { return cartListens; }
  get queries() { return [PricingFeature.channel] as const; }
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: TAddItem): void { … }
  onTotalRequest(): number | null { … }
  onInventoryStockUpdatedEvent(payload: TStock): void { … }
  onItemsEntityUpdated(prev, next, patches): void { … }
}
```

1. **Générique principal = classe Entity** (`TEntity`), pas la forme du state : `this.entity` est typé sans cast et la relation 1:1:1 (I22) est encodée au type-level. `TEntityState<E>` extrait la structure.
2. **Déclarations en `abstract get` instance** : `listens`, `queries` (I93) et `Entity`. Un oubli est une erreur TS2515.
3. **`implements TFeatureCallbacks<TDef, TListens>`** obligatoire (I92) : chaque `on{K}Command`, `on{K}Request`, `on{NS}{Event}Event` dérivé du contrat est imposé avec sa signature. Toute paire `T{X}Contract` a son `T{X}Callbacks` (I88, symétrie avec la View).
4. **Handlers auto-découverts par convention de nommage** (I48), pas de décorateurs ni d'enregistrement manuel. Le suffixe discrimine la lane.
5. **Notifications Entity** auto-découvertes : `on{Key}EntityUpdated(prev, next, patches)` par clé racine, `onAnyEntityUpdated(event)` catch-all (I51, I96). Dispatch côté Feature ; un handler qui throw devient une `BroadcastError` isolée.
6. **Constructeur inerte** (I94) : seulement `assertValidNamespace` + assignation. Sentinel en phase 0b : un side-effect Radio dans le ctor fait échouer `start()`.
7. **`TStrictFeatureClass<NS>`** (I95) : `static channel` présent et `channel.namespace === NS`, vérifié au `satisfies StrictManifest` (ADR-08).
8. **Capacités** : `emit()` (propre Channel) et `request()` (tokens déclarés) sont `protected` ; handle, listen et reply sont implicites. `entity` est `protected` (I6).

## Alternatives rejetées

- **`Feature<TStructure, TChannel>`** — impose `(this.entity as CartEntity)` partout, I22 reste runtime.
- **Mono-générique, Channel inféré depuis l'Entity** — l'Entity ne connaît pas le Channel ; inverserait la dépendance.
- **`static listens` / `static queries`** — oubli non détecté (pas d'`abstract static` en TS).
- **Singleton `ConcreteFeature.me()` + CRTP** — casse les call-sites `[CartFeature.channel] as const` et complique les tests.
- **Décorateurs `@Handle('addItem')`** — magie implicite, contraire à « Explicit > Implicit ».
- **Wrapper `namespace Cart { … }` TS pour co-localiser** — remplacé par la co-localisation par fichier `*.feature.ts`.

## Conséquences

- Couverture des handlers **strictement compile-time** : pas de filet runtime symétrique à la View, car `listens` ne porte pas les noms d'événements. Un `as any` qui omet un handler passe inaperçu (I92).
- `Application` lit `listens`/`queries` sur l'**instance** en phase 0c, d'où l'exigence d'un ctor inerte.
- Une Feature se teste isolément : `new CartFeature("cart").bootstrap()`.
