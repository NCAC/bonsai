import type { TCausalContext } from "@bonsai/types";

/**
 * Options of a `BonsaiError`, after its code and message.
 */
export type TBonsaiErrorOptions = {
  /** Namespace or name of the component involved. */
  readonly component?: string;
  /** Actionable hint for the developer. */
  readonly suggestion?: string;
  /** Original error this one reports (standard `Error.cause`). */
  readonly cause?: unknown;
};

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
export class BonsaiError extends Error {
  override readonly name: string = "BonsaiError";
  readonly code: string;
  readonly component: string;
  readonly suggestion: string;
  /** Original error, when this one reports it. */
  declare readonly cause?: unknown;
  /** Causal context where the error was born; set once by the kernel (ADR-04). */
  declare readonly context?: TCausalContext;

  constructor(code: string, message: string, options: TBonsaiErrorOptions = {}) {
    const component = options.component ?? "";
    const suggestion = options.suggestion ?? "";
    super(`[${code}]${component ? ` ${component}` : ""} — ${message}${suggestion ? `\n  → ${suggestion}` : ""}`);
    this.code = code;
    this.component = component;
    this.suggestion = suggestion;
    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", { value: options.cause, enumerable: false, writable: false, configurable: true });
    }
  }
}
