/**
 * Type tests — values captured with a fact (strate 1c, lot 3, ADR-23)
 *
 * `ui<TEl>()(events, { data })` declares the names; the required DOM handler
 * receives `TFact<names>`, whose `data` is typed by them.
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { type TChannelToken } from "@bonsai/kernel";
import type { TFeatureContract } from "@bonsai/feature";
import {
  View,
  ui,
  ProjectionList,
  type TViewContract,
  type TViewCallbacks,
  type TUIContract,
  type TUIElements,
  type TUIEntryHandlers,
  type TFact
} from "@bonsai/view";

type TDef = { readonly commands: { remove: { id: string } }; readonly events: {}; readonly queries: {} };
class ListFeature {
  static readonly channel: TChannelToken<TDef, "list"> = { namespace: "list" };
}
const features = {
  list: { feature: ListFeature, listens: [] as const, triggers: ["remove"] as const, queries: [] as const }
} satisfies TFeatureContract;

const uiEvents = {
  remove: ui<HTMLButtonElement>()(["click"], { data: ["itemId"] }),
  plain: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;
const uiElements = { remove: ".remove", plain: ".plain" } satisfies TUIElements<typeof uiEvents>;
type TC = TViewContract<typeof features, typeof uiEvents>;

// The data names are kept literally in the entry.
const _names: readonly "itemId"[] | undefined = uiEvents.remove.data;

// The handler receives the typed data: string | null.
type TRemoveFact = Parameters<TUIEntryHandlers<"remove", typeof uiEvents.remove, TC>["onRemoveClick"]>[0];
const _read = (fact: TRemoveFact): string | null => fact.data.itemId;
// @ts-expect-error — a name the key does not capture
const _readUnknown = (fact: TRemoveFact): unknown => fact.data.rowId;
// `null` cannot be rejected here: no tsconfig enables strictNullChecks (CLAUDE.md).

// A key without capture: data is empty.
type TPlainFact = Parameters<TUIEntryHandlers<"plain", typeof uiEvents.plain, TC>["onPlainClick"]>[0];
// @ts-expect-error — nothing captured on "plain"
const _readPlain = (fact: TPlainFact): unknown => fact.data.itemId;

// @ts-expect-error — data names are strings
const _ko_names = ui<HTMLButtonElement>()(["click"], { data: [1] });

class ListView extends View<TC> implements TViewCallbacks<TC> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  onRemoveClick(_fact: TFact<"itemId">): void {}
  onPlainClick(_fact: TFact): void {}
}

// ProjectionList: options typed by the item and its nodes.
const _list = (ul: HTMLElement) =>
  new ProjectionList<{ id: string }, { label: HTMLElement }>(ul, {
    keyAttr: "data-item-id",
    key: (item) => item.id,
    create: () => document.createElement("li"),
    setup: (el) => ({ label: el }),
    // @ts-expect-error — nodes are typed by setup
    update: (nodes) => nodes.missing
  });

describe("Captured data — compile-time (ADR-23)", () => {
  it("typed names, typed handler data, typed ProjectionList options", () => {
    void [_names, _read, _readUnknown, _readPlain, _ko_names, ListView, _list];
  });
});
