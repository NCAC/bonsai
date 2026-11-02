/**
 * Execution kernel (migration lots M1–M6). Exported by `@bonsai/kernel`;
 * the domain layer runs on it since lot M6.1, the concrete layers since M6.2.
 */

export { Root } from "./root";
export { capture } from "./capture";
export { TransportError, StartupError, InvariantError, ManifestError } from "./errors";
export type { TTransportErrorCode } from "./errors";
export type * from "./types";
