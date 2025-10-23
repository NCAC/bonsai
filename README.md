<<<<<<< HEAD

# Bonsai Framework

Un framework JavaScript moderne pour le développement frontend.

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
- **Remeda**: Utilitaires fonctionnels
- **Zod**: Validation de schémas

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

> ℹ️ Les détails sur le process de build, l'optimisation et les scripts internes sont réservés à la documentation interne du projet (voir `/lib/BUILD.md`).

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

- `@bonsai/event` : système d'événements
- `@bonsai/types` : types utilitaires avancés
- `@bonsai/rxjs` : intégration RxJS
- `@bonsai/remeda` : utilitaires fonctionnels
- `@bonsai/zod` : validation de schémas

## Documentation

Pour plus d'exemples et la documentation complète de l'API, consultez les README de chaque package ou la documentation en ligne.
