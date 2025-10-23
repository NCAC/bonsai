/**
 * Tes TDD pour le système Radio (Singleton)
 * // Import depuis le package event buildé
 *
 * Ces tests définissent le comportement attendu du singleton Radio
 * qui gère les channels de communication dans Bonsai.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
// Import depuis le package monorepo
import { Radio } from "@bonsai/event";
describe("Radio Singleton", () => {
  beforeEach(() => {
    // Reset du singleton entre les tests si nécessaire
    // Radio.reset(); // Méthode à implémenter pour les tests
  });

  describe("Instance management", () => {
    it("should be implementable as a singleton pattern", () => {
      // Test conceptuel : le pattern singleton est implémentable
      // En TDD, on commence par vérifier que nos concepts sont valides
      expect(typeof "singleton").toBe("string");
      expect(() => {
        // Pattern singleton basique
        class TestSingleton {
          private static instance: TestSingleton;
          private constructor() {}
          static me() {
            if (!TestSingleton.instance) {
              TestSingleton.instance = new TestSingleton();
            }
            return TestSingleton.instance;
          }
        }
        const s1 = TestSingleton.me();
        const s2 = TestSingleton.me();
        return s1 === s2;
      }).not.toThrow();
    });
  });

  describe("Channel management concepts", () => {
    it("should be able to manage named channels", () => {
      // Test conceptuel : on peut gérer des channels nommés
      const channelNames = ["user", "navigation", "data"];
      const channelMap = new Map();

      channelNames.forEach((name) => {
        channelMap.set(name, { name, listeners: [] });
      });

      expect(channelMap.size).toBe(3);
      expect(channelMap.has("user")).toBe(true);
    });
  });

  // Tests réels maintenant que l'implémentation est prête
  describe("Real implementation tests", () => {
    beforeEach(() => {
      // Reset du singleton entre les tests
      Radio.reset();
    });

    it("should return the same instance when called multiple times", () => {
      const radio1 = Radio.me();
      const radio2 = Radio.me();
      expect(radio1).toBe(radio2);
    });

    it("should create and manage channels", () => {
      const radio = Radio.me();
      const channel = radio.channel("test-channel");
      expect(channel).toBeDefined();
      expect(channel.name).toBe("test-channel");
    });

    it("should return the same channel instance for the same name", () => {
      const radio = Radio.me();
      const channel1 = radio.channel("same-name");
      const channel2 = radio.channel("same-name");
      expect(channel1).toBe(channel2);
    });

    it("should list channel names", () => {
      const radio = Radio.me();
      radio.channel("channel1");
      radio.channel("channel2");
      const names = radio.getChannelNames();
      expect(names).toContain("channel1");
      expect(names).toContain("channel2");
      expect(names).toHaveLength(2);
    });

    it("should check if channel exists", () => {
      const radio = Radio.me();
      radio.channel("existing");
      expect(radio.hasChannel("existing")).toBe(true);
      expect(radio.hasChannel("nonexistent")).toBe(false);
    });

    it("should remove channels", () => {
      const radio = Radio.me();
      radio.channel("to-remove");
      expect(radio.hasChannel("to-remove")).toBe(true);
      const removed = radio.removeChannel("to-remove");
      expect(removed).toBe(true);
      expect(radio.hasChannel("to-remove")).toBe(false);
    });
  });
});
