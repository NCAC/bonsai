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

import { RXJS } from "@bonsai/rxjs";
import {
  NoHandlerError,
  DuplicateHandlerError,
  ListenerError
} from "@bonsai/error";

// ── Contrat structurel d'un Channel (ADR-0040) ───────────────────────────────

/**
 * Déclare le contrat complet d'un Channel : toutes les lanes et leurs types.
 * Chaque Feature déclare son propre `TChannelDefinition` dans son fichier
 * `.feature.ts` (source de vérité unique, co-localisée — I74).
 */
export type TChannelDefinition = {
  readonly commands: Record<string, unknown>;
  readonly events:   Record<string, unknown>;
  readonly requests: Record<string, { params: unknown; result: unknown }>;
};

/**
 * Token phantom porté en `static readonly channel` sur chaque Feature.
 *
 * Encode à la fois le namespace (runtime) et la définition du Channel
 * (compile-time). Permet à tout consommateur (View, Feature externe) d'obtenir
 * un `Channel<TDef>` typé via `Radio.me().channelFor(token)` sans tenir de
 * référence à une instance Feature (ADR-0040 §Décision).
 *
 * `_def` est un champ phantom optionnel — jamais assigné en runtime, présent
 * uniquement pour que TypeScript distingue structurellement deux tokens portant
 * des `TDef` différents sur le même namespace.
 */
export type TChannelToken<
  TDef extends TChannelDefinition,
  TNS extends string = string
> = {
  readonly namespace: TNS;
  readonly _def?: TDef;
};

/** Extrait le `TDef` d'un `TChannelToken`. */
export type TTokenDef<T> =
  T extends TChannelToken<infer TDef, any> ? TDef : never;

// ── Types internes des Maps (stockage opaque) ─────────────────────────────────

// Les Maps internes stockent des handlers avec payload `unknown`.
// La surface publique est typée via les generics de Channel<TDef>.
// Les casts à l'insertion sont le prix de cette séparation (I75).
type TCommandHandler = (payload: unknown) => void;
type TEventListener  = (payload: unknown) => void;
type TRequestReplier = (params: unknown) => unknown;

// ── Payload de l'événement technique `any` ───────────────────────────────────

/**
 * Payload de l'événement technique `any`, émis automatiquement
 * après chaque `emit()` d'un Event granulaire.
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

  // ── Événement technique `any` ─────────────────────────────────────────────
  readonly #anySubject = new RXJS.Subject<TAnyEventPayload>();
  readonly #anySubscriptions = new Map<TEventListener, RXJS.Subscription>();

  constructor(public readonly name: string) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Lane 1 — Commands
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enregistre le handler unique pour un Command (I10 — un seul handler).
   * @throws DuplicateHandlerError si un handler est déjà enregistré.
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
   * Émet un Command vers son handler unique.
   * @throws NoHandlerError si aucun handler n'est enregistré.
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
   * Enregistre un listener pour un Event (I11 — N listeners autorisés).
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
              "ADR-0002",
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
   * Supprime un listener spécifique pour un Event.
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
   * Émet un Event vers tous les listeners (1:N).
   * Silencieux si aucun listener. Émet `any` automatiquement après.
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
    const subscription = this.#anySubscriptions.get(
      listener as TEventListener
    );
    if (subscription) {
      subscription.unsubscribe();
      this.#anySubscriptions.delete(listener as TEventListener);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lane 3 — Requests (synchrone, T | null)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enregistre le replier unique pour un type de Request.
   * @throws DuplicateHandlerError si un replier est déjà enregistré.
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
   * Supprime un replier.
   */
  unreply<K extends keyof TDef["requests"] & string>(
    requestName: K
  ): void {
    this.#requestRepliers.delete(requestName);
  }

  /**
   * Effectue une Request synchrone. Retourne `TDef['requests'][K]['result'] | null`.
   * - Pas de replier → null (ADR-0023, D44)
   * - Replier qui throw → null, erreur loguée (I55)
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
   * Supprime tous les handlers, listeners et repliers.
   * Complète les Subjects RxJS.
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
