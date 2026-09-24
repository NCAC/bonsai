# ADR-13 — Router : Feature framework spécialisée

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I28, I71 |
| **Livré** | ⚠️ partiel — seul le namespace réservé `router` existe · Router ⏳ strate 2 |
| **Spec** | [router.md](../spec/3-couche-abstraite/router.md) |

## Contexte

La navigation touche un état global (URL, `window.history`) que plusieurs
domaines lisent. Si chaque composant manipule l'History API, l'URL devient un
state partagé non encapsulé, en contradiction avec I30 (domain state
uniquement dans une Entity).

## Décision

Le Router est une **Feature framework** (`RouterFeature extends Feature<RouteEntity, TRouterDef, "router">`) :

- **namespace réservé `router`** (`RESERVED_NAMESPACES`) : aucune Feature applicative ne peut le prendre (I28, I71) ;
- **accès exclusif à l'History API** : aucun autre composant ne touche `window.history` ;
- **instancié par `Application`**, pas déclaré par le développeur dans son manifest ;
- l'état de navigation (URL, params, query) vit dans `RouteEntity`. Les autres composants l'observent comme n'importe quel Channel (listen, request) et naviguent par Command.

## Alternatives rejetées

- **Router = Feature ordinaire écrite par l'application** — rien n'empêche deux Features de se disputer l'History API.
- **Router = composant hors modèle (service global)** — introduit un getter global, contraire à « Explicit > Implicit ».

## Questions ouvertes (à trancher à la livraison)

- **Enregistrement** : `StrictManifest<M>` résout la clé `router` en `never`. Il faut définir l'injection hors manifest (option d'`Application` ou ajout automatique) et la manière dont les consommateurs obtiennent le token typé.
- Contrat du Channel `router` (commands de navigation, events, requests) : à écrire dans la spec au moment de l'implémentation.
