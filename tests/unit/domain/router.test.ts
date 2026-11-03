/**
 * Test — navigation and history adapter on the kernel (lot M6.3a)
 *
 * The probe of `drive` plays the user interface: a Command it addresses is a
 * reaction to an independent fact, so it has the right to command (D18).
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { Application } from "@bonsai/application";
import { HistoryAdapter, RouterFeature, RouteEntity, parseLocation, serializeRoute, canonicalLocation, type TRoute } from "@bonsai/router";
import type { TComponentHandle } from "@bonsai/kernel";
import { drive, type TDrive } from "../../helpers/drive";
import { until } from "../../helpers/dom-setup";

const tick = (ms = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const here = (): string => window.location.pathname + window.location.search + window.location.hash;

let current: TDrive | null = null;
const start = (
  options: { adapters?: (typeof HistoryAdapter)[]; timeout?: number; router?: boolean } = {}
): TDrive => {
  current = drive(
    {},
    {
      document,
      router: options.router ?? true,
      adapters: options.adapters ?? [HistoryAdapter],
      ...(options.timeout === undefined ? {} : { adapterOptions: { history: { traversalTimeoutMs: options.timeout } } }),
      listen: [
        { namespace: "router", event: "routeChanged" },
        { namespace: "history", event: "navigated" },
        { namespace: "history", event: "requestResult" },
        { namespace: "history", event: "refreshed" },
        { namespace: "history", event: "failed" }
      ]
    }
  );
  return current;
};
const events = (d: TDrive, event: string) => d.received.filter((r) => r.event === event).map((r) => r.payload as Record<string, unknown>);
const route = (d: TDrive): TRoute => d.ask<TRoute>("router", "currentRoute", null);

describe("Locations", () => {
  it("parse and serialize in one canonical form", () => {
    expect(parseLocation("/products/42?tab=2&x=1#top")).toEqual({ path: "/products/42", query: { tab: "2", x: "1" }, hash: "#top" });
    expect(serializeRoute({ path: "/a", query: {}, hash: "" })).toBe("/a");
    expect(canonicalLocation("/a?b=1#")).toBe("/a?b=1");
  });
  it("refuses what is not a location of the application", () => {
    for (const bad of ["products", "//evil.example/x", "https://evil.example/", ""]) expect(() => parseLocation(bad)).toThrow(/not a location/);
  });
});

describe("Navigation on the kernel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("the address found at startup enters the model as an independent fact", () => {
    window.history.replaceState(null, "", "/products/42?tab=2#top");
    const d = start();
    expect(route(d)).toEqual({ path: "/products/42", query: { tab: "2" }, hash: "#top" });
    expect(d.ask<{ location: string; mode: string }>("history", "location", null)).toMatchObject({ location: "/products/42?tab=2#top" });
    expect(d.failures()).toEqual([]);
    d.application.stop();
  });

  it("a push writes a new entry, even at the address that is already shown (B.5)", () => {
    const d = start();
    const before = window.history.length;
    d.send("router", "navigate", { location: "/a", mode: "push" });
    expect(here()).toBe("/a");
    expect(window.history.length).toBe(before + 1);
    d.send("router", "navigate", { location: "/a", mode: "push" });
    expect(window.history.length).toBe(before + 2);
    expect(route(d).path).toBe("/a");
    expect(events(d, "requestResult").map((e) => e.operation)).toEqual(["push", "push"]);
    expect(d.failures()).toEqual([]);
    d.application.stop();
  });

  it("a replace at the address already shown writes nothing; at another address it replaces the entry", () => {
    const d = start();
    d.send("router", "navigate", { location: "/a", mode: "push" });
    const push = jest.spyOn(window.history, "pushState");
    const replace = jest.spyOn(window.history, "replaceState");
    const length = window.history.length;
    d.send("router", "navigate", { location: "/a", mode: "replace" });
    expect(replace).not.toHaveBeenCalled();
    d.send("router", "navigate", { location: "/b", mode: "replace" });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
    expect(here()).toBe("/b");
    d.application.stop();
  });

  it("the domain state follows the observation: query and fragment included", () => {
    const d = start();
    d.send("router", "navigate", { location: "/s?q=bonsai&page=2#r", mode: "push" });
    expect(route(d)).toEqual({ path: "/s", query: { q: "bonsai", page: "2" }, hash: "#r" });
    expect(here()).toBe("/s?q=bonsai&page=2#r");
    expect(d.ask<{ location: string; mode: string }>("history", "location", null)).toMatchObject({ location: "/s?q=bonsai&page=2#r", mode: "push" });
    d.application.stop();
  });

  it("a user going back is an independent fact: relayed as `pop`, and the adapter writes nothing (B.5)", async () => {
    const d = start();
    d.send("router", "navigate", { location: "/a", mode: "push" });
    d.send("router", "navigate", { location: "/b", mode: "push" });
    const push = jest.spyOn(window.history, "pushState");
    const replace = jest.spyOn(window.history, "replaceState");
    window.history.back(); // a raw host operation: the user's button, not the model's
    await until(() => route(d).path === "/a");
    expect(route(d).path).toBe("/a");
    expect(events(d, "routeChanged").at(-1)).toMatchObject({ mode: "pop", route: { path: "/a" } });
    expect(events(d, "navigated").at(-1)).toMatchObject({ location: "/a", mode: "pop", classification: "independent" });
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(d.failures()).toEqual([]);
    d.application.stop();
  });

  it("a redirection after a traversal replaces the entry instead of adding one", async () => {
    const d = start();
    d.send("router", "navigate", { location: "/admin", mode: "push" });
    d.send("router", "navigate", { location: "/other", mode: "push" });
    window.history.back();
    await until(() => here() === "/admin");
    const length = window.history.length;
    d.send("router", "navigate", { location: "/login", mode: "replace" }); // the domain's answer to a protected address
    expect(here()).toBe("/login");
    expect(window.history.length).toBe(length);
    d.application.stop();
  });

  it("history:back requested by the interface is a continuation: the result keeps the right of the click", async () => {
    const d = start();
    d.send("router", "navigate", { location: "/a", mode: "push" });
    d.send("router", "navigate", { location: "/b", mode: "push" });
    d.send("history", "back");
    await until(() => route(d).path === "/a");
    expect(here()).toBe("/a");
    expect(events(d, "navigated").at(-1)).toMatchObject({ classification: "correlated" });
    expect(route(d).path).toBe("/a"); // relayed: the requesting reaction was entitled to command
    d.application.stop();
  });

  it("two traversals engaged at once cannot be told apart: unknown antecedent, nothing relayed (C.4, D18)", async () => {
    const d = start();
    for (const p of ["/a", "/b", "/c"]) d.send("router", "navigate", { location: p, mode: "push" });
    d.send("history", "back");
    d.send("history", "back");
    await until(() => events(d, "navigated").some((e) => e.mode === "pop"));
    await tick(100);
    // How many notifications the host emits for two overlapping requests is the host's business; whatever it emits is unknown.
    const classes = events(d, "navigated").filter((e) => e.mode === "pop").map((e) => e.classification);
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every((c) => c === "unknown")).toBe(true);
    expect(route(d).path).toBe("/c"); // the domain was told nothing: no Command on an unknown antecedent
    expect(d.failures()).toEqual([]);
    d.application.stop();
  });

  it("a traversal that the host never notifies is given up with a `failed` Event", async () => {
    const d = start({ timeout: 15 });
    jest.spyOn(window.history, "back").mockImplementation(() => undefined); // the host does nothing, as at the first entry
    d.send("history", "back");
    await tick(60);
    expect(events(d, "failed")).toEqual([{ operation: "back", reason: "no traversal was notified by the host" }]);
    expect(events(d, "navigated").filter((e) => e.mode === "pop")).toEqual([]);
    d.application.stop();
  });

  it("a traversal given up no longer taints the independent fact that follows", async () => {
    const d = start({ timeout: 15 });
    d.send("router", "navigate", { location: "/a", mode: "push" });
    const back = jest.spyOn(window.history, "back").mockImplementation(() => undefined);
    d.send("history", "back");
    await tick(60); // window closed
    back.mockRestore();
    window.history.back(); // the user
    await until(() => events(d, "navigated").some((e) => e.mode === "pop"));
    expect(events(d, "navigated").at(-1)).toMatchObject({ classification: "independent" });
    d.application.stop();
  });

  it("history:forward and history:replace requested by the interface", async () => {
    const d = start();
    d.send("router", "navigate", { location: "/a", mode: "push" });
    d.send("router", "navigate", { location: "/b", mode: "push" });
    d.send("history", "back");
    await until(() => route(d).path === "/a");
    d.send("history", "forward");
    await until(() => route(d).path === "/b");
    expect(events(d, "navigated").at(-1)).toMatchObject({ location: "/b", mode: "pop", classification: "correlated" });

    const length = window.history.length;
    d.send("history", "replace", { location: "/c" });
    expect(here()).toBe("/c");
    expect(window.history.length).toBe(length);
    expect(d.ask<{ location: string; mode: string }>("history", "location", null)).toMatchObject({ location: "/c", mode: "replace" });
    expect(events(d, "requestResult").at(-1)).toEqual({ operation: "replace", location: "/c" });
    expect(d.failures()).toEqual([]);
    d.application.stop();
  });

  it("a host that refuses to write an entry: a `failed` Event, the observation unchanged", () => {
    const d = start();
    jest.spyOn(window.history, "pushState").mockImplementation(() => { throw new Error("quota exceeded"); });
    d.send("history", "push", { location: "/a" });
    expect(events(d, "failed")).toEqual([{ operation: "push", reason: "quota exceeded" }]);
    expect(events(d, "requestResult")).toEqual([]);
    expect(d.ask<{ location: string; mode: string }>("history", "location", null)).toMatchObject({ location: "/", mode: "initial" });
    expect(d.failures()).toEqual([]);
    d.application.stop();
  });

  it("a host that refuses a traversal fails it at once and leaves nothing engaged", async () => {
    const d = start({ timeout: 15 });
    d.send("router", "navigate", { location: "/a", mode: "push" });
    const back = jest.spyOn(window.history, "back").mockImplementation(() => { throw new Error("no entry"); });
    d.send("history", "back");
    expect(events(d, "failed")).toEqual([{ operation: "back", reason: "no entry" }]);
    await tick(60); // past the window: nothing was left engaged, no late failure
    expect(events(d, "failed")).toHaveLength(1);
    back.mockRestore();
    window.history.back(); // the user: not mistaken for the refused traversal
    await until(() => events(d, "navigated").some((e) => e.mode === "pop"));
    expect(events(d, "navigated").at(-1)).toMatchObject({ location: "/", classification: "independent" });
    d.application.stop();
  });

  it("a result whose unit fails leaves the observation as it was (G7)", () => {
    // The result of a push requested at depth 1 is admitted at depth 2: announcing it exceeds the bound.
    const d = drive({}, { document, router: true, causalBound: 2, adapters: [HistoryAdapter] });
    d.send("history", "push", { location: "/a" });
    expect(here()).toBe("/a"); // the host was written: the effect was engaged
    expect(String(d.failures()[0]!.error)).toMatch(/CAUSAL_BOUND/);
    expect(d.ask<{ location: string; mode: string; sequence: number }>("history", "location", null)).toEqual({ location: "/", mode: "initial", sequence: 1 });
    d.application.stop();
  });

  it("refresh integrates the host address and announces it", () => {
    const d = start();
    window.history.replaceState(null, "", "/moved-by-someone-else"); // not notified by the host
    expect(d.ask<{ location: string }>("history", "location", null).location).toBe("/"); // the Query never reads the host (C.5)
    d.send("history", "refresh");
    expect(d.ask<{ location: string }>("history", "location", null).location).toBe("/moved-by-someone-else");
    expect(events(d, "refreshed")).toEqual([{ location: "/moved-by-someone-else" }]);
    d.application.stop();
  });

  it("an invalid location fails the unit and writes nothing", () => {
    const d = start();
    const before = here();
    d.send("history", "push", { location: "//evil.example/x" });
    expect(d.failures()).toHaveLength(1);
    expect(here()).toBe(before);
    d.application.stop();
  });

  it("only a component of the user interface may address the adapter (A4.b)", () => {
    const d = start({ router: true });
    let domain!: TComponentHandle;
    const app = new Application({
      document,
      router: true,
      adapters: [HistoryAdapter],
      onTrace: null,
      components: [
        {
          name: "domainProbe",
          init: (c) => {
            domain = c.self;
          },
          locals: {
            go: (_p, c) => c.trigger("history", "push", { location: "/forbidden" })
          }
        }
      ]
    });
    app.start();
    app.root!.admit(domain, "go", null, { kind: "independent" });
    const failed = app.root!.trace.filter((t) => t.type === "unit-failed");
    expect(String((failed[0] as { error: Error }).error.message)).toMatch(/A4\.b/);
    expect(here()).not.toBe("/forbidden");
    app.stop();
    d.application.stop();
  });

  it("a subclass may normalize detached locations, nothing else (B.4)", () => {
    class Slashless extends HistoryAdapter {
      protected override normalize(location: string): string {
        return location.length > 1 ? location.replace(/\/+$/, "") : location;
      }
    }
    const d = start({ adapters: [Slashless as typeof HistoryAdapter] });
    d.send("router", "navigate", { location: "/a/", mode: "push" });
    expect(here()).toBe("/a");
    d.application.stop();
  });

  it("stop() removes the host observers: a later traversal is no longer admitted", async () => {
    const d = start();
    d.send("router", "navigate", { location: "/a", mode: "push" });
    d.send("router", "navigate", { location: "/b", mode: "push" });
    d.application.stop();
    window.history.back();
    await until(() => here() === "/a");
    await tick(50);
    expect(events(d, "navigated").filter((e) => e.mode === "pop")).toEqual([]);
  });

  it("the Manifest refuses an adapter without the Feature it needs, and two adapters of one category", () => {
    expect(() => new Application({ document, adapters: [HistoryAdapter] })).toThrow(/needs the Feature "router"/);
    expect(() => new Application({ document, router: true, adapters: [HistoryAdapter, HistoryAdapter] })).toThrow(/two adapters of the category "history"/);
    expect(() => new Application({ router: true, adapters: [HistoryAdapter] })).toThrow(/need the host `document`/);
  });

  it("a document without a window gives no history to adapt: refused when the adapter is described", () => {
    const detached = document.implementation.createHTMLDocument("detached"); // defaultView is null
    const app = new Application({ document: detached, router: true, adapters: [HistoryAdapter], onTrace: null });
    expect(() => app.start()).toThrow(/the document has no window: the history is not reachable/);
  });

  it("the router Feature consults no other Feature and starts at the root location (D15)", () => {
    const router = new RouterFeature("router");
    expect([router.listens, router.queries]).toEqual([[], []]);
    expect(new RouteEntity().initialState).toEqual({ path: "/", query: {}, hash: "" });
  });

  it("`router` stays reserved for application Features", () => {
    const app = new Application({ features: { router: class {} as never } });
    expect(() => app.start()).toThrow(/reserved/);
  });
});
