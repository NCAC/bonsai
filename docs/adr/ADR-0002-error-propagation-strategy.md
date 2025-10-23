# ADR-0002 : Error Propagation Strategy

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-18 |
| **Décideurs** | @ncac |
| **RFC liée** | RFC-0002-feature, RFC-0002-entity |
| **ADR liée** | [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) |

---

## Contexte

Les RFC définissent les flux de communication (Commands, Events, Requests) mais ne spécifient pas le comportement en cas d'erreur. L'audit identifie ce manque :

> *"Le second point à verrouiller est le **contrat d'erreur** : que se passe-t-il si un handler command throw ? Si un request handler rejette ? Si un event listener échoue au milieu d'une cascade ?"*

### Lien avec ADR-0001

ADR-0001 introduit `mutate(intent, params?, recipe)`. Cela crée de nouvelles questions :
- Que se passe-t-il si le `recipe` throw ?
- Que se passe-t-il si un `onXxxEntityUpdated` throw ?

---

## Décision

### Taxonomie des erreurs

Les erreurs sont catégorisées par **couche** et **type** :

```
┌─────────────────────────────────────────────────────────────────┐
│                        ERREURS BONSAI                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENTITY LAYER (State)                                          │
│  ├── MutationError     : recipe throw → Immer rollback          │
│                                                                 │
│  FEATURE LAYER (Logic)                                         │
│  ├── CommandError      : onXxxCommand() throw                   │
│  ├── RequestError      : onXxxRequest() throw/reject            │
│  └── BroadcastError    : onXxxEntityUpdated() throw             │
│                                                                 │
│  CHANNEL LAYER (Communication)                                 │
│  ├── ListenerError     : Event listener throw                   │
│  ├── TimeoutError      : Request sans réponse                   │
│  └── NoHandlerError    : Command/Request sans handler           │
│                                                                 │
│  VIEW LAYER (UI)                                               │
│  ├── RenderError       : Projection/template throw              │
│  └── BehaviorError     : Behavior throw                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Matrice de comportement

| Erreur | State | Historique | Continue ? | Remontée ? | Mode dev | Mode prod |
|--------|-------|------------|------------|------------|----------|-----------|
| **MutationError** | ❌ Rollback | ❌ Non ajouté | Non | ✅ throw | throw | throw |
| **CommandError** | ❌ Pas muté | — | Non | ✅ throw | throw | throw |
| **RequestError** | — | — | Non | ✅ reject | reject | reject |
| **BroadcastError** | ✅ Conservé | ✅ Conservé | ✅ Oui | ❌ log | throw | log |
| **ListenerError** | — | — | ✅ Oui | ❌ log | throw | log |
| **TimeoutError** | — | — | Non | ✅ reject | reject | reject |
| **NoHandlerError** | — | — | — | ⚙️ Config | throw | warn |
| **RenderError** | — | — | ✅ Boundary | ❌ boundary | throw | boundary |
| **BehaviorError** | — | — | ✅ Oui | ❌ log | throw | log |

### Principe clé : séparation Mutation vs Broadcast

```typescript
// MUTATION : erreur dans recipe → state intact
this.entity.mutate({ intent: "cart:addItem" }, draft => {
  throw new Error("Validation failed");
  // → Immer rollback automatique
  // → MutationError remontée
  // → State INTACT
});

// BROADCAST : erreur dans handler → state CONSERVÉ
onItemsEntityUpdated(prev, next, patches) {
  this.emit('cart:updated', { items: next });
  throw new Error("Analytics failed");
  // → State DÉJÀ MODIFIÉ (mutation réussie)
  // → BroadcastError loggée
  // → Autres handlers quand même appelés
}
```

**Justification** : L'erreur dans un entity handler concerne le **broadcast** (emit vers Channel), pas la **mutation** elle-même. Le state est correct, seule la propagation a échoué.

---

## Hiérarchie TypeScript

```typescript
/**
 * Base class pour toutes les erreurs Bonsai.
 * Porte le contexte causal (metas).
 */
abstract class BonsaiError extends Error {
  abstract readonly code: string;
  
  constructor(
    message: string,
    public readonly metas: TMessageMetas | null,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ═══════════════════════════════════════════════════════════
// ENTITY LAYER
// ═══════════════════════════════════════════════════════════

class MutationError extends BonsaiError {
  readonly code = 'MUTATION_FAILED';
  
  constructor(
    public readonly intent: string,
    public readonly payload: unknown,
    cause: Error,
    metas: TMessageMetas | null
  ) {
    super(`Mutation "${intent}" failed: ${cause.message}`, metas, cause);
  }
}

// ═══════════════════════════════════════════════════════════
// FEATURE LAYER
// ═══════════════════════════════════════════════════════════

class CommandError extends BonsaiError {
  readonly code = 'COMMAND_FAILED';
  
  constructor(
    public readonly command: string,
    public readonly payload: unknown,
    cause: Error,
    metas: TMessageMetas
  ) {
    super(`Command "${command}" failed: ${cause.message}`, metas, cause);
  }
}

class RequestError extends BonsaiError {
  readonly code = 'REQUEST_FAILED';
  
  constructor(
    public readonly request: string,
    public readonly params: unknown,
    cause: Error,
    metas: TMessageMetas
  ) {
    super(`Request "${request}" failed: ${cause.message}`, metas, cause);
  }
}

class BroadcastError extends BonsaiError {
  readonly code = 'BROADCAST_FAILED';
  
  constructor(
    public readonly handler: string,
    public readonly intent: string,
    public readonly changedKeys: string[],
    cause: Error,
    metas: TMessageMetas | null
  ) {
    super(`Broadcast in "${handler}" failed after "${intent}"`, metas, cause);
  }
}

// ═══════════════════════════════════════════════════════════
// CHANNEL LAYER
// ═══════════════════════════════════════════════════════════

class ListenerError extends BonsaiError {
  readonly code = 'LISTENER_FAILED';
  
  constructor(
    public readonly event: string,
    public readonly listener: string,
    cause: Error,
    metas: TMessageMetas
  ) {
    super(`Listener "${listener}" failed for event "${event}"`, metas, cause);
  }
}

class TimeoutError extends BonsaiError {
  readonly code = 'REQUEST_TIMEOUT';
  
  constructor(
    public readonly request: string,
    public readonly timeoutMs: number,
    metas: TMessageMetas
  ) {
    super(`Request "${request}" timed out after ${timeoutMs}ms`, metas);
  }
}

class NoHandlerError extends BonsaiError {
  readonly code = 'NO_HANDLER';
  
  constructor(
    public readonly messageType: 'command' | 'request',
    public readonly name: string,
    metas: TMessageMetas
  ) {
    super(`No handler for ${messageType} "${name}"`, metas);
  }
}

// ═══════════════════════════════════════════════════════════
// VIEW LAYER
// ═══════════════════════════════════════════════════════════

class RenderError extends BonsaiError {
  readonly code = 'RENDER_FAILED';
  
  constructor(
    public readonly view: string,
    public readonly phase: 'template' | 'projection' | 'reconcile',
    cause: Error
  ) {
    super(`Render failed in "${view}" during ${phase}`, null, cause);
  }
}

class BehaviorError extends BonsaiError {
  readonly code = 'BEHAVIOR_FAILED';
  
  constructor(
    public readonly behavior: string,
    public readonly view: string,
    cause: Error
  ) {
    super(`Behavior "${behavior}" failed in view "${view}"`, null, cause);
  }
}
```

---

## Implémentation

### Entity.mutate() — gestion MutationError

```typescript
mutate(intent: string, params: Record<string, unknown> | undefined, recipe: (draft) => void): TEntityEvent {
  const payload = params;
  
  try {
    const [nextState, patches, inversePatches] = produceWithPatches(
      this._state,
      recipe
    );
    
    // Si on arrive ici, recipe n'a pas throw
    this._state = nextState;
    const event = { intent, payload, patches, inversePatches, ... };
    this._history.push(event);
    
    // Notification des handlers (peut throw BroadcastError)
    this._notifyHandlers(event);
    
    return event;
    
  } catch (error) {
    if (error instanceof BroadcastError) {
      // State déjà modifié, on laisse passer (loggé dans _notifyHandlers)
      throw error; // ou pas, selon mode
    }
    // Immer a rollback automatiquement
    throw new MutationError(intent, payload, error, this._currentMetas);
  }
}
```

### _notifyHandlers() — gestion BroadcastError

```typescript
private _notifyHandlers(event: TEntityEvent): void {
  const errors: BroadcastError[] = [];
  
  // Per-key handlers
  for (const key of event.changedKeys) {
    const handler = this[`on${capitalize(key)}EntityUpdated`];
    if (handler) {
      try {
        handler.call(this.feature, prev[key], next[key], event.patches);
      } catch (error) {
        const broadcastError = new BroadcastError(
          `on${capitalize(key)}EntityUpdated`,
          event.intent,
          event.changedKeys,
          error,
          this._currentMetas
        );
        errors.push(broadcastError);
        this._reportError(broadcastError);
        // Continue avec les autres handlers
      }
    }
  }
  
  // Catch-all handler
  const catchAll = this.feature.onAnyEntityUpdated;
  if (catchAll) {
    try {
      catchAll.call(this.feature, event);
    } catch (error) {
      const broadcastError = new BroadcastError(
        'onAnyEntityUpdated',
        event.intent,
        event.changedKeys,
        error,
        this._currentMetas
      );
      errors.push(broadcastError);
      this._reportError(broadcastError);
    }
  }
  
  // En mode dev, throw si erreurs (pour visibilité)
  if (__DEV__ && errors.length > 0) {
    throw errors[0];
  }
}
```

### Channel — gestion ListenerError

```typescript
async dispatchEvent(name: string, payload: unknown, metas: TMessageMetas): Promise<void> {
  const errors: ListenerError[] = [];
  
  for (const listener of this.listeners.get(name) ?? []) {
    try {
      await listener(payload, metas);
    } catch (error) {
      const listenerError = new ListenerError(
        name,
        listener.name || 'anonymous',
        error,
        metas
      );
      errors.push(listenerError);
      this._reportError(listenerError);
      // Continue avec les autres listeners
    }
  }
  
  if (__DEV__ && errors.length > 0) {
    throw errors[0];
  }
}
```

---

## Configuration

```typescript
const app = createApplication({
  errorHandling: {
    // Mode global
    mode: __DEV__ ? 'development' : 'production',
    
    // Comportements par défaut (overridables)
    noHandler: __DEV__ ? 'throw' : 'warn',
    // requestTimeout supprimé (ADR-0023 : request synchrone, pas de timeout)
    
    // Reporter custom (Sentry, Datadog, etc.)
    reporter: (error: BonsaiError) => {
      console.error(`[${error.code}]`, error.message, error.metas);
      // Sentry.captureException(error);
    }
  }
});
```

### Modes prédéfinis

| Mode | Description | Comportement erreurs non-critiques |
|------|-------------|-----------------------------------|
| `development` | Fail-fast, erreurs visibles | throw |
| `production` | Résilient, isolation | log + continue |
| `strict` | Pour tests, tout throw | throw |

---

## Recovery Hook

Chaque composant peut override `onError()` pour un comportement custom :

```typescript
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  
  protected onError(error: BonsaiError): void {
    if (error instanceof RequestError && error.request === 'pricing:getPrice') {
      // Retry avec cache
      this.useCachedPrice();
      return;
    }
    
    if (error instanceof MutationError) {
      // Notifier l'utilisateur
      this.emit('cart:error', { message: 'Action failed, please retry' });
      return;
    }
    
    // Comportement par défaut
    super.onError(error);
  }
}
```

---

## ErrorReporter — infrastructure de collecte et de consultation

> **Position architecturale** : les erreurs ne sont PAS un domaine métier.
> Elles ne sont PAS modélisées comme Feature + Entity + Channel.
> L'ErrorReporter est une **infrastructure framework transversale** (comme Radio),
> pas un composant Bonsai.

### Pourquoi pas de Channel framework `error` ?

Le Router est un namespace réservé parce que c'est une **Feature spécialisée** — il a une Entity (état de la route), il émet des Events (`router:routeChanged`), il répond à des Requests. Il s'inscrit dans le modèle Feature.

Les erreurs ne s'inscrivent **pas** dans ce modèle :

| Aspect | Domain state (Feature+Entity+Channel) | Erreurs |
|--------|---------------------------------------|--------|
| Origine | Déclenchée par un trigger utilisateur | Capturée automatiquement par le framework |
| Mutation | `mutate(intent, recipe)` contrôlée | Pas de mutation — les erreurs sont accumulées, pas modifiées |
| Diffusion | Events (1:N) vers des listeners | Pas de listeners — les erreurs sont logguées/stockées |
| Consultation | `request()` via Channel | API DevTools directe |

Si un développeur veut **afficher** des erreurs utilisateur (toast, bannière), ce sont des **erreurs applicatives** (ex: `cart:addItemFailed`), pas des erreurs d'infrastructure. Elles passent par le Channel métier normal.

### Architecture de l'ErrorReporter

```
┌──────────────────────────────────────────────────────┐
│                    Application                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │          ErrorReporter (infrastructure)           │ │
│  │                                                    │ │
│  │  ← Feature throw (MutationError, CommandError)    │ │
│  │  ← Channel throw (ListenerError, TimeoutError)    │ │
│  │  ← View throw (RenderError, BehaviorError)        │ │
│  │                                                    │ │
│  │  → console.error() [mode debug]                   │ │
│  │  → ring buffer [mode prod]                        │ │
│  │  → reporter custom (Sentry, Datadog)              │ │
│  │  → DevTools hooks (onError, getErrors)            │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Comportement par mode

| Mode | `console.error()` | Ring buffer | Reporter custom | `onError()` hook |
|------|-------------------|-------------|-----------------|------------------|
| `development` | ✅ Immédiat, avec stack complète | ✅ Stocké | ✅ Appelé si configuré | ✅ Appelé |
| `production` | ❌ Silencieux | ✅ Stocké (ring buffer) | ✅ Appelé si configuré | ✅ Appelé |
| `strict` (tests) | ✅ Immédiat | ❌ Pas de stockage | ❌ Pas appelé | ❌ Throw direct |

### Ring buffer (mode production)

En production, les erreurs ne sont pas affichées dans la console mais stockées dans un **ring buffer** en mémoire :

```typescript
/**
 * TErrorLogEntry — entrée dans le ring buffer des erreurs.
 */
type TErrorLogEntry = {
  /** L'erreur Bonsai typée */
  readonly error: BonsaiError;
  /** Horodatage de capture */
  readonly timestamp: number;
  /** Namespace du composant source (si applicable) */
  readonly namespace: string | null;
  /** correlationId au moment de l'erreur (si applicable) */
  readonly correlationId: string | null;
};
```

| Paramètre | Valeur par défaut | Description |
|-----------|-------------------|-------------|
| `errorBufferSize` | `100` | Nombre maximum d'erreurs stockées. Au-delà, les plus anciennes sont écrasées (FIFO). |
| `errorBufferSize: 0` | — | Désactive le stockage (les erreurs sont uniquement envoyées au reporter custom). |

### API DevTools pour les erreurs

Le `TBonsaiDevTools` (RFC-0004) expose les hooks suivants pour les erreurs :

```typescript
type TBonsaiDevTools = {
  // ... (hooks existants : onMessage, onEntityMutation, etc.)

  /**
   * Enregistre un listener sur toutes les erreurs capturées par le framework.
   * Appelé pour chaque BonsaiError, quel que soit le mode (debug/prod).
   * Retourne une fonction de désinscription.
   */
  onError(listener: (entry: TErrorLogEntry) => void): () => void;

  /**
   * Retourne les erreurs stockées dans le ring buffer.
   * En mode `strict` (tests), retourne toujours un tableau vide.
   */
  getErrors(): readonly TErrorLogEntry[];

  /**
   * Vide le ring buffer des erreurs.
   */
  clearErrors(): void;

  /**
   * Retourne les erreurs filtrées par code d'erreur.
   * Ex: getErrorsByCode('RENDER_FAILED') → toutes les RenderError.
   */
  getErrorsByCode(code: string): readonly TErrorLogEntry[];
};
```

### Usage dans les tests

```typescript
// ── Vérifier qu'une mutation invalide produit la bonne erreur ──
app.devTools!.clearErrors();

await triggerCommand('cart:addItem', { productId: 'invalid' });

const errors = app.devTools!.getErrorsByCode('MUTATION_FAILED');
expect(errors).toHaveLength(1);
expect(errors[0].error.message).toContain('Validation failed');
expect(errors[0].namespace).toBe('cart');
```

### Usage avec un reporter externe

```typescript
const app = createApplication({
  errorHandling: {
    mode: 'production',
    errorBufferSize: 50,
    reporter: (error: BonsaiError) => {
      // Sentry — avec contexte causal complet
      Sentry.captureException(error, {
        tags: { bonsaiCode: error.code },
        extra: {
          metas: error.metas,
          correlationId: error.metas?.correlationId,
        },
      });
    },
  },
});
```

---

## Conséquences

### Positives

- ✅ **Taxonomie claire** : chaque erreur a un type, un code, un comportement
- ✅ **Séparation mutation/broadcast** : state cohérent même si broadcast échoue
- ✅ **Traçabilité** : erreurs portent les metas causales
- ✅ **Modes dev/prod** : fail-fast en dev, résilient en prod
- ✅ **Extensible** : recovery hooks par composant
- ✅ **Consultation** : ring buffer + DevTools hooks pour inspection post-mortem
- ✅ **Pas de pollution architecturale** : pas de Channel/Feature/Entity pour les erreurs

### Négatives (acceptées)

- ⚠️ Hiérarchie d'erreurs à implémenter — nécessaire pour la clarté
- ⚠️ Configuration supplémentaire — mitigé par defaults sensés
- ⚠️ Ring buffer consomme de la mémoire — mitigé par taille configurable et écrasement FIFO

---

## Actions de suivi

- [ ] Implémenter hiérarchie `BonsaiError`
- [ ] Implémenter `_notifyHandlers()` avec try/catch
- [ ] Implémenter `dispatchEvent()` avec isolation
- [ ] Ajouter `onError()` hook dans Feature, View
- [ ] Ajouter error reporter configurable
- [ ] Implémenter ErrorReporter avec ring buffer
- [ ] Ajouter `onError()`, `getErrors()`, `clearErrors()`, `getErrorsByCode()` dans DevTools (RFC-0004)
- [ ] Tests : simuler chaque type d'erreur

---

## Références

- [ADR-0001 Entity Mutation](ADR-0001-entity-diff-notification-strategy.md)
- [React Error Boundaries](https://reactjs.org/docs/error-boundaries.html)
- [Angular ErrorHandler](https://angular.io/api/core/ErrorHandler)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) — options documentées |
| 2026-03-18 | **Accepted** — taxonomie, matrice, hiérarchie TypeScript |
| 2026-03-25 | Ajout section ErrorReporter (ring buffer, DevTools hooks, position architecturale sur Channel `error`) |
