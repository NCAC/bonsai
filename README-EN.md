[![🇫🇷 Documentation en français](https://img.shields.io/badge/docs-français-blue)](./README.md)
[![Version](https://img.shields.io/badge/version-0.2.0-informational)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-435%20passed-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-100%25%20lines%20%C2%B7%2097%25%20branches-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)]()

# Bonsai Framework

> 🇫🇷→🇬🇧 **Secondary language while the project is unreleased** — [README.md](README.md) (French) is the actively maintained source; this file may lag behind. Full English documentation is planned once the project is mature enough for public exposure (ADR-34).
>
> ⚠️ **Work in Progress** — version `0.2.0` (November 2026): strate 0 delivered, execution kernel and navigation delivered, strate 1 in progress. The API is `0.x` and may still change before `1.0` (ADR-33).

TypeScript framework for opinionated frontend applications — event-driven architecture, strict unidirectional data flow, compile-time safety, and a "type-as-contract" philosophy.

---

## Why Bonsai

Most frontend frameworks _let_ you structure an app. Bonsai **forces** you to structure it correctly — the type system itself rejects architectures that violate the unidirectional flow.

- **One direction, no exceptions**: `View → Command → Feature → Event → View`. Views never emit. Features never touch the DOM. The compiler enforces it.
- **State is encapsulated**: each Feature owns exactly one Entity. Mutation goes through a single `mutate(intent, recipe)` method (Immer under the hood). No setters, no reactive proxies leaking out.
- **Transactional treatments**: every treatment runs in a validation unit. A failure undoes it entirely — state and messages — and none of its DOM effects is engaged: effects are engaged only after validation.
- **DX-first TypeScript**: handlers are auto-discovered by name (`onAddItemCommand`, `onCartItemAddedEvent`). No registration boilerplate, no decorators, full IntelliSense.
- **Surgical DOM**: views are updated through N1 projections (`getUI("total").text("9.99")`) — no virtual DOM, no diffing. Pug templates (N2/N3) are ⏳ strate 1c.

## Status

| Component | Role | Status |
| --- | --- | --- |
| `@bonsai/kernel` | Execution kernel: `Root`, validation units, deferred queue, Queries, parts, effects | 🟢 Delivered |
| `@bonsai/application` | Bootstrap from the application manifest, one root per Application | 🟢 Delivered |
| `@bonsai/feature` · `@bonsai/entity` | Business logic and state (strate 1a: patches, per-key handlers) | 🟢 Delivered |
| `@bonsai/foundation` · `@bonsai/composer` · `@bonsai/view` | Layout, composition of Views, N1 DOM projections | 🟢 Delivered |
| `@bonsai/router` | `router` Feature and history adapter | 🟢 Delivered |
| `@bonsai/behavior` | Reusable DOM behaviours | ⏳ Strate 2 |

Strates ([ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md)): strate 0 ✅ · 1a ✅ · 1b, 1c, 1d ⏳ · strate 2 ⏳.

**E2E gates** are green, without a single mock, in a real DOM (jsdom):

- [`strate-0.cart-round-trip.test.ts`](tests/e2e/strate-0.cart-round-trip.test.ts) — click → Command → mutation → Event → projection;
- [`navigation-round-trip.test.ts`](tests/e2e/navigation-round-trip.test.ts) — click on a link → route → address → the user goes back.

## Quick look

```ts
// Entity — the state of one Feature, changed only through Immer recipes.
class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

// Feature — owns the Entity, handles Commands, emits Events, answers Queries.
// The namespace comes from the application manifest key (ADR-08) — no `static namespace`.
class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens, CartEntity>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart", events: ["itemAdded"] };
  get listens() { return cartListens; }   // const cartListens = [] as const
  get queries() { return [] as const; }
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: TCartItem, ctx: TFeatureContext<TCartDef, CartEntity>): void {
    ctx.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    ctx.emit("itemAdded", { item: payload });
  }

  onTotalQuery(_params: null, _ctx: TFeatureQueryContext): number {
    return this.entity.state.total;
  }
}

// View — modular contract (ADR-14): features + uiEvents + uiElements.
const features = {
  cart: { feature: CartFeature, listens: ["itemAdded"] as const,
          triggers: ["addItem"] as const, queries: ["total"] as const },
} satisfies TFeatureContract;

const uiEvents = {
  addButton: ui<HTMLButtonElement>()(["click"]),
  total: ui<HTMLSpanElement>()([]),
} satisfies TUIContract;

const uiElements = {
  addButton: "[data-ui='addButton']",
  total: "[data-ui='total']",
} satisfies TUIElements<typeof uiEvents>;

type TCartViewContract = TViewContract<typeof features, typeof uiEvents>;

class CartView extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract> {
  get features()   { return features; }
  get uiEvents()   { return uiEvents; }
  get uiElements() { return uiElements; }
  get template()   { return `<button data-ui="addButton">Add</button> <span data-ui="total">0.00</span>`; }

  // Required by `events: ["click"]` on addButton (checked at compile time).
  onAddButtonClick(_fact: TFact, ctx: TFactContext<TCartViewContract>): void {
    ctx.trigger("cart:addItem", { productId: "p1", qty: 1, price: 9.99 });
  }

  // Required by `listens: ["itemAdded"]`; an Event handler may query, never command.
  onCartItemAddedEvent(_payload: { item: TCartItem }, ctx: TEventContext<TCartViewContract>): void {
    this.getUI("total").text(ctx.query("cart:total", null).toFixed(2));
  }
}

// Composer — decides which Views occupy its slot; Foundation — the page layout.
class MainComposer extends Composer<TComposerContract<Record<string, never>, { cart: typeof CartView }>> {
  get features() { return {}; }
  get views() { return { cart: CartView }; }
  resolve() { return [{ view: "cart" as const, key: "cart" }]; }
}
class AppFoundation extends Foundation {
  get composers() { return { main: { slot: "#main", composer: MainComposer } } as const; }
}

// Bootstrap — typed application manifest (ADR-08).
new Application({
  features: { cart: CartFeature } satisfies StrictManifest<{ cart: unknown }>,
  foundation: AppFoundation,
  document,
}).start();
```

Complete example with its imports, checked by the E2E gate: [`tests/fixtures/cart-feature.fixture.ts`](tests/fixtures/cart-feature.fixture.ts).

## Architecture in 30 seconds

```text
┌─────────────────────────────────────┐
│             Application             │  ← manifest, bootstrap
└─────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Foundation  │        │   Features   │  ← own the state (Entity),
│   (slots)    │        │              │     handle Commands and Queries
└──────────────┘        └──────────────┘
        │                    ▲      │
        ▼                    │      │
┌──────────────┐    Commands │      │ Events,
│   Composer   │     Queries │      │ answers
│  (resolve)   │             │      ▼
└──────────────┘        ┌──────────────┐
        │               │     Root     │  ← kernel root,
        ▼               │   (kernel)   │     one per Application
┌──────────────┐ ─────▶ │              │
│     View     │ ◀───── │              │
│  (DOM N1)    │        └──────────────┘
└──────────────┘
```

- **Foundation** owns the page layout: an anchor (`<body>` by default) and slots handed to Composers.
- **Composer** decides which **Views** to mount, by key, and recreates only what changed.
- **View** receives DOM facts, addresses **Commands**, listens to **Events**, asks **Queries** and projects onto the DOM.
- **Root**, the kernel root (`@bonsai/kernel`), runs every treatment in a validation unit and routes Commands, Events and Queries; one per Application, internal to the framework. A Feature's **Channel** is only a typed contract.
- **Feature** is the only component that **emits Events** and **owns mutable state** (its Entity).

→ Theory (authoritative, French): [docs/theorie.md](docs/theorie.md) · architecture: [docs/spec/1-philosophie.md](docs/spec/1-philosophie.md)

## Repo layout

```text
bonsai/
├── core/              # @bonsai/core meta-package (re-exports) and dist/ bundles
├── packages/          # 13 packages
│   ├── kernel/        application/  feature/  entity/
│   ├── foundation/    composer/     view/     router/
│   ├── error/         # BonsaiError hierarchy, invariant helpers
│   ├── types/         # TypeScript utilities
│   └── immer/  rxjs/  valibot/   # third-party library wrappers
├── tests/
│   ├── unit/          # kernel/, domain/, error/; strate-0/ = regression gate
│   ├── types/         # compile-time tests
│   ├── integration/   # cross-package scenarios, dev/prod bundles
│   └── e2e/           # 🚪 gates (cart, navigation)
├── lib/build/         # internal build pipeline (Rollup + .d.ts)
├── tools/             # build-bonsai-package, invariants, pug-compiler
└── docs/
    ├── theorie.md     # theory — authoritative (French)
    ├── spec/          # specification — the contracts (French)
    └── adr/           # 35 ADRs — architectural decisions (French)
```

## Develop

### Prerequisites

- **Node.js** 23 (devcontainer) — CI runs on Node 20
- **pnpm** 10+

### Common commands

```bash
pnpm install                    # install the workspace
pnpm tsc:check                  # type-check lib/ only
pnpm tsc:check:tests            # type-check packages/ + tests/
pnpm test                       # full test suite
pnpm test:unit                  # unit tests
pnpm test:e2e                   # E2E gates
pnpm test:regression            # regression gate
pnpm test:coverage              # coverage with HTML report
pnpm invariants:check           # consistency of the invariants registry
pnpm run build                  # build all packages (watch mode)
pnpm run build:no-watch         # one-shot build
```

### Quality gates

- **TypeScript**: no `tsconfig` enables `strict` (the `Feature` contract does not compile under `strictFunctionTypes`, see ADR-14); `packages/` and `tests/` are type-checked by `pnpm tsc:check:tests`.
- **Coverage thresholds** locked in `jest.config.ts` at the measured level — any regression fails CI.
- **Husky** ([ADR-33](docs/adr/ADR-33-workflow-git-ci.md)): on commit, type-checks, invariants, regression gate and message format; on push, the full suite. GitHub Actions **CI** replays type-checks, coverage and invariants.
- **Versioned artefacts**: every source change in `packages/` or `core/` comes with a `pnpm run build:no-watch` ([ADR-30](docs/adr/ADR-30-artefacts-versionnes.md)).

## Documentation

The documentation is written in **French** — the design language of the project (see [ADR-34](docs/adr/ADR-34-documentation-francais.md)). English translations are planned for stable documents.

| | |
| --- | --- |
| 🌱 **Theory** | [docs/theorie.md](docs/theorie.md) — vocabulary, axioms, guarantees, decisions; authoritative over everything else |
| 📐 **Spec** | [docs/spec/](docs/spec/README.md) — contracts, signatures, invariants |
| 📋 **ADRs** | [35 decisions](docs/adr/README.md) — every architectural trade-off |
| 📖 **Guides** | [Coding conventions](docs/guides/) — TypeScript style, framework style, testing |
| 🚪 **Strates** | [ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md) — delivery roadmap & gates |
| 🗂️ **Index** | [docs/README.md](docs/README.md) — entry point of the whole documentation |
| 🛠️ **Build** | [lib/BUILD-EN.md](lib/BUILD-EN.md), [lib/DEVELOPER-GUIDE-EN.md](lib/DEVELOPER-GUIDE-EN.md) |
| 🇫🇷 | [French version](README.md) — primary language while the project is not yet publicly exposed |

## License

MIT © NCAC
