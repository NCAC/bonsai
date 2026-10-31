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

/** Context offered to a Query handler: read-only, transitive (A3.g). */
export interface TReadContext {
  readonly self: TComponentHandle;
  readonly cause: TCausalContext;
  query<T = unknown>(namespace: string, name: string, params?: unknown): T;
}

/** Context offered during a validation unit (treatment or initialisation). */
export interface TUnitContext extends TReadContext {
  trigger(namespace: string, command: string, payload?: unknown): void;
  emit(event: string, payload?: unknown): void;
  local(name: string, payload?: unknown): void;
  create(spec: TComponentSpec): TComponentHandle;
  destroy(child: TComponentHandle): void;
  /** Registers how to undo an internal mutation if the unit fails (G7). */
  journal(undo: () => void): void;
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
  | { readonly type: "effects"; readonly owner: string; readonly context: TCausalContext; readonly report: ReadonlyArray<{ readonly label: string; readonly outcome: TEffectOutcome; readonly error?: unknown }> };

export interface TRootOptions {
  /** Causal bound fixed by the Manifest (D9). */
  readonly causalBound: number;
}
