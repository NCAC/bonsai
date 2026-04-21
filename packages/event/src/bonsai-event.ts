/**
 * @bonsai/event — Infrastructure de communication tri-lane du framework Bonsai.
 *
 * Exports :
 * - `Channel` : contrat de communication tri-lane (Command/Event/Request)
 * - `Radio` : singleton registre des Channels
 * - Types : `TAnyEventPayload`
 *
 * @packageDocumentation
 */

export { Channel } from "./channel.class";
export type { TAnyEventPayload } from "./channel.class";
export { Radio } from "./radio.singleton";
