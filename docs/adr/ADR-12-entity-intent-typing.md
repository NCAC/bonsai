# ADR-12 — Typage de l'`intent` de `Entity.mutate()` (question ouverte)

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟡 Proposed |
| **Livré** | — (statu quo : `intent: string`) |
| **Spec** | [entity.md](../spec/3-couche-abstraite/entity.md) |

## Contexte

`mutate(intent, …)` est la seule API à discriminant du framework dont le
discriminant est une `string` libre, alors que toutes les méthodes du Channel
sont typées par `keyof TDef` (I76). Une faute de frappe (`"cart:addItm"`)
compile. Seul garde-fou : la convention de review « intent `namespace:verbNoun`,
métier, jamais générique ».

Contraintes : l'Entity ignore son namespace (I5, I6, I22), son constructeur
reste sans argument (ADR-09), les Entities existantes ne doivent pas casser.
L'intent ne sert pas au dispatch (I96 route sur `changedKeys`) : c'est un
identifiant de traçabilité, DevTools et event sourcing.

## Options en présence

- **A — Statu quo `string`** : rien à migrer, aucune garantie.
- **B — 2ᵉ générique opt-in** `Entity<TStructure, TIntent extends string = string>` : symétrie avec I76, non cassant, mais liste d'intents à maintenir dans l'Entity et convention `namespace:verbNoun` non capturée.
- **C — Template literal** `` `${string}:${string}` `` ou dérivé du namespace : capture la convention, mais couple l'Entity au namespace au type-level.

## Piste (non actée)

**B en opt-in**. À trancher quand plusieurs Features auront été écrites en
strate 1b/1c (chorégraphie multi-features), sur la base de l'usage réel.

## Conséquences d'une décision B ou C

- Amender ADR-10 et lister les Entities (fixtures, tests) qui migrent vers un `TIntent` explicite.
- Attendre trop longtemps rend la migration plus coûteuse, car le corpus strate 1 s'appuie sur des intents non typés.
