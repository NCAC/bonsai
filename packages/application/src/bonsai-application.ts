/**
 * @bonsai/application — Application class
 *
 * Capabilities (ADR-07, ADR-08, ADR-09):
 *   - constructor({ features, components?, causalBound? }) — declares the application manifest
 *   - start() — phased bootstrap on the communication kernel (migration lot M6.1):
 *       Phase 0a: namespace format validation (assertValidNamespace)
 *       Phase 0b: pure instantiation of the Features (inert ctor — I94)
 *       Phase 0c: read instance.listens/queries/dependsOn — cross-reference validation (I70)
 *       Phase 1: kernel startup — one `Root` per Application (G6); the Features
 *                become its children in an order that respects their initial
 *                initial dependencies (`dependsOn`, C.1); each creates its Entity,
 *                registers its handlers and runs `onInit()` inside the startup
 *                unit (§2.5, I56)
 *       Then the Foundation (if any), which creates its Composers, which
 *       create the Views (lot M6.2)
 *
 * Invariants:
 *   I23  — Application is dormant at runtime (no handle/emit/listen/request)
 *   I21  — The manifest guarantees uniqueness at compile time; Application
 *          validates format, reserved names and `channel` consistency at bootstrap
 *   I33  — An Application without a Foundation cannot render anything
 *          (still not enforced: the Foundation stays optional — a headless
 *          Application is legitimate in tests)
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
  describeComponent,
  type TChannelDefinition,
  type TChannelToken,
  type TManifestEntry
} from "@bonsai/kernel";
import {
  Feature,
  BonsaiNamespaceError,
  assertValidNamespace,
  describeFeature
} from "@bonsai/feature";
import type { Foundation } from "@bonsai/foundation";
import { RouterFeature } from "@bonsai/router";

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
 * - `foundation`: the root of the visual tree. Created after the Features
 *   (I56), it admits the `anchor` and creates its Composers (lot M6.2).
 * - `document`: host document the Foundation's anchor is resolved in.
 *   Required with a `foundation`.
 * - `anchor`: selector of the distributable resource the Foundation admits.
 *   Default `"body"`.
 * - `router`: activates the Feature of navigation (D15), namespace `router`
 *   (reserved: it is not declared among `features`).
 * - `adapters`: built-in adapters of the host (D7, annex B), one per category
 *   (B.2). They are created after the Features and before the Foundation, and
 *   need `document`. A class lists the namespaces it requires (`requires`).
 * - `causalBound`: the bound on causal chains fixed by the Manifest (D9).
 *   Default 50.
 */
export type TApplicationOptions<
  M extends TFeaturesManifest = TFeaturesManifest
> = {
  readonly features?: M;
  readonly components?: readonly TManifestEntry[];
  readonly foundation?: new () => Foundation;
  readonly document?: Document;
  readonly anchor?: string;
  readonly router?: boolean;
  readonly adapters?: readonly TAdapterClass[];
  /** Serializable creation parameters of the adapters, by category (Manifest, 16.9). */
  readonly adapterOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly causalBound?: number;
};

/** A built-in adapter class: a category, the namespaces it needs, and its description for the kernel. */
export type TAdapterClass = (new () => object) & {
  readonly category: string;
  readonly requires?: readonly string[];
};

// ─── Application class ───────────────────────────────────────────────────────

export class Application<M extends TFeaturesManifest = TFeaturesManifest> {
  readonly #manifest: M;
  readonly #components: readonly TManifestEntry[];
  readonly #causalBound: number;
  readonly #foundation: (new () => Foundation) | null;
  readonly #document: Document | undefined;
  readonly #anchor: string | undefined;
  readonly #router: boolean;
  readonly #adapters: readonly TAdapterClass[];
  readonly #adapterOptions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly #stop = new AbortController();
  #started = false;
  #root: Root | null = null;
  #featureInstances: Feature<any, any, any>[] = [];

  constructor(options?: TApplicationOptions<M>) {
    this.#manifest = options?.features ?? ({} as M);
    this.#components = options?.components ?? [];
    this.#causalBound = options?.causalBound ?? 50;
    this.#foundation = options?.foundation ?? null;
    this.#document = options?.document;
    this.#anchor = options?.anchor;
    this.#router = options?.router ?? false;
    this.#adapters = options?.adapters ?? [];
    this.#adapterOptions = options?.adapterOptions ?? {};
    if (this.#foundation !== null && this.#document === undefined) {
      throw new Error("[Bonsai Application] a `foundation` needs the host `document` it renders in");
    }
    if (this.#adapters.length > 0 && this.#document === undefined) {
      throw new Error("[Bonsai Application] `adapters` need the host `document` they observe");
    }
    const categories = new Set<string>();
    for (const adapter of this.#adapters) {
      if (categories.has(adapter.category)) {
        throw new Error(`[Bonsai Application] two adapters of the category "${adapter.category}": a source of the host is admitted by one instance only (A5.d, D7)`);
      }
      categories.add(adapter.category);
      for (const needed of adapter.requires ?? []) {
        if (needed === "router" && !this.#router) {
          throw new Error(`[Bonsai Application] the adapter "${adapter.category}" needs the Feature "${needed}": activate it with \`router: true\``);
        }
      }
    }
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
    if (this.#router) known.add("router");
    for (let i = 0; i < entries.length; i++) {
      const [ownNs] = entries[i]!;
      const instance = this.#featureInstances[i]!;
      const queried = new Set(instance.queries.map((t) => t.namespace));
      for (const dependency of instance.dependsOn) {
        // C.1: an initial dependency is a Query made at startup, so it must be a declared one.
        if (!queried.has(dependency.namespace)) {
          throw new BonsaiNamespaceError(
            "FEATURE_DEPENDENCY_NOT_QUERIED",
            `Feature "${ownNs}" depends on "${dependency.namespace}" for its startup but does not declare it in \`queries\`.`
          );
        }
      }
      const refs = [...instance.listens, ...instance.queries, ...instance.dependsOn].map(
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

    // The Feature of navigation is provided by the framework, outside the manifest (D15, I71).
    const framework = this.#router ? [new RouterFeature("router")] : [];

    // ── Phase 1 — kernel startup (§2.5, C.1) ─────────────────────────────
    this.#root = new Root({
      causalBound: this.#causalBound,
      ...(this.#document === undefined ? {} : { document: this.#document })
    });
    // Features first (I56), then the adapters of the host, then the Foundation, then the other components.
    const adapters = this.#adapters.map((Adapter) =>
      describeComponent(new Adapter(), {
        ...this.#adapterOptions[Adapter.category],
        root: this.#root,
        document: this.#document,
        signal: this.#stop.signal
      })
    );
    const foundation =
      this.#foundation === null
        ? []
        : [describeComponent(new this.#foundation(), { anchor: this.#anchor })];
    this.#root.startFromManifest([
      ...[...this.#featureInstances, ...framework].map((instance) => describeFeature(instance)),
      ...adapters,
      ...foundation,
      ...this.#components
    ]);
  }

  /** The communication root (one per Application, G6); `null` before start(). */
  get root(): Root | null {
    return this.#root;
  }

  /**
   * Removes the observers that Bonsai registered on the host (B.2). The model
   * is not destroyed: this is the only part of a stop that exists yet.
   */
  stop(): void {
    this.#stop.abort();
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
