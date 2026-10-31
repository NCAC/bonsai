/**
 * Kernel prototype (migration lot M1). Not exported by `@bonsai/event` yet:
 * it lives beside the delivered `Channel`/`Radio` until it is validated.
 */

export { Root } from "./root";
export { capture } from "./capture";
export { TransportError, StartupError } from "./errors";
export type { TTransportErrorCode } from "./errors";
export type * from "./types";
