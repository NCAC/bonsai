/**
 * RouterFeature — the Feature of navigation provided by the framework (D15).
 *
 * Namespace `router`, reserved (I71): the Application instantiates it when
 * its Manifest activates navigation; it is not declared among the application
 * Features. It owns the navigation state only. The address belongs to the
 * history adapter (D7): this Feature never touches the host.
 *
 * Contract (the one the history adapter projects, B.5):
 *   - Command `router:navigate { location, mode }`
 *   - Event   `router:routeChanged { route, mode }`
 *   - Query   `router:currentRoute`
 *
 * A return or an advance is requested from the history adapter by a View
 * (`history:back`, `history:forward`, A4.b); the adapter then relays the
 * traversal here as `navigate` with the mode `"pop"`, when it is established
 * independent (C.4).
 */

import { Entity } from "@bonsai/entity";
import type { TChannelToken } from "@bonsai/event";
import { Feature, type TFeatureCallbacks, type TFeatureContext, type TFeatureQueryContext } from "@bonsai/feature";
import { parseLocation, type TNavigationMode, type TRoute } from "./location";

export type TRouterDef = {
  commands: { navigate: { location: string; mode: TNavigationMode } };
  events: { routeChanged: { route: TRoute; mode: TNavigationMode } };
  queries: { currentRoute: { params: null; result: TRoute } };
};

export class RouteEntity extends Entity<TRoute> {
  protected defineInitialState(): TRoute {
    return { path: "/", query: {}, hash: "" };
  }
}

const routerListens = [] as const;

export class RouterFeature
  extends Feature<RouteEntity, TRouterDef, "router">
  implements TFeatureCallbacks<TRouterDef, typeof routerListens, RouteEntity>
{
  /** Framework class: may take the reserved namespace `router` (I71). */
  static readonly framework = true;

  static readonly channel: TChannelToken<TRouterDef, "router"> = {
    namespace: "router",
    events: ["routeChanged"]
  };

  get listens() {
    return routerListens;
  }
  get queries() {
    return [] as const;
  }
  protected get Entity() {
    return RouteEntity;
  }

  /**
   * Updates the navigation state, then announces it with the mode of the
   * navigation. The Event goes out even when the route is unchanged: a push
   * to the current address is a request for a new entry (B.5).
   */
  onNavigateCommand(
    payload: { location: string; mode: TNavigationMode },
    ctx: TFeatureContext<TRouterDef, RouteEntity>
  ): void {
    const route = parseLocation(payload.location);
    ctx.mutate("navigate", (draft) => {
      draft.path = route.path;
      draft.query = route.query;
      draft.hash = route.hash;
    });
    ctx.emit("routeChanged", { route, mode: payload.mode });
  }

  onCurrentRouteQuery(_params: null, _ctx: TFeatureQueryContext): TRoute {
    return this.entity.state;
  }
}
