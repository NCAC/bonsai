/**
 * @bonsai/kernel — execution kernel of the Bonsai framework.
 *
 * Exports:
 * - `Root` and the kernel types: the execution kernel (theory §13, annex C)
 * - Channel contract types: `TChannelDefinition`, `TChannelToken`, `TTokenDef`, `TAnyEventPayload`
 *
 * @packageDocumentation
 */

export type {
  TChannelDefinition,
  TChannelToken,
  TTokenDef,
  TAnyEventPayload
} from "./channel-types";

// ── Execution kernel (migration lot M6) ──────────────────────────────────
export {
  Root,
  capture,
  reportToConsole,
  TransportError,
  StartupError,
  InvariantError,
  ManifestError
} from "./kernel";
export type { TTransportErrorCode, TManifestErrorCode, TTraceConsole } from "./kernel";
export type * from "./kernel/types";
export { DESCRIBE, describeComponent } from "./component";
export type { TDescribable } from "./component";
