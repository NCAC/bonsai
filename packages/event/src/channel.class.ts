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

import { RXJS } from "@bonsai/rxjs";
import {
  NoHandlerError,
  DuplicateHandlerError,
  ListenerError
} from "@bonsai/error";

// ── Types ────────────────────────────────────────────────────────

type TCommandHandler = (payload: unknown) => void;
type TEventListener = (payload: unknown) => void;
type TRequestReplier = (params: unknown) => unknown;

/**
 * Payload de l'événement technique `any`, émis automatiquement
 * après chaque `emit()` d'un Event granulaire.
 */
export type TAnyEventPayload = {
  readonly event: string;
  readonly changes: Record<string, unknown>;
};

// ── Channel ──────────────────────────────────────────────────────

export class Channel {
  // ── Lane 1 — Commands (1:1) ──────────────────────────────────
  readonly #commandHandlers = new Map<string, TCommandHandler>();

  // ── Lane 2 — Events (1:N via RxJS Subject) ────────────────
  readonly #eventSubjects = new Map<string, RXJS.Subject<unknown>>();
  readonly #eventSubscriptions = new Map<
    string,
    Map<TEventListener, RXJS.Subscription>
  >();

  // ── Lane 3 — Requests (1:1 sync) ──────────────────────
  readonly #requestRepliers = new Map<string, TRequestReplier>();

  // ── Événement technique `any` ──────────────────────────
  readonly #anySubject = new RXJS.Subject<TAnyEventPayload>();
  readonly #anySubscriptions = new Map<TEventListener, RXJS.Subscription>();

  constructor(public readonly name: string) {}

  // ═══════════════════════════════════════════════════════════════
  // Lane 1 — Commands
  // ═══════════════════════════════════════════════════════════════

  /**
   * Enregistre le handler unique pour un Command. I10 : un seul handler par Command.
   * @throws DuplicateHandlerError si un handler est déjà enregistré pour ce Command
   */
  handle(commandName: string, handler: TCommandHandler): void {
    if (this.#commandHandlers.has(commandName)) {
      throw new DuplicateHandlerError(
        `Command "${this.name}:${commandName}" already has a handler`,
        "I10",
        this.name,
        "Each Command must have exactly one handler (the owning Feature)."
      );
    }
    this.#commandHandlers.set(commandName, handler);
  }

  /**
   * Émet un Command vers son handler unique.
   * @throws NoHandlerError si aucun handler n'est enregistré (strate 0 : toujours throw)
   */
  trigger(commandName: string, payload: unknown): void {
    const handler = this.#commandHandlers.get(commandName);
    if (!handler) {
      throw new NoHandlerError(
        `No handler for command "${this.name}:${commandName}"`,
        "I10",
        this.name,
        `Register a handler with channel.handle("${commandName}", handler)`
      );
    }
    handler(payload);
  }

  // ═══════════════════════════════════════════════════════════════
  // Lane 2 — Events
  // ═══════════════════════════════════════════════════════════════

  /**
   * Enregistre un listener pour un Event. I11 : N listeners autorisés.
   */
  listen(eventName: string, listener: TEventListener): void {
    if (!this.#eventSubjects.has(eventName)) {
      this.#eventSubjects.set(eventName, new RXJS.Subject<unknown>());
      this.#eventSubscriptions.set(eventName, new Map());
    }

    const subject = this.#eventSubjects.get(eventName)!;
    const subscription = subject.subscribe({
      next: (payload) => {
        try {
          listener(payload);
        } catch (error) {
          // ADR-0002 : isolation des erreurs — ne propage pas aux autres listeners
          console.error(
            new ListenerError(
              `Listener error on "${this.name}:${eventName}"`,
              "ADR-0002",
              this.name
            ),
            error
          );
        }
      }
    });

    this.#eventSubscriptions.get(eventName)!.set(listener, subscription);
  }

  /**
   * Supprime un listener spécifique pour un Event.
   */
  unlisten(eventName: string, listener: TEventListener): void {
    const subsMap = this.#eventSubscriptions.get(eventName);
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
  emit(eventName: string, payload: unknown): void {
    const subject = this.#eventSubjects.get(eventName);
    if (subject) {
      subject.next(payload);
    }

    // Événement technique `any` — émis après chaque Event granulaire
    this.#anySubject.next({
      event: eventName,
      changes:
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {}
    });
  }

  /**
   * Enregistre un listener pour l'événement technique `any`.
   */
  listenAny(listener: (payload: TAnyEventPayload) => void): void {
    const subscription = this.#anySubject.subscribe({
      next: (payload) => {
        try {
          listener(payload);
        } catch (error) {
          console.error(
            new ListenerError(
              `Listener error on "${this.name}:any"`,
              "ADR-0002",
              this.name
            ),
            error
          );
        }
      }
    });
    this.#anySubscriptions.set(listener as TEventListener, subscription);
  }

  /**
   * Supprime un listener `any`.
   */
  unlistenAny(listener: (payload: TAnyEventPayload) => void): void {
    const subscription = this.#anySubscriptions.get(listener as TEventListener);
    if (subscription) {
      subscription.unsubscribe();
      this.#anySubscriptions.delete(listener as TEventListener);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Lane 3 — Requests (synchrone, T | null)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Enregistre le replier unique pour un type de Request.
   * @throws DuplicateHandlerError si un replier est déjà enregistré
   */
  reply(requestName: string, replier: TRequestReplier): void {
    if (this.#requestRepliers.has(requestName)) {
      throw new DuplicateHandlerError(
        `Request "${this.name}:${requestName}" already has a replier`,
        "I10",
        this.name,
        "Each Request must have exactly one replier."
      );
    }
    this.#requestRepliers.set(requestName, replier);
  }

  /**
   * Supprime un replier.
   */
  unreply(requestName: string): void {
    this.#requestRepliers.delete(requestName);
  }

  /**
   * Effectue une Request synchrone. Retourne T | null.
   * - Pas de replier → null (ADR-0023, D44)
   * - Replier qui throw → null, erreur loguée (I55)
   */
  request(requestName: string, params: unknown): unknown | null {
    const replier = this.#requestRepliers.get(requestName);
    if (!replier) {
      return null;
    }
    try {
      return replier(params);
    } catch (error) {
      console.error(
        `[Bonsai] Request replier error on "${this.name}:${requestName}"`,
        error
      );
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
  clear(): void {
    // Commands
    this.#commandHandlers.clear();

    // Events — unsubscribe all, complete subjects
    for (const [, subsMap] of this.#eventSubscriptions) {
      for (const [, sub] of subsMap) {
        sub.unsubscribe();
      }
    }
    this.#eventSubscriptions.clear();
    for (const [, subject] of this.#eventSubjects) {
      subject.complete();
    }
    this.#eventSubjects.clear();

    // Any
    for (const [, sub] of this.#anySubscriptions) {
      sub.unsubscribe();
    }
    this.#anySubscriptions.clear();
    this.#anySubject.complete();

    // Requests
    this.#requestRepliers.clear();
  }
}
