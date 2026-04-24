/**
 * TDD — View base class (strate-0)
 *
 * Capacités View strate-0 :
 *   - trigger(namespace, commandName, payload) → envoie un Command (I4: pas d'emit)
 *   - getUI(key) → TProjectionNode pour manipulation DOM N1
 *   - get params() → manifeste ADR-0024 (uiElements, listen, trigger)
 *   - D48 : auto-discovery UI handlers on{UiKey}{DomEvent}
 *   - I48 : auto-discovery Event listeners on{Channel}{EventName}Event
 *   - onAttach() lifecycle hook
 *   - rootElement injecté au mount
 *
 * Invariants :
 *   I4  — View n'a jamais emit()
 *   I31 — rootElement est un sélecteur CSS string
 *   I34 — rootElement d'une View = enfant de body, jamais body lui-même
 *   I36 — View ne compose jamais d'autres Views
 *   I39 — Accès DOM via getUI(key) uniquement
 *   I40 — Scope DOM : résolution dans rootElement
 *   I48 — Handlers auto-découverts par convention
 *   D48 — UI handlers auto-dérivés depuis uiElements
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Radio } from "@bonsai/event";
import { View, type TViewParams } from "@bonsai/view";

// ─── Fixtures : ADR-0024 value-first pattern ─────────────────────────────────

const testViewParams = {
  uiElements: {
    title: "[data-ui='title']",
    counter: "[data-ui='counter']",
    toggleBtn: "[data-ui='toggleBtn']"
  },
  listen: ["cart"],
  trigger: ["cart"]
} as const satisfies TViewParams;

class TestView extends View {
  get params() {
    return testViewParams;
  }

  // D48 — UI handler: on{UiKey}{DomEvent}
  onToggleBtnClick(_event: Event): void {
    this.trigger("cart", "addItem", { productId: "abc", qty: 1 });
  }

  // I48 / C3 — listen external channel event
  onCartItemAddedEvent(payload: { item: { qty: number } }): void {
    this.getUI("counter").text(String(payload.item.qty));
  }

  onAttach(): void {
    // lifecycle hook called after mount
  }
}

// ─── DOM Setup ───────────────────────────────────────────────────────────────

function setupDOM(): void {
  document.body.innerHTML = `
    <div data-view="test">
      <h2 data-ui="title">Hello</h2>
      <span data-ui="counter">0</span>
      <button data-ui="toggleBtn">Toggle</button>
    </div>
  `;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("View — strate-0 core (ADR-0024 value-first)", () => {
  beforeEach(() => {
    Radio.reset();
    setupDOM();
  });

  describe("ADR-0024 — get params() manifeste", () => {
    it("params is read once at mount (abstract getter pattern)", () => {
      const view = new TestView();
      const spy = jest.spyOn(view, "params", "get");
      view.mount("[data-view='test']");

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("I31 — rootElement injection", () => {
    it("View receives rootElement at mount and scopes DOM queries to it", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      expect(view.rootElement).toBe("[data-view='test']");
    });

    it("mount() calls onAttach() lifecycle hook", () => {
      const view = new TestView();
      const spy = jest.spyOn(view, "onAttach");
      view.mount("[data-view='test']");

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("mount() is idempotent — second call is no-op", () => {
      const view = new TestView();
      const spy = jest.spyOn(view, "onAttach");
      view.mount("[data-view='test']");
      view.mount("[data-view='test']");

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("I39 — getUI(key) returns TProjectionNode", () => {
    it("getUI resolves element within rootElement scope (I40)", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      const titleNode = view.getUI("title");
      expect(titleNode).toBeDefined();
    });

    it("getUI throws on unknown key", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      expect(() => view.getUI("nonexistent")).toThrow(/Unknown UI key/);
    });

    it("TProjectionNode.text() sets textContent", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      view.getUI("title").text("Updated");
      const el = document.querySelector("[data-ui='title']") as HTMLElement;
      expect(el.textContent).toBe("Updated");
    });

    it("TProjectionNode.attr() sets an attribute", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      view.getUI("title").attr("aria-label", "heading");
      const el = document.querySelector("[data-ui='title']") as HTMLElement;
      expect(el.getAttribute("aria-label")).toBe("heading");
    });

    it("TProjectionNode.toggleClass() adds/removes a class", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      view.getUI("title").toggleClass("active", true);
      const el = document.querySelector("[data-ui='title']") as HTMLElement;
      expect(el.classList.contains("active")).toBe(true);

      view.getUI("title").toggleClass("active", false);
      expect(el.classList.contains("active")).toBe(false);
    });

    it("TProjectionNode.visible() toggles display none", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      view.getUI("counter").visible(false);
      const el = document.querySelector("[data-ui='counter']") as HTMLElement;
      expect(el.style.display).toBe("none");

      view.getUI("counter").visible(true);
      expect(el.style.display).toBe("");
    });

    it("TProjectionNode.style() sets inline style property", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      view.getUI("title").style("color", "red");
      const el = document.querySelector("[data-ui='title']") as HTMLElement;
      expect(el.style.color).toBe("red");
    });
  });

  describe("I4 — View cannot emit (no emit method)", () => {
    it("View has no emit() method", () => {
      const view = new TestView();
      expect((view as any).emit).toBeUndefined();
    });
  });

  describe("trigger() — sends Command via Channel", () => {
    it("trigger() calls channel.trigger() on the target namespace", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      const handler = jest.fn();
      Radio.me().channel("cart").handle("addItem", handler);

      view.callTrigger("cart", "addItem", { productId: "abc", qty: 1 });

      expect(handler).toHaveBeenCalledWith({ productId: "abc", qty: 1 });
    });
  });

  describe("D48 — UI handler auto-discovery on{UiKey}{DomEvent}", () => {
    it("click on toggleBtn calls onToggleBtnClick and triggers command", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      const handler = jest.fn();
      Radio.me().channel("cart").handle("addItem", handler);

      // Simulate click
      const btn = document.querySelector(
        "[data-ui='toggleBtn']"
      ) as HTMLElement;
      btn.click();

      expect(handler).toHaveBeenCalledWith({ productId: "abc", qty: 1 });
    });
  });

  describe("I48 / C3 — Event listener auto-discovery on{Channel}{Event}Event", () => {
    it("View auto-discovers on{Channel}{EventName}Event handlers at mount", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      // Emit from cart channel
      Radio.me()
        .channel("cart")
        .emit("itemAdded", { item: { qty: 5 } });

      const el = document.querySelector("[data-ui='counter']") as HTMLElement;
      expect(el.textContent).toBe("5");
    });
  });
});

// ─── I34 — rootElement is child of body, never body itself ───────────────────

describe("I34 — rootElement cannot be document.body", () => {
  beforeEach(() => {
    Radio.reset();
    document.body.innerHTML = `
      <div data-view="test">
        <h2 data-ui="title">Hello</h2>
        <span data-ui="counter">0</span>
        <button data-ui="toggleBtn">Toggle</button>
      </div>
    `;
  });

  it("mount() throws when rootElement selector resolves to document.body", () => {
    const view = new TestView();
    expect(() => view.mount("body")).toThrow(/I34/);
  });
});

// ─── Contextual params — read data-* from root element ───────────────────────

describe("ADR-0024 — contextual params from root element dataset", () => {
  beforeEach(() => {
    Radio.reset();
  });

  it("View reads data-* attributes from root element in onAttach() via get el()", () => {
    class ProductView extends View {
      readonly #viewParams = {
        uiElements: { price: "[data-ui='price']" },
        listen: [] as readonly string[],
        trigger: [] as readonly string[]
      } as const satisfies TViewParams;

      get params(): TViewParams {
        return this.#viewParams;
      }

      #productId = "";
      get productId(): string {
        return this.#productId;
      }

      onAttach(): void {
        this.#productId = this.el?.dataset.productId ?? "";
      }
    }

    document.body.innerHTML = `
      <div data-view="product" data-product-id="123">
        <span data-ui="price">€9.99</span>
      </div>
    `;

    const view = new ProductView();
    view.mount("[data-view='product']");

    expect(view.productId).toBe("123");
  });
});
