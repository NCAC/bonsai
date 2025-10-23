# RFC-0004 — DevTools et outils de debug

> **Instrumentation, observabilité et outillage de développement du framework Bonsai**

---

| Champ             | Valeur                                      |
|-------------------|---------------------------------------------|
| **RFC**           | 0004                                        |
| **Composant**     | DevTools — infrastructure d'observabilité   |
| **Statut**        | 🟢 Stable                                   |
| **Créé le**       | 2026-03-23                                  |
| **Mis à jour**    | 2026-03-26                                  |
| **ADRs liées**    | [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md), [ADR-0002](../adr/ADR-0002-error-propagation-strategy.md), [ADR-0004](../adr/ADR-0004-validation-modes.md), [ADR-0011](../adr/ADR-0011-event-sourcing-support.md), [ADR-0015](../adr/ADR-0015-local-state-mechanism.md) |

> ### Statut normatif
> Ce document définit le **scope v1 des DevTools** : contrats d'instrumentation,
> API d'inspection, hooks framework, coût en production.
> Les sections marquées ⏳ sont des extensions prévues post-v1.
> En cas de divergence avec RFC-0002 sur les hooks, RFC-0004 (ce document) prévaut.

---

## 📋 Table des matières

1. [Motivation et position architecturale](#1-motivation-et-position-architecturale)
2. [Scope v1 — périmètre défini](#2-scope-v1--périmètre-défini)
3. [API d'instrumentation — hooks framework](#3-api-dinstrumentation--hooks-framework)
4. [Inspection des Channels](#4-inspection-des-channels)
5. [Inspection et collecte des erreurs](#5-inspection-et-collecte-des-erreurs)
6. [Inspection des Entities](#6-inspection-des-entities)
7. [Graphe causal — Event Ledger](#7-graphe-causal--event-ledger)
8. [Snapshot et restore](#8-snapshot-et-restore)
9. [Coût en production et mode debug](#9-coût-en-production-et-mode-debug)
10. [Extensions post-v1](#10-extensions-post-v1)

---

## 1. Motivation et position architecturale

> **Principe fondateur** : un framework aussi contraignant que Bonsai —
> invariants stricts, flux unidirectionnel, chorégraphie, encapsulation forte —
> ne peut tenir ses promesses qu'avec une **observabilité de première classe**.
> Les DevTools ne sont pas un bonus : ils sont la condition sine qua non
> pour que les contraintes soient débogables plutôt que pénibles.

### Pourquoi les DevTools sont prioritaires v1

Sans DevTools, les problèmes suivants deviennent très difficiles à diagnostiquer :

| Problème sans DevTools | Conséquence |
|------------------------|-------------|
| Chaîne causale cassée (hop > maxHops) | Message "Max hops exceeded" sans contexte — impossible à remonter |
| Event émis mais View non mise à jour | Vérifier visuellement si le Channel est câblé, si le selector `any` correspond |
| Mutation Entity sans notification attendue | Inspecter `changedKeys`, vérifier le no-op |
| Composer qui ne monte pas la bonne View | `resolve()` renvoie quoi ? À quel moment ? |
| Request sans replier | Quel replier est enregistré ? Est-il câblé ? Pourquoi `null` ? |

> **Décision** : les DevTools sont développés en parallèle du framework, pas après.
> Un framework sans observabilité est difficile à adopter, quelle que soit
> la qualité de son architecture.

---

## 2. Scope v1 — périmètre défini

### ✅ Inclus dans le scope v1

| Fonctionnalité | Description |
|---------------|-------------|
| **Activation conditionnelle** | `enableDevTools: true` dans `TApplicationConfig` — zéro coût en production si désactivé |
| **Inspection des Channels** | Liste des Channels enregistrés, handlers câblés, listeners actifs |
| **Inspection et collecte des erreurs** | Ring buffer, hooks `onError()` / `getErrors()` / `getErrorsByCode()`, liaison avec ADR-0002 ErrorReporter |
| **Inspection des Entities** | État courant de chaque Entity (via `toJSON()`), `changedKeys` de la dernière mutation |
| **Event Ledger** | Log en temps réel de tous les messages (Commands, Events, Requests) avec leurs metas causales |
| **Graphe causal simple** | Reconstruction d'une chaîne causale depuis un `correlationId` — messages dans l'ordre, hop par hop |
| **Snapshot / restore** | Export de l'état complet de toutes les Entities (`app.snapshot()`), restauration (`app.restore(snapshot)`) |
| **Mode debug** | `Object.freeze` sur les Entities hors mutations (détection des mutations sauvages), logs verbose |

### ⏳ Extensions post-v1

| Fonctionnalité | Description |
|---------------|-------------|
| **Time-travel** | Undo/redo via `inversePatches` d'Immer — rejouer l'état à un instant T |
| **UI DevTools** | Extension navigateur (Chrome DevTools panel) |
| **Profiling** | Mesure des temps d'exécution par handler, par Channel |
| **Replay de session** | Rejouer une session complète à partir de l'Event Log |
| **Visualisation graphe** | Graphe interactif des dépendances Channel entre composants |

---

## 3. API d'instrumentation — hooks framework

### 3.1 Configuration

```typescript
/**
 * TApplicationConfig — extrait pertinent pour les DevTools.
 * La source de vérité complète de TApplicationConfig est dans
 * [application.md §4](3-couche-abstraite/application.md).
 *
 * Seuls les champs impactant les DevTools sont rappelés ici.
 * `requestTimeout` a été supprimé — request() est synchrone
 * (D9 révisé par ADR-0023).
 */
type TApplicationConfig = {
  maxHops?: number;          // défaut : 10 (I9)
  debug?: boolean;           // active les logs verbose et Object.freeze
  enableDevTools?: boolean;  // active l'instrumentation DevTools (Event Ledger, hooks)
  // ... voir application.md §4 pour strict, logLevel, validateAtBootstrap
};

const app = new Application({
  enableDevTools: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV === 'development',
});
```

> **Règle** : `enableDevTools: true` sans `debug: true` est valide — le DevTools panel
> peut fonctionner sans les logs verbose. `debug: true` implique `enableDevTools: true`
> (le debug mode a besoin de l'instrumentation pour les logs structurés).
>
> **Source de vérité** : [application.md §4](3-couche-abstraite/application.md) définit
> la forme canonique complète de `TApplicationConfig`. Ce document n'en montre qu'un extrait.

### 3.2 Interface publique des DevTools

```typescript
/**
 * TBonsaiDevTools — interface d'instrumentation exposée par Application.
 * Disponible uniquement si `enableDevTools: true` dans la config.
 * En production (`enableDevTools: false`), `app.devTools` est `null`.
 */
type TBonsaiDevTools = {
  /** Enregistre un listener sur tous les messages transitant par les Channels */
  onMessage(listener: (entry: TMessageLogEntry) => void): () => void;

  /** Enregistre un listener sur toutes les mutations Entity */
  onEntityMutation(listener: (entry: TEntityMutationEntry) => void): () => void;

  /** Retourne le snapshot de l'état de toutes les Entities */
  getSnapshot(): TApplicationSnapshot;

  /** Restaure l'état de toutes les Entities depuis un snapshot */
  restoreSnapshot(snapshot: TApplicationSnapshot): void;

  /** Retourne tous les Channels enregistrés avec leurs registres */
  getChannelRegistry(): TChannelRegistryEntry[];

  /** Retourne le log causal d'une transaction depuis son correlationId */
  getCausalChain(correlationId: string): TMessageLogEntry[];

  /** Enregistre un listener sur toutes les erreurs capturées par le framework (ADR-0002) */
  onError(listener: (entry: TErrorLogEntry) => void): () => void;

  /** Retourne les erreurs stockées dans le ring buffer */
  getErrors(): readonly TErrorLogEntry[];

  /** Retourne les erreurs filtrées par code d'erreur (ex: 'RENDER_FAILED') */
  getErrorsByCode(code: string): readonly TErrorLogEntry[];

  /** Vide le ring buffer des erreurs */
  clearErrors(): void;

  /** Vide le log des messages (pour les tests) */
  clearLog(): void;
};

/** Accès depuis l'instance Application */
const devtools = app.devTools; // TBonsaiDevTools | null
```

### 3.3 Types de log

```typescript
/**
 * TMessageLogEntry — entrée dans l'Event Ledger.
 * Couvre Commands, Events et Requests.
 */
type TMessageLogEntry = {
  /** Type de message */
  readonly kind: 'command' | 'event' | 'request' | 'reply';
  /** Namespace + nom : ex "cart:addItem" */
  readonly name: string;
  /** Payload du message */
  readonly payload: unknown;
  /** Metas causales complètes (I7) */
  readonly metas: TMessageMetas;
  /** Horodatage de réception par le framework */
  readonly receivedAt: number;
  /** Résultat (pour request/reply) */
  readonly result?: unknown;
  /** Erreur si le handler a échoué */
  readonly error?: unknown;
};

/**
 * TEntityMutationEntry — entrée de mutation Entity dans le log.
 */
type TEntityMutationEntry = {
  /** Namespace de la Feature propriétaire */
  readonly namespace: string;
  /** Intention métier */
  readonly intent: string;
  /** Clés modifiées */
  readonly changedKeys: string[];
  /** State avant (copie profonde) */
  readonly stateBefore: unknown;
  /** State après (copie profonde) */
  readonly stateAfter: unknown;
  /** correlationId lié à cette mutation */
  readonly correlationId: string | null;
};

/**
 * TApplicationSnapshot — état complet de l'application.
 */
type TApplicationSnapshot = {
  readonly timestamp: number;
  readonly entities: Record<string, unknown>; // namespace → state JSON
};

/**
 * TErrorLogEntry — entrée dans le ring buffer des erreurs (ADR-0002).
 * Couvre toutes les catégories BonsaiError : MutationError, CommandError,
 * RequestError, RenderError, ListenerError, etc.
 */
type TErrorLogEntry = {
  /** L'erreur Bonsai typée (avec code, message, cause, metas) */
  readonly error: BonsaiError;
  /** Horodatage de capture */
  readonly timestamp: number;
  /** Namespace du composant source (si applicable) */
  readonly namespace: string | null;
  /** correlationId au moment de l'erreur (si applicable) */
  readonly correlationId: string | null;
};
```

---

## 4. Inspection des Channels

### 4.1 Registre des Channels

```typescript
type TChannelRegistryEntry = {
  /** Namespace du Channel */
  readonly namespace: string;
  /** Nom de la Feature propriétaire */
  readonly featureName: string;
  /** Commands câblés et leur handler */
  readonly commands: Record<string, { handlerMethod: string }>;
  /** Events et leur liste de listeners */
  readonly events: Record<string, Array<{ componentName: string; method: string }>>;
  /** Requests câblés et leur replier */
  readonly requests: Record<string, { replierMethod: string }>;
};
```

### 4.2 Usage dans les tests

```typescript
// ── Vérifier qu'un handler est correctement câblé ──
const registry = app.devTools!.getChannelRegistry();
const cartChannel = registry.find(c => c.namespace === 'cart');

expect(cartChannel?.commands['addItem']).toBeDefined();
expect(cartChannel?.requests['total']?.replierMethod).toBe('onTotalRequest');
```

> L'inspection des Channels est particulièrement utile dans les **tests d'intégration**
> pour valider que le câblage est correct sans avoir à déclencher des messages réels.

---

## 5. Inspection et collecte des erreurs

> **Position architecturale** : les erreurs sont une préoccupation d'infrastructure,
> pas un domaine métier. L'ErrorReporter est transversal (comme Radio).
> Pas de Channel `error`, pas de Feature `error`, pas d'Entity `error`.
> Voir [ADR-0002 § ErrorReporter](../adr/ADR-0002-error-propagation-strategy.md) pour le raisonnement complet.

### 5.1 Collecte automatique

Toute `BonsaiError` capturée par le framework (Entity, Feature, Channel, View) est automatiquement transmise à l'ErrorReporter. Pas d'action du développeur requise.

### 5.2 Comportement par mode

| Mode | `console.error()` | Ring buffer | Reporter custom | DevTools `onError()` |
|------|-------------------|-------------|-----------------|---------------------|
| `development` | ✅ Immédiat | ✅ Stocké | ✅ Si configuré | ✅ Appelé |
| `production` | ❌ Silencieux | ✅ Stocké (FIFO) | ✅ Si configuré | ✅ Appelé |
| `strict` (tests) | ✅ Immédiat | ❌ Pas de stockage | ❌ | ❌ Throw direct |

### 5.3 Ring buffer

En mode non-strict, les erreurs sont stockées dans un ring buffer en mémoire :

```typescript
// Configuration
const app = new Application({
  devTools: true,
  errorHandling: {
    errorBufferSize: 100, // défaut: 100. FIFO. 0 = pas de stockage.
  },
});
```

### 5.4 Hooks DevTools

```typescript
// ── Observer les erreurs en temps réel ──
const unsubscribe = app.devTools!.onError(entry => {
  console.warn(
    `[${entry.error.code}]`,
    entry.error.message,
    entry.namespace ? `in ${entry.namespace}` : '',
    entry.correlationId ? `corr=${entry.correlationId.slice(0, 8)}` : ''
  );
});

// ── Consulter les erreurs stockées ──
const allErrors = app.devTools!.getErrors();
const renderErrors = app.devTools!.getErrorsByCode('RENDER_FAILED');

// ── Dans les tests ──
app.devTools!.clearErrors();
await triggerCommand('cart:addItem', { productId: 'invalid' });
expect(app.devTools!.getErrorsByCode('MUTATION_FAILED')).toHaveLength(1);
```

### 5.5 Erreurs applicatives vs erreurs d'infrastructure

| Type | Exemple | Canal de communication | Concerne le DevTools ? |
|------|---------|----------------------|----------------------|
| **Infrastructure** | `RenderError`, `TimeoutError`, `MutationError` | ErrorReporter (automatique) | ✅ Oui |
| **Applicative** | "Article en rupture de stock" | Channel métier (`cart:addItemFailed` Event) | ❌ Non — c'est du domain state |

> Si un développeur veut afficher des erreurs utilisateur (toast, bannière),
> ce sont des **erreurs applicatives** : elles passent par le Channel métier normal
> (emit → Event → View se met à jour). Le DevTools ErrorReporter ne capture que
> les erreurs d'infrastructure.

---

## 6. Inspection des Entities

```typescript
// ── Observer les mutations en temps réel ──
app.devTools!.onEntityMutation(entry => {
  if (entry.namespace === 'cart' && entry.changedKeys.includes('items')) {
    console.log('[DevTools]', entry.intent, '→ items changed');
    console.log('  before:', entry.stateBefore);
    console.log('  after:', entry.stateAfter);
  }
});

// ── Inspecter l'état courant ──
const snapshot = app.devTools!.getSnapshot();
console.log('[DevTools] cart state:', snapshot.entities['cart']);
```

> **Note** : `stateBefore` et `stateAfter` sont des **copies profondes** (`structuredClone`).
> Le consommateur ne peut pas muter l'état de l'application via ces références.

---

## 7. Graphe causal — Event Ledger

### 7.1 Log en temps réel

```typescript
app.devTools!.onMessage(entry => {
  console.log(
    `[${entry.kind.toUpperCase()}]`,
    entry.name,
    `hop=${entry.metas.hop}`,
    `corr=${entry.metas.correlationId.slice(0, 8)}`
  );
});

// Output typique :
// [COMMAND] cart:addItem      hop=0  corr=c-9f3a12
// [EVENT]   cart:itemAdded    hop=1  corr=c-9f3a12
// [EVENT]   inventory:stockUpdated  hop=2  corr=c-9f3a12
```

### 7.2 Reconstruction d'une chaîne causale

```typescript
// Après une interaction utilisateur, récupérer la chaîne complète
const chain = app.devTools!.getCausalChain('c-9f3a12');

// Output typique :
// [
//   { kind: 'command', name: 'cart:addItem',            hop: 0, causationId: null },
//   { kind: 'event',   name: 'cart:itemAdded',           hop: 1, causationId: 'msg-001' },
//   { kind: 'event',   name: 'inventory:stockUpdated',   hop: 2, causationId: 'msg-002' },
//   { kind: 'event',   name: 'pricing:totalRecalculated',hop: 2, causationId: 'msg-002' },
// ]
```

> **Utilisation en tests** : le graphe causal permet de vérifier qu'une interaction
> utilisateur produit exactement les Events attendus dans le bon ordre,
> sans avoir à surveiller chaque Feature individuellement.

---

## 8. Snapshot et restore

### 8.1 Export / import d'état

```typescript
// ── Export complet ──
const snapshot = app.devTools!.getSnapshot();
// { timestamp: 1710765432000, entities: { cart: { items: [...], total: 42 }, ... } }

// ── Sauvegarder pour reproduction de bug ──
localStorage.setItem('debug-snapshot', JSON.stringify(snapshot));

// ── Restaurer (ex: rejouer un scénario de test) ──
const savedSnapshot = JSON.parse(localStorage.getItem('debug-snapshot')!);
app.devTools!.restoreSnapshot(savedSnapshot);
```

### 8.2 Garanties du restore

| Aspect | Comportement |
|--------|-------------|
| **Validation** | Le framework vérifie la conformité du snapshot (`TJsonSerializable`, structure compatible) |
| **Notifications** | La restauration déclenche les notifications Entity → Feature pour chaque Entity modifiée |
| **Views** | La restauration déclenche un `any` sur tous les Channels, forçant la re-projection des Views |
| **Metas** | Les metas de la restauration ont `correlationId: 'devtools-restore'` pour les distinguer |

---

## 9. Coût en production et mode debug

### 9.1 Stratégie zéro-coût

| Config | Overhead mémoire | Overhead CPU | Instruments actifs |
|--------|-----------------|-------------|-------------------|
| `enableDevTools: false` (défaut prod) | ✅ Zéro | ✅ Zéro | Aucun |
| `enableDevTools: true, debug: false` | ~KB (log buffer) | Minimal (hooks) | Event Ledger, inspection |
| `enableDevTools: true, debug: true` | ~KB + freeze | Modéré (freeze + logs) | Tout |

> **Règle stricte** : le code de production NE DOIT PAS référencer `app.devTools`.
> `app.devTools` retourne `null` si `enableDevTools: false`. Tout accès à `null.xxx`
> est un bug de code, pas une dégradation gracieuse.

### 9.2 Mode debug — `Object.freeze`

En mode `debug: true`, le framework appelle `Object.freeze()` sur l'état
de chaque Entity **après** chaque mutation. Cela permet de détecter les
mutations sauvages (accès direct à `this.entity.state` hors de `mutate()`) :

```typescript
// En mode debug, si une Feature tente de muter l'Entity sans passer par mutate() :
this.entity['_state'].items.push(item);
// → TypeError: Cannot add property X, object is not extensible
```

> **Coût** : `Object.freeze` récursif sur des objets complexes peut avoir
> un impact sur les performances. Ce mode est réservé au développement.
> La profondeur de freeze est configurable (`freezeDepth`, défaut : `Infinity`).

---

## 10. Extensions post-v1

> Les fonctionnalités suivantes sont documentées ici comme vision et
> ne font PAS partie du scope v1. Elles sont référencées pour orienter
> les décisions d'architecture actuelles (notamment la structure de `TEntityEvent`
> avec `inversePatches`).

### 10.1 Time-travel (undo/redo)

Basé sur les `inversePatches` d'Immer (Entity §4, RFC-0002-entity) :

```typescript
// ⏳ Post-v1 — API à définir
app.devTools!.undo(); // Annule la dernière mutation d'une Entity
app.devTools!.redo(); // Rejoue la dernière mutation annulée
app.devTools!.travelTo(timestamp); // Rejoue l'état à un instant T
```

### 10.2 Extension navigateur

Interface utilisateur sous forme d'extension Chrome/Firefox :
- Panel "Bonsai DevTools" dans les DevTools du navigateur
- Visualisation en temps réel de l'Event Ledger
- Graphe causal interactif (cliquer sur un message pour voir sa chaîne)
- Inspecteur d'Entity avec diff visuel
- Time-travel via curseur temporel
- **Panel Erreurs** : liste filtrée par catégorie, lien vers la chaîne causale

### 10.3 Profiling

```typescript
// ⏳ Post-v1 — API à définir
app.devTools!.startProfiling();
// ... interactions
const report = app.devTools!.stopProfiling();
// report: { handlers: [{ name, avgMs, calls }], ... }
```

---

## Références croisées

| Section RFC-0002 | Concept | Lien DevTools |
|-------------------|---------|---------------|
| [RFC-0002 §7.3 `enableDevTools`](6-transversal/conventions-typage.md) | Flag dans `TApplicationConfig` | Active/désactive les hooks |
| [RFC-0001 §10 Metas](1-philosophie.md#10-traçabilité-et-métadonnées-causales) | `correlationId`, `causationId`, `hop` | Graphe causal, Event Ledger |
| [RFC-0001 §11.3 Diagnostics](1-philosophie.md#113-principe-de-diagnostics) | Principes d'observabilité | Motivation des DevTools |
| [RFC-0002-entity §4](3-couche-abstraite/entity.md#4-api-de-mutation--mutateintent-params-recipe) | `TEntityEvent` avec `patches` | Inspection mutations |
| [RFC-0002-entity §7](3-couche-abstraite/entity.md#7-sérialisation-et-snapshot) | `toJSON()` / `fromJSON()` | Snapshot, restore |
| [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) | `inversePatches` Immer | Time-travel (post-v1) |
| [ADR-0002](../adr/ADR-0002-error-propagation-strategy.md) | Taxonomie erreurs, ErrorReporter | §5 Inspection erreurs, ring buffer, hooks |
| [ADR-0015](../adr/ADR-0015-local-state-mechanism.md) | localState (View/Behavior) | Non inclus dans snapshot (état volatile) |
