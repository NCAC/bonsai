/**
 * @bonsai/entity - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-05-07T09:44:38.950Z
 */
import { Immer } from '@bonsai/immer';

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
var _Entity_instances, _Entity_state, _Entity_initialState, _Entity_listeners, _Entity_initialized, _Entity_ensureInitialized, _Entity_computeChangedKeys;
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
        // L'initialisation réelle est faite dans #ensureInitialized()
        // car TS interdit l'accès aux propriétés abstraites dans le constructeur.
        __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_ensureInitialized).call(this);
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
        const previousState = __classPrivateFieldGet(this, _Entity_state, "f");
        // Immer produce — mutation immutable
        const nextState = Immer.produce(previousState, recipe);
        // Détection no-op : comparaison shallow des clés de 1er niveau
        const changedKeys = __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_computeChangedKeys).call(this, previousState, nextState);
        if (changedKeys.length === 0) {
            // No-op — pas de notification
            return;
        }
        // Mise à jour du state
        __classPrivateFieldSet(this, _Entity_state, nextState, "f");
        // Notification catch-all (I51)
        const event = {
            intent,
            params,
            changedKeys,
            previousState,
            nextState,
            timestamp: Date.now()
        };
        for (const listener of __classPrivateFieldGet(this, _Entity_listeners, "f")) {
            listener(event);
        }
    }
    /**
     * Enregistre un listener catch-all (I51).
     * Appelé après chaque mutation non no-op.
     */
    onAnyEntityUpdated(listener) {
        __classPrivateFieldGet(this, _Entity_listeners, "f").push(listener);
    }
}
_Entity_state = new WeakMap(), _Entity_initialState = new WeakMap(), _Entity_listeners = new WeakMap(), _Entity_initialized = new WeakMap(), _Entity_instances = new WeakSet(), _Entity_ensureInitialized = function _Entity_ensureInitialized() {
    if (!__classPrivateFieldGet(this, _Entity_initialized, "f")) {
        __classPrivateFieldSet(this, _Entity_initialState, this.defineInitialState(), "f");
        __classPrivateFieldSet(this, _Entity_state, __classPrivateFieldGet(this, _Entity_initialState, "f"), "f");
        __classPrivateFieldSet(this, _Entity_initialized, true, "f");
    }
}, _Entity_computeChangedKeys = function _Entity_computeChangedKeys(prev, next) {
    if (prev === next)
        return [];
    // TStructure est un objet (garanti par l'usage)
    const prevObj = prev;
    const nextObj = next;
    const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
    const changed = [];
    for (const key of keys) {
        if (prevObj[key] !== nextObj[key]) {
            changed.push(key);
        }
    }
    return changed;
};

export { Entity };
