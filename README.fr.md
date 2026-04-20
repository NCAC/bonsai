# Bonsai Framework

Un framework JavaScript moderne pour le développement frontend.

> ⚠️ **En cours de développement** - Ce framework est actuellement en phase de développement actif. L'API va _très certainement_ évoluer avant la version stable.

## Introduction

**bonsai** est un framework front-end écrit en TypeScript, conçu pour offrir une base solide, typée et modulaire pour le développement d'applications web modernes. Il met l'accent sur la clarté, la robustesse et la réutilisabilité du code.

En plus, il intègre des bibliothèques externes populaires sous une API unifiée.

## Structure du projet

Le projet est organisé en plusieurs sections principales:

- `core/`: Le cœur du framework
- `packages/`: Modules individuels et bibliothèques encapsulées
- `lib/`: Outils de build et de développement
- `tools/`: Scripts utilitaires
- `docs/`: Documentation technique

## Bibliothèques externes intégrées

Bonsai intègre plusieurs bibliothèques externes populaires, encapsulées pour une utilisation cohérente:

- **RxJS**: Programmation réactive
- **Immer**: Mutations d'état immuables
- **Remeda**: Utilitaires fonctionnels
- **Zod**: Validation de schémas
- **Valibot**: Validation de schémas (contrats Entity)

## Fonctionnalités principales

- Architecture modulaire (événements, types utilitaires, intégration RxJS, etc.)
- Système d'événements inspiré de Backbone.Events/Radio (Pub/Sub, Request/Reply)
- Large collection de types utilitaires stricts
- Intégration transparente de librairies modernes (rxjs, zod, remeda)
- 100% TypeScript, typage strict et documentation des API

## Développement

### Prérequis

- Node.js 23+
- pnpm

### Installation

```bash
# Installer les dépendances
pnpm install
```

### Compilation

```bash
# Compiler tous les packages et le framework
pnpm run build

# Compiler sans watch
pnpm run build:no-watch

# Compiler et nettoyer tous les fichiers compilés avant
pnpm run build:clean
```

---

## Documentation du système de build

Le framework Bonsai utilise un système de build intelligent qui gère automatiquement :

- **Packages réguliers** : Compilation TypeScript + Rollup
- **Packages types-only** : Copie directe des fichiers `.d.ts` (optimisé)
- **Détection automatique** : Aucune configuration manuelle requise
- **Build incrémental** : Seuls les packages modifiés sont rebuildés

> 📖 **Documentation complète** :
>
> - **Vue d'ensemble** : [`/lib/BUILD.md`](./lib/BUILD.md) - Concepts et fonctionnement
> - **Guide développeur** : [`/lib/DEVELOPER-GUIDE.md`](./lib/DEVELOPER-GUIDE.md) - Usage pratique
> - **Architecture** : [`/lib/ARCHITECTURE.md`](./lib/ARCHITECTURE.md) - Détails techniques
> - **Index complet** : [`/lib/README.md`](./lib/README.md) - Navigation dans la documentation

## Installation côté client

```bash
pnpm add bonsai
```

## Utilisation de base

```ts
import { EventTrigger, RXJS, zod } from "bonsai";

// Exemple : création d'un émetteur d'événements
type MyEvents = { update: string };
class MyEmitter extends EventTrigger<MyEmitter, MyEvents> {}

const emitter = new MyEmitter();
emitter.on("update", (msg) => console.log(msg));
emitter.trigger("update", "Hello world!");
```

## Packages principaux

- `@bonsai/event` : système Channel tri-lane (Commands, Events, Requests) + Radio singleton
- `@bonsai/entity` : classe abstraite Entity avec `mutate()` Immer
- `@bonsai/types` : types utilitaires avancés
- `@bonsai/immer` : wrapper Immer (Tier 3 opaque)
- `@bonsai/valibot` : wrapper Valibot (validation Entity)
- `@bonsai/rxjs` : intégration RxJS
- `@bonsai/remeda` : utilitaires fonctionnels
- `@bonsai/zod` : validation de schémas

## Documentation

- 📐 [RFCs — Spécifications](docs/rfc/README.md) (source de vérité)
- 📋 [ADRs — Décisions](docs/adr/README.md) (36 décisions architecturales)
- 📖 [Guides](docs/guides/) (conventions de codage)
- 🇬🇧 [English version](README.md)
