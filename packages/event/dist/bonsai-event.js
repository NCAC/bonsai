/**
 * @bonsai/event - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-04-29T13:26:10.202Z
 */
import { RXJS } from '@bonsai/rxjs';
import { DuplicateHandlerError, NoHandlerError, ListenerError } from '@bonsai/error';

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
 * Channel tri-lane — infrastructure de communication interne Bonsai.
 *
 * Un Channel est un contrat de communication à 3 lanes :
 * - **Command Lane** : `handle()` / `trigger()` — 1:1 (un seul handler)
 * - **Event Lane** : `listen()` / `unlisten()` / `emit()` — 1:N (broadcast)
 * - **Request Lane** : `reply()` / `unreply()` / `request()` — 1:1 synchrone, T | null
 *
 * Le Channel émet automatiquement un événement `any` après chaque `emit()`.
 *
 * `Channel` est générique sur `TDef extends TChannelDefinition` (ADR-0040).
 * La valeur par défaut `TChannelDefinition` (toutes lanes `Record<string, unknown>`)
 * assure une rétrocompatibilité totale avec le code non-paramétré.
 *
 * @see RFC 2-architecture/communication.md
 * @see ADR-0003 — Sémantiques runtime Channel
 * @see ADR-0023 — request() synchrone
 * @see ADR-0040 — API TypeScript-First : TChannelDefinition, TChannelToken
 */
var _Channel_commandHandlers, _Channel_eventSubjects, _Channel_eventSubscriptions, _Channel_requestRepliers, _Channel_anySubject, _Channel_anySubscriptions;
// ── Channel ──────────────────────────────────────────────────────────────────
class Channel {
    constructor(name) {
        this.name = name;
        // ── Lane 1 — Commands (1:1) ──────────────────────────────────────────────
        _Channel_commandHandlers.set(this, new Map());
        // ── Lane 2 — Events (1:N via RxJS Subject) ───────────────────────────────
        _Channel_eventSubjects.set(this, new Map());
        _Channel_eventSubscriptions.set(this, new Map());
        // ── Lane 3 — Requests (1:1 sync) ─────────────────────────────────────────
        _Channel_requestRepliers.set(this, new Map());
        // ── Événement technique `any` ─────────────────────────────────────────────
        _Channel_anySubject.set(this, new RXJS.Subject());
        _Channel_anySubscriptions.set(this, new Map());
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Lane 1 — Commands
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Enregistre le handler unique pour un Command (I10 — un seul handler).
     * @throws DuplicateHandlerError si un handler est déjà enregistré.
     */
    handle(commandName, handler) {
        if (__classPrivateFieldGet(this, _Channel_commandHandlers, "f").has(commandName)) {
            throw new DuplicateHandlerError(`Command "${this.name}:${commandName}" already has a handler`, "I10", this.name, "Each Command must have exactly one handler (the owning Feature).");
        }
        __classPrivateFieldGet(this, _Channel_commandHandlers, "f").set(commandName, handler);
    }
    /**
     * Émet un Command vers son handler unique.
     * @throws NoHandlerError si aucun handler n'est enregistré.
     */
    trigger(commandName, payload) {
        const handler = __classPrivateFieldGet(this, _Channel_commandHandlers, "f").get(commandName);
        if (!handler) {
            throw new NoHandlerError(`No handler for command "${this.name}:${commandName}"`, "I10", this.name, `Register a handler with channel.handle("${commandName}", handler)`);
        }
        handler(payload);
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Lane 2 — Events
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Enregistre un listener pour un Event (I11 — N listeners autorisés).
     */
    listen(eventName, listener) {
        if (!__classPrivateFieldGet(this, _Channel_eventSubjects, "f").has(eventName)) {
            __classPrivateFieldGet(this, _Channel_eventSubjects, "f").set(eventName, new RXJS.Subject());
            __classPrivateFieldGet(this, _Channel_eventSubscriptions, "f").set(eventName, new Map());
        }
        const subject = __classPrivateFieldGet(this, _Channel_eventSubjects, "f").get(eventName);
        const subscription = subject.subscribe({
            next: (payload) => {
                try {
                    listener(payload);
                }
                catch (error) {
                    console.error(new ListenerError(`Listener error on "${this.name}:${eventName}"`, "ADR-0002", this.name), error);
                }
            }
        });
        __classPrivateFieldGet(this, _Channel_eventSubscriptions, "f").get(eventName).set(listener, subscription);
    }
    /**
     * Supprime un listener spécifique pour un Event.
     */
    unlisten(eventName, listener) {
        const subsMap = __classPrivateFieldGet(this, _Channel_eventSubscriptions, "f").get(eventName);
        if (subsMap) {
            const subscription = subsMap.get(listener);
            if (subscription) {
                subscription.unsubscribe();
                subsMap.delete(listener);
            }
        }
    }
    /**
     * Émet un Event vers tous les listeners (1:N).
     * Silencieux si aucun listener. Émet `any` automatiquement après.
     */
    emit(eventName, payload) {
        const subject = __classPrivateFieldGet(this, _Channel_eventSubjects, "f").get(eventName);
        if (subject) {
            subject.next(payload);
        }
        __classPrivateFieldGet(this, _Channel_anySubject, "f").next({
            event: eventName,
            changes: payload && typeof payload === "object"
                ? payload
                : {}
        });
    }
    /**
     * Enregistre un listener pour l'événement technique `any`.
     */
    listenAny(listener) {
        const subscription = __classPrivateFieldGet(this, _Channel_anySubject, "f").subscribe({
            next: (payload) => {
                try {
                    listener(payload);
                }
                catch (error) {
                    console.error(new ListenerError(`Listener error on "${this.name}:any"`, "ADR-0002", this.name), error);
                }
            }
        });
        __classPrivateFieldGet(this, _Channel_anySubscriptions, "f").set(listener, subscription);
    }
    /**
     * Supprime un listener `any`.
     */
    unlistenAny(listener) {
        const subscription = __classPrivateFieldGet(this, _Channel_anySubscriptions, "f").get(listener);
        if (subscription) {
            subscription.unsubscribe();
            __classPrivateFieldGet(this, _Channel_anySubscriptions, "f").delete(listener);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Lane 3 — Requests (synchrone, T | null)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Enregistre le replier unique pour un type de Request.
     * @throws DuplicateHandlerError si un replier est déjà enregistré.
     */
    reply(requestName, replier) {
        if (__classPrivateFieldGet(this, _Channel_requestRepliers, "f").has(requestName)) {
            throw new DuplicateHandlerError(`Request "${this.name}:${requestName}" already has a replier`, "I10", this.name, "Each Request must have exactly one replier.");
        }
        __classPrivateFieldGet(this, _Channel_requestRepliers, "f").set(requestName, replier);
    }
    /**
     * Supprime un replier.
     */
    unreply(requestName) {
        __classPrivateFieldGet(this, _Channel_requestRepliers, "f").delete(requestName);
    }
    /**
     * Effectue une Request synchrone. Retourne `TDef['requests'][K]['result'] | null`.
     * - Pas de replier → null (ADR-0023, D44)
     * - Replier qui throw → null, erreur loguée (I55)
     */
    request(requestName, params) {
        const replier = __classPrivateFieldGet(this, _Channel_requestRepliers, "f").get(requestName);
        if (!replier) {
            return null;
        }
        try {
            return replier(params);
        }
        catch (error) {
            console.error(`[Bonsai] Request replier error on "${this.name}:${requestName}"`, error);
            return null;
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Lifecycle
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Supprime tous les handlers, listeners et repliers.
     * Complète les Subjects RxJS.
     */
    clear() {
        __classPrivateFieldGet(this, _Channel_commandHandlers, "f").clear();
        for (const [, subsMap] of __classPrivateFieldGet(this, _Channel_eventSubscriptions, "f")) {
            for (const [, sub] of subsMap) {
                sub.unsubscribe();
            }
        }
        __classPrivateFieldGet(this, _Channel_eventSubscriptions, "f").clear();
        for (const [, subject] of __classPrivateFieldGet(this, _Channel_eventSubjects, "f")) {
            subject.complete();
        }
        __classPrivateFieldGet(this, _Channel_eventSubjects, "f").clear();
        for (const [, sub] of __classPrivateFieldGet(this, _Channel_anySubscriptions, "f")) {
            sub.unsubscribe();
        }
        __classPrivateFieldGet(this, _Channel_anySubscriptions, "f").clear();
        __classPrivateFieldGet(this, _Channel_anySubject, "f").complete();
        __classPrivateFieldGet(this, _Channel_requestRepliers, "f").clear();
    }
}
_Channel_commandHandlers = new WeakMap(), _Channel_eventSubjects = new WeakMap(), _Channel_eventSubscriptions = new WeakMap(), _Channel_requestRepliers = new WeakMap(), _Channel_anySubject = new WeakMap(), _Channel_anySubscriptions = new WeakMap();

/**
 * Radio — Singleton registre des Channels.
 *
 * Radio est le point central de câblage des communications Bonsai.
 * Il gère les instances Channel par namespace (get-or-create).
 *
 * I15 — Radio n'est jamais exposé au développeur d'application.
 *
 * @see RFC 2-architecture/communication.md §8
 */
var _a, _Radio_instance, _Radio_constructing, _Radio_channels;
class Radio {
    /** Constructeur privé — force le pattern singleton via `me()`. */
    constructor() {
        _Radio_channels.set(this, new Map());
        if (!__classPrivateFieldGet(_a, _a, "f", _Radio_constructing)) {
            throw new Error("Radio is a singleton — use Radio.me() to get the instance.");
        }
    }
    /** Retourne l'instance unique du Radio. */
    static me() {
        if (!__classPrivateFieldGet(_a, _a, "f", _Radio_instance)) {
            __classPrivateFieldSet(_a, _a, true, "f", _Radio_constructing);
            __classPrivateFieldSet(_a, _a, new _a(), "f", _Radio_instance);
            __classPrivateFieldSet(_a, _a, false, "f", _Radio_constructing);
        }
        return __classPrivateFieldGet(_a, _a, "f", _Radio_instance);
    }
    /**
     * Obtient ou crée un Channel par namespace (API interne).
     * Retourne `Channel<TChannelDefinition>` — toutes lanes `Record<string, unknown>`.
     * Pour un accès typé depuis l'extérieur, utiliser `channelFor(token)`.
     */
    channel(name) {
        if (!__classPrivateFieldGet(this, _Radio_channels, "f").has(name)) {
            __classPrivateFieldGet(this, _Radio_channels, "f").set(name, new Channel(name));
        }
        return __classPrivateFieldGet(this, _Radio_channels, "f").get(name);
    }
    /**
     * Obtient ou crée un Channel typé via son token (ADR-0040, I77, I79).
     *
     * Le cast `as Channel<TDef>` est sûr par I22 : un namespace ne peut être
     * associé qu'à une seule Feature et donc à un seul `TDef`.
     */
    channelFor(token) {
        return this.channel(token.namespace);
    }
    /** Vérifie si un Channel existe pour ce namespace. */
    hasChannel(name) {
        return __classPrivateFieldGet(this, _Radio_channels, "f").has(name);
    }
    /** Liste tous les namespaces enregistrés. */
    getChannelNames() {
        return Array.from(__classPrivateFieldGet(this, _Radio_channels, "f").keys());
    }
    /**
     * Supprime un Channel. Appelle `clear()` sur le Channel avant suppression.
     * @returns `true` si le Channel existait, `false` sinon
     */
    removeChannel(name) {
        const channel = __classPrivateFieldGet(this, _Radio_channels, "f").get(name);
        if (channel) {
            channel.clear();
            return __classPrivateFieldGet(this, _Radio_channels, "f").delete(name);
        }
        return false;
    }
    /** Reset complet — détruit le singleton. Usage : tests uniquement. */
    static reset() {
        if (__classPrivateFieldGet(_a, _a, "f", _Radio_instance)) {
            for (const [, channel] of __classPrivateFieldGet(__classPrivateFieldGet(_a, _a, "f", _Radio_instance), _Radio_channels, "f")) {
                channel.clear();
            }
            __classPrivateFieldGet(__classPrivateFieldGet(_a, _a, "f", _Radio_instance), _Radio_channels, "f").clear();
        }
        __classPrivateFieldSet(_a, _a, undefined, "f", _Radio_instance);
    }
}
_a = Radio, _Radio_channels = new WeakMap();
_Radio_instance = { value: void 0 };
_Radio_constructing = { value: false };

export { Channel, Radio };
