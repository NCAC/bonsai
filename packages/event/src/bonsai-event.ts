/**
 * @bonsai/event — Tri-lane communication infrastructure of the Bonsai framework.
 *
 * Exports:
 * - `Channel`: tri-lane communication contract (Command/Event/Request)
 * - `Radio`: singleton registry of Channels
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
