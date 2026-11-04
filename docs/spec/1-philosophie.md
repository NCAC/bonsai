# Philosophie du framework Bonsai

> 🟢 **Aligné sur la théorie V0.9.5 (4 novembre 2026).** Ce chapitre pose le pourquoi ; le modèle formel est la [théorie](../theorie.md), qui prévaut en cas d'écart ([règle de confiance](../README.md#règle-de-confiance-et-dalignement)).

> **Pourquoi Bonsai existe — contexte, objectifs et principes fondateurs**

[← Retour à l'index](README.md)

---

## 1. Contexte et motivation

### Pourquoi cette spécification ?

Le framework Bonsai repose sur des choix architecturaux forts et opinionated.
Avant toute implémentation, il est indispensable de poser formellement :

- les **composants** du framework et leurs **responsabilités exclusives** ;
- les **frontières** entre composants — ce que chacun peut et ne peut pas faire ;
- les **règles de communication** — qui parle à qui, par quel mécanisme ;
- les **invariants non négociables** qui garantissent la cohérence du système.

Ce document constitue le _quoi_ architectural : il définit les pièces du puzzle
et comment elles s'emboîtent, indépendamment du _comment_ (API TypeScript,
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
et les garde-fous — le développeur construit _dans_ le framework,
pas _autour_ d'une librairie.

### 3.3 Flux unidirectionnel strict

Toutes les interactions passent par la racine du noyau, selon des contrats de Channel déclarés.
Le flux suit un chemin prévisible : fait du DOM → View → Command → Feature → Entity → Event → View.
Seul le handler d'un fait du DOM commande ; un handler d'Event interroge mais ne commande pas (D18).
Chaque traitement est une unité de validation : il réussit entièrement ou est défait (G7).
Aucun raccourci, aucun appel direct entre composants (sauf Entity ↔ Feature, I6).

### 3.4 Découplage par communication événementielle

Aucun composant n'a de référence directe vers un autre (sauf Entity ↔ Feature).
La communication passe exclusivement par la racine du noyau — Commands, Events et Queries.
Le graphe de dépendances est visible dans les déclarations statiques.

### 3.5 Encapsulation stricte du state

Le state vit dans les Entities, détenues par le noyau et mutées exclusivement
par leur Feature (`ctx.mutate`). Personne d'autre ne lit le state : les
consommateurs l'interrogent par une Query (`ctx.query`, C5), et la Feature
contrôle ce qu'elle expose par ses handlers `on{Nom}Query` (C4). Une Query est
synchrone et rend une copie (G2, G5).

### 3.6 Testabilité par design

Chaque composant est isolé, avec des responsabilités bien définies.
Les dépendances sont déclarées statiquement → les tests ne montent
que les contrats nécessaires, pas toute l'application.

> **Les tests sont une preuve d'architecture** ([ADR-32](../adr/ADR-32-tests-preuve-architecture.md)) :
> chaque test documente explicitement l'invariant qu'il prouve — un test
> n'est pas seulement une garantie de non-régression, c'est une démonstration
> vérifiable qu'une frontière ou une règle du framework est respectée.

### 3.7 Lisibilité avant performance

La clarté du code prime sur les micro-optimisations.
Conventions explicites, nommage sémantique, pas de magie.
Le code se lit comme une spécification.

### 3.8 Typage fort et explicite

> **Le type EST le contrat.** Un développeur Bonsai ne devrait jamais avoir
> besoin de lire une RFC pour utiliser correctement l'API — IntelliSense et
> les erreurs du compilateur suffisent.

TypeScript, code auto-documenté via les types.
Les contrats sont définis par les types (TChannelDefinition, TStructure),
le compilateur vérifie les invariants à la compilation.

> ⚠️ **Configuration livrée** : aucun `tsconfig` du dépôt n'active `strict`, et
> le contrat `Feature<TEntity, …>` ne compile pas sous `strictFunctionTypes`
> ([ADR-14](../adr/ADR-14-contrats-types.md), Conséquences).

> **Prérequis fondamental** : Bonsai impose **TypeScript** comme langage de développement.
> Ce n'est pas une recommandation, c'est un prérequis.
>
> Principe non négociable : **compile-time > runtime** — toute erreur
> détectable à la compilation ne doit jamais atteindre le runtime. Cette
> contrainte permet de déplacer de nombreuses vérifications du runtime
> vers le compile-time :
>
> - Handlers de Command, d'Event ou de Query manquants → `TFeatureCallbacks` et `TStrictFeatureClass` ([feature.md §7](3-couche-abstraite/feature.md#7-contrats-typés), ADR-09, I92) ; handlers de faits et d'Events d'une View → `TViewCallbacks` (ADR-14)
> - Payloads incorrects → typage générique
> - Channels non déclarés → manifest applicatif typé (ADR-08) et `static readonly channel` sur la classe Feature (ADR-14)
> - Commands interdites → un handler d'Event de View n'a pas de `trigger` dans son contexte (D18), une Feature n'en a jamais (D17)
>
> Voir [ADR-03](../adr/ADR-03-channel-runtime.md) pour le détail.

### 3.9 Dépendances déclaratives et statiques

Tout composant (Feature, View, Composer) **DOIT** déclarer dans sa définition
les Channels avec lesquels il interagit (ADR-01) : `get listens()` et `get queries()`
pour une Feature, `get features()` pour une View ou un Composer. Le noyau refuse un
message absent du contrat de sa cible (D16). ⚠️ Une Query de Feature vers un Channel
absent de ses `queries` n'est pas encore refusée au runtime (I17, partiel). Les dépendances de communication sont visibles
dans la signature du composant, pas cachées dans son implémentation.

**Conséquences** :

- Le graphe de communication est lisible dans le code sans l'exécuter
- Les invariants sont vérifiables à la compilation (TypeScript)
- Les tests ne démarrent que les Features déclarées
- L'infrastructure (la racine du noyau) reste interne au framework

> Voir [ADR-03](../adr/ADR-03-channel-runtime.md) pour le détail.

---

## Lecture suivante

→ [Architecture — Vue d'ensemble](2-architecture/README.md) — taxonomie des composants, organisation en couches
