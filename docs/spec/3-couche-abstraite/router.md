# Router

> 🟠 **Livré sur le noyau (lot M6.3a, 1er novembre 2026), aligné sur la théorie V0.9.5 (D15, annexe B.5, C.4).** Reste hors périmètre : correspondance de routes à motifs (`params`), gardes, routes imbriquées. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Feature de navigation fournie par le framework — namespace réservé `router`**

[← Retour à la couche abstraite](README.md)

---

> Décision : [ADR-13](../../adr/ADR-13-router.md), précisée par D15. Namespace `router` réservé (I28, I71). Paquet `@bonsai/router`.

## 1. Rôle et partage des responsabilités

| Composant | Possède | Ne fait pas |
| --- | --- | --- |
| `RouterFeature` (`router`) | l'**état de navigation** (chemin, paramètres de requête, fragment) | toucher l'adresse de l'hôte |
| `HistoryAdapter` (`history`) | l'**adresse** et l'historique de session (D7) ; adaptateur de l'interface utilisateur | décider de la navigation |

Les deux sont activés par le Manifest de l'`Application`, hors des `features` applicatives (la clé `router` y est refusée, I71) :

```typescript
new Application({
  document,
  router: true,                 // Feature de navigation (D15)
  adapters: [HistoryAdapter],   // adaptateur historique (D7) ; exige `router`
  features: { /* … */ },
  foundation: AppFoundation
});
```

`RouterFeature` porte `static readonly framework = true`, seule voie pour prendre un namespace réservé ; l'`Application` est la seule à l'instancier. L'adaptateur historique est une catégorie (B.3) : deux adaptateurs de la même catégorie sont refusés. `adapterOptions: { history: { traversalTimeoutMs } }` fixe ses paramètres de création (sérialisables).

## 2. Contrat (D15)

| Message | Forme | Émetteur → récepteur |
| --- | --- | --- |
| Command `router:navigate` | `{ location, mode }` | interface (View, adaptateur) → Feature |
| Event `router:routeChanged` | `{ route, mode }` | Feature → abonnés (l'adaptateur projette l'adresse) |
| Query `router:currentRoute` | `null` → `TRoute` | tout composant |

- `location` : chemin de l'application, `"/chemin?clé=valeur#ancre"`. Toute autre forme (`//hôte`, URL absolue, sans `/`) est refusée.
- `route` : `{ path, query, hash }` ; une clé de requête répétée garde sa dernière valeur.
- `mode` : `"push"` (ajouter une entrée), `"replace"` (remplacer l'entrée courante), `"pop"` (suivre un retour ou une avance).
- L'Event part même si la route est inchangée : un `push` vers l'adresse courante demande une nouvelle entrée (B.5).

Un retour ou une avance se **demande à l'adaptateur** (`history:back`, `history:forward`), par une View (A4.b, garde du noyau : un composant du domaine qui adresse une Command à l'adaptateur échoue). Le routeur ne les connaît pas.

## 3. Adaptateur historique

Fiche : [`docs/adaptateurs/historique.md`](../../adaptateurs/historique.md).

- **Commands** `history:push|replace|back|forward|refresh` ; **Query** `history:location` (observation intégrée, jamais une lecture fraîche de l'hôte) ; **Events** `history:navigated|requestResult|refreshed|failed`.
- **Projection** de `router:routeChanged` (B.5) : `push` écrit toujours une entrée ; `replace` écrit si l'adresse diffère ; `pop` n'écrit rien si l'adresse est déjà celle-ci, remplace l'entrée sinon (redirection). L'équivalence porte sur l'adresse **et** l'opération.
- **Monde fermé (C.4)** : seuls `history:back` et `history:forward` produisent un `popstate`, et tous passent par l'adaptateur.
  - aucune traversée engagée : fait **indépendant** (origine spontanée), droit de commander ; relayé en `router:navigate { mode: "pop" }` ;
  - une seule engagée : résultat **corrélé**, il continue la réaction qui l'a demandée et garde son droit (un clic peut commander, un Event relayé non) ;
  - plusieurs engagées : **antécédent inconnu**, aucun droit, rien n'est relayé (D18).
  Une traversée engagée se ferme à la notification de l'hôte ou après `traversalTimeoutMs` (2000 ms par défaut) par un Event `history:failed`.
- **Démarrage** : l'adresse trouvée à la création entre dans le modèle comme fait indépendant ; elle est relayée en `router:navigate { mode: "replace" }`.
- **Extension** : `protected normalize(location)` sur une adresse déjà détachée de l'hôte ; rien d'autre n'est surchargeable (B.4).
- `Application.stop()` retire les observateurs de l'hôte (B.2).

## 4. Flux canonique

```text
1. View (clic, droit de commander) → trigger(router:navigate, { location: "/products/42", mode: "push" })
2. RouterFeature : mutate(route), emit(routeChanged, { route, mode })
3. HistoryAdapter ← routeChanged : écrit l'entrée (effet après validation), puis intègre le résultat
4. Features et Views abonnées à routeChanged réagissent (chorégraphie, ADR-01) ;
   charger les données d'une page vient d'une Feature, pas de la View (D17, D18)
5. Retour de l'utilisateur : popstate indépendant → history:navigated, relais router:navigate { mode: "pop" } → 2.
```

## 5. Limites connues

- Pas de `params` de route (motifs `/products/:id`) : D15 ne les porte pas ; la Feature de navigation d'une application peut les dériver de `route.path`.
- `hashchange` n'est pas écouté seul ; un changement d'ancre provoque aussi `popstate`.
- La fenêtre de non-clôture d'une traversée est une durée, non un identifiant de l'hôte (fiche, rubrique 30).
- Deux `routeChanged` successifs avant que le résultat du premier soit intégré comparent à l'observation précédente.
- Pas de destruction de la racine : seul `stop()` retire les observateurs.

---

## Lecture suivante

→ [Couche concrète](../4-couche-concrete/README.md) — Foundation, Composer, View, Behavior
