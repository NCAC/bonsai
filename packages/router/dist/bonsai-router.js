/**
 * @bonsai/router - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-04T20:36:08.663Z
 */
import { Entity } from '@bonsai/entity';
import { Feature } from '@bonsai/feature';
import { DESCRIBE } from '@bonsai/kernel';

/**
 * Locations and routes of the navigation (D15).
 *
 * A location is the address inside the application, written as the host
 * writes it: path, query and fragment (`/products/42?tab=2#top`). A route is
 * its parsed form, kept by the Feature of navigation.
 */
const BASE = "http://bonsai.invalid";
/**
 * Parses a location of the application.
 *
 * @throws when it is not a path of the application (`/…`, not `//host`).
 */
function parseLocation(location) {
    if (typeof location !== "string" || !location.startsWith("/") || location.startsWith("//")) {
        throw new Error(`[Bonsai Router] "${String(location)}" is not a location of the application (expected "/path?query#hash")`);
    }
    const url = new URL(location, BASE);
    const query = {};
    url.searchParams.forEach((value, key) => {
        query[key] = value;
    });
    return { path: url.pathname, query, hash: url.hash };
}
/** Writes a route as a location, in the one canonical form. */
function serializeRoute(route) {
    const search = new URLSearchParams(route.query).toString();
    return `${route.path}${search === "" ? "" : `?${search}`}${route.hash === "" || route.hash === "#" ? "" : route.hash}`;
}
/** Canonical form of a location: parse, then write. Two equal addresses have one form. */
function canonicalLocation(location) {
    return serializeRoute(parseLocation(location));
}

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
class RouteEntity extends Entity {
    defineInitialState() {
        return { path: "/", query: {}, hash: "" };
    }
}
const routerListens = [];
class RouterFeature extends Feature {
    get listens() {
        return routerListens;
    }
    get queries() {
        return [];
    }
    get Entity() {
        return RouteEntity;
    }
    /**
     * Updates the navigation state, then announces it with the mode of the
     * navigation. The Event goes out even when the route is unchanged: a push
     * to the current address is a request for a new entry (B.5).
     */
    onNavigateCommand(payload, ctx) {
        const route = parseLocation(payload.location);
        ctx.mutate("navigate", (draft) => {
            draft.path = route.path;
            draft.query = route.query;
            draft.hash = route.hash;
        });
        ctx.emit("routeChanged", { route, mode: payload.mode });
    }
    onCurrentRouteQuery(_params, _ctx) {
        return this.entity.state;
    }
}
/** Framework class: may take the reserved namespace `router` (I71). */
RouterFeature.framework = true;
RouterFeature.channel = {
    namespace: "router",
    events: ["routeChanged"]
};

/**
 * HistoryAdapter — the adapter of the address and of the session history
 * (theory annex A.4, B.3; sheet `docs/adaptateurs/historique.md`).
 *
 * A built-in component of the user interface, child of the root, namespace
 * `history`. It is the only component that reads or writes the address. The
 * application reaches it in three ways:
 *
 *   - Commands `history:push|replace|back|forward|refresh`, addressed by
 *     components of the user interface only (A4.b, enforced by the kernel);
 *   - Query `history:location`: the observation integrated at initialisation
 *     or by an admission, never a fresh read of the host (C.5);
 *   - Events `history:navigated|requestResult|refreshed|failed`.
 *
 * It also projects the domain: on `router:routeChanged` it writes the entry
 * the mode asks for, unless the projection is already satisfied (B.5).
 *
 * Closed world (C.4). The operations of the model that can make the host emit
 * `popstate` are `history:back` and `history:forward`, and both go through
 * here. A `popstate` that no engaged traversal could have produced is an
 * independent fact: origin "spontaneous", which grants the right to command
 * (D18) and is relayed to the router as `router:navigate { mode: "pop" }`.
 * With exactly one traversal engaged, it is the result of that traversal: a
 * continuation, which keeps the right of the reaction that requested it (a
 * click on "back" may command, an Event relayed to the adapter may not). With several engaged, nothing tells them apart: it
 * is an observation with an unknown antecedent, no right, no relay.
 *
 * What a subclass may do (B.4): `normalize` a location that is already
 * detached from the host. Nothing else is overridable.
 *
 * Known limits: `popstate` is the only host notification listened to
 * (`hashchange` follows it for a change of fragment); the window during which
 * a traversal is considered engaged is closed by the host notification or by
 * `traversalTimeoutMs` (open point of the sheet, rubric 30); `stop()` of the
 * Application removes the host observers.
 */
class HistoryAdapter {
    /**
     * The only extension point: puts a location, already detached from the
     * host, in the form the application wants (B.4). Applied to every location
     * that is observed or written; it must be a pure function of its argument.
     */
    normalize(location) {
        return location;
    }
    /** @internal Description given to the kernel by the Application. */
    [DESCRIBE](options) {
        const { root, document: doc, signal } = options;
        const timeout = options.traversalTimeoutMs ?? 2000;
        const view = doc.defaultView;
        if (view === null)
            throw new Error("[Bonsai HistoryAdapter] the document has no window: the history is not reachable");
        const host = view;
        const canonical = (location) => this.normalize(canonicalLocation(location));
        const readHost = () => canonical(host.location.pathname + host.location.search + host.location.hash);
        let handle = null;
        let observation = Object.freeze({ location: "/", mode: "initial", sequence: 0 });
        const traversals = [];
        const admit = (local, payload, admission) => {
            if (handle !== null)
                root.admit(handle, local, payload, admission);
        };
        const observe = (c, location, mode) => {
            const previous = observation;
            observation = Object.freeze({ location, mode, sequence: previous.sequence + 1 });
            c.journal(() => {
                observation = previous;
            });
        };
        // ── Writing an entry: an effect engaged after validation (C.3), its result a continuation (G8) ──
        const write = (c, operation, location) => {
            const target = canonical(location);
            const token = c.correlate();
            c.prepareEffect(`history.${operation}`, () => {
                try {
                    if (operation === "push")
                        host.history.pushState(null, "", target);
                    else
                        host.history.replaceState(null, "", target);
                }
                catch (error) {
                    admit("result", { operation, ok: false, reason: String(error.message) }, { kind: "correlated", token });
                    return;
                }
                admit("result", { operation, ok: true, location: readHost() }, { kind: "correlated", token });
            });
        };
        // ── A traversal is engaged until the host notifies it or the window closes ──
        const traverse = (c, operation) => {
            const token = c.correlate();
            c.prepareEffect(`history.${operation}`, () => {
                const entry = { token, operation, tainted: false, timer: null };
                traversals.forEach((other) => {
                    other.tainted = true; // several engaged at once: nothing tells them apart (C.4)
                    entry.tainted = true;
                });
                traversals.push(entry);
                entry.timer = host.setTimeout(() => {
                    const index = traversals.indexOf(entry);
                    if (index < 0)
                        return;
                    traversals.splice(index, 1);
                    admit("result", { operation, ok: false, reason: "no traversal was notified by the host" }, { kind: "correlated", token });
                }, timeout);
                try {
                    if (operation === "back")
                        host.history.back();
                    else
                        host.history.forward();
                }
                catch (error) {
                    host.clearTimeout(entry.timer);
                    traversals.splice(traversals.indexOf(entry), 1);
                    admit("result", { operation, ok: false, reason: String(error.message) }, { kind: "correlated", token });
                }
            });
        };
        // ── The host notifies a traversal: classify it by the closed world (C.4) ──
        const onPopState = () => {
            const location = readHost();
            const entry = traversals.shift();
            if (entry === undefined) {
                admit("popped", { location, classification: "independent" }, { kind: "independent" });
                return;
            }
            if (entry.timer !== null)
                host.clearTimeout(entry.timer);
            if (entry.tainted) {
                admit("popped", { location, classification: "unknown" }, { kind: "unknown" });
                return;
            }
            admit("popped", { location, classification: "correlated" }, { kind: "correlated", token: entry.token });
        };
        return {
            name: this.constructor.name,
            ui: true,
            channel: {
                namespace: "history",
                events: ["navigated", "requestResult", "refreshed", "failed"],
                commands: {
                    push: (payload, c) => write(c, "push", payload.location),
                    replace: (payload, c) => write(c, "replace", payload.location),
                    back: (_payload, c) => traverse(c, "back"),
                    forward: (_payload, c) => traverse(c, "forward"),
                    refresh: (_payload, c) => {
                        const token = c.correlate();
                        c.prepareEffect("history.refresh", () => {
                            admit("result", { operation: "refresh", ok: true, location: readHost() }, { kind: "correlated", token });
                        });
                    }
                },
                queries: {
                    location: () => observation
                }
            },
            // Projection of the domain onto the address (A4.d, B.5). An Event grants no right to command (D18).
            listens: [
                {
                    namespace: "router",
                    event: "routeChanged",
                    handler: (payload, c) => {
                        const { route, mode } = payload;
                        const desired = canonical(serializeRoute(route));
                        const satisfied = desired === observation.location;
                        if (mode === "push")
                            write(c, "push", desired); // a new entry may be the requested effect, even at the same address
                        else if (!satisfied)
                            write(c, "replace", desired); // replace, or a redirection after a traversal
                    }
                }
            ],
            locals: {
                // The address found at startup enters the model as an independent fact (A5.c).
                initial: (payload, c) => {
                    const { location } = payload;
                    c.emit("navigated", { location, mode: "initial", classification: "independent" });
                    c.trigger("router", "navigate", { location, mode: "replace" });
                },
                // A traversal notified by the host.
                popped: (payload, c) => {
                    const { location, classification } = payload;
                    observe(c, location, "pop");
                    c.emit("navigated", { location, mode: "pop", classification });
                    // Relayed to the domain only if the right to command exists (D18, C.4): an independent traversal
                    // has it, the result of a traversal requested by a reaction that had it continues it, and a
                    // notification with an unknown antecedent never has it.
                    if (c.mayCommand())
                        c.trigger("router", "navigate", { location, mode: "pop" });
                },
                // The result of an operation the adapter performed.
                result: (payload, c) => {
                    const result = payload;
                    if (!result.ok) {
                        c.emit("failed", { operation: result.operation, reason: result.reason ?? "unknown" });
                        return;
                    }
                    if (result.operation === "push" || result.operation === "replace")
                        observe(c, result.location, result.operation);
                    else if (result.operation === "refresh")
                        observe(c, result.location, observation.mode);
                    c.emit("requestResult", { operation: result.operation, location: result.location ?? observation.location });
                    if (result.operation === "refresh")
                        c.emit("refreshed", { location: result.location });
                }
            },
            init: (c) => {
                handle = c.self;
                // The address is resolved at creation (9.10); the observation is published only if startup validates.
                observe(c, readHost(), "initial");
                c.prepareEffect("history.observe", () => {
                    host.addEventListener("popstate", onPopState, signal === undefined ? undefined : { signal });
                    signal?.addEventListener("abort", () => {
                        traversals.splice(0).forEach((entry) => entry.timer !== null && host.clearTimeout(entry.timer));
                    });
                    admit("initial", { location: observation.location }, { kind: "independent" });
                });
            }
        };
    }
}
/** Category of the catalogue (B.3): one adapter per category and per root. */
HistoryAdapter.category = "history";
/** Namespaces of Features that must be active for this adapter. */
HistoryAdapter.requires = ["router"];

export { HistoryAdapter, RouteEntity, RouterFeature, canonicalLocation, parseLocation, serializeRoute };
