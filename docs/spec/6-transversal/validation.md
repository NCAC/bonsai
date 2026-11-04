# Validation statique et dynamique

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (4 novembre 2026).** Les garde-fous non livrés sont marqués ⏳. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Compile-time, démarrage, unité de validation — garanties TypeScript et refus du noyau**

[← Retour à l'index](../README.md)

---

> **Livré** : garanties compile-time du pattern modulaire et du contrat Feature
> (ADR-14, ADR-09), prouvées par `tests/types/` ; au démarrage,
> `BonsaiNamespaceError` (phases 0a et 0c), `ManifestError` (cycle de
> dépendances initiales), constructeur inerte (I94), filets I82/I84 quand la
> View est décrite au noyau, `hardInvariant()` pour I96 ; pendant un
> traitement, les refus du noyau (`TransportError`, code stable) qui font
> échouer l'unité de l'auteur (G7) ; helpers `invariant()`, `hardInvariant()`
> et `warning()` de `@bonsai/error`, et `__DEV__` remplacé par la pipeline
> (§3.1).
>
> **Non livré** : validation des Entities par schéma (`TEntitySchema`, Valibot,
> ADR-11) ; `warning()` sur les handlers orphelins ; test de taille du bundle.

## 1. Validation statique (compile-time)

### 1.1 Typage des déclarations

Le système de types garantit que les déclarations sont cohérentes avec l'usage.

**Exemple** : `CartView` déclare `cart` dans `get features()` (ADR-14,
`TFeatureContract`), avec `triggers: ["addItem"]` :

```typescript
onAddButtonClick(_fact: TFact, ctx: TFactContext<TCartViewContract>): void {
  // ✅ "cart:addItem" ∈ TFlatTriggers<F> (I77)
  ctx.trigger("cart:addItem", payload);

  // ❌ Erreur TS : Command inconnue (typo)
  ctx.trigger("cart:adddItem", payload);

  // ❌ Erreur TS : namespace non déclaré dans get features()
  ctx.trigger("inventory:reserve", payload);
}

onCartItemAddedEvent(_payload: { item: TCartItem }, ctx: TEventContext<TCartViewContract>): void {
  // ❌ Erreur TS : le contexte d'un Event n'a pas de trigger (D18)
  ctx.trigger("cart:addItem", payload);
}
// ❌ Erreur TS : une View n'a ni emit() ni trigger() propre (I4)
this.emit("itemAdded", payload);
```

### 1.2 Erreurs de compilation attendues

| # | Erreur TypeScript | Invariant | Cause |
| --- | --- | --- | --- |
| 1 | `Property 'emit' does not exist on type 'CartView'` | I4 | Une View n'émet jamais |
| 2 | `Argument of type '"cart:adddItem"' is not assignable to parameter of type …` | I77 | Command inexistante ou typo dans la clé namespacée |
| 3 | `Argument of type '"inventory:reserve"' is not assignable to parameter of type …` | I14, I77 | Namespace non déclaré dans `get features()` |
| 4 | `Property 'trigger' does not exist on type 'TEventContext<…>'` | D18, I13 | Un handler d'Event ne commande pas |
| 5 | `Property 'trigger' does not exist on type 'TFeatureContext<…>'` | D17 | Une Feature n'adresse jamais de Command |
| 6 | `Type '{ items: Map<string, Item> }' does not satisfy the constraint 'TJsonSerializable'` | ADR-10 | Entity non jsonifiable |

### 1.3 Patterns TypeScript avancés

| Pattern TypeScript | Usage dans Bonsai | Bénéfice DX |
| --- | --- | --- |
| **Template literal types** | `` `on${Capitalize<K>}Command` `` (dans `TCommandCallbacks<TDef>`) : `"addItem"` → `"onAddItemCommand"` | Autocomplétion des noms de handlers |
| **Mapped types** | `TCommandCallbacks<TDef>` / `TQueryCallbacks<TDef>` génèrent les signatures obligatoires (ADR-09) | `implements TFeatureCallbacks<…>` : l'IDE liste les méthodes manquantes |
| **Conditional types + infer** | `TQueryResultFor<F, K>` extrait le type de retour d'une Query depuis un `TFeatureContract` | `ctx.query` retourne une valeur typée, synchrone (G5) |
| **Literal string types** | paramètre `NS` de `TChannelToken<TDef, NS>` | Erreur compile-time si namespace inconnu |
| **Constrained generics** | `TStructure extends TJsonSerializable` | Impossible de créer une Entity non sérialisable |
| **`satisfies`** | `satisfies StrictManifest<AppManifest>` (ADR-08), `satisfies TFeatureContract` / `TUIContract` (ADR-14) | Erreur si un namespace ou un message non déclaré est utilisé |
| **Contextes distincts** | `TFactContext` (avec `trigger`) / `TEventContext` (sans), `TFeatureContext` / `TFeatureQueryContext` | Le droit de commander et la lecture seule sont des propriétés du type (D18, A3.g) |
| **`UnionToIntersection`** | Fusionne les handlers de plusieurs tokens `listens` en un type `implements`-able (`TListenCallbacks`) | Sans lui, TS produit une union que `implements` refuse (TS2422) |

**Patterns non retenus** :

- **F-bounded polymorphism récursif** : inutile, les Features ne s'héritent pas.
- **Accès runtime à un Channel exposé au développeur** : l'acheminement appartient à la racine du noyau, interne (I15) ; la surface développeur ne manipule que des types (`TChannelDefinition`, `TChannelToken`) et les contextes de handler.
- **Décorateurs** (`@Handle('addItem')`) : rejetés (ADR-09) au profit de la convention `on…` auto-découverte.
- **Branded types pour l'unicité du namespace** : l'unicité est garantie par `TS1117` (clé dupliquée dans le manifest littéral).

---

## 2. Validation dynamique (runtime)

### 2.1 Refus du noyau

Ce que le type system ne peut pas attraper (casts `as any`, JavaScript, ordre
d'exécution) est refusé par la racine du noyau. Un refus est une
`TransportError` à code stable : il interrompt l'auteur et fait échouer son
unité, qui est entièrement défaite (G7).

| Code | Condition | Référence |
| --- | --- | --- |
| `UNKNOWN_TARGET` | Command vers un namespace sans Channel dans cette racine | G6 |
| `UNDECLARED_MESSAGE` | Command, Query ou Event absent du contrat de la cible (handler non découvert compris), message local non déclaré | D16 |
| `NOT_AUTHORIZED` | Command adressée sans droit de commander : handler d'Event, composant hors interface | D18, I13 |
| `NOT_OWNER` | `emit` sans Channel propre, projection ou destruction sur une ressource d'autrui | A3.e, A1.b |
| `READ_ONLY` | Mutation, émission ou Command pendant une Query | A3.g |
| `TARGET_ACTIVE` / `TARGET_NOT_READY` | Query vers soi-même, un cycle, ou une cible encore en initialisation | G5, C.1 |
| `CAUSAL_BOUND` | Profondeur causale au-delà de `causalBound` | D9, I9 |
| `NOT_CAPTURABLE` | Payload portant une fonction ou une valeur non copiable | G2, A3.d |
| `NO_UNIT` | Contexte utilisé hors de son unité (par exemple dans un `.then()`) | A5.a, I66 |
| `UNRECOVERABLE` | Échec de Query intercepté par l'auteur : l'unité échoue quand même | G7 |
| `DUPLICATE_NAMESPACE` | Deux Channels vivants du même namespace dans une racine | I21 |

Il n'y a ni `NoHandlerError`, ni `DuplicateHandlerError`, ni `null` de
substitution : un handler est découvert par son nom (un nom de méthode est
unique), et une Command ou une Query sans handler n'appartient pas au contrat.

**Mutation externe** : `Feature.entity` est `protected` (I6), donc une mutation
externe ne compile pas ; à l'exécution, `entity.state` n'est lisible que
pendant un handler de la Feature, et l'état n'est modifiable que par
`ctx.mutate`.

### 2.2 Messages d'erreur et diagnostics

Les messages d'erreur sont **explicites**, **contextuels** et **actionnables**.
Exemples réels (`packages/kernel/src/kernel/root.ts`) :

```text
[UNDECLARED_MESSAGE] command "inventory:reserve" not declared
[CAUSAL_BOUND] depth 51 exceeds bound 50
[NO_UNIT] context used outside its validation unit (A5.a)
```

Chaque échec est écrit dans la trace de la racine (`unit-failed`) avec le
contexte causal de l'unité (G8), et signalé sur la console en développement
(`reportToConsole`, O2).

> Le cas « `inventory:reserve` non déclaré dans `get features()` » n'atteint
> **jamais** le runtime : il est rejeté au compile-time (I77, §1.2 n°3).

### 2.3 Catégorisation des validations

> **Principe** : maximum de validations au compile-time ; le runtime ne vérifie que ce que TypeScript ne peut pas attraper.

| Catégorie | Quand | Exemples | Action en cas de violation |
| --- | --- | --- | --- |
| **Compile-time** | `tsc` | Contrats de Channel, `get features()`/`get listens()`, payloads, handlers requis (I92), droit de commander (D18) | Erreur de compilation |
| **Démarrage** | `app.start()`, une fois | Format et unicité du namespace, `static channel` (phase 0a), références inconnues (I70, phase 0c), cycle de dépendances (C.1), handlers déclarés d'une View (I82, I84) | `BonsaiNamespaceError`, `ManifestError`, `StartupError` : rien n'est publié |
| **Unité** | Chaque traitement | Refus du noyau (§2.1), invariant d'Entity en fin d'unité (`InvariantError`) | L'unité échoue et est défaite, en développement comme en production |
| **⏳ Non livré** | — | Schéma d'Entity (ADR-11), `warning()` sur handlers orphelins | — |

---

## 3. Assertions conditionnelles — API `@bonsai/error`

> Décision : [ADR-06](../../adr/ADR-06-modes-validation.md) — assertions conditionnelles
> inspirées de React/Vue, éliminées du bundle de production.
>
> **Livré** : la pipeline définit `__DEV__` et publie un bundle de production
> où les branches de développement sont éliminées (ADR-06, §3.1).
>
> Les assertions vivent dans **`@bonsai/error`** (`packages/error/src/invariant.ts`).
> Signature : `(condition, message, invariantId?, component?)` ; `invariantId`
> (par défaut `"INVARIANT"`) devient le `code` de la `BonsaiError` ; le message est
> passé tel quel, sans placeholder `%s`.

### 3.1 Constante globale `__DEV__`

```typescript
// packages/error/src/invariant.ts
declare const __DEV__: boolean;
export function isDev(): boolean {
  return typeof __DEV__ === "undefined" || __DEV__;
}

// La pipeline (lib/build/plugins/rollup-plugin-define.ts) remplace __DEV__
// dans l'AST : `true` pour core/dist/bonsai.js, `false` pour
// core/dist/bonsai.prod.js. Rollup replie alors la constante :
//   if (isDev() && !condition) { ... }  ->  supprimé en production
```

| Bundle | `__DEV__` | Choisi par |
| --- | --- | --- |
| `core/dist/bonsai.js` | `true` | condition `default` |
| `core/dist/bonsai.prod.js` | `false` | condition `production` de `exports` |
| `packages/*/dist`, sources lancées par Jest | libre → `true` | — |

> **Filet** : si `__DEV__` n'est pas remplacé (`typeof __DEV__ === "undefined"`),
> `isDev()` retourne `true` — choix délibérément conservateur : mieux vaut
> montrer une erreur qu'un état incohérent silencieux.

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
  invariantId: string = "INVARIANT",
  component: string = ""
): asserts condition {
  if (isDev()) {
    if (!condition) {
      throw new BonsaiError(invariantId, message, { component });
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
 * Reservee aux erreurs structurelles fatales detectees au bootstrap.
 * (Le seul appelant livré est la Feature, pour I96 : un namespace réservé
 * lève BonsaiNamespaceError.)
 */
function hardInvariant(
  condition: unknown,
  message: string,
  invariantId: string = "INVARIANT",
  component: string = ""
): asserts condition {
  if (!condition) {
    throw new BonsaiError(invariantId, message, { component });
  }
}
```

> Aucune des trois fonctions n'accepte de placeholders `%s`/`...args` — le
> `message` est passe tel quel a `BonsaiError`, qui le formate avec son
> `code` et son `component` : `[I1] cart — …` (voir
> [erreurs.md](../2-architecture/erreurs.md) et [ADR-05](../../adr/ADR-05-propagation-erreurs.md)).

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

> Un cas comme « une Feature émet sur le Channel d'une autre » (I1)
> n'a **pas besoin** d'un `invariant()` : `ctx.emit()` n'accepte que les
> clés de `TChannelDef['events']` propre à la Feature, et le noyau émet
> toujours sur le Channel de l'auteur (`NOT_OWNER` sinon).
>
> **Convention** : chaque message d'invariant cite l'invariant violé (I1, I7, I21, etc.)
> pour que le developpeur puisse trouver la documentation.

### 3.6 Mode debug vs production

`invariant()` et `hardInvariant()` ne diffèrent que par le strippage en
production (`isDev()` conditionne `invariant()`, jamais `hardInvariant()`). Les
refus du noyau ne dépendent pas du mode : une unité qui échoue en
développement échoue de la même façon en production. Seule la sortie console
change.

| Vérification | Debug (`__DEV__`) | Production | Mécanisme | État |
| --- | --- | --- | --- | --- |
| Refus du noyau (§2.1) | Oui | Oui | `TransportError`, unité défaite | ✅ livré |
| Références `listens`/`queries` inconnues (I70) | Oui | Oui | `BonsaiNamespaceError` (phase 0c) | ✅ livré |
| Borne causale (D9) | Oui | Oui | `CAUSAL_BOUND` | ✅ livré |
| Payload capturable par copie (G2) | Oui | Oui | `NOT_CAPTURABLE` | ✅ livré |
| Sortie console des échecs (O2) | Oui | Non | `reportToConsole`, absent du bundle de production | ✅ livré |
| `on…` sans message déclaré | — | — | — | ⏳ non planifié |

### 3.7 Tree-shaking — garantie zero-overhead en production

Le pattern `if (__DEV__)` est le standard de l'industrie (React, Vue, Angular) pour garantir que le code de validation ne pese rien en production.

**Prérequis côté application** : `__DEV__` est déjà remplacé dans les bundles
du framework ; le `define` du bundler applicatif ne s'y applique pas. Le
bundle de production est choisi par la condition `production` de `exports` :

| Bundler | Configuration |
| --- | --- |
| **Vite** | aucune : condition `production` posée en build |
| **webpack 5** | aucune : condition `production` posée en `mode: "production"` |
| **esbuild** | `--conditions=production` |
| **Rollup** | `nodeResolve({ exportConditions: ["production"] })` |

**Validation** : `tests/integration/bundles-dev-prod.test.ts` vérifie qu'aucun
bundle ne garde de `__DEV__` libre et que le sink console de la trace (O2)
est absent du bundle de production. ⏳ Un test de taille du bundle reste non
planifié par ADR-31.

---

## Lecture suivante

→ [Conventions de typage](conventions-typage.md) — préfixes, patterns TypeScript fondamentaux
