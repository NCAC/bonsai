/**
 * @bonsai/feature — Types & runtime helpers
 *
 * Implements:
 *   - ADR-08: authority, uniqueness and conformity of Feature namespaces.
 *   - ADR-14: modular consumer contract — Feature-grouped `TFeatureContract`
 *     + flattening helpers (`TFlatListens`, `TFlatTriggers`, `TFlatRequests`)
 *     + payload extractors (`TEventPayloadFor`, `TCommandPayloadFor`,
 *     `TRequestParamsFor`, `TRequestResultFor`) + `TChannelCallbacks`
 *     (required handlers derived from the contract).
 *
 * This module has three roles:
 *   1. Compile-time types (`CamelCaseNamespace<S>`, `StrictManifest<M>`,
 *      `ValidatedManifest<M>`) encoding invariants I68–I72.
 *   2. The framework constant `RESERVED_NAMESPACES` (I71) — not configurable
 *      by the application.
 *   3. A runtime safety net (`assertValidNamespace`, `BonsaiNamespaceError`)
 *      for when compile-time checks are bypassed (`as any` cast, plain JS,
 *      dynamic manifest).
 *
 * Invariants covered:
 *   I21          — unique, flat camelCase namespace
 *   I24          — Application validates format + reserved names at bootstrap
 *   I57          — `local` is reserved (ADR-17)
 *   I68          — the namespace is carried by the manifest, not by a `static`
 *   I69          — the manifest is the single source of truth for identity
 *   I70          — every reference to an external namespace MUST be validated
 *   I71          — `RESERVED_NAMESPACES` is a framework constant
 *   I72          — `TSelfNS` must match the manifest key
 *   I81 (ADR-14) — `get features()` is the runtime source of truth
 *   I82 (ADR-14) — `implements TViewCallbacks<TVC>` enforces the handlers
 *   I83 (ADR-14) — reusable modular `T{Component}Contract` pattern
 *   I87 (ADR-14) — object key ≡ namespace of the referenced Feature
 *   I88 (ADR-14) — Contract/Callbacks symmetry
 *
 * @packageDocumentation
 */

import type { Entity, TJsonSerializable } from "@bonsai/entity";
import type { TChannelDefinition, TChannelToken } from "@bonsai/event";
import type { CamelCase, UnionToIntersection } from "@bonsai/types";
import type { Feature } from "./bonsai-feature";

// ─── Reserved words (I71, ADR-17) ─────────────────────────────────────────

/**
 * Namespaces reserved by the framework — forbidden to application Features.
 *
 *   - `local`  : localState key in namespaced data (I57, ADR-17)
 *   - `router` : framework navigation Feature, instantiated by Application (I28, ADR-13)
 *
 * Non-configurable framework constant. Any future extension changes this
 * constant and propagates through the derived types (I71).
 */
export const RESERVED_NAMESPACES = ["local", "router"] as const;

/** Union of the reserved namespaces (derived from the constant). */
export type ReservedNamespace = (typeof RESERVED_NAMESPACES)[number];

// ─── Compile-time camelCase enforcement ─────────────────────────────────────

/**
 * Local alias of `CamelCase` (ADR-08 — `CamelCaseNamespace<S>`).
 *
 * The generic type lives in `@bonsai/types` (reusable). This alias makes its
 * role explicit in the "Feature namespace" context, as named by the ADR.
 */
export type CamelCaseNamespace<S extends string> = CamelCase<S>;

// ─── Manifest types (ADR-08) ────────────────────────────────────

/**
 * Manifest filter: drops reserved keys at compile time.
 *
 * `ValidatedManifest<M>` removes the entries whose key is in
 * `RESERVED_NAMESPACES`. Combined with `StrictManifest<M>`, it guarantees no
 * application Feature takes a framework namespace.
 */
export type ValidatedManifest<M> = {
  [K in keyof M as K extends ReservedNamespace ? never : K]: M[K];
};

/**
 * Structural type of the application value-manifest.
 *
 * For each key `K` of the type-manifest `M`:
 *   - `K` must be flat camelCase (otherwise `never` → `satisfies` error)
 *   - `K` must not be reserved (otherwise `never`)
 *   - The value must be a constructor taking `K` as namespace AND producing
 *     a `Feature<any, K>` — this is what forces `TSelfNS === K` at compile
 *     time (I72).
 *
 * Application-side usage:
 *
 * ```ts
 * const features = {
 *   cart: CartFeature,        // ✅
 *   user: UserFeature,        // ✅
 *   // local: BadFeature,     // ❌ never (reserved)
 *   // Cart: CartFeature,     // ❌ never (PascalCase)
 *   // user: CartFeature,     // ❌ TSelfNS "cart" ≠ "user"
 * } satisfies StrictManifest<AppManifest>;
 * ```
 */

/**
 * Compile-time constraint on a Feature class that can be registered in a manifest.
 *
 * Requires (ADR-09, I95):
 *   - A `(namespace: TNS) => Feature<…, TDef, TNS>` constructor — forces
 *     `TSelfNS === TNS` (I72).
 *   - A static `channel: TChannelToken<TDef, TNS>` member — presence AND
 *     `channel.namespace === TNS` alignment at compile time (I73/I74/I22).
 *
 * **Handler coverage is NOT enforced here** (ADR-09): a type-only manifest
 * with `unknown` values (ADR-08) cannot yield `TDef` per key, so no handler
 * inference is possible at the manifest. Coverage is guaranteed by I92
 * (`implements TFeatureCallbacks` on each class — same as View, ADR-14),
 * strictly at compile time: unlike View (I82), there is no runtime safety
 * net on the Feature side — see feature.md §3bis.
 *
 * @example
 * ```ts
 * // ✅ CartFeature satisfies TStrictFeatureClass<"cart">
 * // ❌ Class without a static channel → compile error
 * // ❌ channel.namespace ≠ "cart" → compile error
 * ```
 */
export type TStrictFeatureClass<
  TNS extends string,
  TDef extends TChannelDefinition = TChannelDefinition
> = (new (
  namespace: TNS
) => Feature<Entity<TJsonSerializable>, TDef, TNS>) & {
  readonly channel: TChannelToken<TDef, TNS>;
};

export type StrictManifest<M> = {
  [K in keyof M & string]: K extends CamelCaseNamespace<K>
    ? K extends ReservedNamespace
      ? never
      : TStrictFeatureClass<K, TChannelDefinition>
    : never;
};

// ─── Typed error (ADR-08 — runtime safety net) ──────────────────

/**
 * Stable error codes for namespace invariant violations.
 *
 * `NAMESPACE_DUPLICATE` is theoretically impossible with a manifest (TS1117
 * catches it), but the runtime safety net still raises it in case the
 * manifest is built dynamically.
 */
export type TBonsaiNamespaceErrorCode =
  | "NAMESPACE_INVALID_FORMAT"
  | "NAMESPACE_RESERVED"
  | "NAMESPACE_DUPLICATE"
  | "NAMESPACE_UNKNOWN_REFERENCE"
  | "FEATURE_MISSING_CHANNEL"
  | "FEATURE_CHANNEL_NAMESPACE_MISMATCH";

/**
 * Typed error for any violation detected at runtime.
 *
 * Belongs to the framework error family (ADR-05). Codes are stable and
 * meant to be matched by consumers.
 */
export class BonsaiNamespaceError extends Error {
  readonly code: TBonsaiNamespaceErrorCode;

  constructor(code: TBonsaiNamespaceErrorCode, message: string) {
    super(`[Bonsai] ${code}: ${message}`);
    this.name = "BonsaiNamespaceError";
    this.code = code;
  }
}

// ─── Runtime safety net ─────────────────────────────────────────────────────

const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z]*$/;

// ─── Modular consumer pattern (ADR-14) ────────────────────────────────────

/**
 * Minimal structural constraint on any Feature a consumer component
 * (View, Composer, Behavior) can reference.
 *
 * In practice `typeof CartFeature` (a constructor with `static readonly channel`)
 * satisfies it. The Channel stays private — only its token is exposed.
 *
 * I80 — no consumer references `TChannelToken` directly.
 */
export type TFeatureRef<
  TDef extends TChannelDefinition = TChannelDefinition,
  TNS extends string = string
> = { readonly channel: TChannelToken<TDef, TNS> };

/**
 * `TFeatureRef` constrained to a given namespace (ADR-14, I87).
 *
 * Used by `TFeatureContract` so that the object key (`cart`, `user`) matches
 * the namespace of the referenced Feature:
 *
 * ```ts
 * const features = {
 *   cart: { feature: UserFeature, ... },  // "cart" ≠ "user"
 * } satisfies TFeatureContract;
 * ```
 *
 * Known gap (ADR-14): TypeScript does not check the index signature per key
 * at the `satisfies`; the mismatch is only rejected at use sites, where the
 * extractors resolve to `never`.
 */
export type TFeatureRefForNS<NS extends string> = TFeatureRef<
  TChannelDefinition,
  NS
>;

/**
 * Feature contract module — Feature-grouped (ADR-14).
 *
 * One entry per consumed Feature. The object key MUST match the namespace of
 * the Feature referenced by `feature` (`TFeatureRefForNS<NS>` — I87).
 *
 * For each Feature:
 *   - `feature`  : runtime ref (`typeof XxxFeature`) — channel/events/
 *                  commands/requests are extracted through its token
 *   - `listens`  : event names without namespace prefix (the key IS the NS)
 *   - `triggers` : command names without namespace prefix
 *   - `requests` : request names without namespace prefix
 *
 * Known gap (ADR-14): the three lists are typed `readonly string[]`, so a
 * typo is not caught here. In `triggers`/`requests` it surfaces at the call
 * site (payload `never`); in `listens` it compiles and the handler is never
 * called.
 *
 * Usage:
 *
 * ```ts
 * const cartViewFeatures = {
 *   cart: {
 *     feature:  CartFeature,
 *     listens:  ["itemAdded"]  as const,
 *     triggers: ["addItem"]    as const,
 *     requests: []             as const,
 *   },
 *   user: {
 *     feature:  UserFeature,
 *     listens:  ["profileUpdated"] as const,
 *     triggers: []                 as const,
 *     requests: ["getProfile"]     as const,
 *   },
 * } satisfies TFeatureContract;
 * ```
 *
 * I81 — runtime source of truth of the consumer component.
 * I83 — module reused by View / Composer / Behavior.
 * I87 — key ≡ namespace (checked at use sites).
 */
export type TFeatureContract = {
  readonly [NS in string]: {
    readonly feature: TFeatureRefForNS<NS>;
    readonly listens: readonly string[];
    readonly triggers: readonly string[];
    readonly requests: readonly string[];
  };
};

// ─── Flattening helpers (flat prefixed keys) ─────────────────────────────────

/**
 * Flattens every `listens` of the contract into a union of `"ns:event"` keys.
 *
 * @example
 *   TFlatListens<{ cart: { listens: ["itemAdded"] }; user: { listens: ["profileUpdated"] } }>
 *   → "cart:itemAdded" | "user:profileUpdated"
 */
export type TFlatListens<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["listens"][number] extends infer E
    ? E extends string
      ? `${NS}:${E}`
      : never
    : never;
}[keyof F & string];

/** Flattens every `triggers` into a union of `"ns:cmd"` keys. */
export type TFlatTriggers<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["triggers"][number] extends infer C
    ? C extends string
      ? `${NS}:${C}`
      : never
    : never;
}[keyof F & string];

/** Flattens every `requests` into a union of `"ns:req"` keys. */
export type TFlatRequests<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["requests"][number] extends infer R
    ? R extends string
      ? `${NS}:${R}`
      : never
    : never;
}[keyof F & string];

// ─── Payload extractors from a flat prefixed key ────────────────────────────

/**
 * Payload of an event from a `"ns:event"` key and the Feature contract.
 *
 * Resolution:
 *   1. Splits `K` into `${NS}:${E}` with a template literal.
 *   2. Extracts the Channel definition `D` through the static token.
 *   3. Reads `D["events"][E]`.
 */
export type TEventPayloadFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer E}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? E extends keyof D["events"]
        ? D["events"][E]
        : never
      : never
    : never
  : never;

/** Payload of a command from a `"ns:cmd"` key. */
export type TCommandPayloadFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer C}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? C extends keyof D["commands"]
        ? D["commands"][C]
        : never
      : never
    : never
  : never;

/** Params of a request from a `"ns:req"` key. */
export type TRequestParamsFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer R}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? R extends keyof D["requests"]
        ? D["requests"][R]["params"]
        : never
      : never
    : never
  : never;

/** Result of a request from a `"ns:req"` key. */
export type TRequestResultFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer R}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? R extends keyof D["requests"]
        ? D["requests"][R]["result"]
        : never
      : never
    : never
  : never;

// ─── Channel handlers (I48 channel) ──────────────────────────────────────────

/**
 * Derives the channel handler name from a namespace + event name.
 * I48 channel convention: `on{NS}{EventName}Event` (the `Event` suffix
 * avoids collisions with DOM handlers, ADR-14).
 *
 * @example
 *   TChannelHandlerName<"cart", "itemAdded">  → "onCartItemAddedEvent"
 */
export type TChannelHandlerName<
  NS extends string,
  E extends string
> = `on${Capitalize<NS>}${Capitalize<E>}Event`;

/**
 * Channel handlers REQUIRED by a `TFeatureContract` — one per event declared
 * in each Feature's `listens`.
 *
 * Contract/Callbacks symmetry (ADR-14, I88): for every entry of
 * `features[NS].listens`, the compiler requires an `on{NS}{EventName}Event`
 * method with the exact `(payload) => void` signature.
 *
 * The payload is resolved through `TEventPayloadFor`, typed by the Feature's
 * `TChannelDefinition`.
 *
 * No `metas` parameter yet: a second `metas: TMessageMetas` parameter comes
 * with stratum 1b (ADR-04).
 */
export type TChannelCallbacks<F extends TFeatureContract> = UnionToIntersection<
  {
    [NS in keyof F & string]: {
      [E in F[NS]["listens"][number] as TChannelHandlerName<NS, E & string>]: (
        payload: TEventPayloadFor<F, `${NS}:${E & string}`>
      ) => void;
    };
  }[keyof F & string]
>;

// ─── Feature callbacks (ADR-09 — I88 symmetry extended to Feature) ──

/**
 * Command handlers REQUIRED by a concrete Feature.
 *
 * I48 command convention: `on{Cmd}Command` (`Command` suffix).
 * For each command `K ∈ keyof TDef["commands"]`, requires the method
 * `onKCommand(payload: TDef["commands"][K]): void`.
 *
 * @example
 *   TCommandCallbacks<{ commands: { addItem: { productId: string } }; ... }>
 *   → { onAddItemCommand(payload: { productId: string }): void }
 */
export type TCommandCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["commands"] & string as `on${Capitalize<K>}Command`]: (
    payload: TDef["commands"][K]
  ) => void;
};

/**
 * Request handlers REQUIRED by a concrete Feature.
 *
 * I48 request convention: `on{Req}Request` (`Request` suffix).
 * For each request `K ∈ keyof TDef["requests"]`, requires the method
 * `onKRequest(params: TDef["requests"][K]["params"]): TDef["requests"][K]["result"]`.
 */
export type TRequestCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["requests"] & string as `on${Capitalize<K>}Request`]: (
    params: TDef["requests"][K]["params"]
  ) => TDef["requests"][K]["result"];
};

/**
 * Listen handlers REQUIRED for each token of `TListens[number]`.
 *
 * I48 channel convention: `on{NS}{EventName}Event` — the namespace prefix
 * tells events of distinct Channels apart (no collision).
 *
 * **`UnionToIntersection` is REQUIRED** (see ADR-09).
 * Without it, the distributive conditional yields a union of objects
 * `{ …cart } | { …wishlist }` that TS rejects as an `implements` target
 * (TS2422). `UnionToIntersection` merges them into an intersection usable
 * as an `implements` target.
 */
export type TListenCallbacks<
  TListens extends readonly TChannelToken<TChannelDefinition, string>[]
> = UnionToIntersection<
  TListens[number] extends infer Tok
    ? Tok extends TChannelToken<infer DEF, infer NS>
      ? {
          [E in keyof DEF["events"] &
            string as `on${Capitalize<NS & string>}${Capitalize<E>}Event`]: (
            payload: DEF["events"][E]
          ) => void;
        }
      : never
    : never
>;

/**
 * Compile-time enforcement type for the handlers of a concrete Feature.
 *
 * Contract/Callbacks symmetry (ADR-09, I88, I92):
 * `implements TFeatureCallbacks<TDef, TListens>` makes the compiler require
 * the presence and exact signature of ALL derived handlers:
 *   - `onXxxCommand`        for each `K ∈ keyof TDef["commands"]`
 *   - `onXxxRequest`        for each `K ∈ keyof TDef["requests"]`
 *   - `on{NS}{Evt}Event`    for each `(token, event) ∈ TListens`
 *
 * Missing handler → TS2515; wrong signature → TS2416.
 *
 * @example
 * ```ts
 * class CartFeature
 *   extends Feature<CartEntity, TCartChannelDef, "cart">
 *   implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
 * { … }
 * ```
 */
export type TFeatureCallbacks<
  TDef extends TChannelDefinition,
  TListens extends readonly TChannelToken<TChannelDefinition, string>[] =
    readonly []
> = TCommandCallbacks<TDef> &
  TRequestCallbacks<TDef> &
  TListenCallbacks<TListens>;

// ─── Runtime safety net ─────────────────────────────────────────────────────

/** Runtime camelCase format check. */
export function isCamelCaseNamespace(ns: string): boolean {
  return CAMEL_CASE_REGEX.test(ns);
}

/** Runtime reserved-name check. */
export function isReservedNamespace(ns: string): ns is ReservedNamespace {
  return (RESERVED_NAMESPACES as readonly string[]).includes(ns);
}

/**
 * Safety net — checks format + reservation at runtime.
 *
 * Called by the `Feature` constructor (immutable from construction) and by
 * `Application.start()` (whole-manifest validation). Throws
 * `BonsaiNamespaceError` with a stable code.
 */
export function assertValidNamespace(ns: string): void {
  if (typeof ns !== "string" || ns.length === 0) {
    throw new BonsaiNamespaceError(
      "NAMESPACE_INVALID_FORMAT",
      `Namespace must be a non-empty string, received: ${String(ns)}`
    );
  }
  if (!isCamelCaseNamespace(ns)) {
    throw new BonsaiNamespaceError(
      "NAMESPACE_INVALID_FORMAT",
      `Namespace "${ns}" must be camelCase (lowercase first letter, letters only)`
    );
  }
  if (isReservedNamespace(ns)) {
    throw new BonsaiNamespaceError(
      "NAMESPACE_RESERVED",
      `Namespace "${ns}" is reserved by the framework`
    );
  }
}
