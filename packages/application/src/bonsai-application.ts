/**
 * @bonsai/application — Application class
 *
 * Capabilities (ADR-07, ADR-08, ADR-09):
 *   - constructor({ features, components?, causalBound? }) — declares the application manifest
 *   - start() — phased bootstrap on the communication kernel (migration lot M6.1):
 *       Phase 0a: namespace format validation (assertValidNamespace)
 *       Phase 0b: pure instantiation of the Features (inert ctor — I94)
 *       Phase 0c: read instance.listens/queries — cross-reference validation (I70)
 *       Phase 1: kernel startup — one `Root` per Application (G6); the Features
 *                become its children in an order that respects their initial
 *                Query dependencies (`queries`, C.1); each creates its Entity,
 *                registers its handlers and runs `onInit()` inside the startup
 *                unit (§2.5, I56)
 *       (Foundation → Composers → Views: not wired yet — lot M6.2)
 *
 * Invariants:
 *   I23  — Application is dormant at runtime (no handle/emit/listen/request)
 *   I21  — The manifest guarantees uniqueness at compile time; Application
 *          validates format, reserved names and `channel` consistency at bootstrap
 *   I33  — An Application without a Foundation cannot render anything
 *          (not enforced during lot M6.1: the Foundation is not wired yet)
 *   I56  — Every Feature's onInit() runs before the Foundation is created
 *   I68  — The namespace is carried by the manifest, not by a static (ADR-08)
 *   I69  — The manifest is the single source of truth for identity (ADR-08)
 *   I70  — Every reference to an external namespace MUST be validated against
 *          the manifest — read from instance.listens/queries (ADR-09)
 *   I71  — `RESERVED_NAMESPACES` is a framework constant (ADR-08)
 *   I94  — The Feature constructor is inert: it creates no Entity and
 *          touches no kernel; everything happens at startup (ADR-09)
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
  Root,
  type TChannelDefinition,
  type TChannelToken,
  type TManifestEntry
} from "@bonsai/event";
import {
  Feature,
  BonsaiNamespaceError,
  assertValidNamespace,
  describeFeature
} from "@bonsai/feature";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Application Features manifest — loose structural type accepted at runtime
 * by `Application`. Strict consistency (camelCase, reserved words,
 * `TSelfNS ↔ key` agreement) is enforced on the caller side by
 * `StrictManifest<M>` through `satisfies` (see ADR-08 and `@bonsai/feature/types`).
 */
export type TFeaturesManifest = Readonly<
  Record<string, new (namespace: string) => Feature<any, any, any>>
>;

/**
 * Application constructor options.
 *
 * - `features`: application manifest (key = namespace, value = Feature class).
 *   Compile-time validation happens on the caller side through
 *   `satisfies StrictManifest<AppManifest>`; Application only runs a runtime
 *   safety net in `start()`.
 * - `components`: other children of the root, created after the Features
 *   (the Foundation and the adapters, from lot M6.2 on; probes in tests).
 * - `causalBound`: the bound on causal chains fixed by the Manifest (D9).
 *   Default 50.
 */
export type TApplicationOptions<
  M extends TFeaturesManifest = TFeaturesManifest
> = {
  readonly features?: M;
  readonly components?: readonly TManifestEntry[];
  readonly causalBound?: number;
};

// ─── Application class ───────────────────────────────────────────────────────

export class Application<M extends TFeaturesManifest = TFeaturesManifest> {
  readonly #manifest: M;
  readonly #components: readonly TManifestEntry[];
  readonly #causalBound: number;
  #started = false;
  #root: Root | null = null;
  #featureInstances: Feature<any, any, any>[] = [];

  constructor(options?: TApplicationOptions<M>) {
    this.#manifest = options?.features ?? ({} as M);
    this.#components = options?.components ?? [];
    this.#causalBound = options?.causalBound ?? 50;
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Phased bootstrap (ADR-07, ADR-09). Can only be called once.
   *
   * @throws when called twice (no re-bootstrap)
   * @throws `BonsaiNamespaceError` when the manifest breaks the invariants
   *   (runtime safety net — compile time should already have caught it
   *   through `StrictManifest<M>`).
   * @throws `ManifestError` when the initial Query dependencies are cyclic (C.1).
   * @throws `StartupError` when a Feature fails during startup: the model
   *   under construction is abandoned (§2.5).
   */
  start(): void {
    if (this.#started) {
      throw new Error("[Bonsai Application] Cannot start() — already started");
    }

    // ── Phase 0a — format + channel validation (ADR-08 — I70/I71/I73) ───
    this.#validateManifest();

    this.#started = true;

    const entries = Object.entries(this.#manifest) as Array<
      [string, new (namespace: string) => Feature<any, any>]
    >;

    // ── Phase 0b — pure instantiation ───────────────────────────────────
    // The Feature ctor is inert (I94): assertValidNamespace + #namespace.
    for (const [namespace, FeatureClass] of entries) {
      this.#featureInstances.push(new FeatureClass(namespace));
    }

    // ── Phase 0c — cross-reference validation from the instances (I70) ───
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

    // ── Phase 1 — kernel startup (§2.5, C.1) ─────────────────────────────
    this.#root = new Root({ causalBound: this.#causalBound });
    this.#root.startFromManifest([
      ...this.#featureInstances.map((instance) => describeFeature(instance)),
      ...this.#components
    ]);
  }

  /** The communication root (one per Application, G6); `null` before start(). */
  get root(): Root | null {
    return this.#root;
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
