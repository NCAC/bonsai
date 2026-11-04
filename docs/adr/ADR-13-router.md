# ADR-13 — Router : Feature de navigation fournie par le framework

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I28, I71 |
| **Livré** | ✅ `RouterFeature` et `HistoryAdapter` (`@bonsai/router`, lot M6.3a), gate `tests/e2e/navigation-round-trip.test.ts` · ⏳ routes à motifs (`params`), gardes, routes imbriquées, exportés par `@bonsai/core` |
| **Spec** | [router.md](../spec/3-couche-abstraite/router.md) · théorie D7, D15, annexe B.5, C.4 |

## Contexte

La navigation touche un état global (l'adresse, l'historique de session) que
plusieurs domaines lisent. Si chaque composant manipule l'History API, l'adresse
devient un état partagé non encapsulé, en contradiction avec I30 (domain state
uniquement dans une Entity), et un retour arrière n'a plus de cause établie.

## Décision

**Deux composants, deux responsabilités** (D7, D15) :

- **`RouterFeature`**, namespace réservé `router` (`RESERVED_NAMESPACES`, I28, I71) : possède l'**état de navigation** (`{ path, query, hash }`) et ne touche pas l'hôte. Contrat : Command `router:navigate { location, mode }`, Event `router:routeChanged { route, mode }`, Query `router:currentRoute`.
- **`HistoryAdapter`**, adaptateur de l'interface (`history`) : seul à toucher l'adresse et l'historique ; il projette `routeChanged` sur l'adresse et relaie les retours et avances de l'utilisateur en `router:navigate { mode: "pop" }`.

Tous deux sont **activés par l'Application**, hors du manifest applicatif
(la clé `router` y est refusée) :

```ts
new Application({ document, router: true, adapters: [HistoryAdapter], features, foundation: AppFoundation });
```

`RouterFeature` porte `static readonly framework = true`, seule voie pour prendre
un namespace réservé. Les autres composants l'écoutent et l'interrogent comme
n'importe quelle Feature, et naviguent par Command depuis un fait de l'hôte (D18).

## Alternatives rejetées

- **Router = Feature ordinaire écrite par l'application** — rien n'empêche deux Features de se disputer l'History API.
- **Router = composant hors modèle (service global)** — introduit un getter global, contraire à « Explicit > Implicit ».
- **Une seule Feature qui possède état et adresse** — mêle domaine et hôte ; un retour arrière n'aurait pas de source admise (C.4).

## Conséquences

- Un lien relayé à `router:navigate` doit déclarer l'annulation de son clic (`cancelDefault`, D20), sinon l'hôte charge l'adresse.
- Charger les données d'une page revient à une Feature qui écoute `routeChanged` (D17), pas à la View.
- Un `popstate` est qualifié par le monde fermé (C.4) : indépendant, corrélé à une traversée demandée, ou d'antécédent inconnu ; ce dernier n'ouvre aucun droit de commander et n'est pas relayé.
