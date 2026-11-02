import type { Draft, Patch } from "immer";

/**
 * Kernel prototype (migration lot M1) — public types.
 *
 * This kernel is a prototype written beside the delivered `Channel`/`Radio`,
 * without replacing them. It realises the communication guarantees of the
 * theory (docs/theorie.md §13, annex C) so that they can be tested:
 * G1–G3, G5–G8, D8 and D9.
 *
 * Vocabulary follows the theory: Command, Query, Event, local message,
 * deferred message (9.12), validation unit (9.13), effect (11.8).
 */

/** How the origin of a causal chain was qualified (A5.b, C.4). */
export type TOriginKind = "startup" | "spontaneous" | "unknown";

/**
 * Causal context carried by every message (10.5, G8).
 * One triggering parent per message outside an origin.
 */
export interface TCausalContext {
  /** Identifier of this message (or of this Query). */
  readonly id: string;
  /** Triggering parent; `null` for an origin. */
  readonly parentId: string | null;
  /** Identifier of the origin of the chain. */
  readonly originId: string;
  /** Qualification of that origin. */
  readonly originKind: TOriginKind;
  /** Number of continuations since the origin (D9). Origin = 0. */
  readonly depth: number;
}

/** Opaque handle on a living component occurrence (C.2). */
export interface TComponentHandle {
  /** Non-reusable occurrence identifier. */
  readonly occurrence: string;
  readonly name: string;
}

/**
 * A business invariant on an Entity state (11.3). `check` returns `true` when
 * satisfied; it is verified at the successful end of each validation unit
 * that touched the Entity, and at the end of startup (A4.a).
 */
export interface TInvariant<S> {
  readonly name: string;
  readonly check: (state: S) => boolean;
}

/** State of the domain owned by a Feature, with its invariants (16.2). */
export interface TEntityDefinition<S> {
  readonly name: string;
  readonly initial: S;
  readonly invariants?: ReadonlyArray<TInvariant<S>>;
}

/** Handler of a deferred message (Command, Event, local message). */
export type TDeferredHandler = (payload: unknown, ctx: TUnitContext) => void;

/** Handler of a Query: read-only context (A3.g). */
export type TQueryHandler = (params: unknown, ctx: TReadContext) => unknown;

/**
 * Declared contract of a component (D16). Everything a component handles is
 * declared at its creation; nothing is registered later.
 */
export interface TComponentSpec {
  readonly name: string;
  /** Own Channel, distinguished by a namespace (A3.b). */
  readonly channel?: {
    readonly namespace: string;
    readonly commands?: Readonly<Record<string, TDeferredHandler>>;
    readonly queries?: Readonly<Record<string, TQueryHandler>>;
    /** Events this component may emit on its own Channel (A3.e). */
    readonly events?: readonly string[];
  };
  /** Subscriptions, in declaration order (D8). */
  readonly listens?: ReadonlyArray<{
    readonly namespace: string;
    readonly event: string;
    readonly handler: TDeferredHandler;
  }>;
  /** Local messages, including admissions of facts (9.5, A5.c). */
  readonly locals?: Readonly<Record<string, TDeferredHandler>>;
  /** Initialisation, executed inside the creator's validation unit (§2.5). */
  readonly init?: (ctx: TUnitContext) => void;
  /**
   * The component belongs to the user interface (11.1): its Commands are
   * restricted by D18 to reactions whose trigger grants the right.
   */
  readonly ui?: boolean;
  /**
   * Host events admitted in the component's part, by type, with the local
   * message that receives them (D10, D16). Only occurrences whose innermost
   * part is the component's own are admitted.
   */
  readonly dom?: Readonly<Record<string, string | TDomAdmission>>;
  /** Entity owned by the component (D4: exactly one for a Feature). */
  readonly entity?: TEntityDefinition<any>;
}

/**
 * Admission of a host event type with the UI keys it can be attributed to: the
 * payload's `ui` is the first key, in declaration order, whose selector matches
 * the target or an ancestor inside the part; without `keys`, it is the target's
 * `data-ui` attribute.
 */
export interface TDomAdmission {
  readonly local: string;
  readonly keys?: Readonly<Record<string, string>>;
}

/** Entry of a Manifest: a child of the root and its initial Query dependencies (C.1). */
export interface TManifestEntry extends TComponentSpec {
  /** Namespaces this child queries during its initialisation. */
  readonly dependsOn?: readonly string[];
}

/** Handle on a distributable resource or on a part (6.3–6.5). */
export interface TResourceHandle {
  readonly id: string;
  readonly label: string;
}

/**
 * Designation of a part (8.5): information to resolve under ownership
 * control, valid only for one attribution; never an access by itself.
 */
export interface TDesignation {
  readonly resource: string;
  readonly portion: string;
  readonly attribution: string;
}

/** Options of a creation: creation parameters (6.2) and attributed part (6.5). */
export interface TCreateOptions {
  readonly params?: unknown;
  /** Portion of a distributable resource owned by the creator, attributed to the child. */
  readonly part?: {
    readonly resource: TResourceHandle;
    readonly portion: string;
    /** Position in the host: before the part occupying this portion; at the end otherwise. */
    readonly before?: string;
    /**
     * The part is an element of the container that already exists (a declared slot):
     * a selector that must match exactly one element inside the container's element.
     * Without it, the part is a new element created in the container.
     */
    readonly host?: string;
  };
}

/** Correlation of a provoked fact with the treatment that caused it (G8). */
export interface TCorrelationToken {
  readonly kind: "correlation";
  readonly occurrence: string;
  readonly context: TCausalContext;
}

/** Qualification of an admitted occurrence (C.4). */
export type TAdmission =
  | { readonly kind: "correlated"; readonly token: TCorrelationToken }
  | { readonly kind: "independent" }
  | { readonly kind: "unknown" };

/** Change made to an Entity state by one `mutate` call. */
export interface TStateChange<S = unknown> {
  readonly previous: S;
  readonly next: S;
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
}

/** Context offered to a Query handler: read-only, transitive (A3.g). */
export interface TReadContext {
  readonly self: TComponentHandle;
  readonly cause: TCausalContext;
  query<T = unknown>(namespace: string, name: string, params?: unknown): T;
  /** Current state of the component's own Entity, frozen. */
  state<S = unknown>(): S;
}

/** Context offered during a validation unit (treatment or initialisation). */
export interface TUnitContext extends TReadContext {
  trigger(namespace: string, command: string, payload?: unknown): void;
  emit(event: string, payload?: unknown): void;
  local(name: string, payload?: unknown): void;
  create(spec: TComponentSpec, options?: TCreateOptions): TComponentHandle;
  /** Creation parameters received from the parent, captured by copy (6.2, A3.d). */
  params<P = unknown>(): P;
  /** Designation of the part attributed at creation, if any (8.5). */
  designation(): TDesignation | null;
  /**
   * Admits a host element as a distributable resource owned by self (D3, A2.b).
   * With a host document, `label` is a selector resolved once, at admission.
   */
  admitDistributable(label: string): TResourceHandle;
  /**
   * Prepares a projection on the element of a resource owned by self (16.5).
   * The element is given to `write` only at engagement, after validation (C.3);
   * a part not yet materialized makes the effect fail.
   */
  project(resource: TResourceHandle, label: string, write: (element: Element) => void): void;
  /**
   * Instrumented simulation of a host event on a resource owned by self (C.4):
   * engaged after validation; the occurrence it produces is correlated with
   * the current treatment, never qualified as independent.
   */
  simulate(resource: TResourceHandle, type: string): void;
  /** Controlled resolution: valid only for a living attribution owned by self (9.10). */
  resolve(designation: TDesignation): TResourceHandle;
  /** Portions currently attributed within a resource owned by self (T7). */
  attributed(resource: TResourceHandle): readonly string[];
  destroy(child: TComponentHandle): void;
  /**
   * Mutates the component's own Entity; journaled for G7 (16.2).
   * Returns the description of the change, or `null` when the recipe changed nothing.
   */
  mutate<S = unknown>(recipe: (draft: Draft<S>) => void): TStateChange<S> | null;
  /** Registers how to undo an internal mutation if the unit fails (G7). */
  journal(undo: () => void): void;
  /**
   * Whether the trigger of this unit grants the right to command (D18). Lets a
   * built-in relay what it is entitled to relay, without attempting a Command
   * that would fail the unit.
   */
  mayCommand(): boolean;
  /** Prepares an effect, engaged only after the unit validates (C.3). */
  prepareEffect(label: string, run: () => void): void;
  /** Captures the current causal context for a later provoked fact (G8). */
  correlate(): TCorrelationToken;
}

/** Outcome of the engagement of one effect (C.3). */
export type TEffectOutcome = "engaged" | "failed" | "not-attempted";

/** Kernel trace: technical, outside the application transport. */
export type TTraceEntry =
  | { readonly type: "delivered"; readonly kind: "command" | "event" | "local"; readonly to: string; readonly name: string; readonly context: TCausalContext }
  | { readonly type: "unit-failed"; readonly owner: string; readonly context: TCausalContext; readonly error: unknown }
  | { readonly type: "delivery-abandoned"; readonly reason: string; readonly name: string; readonly context: TCausalContext }
  | { readonly type: "admission-abandoned"; readonly reason: string; readonly name: string }
  | { readonly type: "effects"; readonly owner: string; readonly context: TCausalContext; readonly report: ReadonlyArray<{ readonly label: string; readonly outcome: TEffectOutcome; readonly error?: unknown }> }
  /** A unit, effects included, longer than the threshold (ADR-35, O2). */
  | { readonly type: "long-unit"; readonly owner: string; readonly context: TCausalContext; readonly durationMs: number }
  /** A portion returned to its container at the end of a part (6.5, T3), imputed to the container's owner. */
  | { readonly type: "restitution"; readonly portion: string; readonly container: string; readonly imputedTo: string; readonly endedOwner: string }
  /** A drain of the queue longer than the threshold (ADR-35, O2). */
  | { readonly type: "long-drain"; readonly units: number; readonly context: TCausalContext; readonly durationMs: number };

export interface TRootOptions {
  /** Causal bound fixed by the Manifest (D9). */
  readonly causalBound: number;
  /** Threshold above which a unit or a drain is reported (ADR-35). Default: 50 ms. */
  readonly longUnitMs?: number;
  /** Host document: distributable resources are admitted from it and parts materialized in it (lot M4). */
  readonly document?: Document;
  /** Clock in milliseconds. Default: `performance.now()`. Injected by tests. */
  readonly now?: () => number;
}
