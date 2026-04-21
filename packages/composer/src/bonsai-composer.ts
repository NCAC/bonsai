/**
 * @bonsai/composer — Composer abstract base class
 *
 * Strate 0 — Capacités :
 *   - resolve(event | null) → TResolveResult | null (0/1 View)
 *   - Slot DOM immutable fourni par le parent (Foundation ou View)
 *   - Machine à états minimal : idle → active → idle
 *   - Création d'élément DOM si absent (D30)
 *   - Diff de transitions §3.1 (5 cas Same/New/null) sans recréation inutile
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
 * Diff §3.1 (RFC composer.md) :
 *   | resolve() retourne | View montée         | Action                                    |
 *   | ------------------ | ------------------- | ----------------------------------------- |
 *   | SameView+SameRoot  | SameView instance   | **No-op** (instance conservée)            |
 *   | NewView (ou root)  | OldView instance    | **Detach** OldView → **Attach** NewView   |
 *   | NewView            | null                | **Attach** NewView                        |
 *   | null               | OldView instance    | **Detach** OldView                        |
 *   | null               | null                | **No-op**                                 |
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

  /**
   * Dernier résultat retourné par resolve() — sert de référence pour le diff §3.1.
   * Null si la dernière sortie était null (ou avant le premier resolve).
   */
  #currentResult: TResolveResult | null = null;

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

  /**
   * Diff §3.1 (RFC composer.md) — applique la transition entre l'état précédent
   * (`#currentView` + `#currentResult`) et la nouvelle décision retournée par
   * `resolve(event)`. 5 transitions possibles, aucune recréation inutile.
   */
  #performResolve(event: unknown | null): void {
    const next = this.resolve(event);
    const prev = this.#currentResult;

    // Transition 5 : null + null → no-op
    if (next === null && prev === null) {
      return;
    }

    // Transition 4 : null + instance → detach
    if (next === null) {
      this.#detachCurrent();
      return;
    }

    // À ce stade, next !== null

    // Transition 1 : SameView + SameRoot + currentView → no-op
    // (instance conservée, aucun remount)
    if (
      prev !== null &&
      this.#currentView !== null &&
      prev.view === next.view &&
      prev.rootElement === next.rootElement
    ) {
      return;
    }

    // Transition 3 : NewView + null → attach simple
    if (this.#currentView === null) {
      this.#attachNew(next);
      return;
    }

    // Transition 2 : NewView (ou même viewClass mais rootElement différent)
    //                + instance existante → detach + attach
    this.#detachCurrent();
    this.#attachNew(next);
  }

  /**
   * Instancie la View décrite par `result`, la monte sur son rootElement,
   * et met à jour l'état interne. Appelée par `#performResolve()` uniquement.
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
   * Détache la View courante. En strate 0, le Composer n'a pas de subscription
   * propre à libérer (ADR-0025) — il libère simplement la référence. La RFC §4.2
   * prévoit `view.onDetach()` en strates ultérieures.
   *
   * Note : l'élément DOM créé par D30 (slot du Composer) reste en place — c'est
   * le slot, pas le rootElement de la View. Seule la View mountée est libérée.
   */
  #detachCurrent(): void {
    this.#currentView = null;
    this.#currentResult = null;
    this.#state = "idle";
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
