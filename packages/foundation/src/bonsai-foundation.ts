/**
 * @bonsai/foundation — Foundation abstract base class
 *
 * Strate 0 — Capacités :
 *   - rootElement = document.body (toujours en strate 0)
 *   - Déclare les Composers racines via abstract get composers()
 *   - Crée et attache les Composers au bootstrap
 *   - onAttach() lifecycle hook
 *
 * Invariants :
 *   I33  — Foundation unique par application — cible <body>
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I34  — rootElement d'une View = enfant de <body>, jamais <body>
 *
 * Strate 0 simplifications :
 *   - Pas de TUIMap (ADR-0018 Suspended)
 *   - Pas d'event delegation globale (strate 1)
 *   - Pas de params() Channel capabilities (strate 1)
 *
 * @packageDocumentation
 */

import { Composer, type TComposerOptions } from "@bonsai/composer";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Entrée de déclaration d'un Composer racine dans Foundation.
 */
export type TFoundationComposerEntry = {
  /** La classe Composer concrète */
  readonly composer: typeof Composer;
  /** Sélecteur CSS dans <body> pour le slot du Composer */
  readonly rootElement: string;
};

// ─── Foundation abstract class ───────────────────────────────────────────────

export abstract class Foundation {
  /** Référence à <body> — toujours document.body en strate 0 (I33) */
  #el: HTMLElement;

  /** Les instances de Composers racines créées au bootstrap */
  #composerInstances: Composer[] = [];

  /** Flag : Foundation déjà attachée */
  #attached = false;

  constructor() {
    this.#el = document.body;
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Référence à l'élément racine (<body>).
   */
  get el(): HTMLElement {
    return this.#el;
  }

  /**
   * Les Composer instances créées.
   */
  get composerInstances(): readonly Composer[] {
    return this.#composerInstances;
  }

  /**
   * Attache la Foundation : résout et crée les Composers racines.
   * Appelé une seule fois par Application.start().
   */
  attach(): void {
    if (this.#attached) {
      throw new Error(
        "[Bonsai Foundation] Foundation already attached — I33 singleton violated"
      );
    }
    this.#attached = true;

    const entries = this.composers;

    for (const entry of entries) {
      const ComposerClass = entry.composer as unknown as new (
        opts: TComposerOptions
      ) => Composer;
      const instance = new ComposerClass({ rootElement: entry.rootElement });
      instance.attach(this.#el);
      this.#composerInstances.push(instance);
    }

    this.onAttach();
  }

  // ─── Abstract ──────────────────────────────────────────────────────────

  /**
   * Déclare les Composers racines — clés = sélecteurs CSS dans <body>.
   * Évalué au bootstrap par attach().
   */
  abstract get composers(): readonly TFoundationComposerEntry[];

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Hook appelé après résolution des Composers racines.
   */
  onAttach(): void {
    // Default no-op
  }
}
