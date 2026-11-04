/**
 * @bonsai/error — Error and validation infrastructure of the Bonsai framework.
 *
 * Exports:
 * - `BonsaiError`, root of every error raised by the framework (ADR-05)
 * - `invariant()`, `hardInvariant()`, `warning()`, `isDev()` (ADR-06 modes)
 *
 * @packageDocumentation
 */

// ── Error hierarchy ─────────────────────────────────────────────
export { BonsaiError } from "./bonsai-error.class";
export type { TBonsaiErrorOptions } from "./bonsai-error.class";

// ── Validation functions ────────────────────────────────────────
export { invariant, hardInvariant, warning, isDev } from "./invariant";
