/**
 * Contracts of a Channel (ADR-14) — types only.
 *
 * The tri-lane `Channel` class and the `Radio` singleton that carried messages
 * before the communication kernel (lot M6) are removed (lot M6.3b): messages
 * travel through `Root`, which owns the Channel of each component. What stays
 * here is the *declaration* of a Channel: its lanes and the token a Feature
 * carries as `static readonly channel`.
 *
 * @see docs/theorie.md — A3.b, A3.e, D16
 * @see ADR-14 — typed contracts: TChannelDefinition, TChannelToken
 */

// ── Structural contract of a Channel (ADR-14) ──────────────────────────────

/**
 * Declares the full contract of a Channel: every lane and its types.
 * Each Feature declares its own `TChannelDefinition` in its `.feature.ts`
 * file (single, co-located source of truth — I74).
 */
export type TChannelDefinition = {
  readonly commands: Record<string, unknown>;
  readonly events:   Record<string, unknown>;
  readonly queries: Record<string, { params: unknown; result: unknown }>;
};

/**
 * Phantom token carried as `static readonly channel` on every Feature.
 *
 * Encodes both the namespace (runtime) and the Channel definition
 * (compile time). Lets any consumer (View, external Feature) name a typed
 * Channel without holding a reference to a Feature instance (ADR-14).
 *
 * `_def` is an optional phantom field — never assigned at runtime, present
 * only so TypeScript structurally distinguishes two tokens carrying
 * different `TDef` on the same namespace.
 */
export type TChannelToken<
  TDef extends TChannelDefinition,
  TNS extends string = string
> = {
  readonly namespace: TNS;
  /**
   * Events the Channel's owner may emit (D16: everything a component can do
   * is declared at its creation). Required of a Feature's own token by the
   * kernel.
   */
  readonly events?: readonly string[];
  readonly _def?: TDef;
};

/** Extracts the `TDef` of a `TChannelToken`. */
export type TTokenDef<T> =
  T extends TChannelToken<infer TDef, any> ? TDef : never;
