/**
 * Test harness for the domain layer on the kernel (lot M6.1).
 *
 * The domain never speaks by itself: something has to address Commands to it
 * and ask it Queries. In an application that something is the user interface;
 * here it is a probe component of the same root, driven from outside through
 * admissions of independent facts (A5.b), exactly like a click.
 */

import { Application, type TFeaturesManifest } from "@bonsai/application";
import type {
  Root,
  TComponentHandle,
  TManifestEntry,
  TTraceEntry
} from "@bonsai/event";

export type TDrive = {
  readonly application: Application;
  readonly root: Root;
  /** Addresses a Command as an independent fact would (admitted, then drained). */
  send(namespace: string, command: string, payload?: unknown): void;
  /** Asks a Query and returns its result (throws if the probe's unit failed). */
  ask<T = unknown>(namespace: string, name: string, params?: unknown): T;
  /** Events received by the probe, in order. */
  readonly received: Array<{ namespace: string; event: string; payload: unknown }>;
  /** Failed units, in order. */
  failures(): Array<Extract<TTraceEntry, { type: "unit-failed" }>>;
};

export function drive(
  features: TFeaturesManifest,
  options: {
    listen?: ReadonlyArray<{ namespace: string; event: string }>;
    components?: readonly TManifestEntry[];
    causalBound?: number;
    foundation?: ConstructorParameters<typeof Application>[0] extends infer O ? (O extends { foundation?: infer F } ? F : never) : never;
    document?: Document;
    anchor?: string;
    router?: boolean;
    adapters?: ConstructorParameters<typeof Application>[0] extends infer O ? (O extends { adapters?: infer A } ? A : never) : never;
    adapterOptions?: ConstructorParameters<typeof Application>[0] extends infer O ? (O extends { adapterOptions?: infer A } ? A : never) : never;
  } = {}
): TDrive {
  let probe!: TComponentHandle;
  const received: TDrive["received"] = [];
  let answer: { value?: unknown; done: boolean } = { done: false };

  const probeSpec: TManifestEntry = {
    name: "probe",
    ui: true,
    init: (c) => {
      probe = c.self;
    },
    listens: (options.listen ?? []).map(({ namespace, event }) => ({
      namespace,
      event,
      handler: (payload: unknown) => {
        received.push({ namespace, event, payload });
      }
    })),
    locals: {
      send: (p, c) => {
        const { namespace, command, payload } = p as { namespace: string; command: string; payload?: unknown };
        c.trigger(namespace, command, payload);
      },
      ask: (p, c) => {
        const { namespace, name, params } = p as { namespace: string; name: string; params?: unknown };
        answer = { value: c.query(namespace, name, params), done: true };
      }
    }
  };

  const application = new Application({
    features,
    components: [...(options.components ?? []), probeSpec],
    ...(options.causalBound === undefined ? {} : { causalBound: options.causalBound }),
    ...(options.foundation === undefined ? {} : { foundation: options.foundation }),
    ...(options.document === undefined ? {} : { document: options.document }),
    ...(options.anchor === undefined ? {} : { anchor: options.anchor }),
    ...(options.router === undefined ? {} : { router: options.router }),
    ...(options.adapters === undefined ? {} : { adapters: options.adapters }),
    ...(options.adapterOptions === undefined ? {} : { adapterOptions: options.adapterOptions })
  });
  application.start();
  const root = application.root!;

  const failures = (): ReturnType<TDrive["failures"]> =>
    root.trace.filter((e): e is Extract<TTraceEntry, { type: "unit-failed" }> => e.type === "unit-failed");

  return {
    application,
    root,
    received,
    failures,
    send: (namespace, command, payload) => {
      root.admit(probe, "send", { namespace, command, payload }, { kind: "independent" });
    },
    ask: <T>(namespace: string, name: string, params?: unknown): T => {
      answer = { done: false };
      const before = failures().length;
      root.admit(probe, "ask", { namespace, name, params }, { kind: "independent" });
      if (!answer.done) {
        const failed = failures().slice(before).at(-1);
        throw failed?.error ?? new Error(`Query ${namespace}:${name} produced no answer`);
      }
      return answer.value as T;
    }
  };
}
