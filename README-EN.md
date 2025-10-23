# Bonsai Framework

A modern JavaScript framework for frontend development.

## Introduction

**Bonsai** is a front-end framework written in TypeScript, designed to provide a solid, typed, and modular foundation for developing modern web applications. It emphasizes code clarity, robustness, and reusability.

Additionally, it integrates popular external libraries under a unified API.

## Project structure

The project is organized into several main sections:

- `core/`: The framework core
- `packages/`: Individual modules and encapsulated libraries
- `lib/`: Build and development tools
- `tools/`: Utility scripts
- `docs/`: Technical documentation

## Integrated external libraries

Bonsai integrates several popular external libraries, encapsulated for consistent usage:

- **RxJS**: Reactive programming
- **Remeda**: Functional utilities
- **Zod**: Schema validation

## Main features

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
# Install dependencies
pnpm install
```

### Compilation

```bash
# Compile all packages and the framework
pnpm run build

# Compile without watch
pnpm run build:no-watch

# Compile and clean all compiled files beforehand
pnpm run build:clean
```

## Build system documentation

The Bonsai framework uses an intelligent build system that automatically handles:

- **Regular packages**: TypeScript compilation + Rollup
- **Types-only packages**: Direct copy of `.d.ts` files (optimized)
- **Automatic detection**: No manual configuration required
- **Incremental build**: Only modified packages are rebuilt

> 📖 **Complete documentation**:
>
> - **Overview**: [`/lib/BUILD-EN.md`](./lib/BUILD-EN.md) - Concepts and operation
> - **Developer guide**: [`/lib/DEVELOPER-GUIDE-EN.md`](./lib/DEVELOPER-GUIDE-EN.md) - Practical usage
> - **Architecture**: [`/lib/ARCHITECTURE.md`](./lib/ARCHITECTURE.md) - Technical details
> - **Complete index**: [`/lib/README-EN.md`](./lib/README-EN.md) - Documentation navigation

## Client-side installation

```bash
pnpm add bonsai
```

## Basic usage

```ts
import { EventTrigger, RXJS, zod } from "bonsai";

// Example: creating an event emitter
type MyEvents = { update: string };
class MyEmitter extends EventTrigger<MyEmitter, MyEvents> {}

const emitter = new MyEmitter();
emitter.on("update", (msg) => console.log(msg));
emitter.trigger("update", "Hello world!");
```

## Main packages

- `@bonsai/event`: event system
- `@bonsai/types`: advanced utility types
- `@bonsai/rxjs`: RxJS integration
- `@bonsai/remeda`: functional utilities
- `@bonsai/zod`: schema validation

## Documentation

For more examples and complete API documentation, see the README of each package or the online documentation.
