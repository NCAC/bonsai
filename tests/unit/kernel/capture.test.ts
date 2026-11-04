/**
 * Test — capture of transmitted values (G2, C.5, A3.d), kernel errors and
 * component descriptions, through the public entry point of @bonsai/kernel.
 */

import { describe, expect, it } from "@jest/globals";
import { capture, describeComponent, InvariantError, TransportError } from "@bonsai/kernel";

/** The transport error raised by `run`, or a failure when it does not throw. */
function refusal(run: () => unknown): TransportError {
  try {
    run();
  } catch (error) {
    return error as TransportError;
  }
  throw new Error("expected a refusal");
}

describe("G2 — capture by copy", () => {
  it("copies dates, maps and sets into detached, frozen values", () => {
    const date = new Date(0);
    const map = new Map([["k", { n: 1 }]]);
    const set = new Set([1, 2]);
    const copy = capture({ date, map, set });

    expect(copy.date).not.toBe(date);
    expect(copy.date.getTime()).toBe(0);
    expect(copy.map).not.toBe(map);
    expect(copy.map.get("k")).toEqual({ n: 1 });
    expect(copy.set).not.toBe(set);
    expect([...copy.set]).toEqual([1, 2]);
    for (const value of [copy, copy.date, copy.map, copy.set, copy.map.get("k")]) expect(Object.isFrozen(value)).toBe(true);

    map.get("k")!.n = 2;
    set.add(3);
    expect(copy.map.get("k")).toEqual({ n: 1 });
    expect(copy.set.size).toBe(2);
  });

  it("keeps sharing and cycles: a value seen twice is copied once", () => {
    const shared = { n: 1 };
    const cyclic: { self?: unknown; items: unknown[] } = { items: [shared, shared] };
    cyclic.self = cyclic;
    const copy = capture(cyclic);
    expect(copy.self).toBe(copy);
    expect(copy.items[0]).toBe(copy.items[1]);
    expect(copy.items[0]).not.toBe(shared);
  });

  it("accepts an object without prototype, and keeps null and undefined", () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { a: null, b: undefined });
    expect(capture(bare)).toEqual({ a: null, b: undefined });
  });

  it("refuses what would carry a reference: a symbol, an instance of a class (A3.d)", () => {
    class Point { x = 1; }
    for (const value of [Symbol("s"), new Point(), { nested: [Symbol.iterator] }]) {
      const error = refusal(() => capture(value));
      expect(error).toBeInstanceOf(TransportError);
      expect(error.code).toBe("NOT_CAPTURABLE");
    }
    expect(refusal(() => capture(new Point())).message).toMatch(/instance of Point/);
    expect(refusal(() => capture(Object.create(Object.create(null)))).message).toMatch(/instance of a class/);
  });
});

describe("Kernel errors and component descriptions", () => {
  it("an InvariantError names the entity and the violated invariant (A4.a)", () => {
    const error = new InvariantError("CartEntity", "non-negative total");
    expect(error.name).toBe("InvariantError");
    expect([error.entity, error.invariant]).toEqual(["CartEntity", "non-negative total"]);
    expect(error.message).toMatch(/^\[INVARIANT_VIOLATED\] CartEntity — invariant "non-negative total" violated/);
  });

  it("describeComponent refuses an object that is not a Bonsai component", () => {
    class Plain {}
    expect(() => describeComponent(new Plain())).toThrow(/Plain is not a Bonsai component/);
  });
});
