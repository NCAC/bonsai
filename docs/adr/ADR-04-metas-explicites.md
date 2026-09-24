# ADR-04 — Metas causales explicites : `(payload, metas)`

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I7, I8, I9, I54 |
| **Livré** | ⏳ strate 1b — aucun `TMessageMetas` n'existe ; handlers et `emit()` n'ont qu'un paramètre `payload` ; seul `Entity.mutate()` accepte déjà `{ payload?, metas? }` (`metas: Record<string, unknown>`, recopié dans le `TEntityEvent`) |
| **Spec** | [metas.md](../spec/2-architecture/metas.md) |

## Contexte

En chorégraphie (ADR-01), une action utilisateur déclenche une cascade
Command → Event → Event… à travers plusieurs Features. Sans métadonnées causales,
impossible de relier un effet à sa cause, de détecter une boucle, ou d'alimenter
DevTools et event sourcing. La question : ces metas sont-elles portées
**implicitement** par le framework ou **explicitement** par le code ?

## Décision

Tout message (Command, Event **et Request**) porte des metas complètes (I7) :

```ts
type TMessageMetas = {
  readonly messageId: string;           // ULID
  readonly correlationId: string;       // ULID préfixé "usr-" (UI) ou "sys-" (système) — jamais modifié (I8)
  readonly causationId: string | null;  // messageId du parent, null si racine
  readonly hop: number;                 // 0 à la racine, +1 par réaction ; rejet si > MAX_HOPS (I9)
  readonly timestamp: number;
  readonly origin: { kind: "view" | "feature" | "behavior" | "composer" | "foundation"; name: string; namespace?: string };
};
```

- **Le framework crée** les metas au point d'entrée : `trigger()` d'une View, timer ou `onInit()` d'une Feature. Le développeur n'en forge **jamais**.
- **Les handlers les reçoivent** en paramètre : `onAddItemCommand(payload, metas)`, `on{NS}{Event}Event(payload, metas)`, `on{X}Request(params, metas)`.
- **Le développeur les propage explicitement** (I54) :

```ts
onAddItemCommand(payload: TAddItem, metas: TMessageMetas): void {
  this.entity.mutate("cart:addItem", { payload, metas }, d => { d.items.push(payload.item); });
  this.emit("itemAdded", { item: payload.item }, { metas });
}
```

- `trigger()` côté View ne prend pas de metas : c'est le point d'entrée.

## Alternatives rejetées

- **Contexte causal implicite** (le framework « sait » quel message est en cours, `this.currentMetas`) — faux dès qu'un handler `async` s'entrelace avec un autre : bug silencieux et non déterministe. Contraire à « Explicit > Implicit ».
- **Metas forgées par le développeur** — source d'erreurs, chaîne causale falsifiable.
- **UUID** — ULID préféré : triable temporellement, utile pour l'event sourcing.

## Conséquences

- Handlers async-safe par construction : la closure capture ses propres metas.
- Un paramètre de plus sur `emit`, `request` et `mutate` ; `options: { metas }` étant requis, le compilateur signale l'oubli de propagation.
- Les erreurs framework (ADR-05) porteront les metas du message fautif.
- Livraison : ajout du 2ᵉ paramètre à tous les handlers (Feature et View), génération ULID, garde `MAX_HOPS`.
