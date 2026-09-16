/**
 * @bonsai/entity — Entity base class
 *
 * Implémentation ADR-0001 (🔵 Tested) :
 *   - mutate(intent, params?, recipe) via Immer produceWithPatches
 *   - changedKeys dérivées depuis les patches (1er segment de path)
 *   - Détection no-op (aucun patch produit → pas de notification)
 *   - Notification catch-all onAnyEntityUpdated (I51) — event enrichi
 *     (patches, inversePatches, payload, metas)
 *   - Ré-entrance FIFO bornée par maxEntityNotificationDepth (I98,
 *     ADR-0028 strate 1a) — cf. RFC entity.md §Ré-entrance
 *   - MutationError si la recipe throw (rollback Immer automatique,
 *     ADR-0002)
 *   - initialState getter (D17)
 *
 * NOTE : les handlers per-key `on<Key>EntityUpdated` ne sont PAS dispatchés
 * ici — c'est la responsabilité de `Feature#registerEntityHandlers` (I96),
 * qui s'abonne à `onAnyEntityUpdated` et route en interne. Entity ne connaît
 * jamais sa Feature (I5, I6).
 */

import { Immer } from "@bonsai/immer";
import type { Draft, Patch } from "immer";
import { EntityReentrancyError, MutationError } from "@bonsai/error";

Immer.enablePatches();

// ─── Types publics ───────────────────────────────────────────────────────────

/**
 * Contrainte structurelle : le state d'une Entity doit être JsonSerializable (I46).
 */
export type TJsonSerializable =
  | string
  | number
  | boolean
  | null
  | TJsonSerializable[]
  | { [key: string]: TJsonSerializable };

/**
 * Extrait la structure d'état (TStructure) d'une classe Entity concrète.
 *
 * Introduit par ADR-0037 — permet de dériver la forme du state
 * depuis une classe Entity, sans la redéclarer manuellement.
 *
 * @example
 *   type TCartState = TEntityState<CartEntity>;  // = { items: [...]; total: number }
 */
export type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;

/**
 * Paramètres optionnels passés à mutate() — payload + metas (traçabilité).
 */
export type TMutationParams = {
  payload?: unknown;
  metas?: Record<string, unknown>;
};

/**
 * Événement émis après une mutation réussie (non no-op).
 * Reçu par les listeners onAnyEntityUpdated, et dispatché par Feature vers
 * les handlers per-key/catch-all (I96).
 */
export type TEntityEvent<
  TStructure extends TJsonSerializable = TJsonSerializable
> = {
  readonly intent: string;
  readonly payload?: unknown;
  readonly metas?: Record<string, unknown>;
  readonly changedKeys: string[];
  readonly patches: Patch[];
  readonly inversePatches: Patch[];
  readonly previousState: TStructure;
  readonly nextState: TStructure;
  readonly timestamp: number;
};

/**
 * Signature du listener catch-all.
 */
export type TEntityUpdateListener<
  TStructure extends TJsonSerializable = TJsonSerializable
> = (event: TEntityEvent<TStructure>) => void;

/**
 * Mutation en attente dans la file de ré-entrance (I98).
 */
type TPendingMutation<TStructure extends TJsonSerializable> = {
  intent: string;
  params: TMutationParams | null;
  recipe: (draft: Draft<TStructure>) => void;
};

// ─── Classe abstraite Entity ─────────────────────────────────────────────────

/**
 * Entity — Conteneur d'état immutable d'une Feature (I6, I22, I46).
 *
 * Classe abstraite : les sous-classes doivent implémenter `get initialState()`.
 *
 * @template TStructure - Le type du state, contraint à TJsonSerializable.
 */
export abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * State courant de l'Entity. Accessible en lecture par les sous-classes
   * et par le code qui détient une référence à l'Entity.
   */
  #state!: TStructure;

  /**
   * Copie du state initial pour pouvoir le retourner via `initialState` (D17).
   */
  #initialState!: TStructure;

  /**
   * Listeners catch-all (I51).
   */
  #listeners: Array<TEntityUpdateListener<TStructure>> = [];

  /**
   * Flag d'initialisation (lazy init pour contourner la restriction abstraite).
   */
  #initialized = false;

  // ─── Ré-entrance FIFO (I98) ────────────────────────────────────────────

  /** `true` pendant qu'un cycle mutate → notify est en cours (pilote externe). */
  #draining = false;

  /** Profondeur du cycle en cours (1 = appel externe, incrémenté par dépilement). */
  #cycleDepth = 0;

  /** File FIFO des mutations déclenchées pendant une notification. */
  #queue: TPendingMutation<TStructure>[] = [];

  constructor() {
    // L'initialisation réelle est faite dans #ensureInitialized()
    // car TS interdit l'accès aux propriétés abstraites dans le constructeur.
    this.#ensureInitialized();
  }

  #ensureInitialized(): void {
    if (!this.#initialized) {
      this.#initialState = this.defineInitialState();
      this.#state = this.#initialState;
      this.#initialized = true;
    }
  }

  // ─── Abstract ────────────────────────────────────────────────────────

  /**
   * Retourne l'état initial de l'Entity.
   * Chaque sous-classe concrète DOIT implémenter ce getter.
   */
  protected abstract defineInitialState(): TStructure;

  // ─── Configuration overridable ─────────────────────────────────────────

  /**
   * Profondeur maximale de ré-entrance (I98, ADR-0028 strate 1a — défaut 3).
   * Overridable par une sous-classe concrète pour un cas d'usage avancé.
   */
  protected get maxEntityNotificationDepth(): number {
    return 3;
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * State courant (lecture seule depuis l'extérieur).
   */
  get state(): TStructure {
    return this.#state;
  }

  /**
   * Retourne l'état initial tel que défini à la construction (D17).
   * Accessible publiquement pour reset ou comparaison.
   */
  get initialState(): TStructure {
    return this.#initialState;
  }

  /**
   * Mutation immutable via Immer produceWithPatches (ADR-0001, I97).
   *
   * Overload 1 : mutate(intent, recipe)
   * Overload 2 : mutate(intent, params, recipe)
   *
   * Détecte les no-ops : si aucun patch n'est produit → pas de notification,
   * retourne `null`.
   *
   * Ré-entrance (I98) : si appelé pendant un cycle de notification en cours,
   * la mutation est mise en file FIFO et exécutée après la fin du cycle
   * courant — retourne `null` immédiatement (l'event n'est pas disponible
   * synchrone). Throw `EntityReentrancyError` si `maxEntityNotificationDepth`
   * serait dépassé.
   *
   * @throws MutationError si la recipe throw (state intact, rollback Immer).
   * @throws EntityReentrancyError si la profondeur max de ré-entrance est dépassée.
   */
  mutate(
    intent: string,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null;
  mutate(
    intent: string,
    params: TMutationParams,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null;
  mutate(
    intent: string,
    paramsOrRecipe: TMutationParams | ((draft: Draft<TStructure>) => void),
    maybeRecipe?: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null {
    // Résolution des overloads
    let params: TMutationParams | null = null;
    let recipe: (draft: Draft<TStructure>) => void;

    if (typeof paramsOrRecipe === "function") {
      recipe = paramsOrRecipe;
    } else {
      params = paramsOrRecipe;
      recipe = maybeRecipe!;
    }

    // Ré-entrance : un cycle est déjà en cours — mise en file (I98)
    if (this.#draining) {
      const wouldBeDepth = this.#cycleDepth + this.#queue.length + 1;
      if (wouldBeDepth > this.maxEntityNotificationDepth) {
        throw new EntityReentrancyError(
          `Ré-entrance Entity au-delà de maxEntityNotificationDepth (${this.maxEntityNotificationDepth}) — intent "${intent}"`,
          "I98",
          "Entity",
          "Vérifier qu'un handler entity ne déclenche pas une boucle de mutations en cascade."
        );
      }
      this.#queue.push({ intent, params, recipe });
      return null;
    }

    // Appel externe — ce mutate() pilote tout le cycle (premier + file)
    this.#draining = true;
    this.#cycleDepth = 1;
    try {
      const firstEvent = this.#runCycle(intent, params, recipe);

      while (this.#queue.length > 0) {
        this.#cycleDepth += 1;
        const next = this.#queue.shift()!;
        this.#runCycle(next.intent, next.params, next.recipe);
      }

      return firstEvent;
    } finally {
      this.#draining = false;
      this.#cycleDepth = 0;
      this.#queue.length = 0;
    }
  }

  /**
   * Enregistre un listener catch-all (I51).
   * Appelé après chaque mutation non no-op. Pas d'isolation d'erreur ici —
   * les exceptions d'un listener se propagent jusqu'à l'appelant externe de
   * `mutate()` (I98 s'appuie sur cette propagation). L'isolation
   * `BroadcastError` est une responsabilité du dispatch Feature (I96).
   */
  onAnyEntityUpdated(listener: TEntityUpdateListener<TStructure>): void {
    this.#listeners.push(listener);
  }

  // ─── Private ─────────────────────────────────────────────────────────

  /**
   * Exécute un cycle complet : recipe → patches → notification.
   * Ne gère pas la file — c'est la responsabilité de l'appelant (`mutate()`).
   */
  #runCycle(
    intent: string,
    params: TMutationParams | null,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null {
    const previousState = this.#state;

    let nextState: TStructure;
    let patches: Patch[];
    let inversePatches: Patch[];
    try {
      [nextState, patches, inversePatches] = Immer.produceWithPatches(
        previousState,
        recipe
      ) as [TStructure, Patch[], Patch[]];
    } catch (error) {
      throw new MutationError(
        `Recipe throw pour l'intent "${intent}" — state conservé (rollback Immer)`,
        "ADR-0002",
        "Entity",
        error instanceof Error ? error.message : String(error)
      );
    }

    if (patches.length === 0) {
      // No-op — pas de notification
      return null;
    }

    // changedKeys dérivées du 1er segment de path des patches (I97)
    const changedKeys = [...new Set(patches.map((p) => String(p.path[0])))];

    this.#state = nextState;

    const event: TEntityEvent<TStructure> = {
      intent,
      payload: params?.payload,
      metas: params?.metas,
      changedKeys,
      patches,
      inversePatches,
      previousState,
      nextState,
      timestamp: Date.now()
    };

    for (const listener of this.#listeners) {
      listener(event);
    }

    return event;
  }
}
