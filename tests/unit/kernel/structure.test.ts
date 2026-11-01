/**
 * Discriminating tests of the kernel prototype, lot M3: transactional
 * structure — distributable resources, parts, designations, bottom-up
 * restitutions, cancellation keeping the same occurrences and parts.
 * No DOM: parts are modelled abstractly (6.3–6.6).
 */

import { describe, expect, it } from "@jest/globals";
import {
  Root,
  TransportError,
  type TComponentHandle,
  type TComponentSpec,
  type TCorrelationToken,
  type TDesignation,
  type TResourceHandle
} from "../../../packages/event/src/kernel";

const click = { kind: "independent" } as const;

function failures(root: Root): TransportError[] {
  return root.trace.filter((e) => e.type === "unit-failed").map((e) => (e as { error: unknown }).error as TransportError);
}

/**
 * Foundation (admits "body") → Composer (part "main") → view-a, view-b
 * (parts "a", "b" of the slot). view-b has its own sub-Composer on a part
 * "slot" of view-b's part. Everything a test needs is recorded in `state`.
 */
function setup() {
  const log: string[] = [];
  const designations: Record<string, TDesignation> = {};
  const tokens: Record<string, TCorrelationToken> = {};
  const h: { foundation?: TComponentHandle; composer?: TComponentHandle; a?: TComponentHandle; b?: TComponentHandle } = {};
  let slot!: TResourceHandle;

  const view = (name: string, withSubComposer = false): TComponentSpec => ({
    name,
    init: (c) => {
      designations[name] = c.designation()!;
      const part = c.resolve(c.designation()!);
      log.push(`${name} resolves ${part.label}`);
      if (withSubComposer) c.create({ name: `${name}-sub`, init: (cc) => { cc.resolve(cc.designation()!); } }, { part: { resource: part, portion: "slot" } });
    },
    locals: {
      probe: (_p, c) => { log.push(`${name} probe ${c.resolve(c.designation()!).label}`); },
      steal: (p, c) => { c.resolve(p as TDesignation); },
      arm: (_p, c) => { tokens[name] = c.correlate(); },
      result: () => { log.push(`${name} result`); }
    }
  });

  const composer: TComponentSpec = {
    name: "composer",
    init: (c) => {
      slot = c.resolve(c.designation()!);
      h.a = c.create(view("view-a"), { part: { resource: slot, portion: "a" } });
      h.b = c.create(view("view-b", true), { part: { resource: slot, portion: "b" } });
    },
    locals: {
      overlap: (_p, c) => { c.create(view("intruder"), { part: { resource: slot, portion: "a" } }); },
      swap: (_p, c) => {
        c.destroy(h.a!);
        h.a = c.create(view("view-a2"), { part: { resource: slot, portion: "a" } });
      },
      destroyThenFail: (_p, c) => { c.destroy(h.a!); throw new Error("cancel"); },
      list: (_p, c) => { log.push(`attributed ${c.attributed(slot).join(",")}`); }
    }
  };

  const root = new Root({ causalBound: 20 });
  root.start((ctx) => {
    h.foundation = ctx.create({
      name: "foundation",
      init: (c) => {
        const body = c.admitDistributable("body");
        h.composer = c.create(composer, { part: { resource: body, portion: "main" } });
      },
      locals: { drop: (_p, c) => { c.destroy(h.composer!); } }
    });
  });
  return { root, log, designations, tokens, h };
}

describe("M3 — parts and attribution (6.5, T7, A1.b)", () => {
  it("attributes disjoint parts; each View resolves its own designation", () => {
    const { log } = setup();
    expect(log).toEqual(["view-a resolves body/main/a", "view-b resolves body/main/b"]);
  });

  it("refuses to attribute a portion already attributed (T7)", () => {
    const { root, log, h } = setup();
    root.admit(h.composer!, "overlap", {}, click);
    expect(failures(root)[0]!.code).toBe("PORTION_TAKEN");
    root.admit(h.composer!, "list", {}, click);
    expect(log.at(-1)).toBe("attributed a,b");
  });

  it("refuses to attribute a portion of a resource the creator does not own (A1.b)", () => {
    const root = new Root({ causalBound: 10 });
    let stolen!: TResourceHandle;
    let thief!: TComponentHandle;
    root.start((ctx) => {
      ctx.create({ name: "owner", init: (c) => { stolen = c.admitDistributable("body"); } });
      thief = ctx.create({ name: "thief", locals: { go: (_p, c) => { c.create({ name: "x" }, { part: { resource: stolen, portion: "p" } }); } } });
    });
    root.admit(thief, "go", {}, click);
    expect(failures(root)[0]!.code).toBe("NOT_OWNER");
  });
});

describe("M3 — designations (8.5, 9.10)", () => {
  it("refuses to resolve another component's designation", () => {
    const { root, designations, h } = setup();
    root.admit(h.a!, "steal", designations["view-b"], click);
    expect(failures(root)[0]!.code).toBe("INVALID_DESIGNATION");
  });

  it("does not reactivate an old designation when the same portion is attributed again", () => {
    const { root, log, designations, h } = setup();
    const old = designations["view-a"]!;
    root.admit(h.composer!, "swap", {}, click);
    expect(log.at(-1)).toBe("view-a2 resolves body/main/a");
    expect(designations["view-a2"]!.attribution).not.toBe(old.attribution);
    root.admit(h.a!, "steal", old, click);                    // h.a is now view-a2
    expect(failures(root)[0]!.code).toBe("INVALID_DESIGNATION");
  });
});

describe("M3 — cascade and restitutions (T3, §2.5)", () => {
  it("returns portions bottom-up, each imputed to the container's owner still present", () => {
    const { root, h } = setup();
    root.admit(h.foundation!, "drop", {}, click);
    const restitutions = root.trace.filter((e) => e.type === "restitution").map((e) => e.type === "restitution" && `${e.endedOwner} → ${e.imputedTo}`);
    expect(restitutions).toEqual([
      "view-a → composer",
      "view-b-sub → view-b",
      "view-b → composer",
      "composer → foundation"
    ]);
  });
});

describe("M3 — cancellation keeps the same structure (C.2, C.7)", () => {
  it("keeps the same occurrence, part and designation after a cancelled destruction", () => {
    const { root, log, h } = setup();
    const before = h.a!;
    root.admit(h.composer!, "destroyThenFail", {}, click);
    expect(failures(root)).toHaveLength(1);
    root.admit(before, "probe", {}, click);                     // same occurrence still alive
    expect(log.at(-1)).toBe("view-a probe body/main/a");        // same part, designation still valid
    root.admit(h.composer!, "list", {}, click);
    expect(log.at(-1)).toBe("attributed a,b");
    expect(root.trace.some((e) => e.type === "restitution")).toBe(false); // provisional restitutions never published
  });
});

describe("M3 — late callbacks (C.2)", () => {
  it("neither revives a destroyed View nor redirects its result to the new View at the same portion", () => {
    const { root, log, tokens, h } = setup();
    const old = h.a!;
    root.admit(old, "arm", {}, click);
    root.admit(h.composer!, "swap", {}, click);
    root.admit(old, "result", {}, { kind: "correlated", token: tokens["view-a"]! });
    root.admit(h.a!, "result", {}, { kind: "correlated", token: tokens["view-a"]! });
    expect(log.filter((l) => l.endsWith("result"))).toEqual([]);
    expect(root.trace.filter((e) => e.type === "admission-abandoned").map((e) => e.type === "admission-abandoned" && e.reason)).toEqual([
      "occurrence no longer alive",
      "result routed to another occurrence"
    ]);
  });
});

describe("M3 — creation parameters (6.2, A3.d)", () => {
  it("captures parameters by copy and refuses a reference", () => {
    const root = new Root({ causalBound: 10 });
    let received: unknown;
    let parent!: TComponentHandle;
    root.start((ctx) => {
      parent = ctx.create({
        name: "parent",
        init: (c) => { c.create({ name: "child", init: (cc) => { received = cc.params(); } }, { params: { productId: 42 } }); },
        locals: { bad: (_p, c) => { c.create({ name: "child2" }, { params: { onDone: () => 0 } }); } }
      });
    });
    expect(received).toEqual({ productId: 42 });
    expect(Object.isFrozen(received)).toBe(true);
    root.admit(parent, "bad", {}, click);
    expect(failures(root)[0]!.code).toBe("NOT_CAPTURABLE");
  });
});
