/**
 * TEST GATE — Strate 0 : Cart round-trip E2E
 *
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  Ce test est le CRITÈRE DE GATE de la strate 0 (ADR-31).     ║
 * ║  La strate 0 n'est PAS livrée tant que ce test ne passe pas.   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Full scenario with a DOM:
 *
 *   1. new Application({ features, foundation, document }).start()
 *   2. MainComposer resolves CartView; the kernel creates its part in AppFoundation's slot
 *   3. Click on @ui.addButton, admitted as a fact of the part
 *      → CartView.onAddButtonClick(fact, ctx)
 *      → ctx.trigger("cart:addItem", { productId: "prod", qty: 1, price: 9.99 })
 *   4. CartFeature.onAddItemCommand(payload, ctx), in its own validation unit
 *      → ctx.mutate("addItem", draft => { draft.items.push(...) })
 *      → ctx.emit("itemAdded", { item })
 *   5. CartView.onCartItemAddedEvent(payload, ctx) queries the cart
 *      → N1 projection: this.getUI("itemCount").text(count), engaged after validation
 *   6. DOM assertion: the item count is updated, and no unit failed
 *
 * Invariants prouvés (par transitivité) :
 *   I1, I10, I11, I22, I25, I31, I39, I48, I51
 *   I73 — CartFeature déclare `static readonly channel: TChannelToken<TDef, "cart">`
 *         (cf. tests/fixtures/cart-feature.fixture.ts — sans cette déclaration,
 *         Application.start() ne peut pas câbler le Channel propre).
 *   I74 — `TChannelDefinition` co-localisé dans le fichier `.feature.ts` du
 *         domaine (CartEntity + CartFeature + CartView dans le même fichier).
 *   I83 — Pattern modulaire ADR-14 en 5 étapes appliqué à CartView : features
 *         (TFeatureContract) + uiEvents (TUIContract) + uiElements (TUIElements)
 *         + TViewContract dérivé + View<TVC> + implements TViewCallbacks<TVC>.
 *   I85 — Le helper `ui<TEl>()(events)` curryfié est l'unique forme de
 *         construction des `TUIEntry` dans la fixture.
 *   I86 — Champ `events` toujours présent et toujours un tableau (`[]` ou
 *         `["click"]`) — la fixture l'exerce dans les deux modes.
 *   + ADR-15, ADR-09, ADR-19, ADR-02, ADR-14, ADR-18
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../helpers/dom-setup";
import { Application } from "@bonsai/application";
import { CartFeature, AppFoundation } from "../fixtures/cart-feature.fixture";

describe("🚪 GATE Strate 0 — Cart round-trip E2E [ADR-31]", () => {
  beforeEach(() => {
    resetDOM();

    // Simuler un DOM pré-rendu (PDR : le HTML existe déjà)
    document.body.innerHTML = `
      <header data-region="header">
        <h1>Bonsai Cart</h1>
      </header>
      <main data-region="main">
      </main>
    `;
  });

  it("click addButton → trigger → handle → mutate → emit → N1 projection → DOM updated", () => {
    // ── 1. Bootstrap : Features, puis Foundation → Composer → View ────
    const app = new Application({
      features: { cart: CartFeature },
      foundation: AppFoundation,
      document
    });
    app.start();

    // ── 2. La View existe dans l'emplacement déclaré, avec son gabarit ─
    const main = document.querySelector("[data-region='main']")!;
    expect(main.children).toHaveLength(1); // la partie de la View, créée par le Composer
    const addButton = document.querySelector("[data-ui='addButton']") as HTMLElement;
    const itemCount = document.querySelector("[data-ui='itemCount']")!;
    const total = document.querySelector("[data-ui='total']")!;
    const emptyMsg = document.querySelector("[data-ui='emptyMessage']") as HTMLElement;
    expect(itemCount.textContent).toBe("0");

    // ── 3. Premier click : fait → trigger → Command → mutate → Event → projection
    addButton.click();
    expect(itemCount.textContent).toBe("1");
    expect(total.textContent).toBe("9.99");
    expect(emptyMsg.style.display).toBe("none");

    // ── 4. Deuxième click : l'état est celui de la Feature, pas de la View
    addButton.click();
    expect(itemCount.textContent).toBe("2");
    expect(total.textContent).toBe("19.98");

    // ── 5. Aucune unité n'a échoué ────────────────────────────────────
    expect(app.root!.trace.filter((t) => t.type === "unit-failed")).toEqual([]);
  });
});
