/**
 * @bonsai/entity — Entity base class
 *
 * Strate 0 — Implémentation ADR-0001 :
 *   - mutate(intent, recipe) via Immer.produce
 *   - changedKeys par comparaison shallow avant/après
 *   - Détection no-op (pas de notification si state inchangé)
 *   - Notification catch-all onAnyEntityUpdated (I51)
 *   - initialState getter (D17)
 *
 * NOTE strate 0 : pas de produceWithPatches, pas de per-key handlers,
 * pas de ré-entrance FIFO, pas de toJSON/fromJSON.
 */

import { Immer } from "@bonsai/immer";
import type { Draft } from "immer";

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
 * Paramètres optionnels passés à mutate() — payload + metas (traçabilité).
 */
export type TMutationParams = {
  payload?: unknown;
  metas?: Record<string, unknown>;
};

/**
 * Événement émis après une mutation réussie (non no-op).
 * Reçu par les listeners onAnyEntityUpdated.
 */
export type TEntityEvent<
  TStructure extends TJsonSerializable = TJsonSerializable
> = {
  readonly intent: string;
  readonly params: TMutationParams | null;
  readonly changedKeys: string[];
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
   * Mutation immutable via Immer (ADR-0001).
   *
   * Overload 1 : mutate(intent, recipe)
   * Overload 2 : mutate(intent, params, recipe)
   *
   * Détecte les no-ops par comparaison shallow des clés de 1er niveau.
   * Si aucune clé n'a changé → pas de notification.
   */
  mutate(intent: string, recipe: (draft: Draft<TStructure>) => void): void;
  mutate(
    intent: string,
    params: TMutationParams,
    recipe: (draft: Draft<TStructure>) => void
  ): void;
  mutate(
    intent: string,
    paramsOrRecipe: TMutationParams | ((draft: Draft<TStructure>) => void),
    maybeRecipe?: (draft: Draft<TStructure>) => void
  ): void {
    // Résolution des overloads
    let params: TMutationParams | null = null;
    let recipe: (draft: Draft<TStructure>) => void;

    if (typeof paramsOrRecipe === "function") {
      recipe = paramsOrRecipe;
    } else {
      params = paramsOrRecipe;
      recipe = maybeRecipe!;
    }

    const previousState = this.#state;

    // Immer produce — mutation immutable
    const nextState = Immer.produce(previousState, recipe);

    // Détection no-op : comparaison shallow des clés de 1er niveau
    const changedKeys = this.#computeChangedKeys(previousState, nextState);

    if (changedKeys.length === 0) {
      // No-op — pas de notification
      return;
    }

    // Mise à jour du state
    this.#state = nextState;

    // Notification catch-all (I51)
    const event: TEntityEvent<TStructure> = {
      intent,
      params,
      changedKeys,
      previousState,
      nextState,
      timestamp: Date.now()
    };

    for (const listener of this.#listeners) {
      listener(event);
    }
  }

  /**
   * Enregistre un listener catch-all (I51).
   * Appelé après chaque mutation non no-op.
   */
  onAnyEntityUpdated(listener: TEntityUpdateListener<TStructure>): void {
    this.#listeners.push(listener);
  }

  // ─── Private ─────────────────────────────────────────────────────────

  /**
   * Comparaison shallow des clés de premier niveau entre deux states.
   * Retourne la liste des clés dont la référence a changé.
   */
  #computeChangedKeys(prev: TStructure, next: TStructure): string[] {
    if (prev === next) return [];

    // TStructure est un objet (garanti par l'usage)
    const prevObj = prev as Record<string, unknown>;
    const nextObj = next as Record<string, unknown>;

    const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
    const changed: string[] = [];

    for (const key of keys) {
      if (prevObj[key] !== nextObj[key]) {
        changed.push(key);
      }
    }

    return changed;
  }
}
