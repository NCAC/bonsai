/**
 * @bonsai/foundation — Foundation abstract base class
 *
 * Delivered capabilities:
 *   - body = document.body            (I33)
 *   - html = document.documentElement (N1 alteration right, ADR-20)
 *   - Declares the root Composers through abstract get composers()
 *     (Readonly<Record<string, typeof Composer>> — ADR-20)
 *   - Creates and attaches the Composers at bootstrap in insertion order
 *     (ES2015+ Object.entries guarantees string-key order)
 *   - onAttach() / onDetach() hooks
 *
 * Invariants:
 *   I33  — A single Foundation per application — targets <body>
 *   I20  — Only Foundation/Composers create or destroy Views
 *   I34  — A View's rootElement is a descendant of <body>, never <body>
 *   I67  — Structural stability of the Foundation (ADR-20)
 *   ADR-20 — the Foundation may alter html/body at N1 only
 *
 * Not delivered yet:
 *   - Declared global events (post-v1 track, docs/ROADMAP.md)
 *   - Global event delegation
 *   - Channel capabilities (form not decided)
 *
 * @packageDocumentation
 */

import { Composer, type TComposerOptions } from "@bonsai/composer";

// ─── Foundation abstract class ───────────────────────────────────────────────

export abstract class Foundation {
  /** <body> — always document.body (I33) */
  #body: HTMLElement;

  /** <html> — N1 alteration right (ADR-20, foundation.md §2) */
  #html: HTMLElement;

  /** Root Composer instances created at bootstrap */
  #composerInstances: Composer[] = [];

  /** Flag: Foundation already attached */
  #attached = false;

  constructor() {
    this.#body = document.body;
    this.#html = document.documentElement;
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * <body> (foundation.md §1).
   * Developers may alter it at N1 only (classes, attributes) — ADR-20.
   */
  protected get body(): HTMLElement {
    return this.#body;
  }

  /**
   * <html> (foundation.md §1).
   * Developers may alter it at N1 only (classes, attributes) — ADR-20.
   */
  protected get html(): HTMLElement {
    return this.#html;
  }

  /**
   * The created Composer instances.
   */
  get composerInstances(): readonly Composer[] {
    return this.#composerInstances;
  }

  /**
   * Attaches the Foundation: resolves and creates the root Composers.
   * Called once by Application.start().
   *
   * Iterates over Object.entries(this.composers) — insertion order of
   * non-numeric string keys is guaranteed by ES2015+ (§9.1.12).
   */
  attach(): void {
    if (this.#attached) {
      throw new Error(
        "[Bonsai Foundation] Foundation already attached — I33 singleton violated"
      );
    }
    this.#attached = true;

    const composersMap = this.composers;

    for (const [selector, ComposerCtor] of Object.entries(composersMap)) {
      const ComposerClass = ComposerCtor as unknown as new (
        opts: TComposerOptions
      ) => Composer;
      const instance = new ComposerClass({ rootElement: selector });
      instance.attach(this.#body);
      this.#composerInstances.push(instance);
    }

    this.onAttach();
  }

  // ─── Abstract ──────────────────────────────────────────────────────────

  /**
   * Declares the Foundation's root Composers — ADR-20.
   *
   * Keys = CSS selectors in <body> (free string, checked at runtime).
   * Values = concrete Composer classes.
   *
   * Stable, persistent layout — typically 3 to 5 entries
   * (#header, #main, #footer, #aside...). Evaluated once at bootstrap (I67).
   *
   * For dynamic composition, delegate to a dedicated View through
   * View.composers + PDR (ADR-20, delegation pattern).
   */
  abstract get composers(): Readonly<Record<string, typeof Composer>>;

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Hook called once the root Composers are resolved.
   * Override it to add global DOM listeners (resize, scroll, etc.).
   * Default no-op.
   */
  onAttach(): void {
    // Default no-op
  }

  /**
   * Hook called at shutdown — counterpart of onAttach().
   * Override it to remove the global DOM listeners added in onAttach().
   * Default no-op.
   *
   * NB: not called yet — Application.stop() does not exist (stratum 1).
   */
  onDetach(): void {
    // Default no-op
  }
}
