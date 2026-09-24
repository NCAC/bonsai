/**
 * BonsaiError — base class for all structured framework errors.
 *
 * Every Bonsai error provides:
 * - `invariantId`: id of the violated invariant or ADR (e.g. "I10", "ADR-05")
 * - `component`: namespace or name of the component involved
 * - `suggestion`: actionable message for the developer
 *
 * @see ADR-05 — error propagation (full taxonomy)
 */
export class BonsaiError extends Error {
  override readonly name: string = "BonsaiError";

  constructor(
    message: string,
    readonly invariantId: string,
    readonly component: string = "",
    readonly suggestion: string = ""
  ) {
    super(
      `[${invariantId}]${component ? ` ${component}` : ""} — ${message}${suggestion ? `\n  → ${suggestion}` : ""}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Entity Layer (State)
// ═══════════════════════════════════════════════════════════════

/**
 * The `mutate()` recipe threw → automatic Immer rollback, state intact.
 */
export class MutationError extends BonsaiError {
  override readonly name = "MutationError";
}

/**
 * `mutate()` called during a notification cycle while the re-entrance depth
 * exceeds `maxEntityNotificationDepth` (stratum 1a).
 */
export class EntityReentrancyError extends BonsaiError {
  override readonly name = "EntityReentrancyError";
}

// ═══════════════════════════════════════════════════════════════
// Feature Layer (Logic)
// ═══════════════════════════════════════════════════════════════

/**
 * An `onXxxCommand()` handler threw (defined, not raised yet — ADR-05).
 */
export class CommandError extends BonsaiError {
  override readonly name = "CommandError";
}

/**
 * An `onXxxRequest()` handler threw (defined, not raised yet — ADR-05).
 */
export class RequestError extends BonsaiError {
  override readonly name = "RequestError";
}

/**
 * An `onXxxEntityUpdated()` handler threw — state kept, notification continues.
 */
export class BroadcastError extends BonsaiError {
  override readonly name = "BroadcastError";
}

// ═══════════════════════════════════════════════════════════════
// Channel Layer (Communication)
// ═══════════════════════════════════════════════════════════════

/**
 * An Event listener threw — error isolated, other listeners still run.
 */
export class ListenerError extends BonsaiError {
  override readonly name = "ListenerError";
}

/**
 * `trigger()` with no registered `handle()` (`request()` without a replier returns `null` instead).
 */
export class NoHandlerError extends BonsaiError {
  override readonly name = "NoHandlerError";
}

/**
 * `handle()` or `reply()` called twice for the same message (I10).
 */
export class DuplicateHandlerError extends BonsaiError {
  override readonly name = "DuplicateHandlerError";
}

// ═══════════════════════════════════════════════════════════════
// View Layer (UI)
// ═══════════════════════════════════════════════════════════════

/**
 * A projection or template threw.
 */
export class RenderError extends BonsaiError {
  override readonly name = "RenderError";
}

/**
 * A Behavior threw.
 */
export class BehaviorError extends BonsaiError {
  override readonly name = "BehaviorError";
}
