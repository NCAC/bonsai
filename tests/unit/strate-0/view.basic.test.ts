/**
 * TDD — View base class (strate-0)
 *
 * Capacités View strate-0 (post ADR-0040 + ADR-0041) :
 *   - trigger("ns:cmd", payload) → envoie un Command (I4: pas d'emit)
 *   - getUI(key) → TProjectionNode pour manipulation DOM N1
 *   - get contract() → manifeste ADR-0024 + ADR-0041 (uiElements, listens, triggers, requests)
 *   - D48 : auto-discovery UI handlers on{UiKey}{DomEvent}
 *   - I48 : auto-discovery Event listeners on{Namespace}{EventName}Event
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
 *   I48 — Handlers déclarés dans contract.listens, câblés par convention
 *   I80 — Channel privé : aucun TChannelToken dans la surface consommateur
 *   I82 — Handler manquant pour key déclarée → erreur (compile via implements, runtime via mount)
 *   D48 — UI handlers auto-dérivés depuis uiElements
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Radio, type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { View, type TViewContract } from "@bonsai/view";

// ─── Fake Feature pour les tests (équivalent minimal à CartFeature.channel) ─

type TCartDef = {
  readonly commands: { addItem: { productId: string; qty: number } };
  readonly events:   { itemAdded: { item: { qty: number } } };
  readonly requests: Record<string, { params: unknown; result: unknown }>;
};

class CartFeatureFake {
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
}

// ─── Fixtures : pattern consommateur (ADR-0041) ─────────────────────────────

type TTestViewDeps = {
  readonly listens:  [typeof CartFeatureFake];
  readonly triggers: [typeof CartFeatureFake];
  readonly requests: [typeof CartFeatureFake];
};

const testViewContract = {
  uiElements: {
    title: "[data-ui='title']",
    counter: "[data-ui='counter']",
    toggleBtn: "[data-ui='toggleBtn']"
  },
  listens:  ["cart:itemAdded"] as const,
  triggers: ["cart:addItem"]   as const,
  requests: [] as const
} satisfies TViewContract<TTestViewDeps>;

type TTestViewContract = typeof testViewContract;

class TestView extends View<TTestViewDeps, TTestViewContract> {
  get contract() {
    return testViewContract;
  }

  // D48 — UI handler: on{UiKey}{DomEvent}
  onToggleBtnClick(_event: Event): void {
    this.trigger("cart:addItem", { productId: "abc", qty: 1 });
  }

  // I48 / C3 — listen external channel event (déclaré dans contract.listens)
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

describe("View — strate-0 core (ADR-0024 value-first + ADR-0041 pattern)", () => {
  beforeEach(() => {
    Radio.reset();
    setupDOM();
  });

  describe("ADR-0024 — get contract() manifeste", () => {
    it("contract is read once at mount (abstract getter pattern)", () => {
      const view = new TestView();
      const spy = jest.spyOn(view, "contract", "get");
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

      // @ts-expect-error — clé hors uiElements doit échouer compile, on teste le filet runtime
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

    it("TProjectionNode.element() returns the underlying HTMLElement", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      const el = view.getUI("title").element();
      expect(el).toBeInstanceOf(HTMLElement);
      expect(el).toBe(document.querySelector("[data-ui='title']"));
    });

    it("getUI throws when selector is not found in DOM", () => {
      document.body.innerHTML = `
        <div data-view="test">
          <span data-ui="counter">0</span>
          <button data-ui="toggleBtn">Toggle</button>
        </div>
      `;
      const view = new TestView();
      view.mount("[data-view='test']");

      // title est déclaré dans uiElements mais absent du DOM
      expect(() => view.getUI("title")).toThrow(/UI element "title" not found/);
    });
  });

  describe("I4 — View cannot emit (no emit method)", () => {
    it("View has no emit() method", () => {
      const view = new TestView();
      expect((view as unknown as { emit?: unknown }).emit).toBeUndefined();
    });
  });

  describe("trigger() — sends Command via Channel (I80 — clé namespacée, pas de token)", () => {
    it("trigger('ns:cmd', payload) calls channel.trigger() on the target namespace", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      const handler = jest.fn();
      Radio.me().channel("cart").handle("addItem", handler);

      view.callTrigger("cart:addItem", { productId: "abc", qty: 1 });

      expect(handler).toHaveBeenCalledWith({ productId: "abc", qty: 1 });
    });

    it("trigger with malformed key (no colon) throws", () => {
      const view = new TestView();
      view.mount("[data-view='test']");

      expect(() =>
        (view as unknown as { callTrigger(k: string, p: unknown): void })
          .callTrigger("malformed", {})
      ).toThrow(/Malformed namespaced key/);
    });
  });

  describe("request() — effectue une Request synchrone typée (ADR-0041)", () => {
    type TRequestDeps = {
      readonly listens:  readonly [];
      readonly triggers: readonly [];
      readonly requests: [typeof CartFeatureFake];
    };

    const requestViewContract = {
      uiElements: {},
      listens:  [] as const,
      triggers: [] as const,
      requests: ["cart:getCount"] as const
    } satisfies TViewContract<TRequestDeps>;

    type TRequestViewContract = typeof requestViewContract;

    class RequestView extends View<TRequestDeps, TRequestViewContract> {
      get contract() {
        return requestViewContract;
      }
      doRequest(): unknown {
        return this.request("cart:getCount", undefined);
      }
    }

    it("request('ns:req', params) returns result from channel replier", () => {
      document.body.innerHTML = `<div data-view="req"></div>`;
      const view = new RequestView();
      view.mount("[data-view='req']");

      Radio.me().channel("cart").reply("getCount", () => 42);
      expect(view.doRequest()).toBe(42);
    });

    it("request() returns null when no replier is registered", () => {
      document.body.innerHTML = `<div data-view="req"></div>`;
      const view = new RequestView();
      view.mount("[data-view='req']");

      expect(view.doRequest()).toBeNull();
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

  describe("I48 / C3 — Event listener auto-discovery on{Namespace}{Event}Event", () => {
    it("View câble les handlers déclarés dans contract.listens au mount", () => {
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

// ─── I82 — Handler missing for declared listen → throw at mount ─────────────

describe("I82 — handler manquant pour clé déclarée dans contract.listens", () => {
  beforeEach(() => {
    Radio.reset();
    document.body.innerHTML = `<div data-view="missing"></div>`;
  });

  it("mount() throws when contract.listens declares a key without matching handler", () => {
    type TMissingDeps = {
      readonly listens:  [typeof CartFeatureFake];
      readonly triggers: readonly [];
      readonly requests: readonly [];
    };

    const missingContract = {
      uiElements: {},
      listens:  ["cart:itemAdded"] as const,
      triggers: [] as const,
      requests: [] as const
    } satisfies TViewContract<TMissingDeps>;

    type TMissingContract = typeof missingContract;

    // Cette View viole I82 — déclare cart:itemAdded mais n'implémente pas
    // onCartItemAddedEvent. À la compilation, `implements TListenCallbacks` aurait
    // refusé cette classe. On contourne pour tester le filet runtime.
    class MissingHandlerView extends View<TMissingDeps, TMissingContract> {
      get contract() {
        return missingContract;
      }
    }

    const view = new MissingHandlerView();
    expect(() => view.mount("[data-view='missing']")).toThrow(
      /Missing handler "onCartItemAddedEvent"/
    );
  });

  it("mount() succeeds when all declared listens have a matching handler", () => {
    type TOkDeps = {
      readonly listens:  [typeof CartFeatureFake];
      readonly triggers: readonly [];
      readonly requests: readonly [];
    };

    const okContract = {
      uiElements: {},
      listens:  ["cart:itemAdded"] as const,
      triggers: [] as const,
      requests: [] as const
    } satisfies TViewContract<TOkDeps>;

    type TOkContract = typeof okContract;

    class OkView extends View<TOkDeps, TOkContract> {
      get contract() {
        return okContract;
      }
      onCartItemAddedEvent(_p: { item: { qty: number } }): void {}
    }

    const view = new OkView();
    expect(() => view.mount("[data-view='missing']")).not.toThrow();
  });
});

// ─── Contextual contract — read data-* from root element ─────────────────────

describe("ADR-0024 — contextual contract read from root element dataset", () => {
  beforeEach(() => {
    Radio.reset();
  });

  it("View reads data-* attributes from root element in onAttach() via get el()", () => {
    type TProductDeps = {
      readonly listens:  readonly [];
      readonly triggers: readonly [];
      readonly requests: readonly [];
    };

    const productContract = {
      uiElements: { price: "[data-ui='price']" },
      listens:  [] as const,
      triggers: [] as const,
      requests: [] as const
    } satisfies TViewContract<TProductDeps>;

    type TProductContract = typeof productContract;

    class ProductView extends View<TProductDeps, TProductContract> {
      get contract() {
        return productContract;
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
