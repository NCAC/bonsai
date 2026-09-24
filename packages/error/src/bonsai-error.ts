/**
 * @bonsai/error — Error and validation infrastructure of the Bonsai framework.
 *
 * Exports:
 * - `BonsaiError` and subclasses (ADR-05 taxonomy)
 * - `invariant()`, `hardInvariant()`, `warning()` (ADR-06 modes)
 *
 * @packageDocumentation
 */

// ── Error hierarchy ─────────────────────────────────────────────
export {
  BonsaiError,
  // Entity Layer
  MutationError,
  EntityReentrancyError,
  // Feature Layer
  CommandError,
  RequestError,
  BroadcastError,
  // Channel Layer
  ListenerError,
  NoHandlerError,
  DuplicateHandlerError,
  // View Layer
  RenderError,
  BehaviorError
} from "./bonsai-error.class";

// ── Validation functions ────────────────────────────────────────
export { invariant, hardInvariant, warning } from "./invariant";
