[![🇬🇧 English documentation](https://img.shields.io/badge/docs-english-blue)](./README-EN.md)
[![Strate 0](https://img.shields.io/badge/strate%200-livr%C3%A9e-success)](https://github.com/NCAC/bonsai/releases/tag/v0.1.0-strate-0)
[![Tests](https://img.shields.io/badge/tests-267%20passed-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)]()

# Framework Bonsai

> ⚠️ **Work in Progress** — strate 0 livrée (avril 2026). L'API publique est stable pour les composants core ; les strates 1+ ajouteront Behavior, formulaires, routing et SSR.

Framework TypeScript moderne pour applications frontend opinionées — architecture événementielle, flux de données strictement unidirectionnel, sécurité au compile-time, et une philosophie « le type EST le contrat ».

---

## Pourquoi Bonsai

La plupart des frameworks frontend te _laissent_ structurer une app. Bonsai te **force** à la structurer correctement — le type system rejette de lui-même les architectures qui violent le flux unidirectionnel.

- **Une seule direction, sans exception** : `View → Command → Feature → Event → View`. Les Views n'ont jamais `emit`. Les Features ne touchent jamais le DOM. Le compilateur l'impose.
- **State encapsulé** : chaque Feature possède exactement une Entity. La mutation passe par une unique méthode `mutate(intent, recipe)` (Immer en interne). Pas de setters, pas de proxies réactifs qui fuient.
- **TypeScript DX-first** : les handlers sont auto-découverts par leur nom (`onAddItemCommand`, `onCartItemAddedEvent`). Pas de boilerplate d'enregistrement, pas de décorateurs, IntelliSense complète.
- **DOM chirurgical** : les vues se mettent à jour par projections N1 (`getUI("itemCount").text("3")`) — pas de virtual DOM, pas de diffing. Les templates Pug (N2/N3) sont ⏳ strate 1c.

## Statut — Strate 0 ✅

| Composant | Statut | Coverage |
| --- | --- | --- |
| `@bonsai/entity` | 🟢 Stable | 100 % |
| `@bonsai/feature` | 🟢 Stable | 99 % |
| `@bonsai/view` | 🟢 Stable | 99 % |
| `@bonsai/composer` | 🟢 Stable | 96 % |
| `@bonsai/foundation` | 🟢 Stable | 89 % |
| `@bonsai/application` | 🟢 Stable | 100 % |
| `@bonsai/event` (Channel/Radio) | 🟢 Stable | 94 % |
| `@bonsai/behavior` | ⏳ Absent (strate 2) | — |

**Gate E2E** vert : un cart round-trip complet (click → trigger → handle → mutate → emit → DOM) traverse les six composants sans aucun mock. Voir [`tests/e2e/strate-0.cart-round-trip.test.ts`](tests/e2e/strate-0.cart-round-trip.test.ts).

## Aperçu rapide

```ts
// Feature — possède le state, gère les commands, émet des events.
// Le namespace vient du manifest applicatif typé (ADR-08) — plus de `static namespace`.
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

// View — contrat modulaire (ADR-14) : features + uiEvents + uiElements.
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

  // Imposé par `events: ["click"]` sur addButton (vérifié compile-time — I88).
  onAddButtonClick(): void {
    this.trigger("cart:addItem", { productId: "p1", qty: 1, price: 9.99 });
  }

  // Imposé par cart.listens: ["itemAdded"] (vérifié compile-time — I82).
  onCartItemAddedEvent(_payload: { item: TCartItem }): void {
    this.getUI("itemCount").text(String(this.#count++));
  }
}

// Bootstrap — manifest applicatif typé (ADR-08).
new Application({
  foundation: AppFoundation,
  features:   { cart: CartFeature } satisfies StrictManifest<{ cart: unknown }>,
}).start();
```

## Architecture en 30 secondes

```text
┌─────────────────────────────────────┐
│             Application              │  ← bootstrap, namespaces
└─────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Foundation  │        │   Features   │  ← possèdent le State (Entity)
│  (composers) │        │              │     les Channels (handlers)
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
│  (DOM N1)    │        │ (tri-lane)   │     dispatche
└──────────────┘        └──────────────┘
```

- **Foundation** possède le layout de la page (`<body>` + slots de composers).
- **Composer** décide quelle **View** monter au runtime (avec diff au re-resolve).
- **View** observe le DOM, déclenche des **Commands**, écoute des **Events**.
- **Channel** route Commands / Events / Requests ; **Radio** possède un Channel par namespace de Feature.
- **Feature** est la seule entité qui **émet des Events** et **possède du state mutable** (son Entity).

→ Architecture complète : [docs/spec/1-philosophie.md](docs/spec/1-philosophie.md)

## Structure du dépôt

```text
bonsai/
├── core/              # méta-package @bonsai/core (re-exports)
├── packages/          # 12 packages (9 composants/infra + 3 wrappers)
│   ├── entity/        application/  composer/  feature/
│   ├── foundation/    view/         event/
│   ├── error/         # invariants, erreurs préfixées Bonsai
│   └── immer/  rxjs/  valibot/  types/   # wrappers libs tierces
├── tests/
│   ├── unit/strate-0/    # strate 0 : un fichier par composant (207 tests, dont 82 rejoués par la gate de régression)
│   ├── integration/      # scénarios cross-package
│   └── e2e/              # 🚪 strate gates (un par strate)
├── lib/build/         # pipeline de build interne (Rollup + emit .d.ts)
├── tools/             # build-bonsai-package, pug-to-ts-template
└── docs/
    ├── spec/           # spécification (6 chapitres) — source de vérité
    └── adr/           # 34 ADR — décisions architecturales
```

## Développement

### Prérequis

- **Node.js** 23 (devcontainer) — la CI tourne sur Node 20
- **pnpm** 10+

### Commandes courantes

```bash
pnpm install                          # installe le workspace
pnpm tsc:check                        # type-check de lib/ uniquement (no emit)
npx tsc --noEmit -p tsconfig.test.json # type-check de packages/ + tests/ (à lancer à la main)
pnpm test                             # suite de tests complète
pnpm test:strate-0:regression         # suite de régression strate 0
pnpm jest tests/unit/strate-0         # tous les tests unit strate 0
pnpm jest tests/e2e --no-coverage     # gate E2E
pnpm test:coverage                    # coverage avec rapport HTML
pnpm run build                        # build tous les packages (watch)
pnpm run build:no-watch               # build one-shot
```

### Quality gates

- **TypeScript** : aucun `tsconfig` n'active `strict` (le contrat `Feature` ne compile pas sous `strictFunctionTypes`, cf. ADR-14) ; `packages/` et `tests/` ne sont type-checkés que par `npx tsc --noEmit -p tsconfig.test.json`.
- **Seuils de coverage** verrouillés dans `jest.config.ts` — toute régression sous la baseline strate 0 fait échouer la CI.
- **Husky pre-commit / pre-push** : ADR-33 continuous verification.

## Documentation

La documentation architecturale (spec, ADR) est rédigée en **français** — la langue de conception du projet (cf. [ADR-34](docs/adr/ADR-34-documentation-francais.md)). Des traductions anglaises sont prévues pour les documents stables.

| | |
| --- | --- |
| 📐 **Spec** | [Source de vérité](docs/spec/README.md) — architecture, contrats, invariants |
| 📋 **ADR** | [34 décisions](docs/adr/README.md) — chaque arbitrage architectural |
| 📖 **Guides** | [Conventions de code](docs/guides/) — style TypeScript, style framework |
| 🚪 **Strates** | [ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md) — roadmap de livraison & gates |
| 🛠️ **Build** | [lib/BUILD.md](lib/BUILD.md), [lib/DEVELOPER-GUIDE.md](lib/DEVELOPER-GUIDE.md) |
| 🇬🇧 | [English version](README-EN.md) — non maintenue en priorité tant que le projet n'est pas exposé publiquement |

## Licence

MIT © NCAC
