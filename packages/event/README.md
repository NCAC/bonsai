# @bonsai/event

> **Infrastructure de communication tri-lane du framework Bonsai.**
> Channel (Command / Event / Request) + Radio (singleton registre).

---

## Rôle

`@bonsai/event` fournit les deux primitives de communication runtime de Bonsai :

| Export        | Rôle                                                                                  | Visibilité                                              |
| ------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **`Channel`** | Contrat de communication tri-lane : Commands (1:1), Events (1:N), Requests (1:1 sync) | Interne framework — jamais instancié par le développeur |
| **`Radio`**   | Singleton registre des Channels (get-or-create par namespace)                         | Interne framework (I15)                                 |

Le package exporte aussi les types `TChannelDefinition`, `TChannelToken`, `TTokenDef` et
`TAnyEventPayload` ; `@bonsai/core` ne ré-exporte que ces **types**, jamais `Channel` ni `Radio` (I15, I80).

> **Ce package est une infrastructure interne.** Le développeur d'application
> interagit avec les Channels indirectement via `Feature.emit()`, `Feature.request()`,
> `View.trigger()`, `View.request()`, etc. Il n'importe jamais `Channel` ni `Radio` directement.

---

## Architecture — Channel tri-lane

`Channel<TDef extends TChannelDefinition>` (nom lisible par `channel.name`) expose trois lanes
indépendantes, toutes typées par `keyof TDef[lane]` (I76) :

```text
Command Lane   handle(name, handler)                    trigger(name, payload)   → 1:1
Event Lane     listen(name, listener)                   emit(name, payload)      → 1:N
               unlisten(name, listener)                 listenAny / unlistenAny  → événement technique `any`
Request Lane   reply(name, replier)   unreply(name)     request(name, params)    → sync, T | null
Cycle de vie   clear()  — vide tous les registres et complète les Subjects RxJS
```

### Sémantiques runtime (ADR-03)

| Situation                | Comportement                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `trigger()` sans handler | `throw NoHandlerError` (toujours, quel que soit le mode)                              |
| `handle()` / `reply()` dupliqué | `throw DuplicateHandlerError` (I10)                                            |
| `emit()` sans listener   | Silencieux — valide sémantiquement                                                    |
| `request()` sans replier | Retourne `null` (ADR-02), sans log                                                    |
| Replier qui throw        | `request()` retourne `null` et journalise via `console.error` (I55)                   |
| Listener qui throw       | `ListenerError` journalisée via `console.error` ; les autres listeners continuent (ADR-05) |
| Handler Command qui throw | Exception **non capturée** : remonte à l'appelant de `trigger()`                     |

### Événement réservé `any`

Après chaque `emit()` d'un Event granulaire, le Channel émet automatiquement
un événement technique `any` :

```typescript
type TAnyEventPayload = {
  readonly event: string;                      // nom de l'Event granulaire
  readonly changes: Record<string, unknown>;   // payload de l'Event tel quel ({} si ce n'est pas un objet)
};
```

---

## Architecture — Radio singleton

```typescript
Radio.me()                    // → instance unique
Radio.me().channel("cart")    // → Channel (get or create, non typé)
Radio.me().channelFor(token)  // → Channel<TDef> typé depuis un TChannelToken (get or create)
Radio.me().hasChannel("cart") // → boolean
Radio.me().getChannelNames()  // → string[]
Radio.me().removeChannel("cart") // → boolean (appelle clear() avant retrait)
Radio.reset()                 // → reset complet (tests only)
```

Radio est un registre **passif** : il ne résout aucune déclaration. `Application.start()` crée un
Channel par clé du manifest (Phase 1) et valide les références croisées avant (Phases 0a–0c).

> **I15** — Radio n'est jamais exposé au développeur d'application.

---

## Dépendances

```text
@bonsai/error   ← NoHandlerError, DuplicateHandlerError, ListenerError
@bonsai/rxjs    ← RXJS.Subject, RXJS.Subscription (dispatch interne)
```

(`package.json` déclare aussi `@bonsai/types`, non importé par le code.)

---

## Structure des fichiers

```text
src/
  bonsai-event.ts         ← barrel (Channel, Radio, types publics)
  channel.class.ts        ← Channel tri-lane + types TChannelDefinition/TChannelToken/TTokenDef/TAnyEventPayload
  radio.singleton.ts      ← Radio singleton
```

---

## Périmètre livré (ADR-31)

**Inclus :**

- Channel tri-lane typé (`Channel<TDef>`, ADR-14) : `handle`/`trigger`, `listen`/`unlisten`/`emit` + `any`, `reply`/`unreply`/`request` synchrone
- Radio singleton : registre, get-or-create, `channelFor(token)`, `reset()`
- Détection handler absent (`trigger` sans `handle`) et handler dupliqué → throw
- Isolation des erreurs entre listeners (`emit`)
- `clear()` — nettoyage des registres et Subjects RxJS

**Exclu (strates suivantes) :**

- Metas causales (`correlationId`, `causationId`, `hop`) et anti-boucle I9 — strate 1b
- `ErrorReporter` (I65) et rejet des messages avant `start()` (I66)
- Nettoyage automatique des abonnements au démontage d'un composant

---

## Documents normatifs

| Document                                                                 | Ce qu'il spécifie                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| [spec communication.md](../../docs/spec/2-architecture/communication.md) | Tri-lane, matrice des droits, flux, `any`, Radio §8 |
| [ADR-03](../../docs/adr/ADR-03-channel-runtime.md)                       | Sémantiques runtime du Channel                      |
| [ADR-02](../../docs/adr/ADR-02-request-synchrone.md)                     | `request()` synchrone, `T \| null`                  |
| [ADR-05](../../docs/adr/ADR-05-propagation-erreurs.md)                   | Isolation des erreurs, taxonomie `BonsaiError`      |
| [ADR-14](../../docs/adr/ADR-14-contrats-types.md)                        | `TChannelDefinition`, `TChannelToken`               |
| [ADR-31](../../docs/adr/ADR-31-strates-perimetre-v1.md)                  | Périmètre des strates                               |
| [ADR-28](../../docs/adr/ADR-28-monorepo-packages.md)                     | Topologie packages, DAG                             |

---

## Tests

Les tests de spécification sont dans `tests/unit/` :

- `strate-0/channel.basic.test.ts` — invariants I10, I11, I25, I26, I27, I29, I55
- `strate-0/radio.singleton.test.ts` — comportement runtime de Radio (I15 est prouvé côté types par `tests/types/strate-0/encapsulation.types.test.ts`)
- `channel.class.test.ts`, `radio.singleton.test.ts` — tests historiques hors strate
