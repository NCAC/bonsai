/**
 * @bonsai/error - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-09-24T20:04:50.168Z
 */
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
class BonsaiError extends Error {
    constructor(message, invariantId, component = "", suggestion = "") {
        super(`[${invariantId}]${component ? ` ${component}` : ""} — ${message}${suggestion ? `\n  → ${suggestion}` : ""}`);
        this.invariantId = invariantId;
        this.component = component;
        this.suggestion = suggestion;
        this.name = "BonsaiError";
    }
}
// ═══════════════════════════════════════════════════════════════
// Entity Layer (State)
// ═══════════════════════════════════════════════════════════════
/**
 * The `mutate()` recipe threw → automatic Immer rollback, state intact.
 */
class MutationError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "MutationError";
    }
}
/**
 * `mutate()` called during a notification cycle while the re-entrance depth
 * exceeds `maxEntityNotificationDepth` (stratum 1a).
 */
class EntityReentrancyError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "EntityReentrancyError";
    }
}
// ═══════════════════════════════════════════════════════════════
// Feature Layer (Logic)
// ═══════════════════════════════════════════════════════════════
/**
 * An `onXxxCommand()` handler threw (defined, not raised yet — ADR-05).
 */
class CommandError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "CommandError";
    }
}
/**
 * An `onXxxRequest()` handler threw (defined, not raised yet — ADR-05).
 */
class RequestError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "RequestError";
    }
}
/**
 * An `onXxxEntityUpdated()` handler threw — state kept, notification continues.
 */
class BroadcastError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "BroadcastError";
    }
}
// ═══════════════════════════════════════════════════════════════
// Channel Layer (Communication)
// ═══════════════════════════════════════════════════════════════
/**
 * An Event listener threw — error isolated, other listeners still run.
 */
class ListenerError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "ListenerError";
    }
}
/**
 * `trigger()` with no registered `handle()` (`request()` without a replier returns `null` instead).
 */
class NoHandlerError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "NoHandlerError";
    }
}
/**
 * `handle()` or `reply()` called twice for the same message (I10).
 */
class DuplicateHandlerError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "DuplicateHandlerError";
    }
}
// ═══════════════════════════════════════════════════════════════
// View Layer (UI)
// ═══════════════════════════════════════════════════════════════
/**
 * A projection or template threw.
 */
class RenderError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "RenderError";
    }
}
/**
 * A Behavior threw.
 */
class BehaviorError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "BehaviorError";
    }
}

/**
 * Validation functions of the Bonsai framework.
 *
 * - `invariant()`: runtime assertion, strippable in production via `__DEV__`
 * - `hardInvariant()`: NON-strippable assertion — fatal structural errors
 * - `warning()`: `__DEV__`-only conditional log, never throws
 *
 * @see ADR-06 — validation modes
 */
/**
 * Returns `true` in development mode.
 * Fallback: `true` when `__DEV__` is undefined (safe default — better to
 * surface errors than to hide them).
 */
function isDev() {
    try {
        return typeof __DEV__ !== "undefined" ? __DEV__ : true;
    }
    catch {
        return true;
    }
}
/**
 * Runtime assertion — throws a `BonsaiError` when the condition is false.
 *
 * **Strippable in production**: `invariant()` calls are removed by the
 * bundler when `__DEV__ === false`. Use it for development checks (type
 * checks, DX guards).
 *
 * For structural violations that must stay in production → `hardInvariant()`.
 *
 * @param condition - When `false`, throws a `BonsaiError`
 * @param message - Descriptive error message
 * @param invariantId - Id of the violated invariant (e.g. "I10")
 * @param component - Namespace or name of the component involved (optional)
 *
 * @example
 * ```typescript
 * invariant(handlers.size === 0, "Duplicate command handler", "I10", "cart");
 * ```
 */
function invariant(condition, message, invariantId = "", component = "") {
    if (isDev()) {
        if (!condition) {
            throw new BonsaiError(message, invariantId, component);
        }
    }
}
/**
 * NON-strippable assertion — kept in production.
 *
 * Use it for fatal structural errors detected at bootstrap (duplicate
 * namespace I21, duplicate Command handler I10, etc.). A failing
 * `hardInvariant` means the framework is in an inconsistent state — it
 * MUST throw, even in production.
 *
 * @param condition - When `false`, throws a `BonsaiError`
 * @param message - Descriptive error message
 * @param invariantId - Id of the violated invariant
 * @param component - Namespace or name of the component involved (optional)
 */
function hardInvariant(condition, message, invariantId = "", component = "") {
    if (!condition) {
        throw new BonsaiError(message, invariantId, component);
    }
}
/**
 * Development-only conditional log — never throws.
 *
 * Stripped in production (`__DEV__ === false`).
 * Use it for non-blocking warnings.
 *
 * @param condition - When `false`, logs a warning
 * @param message - Warning message
 */
function warning(condition, message) {
    if (isDev()) {
        if (!condition) {
            console.warn(`[Bonsai] ${message}`);
        }
    }
}

export { BehaviorError, BonsaiError, BroadcastError, CommandError, DuplicateHandlerError, EntityReentrancyError, ListenerError, MutationError, NoHandlerError, RenderError, RequestError, hardInvariant, invariant, warning };
