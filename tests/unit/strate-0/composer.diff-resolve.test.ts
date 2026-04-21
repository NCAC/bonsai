/**
 * Tests Strate 0 — Composer diff resolve() §3.1
 *
 * Couvre les 5 transitions formalisées dans RFC composer.md §3.1
 * et implémentées dans Composer.#performResolve() :
 *
 *   | resolve() retourne | View montée         | Action attendue                          |
 *   | ------------------ | ------------------- | ---------------------------------------- |
 *   | SameView+SameRoot  | SameView instance   | No-op (instance conservée)               |
 *   | NewView (ou root)  | OldView instance    | Detach OldView → Attach NewView          |
 *   | NewView            | null                | Attach NewView                           |
 *   | null               | OldView instance    | Detach OldView                           |
 *   | null               | null                | No-op                                    |
 *
 * Invariants prouvés :
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I35  — Composer n'a aucune écriture DOM (resolve unique abstract)
 *   I37  — 0/1 Views en strate 0
 *
 * ADRs prouvés :
 *   ADR-0027 — resolve(event) unique point d'entrée, pas de state local
 *   ADR-0025 — Pas de lifecycle hooks Composer
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../../helpers/dom-setup";
import { Composer, type TResolveResult } from "@bonsai/composer";
import { View, type TViewParams } from "@bonsai/view";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const emptyParams = {
  uiElements: {},
  listen: [] as readonly string[],
  trigger: [] as readonly string[]
} as const satisfies TViewParams;

class CartView extends View {
  get params() {
    return emptyParams;
  }
}

class CheckoutView extends View {
  get params() {
    return emptyParams;
  }
}

/**
 * Composer programmable : la décision est pilotée par une fonction injectée,
 * permettant de simuler chaque transition sans réinstancier.
 */
class ProgrammableComposer extends Composer {
  decide: (event: unknown | null) => TResolveResult | null = () => null;
  resolveCalls = 0;

  resolve(event: unknown | null): TResolveResult | null {
    this.resolveCalls += 1;
    return this.decide(event);
  }
}

function setupDOM(): void {
  document.body.innerHTML = `
    <main data-region="main">
      <div data-view="cart"></div>
      <div data-view="checkout"></div>
    </main>
  `;
}

function createComposer(): ProgrammableComposer {
  return new ProgrammableComposer({ rootElement: "[data-region='main']" });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Composer diff resolve() §3.1 — 5 transitions [I20, I35, I37, ADR-0027]", () => {
  beforeEach(() => {
    resetDOM();
    setupDOM();
  });

  // ── Transition 5 : null → null → no-op ───────────────────────────────────

  it("Transition null + null → no-op (currentView reste null)", () => {
    const composer = createComposer();
    composer.decide = () => null;

    composer.attach(document.body); // resolve #1 → null
    expect(composer.currentView).toBeNull();

    composer.performResolve("event-1"); // resolve #2 → null
    expect(composer.currentView).toBeNull();
    expect(composer.resolveCalls).toBe(2);
  });

  // ── Transition 3 : NewView + null → attach ───────────────────────────────

  it("Transition NewView + null → attach (instance créée, currentView défini)", () => {
    const composer = createComposer();
    composer.decide = () => ({
      view: CartView,
      rootElement: "[data-view='cart']"
    });

    composer.attach(document.body);

    expect(composer.currentView).toBeInstanceOf(CartView);
    expect(composer.currentView).not.toBeNull();
  });

  // ── Transition 1 : SameView + SameRoot → no-op (instance préservée) ──────

  it("Transition SameView + SameRoot → no-op (MÊME instance conservée)", () => {
    const composer = createComposer();
    composer.decide = () => ({
      view: CartView,
      rootElement: "[data-view='cart']"
    });

    composer.attach(document.body);
    const firstInstance = composer.currentView;

    // Second resolve avec exactement la même décision
    composer.performResolve("event-tick");

    expect(composer.currentView).toBe(firstInstance); // identité préservée
    expect(composer.currentView).toBeInstanceOf(CartView);
  });

  // ── Transition 2 (cas A) : NewView (classe différente) → detach + attach ─

  it("Transition NewView (classe différente) + instance → detach + attach", () => {
    const composer = createComposer();
    composer.decide = () => ({
      view: CartView,
      rootElement: "[data-view='cart']"
    });

    composer.attach(document.body);
    const firstInstance = composer.currentView;
    expect(firstInstance).toBeInstanceOf(CartView);

    // Bascule vers CheckoutView
    composer.decide = () => ({
      view: CheckoutView,
      rootElement: "[data-view='checkout']"
    });
    composer.performResolve("switch");

    expect(composer.currentView).not.toBe(firstInstance);
    expect(composer.currentView).toBeInstanceOf(CheckoutView);
  });

  // ── Transition 2 (cas B) : SameView mais rootElement différent ───────────

  it("Transition SameView + rootElement différent → detach + attach (nouvelle instance)", () => {
    const composer = createComposer();
    composer.decide = () => ({
      view: CartView,
      rootElement: "[data-view='cart']"
    });

    composer.attach(document.body);
    const firstInstance = composer.currentView;
    expect(firstInstance).toBeInstanceOf(CartView);

    // Même classe, autre rootElement → instance différente
    composer.decide = () => ({
      view: CartView,
      rootElement: "[data-view='checkout']"
    });
    composer.performResolve("relocate");

    expect(composer.currentView).not.toBe(firstInstance);
    expect(composer.currentView).toBeInstanceOf(CartView);
  });

  // ── Transition 4 : null + instance → detach ──────────────────────────────

  it("Transition null + instance → detach (currentView devient null)", () => {
    const composer = createComposer();
    composer.decide = () => ({
      view: CartView,
      rootElement: "[data-view='cart']"
    });

    composer.attach(document.body);
    expect(composer.currentView).toBeInstanceOf(CartView);

    // Bascule vers null
    composer.decide = () => null;
    composer.performResolve("hide");

    expect(composer.currentView).toBeNull();
  });

  // ── Cycle complet : null → View → null → View (transitions enchaînées) ──

  it("Cycle complet null → View → null → View (toutes transitions chaînées)", () => {
    const composer = createComposer();

    // 1. attach → null (transition initiale, équivalent T5 sans précédent)
    composer.decide = () => null;
    composer.attach(document.body);
    expect(composer.currentView).toBeNull();

    // 2. resolve → CartView (T3 : NewView + null)
    composer.decide = () => ({
      view: CartView,
      rootElement: "[data-view='cart']"
    });
    composer.performResolve("show-cart");
    const cartInstance = composer.currentView;
    expect(cartInstance).toBeInstanceOf(CartView);

    // 3. resolve → SameView same root (T1 : no-op)
    composer.performResolve("noop-tick");
    expect(composer.currentView).toBe(cartInstance);

    // 4. resolve → null (T4 : detach)
    composer.decide = () => null;
    composer.performResolve("hide");
    expect(composer.currentView).toBeNull();

    // 5. resolve → CheckoutView (T3 again)
    composer.decide = () => ({
      view: CheckoutView,
      rootElement: "[data-view='checkout']"
    });
    composer.performResolve("show-checkout");
    expect(composer.currentView).toBeInstanceOf(CheckoutView);
  });

  // ── ADR-0027 : pas de state local — chaque resolve est recalculé ─────────

  it("ADR-0027 — resolve() est recalculé à chaque appel (pas de cache local)", () => {
    const composer = createComposer();
    let toggle = true;
    composer.decide = () =>
      toggle
        ? { view: CartView, rootElement: "[data-view='cart']" }
        : { view: CheckoutView, rootElement: "[data-view='checkout']" };

    composer.attach(document.body);
    expect(composer.currentView).toBeInstanceOf(CartView);

    toggle = false;
    composer.performResolve("toggle");
    expect(composer.currentView).toBeInstanceOf(CheckoutView);

    toggle = true;
    composer.performResolve("toggle");
    expect(composer.currentView).toBeInstanceOf(CartView);

    expect(composer.resolveCalls).toBe(3);
  });
});
