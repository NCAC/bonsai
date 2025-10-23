/**
 * Tests Strate 0 — Channel tri-lane basic
 *
 * Invariants prouvés :
 *   I10  — Un Command a un seul handler (la Feature propriétaire)
 *   I11  — Un Event peut avoir N subscribers
 *   I25  — trigger() = Command (1:1)
 *   I26  — emit() = Event (1:N)
 *   I27  — Un Command peut être refusé ; un Event est un fait irrévocable
 *   I29  — reply() retourne T synchrone — request() → T | null
 *   I55  — reply() ne throw jamais — retourne T ou null
 *
 * Sémantiques runtime ADR-0003 :
 *   - Command sans handler → throw en dev
 *   - Request sans replier → null immédiat
 *   - Replier qui throw → null (D44 révisé, ADR-0023)
 *   - Event sans listener → silencieux
 *   - Duplicate command handler → throw
 *   - Isolation erreurs entre listeners (emit continue malgré throw)
 *
 * NOTE : le Channel existant dans packages/event/src/channel.class.ts est
 * pré-Bonsai (request async, pas de tri-lane). Ces tests définissent le
 * contrat Bonsai v1. L'implémentation devra être refaite/adaptée.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ============================================================================
// IMPORT TDD : ce chemin importera le Channel Bonsai v1 quand il existera.
// Pour l'instant, on importe le Channel existant pour montrer ce qui casse.
// Quand l'API v1 sera implémentée, cet import restera identique.
// ============================================================================
import { Channel } from "@bonsai/event";

describe("Channel tri-lane basic — Strate 0 [I10, I11, I25, I26, I27, I29, I55]", () => {
  let channel: Channel;

  beforeEach(() => {
    channel = new Channel("cart");
  });

  // ═══════════════════════════════════════════════════════════════════
  // Lane 1 — Commands (trigger → handle, 1:1)
  // ═══════════════════════════════════════════════════════════════════

  describe("Lane 1 — Commands (trigger → handle) [I10, I25]", () => {
    it("I10 — handle() registers a single handler for a command", () => {
      const handler = jest.fn();

      // API v1 : channel.handle(commandName, handler)
      // Différent de channel.on() qui est pour les Events (Lane 2)
      channel.handle("addItem", handler);
      channel.trigger("addItem", { productId: "123", qty: 1 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ productId: "123", qty: 1 });
    });

    it("I10 — duplicate handle() for same command throws DuplicateHandlerError", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      channel.handle("addItem", handler1);

      expect(() => channel.handle("addItem", handler2)).toThrow();
    });

    it("I25/I27 — trigger() without handler throws in dev mode", () => {
      // En strate 0, pas de handler enregistré → erreur
      // (Le mode dev/prod sera configurable en strate 1 — ici on est toujours en dev)
      expect(() =>
        channel.trigger("nonexistent", {})
      ).toThrow();
    });

    it("trigger() passes payload to the registered handler", () => {
      const handler = jest.fn();
      const payload = { productId: "abc", qty: 3, options: { gift: true } };

      channel.handle("addItem", handler);
      channel.trigger("addItem", payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Lane 2 — Events (emit → listen, 1:N)
  // ═══════════════════════════════════════════════════════════════════

  describe("Lane 2 — Events (emit → listen) [I11, I26]", () => {
    it("I11 — emit() notifies all registered listeners", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      channel.listen("itemAdded", listener1);
      channel.listen("itemAdded", listener2);
      channel.listen("itemAdded", listener3);
      channel.emit("itemAdded", { item: { productId: "123" } });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it("I26 — emit() passes payload to all listeners", () => {
      const listener = jest.fn();
      const payload = { item: { productId: "123", name: "Widget" } };

      channel.listen("itemAdded", listener);
      channel.emit("itemAdded", payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    it("I27 — emit() with no listeners is silently ignored", () => {
      // Un Event sans listeners = fait irrévocable émis, personne n'écoute, pas d'erreur
      expect(() =>
        channel.emit("nobodyListening", { data: "ignored" })
      ).not.toThrow();
    });

    it("emit() error in one listener does not prevent other listeners", () => {
      const listener1 = jest.fn(() => {
        throw new Error("listener1 crash");
      });
      const listener2 = jest.fn();

      channel.listen("itemAdded", listener1);
      channel.listen("itemAdded", listener2);
      channel.emit("itemAdded", { item: {} });

      // listener2 DOIT être appelé malgré le throw de listener1
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("unlisten() removes a specific listener", () => {
      const listener = jest.fn();

      channel.listen("itemAdded", listener);
      channel.unlisten("itemAdded", listener);
      channel.emit("itemAdded", { item: {} });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Lane 3 — Requests (request → reply, 1:1 synchrone)
  // ═══════════════════════════════════════════════════════════════════

  describe("Lane 3 — Requests (request → reply) [I29, I55]", () => {
    it("I29 — request() returns T synchronously (not a Promise)", () => {
      channel.reply("getTotal", () => 42);

      const result = channel.request("getTotal", {});

      // Résultat SYNCHRONE — pas besoin d'await (ADR-0023)
      expect(result).toBe(42);
      // Vérifie que ce n'est PAS une Promise
      expect(result).not.toBeInstanceOf(Promise);
    });

    it("I29 — request() returns null when no replier registered", () => {
      const result = channel.request("nonexistent", {});

      expect(result).toBeNull();
    });

    it("I55 — request() returns null when replier throws (never propagates)", () => {
      channel.reply("getTotal", () => {
        throw new Error("database connection lost");
      });

      const result = channel.request("getTotal", {});

      // Le framework intercepte, retourne null (D44 révisé)
      expect(result).toBeNull();
    });

    it("reply() passes params to the replier function", () => {
      channel.reply("getItemPrice", (params: { productId: string }) => {
        return params.productId === "123" ? 9.99 : 0;
      });

      const result = channel.request("getItemPrice", { productId: "123" });
      expect(result).toBe(9.99);
    });

    it("I10-analogous — duplicate reply() for same request type throws", () => {
      channel.reply("getTotal", () => 42);

      expect(() =>
        channel.reply("getTotal", () => 99)
      ).toThrow();
    });

    it("unreply() removes a replier", () => {
      channel.reply("getTotal", () => 42);
      channel.unreply("getTotal");

      const result = channel.request("getTotal", {});
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Introspection
  // ═══════════════════════════════════════════════════════════════════

  describe("Introspection", () => {
    it("channel has a name", () => {
      expect(channel.name).toBe("cart");
    });

    it("clear() removes all handlers, listeners and repliers", () => {
      const handler = jest.fn();
      const listener = jest.fn();

      channel.handle("addItem", handler);
      channel.listen("itemAdded", listener);
      channel.reply("getTotal", () => 42);

      channel.clear();

      // Tout est nettoyé
      expect(() => channel.trigger("addItem", {})).toThrow(); // no handler
      channel.emit("itemAdded", {}); // silencieux
      expect(listener).not.toHaveBeenCalled();
      expect(channel.request("getTotal", {})).toBeNull();
    });
  });
});
