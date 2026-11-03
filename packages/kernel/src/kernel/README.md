# Execution kernel

Execution kernel required by the theory
([docs/theorie.md](../../../../docs/theorie.md), §13 and annex C), exported by
`@bonsai/kernel`. Started as the prototype of migration lot M1; the domain layer
(`Feature`, `Entity`, `Application`) runs on it since lot M6.1, the concrete
layers since M6.2, and the legacy `Channel` class was removed in M6.3b.

| File | Content |
| --- | --- |
| `root.ts` | `Root`: one registry, queue and trace per model (G6); validation units with journal and rollback (G7); deferred delivery (G5, D8); synchronous read-only Queries (G5, A3.g); reservations (C.6); causal contexts (G8); depth bound (D9); startup (§2.5); effects (C.3); synchronous drain with long units reported (ADR-35); Entity on the unit journal and invariants at the end of each unit (A4.a); startup from a Manifest ordered by initial dependencies (C.1); distributable resources, parts, designations and bottom-up restitutions, cancellable exactly (6.5, 8.5, C.7); materialization in a host document and projection effects engaged after validation (C.3); admission of host events in the innermost part (D10), closed-world qualification (C.4) and right to command by trigger (D18) |
| `capture.ts` | Capture by copy and deep freeze of transmitted values, data only (G2, C.5, A3.d) |
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

Tests: `tests/unit/kernel/root.test.ts` (M1), `tests/unit/kernel/entity.test.ts` (M2), `tests/unit/kernel/structure.test.ts` (M3), `tests/unit/kernel/host.test.ts` (M4, jsdom), `tests/unit/kernel/permissions.test.ts` (M5, jsdom). Findings and next steps:
[prototype report](../../../../docs/rapports/prototype-noyau-M1-2026-10-31.md).
