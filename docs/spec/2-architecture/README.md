# Architecture — Vue d'ensemble

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (4 novembre 2026).** En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Taxonomie des composants, organisation en couches et principes structurants**

[← Retour à l'index](../README.md)

---

## Introduction

Bonsai organise ses composants en deux couches, au-dessus d'un noyau d'exécution :

- **Couche abstraite** — persistante, indépendante du DOM : la logique métier et les données ;
- **Couche concrète** — éphémère, liée à l'interface : composition et projection ;
- **Noyau** (`Root`, `@bonsai/kernel`) — une racine par Application, interne (I15) : registre, unités de validation, file différée, Queries, parts, effets et trace.

La logique métier (abstraite) survit aux changements d'interface (concrète). Toute communication passe par la racine : aucun composant n'en appelle un autre directement.

---

## Taxonomie

### Couche abstraite (persistante)

| Élément | Rôle | Détail |
| --- | --- | --- |
| **Application** | Racine du modèle : valide le Manifest, démarre la racine du noyau | [application.md](../3-couche-abstraite/application.md) |
| **Feature** | Unité métier : reçoit des Commands, émet des Events, répond aux Queries, écoute d'autres Features | [feature.md](../3-couche-abstraite/feature.md) |
| **Entity** | Ressource de la Feature (pas un composant) : état jsonifiable détenu par le noyau, muté par `ctx.mutate` | [entity.md](../3-couche-abstraite/entity.md) |
| **Channel** | Contrat typé d'une Feature (`commands`, `events`, `queries`), porté par `static readonly channel` ; pas une classe d'exécution | [communication.md](communication.md) §5 |
| **Router** | Feature `router` fournie par le framework et adaptateur d'historique (D7, D15) | [router.md](../3-couche-abstraite/router.md) |

### Couche concrète (éphémère)

| Composant | Rôle | Détail |
| --- | --- | --- |
| **Foundation** | Admet son ancre (`<body>` par défaut, option `anchor`) et y déclare les slots de ses Composers ; ni Channel ni Query | [foundation.md](../4-couche-concrete/foundation.md) |
| **Composer** | Décide la composition d'un slot : `resolve(ctx)` → Views ordonnées par clé ; interroge, ne commande ni n'émet (D12) | [composer.md](../4-couche-concrete/composer.md) |
| **View** | Projette le domaine sur sa part (`getUI`), admet les faits du DOM, commande depuis le handler d'un fait (D18) ; aucun état du domaine | [view.md](../4-couche-concrete/view.md) |
| **Behavior** | ⏳ strate 2 : code réutilisable inclus dans le traitement de sa View, sans existence propre (ADR-21) | [behavior.md](../4-couche-concrete/behavior.md) |

> Pour le détail (responsabilités, limites, ownership, relations), suivre les liens
> vers la [couche abstraite](../3-couche-abstraite/README.md) et la
> [couche concrète](../4-couche-concrete/README.md).

---

## Documents de cette section

| Document | Sujet |
| --- | --- |
| [communication.md](communication.md) | Flux unidirectionnel, Commands/Events/Queries, racine, namespaces |
| [state.md](state.md) | Entity détenue par le noyau, ownership, store distribué |
| [lifecycle.md](lifecycle.md) | Démarrage, création et destruction par le noyau, cascade |
| [distribution.md](distribution.md) | Bundles livrés, mode ESM modulaire (cible) |
| [metas.md](metas.md) | Contextes causaux, traçabilité |
| [erreurs.md](erreurs.md) | Catégories, unité de validation, diagnostics |

---

## Lecture suivante

→ [Communication et flux](communication.md) — comment les composants communiquent
