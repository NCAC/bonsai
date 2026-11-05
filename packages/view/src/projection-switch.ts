/**
 * @bonsai/view — ProjectionSwitch: conditional zone of a template (5-rendu §8.4).
 *
 * The compiled form of a Pug `if` / `else if` / `else` chain. The active
 * branch sits between two comment markers, the start one naming it:
 *
 *   <!--bonsai-if:1--> …nodes of branch 1… <!--/bonsai-if-->
 *
 * Branch `-1` is "no branch" (an `if` without `else` whose tests all fail).
 * Like `ProjectionList`, it runs only when the projection is engaged (C.3):
 * built in `setup()`, switched in `project()`. A branch switch recreates the
 * nodes of the new branch; keeping the same branch only projects it.
 *
 * @packageDocumentation
 */

import { BonsaiError } from "@bonsai/error";

const START = /^bonsai-if:(-?\d+)$/;
const END = "/bonsai-if";

/** Locates the dynamic nodes of a branch, from its first node (`null` if empty). */
export type TSwitchSetup<TNodes> = (branch: number, first: ChildNode | null) => TNodes;

/** Builds the content of a branch, `null` for branch `-1`. */
export type TSwitchCreate = (branch: number) => Node | null;

export class ProjectionSwitch<TNodes = unknown> {
  readonly #start: Comment;
  readonly #end: Comment;
  #branch: number;
  #nodes: TNodes;

  /** Markers and content of a branch, as `create()` of a template inserts them. */
  static create(branch: number, content: Node | null): DocumentFragment {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createComment(`bonsai-if:${branch}`));
    if (content !== null) fragment.append(content);
    fragment.append(document.createComment(END));
    return fragment;
  }

  /**
   * Adopts the markers starting at `start` and the branch they enclose —
   * produced by `create()` of the template or by a server rendering (ADR-24).
   */
  constructor(start: ChildNode | null, setup: TSwitchSetup<TNodes>) {
    const match = start instanceof Comment ? START.exec(start.data) : null;
    if (match === null) throw ProjectionSwitch.#mismatch("no start marker <!--bonsai-if:N--> where the template expects one");
    this.#start = start as Comment;
    this.#end = ProjectionSwitch.#findEnd(this.#start);
    this.#branch = Number(match[1]);
    this.#nodes = setup(this.#branch, this.#first());
  }

  /** Index of the active branch, `-1` for none. */
  get branch(): number {
    return this.#branch;
  }

  /** Nodes of the active branch, as its setup located them. */
  get nodes(): TNodes {
    return this.#nodes;
  }

  /** End marker: the node after it is the next sibling of the zone. */
  get end(): Comment {
    return this.#end;
  }

  /**
   * Makes `branch` the active one. Same branch: returns its nodes, untouched.
   * Another branch: removes the current nodes, inserts the created ones,
   * renames the start marker and locates the new nodes.
   */
  project(branch: number, create: TSwitchCreate, setup: TSwitchSetup<TNodes>): TNodes {
    if (branch === this.#branch) return this.#nodes;
    let node = this.#start.nextSibling;
    while (node !== this.#end) {
      const next = node!.nextSibling;
      node!.remove();
      node = next;
    }
    const content = create(branch);
    if (content !== null) this.#end.before(content);
    this.#start.data = `bonsai-if:${branch}`;
    this.#branch = branch;
    this.#nodes = setup(branch, this.#first());
    return this.#nodes;
  }

  #first(): ChildNode | null {
    const first = this.#start.nextSibling;
    return first === this.#end ? null : first;
  }

  /** Matching end marker, skipping the zones nested at the same level. */
  static #findEnd(start: Comment): Comment {
    let depth = 0;
    for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
      if (!(node instanceof Comment)) continue;
      if (START.test(node.data)) depth++;
      else if (node.data === END) {
        if (depth === 0) return node;
        depth--;
      }
    }
    throw ProjectionSwitch.#mismatch("start marker <!--bonsai-if:N--> without its end marker <!--/bonsai-if-->");
  }

  static #mismatch(detail: string): BonsaiError {
    return new BonsaiError("TEMPLATE_MISMATCH", `the DOM does not match the template: ${detail}.`, {
      component: "ProjectionSwitch",
      suggestion: "The zone must come from create() of the same template, or from a server rendering of it."
    });
  }
}
