/**
 * Causal context shared by the kernel and the framework errors (theory G8).
 *
 * Declared here, below `@bonsai/kernel` and `@bonsai/error`, so that both can
 * name it without a package cycle; `@bonsai/kernel` re-exports it (ADR-04, ADR-05).
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
