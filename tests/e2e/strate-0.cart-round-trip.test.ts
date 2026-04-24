/**
 * TEST GATE — Strate 0 : Cart round-trip E2E
 *
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  Ce test est le CRITÈRE DE GATE de la strate 0 (ADR-0028).     ║
 * ║  La strate 0 n'est PAS livrée tant que ce test ne passe pas.   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Scénario complet avec DOM :
 *
 *   1. Application.register(CartFeature) + Application.start()
 *   2. CartView est montée dans le DOM (via Foundation → MainComposer → CartView)
 *   3. Simuler click sur @ui.addButton
 *      → D48 auto-dérive → CartView.onAddButtonClick()
 *      → CartView.trigger(cart:addItem, { productId: "123", qty: 1 })
 *   4. CartFeature.onAddItemCommand() est appelé
 *      → this.entity.mutate("addItem", draft => { draft.items.push(...) })
 *      → onAnyEntityUpdated() (changedKeys = ["items", "total"])
 *      → this.emit("itemAdded", { item })
 *   5. CartView écoute cart:itemAdded
 *      → handler met à jour la projection N1 : this.getUI("itemCount").text(count)
 *   6. Assertion DOM : le compteur d'items est mis à jour
 *
 * Invariants prouvés (par transitivité) :
 *   I1, I10, I11, I22, I25, I26, I31, I39, I48, I51
 *   + D48, D17, D30, ADR-0023, ADR-0024, ADR-0025, ADR-0026, ADR-0027
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../helpers/dom-setup";
import { Application } from "@bonsai/application";
import { CartFeature, AppFoundation } from "../fixtures/cart-feature.fixture";

describe("🚪 GATE Strate 0 — Cart round-trip E2E [ADR-0028]", () => {
  beforeEach(() => {
    resetDOM();

    // Simuler un DOM pré-rendu (PDR : le HTML existe déjà)
    document.body.innerHTML = `
      <header data-region="header">
        <h1>Bonsai Cart</h1>
      </header>
      <main data-region="main">
        <div data-view="cart">
          <span data-ui="itemCount">0</span>
          <span data-ui="total">0.00</span>
          <button data-ui="addButton">Add Item</button>
          <ul data-ui="itemList"></ul>
          <div data-ui="emptyMessage">Cart is empty</div>
        </div>
      </main>
    `;
  });

  it("click addButton → trigger → handle → mutate → emit → N1 projection → DOM updated", () => {
    // ── 1. Bootstrap ──────────────────────────────────────────────
    // ADR-0039 — manifest applicatif (clé = namespace, valeur = classe Feature).
    // L'unicité, le format camelCase et l'accord TSelfNS↔clé sont vérifiés
    // au compile-time via `StrictManifest<M>` (cf. tests de type).
    const app = new Application({
      foundation: AppFoundation,
      features: { cart: CartFeature }
    });
    app.start();

    // ── 2. Vérifier que la View est montée ────────────────────────
    const addButton = document.querySelector(
      "[data-ui='addButton']"
    ) as HTMLElement;
    expect(addButton).not.toBeNull();

    const itemCount = document.querySelector("[data-ui='itemCount']");
    const total = document.querySelector("[data-ui='total']");
    const emptyMsg = document.querySelector(
      "[data-ui='emptyMessage']"
    ) as HTMLElement;

    // État initial — pré-rendu côté template (PDR), la View n'a rien projeté
    expect(itemCount!.textContent).toBe("0");

    // ── 3. Premier click ──────────────────────────────────────────
    addButton.click();

    // ── 4. Projection N1 mise à jour ──────────────────────────────
    expect(itemCount!.textContent).toBe("1");
    expect(total!.textContent).toBe("9.99");
    // visible(false) → display:none (D19)
    expect(emptyMsg.style.display).toBe("none");

    // ── 5. Deuxième click — confirme la persistance du state ─────
    addButton.click();
    expect(itemCount!.textContent).toBe("2");
    expect(total!.textContent).toBe("19.98");
  });
});
