/**
 * Validation functions of the Bonsai framework.
 *
 * - `invariant()`: runtime assertion, strippable in production via `__DEV__`
 * - `hardInvariant()`: NON-strippable assertion — fatal structural errors
 * - `warning()`: `__DEV__`-only conditional log, never throws
 *
 * @see ADR-06 — validation modes
 */

import { BonsaiError } from "./bonsai-error.class";

/**
 * Compile-time constant replaced by the build (ADR-06): `true` in
 * `core/dist/bonsai.js`, `false` in `core/dist/bonsai.prod.js`, where the
 * development branches are dropped. Left free in the package bundles and in
 * the sources run by the tests.
 */
declare const __DEV__: boolean;

/**
 * Returns `true` in development mode.
 * Fallback: `true` when `__DEV__` is not defined (safe default — better to
 * surface errors than to hide them). `typeof` never throws on an undeclared
 * identifier, and the expression folds to a constant once `__DEV__` is
 * replaced.
 */
export function isDev(): boolean {
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
 * @param invariantId - Id of the violated invariant (e.g. "I10")
 * @param component - Namespace or name of the component involved (optional)
 *
 * @example
 * ```typescript
 * invariant(handlers.size === 0, "Duplicate command handler", "I10", "cart");
 * ```
 */
export function invariant(
  condition: unknown,
  message: string,
  invariantId: string = "",
  component: string = ""
): asserts condition {
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
export function hardInvariant(
  condition: unknown,
  message: string,
  invariantId: string = "",
  component: string = ""
): asserts condition {
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
export function warning(condition: unknown, message: string): void {
  if (isDev()) {
    if (!condition) {
      console.warn(`[Bonsai] ${message}`);
    }
  }
}
