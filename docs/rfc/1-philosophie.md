# Philosophie du framework Bonsai

> **Pourquoi Bonsai existe — contexte, objectifs et principes fondateurs**

[← Retour à l'index](README.md)

---

## 1. Contexte et motivation

### Pourquoi cette RFC ?

Le framework Bonsai repose sur des choix architecturaux forts et opinionated.
Avant toute implémentation, il est indispensable de poser formellement :

- les **composants** du framework et leurs **responsabilités exclusives** ;
- les **frontières** entre composants — ce que chacun peut et ne peut pas faire ;
- les **règles de communication** — qui parle à qui, par quel mécanisme ;
- les **invariants non négociables** qui garantissent la cohérence du système.

Ce document constitue le *quoi* architectural : il définit les pièces du puzzle
et comment elles s'emboîtent, indépendamment du *comment* (API TypeScript,
implémentation, typage) qui fait l'objet des documents composants.

L'objectif est qu'un développeur puisse lire cette documentation et comprendre
l'architecture complète de Bonsai sans avoir vu une seule ligne de code.

### Ce que cette documentation couvre

- La **taxonomie** complète des composants du framework
- Les **responsabilités** et **limites** de chaque composant
- Les **règles de communication** entre composants
- La **gestion du state** et les règles d'ownership
- Le **cycle de vie** des composants
- La **traçabilité** des flux (métadonnées causales)
- Les **invariants** qui constituent le contrat architectural

### Ce que cette documentation ne couvre pas

- L'API concrète des composants (signatures, types, méthodes) → voir les fichiers composants
- Les détails d'implémentation (classes abstraites, génériques)
- Le système de build et de packaging
- Les stratégies de rendu avancées (compilateur PugJS → PDR, animations) → voir [5-rendu.md](5-rendu.md)
- Les outils de développement (DevTools, CLI) → voir [devtools.md](devtools.md)

---

## 2. Objectifs

1. **Définir** chaque composant, son rôle et ses frontières
2. **Formaliser** les règles de communication (qui parle à qui, comment, pourquoi)
3. **Établir** les invariants architecturaux non négociables
4. **Clarifier** les capacités exactes d'une Feature et le modèle chorégraphique
5. **Spécifier** le modèle de traçabilité causale
6. **Documenter** les anti-patterns et les décisions rejetées
7. **Fournir** un vocabulaire commun ([glossaire](reference/glossaire.md)) pour toute la documentation future

---

## 3. Principes fondateurs

### 3.1 Opinionated

Conventions fortes, structure imposée, peu de configuration.
Bonsai fait des choix à la place du développeur (nommage, découpage, communication)
pour garantir la cohérence et la lisibilité à l'échelle.

### 3.2 Framework-first

Socle complet, pas une simple bibliothèque.
Bonsai fournit l'architecture, les composants, les conventions
et les garde-fous — le développeur construit *dans* le framework,
pas *autour* d'une librairie.

### 3.3 Flux unidirectionnel strict

Toutes les interactions passent par des Channels.
Le flux suit un chemin prévisible : UI → Command → Feature → Entity → Event → UI.
Aucun raccourci, aucun appel direct entre composants (sauf Entity ↔ Feature, I6).

### 3.4 Découplage par communication événementielle

Aucun composant n'a de référence directe vers un autre (sauf Entity ↔ Feature).
La communication passe exclusivement par les Channels — Commands, Events et Requests.
Le graphe de dépendances est visible dans les déclarations statiques.

### 3.5 Encapsulation stricte du state

Le state vit dans les Entities, gérées exclusivement par les Features.
Personne ne lit le state directement — les consommateurs passent par
`request()` (C5), la Feature contrôle ce qu'elle expose via `reply` (C4).

### 3.6 Testabilité par design

Chaque composant est isolé, avec des responsabilités bien définies.
Les dépendances sont déclarées statiquement → les tests ne montent
que les Channels nécessaires, pas toute l'application.

### 3.7 Lisibilité avant performance

La clarté du code prime sur les micro-optimisations.
Conventions explicites, nommage sémantique, pas de magie.
Le code se lit comme une spécification.

### 3.8 Typage fort et explicite

TypeScript strict, code auto-documenté via les types.
Les contrats sont définis par les types (TChannelDefinition, TStructure),
le compilateur vérifie les invariants à la compilation.

> **Prérequis fondamental** : Bonsai impose **TypeScript** comme langage de développement.
> Ce n'est pas une recommandation, c'est un prérequis.
>
> Cette contrainte permet de déplacer de nombreuses vérifications du runtime
> vers le compile-time :
> - Handlers/repliers manquants → `implements TRequiredCommandHandlers<T>`
> - Payloads incorrects → typage générique
> - Channels non déclarés → déclarations statiques (`params` ADR-0024, `static readonly` Features)
>
> Voir [ADR-0003](../adr/ADR-0003-channel-runtime-semantics.md) pour le détail.

### 3.9 Dépendances déclaratives et statiques

Tout composant (Feature, View, Behavior) **DOIT** déclarer dans sa définition
les Channels avec lesquels il interagit (D1). Aucun accès dynamique à un Channel
n'est permis au runtime. Les dépendances de communication sont visibles
dans la signature du composant, pas cachées dans son implémentation.

**Conséquences** :
- Le graphe de communication est lisible dans le code sans l'exécuter
- Les invariants sont vérifiables à la compilation (TypeScript)
- Les tests ne montent que les Channels déclarés
- L'infrastructure (Radio) reste interne au framework

> Voir [ADR-0003](../adr/ADR-0003-channel-runtime-semantics.md) pour le détail.

---

## Lecture suivante

→ [Architecture — Vue d'ensemble](2-architecture/README.md) — taxonomie des composants, organisation en couches
