# ADR-07 — Application : instance dormante, bootstrap par phases

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I23, I56 |
| **Livré** | ✅ `start()` · ⏳ arrêt complet (`stop()` ne retire que les observateurs de l'hôte) et `serverState` (strate 2) |
| **Spec** | [application.md](../spec/3-couche-abstraite/application.md) · [lifecycle.md](../spec/2-architecture/lifecycle.md) |

## Contexte

Le démarrage implique la racine du noyau, les Features, leurs Entities puis la
couche DOM. Sans ordre explicite, une Feature peut recevoir un message avant
d'être prête, ou une View se monter avant que la couche abstraite ne soit
prête. Il faut aussi un point unique où les garanties compile-time
contournables (`as any`, JS pur) sont revérifiées.

## Décision

`Application` est une **instance légère**, active au bootstrap et au shutdown,
**dormante au runtime** : aucune logique métier, aucun rôle entre les deux (I23).

```ts
new Application({ foundation: AppFoundation, features, document }).start();
```

`start()` exécute des phases strictement ordonnées :

| Phase | Rôle | Side-effect sur le noyau |
| --- | --- | --- |
| 0a | Validation du manifest : format camelCase, noms réservés, cohérence `static channel` (ADR-08) | aucun |
| 0b | Instanciation pure des Features (ctor inerte — ADR-09) | aucun |
| 0c | Lecture `instance.listens` / `instance.queries`, validation des références croisées (I70) | aucun |
| 1 | Création de la racine du noyau (`Root`, une par Application, G6) ; les Features y démarrent dans l'ordre de leurs `dependsOn` (C.1) : Entity, auto-discovery des handlers, `onInit()`, dans l'unité de démarrage | oui |
| 2 | Foundation (si présente) → Composers → Views, dans la même unité de démarrage | DOM |

La couche abstraite est **intégralement active** avant la création de la couche
concrète (I56). `start()` est la **frontière de confiance** : avant, aucune
garantie runtime ; après, les garanties compile-time sont revérifiées (I66).
Un second appel à `start()` lève une erreur. `document` est requis dès qu'il y a une
Foundation ou des adaptateurs ; `router: true` active la Feature de navigation (ADR-13).

Les phases 0a–0c sont sans side-effect : un manifest invalide échoue avant
que la racine du noyau ne soit créée.

## Alternatives rejetées

- **Application orchestrateur actif** (routeur de messages, médiateur) — recrée un god-object ; la chorégraphie vit dans les Features (ADR-01).
- **Bootstrap implicite par `import`** — ordre non garanti, erreurs non localisées.
- **Phases configurables (hooks `beforePhase`/`afterPhase`, config distante)** — écarté pour la v1 ; aucun cas d'usage ne le justifie.

## Conséquences

- Les erreurs de bootstrap sont localisées par phase et levées **avant** tout effet observable.
- La phase 1 démarre les Features dans l'ordre de leurs `dependsOn` (C.1), à défaut dans l'ordre du manifest. Une Query adressée depuis `onInit()` à une Feature qui n'est pas encore prête, faute de `dependsOn`, est refusée (`TARGET_NOT_READY`) et fait échouer le démarrage.
- `stop()` ne retire aujourd'hui que les observateurs de l'hôte ; l'arrêt complet de la racine (ordre inverse) et le pré-peuplement SSR (`serverState`, ADR-24) restent à livrer.
