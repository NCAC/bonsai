# Router

> **Spécialisation Feature pour la navigation — namespace réservé `router`**

[← Retour à la couche abstraite](README.md)

---

> **D8** : le Router est une spécialisation interne de Feature.
> **I28** : le namespace `router` est réservé — aucune Feature utilisateur ne peut l'utiliser.

## 1. Classe RouterFeature

Le Router est une Feature **instanciée par le framework**, pas par le développeur.
Il encapsule l'accès exclusif à l'History API du navigateur.

```typescript
class RouterFeature extends Feature<TRouteState, TRouterChannel> {
  static readonly namespace = 'router';  // réservé (I28)
}
```

| Aspect | Détail |
|--------|--------|
| **Instanciation** | Par Application au bootstrap — pas par `register()` |
| **Namespace** | `router` — réservé, collision = erreur (I28) |
| **History API** | Accès exclusif — aucun autre composant ne touche `window.history` |
| **Entity** | `RouteEntity` — contient l'URL courante, les params, la query |

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

class RouteEntity extends Entity<TRouteState> {}
```

---

## 4. Messages standards — TRouterChannel

```typescript
type TRouterChannel = TChannelDefinition & {
  readonly namespace: 'router';

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
4. RouterFeature → entity.mutate({ path: '/products/42', params: { id: '42' } })
5. RouterFeature → emit(router:routeChanged, { path, params, query, hash })
6. ProductFeature ← listen(router:routeChanged) → fetch('/api/products/42') → entity.mutate()
7. ProductFeature → emit(product:loaded, {...})
8. ProductView ← listen(product:loaded) → re-projection
```

> Le Router **ne connaît pas** les Features qui écoutent ses Events.
> C'est de la chorégraphie pure (D2) : chaque Feature réagit de manière autonome
> au changement de route.

---

## Lecture suivante

→ [Couche concrète](../4-couche-concrete/README.md) — Foundation, Composer, View, Behavior
