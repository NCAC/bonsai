# ADR-02 — Request synchrone : `request()` → `T | null`

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I29, I55 |
| **Livré** | ✅ |
| **Spec** | [communication.md](../spec/2-architecture/communication.md) |

## Contexte

La Request lane lit l'état d'une autre Feature. Si `request()` retourne une
`Promise`, toute la couche concrète devient asynchrone : les Views attendent,
gèrent des états de chargement intermédiaires, et un replier peut déguiser un
fetch en lecture.

## Décision

`reply()` retourne **`T` synchrone**, `request()` retourne **`T | null`** (I29).

- Un replier **ne lit que l'Entity en mémoire** de sa Feature (méthodes query, I52). Tout I/O (`fetch`, `await`, timer) dans un replier est un anti-pattern bloquant (I64). Il n'est pas détectable par le compilateur : c'est une règle de review, et une règle ESLint `no-async-in-replier` est envisagée.
- `null` si **aucun replier** n'est enregistré, ou si le **replier throw** : l'erreur est journalisée et **ne se propage jamais** au demandeur (I55, reporting : ADR-03).
- Pas de type `Result<T>`, pas de timeout.

**L'async appartient à la couche abstraite.** Les handlers de Command, les
listeners d'Event et `onInit()` d'une Feature peuvent être `async`. La couche
concrète (View, Behavior, Composer, Foundation) est **synchrone par conception** :
elle projette un état déjà matérialisé et délègue tout effet asynchrone par
`trigger()`.

```ts
// ❌ replier async                      // ✅ pré-chargement via Command
async onPriceRequest() { await fetch… }  async onLoadPricesCommand() {
                                           const p = await api.prices();
                                           this.entity.mutate("pricing:load", d => { d.prices = p; });
                                         }
                                         onPriceRequest({ id }) { return this.entity.state.prices[id] ?? null; }
```

## Alternatives rejetées

- **`request()` → `Promise<T>`** (décision initiale) — contamine toute la couche concrète d'`await`, alors que la lecture porte sur un état déjà en mémoire.
- **`T | Promise<T>`** — chaque appelant doit gérer les deux cas : la pire des DX.

## Conséquences

- Tri-lane cohérent : `trigger` et `emit` retournent `void`, seule la Request lane retourne une valeur, et elle est immédiate.
- Une donnée pas encore chargée se modélise dans l'Entity (`status: "loading"`), puis se projette via un Event : jamais en attendant une réponse.
- `fetch`/`await` dans une View ou un Behavior est un anti-pattern documenté (« Async in Concrete Layer »), non détectable mécaniquement.
