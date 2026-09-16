/**
 * @bonsai/entity - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-09-14T16:47:58.565Z
 */
import { Immer } from '@bonsai/immer';
import { EntityReentrancyError, MutationError } from '@bonsai/error';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

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
var _Entity_instances, _Entity_state, _Entity_initialState, _Entity_listeners, _Entity_initialized, _Entity_draining, _Entity_cycleDepth, _Entity_queue, _Entity_ensureInitialized, _Entity_runCycle;
Immer.enablePatches();
// ─── Classe abstraite Entity ─────────────────────────────────────────────────
/**
 * Entity — Conteneur d'état immutable d'une Feature (I6, I22, I46).
 *
 * Classe abstraite : les sous-classes doivent implémenter `get initialState()`.
 *
 * @template TStructure - Le type du state, contraint à TJsonSerializable.
 */
class Entity {
    constructor() {
        _Entity_instances.add(this);
        /**
         * State courant de l'Entity. Accessible en lecture par les sous-classes
         * et par le code qui détient une référence à l'Entity.
         */
        _Entity_state.set(this, void 0);
        /**
         * Copie du state initial pour pouvoir le retourner via `initialState` (D17).
         */
        _Entity_initialState.set(this, void 0);
        /**
         * Listeners catch-all (I51).
         */
        _Entity_listeners.set(this, []);
        /**
         * Flag d'initialisation (lazy init pour contourner la restriction abstraite).
         */
        _Entity_initialized.set(this, false);
        // ─── Ré-entrance FIFO (I98) ────────────────────────────────────────────
        /** `true` pendant qu'un cycle mutate → notify est en cours (pilote externe). */
        _Entity_draining.set(this, false);
        /** Profondeur du cycle en cours (1 = appel externe, incrémenté par dépilement). */
        _Entity_cycleDepth.set(this, 0);
        /** File FIFO des mutations déclenchées pendant une notification. */
        _Entity_queue.set(this, []);
        // L'initialisation réelle est faite dans #ensureInitialized()
        // car TS interdit l'accès aux propriétés abstraites dans le constructeur.
        __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_ensureInitialized).call(this);
    }
    // ─── Configuration overridable ─────────────────────────────────────────
    /**
     * Profondeur maximale de ré-entrance (I98, ADR-0028 strate 1a — défaut 3).
     * Overridable par une sous-classe concrète pour un cas d'usage avancé.
     */
    get maxEntityNotificationDepth() {
        return 3;
    }
    // ─── Public API ──────────────────────────────────────────────────────
    /**
     * State courant (lecture seule depuis l'extérieur).
     */
    get state() {
        return __classPrivateFieldGet(this, _Entity_state, "f");
    }
    /**
     * Retourne l'état initial tel que défini à la construction (D17).
     * Accessible publiquement pour reset ou comparaison.
     */
    get initialState() {
        return __classPrivateFieldGet(this, _Entity_initialState, "f");
    }
    mutate(intent, paramsOrRecipe, maybeRecipe) {
        // Résolution des overloads
        let params = null;
        let recipe;
        if (typeof paramsOrRecipe === "function") {
            recipe = paramsOrRecipe;
        }
        else {
            params = paramsOrRecipe;
            recipe = maybeRecipe;
        }
        // Ré-entrance : un cycle est déjà en cours — mise en file (I98)
        if (__classPrivateFieldGet(this, _Entity_draining, "f")) {
            const wouldBeDepth = __classPrivateFieldGet(this, _Entity_cycleDepth, "f") + __classPrivateFieldGet(this, _Entity_queue, "f").length + 1;
            if (wouldBeDepth > this.maxEntityNotificationDepth) {
                throw new EntityReentrancyError(`Ré-entrance Entity au-delà de maxEntityNotificationDepth (${this.maxEntityNotificationDepth}) — intent "${intent}"`, "I98", "Entity", "Vérifier qu'un handler entity ne déclenche pas une boucle de mutations en cascade.");
            }
            __classPrivateFieldGet(this, _Entity_queue, "f").push({ intent, params, recipe });
            return null;
        }
        // Appel externe — ce mutate() pilote tout le cycle (premier + file)
        __classPrivateFieldSet(this, _Entity_draining, true, "f");
        __classPrivateFieldSet(this, _Entity_cycleDepth, 1, "f");
        try {
            const firstEvent = __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_runCycle).call(this, intent, params, recipe);
            while (__classPrivateFieldGet(this, _Entity_queue, "f").length > 0) {
                __classPrivateFieldSet(this, _Entity_cycleDepth, __classPrivateFieldGet(this, _Entity_cycleDepth, "f") + 1, "f");
                const next = __classPrivateFieldGet(this, _Entity_queue, "f").shift();
                __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_runCycle).call(this, next.intent, next.params, next.recipe);
            }
            return firstEvent;
        }
        finally {
            __classPrivateFieldSet(this, _Entity_draining, false, "f");
            __classPrivateFieldSet(this, _Entity_cycleDepth, 0, "f");
            __classPrivateFieldGet(this, _Entity_queue, "f").length = 0;
        }
    }
    /**
     * Enregistre un listener catch-all (I51).
     * Appelé après chaque mutation non no-op. Pas d'isolation d'erreur ici —
     * les exceptions d'un listener se propagent jusqu'à l'appelant externe de
     * `mutate()` (I98 s'appuie sur cette propagation). L'isolation
     * `BroadcastError` est une responsabilité du dispatch Feature (I96).
     */
    onAnyEntityUpdated(listener) {
        __classPrivateFieldGet(this, _Entity_listeners, "f").push(listener);
    }
}
_Entity_state = new WeakMap(), _Entity_initialState = new WeakMap(), _Entity_listeners = new WeakMap(), _Entity_initialized = new WeakMap(), _Entity_draining = new WeakMap(), _Entity_cycleDepth = new WeakMap(), _Entity_queue = new WeakMap(), _Entity_instances = new WeakSet(), _Entity_ensureInitialized = function _Entity_ensureInitialized() {
    if (!__classPrivateFieldGet(this, _Entity_initialized, "f")) {
        __classPrivateFieldSet(this, _Entity_initialState, this.defineInitialState(), "f");
        __classPrivateFieldSet(this, _Entity_state, __classPrivateFieldGet(this, _Entity_initialState, "f"), "f");
        __classPrivateFieldSet(this, _Entity_initialized, true, "f");
    }
}, _Entity_runCycle = function _Entity_runCycle(intent, params, recipe) {
    const previousState = __classPrivateFieldGet(this, _Entity_state, "f");
    let nextState;
    let patches;
    let inversePatches;
    try {
        [nextState, patches, inversePatches] = Immer.produceWithPatches(previousState, recipe);
    }
    catch (error) {
        throw new MutationError(`Recipe throw pour l'intent "${intent}" — state conservé (rollback Immer)`, "ADR-0002", "Entity", error instanceof Error ? error.message : String(error));
    }
    if (patches.length === 0) {
        // No-op — pas de notification
        return null;
    }
    // changedKeys dérivées du 1er segment de path des patches (I97)
    const changedKeys = [...new Set(patches.map((p) => String(p.path[0])))];
    __classPrivateFieldSet(this, _Entity_state, nextState, "f");
    const event = {
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
    for (const listener of __classPrivateFieldGet(this, _Entity_listeners, "f")) {
        listener(event);
    }
    return event;
};

export { Entity };
