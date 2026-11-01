/**
 * Kernel prototype (migration lot M1) — one Root per model.
 *
 * Realises, for testing, the guarantees of the communication infrastructure
 * (docs/theorie.md §13 and annex C):
 *
 * - G1  delivery to the Channel owner, to subscription owners, to the author
 *       of a local message; responses to the author only.
 * - G2  values captured by copy at submission, responses at return (C.5).
 * - G3  no delivery to a destroyed Channel, subscription or component;
 *       reservations bound to a determined subscription (C.2, C.6).
 * - G5  deferred messages delivered only after the producing unit validates;
 *       Queries synchronous, refused towards a target not ready or active.
 * - G6  one registry per Root: no message crosses roots.
 * - G7  a failing unit restores what it journaled, drops its creations,
 *       destructions and deferred messages; Query errors poison the unit.
 * - G8  causal contexts created and propagated by the kernel only.
 * - D8  production order; subscription order; rank fixed at emission.
 * - D9  causal depth checked before any submission.
 * - C.3 effects prepared during the unit, engaged in order after it
 *       validates, stopping at the first synchronous failure.
 *
 * Out of scope for M1: Entity integration (M2), structural parts and DOM
 * (M3–M4), closed-world qualification of host sources and D18 (M5).
 */

import { Immer } from "@bonsai/immer";
import type { Draft } from "immer";
import { capture } from "./capture";
import { InvariantError, ManifestError, StartupError, TransportError } from "./errors";
import type {
  TAdmission,
  TCausalContext,
  TComponentHandle,
  TComponentSpec,
  TCreateOptions,
  TDesignation,
  TResourceHandle,
  TCorrelationToken,
  TDeferredHandler,
  TEffectOutcome,
  TEntityDefinition,
  TManifestEntry,
  TOriginKind,
  TReadContext,
  TRootOptions,
  TTraceEntry,
  TUnitContext
} from "./types";

// ── Internal records ─────────────────────────────────────────────────────────

type TStatus = "initializing" | "ready" | "destroyed";

interface ComponentRecord {
  readonly handle: TComponentHandle;
  readonly spec: TComponentSpec;
  readonly parent: ComponentRecord | null;
  readonly children: ComponentRecord[];
  status: TStatus;
  channel: ChannelRecord | null;
  readonly subscriptions: SubscriptionRecord[];
  entity: { readonly def: TEntityDefinition<unknown>; state: unknown } | null;
  /** Distributable resources and parts owned by the component (6.3–6.5). */
  readonly resources: ResourceRecord[];
  params: unknown;
  designation: TDesignation | null;
}

/** A distributable resource; a part is one whose `container` is set (6.3, 6.5). */
interface ResourceRecord {
  readonly handle: TResourceHandle;
  readonly owner: ComponentRecord;
  readonly container: { readonly resource: ResourceRecord; readonly portion: string } | null;
  /** Portions subtracted from this resource, by the part that occupies them (6.6). */
  readonly portions: Map<string, ResourceRecord>;
  alive: boolean;
}

interface ChannelRecord {
  readonly namespace: string;
  readonly owner: ComponentRecord;
  alive: boolean;
}

interface SubscriptionRecord {
  readonly owner: ComponentRecord;
  readonly namespace: string;
  readonly event: string;
  readonly handler: TDeferredHandler;
  alive: boolean;
}

type Delivery =
  | { readonly kind: "command"; readonly channel: ChannelRecord; readonly name: string; readonly payload: unknown; readonly context: TCausalContext }
  | { readonly kind: "event"; readonly subscription: SubscriptionRecord; readonly name: string; readonly payload: unknown; readonly context: TCausalContext }
  | { readonly kind: "local"; readonly target: ComponentRecord; readonly name: string; readonly payload: unknown; readonly context: TCausalContext };

interface PreparedEffect {
  readonly owner: ComponentRecord;
  readonly label: string;
  readonly run: () => void;
  readonly context: TCausalContext;
}

interface Unit {
  open: boolean;
  readonly staged: Delivery[];
  readonly undo: Array<() => void>;
  readonly effects: PreparedEffect[];
  /** Components whose Entity was created or mutated in this unit (A4.a). */
  readonly touched: Set<ComponentRecord>;
  /** Restitutions performed by provisional destructions, traced at commit. */
  readonly restitutions: TTraceEntry[];
  poisoned: { error: unknown } | null;
}

let rootCounter = 0;

// ── Root ─────────────────────────────────────────────────────────────────────

export class Root {
  readonly #id: string;
  readonly #bound: number;
  readonly #longMs: number;
  readonly #now: () => number;
  readonly #registry = new Map<string, ChannelRecord>();
  readonly #subscriptions: SubscriptionRecord[] = [];
  readonly #components = new Map<string, ComponentRecord>();
  readonly #resources = new Map<string, ResourceRecord>();
  readonly #queue: Delivery[] = [];
  readonly #active: ComponentRecord[] = [];
  readonly #trace: TTraceEntry[] = [];
  #counter = 0;
  #unit: Unit | null = null;
  #draining = false;
  #state: "created" | "starting" | "started" | "abandoned" = "created";
  readonly #record: ComponentRecord;

  constructor(options: TRootOptions) {
    this.#id = `r${++rootCounter}`;
    this.#bound = options.causalBound;
    this.#longMs = options.longUnitMs ?? 50;
    this.#now = options.now ?? (() => performance.now());
    // The root's existence is provided by the host, not admitted (A0.d, 7.4).
    this.#record = {
      handle: Object.freeze({ occurrence: this.#nextId("c"), name: "root" }),
      spec: { name: "root" },
      parent: null,
      children: [],
      status: "ready",
      channel: null,
      subscriptions: [],
      entity: null,
      resources: [],
      params: undefined,
      designation: null
    };
  }

  /** Technical trace, outside the application transport. */
  get trace(): readonly TTraceEntry[] {
    return this.#trace;
  }

  /**
   * Startup: an exceptional validation unit whose cause is an origin (§2.5).
   * Deferred messages and admissions wait for its success; its failure
   * abandons the model under construction (C.1).
   */
  start(init: (ctx: TUnitContext) => void): void {
    if (this.#state !== "created") {
      throw new TransportError("ROOT_ABANDONED", `root cannot start from state "${this.#state}"`);
    }
    this.#state = "starting";
    const cause = this.#origin("startup");
    const error = this.#runUnit(this.#record, cause, (ctx) => init(ctx));
    if (error !== null) {
      this.#state = "abandoned";
      this.#registry.clear();
      this.#subscriptions.length = 0;
      this.#queue.length = 0;
      throw new StartupError(error.error);
    }
    this.#state = "started";
    this.#drain();
  }

  /**
   * Starts from a Manifest (16.9, D14): the root creates its declared children
   * in an order that respects their initial Query dependencies; among children
   * without remaining dependency, declaration order decides; a cycle or an
   * unknown dependency is refused before startup (C.1).
   */
  startFromManifest(entries: readonly TManifestEntry[]): void {
    const byNamespace = new Map<string, TManifestEntry>();
    for (const entry of entries) {
      if (entry.channel !== undefined) byNamespace.set(entry.channel.namespace, entry);
    }
    for (const entry of entries) {
      for (const dependency of entry.dependsOn ?? []) {
        if (!byNamespace.has(dependency)) throw new ManifestError(`${entry.name} depends on unknown namespace "${dependency}"`);
      }
    }
    const ordered: TManifestEntry[] = [];
    const placed = new Set<TManifestEntry>();
    while (ordered.length < entries.length) {
      const next = entries.find((entry) => !placed.has(entry) && (entry.dependsOn ?? []).every((d) => placed.has(byNamespace.get(d)!)));
      if (next === undefined) {
        const blocked = entries.filter((entry) => !placed.has(entry)).map((entry) => entry.name);
        throw new ManifestError(`cyclic initial dependencies between ${blocked.join(", ")} (C.1)`);
      }
      ordered.push(next);
      placed.add(next);
    }
    this.start((ctx) => {
      for (const entry of ordered) ctx.create(entry);
    });
  }

  /**
   * Admission of an occurrence of the host or of an external system (A5.c).
   * The preamble mutates nothing: it checks the occurrence of life, qualifies
   * the context (C.4), captures the payload and queues a local message.
   */
  admit(target: TComponentHandle, local: string, payload: unknown, admission: TAdmission): void {
    if (this.#state === "abandoned") {
      this.#push({ type: "admission-abandoned", reason: "root abandoned", name: local });
      return;
    }
    const record = this.#components.get(target.occurrence);
    if (record === undefined || record.status === "destroyed") {
      this.#push({ type: "admission-abandoned", reason: "occurrence no longer alive", name: local });
      return;
    }
    if (record.spec.locals?.[local] === undefined) {
      throw new TransportError("UNDECLARED_MESSAGE", `local "${local}" not declared by ${record.handle.name}`);
    }
    let context: TCausalContext;
    if (admission.kind === "correlated") {
      if (admission.token.occurrence !== record.handle.occurrence) {
        this.#push({ type: "admission-abandoned", reason: "result routed to another occurrence", name: local });
        return;
      }
      const child = this.#child(admission.token.context);
      if (child.depth > this.#bound) {
        // Refused at the preamble: no treatment starts, nothing is revoked (D9).
        this.#push({ type: "admission-abandoned", reason: "causal bound", name: local });
        return;
      }
      context = child;
    } else {
      context = this.#origin(admission.kind === "independent" ? "spontaneous" : "unknown");
    }
    this.#queue.push({ kind: "local", target: record, name: local, payload: capture(payload), context });
    this.#drain();
  }

  // ── Units ──────────────────────────────────────────────────────────────────

  #runUnit(owner: ComponentRecord, cause: TCausalContext, body: (ctx: TUnitContext) => void): { error: unknown } | null {
    const startedAt = this.#now();
    const unit: Unit = { open: true, staged: [], undo: [], effects: [], touched: new Set(), restitutions: [], poisoned: null };
    this.#unit = unit;
    this.#active.push(owner);
    let failure: { error: unknown } | null = null;
    try {
      body(this.#unitContext(owner, cause, unit));
    } catch (error) {
      failure = { error };
    } finally {
      this.#active.pop();
      unit.open = false;
      this.#unit = null;
    }
    // A Query error or a refused submission cannot be recovered locally (G7).
    if (failure === null && unit.poisoned !== null) {
      // The author intercepted a Query failure: the unit fails anyway (G7).
      failure = {
        error: new TransportError(
          "UNRECOVERABLE",
          "Query refusée ou en échec : l'unité est annulée et ne peut pas reprendre localement (G7)",
          unit.poisoned.error
        )
      };
    }
    if (failure === null) failure = this.#checkInvariants(unit);
    if (failure !== null) {
      for (let i = unit.undo.length - 1; i >= 0; i--) {
        try {
          unit.undo[i]!();
        } catch {
          // Undo must not throw; a failing undo is a kernel defect.
        }
      }
      this.#push({ type: "unit-failed", owner: owner.handle.name, context: cause, error: failure.error });
      this.#measure("long-unit", startedAt, { owner: owner.handle.name, context: cause });
      return failure;
    }
    for (const entry of unit.restitutions) this.#push(entry);
    this.#queue.push(...unit.staged);
    this.#engage(unit.effects);
    this.#measure("long-unit", startedAt, { owner: owner.handle.name, context: cause });
    return null;
  }

  /** A4.a: business invariants of every Entity touched by the unit. */
  #checkInvariants(unit: Unit): { error: unknown } | null {
    for (const record of unit.touched) {
      if (record.status === "destroyed" || record.entity === null) continue;
      for (const invariant of record.entity.def.invariants ?? []) {
        let satisfied: boolean;
        try {
          satisfied = invariant.check(record.entity.state);
        } catch (error) {
          return { error };
        }
        if (!satisfied) return { error: new InvariantError(record.entity.def.name, invariant.name) };
      }
    }
    return null;
  }

  /** C.3: engage in preparation order, stop at the first synchronous failure. */
  #engage(effects: readonly PreparedEffect[]): void {
    if (effects.length === 0) return;
    const reports = new Map<ComponentRecord, Array<{ label: string; outcome: TEffectOutcome; error?: unknown }>>();
    let stopped = false;
    for (const effect of effects) {
      const list = reports.get(effect.owner) ?? [];
      reports.set(effect.owner, list);
      if (stopped) {
        list.push({ label: effect.label, outcome: "not-attempted" });
        continue;
      }
      try {
        effect.run();
        list.push({ label: effect.label, outcome: "engaged" });
      } catch (error) {
        list.push({ label: effect.label, outcome: "failed", error });
        stopped = true;
      }
    }
    for (const [owner, report] of reports) {
      const context = effects.find((e) => e.owner === owner)!.context;
      this.#push({ type: "effects", owner: owner.handle.name, context, report });
      // The engagement report is admitted as a correlated result when declared (C.3).
      if (owner.status !== "destroyed" && owner.spec.locals?.["$effects"] !== undefined) {
        const child = this.#child(context);
        if (child.depth <= this.#bound) {
          this.#queue.push({ kind: "local", target: owner, name: "$effects", payload: capture(report.map(({ label, outcome }) => ({ label, outcome }))), context: child });
        } else {
          this.#push({ type: "admission-abandoned", reason: "causal bound", name: "$effects" });
        }
      }
    }
  }

  /** Delivers deferred messages one unit at a time, never reentrantly (G5). */
  #drain(): void {
    if (this.#draining || this.#unit !== null || this.#state !== "started") return;
    this.#draining = true;
    // ADR-35: the queue is drained in one go, without yielding to the host.
    const startedAt = this.#now();
    const context = this.#queue[0]?.context;
    let units = 0;
    try {
      while (this.#queue.length > 0) {
        const delivery = this.#queue.shift()!;
        this.#deliver(delivery);
        units++;
      }
    } finally {
      this.#draining = false;
      if (context !== undefined) this.#measure("long-drain", startedAt, { units, context });
    }
  }

  /** Reports a unit or a drain longer than the threshold (ADR-35, O2). */
  #measure(type: "long-unit", startedAt: number, data: { owner: string; context: TCausalContext }): void;
  #measure(type: "long-drain", startedAt: number, data: { units: number; context: TCausalContext }): void;
  #measure(type: "long-unit" | "long-drain", startedAt: number, data: { owner?: string; units?: number; context: TCausalContext }): void {
    const durationMs = this.#now() - startedAt;
    if (durationMs <= this.#longMs) return;
    if (type === "long-unit") {
      this.#push({ type, owner: data.owner!, context: data.context, durationMs });
    } else {
      this.#push({ type, units: data.units!, context: data.context, durationMs });
    }
  }

  #deliver(delivery: Delivery): void {
    let owner: ComponentRecord;
    let handler: TDeferredHandler | undefined;
    switch (delivery.kind) {
      case "command":
        if (!delivery.channel.alive) return this.#abandon("channel destroyed", delivery);
        owner = delivery.channel.owner;
        handler = owner.spec.channel?.commands?.[delivery.name];
        break;
      case "event":
        if (!delivery.subscription.alive) return this.#abandon("subscription destroyed", delivery);
        owner = delivery.subscription.owner;
        handler = delivery.subscription.handler;
        break;
      case "local":
        owner = delivery.target;
        handler = owner.spec.locals?.[delivery.name];
        break;
    }
    if (owner.status === "destroyed") return this.#abandon("recipient destroyed", delivery);
    if (handler === undefined) return this.#abandon("no declared handler", delivery);
    this.#push({ type: "delivered", kind: delivery.kind, to: owner.handle.name, name: delivery.name, context: delivery.context });
    const run = handler;
    this.#runUnit(owner, delivery.context, (ctx) => run(delivery.payload, ctx));
  }

  #abandon(reason: string, delivery: Delivery): void {
    this.#push({ type: "delivery-abandoned", reason, name: delivery.name, context: delivery.context });
  }

  // ── Contexts offered to the application ────────────────────────────────────

  #unitContext(self: ComponentRecord, cause: TCausalContext, unit: Unit): TUnitContext {
    const guard = (): void => {
      if (this.#unit !== unit || !unit.open) {
        throw new TransportError("NO_UNIT", "context used outside its validation unit (A5.a)");
      }
    };
    const fail = (error: TransportError): never => {
      unit.poisoned = unit.poisoned ?? { error };
      throw error;
    };
    const submit = (): TCausalContext => {
      const child = this.#child(cause);
      if (child.depth > this.#bound) {
        fail(new TransportError("CAUSAL_BOUND", `depth ${child.depth} exceeds bound ${this.#bound}`));
      }
      return child;
    };

    return {
      self: self.handle,
      cause,
      query: <T>(namespace: string, name: string, params?: unknown): T => {
        guard();
        return this.#query<T>(namespace, name, params, cause, unit);
      },
      trigger: (namespace, command, payload) => {
        guard();
        const channel = this.#registry.get(namespace);
        if (channel === undefined || !channel.alive) fail(new TransportError("UNKNOWN_TARGET", `no Channel "${namespace}" in this root`));
        if (channel!.owner.spec.channel?.commands?.[command] === undefined) fail(new TransportError("UNDECLARED_MESSAGE", `command "${namespace}:${command}" not declared`));
        const context = submit();
        unit.staged.push({ kind: "command", channel: channel!, name: command, payload: this.#capture(payload, unit), context });
      },
      emit: (event, payload) => {
        guard();
        const channel = self.channel;
        if (channel === null || !channel.alive) fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Channel to emit on (A3.e)`));
        if (!(self.spec.channel?.events ?? []).includes(event)) fail(new TransportError("UNDECLARED_MESSAGE", `event "${event}" not declared by ${self.handle.name}`));
        const context = submit();
        const value = this.#capture(payload, unit);
        // D8 / C.6: reservations fixed now, on the subscriptions present now.
        for (const subscription of this.#subscriptions) {
          if (subscription.alive && subscription.namespace === channel!.namespace && subscription.event === event) {
            unit.staged.push({ kind: "event", subscription, name: event, payload: value, context });
          }
        }
      },
      local: (name, payload) => {
        guard();
        if (self.spec.locals?.[name] === undefined) fail(new TransportError("UNDECLARED_MESSAGE", `local "${name}" not declared`));
        const context = submit();
        unit.staged.push({ kind: "local", target: self, name, payload: this.#capture(payload, unit), context });
      },
      create: (spec, options) => {
        guard();
        return this.#create(self, spec, cause, unit, options);
      },
      params: <P>(): P => self.params as P,
      designation: () => self.designation,
      admitDistributable: (label) => {
        guard();
        const resource: ResourceRecord = { handle: Object.freeze({ id: this.#nextId("res"), label }), owner: self, container: null, portions: new Map(), alive: true };
        this.#resources.set(resource.handle.id, resource);
        self.resources.push(resource);
        unit.undo.push(() => {
          resource.alive = false;
          this.#resources.delete(resource.handle.id);
          self.resources.splice(self.resources.indexOf(resource), 1);
        });
        return resource.handle;
      },
      resolve: (designation) => {
        guard();
        const part = this.#resources.get(designation.attribution);
        const valid = part !== undefined && part.alive && part.owner === self && part.container !== null
          && part.container.resource.handle.id === designation.resource && part.container.portion === designation.portion
          && part.container.resource.portions.get(designation.portion) === part;
        if (!valid) fail(new TransportError("INVALID_DESIGNATION", `designation of portion "${designation.portion}" does not resolve to a living part owned by ${self.handle.name} (8.5, 9.10)`));
        return part!.handle;
      },
      attributed: (resource) => {
        const record = this.#resources.get(resource.id);
        if (record === undefined || !record.alive || record.owner !== self) fail(new TransportError("NOT_OWNER", `${self.handle.name} does not own resource ${resource.label}`));
        return [...record!.portions.keys()];
      },
      destroy: (child) => {
        guard();
        const record = this.#components.get(child.occurrence);
        if (record === undefined || record.parent !== self) fail(new TransportError("NOT_OWNER", `${self.handle.name} is not the parent of ${child.name} (A1.b, T1)`));
        this.#destroy(record!, unit);
      },
      state: <S>(): S => {
        if (self.entity === null) fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Entity`));
        return self.entity!.state as S;
      },
      mutate: <S>(recipe: (draft: Draft<S>) => void): void => {
        guard();
        const entity = self.entity;
        if (entity === null) fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Entity (16.2)`));
        const previous = entity!.state;
        const next = Immer.produce(previous as S, recipe);
        if (next === previous) return;
        entity!.state = next;
        // Immutable states: restoring the previous reference is an exact undo (G7).
        unit.undo.push(() => { entity!.state = previous; });
        unit.touched.add(self);
      },
      journal: (undo) => {
        guard();
        unit.undo.push(undo);
      },
      prepareEffect: (label, run) => {
        guard();
        unit.effects.push({ owner: self, label, run, context: cause });
      },
      correlate: (): TCorrelationToken => {
        guard();
        return Object.freeze({ kind: "correlation", occurrence: self.handle.occurrence, context: cause });
      }
    };
  }

  #readContext(self: ComponentRecord, cause: TCausalContext, unit: Unit): TReadContext & TUnitContext {
    const forbidden = (operation: string) => (): never => {
      const error = new TransportError("READ_ONLY", `${operation} forbidden while answering a Query (A3.g)`);
      unit.poisoned = unit.poisoned ?? { error };
      throw error;
    };
    return {
      self: self.handle,
      cause,
      query: <T>(namespace: string, name: string, params?: unknown): T => this.#query<T>(namespace, name, params, cause, unit),
      state: <S>(): S => {
        if (self.entity === null) return forbidden("state without Entity")();
        return self.entity.state as S;
      },
      mutate: forbidden("mutate"),
      params: forbidden("params"),
      designation: forbidden("designation"),
      admitDistributable: forbidden("admitDistributable"),
      resolve: forbidden("resolve"),
      attributed: forbidden("attributed"),
      trigger: forbidden("trigger"),
      emit: forbidden("emit"),
      local: forbidden("local"),
      create: forbidden("create"),
      destroy: forbidden("destroy"),
      journal: forbidden("journal"),
      prepareEffect: forbidden("prepareEffect"),
      correlate: forbidden("correlate")
    };
  }

  #query<T>(namespace: string, name: string, params: unknown, cause: TCausalContext, unit: Unit): T {
    const fail = (error: TransportError): never => {
      unit.poisoned = unit.poisoned ?? { error };
      throw error;
    };
    const channel = this.#registry.get(namespace);
    if (channel === undefined || !channel.alive) return fail(new TransportError("UNKNOWN_TARGET", `no Channel "${namespace}" in this root`));
    const target = channel.owner;
    const handler = target.spec.channel?.queries?.[name];
    if (handler === undefined) return fail(new TransportError("UNDECLARED_MESSAGE", `query "${namespace}:${name}" not declared`));
    if (target.status !== "ready") return fail(new TransportError("TARGET_NOT_READY", `${target.handle.name} is not ready (C.1)`));
    if (this.#active.includes(target)) return fail(new TransportError("TARGET_ACTIVE", `${target.handle.name} has an execution in progress (G5)`));
    const context = this.#child(cause);
    if (context.depth > this.#bound) return fail(new TransportError("CAUSAL_BOUND", `depth ${context.depth} exceeds bound ${this.#bound}`));
    const value = this.#capture(params, unit);
    this.#active.push(target);
    try {
      const result = handler(value, this.#readContext(target, context, unit));
      return this.#capture(result, unit) as T;
    } catch (error) {
      // Any Query failure interrupts the author's unit; no local recovery (G7).
      unit.poisoned = unit.poisoned ?? { error };
      throw error;
    } finally {
      this.#active.pop();
    }
  }

  // ── Structure: creation and cascade, journaled for G7 ──────────────────────

  #create(parent: ComponentRecord, spec: TComponentSpec, cause: TCausalContext, unit: Unit, options: TCreateOptions = {}): TComponentHandle {
    const record: ComponentRecord = {
      handle: Object.freeze({ occurrence: this.#nextId("c"), name: spec.name }),
      spec,
      parent,
      children: [],
      status: "initializing",
      channel: null,
      subscriptions: [],
      entity: null,
      resources: [],
      params: undefined,
      designation: null
    };
    if (spec.entity !== undefined) {
      // Initial state captured by copy and frozen; checked at the end of the unit (A4.a).
      record.entity = { def: spec.entity, state: capture(spec.entity.initial) };
      unit.touched.add(record);
    }
    if (spec.channel !== undefined) {
      const existing = this.#registry.get(spec.channel.namespace);
      if (existing !== undefined && existing.alive) {
        const error = new TransportError("DUPLICATE_NAMESPACE", `namespace "${spec.channel.namespace}" already used in this root`);
        unit.poisoned = unit.poisoned ?? { error };
        throw error;
      }
      record.channel = { namespace: spec.channel.namespace, owner: record, alive: true };
      this.#registry.set(spec.channel.namespace, record.channel);
    }
    for (const listen of spec.listens ?? []) {
      const subscription: SubscriptionRecord = { owner: record, namespace: listen.namespace, event: listen.event, handler: listen.handler, alive: true };
      record.subscriptions.push(subscription);
      this.#subscriptions.push(subscription);
    }
    record.params = this.#capture(options.params, unit);
    if (options.part !== undefined) {
      // Attribution (6.5): only by the container's owner (A1.b), only to a child (A2.d), never overlapping (T7).
      const container = this.#resources.get(options.part.resource.id);
      const fail = (error: TransportError): never => { unit.poisoned = unit.poisoned ?? { error }; throw error; };
      if (container === undefined || !container.alive || container.owner !== parent) fail(new TransportError("NOT_OWNER", `${parent.handle.name} does not own resource ${options.part.resource.label} (A1.b)`));
      if (container!.portions.has(options.part.portion)) fail(new TransportError("PORTION_TAKEN", `portion "${options.part.portion}" of ${options.part.resource.label} is already attributed (T7)`));
      const part: ResourceRecord = {
        handle: Object.freeze({ id: this.#nextId("part"), label: `${container!.handle.label}/${options.part.portion}` }),
        owner: record,
        container: { resource: container!, portion: options.part.portion },
        portions: new Map(),
        alive: true
      };
      container!.portions.set(options.part.portion, part);
      this.#resources.set(part.handle.id, part);
      record.resources.push(part);
      record.designation = Object.freeze({ resource: container!.handle.id, portion: options.part.portion, attribution: part.handle.id });
      unit.undo.push(() => {
        part.alive = false;
        if (container!.portions.get(options.part!.portion) === part) container!.portions.delete(options.part!.portion);
        this.#resources.delete(part.handle.id);
      });
    }
    parent.children.push(record);
    this.#components.set(record.handle.occurrence, record);
    unit.undo.push(() => {
      // An abandoned creation is never published (§2.5, C.7).
      record.status = "destroyed";
      if (record.channel !== null) {
        record.channel.alive = false;
        if (this.#registry.get(record.channel.namespace) === record.channel) this.#registry.delete(record.channel.namespace);
      }
      for (const subscription of record.subscriptions) {
        subscription.alive = false;
        const index = this.#subscriptions.indexOf(subscription);
        if (index >= 0) this.#subscriptions.splice(index, 1);
      }
      const index = parent.children.indexOf(record);
      if (index >= 0) parent.children.splice(index, 1);
      this.#components.delete(record.handle.occurrence);
    });
    if (spec.init !== undefined) {
      // The child's initialisation belongs to its creator's unit (§2.5).
      this.#active.push(record);
      try {
        spec.init(this.#unitContext(record, cause, unit));
      } finally {
        this.#active.pop();
      }
    }
    record.status = "ready";
    return record.handle;
  }

  /** Cascade, bottom-up; provisional until the unit validates (C.7). */
  #destroy(record: ComponentRecord, unit: Unit): void {
    const order: ComponentRecord[] = [];
    const visit = (node: ComponentRecord): void => {
      for (const child of node.children) visit(child);
      order.push(node);
    };
    visit(record);
    const parent = record.parent!;
    const position = parent.children.indexOf(record);
    const saved = order.map((node) => ({
      node,
      status: node.status,
      channelAlive: node.channel?.alive ?? false,
      subscriptions: node.subscriptions.map((s) => ({ s, alive: s.alive, index: this.#subscriptions.indexOf(s) }))
    }));
    const snapshots = new Map<ResourceRecord, Array<[string, ResourceRecord]>>();
    const ended: ResourceRecord[] = [];
    for (const node of order) {
      // Bottom-up: each restitution is imputed to the container's owner, still present here (§2.5, T3).
      for (const resource of node.resources) {
        if (resource.container !== null && resource.container.resource.portions.get(resource.container.portion) === resource) {
          const { resource: container, portion } = resource.container;
          if (!snapshots.has(container)) snapshots.set(container, [...container.portions.entries()]);
          container.portions.delete(portion);
          unit.restitutions.push({ type: "restitution", portion, container: container.handle.label, imputedTo: container.owner.handle.name, endedOwner: node.handle.name });
        }
        if (resource.alive) {
          resource.alive = false;
          ended.push(resource);
        }
      }
      node.status = "destroyed";
      if (node.channel !== null) {
        node.channel.alive = false;
        if (this.#registry.get(node.channel.namespace) === node.channel) this.#registry.delete(node.channel.namespace);
      }
      for (const subscription of node.subscriptions) {
        subscription.alive = false;
        const index = this.#subscriptions.indexOf(subscription);
        if (index >= 0) this.#subscriptions.splice(index, 1);
      }
    }
    parent.children.splice(position, 1);
    unit.undo.push(() => {
      // Cancellation keeps the same occurrences, Channels and reservations (C.2).
      parent.children.splice(position, 0, record);
      const restored = saved.flatMap((entry) => entry.subscriptions).filter((x) => x.index >= 0).sort((a, b) => a.index - b.index);
      for (const entry of saved) {
        entry.node.status = entry.status;
        if (entry.node.channel !== null) {
          entry.node.channel.alive = entry.channelAlive;
          if (entry.channelAlive) this.#registry.set(entry.node.channel.namespace, entry.node.channel);
        }
      }
      for (const { s, alive, index } of restored) {
        s.alive = alive;
        this.#subscriptions.splice(index, 0, s);
      }
      // Same parts and designations as before: neither a new creation nor a transfer (C.7).
      for (const resource of ended) resource.alive = true;
      // Exact restoration, order of attribution included.
      for (const [container, entries] of snapshots) {
        container.portions.clear();
        for (const [portion, part] of entries) container.portions.set(portion, part);
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  #capture<T>(value: T, unit: Unit): T {
    try {
      return capture(value);
    } catch (error) {
      unit.poisoned = unit.poisoned ?? { error };
      throw error;
    }
  }

  #origin(kind: TOriginKind): TCausalContext {
    const id = this.#nextId("m");
    return Object.freeze({ id, parentId: null, originId: id, originKind: kind, depth: 0 });
  }

  #child(parent: TCausalContext): TCausalContext {
    return Object.freeze({
      id: this.#nextId("m"),
      parentId: parent.id,
      originId: parent.originId,
      originKind: parent.originKind,
      depth: parent.depth + 1
    });
  }

  #nextId(prefix: string): string {
    return `${this.#id}:${prefix}${++this.#counter}`;
  }

  #push(entry: TTraceEntry): void {
    this.#trace.push(entry);
  }
}
