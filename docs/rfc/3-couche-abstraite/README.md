# Couche abstraite — Composants persistants

> **Application, Feature, Entity, Router — ce qui vit toute la session**

[← Retour à l'index](../README.md) · [← Architecture](../2-architecture/README.md)

---

## Vue d'ensemble

La couche abstraite contient les composants qui **survivent aux changements d'interface**. Ils sont instanciés au bootstrap et persistent jusqu'au shutdown de l'application. Ils ne touchent jamais le DOM directement.

### Caractéristiques communes

- **Persistants** : créés une fois, jamais détruits par un changement de route ou de vue
- **Indépendants du DOM** : aucun `document.querySelector`, aucun élément HTML
- **Propriétaires de la logique métier** : state, communication, orchestration
- **Testables sans navigateur** : exécutables dans Node.js

---

## Composants

| Composant | Rôle | Cardinalité | Document |
|-----------|------|-------------|----------|
| **Application** | Orchestrateur, bootstrap, registre | Singleton | [application.md](application.md) |
| **Feature** | Unité métier autonome, chorégraphe | N instances | [feature.md](feature.md) |
| **Entity** | État encapsulé, `mutate()`, query | 1 par Feature | [entity.md](entity.md) |
| **Router** | Navigation, Feature spécialisée | 0–1 | [router.md](router.md) |

> **Note** : Channel et Radio n'ont pas de fichier dédié. Channel est un **contrat déclaré** dans une Feature (voir [feature.md](feature.md) — capacité C2), pas une classe à instancier. Radio est l'infrastructure interne de câblage (voir [communication.md](../2-architecture/communication.md)).

---

## Ordre de lecture recommandé

1. [application.md](application.md) — le point d'entrée
2. [feature.md](feature.md) — le composant central (5 capacités, Channel inclus)
3. [entity.md](entity.md) — le state encapsulé
4. [router.md](router.md) — la navigation (spécialisation de Feature)

---

## Lecture suivante

→ [Couche concrète](../4-couche-concrete/README.md) — Foundation, Composer, View, Behavior
