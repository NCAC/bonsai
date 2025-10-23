# ADR-0032 : Build Pipeline — Toolchain, artefacts et stratégie de bundling DTS

> **Comment construire les artefacts du framework Bonsai (`.js` + `.d.ts`) et quel outillage fournir aux développeurs d'applications ?**

| Champ           | Valeur                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**      | 🟡 Proposed                                                                                                                                                                                                                                                                                     |
| **Date**        | 2026-04-14                                                                                                                                                                                                                                                                                      |
| **Décideurs**   | @ncac                                                                                                                                                                                                                                                                                           |
| **RFC liées**   | [Distribution](../rfc/2-architecture/distribution.md) (mode IIFE vs ESM)                                                                                                                                                                                                                        |
| **ADR liées**   | [ADR-0019](ADR-0019-mode-esm-modulaire.md) (ESM Modulaire, CLI `bonsai build`), [ADR-0028](ADR-0028-implementation-phasing-strategy.md) (phasage kernel-first), [ADR-0029](ADR-0029-v1-scope-freeze.md) (scope v1 gelé), [ADR-0031](ADR-0031-monorepo-package-topology.md) (topologie monorepo) |
| **Déclencheur** | Audit de la pipeline de build existante — 5 893 lignes de code custom de bundling DTS identifiées comme dette technique pré-corpus                                                                                                                                                              |

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Les deux builds](#les-deux-builds)
3. [Classification des dépendances tierces](#classification-des-dépendances-tierces)
4. [Contraintes](#contraintes)
5. [État des lieux — inventaire de la dette](#état-des-lieux--inventaire-de-la-dette)
6. [Options considérées — Stratégie DTS](#options-considérées--stratégie-dts)
7. [Options considérées — Architecture pipeline](#options-considérées--architecture-pipeline)
8. [Analyse comparative — Stratégie DTS](#analyse-comparative--stratégie-dts)
9. [Analyse comparative — Architecture pipeline](#analyse-comparative--architecture-pipeline)
10. [Décision](#décision)
11. [Gate de validation — Proof of Concept](#gate-de-validation--proof-of-concept)
12. [Spécification des artefacts v1](#spécification-des-artefacts-v1)
13. [Conséquences](#conséquences)
14. [Actions de suivi](#actions-de-suivi)

---

## Contexte

### Le problème

Le corpus Bonsai spécifie **quels artefacts** le framework doit produire (ADR-0019 §8) et **quelle topologie source** ils exploitent (ADR-0031). Mais **aucun ADR ne formalise comment construire ces artefacts** — quelle toolchain, quel bundler DTS, quelle architecture de pipeline.

Le code actuel dans `/bonsai/lib/build/` est un **prototype pré-corpus** : il a été écrit avant les RFC et les ADR, pendant la phase exploratoire marionext. Ce code fonctionne pour l'ancien monde (2 packages hérités), mais il est structurellement inadapté à la topologie ADR-0031 (8+ packages par composant) et aux artefacts ADR-0019 (`bonsai.esm.js` + `bonsai.d.ts`).

### Pourquoi un ADR maintenant

L'implémentation de la strate 0 (ADR-0028) démarre. La première ligne de code d'un composant Bonsai nécessite un build fonctionnel pour produire un artefact testable E2E (ADR-0028 C1). Le build est un **prérequis bloquant** — pas un « nice to have ».

De plus, le choix de la toolchain DTS est **irréversible à court terme** : il conditionne la structure des `tsconfig.json` de chaque package (ADR-0031), les scripts `package.json`, les conventions d'artefacts et la DX de développement. Un mauvais choix maintenant produit de la dette structurelle dans chaque package créé.

### Deux builds, un ADR

Ce document couvre **deux builds distincts** qui partagent des choix fondamentaux (toolchain TypeScript, stratégie DTS, format de sortie). Les traiter dans un seul ADR évite les incohérences.

---

## Les deux builds

| #           | Build              | Objectif                                                                                        | Qui s'en sert                          | Quand                 | Statut v1                                 |
| ----------- | ------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------- | ----------------------------------------- |
| **Build 1** | Build framework    | Produire les artefacts du runtime Bonsai (`bonsai.esm.js` + `bonsai.d.ts`) à partir du monorepo | L'équipe Bonsai                        | Développement continu | ✅ **IN v1** — bloquant strate 0          |
| **Build 2** | CLI `bonsai build` | Compiler l'application d'un développeur (`--mode=esm\|iife`)                                    | Les développeurs d'applications Bonsai | Après v1 runtime      | ⏳ **OUT v1** (ADR-0029, cf. ADR-0019 §8) |

> **Périmètre de cette ADR** : les deux builds sont spécifiés, mais seul le Build 1 est implémenté en v1. Le Build 2 est conçu pour que les choix de toolchain v1 le supportent naturellement quand il sera implémenté.

### Build 1 — Build framework (interne)

**Entrée** : le monorepo Bonsai — `packages/*/src/*.ts` + `core/src/bonsai.ts`

**Sortie** :

```
core/dist/
  bonsai.esm.js           ← bundle ESM unique — tout le runtime Bonsai
  bonsai.d.ts             ← bundle de déclarations TypeScript unifié
  bonsai.esm.js.map       ← source map (optionnel)
```

**Caractéristiques** :

- Lit `bonsai-components.yaml` pour connaître les packages à inclure
- Résout le DAG de dépendances inter-packages (ADR-0031)
- Produit un bundle « flat » : les imports `@bonsai/entity`, `@bonsai/feature`, etc. sont **résolus et inlinés** dans le bundle final
- **Toutes** les dépendances tierces (`valibot`, `immer`, `rxjs`) sont **inlinées et tree-shakées** dans le bundle — zéro dépendance transitive (voir [§3 Classification des dépendances tierces](#classification-des-dépendances-tierces)). Seul `Valibot` est exporté publiquement ; `immer` et `rxjs` restent internes
- Le `.d.ts` est un fichier **autonome** qui ré-exporte les types publics de tous les packages — aucun `import` vers une dépendance tierce

### Build 2 — CLI `bonsai build` (développeur)

**Entrée** : le projet TypeScript d'un développeur d'application Bonsai

**Sortie selon le mode** :

| Mode          | Sortie                                                | Pipeline                                      |
| ------------- | ----------------------------------------------------- | --------------------------------------------- |
| `--mode=iife` | `app.bundle.iife.js` (bundle unique, auto-exécutable) | `tsc` → bundler (Rollup/esbuild) → IIFE wrap  |
| `--mode=esm`  | `*.esm.js` + `*.d.ts` par module source               | `tsc --declaration` → résolution path aliases |

**Caractéristiques** (ADR-0019 §8) :

- Wrapper fin autour de `tsc` — ne réinvente pas la compilation
- Garantit `declaration: true` en mode ESM (C7)
- Résout les path aliases TypeScript (C8)
- Valide les artefacts produits

> **Ce Build 2 est OUT de v1** (ADR-0029). Mais les choix de toolchain du Build 1 doivent être compatibles avec le Build 2 futur — en particulier, la résolution DTS choisie pour le Build 1 doit fonctionner aussi pour le Build 2.

---

## Classification des dépendances tierces

Le framework Bonsai dépend de trois bibliothèques tierces (`valibot`, `immer`, `rxjs`). Ces trois dépendances n'ont **pas le même statut** vis-à-vis du développeur d'application et ne reçoivent donc **pas le même traitement** dans le bundle produit.

### Vue d'ensemble

| Dépendance  | Tier                      | Le développeur l'utilise ?                      | JS bundle (`bonsai.esm.js`)       | DTS bundle (`bonsai.d.ts`) | `package.json` consommateur |
| ----------- | ------------------------- | ----------------------------------------------- | --------------------------------- | -------------------------- | --------------------------- |
| **valibot** | **Tier 1** — Intégrée     | ✅ Oui — schémas Entity (ADR-0022)              | **Inliné + exporté** (`Valibot`)  | **Inliné** (types résolus) | Aucune dépendance requise   |
| **immer**   | **Tier 2** — Transparente | ❌ Non — concept `TDraft<T>` exposé, lib cachée | **Inliné, non exporté** (interne) | **Inliné** (types résolus) | Aucune dépendance requise   |
| **rxjs**    | **Tier 3** — Opaque       | ❌ Non — mécanique interne invisible            | **Inliné, non exporté** (interne) | **Inliné** (types résolus) | Aucune dépendance requise   |

> **Principe fondamental** : `@bonsai/core` a **zéro dépendance transitive**. Le développeur fait `npm install @bonsai/core` et n'a rien d'autre à installer. Bonsai contrôle la version exacte de chaque bibliothèque tierce — aucun conflit de version possible.

### Tier 1 — Dépendance intégrée : `valibot`

**Principe** : le développeur d'application utilise directement cette bibliothèque dans son code applicatif. Elle est **re-exportée** depuis `@bonsai/core` sous un namespace `Valibot` (PascalCase) et **inlinée** dans le bundle — JS et DTS.

**Justification** :

- ADR-0022 impose Valibot comme unique bibliothèque de validation pour les Entity schemas
- Le framework se réserve le droit de **forcer** un schéma Valibot dans la définition de `TEntityStructure` — valibot DOIT donc être disponible sans installation supplémentaire
- Le développeur DOIT avoir accès à l'API Valibot complète pour construire ses schémas
- Un seul point d'entrée : `import { Valibot, Entity } from "@bonsai/core"` — pas de dépendance transitive à gérer

**DX** :

```typescript
// Le développeur importe TOUT depuis @bonsai/core — un seul point d'entrée
import { Valibot, Entity } from "@bonsai/core";

export namespace Cart {
  export const schema = Valibot.object({
    items: Valibot.array(
      Valibot.object({
        productId: Valibot.pipe(Valibot.string(), Valibot.minLength(1)),
        qty: Valibot.pipe(
          Valibot.number(),
          Valibot.integer(),
          Valibot.minValue(1)
        )
      })
    ),
    total: Valibot.pipe(Valibot.number(), Valibot.minValue(0))
  });

  export type State = TEntityStructure & Valibot.InferOutput<typeof schema>;
}
```

**Conséquences sur le build** :

- **JS** : le code de `valibot` est résolu et inliné dans `bonsai.esm.js` — le consommateur n'a **aucune dépendance transitive** sur `valibot`
- **DTS** : les types de `valibot` sont résolus et inlinés dans `bonsai.d.ts` — le consommateur voit les types directement sous le namespace `Valibot`
- **Pas de conflit de version** : le framework pin la version exacte de valibot ; le développeur n'installe pas valibot séparément
- **Bundle size** : valibot est conçu pour le tree-shaking (~5 KB gzip noyau) — l'impact est acceptable pour une dépendance de première classe
- **Convention** : la re-export utilise le namespace `Valibot` (PascalCase) — pas `VALIBOT` ni `valibot`

### Tier 2 — Dépendance transparente : `immer`

**Principe** : le framework utilise cette bibliothèque en interne. Un **concept** de la lib transparaît dans l'API publique (le type `Draft<T>` dans la signature de `mutate()`), mais le développeur **n'importe jamais la lib et n'appelle jamais ses fonctions directement**.

**Justification** (ADR-0001) :

- `Entity.mutate(intent, recipe)` utilise `produceWithPatches()` d'Immer en interne
- La `recipe` reçoit un `Draft<TStructure>` — le développeur écrit des mutations JavaScript naturelles sur ce draft (assignments, `push()`, `splice()`...)
- Le développeur ne manipule **aucune** fonction Immer (`produce`, `original`, `castDraft`...) — uniquement des opérations JavaScript standards
- ADR-0001 : _« Pas de magie exposée : Immer est interne au draft scopé »_

**Alias Bonsai** :

Le type `Draft<T>` d'Immer est aliasé en `TDraft<T>` dans le code framework pour découpler l'API publique d'immer :

```typescript
// Dans @bonsai/entity (code framework, pas développeur)
import type { Draft } from 'immer';

/** Draft mutable d'une Entity — alias framework de Draft<T> (Immer). */
export type TDraft<T> = Draft<T>;

// Signature publique de mutate() — aucune mention d'immer
mutate(
  intent: string,
  recipe: (draft: TDraft<TStructure>) => void
): TEntityEvent;
```

**Conséquences sur le build** :

- **JS** : le code d'immer est **résolu et inliné** dans `bonsai.esm.js` (tree-shaké — seuls `produceWithPatches`, `enablePatches` survivent, ~5-8 KB gzip). Aucun `import 'immer'` dans le bundle produit
- **DTS** : les types d'immer sont **résolus et inlinés** dans `bonsai.d.ts` — le consommateur voit `TDraft<T>` sans référence à `immer`
- **`package.json`** : immer n'apparaît **nulle part** dans les dépendances du consommateur — zéro conflit de version

### Tier 3 — Dépendance opaque : `rxjs`

**Principe** : le framework utilise cette bibliothèque en interne. **Aucun concept** ne transparaît dans l'API publique. Le développeur ne sait pas que `rxjs` existe.

**Justification** :

- RxJS est la mécanique interne du système pub/sub (Channels, souscriptions Features→Views)
- Aucun type RxJS (`Observable`, `Subject`, `Subscription`) n'apparaît dans les signatures publiques
- RFC Entity : _« L'implémentation (Immer, rxjs, callback) est interne. »_

**Conséquences sur le build** :

- **JS** : le code de rxjs est **résolu et inliné** dans `bonsai.esm.js` (tree-shaké — seuls les opérateurs utilisés par le framework survivent, ~10-15 KB gzip estimé). Aucun `import 'rxjs'` dans le bundle produit
- **DTS** : si des types internes référencent rxjs, ils sont **résolus et inlinés** — aucun `import` de `rxjs` dans le `.d.ts` public
- **`package.json`** : rxjs n'apparaît **nulle part** dans les dépendances du consommateur
- **Liberté de remplacement** : si le framework décide de remplacer rxjs par `EventTarget` natif ou un pub/sub custom, c'est un changement interne — zéro impact consommateur

### Impact sur la configuration Rollup du framework build

Toutes les dépendances tierces sont inlinées — la configuration `external` est **identique** pour les passes JS et DTS :

```typescript
// Passes JS et DTS — bonsai.esm.js et bonsai.d.ts
// Tier 1 (valibot) : inliné + exporté publiquement (namespace Valibot)
// Tier 2 (immer) :  inliné, non exporté (interne)
// Tier 3 (rxjs) :   inliné, non exporté (interne)
// Rollup résout et inline TOUT — tree-shaking élimine le code non utilisé
const externalPatterns: (string | RegExp)[] = [];
```

> **Invariant** : le bundle produit (`bonsai.esm.js` + `bonsai.d.ts`) ne contient **aucun** `import` vers une dépendance tierce. Le consommateur fait `npm install @bonsai/core` et n'a **rien d'autre à installer**. Zéro dépendance transitive, zéro conflit de version.
>
> **Bundle size estimé** (tree-shaké) : valibot ~3-5 KB + immer ~5-8 KB + rxjs ~10-15 KB ≈ **~20-28 KB gzip** pour les trois libs. Ce coût est le prix de la vraie encapsulation et de zéro dépendance transitive — acceptable pour un framework.

---

## Contraintes

### Contraintes architecturales

| #   | Contrainte                                                                                                                                                                             | Source                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| C1  | Le build framework DOIT produire un **artefact testable E2E** dès la strate 0 — pas de « pipeline seule sans sortie »                                                                  | ADR-0028 C1                                            |
| C2  | Le `.d.ts` est un **artefact de première classe** — inséparable du `.js`. Sans `.d.ts`, pas de type-safety consommateur                                                                | ADR-0019 C7                                            |
| C3  | Le build framework DOIT supporter la topologie **1 package/composant** avec résolution du DAG de dépendances                                                                           | ADR-0031 (Option D)                                    |
| C4  | Le build framework DOIT produire un **bundle ESM** (`format: "es"`) — pas d'IIFE pour le runtime                                                                                       | ADR-0019 §8, Distribution RFC                          |
| C5  | **Toutes** les dépendances tierces DOIVENT être **inlinées** (JS + DTS) selon leur tier (§3) — Tier 1 exporté publiquement, Tier 2/3 internes non exportés. Zéro dépendance transitive | DX développeur, encapsulation, zéro conflit de version |
| C6  | Les artefacts produits DOIVENT permettre **IntelliSense complet** chez le consommateur (`Go to definition`, auto-completion, erreurs compile-time)                                     | Philosophie Bonsai — « le type EST la documentation »  |
| C7  | La toolchain choisie DOIT être **compatible avec le futur CLI `bonsai build`** (Build 2) — pas de choix qui bloque le mode ESM per-module                                              | ADR-0019 C8                                            |

### Contraintes de maintenabilité

| #   | Contrainte                                                                                                                                             | Justification         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| C8  | La pipeline DOIT être **maintenable par un développeur standard** — pas de connaissance approfondie de l'AST TypeScript requise                        | Réduire le bus factor |
| C9  | La pipeline NE DOIT PAS contenir de **branches hardcodées par package** (`if (name === "@bonsai/rxjs")`) — chaque package suit le même chemin de build | Généricité            |
| C10 | La pipeline DOIT fonctionner **sans modification** quand un nouveau package composant est ajouté à `bonsai-components.yaml`                            | Extensibilité         |
| C11 | Le code de la pipeline DOIT suivre le [BUILD-CODING-STYLE](../guides/BUILD-CODING-STYLE.md) — singleton `me()`, `fs-extra`, imports `@build/`, Vitest  | Cohérence interne     |

### Contraintes d'écosystème

| #   | Contrainte                                                                                        | Justification    |
| --- | ------------------------------------------------------------------------------------------------- | ---------------- |
| C12 | La toolchain DOIT supporter **TypeScript 5.8+** et suivre les évolutions du compilateur           | Pérennité        |
| C13 | La licence de tout outil tiers DOIT être compatible avec la licence MIT de Bonsai                 | Juridique        |
| C14 | La toolchain DOIT avoir un **écosystème actif** — pas de projet abandonné ou en maintenance seule | Risque technique |

---

## État des lieux — inventaire de la dette

### Inventaire quantitatif du code actuel (`/bonsai/lib/build/`)

| Zone                                   | Fichiers        | Lignes    | Rôle                                                  | État                    |
| -------------------------------------- | --------------- | --------- | ----------------------------------------------------- | ----------------------- |
| `bundling/`                            | 4 fichiers      | **1 754** | Bundling DTS custom (ts-morph + regex)                | 🔴 À supprimer          |
| `plugins/rollup-plugin-dts/`           | 15 fichiers     | **4 139** | Fork custom de rollup-plugin-dts avec gestion mémoire | 🔴 À supprimer          |
| **Total DTS custom**                   | **19 fichiers** | **5 893** | —                                                     | —                       |
| `building/`                            | 2 fichiers      | 793       | Builder + Orchestrator                                | 🟡 À refactorer         |
| `initializing/`                        | 2 fichiers      | 648       | ComponentsRegistry + BuildOptions                     | 🟡 À adapter (ADR-0031) |
| `cache/`                               | 6 fichiers      | 793       | Système de cache                                      | 🟢 Réutilisable         |
| `core/`                                | 2 fichiers      | 390       | PathManager + BuildCache                              | 🟢 Réutilisable         |
| `plugins/rollup-plugin-postprocess.ts` | 1 fichier       | 55        | Post-traitement Rollup                                | 🟢 Réutilisable         |
| `build.type.ts`                        | 1 fichier       | 69        | Types centralisés                                     | 🟡 À adapter (ADR-0031) |
| **Total hors DTS**                     | **14 fichiers** | **2 748** | —                                                     | —                       |
| **Total pipeline**                     | **33 fichiers** | **8 641** | —                                                     | —                       |

> **68% du code de la pipeline** (5 893 / 8 641 lignes) est du bundling DTS custom qui sera supprimé par cette ADR quelle que soit l'option choisie.

### Contexte historique — pourquoi du DTS custom ?

La solution custom (ts-morph + fork de rollup-plugin-dts) n'est **pas arbitraire**. Elle a été créée parce que `rollup-plugin-dts` **ne produisait pas un `.d.ts` flat fonctionnel** à l'époque pour la topologie Bonsai. Le plugin standard échouait sur la résolution cross-packages du monorepo et/ou produisait un fichier `.d.ts` que TypeScript ne pouvait pas consommer correctement.

Le code custom a contourné ce problème avec une approche différente (extraction AST via ts-morph + manipulation textuelle). Ce contournement fonctionnait pour 2-3 packages, mais sa complexité et sa fragilité augmentent linéairement avec chaque package ajouté.

> **Conséquence critique** : l'Option B (`rollup-plugin-dts` standard) DOIT être **validée par un Proof of Concept** avant de supprimer le code custom. Il est possible que le problème originel persiste ou que de nouvelles limitations apparaissent avec la topologie ADR-0031. Voir [§11 Gate de validation](#gate-de-validation--proof-of-concept).

### Problèmes identifiés dans le code DTS custom

1. **Branches hardcodées par package** — `generate-flat-framework-dts.ts` contient `if (name === "@bonsai/rxjs")`, `if (name === "@bonsai/types")`, `if (name === "@bonsai/event")`. Chaque nouveau package casse la logique. Viole C9 et C10.

2. **Extraction par regex sur du texte** — `extractEventTypesAndClasses()` cherche `// Type declarations\n` dans le contenu textuel du `.d.ts`, puis supprime les lignes d'import par regex. Fragile : un commentaire manquant ou un formatage différent = échec silencieux.

3. **Fork custom de rollup-plugin-dts** — 4 139 lignes dans `plugins/rollup-plugin-dts/` qui dupliquent la logique du package npm `rollup-plugin-dts@6.2.1` (déjà installé, non utilisé) avec en plus un monitoring mémoire custom (987 lignes à lui seul : `memory-monitor.ts`, `memory-tracking.ts`, `memory-utils.ts`, `memory-optimized-dts.ts`).

4. **Deux systèmes redondants** — `bundle-library-dts.ts` (997 lignes, ts-morph) ET le plugin custom dans `plugins/rollup-plugin-dts/` (4 139 lignes) font la même chose : bundler des `.d.ts`. Aucun des deux n'est utilisé de façon cohérente.

5. **Aucun test** — 0 fichier de test pour 5 893 lignes de code critique. Un changement dans la structure d'un `.d.ts` généré par `tsc` casse silencieusement le bundle.

### Ce qui fonctionne bien (à conserver)

- **Orchestration `BuildOrchestrator`** — parallèle pour libraries, séquentiel avec tri topologique pour packages. Architecture saine.
- **`ComponentsRegistry`** — lecture YAML, classification des packages, détection types-only. À adapter pour ADR-0031 mais la structure est bonne.
- **Système de cache** — `PackageCache` (hash sources) + `LibraryCache` (version npm). Fonctionnel et utile.
- **Pattern singleton `me()`** — respecté partout, conforme au BUILD-CODING-STYLE.
- **Builder : stratégies `buildPackage()` / `buildLibrary()` / `buildFramework()`** — la structure est bonne, c'est le contenu (la partie DTS) qui doit changer.
- **Rollup pour le JS** — `format: "es"`, résolution `nodeResolve`, compilation TypeScript. Fonctionne.

---

## Options considérées — Stratégie DTS

### Option A — Custom ts-morph (statu quo)

**Description** : conserver le code existant dans `bundling/` et `plugins/rollup-plugin-dts/`. Adapter les branches hardcodées pour chaque nouveau package ADR-0031.

| Avantages                          | Inconvénients                                                  |
| ---------------------------------- | -------------------------------------------------------------- |
| + Aucun coût de migration immédiat | - 5 893 lignes non testées à maintenir                         |
| + Contrôle total sur la sortie     | - Branches hardcodées par package — viole C9, C10              |
|                                    | - Nécessite une expertise AST TypeScript (ts-morph) — viole C8 |
|                                    | - Deux systèmes redondants (bundling/ et plugins/)             |
|                                    | - 0 test — régressions silencieuses garanties                  |
|                                    | - Fork abandonné de rollup-plugin-dts — diverge de l'upstream  |

---

### Option B — `rollup-plugin-dts` (package npm)

**Description** : utiliser le package `rollup-plugin-dts@6.2.1` **déjà installé** dans le projet. Supprimer les 5 893 lignes custom. Le bundling DTS devient une seconde passe Rollup avec un plugin standard.

**Pipeline** :

```
Passe 1 — JS :
  tsc (via rollup-plugin-typescript2) → Rollup format:"es" → bonsai.esm.js

Passe 2 — DTS :
  tsc --declaration → .d.ts individuels par package
  → Rollup + rollup-plugin-dts → bonsai.d.ts (bundle unique)
```

**Code Builder (esquisse)** :

```typescript
import { dts } from "rollup-plugin-dts";

// Dans buildFramework() — passe DTS
const dtsBundleConfig: RollupOptions = {
  input: framework.outDtsFile, // le .d.ts d'entrée généré par tsc
  output: {
    file: framework.outDtsFile,
    format: "es"
  },
  plugins: [
    dts({
      tsconfig: join(this.pathManager.rootPath, "tsconfig.framework.json"),
      // Résoudre les path aliases @bonsai/*
      compilerOptions: {
        paths: {
          "@bonsai/*": ["./packages/*/src/*"]
        }
      }
    })
  ],
  // Passe DTS : aucun external → tous les types résolus et inlinés (§3)
  external: []
};

const dtsBundle = await rollup(dtsBundleConfig);
await dtsBundle.write(dtsBundleConfig.output as any);
await dtsBundle.close();
```

| Avantages                                                                         | Inconvénients                                                                      |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| + **Déjà installé** (`rollup-plugin-dts@6.2.1` dans `package.json`) — coût zéro   | - Projet en **maintenance mode** (pas de nouvelles features, mais mises à jour TS) |
| + Supprime **5 893 lignes** de code custom                                        | - Licence **LGPL-3.0** — à vérifier compatibilité avec MIT                         |
| + **Intégration Rollup native** — même pipeline que le JS                         | - Ne produit pas de rapport API (pas de tracking des breaking changes)             |
| + **Générique** — aucune branche par package (C9 ✅, C10 ✅)                      | - Ne fonctionne qu'avec des `.d.ts` existants (tsc doit d'abord les générer)       |
| + **1,4M téléchargements/semaine** — écosystème validé                            |                                                                                    |
| + Un développeur standard comprend la config (C8 ✅)                              |                                                                                    |
| + Compatible Build 2 futur (C7 ✅) — même plugin pour bundler les DTS applicatifs |                                                                                    |
| + Sourcemap support (`sourcemap: true`) pour Go-to-Definition (C6 ✅)             |                                                                                    |

---

### Option C — `@microsoft/api-extractor`

**Description** : utiliser l'outil de Microsoft (Rush Stack) qui produit des `.d.ts` rollups + un rapport API + un doc model JSON.

**Pipeline** :

```
Passe 1 — JS :
  tsc (via rollup-plugin-typescript2) → Rollup format:"es" → bonsai.esm.js

Passe 2 — DTS :
  tsc --declaration → .d.ts individuels
  → api-extractor run → bonsai.d.ts (bundle) + bonsai.api.md (rapport)
```

**Code Builder (esquisse)** :

```typescript
import {
  Extractor,
  ExtractorConfig,
  ExtractorResult
} from "@microsoft/api-extractor";

// Dans buildFramework() — passe DTS
const extractorConfig = ExtractorConfig.loadFileAndPrepare(
  join(framework.rootPath, "config", "api-extractor.json")
);

const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
  localBuild: true,
  showVerboseMessages: false
});

if (!extractorResult.succeeded) {
  throw new Error(
    `API Extractor failed with ${extractorResult.errorCount} errors`
  );
}
```

**Fichier `api-extractor.json` requis** :

```jsonc
{
  "$schema": "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
  "mainEntryPointFilePath": "<projectFolder>/core/dist/bonsai.d.ts",
  "apiReport": {
    "enabled": true,
    "reportFolder": "<projectFolder>/docs/api/"
  },
  "dtsRollup": {
    "enabled": true,
    "untrimmedFilePath": "<projectFolder>/core/dist/bonsai.d.ts"
  },
  "docModel": {
    "enabled": false
  }
}
```

| Avantages                                                                                      | Inconvénients                                                                                                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| + **Outil Microsoft officiel** — maintenu activement, utilisé par TypeScript lui-même          | - **Pas installé** — nouvelle dépendance à ajouter                                                                   |
| + **Rapport API** — détecte les breaking changes entre versions (`bonsai.api.md`)              | - **Complexité de configuration** — `api-extractor.json` verbeux (~200 lignes pour le template complet)              |
| + **Qualité de sortie excellente** — trimming des déclarations internes (`@internal`, `@beta`) | - **Processus séparé** — n'est pas un plugin Rollup, nécessite une étape `tsc` + une étape api-extractor             |
| + **Licence MIT** — compatible (C13 ✅)                                                        | - **Couplage version TS** — api-extractor embarque son propre compilateur TS, des conflits de version sont possibles |
| + Fonctionne idéalement dans un monorepo (Rush Stack)                                          | - **N'est pas conçu pour le bundling cross-packages monorepo** — chaque invocation traite un seul point d'entrée     |
|                                                                                                | - Surdimensionné pour v1 — le rapport API et le doc model ne sont pas des besoins immédiats                          |

---

### Option D — `tsc` seul (pas de bundling DTS)

**Description** : ne pas bundler les `.d.ts`. Chaque package produit son propre `.d.ts` dans `dist/`. Le barrel `@bonsai/core` contient des `export * from "@bonsai/entity"` qui pointent vers les `.d.ts` individuels.

**Pipeline** :

```
tsc --declaration --project tsconfig.framework.json
→ packages/entity/dist/bonsai-entity.d.ts
→ packages/feature/dist/bonsai-feature.d.ts
→ ...
→ core/dist/bonsai.d.ts (contient: export * from "@bonsai/entity")
```

| Avantages                                    | Inconvénients                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| + **Zéro outil supplémentaire** — `tsc` seul | - Les consommateurs voient les **imports internes** (`@bonsai/entity`, `@bonsai/feature`) dans les types                                |
| + **Zéro code custom** à maintenir           | - **IntelliSense dégradé** — Go-to-Definition pointe vers les `.d.ts` intermédiaires, pas un fichier unifié (C6 ⚠️)                     |
| + Rapide — pas de passe supplémentaire       | - **Ne produit pas un `.d.ts` autonome** — le consommateur doit résoudre les packages workspace (incompatible avec la distribution npm) |
|                                              | - Incompatible avec le mode IIFE (un seul `.d.ts` requis pour le bundle)                                                                |
|                                              | - Les types internes (`@bonsai/entity/src/internal-type`) fuient dans l'API publique                                                    |

---

## Options considérées — Architecture pipeline

### Option I — Refactoring progressif (garder `lib/build/`)

**Description** : conserver la structure existante de `lib/build/`, remplacer uniquement le bundling DTS, adapter `ComponentsRegistry` et `Builder` pour ADR-0031.

| Avantages                                         | Inconvénients                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| + Continuité — pas de big-bang                    | - Le code existant porte des conventions marionext (ex: champ `namespace` dans package.json) |
| + Cache et orchestration réutilisés immédiatement | - Mélange de code neuf et ancien — risque de confusion                                       |
| + Moins de travail initial                        |                                                                                              |

---

### Option II — Réécriture ciblée (garder la structure, réécrire le contenu)

**Description** : conserver l'architecture (`lib/build/` avec les sous-dossiers `building/`, `initializing/`, `cache/`, `core/`), mais réécrire les fichiers du `Builder` et supprimer tout le code DTS custom. Conserver le cache et l'orchestrateur tels quels.

| Avantages                                                          | Inconvénients                                    |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| + Architecture éprouvée conservée (orchestrateur, cache, registry) | - Travail de réécriture du Builder (~500 lignes) |
| + Suppression nette de la dette (5 893 lignes)                     |                                                  |
| + Les conventions ADR-0031 sont intégrées dès le départ            |                                                  |
| + Tests Vitest écrits en même temps que la réécriture              |                                                  |

---

### Option III — Réécriture totale (`lib/build/` from scratch)

**Description** : supprimer tout le contenu de `lib/build/` et repartir de zéro.

| Avantages                            | Inconvénients                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| + Slate propre, aucun legacy         | - Perte du cache (793 lignes fonctionnelles)                                     |
| + Conventions ADR-0031 dès le départ | - Perte de l'orchestrateur (296 lignes fonctionnelles, tri topologique)          |
|                                      | - Perte du PathManager (186 lignes)                                              |
|                                      | - Délai plus long avant un artefact testable (viole ADR-0028 C1 pragmatiquement) |

---

## Analyse comparative — Stratégie DTS

| Critère                            | A — Custom ts-morph        | B — rollup-plugin-dts                | C — api-extractor            | D — tsc seul                     |
| ---------------------------------- | -------------------------- | ------------------------------------ | ---------------------------- | -------------------------------- |
| **Qualité `.d.ts` produit**        | ⭐ (regex, fragile)        | ⭐⭐⭐ (résolution complète)         | ⭐⭐⭐ (trimming avancé)     | ⭐⭐ (pas de bundling)           |
| **Maintenabilité** (C8)            | ⭐ (expertise AST requise) | ⭐⭐⭐ (~10 lignes de config)        | ⭐⭐ (config JSON verbeux)   | ⭐⭐⭐ (rien à maintenir)        |
| **Généricité** (C9, C10)           | ⭐ (branches par package)  | ⭐⭐⭐ (générique)                   | ⭐⭐⭐ (générique)           | ⭐⭐⭐ (générique)               |
| **IntelliSense** (C6)              | ⭐⭐ (approximatif)        | ⭐⭐⭐ (sourcemap support)           | ⭐⭐⭐ (excellent)           | ⭐⭐ (imports internes visibles) |
| **Intégration Rollup**             | ⭐⭐ (plugin custom)       | ⭐⭐⭐ (natif)                       | ⭐ (processus séparé)        | N/A                              |
| **Complexité d'adoption**          | ⭐⭐⭐ (déjà là)           | ⭐⭐⭐ (déjà installé)               | ⭐⭐ (nouvelle dep + config) | ⭐⭐⭐ (rien à faire)            |
| **Pérennité** (C12, C14)           | ⭐ (non maintenu)          | ⭐⭐ (maintenance mode, mais MAJ TS) | ⭐⭐⭐ (Microsoft, actif)    | ⭐⭐⭐ (tsc = éternel)           |
| **Rapport API / breaking changes** | ❌                         | ❌                                   | ✅                           | ❌                               |
| **Licence** (C13)                  | N/A (interne)              | ⚠️ LGPL-3.0                          | ✅ MIT                       | ✅ N/A                           |
| **Lignes de code pipeline**        | 5 893                      | ~20                                  | ~30 + JSON                   | 0                                |
| **Compatible Build 2** (C7)        | ⚠️ Non portable            | ✅ Même plugin                       | ✅ Même outil                | ✅ tsc natif                     |

---

## Analyse comparative — Architecture pipeline

| Critère                           | I — Refactoring progressif | II — Réécriture ciblée                     | III — From scratch    |
| --------------------------------- | -------------------------- | ------------------------------------------ | --------------------- |
| **Délai avant artefact testable** | ⭐⭐⭐ (rapide)            | ⭐⭐ (quelques jours)                      | ⭐ (semaines)         |
| **Qualité du résultat**           | ⭐⭐ (legacy résiduel)     | ⭐⭐⭐ (propre)                            | ⭐⭐⭐ (propre)       |
| **Conservation des acquis**       | ⭐⭐⭐ (tout)              | ⭐⭐⭐ (cache, orchestrateur, PathManager) | ⭐ (rien)             |
| **Conformité ADR-0031**           | ⭐⭐ (adaptation)          | ⭐⭐⭐ (intégré)                           | ⭐⭐⭐ (intégré)      |
| **Testabilité**                   | ⭐⭐ (tests à ajouter)     | ⭐⭐⭐ (tests inclus)                      | ⭐⭐⭐ (tests inclus) |

---

## Décision

### Stratégie DTS : Option B — `rollup-plugin-dts`

Nous choisissons **`rollup-plugin-dts`** (package npm, déjà installé) parce que :

1. **Coût d'adoption nul.** Le package est déjà dans `package.json` (`"rollup-plugin-dts": "^6.2.1"`). Il suffit de l'importer dans le Builder et de supprimer les 5 893 lignes custom. Le ratio effort/impact est imbattable.

2. **Intégration Rollup native.** Le bundling DTS devient une seconde passe Rollup dans la même pipeline que le JS. Pas de processus séparé, pas de coordination inter-outils. Le code du Builder reste cohérent : une méthode, deux passes.

3. **Généricité totale.** Le plugin résout automatiquement les imports entre packages via le compilateur TypeScript. Aucune branche par package, aucune regex sur du texte. L'ajout d'un nouveau package à `bonsai-components.yaml` fonctionne sans toucher au code de la pipeline (C9, C10 ✅).

4. **Maintenabilité radicale.** ~20 lignes de configuration remplacent 5 893 lignes de code custom non testé. Un développeur standard comprend la configuration sans expertise AST (C8 ✅).

5. **Compatible avec le Build 2 futur.** Le même plugin peut être utilisé dans le CLI `bonsai build --mode=esm` pour bundler les `.d.ts` d'une application développeur. Le choix ne ferme aucune porte (C7 ✅).

**Pourquoi pas Option C (api-extractor) ?**

`api-extractor` est un excellent outil, mais surdimensionné pour les besoins v1. Le rapport API et le tracking de breaking changes sont des features post-v1 — quand Bonsai aura des consommateurs externes et un versionning sémantique public. De plus, api-extractor est un processus séparé de Rollup, ce qui complexifie la pipeline pour un bénéfice non immédiat. **Si le besoin de rapport API émerge post-v1, migrer de `rollup-plugin-dts` vers `api-extractor` est faisable** — les deux consomment les mêmes `.d.ts` générés par `tsc`.

**Pourquoi pas Option D (tsc seul) ?**

Un `.d.ts` non bundlé expose les imports internes (`@bonsai/entity`, `@bonsai/feature`) au consommateur, ce qui fuit l'architecture interne du monorepo dans l'API publique. C'est incompatible avec la distribution d'un bundle unique (ADR-0019) et dégrade l'IntelliSense (C6).

**Pourquoi pas Option A (statu quo) ?**

5 893 lignes non testées avec des branches hardcodées par package. L'ajout de chaque package ADR-0031 (`@bonsai/entity`, `@bonsai/feature`, `@bonsai/view`...) casse la logique. Le coût de maintenance dépasse le coût de migration dès le 2ème package ajouté.

### Point d'attention — Licence LGPL-3.0

`rollup-plugin-dts` est sous licence **LGPL-3.0**. Cette licence autorise l'utilisation dans un projet MIT **tant que le code LGPL n'est pas modifié et redistribué**. Puisque Bonsai utilise le package npm tel quel (sans fork ni modification) et que `rollup-plugin-dts` est un outil de build (pas une dépendance runtime distribuée dans le bundle), la compatibilité est respectée. Le bundle `bonsai.esm.js` produit ne contient aucun code de `rollup-plugin-dts`.

### Architecture pipeline : Option II — Réécriture ciblée

Nous choisissons la **réécriture ciblée** parce que :

1. **Conservation des acquis.** Le cache (793 lignes), l'orchestrateur avec tri topologique (296 lignes) et le PathManager (186 lignes) sont fonctionnels et conformes au BUILD-CODING-STYLE. Les réécrire est du gaspillage.

2. **Suppression nette de la dette.** Tout le code DTS custom (`bundling/` et `plugins/rollup-plugin-dts/`) est supprimé. Le Builder est réécrit pour utiliser `rollup-plugin-dts`. Le résultat est propre sans être un big-bang risqué.

3. **Tests inclus.** La réécriture est l'occasion d'écrire les tests Vitest du Builder — conformément à ADR-0030 (tests = preuve d'architecture).

4. **Délai acceptable.** La réécriture du Builder (~500 lignes) + suppression du DTS custom + tests = quelques jours de travail, compatible avec le calendrier strate 0.

---

## Gate de validation — Proof of Concept

> **Aucune ligne de code custom n'est supprimée tant que le PoC n'a pas passé tous les critères.**

### Pourquoi un PoC

Le code DTS custom dans `bundling/` et `plugins/rollup-plugin-dts/` a été créé parce que `rollup-plugin-dts` ne produisait pas un `.d.ts` flat fonctionnel pour la topologie Bonsai à l'époque. Avant de supprimer 5 893 lignes de code qui _fonctionnent_ (même mal), il faut **prouver** que le remplacement fonctionne.

### Scope du PoC

Créer un script de validation **indépendant** (dans `lib/build/__poc__/` ou `tests/build/`) qui :

1. Prend les packages actuels (`@bonsai/types`, `@bonsai/event`, `@bonsai/rxjs`, `@bonsai/valibot`) + le barrel `core/src/bonsai.ts`
2. Exécute la passe DTS avec `rollup-plugin-dts` (config §12 `createDtsRollupConfig`, `external: []`)
3. Produit un `bonsai.d.ts` candidat

### Critères de validation (tous obligatoires)

| #   | Critère                        | Test                                                                                        | Résultat attendu                                                         |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| VC1 | **Compilabilité**              | `tsc --noEmit --strict test-consumer.ts` où `test-consumer.ts` importe depuis `bonsai.d.ts` | Zéro erreur                                                              |
| VC2 | **Aucun import tiers**         | `grep -c "from 'rxjs'\|from 'immer'\|from 'valibot'" bonsai.d.ts`                           | 0 occurrences                                                            |
| VC3 | **Aucun import interne**       | `grep -c "from '@bonsai/" bonsai.d.ts`                                                      | 0 occurrences                                                            |
| VC4 | **Namespace Valibot exporté**  | `grep -c "export.*Valibot" bonsai.d.ts`                                                     | ≥ 1 occurrence                                                           |
| VC5 | **Types Event présents**       | `test-consumer.ts` utilise `Channel`, `Radio` → IntelliSense correct                        | Types résolus, auto-completion fonctionnelle                             |
| VC6 | **Types utilitaires présents** | `test-consumer.ts` utilise `TJsonObject`, `TDictionary` etc.                                | Types résolus                                                            |
| VC7 | **Pas de `any` implicite**     | Aucun type `any` dans le `.d.ts` sauf si explicitement marqué                               | `grep "any" bonsai.d.ts` ne contient que des `any` intentionnels         |
| VC8 | **Taille raisonnable**         | `wc -c bonsai.d.ts`                                                                         | < 500 KB (heuristique — si plus grand, vérifier que rien n'est dupliqué) |

### Scénarios de fallback si le PoC échoue

| Échec                                      | Cause probable                                              | Fallback                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| VC1 échoue — erreurs TS dans le `.d.ts`    | rollup-plugin-dts résout mal les generics cross-packages    | Tester `api-extractor` (Option C). Si OK → changer la décision                                                        |
| VC2 échoue — imports tiers résiduels       | `respectExternal: true` + `external: []` mal interprété     | Tester avec `respectExternal: false` ou pré-traiter les `.d.ts` intermédiaires                                        |
| VC3 échoue — imports `@bonsai/*` résiduels | Path aliases non résolus                                    | Ajouter `compilerOptions.paths` explicite dans la config dts. Si insuffisant → Option C                               |
| VC8 échoue — `.d.ts` gigantesque           | Types dupliqués (même type inliné N fois depuis N packages) | Activer `respectExternal` sélectivement ou restructurer les dépendances inter-packages                                |
| **Tous les fallbacks échouent**            | —                                                           | Conserver le code custom en le **simplifiant** : supprimer le fork (4 139 lignes) mais garder ts-morph (1 754 lignes) |

### Workflow

```
1. Écrire le PoC (script + test-consumer.ts)     ← AVANT toute suppression
2. Exécuter le PoC → résultats VC1–VC8
3a. Tous OK → Option B confirmée → supprimer le code custom
3b. Certains KO → tenter les fallbacks
3c. Tous KO → Option C ou custom simplifié
```

> **Le statut de cette ADR reste 🟡 Proposed tant que le PoC n'est pas passé.** Le passage en 🟢 Accepted est conditionné à la validation VC1–VC8.

---

## Spécification des artefacts v1

### Artefacts produits par le Build 1

```
core/dist/
  bonsai.esm.js             ← bundle ESM — tout le runtime Bonsai
  bonsai.d.ts               ← déclarations TypeScript unifiées
  bonsai.esm.js.map          ← source map JS (optionnel, activable)

packages/{composant}/dist/
  bonsai-{composant}.js     ← module ES individuel (pour les tests unitaires)
  bonsai-{composant}.d.ts   ← déclarations individuelles (pour les tests unitaires)
```

### Pipeline v1 détaillée

```
bonsai-components.yaml
        │
        ▼
ComponentsRegistry.collect()
        │
        ▼
BuildOrchestrator.build()
  │
  ├── 1. Libraries (parallèle) — @bonsai/rxjs, @bonsai/valibot
  │     └── Builder.buildLibrary(pkg)
  │           ├── Rollup passe JS : tsc → format:"es" → dist/{lib}.js
  │           └── Rollup passe DTS : rollup-plugin-dts → dist/{lib}.d.ts
  │
  ├── 2. Packages (séquentiel, tri topologique)
  │     └── Builder.buildPackage(pkg)
  │           ├── types-only ? → copie .d.ts directe
  │           └── regular ? →
  │                 ├── Rollup passe JS : tsc → format:"es" → dist/{pkg}.js
  │                 └── Rollup passe DTS : rollup-plugin-dts → dist/{pkg}.d.ts
  │
  └── 3. Framework (dernier)
        └── Builder.buildFramework(fw)
              ├── Rollup passe JS : inline TOUT (@bonsai/* + valibot + immer + rxjs)
              │     external: [] — zéro dépendance transitive
              │     → format:"es" → bonsai.esm.js (bundle autonome)
              └── Rollup passe DTS : rollup-plugin-dts (résout TOUT)
                    external: [] — zéro import tiers
                    → bonsai.d.ts (bundle autonome)
```

### Configuration Rollup (passe DTS — générique, identique pour tout composant)

```typescript
function createDtsRollupConfig(
  inputDtsFile: string,
  outputDtsFile: string,
  tsconfigPath: string,
  externalPatterns: (string | RegExp)[] = []
): RollupOptions {
  return {
    input: inputDtsFile,
    output: {
      file: outputDtsFile,
      format: "es"
    },
    plugins: [
      dts({
        tsconfig: tsconfigPath,
        respectExternal: true
      })
    ],
    external: externalPatterns
  };
}
```

> **C9 respectée** : cette fonction est appelée identiquement pour chaque composant, library et le framework. Aucune branche par package.
>
> **Appels framework (§3)** : pour le build framework final, `externalPatterns` est un **tableau vide** `[]` pour **les deux passes** (JS et DTS). Toutes les dépendances tierces sont inlinées et tree-shakées. Le bundle produit est autonome — zéro `import` externe.

---

## Conséquences

### Positives

- ✅ **Suppression de 5 893 lignes** de code custom non testé — la surface de maintenance de la pipeline passe de 8 641 à ~2 800 lignes
- ✅ **Pipeline générique** — l'ajout d'un nouveau package ADR-0031 ne nécessite que l'ajout d'une ligne dans `bonsai-components.yaml`
- ✅ **IntelliSense complet** — le `.d.ts` bundlé résout tous les imports internes, les consommateurs ne voient que l'API publique
- ✅ **Pipeline testable** — la réécriture ciblée inclut des tests Vitest pour le Builder
- ✅ **Compatibilité Build 2** — les choix de toolchain v1 supportent naturellement le futur CLI `bonsai build`
- ✅ **Cohérence** — une seule toolchain (Rollup) pour le JS et le DTS
- ✅ **`Valibot` intégré (Tier 1)** — valibot est un citoyen de première classe du framework, accessible via `import { Valibot } from "@bonsai/core"` sans aucune dépendance supplémentaire
- ✅ **DTS autonome** — `bonsai.d.ts` ne contient aucun `import` vers une dépendance tierce — IntelliSense fonctionne sans installer rxjs, immer ni valibot séparément

### Négatives (acceptées)

- ⚠️ **`rollup-plugin-dts` est en maintenance mode** — accepté : le package reçoit des mises à jour de compatibilité TypeScript (dernière release : avril 2026), et l'alternative `api-extractor` reste viable si le projet est réellement abandonné
- ⚠️ **Licence LGPL-3.0** — accepté : le package est un outil de build, pas une dépendance runtime. Le bundle distribué ne contient aucun code LGPL
- ⚠️ **Pas de rapport API** — accepté pour v1 : le tracking de breaking changes est un besoin post-v1. Migration vers `api-extractor` possible ultérieurement
- ⚠️ **Trois libs tierces inlinées dans le bundle JS** — accepté : ~20-28 KB gzip (tree-shaké) pour valibot + immer + rxjs. C'est le prix de zéro dépendance transitive et de la vraie encapsulation. Si le développeur utilise indépendamment l'une de ces libs, il y aura deux copies — mais il ne devrait pas savoir que Bonsai les utilise (Tier 2/3 internes)

### Risques identifiés

- 🔶 **`rollup-plugin-dts` ne supporte pas un futur TypeScript 6.x** — mitigation : le package a 1,4M téléchargements/semaine et une communauté active. En cas d'abandon réel, `api-extractor` ou `dts-bundle-generator` sont des alternatives directes qui consomment les mêmes `.d.ts` en entrée. La migration est mécanique (changer un plugin, pas l'architecture).
- 🔶 **Les `.d.ts` intermédiaires doivent exister avant la passe DTS** — mitigation : la passe JS (rollup-plugin-typescript2 avec `declaration: true`) les génère déjà. L'ordre est garanti par la séquence `buildPackage()` → `buildFramework()`.
- � **`rollup-plugin-dts` a déjà échoué par le passé** — le code custom existe _parce que_ le plugin standard ne produisait pas un `.d.ts` flat fonctionnel pour la topologie Bonsai. Le problème a pu être corrigé dans les versions récentes (6.x) ou a pu être lié à la configuration de l'époque. **Mitigation obligatoire** : un Proof of Concept (§11) DOIT valider que le `.d.ts` produit est consommable avant toute suppression du code custom. Si le PoC échoue, le fallback est Option C (api-extractor) ou une version minimale du code custom sans les 4 139 lignes du fork.
- �🔶 **Tree-shaking de rxjs insuffisant** — si le wrapper `@bonsai/rxjs` importe `import * as RxjsOriginal from 'rxjs'` (wildcard), Rollup ne peut pas tree-shaker. Mitigation : le wrapper DOIT être réécrit avec des imports nommés explicites (`import { Subject, BehaviorSubject } from 'rxjs'`) pour garantir un tree-shaking efficace.

---

## Actions de suivi

### Phase 0 — Proof of Concept (BLOQUANT)

> **Aucune action de Phase 1 ne démarre tant que Phase 0 n'est pas validée.**

- [ ] Écrire le script PoC : `rollup-plugin-dts` sur les packages actuels → `bonsai.d.ts` candidat
- [ ] Écrire `test-consumer.ts` : fichier TypeScript qui importe et utilise les types de `bonsai.d.ts`
- [ ] Exécuter les critères VC1–VC8 (voir §11)
- [ ] **Si PoC OK** → passer cette ADR en 🟢 Accepted, poursuivre Phase 1
- [ ] **Si PoC KO** → documenter les échecs, tester les fallbacks (§11), adapter la décision

### Phase 1 — Implémentation (après validation PoC)

- [ ] Supprimer `lib/build/bundling/` (4 fichiers, 1 754 lignes)
- [ ] Supprimer `lib/build/plugins/rollup-plugin-dts/` (15 fichiers, 4 139 lignes)
- [ ] Réécrire `Builder.buildLibrary()`, `Builder.buildPackage()`, `Builder.buildFramework()` avec passe DTS `rollup-plugin-dts`
- [ ] Extraire `createDtsRollupConfig()` comme fonction utilitaire dans `lib/build/building/dts-config.ts`
- [ ] Adapter `ComponentsRegistry` pour la topologie ADR-0031 (nouveaux packages par composant)
- [ ] Adapter `bonsai-components.yaml` pour la topologie ADR-0031
- [ ] Réécrire les wrappers `@bonsai/rxjs` et `@bonsai/valibot` avec des imports nommés explicites (tree-shaking)

### Phase 2 — Validation et documentation

- [ ] Écrire les tests Vitest : `builder.class.test.ts`, `components-registry.test.ts`
- [ ] Intégrer les critères VC1–VC8 comme tests de non-régression permanents dans la CI
- [ ] Valider le bundle produit : `bonsai.esm.js` importable + `bonsai.d.ts` compilable avec `tsc --noEmit`
- [ ] Mettre à jour `lib/BUILD.md` et `lib/ARCHITECTURE.md` pour refléter la nouvelle pipeline
- [ ] Mettre à jour l'agent `build-framework.agent.md` pour refléter la suppression du code custom

### Phase 3 — Propagation dans le corpus

- [ ] Renommer le namespace `VALIBOT` → `Valibot` (PascalCase) dans `packages/valibot/src/valibot.ts` et `core/src/bonsai.ts`
- [ ] Créer l'alias `TDraft<T>` dans `@bonsai/entity` pour découpler `Draft<T>` d'immer de l'API publique
- [ ] Mettre à jour ADR-0022 — les exemples doivent utiliser `import { Valibot } from "@bonsai/core"` au lieu de `import * as v from 'valibot'`

---

## Références

- [ADR-0019 — Mode ESM Modulaire](ADR-0019-mode-esm-modulaire.md) — §8 : artefacts de distribution, CLI `bonsai build`
- [ADR-0028 — Phasage kernel-first](ADR-0028-implementation-phasing-strategy.md) — C1 : artefact testable E2E par strate
- [ADR-0029 — Scope v1 gelé](ADR-0029-v1-scope-freeze.md) — CLI `bonsai build` OUT v1
- [ADR-0031 — Topologie monorepo](ADR-0031-monorepo-package-topology.md) — 1 package/composant
- [BUILD-CODING-STYLE](../guides/BUILD-CODING-STYLE.md) — Conventions pipeline de build
- [rollup-plugin-dts](https://www.npmjs.com/package/rollup-plugin-dts) — Package npm, 1,4M dl/semaine
- [@microsoft/api-extractor](https://api-extractor.com/) — Alternative post-v1

---

## Historique

| Date       | Changement                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-14 | Création (Proposed) — audit pipeline existante, 5 893 lignes DTS custom identifiées, choix `rollup-plugin-dts` + réécriture ciblée                                                                                                                                                                                              |
| 2026-04-14 | Ajout §3 Classification des dépendances tierces — 3 tiers, all-inlined. Valibot Tier 1 (exporté), immer Tier 2 (interne), rxjs Tier 3 (interne). Zéro dépendance transitive, zéro conflit de version. Bundle autonome ~20-28 KB gzip                                                                                            |
| 2026-04-14 | Ajout §11 Gate de validation PoC — contexte historique (code custom existait car rollup-plugin-dts échouait à l'époque). 8 critères de validation (VC1–VC8). Scénarios de fallback. Actions restructurées en 4 phases (PoC bloquant → Implémentation → Validation → Propagation). Statut reste Proposed tant que PoC non validé |
