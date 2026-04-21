# ADR-0037 : Generic principal de Feature — classe Entity vs structure d'état

| Champ                   | Valeur                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**              | � Accepted                                                                                                                                                                |
| **Date**                | 2026-04-21                                                                                                                                                                |
| **Décideurs**           | @ncac                                                                                                                                                                     |
| **RFC liée**            | [feature.md](../rfc/3-couche-abstraite/feature.md), [entity.md](../rfc/3-couche-abstraite/entity.md), [conventions-typage.md](../rfc/6-transversal/conventions-typage.md) |
| **ADR liées**           | [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) (mutate), [ADR-0024](ADR-0024-component-capabilities-manifest-pattern.md) (manifeste typé)                      |
| **Décisions amendées**  | D17 (getter `Entity` abstrait — signature révisée)                                                                                                                        |
| **Invariants impactés** | I22 (1:1:1) — désormais encodé au type-level                                                                                                                              |

---

## Contexte

Le contrat actuel de [Feature](../rfc/3-couche-abstraite/feature.md#L62) déclare :

```typescript
abstract class Feature<
  TStructure extends TJsonSerializable,
  TChannel extends TChannelDefinition
> {
  protected abstract get Entity(): new () => Entity<TStructure>;
  protected readonly entity: Entity<TStructure>;
}
```

Le développeur écrit donc systématiquement :

```typescript
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  protected get Entity() {
    return CartEntity;
  }

  onTotalRequest(): number | null {
    // ❌ this.entity est typé Entity<Cart.State> — pas CartEntity
    return (this.entity as CartEntity).query.getTotal();
  }
}
```

### Problèmes constatés

1. **Cast obligatoire vers la classe Entity concrète** dès qu'on accède à `query`,
   à des méthodes spécifiques de l'Entity, ou à toute API au-delà du `state` brut.
   Les tests strate-0 actuels ([feature.core.test.ts](../../tests/unit/strate-0/feature.core.test.ts#L92)) en font la démonstration : trois `as CartEntity` / `as PricingEntity` pour un fixture minimal.

2. **Duplication conceptuelle** : `Cart.State` est déjà accessible via `CartEntity`
   (l'Entity est paramétrée par sa structure). Le déclarer une seconde fois
   dans la signature de `Feature` viole **Don't Repeat Yourself** au niveau du contrat de typage.

3. **L'invariant I22 (1:1:1 Feature ↔ Entity) n'est pas encodé** dans le type system.
   Rien dans `Feature<Cart.State, Cart.Channel>` ne **lie** la Feature à `CartEntity` — seul le getter runtime fait le lien. Une Feature pourrait théoriquement déclarer `Cart.State` et instancier une Entity totalement différente partageant la même structure.

4. **Le `query` n'est pas un contrat formalisé** sur la base class `Entity`.
   Chaque Entity définit son propre `query` ; sans le type concret, l'IDE ne peut rien proposer.

### Élément déclencheur

Lors de l'écriture des tests strate-0 ([feature.core.test.ts](../../tests/unit/strate-0/feature.core.test.ts)), la répétition mécanique du cast `(this.entity as CartEntity).query.*` a fait apparaître que l'information manquante (le **type concret** de l'Entity) est connue **statiquement** par le développeur — il l'écrit déjà dans `protected get Entity() { return CartEntity; }`. Le type system devrait pouvoir l'inférer.

---

## Contraintes

- **C1** — Doit respecter [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) : `entity.mutate(intent, params?, recipe)` reste l'unique API de mutation.
- **C2** — Doit respecter [I22](../rfc/reference/invariants.md) : 1:1:1 namespace ↔ Feature ↔ Entity.
- **C3** — Doit respecter [D10](../rfc/reference/decisions.md) : la structure d'état reste `TJsonSerializable`.
- **C4** — `TChannel extends TChannelDefinition` (second générique) **n'est pas remis en cause** — Channel et Entity sont deux préoccupations orthogonales (le Channel est co-localisé via D13/D14, pas porté par l'Entity).
- **C5** — Aucune régression DX sur les `implements TRequiredCommandHandlers<TChannel>` / `TRequiredRequestHandlers<TChannel>`.
- **C6** — Le pattern getter abstrait pour la liaison runtime (D17) doit rester applicable (les initialiseurs de la classe fille s'exécutent après `super()`, donc on a besoin d'une indirection accessible depuis le constructeur de la base).

---

## Options considérées

### Option A — Statu quo : `Feature<TStructure, TChannel>`

**Description** : conserver la signature actuelle. Le développeur cast `this.entity` vers la classe concrète au besoin.

| Avantages                                                      | Inconvénients                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| + Aucun changement, aucune migration                           | - Cast `as CartEntity` partout où on accède à `query`                                               |
| + Indépendance théorique entre forme du state et classe Entity | - I22 non encodé au type-level                                                                      |
| + Familier (matche les RFC actuelles)                          | - Duplication : `Cart.State` mentionné dans Feature ET dans `CartEntity extends Entity<Cart.State>` |
|                                                                | - DX dégradée : pas d'autocomplétion sur `this.entity.query.*`                                      |

```typescript
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  protected get Entity() {
    return CartEntity;
  }
  onTotalRequest(): number | null {
    return (this.entity as CartEntity).query.getTotal(); // cast obligatoire
  }
}
```

---

### Option B — Generic = classe Entity : `Feature<TEntityClass, TChannel>` ✅

**Description** : le premier générique devient la **classe** Entity concrète. La structure d'état est dérivée automatiquement via un type utilitaire `TEntityState<E>`. Le getter `Entity` (D17) voit sa signature affinée pour retourner exactement `TEntityClass`.

```typescript
// Type utilitaire — exporté depuis @bonsai/entity
type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;

abstract class Feature<
  TEntityClass extends Entity<TJsonSerializable>,
  TChannel extends TChannelDefinition
> {
  /**
   * Liaison Feature → Entity concrète (D17 amendé).
   * Le retour est désormais la CLASSE concrète, pas Entity<TStructure>.
   */
  protected abstract get Entity(): new () => TEntityClass;

  /** L'instance Entity, typée par la classe concrète — plus aucun cast nécessaire. */
  protected readonly entity: TEntityClass;

  constructor() {
    this.entity = new this.Entity();
  }
}
```

**Usage** :

```typescript
class CartEntity extends Entity<Cart.State> {
  protected get initialState(): Cart.State {
    return { items: [], total: 0, lastUpdated: 0 };
  }

  get query() {
    return {
      getTotal: () => this.state.total,
      getItemCount: () => this.state.items.length
    };
  }
}

class CartFeature
  extends Feature<CartEntity, Cart.Channel>
  implements
    TRequiredCommandHandlers<Cart.Channel>,
    TRequiredRequestHandlers<Cart.Channel>
{
  static readonly namespace = Cart.channel.namespace;
  protected get Entity() {
    return CartEntity;
  }

  onAddItemCommand(
    payload: { productId: string; qty: number },
    metas: TMessageMetas
  ): void {
    this.entity.mutate("cart:addItem", { payload, metas }, (draft) => {
      draft.items.push(payload);
    });
    this.emit("itemAdded", payload, { metas });
  }

  // ✅ Plus aucun cast — this.entity est typé CartEntity
  onTotalRequest(params: void, metas: TMessageMetas): number | null {
    return this.entity.query.getTotal();
  }
}
```

| Avantages                                                                                 | Inconvénients                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| + DX : autocomplétion complète sur `this.entity.query.*`, méthodes Entity custom, etc.    | - Migration de tous les exemples RFC + tests strate-0                                                   |
| + Zéro cast `as ConcreteEntity` dans le code applicatif                                   | - Léger surcoût mental : il faut comprendre que le générique est une **classe**, pas un type de données |
| + I22 (1:1:1) **encodé au type-level** : la Feature est typée par SA classe Entity        | - Le terme "TStructure" disparaît des génériques de Feature (mais reste sur Entity, donc cohérent)      |
| + DRY : la structure d'état n'est déclarée qu'une fois (sur l'Entity)                     |                                                                                                         |
| + `TJsonSerializable` reste la contrainte transitive (via `Entity<TJsonSerializable>`)    |                                                                                                         |
| + `TEntityState<E>` ouvre la porte à d'autres dérivations (intents de mutate, etc.)       |                                                                                                         |
| + Compatible avec le pattern D17 (getter abstrait `Entity`) — signature seulement affinée |                                                                                                         |

---

### Option C — Mono-générique avec inférence de Channel depuis l'Entity

**Description** : pousser la logique au bout — une seule signature `Feature<TEntityClass>` où le Channel serait dérivé de l'Entity (par exemple via une property statique `static channel` sur l'Entity).

```typescript
class CartEntity extends Entity<Cart.State> {
  static readonly channel: Cart.Channel = ...;
}

class CartFeature extends Feature<CartEntity> { ... }
```

| Avantages            | Inconvénients                                                                       |
| -------------------- | ----------------------------------------------------------------------------------- |
| + Signature minimale | - **Viole D14** : le Channel est co-localisé avec la **Feature**, pas avec l'Entity |
| + Un seul générique  | - **Viole I5/I6** : l'Entity n'a aucune connaissance des Channels (encapsulation)   |
|                      | - Force l'Entity à dépendre du concept Channel — fuite d'abstraction inverse        |
|                      | - Empêche une Entity réutilisée (théoriquement) avec deux Channels différents       |

**Rejetée** : contradiction directe avec [I5/I6](../rfc/reference/invariants.md) et [D14](../rfc/reference/decisions.md). L'Entity ne doit jamais avoir connaissance des Channels.

---

## Analyse comparative

| Critère                    | Option A | Option B | Option C |
| -------------------------- | -------- | -------- | -------- |
| Type-safety / I22 encodé   | ⭐       | ⭐⭐⭐   | ⭐⭐⭐   |
| DX (autocomplétion query)  | ⭐       | ⭐⭐⭐   | ⭐⭐⭐   |
| Respect frontières (I5/I6) | ⭐⭐⭐   | ⭐⭐⭐   | ❌       |
| Conformité D13/D14         | ⭐⭐⭐   | ⭐⭐⭐   | ❌       |
| Coût migration             | ⭐⭐⭐   | ⭐⭐     | ⭐       |
| DRY                        | ⭐       | ⭐⭐⭐   | ⭐⭐⭐   |
| Effort de compréhension    | ⭐⭐⭐   | ⭐⭐     | ⭐⭐⭐   |

---

## Décision

**Option B retenue** : `Feature<TEntityClass extends Entity<TJsonSerializable>, TChannel extends TChannelDefinition>`.

### Justifications

1. **DX** — la cible explicite de Bonsai (« le type EST la documentation ») exige que `this.entity.query.*` soit auto-complété sans cast. Option A échoue ce critère ; Option B le satisfait sans contournement.
2. **Encodage de I22 au type-level** — la 1:1:1 entre Feature et Entity passe d'un invariant _runtime/documentaire_ à un invariant _compile-time_. C'est une victoire architecturale gratuite.
3. **DRY** — la structure d'état (`Cart.State`) n'est plus mentionnée que dans `class CartEntity extends Entity<Cart.State>`. Toute évolution est centralisée.
4. **Préservation de D14** — le Channel reste un générique indépendant, co-localisé avec la Feature (pattern namespace TS). Option C est rejetée précisément pour ne pas violer cette frontière.
5. **Préservation de D17** — le getter `Entity` reste la mécanique de liaison ; seule sa signature retournée est resserrée.
6. **Coût de migration acceptable** — les RFC concernées sont nombreuses mais l'opération est mécanique (`Feature<X.State, X.Channel>` → `Feature<XEntity, X.Channel>` + suppression des casts).

### Pourquoi pas Option A

Le cast `(this.entity as CartEntity).query.*` constitue précisément le type de **frottement DX silencieux** que Bonsai vise à éliminer. Conserver Option A reviendrait à faire payer à chaque Feature un coût de typage évitable, indéfiniment.

### Pourquoi pas Option C

Inacceptable architecturalement : l'Entity ne connaît pas le Channel (I5/I6, D14). Toute tentative de la rendre dépendante du Channel romprait l'encapsulation et inverserait la direction de dépendance définie par la couche abstraite.

---

## Conséquences

### Positives

- ✅ Suppression de tous les casts `as XxxEntity` dans le code applicatif (Feature et tests).
- ✅ I22 vérifié à la compilation (impossible d'instancier une Feature avec une Entity dont la structure ne correspond pas).
- ✅ `query` exposé typé sur `this.entity` — l'IDE guide entièrement l'écriture des `onXxxRequest`.
- ✅ Type utilitaire `TEntityState<E>` réutilisable ailleurs (DevTools, sérialisation, tests).
- ✅ Documentation pédagogique : le développeur lit `Feature<CartEntity, Cart.Channel>` et comprend immédiatement les deux contrats portés par sa Feature.

### Négatives (acceptées)

- ⚠️ **Migration documentaire** : ~6 fichiers RFC à mettre à jour (feature.md, entity.md, application.md, conventions-typage.md, et les exemples downstream). Acceptable car opération mécanique.
- ⚠️ **Migration tests strate-0** : [feature.core.test.ts](../../tests/unit/strate-0/feature.core.test.ts) déjà en divergence avec la RFC (utilise `createEntity()` au lieu de `get Entity`) — la migration est l'occasion d'aligner ces tests sur le contrat normatif.
- ⚠️ **Léger glissement de vocabulaire** : `TStructure` disparaît du générique de Feature (il reste `TEntityClass`). L'invariant de jsonifiabilité est porté transitivement par `Entity<TJsonSerializable>` dans la contrainte. Documentation à clarifier.

### Risques identifiés

- 🔶 **Risque de confusion entre `TEntityClass` (classe) et `TStructure` (forme du state)** — mitigé par les conventions de typage RFC mises à jour et par le type utilitaire nommé explicitement `TEntityState<E>`.
- 🔶 **Risque que le `query` non typé sur la base `Entity` empêche l'auto-discovery par le framework** — non bloquant : le `query` reste un _getter_ défini par chaque Entity concrète, le typage se fait via le type concret de l'Entity passé en générique.

---

## Spécification cible

### Type utilitaire (à ajouter dans `@bonsai/entity`)

```typescript
/**
 * Extrait la structure d'état (TStructure) d'une classe Entity concrète.
 *
 * @example
 *   type TCartState = TEntityState<CartEntity>;  // = Cart.State
 */
export type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;
```

### Signature révisée de `Feature`

```typescript
abstract class Feature<
  TEntityClass extends Entity<TJsonSerializable>,
  TChannel extends TChannelDefinition
> {
  static readonly namespace: string;

  /**
   * Liaison Feature → Entity concrète (D17 amendé par ADR-0037).
   * Retourne la CLASSE concrète, ce qui permet d'inférer this.entity: TEntityClass.
   */
  protected abstract get Entity(): new () => TEntityClass;

  /** L'instance Entity — typée par la classe concrète, plus aucun cast nécessaire. */
  protected readonly entity: TEntityClass;

  constructor() {
    this.entity = new this.Entity();
  }
}
```

### Pattern de référence (CartFeature)

```typescript
class CartFeature
  extends Feature<CartEntity, Cart.Channel>
  implements
    TRequiredCommandHandlers<Cart.Channel>,
    TRequiredRequestHandlers<Cart.Channel>
{
  static readonly namespace = Cart.channel.namespace;
  protected get Entity() {
    return CartEntity;
  }

  onTotalRequest(params: void, metas: TMessageMetas): number | null {
    return this.entity.query.getTotal(); // ✅ inféré, zéro cast
  }
}
```

---

## Actions de suivi

- [ ] Mettre à jour [feature.md](../rfc/3-couche-abstraite/feature.md) §1, §3, §6 (signature `Feature<TEntityClass, TChannel>`, exemples).
- [ ] Mettre à jour [entity.md](../rfc/3-couche-abstraite/entity.md) §1 et §3 (clarifier que `TStructure` reste sur Entity, ajouter `TEntityState<E>`).
- [ ] Mettre à jour [conventions-typage.md](../rfc/6-transversal/conventions-typage.md) (mapped types `TRequiredCommandHandlers<TChannel>` inchangés ; ajouter `TEntityState<E>`).
- [ ] Mettre à jour [application.md](../rfc/3-couche-abstraite/application.md) si des exemples Feature y figurent.
- [ ] Amender [decisions.md](../rfc/reference/decisions.md) : ajouter une note sous D17 indiquant l'amendement par ADR-0037 (signature retour du getter `Entity`).
- [ ] Mettre à jour [invariants.md](../rfc/reference/invariants.md) sur I22 : ajouter mention « encodé au type-level depuis ADR-0037 ».
- [ ] Migrer [feature.core.test.ts](../../tests/unit/strate-0/feature.core.test.ts) : remplacer `createEntity()` par `get Entity()`, supprimer les casts, passer la classe Entity en générique.
- [ ] Aligner l'implémentation `@bonsai/feature` (`packages/feature/src/`) sur la signature révisée.
- [ ] Exporter `TEntityState<E>` depuis `@bonsai/entity`.

---

## Références

- [feature.md §1 Classe abstraite](../rfc/3-couche-abstraite/feature.md#L40)
- [entity.md §1 Type TEntityStructure](../rfc/3-couche-abstraite/entity.md#L48)
- [decisions.md D17 — getter Entity abstrait](../rfc/reference/decisions.md)
- [invariants.md I22 — 1:1:1 namespace ↔ Feature ↔ Entity](../rfc/reference/invariants.md)
- [feature.core.test.ts — élément déclencheur](../../tests/unit/strate-0/feature.core.test.ts)

---

## Historique

| Date       | Changement                                                                     |
| ---------- | ------------------------------------------------------------------------------ | --- | ---------- | ------------------------------------------- |
| 2026-04-21 | Création (Proposed) — déclenchée par les casts répétés dans les tests strate-0 |     | 2026-04-21 | Accepted après relecture — Option B retenue |
