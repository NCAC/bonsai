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

import {
  DESCRIBE,
  type Root,
  type TAdmission,
  type TComponentHandle,
  type TComponentSpec,
  type TCorrelationToken,
  type TUnitContext
} from "@bonsai/kernel";
import { canonicalLocation, parseLocation, serializeRoute, type TNavigationMode, type TRoute } from "./location";

/** What the adapter has integrated about the address (C.5). */
export type THistoryObservation = {
  readonly location: string;
  /** How the current entry was reached; `"initial"` before any navigation. */
  readonly mode: "initial" | TNavigationMode;
  /** Counts the integrated observations, so that an unchanged address stays distinguishable. */
  readonly sequence: number;
};

/** Creation parameters given by the Application (never a reference of the model: they are the framework's). */
export type THistoryAdapterOptions = {
  readonly root: Root;
  readonly document: Document;
  /** Removes the host observers when aborted (B.2). */
  readonly signal?: AbortSignal;
  /** Time after which an engaged traversal that the host did not notify is given up. Default 2000 ms. */
  readonly traversalTimeoutMs?: number;
};

type TOperation = "push" | "replace" | "back" | "forward" | "refresh";
type TClassification = "independent" | "correlated" | "unknown";

type TTraversal = {
  readonly token: TCorrelationToken;
  readonly operation: "back" | "forward";
  tainted: boolean;
  timer: number | null;
};

export class HistoryAdapter {
  /** Category of the catalogue (B.3): one adapter per category and per root. */
  static readonly category = "history";
  /** Namespaces of Features that must be active for this adapter. */
  static readonly requires = ["router"] as const;

  /**
   * The only extension point: puts a location, already detached from the
   * host, in the form the application wants (B.4). Applied to every location
   * that is observed or written; it must be a pure function of its argument.
   */
  protected normalize(location: string): string {
    return location;
  }

  /** @internal Description given to the kernel by the Application. */
  [DESCRIBE](options: THistoryAdapterOptions): TComponentSpec {
    const { root, document: doc, signal } = options;
    const timeout = options.traversalTimeoutMs ?? 2000;
    const view = doc.defaultView;
    if (view === null) throw new Error("[Bonsai HistoryAdapter] the document has no window: the history is not reachable");
    const host = view;
    const canonical = (location: string): string => this.normalize(canonicalLocation(location));
    const readHost = (): string => canonical(host.location.pathname + host.location.search + host.location.hash);

    let handle: TComponentHandle | null = null;
    let observation: THistoryObservation = Object.freeze({ location: "/", mode: "initial", sequence: 0 });
    const traversals: TTraversal[] = [];

    const admit = (local: string, payload: unknown, admission: TAdmission): void => {
      if (handle !== null) root.admit(handle, local, payload, admission);
    };
    const observe = (c: TUnitContext, location: string, mode: THistoryObservation["mode"]): void => {
      const previous = observation;
      observation = Object.freeze({ location, mode, sequence: previous.sequence + 1 });
      c.journal(() => {
        observation = previous;
      });
    };

    // ── Writing an entry: an effect engaged after validation (C.3), its result a continuation (G8) ──
    const write = (c: TUnitContext, operation: "push" | "replace", location: string): void => {
      const target = canonical(location);
      const token = c.correlate();
      c.prepareEffect(`history.${operation}`, () => {
        try {
          if (operation === "push") host.history.pushState(null, "", target);
          else host.history.replaceState(null, "", target);
        } catch (error) {
          admit("result", { operation, ok: false, reason: String((error as Error).message) }, { kind: "correlated", token });
          return;
        }
        admit("result", { operation, ok: true, location: readHost() }, { kind: "correlated", token });
      });
    };

    // ── A traversal is engaged until the host notifies it or the window closes ──
    const traverse = (c: TUnitContext, operation: "back" | "forward"): void => {
      const token = c.correlate();
      c.prepareEffect(`history.${operation}`, () => {
        const entry: TTraversal = { token, operation, tainted: false, timer: null };
        traversals.forEach((other) => {
          other.tainted = true; // several engaged at once: nothing tells them apart (C.4)
          entry.tainted = true;
        });
        traversals.push(entry);
        entry.timer = host.setTimeout(() => {
          const index = traversals.indexOf(entry);
          if (index < 0) return;
          traversals.splice(index, 1);
          admit("result", { operation, ok: false, reason: "no traversal was notified by the host" }, { kind: "correlated", token });
        }, timeout);
        try {
          if (operation === "back") host.history.back();
          else host.history.forward();
        } catch (error) {
          host.clearTimeout(entry.timer);
          traversals.splice(traversals.indexOf(entry), 1);
          admit("result", { operation, ok: false, reason: String((error as Error).message) }, { kind: "correlated", token });
        }
      });
    };

    // ── The host notifies a traversal: classify it by the closed world (C.4) ──
    const onPopState = (): void => {
      const location = readHost();
      const entry = traversals.shift();
      if (entry === undefined) {
        admit("popped", { location, classification: "independent" satisfies TClassification }, { kind: "independent" });
        return;
      }
      if (entry.timer !== null) host.clearTimeout(entry.timer);
      if (entry.tainted) {
        admit("popped", { location, classification: "unknown" satisfies TClassification }, { kind: "unknown" });
        return;
      }
      admit("popped", { location, classification: "correlated" satisfies TClassification }, { kind: "correlated", token: entry.token });
    };

    return {
      name: this.constructor.name,
      ui: true,
      channel: {
        namespace: "history",
        events: ["navigated", "requestResult", "refreshed", "failed"],
        commands: {
          push: (payload, c) => write(c, "push", (payload as { location: string }).location),
          replace: (payload, c) => write(c, "replace", (payload as { location: string }).location),
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
            const { route, mode } = payload as { route: TRoute; mode: TNavigationMode };
            const desired = canonical(serializeRoute(route));
            const satisfied = desired === observation.location;
            if (mode === "push") write(c, "push", desired); // a new entry may be the requested effect, even at the same address
            else if (!satisfied) write(c, "replace", desired); // replace, or a redirection after a traversal
          }
        }
      ],
      locals: {
        // The address found at startup enters the model as an independent fact (A5.c).
        initial: (payload, c) => {
          const { location } = payload as { location: string };
          c.emit("navigated", { location, mode: "initial", classification: "independent" });
          c.trigger("router", "navigate", { location, mode: "replace" satisfies TNavigationMode });
        },
        // A traversal notified by the host.
        popped: (payload, c) => {
          const { location, classification } = payload as { location: string; classification: TClassification };
          observe(c, location, "pop");
          c.emit("navigated", { location, mode: "pop", classification });
          // Relayed to the domain only if the right to command exists (D18, C.4): an independent traversal
          // has it, the result of a traversal requested by a reaction that had it continues it, and a
          // notification with an unknown antecedent never has it.
          if (c.mayCommand()) c.trigger("router", "navigate", { location, mode: "pop" satisfies TNavigationMode });
        },
        // The result of an operation the adapter performed.
        result: (payload, c) => {
          const result = payload as { operation: TOperation; ok: boolean; location?: string; reason?: string };
          if (!result.ok) {
            c.emit("failed", { operation: result.operation, reason: result.reason ?? "unknown" });
            return;
          }
          if (result.operation === "push" || result.operation === "replace") observe(c, result.location!, result.operation);
          else if (result.operation === "refresh") observe(c, result.location!, observation.mode);
          c.emit("requestResult", { operation: result.operation, location: result.location ?? observation.location });
          if (result.operation === "refresh") c.emit("refreshed", { location: result.location! });
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
