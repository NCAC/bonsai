/**
 * Tests Strate 0 — Foundation basic
 *
 * Invariants prouvés :
 *   I33  — Foundation unique par application — cible <body>
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../../helpers/dom-setup";
import { Foundation, type TFoundationComposerEntry } from "@bonsai/foundation";
import { Composer, type TResolveResult } from "@bonsai/composer";
import { View, type TViewParams } from "@bonsai/view";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const simpleViewParams = {
  uiElements: {},
  listen: [] as readonly string[],
  trigger: [] as readonly string[]
} as const satisfies TViewParams;

class SimpleView extends View {
  get params() {
    return simpleViewParams;
  }
}

class MainComposer extends Composer {
  resolve(event: unknown | null): TResolveResult | null {
    return { viewClass: SimpleView, rootElement: "[data-view='main']" };
  }
}

class HeaderComposer extends Composer {
  resolve(event: unknown | null): TResolveResult | null {
    return null;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Foundation basic — Strate 0 [I33, I20]", () => {
  beforeEach(() => {
    resetDOM();
  });

  describe("I33 — Singleton Foundation, targets <body>", () => {
    it("Foundation rootElement is document.body", () => {
      class AppFoundation extends Foundation {
        get composers(): readonly TFoundationComposerEntry[] {
          return [];
        }
      }

      const foundation = new AppFoundation();
      expect(foundation.el).toBe(document.body);
    });

    it("I33 — Foundation cannot be attached twice", () => {
      class AppFoundation extends Foundation {
        get composers(): readonly TFoundationComposerEntry[] {
          return [];
        }
      }

      const foundation = new AppFoundation();
      foundation.attach();

      expect(() => foundation.attach()).toThrow(/already attached/i);
    });
  });

  describe("Composers racines", () => {
    it("Foundation declares root Composers via get composers()", () => {
      class AppFoundation extends Foundation {
        get composers(): readonly TFoundationComposerEntry[] {
          return [
            {
              composer: HeaderComposer as unknown as typeof Composer,
              rootElement: "[data-region='header']"
            },
            {
              composer: MainComposer as unknown as typeof Composer,
              rootElement: "[data-region='main']"
            }
          ];
        }
      }

      document.body.innerHTML = `
        <header data-region="header"></header>
        <main data-region="main">
          <div data-view="main"></div>
        </main>
      `;

      const foundation = new AppFoundation();
      foundation.attach();

      expect(foundation.composerInstances).toHaveLength(2);
    });

    it("Foundation onAttach() is called after Composers are resolved", () => {
      const callOrder: string[] = [];

      class AppFoundation extends Foundation {
        get composers(): readonly TFoundationComposerEntry[] {
          return [];
        }
        onAttach() {
          callOrder.push("onAttach");
        }
      }

      const foundation = new AppFoundation();
      foundation.attach();

      expect(callOrder).toContain("onAttach");
    });
  });
});
