# ADR-0022 : Entity Schema Validation Strategy

> ### TL;DR
> **Valibot imposé** comme unique bibliothèque de validation. Chaque Entity définit
> `abstract get schema(): TEntitySchema<TStructure>`. Validation **modale** : silencieuse
> en prod, `console.warn` en dev (`__DEV__`), stricte (throw) dans les formulaires
> (`FormBehavior`). Nouvel invariant I63. Valibot < 1 KB noyau vs Zod ~13 KB full (v3).

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-01 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0002-entity](../rfc/3-couche-abstraite/entity.md) §1–4, §7 · [RFC-0002 API §15–16](../rfc/6-transversal/conventions-typage.md) · [ADR-0004](ADR-0004-validation-modes.md) · [ADR-0009](ADR-0009-forms-pattern.md) |
| **Invariants impactés** | I6, I46 (respectés), I63 (nouveau — acté) |
| **ADRs liées** | [ADR-0001](ADR-0001-entity-diff-notification-strategy.md), [ADR-0004](ADR-0004-validation-modes.md), [ADR-0009](ADR-0009-forms-pattern.md), [ADR-0015](ADR-0015-local-state-mechanism.md) |

---

## Contexte

### Le trou de validation

Bonsai possède aujourd'hui **trois couches de validation** :

| Couche | Mécanisme | Ce qui est validé | Ce qui échappe |
|--------|-----------|-------------------|----------------|
| **Compile-time** | `TEntityStructure extends TJsonSerializable` | Structure (champs, types) | Valeurs (`""`, `-1`, string de 10 000 caractères) |
| **Framework** | `invariant()` / `warning()` (ADR-0004) | Invariants architecturaux I1–I58 | Contraintes domaine (min/max, format, enum runtime) |
| **UI** | localState dans View/Behavior (ADR-0009) | Saisie pré-soumission | Pas de garantie côté Entity — la View peut « oublier » |

TypeScript garantit que `Cart.State.total` est un `number`. Mais **rien n'empêche** :

```typescript
// TypeScript est satisfait. L'Entity accepte.
this.entity.mutate('cart:setDiscount', { metas }, draft => {
  draft.discount = -50;    // ← négatif ? Aucune validation.
  draft.couponCode = '';   // ← vide ? Aucune validation.
});
```

### Les données externes — le cas critique

`populateFromServer()` et `fromJSON()` acceptent un `TStructure` typé statiquement, mais les données viennent du **runtime** (serveur, localStorage, DevTools) :

```typescript
// Le serveur renvoie n'importe quoi — TypeScript ne peut pas vérifier
const serverData = JSON.parse(response.body); // unknown → cast → Entity
entity.populateFromServer(serverData as Cart.State); // 💥 Aucune validation runtime
```

Si le serveur renvoie `{ total: "not-a-number", items: null }`, l'Entity l'accepte silencieusement. Les Views crashent ensuite avec des erreurs incompréhensibles, loin de la source du problème.

### La duplication formulaire ↔ domaine

ADR-0009 montre la validation dans la View :

```typescript
// Dans la View (ADR-0009, localState)
draft.errors.zip = !/^\d{5}$/.test(value) ? 'Code postal invalide' : null;
```

Mais la même contrainte (`zip` = 5 chiffres) **devrait aussi** exister au niveau Entity — pour protéger contre les données serveur, les imports, les scripts de migration, les DevTools. Aujourd'hui, si la View est bypassée (API directe, SSR, test), la contrainte disparaît.

### Ce qui manque concrètement

| Besoin | Exemple | Couvert aujourd'hui ? |
|--------|---------|-----------------------|
| Contrainte de valeur | `qty >= 0`, `price > 0` | ❌ Non |
| Contrainte de format | `email matches /^.+@.+\..+$/` | ❌ Non |
| Contrainte d'enum runtime | `status ∈ ['draft', 'active', 'archived']` | ⚠️ Compile-time via literal union, pas runtime |
| Contrainte inter-champs | `endDate > startDate` | ❌ Non |
| Contrainte de longueur | `name.length ∈ [3, 100]` | ❌ Non |
| Validation données externes | `populateFromServer()`, `fromJSON()` | ❌ Non |

---

## Contraintes

### Architecturales

- **I46** : `TStructure` est contraint à `TJsonSerializable` — la validation de schéma opère sur des plain objects JSON, pas des classes
- **I6** : seule la Feature modifie l'Entity via `mutate()` — la validation ne doit pas créer de chemin de mutation alternatif
- **ADR-0001** : `mutate(intent, params?, recipe)` est l'unique API de mutation — le schéma ne remplace pas Immer, il **valide le résultat**
- **ADR-0004** : pattern `__DEV__` + `invariant()` déjà standardisé — la validation domaine doit s'intégrer dans cette infrastructure
- **D10** : TJsonSerializable — les données sont des plain objects, compatibles avec les bibliothèques de validation (Zod, Valibot)

### Techniques

- **Performance** : la validation ne doit pas impacter la production (ou être opt-in)
- **Tree-shaking** : le code de validation dev doit être éliminable par le bundler
- **DX** : le développeur ne doit pas écrire la même contrainte deux fois (formulaire + Entity)
- **Progressivité** : ne pas forcer un schéma sur les Entities simples qui n'en ont pas besoin

### Dépendances existantes

- `packages/zod/` — Zod est déjà bundlé dans le monorepo comme ré-export (`ZOD`)
- `packages/types/` — types utilitaires existants
- ADR-0009 — validation UI dans localState, patterns formulaires

---

## Options considérées

### Option A — Schema Zod déclaratif colocalisé dans le namespace

**Description** : chaque Entity **DOIT** déclarer un schema Zod à côté de `State`. Le framework l'utilise automatiquement pour valider `mutate()`, `fromJSON()` et `populateFromServer()`.

```typescript
import { z } from 'zod';

export namespace Cart {
  // ── Schema = source de vérité ──
  export const schema = z.object({
    items: z.array(z.object({
      productId: z.string().min(1, 'productId requis'),
      qty: z.number().int().min(1, 'quantité ≥ 1'),
    })),
    total: z.number().min(0, 'total ≥ 0'),
    lastUpdated: z.number().int().min(0),
  });

  // State dérivé du schema — Single Source of Truth
  export type State = TEntityStructure & z.infer<typeof schema>;

  export type Channel = TChannelDefinition & {
    readonly namespace: 'cart';
    readonly commands: {
      addItem: { productId: string; qty: number };
      clear: void;
    };
    readonly events: {
      itemAdded: { productId: string; qty: number };
      cleared: void;
    };
    readonly requests: {};
  };

  export const channel: unique symbol = Symbol('cart');
}
```

```typescript
// ── Entity avec schema obligatoire ──

class CartEntity extends Entity<Cart.State> {
  // Le framework exige cette déclaration
  static readonly schema = Cart.schema;

  protected get initialState(): Cart.State {
    return { items: [], total: 0, lastUpdated: 0 };
  }
}
```

```typescript
// ── Framework : validation automatique ──

abstract class Entity<TStructure extends TJsonSerializable> {
  // Déclaré par chaque sous-classe concrète
  static readonly schema: z.ZodType<TJsonSerializable>;

  mutate(
    intent: string,
    paramsOrRecipe: TMutationParams | null | ((draft: Draft<TStructure>) => void),
    maybeRecipe?: (draft: Draft<TStructure>) => void
  ): TEntityEvent {
    // ... Immer produceWithPatches ...
    const [nextState, patches, inversePatches] = produceWithPatches(this._state, recipe);

    // Validation post-mutation — TOUJOURS active
    const result = (this.constructor as typeof Entity).schema.safeParse(nextState);
    if (!result.success) {
      throw new EntityValidationError(intent, result.error);
    }

    this._state = nextState;
    // ... notifications ...
  }

  fromJSON(snapshot: TStructure): void {
    const result = (this.constructor as typeof Entity).schema.safeParse(snapshot);
    if (!result.success) {
      throw new EntityValidationError('fromJSON', result.error);
    }
    this._state = snapshot;
  }

  populateFromServer(state: TStructure): void {
    const result = (this.constructor as typeof Entity).schema.safeParse(state);
    if (!result.success) {
      throw new EntityValidationError('populateFromServer', result.error);
    }
    this._state = state;
  }
}
```

```typescript
// ── Réutilisation dans la View (ADR-0009 intégration) ──

class ShippingStepView extends View<[Checkout.Channel], TShippingUI, TShippingOpts, TShippingLocal> {
  onZipInputInput(e: TUIEventFor<TShippingUI, 'zipInput', 'input'>): void {
    const value = e.currentTarget.value;
    // Réutilise le sous-schema de l'Entity — Single Source of Truth
    const zipResult = Checkout.schema.shape.steps.unwrap().shape.shipping
      .unwrap().shape.zip.safeParse(value);
    this.updateLocal(draft => {
      draft.values.zip = value;
      draft.errors.zip = zipResult.success ? null : zipResult.error.issues[0].message;
    });
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| ✅ **Single Source of Truth** — `z.infer<typeof schema>` dérive le type | ❌ **Zod obligatoire** — couplage fort à une dépendance externe |
| ✅ Validation systématique — aucun `mutate()` ne bypass le schéma | ❌ **Overhead runtime à chaque mutation** — même en production |
| ✅ Messages d'erreur riches et structurés (ZodError) | ❌ **Breaking change** — toutes les Entities existantes doivent ajouter un schema |
| ✅ Réutilisable dans les formulaires (sous-schemas) | ❌ **Complexité** pour des Entities simples (compteur, toggles) |
| ✅ Validation des données externes (serveur, localStorage) | ❌ **Pas de tree-shaking** — le schema est utilisé en prod |
| ✅ Type dérivé du schema = impossible de diverger | ❌ **Navigation de sous-schemas** pénible (`.shape.x.unwrap().shape.y`) |

---

### Option B — Méthode `validate()` impérative dans l'Entity

**Description** : l'Entity peut optionnellement définir une méthode `protected validate()` appelée par le framework après chaque mutation.

```typescript
export namespace Cart {
  export type State = TEntityStructure & {
    items: Array<{ productId: string; qty: number }>;
    total: number;
    lastUpdated: number;
  };

  export type Channel = TChannelDefinition & {
    readonly namespace: 'cart';
    // ...
  };

  export const channel: unique symbol = Symbol('cart');
}
```

```typescript
// ── Entity avec validate() optionnel ──

class CartEntity extends Entity<Cart.State> {
  protected get initialState(): Cart.State {
    return { items: [], total: 0, lastUpdated: 0 };
  }

  /**
   * Validation domaine — appelé par le framework après chaque mutate().
   * Retourne null si valide, ou un tableau d'erreurs.
   */
  protected validate(state: Cart.State): TValidationError[] | null {
    const errors: TValidationError[] = [];

    if (state.total < 0) {
      errors.push({ path: 'total', message: 'Le total ne peut pas être négatif', value: state.total });
    }

    for (const [index, item] of state.items.entries()) {
      if (item.qty < 1) {
        errors.push({ path: `items[${index}].qty`, message: 'Quantité ≥ 1', value: item.qty });
      }
      if (item.productId.length === 0) {
        errors.push({ path: `items[${index}].productId`, message: 'productId requis', value: item.productId });
      }
    }

    return errors.length > 0 ? errors : null;
  }
}
```

```typescript
// ── Types de validation ──

type TValidationError = {
  /** Chemin JSON-path de la propriété invalide */
  readonly path: string;
  /** Message d'erreur lisible */
  readonly message: string;
  /** Valeur fautive */
  readonly value: unknown;
};

class EntityValidationError extends BonsaiError {
  constructor(
    readonly intent: string,
    readonly errors: TValidationError[]
  ) {
    super(
      `Entity validation failed for "${intent}": ` +
      errors.map(e => `${e.path}: ${e.message}`).join(', ')
    );
  }
}
```

```typescript
// ── Framework : appel conditionnel ──

abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * Validation domaine optionnelle.
   * Si définie, appelée après chaque mutate() en __DEV__.
   * Appelée TOUJOURS pour fromJSON() et populateFromServer() (données externes).
   */
  protected validate(state: TStructure): TValidationError[] | null {
    return null; // Par défaut : pas de validation
  }

  mutate(/* ... */): TEntityEvent {
    // ... Immer produceWithPatches ...
    const [nextState, patches, inversePatches] = produceWithPatches(this._state, recipe);

    // Validation post-mutation — DEV uniquement
    if (__DEV__) {
      const errors = this.validate(nextState);
      if (errors !== null) {
        throw new EntityValidationError(intent, errors);
      }
    }

    this._state = nextState;
    // ...
  }

  fromJSON(snapshot: TStructure): void {
    // Validation — TOUJOURS active (données externes)
    const errors = this.validate(snapshot);
    if (errors !== null) {
      throw new EntityValidationError('fromJSON', errors);
    }
    this._state = snapshot;
  }

  populateFromServer(state: TStructure): void {
    // Validation — TOUJOURS active (données externes)
    const errors = this.validate(state);
    if (errors !== null) {
      throw new EntityValidationError('populateFromServer', errors);
    }
    this._state = state;
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| ✅ **Aucune dépendance externe** — plain TypeScript | ❌ **Boilerplate** — chaque contrainte est un if/push manuellement |
| ✅ **Optionnel** — les Entities simples n'ont rien à ajouter | ❌ **Pas de Single Source of Truth** — le type et validate() peuvent diverger |
| ✅ **Flexible** — peut valider des contraintes inter-champs arbitraires | ❌ **Non-réutilisable** dans les formulaires (ADR-0009) — pas de schema partageable |
| ✅ **`__DEV__` pour mutate()** — zero overhead en prod | ❌ **Messages d'erreur manuels** — qualité dépend du développeur |
| ✅ **Données externes toujours validées** (fromJSON, populateFromServer) | ❌ **Pas d'inférence de type** — le type est déclaré séparément du validate() |
| ✅ Pattern familier (méthode hook) | ❌ **Tests plus lourds** — il faut tester les cas de validation manuellement |

---

### Option C — Validation au niveau Feature handler (statu quo enrichi)

**Description** : pas de mécanisme framework — le développeur valide **dans le command handler** de la Feature, avant ou après `mutate()`. Le framework fournit seulement un type utilitaire et des helpers.

```typescript
import { z } from 'zod';

export namespace Cart {
  export type State = TEntityStructure & {
    items: Array<{ productId: string; qty: number }>;
    total: number;
    lastUpdated: number;
  };

  // Schema optionnel — utilitaire, pas intégré au framework
  export const addItemPayloadSchema = z.object({
    productId: z.string().min(1),
    qty: z.number().int().min(1),
  });

  export type Channel = TChannelDefinition & {
    readonly namespace: 'cart';
    readonly commands: {
      addItem: z.infer<typeof addItemPayloadSchema>;
      clear: void;
    };
    readonly events: { itemAdded: { productId: string; qty: number }; cleared: void };
    readonly requests: {};
  };

  export const channel: unique symbol = Symbol('cart');
}
```

```typescript
// ── Feature avec validation explicite ──

class CartFeature extends Feature<Cart.State, Cart.Channel> {
  static readonly namespace = Cart.channel;

  onAddItemCommand(
    payload: { productId: string; qty: number },
    metas: TMessageMetas
  ): void {
    // Validation explicite du payload AVANT mutation
    const parsed = Cart.addItemPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      // Émettre un event d'erreur ou logger
      this.emit('validationFailed', {
        command: 'addItem',
        errors: parsed.error.issues,
      }, { metas });
      return;
    }

    this.entity.mutate(
      'cart:addItem',
      { payload: parsed.data, metas },
      draft => {
        draft.items.push({ productId: parsed.data.productId, qty: parsed.data.qty });
        draft.total += parsed.data.qty;
        draft.lastUpdated = Date.now();
      }
    );

    this.emit('itemAdded', parsed.data, { metas });
  }
}
```

```typescript
// ── fromJSON / populateFromServer — pas de validation intégrée ──

// Le développeur doit surcharger manuellement :
class CartEntity extends Entity<Cart.State> {
  protected get initialState(): Cart.State {
    return { items: [], total: 0, lastUpdated: 0 };
  }

  // ❌ Pas de mécanisme framework pour valider fromJSON/populateFromServer
  // Le développeur doit penser à surcharger — facile à oublier
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| ✅ **Explicite** — chaque validation est visible dans le code | ❌ **Aucune garantie** — facile d'oublier de valider |
| ✅ **Flexible** — chaque handler choisit sa stratégie | ❌ **Dispersé** — la même contrainte dupliquée dans 3 handlers |
| ✅ **Zero overhead framework** — pas de hook | ❌ **`fromJSON()` / `populateFromServer()` non protégés** — le trou reste béant |
| ✅ Compatible avec n'importe quelle bibliothèque | ❌ **Pas de fail-safe** — une mutation invalide passe si le développeur oublie |
| ✅ Aucun changement au framework | ❌ **Pas de DX unifiée** — chaque Feature fait à sa façon |
| | ❌ **Tests de régression** — comment vérifier que TOUTES les mutations sont validées ? |

---

### Option D — Schema déclaratif abstrait + validation modale (recommandé)

**Description** : chaque Entity **doit** implémenter le getter abstrait `get schema()` qui retourne soit un `TEntitySchema<TStructure>` (schema de validation domaine), soit `null` (opt-out conscient). Le framework exploite ce schema de façon **modale** :

| Point de validation | Mode | Mécanisme |
|---------------------|------|-----------|
| `mutate()` | `__DEV__` uniquement | `invariant()` — éliminé en prod (ADR-0004) |
| `fromJSON()` | **Toujours** | `hardInvariant()` — données externes non fiables |
| `populateFromServer()` | **Toujours** | `hardInvariant()` — données serveur non fiables |
| `initialState` | **Bootstrap** | Vérifié une fois au démarrage |
| Formulaires (ADR-0009) | Vue seulement | Réutilisation optionnelle du sous-schema |

Si l'Entity retourne `null` → **aucune validation domaine** (choix conscient et explicite — `return null` est une déclaration, pas un oubli).

> **Différence clé avec l'ancienne approche opt-in** : ici, l'**absence de déclaration est une erreur de compilation**. Chaque Entity est forcée de répondre à la question « mes données ont-elles besoin d'un schema de validation ? ». `return null` est un choix architectural assumé, pas un oubli silencieux.

#### Interface framework — `TEntitySchema<T>`

Le framework définit sa propre interface de validation, **découplée de toute bibliothèque** :

```typescript
/**
 * Interface framework pour les schemas de validation Entity.
 *
 * Découplée de Zod, Valibot, ArkType ou toute autre bibliothèque.
 * Le seul contrat est `safeParse()` : validation sans throw.
 *
 * Toute bibliothèque de validation exposant `.safeParse()` est compatible
 * nativement (Zod, Valibot) ou via un adaptateur trivial (ArkType).
 *
 * @typeParam TStructure — le type de state de l'Entity
 */
type TEntitySchema<TStructure> = {
  /**
   * Valide un état inconnu de façon non-destructive.
   *
   * - Ne throw jamais — retourne un discriminated union
   * - Ne transforme PAS les données (pas de coerce, trim, default)
   * - Accepte `unknown` en entrée (données potentiellement non fiables)
   *
   * @param data — la donnée à valider (unknown car provient de sources non fiables)
   * @returns — résultat discriminé success/failure avec détails des erreurs
   */
  safeParse(data: unknown):
    | { readonly success: true; readonly data: TStructure }
    | {
        readonly success: false;
        readonly error: {
          readonly issues: ReadonlyArray<{
            readonly path: ReadonlyArray<string | number>;
            readonly message: string;
          }>;
        };
      };
};
```

> **Pourquoi une interface framework plutôt qu'un import direct de Zod ?**
>
> 1. **Découplage** : le framework ne dépend pas d'une bibliothèque spécifique. Si Zod perd en popularité ou si ArkType/Valibot devient le standard, le framework reste inchangé.
> 2. **Compatibilité native** : Zod et Valibot exposent déjà `safeParse()` avec exactement cette signature. Un `z.object({...})` **est** un `TEntitySchema<T>` sans adaptateur.
> 3. **Adaptateur trivial** : pour ArkType ou d'autres, un wrapper de 5 lignes suffit.
> 4. **Tree-shaking** : la bibliothèque de validation est importée par le code applicatif, pas par le framework. Le framework ne voit que l'interface.

#### Déclaration du schema

```typescript
import { z } from 'zod';

export namespace Cart {
  // ── Schema domaine — déclare les contraintes de validité ──
  export const schema = z.object({
    items: z.array(z.object({
      productId: z.string().min(1, 'productId requis'),
      qty: z.number().int().min(1, 'quantité ≥ 1'),
    })),
    total: z.number().min(0, 'total ne peut pas être négatif'),
    lastUpdated: z.number().int().min(0),
  });

  // Type dérivé du schema — Single Source of Truth
  // z.infer<typeof schema> EST le type, pas une copie
  export type State = TEntityStructure & z.infer<typeof schema>;

  export type Channel = TChannelDefinition & {
    readonly namespace: 'cart';
    readonly commands: {
      addItem: { productId: string; qty: number };
      clear: void;
    };
    readonly events: {
      itemAdded: { productId: string; qty: number };
      cleared: void;
    };
    readonly requests: {};
  };

  export const channel: unique symbol = Symbol('cart');
}
```

#### Entity AVEC schema — validation active

```typescript
class CartEntity extends Entity<Cart.State> {
  /**
   * Schema de validation domaine.
   *
   * Le framework utilise ce schema pour :
   * - valider chaque mutate() en __DEV__
   * - valider fromJSON() et populateFromServer() en production
   * - vérifier initialState au bootstrap
   *
   * Cart.schema (Zod) est nativement compatible TEntitySchema<Cart.State>
   * car Zod expose safeParse() avec la signature attendue.
   */
  protected get schema(): TEntitySchema<Cart.State> {
    return Cart.schema;
  }

  protected get initialState(): Cart.State {
    return { items: [], total: 0, lastUpdated: 0 };
  }
}
```

#### Entity SANS schema — opt-out explicite

```typescript
export namespace Counter {
  export type State = TEntityStructure & {
    count: number;
  };
  // Pas de schema — Entity triviale, décision consciente
  export const channel: unique symbol = Symbol('counter');
}

class CounterEntity extends Entity<Counter.State> {
  /**
   * Opt-out explicite de la validation domaine.
   *
   * `return null` est un choix architectural conscient :
   * cette Entity est triviale (un seul champ numérique),
   * le type-system suffit à garantir sa cohérence.
   *
   * ⚠️ Si cette Entity évolue vers un state complexe,
   * un schema devra être ajouté.
   */
  protected get schema(): null {
    return null;
  }

  protected get initialState(): Counter.State {
    return { count: 0 };
  }
}
```

> **Le `return null` n'est pas de la friction inutile.** C'est le même pattern que `implements Serializable` ou `@Override` : une déclaration d'intention qui protège contre l'oubli. Un développeur qui écrit `return null` a **répondu à la question**. Un développeur qui n'a rien écrit a une **erreur de compilation** — exactement le comportement voulu.

#### Intégration framework — classe Entity abstraite

```typescript
// ── Classe Entity — getter schema abstrait ──

abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * Schema de validation domaine pour cet Entity.
   *
   * Chaque Entity concrète DOIT implémenter ce getter :
   * - Retourner un `TEntitySchema<TStructure>` pour activer la validation
   * - Retourner `null` pour désactiver la validation (opt-out conscient)
   *
   * Le framework utilise ce schema de façon modale :
   * - `mutate()` → __DEV__ uniquement (ADR-0004)
   * - `fromJSON()` / `populateFromServer()` → toujours
   * - `initialState` → au bootstrap
   *
   * @returns schema compatible TEntitySchema, ou null
   */
  protected abstract get schema(): TEntitySchema<TStructure> | null;

  mutate(
    intent: string,
    paramsOrRecipe: TMutationParams | null | ((draft: Draft<TStructure>) => void),
    maybeRecipe?: (draft: Draft<TStructure>) => void
  ): TEntityEvent {
    const params = typeof paramsOrRecipe === 'function' ? null : paramsOrRecipe;
    const recipe = typeof paramsOrRecipe === 'function' ? paramsOrRecipe : maybeRecipe!;

    const [nextState, patches, inversePatches] = produceWithPatches(this._state, recipe);

    // ── Validation post-mutation — __DEV__ uniquement (ADR-0004) ──
    if (__DEV__) {
      this.validateState(nextState, intent);
    }

    this._state = nextState;
    // ... changedKeys, TEntityEvent, notifications ...
    return event;
  }

  fromJSON(snapshot: TStructure): void {
    // ── Validation — TOUJOURS active (données potentiellement non fiables) ──
    this.validateState(snapshot, 'fromJSON');

    this._state = snapshot;
    // ... notifications ...
  }

  populateFromServer(state: TStructure): void {
    // ── Validation — TOUJOURS active (données serveur non fiables) ──
    this.validateState(state, 'populateFromServer');

    this._state = state;
    // ... pas de notifications (silencieux, ADR-0014 H5) ...
  }

  /**
   * Valide un state contre le schema de cet Entity.
   *
   * Si `this.schema` est `null`, cette méthode est un no-op.
   * Sinon, elle appelle `safeParse()` et throw `EntityValidationError`
   * en cas d'échec.
   *
   * @param state — le state à valider
   * @param context — le contexte (intent, 'fromJSON', 'populateFromServer')
   * @throws EntityValidationError si la validation échoue
   * @internal
   */
  private validateState(state: TStructure, context: string): void {
    const schema = this.schema;
    if (schema === null) return; // Opt-out conscient → pas de validation

    const result = schema.safeParse(state);
    if (!result.success) {
      throw new EntityValidationError(context, result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        value: undefined,
      })));
    }
  }
}
```

> **Simplification notable** : plus besoin de `hasSchema()` type guard ni de `TEntityWithSchema` — la validation est une méthode d'instance qui lit `this.schema`. Le code framework est plus simple, plus sûr, et le `this.constructor as any` disparaît.

#### Validation au bootstrap

```typescript
// ── Phase bootstrap 'entities' — vérification initialState ──

function bootstrapEntity<TStructure extends TJsonSerializable>(
  entity: Entity<TStructure>
): void {
  // Le getter schema est toujours défini (abstract → compilateur garantit)
  // Si schema !== null, vérifier que initialState est conforme
  // validateState est privé, donc le bootstrap appelle safeParse directement

  const schema = (entity as any)['schema']; // accès interne framework
  if (schema !== null) {
    const result = schema.safeParse(entity.toJSON());
    if (!result.success) {
      throw new EntityValidationError(
        `${entity.constructor.name}.initialState`,
        result.error.issues.map((issue: any) => ({
          path: issue.path.join('.'),
          message: issue.message,
          value: undefined,
        }))
      );
    }
  }
}
```

#### Réutilisation dans les formulaires (intégration ADR-0009)

```typescript
// ── Sous-schema extrait pour le formulaire ──

// Le namespace exporte des sous-schemas réutilisables
export namespace Checkout {
  export const shippingSchema = z.object({
    address: z.string().min(5, 'Adresse trop courte'),
    city: z.string().min(2, 'Ville requise'),
    zip: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)'),
  });

  export const schema = z.object({
    currentStep: z.number().int().min(0).max(3),
    steps: z.object({
      shipping: shippingSchema.nullable(),
      payment: z.object({
        method: z.enum(['card', 'paypal']),
        cardLast4: z.string().nullable(),
      }).nullable(),
      confirmation: z.object({
        accepted: z.boolean(),
      }).nullable(),
    }),
    isComplete: z.boolean(),
  });

  export type State = TEntityStructure & z.infer<typeof schema>;
  // ...
}
```

```typescript
// ── Dans la View — réutilisation du sous-schema ──

class ShippingStepView extends View<
  [Checkout.Channel], TShippingUI, TShippingOpts, TShippingLocal
> {
  // Valider un champ en réutilisant le sous-schema Entity
  private validateField<K extends keyof z.infer<typeof Checkout.shippingSchema>>(
    field: K,
    value: string
  ): string | null {
    const result = Checkout.shippingSchema.shape[field].safeParse(value);
    return result.success ? null : result.error.issues[0].message;
  }

  onZipInputInput(e: TUIEventFor<TShippingUI, 'zipInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.zip = value;
      // ✅ Single Source of Truth — même règle que l'Entity
      draft.errors.zip = this.validateField('zip', value);
    });
  }

  onCityInputInput(e: TUIEventFor<TShippingUI, 'cityInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.city = value;
      draft.errors.city = this.validateField('city', value);
    });
  }

  onAddressInputInput(e: TUIEventFor<TShippingUI, 'addressInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.address = value;
      draft.errors.address = this.validateField('address', value);
    });
  }
}
```

#### Compatibilité avec d'autres bibliothèques de validation

```typescript
// ── Zod — compatible nativement ──
import { z } from 'zod';

const zodSchema = z.object({ count: z.number().int().min(0) });
// zodSchema satisfies TEntitySchema<{ count: number }> ← ✅ aucun adaptateur

// ── Valibot — compatible nativement ──
import * as v from 'valibot';

const valibotSchema = v.object({ count: v.pipe(v.number(), v.integer(), v.minValue(0)) });
// valibotSchema.safeParse ← existe, même signature → ✅ compatible

// ── ArkType — adaptateur trivial ──
import { type } from 'arktype';

const arkSchema = type({ count: 'integer >= 0' });

function arkToEntitySchema<T>(arkType: type.Any): TEntitySchema<T> {
  return {
    safeParse(data: unknown) {
      const result = arkType(data);
      if (result instanceof type.errors) {
        return {
          success: false as const,
          error: {
            issues: result.map(e => ({
              path: e.path as ReadonlyArray<string | number>,
              message: e.message,
            })),
          },
        };
      }
      return { success: true as const, data: result as T };
    },
  };
}
// Usage: protected get schema() { return arkToEntitySchema<Counter.State>(arkSchema); }
```

#### EntityValidationError

```typescript
/**
 * Erreur de validation de l'Entity — domaine, pas framework.
 *
 * Distincte de InvariantError (ADR-0004) car :
 * - InvariantError = violation d'un invariant architectural (bug framework/dev)
 * - EntityValidationError = données domaine invalides (bug data)
 *
 * Contient les détails structurés pour debug et logging.
 */
class EntityValidationError extends BonsaiError {
  readonly name = 'EntityValidationError';

  constructor(
    /** Contexte : intent de la mutation, ou 'fromJSON', ou 'populateFromServer' */
    readonly context: string,
    /** Liste des violations domaine */
    readonly violations: readonly TValidationError[]
  ) {
    super(
      `[Bonsai] Entity validation failed (${context}):\n` +
      violations.map(v => `  • ${v.path}: ${v.message}`).join('\n')
    );
  }
}

type TValidationError = {
  /** Chemin JSON-path de la propriété invalide (ex: "items[0].qty") */
  readonly path: string;
  /** Message d'erreur lisible par le développeur */
  readonly message: string;
  /** Valeur fautive (optionnel — peut être omis pour sécurité) */
  readonly value?: unknown;
};
```

| Avantages | Inconvénients |
|-----------|---------------|
| ✅ **Oubli impossible** — `abstract get schema()` force la déclaration au compile-time | ⚠️ **Friction `return null`** — les Entities triviales doivent écrire 3 lignes de plus |
| ✅ **Découplé** — `TEntitySchema<T>` framework-owned, compatible Zod/Valibot/ArkType | ⚠️ **Overhead dev** — validation à chaque mutate() en développement |
| ✅ **Modal** — `__DEV__` pour mutate(), toujours pour données externes | ⚠️ **Schema ≠ TJsonSerializable** — il faut s'assurer que les types restent dans le sous-ensemble JSON |
| ✅ **Single Source of Truth** — `z.infer<typeof schema>` = type | ⚠️ **Courbe d'apprentissage** — le développeur doit connaître une bibliothèque de validation |
| ✅ **Réutilisable** — sous-schemas dans les formulaires (ADR-0009) | |
| ✅ **Intégré ADR-0004** — même pattern `__DEV__` / `invariant()` | |
| ✅ **Explicite > Implicite** — `return null` est une décision, pas un oubli | |
| ✅ **initialState vérifié au bootstrap** — fail-fast | |
| ✅ **Code framework simplifié** — plus de `hasSchema()`, plus de cast `this.constructor as any` | |
| ✅ **EntityValidationError structuré** — path, message, exploitable par les DevTools | |
| ✅ **Library-agnostic** — le framework ne dépend pas de Zod | |

---

### Option E — Valibot imposé + `TEntitySchema<T>` interne (recommandé)

**Description** : l'Option E **reprend intégralement l'architecture de l'Option D** (`abstract get schema()`, `TEntitySchema<T>`, validation modale, `return null` pour opt-out) mais **impose Valibot** comme bibliothèque de validation officielle de Bonsai. L'interface `TEntitySchema<T>` est conservée comme contrat *interne* du framework (découplage implémentation), mais le code applicatif, la documentation, les exemples et les conventions utilisent exclusivement Valibot.

> **L'Option E n'est pas une architecture différente de D** — c'est D + un choix opinionated sur la bibliothèque. Toute la mécanique framework (`abstract get schema()`, `validateState()`, validation modale, `EntityValidationError`) est identique.

#### Pourquoi imposer une bibliothèque — la cohérence documentaire

Bonsai est un framework **opinionated**. Il impose Immer pour l'immutabilité, Pug pour les templates, Radio singleton pour l'event bus. Laisser le choix de la bibliothèque de validation crée un problème de **fragmentation** :

| Aspect | Choix libre (D) | Valibot imposé (E) |
|--------|-----------------|---------------------|
| **Documentation** | « Choisissez votre bibliothèque » — impossible de montrer un seul idiome | Un seul idiome partout : RFC, guides, sandbox |
| **DX onboarding** | Le nouveau dev doit découvrir quelle lib est utilisée dans le projet | « C'est Valibot » — un seul skill à apprendre |
| **Réutilisation sous-schema (ADR-0009)** | `z.shape.field` ou `v.pick()` ou `Type.Pick()` ? | `v.pick(schema, ['field'])` — toujours |
| **Dérivation type ↔ schema** | `z.infer<>` ou `v.InferOutput<>` ou `Type.Static<>` ? | `v.InferOutput<typeof schema>` — toujours |
| **Lint rules** | Impossible de linter un format inconnu | Lint rules Valibot-spécifiques possibles |
| **Formation** | N bibliothèques à connaître selon les projets | Un seul standard |

#### Pourquoi Valibot plutôt que Zod

| Critère | Zod | Valibot | Verdict |
|---------|-----|---------|---------|
| **Bundle (min+gz)** | ~2 KB core (v4), ~13 KB full (v3) | < 700 B noyau — seuls les validateurs importés sont bundlés | 🏆 Valibot |
| **Tree-shaking** | Bon (v4), chaque méthode exportée | **Excellent** — chaque validateur est une fonction indépendante | 🏆 Valibot |
| **Performance runtime** | ⭐⭐⭐ | ⭐⭐⭐⭐ (plus rapide sur les objets complexes) | 🏆 Valibot |
| **`safeParse()` natif** | ✅ `schema.safeParse(data)` | ✅ `v.safeParse(schema, data)` | Égalité |
| **`infer` SSoT** | ✅ `z.infer<typeof S>` | ✅ `v.InferOutput<typeof S>` | Égalité |
| **Séparation validation / transformation** | Mélangées (`.transform()` dans le même pipeline) | **Séparées** — `v.pipe()` pour validation, `v.transform()` explicite | 🏆 Valibot (facilite I63) |
| **100% test coverage** | Non documenté | ✅ 100% | 🏆 Valibot |
| **Maturité écosystème** | ⭐⭐⭐⭐⭐ (42K ★, standard de facto) | ⭐⭐⭐⭐ (6K+ ★, adoption rapide) | 🏆 Zod |
| **API erreurs structurées** | `ZodError.issues[]` avec `path`, `message` | `ValiError.issues[]` avec `path`, `message` | Égalité |

**Bilan** : Valibot gagne sur les critères **techniques** (bundle, tree-shaking, performance, séparation concerns). Zod ne gagne que sur la **maturité écosystème** — critère qui perd en poids quand le framework impose son choix (le développeur Bonsai n'a pas besoin que Valibot soit le standard de facto du monde entier, il a besoin qu'il soit le standard de Bonsai).

#### Déclaration du schema — syntaxe Valibot

```typescript
import * as v from 'valibot';

export namespace Cart {
  // ── Schema domaine — Valibot, Single Source of Truth ──
  export const schema = v.object({
    items: v.array(v.object({
      productId: v.pipe(v.string(), v.minLength(1, 'productId requis')),
      qty: v.pipe(v.number(), v.integer(), v.minValue(1, 'quantité ≥ 1')),
    })),
    total: v.pipe(v.number(), v.minValue(0, 'total ne peut pas être négatif')),
    lastUpdated: v.pipe(v.number(), v.integer(), v.minValue(0)),
  });

  // Type dérivé du schema — Single Source of Truth
  // v.InferOutput<typeof schema> EST le type, pas une copie
  export type State = TEntityStructure & v.InferOutput<typeof schema>;

  export type Channel = TChannelDefinition & {
    readonly namespace: 'cart';
    readonly commands: {
      addItem: { productId: string; qty: number };
      clear: void;
    };
    readonly events: {
      itemAdded: { productId: string; qty: number };
      cleared: void;
    };
    readonly requests: {};
  };

  export const channel: unique symbol = Symbol('cart');
}
```

#### Entity avec schema — Valibot natif → `TEntitySchema<T>`

```typescript
class CartEntity extends Entity<Cart.State> {
  /**
   * Schema de validation domaine (Valibot).
   *
   * Valibot expose `safeParse()` avec la même signature que TEntitySchema<T>
   * → compatible nativement, aucun adaptateur nécessaire.
   */
  protected get schema(): TEntitySchema<Cart.State> {
    return Cart.schema;
  }

  protected get initialState(): Cart.State {
    return { items: [], total: 0, lastUpdated: 0 };
  }
}
```

#### Entity sans schema — opt-out identique à D

```typescript
export namespace Counter {
  export type State = TEntityStructure & {
    count: number;
  };
  export const channel: unique symbol = Symbol('counter');
}

class CounterEntity extends Entity<Counter.State> {
  /** Opt-out conscient — Entity triviale, pas besoin de validation domaine. */
  protected get schema(): null {
    return null;
  }

  protected get initialState(): Counter.State {
    return { count: 0 };
  }
}
```

#### Validation de données API tierce — le cas critique

```typescript
// ── Données venant d'une API tierce non fiable ──

// Le serveur renvoie du JSON inconnu
const apiResponse: unknown = await fetch('/api/products/42').then(r => r.json());

// Valibot valide et type en une opération
const result = v.safeParse(Product.schema, apiResponse);

if (!result.success) {
  // result.issues contient les détails structurés
  // Ex: [{ path: [{ key: 'price' }], message: 'prix ≥ 0' }]
  console.error('API response invalid:', result.issues);
  return;
}

// result.output est typé Product.State — garanti conforme au schema
const product: Product.State = result.output;
```

```typescript
// ── Dans l'Entity — populateFromServer() protège automatiquement ──

// Le framework appelle safeParse() via validateState()
// Si l'API renvoie { price: -50 }, EntityValidationError est throw
entity.populateFromServer(apiResponse as Product.State);
// 💥 EntityValidationError: [Bonsai] Entity validation failed (populateFromServer):
//   • price: prix ≥ 0
```

> **Point clé** : `populateFromServer()` valide **toujours** (pas seulement en `__DEV__`). Les données venant d'une API tierce sont le cas d'usage *premier* de la validation. Valibot est excellent pour ce cas — `safeParse()` est rapide (~0.1ms pour un objet de 20 propriétés), structuré, et ne throw pas.

#### Réutilisation dans les formulaires — syntaxe Valibot

```typescript
// ── Sous-schemas nommés, exportés par le namespace ──

export namespace Checkout {
  export const shippingSchema = v.object({
    address: v.pipe(v.string(), v.minLength(5, 'Adresse trop courte')),
    city: v.pipe(v.string(), v.minLength(2, 'Ville requise')),
    zip: v.pipe(v.string(), v.regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)')),
  });

  export const paymentSchema = v.object({
    method: v.picklist(['card', 'paypal']),
    cardLast4: v.nullable(v.string()),
  });

  export const schema = v.object({
    currentStep: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3)),
    steps: v.object({
      shipping: v.nullable(shippingSchema),
      payment: v.nullable(paymentSchema),
      confirmation: v.nullable(v.object({
        accepted: v.boolean(),
      })),
    }),
    isComplete: v.boolean(),
  });

  export type State = TEntityStructure & v.InferOutput<typeof schema>;
}
```

```typescript
// ── Dans la View — réutilisation du sous-schema Valibot ──

class ShippingStepView extends View<
  [Checkout.Channel], TShippingUI, TShippingOpts, TShippingLocal
> {
  /**
   * Valide un champ en réutilisant le sous-schema Entity.
   * v.pick() extrait un sous-schema par clé — plus lisible que .shape.
   */
  private validateField(
    field: keyof v.InferOutput<typeof Checkout.shippingSchema>,
    value: string
  ): string | null {
    const fieldSchema = Checkout.shippingSchema.entries[field];
    const result = v.safeParse(fieldSchema, value);
    return result.success ? null : result.issues[0].message;
  }

  onZipInputInput(e: TUIEventFor<TShippingUI, 'zipInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.zip = value;
      // ✅ Single Source of Truth — même règle que l'Entity
      draft.errors.zip = this.validateField('zip', value);
    });
  }

  onCityInputInput(e: TUIEventFor<TShippingUI, 'cityInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.city = value;
      draft.errors.city = this.validateField('city', value);
    });
  }
}
```

#### Architecture interne — `TEntitySchema<T>` conservé

Le framework conserve `TEntitySchema<T>` comme contrat interne. Le code framework (~20 lignes de `validateState()`) ne connaît ni Valibot ni Zod — il voit uniquement `safeParse()`. Cela signifie :

- **Migration future** : si Valibot perd en pertinence dans 3 ans, seul le code applicatif (namespaces, schemas) change. Le framework reste intact.
- **Tests unitaires** : on peut injecter un mock `TEntitySchema<T>` sans importer Valibot.
- **Pas de `import * as v from 'valibot'` dans le framework** : Valibot est une dépendance applicative, pas framework.

```typescript
// ── Le framework ne voit QUE TEntitySchema<T> ──
// Identique à l'Option D — aucune différence dans le code framework

abstract class Entity<TStructure extends TJsonSerializable> {
  protected abstract get schema(): TEntitySchema<TStructure> | null;

  private validateState(state: TStructure, context: string): void {
    const schema = this.schema;
    if (schema === null) return;

    const result = schema.safeParse(state);
    if (!result.success) {
      throw new EntityValidationError(context, result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        value: undefined,
      })));
    }
  }
}
```

#### `packages/valibot/` — ré-export standard

```typescript
// packages/valibot/src/valibot.ts
// Même pattern que l'existant packages/zod/

import * as ValibotOriginal from 'valibot';
const VALIBOT = { ...ValibotOriginal };
export { VALIBOT };

// Ou, plus idiomatique :
export * from 'valibot';
```

> `packages/zod/` reste disponible pour la rétrocompatibilité avec du code legacy existant, mais n'est plus recommandé pour les nouvelles Entities.

| Avantages (par rapport à D) | Inconvénients (par rapport à D) |
|------------------------------|----------------------------------|
| ✅ **Opinionated** — un seul idiome dans tout l'écosystème Bonsai | ⚠️ **Moins de choix** — le développeur qui préfère Zod doit utiliser Valibot |
| ✅ **Bundle optimal** — Valibot < 700 B noyau, tree-shaking radical | ⚠️ **Écosystème plus jeune** — moins d'intégrations tierces que Zod (mais croissance rapide) |
| ✅ **Performance** — plus rapide que Zod sur les validations d'objets | |
| ✅ **Séparation validation/transformation** — facilite I63 (interdit `.transform()`) | |
| ✅ **Documentation cohérente** — tous les exemples en Valibot, un seul `infer` | |
| ✅ **Onboarding simplifié** — « C'est Valibot » = un seul skill | |
| ✅ **Lint rules** — on peut linter un format connu (import Valibot, pas de transform) | |
| ✅ **`TEntitySchema<T>` préservé** — le framework reste découplé (migration future possible) | |

---

## Analyse comparative

| Critère | A — Zod obligatoire | B — validate() | C — Feature handler | D — Schema abstrait (lib-agnostic) | **E — Valibot imposé (recommandé)** |
|---------|--------------------|--------------------------|--------------------|-------------------------------|--------------------------------------|
| **Performance prod** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (Valibot + modal) |
| **Type-safety** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (`InferOutput`) |
| **DX** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (un seul idiome) |
| **Oubli impossible** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (abstract) |
| **Réutilisabilité formulaire** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Protection données externes** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Progressivité** | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ (`return null`) |
| **Cohérence documentaire** | ⭐⭐⭐⭐ (Zod partout) | ⭐⭐ (pas de lib) | ⭐⭐ (freestyle) | ⭐⭐ (N libs possibles) | ⭐⭐⭐⭐⭐ (Valibot partout) |
| **Bundle size** | ⭐⭐⭐ (~2 KB v4) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ (dépend du choix) | ⭐⭐⭐⭐⭐ (< 700 B + tree-shaking) |
| **Tree-shaking** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (modulaire natif) |
| **Conformité ADR-0004** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Maintenabilité** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Complexité framework** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ (identique D) |

---

## Décision

### Option E — Valibot imposé + `TEntitySchema<T>` interne (recommandé)

L'**Option E** est recommandée. Elle combine l'architecture de l'Option D (getter abstrait, validation modale, `TEntitySchema<T>`) avec un **choix opinionated** de bibliothèque : **Valibot**.

#### Justification

1. **Oubli impossible** : `abstract get schema()` force chaque Entity concrète à implémenter le getter. Une Entity qui ne déclare pas de schema **ne compile pas**. C'est la force principale de l'Option A obtenue sans son overhead en production.

2. **Opinionated et assumé** : Bonsai impose Immer, Pug, Radio singleton. Imposer Valibot est cohérent avec cette philosophie. Le développeur n'a pas de choix à faire — il utilise Valibot, comme il utilise Immer pour l'immutabilité. Un seul idiome, un seul skill, un seul jeu d'exemples.

3. **Bundle optimal** : Valibot < 700 B de noyau. Son design modulaire (chaque validateur est une fonction importée séparément) permet un tree-shaking radical — seuls les validateurs effectivement utilisés sont bundlés. Pour un framework frontend, chaque KB compte.

4. **Performance** : Valibot est plus rapide que Zod sur les validations d'objets complexes. Pour `populateFromServer()` et `fromJSON()` qui valident en production, cette différence est réelle.

5. **Séparation validation / transformation** : Valibot sépare clairement `v.pipe()` (validation pure) et `v.transform()` (transformation). Cela rend l'invariant I63 (interdiction de `.transform()` dans les schemas Entity) naturel à respecter et à linter.

6. **Single Source of Truth** : `v.InferOutput<typeof schema>` **est** le type. Même garantie que `z.infer<>` — impossible que le type et le schema divergent.

7. **Validation données API tierces** : `v.safeParse()` est conçu pour valider des données `unknown` venant de sources non fiables (API REST, WebSocket, localStorage). C'est rapide (~0.1ms pour un objet de 20 propriétés), structuré (issues avec path + message), et ne throw pas.

8. **Documentation cohérente** : tous les exemples RFC, guides, sandbox utilisent la même syntaxe. L'onboarding est simplifié — « C'est Valibot » = une seule doc à lire.

9. **`TEntitySchema<T>` préservé** : le framework reste découplé. Si Valibot perd en pertinence dans 3 ans, seul le code applicatif change. Le framework ne connaît que `safeParse()`.

10. **Fail-fast au bootstrap** : `initialState` est vérifié au démarrage contre le schema Valibot.

#### Rejet des autres options

- **Option A** (Zod obligatoire) : rejetée — validation systématique en production, overhead runtime, couplage framework à Zod, Zod moins performant et plus lourd que Valibot.

- **Option B** (`validate()` impératif) : rejetée — pas de Single Source of Truth, pas de réutilisabilité formulaire, divergence type ↔ validation.

- **Option C** (Feature handler) : rejetée — `fromJSON()` / `populateFromServer()` non protégés, oubli indétectable.

- **Option D** (Schema abstrait, lib-agnostic) : rejetée en faveur de E — même architecture, mais le « choix libre » de bibliothèque fragmente la documentation, l'onboarding et les conventions. L'abstraction `TEntitySchema<T>` protège le framework (~20 lignes) mais pas le code applicatif que le développeur écrit tous les jours. L'Option E est D + un choix opinionated cohérent avec la philosophie Bonsai.

---

## Anti-patterns

### ❌ Schema qui utilise des types non-JSON

```typescript
import * as v from 'valibot';

// ❌ INTERDIT — Date n'est pas TJsonSerializable (D10)
const schema = v.object({
  createdAt: v.date(),                       // ❌ Date
  metadata: v.map(v.string(), v.unknown()),  // ❌ Map + unknown
});

// ✅ CORRECT — types JSON uniquement
const schema = v.object({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),  // timestamp
  metadata: v.record(v.string(), v.string()),                 // plain object
});
```

### ❌ Validation qui modifie les données (transform)

```typescript
import * as v from 'valibot';

// ❌ INTERDIT — le schema ne doit PAS transformer les données
const schema = v.object({
  email: v.pipe(
    v.string(),
    v.email(),
    v.transform(s => s.toLowerCase()),  // ❌ transform
  ),
  name: v.optional(v.string(), 'Anonymous'),  // ❌ default value
});

// ✅ CORRECT — le schema VALIDE, il ne transforme pas
const schema = v.object({
  email: v.pipe(v.string(), v.email('Format email invalide')),
  name: v.pipe(v.string(), v.minLength(1, 'Nom requis'), v.maxLength(100, 'Nom trop long')),
});
// Les transformations (lowercase, trim) sont la responsabilité
// du command handler dans la Feature, AVANT mutate().
```

> **Principe** : le schema est un **garde-fou en lecture**, pas un pipeline de transformation. Les mutations passent exclusivement par `mutate()` (ADR-0001). Un schema avec `v.transform()` créerait un chemin de mutation implicite — violation de I6. Valibot facilite cette discipline en séparant clairement `v.pipe()` (validation) et `v.transform()` (transformation) — contrairement à Zod où `.transform()` est chaîné dans le même pipeline.

### ❌ Ignorer le schema pour "aller plus vite"

```typescript
// ❌ MAUVAIS — retourner null par défaut sans réflexion sur une Entity critique
class PaymentEntity extends Entity<Payment.State> {
  // "On ajoutera le schema plus tard"
  // → populateFromServer() accepte n'importe quoi pour une Entity de paiement !
  protected get schema(): null {
    return null; // ← null sur une Entity CRITIQUE = dette technique dangereuse
  }
  protected get initialState(): Payment.State { /* ... */ }
}

// ✅ CORRECT — Entity critique = schema obligatoire
class PaymentEntity extends Entity<Payment.State> {
  protected get schema(): TEntitySchema<Payment.State> {
    return Payment.schema;
  }
  protected get initialState(): Payment.State { /* ... */ }
}
```

> **Règle** : `return null` est réservé aux Entities triviales (compteur, toggle, booléen simple). Toute Entity manipulant des données critiques (paiement, profil utilisateur, formulaire multi-step) DOIT déclarer un schema. Une lint rule ESLint custom pourrait forcer cette convention sur les Entities dont le state dépasse N propriétés.

### ❌ Dupliquer les contraintes entre schema et formulaire

```typescript
import * as v from 'valibot';

// ❌ MAUVAIS — la même règle est écrite deux fois
// Entity
const schema = v.object({
  zip: v.pipe(v.string(), v.regex(/^\d{5}$/)),
});
// View
onZipInputInput(e) {
  const isValid = /^\d{5}$/.test(value); // ← doublon !
}

// ✅ CORRECT — réutiliser le sous-schema Valibot
onZipInputInput(e) {
  const fieldSchema = Checkout.shippingSchema.entries.zip;
  const result = v.safeParse(fieldSchema, value);
  draft.errors.zip = result.success ? null : result.issues[0].message;
}
```

### ❌ Utiliser Zod ou une autre bibliothèque au lieu de Valibot

```typescript
import { z } from 'zod';

// ❌ INTERDIT — Bonsai impose Valibot (ADR-0022 Option E)
const schema = z.object({
  name: z.string().min(1),
});

// ✅ CORRECT — utiliser Valibot
import * as v from 'valibot';
const schema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
});
```

> **Règle** : tous les schemas Entity utilisent Valibot. `packages/zod/` reste disponible pour la rétrocompatibilité du code legacy existant, mais n'est pas autorisé pour les nouveaux schemas Entity.

---

## Conséquences

### Impact sur le code

| Élément | Impact |
|---------|--------|
| **Entity (framework)** | Ajouter `abstract get schema(): TEntitySchema<TStructure> \| null`, implémenter `validateState()` privé, appeler dans `mutate()` (`__DEV__`), `fromJSON()` (toujours), `populateFromServer()` (toujours), et au bootstrap pour `initialState` |
| **Entity (applicatif)** | Chaque Entity concrète **doit** implémenter `get schema()` — retourner un `TEntitySchema` ou `null` |
| **TEntitySchema<T>** | Nouvelle interface framework (`packages/types/`) — contrat `safeParse()` interne |
| **`packages/valibot/`** | Créer le package — ré-export Valibot (même pattern que `packages/zod/`) |
| **`packages/zod/`** | Conservé en legacy — déprécié pour les nouveaux schemas Entity |
| **Namespace** | Convention : déclarer `const schema = v.object({...})` + `type State = TEntityStructure & v.InferOutput<typeof schema>` |
| **Views/Behaviors formulaires** | Réutiliser les sous-schemas via `v.safeParse(Namespace.subSchema.entries.field, value)` |
| **BonsaiError** | Ajouter `EntityValidationError` (distinct de `InvariantError`) |
| **Bootstrap** | Vérifier `initialState` contre le schema si non-null (phase 3 `'entities'`) |

### Impact sur les RFC

| Document | Impact |
|----------|--------|
| **RFC-0002-entity §1** | Ajouter `abstract get schema(): TEntitySchema<TStructure> \| null` + mention Valibot comme bibliothèque officielle |
| **RFC-0002-entity §2** | Ajouter `TEntitySchema<T>` interface + relation schema ↔ `TJsonSerializable` — interdire `v.transform()`, `v.optional()` avec default |
| **RFC-0002-entity §4** | Ajouter la validation post-mutation `__DEV__` dans `mutate()` |
| **RFC-0002-entity §7** | Ajouter la validation toujours-active dans `fromJSON()` et `populateFromServer()` |
| **RFC-0002 API §16** | Ajouter §16.8 « Validation domaine Entity » — distinguer invariant (framework) vs schema (domaine), documenter `TEntitySchema<T>` + Valibot |
| **FORMS-GUIDE.md** | Ajouter un Pattern E (réutilisation sous-schema Valibot) avec exemple |

### Impact sur les invariants

| Invariant | Impact |
|-----------|--------|
| **I46** (TStructure jsonifiable) | Respecté — Valibot `v.object()` produit des types JSON-compatibles |
| **I6** (seule la Feature mute) | Respecté — le schema **valide** le résultat, il ne **mute** pas (`v.transform()` interdit) |
| **ADR-0004** (validation modale) | Étendu — la validation domaine suit le même pattern `__DEV__` pour mutate() |
| **Nouvel invariant** | I63 — « Un schema Entity ne contient PAS de `v.transform()`, `v.optional()` avec default, ni de coercion. Le schema est un garde-fou en lecture, pas un pipeline de mutation. » |

### Risques identifiés

| Risque | Mitigation |
|--------|------------|
| 🔶 **Overhead validation en dev** — validation à chaque `mutate()` | Acceptable : Valibot `safeParse()` sur des objets JSON simples < 0.1ms. Impact nul en prod (éliminé par `__DEV__`). Plus rapide que Zod. |
| 🔶 **Schema oublié sur Entity critique** | Impossible d'oublier au compile-time (`abstract`). Mais `return null` reste possible — recommandation forte dans le guide + lint rule possible (ESLint custom) pour Entity dont le state > N propriétés. |
| 🔶 **Choix Valibot imposé** | Valibot est plus jeune que Zod (6K vs 42K ★) mais en croissance rapide, 100% test coverage, API stable. `TEntitySchema<T>` permet une migration future si nécessaire sans toucher au code framework. |
| 🔶 **Navigation sous-schema** | Valibot expose `.entries` pour les propriétés d'un `v.object()`. Exporter des sous-schemas nommés (`shippingSchema`, `paymentSchema`) pour une DX optimale. |
| 🔶 **`packages/zod/` legacy** | Conserver pour le code existant, déprécier dans la doc. Migrer progressivement vers `packages/valibot/`. |

### Actions

| # | Action | Priorité |
|---|--------|----------|
| A1 | Amender RFC-0002-entity §1, §4, §7 avec `abstract get schema()`, `TEntitySchema<T>` et Valibot | P1 |
| A2 | Ajouter §16.8 dans RFC-0002 API — validation domaine vs framework, `TEntitySchema<T>`, Valibot officiel | P1 |
| A3 | Déclarer `TEntitySchema<T>` dans `packages/types/` | P1 |
| A4 | Créer `packages/valibot/` — ré-export Valibot (même pattern que `packages/zod/`) | P1 |
| A5 | Déprécier `packages/zod/` pour les schemas Entity (conserver pour legacy) | P2 |
| A6 | Enrichir FORMS-GUIDE.md — Pattern E « réutilisation sous-schema Valibot » | P3 |
| A7 | ~~Évaluer le nouvel invariant I63~~ — ✅ I63 acté (ADR Accepted) | ✅ |
| A8 | Prototype sandbox — Entity avec schema Valibot + View qui réutilise le sous-schema | P3 |

---

## Références

- [RFC-0002-entity](../rfc/3-couche-abstraite/entity.md) — Contrat Entity : TEntityStructure, `mutate()`, `fromJSON()`, `populateFromServer()`
- [RFC-0002 API §15–16](../rfc/6-transversal/conventions-typage.md) — Validation statique et dynamique
- [ADR-0004](ADR-0004-validation-modes.md) — Validation modes (`invariant()`, `__DEV__`, tree-shaking)
- [ADR-0009](ADR-0009-forms-pattern.md) — Forms pattern — validation UI dans localState
- [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) — Entity mutation via `mutate()`
- [Valibot Documentation](https://valibot.dev/) — **Bibliothèque officielle Bonsai** — schema validation modulaire, tree-shakeable
- [Valibot API](https://valibot.dev/api/) — Référence API complète
- [Zod Documentation](https://zod.dev/) — TypeScript-first schema validation (legacy, non recommandé pour les nouvelles Entities)
- [ArkType](https://arktype.io/) — Alternative (non supportée officiellement)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-01 | Création (Proposed) — 4 options, recommandation Option D (schema optionnel + validation modale) |
| 2026-04-01 | Révision Option D → D-révisée : `abstract get schema()` + `TEntitySchema<T>` framework-owned. Absorbe la force de A (oubli impossible) sans overhead prod. Découplage bibliothèque de validation. |
| 2026-04-01 | Ajout Option E — Valibot imposé + `TEntitySchema<T>` interne. Analyse Zod vs Valibot : Valibot retenu pour bundle size, tree-shaking, performance, séparation validation/transformation. Décision déplacée de D vers E. |
| 2026-04-01 | Passage à 🟢 **Accepted** — Option E retenue, I63 acté. |
