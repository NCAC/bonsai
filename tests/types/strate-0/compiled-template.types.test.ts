/**
 * Type tests — a compiled Pug template is typed by its `//- @data`
 * (strate 1c, lot 4, ADR-22, ADR-26)
 *
 * The compiler copies the declared type into the generated module and
 * TypeScript checks every expression of the template against it; `bind<TVC>()`
 * then checks that the output of `select` is that type.
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { type TChannelToken } from "@bonsai/kernel";
import type { TFeatureContract } from "@bonsai/feature";
import { ui, bind, type TViewContract, type TUIContract, type TProjectionTemplate } from "@bonsai/view";
import { TodoListTemplate, type TTodoListTemplateData } from "../../fixtures/templates/todo-list.template";
import type { TTodo, TTodoListData } from "../../fixtures/templates/todo.types";

type TTodoDef = {
  readonly commands: Record<string, never>;
  readonly events: { changed: null };
  readonly queries: { todos: { params: null; result: readonly TTodo[] }; count: { params: null; result: number } };
};
class TodoFeature {
  static readonly channel: TChannelToken<TTodoDef, "todo"> = { namespace: "todo" };
}
const features = {
  todo: { feature: TodoFeature, listens: ["changed"] as const, triggers: [] as const, queries: ["todos", "count"] as const }
} satisfies TFeatureContract;
const uiEvents = { list: ui<HTMLElement>()([]) } satisfies TUIContract;
type TC = TViewContract<typeof features, typeof uiEvents>;

// The exported data type is the declared one.
const _data: TTodoListTemplateData = { todos: [] } satisfies TTodoListData;
const _template: TProjectionTemplate<TTodoListData> = TodoListTemplate;

const _ok = bind<TC>()({
  template: TodoListTemplate,
  query: "todo:todos",
  params: null,
  on: ["todo:changed"],
  select: (todos) => ({ todos })
});

const _ko_shape = bind<TC>()({
  template: TodoListTemplate,
  query: "todo:todos",
  params: null,
  on: ["todo:changed"],
  // @ts-expect-error — the template reads { todos }, not the bare array
  select: (todos) => todos
});

// @ts-expect-error — without select, the result of todo:count (number) is not the data of the template
const _ko_query = bind<TC>()({ template: TodoListTemplate, query: "todo:count", params: null, on: ["todo:changed"] });

const _ko_item = bind<TC>()({
  template: TodoListTemplate,
  query: "todo:todos",
  params: null,
  on: ["todo:changed"],
  // @ts-expect-error — an item without `done`, read by the template
  select: (todos) => ({ todos: todos.map(({ id, title }) => ({ id, title })) })
});

describe("compiled template types (strate 1c, lot 4)", () => {
  it("compile-time checks only", () => {
    void [_data, _template, _ok, _ko_shape, _ko_query, _ko_item];
  });
});
