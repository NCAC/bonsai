# Kernel prototype (migration lot M1)

Prototype of the communication kernel required by the theory
([docs/theorie.md](../../../../docs/theorie.md), §13 and annex C). It lives
**beside** the delivered `Channel` and `Radio` and is not exported by
`@bonsai/event` yet.

| File | Content |
| --- | --- |
| `root.ts` | `Root`: one registry, queue and trace per model (G6); validation units with journal and rollback (G7); deferred delivery (G5, D8); synchronous read-only Queries (G5, A3.g); reservations (C.6); causal contexts (G8); depth bound (D9); startup (§2.5); effects (C.3); synchronous drain with long units reported (ADR-35) |
| `capture.ts` | Capture by copy and deep freeze of transmitted values (G2, C.5) |
| `errors.ts` | `TransportError` codes and `StartupError` |
| `types.ts` | Component specs, contexts, admissions, trace entries |

```ts
let view!: TComponentHandle;
const root = new Root({ causalBound: 50 });
root.start((ctx) => {
  ctx.create({
    name: "cart",
    channel: { namespace: "cart", events: ["itemAdded"], commands: { addItem: (p, c) => c.emit("itemAdded", p) } }
  });
  view = ctx.create({ name: "view", locals: { click: (_p, c) => c.trigger("cart", "addItem", { id: 1 }) } });
});
root.admit(view, "click", {}, { kind: "independent" });
```

Tests: `tests/unit/kernel/root.test.ts`. Findings and next steps:
[prototype report](../../../../docs/rapports/prototype-noyau-M1-2026-10-31.md).
