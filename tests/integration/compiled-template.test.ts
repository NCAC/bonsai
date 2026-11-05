/**
 * Test — a View rendered by a compiled Pug template (strate 1c, lot 4, ADR-22)
 *
 * `todo-list.template.pug` is compiled by `pnpm pug` into the versioned
 * `todo-list.template.ts`. The View binds it to a declared Query (ADR-26):
 * the template is created with the View, re-projected after each Event of
 * `on`, its list reconciled by key and its conditional zone switched, while
 * a click on a row is admitted with the key of the row captured (ADR-23).
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drive } from "../helpers/drive";
import { resetDOM } from "../helpers/dom-setup";
import { Entity } from "@bonsai/entity";
import { Feature, type TFeatureContract, type TFeatureCallbacks, type TFeatureContext } from "@bonsai/feature";
import type { TChannelToken } from "@bonsai/kernel";
import { Composer, type TComposerContract, type TComposeContext, type TComposition } from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";
import {
  View,
  ui,
  bind,
  type TViewContract,
  type TViewCallbacks,
  type TViewTemplates,
  type TUIContract,
  type TUIElements,
  type TFact,
  type TFactContext
} from "@bonsai/view";
import { compilePug } from "@tools/pug-compiler/src/bonsai-pug";
import { TodoListTemplate } from "../fixtures/templates/todo-list.template";
import type { TTodo } from "../fixtures/templates/todo.types";

const FIXTURE = join(__dirname, "../fixtures/templates/todo-list.template.pug");

class TodoEntity extends Entity<{ todos: TTodo[] }> {
  protected defineInitialState() {
    return {
      todos: [
        { id: "t1", title: "one", done: false },
        { id: "t2", title: "two", done: true },
        { id: "t3", title: "three", done: false }
      ]
    };
  }
}
type TTodoDef = {
  commands: { remove: { id: string }; toggle: { id: string } };
  events: { changed: null };
  queries: { todos: { params: null; result: readonly TTodo[] } };
};
class TodoFeature
  extends Feature<TodoEntity, TTodoDef, "todo">
  implements TFeatureCallbacks<TTodoDef, readonly [], TodoEntity>
{
  static readonly channel: TChannelToken<TTodoDef, "todo"> = { namespace: "todo", events: ["changed"] };
  get listens() { return [] as const; }
  get queries() { return [] as const; }
  protected get Entity() { return TodoEntity; }
  onRemoveCommand(payload: { id: string }, ctx: TFeatureContext<TTodoDef, TodoEntity>): void {
    ctx.mutate("remove", (d) => { d.todos = d.todos.filter((t) => t.id !== payload.id); });
    ctx.emit("changed", null);
  }
  onToggleCommand(payload: { id: string }, ctx: TFeatureContext<TTodoDef, TodoEntity>): void {
    ctx.mutate("toggle", (d) => {
      const todo = d.todos.find((t) => t.id === payload.id);
      if (todo !== undefined) todo.done = !todo.done;
    });
    ctx.emit("changed", null);
  }
  onTodosQuery(): readonly TTodo[] { return this.entity.state.todos; }
}

const features = {
  todo: { feature: TodoFeature, listens: ["changed"] as const, triggers: ["remove", "toggle"] as const, queries: ["todos"] as const }
} satisfies TFeatureContract;
const uiEvents = {
  list: ui<HTMLDivElement>()([]),
  remove: ui<HTMLButtonElement>()(["click"], { data: ["itemId"] }),
  title: ui<HTMLElement>()(["click"], { data: ["itemId"] })
} satisfies TUIContract;
const uiElements = { list: "[data-ui='list']", remove: ".remove", title: ".title" } satisfies TUIElements<typeof uiEvents>;
type TContract = TViewContract<typeof features, typeof uiEvents>;

const templates = {
  list: bind<TContract>()({
    template: TodoListTemplate,
    query: "todo:todos",
    params: null,
    on: ["todo:changed"],
    select: (todos) => ({ todos })
  })
} as const;

class TodoView extends View<TContract> implements TViewCallbacks<TContract, typeof templates> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  get template() { return `<div data-ui="list"></div>`; }
  override get templates(): TViewTemplates<TContract> { return templates; }

  onRemoveClick(fact: TFact<"itemId">, ctx: TFactContext<TContract>): void {
    if (fact.data.itemId !== null) ctx.trigger("todo:remove", { id: fact.data.itemId });
  }
  onTitleClick(fact: TFact<"itemId">, ctx: TFactContext<TContract>): void {
    if (fact.data.itemId !== null) ctx.trigger("todo:toggle", { id: fact.data.itemId });
  }
}

const mount = () => {
  const composerFeatures = { todo: { feature: TodoFeature, listens: [] as const, queries: [] as const } };
  const composerViews = { todo: TodoView };
  type TC = TComposerContract<typeof composerFeatures, typeof composerViews>;
  class Host extends Composer<TC> {
    get features() { return composerFeatures; }
    get views() { return composerViews; }
    resolve(_ctx: TComposeContext<TC>): TComposition<TC> { return [{ view: "todo", key: "t" }]; }
  }
  class Page extends Foundation {
    get composers() { return { main: { slot: "#main", composer: Host } } as const; }
  }
  return drive({ todo: TodoFeature }, { foundation: Page, document });
};

const rows = () =>
  Array.from(document.querySelectorAll("li")).map((li) => `${li.getAttribute("data-item-id")}:${li.getAttribute("data-state")}:${li.querySelector("s") === null ? "" : "~"}${li.querySelector(".title")!.textContent}`);
const row = (id: string) => document.querySelector(`li[data-item-id='${id}']`) as HTMLElement;

describe("A View rendered by a compiled Pug template", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<div id="main"></div>`;
  });

  it("the versioned module is the compilation of the template (pnpm pug:check)", () => {
    const generated = compilePug(readFileSync(FIXTURE, "utf-8"), { filename: FIXTURE });
    expect(readFileSync(FIXTURE.replace(/\.pug$/, ".ts"), "utf-8")).toBe(generated);
  });

  it("creation projects the result of the Query through select", () => {
    const d = mount();
    expect(rows()).toEqual(["t1:open:one", "t2:done:~two", "t3:open:three"]);
    expect(document.querySelector("ul")!.getAttribute("data-count")).toBe("3");
    expect(d.failures()).toEqual([]);
  });

  it("an Event re-projects: the zone of the item switches, the other rows keep their nodes", () => {
    const d = mount();
    const [t1, t2, t3] = ["t1", "t2", "t3"].map(row);
    (row("t1").querySelector(".title") as HTMLElement).click();
    expect(rows()).toEqual(["t1:done:~one", "t2:done:~two", "t3:open:three"]);
    expect([row("t1"), row("t2"), row("t3")]).toEqual([t1, t2, t3]);
    expect(d.failures()).toEqual([]);
  });

  it("removing an item reconciles the list by key", () => {
    const d = mount();
    const t3 = row("t3");
    (row("t2").querySelector(".remove") as HTMLElement).click();
    expect(rows()).toEqual(["t1:open:one", "t3:open:three"]);
    expect(row("t3")).toBe(t3);
    expect(document.querySelector("ul")!.getAttribute("data-count")).toBe("2");
    expect(d.failures()).toEqual([]);
  });
});
