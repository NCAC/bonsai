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
 * Declares the global `__DEV__` variable injected by the bundler.
 * Development: `true`. Production: `false` (tree-shaken).
 * Note: the current build does not define it yet (ADR-06).
 */
declare const __DEV__: boolean;

/**
 * Returns `true` in development mode.
 * Fallback: `true` when `__DEV__` is undefined (safe default — better to
 * surface errors than to hide them).
 */
function isDev(): boolean {
  try {
    return typeof __DEV__ !== "undefined" ? __DEV__ : true;
  } catch {
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
