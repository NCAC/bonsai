# ADR-0004 : Validation Modes

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-18 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0002-api-contrats-typage](../rfc/6-transversal/conventions-typage.md) §15–16 |

---

## Contexte

Les RFC définissent **58 invariants** (I1–I58) qui constituent le "contrat architectural" de Bonsai. La question : **quand et comment valider ces invariants ?**

### Types de validations

| Type | Exemple | Coût |
|------|---------|------|
| **Compile-time** | Types TypeScript, déclarations Channel | Nul (runtime) |
| **Bootstrap** | Unicité namespaces, handlers déclarés | Une fois |
| **Runtime** | Hop > MAX_HOPS, accès Channel non déclaré | Chaque appel |

### Problématique

- En **développement** : on veut tout valider, fail-fast, messages clairs
- En **production** : on veut performance, pas de crash pour une validation
- En **test** : on veut assertions strictes, erreurs explicites

L'audit identifie ce manque :

> *"La validation runtime / mode debug / strict / production n'est pas encore fermée."*

---

## Contraintes

### Architecturales

- **58 invariants** (I1–I58) à potentiellement vérifier
- **Compile-time first** : maximum de validations via TypeScript
- **Performance production** : overhead minimal

### Techniques

- **Tree-shaking** : le code de validation dev doit disparaître en prod
- **Assertions strippables** : pattern `if (__DEV__)` ou similaire
- **Source maps** : erreurs avec stack traces utiles

---

## Options considérées

### Option A — Validation compile-time uniquement

**Description** : Tout passe par TypeScript, aucune validation runtime.

```typescript
// TypeScript garantit que le Channel est déclaré
this.listen('cart:itemAdded', handler); // ✅ Type-safe

// Pas de vérification runtime
// Si le code compile, il est correct
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Zero overhead runtime | - Ne couvre pas tout (ex: unicité namespace) |
| + Erreurs à la compilation | - Bugs runtime possibles |
| + Simple | - Pas de protection contre `any` |

---

### Option B — Validation runtime always-on

**Description** : Toutes les validations actives en permanence.

```typescript
class Feature {
  emit(name: string, payload: unknown) {
    // Validation à chaque appel
    assertChannelOwned(this, name);
    assertValidPayload(payload);
    assertHopLimit(this.currentMetas);
    // ... autres validations
    
    this.channel.emit(name, payload);
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Protection maximale | - **Overhead performance** |
| + Erreurs détectées immédiatement | - Même en production |
| + Debugging facile | - Pas de tree-shaking |

---

### Option C — Modes configurable (dev/prod/strict)

**Description** : Trois modes avec niveaux de validation différents.

```typescript
// Configuration
const app = createApplication({
  mode: 'development', // 'development' | 'production' | 'strict'
});

// Implémentation
class Feature {
  emit(name: string, payload: unknown) {
    if (__DEV__) {
      assertChannelOwned(this, name);
      assertValidPayload(payload);
    }
    if (__STRICT__) {
      assertHopLimit(this.currentMetas);
      assertNoCircularRef(payload);
    }
    
    this.channel.emit(name, payload);
  }
}
```

| Mode | Validations | Use case |
|------|-------------|----------|
| `development` | Bootstrap + runtime warnings | Dev local |
| `production` | Bootstrap only | Prod |
| `strict` | Tout + assertions fatales | Tests, CI |

| Avantages | Inconvénients |
|-----------|---------------|
| + Flexible | - Configuration à gérer |
| + Tree-shakeable | - Trois comportements à tester |
| + Adapté à chaque contexte | |

---

### Option D — Assertions conditionnelles (recommandé)

**Description** : Macro-like assertions qui disparaissent en production.

```typescript
// Définition des assertions
function invariant(
  condition: boolean, 
  message: string, 
  ...args: unknown[]
): asserts condition {
  if (__DEV__ && !condition) {
    throw new InvariantError(format(message, ...args));
  }
}

function warning(condition: boolean, message: string, ...args: unknown[]) {
  if (__DEV__ && !condition) {
    console.warn(`[Bonsai] ${format(message, ...args)}`);
  }
}

// Usage
class Feature {
  emit(name: string, payload: unknown) {
    invariant(
      this.ownsChannel(name),
      'Feature "%s" cannot emit on channel "%s" (I1)',
      this.namespace,
      name
    );
    
    warning(
      isJsonSerializable(payload),
      'Payload for "%s" should be JSON-serializable',
      name
    );
    
    this.channel.emit(name, payload);
  }
}
```

```typescript
// Build configuration (Vite/Rollup/esbuild)
define: {
  __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
}

// En production, le bundler élimine :
// if (false && !condition) { ... } → dead code elimination
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Zero overhead en prod** (dead code) | - Dépend du bundler |
| + Messages riches en dev | - Pattern à connaître |
| + Assertions TypeScript (`asserts`) | |
| + Inspiré de React/Vue | |

---

## Analyse comparative

| Critère | A (Compile) | B (Always) | C (Modes) | D (Conditional) |
|---------|-------------|------------|-----------|-----------------|
| **Perf prod** | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Protection dev** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **DX messages** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Simplicité** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Tree-shaking** | ✅ | ❌ | ✅ | ✅ |

---

## Décision

**🟢 Accepté**

### Option retenue : D (Assertions conditionnelles)

Justification :

1. **Zero overhead en production** via dead code elimination
2. **Messages riches** avec contexte (invariant violé, valeurs)
3. **Pattern éprouvé** (React, Vue, Angular utilisent ce pattern)
4. **TypeScript `asserts`** pour narrowing

### Catégorisation des validations

| Catégorie | Quand | Exemples | Action |
|-----------|-------|----------|--------|
| **Compile-time** | tsc | Types Channel, déclarations | Erreur compilation |
| **Bootstrap** | Au démarrage | Unicité namespace, handlers | `invariant()` fatal |
| **Runtime dev** | Chaque appel (dev) | Hop limit, payload valid | `invariant()` |
| **Runtime warning** | Chaque appel (dev) | Performance hints | `warning()` |

### API proposée

```typescript
// Assertions fatales
invariant(condition, message, ...args);
// → throw InvariantError en dev
// → noop en prod

// Warnings
warning(condition, message, ...args);
// → console.warn en dev
// → noop en prod

// Assertions toujours actives (rare)
hardInvariant(condition, message, ...args);
// → throw même en prod (pour cas critiques)
```

### Messages d'erreur riches

```typescript
// Mauvais
invariant(false, 'Invalid emit');

// Bon
invariant(
  this.ownsChannel(channelName),
  `Feature "${this.namespace}" cannot emit on channel "${channelName}". ` +
  `Features can only emit on their own channel (I1). ` +
  `Did you mean to use listen() instead?`
);
```

---

## Conséquences

### Positives

- ✅ Zero overhead en production
- ✅ Erreurs claires en développement
- ✅ Invariants documentés dans les messages
- ✅ Compatible avec tous les bundlers modernes

### Négatives (acceptées)

- ⚠️ Dépendance au bundler pour tree-shaking — standard en 2026
- ⚠️ Certaines erreurs invisibles en prod — accepté pour la perf

---

## Actions de suivi

- [ ] Créer module `@bonsai/invariant` avec `invariant()`, `warning()`
- [ ] Documenter configuration bundler (Vite, Rollup, esbuild, webpack)
- [ ] Mapper chaque invariant I1–I58 à une assertion
- [ ] Tester tree-shaking effectif

---

## Références

- [React invariant](https://github.com/facebook/react/blob/main/packages/shared/invariant.js)
- [Vue warn](https://github.com/vuejs/core/blob/main/packages/shared/src/warning.ts)
- [tiny-invariant](https://github.com/alexreardon/tiny-invariant)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) |
| 2026-03-18 | **Accepted** — Option D (Assertions conditionnelles) |
