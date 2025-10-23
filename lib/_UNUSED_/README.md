# Orchestration du build Bonsai

Ce dossier contient la logique d'orchestration du build du framework Bonsai.

## Rôle
- Point d'entrée unique du build (`index.ts`)
- Gestion des phases de build (parallèle/séquentiel)
- Configuration centralisée et gestion des événements

## Fichiers typiques
- `index.ts` : point d'entrée, orchestre tout le pipeline
- `phases.ts` : logique des phases 1/2
- `BuildStoreConfig.ts` : configuration du build
- `BuildEventManager.ts` : gestion des événements de build
- `types.ts` : types partagés

> Toute nouvelle logique d'orchestration ou de gestion du pipeline doit être placée ici.
