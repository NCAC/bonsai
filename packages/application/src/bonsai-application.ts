/**
 * @bonsai/application — Application class
 *
 * Capabilities (ADR-07, ADR-08, ADR-09):
 *   - constructor({ foundation, features }) — declares the application manifest
 *   - start() — phased bootstrap:
 *       Phase 0a: namespace format validation (assertValidNamespace)
 *       Phase 0b: pure instantiation of the Features (inert ctor — I94) + sentinel
 *       Phase 0c: read instance.listens/queries — cross-reference validation (I70)
 *       Phase 1: Channels (one channel per Feature)
 *       Phase 3: Features (bootstrap() — Entity, handlers, onInit() — on the Phase 0b instances)
 *       Phase 4: Foundation (composers → views, attach)
 *
 * Invariants:
 *   I23  — Application is dormant at runtime (no handle/emit/listen/request)
 *   I21  — The manifest guarantees uniqueness at compile time; Application
 *          validates format, reserved names and `channel` consistency at bootstrap
 *   I33  — An Application without a Foundation cannot render anything
 *   I56  — Every Feature's onInit() runs before the Foundation is created
 *   I68  — The namespace is carried by the manifest, not by a static (ADR-08)
 *   I69  — The manifest is the single source of truth for identity (ADR-08)
 *   I70  — Every reference to an external namespace MUST be validated against
 *          the manifest — read from instance.listens/queries (ADR-09)
 *   I71  — `RESERVED_NAMESPACES` is a framework constant (ADR-08)
 *   I94  — The Feature constructor is inert: the Phase 0b sentinel detects
 *          any unexpected Radio side effect (ADR-09)
 *
 * Not delivered yet:
 *   - stop()
 *   - SSR (serverState)
 *   - DevTools
 *   - ESM BonsaiRegistry
 *
 * @packageDocumentation
 */

import {
  Radio,
  type TChannelDefinition,
  type TChannelToken
} from "@bonsai/event";
import {
  Feature,
  BonsaiNamespaceError,
  assertValidNamespace
} from "@bonsai/feature";
import { Foundation } from "@bonsai/foundation";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Application Features manifest — loose structural type accepted at runtime
 * by `Application`. Strict consistency (camelCase, reserved words,
 * `TSelfNS ↔ key` agreement) is enforced on the caller side by
 * `StrictManifest<M>` through `satisfies` (see ADR-08 and `@bonsai/feature/types`).
 *
 * Application only needs here:
 *   - `string` keys (the namespaces)
 *   - values = `(namespace) => Feature` constructors
 *
 * Strict typing of the application manifest lives in `@bonsai/feature`.
 */
export type TFeaturesManifest = Readonly<
  Record<string, new (namespace: string) => Feature<any, any, any>>
>;

/**
 * Application constructor options.
 *
 * - `foundation`: concrete Foundation class (required by `start()` — throws
 *   otherwise, I33).
 * - `features`: application manifest (key = namespace, value = Feature class).
 *   Compile-time validation happens on the caller side through
 *   `satisfies StrictManifest<AppManifest>`; Application only runs a runtime
 *   safety net in `start()`.
 */
export type TApplicationOptions<
  M extends TFeaturesManifest = TFeaturesManifest
> = {
  readonly foundation?: typeof Foundation;
  readonly features?: M;
};

// ─── Application class ───────────────────────────────────────────────────────

export class Application<M extends TFeaturesManifest = TFeaturesManifest> {
  readonly #manifest: M;
  #started = false;
  #foundationClass: typeof Foundation | null;
  #foundationInstance: Foundation | null = null;
  #featureInstances: Feature<any, any, any>[] = [];

  constructor(options?: TApplicationOptions<M>) {
    this.#foundationClass = options?.foundation ?? null;
    this.#manifest = options?.features ?? ({} as M);
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Phased bootstrap (ADR-07, ADR-09). Can only be called once.
   *
   * Phases:
   *   Phase 0a — namespace format validation (assertValidNamespace + I73/I22)
   *   Phase 0b — pure instantiation (inert ctor, I94) + Radio sentinel
   *   Phase 0c — read instance.listens/queries — reference validation (I70)
   *   Phase 1  — Channels  : `Radio.channel(namespace)` for each Feature
   *   Phase 3  — Features  : `bootstrap()` on the Phase 0b instances (I56)
   *   Phase 4  — Foundation: `Foundation.attach()` (Composers → Views)
   *
   * @throws when called twice (no re-bootstrap)
   * @throws `BonsaiNamespaceError` when the manifest breaks the invariants
   *   (runtime safety net — compile time should already have caught it
   *   through `StrictManifest<M>`).
   * @throws when no Foundation was given to the constructor (I33).
   */
  start(): void {
    if (this.#started) {
      throw new Error("[Bonsai Application] Cannot start() — already started");
    }
    if (this.#foundationClass === null) {
      throw new Error(
        "[Bonsai Application] Cannot start() — no Foundation provided. " +
          "Pass { foundation: MyFoundation } to the Application constructor (I33)."
      );
    }

    // ── Phase 0a — format + channel validation (ADR-08 — I70/I71/I73) ───
    this.#validateManifest();

    this.#started = true;

    const entries = Object.entries(this.#manifest) as Array<
      [string, new (namespace: string) => Feature<any, any>]
    >;

    // ── Phase 0b — pure instantiation + I94 sentinel ─────────────────────────
    // The Feature ctor is inert (I94): assertValidNamespace + #namespace.
    // Sentinel: no Channel may be created/removed in Radio during `new`.
    for (const [namespace, FeatureClass] of entries) {
      const nssBefore = Radio.me().getChannelNames();
      const instance = new FeatureClass(namespace);
      const nssAfter = Radio.me().getChannelNames();
      if (nssBefore.length !== nssAfter.length) {
        throw new Error(
          `[Bonsai Application] Feature "${namespace}" constructor is not inert —` +
            ` Radio was mutated during new ${FeatureClass.name}("${namespace}").` +
            ` Move all Radio/Entity calls out of the constructor (I94 — ADR-09).`
        );
      }
      this.#featureInstances.push(instance);
    }

    // ── Phase 0c — cross-reference validation from the instances (I70) ───
    // listens + queries read from the instances (abstract get — I93).
    // Runs BEFORE Phase 1 (Channel creation) — no Radio side effect.
    const known = new Set(entries.map(([ns]) => ns));
    for (let i = 0; i < entries.length; i++) {
      const [ownNs] = entries[i]!;
      const instance = this.#featureInstances[i]!;
      const refs = [...instance.listens, ...instance.queries].map(
        (t) => t.namespace
      );
      for (const ref of refs) {
        if (!known.has(ref)) {
          throw new BonsaiNamespaceError(
            "NAMESPACE_UNKNOWN_REFERENCE",
            `Feature "${ownNs}" declares unknown channel "${ref}". ` +
              `Known namespaces: ${[...known].join(", ")}`
          );
        }
      }
    }

    // Phase 1: Channels — creates each Feature's channel in Radio
    for (const [namespace] of entries) {
      Radio.me().channel(namespace);
    }

    // Phase 3: Features — bootstrap the Phase 0b instances
    // (auto-discovery handlers I48, entity, onInit I56)
    for (const instance of this.#featureInstances) {
      instance.bootstrap();
    }

    // Phase 4: Views — Foundation → Composers → Views
    const FoundationClass = this
      .#foundationClass as unknown as new () => Foundation;
    this.#foundationInstance = new FoundationClass();
    this.#foundationInstance.attach();
  }

  /** The instantiated Foundation (after start). */
  get foundation(): Foundation | null {
    return this.#foundationInstance;
  }

  /** Whether the application has started. */
  get started(): boolean {
    return this.#started;
  }

  // ─── Private — runtime safety net (ADR-08) ─────────────────

  /**
   * Validates the manifest before any side effect. Safety net — most of these
   * violations are already caught at compile time by `StrictManifest<M>` on
   * the caller side. Still useful for `as any` casts, dynamic manifests and
   * plain JS.
   *
   * Checks (Phase 0a):
   *   - camelCase format of each key (I21)
   *   - no reserved key (I57, I71)
   *   - each Feature class exposes a `static readonly channel` (I73, ADR-14)
   *   - `channel.namespace` matches the manifest key (I22, I73)
   *
   * Note: `listens`/`queries` cross-references are validated in Phase 0c
   * (read from the instances — ADR-09 — I70/I93).
   */
  #validateManifest(): void {
    const namespaces = Object.keys(this.#manifest);

    // I21/I57/I71 — delegates to assertValidNamespace
    for (const ns of namespaces) {
      assertValidNamespace(ns);
    }

    // I73 — each Feature MUST expose `static readonly channel`
    // I22 — channel.namespace must match the manifest key
    type TWithChannel = {
      channel?: TChannelToken<TChannelDefinition>;
    };
    for (const [ownNs, FeatureClass] of Object.entries(this.#manifest)) {
      const cls = FeatureClass as unknown as TWithChannel;
      const token = cls.channel;
      if (
        token === undefined ||
        token === null ||
        typeof token !== "object" ||
        typeof (token as { namespace?: unknown }).namespace !== "string"
      ) {
        throw new BonsaiNamespaceError(
          "FEATURE_MISSING_CHANNEL",
          `Feature "${ownNs}" does not declare \`static readonly channel: ` +
            `TChannelToken<TDef, "${ownNs}">\` (I73 — ADR-14). Add ` +
            `\`static readonly channel = { namespace: "${ownNs}" }\` ` +
            `to the class.`
        );
      }
      if (token.namespace !== ownNs) {
        throw new BonsaiNamespaceError(
          "FEATURE_CHANNEL_NAMESPACE_MISMATCH",
          `Feature registered under "${ownNs}" declares ` +
            `channel.namespace="${token.namespace}" — must match the manifest ` +
            `key (I22, I73). The channel token namespace and the manifest key ` +
            `are the authoritative identity of the Feature.`
        );
      }
    }
  }
}
