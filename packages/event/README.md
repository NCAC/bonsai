# @bonsai/event

> **Infrastructure de communication tri-lane du framework Bonsai.**
> Channel (Command / Event / Request) + Radio (singleton registre).

---

## Rôle

`@bonsai/event` fournit les deux primitives de communication runtime de Bonsai :

| Export | Rôle | Visibilité |
|--------|------|------------|
| **`Channel`** | Contrat de communication tri-lane : Commands (1:1), Events (1:N), Requests (1:1 sync) | Interne framework — jamais instancié par le développeur |
| **`Radio`** | Singleton registre des Channels — câblage au bootstrap | Interne framework (I15) |

> **Ce package est une infrastructure interne.** Le développeur d'application
> interagit avec les Channels indirectement via `Feature.emit()`, `View.trigger()`,
> `View.request()`, etc. Il n'importe jamais `Channel` ni `Radio` directement.

---

## Architecture — Channel tri-lane

Chaque Channel expose trois lanes indépendantes :

```

                 Channel "cart"                       │

  Command Lane   │  trigger(name, payload)    → 1:1  │
                 │  handle(name, handler)             │

  Event Lane     │  emit(name, payload)       → 1:N  │
                 │  on(name, handler)                 │
                 │  off(name, handler)                │
                 │  → émet `any` automatiquement      │

  Request Lane   │  request(name, params)     → sync │
                 │  reply(name, handler)       T|null │

```

### Sémantiques runtime (ADR-0003)

| Situation | Comportement |
|-----------|-------------|
| `trigger()` sans handler | `throw NoHandlerError` (strate 0 : toujours throw) |
| `handle()` dupliqué | `throw DuplicateHandlerError` (I10) |
| `emit()` sans listener | Silencieux — valide sémantiquement |
| `request()` sans replier | Retourne `null` (D44, ADR-0023) |
| `reply()` qui throw | Retourne `null`, erreur loguée (I55) |
| Listener qui throw | Erreur isolée, les autres listeners continuent (ADR-0002) |

### Événement réservé `any`

Après chaque `emit()` d'un Event granulaire, le Channel émet automatiquement
un événement technique `any` avec le payload :

```typescript
type TAnyEventPayload = {
  readonly event: string;
  readonly changes: Record<string, unknown>;
};
```

---

## Architecture — Radio singleton

```typescript
Radio.me()                    // → instance unique
Radio.me().channel("cart")    // → Channel (get or create)
Radio.me().hasChannel("cart") // → boolean
Radio.reset()                 // → reset complet (tests only)
```

Radio est le **registre central** des instances Channel. Au bootstrap
(`app.start()`), le framework résout les déclarations statiques des composants
en connexions runtime via Radio.

> **I15** — Radio n'est jamais exposé au développeur d'application.

---

## Dépendances

```
@bonsai/types   ← TJsonValue (payloads)
@bonsai/error   ← NoHandlerError, DuplicateHandlerError, invariant()
@bonsai/rxjs    ← Subject, Subscription (dispatch interne)
```

---

## Structure des fichiers

```
src/
  bonsai-event.ts         ← barrel (exports publics)
  channel.class.ts        ← Channel tri-lane
  radio.singleton.ts      ← Radio singleton
  types.ts                ← types publics (TAnyEventPayload, etc.)
```

---

## Périmètre strate 0 (ADR-0028)

**Inclus :**
- Channel tri-lane : `handle`/`trigger`, `on`/`off`/`emit` + `any`, `reply`/`request` sync
- Radio singleton : registre, get-or-create, reset
- Détection handler absent (`trigger` sans `handle`) → throw
- Détection handler dupliqué → throw
- Isolation des erreurs entre listeners (`emit`)
- `dispose()` — nettoyage des registres et Subjects RxJS

**Exclu (strate 1+) :**
- Metas causales (`correlationId`, `causationId`, `hop`) — stub
- Anti-boucle I9 (`hop > maxHops`)
- `noHandler` configurable par mode (dev/prod)
- Generics `TChannelDefinition` typés — arrive avec Feature

---

## Documents normatifs

| Document | Ce qu'il spécifie |
|----------|-------------------|
| [RFC communication.md](../../docs/rfc/2-architecture/communication.md) | Tri-lane, matrice des droits, flux, `any`, Radio §8 |
| [ADR-0003](../../docs/adr/ADR-0003-channel-runtime-semantics.md) | Sémantiques runtime (throw/warn/silent par mode) |
| [ADR-0023](../../docs/adr/ADR-0023-request-reply-sync-vs-async.md) | `request()` synchrone, `T \| null` |
| [ADR-0002](../../docs/adr/ADR-0002-error-propagation-strategy.md) | Isolation des erreurs, taxonomie `BonsaiError` |
| [ADR-0028](../../docs/adr/ADR-0028-implementation-phasing-strategy.md) | Périmètre strate 0 |
| [ADR-0031](../../docs/adr/ADR-0031-monorepo-package-topology.md) | Topologie packages, DAG |

---

## Tests

Les tests de spécification sont dans `tests/unit/strate-0/` :
- `channel.basic.test.ts` — invariants I10, I11, I25, I26, I27, I29, I55
- `radio.singleton.test.ts` — invariant I15
