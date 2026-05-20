/**
 * @bonsai/application — Application class
 *
 * Strate 0 (refondu ADR-0039) — Capacités :
 *   - constructor({ foundation, features }) — déclare le manifest applicatif
 *   - start() — bootstrap en phases réordonnées (ADR-0046) :
 *       Phase 0a: Validation format namespace (assertValidNamespace)
 *       Phase 0b: Instanciation pure des Features (ctor inerte — I94) + sentinel
 *       Phase 0c: Lecture instance.listens/queries — validation références croisées (I70)
 *       Phase 1: Channels (crée les channels de chaque Feature)
 *       Phase 2: Entities (instanciées par les Features)
 *       Phase 3: Features (bootstrap() + onInit() sur les instances Phase 0b)
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
 *   I70  — Toute référence à un namespace externe DOIT être validée contre
 *          le manifest — lue depuis instance.listens/queries (amendé ADR-0046)
 *   I71  — `RESERVED_NAMESPACES` est une constante framework (ADR-0039)
 *   I94  — Le constructeur de Feature est inerte : sentinel Phase 0b détecte
 *          tout side-effect Radio inattendu (ADR-0046)
 *
 * Strate 0 simplifications :
 *   - Pas de stop()
 *   - Pas de SSR (serverState)
 *   - Pas de DevTools
 *   - Pas de BonsaiRegistry ESM
 *
 * @packageDocumentation
 */

import {
  Radio,
  type TChannelDefinition,
  type TChannelToken
} from "@bonsai/event";
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
  Record<string, new (namespace: string) => Feature<any, any, any>>
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
  #featureInstances: Feature<any, any, any>[] = [];

  constructor(options?: TApplicationOptions<M>) {
    this.#foundationClass = options?.foundation ?? null;
    this.#manifest = options?.features ?? ({} as M);
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Bootstrap en phases réordonnées (ADR-0046 — M1).
   * Ne peut être appelé qu'une seule fois.
   *
   * Phases :
   *   Phase 0a — Validation format namespace (assertValidNamespace + I73/I22)
   *   Phase 0b — Instanciation pure (ctor inerte I94) + sentinel Radio
   *   Phase 0c — Lecture instance.listens/queries — validation références (I70)
   *   Phase 1  — Channels  : `Radio.channel(namespace)` pour chaque Feature
   *   Phase 3  — Features  : `bootstrap()` sur les instances de Phase 0b (I56)
   *   Phase 4  — Foundation: `Foundation.attach()` (Composers → Views)
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

    // ── Phase 0a — Validation format + channel (ADR-0039 — I70/I71/I73) ───
    this.#validateManifest();

    this.#started = true;

    const entries = Object.entries(this.#manifest) as Array<
      [string, new (namespace: string) => Feature<any, any>]
    >;

    // ── Phase 0b — Instanciation pure + sentinel I94 ─────────────────────────
    // Le ctor de Feature est inerte (I94) : assertValidNamespace + #namespace.
    // Sentinel : aucun Channel ne doit être créé/supprimé dans Radio pendant le new.
    for (const [namespace, FeatureClass] of entries) {
      const nssBefore = Radio.me().getChannelNames();
      const instance = new FeatureClass(namespace);
      const nssAfter = Radio.me().getChannelNames();
      if (nssBefore.length !== nssAfter.length) {
        throw new Error(
          `[Bonsai Application] Feature "${namespace}" constructor is not inert —` +
            ` Radio was mutated during new ${FeatureClass.name}("${namespace}").` +
            ` Move all Radio/Entity calls out of the constructor (I94 — ADR-0046).`
        );
      }
      this.#featureInstances.push(instance);
    }

    // ── Phase 0c — Validation références croisées via instance (I70 amendé) ───
    // listens + queries lus depuis les instances (abstract get — I93).
    // Exécuté AVANT Phase 1 (création des Channels) — aucun side-effect Radio.
    const known = new Set(entries.map(([ns]) => ns));
    for (let i = 0; i < entries.length; i++) {
      const [ownNs] = entries[i]!;
      const instance = this.#featureInstances[i]!;
      const refs = [...instance.listens, ...instance.queries].map(
        (t) => t.namespace
      );
      for (const ref of refs) {
        if (!known.has(ref)) {
          throw new BonsaiNamespaceError(
            "NAMESPACE_UNKNOWN_REFERENCE",
            `Feature "${ownNs}" declares unknown channel "${ref}". ` +
              `Known namespaces: ${[...known].join(", ")}`
          );
        }
      }
    }

    // Phase 1: Channels — crée le channel de chaque Feature dans Radio
    for (const [namespace] of entries) {
      Radio.me().channel(namespace);
    }

    // Phase 3: Features — bootstrap sur les instances de Phase 0b
    // (auto-discovery handlers I48, entity, onInit I56)
    for (const instance of this.#featureInstances) {
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
   * `StrictManifest<M>` côté appelant. Reste utile pour : cast `as any`,
   * manifest dynamique, code JS pur.
   *
   * Vérifications (Phase 0a) :
   *   - format camelCase de chaque clé (I21 amendé)
   *   - non-réservation de chaque clé (I57, I71)
   *   - chaque classe Feature expose un `static readonly channel` (I73, ADR-0040)
   *   - `channel.namespace` correspond à la clé du manifest (I22, I73)
   *
   * Note : la validation des références croisées `listens`/`queries` est
   * désormais en Phase 0c (lecture depuis les instances — ADR-0046 — I70/I93).
   */
  #validateManifest(): void {
    const namespaces = Object.keys(this.#manifest);

    // I21/I57/I71 — délègue à assertValidNamespace
    for (const ns of namespaces) {
      assertValidNamespace(ns);
    }

    // I73 — chaque Feature DOIT exposer `static readonly channel`
    // I22 — channel.namespace doit correspondre à la clé du manifest
    type TWithChannel = {
      channel?: TChannelToken<TChannelDefinition>;
    };
    for (const [ownNs, FeatureClass] of Object.entries(this.#manifest)) {
      const cls = FeatureClass as unknown as TWithChannel;
      const token = cls.channel;
      if (
        token === undefined ||
        token === null ||
        typeof token !== "object" ||
        typeof (token as { namespace?: unknown }).namespace !== "string"
      ) {
        throw new BonsaiNamespaceError(
          "FEATURE_MISSING_CHANNEL",
          `Feature "${ownNs}" does not declare \`static readonly channel: ` +
            `TChannelToken<TDef, "${ownNs}">\` (I73 — ADR-0040). Add ` +
            `\`static readonly channel = { namespace: "${ownNs}" }\` ` +
            `to the class.`
        );
      }
      if (token.namespace !== ownNs) {
        throw new BonsaiNamespaceError(
          "FEATURE_CHANNEL_NAMESPACE_MISMATCH",
          `Feature registered under "${ownNs}" declares ` +
            `channel.namespace="${token.namespace}" — must match the manifest ` +
            `key (I22, I73). The channel token namespace and the manifest key ` +
            `are the authoritative identity of the Feature.`
        );
      }
    }
  }
}
