# ADR-0003 : Channel Runtime Semantics

| Champ         | Valeur           |
| ------------- | ---------------- |
| **Statut**    | 🟢 Accepted      |
| **Date**      | 2026-03-18       |
| **Décideurs** | @ncac            |
| **RFC liée**  | RFC-0002-channel |

> ### ⚠️ Amendement 2026-04-03 — Impact ADR-0023
>
> **[ADR-0023](ADR-0023-request-reply-sync-vs-async.md)** (Accepted) révise D9 : `request()` retourne `T` **synchrone** (et non plus `Promise<T>`).
> Les sections suivantes de cet ADR sont **partiellement supersédées** :
>
> - **Contraintes §Request** : `Promise<T>` → `T | null` sync
> - **Question 2 (No Replier) — Cas A Timeout** : obsolète (un replier sync ne peut pas « prendre trop de temps »)

> ### ⚠️ Amendement 2026-04-17 — Observabilité + frontière compile/runtime
>
> Suite à un feedback de review (PR #2), deux sections ajoutées :
>
> - **§ Observabilité des erreurs Request Lane** : distinction dev/strict vs prod, ErrorReporter injectable
> - **§ Frontière compile-time / runtime** : quelles garanties tiennent en mode ESM/lazy (ADR-0019) vs mode bundle
> - **Nouveaux invariants** : I64 (replier sync strict), I65 (request error reporting obligatoire), I66 (bootstrap = frontière de confiance)
> - **Question 2 — Cas B Erreur** : le replier throw → retourne `null` sync (D44 révisé), pas `RequestError`
> - **Synthèse — Request timeout** : supprimé
> - **Configuration — `requestTimeout`** : supprimé
> - **Implémentation — `async request()`** : remplacé par appel synchrone
>
> Les décisions Command Lane, Event Lane, Listener ordering, Teardown et Event sans listeners restent **inchangées**.

---

## Contexte

RFC-0002-channel définit le **contrat de typage** des Channels (tri-lane, TChannelDefinition, namespace pattern) mais laisse ouverts plusieurs comportements runtime. L'audit identifie :

> _"Les comportements exacts à formaliser restent encore, notamment : absence de handler/replier, politique d'erreur sur `dispatchRequest`, garanties d'ordre, teardown / unsubscribe / fuites, interaction précise avec metas et hop."_

### Questions à trancher

| Question                                                                | Impact                                        |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| **No handler** : un Command est envoyé mais aucun handler n'existe      | Erreur ? Silent ? Warning ?                   |
| **No replier** : un Request est envoyé mais personne ne reply           | Timeout ? Erreur immédiate ? Pending infini ? |
| **Ordre garanti** : les Events sont-ils reçus dans l'ordre d'émission ? | Correctness                                   |
| **Teardown** : quand et comment unsubscribe les listeners ?             | Memory leaks                                  |
| **Duplicate handlers** : deux handlers pour le même Command ?           | Architecture violation                        |
| **Undelivered events** : un Event émis sans listeners                   | Warning ? Silent ?                            |

---

## Contraintes

### Prérequis fondamental : TypeScript obligatoire

> **Bonsai impose TypeScript** comme langage de développement.
> Ce n'est pas une recommandation, c'est un prérequis.

Cette contrainte a des conséquences majeures sur les vérifications runtime :

| Vérification        | Sans TypeScript | Avec TypeScript                                                  |
| ------------------- | --------------- | ---------------------------------------------------------------- |
| Handler manquant    | Runtime check   | ✅ **Compile-time** via `implements TRequiredCommandHandlers<T>` |
| Replier manquant    | Runtime check   | ✅ **Compile-time** via `implements TRequiredRequestHandlers<T>` |
| Payload incorrect   | Runtime check   | ✅ **Compile-time** via typage générique                         |
| Channel non déclaré | Runtime check   | ✅ **Compile-time** via `static readonly listen/request`         |

**Conséquence** : de nombreuses vérifications runtime deviennent **inutiles**.
Les seuls cas runtime restants sont :

- ~~**Timeout** : un replier existe mais prend trop de temps~~ → **Obsolète** (ADR-0023 : replier sync, retour immédiat)
- **Erreur** : un replier throw → retourne `null` synchrone (D44 révisé par ADR-0023)
- **Lazy loading** : une Feature n'est pas encore chargée (cas rare, optionnel)

### Architecturales (RFC)

- **Command = 1:1** : un seul handler (la Feature propriétaire) — I10
- **Event = 1:N** : N subscribers possibles — I11
- **Request = 1:1 synchrone** : un seul replier, retourne `T | null` — I29 (révisé par [ADR-0023](ADR-0023-request-reply-sync-vs-async.md))
- **Radio interne** : l'implémentation runtime est un détail interne — I15

### Techniques

- **Implémentation RxJS probable** : Subjects, Observables, mais abstrait
- **Async/await** : requests sont async
- **Memory** : pas de fuites sur components détruits
- **Testabilité** : comportements mockables

---

## Options par question

### Question 1 : No Handler (Command sans handler)

> **Contexte TypeScript** : ce cas est normalement **impossible** car
> `implements TRequiredCommandHandlers<T>` force la Feature à implémenter
> tous les handlers déclarés dans le Channel.
>
> Le seul cas où ce problème peut survenir est le **lazy loading** :
> une View trigger un Command vers une Feature pas encore chargée.

#### Option 1A — Erreur immédiate

```typescript
trigger("cart:unknownCommand", payload);
// → throw NoHandlerError('cart:unknownCommand')
```

| Avantages                   | Inconvénients                        |
| --------------------------- | ------------------------------------ |
| + Bug détecté immédiatement | - Crash si Feature pas encore loaded |
| + Fail-fast                 | - Rigide                             |

#### Option 1B — Warning + silent fail

```typescript
trigger("cart:unknownCommand", payload);
// → console.warn('No handler for cart:unknownCommand')
// → Rien ne se passe
```

| Avantages               | Inconvénients                |
| ----------------------- | ---------------------------- |
| + Résilient             | - Bug potentiellement masqué |
| + Lazy loading friendly | - DX moins bonne             |

#### Option 1C — Mode-dependent

```typescript
// development → throw
// production → warn + silent
// strict → throw
```

| Avantages             | Inconvénients                  |
| --------------------- | ------------------------------ |
| + Best of both worlds | - Configuration supplémentaire |

**Recommandation** : **1C (Mode-dependent)** — cohérent avec ADR-0002.

**✅ Décision validée** : `development` → throw, `production` → warn + silent.

---

### Question 2 : No Replier (Request sans replier)

> **⚠️ Amendement ADR-0023** : cette section a été rédigée quand `request()` retournait `Promise<T>`.
> Avec ADR-0023 (Accepted), `request()` retourne `T | null` **synchrone**.
> Le **Cas A (Timeout)** est **obsolète** — un replier sync retourne immédiatement.
> Le **Cas B (Erreur)** reste valide mais simplifié : le replier throw → retourne `null` sync.

> **Contexte TypeScript** : le cas "oubli de replier" est **impossible**
> car `implements TRequiredRequestHandlers<T>` force l'implémentation.
>
> Restent **deux cas runtime distincts** :

| Cas         | Cause                                             | Gestion                                   |
| ----------- | ------------------------------------------------- | ----------------------------------------- |
| **Timeout** | Replier trop lent (service externe, calcul lourd) | Timeout configurable                      |
| **Erreur**  | Replier throw (service 500, validation, etc.)     | Propagation via `RequestError` (ADR-0002) |

#### ~~Cas A : Timeout (reply trop long)~~ — OBSOLÈTE (ADR-0023)

> **Supersédé** : avec `request()` → `T | null` synchrone (ADR-0023), le concept de timeout
> sur la Request Lane n'a plus de raison d'être. Un replier sync retourne immédiatement `T` ou
> throw (→ `null`). Le seul cas « pas de réponse » est le Channel non enregistré → `null` immédiat.

~~```typescript
const result = await request('pricing:getPrice', { id: '123' });
// Après 5000ms → throw TimeoutError

````~~

~~| Config | Valeur | Notes |
|--------|--------|-------|
| **Global** | 5000ms (défaut) | Configurable au bootstrap |
| **Par request** | Override possible | `request(..., { timeout: 10000 })` |
| **Infini** | `timeout: 0` | Pour les cas spéciaux (long polling, etc.) |~~

> **Obsolète** — plus de timeout sur la Request Lane (ADR-0023).

#### Cas B : Erreur de réponse (amendé par ADR-0023)

> **Amendement** : le replier est désormais synchrone. Il ne peut plus faire de `fetch()` —
> un replier lit uniquement l'Entity en mémoire. Un replier qui throw retourne `null` (D44 révisé).
> Le pattern `try/catch` côté appelant est remplacé par un test `null`.

```typescript
// Le replier throw une erreur (ex: validation)
onGetPriceRequest(payload: { id: string }, metas: TMetas): number | null {
  const price = this.entity.state.prices[payload.id];
  if (price === undefined) {
    throw new Error(`Price not found for ${payload.id}`);
    // → Le framework intercepte et retourne null à l'appelant
  }
  return price;
}

// Côté appelant — synchrone, pas de try/catch
const price = this.request('pricing:getPrice', { id });
if (price === null) {
  // Donnée non disponible — afficher un placeholder, déclencher un refresh
  this.trigger('pricing:refresh', { id }, { metas });
}
````

**Gestion** : le replier throw → retourne `null` synchrone (D44 révisé par ADR-0023).

**✅ Décision (amendée par ADR-0023)** :

- ~~Timeout : 5s par défaut, configurable globalement et par request~~ → **Supprimé** (replier sync)
- Erreurs : replier throw → retourne `null` synchrone (D44 révisé)

---

### Question 3 : Ordre des Events et listeners async

#### Contexte : JavaScript single-threaded

```typescript
emit("cart:itemAdded", item1);
// → Tous les listeners SYNC s'exécutent complètement
emit("cart:itemAdded", item2);
// → Puis ceux-ci s'exécutent
```

**L'ordre FIFO est garanti naturellement** par le runtime JS pour les listeners **synchrones**.

#### Problème : listeners async

Si un listener contient du code async, l'ordre d'exécution n'est plus garanti :

```typescript
// Listener async — PROBLÈME POTENTIEL
onCartItemAddedEvent(payload) {
  await fetch('/api/log', payload); // async !
  this.updateSomething();
}

// Timeline possible :
// t0: listener(item1) démarre, atteint await
// t1: listener(item2) démarre, atteint await
// t2: fetch(item2) résout AVANT fetch(item1) → INVERSION !
```

#### Décision

| Aspect                 | Décision                                        |
| ---------------------- | ----------------------------------------------- |
| **`emit()` signature** | `void` (fire-and-forget, non bloquant)          |
| **Ordre sync**         | ✅ Garanti par JS single-thread                 |
| **Ordre async**        | ⚠️ **Non garanti** — responsabilité développeur |

#### Pattern recommandé : Batch + Flush

Pour les cas où un listener doit effectuer une opération async sur plusieurs events :

```typescript
// ══════════════════════════════════════════════════════════════
// PATTERN : Batch + Flush pour listeners async
// ══════════════════════════════════════════════════════════════

// Feature émettrice (Cart)
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  onBulkAddCommand(items: Item[]) {
    for (const item of items) {
      this.entity.mutate("cart:addItem", { payload: { item } }, (draft) => {
        draft.items.push(item);
      });
      this.emit("itemAdded", { item });
    }
    // Signal de fin de batch
    this.emit("itemsAddedComplete", { count: items.length });
  }
}

// Feature réceptrice (Analytics) — opération async
class AnalyticsFeature extends Feature<Analytics.State, Analytics.Channel> {
  static readonly listen = [Cart.channel] as const;

  // Accumuler (sync, rapide, ordre garanti)
  onCartItemAddedEvent(payload: { item: Item }) {
    this.entity.mutate("analytics:queueItem", { payload }, (draft) => {
      draft.pendingItems.push(payload.item);
    });
  }

  // Flush (async, une seule fois à la fin)
  async onCartItemsAddedCompleteEvent(payload: { count: number }) {
    const items = this.entity.getPendingItems();
    await this.sendToAnalyticsService(items); // Async ici, safe
    this.entity.mutate("analytics:clearPending", (draft) => {
      draft.pendingItems = [];
    });
  }
}
```

**Avantages du pattern** :

- ✅ Explicite — pas de magie, le dev contrôle
- ✅ Performant — une seule requête async au lieu de N
- ✅ Prévisible — l'ordre des items est garanti (array)
- ✅ Résilient — le batch peut être rejoué si erreur

**✅ Décision validée** : Ordre garanti pour sync, pattern Batch+Flush documenté pour async.

---

### Question 4 : Ordre d'exécution des listeners

#### Contexte

Quand **plusieurs Features** écoutent le même Event, dans quel ordre sont-elles appelées ?

```typescript
// InventoryFeature écoute cart:itemAdded
// AnalyticsFeature écoute cart:itemAdded
// PricingFeature écoute cart:itemAdded

emit("cart:itemAdded", item);
// → Qui s'exécute en premier ?
```

#### Décision : Séquentiel + Isolation + Priority optionnelle

**Comportement par défaut** :

- Listeners appelés **séquentiellement** (pas en parallèle)
- Si un listener **throw**, on **log l'erreur** et on **continue** avec les autres
- Ordre par défaut : ordre de bootstrap

**Priority optionnelle** (pour cas spéciaux) :

```typescript
import { ListenerPriority } from '@bonsai/core';

// Constantes sémantiques (pas de nombres arbitraires)
enum ListenerPriority {
  FIRST = 0,      // Monitoring, logging, débug
  HIGH = 25,
  NORMAL = 50,    // Défaut (implicite)
  LOW = 75,
  LAST = 100      // Cleanup, finalization
}

// Usage : la plupart des Features ne déclarent pas de priority
static readonly listen = [Cart.channel] as const;

// Usage spécial : monitoring qui doit voir TOUT en premier
class LoggingFeature extends Feature<...> {
  static readonly listen = [
    { channel: Cart.channel, priority: ListenerPriority.FIRST },
    { channel: User.channel, priority: ListenerPriority.FIRST }
  ] as const;
}
```

| Aspect            | Décision                                       |
| ----------------- | ---------------------------------------------- |
| Exécution         | Séquentielle                                   |
| Isolation erreurs | Oui (continue après throw)                     |
| Priority          | Optionnelle, constantes sémantiques uniquement |
| Nombres custom    | ❌ Interdit (pas de `priority: 99999`)         |

**✅ Décision validée** : Séquentiel avec isolation, `ListenerPriority` optionnel.

---

### Question 5 : Teardown / Unsubscribe

#### Décision : Automatique via lifecycle

Le framework gère automatiquement le cleanup des subscriptions.
Aucune API manuelle exposée — pas de `unsubscribe()`, pas de `{ autoCleanup: false }`.

```typescript
class CartView extends View {
  onAttach() {
    // Le framework track cette subscription
    this.listen("cart:itemAdded", this.onItemAdded);
    this.listen("cart:itemRemoved", this.onItemRemoved);
  }

  // Pas besoin de onDetach pour cleanup
  // Le framework unsubscribe automatiquement quand la View est détruite
}
```

**Implémentation interne** (AbortController pattern) :

```typescript
abstract class View {
  private abortController = new AbortController();

  protected listen(event: string, handler: Function) {
    const subscription = this.channel.on(event, handler);

    // Auto-cleanup quand le composant est détruit
    this.abortController.signal.addEventListener("abort", () => {
      subscription.unsubscribe();
    });
  }

  /** @internal Appelé par le framework */
  private _destroy() {
    this.abortController.abort(); // Cleanup all subscriptions
  }
}
```

| Aspect       | Décision                           |
| ------------ | ---------------------------------- |
| Cleanup      | Automatique, géré par le framework |
| API manuelle | ❌ Pas exposée                     |
| Memory leaks | Impossibles (par design)           |

**Justification** : exposer `unsubscribe()` n'apporte rien et crée un risque d'oubli.

**✅ Décision validée** : Cleanup automatique, aucune API manuelle.

---

### ~~Question 6 : Duplicate Handlers~~ — CADUQUE

> **Caduc par architecture TypeScript** :
>
> - Un Command appartient à un Channel (I10)
> - Un Channel appartient à une Feature (I21, I22)
> - `implements TRequiredCommandHandlers<T>` force la Feature propriétaire
> - Aucune autre Feature ne peut implémenter les handlers d'un autre Channel
>
> Le duplicate handler est **structurellement impossible**.

---

### Question 7 : Event sans listeners

#### Option 7A — Silent (normal)

```typescript
emit("cart:itemAdded", item);
// Personne n'écoute → rien ne se passe, normal
```

| Avantages                                   | Inconvénients           |
| ------------------------------------------- | ----------------------- |
| + Events = broadcast, 0 listener est valide | - Peut masquer un oubli |
| + Découplage total                          |                         |

#### Option 7B — Warning en dev

```typescript
// development → console.warn('Event cart:itemAdded has no listeners')
// production → silent
```

| Avantages        | Inconvénients       |
| ---------------- | ------------------- |
| + Aide au debug  | - Peut être verbeux |
| + Silent en prod |                     |

**Recommandation** : **7A (Silent)** — 0 listeners est sémantiquement valide pour un broadcast.

**✅ Décision validée** : Silent, pas d'erreur ni warning.

---

## Synthèse des décisions

### Vérifications compile-time (TypeScript)

| Vérification       | Mécanisme                                           |
| ------------------ | --------------------------------------------------- |
| Handler manquant   | `implements TRequiredCommandHandlers<T>`            |
| Replier manquant   | `implements TRequiredRequestHandlers<T>`            |
| Payload incorrect  | Typage générique `TChannel['commands'][K]`          |
| Duplicate handlers | Impossible par architecture (1 Channel = 1 Feature) |

### Vérifications runtime

| Question                  | Décision                                                                                  | Statut      |
| ------------------------- | ----------------------------------------------------------------------------------------- | ----------- |
| No handler (lazy loading) | Mode-dependent (dev: throw, prod: warn)                                                   | ✅          |
| ~~Request timeout~~       | ~~5s défaut, configurable global + par request~~ → **Obsolète** (ADR-0023 : replier sync) | ❌ Supprimé |
| Request erreur            | Replier throw → retourne `null` sync (D44 révisé par ADR-0023)                            | ✅ Amendé   |
| Ordre Events (sync)       | Garanti par JS single-thread                                                              | ✅          |
| Ordre Events (async)      | Non garanti — pattern Batch+Flush                                                         | ✅          |
| Ordre Listeners           | Séquentiel + isolation + ListenerPriority                                                 | ✅          |
| Teardown                  | Automatique via lifecycle                                                                 | ✅          |
| Event sans listeners      | Silent (valide)                                                                           | ✅          |

---

## Décision

**🟢 Accepté**

### Configuration runtime

```typescript
const app = createApplication({
  channels: {
    // ❌ requestTimeout supprimé (ADR-0023 : request synchrone, pas de timeout)

    // Comportement no-handler (lazy loading)
    noHandler: "mode-dependent" // 'throw' | 'warn' | 'silent' | 'mode-dependent'
  }
});
```

> **Note** : pas de config pour `autoCleanup` (toujours actif)
> ni pour `listenerExecution` (toujours séquentiel isolé).
> `requestTimeout` supprimé par ADR-0023 (replier synchrone).

````

---

## Conséquences

### Positives

- ✅ Comportements prévisibles et documentés
- ✅ Détection précoce des erreurs de contrat (bootstrap)
- ✅ Pas de memory leaks (auto-cleanup)
- ✅ Résilience en production

### Négatives (acceptées)

- ⚠️ Timeout peut masquer un vrai bug — mitigé par logs détaillés
- ⚠️ Sequential listeners plus lent que parallel — accepté pour la prévisibilité

---

## Implémentation technique suggérée

### Channel interne (RxJS-based)

```typescript
class ChannelRuntime<TDef extends TChannelDefinition> {
  private commandSubject = new Subject<CommandMessage>();
  private eventSubject = new Subject<EventMessage>();
  private requestSubject = new Subject<RequestMessage>();

  // Command : unicast (un seul handler)
  registerHandler(handler: CommandHandler) {
    if (this.hasHandler) {
      throw new DuplicateHandlerError(this.namespace);
    }
    this.commandSubject.subscribe(handler);
  }

  // Event : multicast (N listeners)
  registerListener(listener: EventListener): Subscription {
    return this.eventSubject.subscribe(listener);
  }

  // Request : unicast + sync (amendé par ADR-0023)
  registerReplier(replier: RequestReplier) {
    if (this.hasReplier) {
      throw new DuplicateReplierError(this.namespace);
    }
    this.replier = replier;
  }

  // Amendé par ADR-0023 : request synchrone, retourne T | null
  request<K extends keyof TDef['requests']>(
    name: K,
    payload: TDef['requests'][K]['payload']
  ): TDef['requests'][K]['response'] | null {
    if (!this.replier) {
      // Channel non enregistré (lazy loading) → null
      if (this.config.noHandler === 'throw' ||
          (this.config.noHandler === 'mode-dependent' && __DEV__)) {
        throw new NoReplierError(name, this.namespace);
      }
      return null;
    }
    try {
      return this.replier(name, payload);
    } catch (error) {
      // D44 révisé : replier throw → null
      console.error(`[Bonsai] Reply error for ${this.namespace}:${String(name)}`, error);
      return null;
    }
  }
}
````

### Auto-cleanup via AbortController pattern

```typescript
class View {
  private abortController = new AbortController();

  protected listen(channel: Channel, event: string, handler: Function) {
    const subscription = channel.on(event, handler);

    // Auto-cleanup quand le composant est détruit
    this.abortController.signal.addEventListener("abort", () => {
      subscription.unsubscribe();
    });

    return subscription;
  }

  onDetach() {
    this.abortController.abort(); // Cleanup all subscriptions
  }
}
```

---

## Questions ouvertes

> Toutes les questions ont été résolues.

~~1. **Backpressure** : si un listener est lent, les events s'accumulent. Buffer ? Drop ?~~
→ Résolu : exécution séquentielle, pas de buffer. Pattern Batch+Flush pour async.

~~2. **Priority listeners** : certains listeners doivent-ils s'exécuter avant d'autres ?~~
→ Résolu : `ListenerPriority` optionnel avec constantes sémantiques.

~~3. **Replay** : un nouveau listener doit-il recevoir les events passés ?~~
→ Résolu : Non. Les Events sont fire-and-forget.

~~4. **Transactions** : plusieurs events atomiques ?~~
→ Hors scope v1. Pattern Batch+Flush couvre le besoin.

---

## Actions de suivi

- [ ] Implémenter ChannelRuntime avec les comportements décidés
- [ ] Ajouter validation des contrats au bootstrap
- [ ] Implémenter auto-cleanup dans la classe de base View/Feature
- [ ] Documenter les comportements dans RFC-0002-channel
- [ ] Tests : no handler, no replier, timeout, duplicate handlers

---

## Observabilité des erreurs Request Lane

> **Amendement 2026-04-17** — Suite à un feedback de review : le pattern `replier throw → null`
> est robuste en prod, mais risque de **masquer les bugs** si aucun reporting systématique n'est en place.
> Le `null` devient un état normalisé et on perd la cause racine.

### Principe : un replier throw n'est JAMAIS silencieux (I65)

Le framework **DOIT** reporter l'erreur via un mécanisme observable avant de retourner `null`.
Le `console.error` dans l'implémentation technique ci-dessus est un **minimum**, pas un maximum.

### Deux modes de reporting

| Mode             | Comportement                                                                                                              | Justification                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **dev / strict** | `console.error` + compteur interne + **optionnel `throw`** si flag `strict: true` dans la config channel                  | Fail-fast pour les tests et le développement — le développeur voit immédiatement le problème |
| **prod**         | `ErrorReporter.captureRequestError(namespace, name, error)` → hook injectable (Sentry, DataDog, custom) + retourne `null` | Résilience pour l'utilisateur final, mais remontée centralisée pour le monitoring            |

### Configuration

```typescript
const app = createApplication({
  channels: {
    noHandler: "mode-dependent",

    // ── Nouveau : observabilité Request Lane ──
    requestErrorReporting: {
      // dev : throw immédiat (fail-fast pour les tests)
      strict: __DEV__,

      // prod : hook injectable pour monitoring centralisé
      reporter: (
        error: Error,
        context: {
          namespace: string;
          requestName: string;
          payload: unknown;
          correlationId: string;
        }
      ) => {
        // Exemple : Sentry
        Sentry.captureException(error, { extra: context });
      }
    }
  }
});
```

### Implémentation amendée

```typescript
// Dans ChannelRuntime.request() — amendement du code §Implémentation
request<K extends keyof TDef['requests']>(
  name: K,
  payload: TDef['requests'][K]['payload']
): TDef['requests'][K]['response'] | null {
  if (!this.replier) {
    if (this.config.noHandler === 'throw' ||
        (this.config.noHandler === 'mode-dependent' && __DEV__)) {
      throw new NoReplierError(name, this.namespace);
    }
    return null;
  }
  try {
    return this.replier(name, payload);
  } catch (error) {
    // ── I65 : JAMAIS silencieux ──
    const context = {
      namespace: this.namespace,
      requestName: String(name),
      payload,
      correlationId: currentMetas?.correlationId ?? 'unknown'
    };

    // Toujours : log console (minimum incompressible)
    console.error(
      `[Bonsai] Reply error for ${this.namespace}:${String(name)}`,
      error,
      context
    );

    // Mode strict (dev/tests) : fail-fast
    if (this.config.requestErrorReporting?.strict) {
      throw error; // Le test échoue, le bug est visible immédiatement
    }

    // Mode prod : reporting centralisé
    this.config.requestErrorReporting?.reporter?.(
      error instanceof Error ? error : new Error(String(error)),
      context
    );

    return null; // Résilient — l'UI continue de fonctionner
  }
}
```

### Anti-pattern : `null` comme état normalisé sans investigation

```typescript
// ❌ Anti-pattern : ignorer systématiquement les null sans se poser de questions
const price = this.request("pricing:getPrice", { id });
const displayPrice = price ?? 0; // "Bof, null = 0, ça ira"
// → Le replier throw en boucle, personne ne le sait, l'utilisateur voit 0€ partout

// ✅ Pattern correct : null est un signal qui DOIT être traité
const price = this.request("pricing:getPrice", { id });
if (price === null) {
  // Le replier a échoué OU le Channel n'est pas enregistré
  // → Afficher un placeholder explicite + déclencher un refresh
  this.trigger("pricing:refresh", { id }, { metas });
  return; // Ne pas afficher un faux prix
}
```

---

## Frontière compile-time / runtime (I66)

> **Amendement 2026-04-17** — Suite à un feedback de review : les garanties TypeScript
> (« duplicate handler impossible », « handler manquant impossible ») sont vraies
> **si tout est compilé ensemble** et si personne ne contourne le type system.
> En mode ESM modulaire (ADR-0019) avec lazy loading, certaines garanties
> **redeviennent runtime** car les modules ne sont pas tous présents au démarrage.

### Matrice des garanties selon le mode

| Garantie                     | Compile-time (bundle IIFE)                  | Runtime (ESM + lazy)                                   | Mécanisme runtime                                                                           |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Handler Command existe**   | ✅ `implements TRequiredCommandHandlers<T>` | ⚠️ Le module peut ne pas être chargé                   | `app.start()` vérifie la complétude ; `noHandler: 'mode-dependent'` pour le lazy post-start |
| **Replier Request existe**   | ✅ `implements TRequiredRequestHandlers<T>` | ⚠️ Le module peut ne pas être chargé                   | `app.start()` vérifie ; `request()` retourne `null` si absent                               |
| **Pas de duplicate handler** | ✅ Architecture (1 Channel = 1 Feature)     | ✅ `BonsaiRegistry` vérifie I21 au `registerFeature()` | Erreur immédiate `BonsaiRegistryError`                                                      |
| **Payload correct**          | ✅ Generics contraints                      | ✅ Cross-module via `.d.ts` (ADR-0019 C7)              | Compile-time même en ESM si `.d.ts` présents                                                |
| **Namespace unique**         | ✅ Bootstrap assertion                      | ✅ `BonsaiRegistry` + `app.start()`                    | `BonsaiRegistryError` + I21/I24                                                             |

### Invariant I66 : le bootstrap est la frontière de confiance

> **I66** : Après `app.start()`, toutes les garanties compile-time sont vérifiées au runtime.
> Avant `app.start()`, aucune garantie runtime n'est assurée. Le bootstrap est la **frontière de confiance**.

**Implications concrètes** :

1. **Aucun `trigger()`, `emit()`, `request()` avant `app.start()`** — le framework DOIT rejeter ces appels (assertion runtime)
2. **`app.start()` valide la complétude** : pour chaque Channel enregistré, tous les handlers Command déclarés et tous les repliers Request déclarés doivent avoir un handler/replier en place
3. **Le lazy loading post-start est un cas dégradé explicite** : le mode `noHandler: 'mode-dependent'` s'applique. Le développeur sait que le module n'est peut-être pas encore chargé — ce n'est pas un bug silencieux

### Ce que le type system NE PEUT PAS garantir

| Contournement                     | Risque                                    | Mitigation                                                                          |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `as any` / `@ts-ignore`           | Tout invariant compile-time tombe         | Lint rule `no-explicit-any` + code review                                           |
| `import()` dynamique sans `await` | Module pas encore chargé quand on trigger | Convention : `await import()` puis `BonsaiRegistry.collect()` (ADR-0019)            |
| Cast de payload                   | Payload incorrect à runtime               | Validation Valibot au handler (ADR-0022) — filet de sécurité runtime                |
| Modules JS sans `.d.ts`           | Perte totale de type-safety inter-module  | `bonsai build --mode=esm` refuse de produire un artefact sans `.d.ts` (ADR-0019 C7) |

---

## Références

- [RxJS Subjects](https://rxjs.dev/guide/subject)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Event-driven architecture patterns](https://microservices.io/patterns/data/event-sourcing.html)
- [ADR-0019 — Mode ESM Modulaire](ADR-0019-mode-esm-modulaire.md)
- [ADR-0023 — Sémantique request/reply sync](ADR-0023-request-reply-sync-vs-async.md)

---

## Historique

| Date       | Changement                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-17 | Création (Proposed) — 7 questions documentées                                                                                                                                                                     |
| 2026-03-18 | Prérequis TypeScript ajouté, questions 6 caduque                                                                                                                                                                  |
| 2026-03-18 | **Accepted** — Toutes les décisions validées                                                                                                                                                                      |
| 2026-04-03 | **Amendement ADR-0023** — Request Lane sync : timeout supprimé, erreur → `null` sync, implémentation amendée, I29 révisé                                                                                          |
| 2026-04-17 | **Amendement observabilité + frontière compile/runtime** — §Observabilité Request Lane (I65, ErrorReporter dev/prod), §Frontière compile-time/runtime (I66, matrice ESM vs bundle). Suite à feedback review PR #2 |
