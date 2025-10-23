# Validation statique et dynamique

> **Compile-time, bootstrap, runtime — garanties TypeScript et garde-fous framework**

[← Retour a l'index](../README.md)

---

## 1. Validation statique (compile-time)

### 1.1 Typage des declarations Channel

Le systeme de types garantit que les declarations
Channel sont coherentes avec l'usage.

**Exemple** — si `CartView` declare `trigger: [Cart.channel]` :

```typescript
// ✅ Type — Cart.channel est declare en trigger
this.trigger('cart', 'addItem', payload);

// ❌ Erreur TS — Command inconnu
this.trigger('cart', 'unknownCommand', payload);

// ❌ Erreur TS — Channel non declare en trigger
this.trigger('inventory', 'reserve', payload);

// ❌ Erreur TS — View ne peut pas emit (I4)
this.emit('cart', 'itemAdded', payload);
```

### 1.2 Erreurs de compilation attendues

| # | Erreur TypeScript | Invariant | Cause |
|---|---|---|---|
| 1 | `Property 'emit' does not exist on type 'View'` | I4, D7 | View ne peut pas emit |
| 2 | `Argument of type 'unknownCommand' is not assignable to parameter of type keyof Cart.Channel['commands']` | I16 | Command inexistant |
| 3 | `Type 'typeof Inventory.channel' is not assignable to type 'CartView['trigger'][number]'` | I14 | Channel non declare en trigger |
| 4 | `Type '{ items: Map<string, Item> }' does not satisfy the constraint 'JsonSerializable'` | D10 | Entity non jsonifiable |

### 1.3 Patterns TypeScript avances

Inventaire des patterns TypeScript utilises par le systeme de types Bonsai.

| Pattern TypeScript | Usage dans Bonsai | Benefice DX |
|----|----|----|
| **Template literal types** | `ExtractHandlerName` : `"addItem"` -> `"onAddItemCommand"` | Autocompletion des noms de methodes handler |
| **Mapped types** | `TRequiredCommandHandlers<TChannel>` : genere les signatures handler obligatoires avec `(payload, metas: TMessageMetas)` (ADR-0016) | `implements` -> l'IDE liste les methodes manquantes |
| **Conditional types + infer** | `RequestResult<TChannel, TName>` : extrait le type de retour d'un Request | Typage automatique des retours `T \| null` synchrone (D9 révisé, ADR-0023) |
| **Literal string types** | `namespace: 'cart'` (pas `string`) — discriminant pour les Channels | Erreur compile-time si namespace inconnu |
| **Constrained generics** | `TStructure extends TJsonSerializable` — contraint a la compilation | Impossible de creer une Entity non-serialisable |
| **Mapped types (Entity)** | `TEntityKeyHandlers<TStructure>` : genere les signatures `on<Key>EntityUpdated` pour chaque cle de TStructure | Autocompletion des noms de handlers Entity, verification des cles |
| **`satisfies`** | Verification des declarations statiques `listen`, `trigger`, `request` | Erreur si un Channel non declare est utilise |
| **Branded types** | Namespace comme type nominal (garantit l'unicite au type-level) | Deux Features avec le meme string namespace -> erreur |

**Patterns NON retenus** :

- **F-bounded polymorphism recursif** (`Class<Child extends Class<Child, ...>>`) — pas necessaire dans Bonsai car les Features ne s'heritent pas.
- **Cast runtime des Channels** (`Radio.channel('cart') as Channel<...>`) — remplace par des types statiques (`TChannelDefinition`). Le Channel Bonsai est un contrat de type, pas un objet caste.
- **Decorateurs (stage 3)** (`@Handle('addItem')`) — rejete (D12) au profit de la convention `onXXX` auto-decouverte.

---

## 2. Validation dynamique (runtime)

### 2.1 Garde-fous framework

Le framework fournit des garde-fous runtime pour les cas
que le type system ne peut pas attraper :

| Garde-fou | Condition | Action |
|-----------|-----------|--------|
| Anti-boucle | `hop > maxHops` | Rejet + erreur explicite |
| Handler manquant | Command sans handler | Erreur au dispatch |
| Replier manquant | Request sans replier | Erreur au dispatch |
| Double handler | Deux handlers pour le meme Command | Erreur bootstrap |
| Mutation externe | Tentative de modifier une Entity hors Feature | Erreur (via Proxy/Object.freeze en mode debug) |

### 2.2 Messages d'erreur et diagnostics

Les messages d'erreur doivent etre :
- **Explicites** (pas de « undefined is not a function »)
- **Contextuels** (quel composant, quel Channel, quel message)
- **Actionnables** (« did you forget to add X.channel to listen? »)

**Exemples** :

```
[Bonsai] CartView tried to trigger 'inventory:reserve' but
 Inventory.channel is not declared in CartView.trigger.
 Add Inventory.channel to CartView.trigger to fix this.
```

```
[Bonsai] Causal loop detected: hop 11 exceeds maxHops 10.
 correlationId: c-9f3a..., last 5 messages:
 1. cart:addItem (CartView, hop=0)
 2. cart:itemAdded (CartFeature, hop=1)
 ...
```

### 2.3 Categorisation des validations

> **Principe** : maximum de validations au compile-time, le runtime ne verifie que ce que TypeScript ne peut pas attraper.

| Categorie | Quand | Exemples | Action en cas de violation |
|-----------|-------|----------|---------------------------|
| **Compile-time** | `tsc` | Types Channel, declarations `listen`/`trigger`/`request`, payload types | Erreur de compilation |
| **Bootstrap** | Au demarrage, une seule fois | Unicite namespace, handlers declares, repliers obligatoires | `invariant()` fatal |
| **Runtime dev** | Chaque appel (dev uniquement) | Hop limit, payload valid, Entity freeze | `invariant()` -> supprime en prod |
| **Runtime warning** | Chaque appel (dev uniquement) | Performance hints, handlers sans message, metas manquantes | `warning()` -> supprime en prod |

---

## 3. Assertions conditionnelles — API `@bonsai/invariant`

> **ADR-0004 (Accepted)** : assertions conditionnelles inspirees de React/Vue.
> Le code de validation disparait en production via dead code elimination.

### 3.1 Constante globale `__DEV__`

```typescript
// Definie par le bundler (Vite, Rollup, esbuild, webpack)
declare const __DEV__: boolean;

// Configuration bundler — Vite/Rollup/esbuild
define: {
  __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
}

// En production, le bundler transforme :
//   if (__DEV__ && !condition) { ... }
// -> if (false && !condition) { ... }
// -> dead code elimination -> supprime
```

### 3.2 `invariant()` — assertion fatale (dev uniquement)

```typescript
/**
 * Assertion fatale conditionnelle.
 * - En dev (__DEV__ === true) : throw InvariantError si condition fausse.
 * - En prod (__DEV__ === false) : elimine par le bundler (zero overhead).
 *
 * @param condition - Condition a verifier
 * @param message - Message d'erreur avec placeholders %s
 * @param args - Valeurs de remplacement pour les placeholders
 */
function invariant(
  condition: boolean,
  message: string,
  ...args: unknown[]
): asserts condition {
  if (__DEV__ && !condition) {
    throw new InvariantError(format(message, ...args));
  }
}
```

### 3.3 `warning()` — avertissement non-fatal (dev uniquement)

```typescript
/**
 * Avertissement conditionnel.
 * - En dev : console.warn si condition fausse.
 * - En prod : elimine par le bundler.
 */
function warning(condition: boolean, message: string, ...args: unknown[]): void {
  if (__DEV__ && !condition) {
    console.warn(`[Bonsai] ${format(message, ...args)}`);
  }
}
```

### 3.4 `hardInvariant()` — assertion fatale permanente (rare)

```typescript
/**
 * Assertion fatale permanente, active meme en production.
 * Reservee aux cas critiques ou un etat corrompu pourrait causer
 * des dommages irreversibles (donnees utilisateur, securite).
 *
 * Usage : bootstrap checks, configuration critique.
 */
function hardInvariant(
  condition: boolean,
  message: string,
  ...args: unknown[]
): asserts condition {
  if (!condition) {
    throw new InvariantError(format(message, ...args));
  }
}
```

### 3.5 Messages d'erreur riches

Les messages d'invariant doivent etre **explicites**, **contextuels** et **actionnables** :

```typescript
// ❌ MAUVAIS — Message vague
invariant(false, 'Invalid emit');

// ✅ BON — Contexte + invariant violé + suggestion
invariant(
  this.ownsChannel(channelName),
  'Feature "%s" cannot emit on channel "%s". ' +
  'Features can only emit on their own channel (I1). ' +
  'Did you mean to use listen() instead?',
  this.namespace,
  channelName
);
```

> **Convention** : chaque message d'invariant cite l'invariant violé (I1, I7, I21, etc.)
> pour que le developpeur puisse trouver la documentation.

### 3.6 Mode debug vs production

| Verification | Debug (`__DEV__`) | Production | Mecanisme |
|---|---|---|---|
| Validation declarations bootstrap | Oui | Oui | `hardInvariant()` |
| Anti-boucle (hop) | Oui | Oui | `hardInvariant()` |
| Unicite namespace | Oui | Oui | `hardInvariant()` |
| onXXX sans message | Warning | Silencieux | `warning()` |
| Message sans handler | Warning | Silencieux | `warning()` |
| Metas logging | Verbose | Off | `if (__DEV__)` |
| Entity freeze (anti-mutation) | Object.freeze | Off (perf) | `if (__DEV__)` |
| Messages d'erreur detailles | Oui | Reduits | `invariant()` |
| Payload serializable check | Warning | Off | `warning()` |

### 3.7 Tree-shaking — garantie zero-overhead en production

Le pattern `if (__DEV__)` est le standard de l'industrie (React, Vue, Angular) pour garantir que le code de validation ne pese rien en production.

**Prerequis bundler** :

| Bundler | Configuration |
|---------|---------------|
| **Vite** | `define: { __DEV__: false }` (mode build) |
| **Rollup** | `@rollup/plugin-replace: { __DEV__: 'false' }` |
| **esbuild** | `--define:__DEV__=false` |
| **webpack** | `DefinePlugin: { __DEV__: false }` |

**Validation** : le build doit etre verifie par un test de taille du bundle confirmant que les assertions `invariant()` et `warning()` sont eliminees.

---

## Lecture suivante

→ [Conventions de typage](conventions-typage.md) — prefixes, patterns TypeScript fondamentaux
