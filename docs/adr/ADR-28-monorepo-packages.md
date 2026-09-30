# ADR-28 — Monorepo : un package par composant, `@bonsai/core` barrel

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — les frontières ne sont pas imposées (les `paths` de tsconfig contournent les `dependencies`) ; `@bonsai/core` n'exporte ni `Entity` ni `@bonsai/error` ; `@bonsai/behavior` absent (strate 2) |
| **Spec** | `core/src/bonsai.ts` · `packages/*/package.json` |

## Contexte

Avec une dizaine de composants dans un seul `src/`, rien n'empêche une View
d'importer l'Entity : les règles d'architecture (I6, I30) reposent alors
sur la discipline. On veut que la frontière soit un fait de compilation, sans
compliquer l'import côté application.

## Décision

**Un package pnpm par composant**, point d'entrée `src/bonsai-<nom>.ts` :
`application`, `feature`, `entity`, `event`, `view`, `composer`, `foundation`,
`error`, `types`, et des wrappers pour les bibliothèques tierces (`immer`,
`rxjs`, `valibot`).

- Chaque `package.json` déclare **exactement** ses dépendances `@bonsai/*` ; le graphe est un DAG sans cycle.
- **`@bonsai/core` est un barrel pur** : aucun code propre, il ré-exporte la surface publique de chaque package. L'application écrit `import { Feature, View, Entity } from "@bonsai/core"`.
- Ce qui est interne (`Channel`, `Radio`) n'est **pas** ré-exporté par le barrel (I80).
- Les tests unitaires importent le package exact du composant testé ; intégration et e2e passent par `@bonsai/core`.

## Alternatives rejetées

- **`core/src/` plat** — aucune frontière, tout peut importer tout.
- **Deux packages (couche abstraite / couche concrète)** — ni la simplicité du plat, ni la preuve par composant.
- **Un package, sous-dossiers par couche** — un dossier n'est pas une frontière TypeScript.

## Conséquences

- La topologie est indépendante du mode de distribution (ADR-27) : IIFE ou ESM consomment les mêmes imports.
- **Écart livré — frontières** : TypeScript et Jest résolvent `@bonsai/*` par alias vers `src/`, sans regarder les `dependencies`. `view` importe `@bonsai/feature` et `@bonsai/types` sans les déclarer, et `@bonsai/core` ne déclare que `types`, `rxjs`, `valibot`, `event` et `immer` alors qu'il ré-exporte aussi `feature`, `view`, `composer`, `foundation` et `application`. La preuve « View ne peut pas importer Entity » n'existe donc pas encore ; il faudrait des références de projet TypeScript ou une règle de lint sur le graphe.
- **Écart livré — barrel** : `core/src/bonsai.ts` n'exporte ni `@bonsai/entity` ni `@bonsai/error`. Une application qui consomme le bundle ne peut pas déclarer d'Entity (les fixtures importent `@bonsai/entity` directement).
