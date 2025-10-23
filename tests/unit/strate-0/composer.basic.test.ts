/**
 * Tests Strate 0 — Composer basic
 *
 * Invariants prouvés :
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I35  — Composer n'a aucune écriture DOM — resolve(event) unique méthode abstraite
 *   I37  — Un seul type de Composer, gère 0/N Views (strate 0 : 0/1 seulement)
 *   I40  — Scope DOM d'une View exclut les sous-arbres des slots déclarés
 *
 * Sémantiques strate 0 (ADR-0025, ADR-0026, ADR-0027) :
 *   - resolve(event | null) → TResolveResult | null (pas de tableau en strate 0)
 *   - rootElement = string CSS, fourni par le parent (Foundation ou View)
 *   - Machine à états minimal : idle → active → idle
 *   - Création d'élément DOM si absent (D30)
 *   - Pas de lifecycle hooks (ADR-0025)
 *
 * NOTE : N-instances (retour tableau), diff, cascade = strate 1d (Hotspot C).
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { resetDOM, createRootElement } from "../../helpers/dom-setup";

// ============================================================================
// IMPORT TDD : Composer n'existe pas encore. Tests rouges.
// import { Composer, View } from "@core/bonsai";
// ============================================================================

/**
 * Fixture TResolveResult — ce que resolve() retourne
 */
// interface TResolveResult {
//   viewClass: typeof View;
//   rootElement: string; // CSS selector
//   params?: Record<string, unknown>;
// }

describe("Composer basic — Strate 0 [I20, I35, I37, I40]", () => {
  beforeEach(() => {
    resetDOM();
  });

  // ─── resolve() ───────────────────────────────────────────────────

  describe("I35 — resolve(event) is the only abstract method", () => {
    it.skip("resolve(null) at bootstrap — initial composition", () => {
      // class MainComposer extends Composer {
      //   resolve(event: TBonsaiEvent | null): TResolveResult | null {
      //     // null event = initial resolve (bootstrap)
      //     return {
      //       viewClass: CartView,
      //       rootElement: "[data-view='cart']",
      //     };
      //   }
      // }
      //
      // document.body.innerHTML = `
      //   <main data-region="main">
      //     <div data-view="cart"></div>
      //   </main>
      // `;
      //
      // const composer = new MainComposer({ rootElement: "[data-region='main']" });
      // const result = composer.resolve(null);
      //
      // expect(result).not.toBeNull();
      // expect(result!.viewClass).toBe(CartView);
      // expect(result!.rootElement).toBe("[data-view='cart']");
    });

    it.skip("resolve() returning null means 'no View to show'", () => {
      // class ConditionalComposer extends Composer {
      //   resolve(event: TBonsaiEvent | null): TResolveResult | null {
      //     return null; // Rien à afficher
      //   }
      // }
      //
      // const composer = new ConditionalComposer({ rootElement: "[data-region='main']" });
      // const result = composer.resolve(null);
      // expect(result).toBeNull();
    });
  });

  // ─── ADR-0026 — rootElement CSS selector ─────────────────────────

  describe("ADR-0026 — rootElement is a CSS selector string", () => {
    it.skip("rootElement is a CSS selector provided by the parent", () => {
      // Le Composer reçoit son rootElement du parent (Foundation ou View)
      // C'est un sélecteur CSS string — pas un HTMLElement
      //
      // const composer = new MainComposer({ rootElement: "[data-region='main']" });
      // expect(composer.rootElement).toBe("[data-region='main']");
    });

    it.skip("D30 — Composer creates DOM element if selector not found", () => {
      // Si le sélecteur ne correspond à rien dans le DOM,
      // le Composer crée l'élément et l'insère
      //
      // document.body.innerHTML = `<main data-region="main"></main>`;
      //
      // const composer = new MainComposer({ rootElement: "[data-view='cart']" });
      // // Le Composer résout et CartView a besoin de [data-view='cart']
      // // Le Composer crée <div data-view="cart"> dans son scope
      //
      // const result = composer.resolve(null);
      // // Après attach, l'élément existe
      // expect(document.querySelector("[data-view='cart']")).not.toBeNull();
    });
  });

  // ─── ADR-0025 — No lifecycle hooks ───────────────────────────────

  describe("ADR-0025 — Composer has no lifecycle hooks", () => {
    it.skip("Composer does not have onMount/onUnmount", () => {
      // class TestComposer extends Composer {
      //   resolve(event: TBonsaiEvent | null): TResolveResult | null {
      //     return null;
      //   }
      // }
      //
      // const composer = new TestComposer({ rootElement: "[data-region='main']" });
      //
      // // No lifecycle hooks
      // expect((composer as any).onMount).toBeUndefined();
      // expect((composer as any).onUnmount).toBeUndefined();
    });
  });

  // ─── I40 — Scope DOM isolation ───────────────────────────────────

  describe("I40 — View scope excludes slot subtrees", () => {
    it.skip("View cannot access DOM inside a declared slot", () => {
      // document.body.innerHTML = `
      //   <div data-view="layout">
      //     <h1 data-ui="title">Layout</h1>
      //     <div data-slot="sidebar">
      //       <!-- Cet espace appartient au Composer enfant, pas au LayoutView -->
      //       <div data-view="sidebar">
      //         <span data-ui="sidebarTitle">Sidebar</span>
      //       </div>
      //     </div>
      //   </div>
      // `;
      //
      // // LayoutView peut accéder à @ui.title mais PAS à ce qui est dans [data-slot='sidebar']
      // // Le slot est géré par un Composer enfant
    });
  });
});
