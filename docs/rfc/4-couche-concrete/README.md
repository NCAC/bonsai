# Couche concrète — Composants éphémères

> **Foundation, Composer, View, Behavior — ce qui touche le DOM**

[← Retour à l'index](../README.md) · [← Couche abstraite](../3-couche-abstraite/README.md)

---

## Vue d'ensemble

La couche concrète contient les composants qui **gèrent le DOM**. Ils sont créés et détruits au gré des changements de route, de l'état applicatif, ou des décisions des Composers. Leur cycle de vie est éphémère — seule la couche abstraite persiste.

### Caractéristiques communes

- **Éphémères** : créés et détruits dynamiquement (sauf Foundation)
- **Liés au DOM** : chaque instance gère un élément ou une région HTML
- **Pilotés par la couche abstraite** : réagissent aux événements et au state des Features
- **Trois niveaux d'altération DOM** (D26) : N1 (attributs, classes, texte), N2 (insertion/suppression de nœuds), N3 (remplacement de sous-arbre complet)

---

## Composants

L'ordre suit le **flux physique du DOM**, du parent vers l'enfant :

| # | Composant | Rôle | Altérations DOM | Document |
|---|-----------|------|----------------|----------|
| 1 | **Foundation** | Point d'ancrage `<body>`, singleton persistant | N1 uniquement | [foundation.md](foundation.md) |
| 2 | **Composer** | Décideur de rendu : `resolve()` → quelle View ? | — (pas d'accès DOM direct) | [composer.md](composer.md) |
| 3 | **View** | Rendu et interaction UI, template PDR | N1, N2, N3 (via templates) | [view.md](view.md) |
| 4 | **Behavior** | Plugin UI réutilisable, aveugle au métier | N1, N2 (jamais N3 — I45) | [behavior.md](behavior.md) |

> **Foundation en premier** : c'est le `<body>`, la racine de tout le rendu. Les Composers y sont attachés, les Views sont résolues par les Composers, et les Behaviors enrichissent les Views.

---

## Flux de vie typique

```
Foundation (body, persistant)
  └─ Composer (décide)
       └─ View (affiche, éphémère)
            ├─ Behavior A (enrichit)
            └─ Behavior B (enrichit)
```

1. **Foundation** démarre au bootstrap — elle est le seul composant concret persistant
2. **Composer** écoute un événement Feature et appelle `resolve()` pour décider quelle View instancier
3. **View** est créée, son template PDR est projeté, ses UIEvents sont câblés
4. **Behavior** est auto-découvert depuis les déclarations de la View et s'attache à ses éléments (altérations N1/N2)

---

## Ordre de lecture recommandé

1. [foundation.md](foundation.md) — le point d'entrée concret
2. [composer.md](composer.md) — comment le framework décide quoi afficher
3. [view.md](view.md) — le composant le plus riche (templates, events, localState)
4. [behavior.md](behavior.md) — les plugins UI réutilisables

---

## Lecture suivante

→ [5-rendu.md](../5-rendu.md) — PDR, templates PugJS, ProjectionList
