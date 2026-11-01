/**
 * Navigation round trip, from the interface to the address and back (lot M6.3a)
 *
 *   click on a link → fact → View `router:navigate` → router Feature →
 *   `routeChanged` → history adapter writes the entry → View projects the route
 *   → the user goes back → independent fact → `navigate { pop }` → View projects.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Application } from "@bonsai/application";
import { HistoryAdapter, RouterFeature } from "@bonsai/router";
import { Composer, type TComposerContract, type TComposeContext, type TComposition } from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";
import {
  View,
  ui,
  type TViewContract,
  type TViewCallbacks,
  type TUIContract,
  type TUIElements,
  type TFact,
  type TFactContext,
  type TEventContext
} from "@bonsai/view";
import type { TFeatureContract } from "@bonsai/feature";
import { resetDOM, until } from "../helpers/dom-setup";

const features = {
  router: { feature: RouterFeature, listens: ["routeChanged"] as const, triggers: ["navigate"] as const, queries: ["currentRoute"] as const }
} satisfies TFeatureContract;
const uiEvents = {
  current: ui<HTMLElement>()([]),
  toA: ui<HTMLAnchorElement>()(["click"]),
  toB: ui<HTMLAnchorElement>()(["click"])
} satisfies TUIContract;
const uiElements = {
  current: "[data-ui='current']",
  toA: "[data-ui='toA']",
  toB: "[data-ui='toB']"
} satisfies TUIElements<typeof uiEvents>;
type TContract = TViewContract<typeof features, typeof uiEvents>;

class NavView extends View<TContract> implements TViewCallbacks<TContract> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  get template() {
    return `<a href="/a" data-ui="toA">A</a><a href="/b?x=1" data-ui="toB">B</a><span data-ui="current"></span>`;
  }
  onToAClick(_fact: TFact, ctx: TFactContext<TContract>): void {
    ctx.trigger("router:navigate", { location: "/a", mode: "push" });
  }
  onToBClick(_fact: TFact, ctx: TFactContext<TContract>): void {
    ctx.trigger("router:navigate", { location: "/b?x=1", mode: "push" });
  }
  onRouterRouteChangedEvent(_payload: unknown, ctx: TEventContext<TContract>): void {
    const route = ctx.query("router:currentRoute", null);
    this.getUI("current").text(`${route.path}${route.hash}`);
  }
}

const composerFeatures = { router: { feature: RouterFeature, listens: [] as const, queries: [] as const } };
const views = { nav: NavView };
type TC = TComposerContract<typeof composerFeatures, typeof views>;
class NavComposer extends Composer<TC> {
  get features() { return composerFeatures; }
  get views() { return views; }
  resolve(_ctx: TComposeContext<TC>): TComposition<TC> { return [{ view: "nav", key: "nav" }]; }
}
class Page extends Foundation {
  get composers() { return { main: { slot: "#main", composer: NavComposer } } as const; }
}

const here = (): string => window.location.pathname + window.location.search;

describe("Navigation — from the click to the address and back", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<div id="main"></div>`;
    window.history.replaceState(null, "", "/");
  });

  it("a click writes an entry and the View shows the route; the user going back is followed", async () => {
    const app = new Application({ document, foundation: Page, router: true, adapters: [HistoryAdapter] });
    app.start();
    const q = <T extends Element>(selector: string): T => document.querySelector(selector) as T;

    q<HTMLElement>("[data-ui='toA']").click();
    expect(here()).toBe("/a");
    expect(q("[data-ui='current']").textContent).toBe("/a");

    q<HTMLElement>("[data-ui='toB']").click();
    expect(here()).toBe("/b?x=1");
    expect(q("[data-ui='current']").textContent).toBe("/b");

    window.history.back(); // the user's button
    await until(() => here() === "/a");
    expect(q("[data-ui='current']").textContent).toBe("/a");

    expect(app.root!.trace.filter((t) => t.type === "unit-failed")).toEqual([]);
    app.stop();
  });
});
