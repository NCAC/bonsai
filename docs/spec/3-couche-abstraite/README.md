# Couche abstraite — Composants persistants

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lots M6.1 à M6.3, 1er novembre 2026).** En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Application, Feature, Entity, Router — ce qui vit toute la session**

[← Retour à l'index](../README.md) · [← Architecture](../2-architecture/README.md)

---

## Vue d'ensemble

La couche abstraite contient les composants qui **survivent aux changements d'interface**. Ils sont créés dans l'unité de démarrage de la racine et prennent fin avec elle (A4.e). Ils ne touchent jamais le DOM directement.

### Caractéristiques communes

- **Persistants** : créés une fois, jamais détruits par un changement de route ou de vue
- **Indépendants du DOM** : aucun `document.querySelector`, aucun élément HTML
- **Propriétaires de la logique métier** : état, Commands, Events et Queries ; la coordination est une chorégraphie (D17)
- **Testables sans navigateur** : exécutables dans Node.js

---

## Composants

| Composant | Rôle | Cardinalité | Document |
| --- | --- | --- | --- |
| **Application** | Manifest, bootstrap, arrêt — dormante au runtime | 1 par racine (G6) | [application.md](application.md) |
| **Feature** | Unité métier autonome, chorégraphe | N instances | [feature.md](feature.md) |
| **Entity** | Décrit l'état (initial, invariants, lecture) ; le noyau le détient, `ctx.mutate` l'écrit | 1 par Feature | [entity.md](entity.md) |
| **Router** | Navigation, Feature fournie par le framework (`router: true`) | 0–1 | [router.md](router.md) |

> **Note** : Channel n'a pas de fichier dédié. C'est un **contrat déclaré** dans une Feature (voir [feature.md](feature.md) §7), pas une classe à instancier. L'acheminement des messages appartient à la racine du noyau (`Root`), infrastructure interne (voir [communication.md](../2-architecture/communication.md)).

---

## Ordre de lecture recommandé

1. [application.md](application.md) — le point d'entrée
2. [feature.md](feature.md) — le composant central : handlers, contextes, Channel
3. [entity.md](entity.md) — le state encapsulé
4. [router.md](router.md) — la navigation (spécialisation de Feature)

---

## Lecture suivante

→ [Couche concrète](../4-couche-concrete/README.md) — Foundation, Composer, View, Behavior
