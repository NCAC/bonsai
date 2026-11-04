# ADR-28 — Monorepo : un package par composant, `@bonsai/core` barrel

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — les frontières ne sont pas imposées (les `paths` de tsconfig contournent les `dependencies`)  ; le barrel ré-exporte tous les packages de composant (`tests/integration/core-barrel.test.ts`) ; `@bonsai/behavior` absent (strate 2) |
| **Spec** | `core/src/bonsai.ts` · `packages/*/package.json` |

## Contexte

Avec une dizaine de composants dans un seul `src/`, rien n'empêche une View
d'importer l'Entity : les règles d'architecture (I6, I30) reposent alors
sur la discipline. On veut que la frontière soit un fait de compilation, sans
compliquer l'import côté application.

## Décision

**Un package pnpm par composant**, point d'entrée `src/bonsai-<nom>.ts` :
`application`, `feature`, `entity`, `view`, `composer`, `foundation`, `router`,
`error`, `types`, et des wrappers pour les bibliothèques tierces (`immer`, `rxjs`,
`valibot`). S'y ajoute **`kernel`**, le noyau d'exécution (`Root`) : il n'est
pas un composant mais l'infrastructure de communication (théorie 3.3, §13) et
le protocole d'exécution (annexe C) sur lesquels reposent les classes de base.

- Chaque `package.json` déclare **exactement** ses dépendances `@bonsai/*` ; le graphe est un DAG sans cycle.
- **`@bonsai/core` est un barrel pur** : aucun code propre, il ré-exporte la surface publique de chaque package. L'application écrit `import { Feature, View, Entity } from "@bonsai/core"`.
- Ce qui est interne (`Root` et les types du noyau) n'est **pas** ré-exporté par le barrel (I80) ; seuls les types de contrat des Channels le sont.
- Les tests unitaires importent le package exact du composant testé ; intégration et e2e passent par `@bonsai/core`.

## Alternatives rejetées

- **`core/src/` plat** — aucune frontière, tout peut importer tout.
- **Deux packages (couche abstraite / couche concrète)** — ni la simplicité du plat, ni la preuve par composant.
- **Un package, sous-dossiers par couche** — un dossier n'est pas une frontière TypeScript.
- **Nommer le noyau `event`** — depuis le retrait de la classe `Channel` (M6.3b), il ne contient aucun mécanisme propre aux Events ; le nom faisait croire à un système d'évènements.

## Conséquences

- La topologie est indépendante du mode de distribution (ADR-27) : IIFE ou ESM consomment les mêmes imports.
- **Écart livré — frontières** : TypeScript et Jest résolvent `@bonsai/*` par alias vers `src/`, sans regarder les `dependencies`. `view` importe `@bonsai/feature` et `@bonsai/types` sans les déclarer, et `@bonsai/core` ne déclare que `types`, `rxjs`, `valibot`, `kernel` et `immer` alors qu'il ré-exporte aussi `feature`, `view`, `composer`, `foundation` et `application`. La preuve « View ne peut pas importer Entity » n'existe donc pas encore ; il faudrait des références de projet TypeScript ou une règle de lint sur le graphe.
- **Barrel** : `core/src/bonsai.ts` ré-exporte `entity`, `error` et `router` avec les autres composants ; la racine du noyau (`Root`) reste interne (I15). Les fixtures et les gates E2E importent encore les packages directement.
