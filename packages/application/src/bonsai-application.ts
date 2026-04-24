/**
 * @bonsai/application — Application class
 *
 * Strate 0 (refondu ADR-0039) — Capacités :
 *   - constructor({ foundation, features }) — déclare le manifest applicatif
 *   - start() — bootstrap en 4 phases simplifiées :
 *       Phase 0: Validation runtime du manifest (filet ADR-0039)
 *       Phase 1: Channels (crée les channels de chaque Feature)
 *       Phase 2: Entities (instanciées par les Features)
 *       Phase 3: Features (new FeatureClass(ns), bootstrap, onInit)
 *       Phase 4: Foundation (composers → views, attach)
 *
 * Invariants :
 *   I23  — Application est dormante au runtime (pas de handle/emit/listen/request)
 *   I24  — Le manifest garantit l'unicité au compile-time ; Application valide
 *          format + réservés + cohérence des `channels` au bootstrap (amendé ADR-0039)
 *   I33  — Application sans Foundation ne peut rien afficher
 *   I56  — onInit() de chaque Feature appelé avant la création de la Foundation
 *   I68  — Le namespace est porté par le manifest, pas par un static (ADR-0039)
 *   I69  — Le manifest est l'unique source de vérité de l'identité (ADR-0039)
 *   I70  — Toute référence à un namespace externe DOIT être validée
 *          contre le manifest (ADR-0039)
 *   I71  — `RESERVED_NAMESPACES` est une constante framework (ADR-0039)
 *
 * Strate 0 simplifications :
 *   - Pas de stop()
 *   - Pas de SSR (serverState)
 *   - Pas de DevTools
 *   - Pas de BonsaiRegistry ESM
 *
 * @packageDocumentation
 */

import { Radio } from "@bonsai/event";
import {
  Feature,
  BonsaiNamespaceError,
  assertValidNamespace
} from "@bonsai/feature";
import { Foundation } from "@bonsai/foundation";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Manifest de Features applicatives — type structurel laxe accepté au runtime
 * par `Application`. La cohérence stricte (camelCase, mots réservés, accord
 * `TSelfNS ↔ clé`) est portée côté appelant par `StrictManifest<M>` au
 * `satisfies` (cf. ADR-0039 §Décision et `@bonsai/feature/types`).
 *
 * Application n'a besoin ici que de :
 *   - clés `string` (les namespaces)
 *   - valeurs = constructeurs `(namespace) => Feature`
 *
 * Le typage strict côté manifest applicatif vit dans `@bonsai/feature`.
 */
export type TFeaturesManifest = Readonly<
  Record<string, new (namespace: string) => Feature<any, any>>
>;

/**
 * Options du constructeur Application — strate 0 minimal.
 *
 * - `foundation` : classe Foundation concrète (obligatoire pour `start()` —
 *   I33 lève sinon).
 * - `features` : manifest applicatif (clé = namespace, valeur = classe Feature).
 *   La validation compile-time se fait côté appelant via
 *   `satisfies StrictManifest<AppManifest>` ; Application n'effectue qu'un
 *   filet runtime au `start()`.
 */
export type TApplicationOptions<
  M extends TFeaturesManifest = TFeaturesManifest
> = {
  readonly foundation?: typeof Foundation;
  readonly features?: M;
};

// ─── Application class ───────────────────────────────────────────────────────

export class Application<M extends TFeaturesManifest = TFeaturesManifest> {
  readonly #manifest: M;
  #started = false;
  #foundationClass: typeof Foundation | null;
  #foundationInstance: Foundation | null = null;
  #featureInstances: Feature<any, any>[] = [];

  constructor(options?: TApplicationOptions<M>) {
    this.#foundationClass = options?.foundation ?? null;
    this.#manifest = options?.features ?? ({} as M);
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Bootstrap en 4 phases simplifiées (strate 0).
   * Ne peut être appelé qu'une seule fois.
   *
   * Phases :
   *   Phase 0 — Validation runtime du manifest (filet ADR-0039) :
   *             format camelCase, mots réservés, références `static channels`.
   *   Phase 1 — Channels  : `Radio.channel(namespace)` pour chaque Feature
   *   Phase 2 — Entities  : (créées implicitement par Feature.bootstrap)
   *   Phase 3 — Features  : `new FeatureClass(namespace)` + `bootstrap()` (I56)
   *   Phase 4 — Foundation: `Foundation.attach()` qui orchestre Composers → Views
   *
   * @throws si appelée deux fois (strate 0 : pas de re-bootstrap)
   * @throws `BonsaiNamespaceError` si le manifest viole les invariants (filet
   *   runtime — le compile-time est censé l'avoir déjà attrapé via
   *   `StrictManifest<M>`).
   * @throws si aucune Foundation n'a été fournie au constructeur (I33).
   */
  start(): void {
    if (this.#started) {
      throw new Error("[Bonsai Application] Cannot start() — already started");
    }
    if (this.#foundationClass === null) {
      throw new Error(
        "[Bonsai Application] Cannot start() — no Foundation provided. " +
          "Pass { foundation: MyFoundation } to the Application constructor (I33)."
      );
    }

    // ── Phase 0 — Validation runtime du manifest (ADR-0039 — I70/I71) ───
    this.#validateManifest();

    this.#started = true;

    const entries = Object.entries(this.#manifest) as Array<
      [string, new (namespace: string) => Feature<any, any>]
    >;

    // Phase 1: Channels — crée le channel de chaque Feature dans Radio
    for (const [namespace] of entries) {
      Radio.me().channel(namespace);
    }

    // Phase 2: Entities — créées par chaque Feature dans bootstrap()

    // Phase 3: Features — instancie avec le namespace du manifest, bootstrap
    // (auto-discovery handlers I48), appelle onInit (I56)
    for (const [namespace, FeatureClass] of entries) {
      const instance = new FeatureClass(namespace);
      this.#featureInstances.push(instance);
      instance.bootstrap();
    }

    // Phase 4: Views — Foundation → Composers → Views
    const FoundationClass = this
      .#foundationClass as unknown as new () => Foundation;
    this.#foundationInstance = new FoundationClass();
    this.#foundationInstance.attach();
  }

  /** La Foundation instanciée (après start). */
  get foundation(): Foundation | null {
    return this.#foundationInstance;
  }

  /** Indique si l'application a démarré. */
  get started(): boolean {
    return this.#started;
  }

  // ─── Private — Filet runtime (ADR-0039 §Décision) ──────────────────────

  /**
   * Valide le manifest avant tout side-effect. Filet de sécurité — la
   * majorité de ces violations sont déjà attrapées au compile-time par
   * `StrictManifest<M>` côté appelant (cf. `@bonsai/feature/types`). Reste
   * utile pour : cast `as any`, manifest dynamique, code JS pur.
   *
   * Vérifications :
   *   - format camelCase de chaque clé (I21 amendé)
   *   - non-réservation de chaque clé (I57, I71)
   *   - `static channels` de chaque classe ne référence que des clés du manifest
   *     (I70)
   */
  #validateManifest(): void {
    const namespaces = Object.keys(this.#manifest);

    // I21/I57/I71 — délègue à assertValidNamespace
    for (const ns of namespaces) {
      assertValidNamespace(ns);
    }

    // I70 — cohérence des références croisées via `static channels`
    const known = new Set(namespaces);
    for (const [ownNs, FeatureClass] of Object.entries(this.#manifest)) {
      const declared =
        (FeatureClass as unknown as { channels?: readonly string[] })
          .channels ?? [];
      for (const ref of declared) {
        if (!known.has(ref)) {
          throw new BonsaiNamespaceError(
            "NAMESPACE_UNKNOWN_REFERENCE",
            `Feature "${ownNs}" declares unknown channel "${ref}". ` +
              `Known namespaces: ${namespaces.join(", ") || "(none)"}`
          );
        }
      }
    }
  }
}
