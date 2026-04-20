[![🇫🇷 Documentation en français](https://img.shields.io/badge/docs-français-blue)](./README.fr.md)

# Bonsai Framework

> ⚠️ **Work in Progress** - This framework is under active development. The API will very likely change before the stable release.

Modern TypeScript framework for frontend development — event-driven architecture, unidirectional data flow, compile-time safety.

## Introduction

**bonsai** is a frontend framework written in TypeScript, designed to provide a solid, type-safe, and modular foundation for modern web applications. It focuses on clarity, robustness, and code reusability.

It also integrates popular external libraries under a unified API.

## Project Structure

The project is organized into several main sections:

- `core/`: The core of the framework
- `packages/`: Individual modules and encapsulated libraries
- `lib/`: Build and development tools
- `tools/`: Utility scripts
- `docs/`: Technical documentation

## Integrated External Libraries

Bonsai integrates several popular external libraries, encapsulated for consistent usage:

- **RxJS**: Reactive programming
- **Immer**: Immutable state mutations
- **Remeda**: Functional utilities
- **Zod**: Schema validation
- **Valibot**: Schema validation (Entity contracts)

## Main Features

- Modular architecture (events, utility types, RxJS integration, etc.)
- Event system inspired by Backbone.Events/Radio (Pub/Sub, Request/Reply)
- Large collection of strict utility types
- Seamless integration of modern libraries (rxjs, zod, remeda)
- 100% TypeScript, strict typing and API documentation

## Development

### Prerequisites

- Node.js 23+
- pnpm

### Installation

```bash
pnpm install
```

### Build

```bash
pnpm run build
pnpm run build:no-watch
pnpm run build:clean
```

---

## Build System Documentation

Bonsai uses an intelligent build system that automatically handles:

- **Regular packages**: TypeScript compilation + Rollup
- **Types-only packages**: Direct copy of `.d.ts` files (optimized)
- **Automatic detection**: No manual configuration required
- **Incremental build**: Only modified packages are rebuilt

> 📖 **Full documentation**:
>
> - **Overview**: [`/lib/BUILD-EN.md`](./lib/BUILD-EN.md) - Concepts and operation
> - **Developer guide**: [`/lib/DEVELOPER-GUIDE-EN.md`](./lib/DEVELOPER-GUIDE-EN.md) - Practical usage
> - **Architecture**: [`/lib/ARCHITECTURE.md`](./lib/ARCHITECTURE.md) - Technical details
> - **Complete index**: [`/lib/README-EN.md`](./lib/README-EN.md) - Documentation navigation

## Client Installation

```bash
pnpm add bonsai
```

## Basic Usage

```ts
import { EventTrigger, RXJS, zod } from "bonsai";

type MyEvents = { update: string };
class MyEmitter extends EventTrigger<MyEmitter, MyEvents> {}

const emitter = new MyEmitter();
emitter.on("update", (msg) => console.log(msg));
emitter.trigger("update", "Hello world!");
```

## Main Packages

- `@bonsai/event`: tri-lane Channel system (Commands, Events, Requests) + Radio singleton
- `@bonsai/entity`: abstract Entity base class with Immer-based `mutate()`
- `@bonsai/types`: advanced utility types
- `@bonsai/immer`: Immer wrapper (opaque Tier 3)
- `@bonsai/valibot`: Valibot wrapper (Entity schema validation)
- `@bonsai/rxjs`: RxJS integration
- `@bonsai/remeda`: functional utilities
- `@bonsai/zod`: schema validation

## Documentation

Architectural documentation (RFCs, ADRs) is written in **French** — the design language of the project (see [ADR-0036](docs/adr/ADR-0036-documentation-internationalization-strategy.md)). English translations are planned for stable documents.

- 📐 [RFCs — Specifications](docs/rfc/README.md) (source of truth)
- 📋 [ADRs — Decisions](docs/adr/README.md) (36 architectural decisions)
- 📖 [Guides](docs/guides/) (coding conventions)
- 🇫🇷 [Version française](README.fr.md)
