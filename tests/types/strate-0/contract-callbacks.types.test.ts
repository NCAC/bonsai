/**
 * Type tests — Contract/Callbacks symmetry (compile-time).
 *
 * Covers:
 *   I88 — every package that exposes a `T{Component}Contract` also exposes the
 *         matching `T{Component}Callbacks`, which derives the required handlers
 *         from it. The imports below fail to compile if either half of a pair
 *         disappears from a package's public API; each `@ts-expect-error`
 *         locks that the callbacks are really derived from the contract.
 *
 * The handler-by-handler coverage is proven elsewhere:
 *   Feature → feature-callbacks.types.test.ts (I92)
 *   View    → view-contract.types.test.ts (I84)
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import type { TChannelToken } from "@bonsai/event";
import type { TFeatureCallbacks, TFeatureContract } from "@bonsai/feature";
import { ui, type TUIContract, type TViewCallbacks, type TViewContract } from "@bonsai/view";

// ─── Fixtures ────────────────────────────────────────────────────────────────

type TCartChannelDef = {
  commands: { addItem: { id: string } };
  events: { itemAdded: { id: string } };
  requests: Record<never, never>;
};

const cartListens = [
  null as unknown as TChannelToken<TCartChannelDef, "cart">
] as const;

const saveUi = {
  saveBtn: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;

type TSaveViewContract = TViewContract<Record<never, never>, typeof saveUi>;

// ─── Feature : TFeatureContract ↔ TFeatureCallbacks ──────────────────────────

describe("Contract/Callbacks symmetry — I88", () => {
  it("Feature: both halves of the pair are exposed by @bonsai/feature", () => {
    type TContract = TFeatureContract;
    type TCallbacks = TFeatureCallbacks<TCartChannelDef, typeof cartListens>;
    const _contract: TContract | null = null;
    const _callbacks: TCallbacks | null = null;
    void _contract;
    void _callbacks;
  });

  it("Feature: callbacks require the handlers derived from the definition", () => {
    // @ts-expect-error — onAddItemCommand (derived from `commands.addItem`) is missing
    class _MissingHandlers implements TFeatureCallbacks<TCartChannelDef, readonly []> {}
    void _MissingHandlers;
  });

  // ─── View : TViewContract ↔ TViewCallbacks ─────────────────────────────────

  it("View: both halves of the pair are exposed by @bonsai/view", () => {
    type TContract = TViewContract;
    type TCallbacks = TViewCallbacks<TViewContract>;
    const _contract: TContract | null = null;
    const _callbacks: TCallbacks | null = null;
    void _contract;
    void _callbacks;
  });

  it("View: callbacks require the DOM handlers derived from the contract", () => {
    // @ts-expect-error — onSaveBtnClick (derived from `saveBtn: ["click"]`) is missing
    const _missing: TViewCallbacks<TSaveViewContract> = {};
    const _complete: TViewCallbacks<TSaveViewContract> = {
      onSaveBtnClick: (_e: MouseEvent) => {}
    };
    void _missing;
    void _complete;
  });
});
