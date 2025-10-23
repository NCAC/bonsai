# Architecture — Vue d'ensemble

> **Taxonomie des composants, organisation en couches et principes structurants**

[← Retour à l'index](../README.md)

---

## Introduction

Bonsai repose sur **10 composants** organisés en deux couches :

- **Couche abstraite** (6 composants) — persistante, indépendante du DOM
- **Couche concrète** (4 composants) — éphémère, liée au cycle de vie du DOM

Cette séparation est le fondement architectural de Bonsai : la logique métier (abstraite) survit aux changements d'interface (concrète).

---

## Taxonomie des 10 composants

### Couche abstraite (6 composants — persistante)

Composants indépendants du DOM et du cycle de vie visuel.
Portent la logique métier et les données.

| Composant | Rôle | Détail |
|-----------|------|--------|
| **Application** | Orchestration boot/shutdown, configuration globale | [application.md](../3-couche-abstraite/application.md) |
| **Feature** | Unité métier — orchestre, réagit, communique via 5 capacités (C1-C5) | [feature.md](../3-couche-abstraite/feature.md) |
| **Entity** | Structure de données encapsulée — state, mutations, query | [entity.md](../3-couche-abstraite/entity.md) |
| **Channel** | Contrat de communication typé (tri-lane : command, event, request) | [communication.md](communication.md) §5 |
| **Router** | Spécialisation Feature pour la navigation (namespace réservé `router`) | [router.md](../3-couche-abstraite/router.md) |
| **Radio** | *Infrastructure interne* de câblage — jamais exposée au développeur (I15) | [communication.md](communication.md) §6 |

### Couche concrète (4 composants — éphémère)

Composants liés à l'interface utilisateur et au cycle de vie visuel.

| Composant | Rôle | Détail |
|-----------|------|--------|
| **Foundation** | Point d'ancrage unique sur `<body>`, droits N1 sur `<html>`/`<body>`, capacités Channel | [foundation.md](../4-couche-concrete/foundation.md) |
| **Composer** | Décideur de composition — `resolve()` → quelle View instancier, capacités Channel, aucun droit DOM | [composer.md](../4-couche-concrete/composer.md) |
| **View** | Projection pure — monopole du rendu DOM (I18), aucun domain state (localState I42 autorisé) | [view.md](../4-couche-concrete/view.md) |
| **Behavior** | Plugin UI réutilisable et aveugle attaché à une View, aucun domain state (D36) | [behavior.md](../4-couche-concrete/behavior.md) |

> Pour le détail complet (responsabilités, limites, ownership, relations) de chaque composant,
> suivre les liens ci-dessus vers les documents dédiés de la [couche abstraite](../3-couche-abstraite/README.md)
> et de la [couche concrète](../4-couche-concrete/README.md).

---

## Documents de cette section

| Document | Sujet |
|----------|-------|
| [communication.md](communication.md) | Flux unidirectionnel, tri-lane, Radio, namespaces |
| [state.md](state.md) | Entity encapsulée, ownership, store distribué |
| [lifecycle.md](lifecycle.md) | Bootstrap 6 phases, shutdown, persistance |
| [distribution.md](distribution.md) | Mode IIFE vs ESM modulaire |
| [metas.md](metas.md) | Métadonnées causales, traçabilité |
| [erreurs.md](erreurs.md) | Catégories, propagation, diagnostics |

---

## Lecture suivante

→ [Communication et flux](communication.md) — comment les composants communiquent
