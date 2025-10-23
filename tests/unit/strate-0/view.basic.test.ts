/**
 * Tests Strate 0 — View basic
 *
 * Invariants prouvés :
 *   I4   — View : trigger, listen, request seulement — jamais emit()
 *   I5   — Views n'ont jamais accès aux Entities
 *   I18  — View a le monopole du rendu (seul composant DOM)
 *   I19  — View n'a aucune responsabilité sur son propre cycle de vie
 *   I30  — View ne possède aucun domain state
 *   I31  — Au onAttach(), la View DOIT avoir un el (rootElement) dans le DOM
 *   I32  — rootElement altérable en N1 par la View, jamais détruit/remplacé
 *   I34  — rootElement d'une View = enfant de <body>, jamais <body>
 *   I36  — View ne compose jamais d'autres Views
 *   I39  — View accède au DOM exclusivement via getUI(key)
 *
 * Capacités strate 0 :
 *   - trigger(command) — envoie un Command sur un Channel (I25)
 *   - getUI(key) → TProjectionNode — projection N1 (text, attr, toggleClass, visible, style)
 *   - handlers UI auto-dérivés depuis TUIMap (D48)
 *   - onAttach() hook
 *   - get params() manifeste value-first (ADR-0024)
 *
 * NOTE : pas de templates N2/N3, pas de localState, pas de Behaviors en strate 0.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { resetDOM, createRootElement } from "../../helpers/dom-setup";

// ============================================================================
// IMPORT TDD : View n'existe pas encore. Tests rouges.
// import { View } from "@core/bonsai";
// ============================================================================

describe("View basic — Strate 0 [I4, I5, I18, I30, I31, I32, I39]", () => {
  beforeEach(() => {
    resetDOM();
  });

  // ─── rootElement et cycle de vie ─────────────────────────────────

  describe("I31 — rootElement exists in DOM at onAttach()", () => {
    it.skip("View receives its rootElement from the Composer", () => {
      // Le Composer fournit le rootElement via un sélecteur CSS (ADR-0026)
      // La View ne le crée pas — elle le reçoit
      //
      // createRootElement("div", "[data-view='cart']");
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      //
      // expect(view.el).toBeInstanceOf(HTMLElement);
      // expect(view.el.getAttribute("data-view")).toBe("cart");
    });

    it.skip("I34 — rootElement is child of body, never body itself", () => {
      // const view = createView(CartView, { rootElement: "body" });
      // expect(() => view.attach()).toThrow(); // body interdit
    });

    it.skip("onAttach() is called after rootElement is set", () => {
      // class CartView extends View {
      //   public attachCalled = false;
      //   onAttach() { this.attachCalled = true; }
      // }
      //
      // createRootElement("div", "[data-view='cart']");
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      // view.attach();
      //
      // expect(view.attachCalled).toBe(true);
      // expect(view.el).toBeDefined();
    });
  });

  // ─── I39 — getUI(key) N1 projection ─────────────────────────────

  describe("I39 — DOM access exclusively via getUI(key)", () => {
    it.skip("getUI(key).text(value) sets text content", () => {
      // document.body.innerHTML = `
      //   <div data-view="cart">
      //     <span data-ui="itemCount">0</span>
      //   </div>
      // `;
      //
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      // view.attach();
      //
      // view.getUI("itemCount").text("5");
      // expect(document.querySelector("[data-ui='itemCount']")!.textContent).toBe("5");
    });

    it.skip("getUI(key).attr(name, value) sets attribute", () => {
      // document.body.innerHTML = `
      //   <div data-view="cart">
      //     <button data-ui="addButton" disabled>Add</button>
      //   </div>
      // `;
      //
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      // view.attach();
      //
      // view.getUI("addButton").attr("disabled", null); // remove
      // expect(document.querySelector("[data-ui='addButton']")!.hasAttribute("disabled")).toBe(false);
    });

    it.skip("getUI(key).toggleClass(name, force) toggles CSS class", () => {
      // document.body.innerHTML = `
      //   <div data-view="cart">
      //     <div data-ui="panel" class="collapsed"></div>
      //   </div>
      // `;
      //
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      // view.attach();
      //
      // view.getUI("panel").toggleClass("collapsed", false);
      // view.getUI("panel").toggleClass("expanded", true);
      //
      // const panel = document.querySelector("[data-ui='panel']")!;
      // expect(panel.classList.contains("collapsed")).toBe(false);
      // expect(panel.classList.contains("expanded")).toBe(true);
    });

    it.skip("getUI(key).visible(show) controls display", () => {
      // document.body.innerHTML = `
      //   <div data-view="cart">
      //     <div data-ui="emptyMessage">Cart is empty</div>
      //   </div>
      // `;
      //
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      // view.attach();
      //
      // view.getUI("emptyMessage").visible(false);
      // const el = document.querySelector("[data-ui='emptyMessage']") as HTMLElement;
      // expect(el.style.display).toBe("none");
      //
      // view.getUI("emptyMessage").visible(true);
      // expect(el.style.display).not.toBe("none");
    });
  });

  // ─── D48 — UI handlers auto-derived from TUIMap ─────────────────

  describe("D48 — UI event handlers auto-derived from TUIMap", () => {
    it.skip("click on @ui.addButton calls onAddButtonClick(event)", () => {
      // class CartView extends View {
      //   static readonly ui = {
      //     addButton: "[data-ui='addButton']",
      //     removeButton: "[data-ui='removeButton']",
      //   } as const;
      //
      //   onAddButtonClick(event: Event) {
      //     this.trigger("cart:addItem", { productId: "123", qty: 1 });
      //   }
      // }
      //
      // D48 auto-derive : CartView.ui.addButton → onAddButtonClick
      // Le framework branche le event listener au attach()
      //
      // document.body.innerHTML = `
      //   <div data-view="cart">
      //     <button data-ui="addButton">Add</button>
      //   </div>
      // `;
      //
      // const triggerSpy = jest.fn();
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      // view.trigger = triggerSpy;
      // view.attach();
      //
      // document.querySelector("[data-ui='addButton']")!.click();
      //
      // expect(triggerSpy).toHaveBeenCalledWith("cart:addItem", { productId: "123", qty: 1 });
    });
  });

  // ─── trigger() — Lane 1 ─────────────────────────────────────────

  describe("trigger() — sends Commands [I25]", () => {
    it.skip("trigger(commandName, payload) sends a Command on the Channel", () => {
      // const view = createView(CartView, { rootElement: "[data-view='cart']" });
      // view.attach();
      //
      // // La View déclenche un Command — pas un Event
      // view.trigger("cart:addItem", { productId: "123", qty: 1 });
      //
      // // Le Command est routé vers CartFeature.onAddItemCommand()
    });
  });

  // ─── ADR-0024 — get params() manifeste value-first ──────────────

  describe("ADR-0024 — params manifest (value-first)", () => {
    it.skip("View declares its params manifest with as const satisfies", () => {
      // class ProductView extends View {
      //   get params() {
      //     return {
      //       productId: this.el.dataset.productId ?? "",
      //       variant: this.el.dataset.variant ?? "default",
      //     } as const;
      //   }
      // }
      //
      // document.body.innerHTML = `
      //   <div data-view="product" data-product-id="123" data-variant="blue"></div>
      // `;
      //
      // const view = createView(ProductView, { rootElement: "[data-view='product']" });
      // view.attach();
      //
      // expect(view.params.productId).toBe("123");
      // expect(view.params.variant).toBe("blue");
    });
  });
});
