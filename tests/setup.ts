/**
 * Configuration globale pour les tests Jest
 *
 * Ce fichier est exécuté avant chaque suite de tests
 * et permet de configurer l'environnement de test global.
 */

import { jest } from "@jest/globals";

// Configuration des timeouts globaux
jest.setTimeout(30000);

// Nettoyage des modules entre les tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Configuration pour les tests async
process.env.NODE_ENV = "test";

// Supprimer les warnings Node.js non pertinents en test
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  // Filtrer certains warnings spécifiques aux tests
  if (args[0]?.includes?.("punycode") || args[0]?.includes?.("DEP0040")) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Helper global pour les tests
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeTypeOf(type: string): R;
    }
  }
}

// Matcher customisé pour vérifier le type
expect.extend({
  toBeTypeOf(received: any, expectedType: string) {
    const actualType = typeof received;
    const pass = actualType === expectedType;

    if (pass) {
      return {
        message: () => `Expected ${received} not to be of type ${expectedType}`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `Expected ${received} to be of type ${expectedType}, but received ${actualType}`,
        pass: false
      };
    }
  }
});

// Configuration spécifique pour le framework Bonsai
global.BONSAI_TEST_ENV = true;
