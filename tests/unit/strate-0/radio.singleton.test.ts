/**
 * Tests Strate 0 — Radio Singleton
 *
 * Invariants prouvés : I15 (Radio = infrastructure interne)
 *
 * Le Radio est le registre central des Channels. En strate 0 :
 * - Singleton strict (me() retourne toujours la même instance)
 * - Gestion de channels nommés (create, get, has, remove)
 * - Reset pour les tests
 *
 * NOTE : I15 (Radio jamais exposé publiquement) sera prouvé dans
 * compile-time/type-safety.test.ts — ici on teste le comportement runtime.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Radio } from "@bonsai/event";

describe("Radio Singleton — Strate 0 [I15]", () => {
  beforeEach(() => {
    Radio.reset();
  });

  // ─── Singleton pattern ───────────────────────────────────────────

  describe("Singleton pattern", () => {
    it("me() returns the same instance on multiple calls", () => {
      const r1 = Radio.me();
      const r2 = Radio.me();
      expect(r1).toBe(r2);
    });

    it("reset() clears the singleton — next me() creates a fresh instance", () => {
      const r1 = Radio.me();
      r1.channel("test");
      expect(r1.hasChannel("test")).toBe(true);

      Radio.reset();

      const r2 = Radio.me();
      expect(r2).not.toBe(r1);
      expect(r2.hasChannel("test")).toBe(false);
    });

    it("constructor is not publicly accessible", () => {
      // Radio has a private constructor — the only way to get an instance is me()
      // This is a runtime sanity check; the compile-time check is in type-safety.test.ts
      expect(typeof Radio.me).toBe("function");
      // @ts-expect-error — private constructor
      expect(() => new Radio()).toThrow();
    });
  });

  // ─── Channel management ──────────────────────────────────────────

  describe("Channel management", () => {
    it("channel(name) creates a new channel", () => {
      const radio = Radio.me();
      const channel = radio.channel("cart");
      expect(channel).toBeDefined();
      expect(channel.name).toBe("cart");
    });

    it("channel(name) returns the same instance for the same name", () => {
      const radio = Radio.me();
      const c1 = radio.channel("cart");
      const c2 = radio.channel("cart");
      expect(c1).toBe(c2);
    });

    it("channel(name) creates distinct instances for different names", () => {
      const radio = Radio.me();
      const cart = radio.channel("cart");
      const pricing = radio.channel("pricing");
      expect(cart).not.toBe(pricing);
      expect(cart.name).toBe("cart");
      expect(pricing.name).toBe("pricing");
    });

    it("hasChannel() returns true only for existing channels", () => {
      const radio = Radio.me();
      expect(radio.hasChannel("cart")).toBe(false);
      radio.channel("cart");
      expect(radio.hasChannel("cart")).toBe(true);
    });

    it("getChannelNames() lists all channel names", () => {
      const radio = Radio.me();
      radio.channel("cart");
      radio.channel("pricing");
      radio.channel("inventory");
      const names = radio.getChannelNames();
      expect(names).toHaveLength(3);
      expect(names).toContain("cart");
      expect(names).toContain("pricing");
      expect(names).toContain("inventory");
    });

    it("removeChannel() removes a channel and returns true", () => {
      const radio = Radio.me();
      radio.channel("cart");
      expect(radio.removeChannel("cart")).toBe(true);
      expect(radio.hasChannel("cart")).toBe(false);
    });

    it("removeChannel() returns false for non-existent channel", () => {
      const radio = Radio.me();
      expect(radio.removeChannel("nonexistent")).toBe(false);
    });
  });
});
