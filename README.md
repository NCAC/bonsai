[![🇫🇷 Documentation en français](https://img.shields.io/badge/docs-français-blue)](./README.fr.md)
[![Strate 0](https://img.shields.io/badge/strate%200-delivered-success)](https://github.com/NCAC/bonsai/releases/tag/v0.1.0-strate-0)
[![Tests](https://img.shields.io/badge/tests-175%20passed-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-91%25-brightgreen)]()
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue)]()

# Bonsai Framework

> ⚠️ **Work in Progress** — strate 0 delivered (April 2026). Public API is stable for the core components; strates 1+ will add Behavior, forms, routing and SSR.

Modern TypeScript framework for opinionated frontend applications — event-driven architecture, strict unidirectional data flow, compile-time safety, and a documented "type-as-contract" philosophy.

---

## Why Bonsai

Most frontend frameworks let you _structure_ an app. Bonsai **forces** you to structure it correctly — the type system itself rejects architectures that violate the unidirectional flow.

- **One direction, no exceptions**: `View → Command → Feature → Event → View`. Views never `emit`. Features never touch the DOM. The compiler enforces it.
- **State is encapsulated**: each Feature owns exactly one Entity. Mutation goes through a single `mutate(intent, recipe)` method (Immer under the hood). No setters, no reactive proxies leaking out.
- **DX-first TypeScript**: handlers are auto-discovered by name (`onAddItemCommand`, `onCartItemAddedEvent`). No registration boilerplate, no decorators, full IntelliSense.
- **Surgical DOM**: views are rendered via Pug templates (server-side / build-time) and updated through N1 projections (`getUI("itemCount").text("3")`) — no virtual DOM, no diffing.

## Status — Strate 0 ✅

| Component                       | Status                  | Coverage |
| ------------------------------- | ----------------------- | -------- |
| `@bonsai/entity`                | 🟢 Stable               | 100 %    |
| `@bonsai/feature`               | 🟢 Stable               | 96 %     |
| `@bonsai/view`                  | 🟢 Stable               | 95 %     |
| `@bonsai/composer`              | 🟢 Stable               | 96 %     |
| `@bonsai/foundation`            | 🟢 Stable               | 89 %     |
| `@bonsai/application`           | 🟢 Stable               | 97 %     |
| `@bonsai/event` (Channel/Radio) | 🟢 Stable               | 90 %     |
| `@bonsai/behavior`              | 🟡 Stub (strate 1)      | —        |

**E2E gate** is green: a full cart round-trip (click → trigger → handle → mutate → emit → DOM) traverses the six components without a single mock. See [`tests/e2e/strate-0.cart-round-trip.test.ts`](tests/e2e/strate-0.cart-round-trip.test.ts).

## Quick taste

```ts
// Feature — owns state, handles commands, emits events
class CartFeature extends Feature<CartEntity> {
  static readonly namespace = "cart" as const;
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: TCartItem): void {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    this.emit("itemAdded", { item: payload });
  }
}

// View — DOM-only, never owns state
class CartView extends View {
  get params() { return cartViewParams; }

  // Auto-derived from uiElements.addButton + DOM event "click"
  onAddButtonClick(): void {
    this.callTrigger("cart", "addItem", { productId: "p1", qty: 1, price: 9.99 });
  }

  // Auto-derived from listened channel "cart" + event "itemAdded"
  onCartItemAddedEvent(payload: { item: TCartItem }): void {
    this.getUI("itemCount").text(String(this.#count++));
  }
}
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

→ Full architecture: [docs/rfc/RFC-0001-architecture-fondamentale.md](docs/rfc/RFC-0001-architecture-fondamentale.md)

## Repo layout

```
bonsai/
├── core/              # @bonsai/core meta-package (re-exports)
├── packages/          # 8 framework packages (one per component)
│   ├── entity/        application/  composer/  feature/
│   ├── foundation/    view/         event/     behavior/ (stub)
│   ├── error/         # invariants, Bonsai-prefixed errors
│   └── immer/  rxjs/  valibot/  types/   # third-party wrappers
├── tests/
│   ├── unit/strate-0/    # 161 tests, one folder per component
│   ├── integration/      # cross-package scenarios
│   └── e2e/              # 🚪 strate gates (one per strate)
├── lib/build/         # internal build pipeline (Rollup + .d.ts emit)
├── tools/             # build-bonsai-package, pug-to-ts-template
└── docs/
    ├── rfc/           # 4 RFCs — source of truth (French)
    └── adr/           # 38 ADRs — architectural decisions (French)
```

## Develop

### Prerequisites

- **Node.js** 23+
- **pnpm** 10+

### Common commands

```bash
pnpm install                          # install workspace
pnpm tsc:check                        # type-check only (no emit)
pnpm test                             # full test suite
pnpm test:strate-0:regression         # strate 0 regression suite
pnpm jest tests/unit/strate-0         # all strate 0 unit tests
pnpm jest tests/e2e --no-coverage     # E2E gate
pnpm test:coverage                    # coverage with HTML report
pnpm run build                        # build all packages (watch mode)
pnpm run build:no-watch               # one-shot build
```

### Quality gates

- **TypeScript strict**: `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.
- **Coverage thresholds** locked in `jest.config.ts` — any regression below the strate 0 baseline fails CI.
- **Husky pre-commit / pre-push**: ADR-0034 continuous verification.

## Documentation

Architectural documentation (RFCs, ADRs) is written in **French** — the design language of the project (see [ADR-0036](docs/adr/ADR-0036-documentation-internationalization-strategy.md)). English translations are planned for stable documents.

|             |                                                                                       |
| ----------- | ------------------------------------------------------------------------------------- |
| 📐 **RFCs** | [Source of truth](docs/rfc/README.md) — architecture, contracts, invariants            |
| 📋 **ADRs** | [38 decisions](docs/adr/README.md) — every architectural trade-off                     |
| 📖 **Guides** | [Coding conventions](docs/guides/) — TypeScript style, framework style               |
| 🚪 **Strates** | [ADR-0028](docs/adr/ADR-0028-strate-roadmap.md) — delivery roadmap & gates          |
| 🛠️ **Build** | [lib/BUILD-EN.md](lib/BUILD-EN.md), [lib/DEVELOPER-GUIDE-EN.md](lib/DEVELOPER-GUIDE-EN.md) |
| 🇫🇷          | [French version](README.fr.md)                                                         |

## License

MIT © NCAC
