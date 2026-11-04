/**
 * Test — ProjectionList, keyed reconciliation (strate 1c, lot 3, ADR-23)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { BonsaiError } from "@bonsai/error";
import { ProjectionList, type TProjectionListOptions } from "@bonsai/view";

type TRow = { id: string; label: string };
type TNodes = { label: HTMLElement };

const log: string[] = [];

const options: TProjectionListOptions<TRow, TNodes> = {
  keyAttr: "data-item-id",
  key: (row) => row.id,
  create: (row) => {
    log.push(`create:${row.id}`);
    const li = document.createElement("li");
    li.innerHTML = `<span class="label">${row.label}</span>`;
    return li;
  },
  setup: (el) => ({ label: el.querySelector(".label") as HTMLElement }),
  update: (nodes, row, index) => {
    log.push(`update:${row.id}@${index}`);
    if (nodes.label.textContent !== row.label) nodes.label.textContent = row.label;
  }
};

const rows = (...ids: string[]): TRow[] => ids.map((id) => ({ id, label: id.toUpperCase() }));
const keys = (ul: HTMLElement): (string | null)[] => Array.from(ul.children).map((c) => c.getAttribute("data-item-id"));

let ul: HTMLUListElement;

describe("ProjectionList (ADR-23)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<ul></ul>`;
    ul = document.querySelector("ul")!;
    log.length = 0;
  });

  it("creates items in order, sets keyAttr, and updates each with its index", () => {
    const list = new ProjectionList(ul, options);
    list.reconcile(rows("a", "b"));
    expect(keys(ul)).toEqual(["a", "b"]);
    expect(ul.textContent).toBe("AB");
    expect(log).toEqual(["create:a", "update:a@0", "create:b", "update:b@1"]);
    expect(list.nodes("b")!.label.textContent).toBe("B");
    expect(list.nodes("z")).toBeUndefined();
  });

  it("adopts the children carrying keyAttr, without recreating them (ADR-24 H3)", () => {
    ul.innerHTML = `<li data-item-id="a"><span class="label">A</span></li>\n  <li data-item-id="b"><span class="label">B</span></li>`;
    const [a, b] = Array.from(ul.children);
    const list = new ProjectionList(ul, options);
    list.reconcile(rows("a", "b"));
    expect(log).toEqual(["update:a@0", "update:b@1"]);
    expect(Array.from(ul.children)).toEqual([a, b]);
  });

  it("keeps the elements of known items: reorder, insert, remove", () => {
    const list = new ProjectionList(ul, options);
    list.reconcile(rows("a", "b", "c", "d"));
    const [a, b, , d] = Array.from(ul.children);
    log.length = 0;
    list.reconcile(rows("d", "a", "e", "b"));
    expect(keys(ul)).toEqual(["d", "a", "e", "b"]);
    const after = Array.from(ul.children);
    expect([after[0], after[1], after[3]]).toEqual([d, a, b]);
    expect(log.filter((l) => l.startsWith("create"))).toEqual(["create:e"]);
    expect(list.nodes("c")).toBeUndefined(); // removed with its nodes
  });

  it("moves only misplaced elements", () => {
    const list = new ProjectionList(ul, options);
    list.reconcile(rows("a", "b", "c"));
    const moves: string[] = [];
    const insertBefore = ul.insertBefore.bind(ul);
    ul.insertBefore = (<T extends Node>(node: T, child: Node | null): T => {
      moves.push((node as unknown as Element).getAttribute("data-item-id")!);
      return insertBefore(node, child);
    }) as typeof ul.insertBefore;
    list.reconcile(rows("a", "b", "c")); // unchanged order: no move
    expect(moves).toEqual([]);
    list.reconcile(rows("c", "a", "b")); // c to the front
    expect(moves).toEqual(["c"]);
  });

  it("updates text through the guarded update, and empties the list", () => {
    const list = new ProjectionList(ul, options);
    list.reconcile(rows("a"));
    list.reconcile([{ id: "a", label: "renamed" }]);
    expect(ul.textContent).toBe("renamed");
    list.reconcile([]);
    expect(ul.children).toHaveLength(0);
  });

  it("DUPLICATE_KEY — in the items, or among the adopted children", () => {
    const list = new ProjectionList(ul, options);
    const inItems = (() => { try { list.reconcile(rows("a", "a")); } catch (e) { return e; } })() as BonsaiError;
    expect(inItems).toBeInstanceOf(BonsaiError);
    expect(inItems.code).toBe("DUPLICATE_KEY");
    ul.innerHTML = `<li data-item-id="x"></li><li data-item-id="x"></li>`;
    expect(() => new ProjectionList(ul, options)).toThrow(/\[DUPLICATE_KEY\] ProjectionList/);
  });

  it("ignores children without keyAttr at adoption", () => {
    ul.innerHTML = `<li data-item-id="a"><span class="label">A</span></li><li class="other"></li>`;
    const list = new ProjectionList(ul, options);
    list.reconcile(rows("a"));
    expect(log).toEqual(["update:a@0"]);
  });
});
