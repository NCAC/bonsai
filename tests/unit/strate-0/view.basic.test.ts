/**
 * TDD — View base class (strate-0, post-ADR-0042)
 *
 * Capacités View strate-0 (ADR-0040 + ADR-0041 + ADR-0042) :
 *   - trigger("ns:cmd", payload) → envoie un Command (I4: pas d'emit)
 *   - getUI(key) → TProjectionNode<TEl> typé au sous-type HTMLElement
 *   - get features() / get uiEvents() / get uiElements() → manifeste modulaire
 *   - D48 channel : on{NS}{Event}Event câblés depuis features[NS].listens
 *   - D48 UI      : on{UIKey}{DomEvent} câblés depuis uiEvents[k].events
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
 *   I80 — Channel privé : aucun TChannelToken dans la surface consommateur
 *   I81 — features/uiEvents/uiElements sont les sources de vérité runtime
 *   I82 — Handler manquant → erreur (compile via implements, runtime via mount)
 *   I84 — events: [E,...] non-vide impose les handlers DOM correspondants
 *   I87 — Clé d'objet ≡ namespace de la Feature référencée
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Radio, type TChannelToken } from "@bonsai/event";
import {
  View, ui,
  type TViewContract,
  type TUIContract,
  type TUIElements
} from "@bonsai/view";
import type { TFeatureContract } from "@bonsai/feature";

// ─── Fake Feature pour les tests (équivalent minimal à CartFeature.channel) ─

type TCartDef = {
  readonly commands: { addItem: { productId: string; qty: number } };
  readonly events:   { itemAdded: { item: { qty: number } } };
  readonly requests: {
    getCount: { params: undefined; result: number };
  };
};

class CartFeatureFake {
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
}

// ─── Fixtures : pattern modulaire (ADR-0042) ────────────────────────────────

const testFeatures = {
  cart: {
    feature:  CartFeatureFake,
    listens:  ["itemAdded"] as const,
    triggers: ["addItem"]   as const,
    requests: []            as const
  }
} satisfies TFeatureContract;

const testUiEvents = {
  title:     ui<HTMLElement>()([]),
  counter:   ui<HTMLElement>()([]),
  toggleBtn: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;

const testUiElements = {
  title:     "[data-ui='title']",
  counter:   "[data-ui='counter']",
  toggleBtn: "[data-ui='toggleBtn']"
} satisfies TUIElements<typeof testUiEvents>;

type TTestViewContract = TViewContract<
  typeof testFeatures,
  typeof testUiEvents
>;

class TestView extends View<TTestViewContract> {
  get features()   { return testFeatures; }
  get uiEvents()   { return testUiEvents; }
  get uiElements() { return testUiElements; }

  // D48 UI — handler requis (events: ["click"] sur toggleBtn)
  onToggleBtnClick(_event: MouseEvent): void {
    this.callTrigger("cart:addItem", { productId: "abc", qty: 1 });
  }

  // D48 channel — handler requis (cart.listens: ["itemAdded"])
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

describe("View — strate-0 core (ADR-0024 value-first + ADR-0042 modulaire)", () => {
  beforeEach(() => {
    Radio.reset();
    setupDOM();
  });

  describe("ADR-0024 — manifeste modulaire lu une seule fois au mount", () => {
    it("features / uiEvents / uiElements sont chacun appelés une seule fois", () => {
      const view = new TestView();
      const featuresSpy = jest.spyOn(view, "features", "get");
      const uiEventsSpy = jest.spyOn(view, "uiEvents", "get");
      const uiElementsSpy = jest.spyOn(view, "uiElements", "get");
      view.mount("[data-view='test']");

      expect(featuresSpy).toHaveBeenCalledTimes(1);
      expect(uiEventsSpy).toHaveBeenCalledTimes(1);
      expect(uiElementsSpy).toHaveBeenCalledTimes(1);
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

      // @ts-expect-error — clé hors uiEvents doit échouer compile, on teste le filet runtime
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

  describe("request() — effectue une Request synchrone typée (ADR-0042)", () => {
    const requestFeatures = {
      cart: {
        feature:  CartFeatureFake,
        listens:  []            as const,
        triggers: []            as const,
        requests: ["getCount"]  as const
      }
    } satisfies TFeatureContract;

    const requestUiEvents = {} as const satisfies TUIContract;
    const requestUiElements = {} as const satisfies TUIElements<typeof requestUiEvents>;

    type TRequestViewContract = TViewContract<
      typeof requestFeatures,
      typeof requestUiEvents
    >;

    class RequestView extends View<TRequestViewContract> {
      get features()   { return requestFeatures; }
      get uiEvents()   { return requestUiEvents; }
      get uiElements() { return requestUiElements; }

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

  describe("D48 UI — handler auto-discovery on{UiKey}{DomEvent}", () => {
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

  describe("D48 channel — handler auto-discovery on{Namespace}{Event}Event", () => {
    it("View câble les handlers déclarés dans features[NS].listens au mount", () => {
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

describe("I82 — handler manquant pour clé déclarée dans features[NS].listens", () => {
  beforeEach(() => {
    Radio.reset();
    document.body.innerHTML = `<div data-view="missing"></div>`;
  });

  it("mount() throws when features.cart.listens declares a key without matching handler", () => {
    const missingFeatures = {
      cart: {
        feature:  CartFeatureFake,
        listens:  ["itemAdded"] as const,
        triggers: []            as const,
        requests: []            as const
      }
    } satisfies TFeatureContract;

    const missingUiEvents = {} as const satisfies TUIContract;
    const missingUiElements = {} as const satisfies TUIElements<typeof missingUiEvents>;

    type TMissingContract = TViewContract<
      typeof missingFeatures,
      typeof missingUiEvents
    >;

    // Cette View viole I82 — déclare cart.listens: ["itemAdded"] mais n'implémente
    // pas onCartItemAddedEvent. À la compilation, `implements TViewCallbacks`
    // aurait refusé cette classe. On contourne pour tester le filet runtime.
    class MissingHandlerView extends View<TMissingContract> {
      get features()   { return missingFeatures; }
      get uiEvents()   { return missingUiEvents; }
      get uiElements() { return missingUiElements; }
    }

    const view = new MissingHandlerView();
    expect(() => view.mount("[data-view='missing']")).toThrow(
      /Missing handler "onCartItemAddedEvent"/
    );
  });

  it("mount() succeeds when all declared listens have a matching handler", () => {
    const okFeatures = {
      cart: {
        feature:  CartFeatureFake,
        listens:  ["itemAdded"] as const,
        triggers: []            as const,
        requests: []            as const
      }
    } satisfies TFeatureContract;

    const okUiEvents = {} as const satisfies TUIContract;
    const okUiElements = {} as const satisfies TUIElements<typeof okUiEvents>;

    type TOkContract = TViewContract<typeof okFeatures, typeof okUiEvents>;

    class OkView extends View<TOkContract> {
      get features()   { return okFeatures; }
      get uiEvents()   { return okUiEvents; }
      get uiElements() { return okUiElements; }
      onCartItemAddedEvent(_p: { item: { qty: number } }): void {}
    }

    const view = new OkView();
    expect(() => view.mount("[data-view='missing']")).not.toThrow();
  });
});

// ─── I84 — uiEvents interactif sans uiElements / sans handler DOM ───────────

describe("I84 — filet runtime des handlers DOM (events non vides)", () => {
  beforeEach(() => {
    Radio.reset();
    document.body.innerHTML = `
      <div data-view="missing-ui">
        <button data-ui="addBtn">Add</button>
      </div>
    `;
  });

  it("mount() throws when uiEvents declares a key absent from uiElements", () => {
    const features = {} as const satisfies TFeatureContract;
    const uiEvents = {
      addBtn: ui<HTMLButtonElement>()(["click"])
    } satisfies TUIContract;
    // Viole compile-time : la clé `addBtn` est absente de uiElements.
    // On contourne via cast pour exercer le filet runtime (line 510).
    const uiElementsBroken = {} as TUIElements<typeof uiEvents>;

    type TBrokenContract = TViewContract<typeof features, typeof uiEvents>;

    class BrokenElementsView extends View<TBrokenContract> {
      get features()   { return features; }
      get uiEvents()   { return uiEvents; }
      get uiElements() { return uiElementsBroken; }
      onAddBtnClick(_e: MouseEvent): void {}
    }

    const view = new BrokenElementsView();
    expect(() => view.mount("[data-view='missing-ui']")).toThrow(
      /UI key "addBtn" declared in uiEvents but missing in uiElements/
    );
  });

  it("mount() throws when a declared DOM event has no matching on{Key}{Event} handler", () => {
    const features = {} as const satisfies TFeatureContract;
    const uiEvents = {
      addBtn: ui<HTMLButtonElement>()(["click"])
    } satisfies TUIContract;
    const uiElements = {
      addBtn: "[data-ui='addBtn']"
    } satisfies TUIElements<typeof uiEvents>;

    type TMissingHandlerContract = TViewContract<typeof features, typeof uiEvents>;

    // Viole compile-time : `implements TViewCallbacks` aurait imposé
    // `onAddBtnClick`. Filet runtime à line 520.
    class MissingDomHandlerView extends View<TMissingHandlerContract> {
      get features()   { return features; }
      get uiEvents()   { return uiEvents; }
      get uiElements() { return uiElements; }
    }

    const view = new MissingDomHandlerView();
    expect(() => view.mount("[data-view='missing-ui']")).toThrow(
      /Missing handler "onAddBtnClick" for declared event "click" on ui\.addBtn/
    );
  });
});

// ─── Contextual contract — read data-* from root element ─────────────────────

describe("ADR-0024 — contextual contract read from root element dataset", () => {
  beforeEach(() => {
    Radio.reset();
  });

  it("View reads data-* attributes from root element in onAttach() via get el()", () => {
    const productFeatures = {} as const satisfies TFeatureContract;
    const productUiEvents = {
      price: ui<HTMLElement>()([])
    } satisfies TUIContract;
    const productUiElements = {
      price: "[data-ui='price']"
    } satisfies TUIElements<typeof productUiEvents>;

    type TProductContract = TViewContract<
      typeof productFeatures,
      typeof productUiEvents
    >;

    class ProductView extends View<TProductContract> {
      get features()   { return productFeatures; }
      get uiEvents()   { return productUiEvents; }
      get uiElements() { return productUiElements; }

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
