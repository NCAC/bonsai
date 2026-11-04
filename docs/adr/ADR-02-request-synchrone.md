# ADR-02 — Query synchrone : une valeur, jamais une `Promise` ni un `null` de substitution

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I29, I55 |
| **Livré** | ✅ — `Root` rend la valeur capturée du handler ; une cible absente, non prête ou active, ou un handler qui lève, fait échouer l'unité de l'auteur (`tests/unit/kernel/root.test.ts`) |
| **Spec** | [communication.md](../spec/2-architecture/communication.md) · théorie G5, G7, A3.g |

## Contexte

La Query lit l'état d'une autre Feature. Si elle rend une `Promise`, toute la
couche concrète devient asynchrone : les Views attendent, gèrent des états de
chargement intermédiaires, et un handler de Query peut déguiser un chargement
extérieur en lecture. Si elle rend `null` quand elle échoue, l'auteur valide un
traitement fondé sur une lecture qui n'a pas eu lieu (G7).

## Décision

`on{Nom}Query(params, ctx)` rend **une valeur synchrone** du type déclaré, et
`ctx.query()` la rend telle quelle, capturée par copie (G2, I29).

- Le handler **ne lit que l'état en mémoire** de sa Feature. Son contexte ne permet que d'interroger : émettre ou muter est refusé (`READ_ONLY`, A3.g). Tout I/O (`fetch`, `await`, timer) y est un anti-pattern (I64), signalé en revue.
- La cible doit être **prête et inactive** (C.1) : absente, non prête ou déjà en cours de traitement, la Query est refusée (`UNKNOWN_TARGET`, `TARGET_NOT_READY`, `TARGET_ACTIVE`).
- Un refus ou une exception du handler **interrompt l'auteur et fait échouer son unité** (G7, I55) ; l'intercepter ne la sauve pas (`UNRECOVERABLE`). Aucune réponse de substitution.
- Une `Promise` rendue n'est pas capturable : elle est refusée (`NOT_CAPTURABLE`).
- `null` n'est une réponse que si le contrat métier le prévoit (`result: TItem | null`).

```ts
// ❌ handler de Query asynchrone          // ✅ chargement par Command, lecture en mémoire
async onPriceQuery() { await fetch(…) }    onPricesLoadedCommand(p, ctx) { ctx.mutate("load", (d) => { d.prices = p; }); }
                                           onPriceQuery({ id }) { return this.entity.state.prices[id] ?? null; }
```

## Alternatives rejetées

- **`Promise<T>`** (décision initiale) — contamine toute la couche concrète d'`await`, alors que la lecture porte sur un état déjà en mémoire.
- **`T | null`, `null` si aucun répondant ou si le handler lève** (contrat de la strate 0) — valide un traitement sur une lecture échouée ; contraire à G7.
- **`T | Promise<T>`** — chaque appelant doit gérer les deux cas.
- **Type `Result<T>`** — l'erreur de transport n'est pas une valeur métier ; elle fait échouer l'unité.

## Conséquences

- Seule la voie Query rend une valeur, et elle est immédiate ; `trigger` et `emit` rendent `void`.
- Une donnée pas encore chargée se modélise dans l'Entity (`status: "loading"`) et se projette par un Event, jamais en attendant une réponse.
- Le démarrage ordonne les Features par `dependsOn` (C.1) : une Query de démarrage vers une Feature non prête fait échouer le démarrage.
