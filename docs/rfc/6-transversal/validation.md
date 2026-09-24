# Validation statique et dynamique

> **Compile-time, bootstrap, runtime — garanties TypeScript et garde-fous framework**

[← Retour a l'index](../README.md)

---

> ## ⏳ Périmètre d'implémentation (ADR-0028)
>
> Ce document décrit le **contrat cible** de la validation. Les éléments suivants ne sont **pas encore implémentés** :
>
> | Élément | Strate cible | Sections concernées |
> | --- | --- | --- |
> | Garde-fou anti-boucle (`hop > maxHops`) | Strate 1b | §2.1, §3.6 |
> | Validation modale des Entities via `TEntitySchema` (Valibot, ADR-0022) | Strate 1 | — |
> | `warning()` sur handlers orphelins et messages sans handler | Non planifié par ADR-0028 | §2.3, §3.6 |
> | Test de taille de bundle confirmant l'élimination des assertions | Non planifié par ADR-0028 | §3.7 |
>
> **Périmètre effectif livré** : garanties compile-time du pattern modulaire et du contrat Feature (ADR-0040 → ADR-0046), prouvées par `tests/types/` ; au bootstrap, `BonsaiNamespaceError` (Phases 0a et 0c), sentinel du constructeur inerte (I94), filets I82/I84 au `mount()` et `hardInvariant()` pour I96 ; helpers `invariant()`, `hardInvariant()` et `warning()` exportés par `@bonsai/error` avec la signature `(condition, message, invariantId, component?)` — `__DEV__` vaut `true` s'il n'est pas défini par le bundler.

## 1. Validation statique (compile-time)

### 1.1 Typage des déclarations Channel

Le système de types garantit que les déclarations
Channel sont coherentes avec l'usage.

**Exemple** — si `CartView` déclare `cart` dans `get features()` (ADR-0042,
`TFeatureContract`), avec `triggers: ["addItem"]` :

```typescript
// ✅ Type — "cart:addItem" ∈ TFlatTriggers<F> (I77)
this.trigger('cart:addItem', payload);

// ❌ Erreur TS — Command inconnu (typo)
this.trigger('cart:adddItem', payload);

// ❌ Erreur TS — namespace non declare dans get features()
this.trigger('inventory:reserve', payload);

// ❌ Erreur TS — View n'a pas de methode emit() (I4)
this.emit('itemAdded', payload);
```

### 1.2 Erreurs de compilation attendues

| # | Erreur TypeScript | Invariant | Cause |
| --- | --- | --- | --- |
| 1 | `Property 'emit' does not exist on type 'View'` | I4 | View n'a pas de méthode `emit()` |
| 2 | `Argument of type '"cart:adddItem"' is not assignable to parameter of type 'TFlatTriggers<…>'` | I77 | Command inexistant ou typo dans la clé namespacee |
| 3 | `Argument of type '"inventory:reserve"' is not assignable to parameter of type 'TFlatTriggers<…>'` | I14, I77 | Namespace non déclaré dans `get features()` |
| 4 | `Type '{ items: Map<string, Item> }' does not satisfy the constraint 'TJsonSerializable'` | D10 | Entity non jsonifiable |

### 1.3 Patterns TypeScript avances

Inventaire des patterns TypeScript utilises par le système de types Bonsai.

| Pattern TypeScript | Usage dans Bonsai | Benefice DX |
| --- | --- | --- |
| **Template literal types** | `` `on${Capitalize<K>}Command` `` (dans `TCommandCallbacks<TDef>`) : `"addItem"` -> `"onAddItemCommand"` | Autocompletion des noms de méthodes handler |
| **Mapped types** | `TCommandCallbacks<TDef>`/`TRequestCallbacks<TDef>` : génère les signatures handler obligatoires, sans metas en strate 0 (ADR-0046) | `implements TFeatureCallbacks<…>` -> l'IDE liste les méthodes manquantes (TS2515 si absentes) |
| **Conditional types + infer** | `TRequestResultFor<F, K>` : extrait le type de retour d'un Request depuis un `TFeatureContract` | Typage automatique des retours `T \| null` synchrone (D9 révisé, ADR-0023) |
| **Literal string types** | `namespace: 'cart'` — parametre `NS` de `TChannelToken<TDef, NS>` | Erreur compile-time si namespace inconnu |
| **Constrained generics** | `TStructure extends TJsonSerializable` — contraint a la compilation | Impossible de creer une Entity non-serialisable |
| **`satisfies`** | `satisfies StrictManifest<AppManifest>` (manifest applicatif, ADR-0039) et `satisfies TFeatureContract`/`TUIContract` (View, ADR-0042) | Erreur si un namespace ou un Channel non déclaré est utilisé |
| **`UnionToIntersection`** | Fusionne les handlers de plusieurs tokens `listens` en un seul type `implements`-able (`TListenCallbacks`, ADR-0046) | Nécessaire — sans lui, TS produit une union que `implements` refuse (TS2422) |

**Patterns NON retenus** :

- **F-bounded polymorphism recursif** (`Class<Child extends Class<Child, ...>>`) — pas nécessaire dans Bonsai car les Features ne s'heritent pas.
- **Cast runtime des Channels exposé au développeur** (`Radio.channel('cart') as Channel<...>`) — c'est exactement ce que fait le code **interne** du framework (`Feature.request()`, `packages/feature/src/bonsai-feature.ts` — cast documenté par I75), mais ce cast n'est **jamais** exposé a la surface developpeur : celle-ci ne manipule que des types statiques (`TChannelDefinition`, `TChannelToken`).
- **Decorateurs (stage 3)** (`@Handle('addItem')`) — rejete (D12) au profit de la convention `onXXX` auto-découverte.
- **Branded types pour l'unicite du namespace** — non retenu : l'unicite est garantie par `TS1117` (clé d'objet dupliquee dans le manifest litteral), pas par un type nominal brande sur le namespace lui-même.

---

## 2. Validation dynamique (runtime)

### 2.1 Garde-fous framework

Le framework fournit des garde-fous runtime pour les cas
que le type system ne peut pas attraper :

| Garde-fou | Condition | Action reelle |
| --- | --- | --- |
| Anti-boucle | `hop > maxHops` | ⏳ Cible strate 1b — aucune notion de `hop` n'existe dans le code livre |
| Handler manquant | Command sans handler | `NoHandlerError` levee par `Channel.trigger()` — **livre** |
| Replier manquant | Request sans replier | `Channel.request()` retourne `null`, **sans erreur** (D44, ADR-0023) — **livre** |
| Double handler | Deux handlers/repliers pour le même Command/Request | `DuplicateHandlerError` levee par `Channel.handle()`/`reply()` (I10) — **livre** |
| Mutation externe | Tentative de modifier une Entity hors Feature | ⏳ Aucun garde-fou runtime — `Feature.entity` est `protected` (I5, I6), donc **impossible a compiler** depuis l'exterieur ; aucun Proxy/`Object.freeze` n'existe pour intercepter un contournement (`as any`) |

### 2.2 Messages d'erreur et diagnostics

Les messages d'erreur doivent être :

- **Explicites** (pas de « undefined is not a function »)
- **Contextuels** (quel composant, quel Channel, quel message)
- **Actionnables** (« did you forget to add X.channel to listen? »)

**Exemple reel, livre** (`NoHandlerError`, `packages/event/src/channel.class.ts`) —
`inventory:reserve` déclaré dans `get features()` mais sans Command
`reserve` cote `InventoryFeature` :

```text
[I10] cart — No handler for command "inventory:reserve"
  → Register a handler with channel.handle("reserve", handler)
```

> Le cas « `inventory:reserve` non déclaré du tout dans `get features()` »
> (l'exemple historique de cette section) n'atteint **jamais** le runtime —
> il est rejete au compile-time par I77 (cf. §1.2, erreur n°3).

**Exemple cible, non livre** (⏳ strate 1b — aucune notion de `hop` n'existe
aujourd'hui) :

```text
[Bonsai] Causal loop detected: hop 11 exceeds maxHops 10.
 correlationId: c-9f3a..., last 5 messages:
 1. cart:addItem (CartView, hop=0)
 2. cart:itemAdded (CartFeature, hop=1)
 ...
```

### 2.3 Categorisation des validations

> **Principe** : maximum de validations au compile-time, le runtime ne vérifie que ce que TypeScript ne peut pas attraper.

| Categorie | Quand | Exemples reels | Action en cas de violation |
| --- | --- | --- | --- |
| **Compile-time** | `tsc` | Types Channel, `get features()`/`get listens()`, payload types, handlers requis (I92) | Erreur de compilation |
| **Bootstrap** | Au demarrage, une seule fois | Unicite namespace (TS1117, compile-time), handler/replier duplique (I10, `DuplicateHandlerError`), reference `listens`/`queries` inconnue (I70, `BonsaiNamespaceError`, Phase 0c) | `hardInvariant()` ou erreur dediee (`DuplicateHandlerError`, `BonsaiNamespaceError`) |
| **Runtime** | Chaque appel | `NoHandlerError` (Command sans handler), `Channel.request()` retourne `null` sans handler | Erreur levee (Command) ou `null` silencieux (Request) — pas de distinction dev/prod |
| **⏳ Cible, non livre** | — | Hop limit (I9), `Entity` freeze anti-mutation, `warning()` sur handlers orphelins ou metas manquantes | Aucun de ces garde-fous n'est implemente aujourd'hui |

---

## 3. Assertions conditionnelles — API `@bonsai/error`

> **ADR-0004 (Accepted)** : assertions conditionnelles inspirees de React/Vue.
> Le code de validation disparait en production via dead code elimination.
>
> ⚠️ Le package reel est **`@bonsai/error`** (`packages/error/src/invariant.ts`)
> — il n'existe pas de package `@bonsai/invariant` separe. Les signatures
> reelles different de celles montrees historiquement dans cette section :
> `(condition, message, invariantId?, component?)`, pas
> `(condition, message, ...args)` avec des placeholders `%s` — aucun
> formatage par placeholder n'est implemente, le message est passe tel quel.
> Voir les signatures corrigees ci-dessous.

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

> **Filet reel** (`packages/error/src/invariant.ts`) : si `__DEV__` n'est pas
> defini par le bundler (`typeof __DEV__ === "undefined"`), `isDev()` retourne
> `true` par defaut — choix deliberement conservateur : mieux vaut montrer
> une erreur qu'un état incoherent silencieux. Ce comportement n'etait pas
> documente ici jusqu'a cette correction.

### 3.2 `invariant()` — assertion fatale, strippable en production

```typescript
// Signature reelle — packages/error/src/invariant.ts
/**
 * Assertion runtime — throw BonsaiError si la condition est fausse.
 * Strippable en production (elimine quand __DEV__ === false).
 */
function invariant(
  condition: unknown,
  message: string,
  invariantId: string = "",
  component: string = ""
): asserts condition {
  if (isDev()) {
    if (!condition) {
      throw new BonsaiError(message, invariantId, component);
    }
  }
}
```

### 3.3 `warning()` — avertissement non-fatal, ne throw jamais

```typescript
// Signature reelle — packages/error/src/invariant.ts
/**
 * Log conditionnel en developpement — ne throw jamais.
 * Strippe en production.
 */
function warning(condition: unknown, message: string): void {
  if (isDev()) {
    if (!condition) {
      console.warn(`[Bonsai] ${message}`);
    }
  }
}
```

### 3.4 `hardInvariant()` — assertion fatale permanente (rare)

```typescript
// Signature reelle — packages/error/src/invariant.ts
/**
 * Assertion NON-strippable — reste en production.
 * Reservee aux erreurs structurelles fatales detectees au bootstrap
 * (namespace duplique I21, handler Command duplique I10, etc.).
 */
function hardInvariant(
  condition: unknown,
  message: string,
  invariantId: string = "",
  component: string = ""
): asserts condition {
  if (!condition) {
    throw new BonsaiError(message, invariantId, component);
  }
}
```

> Aucune des trois fonctions n'accepte de placeholders `%s`/`...args` — le
> `message` est passe tel quel a `BonsaiError`, qui le formate avec
> `invariantId`/`component`/`suggestion` (voir
> [feature.md §8.7.4](../3-couche-abstraite/feature.md) pour la classe
> `BonsaiError` complète).

### 3.5 Messages d'erreur riches

Les messages d'invariant doivent être **explicites**, **contextuels** et **actionnables** :

```typescript
// Exemple reel, livre — Feature#registerEntityHandlers (I96),
// packages/feature/src/bonsai-feature.ts
hardInvariant(
  stateKeys.has(key),
  `Feature "${this.#namespace}" declares entity handler "${method}" for unknown key "${key}"`,
  "I96",
  this.#namespace
);
```

> Un cas comme « une Feature emet sur le Channel d'une autre » (I1, I12)
> n'a **pas besoin** d'un `invariant()` runtime : `emit()` n'accepte que les
> clés de `TChannelDef['events']` propre a la Feature — la violation est
> **structurellement impossible** a exprimer, donc rejetee au compile-time,
> pas interceptee au runtime.
>
> **Convention** : chaque message d'invariant cite l'invariant violé (I1, I7, I21, etc.)
> pour que le developpeur puisse trouver la documentation.

### 3.6 Mode debug vs production

> ⚠️ **La plupart des lignes ci-dessous decrivent un contrat cible, non livre**
> (aucune notion de `hop`, aucun `Object.freeze` anti-mutation, aucun
> `warning()` sur les handlers orphelins n'existe dans le code). Ce qui est
> **reellement** livre : `invariant()`/`hardInvariant()` different uniquement
> par le strippage en production (`isDev()` conditionne `invariant()`,
> jamais `hardInvariant()`) — il n'y a pas de troisieme état "warning en dev,
> silencieux en prod" pour les handlers manquants aujourd'hui.

| Vérification | Debug (`__DEV__`) | Production | Mecanisme | État |
| --- | --- | --- | --- | --- |
| Duplicate handler/replier (I10) | Oui | Oui | `DuplicateHandlerError` (toujours leve, pas de strippage) | ✅ livré |
| Reference `listens`/`queries` inconnue (I70) | Oui | Oui | `BonsaiNamespaceError` (Phase 0c, toujours leve) | ✅ livré |
| Anti-boucle (hop) | — | — | — | ⏳ cible strate 1b |
| onXXX sans message déclaré | — | — | — | ⏳ non planifie |
| Entity freeze anti-mutation | — | — | — | ⏳ non planifie |
| Metas logging (verbose) | — | — | — | ⏳ cible strate 1b (depend des metas) |
| Payload serializable check | — | — | — | ⏳ non planifie |

### 3.7 Tree-shaking — garantie zero-overhead en production

Le pattern `if (__DEV__)` est le standard de l'industrie (React, Vue, Angular) pour garantir que le code de validation ne pese rien en production.

**Prerequis bundler** :

| Bundler | Configuration |
| --- | --- |
| **Vite** | `define: { __DEV__: false }` (mode build) |
| **Rollup** | `@rollup/plugin-replace: { __DEV__: 'false' }` |
| **esbuild** | `--define:__DEV__=false` |
| **webpack** | `DefinePlugin: { __DEV__: false }` |

**Validation** : ⏳ un test de taille du bundle confirmant l'elimination des
assertions serait souhaitable, mais n'est **pas planifie** par ADR-0028 (cf.
bandeau de perimetre en tete de document) — aucun tel test n'existe
aujourd'hui.

---

## Lecture suivante

→ [Conventions de typage](conventions-typage.md) — préfixes, patterns TypeScript fondamentaux
