/**
 * Execution kernel — transport errors (G5, G7, D9).
 *
 * A transport error is not a business answer: it interrupts the author and
 * propagates to the outermost validation unit, which then fails (G7).
 *
 * Errors raised by the kernel during a validation unit or a Query carry the
 * causal context where they were born (`context`, ADR-04). `cause` keeps its
 * standard `Error.cause` meaning: the original error being reported.
 */

import type { TCausalContext } from "./types";

export type TTransportErrorCode =
  | "UNKNOWN_TARGET"        // no such Channel in this root (G6)
  | "UNDECLARED_MESSAGE"    // message absent from the declared contract (D16)
  | "TARGET_NOT_READY"      // Query to a target not ready (C.1)
  | "TARGET_ACTIVE"         // Query to a target with an execution in progress (G5)
  | "READ_ONLY"             // forbidden operation during a Query (A3.g)
  | "NOT_OWNER"             // emit on a Channel one does not own (A3.e), destroy a non-child (A1.b)
  | "CAUSAL_BOUND"          // depth beyond the Manifest bound (D9)
  | "NOT_CAPTURABLE"        // payload that cannot be captured by value (G2, A3.d)
  | "DUPLICATE_NAMESPACE"   // two Channels with the same namespace in one root
  | "NO_UNIT"               // operation outside any validation unit (A5.a)
  | "UNRECOVERABLE"         // a Query failure was intercepted by the author (G7)
  | "PORTION_TAKEN"         // portion already attributed: parts never overlap (T7)
  | "INVALID_DESIGNATION"   // designation of a part that ended, or not owned by the resolver (8.5)
  | "HOST_NOT_FOUND"        // the host element to admit does not exist (D3)
  | "NOT_AUTHORIZED"        // a Command of the user interface whose trigger grants no right (D18)
  | "ROOT_ABANDONED";       // the root failed to start

export class TransportError extends Error {
  readonly code: TTransportErrorCode;
  /** Original error, when this one reports it (UNRECOVERABLE). */
  readonly cause?: unknown;
  /** Causal context where the error was born; absent outside any unit (ADR-04). */
  readonly context?: TCausalContext;

  constructor(code: TTransportErrorCode, message: string, cause?: unknown) {
    super(`[${code}] ${message}`);
    this.name = "TransportError";
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Raised by `Root.start()` when the startup unit fails (§2.5, C.1). */
export class StartupError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Startup failed: the model under construction was abandoned");
    this.name = "StartupError";
    this.cause = cause;
  }
}

/**
 * A business invariant is violated at the end of a validation unit (A4.a).
 * Not a transport error: the unit fails and is rolled back (G7).
 */
export class InvariantError extends Error {
  readonly entity: string;
  readonly invariant: string;
  /** Causal context of the failing validation unit (ADR-04). */
  readonly context?: TCausalContext;

  constructor(entity: string, invariant: string) {
    super(`Invariant "${invariant}" of entity "${entity}" violated at the end of the validation unit (A4.a)`);
    this.name = "InvariantError";
    this.entity = entity;
    this.invariant = invariant;
  }
}

/** The Manifest cannot be ordered: unknown or cyclic initial dependency (C.1). */
export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/**
 * Attaches the causal context where a kernel error was born (ADR-04). The
 * innermost boundary wins: a context already attached is kept. Errors raised
 * by application code are left untouched — their context is in the trace.
 */
export function attachContext(error: unknown, context: TCausalContext): void {
  if (!(error instanceof TransportError || error instanceof InvariantError)) return;
  if (error.context !== undefined) return;
  Object.defineProperty(error, "context", { value: context, enumerable: true, writable: false, configurable: false });
}
