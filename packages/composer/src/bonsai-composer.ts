/**
 * @bonsai/composer — Composer abstract base class
 *
 * Strate 0 — Capacités :
 *   - resolve(event | null) → TResolveResult | null (0/1 View)
 *   - Slot DOM immutable fourni par le parent (Foundation ou View)
 *   - Machine à états minimal : idle → active → idle
 *   - Création d'élément DOM si absent (D30)
 *
 * Invariants :
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I35  — Composer n'a aucune écriture DOM (lecture scope autorisée)
 *   I37  — Un seul type de Composer, gère 0/1 Views en strate 0
 *   I40  — Scope DOM d'une View exclut les sous-arbres des slots déclarés
 *
 * ADRs :
 *   ADR-0024 — get params() value-first (strate 0 : pas de listen/request)
 *   ADR-0025 — Pas de lifecycle hooks (ni onMount, ni onUnmount, ni onAttach)
 *   ADR-0026 — rootElement = string CSS selector only
 *   ADR-0027 — resolve(event) unique point d'entrée, pas de state local
 *
 * @packageDocumentation
 */

import { View } from "@bonsai/view";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Résultat de resolve() — décrit la View à instancier.
 *
 * Strate 0 (ADR-0028) : pas de tableau (N-instances reportées en strate 1),
 * pas d'options (D34 reporté).
 *
 * Le champ `view` (et non `viewClass`) est l'identifiant officiel
 * du contrat — alignement RFC composer.md §1.1 + ADR-0020 §6.2 + ADR-0026.
 */
export type TResolveResult = {
  /** La classe View concrète à instancier */
  readonly view: typeof View;
  /** Sélecteur CSS de l'élément root de la View — dans le scope du Composer (ADR-0026) */
  readonly rootElement: string;
};

/**
 * Options de construction du Composer — fournies par le framework.
 */
export type TComposerOptions = {
  /** Sélecteur CSS du slot DOM du Composer — fourni par Foundation ou View parent */
  readonly rootElement: string;
};

// ─── Composer abstract class ─────────────────────────────────────────────────

export abstract class Composer {
  /** Sélecteur CSS du slot DOM — immutable (ADR-0020) */
  #rootElement: string;

  /** Référence au slot DOM résolu */
  #slot: HTMLElement | null = null;

  /** La View actuellement montée (null si resolve() a retourné null) */
  #currentView: View | null = null;

  /** Machine à états minimal : idle → active → idle */
  #state: "idle" | "active" = "idle";

  constructor(options: TComposerOptions) {
    this.#rootElement = options.rootElement;
  }

  // ─── Public API (framework only) ────────────────────────────────────

  /**
   * Le sélecteur rootElement (ADR-0026).
   */
  get rootElement(): string {
    return this.#rootElement;
  }

  /**
   * Référence au slot DOM résolu. Null avant attach().
   */
  get slot(): HTMLElement | null {
    return this.#slot;
  }

  /**
   * La View actuellement montée, ou null.
   */
  get currentView(): View | null {
    return this.#currentView;
  }

  /**
   * Attache le Composer à son slot DOM.
   * Appelé par le framework (Foundation ou Composer parent).
   * Résout le slot dans le DOM, puis appelle initialResolve().
   */
  attach(parentElement: HTMLElement): void {
    const el = parentElement.querySelector(
      this.#rootElement
    ) as HTMLElement | null;

    if (!el) {
      // D30 — Créer l'élément si absent
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
   * Appelé par le framework quand un Event est dispatché sur un Channel écouté.
   * En strate 0, pas de listen déclaré — cette méthode est un point d'extension.
   */
  performResolve(event: unknown | null): void {
    this.#performResolve(event);
  }

  // ─── Abstract ──────────────────────────────────────────────────────────

  /**
   * Unique point d'entrée — décide quelle View instancier (ADR-0027).
   *
   * @param event — l'Event déclencheur (null au premier montage / bootstrap)
   * @returns TResolveResult pour monter une View, null pour vider le scope
   */
  abstract resolve(event: unknown | null): TResolveResult | null;

  // ─── Private ───────────────────────────────────────────────────────────

  #performResolve(event: unknown | null): void {
    const result = this.resolve(event);

    if (result === null) {
      // Detach current view if any
      this.#currentView = null;
      this.#state = "idle";
      return;
    }

    // Instancier et monter la View
    const ViewClass = result.view;
    const view = new (ViewClass as unknown as new () => View)();
    view.mount(result.rootElement);
    this.#currentView = view;
    this.#state = "active";
  }

  /**
   * D30 — Parse un sélecteur CSS et crée un élément DOM correspondant.
   * Simplifié en strate 0 : supporte [attr], [attr='value'], .class, #id, tag.
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
