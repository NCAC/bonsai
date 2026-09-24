[![🇫🇷 Documentation en français](https://img.shields.io/badge/docs-français-blue)](./README.md)
[![Strate 0](https://img.shields.io/badge/strate%200-delivered-success)](https://github.com/NCAC/bonsai/releases/tag/v0.1.0-strate-0)
[![Tests](https://img.shields.io/badge/tests-267%20passed-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)]()

# Bonsai Framework

> 🇫🇷→🇬🇧 **Secondary language while the project is unreleased** — [README.md](README.md) (French) is the actively maintained source per the project's current stage; this file may lag behind. Full English documentation is planned once the project is mature enough for public exposure (ADR-34).

> ⚠️ **Work in Progress** — strate 0 delivered (April 2026). Public API is stable for the core components; strates 1+ will add Behavior, forms, routing and SSR.

Modern TypeScript framework for opinionated frontend applications — event-driven architecture, strict unidirectional data flow, compile-time safety, and a documented "type-as-contract" philosophy.

---

## Why Bonsai

Most frontend frameworks let you _structure_ an app. Bonsai **forces** you to structure it correctly — the type system itself rejects architectures that violate the unidirectional flow.

- **One direction, no exceptions**: `View → Command → Feature → Event → View`. Views never `emit`. Features never touch the DOM. The compiler enforces it.
- **State is encapsulated**: each Feature owns exactly one Entity. Mutation goes through a single `mutate(intent, recipe)` method (Immer under the hood). No setters, no reactive proxies leaking out.
- **DX-first TypeScript**: handlers are auto-discovered by name (`onAddItemCommand`, `onCartItemAddedEvent`). No registration boilerplate, no decorators, full IntelliSense.
- **Surgical DOM**: views are updated through N1 projections (`getUI("itemCount").text("3")`) — no virtual DOM, no diffing. Pug templates (N2/N3) are ⏳ strate 1c.

## Status — Strate 0 ✅

| Component                       | Status             | Coverage |
| ------------------------------- | ------------------ | -------- |
| `@bonsai/entity`                | 🟢 Stable          | 100 %    |
| `@bonsai/feature`               | 🟢 Stable          | 99 %     |
| `@bonsai/view`                  | 🟢 Stable          | 99 %     |
| `@bonsai/composer`              | 🟢 Stable          | 96 %     |
| `@bonsai/foundation`            | 🟢 Stable          | 89 %     |
| `@bonsai/application`           | 🟢 Stable          | 100 %    |
| `@bonsai/event` (Channel/Radio) | 🟢 Stable          | 94 %     |
| `@bonsai/behavior`              | ⏳ Absent (strate 2) | —      |

**E2E gate** is green: a full cart round-trip (click → trigger → handle → mutate → emit → DOM) traverses the six components without a single mock. See [`tests/e2e/strate-0.cart-round-trip.test.ts`](tests/e2e/strate-0.cart-round-trip.test.ts).

## Quick taste

```ts
// Feature — owns state, handles commands, emits events.
// Namespace comes from the typed application manifest (ADR-08) — no `static namespace`.
class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
  get listens() { return cartListens; }   // const cartListens = [] as const
  get queries() { return [] as const; }
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: TCartItem): void {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    this.emit("itemAdded", { item: payload });
  }
}

// View — modular contract (ADR-14): features + uiEvents + uiElements.
const cartViewFeatures = {
  cart: { feature: CartFeature, listens: ["itemAdded"] as const,
          triggers: ["addItem"] as const, requests: [] as const },
} satisfies TFeatureContract;

const cartViewUiEvents = {
  addButton: ui<HTMLButtonElement>()(["click"]),
  itemCount: ui<HTMLSpanElement>()([]),
} satisfies TUIContract;

const cartViewUiElements = {
  addButton: "[data-ui='addButton']",
  itemCount: "[data-ui='itemCount']",
} satisfies TUIElements<typeof cartViewUiEvents>;

type TCartViewContract = TViewContract<typeof cartViewFeatures, typeof cartViewUiEvents>;

class CartView
  extends View<TCartViewContract>
  implements TViewCallbacks<TCartViewContract>
{
  get features()   { return cartViewFeatures;   }
  get uiEvents()   { return cartViewUiEvents;   }
  get uiElements() { return cartViewUiElements; }

  #count = 0;

  // Required by `events: ["click"]` on addButton (compile-time enforced — I88).
  onAddButtonClick(): void {
    this.trigger("cart:addItem", { productId: "p1", qty: 1, price: 9.99 });
  }

  // Required by cart.listens: ["itemAdded"] (compile-time enforced — I82).
  onCartItemAddedEvent(_payload: { item: TCartItem }): void {
    this.getUI("itemCount").text(String(this.#count++));
  }
}

// Bootstrap — typed application manifest (ADR-08).
new Application({
  foundation: AppFoundation,
  features:   { cart: CartFeature } satisfies StrictManifest<{ cart: unknown }>,
}).start();
```

## Architecture in 30 seconds

```
┌─────────────────────────────────────┐
│             Application              │  ← bootstrap, namespaces
└─────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Foundation  │        │   Features   │  ← own State (Entity)
│  (composers) │        │              │     Channels (handlers)
└──────────────┘        └──────────────┘
        │                       ▲
        ▼                       │  Events
┌──────────────┐       Commands │  Replies
│   Composer   │       (trigger)│  (reply)
│  (resolves)  │                │
└──────────────┘                │
        │                       │
        ▼                       │
┌──────────────┐        ┌──────────────┐
│     View     │ ─────▶ │   Channel    │  ← Radio singleton
│  (DOM N1)    │        │ (tri-lane)   │     dispatches
└──────────────┘        └──────────────┘
```

- **Foundation** owns the page layout (`<body>` + composer slots).
- **Composer** decides which **View** mounts at runtime (with a diff on re-resolve).
- **View** observes the DOM, triggers **Commands**, listens to **Events**.
- **Channel** routes Commands / Events / Requests; **Radio** owns one Channel per Feature namespace.
- **Feature** is the only entity that **emits Events** and **owns mutable state** (its Entity).

→ Full architecture: [docs/spec/1-philosophie.md](docs/spec/1-philosophie.md)

## Repo layout

```
bonsai/
├── core/              # @bonsai/core meta-package (re-exports)
├── packages/          # 12 packages (9 components/infra + 3 wrappers)
│   ├── entity/        application/  composer/  feature/
│   ├── foundation/    view/         event/
│   ├── error/         # invariants, Bonsai-prefixed errors
│   └── immer/  rxjs/  valibot/  types/   # third-party wrappers
├── tests/
│   ├── unit/strate-0/    # strate 0: one file per component (207 tests, 82 of them replayed by the regression gate)
│   ├── integration/      # cross-package scenarios
│   └── e2e/              # 🚪 strate gates (one per strate)
├── lib/build/         # internal build pipeline (Rollup + .d.ts emit)
├── tools/             # build-bonsai-package, pug-to-ts-template
└── docs/
    ├── spec/           # specification (6 chapters) — source of truth (French)
    └── adr/           # 34 ADRs — architectural decisions (French)
```

## Develop

### Prerequisites

- **Node.js** 23 (devcontainer) — CI runs on Node 20
- **pnpm** 10+

### Common commands

```bash
pnpm install                          # install workspace
pnpm tsc:check                        # type-check lib/ only (no emit)
npx tsc --noEmit -p tsconfig.test.json # type-check packages/ + tests/ (run by hand)
pnpm test                             # full test suite
pnpm test:strate-0:regression         # strate 0 regression suite
pnpm jest tests/unit/strate-0         # all strate 0 unit tests
pnpm jest tests/e2e --no-coverage     # E2E gate
pnpm test:coverage                    # coverage with HTML report
pnpm run build                        # build all packages (watch mode)
pnpm run build:no-watch               # one-shot build
```

### Quality gates

- **TypeScript**: no `tsconfig` enables `strict` (the `Feature` contract does not compile under `strictFunctionTypes`, see ADR-14); `packages/` and `tests/` are only type-checked by `npx tsc --noEmit -p tsconfig.test.json`.
- **Coverage thresholds** locked in `jest.config.ts` — any regression below the strate 0 baseline fails CI.
- **Husky pre-commit / pre-push**: ADR-33 continuous verification.

## Documentation

Architectural documentation (spec, ADRs) is written in **French** — the design language of the project (see [ADR-34](docs/adr/ADR-34-documentation-francais.md)). English translations are planned for stable documents.

|                |                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------- |
| 📐 **Spec**    | [Source of truth](docs/spec/README.md) — architecture, contracts, invariants                  |
| 📋 **ADRs**    | [34 decisions](docs/adr/README.md) — every architectural trade-off                           |
| 📖 **Guides**  | [Coding conventions](docs/guides/) — TypeScript style, framework style                       |
| 🚪 **Strates** | [ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md) — delivery roadmap & gates  |
| 🛠️ **Build**    | [lib/BUILD-EN.md](lib/BUILD-EN.md), [lib/DEVELOPER-GUIDE-EN.md](lib/DEVELOPER-GUIDE-EN.md)   |
| 🇫🇷             | [French version](README.md) — primary language while the project is not yet publicly exposed |

## License

MIT © NCAC
