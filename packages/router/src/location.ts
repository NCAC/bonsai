import { BonsaiError } from "@bonsai/error";
/**
 * Locations and routes of the navigation (D15).
 *
 * A location is the address inside the application, written as the host
 * writes it: path, query and fragment (`/products/42?tab=2#top`). A route is
 * its parsed form, kept by the Feature of navigation.
 */

/** Parsed address: the state the Feature of navigation owns (D15). */
export type TRoute = {
  /** Path, always starting with `/`. */
  path: string;
  /** Query parameters; the last value wins when a key repeats. */
  query: Record<string, string>;
  /** Fragment, with its `#`, or `""`. */
  hash: string;
};

/** How an entry of the history is written, or followed (B.5). */
export type TNavigationMode = "push" | "replace" | "pop";

const BASE = "http://bonsai.invalid";

/**
 * Parses a location of the application.
 *
 * @throws when it is not a path of the application (`/…`, not `//host`).
 */
export function parseLocation(location: string): TRoute {
  if (typeof location !== "string" || !location.startsWith("/") || location.startsWith("//")) {
    throw new BonsaiError("INVALID_LOCATION", `"${String(location)}" is not a location of the application (expected "/path?query#hash")`);
  }
  const url = new URL(location, BASE);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return { path: url.pathname, query, hash: url.hash };
}

/** Writes a route as a location, in the one canonical form. */
export function serializeRoute(route: TRoute): string {
  const search = new URLSearchParams(route.query).toString();
  return `${route.path}${search === "" ? "" : `?${search}`}${route.hash === "" || route.hash === "#" ? "" : route.hash}`;
}

/** Canonical form of a location: parse, then write. Two equal addresses have one form. */
export function canonicalLocation(location: string): string {
  return serializeRoute(parseLocation(location));
}
