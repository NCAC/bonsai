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

import { RXJS } from "@bonsai/rxjs";
import {
  NoHandlerError,
  DuplicateHandlerError,
  ListenerError
} from "@bonsai/error";

// ── Structural contract of a Channel (ADR-14) ──────────────────────────────

/**
 * Declares the full contract of a Channel: every lane and its types.
 * Each Feature declares its own `TChannelDefinition` in its `.feature.ts`
 * file (single, co-located source of truth — I74).
 */
export type TChannelDefinition = {
  readonly commands: Record<string, unknown>;
  readonly events:   Record<string, unknown>;
  readonly requests: Record<string, { params: unknown; result: unknown }>;
};

/**
 * Phantom token carried as `static readonly channel` on every Feature.
 *
 * Encodes both the namespace (runtime) and the Channel definition
 * (compile time). Lets any consumer (View, external Feature) get a typed
 * `Channel<TDef>` through `Radio.me().channelFor(token)` without holding a
 * reference to a Feature instance (ADR-14).
 *
 * `_def` is an optional phantom field — never assigned at runtime, present
 * only so TypeScript structurally distinguishes two tokens carrying
 * different `TDef` on the same namespace.
 */
export type TChannelToken<
  TDef extends TChannelDefinition,
  TNS extends string = string
> = {
  readonly namespace: TNS;
  readonly _def?: TDef;
};

/** Extracts the `TDef` of a `TChannelToken`. */
export type TTokenDef<T> =
  T extends TChannelToken<infer TDef, any> ? TDef : never;

// ── Internal Map types (opaque storage) ──────────────────────────────────────

// Internal Maps store handlers with an `unknown` payload.
// The public surface is typed through the generics of Channel<TDef>.
// Casts on insertion are the price of that separation (I75).
type TCommandHandler = (payload: unknown) => void;
type TEventListener  = (payload: unknown) => void;
type TRequestReplier = (params: unknown) => unknown;

// ── Payload of the technical `any` event ─────────────────────────────────────

/**
 * Payload of the technical `any` event, emitted automatically after
 * each `emit()` of a granular Event.
 */
export type TAnyEventPayload = {
  readonly event: string;
  readonly changes: Record<string, unknown>;
};

// ── Channel ──────────────────────────────────────────────────────────────────

export class Channel<TDef extends TChannelDefinition = TChannelDefinition> {
  // ── Lane 1 — Commands (1:1) ──────────────────────────────────────────────
  readonly #commandHandlers = new Map<string, TCommandHandler>();

  // ── Lane 2 — Events (1:N via RxJS Subject) ───────────────────────────────
  readonly #eventSubjects = new Map<string, RXJS.Subject<unknown>>();
  readonly #eventSubscriptions = new Map<
    string,
    Map<TEventListener, RXJS.Subscription>
  >();

  // ── Lane 3 — Requests (1:1 sync) ─────────────────────────────────────────
  readonly #requestRepliers = new Map<string, TRequestReplier>();

  // ── Technical `any` event ─────────────────────────────────────────────────
  readonly #anySubject = new RXJS.Subject<TAnyEventPayload>();
  readonly #anySubscriptions = new Map<TEventListener, RXJS.Subscription>();

  constructor(public readonly name: string) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Lane 1 — Commands
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Registers the single handler of a Command (I10 — one handler only).
   * @throws DuplicateHandlerError if a handler is already registered.
   */
  handle<K extends keyof TDef["commands"] & string>(
    commandName: K,
    handler: (payload: TDef["commands"][K]) => void
  ): void {
    if (this.#commandHandlers.has(commandName)) {
      throw new DuplicateHandlerError(
        `Command "${this.name}:${commandName}" already has a handler`,
        "I10",
        this.name,
        "Each Command must have exactly one handler (the owning Feature)."
      );
    }
    this.#commandHandlers.set(commandName, handler as TCommandHandler);
  }

  /**
   * Sends a Command to its single handler.
   * @throws NoHandlerError if no handler is registered.
   */
  trigger<K extends keyof TDef["commands"] & string>(
    commandName: K,
    payload: TDef["commands"][K]
  ): void {
    const handler = this.#commandHandlers.get(commandName);
    if (!handler) {
      throw new NoHandlerError(
        `No handler for command "${this.name}:${commandName}"`,
        "I10",
        this.name,
        `Register a handler with channel.handle("${commandName}", handler)`
      );
    }
    handler(payload as unknown);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lane 2 — Events
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Registers a listener for an Event (I11 — N listeners allowed).
   */
  listen<K extends keyof TDef["events"] & string>(
    eventName: K,
    listener: (payload: TDef["events"][K]) => void
  ): void {
    if (!this.#eventSubjects.has(eventName)) {
      this.#eventSubjects.set(eventName, new RXJS.Subject<unknown>());
      this.#eventSubscriptions.set(eventName, new Map());
    }

    const subject = this.#eventSubjects.get(eventName)!;
    const subscription = subject.subscribe({
      next: (payload) => {
        try {
          listener(payload as TDef["events"][K]);
        } catch (error) {
          console.error(
            new ListenerError(
              `Listener error on "${this.name}:${eventName}"`,
              "ADR-05",
              this.name
            ),
            error
          );
        }
      }
    });

    this.#eventSubscriptions.get(eventName)!.set(
      listener as TEventListener,
      subscription
    );
  }

  /**
   * Removes a specific listener of an Event.
   */
  unlisten<K extends keyof TDef["events"] & string>(
    eventName: K,
    listener: (payload: TDef["events"][K]) => void
  ): void {
    const subsMap = this.#eventSubscriptions.get(eventName);
    if (subsMap) {
      const subscription = subsMap.get(listener as TEventListener);
      if (subscription) {
        subscription.unsubscribe();
        subsMap.delete(listener as TEventListener);
      }
    }
  }

  /**
   * Emits an Event to every listener (1:N).
   * Silent when there is no listener. Emits `any` automatically afterwards.
   */
  emit<K extends keyof TDef["events"] & string>(
    eventName: K,
    payload: TDef["events"][K]
  ): void {
    const subject = this.#eventSubjects.get(eventName);
    if (subject) {
      subject.next(payload);
    }

    this.#anySubject.next({
      event: eventName,
      changes:
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {}
    });
  }

  /**
   * Registers a listener for the technical `any` event.
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
              "ADR-05",
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
   * Removes an `any` listener.
   */
  unlistenAny(listener: (payload: TAnyEventPayload) => void): void {
    const subscription = this.#anySubscriptions.get(
      listener as TEventListener
    );
    if (subscription) {
      subscription.unsubscribe();
      this.#anySubscriptions.delete(listener as TEventListener);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lane 3 — Requests (synchronous, T | null)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Registers the single replier of a Request.
   * @throws DuplicateHandlerError if a replier is already registered.
   */
  reply<K extends keyof TDef["requests"] & string>(
    requestName: K,
    replier: (
      params: TDef["requests"][K]["params"]
    ) => TDef["requests"][K]["result"]
  ): void {
    if (this.#requestRepliers.has(requestName)) {
      throw new DuplicateHandlerError(
        `Request "${this.name}:${requestName}" already has a replier`,
        "I10",
        this.name,
        "Each Request must have exactly one replier."
      );
    }
    this.#requestRepliers.set(requestName, replier as TRequestReplier);
  }

  /**
   * Removes a replier.
   */
  unreply<K extends keyof TDef["requests"] & string>(
    requestName: K
  ): void {
    this.#requestRepliers.delete(requestName);
  }

  /**
   * Performs a synchronous Request. Returns `TDef['requests'][K]['result'] | null`.
   * - No replier → null (ADR-02)
   * - Replier throws → null, error logged (I55)
   */
  request<K extends keyof TDef["requests"] & string>(
    requestName: K,
    params: TDef["requests"][K]["params"]
  ): TDef["requests"][K]["result"] | null {
    const replier = this.#requestRepliers.get(requestName);
    if (!replier) {
      return null;
    }
    try {
      return replier(params as unknown) as TDef["requests"][K]["result"];
    } catch (error) {
      console.error(
        `[Bonsai] Request replier error on "${this.name}:${requestName}"`,
        error
      );
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
  clear(): void {
    this.#commandHandlers.clear();

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

    for (const [, sub] of this.#anySubscriptions) {
      sub.unsubscribe();
    }
    this.#anySubscriptions.clear();
    this.#anySubject.complete();

    this.#requestRepliers.clear();
  }
}
