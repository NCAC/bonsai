/**
 * Execution kernel — capture of transmitted values (G2, C.5, A3.d).
 *
 * A value is captured when it is submitted to the transport: a detached deep
 * copy, then deeply frozen. Neither the author nor any recipient keeps a
 * mutable alias on the transmitted value.
 *
 * The copier is the kernel's own, identical on every host (some test hosts,
 * such as jsdom, lack `structuredClone`). It accepts data only: primitives,
 * arrays, plain objects, `Date`, `Map`, `Set`. Anything else — a function, a
 * host element, an instance of a class — would carry a reference and is
 * refused (A3.d).
 */

import { TransportError } from "./errors";

function refuse(what: string): never {
  throw new TransportError("NOT_CAPTURABLE", `value cannot be captured by copy: ${what} (A3.d)`);
}

function copy(value: unknown, seen: Map<object, unknown>): unknown {
  if (value === null || value === undefined) return value;
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
    case "bigint":
      return value;
    case "function":
      return refuse("function");
    case "symbol":
      return refuse("symbol");
  }
  const source = value as object;
  if (seen.has(source)) return seen.get(source);
  if (Array.isArray(source)) {
    const target: unknown[] = [];
    seen.set(source, target);
    for (const item of source) target.push(copy(item, seen));
    return Object.freeze(target);
  }
  if (source instanceof Date) return Object.freeze(new Date(source.getTime()));
  if (source instanceof Map) {
    const target = new Map();
    seen.set(source, target);
    for (const [k, v] of source) target.set(copy(k, seen), copy(v, seen));
    return Object.freeze(target);
  }
  if (source instanceof Set) {
    const target = new Set();
    seen.set(source, target);
    for (const v of source) target.add(copy(v, seen));
    return Object.freeze(target);
  }
  const prototype = Object.getPrototypeOf(source);
  if (prototype !== Object.prototype && prototype !== null) {
    return refuse(`instance of ${(source as { constructor?: { name?: string } }).constructor?.name ?? "a class"}`);
  }
  const target: Record<string, unknown> = {};
  seen.set(source, target);
  for (const key of Object.keys(source)) target[key] = copy((source as Record<string, unknown>)[key], seen);
  return Object.freeze(target);
}

export function capture<T>(value: T): T {
  return copy(value, new Map()) as T;
}
