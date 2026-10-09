/**
 * @bonsai/feature — Feature base class
 *
 * The 5 capabilities (ADR-01):
 *   C1 — emit(event, payload) on its own Channel (typed by TChannelDef, ADR-14)
 *   C2 — handle(command) through auto-discovered on{Name}Command methods
 *   C3 — listen(event) on declared external Channels through on{Channel}{EventName}Event
 *   C4 — reply(request) through auto-discovered on{Name}Request methods
 *   C5 — request(token, name, params) to declared Channels (typed by the token, ADR-14)
 *
 * Invariants:
 *   I1  — A Feature can only emit() on its own Channel, never on another Feature's
 *   I2  — A Feature can listen to Events of declared external Channels
 *   I3  — A Feature can only reply on its own Channel
 *   I6  — An Entity is only accessible to its owning Feature
 *   I21 — Every Feature MUST be registered in the application manifest under
 *         a unique, flat camelCase namespace key (ADR-08)
 *   I22 — namespace ↔ Feature ↔ Entity is a strict 1:1:1 relation
 *   I48 — Handlers are auto-discovered by naming convention
 *   I68 — The namespace is carried by the application manifest, not by a
 *         `static` on the Feature class (ADR-08)
 *   I72 — `TSelfNS` must match exactly the key the Feature is registered
 *         under in the manifest (ADR-08)
 *   I73 — Every concrete Feature MUST expose `static readonly channel:
 *         TChannelToken<TChannelDef, TSelfNS>` — the bridge between the class
 *         and its typed Channel (ADR-14)
 *   I74 — `TChannelDef` is co-located in the domain's `.feature.ts` file
 *         (no separate `.channel.ts`) (ADR-14)
 *   I75 — No `any`/`unknown` in the public surface of Channel/Feature/View;
 *         internal casts are documented and contained (ADR-14)
 *   I76 — `Channel.{trigger,emit,request,handle,listen,reply}` are strictly
 *         typed by `TDef` — key = `keyof TDef[lane]`, never a free `string`
 *         (ADR-14)
 *   I79 — `Feature.request()` only accepts a typed `TChannelToken`;
 *         `abstract get listens()`/`abstract get queries()` carry these tokens
 *         as instance declarations (ADR-14, ADR-09 — I93)
 *   I93 — `listens` and `queries` are instance `abstract get` on Feature
 *         (ADR-09 — TS2515 when missing on a concrete class)
 *   I94 — The Feature constructor is inert: assertValidNamespace + #namespace
 *         only. No Radio/Entity side effect.
 *   I96 — Entity handlers `on<Key>EntityUpdated`/`onAnyEntityUpdated` are
 *         auto-discovered on the Feature (same mechanism as I48), dispatched
 *         in alphabetical order of `changedKeys`, then the catch-all. Unknown
 *         key → bootstrap error. A throwing handler is isolated (BroadcastError,
 *         ADR-05) and the next notification still runs (stratum 1a)
 *
 * @packageDocumentation
 */

import {
  Entity,
  type TEntityEvent,
  type TJsonSerializable
} from "@bonsai/entity";
import {
  Radio,
  type Channel,
  type TChannelDefinition,
  type TChannelToken
} from "@bonsai/event";
import { BroadcastError, hardInvariant } from "@bonsai/error";
import { assertValidNamespace } from "./types";

// ─── Re-exports — public surface of the package ─────────────────────────────

export {
  RESERVED_NAMESPACES,
  BonsaiNamespaceError,
  isCamelCaseNamespace,
  isReservedNamespace,
  assertValidNamespace
} from "./types";
export type {
  ReservedNamespace,
  CamelCaseNamespace,
  ValidatedManifest,
  StrictManifest,
  TBonsaiNamespaceErrorCode,
  // ── Contract modules (ADR-14) ──────────────────────────────────────────
  TFeatureRef,
  TFeatureRefForNS,
  TFeatureContract,
  // Flattening helpers
  TFlatListens,
  TFlatTriggers,
  TFlatRequests,
  // Payload extractors
  TEventPayloadFor,
  TCommandPayloadFor,
  TRequestParamsFor,
  TRequestResultFor,
  // Channel callbacks (Contract/Callbacks symmetry — I88)
  TChannelHandlerName,
  TChannelCallbacks,
  // Feature callbacks (ADR-09 — I88 symmetry extended to Feature)
  TCommandCallbacks,
  TRequestCallbacks,
  TListenCallbacks,
  TFeatureCallbacks,
  // Feature class constraint (ADR-09 — I95)
  TStrictFeatureClass
} from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Concrete constructor of a Feature subclass.
 *
 * The constructor always takes `namespace: TSelfNS` (ADR-08), which lets
 * `StrictManifest<M>` check at compile time that the class matches its
 * registration key (I72).
 *
 * This type only encodes the constructor signature. The static `channel`
 * member (ADR-14) is checked by `TStrictFeatureClass` at the manifest and by
 * the runtime safety net of `Application.start()`; `listens`/`queries` are
 * instance getters (ADR-09).
 */
export type TFeatureClass<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> = new (namespace: TSelfNS) => Feature<TEntity, TChannelDef, TSelfNS>;

// ─── Feature abstract class ──────────────────────────────────────────────────

/**
 * Feature — business unit parameterised by its Entity class, its Channel
 * contract and its namespace.
 *
 * Type parameters:
 *   - `TEntity`     : the Entity class (ADR-09 — encodes I22 at type level)
 *   - `TChannelDef` : the contract of its own Channel — command, event and
 *                     request types (ADR-14 — I74, I76). Defaults to
 *                     `TChannelDefinition` (all lanes `Record<string, unknown>`)
 *                     for untyped use.
 *   - `TSelfNS`     : the namespace this Feature expects to be registered
 *                     under in the application manifest (ADR-08 — I72).
 *                     Defaults to `string` for unparameterised subclasses.
 *
 * **The namespace is not declared on the class** (no `static namespace`,
 * ADR-08 — I68). It is:
 *   - injected by the constructor (immutable from construction)
 *   - derived from the application manifest key (source of truth — I69)
 *   - checked at compile time by `StrictManifest<M>` through `satisfies`
 *   - checked at runtime by `assertValidNamespace()` (safety net — I71)
 */
export abstract class Feature<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> {
  /**
   * Tokens of the external Channels this Feature listens to (C3 — I2, ADR-14,
   * ADR-09 — I93).
   *
   * **Instance** declaration (`abstract get`, ADR-09), like View's
   * `abstract get` (ADR-14). Every concrete Feature MUST implement this
   * getter (TS2515 otherwise).
   *
   * `Application.start()` reads the returned tokens in Phase 0c, AFTER pure
   * instantiation (inert ctor — I94) and BEFORE any Radio/Entity side effect,
   * to validate cross-dependencies (I70).
   */
  abstract get listens(): readonly TChannelToken<TChannelDefinition, string>[];

  /**
   * Tokens of the external Channels this Feature queries (C5 — I17,
   * ADR-14, ADR-09 — I93).
   *
   * **Instance** declaration (`abstract get`, ADR-09) — see `listens`.
   * Not enforced yet: `request()` accepts any token (ADR-01).
   */
  abstract get queries(): readonly TChannelToken<TChannelDefinition, string>[];

  readonly #namespace: TSelfNS;
  #entity!: TEntity;
  // Own channel — assigned at bootstrap; the cast is safe by I22 (1 namespace = 1 TDef).
  #channel!: Channel<TChannelDef>;
  #bootstrapped = false;

  // ─── Constructor ───────────────────────────────────────────────────────

  /**
   * Creates a Feature bound to the given namespace.
   *
   * Called only by `Application.start()`, which passes the manifest key.
   * Manual instantiation (tests) must pass the namespace too.
   *
   * @throws `BonsaiNamespaceError` when the namespace is invalid or reserved.
   */
  constructor(namespace: TSelfNS) {
    assertValidNamespace(namespace);
    this.#namespace = namespace;
  }

  // ─── Abstract ──────────────────────────────────────────────────────────

  /**
   * Feature → concrete Entity binding (ADR-09).
   *
   * Every concrete Feature MUST provide this getter returning its Entity
   * constructor. The return type is TEntity (the concrete class), so
   * `this.entity` is typed without a cast.
   */
  protected abstract get Entity(): new () => TEntity;

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Namespace of this instance — immutable, set by the constructor.
   * Typed `TSelfNS` (a string literal when the Feature is parameterised).
   */
  get namespace(): TSelfNS {
    return this.#namespace;
  }

  /**
   * Access to the Entity (I6 — exclusive owner).
   * `protected`: only the Feature and its subclasses reach it.
   * Typed by the concrete class (TEntity) thanks to ADR-09.
   */
  protected get entity(): TEntity {
    return this.#entity;
  }

  /**
   * Bootstrap: creates the Entity, registers the handlers on the Channel and
   * calls onInit(). Called by Application, or manually in tests.
   */
  bootstrap(): void {
    if (this.#bootstrapped) return;
    this.#bootstrapped = true;

    // Safe cast by I22: 1 namespace = 1 Feature = 1 TDef (I75).
    this.#channel = Radio.me().channel(
      this.#namespace
    ) as unknown as Channel<TChannelDef>;

    // I22 — 1:1 Entity creation through the Entity getter (ADR-09)
    const EntityCtor = this.Entity;
    this.#entity = new EntityCtor();

    // Handler auto-discovery (I48)
    this.#registerCommandHandlers();
    this.#registerRequestRepliers();
    this.#registerEventListeners();
    this.#registerEntityHandlers();

    // Lifecycle
    this.onInit();
  }

  // ─── Capabilities (C1–C5) ──────────────────────────────────────────────

  /**
   * C1 — Emits a typed Event on this Feature's own Channel (I1, ADR-14).
   */
  protected emit<K extends keyof TChannelDef["events"] & string>(
    eventName: K,
    payload: TChannelDef["events"][K]
  ): void {
    this.#channel.emit(eventName, payload);
  }

  /**
   * C5 — Performs a typed Request to a declared Channel (I17, ADR-14).
   * Returns the typed result or null (ADR-02).
   */
  protected request<
    TDef extends TChannelDefinition,
    TNS extends string,
    K extends keyof TDef["requests"] & string
  >(
    token: TChannelToken<TDef, TNS>,
    requestName: K,
    params: TDef["requests"][K]["params"]
  ): TDef["requests"][K]["result"] | null {
    return Radio.me().channelFor(token).request(requestName, params);
  }

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Hook called after bootstrap. Override it in subclasses.
   */
  onInit(): void {
    // Default no-op — subclasses override
  }

  // ─── Private : Auto-discovery (I48) ────────────────────────────────────

  /**
   * Discovers the `on{Name}Command` methods and registers them as handlers
   * on this Feature's own Channel (C2).
   *
   * Convention: `onAddItemCommand` → command "addItem"
   */
  #registerCommandHandlers(): void {
    // Cast to the untyped Channel to register by string (I75).
    const ch = this.#channel as unknown as Channel;
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)Command$/);
      if (match) {
        const commandName = match[1][0].toLowerCase() + match[1].slice(1);
        ch.handle(commandName, (payload: unknown) => {
          (this as unknown as Record<string, (p: unknown) => void>)[method](
            payload
          );
        });
      }
    }
  }

  /**
   * Discovers the `on{Name}Request` methods and registers them as repliers
   * on this Feature's own Channel (C4, I3).
   *
   * Convention: `onGetTotalRequest` → request "getTotal"
   */
  #registerRequestRepliers(): void {
    // Cast to the untyped Channel to register by string (I75).
    const ch = this.#channel as unknown as Channel;
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)Request$/);
      if (match) {
        const requestName = match[1][0].toLowerCase() + match[1].slice(1);
        ch.reply(requestName, (params: unknown) => {
          return (this as unknown as Record<string, (p: unknown) => unknown>)[
            method
          ](params);
        });
      }
    }
  }

  /**
   * Discovers the `on{Channel}{EventName}Event` methods and registers them as
   * listeners on the Channels declared by `get listens()` (C3, I2, I48,
   * ADR-14, ADR-09 — I93).
   *
   * Convention: `onCartItemAddedEvent` with `get listens() { return [CartFeature.channel]; }`
   * → listens to "itemAdded" on the "cart" Channel
   *
   * Pattern: on + ChannelName(PascalCase) + EventName(PascalCase) + Event
   */
  #registerEventListeners(): void {
    const listenTokens = this.listens;
    if (listenTokens.length === 0) return;

    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const token of listenTokens) {
      const channelName = token.namespace;
      const channelPascal = channelName[0].toUpperCase() + channelName.slice(1);
      const prefix = `on${channelPascal}`;
      const suffix = "Event";

      // Cast to the untyped Channel to register by string (I75).
      const ch = Radio.me().channel(channelName) as unknown as Channel;

      for (const method of methods) {
        if (method.startsWith(prefix) && method.endsWith(suffix)) {
          const eventPascal = method.slice(prefix.length, -suffix.length);
          if (eventPascal.length === 0) continue;

          const eventName = eventPascal[0].toLowerCase() + eventPascal.slice(1);

          ch.listen(eventName, (payload: unknown) => {
            (this as unknown as Record<string, (p: unknown) => void>)[method](
              payload
            );
          });
        }
      }
    }
  }

  /**
   * Discovers the `on{Key}EntityUpdated` methods and subscribes once to
   * `entity.onAnyEntityUpdated()` to dispatch them (I96, stratum 1a).
   *
   * Convention: `onItemsEntityUpdated` with an `items` key in the Entity
   * state → called on every mutation that changes `items`.
   * `onAnyEntityUpdated` (catch-all) is wired without key checking.
   *
   * Runtime safety net: an `on<Key>EntityUpdated` method whose `<Key>`
   * matches no key of the Entity state → bootstrap error.
   */
  #registerEntityHandlers(): void {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];
    const stateKeys = new Set(Object.keys(this.#entity.state as object));

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)EntityUpdated$/);
      if (!match || match[1] === "Any") continue;

      const key = match[1][0].toLowerCase() + match[1].slice(1);
      hardInvariant(
        stateKeys.has(key),
        `Feature "${this.#namespace}" declares entity handler "${method}" for unknown key "${key}"`,
        "I96",
        this.#namespace
      );
    }

    this.#entity.onAnyEntityUpdated((event: TEntityEvent) => {
      this.#dispatchEntityEvent(event);
    });
  }

  /**
   * Routes a `TEntityEvent` to the per-key handlers (alphabetical order of
   * `changedKeys`), then to the catch-all, when present. Each call is
   * isolated: a throw becomes a logged `BroadcastError` and the
   * notification continues (ADR-05, I96).
   */
  #dispatchEntityEvent(event: TEntityEvent): void {
    const self = this as unknown as Record<
      string,
      (...args: unknown[]) => void
    >;

    for (const key of [...event.changedKeys].sort()) {
      const handlerName = `on${key[0].toUpperCase()}${key.slice(1)}EntityUpdated`;
      if (typeof self[handlerName] !== "function") continue;

      const keyPatches = event.patches.filter(
        (p) => String(p.path[0]) === key
      );
      const prev = (event.previousState as Record<string, unknown>)[key];
      const next = (event.nextState as Record<string, unknown>)[key];

      try {
        self[handlerName](prev, next, keyPatches);
      } catch (error) {
        console.error(
          new BroadcastError(
            `Entity handler "${handlerName}" threw for intent "${event.intent}"`,
            "ADR-05",
            this.#namespace
          ),
          error
        );
      }
    }

    if (typeof self["onAnyEntityUpdated"] === "function") {
      try {
        self["onAnyEntityUpdated"](event);
      } catch (error) {
        console.error(
          new BroadcastError(
            `Entity handler "onAnyEntityUpdated" threw for intent "${event.intent}"`,
            "ADR-05",
            this.#namespace
          ),
          error
        );
      }
    }
  }
}
