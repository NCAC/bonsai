# Distribution : Mode IIFE vs ESM Modulaire

> **Deux modes de distribution, BonsaiRegistry, strategie de chargement**

[← Retour a l'architecture](README.md)

---

> **ADR-0019 (Accepted)** : Bonsai supporte deux modes de distribution —
> **Mode IIFE** (bundle unique) et **Mode ESM Modulaire** (modules ES natifs).

## 1. Deux modes de distribution

| Aspect             | Mode IIFE (classique)                | Mode ESM Modulaire                     |
| ------------------ | ------------------------------------ | -------------------------------------- |
| **Livraison**      | Bundle unique (`bonsai.iife.js`)     | Modules ES natifs (`*.esm.js`)         |
| **Chargement**     | `<script>` classique                 | `<script type="module">`               |
| **Resolution**     | Build-time (bundler)                 | Runtime (navigateur)                   |
| **BonsaiRegistry** | Non necessaire                       | Obligatoire                            |
| **Tree-shaking**   | Via bundler                          | Natif                                  |
| **Cas d'usage**    | Applications classiques, CMS, legacy | Applications modernes, micro-frontends |

## 2. Mode IIFE — Bootstrap classique

Tous les composants sont connus au build-time. Le bundler (Rollup, Webpack, esbuild)
produit un fichier unique qui contient tout le code de l'application.

```typescript
// Mode IIFE — tout est connu au build-time, pas besoin de BonsaiRegistry
import { Application } from "@bonsai/core";
import { CartFeature } from "./features/cart.feature";
import { UserFeature } from "./features/user.feature";

// Le manifest applicatif : clé camelCase = namespace, valeur = classe Feature (ADR-0039)
const app = new Application({
  features: {
    cart: CartFeature,
    user: UserFeature
  }
});
app.start();
```

> C'est le mode par defaut et le plus simple. Si l'application est construite
> avec un bundler standard, c'est ce mode qu'il faut utiliser.

## 3. Mode ESM Modulaire — BonsaiRegistry

En Mode ESM, les composants Bonsai sont distribues comme des modules ES natifs,
charges par le navigateur via `<script type="module">`. Le `BonsaiRegistry`
collecte les declarations de ces modules avant que l'Application lance le bootstrap.

### Chargement HTML

```html
<!-- 1. Runtime Bonsai (charge en premier) -->
<script type="module" src="/bonsai/bonsai.esm.js"></script>

<!-- 2. Modules metier (ordre HTML = ordre d'execution — garantie HTML spec) -->
<script type="module" src="/modules/cart/cart-feature.esm.js"></script>
<script type="module" src="/modules/user/user-feature.esm.js"></script>

<!-- 3. Bootstrap (dernier — tous les modules precedents ont declare leurs composants) -->
<script type="module" src="/app/bootstrap.esm.js"></script>
```

### Bootstrap ESM

```typescript
// bootstrap.esm.ts — point d'entree Mode ESM
import { Application, BonsaiRegistry } from "/bonsai/bonsai.esm.js";

// Tous les modules de la page ont deja execute leurs registerFeature()
const app = new Application();
const { features } = BonsaiRegistry.collect();

// Enregistrement standard — identique au bootstrap classique
features.forEach((f) => app.register(f));
app.start();
```

### BonsaiRegistry — API

<!-- Le contrat TypeScript complet (signatures, generics, invariants) sera
     injecte lors de la Phase 4 depuis RFC-0002-api §7.4 -->

Le `BonsaiRegistry` est un **singleton** exporte par le runtime ESM. Il offre :

| Methode                      | Role                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `registerFeature(feature)`   | Enregistre une Feature (idempotent, erreur si collision namespace I21)                       |
| `registerView(view)`         | Enregistre une View (optionnel — import statique possible)                                   |
| `registerComposer(composer)` | Enregistre un Composer (optionnel)                                                           |
| `registerBehavior(behavior)` | Enregistre un Behavior                                                                       |
| `collect()`                  | Retourne un snapshot immuable de tous les composants enregistres. **Verrouille** le registry |
| `reset()`                    | Reinitialise le registry — usage test uniquement (`@internal`)                               |

> **Invariant** : `collect()` verrouille le registry — les appels a `register*()`
> apres `collect()` sont des no-ops (mode strict : throw).
> Nature : composant runtime singleton, comme Radio (QO-ESM-3).

---

## 4. Topologie des packages (ADR-0031)

> **ADR-0031 (Accepted)** : **Option D — un package pnpm par composant**. Le
> compilateur TypeScript et la résolution pnpm garantissent les frontières
> architecturales au build-time — aucune convention documentaire ne suffit.

### Graphe de dépendances (DAG pur, zéro cycle)

```
                @bonsai/types           ← types primitifs cross-packages
                ╱     │     ╲
       @bonsai/error  │      │          ← BonsaiError, invariant(), hardInvariant()
        ╱   │   ╲     │      │
@bonsai/event │  @bonsai/entity
      │   ╲    │        │
      │   @bonsai/feature
      │
@bonsai/behavior
      │
 @bonsai/view
      │
@bonsai/composer
      │
@bonsai/foundation
      │
@bonsai/application   ← orchestre tout
      │
 @bonsai/core         ← méta-package barrel pur (zéro code propre)
```

Chaque arc dans ce graphe correspond à une entrée `"dependencies"` dans un
`package.json`. Si le lien n'est pas déclaré, l'import ne compile pas —
c'est la garantie fondamentale d'Option D.

### Convention d'import — deux audiences, deux règles

**Développeur d'application** (consommateur du framework) :

```typescript
// ✅ Un seul import à connaître
import { Application, Feature, Entity, View, Composer } from "@bonsai/core";

// ❌ Interdit — imports internes réservés au framework
import { Entity } from "@bonsai/entity";
```

**Développeur framework** (code inter-packages) :

```typescript
// ✅ Import depuis le package du composant — dépendance explicite
import { Entity } from "@bonsai/entity";
import { Feature } from "@bonsai/feature";
import { Channel, Radio } from "@bonsai/event";

// ❌ Interdit — crée des dépendances circulaires et masque le DAG
import { Entity } from "@bonsai/core";
```

**Tests — l'import dépend du niveau :**

| Niveau                                 | Import                  | Objectif                                      |
| -------------------------------------- | ----------------------- | --------------------------------------------- |
| **Unit** (`tests/unit/`)               | `from "@bonsai/entity"` | Prouve l'isolation, charge le minimum         |
| **Intégration** (`tests/integration/`) | `from "@bonsai/core"`   | Teste comme un consommateur                   |
| **E2E** (`tests/e2e/`)                 | `from "@bonsai/core"`   | Exactement comme le développeur d'application |

### Structure d'un package composant

Chaque package suit un template identique :

```
packages/{name}/
  package.json          → "@bonsai/{name}", deps uniquement @bonsai/* nécessaires
  tsconfig.json         → extends tsconfig.base.json
  src/
    bonsai-{name}.ts    ← barrel (re-exports publics)
    {name}.class.ts     ← classe principale
    types.ts            ← types publics (optionnel)
```

`@bonsai/core` (dans `core/`) est le seul méta-package : barrel pur qui
ré-exporte tous les composants. Il ne contient aucun code propre.

---

## Lecture suivante

→ [Metas et tracabilite](metas.md) — metadonnees causales, ULID, propagation
