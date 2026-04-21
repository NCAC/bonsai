/**
 * @bonsai/foundation — Foundation abstract base class
 *
 * Strate 0 — Capacités :
 *   - body  = document.body            (toujours en strate 0, I33)
 *   - html  = document.documentElement (droit d'altération N1, D27)
 *   - Déclare les Composers racines via abstract get composers()
 *   - Crée et attache les Composers au bootstrap
 *   - Hooks onAttach() / onDetach()
 *
 * Invariants :
 *   I33  — Foundation unique par application — cible <body>
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I34  — rootElement d'une View = enfant de <body>, jamais <body>
 *   D27  — Foundation peut altérer html/body en N1 uniquement
 *
 * Strate 0 simplifications (ADR-0028) :
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
 *
 * NB : la structure exacte (Record vs Entry[] vs Map) sera tranchée
 * par ADR-0038. La RFC composer/foundation actuelle documente Record ;
 * la strate 0 utilise Entry[] en attendant l'ADR.
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
  #body: HTMLElement;

  /** Référence à <html> — droit d'altération N1 (D27, RFC foundation.md §2) */
  #html: HTMLElement;

  /** Les instances de Composers racines créées au bootstrap */
  #composerInstances: Composer[] = [];

  /** Flag : Foundation déjà attachée */
  #attached = false;

  constructor() {
    this.#body = document.body;
    this.#html = document.documentElement;
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Référence à <body> — alignement RFC foundation.md §1.
   * Le développeur peut altérer en N1 (classes, attributs) — D27.
   */
  protected get body(): HTMLElement {
    return this.#body;
  }

  /**
   * Référence à <html> — alignement RFC foundation.md §1.
   * Le développeur peut altérer en N1 (classes, attributs) — D27.
   */
  protected get html(): HTMLElement {
    return this.#html;
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
      instance.attach(this.#body);
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
   * Surcharger pour brancher des écouteurs DOM globaux (resize, scroll, etc.).
   * Default no-op.
   */
  onAttach(): void {
    // Default no-op
  }

  /**
   * Hook appelé au shutdown — symétrique de onAttach().
   * Surcharger pour débrancher les écouteurs DOM globaux installés dans onAttach().
   * Default no-op.
   *
   * NB : non invoqué automatiquement en strate 0 (pas de shutdown formalisé) ;
   * point d'extension pour la strate 1.
   */
  onDetach(): void {
    // Default no-op
  }
}
