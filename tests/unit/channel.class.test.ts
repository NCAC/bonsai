/**
 * Tests unitaires Channel — API tri-lane actuelle.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Import depuis le package monorepo
import { Channel } from "@bonsai/event";

describe("Channel", () => {
  beforeEach(() => {
    // Setup pour chaque test
  });

  describe("Event system concepts (Pub/Sub)", () => {
    it("should support event listener pattern", () => {
      // Test conceptuel : un système d'événements basique
      class SimpleEventEmitter {
        private listeners = new Map<string, Function[]>();

        on(event: string, callback: Function) {
          if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
          }
          this.listeners.get(event)!.push(callback);
        }

        trigger(event: string, data?: any) {
          const callbacks = this.listeners.get(event) || [];
          callbacks.forEach((callback) => callback(data));
        }
      }

      const emitter = new SimpleEventEmitter();
      let received = null;

      emitter.on("test", (data) => {
        received = data;
      });
      emitter.trigger("test", "hello");

      expect(received).toBe("hello");
    });

    it("should support request/reply pattern", async () => {
      // Test conceptuel : pattern request/reply
      class SimpleRequestReply {
        private handlers = new Map<string, Function>();

        reply(request: string, handler: Function) {
          this.handlers.set(request, handler);
        }

        async request(requestType: string, data?: any) {
          const handler = this.handlers.get(requestType);
          if (!handler) throw new Error("No handler");
          return await handler(data);
        }
      }

      const rr = new SimpleRequestReply();
      rr.reply("getData", (id: string) => Promise.resolve(`data-${id}`));

      const result = await rr.request("getData", "123");
      expect(result).toBe("data-123");
    });
  });

  // Tests réels maintenant que l'implémentation est prête
  describe("Real implementation tests", () => {
    let channel: Channel;

    beforeEach(() => {
      channel = new Channel("test-channel");
    });

    it("should create a channel with a name", () => {
      expect(channel.name).toBe("test-channel");
    });

    it("should register and trigger events", () => {
      const callback = jest.fn();
      channel.listen("test-event", callback);
      channel.emit("test-event", "data");
      expect(callback).toHaveBeenCalledWith("data");
    });

    it("should handle multiple listeners for the same event", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      channel.listen("test-event", callback1);
      channel.listen("test-event", callback2);
      channel.emit("test-event", "data");
      expect(callback1).toHaveBeenCalledWith("data");
      expect(callback2).toHaveBeenCalledWith("data");
    });

    it("should remove listeners", () => {
      const callback = jest.fn();
      channel.listen("test-event", callback);
      channel.unlisten("test-event", callback);
      channel.emit("test-event", "data");
      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle requests and replies", async () => {
      channel.reply("test-request", (data) => `response-${data}`);
      const result = await channel.request("test-request", "input");
      expect(result).toBe("response-input");
    });

    it("should handle async request handlers", async () => {
      channel.reply("async-request", async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `async-response-${data}`;
      });
      const result = await channel.request("async-request", "input");
      expect(result).toBe("async-response-input");
    });

    it("should return null for unhandled request", () => {
      const result = channel.request("nonexistent-request", "data");
      expect(result).toBeNull();
    });

    it("should clear all listeners and handlers", () => {
      const callback = jest.fn();
      channel.listen("event", callback);
      channel.reply("request", () => "response");

      channel.clear();

      channel.emit("event", "data");
      expect(callback).not.toHaveBeenCalled();
      expect(channel.request("request", {})).toBeNull();
    });

    it("should dispatch technical any event after emit", () => {
      const anyCallback = jest.fn();

      channel.listenAny(anyCallback);
      channel.emit("productAdded", { id: "p1", qty: 2 });

      expect(anyCallback).toHaveBeenCalledWith({
        event: "productAdded",
        changes: { id: "p1", qty: 2 }
      });
    });
  });
});
