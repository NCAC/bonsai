# Communication et flux de données

> 🟢 **Aligné sur la théorie V0.9.5 et sur le noyau livré (lots M1 à M6, 1er novembre 2026).** Les messages passent par la racine du noyau (`Root`, théorie 13 et annexe C). La classe `Channel` est retirée : le mot ne désigne plus que le contrat typé d'une Feature. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Flux unidirectionnel : Commands, Events, Queries, tous délivrés par la racine**

[← Retour à l'architecture](README.md) · [← Philosophie](../1-philosophie.md)

---

## Table des matières

1. [Primitives](#1-primitives)
2. [Droits de communication](#2-droits-de-communication)
3. [Flux unidirectionnel](#3-flux-unidirectionnel)
4. [Flux entre Features](#4-flux-entre-features)
5. [Le Channel comme contrat](#5-le-channel-comme-contrat)
6. [Racine et namespaces](#6-racine-et-namespaces)
7. [Réactivité des Views](#7-réactivité-des-views)
8. [Sémantique d'exécution](#8-sémantique-dexécution)

---

## 1. Primitives

| Message | Direction | Destinataires | Retour |
| --- | --- | --- | --- |
| **Command** `ns:nom` | View, Behavior, adaptateur, Composer exclu (D12) vers la Feature propriétaire | Exactement un handler `on{Nom}Command` | Aucun ; le résultat s'observe par un Event |
| **Event** `ns:nom` | Feature propriétaire (ou adaptateur) vers les abonnés | N abonnés présents à l'émission (D8) | Aucun |
| **Query** `ns:nom` | N'importe quel composant déclarant `queries` | Un handler `on{Nom}Query` | Une valeur, de manière **synchrone** ; jamais `null` pour « inconnu » |

- La clé d'un message est `namespace:nom` ; le préfixe est le namespace du Manifest (I68–I69).
- Le **payload** est capturé par valeur à l'envoi. Un Event émis pendant une unité est **délivré après sa validation** (G5), jamais pendant (D8).
- Il n'y a pas de message d'un composant à un autre sans passer par la racine : la racine est la seule autorité de transport (G6).

## 2. Droits de communication

Tous les droits sont **déclaratifs**. Un composant ne communique qu'avec ce qu'il a déclaré ; la racine refuse le reste (erreur de transport).

| Composant | Command | Event (émettre) | Event (écouter) | Query |
| --- | --- | --- | --- | --- |
| **Feature** | Aucune (D17) | Sur son propre namespace seulement (I1) | `listens` | `queries` (lecture seule) |
| **View / Behavior** | `features[ns].triggers` | Jamais (I4) | `features[ns].listens` | `features[ns].queries` |
| **Composer** | Aucune (D12) | Jamais | Non | `queries` : sert à `resolve(ctx)` |
| **Adaptateur** | Reçoit ses propres Commands | Sur son propre namespace | Non | Query d'observation intégrée |
| **Foundation** | Aucune | Jamais | Non | Non |

Règles complémentaires :

- Un **Command** a un seul handler, la Feature propriétaire (I10). Un Command vers un namespace absent de la racine, ou non déclaré par le contrat de la Feature, fait échouer l'unité (`UNKNOWN_TARGET`, `UNDECLARED_MESSAGE`).
- Une **Query** s'exécute sans effet : un handler de Query ne peut ni émettre ni muter, ni interroger à son tour (A3.g).
- Un composant **non UI** qui déclenche un Command sur le namespace d'un composant UI, ou qui s'abonne à un Event de ce namespace, est refusé avec `NOT_AUTHORIZED` (A4.b). L'abonnement est contrôlé à la création, quel que soit l'ordre de création des deux composants ; un refus ne laisse aucun abonnement.
- Les View et Behaviors n'ont pas d'Entity : l'état d'une Feature ne se lit que par une Query (I6).
- **Livré** : la déclaration est vérifiée à la compilation (`TFeatureContract`, I81) **et** à l'exécution par la racine (message hors contrat → `UNDECLARED_MESSAGE`). Le filet d'exécution de la dépendance `listens` ne porte que sur le jeton, non sur les noms d'Events (voir [feature.md §3](../3-couche-abstraite/feature.md#3-handlers-et-contextes)).

## 3. Flux unidirectionnel

```text
┌─────────┐   Command    ┌──────────┐   ctx.mutate   ┌────────┐
│  View   │ ───────────► │ Feature  │ ─────────────► │ Entity │
└─────────┘              └──────────┘                └────────┘
    ▲                         │
    └──── Event (après validation) ──┘
```

1. La **View** reçoit un fait DOM et, dans son handler, déclenche un Command (`ctx.trigger`).
2. La **racine** délivre le Command à la Feature propriétaire, dans une **unité de validation** (G7).
3. Le handler **mute** l'état (`ctx.mutate`) et **émet** des Events (`ctx.emit`).
4. À la validation de l'unité : les mutations deviennent définitives, les Events émis sont mis en file et délivrés chacun dans **sa propre unité**, aux abonnés présents (D8).
5. Les **Views** abonnées reçoivent l'Event, interrogent par `ctx.query` et préparent leurs effets DOM, engagés après validation (C.3).

Le flux ne remonte jamais : aucun Event ne devient automatiquement un Command.

## 4. Flux entre Features

Le modèle est la **chorégraphie pure** (ADR-01) : une Feature n'envoie jamais de Command à une autre Feature (I25) et n'émet que sur son propre namespace.

```text
CartFeature ── emit cart:itemAdded ──► PromoFeature (listens: [cart])
                                          └─ onCartItemAddedEvent → ctx.mutate / ctx.emit promo:applied
```

- Une réaction qui doit modifier un autre domaine passe par **son** Event, écouté par ce domaine.
- Une lecture inter-domaines passe par une **Query** déclarée.
- La profondeur d'une chaîne de réactions est bornée (`causalBound`, D9) : au-delà, le message n'est pas délivré et l'échec figure dans la trace.

## 5. Le Channel comme contrat

Le mot **Channel** désigne désormais uniquement le **contrat typé** d'une Feature (`TChannelDefinition` : `commands`, `events`, `queries`) et son jeton (`TChannelToken<TDef, NS>`, exposé par `static channel`). Ce n'est plus une classe d'exécution : il n'y a ni `Channel.emit()` ni abonnement porté par un objet.

| Concept | Rôle |
| --- | --- |
| `TChannelDefinition` | Les trois voies et leurs types, co-localisé avec la Feature (I74) |
| `TChannelToken` | Identifie la Feature (namespace littéral) pour typer les déclarations (I73) |
| Contrats `TFeatureContract` | Ce qu'un consommateur déclare toucher : `listens`, `triggers`, `queries` |

## 6. Racine et namespaces

- **Une racine par `Application`** (G6) : elle détient les unités, la file différée, le journal d'annulation, la trace et le Manifest ordonné par `dependsOn` (C.1).
- Le **namespace** est la clé du Manifest. Il est camelCase, unique, non réservé (`local`, `router`, I71) et porte à la fois l'identité de la Feature, la clé de son état et le préfixe de ses messages.
- Les **parties**, **ressources** et **désignations** (D18) portent les droits sur le DOM : un composant ne reçoit que ce qu'on lui a attribué.
- Aucune infrastructure de câblage n'est exposée au développeur. `Root` n'est pas ré-exporté par la surface applicative (I15 : voir [invariants](../reference/invariants.md)).

## 7. Réactivité des Views

**Livré** : une View reçoit les Events déclarés dans `listens` par des handlers `on{Ns}{Event}Event(payload, ctx)`, et les faits DOM par `on{Key}{Event}(fact, ctx)` ([view.md](../4-couche-concrete/view.md)). Elle relit l'état par `ctx.query`.

**Cible, non livré** : l'événement réservé `any` et les `select` de templates ([5-rendu.md](../5-rendu.md)). Les notifications de l'Entity (`on<Clé>EntityUpdated`, `onAnyEntityUpdated`) concernent la **Feature** propriétaire, non les Views.

## 8. Sémantique d'exécution

### 8.1 Situations limites

| Situation | Comportement |
| --- | --- |
| Command vers une cible inconnue ou un message non déclaré | Échec de l'unité (`UNKNOWN_TARGET`, `UNDECLARED_MESSAGE`) |
| Event sans abonné | Silencieux : un fait sans observateur est valide |
| Query vers une cible absente, non prête ou occupée | Erreur de transport qui fait échouer l'unité (G7), même interceptée |
| Handler qui lève | L'unité échoue : mutations, émissions et Commands préparés sont annulés ; l'échec figure dans la trace |
| Profondeur causale au-delà de la borne | Non délivré (D9) |

### 8.2 Ordre et isolation

- Les abonnés d'un Event sont fixés **à l'émission** (C.6) et délivrés dans un ordre stable.
- Chaque délivrance a sa **propre unité** : l'échec d'un abonné n'annule ni les autres ni l'unité émettrice, déjà validée.
- Les Features ne doivent pas dépendre de l'ordre relatif de leurs abonnés (chorégraphie pure).

### 8.3 Cycle d'abonnement

La clôture d'une part (View détruite par son Composer) retire logiquement ses abonnements dans l'unité ; le retrait physique suit la validation, et un Event déjà délivré en file n'est plus remis à un destinataire clos. `Application.stop()` ne retire aujourd'hui que les observateurs de l'hôte ([application.md](../3-couche-abstraite/application.md)).

### 8.4 Non livré

| Élément | Statut |
| --- | --- |
| `metas` et `correlationId` exposés aux handlers | Cible (ADR-04) ; le noyau tient la chaîne causale en interne |
| `ErrorReporter` (I65) et hook `onError()` | Cible |
| Arrêt complet de la racine (`Application.stop`) | Cible |

---

## Lecture suivante

→ [State](state.md) — l'état détenu par le noyau, accessible par Query
→ [Cycle de vie](lifecycle.md) — unités, démarrage, destruction
