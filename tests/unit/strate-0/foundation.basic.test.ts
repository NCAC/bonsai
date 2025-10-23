/**
 * Tests Strate 0 — Foundation basic
 *
 * Invariants prouvés :
 *   I33  — Foundation unique par application — cible <body>
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I34  — rootElement d'une View = enfant de <body>, jamais <body>
 *
 * Sémantiques strate 0 :
 *   - rootElement = document.body (toujours)
 *   - Déclare les Composers racines via get composers()
 *   - N'a PAS de TUIMap en strate 0 (ADR-0018 Suspended)
 *   - N'a PAS d'event delegation globale en strate 0 (strate 1)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { resetDOM } from "../../helpers/dom-setup";

// ============================================================================
// IMPORT TDD : Foundation n'existe pas encore. Tests rouges.
// import { Foundation, Composer, Application } from "@core/bonsai";
// ============================================================================

describe("Foundation basic — Strate 0 [I33, I20]", () => {
  beforeEach(() => {
    resetDOM();
  });

  describe("I33 — Singleton Foundation, targets <body>", () => {
    it.skip("Foundation rootElement is document.body", () => {
      // const foundation = new Foundation();
      // expect(foundation.el).toBe(document.body);
    });

    it.skip("I33 — only one Foundation per Application", () => {
      // const app = new Application();
      // // La Foundation est fournie par l'Application ou par défaut
      // // Instancier une deuxième Foundation devrait être impossible
    });
  });

  describe("Composers racines", () => {
    it.skip("Foundation declares root Composers via get composers()", () => {
      // class AppFoundation extends Foundation {
      //   get composers() {
      //     return [
      //       { composer: HeaderComposer, rootElement: "[data-region='header']" },
      //       { composer: MainComposer, rootElement: "[data-region='main']" },
      //       { composer: FooterComposer, rootElement: "[data-region='footer']" },
      //     ] as const;
      //   }
      // }
      //
      // document.body.innerHTML = `
      //   <header data-region="header"></header>
      //   <main data-region="main"></main>
      //   <footer data-region="footer"></footer>
      // `;
      //
      // // Au bootstrap, la Foundation crée les Composers racines
      // // Chaque Composer gère sa région du DOM
    });
  });
});
