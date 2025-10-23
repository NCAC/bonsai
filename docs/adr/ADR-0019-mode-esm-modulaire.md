# ADR-0019 : Mode ESM Modulaire

> **Comment distribuer et charger les composants Bonsai en mode ESM natif, sans bundler, avec un mécanisme de découverte dynamique des modules présents au runtime ?**

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-01 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0001-architecture-fondamentale](../rfc/1-philosophie.md), [RFC-0002 §7 Application](../rfc/6-transversal/conventions-typage.md#7-application) |
| **Invariants impactés** | I21, I24, D6, D9, D15 |
| **ADRs liées** | ADR-0010 (bootstrap order), ADR-0018 (Foundation contract), ADR-0020 (N-instances Composer), ADR-0021 (monde ouvert / plateforme) |

> ### Statut normatif
> Ce document est **normatif** pour le choix du mode de distribution et le mécanisme `BonsaiRegistry`.
> En cas de divergence avec `reflexion-2026-03-30.md` (Partie I), **ce document prévaut**.

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Options considérées](#options-considérées)
   - [Option A — Mode Bundle IIFE](#option-a--mode-bundle-iife)
   - [Option B — Mode ESM Modulaire](#option-b--mode-esm-modulaire)
4. [Analyse comparative](#analyse-comparative)
5. [Décision](#décision)
6. [Spécification : BonsaiRegistry](#spécification--bonsairegistry)
7. [Spécification : Bootstrap ESM](#spécification--bootstrap-esm)
8. [Spécification : Artefacts de distribution & outillage de build](#spécification--artefacts-de-distribution--outillage-de-build)
9. [Questions ouvertes](#questions-ouvertes)
10. [Conséquences](#conséquences)
11. [Historique](#historique)

---

## Contexte

Le modèle de distribution actuel de Bonsai suppose implicitement un **bundle unique** : tous les composants (Features, Views, Composers, Behaviors) sont connus à la compilation et assemblés en un seul artefact JS. Cette approche fonctionne parfaitement pour les SPAs monolithiques.

Cependant, les applications réelles — notamment les back-offices CMS, les dashboards configurables, les applications multi-modules — ont besoin d'un modèle plus flexible :

- **Chargement contextuel** : ne charger que les modules nécessaires à la page courante
- **Extensibilité** : permettre à des packages npm tiers (Niveau 1 — cf. ADR-0021) de contribuer des composants sans que l'application hôte les connaisse à la compilation
- **Architecture distribuée** : plusieurs équipes développent des modules indépendants qui s'assemblent au runtime
- **Pas de bundler** : distribuer des modules TypeScript compilés en ES Modules natifs, sans Webpack/Rollup/Vite

### Qu'est-ce que le Mode ESM Modulaire ?

Le mode ESM Modulaire propose de distribuer Bonsai sous la forme :
- d'un **runtime ESM unique** (`bonsai.esm.js`) — le framework lui-même
- de **modules ESM autonomes** — chacun représente un composant Bonsai (Feature, View, Composer, Behavior), compilé depuis TypeScript vers JS sans bundler
- d'un **`BonsaiRegistry`** — point de collecte des modules réellement chargés dans la page, exploité par l'Application au bootstrap

Chaque module est un fichier JS distinct, chargé nativement par le navigateur via `<script type="module">` ou `import()`.

---

## Contraintes

| # | Contrainte | Justification |
|---|-----------|---------------|
| **C1** | **Bootstrap déterministe** — l'ordre de chargement des modules ESM ne doit pas changer le comportement de l'application | ADR-0010, D6 |
| **C2** | **Unicité des namespaces** — deux modules ne peuvent pas enregistrer le même namespace | I21, I24 |
| **C3** | **Pas de side-effects à l'import** — un module ESM ne démarre rien en l'important ; il déclare seulement | D9 (imports dynamiques explicites) |
| **C4** | **Type-safety intra-module** — le code d'un module reste compile-time safe en interne | Philosophie Bonsai |
| **C5** | **Pas de re-câblage Radio post-bootstrap** — le bootstrap classique (ADR-0010) reste la séquence de référence pour v1 | ADR-0010 phase 1–6 |
| **C6** | **`BonsaiRegistry` ne crée pas de singleton global opaque** — son comportement est déterministe et testable | Philosophie Bonsai |
| **C7** | **Chaque module ESM `*.esm.js` est livré avec son `*.d.ts`** — le fichier de déclaration TypeScript est un artefact de première classe, inséparable du module JS. Sans `.d.ts`, l'import du module par un consommateur TypeScript perd toute type-safety. | Philosophie Bonsai — « le type EST la documentation » |
| **C8** | **Bonsai fournit l'outillage de build officiel pour les deux modes** — Mode IIFE (bundle) et Mode ESM+`.d.ts` (modulaire). Un développeur ne doit pas avoir à configurer `tsc`, `tsc-alias` ou un bundler pour obtenir des artefacts conformes. | DX — réduire la charge de configuration |

---

## Options considérées

### Option A — Mode Bundle IIFE

**Description** : produire un bundle unique contenant le runtime Bonsai, l'ensemble des Features, Views, Composers et toute la logique embarquée. Ce bundle est chargé en une fois dans le navigateur.

```html
<!-- Toute l'application dans un seul fichier -->
<script src="/dist/app.bundle.js"></script>
```

```typescript
// build.ts — tout est connu au build-time
import { CartFeature } from './features/cart.feature';
import { UserFeature } from './features/user.feature';
import { ProductView } from './views/product.view';
// ...

const app = new Application();
app.register(CartFeature);
app.register(UserFeature);
app.start();
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Livraison unique — un seul fichier JS | - Bundler obligatoire (Webpack, Rollup, Vite) |
| + Environnement maîtrisé — aucun risque de fuite | - Compilation centralisée — tout doit être connu au build |
| + Runtime instancié une seule fois | - Impossible d'ajouter des Features dynamiquement après compilation |
| + Performances initiales bonnes en HTTP/1 | - Impossible de charger des modules contextuels selon la page/route |
| + Pas de problème d'ordre de chargement | - Import inter-modules impossible — tout est dans le bundle |
| | - Rigidité structurelle — rebuild complet pour toute modification |
| | - Faible granularité — une modif mineure = rebuild complet |

---

### Option B — Mode ESM Modulaire

**Description** : distribuer Bonsai sous forme d'un runtime ESM et d'un ensemble de fichiers ESM autonomes représentant chacun une Feature, un Composer, une View ou un Behavior. Chaque module se déclare dans `BonsaiRegistry` à l'import. L'Application collecte ces déclarations au bootstrap.

```html
<!-- Runtime Bonsai -->
<script type="module" src="/bonsai/bonsai.esm.js"></script>

<!-- Modules applicatifs — chargés selon la page -->
<script type="module" src="/modules/cart/cart-feature.esm.js"></script>
<script type="module" src="/modules/user/user-feature.esm.js"></script>

<!-- Module tiers (package npm compilé en ESM) -->
<script type="module" src="/vendor/@bonsai/rich-text/editor-feature.esm.js"></script>

<!-- Point d'entrée applicatif -->
<script type="module" src="/app/bootstrap.esm.js"></script>
```

```typescript
// cart-feature.esm.ts — chaque module se déclare
import { BonsaiRegistry } from '/bonsai/bonsai.esm.js';
import { CartFeature } from './cart.feature.js';

// Déclaration — pas de side-effect métier, juste un enregistrement
BonsaiRegistry.registerFeature(CartFeature);
```

```typescript
// bootstrap.esm.ts — l'application collecte ce qui a été chargé
import { Application, BonsaiRegistry } from '/bonsai/bonsai.esm.js';

const app = new Application();

// Collecte tous les composants déclarés dans les modules chargés
const modules = BonsaiRegistry.collect();
modules.features.forEach(f => app.register(f));

app.start();
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Aucun bundler requis** — TypeScript → ES Modules, terminé | - Multiplication des requêtes HTTP (atténué par HTTP/2 & HTTP/3) |
| + Modularité totale — chaque Feature vit dans son fichier | - Discipline modulaire requise (exposer ou non un module via API publique) |
| + Découverte dynamique via `BonsaiRegistry` | - Bootstrap doit gérer l'ordre de chargement ESM (QO-ESM-1 → résolu) |
| + Extensibilité naturelle — les modules peuvent importer d'autres modules | - `BonsaiRegistry` introduit un état global (singleton documenté — QO-ESM-3 → résolu) |
| + Lazy-loading natif via `import()` | - `BonsaiRegistry.collect()` retourne les types de base (`typeof Feature`, `typeof View`…) — par design : le bootstrap ne connaît pas les sous-classes. Les imports directs inter-modules sont pleinement typés (C7). |
| + Composition UI flexible par modules | |
| + Granularité fine — modifier 1 module = recompiler 1 fichier | |
| + Cross-module imports natifs + type-safety compile-time (C7 — `.d.ts` obligatoires) | |

---

## Analyse comparative

| Critère | Option A — IIFE | Option B — ESM Modulaire |
|---------|----------------|--------------------------|
| **Build** | Bundler obligatoire | TS → JS direct |
| **Découverte des composants** | Statique (compile-time) | Dynamique (BonsaiRegistry) |
| **Extensibilité tiers** | Faible (import statique requis) | Forte (BonsaiRegistry ouvert) |
| **Chargement par périmètre** | Impossible | Natif (`<script type="module">`) |
| **Cross-module imports** | ❌ | ✅ |
| **Lazy loading** | Complexe (code-splitting bundler) | `import()` natif |
| **Granularité rebuild** | Monolithique | Par module |
| **Adaptation multi-équipes** | Mauvaise | Excellente |
| **Composition UI dynamique** | Rigide | Slots + Registry |
| **Type-safety** | ⭐⭐⭐ compile-time complet | ⭐⭐⭐ imports directs (C7 — `.d.ts` obligatoires) · ⭐⭐ `collect()` dynamique (types de base — par design) |
| **Complexité bootstrap** | ⭐⭐⭐ simple | ⭐⭐ ordre de chargement à gérer |
| **Compatibilité ADR-0010** | ⭐⭐⭐ native | ⭐⭐⭐ compatible (collect → register → start) |

---

## Décision

**Option B retenue — Mode ESM Modulaire.**

### Justification

Pour un framework visant la **modularité**, le **typage strict**, la **composition UI déclarative** et l'**intégration progressive dans des environnements complexes** (CMS, back-offices, dashboards multi-équipes), le mode ESM modulaire est nettement supérieur. C'est la seule approche offrant la flexibilité nécessaire sans sacrifier la cohérence architecturale.

Le mode IIFE reste **supporté** comme mode alternatif pour les applications monolithiques fermées — il n'est pas supprimé, mais il n'est pas le mode cible du framework.

### Ce qui est rejeté et pourquoi

**Option A (IIFE seul)** rejetée comme mode principal :
- Empêche structurellement tout chargement contextuel par page/route
- Exige un outillage de build (bundler) non justifié pour la majorité des cas Bonsai
- Ferme la porte à l'extensibilité tiers (Niveaux 1-3, cf. ADR-0021)
- Contredit la philosophie « TypeScript → JS natif, aucun intermédiaire »

### Périmètre de cette décision

Cette ADR couvre :
- ✅ Le mécanisme `BonsaiRegistry` (register*, collect)
- ✅ La convention de déclaration des modules ESM
- ✅ Le bootstrap dynamique (collect → register → start)
- ✅ Le contrat des artefacts de distribution (`.esm.js` + `.d.ts` obligatoires) — §8
- ✅ L'outillage de build Bonsai pour les deux modes (IIFE et ESM) — §8
- ❌ Les contribution points et late registration → ADR-0021
- ❌ La sémantique N-instances Composer → ADR-0020

---

## Spécification : BonsaiRegistry

### Nature

`BonsaiRegistry` est un **singleton du runtime Bonsai** (composant framework), pas une convention d'usage. Il est exporté directement depuis `bonsai.esm.js` et existe uniquement en mode ESM modulaire.

> **QO-ESM-3 résolue** : `BonsaiRegistry` est un composant runtime, pas un pattern d'usage.
> Sa nature de singleton est assumée et documentée — comme `Radio`.

### API

```typescript
/**
 * BonsaiRegistry — point de collecte des modules ESM Bonsai.
 *
 * Singleton exporté par le runtime. Collecte les déclarations des modules
 * chargés dans la page avant que l'Application appelle collect().
 *
 * Invariant : BonsaiRegistry.collect() est idempotent — appels multiples
 * retournent le même résultat (snapshot au moment de l'appel).
 *
 * Invariant : registerFeature() / registerView() etc. sont des no-ops
 * après collect() — le registry est verrouillé dès que l'Application démarre.
 */
declare const BonsaiRegistry: {
  /**
   * Enregistre une Feature dans le registry.
   * Doit être appelé dans le module ESM de la Feature, au top-level.
   * No-op si la Feature est déjà enregistrée (idempotent).
   *
   * @throws BonsaiRegistryError si un namespace collision est détectée (I21)
   */
  registerFeature(feature: typeof Feature): void;

  /**
   * Enregistre une View dans le registry.
   * Optionnel — les Views peuvent aussi être importées statiquement par les Composers.
   */
  registerView(view: typeof View): void;

  /**
   * Enregistre un Composer dans le registry.
   * Optionnel — les Composers peuvent aussi être câblés statiquement dans les Views.
   */
  registerComposer(composer: typeof Composer): void;

  /**
   * Enregistre un Behavior dans le registry.
   */
  registerBehavior(behavior: typeof Behavior): void;

  /**
   * Collecte tous les composants enregistrés depuis le dernier reset().
   *
   * Retourne un snapshot immuable — les enregistrements ultérieurs n'affectent pas
   * le résultat retourné.
   *
   * Verrouille le registry — les appels à register*() après collect() sont des no-ops
   * (mode strict : throw BonsaiRegistryError ; mode permissif : warning).
   */
  collect(): {
    readonly features: ReadonlyArray<typeof Feature>;
    readonly views: ReadonlyArray<typeof View>;
    readonly composers: ReadonlyArray<typeof Composer>;
    readonly behaviors: ReadonlyArray<typeof Behavior>;
  };

  /**
   * Réinitialise le registry — usage test uniquement.
   * @internal
   */
  reset(): void;
};
```

### Convention de déclaration dans un module ESM

```typescript
// ✅ Déclaration correcte — top-level, pas de side-effect métier
// fichier : cart-feature.esm.ts
import { BonsaiRegistry } from '/bonsai/bonsai.esm.js';
import { CartFeature } from './cart.feature.js';

BonsaiRegistry.registerFeature(CartFeature);
// Le module déclare ce qu'il apporte — c'est tout.
// Aucune logique métier, aucun démarrage d'application.
```

```typescript
// ❌ Anti-pattern — side-effect métier à l'import
// fichier : cart-feature.esm.ts (INTERDIT)
import { BonsaiRegistry } from '/bonsai/bonsai.esm.js';
import { CartFeature } from './cart.feature.js';

BonsaiRegistry.registerFeature(CartFeature);

// ❌ Side-effect métier à l'import — interdit (C3, D9)
const cartState = new CartEntityState();
cartState.init();
```

---

## Spécification : Bootstrap ESM

### Pattern standard

```typescript
// bootstrap.esm.ts — point d'entrée de l'application
import { Application, BonsaiRegistry } from '/bonsai/bonsai.esm.js';

// Tous les modules de la page ont déjà exécuté leurs registerFeature()
// grâce à l'ordre de chargement ESM natif (les <script type="module"> de la page
// sont exécutés dans l'ordre d'apparition dans le DOM — garantie HTML spec).

const app = new Application();

// Collecte le snapshot des composants déclarés
const { features, views, composers, behaviors } = BonsaiRegistry.collect();

// Enregistrement standard — identique au bootstrap classique
features.forEach(f => app.register(f));

// start() exécute la séquence ADR-0010 phase 1–6
app.start();
```

### Ordre de chargement et déterminisme (QO-ESM-1)

Les `<script type="module">` sont exécutés dans leur **ordre d'apparition dans le DOM** (garantie HTML spec). Le bootstrap ESM exploite cette garantie :

```html
<!-- 1. Runtime (chargé en premier) -->
<script type="module" src="/bonsai/bonsai.esm.js"></script>

<!-- 2. Modules métier (ordre déterministe = ordre déclaré dans le HTML) -->
<script type="module" src="/modules/cart/cart-feature.esm.js"></script>
<script type="module" src="/modules/user/user-feature.esm.js"></script>

<!-- 3. Bootstrap (chargé en dernier — tous les modules précédents ont été exécutés) -->
<script type="module" src="/app/bootstrap.esm.js"></script>
```

> **Garantie** : quand `bootstrap.esm.js` s'exécute, tous les modules déclarés avant lui
> dans le HTML ont déjà appelé leurs `BonsaiRegistry.register*()`.
> `BonsaiRegistry.collect()` retourne donc un snapshot complet et déterministe.

Pour le lazy-loading (`import()` dynamique), le pattern est explicite :

```typescript
// Lazy-loading explicite — l'ordre est garanti par await
await import('/modules/admin/admin-feature.esm.js');
await import('/modules/reports/reports-feature.esm.js');

// collect() APRÈS les await — déterministe
const { features } = BonsaiRegistry.collect();
features.forEach(f => app.register(f));
app.start();
```

### Compatibilité avec ADR-0010

La séquence `collect → register → start` est **fully compatible** avec ADR-0010 :

| Phase ADR-0010 | Correspondance Mode ESM |
|----------------|------------------------|
| Phase 1 — Validation namespaces | Inchangée — déclenchée par `app.register()` |
| Phase 2 — Création Channels | Inchangée |
| Phase 3 — Câblage Radio | Inchangée |
| Phase 4 — Init Features (abstract) | Inchangée |
| Phase 5 — Instantiation Views/Composers | Inchangée |
| Phase 6 — Attachement DOM | Inchangée |
| **Pré-bootstrap ESM** | `BonsaiRegistry.collect()` → `app.register()` × N **avant** `app.start()` |

Le mode ESM ajoute uniquement une **étape de pré-collecte** avant `app.start()`. Les phases ADR-0010 restent intactes.

---

## Spécification : Artefacts de distribution & outillage de build

### Principe fondamental — le `.d.ts` est un artefact de première classe

> **Règle (C7)** : un module ESM Bonsai n'est **jamais** distribué sous la forme d'un seul fichier `.js`. L'artefact minimal est une paire `*.esm.js` + `*.d.ts`. Sans le fichier de déclaration TypeScript, un consommateur qui importe le module perd toute type-safety — ce qui est une violation de la philosophie Bonsai.

L'analogie est directe avec les packages npm TypeScript : distribuer `cart-feature.esm.js` sans `cart-feature.d.ts` équivaut à publier un package npm sans types. Les IDE ne peuvent pas fournir d'IntelliSense, le compilateur ne peut pas vérifier les usages, les erreurs ne sont détectées qu'au runtime. C'est inacceptable dans l'architecture Bonsai.

**Structure d'un module distribué** :

```
/modules/cart/
  cart.feature.esm.js       ← module ES natif (chargeable par le navigateur)
  cart.feature.d.ts         ← déclaration TypeScript (obligatoire)
  cart.feature.esm.js.map   ← source map (optionnel, recommandé pour debug)
```

**Structure du runtime Bonsai distribué** :

```
/bonsai/
  bonsai.esm.js             ← runtime ESM natif
  bonsai.d.ts               ← déclarations TypeScript du runtime (BonsaiRegistry, Application, etc.)
  bonsai.esm.js.map         ← source map
  bonsai.iife.js            ← runtime IIFE (mode bundle — optionnel, présent si Mode A utilisé)
```

### Les deux modes de build Bonsai

Bonsai fournit un outil de build officiel (C8) capable de produire les deux modes. Un développeur lance `bonsai build --mode=esm` ou `bonsai build --mode=iife` — sans configuration manuelle de `tsc`, de `tsc-alias`, ni de bundler.

---

#### Mode A — IIFE Bundle

**Sortie** : un fichier JS unique, auto-exécutable, sans `import`/`export`.

```
dist/
  app.bundle.iife.js        ← runtime Bonsai + tous les composants de l'application
  app.bundle.iife.js.map
```

**Pipeline** :
```
TypeScript sources
  → tsc (transpilation + vérification)
  → bundler (Rollup/esbuild — agrégation + IIFE wrap)
  → dist/app.bundle.iife.js
```

> **Note** : en Mode IIFE, **aucun `.d.ts` n'est nécessaire** — tout est dans le bundle, il n'y a pas de consommateur externe. Le bundle est l'application finale, pas une bibliothèque.

**`tsconfig` de référence (Mode IIFE)** :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",          // tsc produit de l'ESM, le bundler fait la conversion IIFE
    "moduleResolution": "bundler",
    "declaration": false,        // pas de .d.ts en Mode IIFE
    "outDir": "./dist"
  }
}
```

---

#### Mode B — ESM Modulaire

**Sortie** : un fichier `.esm.js` par module source, accompagné de son `.d.ts`.

```
dist/
  modules/
    cart/
      cart.feature.esm.js
      cart.feature.d.ts
      cart.feature.esm.js.map
    user/
      user.feature.esm.js
      user.feature.d.ts
      user.feature.esm.js.map
  bootstrap.esm.js
  bootstrap.d.ts
```

**Pipeline** :
```
TypeScript sources
  → tsc --declaration --declarationMap --module NodeNext
  → (optionnel) tsc-alias pour résoudre les path aliases TypeScript
  → dist/modules/**/*.esm.js + dist/modules/**/*.d.ts
```

**`tsconfig` de référence (Mode ESM)** :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",        // génère des imports ESM avec extensions .js
    "moduleResolution": "NodeNext",
    "declaration": true,         // ← obligatoire — génère les .d.ts
    "declarationMap": true,      // ← recommandé — lie .d.ts aux sources .ts pour "Go to definition"
    "sourceMap": true,
    "outDir": "./dist"
  }
}
```

> **Règle** : `declaration: true` est **non optionnel** en Mode ESM. L'outil de build Bonsai refuse de produire un artefact ESM sans `.d.ts` (erreur bloquante, pas un warning).

**Import côté consommateur TypeScript** :

```typescript
// Le consommateur TypeScript importe le .js — TypeScript résout le .d.ts automatiquement
// (résolution TypeScript : .js → cherche .d.ts du même nom)
import { CartFeature } from '/modules/cart/cart.feature.esm.js';
//                                                          ^^^ .js dans l'import
// TypeScript trouve automatiquement cart.feature.d.ts → IntelliSense complet ✅

// ✅ — Le type CartFeature est pleinement résolu
// ✅ — Les erreurs de type sont détectées à la compilation
// ✅ — "Go to definition" pointe vers la source TypeScript (si declarationMap: true)
```

```typescript
// ❌ Anti-pattern — importer le .ts directement depuis un module ESM chargé par le navigateur
import { CartFeature } from '/modules/cart/cart.feature.ts';
// Le navigateur ne connaît pas TypeScript — ce module ne peut pas être chargé nativement
```

---

### Règles de nommage des fichiers

| Type | Convention | Exemple |
|------|-----------|---------|
| Module ESM navigateur | `{nom}.esm.js` | `cart.feature.esm.js` |
| Déclaration TypeScript | `{nom}.d.ts` | `cart.feature.d.ts` |
| Source map déclaration | `{nom}.d.ts.map` | `cart.feature.d.ts.map` |
| Source map JS | `{nom}.esm.js.map` | `cart.feature.esm.js.map` |
| Runtime Bonsai ESM | `bonsai.esm.js` | — |
| Runtime Bonsai IIFE | `bonsai.iife.js` | — |
| Bundle IIFE applicatif | `{app}.bundle.iife.js` | `app.bundle.iife.js` |

> **Suffixe `.esm.js`** : le suffixe `.esm` est intentionnel — il distingue visuellement un module ESM navigateur d'un module CommonJS ou d'un bundle. Il n'est pas une convention Node.js (qui utilise `.mjs`) mais une convention Bonsai pour les artefacts navigateur.

---

### Outillage Bonsai — CLI `bonsai build`

Bonsai expose une commande de build CLI qui encapsule la configuration `tsc` et les outils nécessaires :

```bash
# Mode ESM — produit .esm.js + .d.ts par module source
bonsai build --mode=esm --src=src/ --out=dist/

# Mode IIFE — produit un bundle unique
bonsai build --mode=iife --entry=src/bootstrap.ts --out=dist/app.bundle.iife.js

# Vérification seulement (pas d'artefacts — CI / pre-commit)
bonsai build --check
```

**Garanties du `bonsai build --mode=esm`** :

| Garantie | Description |
|----------|-------------|
| **`.d.ts` systématiques** | Chaque `.esm.js` produit est accompagné de son `.d.ts`. Si `tsc` échoue à générer un `.d.ts`, le build échoue. |
| **Extensions `.js` dans les imports** | Les imports TypeScript `./cart.feature` sont réécrits en `./cart.feature.js` dans la sortie (compatibilité ESM natif). |
| **Résolution des path aliases** | Les alias TypeScript (`@bonsai/*`, `~/*`) sont résolus vers des chemins relatifs dans les artefacts de sortie. |
| **Vérification de type stricte** | `strict: true`, `noImplicitAny`, `strictNullChecks` — aucun artefact produit si la vérification échoue. |
| **Source maps cohérentes** | `.js.map` et `.d.ts.map` pointent vers les sources TypeScript originales. |

> **Note d'implémentation** : `bonsai build` est un wrapper fin autour de `tsc`. Il ne réinvente pas la compilation TypeScript — il garantit les options correctes et valide les artefacts produits. Le Mode IIFE peut utiliser `esbuild` ou `Rollup` comme bundler interne, mais ce choix est **opaque pour le développeur** qui n'utilise que `bonsai build`.

---

## Questions ouvertes

### QO-ESM-1 — Ordre de chargement et `BonsaiRegistry.collect()` 🟢 Stabilisé

> Résolu ci-dessus : ordre HTML spec pour les modules statiques ; `await import()` explicite pour le lazy-loading. Le bootstrap ESM déclare `bootstrap.esm.js` en dernier dans le HTML.

### QO-ESM-2 — `registerComposerInjection` et N-instances (I37) 🟢 Délégué à ADR-0020

> Le cas « plusieurs modules injectent dans le même slot » est couvert par ADR-0020 (sémantique N-instances de `get composers()`). En mode ESM, un module peut enregistrer un `Composer` dans `BonsaiRegistry.registerComposer()` ; la View hôte utilise ce constructeur dans son `get composers()`. La sélection (quelle View pour quel contexte) reste du ressort du Composer — D21 respecté.

### QO-ESM-3 — Nature de `BonsaiRegistry` 🟢 Stabilisé

> `BonsaiRegistry` est un **composant runtime** (singleton exporté par `bonsai.esm.js`), pas une convention d'usage. Sa nature est assumée et documentée.

---

## Conséquences

### Nouveaux éléments

| Élément | Description |
|---------|-------------|
| **`BonsaiRegistry`** | Singleton runtime — `registerFeature()`, `registerView()`, `registerComposer()`, `registerBehavior()`, `collect()`, `reset()` (test) |
| **Convention de module ESM** | Top-level `BonsaiRegistry.register*()`, pas de side-effect métier (C3) |
| **Pattern bootstrap ESM** | `collect → register × N → start` — pré-étape avant la séquence ADR-0010 |
| **`bonsai.esm.js` + `bonsai.d.ts`** | Artefacts du runtime en mode ESM — le `.d.ts` est obligatoire (C7) |
| **`bonsai.iife.js`** | Artefact du runtime en mode IIFE — pas de `.d.ts` (bundle applicatif final) |
| **`bonsai build --mode=esm\|iife`** | CLI de build Bonsai — encapsule `tsc` + toolchain, garantit `.d.ts` systématiques en mode ESM (C8) |

### Invariants impactés

| Invariant | Impact |
|-----------|--------|
| **D6** | Complété — `register()` peut être appelé N fois consécutives (collecte ESM), puis `start()` une seule fois. La contrainte `register → start` reste valide. |
| **D9** | Renforcé — les imports dynamiques (`import()`) en mode ESM sont **explicites et audités** ; les modules ne peuvent pas avoir de side-effects métier à l'import (C3). |
| **I21** | Inchangé — `BonsaiRegistry.registerFeature()` vérifie les namespaces à la déclaration (avant `app.register()`). Collision → `BonsaiRegistryError` immédiate. |

### Fichiers impactés

| Fichier | Impact |
|---------|--------|
| [RFC-0002 §7 Application](../rfc/6-transversal/conventions-typage.md#7-application) | Ajout de l'API `BonsaiRegistry` (register*, collect) |
| [RFC-0001-glossaire](../rfc/reference/glossaire.md) | Ajout définitions : « Mode ESM Modulaire », « BonsaiRegistry », « Module ESM Bonsai », « artefact `.d.ts` » |
| [ADR-0010](ADR-0010-bootstrap-order.md) | Note de compatibilité : pré-étape ESM (collect) avant phase 1 |
| [FRAMEWORK-STYLE-GUIDE](../guides/FRAMEWORK-STYLE-GUIDE.md) | Convention de déclaration des modules ESM + convention nommage artefacts |
| [lib/BUILD.md](../../lib/BUILD.md) | Référence vers ADR-0019 pour le contrat des artefacts — BUILD.md documente l'implémentation, ADR-0019 documente le contrat |

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-01 | Création — issu de Partie I de [`reflexion-2026-03-30.md`](../archive/explorations/reflexion-2026-03-30.md#partie-i--mode-esm-modulaire-et-mode-bundle-iife). Numéro ADR-0019 (anciennement occupé par l'ADR Extension Points, renommée ADR-0021). QO-ESM-1 et QO-ESM-3 stabilisées dans ce document. QO-ESM-2 déléguée à ADR-0020. |
| 2026-04-01 | Ajout contraintes C7 (`.d.ts` obligatoire) et C8 (outillage de build officiel). Ajout §8 : artefacts de distribution, deux modes de build (IIFE vs ESM+`.d.ts`), `tsconfig` de référence, règles de nommage, CLI `bonsai build`. Passage en Accepted. |
