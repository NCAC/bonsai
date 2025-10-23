# Système de Build Bonsai v2 – Documentation Technique

## Table des matières

1. [Introduction](#introduction)
2. [Architecture du système de build](#architecture-du-système-de-build)
3. [Flux de travail détaillé](#flux-de-travail-détaillé)
4. [Configuration et personnalisation](#configuration-et-personnalisation)
5. [Traitement des fichiers de déclaration (DTS)](#traitement-des-fichiers-de-déclaration-dts)
6. [Commandes et options de build](#commandes-et-options-de-build)
7. [Résolution de problèmes](#résolution-de-problèmes)
8. [Axes d'amélioration](#axes-damélioration)
9. [Conclusion](#conclusion)

---

## Introduction

Le système de build Bonsai v2 est une refonte modulaire, stricte ESM, pensée pour la robustesse, la maintenabilité et la scalabilité des builds multi-packages. Il s’appuie sur une architecture orientée phases, une gestion stricte des imports, un cache intelligent et une orchestration centralisée.

**Objectifs clés :**

- Cohérence stricte des types et des artefacts entre packages
- Build optimisé (parallélisation, cache, nettoyage)
- Extensibilité (plugins, hooks, phases)
- Expérience développeur fluide (watch, logs, feedback visuel)

---

## Architecture du système de build

### Structure des fichiers

```
/lib/build/
├── build.ts                # Point d'entrée principal (orchestration)
├── initializing/              # Découverte, analyse et organisation des composants
│   └── component-registry.ts  # collecte et organisation
├── building/                  # Logique de build (builder, orchestrator)
├── bundling/                  # Bundling JS/DTS (Rollup, plugins)
├── core/                      # Services transverses (PathManager, cache)
├── monitoring/                # Logger, reporting
├── plugins/                   # Plugins Rollup et outils de transformation
├── utils/                     # Helpers (clean, etc.)
└── build.type.ts              # Types partagés
```

### Composants principaux

- **build.ts** : Orchestrateur global, gestion des options CLI, initialisation, logs, signaux, lancement du build.
- **ComponentRegistry** : Analyse, collecte et organisation des composants (framework, libraries, packages) à partir de `bonsai-components.yaml`.
- **Builder / BuildOrchestrator** : Exécution du build (par phase, par type de composant), gestion du cache, nettoyage, parallélisation.
- **Plugins & Bundling** : Plugins Rollup custom, bundling JS et DTS, post-processing.
- **Logger** : Gestion centralisée des logs, reporting, feedback visuel.

---

## Flux de travail détaillé

1. **Initialisation**

   - Chargement et validation des chemins critiques
   - Parsing des options CLI (clean, watch, etc.)
   - Initialisation du logger et du cache
   - Découverte et organisation des composants via `ComponentRegistry`

2. **Nettoyage (optionnel)**

   - Suppression des dossiers `dist` si `--clean` est activé

3. **Build principal**

   - Orchestration du build (framework, libraries, packages)
   - Build JS (Rollup, plugins, transformations)
   - Build DTS (Rollup, post-processing, flattening)
   - Gestion du cache (invalidation, mise à jour)

4. **Mode watch (optionnel)**

   - Surveillance des fichiers sources, rebuild automatique
   - Gestion des signaux (SIGINT)

5. **Post-processing & publication**
   - Copie des fichiers auxiliaires (README, LICENSE)
   - Vérification de l’intégrité des artefacts

### Diagramme de flux

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│  Initialisation    │────▶│   Build principal  │────▶│   Bundling/Plugins │
└────────────────────┘     └────────────────────┘     └────────────────────┘
                                                         │
                                                         ▼
┌────────────────────┐     ┌────────────────────┐
│  Post-processing   │◀───│   Watch/Publication│
└────────────────────┘     └────────────────────┘
```

---

## Configuration et personnalisation

- **Fichier central :** `bonsai-components.yaml` (définit libraries/packages à builder)
- **Options CLI :** `--clean`, `--no-watch`, `--force-rebuild`, `--verbose`, `--silent`, `--no-cache`, `--clear-cache`, etc.
- **Configuration TypeScript :** `tsconfig.json` strict, options surchargées par le builder si besoin
- **Plugins :** Ajoutables dans `/lib/build/plugins/` (Rollup, post-processing, etc.)

---

## Traitement des fichiers de déclaration (DTS)

- Bundling DTS via Rollup et plugins custom
- Flattening des types, correction des références inter-packages
- Génération d’un fichier `.d.ts` unique par package
- Gestion des cas particuliers (RxJS, types globaux, etc.)

---

## Commandes et options de build

### Commandes principales

```bash
pnpm build [--clean] [--no-watch] [--force-rebuild] [--verbose] ...
```

- `pnpm build` : Build complet, mode watch par défaut
- `pnpm build --no-watch` : Build complet, process se termine après compilation
- `pnpm build --clean` : Nettoyage des dossiers dist avant build

### Options avancées

| Option            | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `--clean`         | Nettoie les dossiers dist avant la compilation                      |
| `--no-watch`      | Désactive le mode de surveillance des fichiers après la compilation |
| `--force-rebuild` | Force la reconstruction de tous les packages                        |
| `--verbose`       | Affiche plus d’informations de log                                  |
| `--silent`        | Réduit les messages de log                                          |
| `--no-cache`      | Désactive le cache de build                                         |
| `--clear-cache`   | Vide le cache de build                                              |

---

## Résolution de problèmes

- **Références circulaires** : Le registry détecte et log les cycles, refactoriser si besoin
- **Erreurs de types** : Vérifier la version de TypeScript, nettoyer puis rebuild (`pnpm build --clean`)
- **Problèmes de cache** : Utiliser `--clear-cache` ou `--no-cache`
- **Processus qui ne s’arrête pas** : Vérifier l’usage de `--no-watch` (corrigé en v2)

---

## Axes d'amélioration

- Parallélisation plus fine du build (analyse de graphe de dépendances)
- Intégration de tests d’intégration du build
- Feedback visuel enrichi (progress bar, reporting)
- Support de nouveaux formats de bundle (CJS, UMD, etc.)
- Extension du système de plugins (pré/post build)

---

## Conclusion

Le système de build Bonsai offre une base moderne, robuste et évolutive pour la gestion multi-package. Il est conçu pour être strict, modulaire et facilement extensible. Toute évolution ou suggestion doit être documentée ici pour garantir la cohérence du process.

---

## Respect du guide de style

> **Important :** Toutes les contributions au système de build doivent respecter strictement les règles du guide de style [CODING_STYLE.md](../docs/CODING_STYLE.md).
>
> Cela inclut :
>
> - L’ordre et la forme des imports (voir section « Modules et imports (ESM) »)
> - L’utilisation des alias pour tous les imports internes
> - Le nommage explicite des imports par défaut
> - L’utilisation de `fs-extra` pour toutes les opérations sur le système de fichiers
> - Le pattern singleton pour les services (voir section dédiée)
> - La documentation JSDoc sur toutes les API publiques
>
> Tout nouveau module, refactoring ou ajout de fonctionnalité doit être conforme à ces conventions.
