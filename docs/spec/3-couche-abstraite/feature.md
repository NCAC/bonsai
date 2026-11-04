# Feature

> **Unité métier : enfant de la racine, handlers à contexte auto-découverts, état détenu par le noyau**

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lots M6.1 et M6.3, 1er novembre 2026).** Strate 1b : contexte causal lu par `ctx.cause` (ADR-04). Reste à livrer : `onDestroy` (voir §9) ; pas de hook `onError`, écarté par l'ADR-05. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

[← Retour à la couche abstraite](README.md) · [← Communication](../2-architecture/communication.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Feature |
| **Couche** | Abstraite (persistante : elle vit autant que sa racine) |
| **Paquet** | `@bonsai/feature` |
| **Décisions** | [ADR-01](../../adr/ADR-01-channels-tri-lane.md), [ADR-08](../../adr/ADR-08-namespace-manifest.md), [ADR-09](../../adr/ADR-09-feature-contract.md), [ADR-14](../../adr/ADR-14-contrats-types.md) ; théorie 11.2, A3, A4.a, D4, D16, D17 |

## Table des matières

1. [Rôle](#1-rôle)
2. [Déclarer une Feature](#2-déclarer-une-feature)
3. [Handlers et contextes](#3-handlers-et-contextes)
4. [L'Entity et ses notifications](#4-lentity-et-ses-notifications)
5. [Démarrage et dépendances](#5-démarrage-et-dépendances)
6. [Manifest et identité](#6-manifest-et-identité)
7. [Contrats typés](#7-contrats-typés)
8. [Échecs](#8-échecs)
9. [Non livré](#9-non-livré)

---

## 1. Rôle

Une Feature est l'**unité métier** du domaine. Elle possède un **Channel** (un namespace, A3.b) et exactement **une Entity** (D4). Elle est un enfant de la racine (`Root`, une par Application, G6).

- Elle **reçoit** des Commands sur son Channel et des Events des Channels qu'elle écoute.
- Elle **répond** à des Queries (lecture seule, synchrones).
- Elle **émet** des Events sur son propre Channel seulement (A3.e).
- Elle **ne commande jamais** : son contexte n'offre pas de `trigger` (D17). Les Features se coordonnent par chorégraphie, en réagissant aux Events les unes des autres.

Chaque handler s'exécute dans une **unité de validation** (G7) : mutations et émissions d'un handler prennent effet ensemble après validation, ou pas du tout. Les messages émis ne sont délivrés qu'après (G5).

## 2. Déclarer une Feature

```typescript
class CartFeature
  extends Feature<CartEntity, TCartChannelDef, "cart">
  implements TFeatureCallbacks<TCartChannelDef, typeof cartListens, CartEntity>
{
  // Channel propre : namespace et Events que la Feature PEUT émettre (A3.e, D16).
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
    namespace: "cart",
    events: ["itemAdded"]
  };

  // Channels externes dont elle reçoit les Events, et dont elle lit les Queries.
  get listens() { return cartListens; }
  get queries() { return [PricingFeature.channel] as const; }     // permission d'interroger
  get dependsOn() { return [PricingFeature.channel] as const; }   // facultatif : interrogée pendant onInit (C.1)

  protected get Entity() { return CartEntity; }                 // liaison Feature → Entity (ADR-09)

  onAddItemCommand(payload: TCartItem, ctx: TFeatureContext<TCartChannelDef, CartEntity>): void {
    ctx.mutate("addItem", (draft) => { draft.items.push(payload); });
    ctx.emit("itemAdded", { item: payload });
  }

  onGetItemCountQuery(_params: null, ctx: TFeatureQueryContext): number {
    return this.entity.query.getItemCount();
  }
}
```

- `static readonly channel` identifie la **classe** (une View ou une autre Feature la nomme sans instance, I73) ; `listens` et `queries` sont des `abstract get` d'**instance** (I93) : omettre l'un est une erreur de compilation (TS2515).
- **Tout ce qu'une Feature peut émettre est déclaré** à sa création (D16) : `events` du jeton. Une émission non déclarée échoue (`UNDECLARED_MESSAGE`).
- Le constructeur est **inerte** (I94) : il valide et retient le namespace, rien d'autre. L'Entity est créée au démarrage.
- Pas de `static namespace` : l'identité est la clé du Manifest (I68, I69).

## 3. Handlers et contextes

Les handlers sont **découverts par leur nom** (I48), y compris ceux hérités d'une classe ancêtre (l'implémentation la plus dérivée gagne). Ils reçoivent le contexte comme second argument.

| Message reçu | Handler | Second argument |
| --- | --- | --- |
| Command `ns:addItem` sur son Channel | `onAddItemCommand(payload, ctx)` | `TFeatureContext` |
| Event `ns:itemAdded` d'un Channel écouté | `on{Ns}{ItemAdded}Event(payload, ctx)` | `TFeatureContext` |
| Query `ns:getCount` | `onGetCountQuery(params, ctx)` | `TFeatureQueryContext` |
| Changement de l'Entity | `on{Clé}EntityUpdated`, `onAnyEntityUpdated` (§4) | `TFeatureContext` |

```typescript
type TFeatureQueryContext = {
  readonly cause: TCausalContext;            // contexte causal de la délivrance, gelé (ADR-04)
  query<T>(token, name, params): T;          // lecture seule, synchrone (A3.g)
};
type TFeatureContext<TDef, TEntity> = TFeatureQueryContext & {
  emit(event, payload): void;                // sur son propre Channel, délivré après validation (G5)
  mutate(intent, recipe): TEntityEvent | null;          // null si la recette ne change rien
  mutate(intent, { payload? }, recipe): TEntityEvent | null;  // TEntityEvent.context = ctx.cause
};
```

- **`ctx.query`** : synchrone. Une cible absente, non prête ou occupée est une erreur de transport qui **fait échouer l'unité** (G7), même si l'auteur l'intercepte. Elle ne rend jamais `null` pour « inconnu ».
- **`ctx.mutate`** : applique une recette Immer sur l'état que le noyau possède ; l'effet est journalisé et annulé si l'unité échoue. Les invariants de l'Entity sont vérifiés à la fin de l'unité (A4.a).
- **`ctx.emit`** : l'Event est capturé par valeur et délivré aux abonnés présents à l'émission (D8).
- Pas de `trigger` (D17). Une Query reçue ne peut ni émettre ni muter (A3.g).
- La conformité des handlers aux contrats est vérifiée à la compilation par `implements TFeatureCallbacks<…>` (I92, I88). Il n'y a pas de filet à l'exécution : `listens` ne porte que des jetons de Channel, non les noms d'Events attendus.

## 4. L'Entity et ses notifications

L'Entity **décrit** l'état (état initial, invariants, méthodes de lecture) ; le **noyau le détient**. `this.entity.state` n'est lisible que pendant un handler de la Feature propriétaire ; hors handler, l'état s'observe par une Query (I6, [entity.md](entity.md)).

Chaque `ctx.mutate` qui change l'état envoie à la Feature un **message local différé** (G5, D8) :

1. `on<Clé>EntityUpdated(previous, next, patches, ctx)` pour chaque clé modifiée, par ordre alphabétique ;
2. puis `onAnyEntityUpdated(event, ctx)` si présent.

Chacun s'exécute dans sa **propre unité**, après celle qui a muté. Un handler de notification qui lève échoue seul : la mutation, déjà validée, reste. Une clé inconnue dans `on<Clé>EntityUpdated` est refusée **avant** le démarrage du noyau (I96, `BonsaiError`).

## 5. Démarrage et dépendances

`Application.start()` décrit chaque Feature au noyau (`describeFeature`) et crée la racine. La Feature est créée dans l'**unité de démarrage** (§2.5) : l'Entity existe, les handlers sont enregistrés, puis `onInit(ctx)` s'exécute avec le même contexte qu'un handler (I56). Si le démarrage échoue, le modèle en construction est abandonné (`StartupError`).

`queries` est une **permission** d'interroger ; elle ne fixe aucun ordre. Deux Features peuvent se déclarer mutuellement en `queries` sans cycle.

`dependsOn` déclare les **dépendances initiales** (C.1) : les Features que celle-ci interroge **pendant son unité de démarrage**. Une Feature démarre après celles dont elle dépend, quel que soit l'ordre du Manifest ; à défaut, l'ordre du Manifest décide. Chaque entrée de `dependsOn` doit figurer aussi dans `queries` (`FEATURE_DEPENDENCY_NOT_QUERIED` sinon). Un cycle de `dependsOn`, ou une cible inconnue, est refusé avant tout démarrage (`ManifestError`, `NAMESPACE_UNKNOWN_REFERENCE`). `listens` ne crée aucune dépendance.

Une Query adressée pendant l'initialisation à une Feature qui n'est pas prête, faute de `dependsOn`, est refusée (`TARGET_NOT_READY`) et fait échouer le démarrage.


## 6. Manifest et identité

```typescript
const features = {
  cart: CartFeature,
  user: UserFeature
} satisfies StrictManifest<AppManifest>;

new Application({ features, document, foundation: AppFoundation, router: true });
```

- La **clé** du Manifest est le namespace (I68–I69). Il est camelCase (I21), non réservé (`local`, `router`, I71) et accordé à `TSelfNS` de la classe (I72) ; `StrictManifest<M>` le vérifie à la compilation, `Application` en filet à l'exécution (`BonsaiNamespaceError`).
- Chaque référence à un namespace externe est validée contre le Manifest (I70) avant le démarrage.
- `router` est fourni par le framework, hors Manifest ([router.md](router.md)).

## 7. Contrats typés

```typescript
type TCartChannelDef = {
  commands: { addItem: TCartItem };
  events:   { itemAdded: { item: TCartItem } };
  queries:  { getItemCount: { params: null; result: number } };
};
```

- `TChannelDefinition` a trois voies : `commands`, `events`, `queries` (ADR-14). Elle est **co-localisée** avec la Feature (I74) ; elle ne porte pas de namespace (il vit sur le jeton).
- Une View ou un Composer déclare les Features qu'il touche par des **contrats** (`TFeatureContract` : `listens`, `triggers`, `queries`) : les clés `ns:nom` sont typées, `payload` et `params` inférés (I81, I87). Le Composer n'a pas de voie `triggers` (D12) : il vérifie `TQueryableContract`.
- Les types utilitaires (`TFlatListens`, `TFlatTriggers`, `TFlatQueries`, `TCommandPayloadFor`, `TEventPayloadFor`, `TQueryParamsFor`, `TQueryResultFor`) calculent les clés plates à partir du contrat.

## 8. Échecs

| Situation | Effet |
| --- | --- |
| Un handler lève | L'unité échoue : mutations, émissions et Commands préparées sont annulées (G7) ; l'échec figure dans la trace du noyau |
| Un handler intercepte l'échec d'une `ctx.query` | L'unité échoue quand même (`UNRECOVERABLE`) |
| Invariant de l'Entity violé | L'unité échoue (`InvariantError`) |
| Emission non déclarée, Query depuis une Query, hors unité | Erreur de transport (`TransportError`, une `BonsaiError` ; codes dans [erreurs.md](../2-architecture/erreurs.md)) |
| Handler de notification d'Entity qui lève | Échoue seul ; la mutation reste |
| Échec au démarrage | La racine est abandonnée (`StartupError`) |
| Profondeur causale au-delà de la borne | Le message n'est pas délivré (D9) |

Il n'existe plus d'isolation par `BroadcastError`, `CommandError` ni `RequestError` : la frontière d'échec est l'unité de validation.

## 9. Non livré

| Élément | Statut |
| --- | --- |
| `onDestroy()`, états `destroying`/`destroyed` | Cible |
| `onInit()` asynchrone | Hors périmètre (le démarrage est synchrone) |

---

## Lecture suivante

→ [Entity](entity.md) — état, invariants, notifications · [Application](application.md) — démarrage et Manifest
