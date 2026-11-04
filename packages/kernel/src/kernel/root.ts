/**
 * Execution kernel (migration lots M1–M6) — one Root per model.
 *
 * Realises the guarantees of the communication infrastructure
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
 *       validates; a synchronous failure closes the resource the effect
 *       aims at (and, for a part, the parts below it), the rest goes on.
 *
 * Later lots added the Entity journal and invariants (M2), structural parts
 * and the host document (M3–M4), closed-world qualification of host sources
 * and D18 (M5).
 */

import { Immer } from "@bonsai/immer";
import type { Draft, Patch } from "immer";
import { capture } from "./capture";
import { BonsaiError } from "@bonsai/error";
import { attachContext, InvariantError, ManifestError, StartupError, TransportError } from "./errors";
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
  TStateChange,
  TRootOptions,
  TTraceEntry,
  TUnitContext
} from "./types";

Immer.enablePatches();

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
  /** Host element once materialized (admission, or engagement of the attribution). */
  element: Element | null;
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

/**
 * What an effect aims at (C.3, 11.8): a part it materializes or writes into,
 * or a resource of the host (or a request to an external system) named by
 * its owner.
 */
type TEffectTarget =
  | { readonly part: ResourceRecord }
  | { readonly owner: ComponentRecord; readonly key: string };

interface PreparedEffect {
  readonly owner: ComponentRecord;
  readonly label: string;
  readonly run: () => void;
  readonly context: TCausalContext;
  readonly target: TEffectTarget;
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
  /** D18: whether the trigger of this unit grants the right to command. */
  readonly right: boolean;
  poisoned: { error: unknown } | null;
}

let rootCounter = 0;

// ── Root ─────────────────────────────────────────────────────────────────────

export class Root {
  readonly #id: string;
  readonly #bound: number;
  readonly #longMs: number;
  readonly #now: () => number;
  readonly #document: Document | null;
  readonly #onTrace: ((entry: TTraceEntry) => void) | undefined;
  /** D18: right to command, by message context (the trigger of a treatment). */
  readonly #rights = new Map<string, boolean>();
  /** C.4: instrumented simulation in progress, if any. */
  #simulating: { element: Element; type: string; token: TCorrelationToken } | null = null;
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
    this.#document = options.document ?? null;
    this.#onTrace = options.onTrace;
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
        if (!byNamespace.has(dependency)) throw new ManifestError("UNKNOWN_DEPENDENCY", `${entry.name} depends on unknown namespace "${dependency}" (C.1)`);
      }
    }
    const ordered: TManifestEntry[] = [];
    const placed = new Set<TManifestEntry>();
    while (ordered.length < entries.length) {
      const next = entries.find((entry) => !placed.has(entry) && (entry.dependsOn ?? []).every((d) => placed.has(byNamespace.get(d)!)));
      if (next === undefined) {
        const blocked = entries.filter((entry) => !placed.has(entry)).map((entry) => entry.name);
        throw new ManifestError("CYCLIC_DEPENDENCIES", `cyclic initial dependencies between ${blocked.join(", ")} (C.1)`);
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
      // A correlated result continues the reaction that armed it, with its right (D18).
      this.#rights.set(context.id, this.#rights.get(admission.token.context.id) ?? false);
    } else {
      context = this.#origin(admission.kind === "independent" ? "spontaneous" : "unknown");
      // Only an established independent fact grants the right to command (D18, C.4).
      this.#rights.set(context.id, admission.kind === "independent");
    }
    this.#queue.push({ kind: "local", target: record, name: local, payload: capture(payload), context });
    this.#drain();
  }

  // ── Units ──────────────────────────────────────────────────────────────────

  #runUnit(owner: ComponentRecord, cause: TCausalContext, body: (ctx: TUnitContext) => void, right = false): { error: unknown } | null {
    const startedAt = this.#now();
    const unit: Unit = { open: true, staged: [], undo: [], effects: [], touched: new Set(), restitutions: [], right, poisoned: null };
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
      attachContext(failure.error, cause);
      // An intercepted refusal reported by UNRECOVERABLE is also dated (ADR-04).
      if (unit.poisoned !== null) attachContext(unit.poisoned.error, cause);
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

  /**
   * C.3: engage in preparation order. A synchronous failure closes the
   * resource the effect aims at and, for a part, every part below it: later
   * effects aiming at a closed resource are not attempted, the others are
   * engaged. Sibling parts are disjoint (T7), so one failing slot does not
   * deprive the others, whatever their declaration order.
   */
  #engage(effects: readonly PreparedEffect[]): void {
    if (effects.length === 0) return;
    const lines: Array<{ effect: PreparedEffect; outcome: TEffectOutcome; error?: unknown; closedBy?: number }> = [];
    // Closed resources, each with the index of the failed line that closed it.
    const closedParts = new Map<ResourceRecord, number>();
    const closedKeys = new Map<ComponentRecord, Map<string, number>>();
    const closedBy = (target: TEffectTarget): number | undefined => {
      if ("part" in target) {
        for (let part: ResourceRecord | null = target.part; part !== null; part = part.container?.resource ?? null) {
          const index = closedParts.get(part);
          if (index !== undefined) return index;
        }
        return undefined;
      }
      return closedKeys.get(target.owner)?.get(target.key);
    };
    const close = (target: TEffectTarget, index: number): void => {
      if ("part" in target) {
        closedParts.set(target.part, index);
        return;
      }
      const keys = closedKeys.get(target.owner) ?? new Map<string, number>();
      keys.set(target.key, index);
      closedKeys.set(target.owner, keys);
    };
    for (const effect of effects) {
      const by = closedBy(effect.target);
      if (by !== undefined) {
        lines.push({ effect, outcome: "not-attempted", closedBy: by });
        continue;
      }
      try {
        effect.run();
        lines.push({ effect, outcome: "engaged" });
      } catch (error) {
        close(effect.target, lines.length);
        lines.push({ effect, outcome: "failed", error });
      }
    }
    // The engagement report is admitted to each living owner that declares it, as a
    // correlated result carrying its own lines only (C.3); the trace keeps the whole list.
    const owners = [...new Set(lines.map((line) => line.effect.owner))];
    const admitted = new Set<ComponentRecord>();
    const abandoned: TTraceEntry[] = [];
    for (const owner of owners) {
      if (owner.status === "destroyed" || owner.spec.locals?.["$effects"] === undefined) continue;
      const own = lines.filter((line) => line.effect.owner === owner);
      const child = this.#child(own[0]!.effect.context);
      if (child.depth > this.#bound) {
        abandoned.push({ type: "admission-abandoned", reason: "causal bound", name: "$effects" });
        continue;
      }
      admitted.add(owner);
      this.#queue.push({ kind: "local", target: owner, name: "$effects", payload: capture(own.map(({ effect, outcome }) => ({ label: effect.label, outcome }))), context: child });
    }
    this.#push({
      type: "effects",
      report: lines.map(({ effect, outcome, error, closedBy: by }) => ({
        owner: effect.owner.handle.name,
        label: effect.label,
        outcome,
        ...(outcome === "failed" ? { error } : {}),
        ...(by === undefined ? {} : { closedBy: by }),
        context: effect.context,
        admitted: admitted.has(effect.owner)
      }))
    });
    for (const entry of abandoned) this.#push(entry);
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
    // D18: an Event never grants the right; a Command or a local message carries its producer's.
    if (delivery.kind === "event") this.#rights.set(delivery.context.id, false);
    const right = this.#rights.get(delivery.context.id) ?? false;
    this.#runUnit(owner, delivery.context, (ctx) => run(delivery.payload, ctx), right);
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
      this.#rights.set(child.id, unit.right);
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
        // A4.b: only a component of the user interface addresses a Command to an adapter of the interface.
        if (channel!.owner.spec.ui === true && self.spec.ui !== true) {
          fail(new TransportError("NOT_AUTHORIZED", `${self.handle.name} is not a component of the user interface: it may not address "${namespace}:${command}" (A4.b)`));
        }
        if (self.spec.ui === true && !unit.right) {
          fail(new TransportError("NOT_AUTHORIZED", `${self.handle.name} may not command: the trigger of this reaction grants no right (D18)`));
        }
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
        let element: Element | null = null;
        if (this.#document !== null) {
          element = this.#document.querySelector(label);
          if (element === null) fail(new TransportError("HOST_NOT_FOUND", `no host element matches "${label}" (D3)`));
        }
        const resource: ResourceRecord = { handle: Object.freeze({ id: this.#nextId("res"), label }), owner: self, container: null, portions: new Map(), alive: true, element };
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
      project: (resource, label, write) => {
        guard();
        const record = this.#resources.get(resource.id);
        if (record === undefined || !record.alive || record.owner !== self) fail(new TransportError("NOT_OWNER", `${self.handle.name} does not own resource ${resource.label} (A1.b)`));
        unit.effects.push({
          owner: self,
          label,
          context: cause,
          target: { part: record! },
          run: () => {
            if (!record!.alive) return;
            if (record!.element === null) throw new BonsaiError("NOT_MATERIALIZED", `${record!.handle.label} is not materialized (9.10)`);
            write(record!.element);
          }
        });
      },
      simulate: (resource, type) => {
        guard();
        const record = this.#resources.get(resource.id);
        if (record === undefined || !record.alive || record.owner !== self) fail(new TransportError("NOT_OWNER", `${self.handle.name} does not own resource ${resource.label} (A1.b)`));
        this.#rights.set(cause.id, unit.right);
        const token: TCorrelationToken = Object.freeze({ kind: "correlation", occurrence: self.handle.occurrence, context: cause });
        unit.effects.push({
          owner: self,
          label: `simulate ${type}`,
          context: cause,
          target: { part: record! },
          run: () => {
            const element = record!.element;
            if (element === null) throw new BonsaiError("NOT_MATERIALIZED", `${record!.handle.label} is not materialized (9.10)`);
            this.#simulating = { element, type, token };
            try {
              // dispatchEvent, not element.click(): the drain may run inside the host's own dispatch of a
              // click on this element, and the host ignores a nested click() while one is in progress.
              const view = element.ownerDocument.defaultView!;
              const event = type === "click" ? new view.MouseEvent(type, { bubbles: true }) : new view.Event(type, { bubbles: true });
              element.dispatchEvent(event);
            } finally {
              this.#simulating = null;
            }
          }
        });
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
        this.#destroy(record!, unit, cause);
      },
      state: <S>(): S => {
        if (self.entity === null) fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Entity`));
        return self.entity!.state as S;
      },
      mutate: <S>(recipe: (draft: Draft<S>) => void): TStateChange<S> | null => {
        guard();
        const entity = self.entity;
        if (entity === null) fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Entity (16.2)`));
        const previous = entity!.state as S;
        const [next, patches, inversePatches] = Immer.produceWithPatches(previous, recipe) as [S, Patch[], Patch[]];
        if (next === previous) return null;
        entity!.state = next;
        // Immutable states: restoring the previous reference is an exact undo (G7).
        unit.undo.push(() => { entity!.state = previous; });
        unit.touched.add(self);
        return { previous, next, patches, inversePatches };
      },
      journal: (undo) => {
        guard();
        unit.undo.push(undo);
      },
      mayCommand: () => {
        guard();
        return unit.right;
      },
      prepareEffect: (label, run, options) => {
        guard();
        unit.effects.push({ owner: self, label, run, context: cause, target: { owner: self, key: options?.target ?? "" } });
      },
      correlate: (): TCorrelationToken => {
        guard();
        this.#rights.set(cause.id, unit.right);
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
      project: forbidden("project"),
      simulate: forbidden("simulate"),
      trigger: forbidden("trigger"),
      emit: forbidden("emit"),
      local: forbidden("local"),
      create: forbidden("create"),
      destroy: forbidden("destroy"),
      journal: forbidden("journal"),
      prepareEffect: forbidden("prepareEffect"),
      mayCommand: forbidden("mayCommand"),
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
      // Born while answering the Query: it carries the Query's context (ADR-04).
      attachContext(error, context);
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
      // A4.b (reception): a Channel of the user interface is not received by a component of the domain,
      // including a subscription made before this Channel exists.
      if (spec.ui === true) {
        const foreign = this.#subscriptions.find((s) => s.alive && s.namespace === spec.channel!.namespace && s.owner.spec.ui !== true);
        if (foreign !== undefined) {
          const error = new TransportError("NOT_AUTHORIZED", `${foreign.owner.handle.name} is not a component of the user interface: it may not receive "${spec.channel.namespace}:${foreign.event}" (A4.b)`);
          unit.poisoned = unit.poisoned ?? { error };
          throw error;
        }
      }
      record.channel = { namespace: spec.channel.namespace, owner: record, alive: true };
      this.#registry.set(spec.channel.namespace, record.channel);
    }
    // A4.b (reception): only a component of the user interface subscribes to a Channel of the interface.
    // Checked before any subscription is registered, so a refusal leaves nothing behind.
    for (const listen of spec.listens ?? []) {
      const target = this.#registry.get(listen.namespace);
      if (target !== undefined && target.alive && target.owner.spec.ui === true && spec.ui !== true) {
        const error = new TransportError("NOT_AUTHORIZED", `${spec.name} is not a component of the user interface: it may not receive "${listen.namespace}:${listen.event}" (A4.b)`);
        unit.poisoned = unit.poisoned ?? { error };
        throw error;
      }
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
        alive: true,
        element: null
      };
      container!.portions.set(options.part.portion, part);
      // Materialization of the part: an effect of the container's owner, engaged after validation (D12, C.3).
      if (this.#document !== null) {
        const document = this.#document;
        const portion = options.part.portion;
        unit.effects.push({
          owner: parent,
          label: `materialize ${part.handle.label}`,
          context: cause,
          target: { part },
          run: () => {
            if (!part.alive) return;
            const host = container!.element;
            if (host === null) throw new BonsaiError("NOT_MATERIALIZED", `${container!.handle.label} is not materialized (9.10)`);
            let element: Element;
            if (options.part!.host !== undefined) {
              // A declared slot: exactly one existing element of the container (Foundation §3).
              const matches = host.querySelectorAll(options.part!.host);
              if (matches.length !== 1) throw new BonsaiError("SLOT_NOT_UNIQUE", `slot "${options.part!.host}" matches ${matches.length} elements of ${container!.handle.label}, expected exactly one`);
              element = matches[0]!;
              element.setAttribute("data-bonsai-part", portion);
            } else {
              element = document.createElement("div");
              element.setAttribute("data-bonsai-part", portion);
              // Order is explicit: before the part named by `before`, otherwise at the end (Composer §1.3).
              const before = options.part!.before === undefined ? null : container!.portions.get(options.part!.before)?.element ?? null;
              host.insertBefore(element, before !== null && before.parentNode === host ? before : null);
            }
            part.element = element;
            // Host sources of the part (D10, B.4): registered by Bonsai, admitted by the part's owner only.
            for (const [type, admission] of Object.entries(record.spec.dom ?? {})) {
              const local = typeof admission === "string" ? admission : admission.local;
              const keys = typeof admission === "string" ? undefined : admission.keys;
              const cancelDefault = typeof admission === "string" ? undefined : admission.cancelDefault;
              element.addEventListener(type, (event) => {
                const target = event.target as Element | null;
                if (target === null || target.closest("[data-bonsai-part]") !== element) return; // innermost part only (A5.d)
                let ui: string | null = target.getAttribute("data-ui");
                if (keys !== undefined) {
                  ui = null;
                  for (const [key, selector] of Object.entries(keys)) {
                    const hit = target.closest(selector);
                    if (hit !== null && element.contains(hit)) { ui = key; break; }
                  }
                }
                // D20: cancelled at capture by declaration, never by the treatment, whatever its outcome.
                if (ui !== null && cancelDefault?.includes(ui) === true) event.preventDefault();
                const pending = this.#simulating;
                // Closed world (C.4): an occurrence no instrumented operation could have produced is independent.
                const admission: TAdmission = pending !== null && pending.element === element && pending.type === type
                  ? { kind: "correlated", token: pending.token }
                  : { kind: "independent" };
                this.admit(record.handle, local, { type, ui }, admission);
              });
            }
          }
        });
      }
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
  #destroy(record: ComponentRecord, unit: Unit, cause: TCausalContext): void {
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
    // Physical cleanup, post-validation (C.7): only parts whose container survives; nested elements go with them.
    const destroyed = new Set(order);
    for (const resource of ended) {
      if (resource.container === null || destroyed.has(resource.container.resource.owner)) continue;
      unit.effects.push({
        owner: resource.container.resource.owner,
        label: `remove ${resource.handle.label}`,
        context: cause,
        target: { part: resource },
        run: () => { resource.element?.remove(); resource.element = null; }
      });
    }
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
    if (this.#onTrace === undefined) return;
    try {
      this.#onTrace(entry);
    } catch {
      // The sink is technical: its failure changes nothing in the model (O2).
    }
  }
}
