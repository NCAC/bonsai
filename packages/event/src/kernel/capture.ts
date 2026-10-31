/**
 * Kernel prototype — capture of transmitted values (G2, C.5, A3.d).
 *
 * A value is captured when it is submitted to the transport: a detached deep
 * copy, then deeply frozen. Neither the author nor any recipient keeps a
 * mutable alias on the transmitted value. Values that cannot be copied
 * (functions, host elements) are refused: they would carry a reference.
 */

import { TransportError } from "./errors";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value as object)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
  }
  return value;
}

export function capture<T>(value: T): T {
  if (value === undefined) return value;
  try {
    return deepFreeze(structuredClone(value));
  } catch (error) {
    throw new TransportError(
      "NOT_CAPTURABLE",
      `value cannot be captured by copy: ${(error as Error).message}`
    );
  }
}
