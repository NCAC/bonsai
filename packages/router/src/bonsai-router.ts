/**
 * @bonsai/router — navigation provided by the framework (D15) and the history
 * adapter that projects it onto the host address (D7, annex B).
 *
 * @packageDocumentation
 */

export { RouterFeature, RouteEntity, type TRouterDef } from "./router-feature";
export { HistoryAdapter, type THistoryAdapterOptions, type THistoryObservation } from "./history-adapter";
export { parseLocation, serializeRoute, canonicalLocation, type TRoute, type TNavigationMode } from "./location";
