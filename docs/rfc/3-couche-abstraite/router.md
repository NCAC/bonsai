# Router

> **Spécialisation Feature pour la navigation — namespace réservé `router`**

[← Retour à la couche abstraite](README.md)

---

> **⚠ État du document (2026-05-13)** — Le Router est une Feature **strate 2+**
> non encore implémentée. Les exemples de ce document datent d'avant
> [ADR-0039](../../adr/ADR-0039-namespace-authority-and-uniqueness.md)
> (manifest applicatif typé) et [ADR-0040](../../adr/ADR-0040-typescript-first-api-channel-definition-typed.md)
> (Channel générique). Les patterns illustrés (`static readonly namespace`,
> `Feature<TEntity, TChannel>`) doivent être lus comme **historiques**.
>
> Les briques courantes à utiliser au moment de la livraison du Router seront :
>
>   - **Feature** : `class extends Feature<E, TDef, "router">` + `static readonly channel: TChannelToken<TDef, "router">` (ADR-0040). Plus de `static namespace` (I68).
>   - **Identité** : la clé `"router"` du manifest applicatif est l'autorité unique du namespace, réservée par le framework (I28, I68).
>
> Le document sera réécrit à la livraison du Router.

---

> **D8** : le Router est une spécialisation interne de Feature.
> **I28** : le namespace `router` est réservé — aucune Feature utilisateur ne peut l'utiliser.

## 1. Classe RouterFeature

Le Router est une Feature **instanciée par le framework**, pas par le développeur.
Il encapsule l'accès exclusif à l'History API du navigateur.

```typescript
// TRouterDef est le SEUL nom utilisé dans ce document — cf. §4 pour le
// contenu complet (commands/events/requests). Pas de champ `namespace` sur
// ce type : le namespace vit sur le token (ADR-0040), jamais sur la
// définition du Channel elle-même.
type TRouterDef = TChannelDefinition & {
  // ... commands/events/requests de navigation, cf. §4
};

class RouterFeature extends Feature<RouteEntity, TRouterDef, "router"> {
  // Namespace "router" réservé (I28) — porté par le token typé (ADR-0040), pas par `static namespace` (I68)
  static readonly channel: TChannelToken<TRouterDef, "router"> = { namespace: "router" };
}
```

| Aspect | Détail |
|--------|--------|
| **Instanciation** | Par Application au bootstrap — pas par `register()` |
| **Namespace** | `router` — réservé (`RESERVED_NAMESPACES`, I71) |
| **History API** | Accès exclusif — aucun autre composant ne touche `window.history` |
| **Entity** | `RouteEntity` — contient l'URL courante, les params, la query |

> 🧭 **Question ouverte, non résolue par ce document** : `router` étant
> réservé, `StrictManifest<M>` résout toute clé `router` du value-manifest en
> `never` (I71) — un développeur ne peut donc **pas** écrire `router:
> RouterFeature` dans son manifest applicatif comme pour une Feature
> ordinaire. Le mécanisme par lequel `Application` instancie et enregistre
> `RouterFeature` (probablement une injection hors manifest, similaire à
> `Foundation`) reste à spécifier au moment de l'implémentation — ne pas
> présumer qu'il réutilise le chemin `satisfies StrictManifest<AppManifest>`.

---

## 2. API de navigation

> **Périmètre v1** : l'API ci-dessous est **stable mais minimale**. Les patterns avancés
> (guards, lazy-loading de routes, nested routing) seront formalisés dans une annexe
> dédiée si le besoin se confirme à l'usage.

### Commands (trigger par les Views/Behaviors)

| Command | Payload | Description |
|---------|---------|-------------|
| `router:navigate` | `{ path: string, params?: Record<string, string> }` | Navigation programmatique |
| `router:back` | `void` | Historique arrière |
| `router:forward` | `void` | Historique avant |

### Events (emit par le Router)

| Event | Payload | Description |
|-------|---------|-------------|
| `router:routeChanged` | `TRouteState` | Émis après chaque changement de route |

> Les Features qui réagissent à la navigation écoutent `router:routeChanged`.
> C'est le mécanisme standard pour le chargement de données par route.

### Requests

| Request | Params | Result | Description |
|---------|--------|--------|-------------|
| `router:currentRoute` | `void` | `TRouteState` | Lecture de la route courante |

---

## 3. Entity Route

```typescript
type TRouteState = TJsonSerializable & {
  /** URL courante (pathname) */
  path: string;
  /** Paramètres de route (ex: { id: '42' }) */
  params: Record<string, string>;
  /** Query string parsée */
  query: Record<string, string>;
  /** Fragment (hash) */
  hash: string;
};

class RouteEntity extends Entity<TRouteState> {
  // Entity est abstraite — defineInitialState() est obligatoire (D17).
  protected defineInitialState(): TRouteState {
    return { path: "/", params: {}, query: {}, hash: "" };
  }
}
```

---

## 4. Messages standards — TRouterDef

```typescript
// Même type que celui esquissé en §1 — défini en entier ici (co-localisation D13).
// Pas de champ `namespace` (ADR-0040) : il vit sur TChannelToken<TRouterDef, "router">.
type TRouterDef = TChannelDefinition & {
  readonly commands: {
    navigate: { path: string; params?: Record<string, string> };
    back: void;
    forward: void;
  };

  readonly events: {
    routeChanged: TRouteState;
  };

  readonly requests: {
    currentRoute: { params: void; result: TRouteState };
  };
};
```

---

## 5. Flux de navigation canonique

```
1. View → trigger(router:navigate, { path: '/products/42' })
2. RouterFeature ← handle(router:navigate)
3. RouterFeature → window.history.pushState(...)
4. RouterFeature → entity.mutate("router:navigate", draft => { draft.path = '/products/42'; draft.params = { id: '42' }; })
5. RouterFeature → emit(routeChanged, { path, params, query, hash })
6. ProductFeature ← listen(router:routeChanged) → fetch('/api/products/42') → entity.mutate("product:load", draft => { ... })
7. ProductFeature → emit(loaded, {...})
8. ProductView ← listen(product:loaded) → re-projection
```

> Le Router **ne connaît pas** les Features qui écoutent ses Events.
> C'est de la chorégraphie pure (D2) : chaque Feature réagit de manière autonome
> au changement de route.

---

## Lecture suivante

→ [Couche concrète](../4-couche-concrete/README.md) — Foundation, Composer, View, Behavior
