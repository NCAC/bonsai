/**
 * Test — ProjectionSwitch, conditional zone of a template
 * (strate 1c, lot 4, ADR-22, 5-rendu §8.4)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { BonsaiError } from "@bonsai/error";
import { ProjectionSwitch } from "@bonsai/view";

type TNodes = { el: Element } | undefined;

const log: string[] = [];
const create = (branch: number): Node | null => {
  log.push(`create:${branch}`);
  if (branch < 0) return null;
  const b = document.createElement("b");
  b.textContent = `branch ${branch}`;
  return b;
};
const setup = (branch: number, first: ChildNode | null): TNodes => {
  log.push(`setup:${branch}:${first === null ? "null" : first.nodeName}`);
  return first === null ? undefined : { el: first as Element };
};

let host: HTMLElement;

const zone = (branch: number): ProjectionSwitch<TNodes> => {
  host.append(ProjectionSwitch.create(branch, create(branch)), document.createElement("hr"));
  return new ProjectionSwitch<TNodes>(host.firstChild, setup);
};

describe("ProjectionSwitch (ADR-22)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div></div>`;
    host = document.querySelector("div")!;
    log.length = 0;
  });

  it("create() encloses the branch between markers naming it", () => {
    host.append(ProjectionSwitch.create(2, create(2)));
    expect(host.innerHTML).toBe("<!--bonsai-if:2--><b>branch 2</b><!--/bonsai-if-->");
    host.replaceChildren(ProjectionSwitch.create(-1, null));
    expect(host.innerHTML).toBe("<!--bonsai-if:-1--><!--/bonsai-if-->");
  });

  it("adopts the markers and the active branch without touching them", () => {
    const s = zone(1);
    expect(s.branch).toBe(1);
    expect(s.nodes).toEqual({ el: host.querySelector("b") });
    expect(s.end.nextSibling!.nodeName).toBe("HR");
    expect(log).toEqual(["create:1", "setup:1:B"]);
  });

  it("the same branch returns its nodes, untouched", () => {
    const s = zone(0);
    const b = host.querySelector("b");
    log.length = 0;
    expect(s.project(0, create, setup)).toEqual({ el: b });
    expect(log).toEqual([]);
  });

  it("another branch replaces the content, renames the marker, locates the new nodes", () => {
    const s = zone(0);
    log.length = 0;
    const nodes = s.project(3, create, setup);
    expect(host.innerHTML).toBe("<!--bonsai-if:3--><b>branch 3</b><!--/bonsai-if--><hr>");
    expect(nodes).toEqual({ el: host.querySelector("b") });
    expect(s.branch).toBe(3);
    expect(log).toEqual(["create:3", "setup:3:B"]);
    s.project(-1, create, setup);
    expect(host.innerHTML).toBe("<!--bonsai-if:-1--><!--/bonsai-if--><hr>");
    expect(s.nodes).toBeUndefined();
    s.project(1, create, setup);
    expect(host.innerHTML).toBe("<!--bonsai-if:1--><b>branch 1</b><!--/bonsai-if--><hr>");
  });

  it("skips the zones nested at the same level to find its end marker", () => {
    host.innerHTML = "<!--bonsai-if:0--><!--bonsai-if:0-->x<!--/bonsai-if--><!-- other --><!--/bonsai-if-->y";
    const s = new ProjectionSwitch<TNodes>(host.firstChild, () => undefined);
    expect(s.end.nextSibling!.textContent).toBe("y");
    s.project(-1, create, setup);
    expect(host.innerHTML).toBe("<!--bonsai-if:-1--><!--/bonsai-if-->y");
  });

  it.each([
    ["no node", null],
    ["an element", "<b></b>"],
    ["another comment", "<!-- x -->"],
    ["a start marker without end", "<!--bonsai-if:0--><b></b>"]
  ])("TEMPLATE_MISMATCH — %s where a zone is expected", (_label, markup) => {
    if (markup !== null) host.innerHTML = markup;
    let error: unknown;
    try {
      new ProjectionSwitch<TNodes>(host.firstChild, setup);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BonsaiError);
    expect((error as BonsaiError).code).toBe("TEMPLATE_MISMATCH");
  });
});
