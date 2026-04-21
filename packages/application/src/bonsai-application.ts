/**
 * @bonsai/application — Application class
 *
 * Strate 0 — Capacités :
 *   - register(FeatureClass) — enregistre une Feature (namespace, Channel)
 *   - start() — bootstrap en 4 phases simplifiées :
 *       Phase 1: Channels (crée les channels de chaque Feature)
 *       Phase 2: Entities (instancie les Entities)
 *       Phase 3: Features (instancie, câble handlers, appelle onInit)
 *       Phase 4: Views (Foundation → Composers → Views, attach)
 *
 * Invariants :
 *   I23  — Application est dormante au runtime (pas de handle/emit/listen/request)
 *   I24  — Application garantit l'unicité des namespaces au bootstrap
 *   I56  — onInit() de chaque Feature appelé avant la création de la Foundation
 *
 * Strate 0 simplifications :
 *   - Pas de stop()
 *   - Pas de SSR (serverState)
 *   - Pas de DevTools
 *   - Pas de BonsaiRegistry ESM
 *   - Pas de TBootstrapOptions (sauf foundation)
 *
 * @packageDocumentation
 */

import { Radio } from "@bonsai/event";
import { Feature } from "@bonsai/feature";
import { Foundation } from "@bonsai/foundation";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Options du constructeur Application — strate 0 minimal.
 */
export type TApplicationOptions = {
  /** Classe Foundation concrète à utiliser (optionnel — défaut = erreur si absent à start()) */
  readonly foundation?: typeof Foundation;
};

/**
 * Type structurel laxe accepté par `Application.register()`.
 *
 * Volontairement plus large que `TFeatureClass<TEntity>` (qui est invariant en
 * TEntity à cause de `protected get Entity(): new () => TEntity` — position
 * output). Application n'a besoin que de `namespace` (clé I24) et du
 * constructeur — la forme de l'Entity ne la concerne pas.
 *
 * Ce type structurel évite à l'utilisateur d'avoir à caster ses Features
 * concrètes (`CartFeature extends Feature<CartEntity>`) lors de l'appel à
 * `register()`.
 */
export type TRegisterableFeature = {
  new (): Feature<any>;
  readonly namespace: string;
  readonly channels: readonly string[];
};

// ─── Application class ───────────────────────────────────────────────────────

export class Application {
  // Stockage interne : on perd le typage paramétré (TEntity) car Application
  // ne fait que du dispatch namespace → instance. Le type structurel large
  // est suffisant : on n'utilise que `namespace` et le constructeur.
  #registeredFeatures: TRegisterableFeature[] = [];
  #namespaces: Set<string> = new Set();
  #started = false;
  #foundationClass: typeof Foundation | null;
  #foundationInstance: Foundation | null = null;
  #featureInstances: Feature<any>[] = [];

  constructor(options?: TApplicationOptions) {
    this.#foundationClass = options?.foundation ?? null;
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Enregistre une Feature. Vérifie l'unicité du namespace (I24).
   * Ne peut plus être appelé après start().
   *
   * Le paramètre est typé `TRegisterableFeature` (type structurel laxe) pour
   * accepter n'importe quelle sous-classe `Feature<TEntity>` concrète sans
   * variance bloquante. Application ne consomme que `namespace` et le
   * constructeur.
   */
  register(FeatureClass: TRegisterableFeature): void {
    if (this.#started) {
      throw new Error(
        "[Bonsai Application] Cannot register after start() — already started"
      );
    }

    const ns = FeatureClass.namespace;

    if (!ns || typeof ns !== "string") {
      throw new Error(
        "[Bonsai Application] Feature must declare a static namespace"
      );
    }

    if (ns === "local") {
      throw new Error(`[Bonsai Application] Namespace "local" is reserved`);
    }

    if (this.#namespaces.has(ns)) {
      throw new Error(
        `[Bonsai Application] Namespace collision — "${ns}" is already registered`
      );
    }

    this.#namespaces.add(ns);
    this.#registeredFeatures.push(FeatureClass);
  }

  /**
   * Bootstrap en 4 phases simplifiées (strate 0).
   * Ne peut être appelé qu'une seule fois.
   *
   * Phases (alignement ADR-0010, version simplifiée pour la strate 0) :
   *   Phase 1 — Channels  : `Radio.channel(namespace)` pour chaque Feature
   *   Phase 2 — Entities  : (implicite : créées par Feature en strate 0)
   *   Phase 3 — Features  : instanciation + `onInit()` (I56)
   *   Phase 4 — Views     : `Foundation.attach()` qui orchestre Composers → Views
   *
   * @throws si appelée deux fois (strate 0 : pas de re-bootstrap)
   * @throws si aucune Foundation n'a été fournie au constructeur (I33 :
   *   une application sans Foundation ne peut rien afficher)
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
    this.#started = true;

    // Phase 1: Channels — crée le channel de chaque Feature dans Radio
    for (const FeatureClass of this.#registeredFeatures) {
      Radio.me().channel(FeatureClass.namespace);
    }

    // Phase 2: Entities — instanciation (gérée par Feature en strate 0)
    // (rien à faire explicitement — Entity est créée par Feature dans son constructeur)

    // Phase 3: Features — instancie, câble handlers, appelle onInit (I56)
    for (const FeatureClass of this.#registeredFeatures) {
      const instance = new FeatureClass();
      this.#featureInstances.push(instance);

      // Appeler onInit si la méthode existe
      if (typeof instance.onInit === "function") {
        instance.onInit();
      }
    }

    // Phase 4: Views — Foundation → Composers → Views
    const FoundationClass = this
      .#foundationClass as unknown as new () => Foundation;
    this.#foundationInstance = new FoundationClass();
    this.#foundationInstance.attach();
  }

  /**
   * La Foundation instanciée (après start).
   */
  get foundation(): Foundation | null {
    return this.#foundationInstance;
  }

  /**
   * Indique si l'application a démarré.
   */
  get started(): boolean {
    return this.#started;
  }
}
