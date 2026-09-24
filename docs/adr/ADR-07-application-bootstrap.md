# ADR-07 — Application : instance dormante, bootstrap par phases

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I23, I56 |
| **Livré** | ✅ `start()` · ⏳ shutdown et `serverState` (strate 2) |
| **Spec** | [application.md](../spec/3-couche-abstraite/application.md) · [lifecycle.md](../spec/2-architecture/lifecycle.md) |

## Contexte

Le démarrage implique Radio, Channels, Entities, Features puis la couche DOM.
Sans ordre explicite, une Feature peut recevoir un message avant que son
Channel existe, ou une View se monter avant que la couche abstraite ne soit
prête. Il faut aussi un point unique où les garanties compile-time
contournables (`as any`, JS pur) sont revérifiées.

## Décision

`Application` est une **instance légère**, active au bootstrap et au shutdown,
**dormante au runtime** : aucune logique métier, aucun rôle entre les deux (I23).

```ts
new Application({ foundation: AppFoundation, features }).start();
```

`start()` exécute des phases strictement ordonnées :

| Phase | Rôle | Side-effect Radio |
| --- | --- | --- |
| 0a | Validation du manifest : format camelCase, noms réservés, cohérence `static channel` (ADR-08) | aucun |
| 0b | Instanciation pure des Features (ctor inerte, sentinel — ADR-09) | aucun |
| 0c | Lecture `instance.listens` / `instance.queries`, validation des références croisées (I70) | aucun |
| 1 | Création d'un Channel par namespace | oui |
| 3 | `feature.bootstrap()` : Entity, auto-discovery des handlers, `onInit()` | oui |
| 4 | `Foundation.attach()` → Composers → Views | DOM |

La couche abstraite est **intégralement active** avant la création de la couche
concrète (I56). `start()` est la **frontière de confiance** : avant, aucune
garantie runtime ; après, les garanties compile-time sont revérifiées (I66).
Un second appel à `start()` lève une erreur.

Les phases 0a–0c sont sans side-effect : un manifest invalide échoue avant
qu'un seul Channel ne soit créé.

## Alternatives rejetées

- **Application orchestrateur actif** (routeur de messages, médiateur) — recrée un god-object ; la chorégraphie vit dans les Features (ADR-01).
- **Bootstrap implicite par `import`** — ordre non garanti, erreurs non localisées.
- **Phases configurables (hooks `beforePhase`/`afterPhase`, config distante)** — écarté pour la v1 ; aucun cas d'usage ne le justifie.

## Conséquences

- Les erreurs de bootstrap sont localisées par phase et levées **avant** tout effet observable.
- ⚠️ La phase 3 enchaîne `bootstrap()` **puis** `onInit()` Feature par Feature, dans l'ordre du manifest. Un `request()` émis depuis `onInit()` vers une Feature placée **plus loin** dans le manifest retourne `null` (Channel créé, replier pas encore enregistré).
- Le shutdown (ordre inverse) et le pré-peuplement SSR (`serverState`, ADR-24) restent à livrer.
