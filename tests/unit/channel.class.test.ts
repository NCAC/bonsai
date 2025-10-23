/**
 * Te// Import depuis les sources pour éviter les problèmes de modules ES avec Jest
import { Channel } from '../../packages/event/src/channel.class';s TDD pour la classe Channel
 *
 * Ces tests définissent le comportement attendu d'un Channel
 * qui gère les communications pub/sub et request/reply.
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
      channel.on("test-event", callback);
      channel.trigger("test-event", "data");
      expect(callback).toHaveBeenCalledWith("data");
    });

    it("should handle multiple listeners for the same event", () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      channel.on("test-event", callback1);
      channel.on("test-event", callback2);
      channel.trigger("test-event", "data");
      expect(callback1).toHaveBeenCalledWith("data");
      expect(callback2).toHaveBeenCalledWith("data");
    });

    it("should remove listeners", () => {
      const callback = jest.fn();
      channel.on("test-event", callback);
      channel.off("test-event", callback);
      channel.trigger("test-event", "data");
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

    it("should throw error for unhandled request", async () => {
      await expect(
        channel.request("nonexistent-request", "data")
      ).rejects.toThrow(
        "No handler registered for request type: nonexistent-request"
      );
    });

    it("should provide introspection methods", () => {
      const callback = jest.fn();
      channel.on("event1", callback);
      channel.on("event2", callback);
      channel.reply("request1", () => "response");

      expect(channel.getListenedEvents()).toEqual(["event1", "event2"]);
      expect(channel.getSupportedRequests()).toEqual(["request1"]);
      expect(channel.isListening("event1")).toBe(true);
      expect(channel.isListening("nonexistent")).toBe(false);
      expect(channel.canHandle("request1")).toBe(true);
      expect(channel.canHandle("nonexistent")).toBe(false);
    });

    it("should clear all listeners and handlers", () => {
      const callback = jest.fn();
      channel.on("event", callback);
      channel.reply("request", () => "response");

      channel.clear();

      expect(channel.getListenedEvents()).toHaveLength(0);
      expect(channel.getSupportedRequests()).toHaveLength(0);
    });
  });
});
