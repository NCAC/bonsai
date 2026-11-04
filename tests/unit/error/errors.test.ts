/**
 * Test — public surface of @bonsai/error: BonsaiError, root of every framework error (ADR-05)
 * and the validation helpers (ADR-06), through the package entry point.
 */

import { describe, expect, it, jest } from "@jest/globals";
import {
  BonsaiError,
  invariant,
  hardInvariant,
  warning,
  isDev
} from "@bonsai/error";
import { InvariantError, ManifestError, StartupError, TransportError } from "@bonsai/kernel";
import { BonsaiNamespaceError } from "@bonsai/feature";

describe("BonsaiError (ADR-05) — root of every framework error", () => {
  it("formats the code, the component and the suggestion when given", () => {
    const full = new BonsaiError("I10", "duplicate handler", { component: "cart", suggestion: "remove one of them" });
    expect(full.message).toBe("[I10] cart — duplicate handler\n  → remove one of them");
    expect([full.code, full.component, full.suggestion]).toEqual(["I10", "cart", "remove one of them"]);
    expect(full.name).toBe("BonsaiError");
    expect(full.context).toBeUndefined();                       // attached by the kernel only (ADR-04)

    const bare = new BonsaiError("NOT_STARTED", "no context");
    expect(bare.message).toBe("[NOT_STARTED] — no context");
    expect([bare.component, bare.suggestion]).toEqual(["", ""]);
    expect("cause" in bare).toBe(false);
  });

  it("keeps the reported error as the standard Error.cause", () => {
    const original = new Error("boom");
    expect(new BonsaiError("X", "wrapped", { cause: original }).cause).toBe(original);
  });

  it("every error class of the framework is a BonsaiError with a stable code", () => {
    const errors = [
      new TransportError("NOT_AUTHORIZED", "refused"),
      new InvariantError("cart", "total ≥ 0"),
      new StartupError(new Error("init failed")),
      new ManifestError("CYCLIC_DEPENDENCIES", "a ↔ b"),
      new BonsaiNamespaceError("NAMESPACE_RESERVED", "router")
    ];
    expect(errors.map((e) => e instanceof BonsaiError)).toEqual([true, true, true, true, true]);
    expect(errors.map((e) => e.code)).toEqual(["NOT_AUTHORIZED", "INVARIANT_VIOLATED", "STARTUP_FAILED", "CYCLIC_DEPENDENCIES", "NAMESPACE_RESERVED"]);
    expect(errors.map((e) => e.name)).toEqual(["TransportError", "InvariantError", "StartupError", "ManifestError", "BonsaiNamespaceError"]);
    expect(errors[1]!.component).toBe("cart");
  });
});

describe("Validation helpers (ADR-06)", () => {
  it("isDev is true when __DEV__ is not defined (tests run the sources, not a bundle)", () => {
    expect(isDev()).toBe(true);
  });

  it("in production (__DEV__ false), isDev is false and invariant no longer checks; hardInvariant still does", () => {
    const scope = globalThis as { __DEV__?: boolean };
    scope.__DEV__ = false;
    try {
      expect(isDev()).toBe(false);
      expect(() => invariant(false, "dev only")).not.toThrow();
      expect(() => hardInvariant(false, "structural")).toThrow(BonsaiError);
    } finally {
      delete scope.__DEV__;
    }
    expect(isDev()).toBe(true);
  });

  it("invariant and hardInvariant throw a BonsaiError only when the condition is false", () => {
    expect(() => invariant(true, "never")).not.toThrow();
    expect(() => hardInvariant(1, "never")).not.toThrow();
    expect(() => invariant(false, "dev check", "I10", "cart")).toThrow("[I10] cart — dev check");
    expect(() => hardInvariant(0, "structural", "I21")).toThrow(BonsaiError);
  });

  it("warning logs in development and never throws", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    warning(true, "silent");
    warning(false, "something is off");
    expect(warn.mock.calls).toEqual([["[Bonsai] something is off"]]);
  });
});
