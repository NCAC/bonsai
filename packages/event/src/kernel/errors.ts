/**
 * Kernel prototype — transport errors (G5, G7, D9).
 *
 * A transport error is not a business answer: it interrupts the author and
 * propagates to the outermost validation unit, which then fails (G7).
 */

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
  | "ROOT_ABANDONED";       // the root failed to start

export class TransportError extends Error {
  readonly code: TTransportErrorCode;
  /** Original error, when this one reports it (UNRECOVERABLE). */
  readonly cause?: unknown;

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
