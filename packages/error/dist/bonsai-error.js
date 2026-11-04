/**
 * @bonsai/error - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-04T20:50:10.119Z
 */
/**
 * BonsaiError — root of every error raised by the framework (ADR-05).
 *
 * `instanceof BonsaiError` separates a violation detected by Bonsai from an
 * error of application code, which the framework never wraps nor modifies.
 *
 * - `code`: stable identifier to match on — a symbolic code (`NOT_AUTHORIZED`)
 *   or the id of the violated invariant (`I96`). Renaming one is a breaking change.
 * - `component`: namespace or name of the component involved, `""` if none.
 * - `suggestion`: actionable hint, `""` if none.
 * - `context`: causal context of the validation unit or Query where the error
 *   was born, attached by the kernel (ADR-04); absent outside any unit.
 */
class BonsaiError extends Error {
    constructor(code, message, options = {}) {
        const component = options.component ?? "";
        const suggestion = options.suggestion ?? "";
        super(`[${code}]${component ? ` ${component}` : ""} — ${message}${suggestion ? `\n  → ${suggestion}` : ""}`);
        this.name = "BonsaiError";
        this.code = code;
        this.component = component;
        this.suggestion = suggestion;
        if (options.cause !== undefined) {
            Object.defineProperty(this, "cause", { value: options.cause, enumerable: false, writable: false, configurable: true });
        }
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
 * Fallback: `true` when `__DEV__` is not defined (safe default — better to
 * surface errors than to hide them). `typeof` never throws on an undeclared
 * identifier, and the expression folds to a constant once `__DEV__` is
 * replaced.
 */
function isDev() {
    return typeof __DEV__ === "undefined" || __DEV__;
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
 * @param invariantId - Id of the violated invariant (e.g. "I10"), used as the error `code`
 * @param component - Namespace or name of the component involved (optional)
 *
 * @example
 * ```typescript
 * invariant(handlers.size === 0, "Duplicate command handler", "I10", "cart");
 * ```
 */
function invariant(condition, message, invariantId = "INVARIANT", component = "") {
    if (isDev()) {
        if (!condition) {
            throw new BonsaiError(invariantId, message, { component });
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
 * @param invariantId - Id of the violated invariant, used as the error `code`
 * @param component - Namespace or name of the component involved (optional)
 */
function hardInvariant(condition, message, invariantId = "INVARIANT", component = "") {
    if (!condition) {
        throw new BonsaiError(invariantId, message, { component });
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

export { BonsaiError, hardInvariant, invariant, isDev, warning };
