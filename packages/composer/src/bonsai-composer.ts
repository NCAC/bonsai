/**
 * @bonsai/composer — Composer abstract base class
 *
 * Delivered capabilities:
 *   - resolve(event | null) → TResolveResult | null (0/1 View)
 *   - Immutable DOM slot provided by the parent (Foundation or View)
 *   - Minimal state machine: idle → active → idle
 *   - Slot element created when missing (ADR-19)
 *   - §3.1 transition diff (5 Same/New/null cases), no needless re-creation
 *
 * Invariants:
 *   I20  — Only Foundation/Composers create or destroy Views
 *   I35  — A Composer never writes to the DOM (reading its scope is allowed)
 *   I37  — A single Composer type; manages 0/1 View today (N instances: stratum 1d)
 *   I40  — A View's DOM scope excludes the subtrees of its declared slots
 *
 * ADRs:
 *   ADR-14 — modular contract (`get features()`): not delivered yet, no listen/request
 *   ADR-18 — no lifecycle hooks (no onMount, onUnmount or onAttach)
 *   ADR-19 — rootElement is a CSS selector string only
 *   ADR-18 — resolve(event) is the single entry point, no local state
 *
 * §3.1 diff (docs/spec/4-couche-concrete/composer.md):
 *   | resolve() returns  | Mounted View        | Action                                    |
 *   | ------------------ | ------------------- | ----------------------------------------- |
 *   | SameView+SameRoot  | SameView instance   | **No-op** (instance kept)                 |
 *   | NewView (ou root)  | OldView instance    | **Detach** OldView → **Attach** NewView   |
 *   | NewView            | null                | **Attach** NewView                        |
 *   | null               | OldView instance    | **Detach** OldView                        |
 *   | null               | null                | **No-op**                                 |
 *
 * @packageDocumentation
 */

import { View, type TViewClass } from "@bonsai/view";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Result of resolve() — describes the View to instantiate.
 *
 * No array yet (N instances: stratum 1d) and no `options` (ADR-21, stratum 2).
 *
 * The field is named `view` (not `viewClass`), as in the spec
 * (composer.md §1.1, ADR-18, ADR-19).
 *
 * `TViewClass` is deliberately structural (permissive variance): the
 * Composer does not depend on the concrete View's contract, only on its
 * mount surface (see ADR-14 and bonsai-view.ts).
 */
export type TResolveResult = {
  /** Concrete View class to instantiate */
  readonly view: TViewClass;
  /**
   * CSS selector of the View's root element (ADR-19). Meant to be resolved in
   * the Composer's slot; today View.mount() queries the whole document.
   */
  readonly rootElement: string;
};

/**
 * Composer construction options — provided by the framework.
 */
export type TComposerOptions = {
  /** CSS selector of the Composer's DOM slot — provided by the Foundation or parent View */
  readonly rootElement: string;
};

// ─── Composer abstract class ─────────────────────────────────────────────────

export abstract class Composer {
  /** CSS selector of the DOM slot — immutable (ADR-18) */
  #rootElement: string;

  /** Resolved DOM slot */
  #slot: HTMLElement | null = null;

  /** Currently mounted View (null when resolve() returned null) */
  #currentView: View | null = null;

  /**
   * Last result returned by resolve() — reference for the §3.1 diff.
   * Null when the last output was null (or before the first resolve).
   */
  #currentResult: TResolveResult | null = null;

  /** Minimal state machine: idle → active → idle */
  #state: "idle" | "active" = "idle";

  constructor(options: TComposerOptions) {
    this.#rootElement = options.rootElement;
  }

  // ─── Public API (framework only) ────────────────────────────────────

  /**
   * The rootElement selector (ADR-19).
   */
  get rootElement(): string {
    return this.#rootElement;
  }

  /**
   * Resolved DOM slot. Null before attach().
   */
  get slot(): HTMLElement | null {
    return this.#slot;
  }

  /**
   * Currently mounted View, or null.
   */
  get currentView(): View | null {
    return this.#currentView;
  }

  /**
   * Attaches the Composer to its DOM slot.
   * Called by the framework (Foundation or parent Composer).
   * Resolves the slot in the DOM, then runs the initial resolve.
   */
  attach(parentElement: HTMLElement): void {
    const el = parentElement.querySelector(
      this.#rootElement
    ) as HTMLElement | null;

    if (!el) {
      // ADR-19 — create the element when missing
      const created = this.#createElementFromSelector(this.#rootElement);
      parentElement.appendChild(created);
      this.#slot = created;
    } else {
      this.#slot = el;
    }

    // Initial resolve — null event = bootstrap
    this.#performResolve(null);
  }

  /**
   * Called by the framework when an Event is dispatched on a listened Channel.
   * No listen declaration exists yet, so only tests call it today (ADR-18).
   */
  performResolve(event: unknown | null): void {
    this.#performResolve(event);
  }

  // ─── Abstract ──────────────────────────────────────────────────────────

  /**
   * Single entry point — decides which View to instantiate (ADR-18).
   *
   * @param event — the triggering Event (null on first mount / bootstrap)
   * @returns a TResolveResult to mount a View, null to empty the slot
   */
  abstract resolve(event: unknown | null): TResolveResult | null;

  // ─── Private ───────────────────────────────────────────────────────────

  /**
   * §3.1 diff (composer.md) — applies the transition between the previous
   * state (`#currentView` + `#currentResult`) and the new decision returned
   * by `resolve(event)`. 5 possible transitions, no needless re-creation.
   */
  #performResolve(event: unknown | null): void {
    const next = this.resolve(event);
    const prev = this.#currentResult;

    // Transition 5: null + null → no-op
    if (next === null && prev === null) {
      return;
    }

    // Transition 4: null + instance → detach
    if (next === null) {
      this.#detachCurrent();
      return;
    }

    // From here on, next !== null

    // Transition 1: SameView + SameRoot + currentView → no-op
    // (instance kept, no remount)
    if (
      prev !== null &&
      this.#currentView !== null &&
      prev.view === next.view &&
      prev.rootElement === next.rootElement
    ) {
      return;
    }

    // Transition 3: NewView + null → plain attach
    if (this.#currentView === null) {
      this.#attachNew(next);
      return;
    }

    // Transition 2: NewView (or same view class with a different rootElement)
    //               + existing instance → detach + attach
    this.#detachCurrent();
    this.#attachNew(next);
  }

  /**
   * Instantiates the View described by `result`, mounts it on its
   * rootElement and updates the internal state. Only called by `#performResolve()`.
   */
  #attachNew(result: TResolveResult): void {
    const ViewClass = result.view;
    const view = new (ViewClass as unknown as new () => View)();
    view.mount(result.rootElement);
    this.#currentView = view;
    this.#currentResult = result;
    this.#state = "active";
  }

  /**
   * Detaches the current View. The Composer has no subscription of its own to
   * release (ADR-18); it only drops the reference.
   *
   * Known gap (ADR-03): the View is not unmounted — its Channel and DOM
   * listeners stay active. `view.onDetach()` and systematic unsubscription
   * are planned for stratum 1d (composer.md §4.2).
   *
   * The slot element created under ADR-19 stays in place: it is the slot,
   * not the View's rootElement.
   */
  #detachCurrent(): void {
    this.#currentView = null;
    this.#currentResult = null;
    this.#state = "idle";
  }

  /**
   * ADR-19 — parses a CSS selector and creates a matching DOM element.
   * Simplified: supports [attr], [attr='value'], the first .class and #id;
   * the tag is ignored (always a <div>, see ADR-19).
   */
  #createElementFromSelector(selector: string): HTMLElement {
    let tag = "div";
    const el = document.createElement(tag);

    // [attr='value'] or [attr="value"]
    const attrMatches = selector.matchAll(
      /\[([^\]=]+)(?:=["']([^"']*)["'])?\]/g
    );
    for (const match of attrMatches) {
      el.setAttribute(match[1], match[2] ?? "");
    }

    // .class
    const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
    if (classMatch) {
      el.classList.add(classMatch[1]);
    }

    // #id
    const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      el.id = idMatch[1];
    }

    return el;
  }
}
