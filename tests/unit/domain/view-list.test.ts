/**
 * Test — an interactive list: ProjectionList + delegation + captured item key
 * (strate 1c, lot 3, ADR-23)
 *
 * A click on a row's button is admitted by the View's part (one listener per
 * event type), carries the row key captured at admission (C.5), commands the
 * domain, and the Event re-runs the binding, which reconciles the list.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { drive } from "../../helpers/drive";
import { resetDOM } from "../../helpers/dom-setup";
import { Entity } from "@bonsai/entity";
import { Feature, type TFeatureContract, type TFeatureCallbacks, type TFeatureContext } from "@bonsai/feature";
import type { TChannelToken } from "@bonsai/kernel";
import { BonsaiError } from "@bonsai/error";
import { Composer, type TComposerContract, type TComposeContext, type TComposition } from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";
import {
  View,
  ui,
  bind,
  ProjectionList,
  type TViewContract,
  type TViewCallbacks,
  type TViewTemplates,
  type TUIContract,
  type TUIElements,
  type TFact,
  type TFactContext,
  type TProjectionTemplate
} from "@bonsai/view";

type TTodo = { id: string; title: string };

class TodoEntity extends Entity<{ todos: TTodo[] }> {
  protected defineInitialState() {
    return { todos: [{ id: "t1", title: "one" }, { id: "t2", title: "two" }, { id: "t3", title: "three" }] };
  }
}
type TTodoDef = {
  commands: { remove: { id: string }; reverse: null };
  events: { changed: null };
  queries: { todos: { params: null; result: readonly TTodo[] } };
};
const todoListens = [] as const;
class TodoFeature
  extends Feature<TodoEntity, TTodoDef, "todo">
  implements TFeatureCallbacks<TTodoDef, typeof todoListens, TodoEntity>
{
  static readonly channel: TChannelToken<TTodoDef, "todo"> = { namespace: "todo", events: ["changed"] };
  get listens() { return todoListens; }
  get queries() { return [] as const; }
  protected get Entity() { return TodoEntity; }
  onRemoveCommand(payload: { id: string }, ctx: TFeatureContext<TTodoDef, TodoEntity>): void {
    ctx.mutate("remove", (d) => { d.todos = d.todos.filter((t) => t.id !== payload.id); });
    ctx.emit("changed", null);
  }
  onReverseCommand(_p: null, ctx: TFeatureContext<TTodoDef, TodoEntity>): void {
    ctx.mutate("reverse", (d) => { d.todos.reverse(); });
    ctx.emit("changed", null);
  }
  onTodosQuery(): readonly TTodo[] { return this.entity.state.todos; }
}

const features = {
  todo: { feature: TodoFeature, listens: ["changed"] as const, triggers: ["remove", "reverse"] as const, queries: ["todos"] as const }
} satisfies TFeatureContract;
const uiEvents = {
  list: ui<HTMLUListElement>()([]),
  remove: ui<HTMLButtonElement>()(["click"], { data: ["todoId", "missing"] }),
  reverse: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;
const uiElements = {
  list: "[data-ui='list']",
  remove: ".remove",
  reverse: "[data-ui='reverse']"
} satisfies TUIElements<typeof uiEvents>;
type TContract = TViewContract<typeof features, typeof uiEvents>;

type TRowNodes = { title: HTMLElement };
const row = (todo: TTodo): HTMLElement => {
  const li = document.createElement("li");
  li.setAttribute("data-todo-id", todo.id);
  li.innerHTML = `<span class="title">${todo.title}</span><button class="remove">x</button>`;
  return li;
};
const TodoListTemplate: TProjectionTemplate<readonly TTodo[], ProjectionList<TTodo, TRowNodes>> = {
  create: (todos) => {
    const ul = document.createElement("ul");
    for (const todo of todos) ul.append(row(todo));
    return ul;
  },
  setup: (container) =>
    new ProjectionList<TTodo, TRowNodes>(container.querySelector("ul")!, {
      keyAttr: "data-todo-id",
      key: (todo) => todo.id,
      create: row,
      setup: (el) => ({ title: el.querySelector(".title") as HTMLElement }),
      update: (nodes, todo) => { if (nodes.title.textContent !== todo.title) nodes.title.textContent = todo.title; }
    }),
  project: (list, todos) => list.reconcile(todos)
};

const templates = {
  list: bind<TContract>()({ template: TodoListTemplate, query: "todo:todos", params: null, on: ["todo:changed"] })
} as const;

const facts: TFact<"todoId" | "missing">[] = [];

class TodoView extends View<TContract> implements TViewCallbacks<TContract, typeof templates> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  get template() { return `<div data-ui="list"></div><button data-ui="reverse">⇅</button>`; }
  override get templates(): TViewTemplates<TContract> { return templates; }

  onRemoveClick(fact: TFact<"todoId" | "missing">, ctx: TFactContext<TContract>): void {
    facts.push(fact);
    if (fact.data.todoId !== null) ctx.trigger("todo:remove", { id: fact.data.todoId });
  }
  onReverseClick(_fact: TFact, ctx: TFactContext<TContract>): void {
    ctx.trigger("todo:reverse", null);
  }
}

const mount = (ViewClass: typeof TodoView = TodoView) => {
  const composerFeatures = { todo: { feature: TodoFeature, listens: [] as const, queries: [] as const } };
  const composerViews = { todo: ViewClass };
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

const ids = (): (string | null)[] => Array.from(document.querySelectorAll("li[data-todo-id]")).map((li) => li.getAttribute("data-todo-id"));
const removeButton = (id: string): HTMLElement => document.querySelector(`[data-todo-id='${id}'] .remove`) as HTMLElement;

describe("Interactive list: ProjectionList + captured item key (ADR-23)", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<div id="main" data-todo-id="outside"></div>`;
    facts.length = 0;
  });

  it("C.5, I39 — the fact carries the key of the row, captured at admission; null for an absent attribute", () => {
    const d = mount();
    removeButton("t2").click();
    expect(facts[0]).toEqual({ type: "click", ui: "remove", data: { todoId: "t2", missing: null } });
    expect(Object.isFrozen(facts[0]!.data)).toBe(true);
    expect(ids()).toEqual(["t1", "t3"]);
    expect(d.failures()).toEqual([]);
  });

  it("the captured value is detached: changing the attribute afterwards changes nothing", () => {
    mount();
    removeButton("t1").click();
    const fact = facts[0]!;
    document.querySelector("[data-todo-id='t2']")!.setAttribute("data-todo-id", "zz");
    expect(fact.data.todoId).toBe("t1");
  });

  it("reconciles in place: kept rows keep their element, a reversal moves them", () => {
    const d = mount();
    const before = new Map(Array.from(document.querySelectorAll("li")).map((li) => [li.getAttribute("data-todo-id"), li]));
    (document.querySelector("[data-ui='reverse']") as HTMLElement).click();
    expect(ids()).toEqual(["t3", "t2", "t1"]);
    for (const li of Array.from(document.querySelectorAll("li"))) expect(li).toBe(before.get(li.getAttribute("data-todo-id")));
    expect(d.failures()).toEqual([]);
  });

  it("a carrier outside the part is not read: the value is null", () => {
    class Bare extends TodoView {
      override get template() { return `<div data-ui="list"></div><button data-ui="reverse">⇅</button><button class="remove">x</button>`; }
    }
    mount(Bare);
    (document.querySelector("#main [data-bonsai-part] > .remove") as HTMLElement).click();
    expect(facts[0]!.data).toEqual({ todoId: null, missing: null });
  });

  describe("O2 — captures checked when the View is described", () => {
    const refused = (entries: TUIContract): BonsaiError | undefined => {
      class Bad extends TodoView {
        override get uiEvents() { return { ...uiEvents, ...entries } as typeof uiEvents; }
      }
      try { mount(Bad); } catch (e) { return ((e as { cause?: unknown }).cause ?? e) as BonsaiError; }
      return undefined;
    };

    it("DATA_WITHOUT_EVENT — a capture on a key that declares no event", () => {
      expect(refused({ list: ui<HTMLUListElement>()([], { data: ["todoId"] }) })!.code).toBe("DATA_WITHOUT_EVENT");
    });

    it.each(["todo-id", "TodoId", "item1", ""])("MALFORMED_DATA_NAME — %j", (name) => {
      expect(refused({ remove: ui<HTMLButtonElement>()(["click"], { data: [name] }) })!.code).toBe("MALFORMED_DATA_NAME");
    });
  });

  it("ui() keeps no empty option", () => {
    expect(ui<HTMLButtonElement>()(["click"], { data: [], cancelDefault: [] })).toEqual({ events: ["click"] });
  });
});
