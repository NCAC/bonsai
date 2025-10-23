# Utilitaires internes du build Bonsai

Ce dossier regroupe tous les helpers et fonctions utilitaires utilisés par le process de build.

## Rôle
- Fonctions pures et réutilisables (gestion mémoire, logs, manipulation de fichiers, etc.)
- Aucun effet de bord direct sur le pipeline de build

## Exemples de fichiers
- `memoryLogger.ts` : suivi de la consommation mémoire
- `gcHelper.ts` : helpers pour le garbage collector
- `prettyFiles.ts` : affichage lisible des fichiers

> Placez ici tout utilitaire générique utilisé par plusieurs parties du build.
