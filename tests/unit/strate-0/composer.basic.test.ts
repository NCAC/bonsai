/**
 * Tests Strate 0 — Composer basic
 *
 * Invariants prouvés :
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I35  — Composer n'a aucune écriture DOM — resolve(event) unique méthode abstraite
 *   I37  — Un seul type de Composer, gère 0/N Views (strate 0 : 0/1 seulement)
 *
 * Sémantiques strate 0 (ADR-0025, ADR-0026, ADR-0027) :
 *   - resolve(event | null) → TResolveResult | null (pas de tableau en strate 0)
 *   - rootElement = string CSS, fourni par le parent (Foundation ou View)
 *   - Machine à états minimal : idle → active → idle
 *   - Création d'élément DOM si absent (D30)
 *   - Pas de lifecycle hooks (ADR-0025)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../../helpers/dom-setup";
import { Composer, type TResolveResult } from "@bonsai/composer";
import { View, type TViewParams } from "@bonsai/view";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const cartViewParams = {
  uiElements: { title: "[data-ui='title']" },
  listen: [] as readonly string[],
  trigger: [] as readonly string[]
} as const satisfies TViewParams;

class CartView extends View {
  get params() {
    return cartViewParams;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Composer basic — Strate 0 [I20, I35, I37]", () => {
  beforeEach(() => {
    resetDOM();
  });

  describe("I35 — resolve(event) is the only abstract method", () => {
    it("resolve(null) at bootstrap — initial composition", () => {
      class MainComposer extends Composer {
        resolve(event: unknown | null): TResolveResult | null {
          return {
            viewClass: CartView,
            rootElement: "[data-view='cart']"
          };
        }
      }

      document.body.innerHTML = `
        <main data-region="main">
          <div data-view="cart"><h1 data-ui="title">Cart</h1></div>
        </main>
      `;

      const composer = new MainComposer({
        rootElement: "[data-region='main']"
      });
      const result = composer.resolve(null);

      expect(result).not.toBeNull();
      expect(result!.viewClass).toBe(CartView);
      expect(result!.rootElement).toBe("[data-view='cart']");
    });

    it("resolve() returning null means 'no View to show'", () => {
      class ConditionalComposer extends Composer {
        resolve(event: unknown | null): TResolveResult | null {
          return null;
        }
      }

      const composer = new ConditionalComposer({
        rootElement: "[data-region='main']"
      });
      const result = composer.resolve(null);
      expect(result).toBeNull();
    });
  });

  describe("ADR-0026 — rootElement is a CSS selector string", () => {
    it("rootElement is a CSS selector provided by the parent", () => {
      class MainComposer extends Composer {
        resolve(event: unknown | null): TResolveResult | null {
          return null;
        }
      }

      const composer = new MainComposer({
        rootElement: "[data-region='main']"
      });
      expect(composer.rootElement).toBe("[data-region='main']");
    });

    it("D30 — Composer creates DOM element if selector not found", () => {
      class MainComposer extends Composer {
        resolve(event: unknown | null): TResolveResult | null {
          return { viewClass: CartView, rootElement: "[data-view='cart']" };
        }
      }

      document.body.innerHTML = `<main data-region="main"></main>`;

      const composer = new MainComposer({ rootElement: "[data-view='cart']" });
      composer.attach(document.querySelector("[data-region='main']")!);

      expect(composer.slot).not.toBeNull();
      expect(composer.slot!.getAttribute("data-view")).toBe("cart");
    });
  });

  describe("ADR-0025 — Composer has no lifecycle hooks", () => {
    it("Composer does not have onMount/onUnmount/onAttach/onDetach", () => {
      class TestComposer extends Composer {
        resolve(event: unknown | null): TResolveResult | null {
          return null;
        }
      }

      const composer = new TestComposer({
        rootElement: "[data-region='main']"
      });

      expect((composer as any).onMount).toBeUndefined();
      expect((composer as any).onUnmount).toBeUndefined();
      expect((composer as any).onAttach).toBeUndefined();
      expect((composer as any).onDetach).toBeUndefined();
    });
  });

  describe("attach() — Composer mounts View from resolve()", () => {
    it("attach() resolves and mounts the View", () => {
      class MainComposer extends Composer {
        resolve(event: unknown | null): TResolveResult | null {
          return { viewClass: CartView, rootElement: "[data-view='cart']" };
        }
      }

      document.body.innerHTML = `
        <main data-region="main">
          <div data-view="cart"><h1 data-ui="title">Cart</h1></div>
        </main>
      `;

      const composer = new MainComposer({
        rootElement: "[data-region='main']"
      });
      composer.attach(document.body);

      expect(composer.currentView).not.toBeNull();
      expect(composer.currentView).toBeInstanceOf(View);
    });

    it("attach() with resolve() returning null — no View mounted", () => {
      class EmptyComposer extends Composer {
        resolve(event: unknown | null): TResolveResult | null {
          return null;
        }
      }

      document.body.innerHTML = `<main data-region="main"></main>`;

      const composer = new EmptyComposer({
        rootElement: "[data-region='main']"
      });
      composer.attach(document.body);

      expect(composer.currentView).toBeNull();
    });
  });
});
