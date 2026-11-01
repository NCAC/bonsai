/**
 * @bonsai/event — Tri-lane communication infrastructure of the Bonsai framework.
 *
 * Exports:
 * - `Channel`: tri-lane communication contract (Command/Event/Request)
 * - `Radio`: singleton registry of Channels (legacy — replaced by the kernel, lot M6)
 * - `Root` and the kernel types: the communication kernel (theory §13, annex C)
 * - Types: `TChannelDefinition`, `TChannelToken`, `TTokenDef`, `TAnyEventPayload`
 *
 * @packageDocumentation
 */

export { Channel } from "./channel.class";
export type {
  TChannelDefinition,
  TChannelToken,
  TTokenDef,
  TAnyEventPayload
} from "./channel.class";
export { Radio } from "./radio.singleton";

// ── Communication kernel (migration lot M6) ──────────────────────────────────
export {
  Root,
  capture,
  TransportError,
  StartupError,
  InvariantError,
  ManifestError
} from "./kernel";
export type { TTransportErrorCode } from "./kernel";
export type * from "./kernel/types";
