/**
 * @bonsai/event - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-04-17T21:02:03.909Z
 */
import { RXJS } from '@bonsai/rxjs';
import { DuplicateHandlerError, NoHandlerError, ListenerError } from '@bonsai/error';

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
 * @see RFC 2-architecture/communication.md
 * @see ADR-0003 — Sémantiques runtime Channel
 * @see ADR-0023 — request() synchrone
 */
// ── Channel ──────────────────────────────────────────────────────
class Channel {
    constructor(name) {
        this.name = name;
        // ── Lane 1 — Commands (1:1) ──────────────────────────────────
        this.commandHandlers = new Map();
        // ── Lane 2 — Events (1:N via RxJS Subject) ──────────────────
        this.eventSubjects = new Map();
        this.eventSubscriptions = new Map();
        // ── Lane 3 — Requests (1:1 sync) ────────────────────────────
        this.requestRepliers = new Map();
        // ── Événement technique `any` ────────────────────────────────
        this.anySubject = new RXJS.Subject();
        this.anySubscriptions = new Map();
    }
    // ═══════════════════════════════════════════════════════════════
    // Lane 1 — Commands
    // ═══════════════════════════════════════════════════════════════
    /**
     * Enregistre le handler unique pour un Command. I10 : un seul handler par Command.
     * @throws DuplicateHandlerError si un handler est déjà enregistré pour ce Command
     */
    handle(commandName, handler) {
        if (this.commandHandlers.has(commandName)) {
            throw new DuplicateHandlerError(`Command "${this.name}:${commandName}" already has a handler`, "I10", this.name, "Each Command must have exactly one handler (the owning Feature).");
        }
        this.commandHandlers.set(commandName, handler);
    }
    /**
     * Émet un Command vers son handler unique.
     * @throws NoHandlerError si aucun handler n'est enregistré (strate 0 : toujours throw)
     */
    trigger(commandName, payload) {
        const handler = this.commandHandlers.get(commandName);
        if (!handler) {
            throw new NoHandlerError(`No handler for command "${this.name}:${commandName}"`, "I10", this.name, `Register a handler with channel.handle("${commandName}", handler)`);
        }
        handler(payload);
    }
    // ═══════════════════════════════════════════════════════════════
    // Lane 2 — Events
    // ═══════════════════════════════════════════════════════════════
    /**
     * Enregistre un listener pour un Event. I11 : N listeners autorisés.
     */
    listen(eventName, listener) {
        if (!this.eventSubjects.has(eventName)) {
            this.eventSubjects.set(eventName, new RXJS.Subject());
            this.eventSubscriptions.set(eventName, new Map());
        }
        const subject = this.eventSubjects.get(eventName);
        const subscription = subject.subscribe({
            next: (payload) => {
                try {
                    listener(payload);
                }
                catch (error) {
                    // ADR-0002 : isolation des erreurs — ne propage pas aux autres listeners
                    console.error(new ListenerError(`Listener error on "${this.name}:${eventName}"`, "ADR-0002", this.name), error);
                }
            }
        });
        this.eventSubscriptions.get(eventName).set(listener, subscription);
    }
    /**
     * Supprime un listener spécifique pour un Event.
     */
    unlisten(eventName, listener) {
        const subsMap = this.eventSubscriptions.get(eventName);
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
        const subject = this.eventSubjects.get(eventName);
        if (subject) {
            subject.next(payload);
        }
        // Événement technique `any` — émis après chaque Event granulaire
        this.anySubject.next({
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
        const subscription = this.anySubject.subscribe({
            next: (payload) => {
                try {
                    listener(payload);
                }
                catch (error) {
                    console.error(new ListenerError(`Listener error on "${this.name}:any"`, "ADR-0002", this.name), error);
                }
            }
        });
        this.anySubscriptions.set(listener, subscription);
    }
    /**
     * Supprime un listener `any`.
     */
    unlistenAny(listener) {
        const subscription = this.anySubscriptions.get(listener);
        if (subscription) {
            subscription.unsubscribe();
            this.anySubscriptions.delete(listener);
        }
    }
    // ═══════════════════════════════════════════════════════════════
    // Lane 3 — Requests (synchrone, T | null)
    // ═══════════════════════════════════════════════════════════════
    /**
     * Enregistre le replier unique pour un type de Request.
     * @throws DuplicateHandlerError si un replier est déjà enregistré
     */
    reply(requestName, replier) {
        if (this.requestRepliers.has(requestName)) {
            throw new DuplicateHandlerError(`Request "${this.name}:${requestName}" already has a replier`, "I10", this.name, "Each Request must have exactly one replier.");
        }
        this.requestRepliers.set(requestName, replier);
    }
    /**
     * Supprime un replier.
     */
    unreply(requestName) {
        this.requestRepliers.delete(requestName);
    }
    /**
     * Effectue une Request synchrone. Retourne T | null.
     * - Pas de replier → null (ADR-0023, D44)
     * - Replier qui throw → null, erreur loguée (I55)
     */
    request(requestName, params) {
        const replier = this.requestRepliers.get(requestName);
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
    // ═══════════════════════════════════════════════════════════════
    // Lifecycle
    // ═══════════════════════════════════════════════════════════════
    /**
     * Supprime tous les handlers, listeners et repliers.
     * Complète les Subjects RxJS.
     */
    clear() {
        // Commands
        this.commandHandlers.clear();
        // Events — unsubscribe all, complete subjects
        for (const [, subsMap] of this.eventSubscriptions) {
            for (const [, sub] of subsMap) {
                sub.unsubscribe();
            }
        }
        this.eventSubscriptions.clear();
        for (const [, subject] of this.eventSubjects) {
            subject.complete();
        }
        this.eventSubjects.clear();
        // Any
        for (const [, sub] of this.anySubscriptions) {
            sub.unsubscribe();
        }
        this.anySubscriptions.clear();
        this.anySubject.complete();
        // Requests
        this.requestRepliers.clear();
    }
}

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
class Radio {
    /** Constructeur privé — force le pattern singleton via `me()`. */
    constructor() {
        this.channels = new Map();
        if (!Radio.constructing) {
            throw new Error("Radio is a singleton — use Radio.me() to get the instance.");
        }
    }
    /** Retourne l'instance unique du Radio. */
    static me() {
        if (!Radio.instance) {
            Radio.constructing = true;
            Radio.instance = new Radio();
            Radio.constructing = false;
        }
        return Radio.instance;
    }
    /** Obtient ou crée un Channel par namespace. */
    channel(name) {
        if (!this.channels.has(name)) {
            this.channels.set(name, new Channel(name));
        }
        return this.channels.get(name);
    }
    /** Vérifie si un Channel existe pour ce namespace. */
    hasChannel(name) {
        return this.channels.has(name);
    }
    /** Liste tous les namespaces enregistrés. */
    getChannelNames() {
        return Array.from(this.channels.keys());
    }
    /**
     * Supprime un Channel. Appelle `clear()` sur le Channel avant suppression.
     * @returns `true` si le Channel existait, `false` sinon
     */
    removeChannel(name) {
        const channel = this.channels.get(name);
        if (channel) {
            channel.clear();
            return this.channels.delete(name);
        }
        return false;
    }
    /** Reset complet — détruit le singleton. Usage : tests uniquement. */
    static reset() {
        if (Radio.instance) {
            for (const [, channel] of Radio.instance.channels) {
                channel.clear();
            }
            Radio.instance.channels.clear();
        }
        Radio.instance = undefined;
    }
}
Radio.constructing = false;

export { Channel, Radio };
