/**
 * @bonsai/error — Infrastructure d'erreurs et de validation du framework Bonsai.
 *
 * Exports :
 * - `BonsaiError` et sous-classes (taxonomie ADR-0002)
 * - `invariant()`, `hardInvariant()`, `warning()` (modes ADR-0004)
 *
 * @packageDocumentation
 */

// ── Hiérarchie d'erreurs ────────────────────────────────────────
export {
  BonsaiError,
  // Entity Layer
  MutationError,
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

// ── Fonctions de validation ─────────────────────────────────────
export { invariant, hardInvariant, warning } from "./invariant";
