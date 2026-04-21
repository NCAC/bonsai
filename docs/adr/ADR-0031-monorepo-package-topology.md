# ADR-0031 : Topologie des packages du monorepo — répartition des composants

| Champ         | Valeur                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------ |
| **Statut**    | 🟢 Accepted                                                                                      |
| **Date**      | 2026-04-10                                                                                       |
| **Décideurs** | @ncac                                                                                            |
| **RFC liée**  | RFC 2-architecture (taxonomie 10 composants), RFC 2-architecture/distribution (mode IIFE vs ESM) |

---

## Contexte

Bonsai est un monorepo pnpm contenant des packages internes (`packages/*`) et un module core (`core/`). Les RFCs définissent **10 composants** organisés en 2 couches conceptuelles, mais aucun document ne formalise **où chaque composant vit physiquement** dans le monorepo.

### L'incohérence actuelle

Trois conventions d'import coexistent sans arbitrage :

| Convention              | Exemple                                   | Source                                   |
| ----------------------- | ----------------------------------------- | ---------------------------------------- |
| Package npm `@bonsai/*` | `import { Channel } from "@bonsai/event"` | `packages/event/package.json`            |
| Package npm sans scope  | `import { ... } from "bonsai"`            | `core/package.json` (`"name": "bonsai"`) |
| Alias test `@core/*`    | `import { Entity } from "@core/bonsai"`   | `tsconfig.test.json` (`paths`)           |

La RFC distribution.md montre pourtant `import { Application } from '@bonsai/core'` — un nom de package qui n'existe nulle part dans le code source.

### Pourquoi trancher maintenant

L'implémentation strate 0 (ADR-0028) démarre. Les 6 composants à implémenter (Entity, Feature, View, Composer, Foundation, Application) doivent être créés dans des fichiers physiques. Chaque test unitaire commence par un `import { ... } from "???"`. **La topologie conditionne la DX d'import** — elle doit être décidée avant la première ligne de code.

---

## Contraintes

### Contraintes architecturales

- **C1 — 2 couches RFC** : les 10 composants sont répartis en couche abstraite (Application, Feature, Entity, Router, Channel, Radio) et couche concrète (Foundation, Composer, View, Behavior). Cette distinction conceptuelle doit être reflétée ou au minimum ne pas être contredite par la topologie physique.

- **C2 — Topologie indépendante du mode de distribution** : le mode IIFE (bundle unique) et le mode ESM modulaire (ADR-0019, OUT de v1 par ADR-0029) consomment les mêmes imports source. La différence IIFE/ESM est un choix de build pipeline, pas de structure packages. La topologie ne doit favoriser ni être couplée à aucun des deux modes.

- **C3 — Rupture avec l'héritage marionext** : `packages/event/` et `packages/types/` contiennent du code commité hérité de marionext (portage Backbone/Marionette). **Ce code est considéré comme nul et non avenu.** L'emplacement `packages/*/` est le bon (précédent validé pour la topologie), mais le contenu sera **réécrit de zéro** selon les spécifications RFC/ADR actuelles. Aucune API, aucune classe, aucune convention de l'existant marionext ne contraint les choix d'implémentation strate 0.

- **C4 — Monorepo pnpm workspace** : les packages internes se référencent via `workspace:^`. Le build et les tests doivent résoudre les imports sans étapes manuelles.

### Contraintes DX

- **C5 — Import unique pour le développeur** : un développeur d'application Bonsai ne devrait avoir qu'un seul import à connaître pour les composants framework. `import { Feature, View, Entity } from "@bonsai/???"` — pas 5 packages différents à mémoriser.

- **C6 — IntelliSense complet** : l'import doit permettre l'auto-complétion de tous les composants et types du framework, y compris les generics contraints.

- **C7 — Tests unitaires par composant** : chaque composant doit être testable en isolation, avec des imports directs vers la source (pas via un barrel compilé).

---

## Options considérées

### Option A — Flat `core/src/` avec barrel `@bonsai/core`

Tous les composants Bonsai vivent dans `core/src/`, organisés en fichiers individuels. Un barrel unique `core/src/bonsai.ts` ré-exporte tout. Le package est renommé `@bonsai/core`.

**Structure physique :**

```
core/
  package.json                    → "@bonsai/core"
  src/
    bonsai.ts                     → barrel (ré-exporte tout)
    application.class.ts
    entity.class.ts
    feature.class.ts
    foundation.class.ts
    composer.class.ts
    view.class.ts
    behavior.class.ts
    router.class.ts

packages/
  event/                          → "@bonsai/event"
    src/
      radio.singleton.ts
      channel.class.ts
      Event-trigger.class.ts
```

**Import développeur :**

```typescript
// Application Bonsai — le développeur n'a qu'un import à connaître
import { Application, Feature, Entity, View, Composer } from "@bonsai/core";

// L'infrastructure Channel est ré-exportée par @bonsai/core
// mais reste physiquement dans @bonsai/event
import { Channel } from "@bonsai/core"; // via re-export
```

**Import test unitaire :**

```typescript
// Test isolé d'un composant — import direct vers la source
import { Entity } from "@bonsai/core"; // résolu par moduleNameMapper → core/src/bonsai.ts

// Ou import ciblé si on veut éviter le barrel :
// jest moduleNameMapper: "^@bonsai/core/(.*)$" → "<rootDir>/core/src/$1"
import { Entity } from "@bonsai/core/entity.class";
```

| Avantages                                            | Inconvénients                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| + Un seul import pour tout le framework              | - `core/src/` devient un fourre-tout (8+ fichiers de classes)         |
| + Conforme à la RFC distribution.md (`@bonsai/core`) | - Pas de séparation physique abstraite/concrète                       |
| + Zéro package supplémentaire                        | - Le barrel ré-exporte des dépendances transitives (@bonsai/event)    |
| + Tests et build simples                             | - Granularité insuffisante pour un futur tree-shaking ESM             |
| + Pas de dépendances circulaires                     | - Difficult de tester un composant concret sans charger les abstraits |

---

### Option B — Deux packages par couche : `@bonsai/core` + `@bonsai/dom`

Les composants sont répartis en 2 packages miroir des 2 couches RFC.

**Structure physique :**

```
core/
  package.json                    → "@bonsai/core"
  src/
    bonsai.ts                     → barrel couche abstraite
    application.class.ts
    entity.class.ts
    feature.class.ts
    router.class.ts

dom/                              ← nouveau dossier
  package.json                    → "@bonsai/dom"
  src/
    bonsai-dom.ts                 → barrel couche concrète
    foundation.class.ts
    composer.class.ts
    view.class.ts
    behavior.class.ts

packages/
  event/                          → "@bonsai/event"
```

**Import développeur :**

```typescript
import { Application, Feature, Entity } from "@bonsai/core";
import { Foundation, Composer, View, Behavior } from "@bonsai/dom";
```

| Avantages                                          | Inconvénients                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| + Miroir fidèle de l'architecture 2 couches        | - **2 imports à mémoriser** — viole C5                                            |
| + Séparation physique abstraite/concrète           | - `@bonsai/dom` dépend de `@bonsai/core` (View a besoin d'Entity)                 |
| + Composants concrets testables sans les abstraits | - Composer a besoin de View ET de Feature → dépendance croisée                    |
| + Prépare le tree-shaking ESM                      | - Un dossier `dom/` au même niveau que `core/` et `packages/` alourdit la racine  |
| + Frontières claires                               | - Le développeur doit savoir qu'Entity est "abstraite" pour trouver le bon import |

---

### Option C — Package unique `@bonsai/core` avec sous-dossiers par couche

Les composants vivent dans `core/src/` mais organisés en sous-dossiers miroir des couches RFC. Un barrel unique ré-exporte tout. Le nom de package est `@bonsai/core`.

**Structure physique :**

```
core/
  package.json                    → "@bonsai/core"
  src/
    bonsai.ts                     → barrel (ré-exporte abstract/ + concrete/)
    abstract/
      index.ts                    → barrel de la couche abstraite
      application.class.ts
      entity.class.ts
      feature.class.ts
      router.class.ts
    concrete/
      index.ts                    → barrel de la couche concrète
      foundation.class.ts
      composer.class.ts
      view.class.ts
      behavior.class.ts

packages/
  event/                          → "@bonsai/event"
```

**Import développeur :**

```typescript
// Import principal — tout le framework, une seule ligne
import { Application, Feature, Entity, View, Composer } from "@bonsai/core";

// Import ciblé optionnel (DX avancée, tree-shaking futur)
import { Entity } from "@bonsai/core/abstract";
import { View } from "@bonsai/core/concrete";
```

**Import test unitaire :**

```typescript
// Test ciblé — n'importe que la couche nécessaire
import { Entity } from "@bonsai/core/abstract";
// ou via le barrel complet :
import { Entity } from "@bonsai/core";
```

| Avantages                                    | Inconvénients                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| + Un seul import pour le développeur (C5 ✅) | - Sous-exports `@bonsai/core/abstract` et `/concrete` à configurer dans package.json `exports` |
| + Organisation interne reflète les 2 couches | - Complexité marginale du build (exports map)                                                  |
| + Prépare le split ESM sans casser la DX     | - Le développeur _peut_ importer de `/abstract` — est-ce qu'on le veut ?                       |
| + Tests isolables par couche                 | - Nommage `abstract/concrete` visible dans l'arborescence source (bien ou mal ?)               |
| + Conforme à la RFC distribution.md          | - Trois niveaux de dossiers (`core/src/abstract/entity.class.ts`)                              |

---

### Option D — Un package par composant (`@bonsai/entity`, `@bonsai/feature`, …)

Chaque composant framework est un package pnpm indépendant dans `packages/`. Les dépendances inter-composants sont explicites dans chaque `package.json`. Un méta-package `@bonsai/core` (barrel pur) ré-exporte tout pour la DX applicative.

**Structure physique :**

```
packages/
  types/                          → "@bonsai/types"     (types cross-packages : TJsonValue, TConstructor, TNullish — nettoyé, legacy marionext purgé)
  error/                          → "@bonsai/error"     (BonsaiError, taxonomie ADR-0002, invariant(), hardInvariant())
    package.json                     deps: @bonsai/types
    src/
      bonsai-error.ts            → barrel
      bonsai-error.class.ts      → hiérarchie BonsaiError
      invariant.ts               → invariant(), hardInvariant(), warning()
  event/                          → "@bonsai/event"     (Radio, Channel — réécriture depuis zéro, legacy marionext abandonné)
    package.json                     deps: @bonsai/types, @bonsai/error
  entity/                         → "@bonsai/entity"
    package.json                     deps: @bonsai/types, @bonsai/error
    src/
      entity.class.ts
      bonsai-entity.ts            → barrel
  feature/                        → "@bonsai/feature"
    package.json                     deps: @bonsai/entity, @bonsai/event, @bonsai/error
    src/
      feature.class.ts
      bonsai-feature.ts           → barrel
  behavior/                       → "@bonsai/behavior"
    package.json                     deps: @bonsai/event, @bonsai/types, @bonsai/error
    src/
      behavior.class.ts
      bonsai-behavior.ts          → barrel
  view/                           → "@bonsai/view"
    package.json                     deps: @bonsai/event, @bonsai/behavior, @bonsai/error
    src/
      view.class.ts
      bonsai-view.ts              → barrel
  composer/                       → "@bonsai/composer"
    package.json                     deps: @bonsai/event, @bonsai/view, @bonsai/error
    src/
      composer.class.ts
      bonsai-composer.ts          → barrel
  foundation/                     → "@bonsai/foundation"
    package.json                     deps: @bonsai/event, @bonsai/composer, @bonsai/error
    src/
      foundation.class.ts
      bonsai-foundation.ts        → barrel
  application/                    → "@bonsai/application"
    package.json                     deps: @bonsai/feature, @bonsai/entity,
                                           @bonsai/event, @bonsai/view,
                                           @bonsai/composer, @bonsai/foundation,
                                           @bonsai/error
    src/
      application.class.ts
      bonsai-application.ts       → barrel

core/                             → "@bonsai/core"  (méta-package — barrel pur)
  package.json                       deps: tous les @bonsai/* ci-dessus
  src/
    bonsai.ts                     → re-export * from chaque package
```

**Graphe de dépendances (DAG pur, zéro cycle) :**

```
                    @bonsai/types           ← types primitifs cross-packages
                    ╱     │     ╲
           @bonsai/error   │      │            ← BonsaiError, invariant(), hardInvariant()
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
 @bonsai/application  ← orchestre tout
        │
  @bonsai/core        ← méta-package (barrel pur, zéro code propre)
```

> **`@bonsai/error` est une dépendance de quasi tout le graphe** : chaque composant
> qui valide un invariant, émet un diagnostic ou throw une `BonsaiError` structurée
> en dépend. C'est le second socle après `@bonsai/types`.

**Import développeur :**

```typescript
// DX applicative — barrel unifié, exactement comme Option A/C
import { Application, Feature, Entity, View, Composer } from "@bonsai/core";

// OU import direct depuis le package du composant (granulaire, tree-shakable)
import { Entity } from "@bonsai/entity";
import { Feature } from "@bonsai/feature";
import { View } from "@bonsai/view";
```

**Import test unitaire :**

```typescript
// Test unitaire — import direct vers le package du composant testé
// Charge UNIQUEMENT Entity et ses dépendances (types), rien d'autre
import { Entity } from "@bonsai/entity";

// Test intégration — barrel complet si nécessaire
import { Feature, Entity, Application } from "@bonsai/core";
```

**package.json de `@bonsai/entity` (exemple) :**

```jsonc
{
  "name": "@bonsai/entity",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "src": "./src/bonsai-entity.ts",
  "main": "./dist/bonsai-entity.js",
  "types": "./dist/bonsai-entity.d.ts",
  "dependencies": {
    "@bonsai/types": "workspace:^",
    "@bonsai/error": "workspace:^"
  }
}
```

**jest.config.ts moduleNameMapper :**

```typescript
moduleNameMapper: {
  // Chaque package résout vers sa source
  "^@bonsai/entity$":      "<rootDir>/packages/entity/src/bonsai-entity.ts",
  "^@bonsai/feature$":     "<rootDir>/packages/feature/src/bonsai-feature.ts",
  "^@bonsai/view$":        "<rootDir>/packages/view/src/bonsai-view.ts",
  "^@bonsai/composer$":    "<rootDir>/packages/composer/src/bonsai-composer.ts",
  "^@bonsai/foundation$":  "<rootDir>/packages/foundation/src/bonsai-foundation.ts",
  "^@bonsai/application$": "<rootDir>/packages/application/src/bonsai-application.ts",
  "^@bonsai/behavior$":    "<rootDir>/packages/behavior/src/bonsai-behavior.ts",
  "^@bonsai/error$":       "<rootDir>/packages/error/src/bonsai-error.ts",
  "^@bonsai/event$":       "<rootDir>/packages/event/src/bonsai-event.ts",
  "^@bonsai/types$":       "<rootDir>/packages/types/index.d.ts",
  // Méta-package barrel
  "^@bonsai/core$":        "<rootDir>/core/src/bonsai.ts",
}
```

| Avantages                                                                                                                                                                 | Inconvénients                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| + **Le compilateur TS garantit les frontières architecturales** — si `@bonsai/view` n'a pas `@bonsai/entity` dans ses deps, l'import est impossible. Prouve I30 au build. | - 8 `package.json` + 8 `tsconfig.json` supplémentaires (boilerplate)                     |
| + **Isolation de test maximale** — chaque test charge uniquement le composant et ses deps                                                                                 | - Plus de fichiers de configuration à maintenir                                          |
| + **DAG de dépendances explicite** — vérifiable par `pnpm ls`, visible dans chaque `package.json`                                                                         | - Déplacer un type partagé entre packages = modifier les deps                            |
| + **Chaque package est un module autonome** — frontière physique = frontière logique                                                                                      | - Le dev Bonsai interne doit ajouter une dep quand il crée un lien inter-composant       |
| + **Conforme au pattern `@bonsai/event` existant** — même convention, même structure                                                                                      | - Risque de divergence si un package évolue sans les autres (mitigé : private, monorepo) |
| + **`@bonsai/core` barrel conserve la DX unifiée** (C5 ✅)                                                                                                                | -                                                                                        |
| + **Compile-time > Runtime** — philosophie Bonsai appliquée aux frontières de packages                                                                                    | -                                                                                        |

---

## Analyse comparative

| Critère                        | A — Flat                 | B — 2 packages     | C — Sous-dossiers                     | D — Par composant                              |
| ------------------------------ | ------------------------ | ------------------ | ------------------------------------- | ---------------------------------------------- |
| **DX import appli** (C5)       | ⭐⭐⭐ un seul           | ⭐⭐ deux          | ⭐⭐⭐ un seul                        | ⭐⭐⭐ un seul via barrel                      |
| **DX import test** (C7)        | ⭐⭐ barrel only         | ⭐⭐ deux packages | ⭐⭐ sous-dossier                     | ⭐⭐⭐ package exact                           |
| **Miroir architecture RFC**    | ⭐ aucune structure      | ⭐⭐⭐ exact       | ⭐⭐⭐ exact (interne)                | ⭐⭐⭐ chaque composant = module               |
| **Frontières compilateur**     | ⭐ aucune                | ⭐⭐ 2 frontières  | ⭐ aucune (sous-dossiers ≠ frontière) | ⭐⭐⭐ **TS + pnpm vérifient**                 |
| **Simplicité build**           | ⭐⭐⭐ trivial           | ⭐⭐ deps inter    | ⭐⭐ exports map                      | ⭐⭐ N package.json (mais pattern identique)   |
| **Testabilité isolation**      | ⭐⭐ tout via barrel     | ⭐⭐⭐ par package | ⭐⭐ sous-dossier (pas de frontière)  | ⭐⭐⭐ par package — charge minimale           |
| **Compile-time > Runtime**     | ⭐ convention seule      | ⭐⭐ 2 frontières  | ⭐ convention seule                   | ⭐⭐⭐ **philosophie Bonsai**                  |
| **Cohérence pattern monorepo** | ⭐ event est l'exception | ⭐⭐ event + dom   | ⭐ event reste l'exception            | ⭐⭐⭐ **même pattern partout**                |
| **Boilerplate monorepo**       | ⭐⭐⭐ 1 package         | ⭐⭐ 2 packages    | ⭐⭐⭐ 1 package                      | ⭐⭐ 8+ packages (mitigé : template identique) |

---

## Décision

Nous choisissons **Option D — Un package par composant** parce que :

1. **Le compilateur garantit les invariants architecturaux.** Si `@bonsai/view` n'a pas `@bonsai/entity` dans ses dépendances, il est _physiquement impossible_ d'importer Entity depuis une View. Cela prouve I30 (View sans domain state), I5/I6 (encapsulation Entity), I44 (Behavior aveugle) **au build-time**, pas par convention documentaire. C'est la philosophie Bonsai — **compile-time > runtime** — appliquée à la structure même du projet.

2. **La DX applicative est préservée.** Le méta-package `@bonsai/core` (barrel pur) ré-exporte tous les composants. Le développeur d'application tape `import { Feature, View, Entity } from "@bonsai/core"` — un seul import, comme dans les Options A et C. La contrainte C5 est respectée.

3. **La DX de test est améliorée.** Chaque test unitaire importe depuis le package exact du composant testé : `import { Entity } from "@bonsai/entity"`. Cela charge le minimum nécessaire, rend les dépendances du test explicites, et prouve que le composant fonctionne dans ses frontières déclarées.

4. **Cohérence monorepo totale.** Chaque composant framework suit la même convention structurelle : un package dédié, ses propres dépendances, son propre barrel. L'Option D généralise ce pattern à tous les composants. `@bonsai/event` et `@bonsai/types` seront réécrits dans ce même cadre — leur emplacement valide le pattern, même si leur contenu actuel est abandonné.

5. **Le DAG de dépendances est explicite et vérifiable.** Chaque `package.json` déclare exactement ses dépendances. `pnpm ls --depth 1` affiche le graphe réel. Il n'y a aucun cycle (vérifié : le graphe est un DAG pur). C'est de l'architecture lisible dans le gestionnaire de packages — pas dans un diagramme Mermaid qu'on oublie de mettre à jour.

6. **La topologie est indépendante du mode de distribution.** Le mode IIFE (bundler → un fichier unique) et le mode ESM (N fichiers `*.esm.js` → `<script type="module">`) consomment les **mêmes imports source**. La différence est un paramètre de build pipeline, pas de structure packages. L'Option D ne favorise ni ne défavorise aucun des deux modes — et c'est une qualité : la topologie source ne doit pas être couplée à la stratégie de distribution.

### Rejet des autres options

**Rejet de l'Option A (Flat)** : aucune structure interne, aucune frontière. Quand `core/src/` contient 8+ classes, rien n'empêche un développeur du framework d'importer Entity depuis View.class.ts par erreur. L'architecture repose sur la discipline, pas sur le compilateur.

**Rejet de l'Option B (2 packages)** : compromis intermédiaire qui n'apporte ni la simplicité de A ni la granularité de D. Les dépendances croisées (Composer → Feature + View) compliquent le graphe sans gagner la preuve compile-time par composant.

**Rejet de l'Option C (Sous-dossiers)** : les sous-dossiers `abstract/` et `concrete/` donnent une illusion de structure, mais **les sous-dossiers ne sont pas des frontières TypeScript**. Rien n'empêche `concrete/view.class.ts` d'importer `abstract/entity.class.ts` car ils sont dans le même package. L'invariant I30 n'est prouvé que par convention, pas par le compilateur. C'est insuffisant pour Bonsai.

### Clarifications associées

#### `@bonsai/core` = méta-package barrel pur

`@bonsai/core` ne contient **aucun code propre** — c'est un fichier barrel qui ré-exporte les symboles publics de chaque package composant. Son `package.json` dépend de tous les `@bonsai/*`. Le développeur d'application n'a jamais besoin de connaître la topologie interne.

```typescript
// core/src/bonsai.ts — méta-package barrel

// Socle transversal
export type {
  TJsonValue,
  TJsonObject,
  TJsonPrimitive,
  TConstructor
} from "@bonsai/types";
export { BonsaiError, invariant, hardInvariant } from "@bonsai/error";

// Couche abstraite
export { Entity } from "@bonsai/entity";
export type { TEntityStructure } from "@bonsai/entity";
export { Feature } from "@bonsai/feature";
export type { TChannelDefinition, declareChannel } from "@bonsai/event";
export { Radio, Channel } from "@bonsai/event";

// Couche concrète
export { View } from "@bonsai/view";
export { Composer } from "@bonsai/composer";
export { Foundation } from "@bonsai/foundation";
export { Behavior } from "@bonsai/behavior";
export { Application } from "@bonsai/application";
```

#### Renommage du package `core/`

Le `core/package.json` passe de `"name": "bonsai"` à `"name": "@bonsai/core"`.

#### `@bonsai/event` et `@bonsai/types` — réécriture depuis zéro

Les packages `packages/event/` et `packages/types/` contiennent du code commité issu d'un portage marionext (legacy Backbone/Marionette). **Ce contenu est intégralement rejeté.** On repart de zéro.

Concrètement :

- L'**emplacement** (`packages/event/` → `@bonsai/event`, `packages/types/` → `@bonsai/types`) est conservé — conforme à l'Option D
- Le **contenu** (classes, types, barrels) sera **supprimé et réécrit** selon les spécifications RFC/ADR actuelles
- Aucune API marionext (`EventTrigger`, `Channel.request()` async, constructeur `Radio` public, types utilitaires hérités) n'est reprise
- Les tests existants référençant l'ancienne API (`tests/unit/channel.class.test.ts`, `tests/unit/radio.singleton.test.ts`) sont obsolètes — les tests strate-0 les remplacent

**Le fait qu'un fichier soit commité ne lui confère aucun statut d'immutabilité ni de conformité architecturale.**

#### `@bonsai/types` — périmètre post-nettoyage

`@bonsai/types` est un package **types-only** (`.d.ts`, pas de runtime). Son rôle est de fournir les **types primitifs cross-packages** utilisés comme contrats transversaux entre ≥2 composants Bonsai distincts.

**Critère d'appartenance** : un type vit dans `@bonsai/types` si et seulement si :

1. Il est utilisé par ≥2 packages Bonsai distincts comme contrat d'interface, ET
2. Il ne peut pas être inliné dans un package consommateur sans créer une dépendance circulaire

**Types conservés :**

| Type                                                        | Justification                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `TJsonValue`, `TJsonObject`, `TJsonArray`, `TJsonPrimitive` | Contrainte state Entity (D10), payload Channel — cross Entity/Event/Feature |
| `TConstructor`, `TClass`                                    | `Application.register()`, factories — cross Application/Feature             |
| `TNullish`, `TNonUndefined`                                 | Types de garde basiques transversaux                                        |
| `AnyFunction` (renommé `TFunction`)                         | Handlers Channel, callbacks génériques                                      |
| `TParameters`                                               | Utilitaire générique handlers                                               |

**Types supprimés** (fork type-fest/utility-types/lodash, aucun consommateur Bonsai identifié) :
`TuplifyUnion`, `StrictArrayOfValues`, `StrictArrayOfKeys`, `MutableKeys`, `RequiredKeys`, `OptionalKeys`, `PickByValue`, `PickByValueExact`, `TPropertyNameByType`, `TFunctionPropertyNames`, `TNonFunctionPropertyNames`, `TOneLetter`, `StringDigit`, `Whitespace`, `StringHash`, `TNumericDictionary`, `TDictionaryValue`, `Entry`, `TEntries`, `AlwaysParameters`, `type-fest-empty-object.d.ts` (doublon).

**Moment du nettoyage** : immédiatement avant le milestone Feature (quand `TChannelDefinition` et `TCommandMap` devront y atterrir). Le milestone Channel/Radio ne nécessite que `TJsonValue` et `AnyFunction`, qui existent déjà.

#### `@bonsai/error` — nouveau package fondation

`@bonsai/error` est un **nouveau package** qui centralise l'infrastructure d'erreurs et de validation du framework. Il implémente la taxonomie définie par [ADR-0002](ADR-0002-error-propagation-strategy.md) et les modes de validation de [ADR-0004](ADR-0004-validation-modes.md).

**Contenu :**

| Export                                                                                                                                              | Rôle                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BonsaiError` (classe de base)                                                                                                                      | Erreur structurée avec `invariantId`, `component`, `suggestion`. Toutes les erreurs framework en héritent. |
| Sous-classes : `MutationError`, `CommandError`, `RequestError`, `ListenerError`, `NoHandlerError`, `RenderError`, `BehaviorError`, `BroadcastError` | Taxonomie ADR-0002 — une classe par catégorie                                                              |
| `invariant(condition, message, invariantId)`                                                                                                        | Assertion runtime — throw `BonsaiError` si condition fausse. Strippable en prod via `__DEV__` (ADR-0004).  |
| `hardInvariant(condition, message, invariantId)`                                                                                                    | Assertion **non-strippable** — erreurs structurelles fatales (bootstrap, I21, I10…). Reste en prod.        |
| `warning(condition, message)`                                                                                                                       | Log conditionnel `__DEV__` only — ne throw jamais.                                                         |

**Pourquoi un package séparé et pas dans `@bonsai/types` ou `@bonsai/event` :**

- `@bonsai/types` est types-only, pas de runtime — or `invariant()` et `BonsaiError` sont du code runtime
- `@bonsai/event` est trop spécifique — `BonsaiError` est utilisé par Entity, Feature, View, Application…
- Un package dédié permet à **tout le graphe** d'en dépendre sans cycle, car `@bonsai/error` ne dépend que de `@bonsai/types`

**Dépendances** : `@bonsai/types` uniquement (pour `TJsonValue` dans les payloads d'erreur).

**Moment de création** : au démarrage du milestone Channel/Radio — les sémantiques runtime Channel (ADR-0003 : throw en dev, warn en prod, `NoHandlerError`) nécessitent `@bonsai/error` immédiatement.

#### Emplacement des packages

Tous les packages composants vivent dans `packages/` — c'est le workspace pnpm existant. Le dossier `core/` reste uniquement pour le méta-package barrel `@bonsai/core`.

#### Convention d'import — deux audiences, deux règles

**Développeur d'application** (consommateur du framework) :

```typescript
// ✅ Toujours importer depuis le méta-package barrel
import { Feature, Entity, View, Composer } from "@bonsai/core";

// ❌ Jamais importer depuis un package interne
import { Entity } from "@bonsai/entity"; // réservé au framework
```

Le développeur d'application ne connaît qu'un seul import : `@bonsai/core`. Il n'a pas à savoir que Entity vit dans `@bonsai/entity` — c'est un détail d'implémentation interne.

**Développeur framework** (nous, code inter-packages) :

```typescript
// ✅ Importer depuis le package du composant — dépendance explicite
import { Entity } from "@bonsai/entity";
import { Feature } from "@bonsai/feature";
import { View } from "@bonsai/view";
import { Channel, Radio } from "@bonsai/event";

// ❌ Interdit — un package framework n'importe JAMAIS depuis @bonsai/core
//    (sinon le barrel crée des dépendances circulaires et masque le DAG)
import { Entity } from "@bonsai/core";

// ❌ Interdit — alias non-standard
import { Entity } from "@core/bonsai";

// ❌ Interdit — chemin relatif
import { Entity } from "../../packages/entity/src/entity.class";
```

**Tests — l'import dépend du niveau de test :**

| Niveau                                 | Objectif                                  | Import                  | Pourquoi                                        |
| -------------------------------------- | ----------------------------------------- | ----------------------- | ----------------------------------------------- |
| **Unit** (`tests/unit/`)               | Prouver le composant en isolation         | `from "@bonsai/entity"` | Valide les frontières du DAG, charge le minimum |
| **Intégration** (`tests/integration/`) | Prouver les interactions inter-composants | `from "@bonsai/core"`   | Teste comme un consommateur, valide le barrel   |
| **E2E** (`tests/e2e/`)                 | Prouver le round-trip complet             | `from "@bonsai/core"`   | Exactement comme le développeur d'application   |

```typescript
// tests/unit/strate-0/entity.basic.test.ts
// ✅ Test unitaire — import direct, prouve que le package est autonome
import { Entity } from "@bonsai/entity";

// tests/integration/strate-0/trigger-handle-mutate-emit.test.ts
// ✅ Test intégration — import barrel, prouve la DX consommateur
import { Feature, Entity, Application } from "@bonsai/core";

// tests/e2e/strate-0.cart-round-trip.test.ts
// ✅ Test E2E — idem, on est le consommateur final
import { Application, Feature, View } from "@bonsai/core";
```

> **Règle simple** : `@bonsai/core` est pour les consommateurs (et les tests qui simulent un consommateur).
> Les packages internes et les tests unitaires importent par nom de package direct.

#### Convention de nommage des fichiers — packages composants framework

Chaque package composant suit un **template structurel identique** :

```
packages/{name}/
  package.json
  tsconfig.json
  src/
    bonsai-{name}.ts              ← barrel (re-exports publics)
    {name}.class.ts               ← classe principale du composant
    types.ts                      ← types publics (optionnel)
```

**Champs `package.json` standardisés :**

```jsonc
{
  "name": "@bonsai/{name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "src": "./src/bonsai-{name}.ts",
  "main": "./dist/bonsai-{name}.js",
  "types": "./dist/bonsai-{name}.d.ts",
  "dependencies": {
    // uniquement les @bonsai/* dont ce composant dépend
  }
}
```

**Tableau récapitulatif :**

| Package               | Barrel source           | Classe principale                        | `main` (dist)                | `types` (dist)                 |
| --------------------- | ----------------------- | ---------------------------------------- | ---------------------------- | ------------------------------ |
| `@bonsai/types`       | `index.d.ts`            | _(types only — pas de runtime)_          | —                            | `index.d.ts`                   |
| `@bonsai/error`       | `bonsai-error.ts`       | `bonsai-error.class.ts`, `invariant.ts`  | `dist/bonsai-error.js`       | `dist/bonsai-error.d.ts`       |
| `@bonsai/entity`      | `bonsai-entity.ts`      | `entity.class.ts`                        | `dist/bonsai-entity.js`      | `dist/bonsai-entity.d.ts`      |
| `@bonsai/feature`     | `bonsai-feature.ts`     | `feature.class.ts`                       | `dist/bonsai-feature.js`     | `dist/bonsai-feature.d.ts`     |
| `@bonsai/event`       | `bonsai-event.ts`       | `radio.singleton.ts`, `channel.class.ts` | `dist/bonsai-event.js`       | `dist/bonsai-event.d.ts`       |
| `@bonsai/view`        | `bonsai-view.ts`        | `view.class.ts`                          | `dist/bonsai-view.js`        | `dist/bonsai-view.d.ts`        |
| `@bonsai/composer`    | `bonsai-composer.ts`    | `composer.class.ts`                      | `dist/bonsai-composer.js`    | `dist/bonsai-composer.d.ts`    |
| `@bonsai/foundation`  | `bonsai-foundation.ts`  | `foundation.class.ts`                    | `dist/bonsai-foundation.js`  | `dist/bonsai-foundation.d.ts`  |
| `@bonsai/behavior`    | `bonsai-behavior.ts`    | `behavior.class.ts`                      | `dist/bonsai-behavior.js`    | `dist/bonsai-behavior.d.ts`    |
| `@bonsai/application` | `bonsai-application.ts` | `application.class.ts`                   | `dist/bonsai-application.js` | `dist/bonsai-application.d.ts` |

> **Wrappers de libs tierces** (`@bonsai/rxjs`, `@bonsai/immer`, `@bonsai/valibot`) conservent leur convention courte (`{name}.ts`) — ce ne sont pas des composants Bonsai.
>
> _Historique 2026-04-21 : `@bonsai/zod` supprimé (remplacé par `@bonsai/valibot` — cf. ADR-0022) ; `@bonsai/remeda` supprimé (utilisé uniquement par `tools/`, pas par le framework — cf. C3 ci-dessous)._

---

## Conséquences

### Positives

- ✅ **Invariants prouvés au build-time** : les frontières de packages garantissent I30, I5/I6, I44 via le compilateur TypeScript et la résolution pnpm. Aucun import interdit ne peut compiler.
- ✅ **DX préservée** : `from "@bonsai/core"` reste le seul import que les développeurs d'application doivent connaître.
- ✅ **Cohérence monorepo** : tous les composants suivent le même pattern — un package, un barrel, ses dépendances explicites. `@bonsai/event` et `@bonsai/types` sont réécrits dans ce cadre, pas hérités.
- ✅ **Tests isolés** : chaque test unitaire charge uniquement le package testé et ses dépendances transitives.
- ✅ **Mode-agnostic** : la topologie source est indépendante du mode de distribution (IIFE vs ESM). Mêmes imports, même structure — seul le build pipeline change.
- ✅ **DAG vérifiable** : `pnpm ls` montre le graphe réel des dépendances.

### Négatives (acceptées)

- ⚠️ **8+ package.json** à maintenir — accepté : template identique, coût marginal ~10 lignes par package. Le monorepo pnpm gère les `workspace:^` automatiquement.
- ⚠️ **8+ tsconfig.json** à maintenir — accepté : chaque tsconfig est minimal (extends tsconfig.base.json + references).
- ⚠️ **Ajouter une dépendance inter-composant = modifier un package.json** — accepté : c'est justement le point. Chaque nouvelle dépendance est un acte conscient et traçable, pas un import accidentel.

### Risques identifiés

- 🔶 **Friction initiale** — créer 6 nouveaux packages avant d'écrire la première ligne de code de composant. Mitigation : c'est un coût unique, ~30 minutes de scaffolding.
- 🔶 **Version sync** — tous les packages sont `private: true` et `0.1.0`, pas de publication npm. Le risque de divergence de versions est nul en monorepo privé.
- 🔶 **Granularité trop fine ?** — si deux composants sont toujours modifiés ensemble, le split est du bruit. Mitigation : le DAG montre que les composants ont des dépendances distinctes (Entity n'a pas besoin de View, View n'a pas besoin d'Entity). Le split est justifié.

---

## Actions de suivi

- [ ] Créer les 6 packages composants dans `packages/` : `entity`, `feature`, `view`, `composer`, `foundation`, `application` — chacun avec `package.json`, `tsconfig.json`, `src/` et barrel
- [ ] Renommer `core/package.json` : `"name": "bonsai"` → `"name": "@bonsai/core"`
- [ ] Transformer `core/src/bonsai.ts` en barrel pur ré-exportant depuis les `@bonsai/*`
- [ ] Mettre à jour `pnpm-workspace.yaml` si nécessaire (vérifier que `packages/*` couvre les nouveaux dossiers)
- [ ] Mettre à jour `jest.config.ts` moduleNameMapper pour tous les `@bonsai/*`
- [ ] Remplacer l'alias `@core/bonsai` par les imports `@bonsai/*` dans `tsconfig.test.json` (paths)
- [ ] Mettre à jour les imports dans tous les tests strate-0
- [ ] Vérifier le DAG avec `pnpm ls --depth 1` après scaffolding
- [ ] Créer le package `@bonsai/error` dans `packages/error/` : `BonsaiError`, taxonomie ADR-0002, `invariant()`, `hardInvariant()`, `warning()` (ADR-0004)
- [ ] Réécrire `@bonsai/event` depuis zéro selon les spécifications RFC/ADR (Radio singleton I15, Channel tri-lane ADR-0023 sync, suppression EventTrigger legacy)
- [ ] Nettoyer `@bonsai/types` — purger les types fork type-fest/utility-types/lodash sans consommateur, ne conserver que les types cross-packages identifiés
- [ ] Supprimer les tests legacy obsolètes (`tests/unit/channel.class.test.ts`, `tests/unit/radio.singleton.test.ts`) — remplacés par les tests strate-0

---

## Références

- [RFC 2-architecture/distribution.md](../rfc/2-architecture/distribution.md) — modes IIFE/ESM, exemples d'import `@bonsai/core`
- [RFC 2-architecture/README.md](../rfc/2-architecture/README.md) — taxonomie 10 composants, 2 couches
- [RFC 3-couche-abstraite/README.md](../rfc/3-couche-abstraite/README.md) — Application, Feature, Entity, Router
- [RFC 4-couche-concrete/README.md](../rfc/4-couche-concrete/README.md) — Foundation, Composer, View, Behavior
- [ADR-0019](ADR-0019-mode-esm-modulaire.md) — Mode ESM modulaire (OUT v1, ADR-0029)
- [ADR-0028](ADR-0028-implementation-phasing-strategy.md) — Stratégie de phasage kernel-first
- [ADR-0029](ADR-0029-v1-scope-freeze.md) — Périmètre gelé v1

---

## Historique

| Date       | Changement                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-10 | Création (Proposed) — motivée par le démarrage de l'implémentation strate 0                                                                                                                                                                                                               |
| 2026-04-10 | Ajout Option D (un package par composant) — retenue comme décision                                                                                                                                                                                                                        |
| 2026-04-10 | **Accepted** — rupture actée avec l'héritage marionext : `@bonsai/event` et `@bonsai/types` réécrits de zéro                                                                                                                                                                              |
| 2026-04-16 | Amendement : ajout `@bonsai/error` (taxonomie ADR-0002, invariant/hardInvariant) comme package fondation dans le DAG. Périmètre post-nettoyage de `@bonsai/types` détaillé (critères d'appartenance, types conservés/supprimés). DAG, barrel, moduleNameMapper et conventions mis à jour. |
