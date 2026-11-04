/**
 * @bonsai/feature — Feature base class
 *
 * The 5 capabilities (ADR-01), realised on the kernel (migration lot M6.1):
 *   C1 — ctx.emit(event, payload) on its own Channel (typed by TChannelDef, ADR-14)
 *   C2 — handle(command) through auto-discovered on{Name}Command(payload, ctx) methods
 *   C3 — listen(event) on declared external Channels through on{Channel}{EventName}Event(payload, ctx)
 *   C4 — reply(query) through auto-discovered on{Name}Query(params, ctx) methods
 *   C5 — ctx.query(token, name, params) to declared Channels (typed by the token, ADR-14)
 *
 * Every handler receives a context as second argument: there is no `this.emit`,
 * `this.request` or `this.entity.mutate` any more. A handler runs inside a
 * validation unit of the kernel (G7): its mutations and emissions are
 * applied together or not at all. A Feature never addresses a Command (D17).
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
 *   I76 — The handler contexts (`emit`, `query`, `mutate`) are strictly
 *         typed by `TDef` — key = `keyof TDef[lane]`, never a free `string`
 *         (ADR-14)
 *   I79 — The Feature's `ctx.query` only accepts a typed `TChannelToken`;
 *         `abstract get listens()`/`abstract get queries()` carry these tokens
 *         as instance declarations (ADR-14, ADR-09 — I93)
 *   I93 — `listens` and `queries` are instance `abstract get` on Feature
 *         (ADR-09 — TS2515 when missing on a concrete class)
 *   I94 — The Feature constructor is inert: assertValidNamespace + #namespace
 *         only. No kernel/Entity side effect.
 *   I96 — Entity handlers `on<Key>EntityUpdated`/`onAnyEntityUpdated` are
 *         auto-discovered on the Feature (same mechanism as I48), dispatched
 *         in alphabetical order of `changedKeys`, then the catch-all. Unknown
 *         key → bootstrap error. The notification is a deferred local message
 *         the Feature sends to itself after the mutation (G5, D8): a throwing
 *         handler fails its own unit, never the one that mutated.
 *
 * @packageDocumentation
 */

import {
  type Entity,
  type TEntityEvent,
  type TJsonSerializable,
  type TMutationParams,
  type TEntityRecipe,
  bindEntityState,
  describeEntity
} from "@bonsai/entity";
import type {
  TChannelDefinition,
  TChannelToken,
  TManifestEntry,
  TReadContext,
  TUnitContext
} from "@bonsai/kernel";
import { hardInvariant } from "@bonsai/error";
import {
  assertValidNamespace,
  type TFeatureContext,
  type TFeatureQueryContext
} from "./types";

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
  // ── Handler contexts (lot M6.1) ────────────────────────────────────────
  TFeatureContext,
  TFeatureQueryContext,
  // ── Contract modules (ADR-14) ──────────────────────────────────────────
  TFeatureRef,
  TFeatureRefForNS,
  TFeatureContract,
  // Flattening helpers
  TFlatListens,
  TFlatTriggers,
  TFlatQueries,
  // Payload extractors
  TEventPayloadFor,
  TCommandPayloadFor,
  TQueryParamsFor,
  TQueryResultFor,
  // Channel callbacks (Contract/Callbacks symmetry — I88)
  TChannelHandlerName,
  TChannelCallbacks,
  // Feature callbacks (ADR-09 — I88 symmetry extended to Feature)
  TCommandCallbacks,
  TQueryCallbacks,
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
 */
export type TFeatureClass<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> = new (namespace: TSelfNS) => Feature<TEntity, TChannelDef, TSelfNS>;

// ─── Framework description of a Feature ──────────────────────────────────────

const DESCRIBE = Symbol("bonsai.feature.describe");

/** Name of the local message a Feature sends itself after a mutation (I96). */
const ENTITY_UPDATED = "entityUpdated";

/**
 * @internal Framework use only (`Application`).
 *
 * Builds the description the kernel needs to create the Feature as a child of
 * the root: its Channel, subscriptions, local message, Entity and initial
 * Query dependencies (D16, C.1). Creates the Entity (I22).
 */
export function describeFeature(
  feature: Feature<any, any, any>
): TManifestEntry {
  return (
    feature as unknown as { [DESCRIBE](): TManifestEntry }
  )[DESCRIBE]();
}

const lowerFirst = (s: string): string => s[0]!.toLowerCase() + s.slice(1);

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
 *
 * **The Events a Feature may emit are declared on its `static readonly
 * channel` token** (`events`, D16): the kernel refuses an emission that was
 * not declared.
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
   * **Instance** declaration (`abstract get`, ADR-09). Every concrete Feature
   * MUST implement this getter (TS2515 otherwise).
   */
  abstract get listens(): readonly TChannelToken<TChannelDefinition, string>[];

  /**
   * Tokens of the external Channels this Feature queries (C5 — I17,
   * ADR-14, ADR-09 — I93).
   *
   * This is a permission to query, not an order of startup: two Features may
   * query each other during their life. The order of startup comes from
   * `dependsOn`.
   */
  abstract get queries(): readonly TChannelToken<TChannelDefinition, string>[];

  /**
   * Tokens of the Features this Feature queries **during its own initial
   * unit** (C.1): the kernel starts the Feature after them, whatever the order
   * of the Manifest. Optional (none by default). Each must also be declared in
   * `queries`; a cycle is refused before startup.
   */
  get dependsOn(): readonly TChannelToken<TChannelDefinition, string>[] {
    return [];
  }

  readonly #namespace: TSelfNS;
  #entity: TEntity | null = null;

  // ─── Constructor ───────────────────────────────────────────────────────

  /**
   * Creates a Feature bound to the given namespace.
   *
   * Called only by `Application.start()`, which passes the manifest key.
   *
   * @throws `BonsaiNamespaceError` when the namespace is invalid or reserved.
   */
  constructor(namespace: TSelfNS) {
    // A class provided by the framework (static `framework`, e.g. the router) may take a reserved namespace.
    // The Application manifest still refuses a reserved key: only the Application instantiates it (I71).
    assertValidNamespace(namespace, { framework: (new.target as { framework?: boolean }).framework === true });
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
   */
  get namespace(): TSelfNS {
    return this.#namespace;
  }

  /**
   * Access to the Entity description and read methods (I6 — exclusive owner).
   * `protected`: only the Feature and its subclasses reach it. Its `state` is
   * readable only inside a handler; mutation goes through `ctx.mutate`.
   */
  protected get entity(): TEntity {
    if (this.#entity === null) {
      throw new Error(
        `[Bonsai Feature] "${this.#namespace}": the Entity exists only once the Feature is started by its Application (I94).`
      );
    }
    return this.#entity;
  }

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Hook called inside the startup unit, after the Entity exists (I56).
   * Override it in subclasses. It receives the same context as a handler.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onInit(_ctx: TFeatureContext<TChannelDef, TEntity>): void {
    // Default no-op — subclasses override
  }

  // ─── Framework description (internal) ──────────────────────────────────

  [DESCRIBE](): TManifestEntry {
    const namespace = this.#namespace;

    // I22 — 1:1 Entity creation through the Entity getter (ADR-09)
    const EntityCtor = this.Entity;
    const entity = new EntityCtor();
    this.#entity = entity;
    const definition = describeEntity(entity);

    const methods = this.#methodNames();
    this.#checkEntityHandlers(methods, definition.initial);

    const token = (this.constructor as { channel?: TChannelToken<TChannelDefinition> }).channel;
    const events = token?.events ?? [];

    const commands: Record<string, (payload: unknown, c: TUnitContext) => void> = {};
    const queries: Record<string, (params: unknown, c: TReadContext) => unknown> = {};
    const listens: Array<{ namespace: string; event: string; handler: (payload: unknown, c: TUnitContext) => void }> = [];
    const self = this as unknown as Record<string, (...args: unknown[]) => unknown>;

    // Handler auto-discovery (I48)
    for (const method of methods) {
      let match = method.match(/^on([A-Z][a-zA-Z]*)Command$/);
      if (match) {
        commands[lowerFirst(match[1]!)] = (payload, c) =>
          this.#run(c, () => self[method]!(payload, this.#featureContext(c)));
        continue;
      }
      match = method.match(/^on([A-Z][a-zA-Z]*)Query$/);
      if (match) {
        queries[lowerFirst(match[1]!)] = (params, c) =>
          this.#run(c, () => self[method]!(params, this.#queryContext(c)));
      }
    }

    // Subscriptions to the declared external Channels (C3, I2, I48)
    for (const external of this.listens) {
      const channelPascal = external.namespace[0]!.toUpperCase() + external.namespace.slice(1);
      const prefix = `on${channelPascal}`;
      for (const method of methods) {
        if (!method.startsWith(prefix) || !method.endsWith("Event")) continue;
        const eventPascal = method.slice(prefix.length, -"Event".length);
        if (eventPascal.length === 0) continue;
        listens.push({
          namespace: external.namespace,
          event: lowerFirst(eventPascal),
          handler: (payload, c) =>
            this.#run(c, () => self[method]!(payload, this.#featureContext(c)))
        });
      }
    }

    return {
      name: namespace,
      channel: { namespace, events, commands, queries },
      listens,
      locals: {
        [ENTITY_UPDATED]: (event, c) =>
          this.#run(c, () => this.#dispatchEntityEvent(event as TEntityEvent, this.#featureContext(c)))
      },
      entity: definition,
      init: (c) => this.#run(c, () => this.onInit(this.#featureContext(c))),
      dependsOn: this.dependsOn.map((t) => t.namespace)
    };
  }

  // ─── Private ───────────────────────────────────────────────────────────

  /**
   * Names of the methods declared on the concrete class and its ancestors up
   * to `Feature` (I48). A subclass that overrides one handler keeps those it
   * inherits; the most derived implementation is the one called.
   */
  #methodNames(): string[] {
    const names = new Set<string>();
    for (
      let proto = Object.getPrototypeOf(this) as object | null;
      proto !== null && proto !== Feature.prototype;
      proto = Object.getPrototypeOf(proto) as object | null
    ) {
      for (const name of Object.getOwnPropertyNames(proto)) names.add(name);
    }
    return [...names];
  }

  /**
   * Binds the Entity to the kernel's current state for the duration of a
   * handler, so that its read methods see the state of the running unit.
   */
  #run<R>(c: TReadContext, fn: () => R): R {
    const entity = this.#entity!;
    const restore = bindEntityState(entity, () => c.state());
    try {
      return fn();
    } finally {
      restore();
    }
  }

  #queryContext(c: TReadContext): TFeatureQueryContext {
    return {
      cause: c.cause,
      query: (token, name, params) =>
        c.query(token.namespace, name, params)
    };
  }

  #featureContext(c: TUnitContext): TFeatureContext<TChannelDef, TEntity> {
    const mutate = (
      intent: string,
      paramsOrRecipe: TMutationParams | TEntityRecipe<any>,
      maybeRecipe?: TEntityRecipe<any>
    ): TEntityEvent<any> | null => {
      const params = typeof paramsOrRecipe === "function" ? null : paramsOrRecipe;
      const recipe = typeof paramsOrRecipe === "function" ? paramsOrRecipe : maybeRecipe!;
      const change = c.mutate<any>(recipe);
      if (change === null) return null; // no-op: no notification
      const event: TEntityEvent<any> = {
        intent,
        payload: params?.payload,
        context: c.cause,
        // Keys derived from the first path segment of each patch (I97)
        changedKeys: [...new Set(change.patches.map((p) => String(p.path[0])))],
        patches: [...change.patches],
        inversePatches: [...change.inversePatches],
        previousState: change.previous,
        nextState: change.next,
        timestamp: Date.now()
      };
      // The notification is a deferred local message (G5, D8).
      c.local(ENTITY_UPDATED, event);
      return event;
    };
    return {
      ...this.#queryContext(c),
      emit: (event, payload) => c.emit(event, payload),
      mutate: mutate as TFeatureContext<TChannelDef, TEntity>["mutate"]
    };
  }

  /**
   * Runtime safety net: an `on<Key>EntityUpdated` method whose `<Key>`
   * matches no key of the Entity state → bootstrap error (I96).
   */
  #checkEntityHandlers(methods: string[], initial: TJsonSerializable): void {
    const stateKeys = new Set(Object.keys(initial as object));
    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)EntityUpdated$/);
      if (!match || match[1] === "Any") continue;
      const key = lowerFirst(match[1]!);
      hardInvariant(
        stateKeys.has(key),
        `Feature "${this.#namespace}" declares entity handler "${method}" for unknown key "${key}"`,
        "I96",
        this.#namespace
      );
    }
  }

  /**
   * Routes a `TEntityEvent` to the per-key handlers (alphabetical order of
   * `changedKeys`), then to the catch-all, when present (I96).
   */
  #dispatchEntityEvent(
    event: TEntityEvent,
    ctx: TFeatureContext<TChannelDef, TEntity>
  ): void {
    const self = this as unknown as Record<string, (...args: unknown[]) => void>;

    for (const key of [...event.changedKeys].sort()) {
      const handlerName = `on${key[0]!.toUpperCase()}${key.slice(1)}EntityUpdated`;
      if (typeof self[handlerName] !== "function") continue;
      const keyPatches = event.patches.filter((p) => String(p.path[0]) === key);
      const prev = (event.previousState as Record<string, unknown>)[key];
      const next = (event.nextState as Record<string, unknown>)[key];
      self[handlerName](prev, next, keyPatches, ctx);
    }

    if (typeof self["onAnyEntityUpdated"] === "function") {
      self["onAnyEntityUpdated"](event, ctx);
    }
  }
}
