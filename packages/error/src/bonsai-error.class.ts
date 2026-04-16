/**
 * BonsaiError — Classe de base pour toutes les erreurs structurées du framework.
 *
 * Chaque erreur Bonsai fournit :
 * - `invariantId` : identifiant de l'invariant ou ADR violé (ex: "I10", "ADR-0002")
 * - `component` : namespace ou nom du composant concerné
 * - `suggestion` : message actionnable pour le développeur
 *
 * @see ADR-0002 — Error Propagation Strategy (taxonomie complète)
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
 * Recipe `mutate()` a throw → Immer rollback automatique, state intact.
 */
export class MutationError extends BonsaiError {
  override readonly name = "MutationError";
}

// ═══════════════════════════════════════════════════════════════
// Feature Layer (Logic)
// ═══════════════════════════════════════════════════════════════

/**
 * `onXxxCommand()` handler a throw.
 */
export class CommandError extends BonsaiError {
  override readonly name = "CommandError";
}

/**
 * `onXxxRequest()` handler a throw ou reject.
 */
export class RequestError extends BonsaiError {
  override readonly name = "RequestError";
}

/**
 * `onXxxEntityUpdated()` handler a throw — state conservé, notification continue.
 */
export class BroadcastError extends BonsaiError {
  override readonly name = "BroadcastError";
}

// ═══════════════════════════════════════════════════════════════
// Channel Layer (Communication)
// ═══════════════════════════════════════════════════════════════

/**
 * Event listener a throw — erreur isolée, les autres listeners continuent.
 */
export class ListenerError extends BonsaiError {
  override readonly name = "ListenerError";
}

/**
 * `trigger()` sans `handle()` enregistré, ou `request()` sans `reply()`.
 */
export class NoHandlerError extends BonsaiError {
  override readonly name = "NoHandlerError";
}

/**
 * `handle()` ou `reply()` appelé deux fois pour le même message (I10).
 */
export class DuplicateHandlerError extends BonsaiError {
  override readonly name = "DuplicateHandlerError";
}

// ═══════════════════════════════════════════════════════════════
// View Layer (UI)
// ═══════════════════════════════════════════════════════════════

/**
 * Projection ou template a throw.
 */
export class RenderError extends BonsaiError {
  override readonly name = "RenderError";
}

/**
 * Behavior a throw.
 */
export class BehaviorError extends BonsaiError {
  override readonly name = "BehaviorError";
}
