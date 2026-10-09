/**
 * @bonsai/event - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-09-24T20:04:51.124Z
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
 * Tri-lane Channel — Bonsai's internal communication infrastructure.
 *
 * A Channel is a communication contract with 3 lanes:
 * - **Command lane**: `handle()` / `trigger()` — 1:1 (a single handler)
 * - **Event lane**: `listen()` / `unlisten()` / `emit()` — 1:N (broadcast)
 * - **Request lane**: `reply()` / `unreply()` / `request()` — 1:1 synchronous, T | null
 *
 * The Channel automatically emits an `any` event after each `emit()`.
 *
 * `Channel` is generic over `TDef extends TChannelDefinition` (ADR-14).
 * The default `TChannelDefinition` (all lanes `Record<string, unknown>`)
 * keeps untyped code fully compatible.
 *
 * @see docs/spec/2-architecture/communication.md
 * @see ADR-03 — Channel runtime semantics
 * @see ADR-02 — synchronous request()
 * @see ADR-14 — typed contracts: TChannelDefinition, TChannelToken
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
        // ── Technical `any` event ─────────────────────────────────────────────────
        _Channel_anySubject.set(this, new RXJS.Subject());
        _Channel_anySubscriptions.set(this, new Map());
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Lane 1 — Commands
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Registers the single handler of a Command (I10 — one handler only).
     * @throws DuplicateHandlerError if a handler is already registered.
     */
    handle(commandName, handler) {
        if (__classPrivateFieldGet(this, _Channel_commandHandlers, "f").has(commandName)) {
            throw new DuplicateHandlerError(`Command "${this.name}:${commandName}" already has a handler`, "I10", this.name, "Each Command must have exactly one handler (the owning Feature).");
        }
        __classPrivateFieldGet(this, _Channel_commandHandlers, "f").set(commandName, handler);
    }
    /**
     * Sends a Command to its single handler.
     * @throws NoHandlerError if no handler is registered.
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
     * Registers a listener for an Event (I11 — N listeners allowed).
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
                    console.error(new ListenerError(`Listener error on "${this.name}:${eventName}"`, "ADR-05", this.name), error);
                }
            }
        });
        __classPrivateFieldGet(this, _Channel_eventSubscriptions, "f").get(eventName).set(listener, subscription);
    }
    /**
     * Removes a specific listener of an Event.
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
     * Emits an Event to every listener (1:N).
     * Silent when there is no listener. Emits `any` automatically afterwards.
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
     * Registers a listener for the technical `any` event.
     */
    listenAny(listener) {
        const subscription = __classPrivateFieldGet(this, _Channel_anySubject, "f").subscribe({
            next: (payload) => {
                try {
                    listener(payload);
                }
                catch (error) {
                    console.error(new ListenerError(`Listener error on "${this.name}:any"`, "ADR-05", this.name), error);
                }
            }
        });
        __classPrivateFieldGet(this, _Channel_anySubscriptions, "f").set(listener, subscription);
    }
    /**
     * Removes an `any` listener.
     */
    unlistenAny(listener) {
        const subscription = __classPrivateFieldGet(this, _Channel_anySubscriptions, "f").get(listener);
        if (subscription) {
            subscription.unsubscribe();
            __classPrivateFieldGet(this, _Channel_anySubscriptions, "f").delete(listener);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // Lane 3 — Requests (synchronous, T | null)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Registers the single replier of a Request.
     * @throws DuplicateHandlerError if a replier is already registered.
     */
    reply(requestName, replier) {
        if (__classPrivateFieldGet(this, _Channel_requestRepliers, "f").has(requestName)) {
            throw new DuplicateHandlerError(`Request "${this.name}:${requestName}" already has a replier`, "I10", this.name, "Each Request must have exactly one replier.");
        }
        __classPrivateFieldGet(this, _Channel_requestRepliers, "f").set(requestName, replier);
    }
    /**
     * Removes a replier.
     */
    unreply(requestName) {
        __classPrivateFieldGet(this, _Channel_requestRepliers, "f").delete(requestName);
    }
    /**
     * Performs a synchronous Request. Returns `TDef['requests'][K]['result'] | null`.
     * - No replier → null (ADR-02)
     * - Replier throws → null, error logged (I55)
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
     * Removes every handler, listener and replier.
     * Completes the RxJS Subjects.
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
 * Radio — singleton registry of Channels.
 *
 * Radio is the central wiring point of Bonsai communication. It manages
 * Channel instances by namespace (get-or-create).
 *
 * I15 — Radio is never exposed to application developers.
 *
 * @see docs/spec/2-architecture/communication.md §8
 */
var _a, _Radio_instance, _Radio_constructing, _Radio_channels;
class Radio {
    /** Private constructor — enforces the singleton through `me()`. */
    constructor() {
        _Radio_channels.set(this, new Map());
        if (!__classPrivateFieldGet(_a, _a, "f", _Radio_constructing)) {
            throw new Error("Radio is a singleton — use Radio.me() to get the instance.");
        }
    }
    /** Returns the single Radio instance. */
    static me() {
        if (!__classPrivateFieldGet(_a, _a, "f", _Radio_instance)) {
            __classPrivateFieldSet(_a, _a, true, "f", _Radio_constructing);
            __classPrivateFieldSet(_a, _a, new _a(), "f", _Radio_instance);
            __classPrivateFieldSet(_a, _a, false, "f", _Radio_constructing);
        }
        return __classPrivateFieldGet(_a, _a, "f", _Radio_instance);
    }
    /**
     * Gets or creates a Channel by namespace (internal API).
     * Returns `Channel<TChannelDefinition>` — all lanes `Record<string, unknown>`.
     * For typed access from outside, use `channelFor(token)`.
     */
    channel(name) {
        if (!__classPrivateFieldGet(this, _Radio_channels, "f").has(name)) {
            __classPrivateFieldGet(this, _Radio_channels, "f").set(name, new Channel(name));
        }
        return __classPrivateFieldGet(this, _Radio_channels, "f").get(name);
    }
    /**
     * Gets or creates a typed Channel from its token (ADR-14, I77, I79).
     *
     * The `as Channel<TDef>` cast is safe by I22: a namespace belongs to a
     * single Feature, hence to a single `TDef`.
     */
    channelFor(token) {
        return this.channel(token.namespace);
    }
    /** Checks whether a Channel exists for this namespace. */
    hasChannel(name) {
        return __classPrivateFieldGet(this, _Radio_channels, "f").has(name);
    }
    /** Lists all registered namespaces. */
    getChannelNames() {
        return Array.from(__classPrivateFieldGet(this, _Radio_channels, "f").keys());
    }
    /**
     * Removes a Channel, calling `clear()` on it first.
     * @returns `true` if the Channel existed, `false` otherwise
     */
    removeChannel(name) {
        const channel = __classPrivateFieldGet(this, _Radio_channels, "f").get(name);
        if (channel) {
            channel.clear();
            return __classPrivateFieldGet(this, _Radio_channels, "f").delete(name);
        }
        return false;
    }
    /** Full reset — destroys the singleton. Tests only. */
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
