# ADR-11 — Entity : schema de validation Valibot

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I63 |
| **Livré** | ⏳ strate 1 — seul le wrapper `@bonsai/valibot` existe |
| **Spec** | [entity.md](../spec/3-couche-abstraite/entity.md) · [validation.md](../spec/6-transversal/validation.md) |

## Contexte

`TJsonSerializable` garantit la **forme** du state, pas ses **règles métier**
(quantité ≥ 0, email valide). Les points d'entrée non typés — `fromJSON()`,
`populateFromServer()`, données d'API — peuvent injecter un state invalide
sans que le compilateur ne voie rien.

## Décision

Chaque Entity concrète **doit** déclarer son schema. L'oubli ne compile pas :

```ts
const cartSchema = v.object({ items: v.array(itemSchema), total: v.pipe(v.number(), v.minValue(0)) });
type TCartState = v.InferOutput<typeof cartSchema>;

class CartEntity extends Entity<TCartState> {
  protected get schema(): TEntitySchema<TCartState> | null {
    return cartSchema;
  }
}
```

- **Valibot est la bibliothèque imposée**, comme Immer l'est pour les mutations. Le type dérive du schema : `v.InferOutput<typeof schema>`.
- Le framework ne connaît que l'interface interne `TEntitySchema<T>` (`safeParse()`) : changer de bibliothèque ne touche pas le framework.
- **Validation modale** (ADR-06) :

  | Point d'entrée | Validation |
  | --- | --- |
  | `initialState` au bootstrap | toujours, fail-fast |
  | `fromJSON()`, `populateFromServer()` | toujours (prod incluse) |
  | après chaque `mutate()` | `__DEV__` uniquement |

- Échec → `EntityValidationError`, distinct des erreurs d'invariant framework.
- **Le schema valide, il ne transforme jamais** (I63) : pas de `v.transform()`, pas de défaut dans `v.optional()`, pas de coercion. Normaliser (trim, lowercase) est le rôle du command handler, avant `mutate()`.
- `return null` est réservé aux Entities triviales (compteur, toggle).

## Alternatives rejetées

- **Zod** — plus lourd, pas de séparation syntaxique nette validation/transformation.
- **Schema abstrait, bibliothèque libre** — même architecture mais documentation et onboarding fragmentés.
- **Méthode `validate()` impérative** — règles dispersées, type et validation divergent.
- **Validation dans les handlers Feature** — `fromJSON`/`populateFromServer` non protégés, oubli indétectable.

## Conséquences

- Les formulaires réutilisent les sous-schemas (`v.safeParse(cartSchema.entries.total, value)`) plutôt que de dupliquer les contraintes (ADR-25).
- Surcoût dev-only sur `mutate()` (~0.1 ms par objet simple), nul en production.
