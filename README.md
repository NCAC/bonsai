[![🇫🇷 Documentation en français](https://img.shields.io/badge/docs-français-blue)](./README.fr.md)

# Bonsai Framework

> ⚠️ **Work in Progress** - This framework is under active development. The API will very likely change before the stable release.

Modern JavaScript framework for frontend development.

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
- **Remeda**: Functional utilities
- **Zod**: Schema validation

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

- `@bonsai/event`: event system
- `@bonsai/types`: advanced utility types
- `@bonsai/rxjs`: RxJS integration
- `@bonsai/remeda`: functional utilities
- `@bonsai/zod`: schema validation

## Documentation

For more examples and full API documentation, see each package's README or the online documentation.
