[![🇬🇧 English documentation](https://img.shields.io/badge/docs-english-blue)](./README.md)
[![Strate 0](https://img.shields.io/badge/strate%200-livr%C3%A9e-success)](https://github.com/NCAC/bonsai/releases/tag/v0.1.0-strate-0)
[![Tests](https://img.shields.io/badge/tests-175%20passed-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-91%25-brightgreen)]()
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue)]()

# Framework Bonsai

> ⚠️ **Work in Progress** — strate 0 livrée (avril 2026). L'API publique est stable pour les composants core ; les strates 1+ ajouteront Behavior, formulaires, routing et SSR.

Framework TypeScript moderne pour applications frontend opinionées — architecture événementielle, flux de données strictement unidirectionnel, sécurité au compile-time, et une philosophie « le type EST le contrat ».

---

## Pourquoi Bonsai

La plupart des frameworks frontend te _laissent_ structurer une app. Bonsai te **force** à la structurer correctement — le type system rejette de lui-même les architectures qui violent le flux unidirectionnel.

- **Une seule direction, sans exception** : `View → Command → Feature → Event → View`. Les Views n'ont jamais `emit`. Les Features ne touchent jamais le DOM. Le compilateur l'impose.
- **State encapsulé** : chaque Feature possède exactement une Entity. La mutation passe par une unique méthode `mutate(intent, recipe)` (Immer en interne). Pas de setters, pas de proxies réactifs qui fuient.
- **TypeScript DX-first** : les handlers sont auto-découverts par leur nom (`onAddItemCommand`, `onCartItemAddedEvent`). Pas de boilerplate d'enregistrement, pas de décorateurs, IntelliSense complète.
- **DOM chirurgical** : les vues sont rendues via templates Pug (côté serveur / build-time) et mises à jour par projections N1 (`getUI("itemCount").text("3")`) — pas de virtual DOM, pas de diffing.

## Statut — Strate 0 ✅

| Composant                       | Statut                  | Coverage |
| ------------------------------- | ----------------------- | -------- |
| `@bonsai/entity`                | 🟢 Stable               | 100 %    |
| `@bonsai/feature`               | 🟢 Stable               | 96 %     |
| `@bonsai/view`                  | 🟢 Stable               | 95 %     |
| `@bonsai/composer`              | 🟢 Stable               | 96 %     |
| `@bonsai/foundation`            | 🟢 Stable               | 89 %     |
| `@bonsai/application`           | 🟢 Stable               | 97 %     |
| `@bonsai/event` (Channel/Radio) | 🟢 Stable               | 90 %     |
| `@bonsai/behavior`              | 🟡 Stub (strate 1)      | —        |

**Gate E2E** vert : un cart round-trip complet (click → trigger → handle → mutate → emit → DOM) traverse les six composants sans aucun mock. Voir [`tests/e2e/strate-0.cart-round-trip.test.ts`](tests/e2e/strate-0.cart-round-trip.test.ts).

## Aperçu rapide

```ts
// Feature — possède le state, gère les commands, émet des events
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

// View — uniquement DOM, ne possède jamais de state
class CartView extends View {
  get params() { return cartViewParams; }

  // Auto-dérivé depuis uiElements.addButton + event DOM "click"
  onAddButtonClick(): void {
    this.callTrigger("cart", "addItem", { productId: "p1", qty: 1, price: 9.99 });
  }

  // Auto-dérivé depuis le channel écouté "cart" + event "itemAdded"
  onCartItemAddedEvent(payload: { item: TCartItem }): void {
    this.getUI("itemCount").text(String(this.#count++));
  }
}
```

## Architecture en 30 secondes

```
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

→ Architecture complète : [docs/rfc/RFC-0001-architecture-fondamentale.md](docs/rfc/RFC-0001-architecture-fondamentale.md)

## Structure du dépôt

```
bonsai/
├── core/              # méta-package @bonsai/core (re-exports)
├── packages/          # 8 packages framework (un par composant)
│   ├── entity/        application/  composer/  feature/
│   ├── foundation/    view/         event/     behavior/ (stub)
│   ├── error/         # invariants, erreurs préfixées Bonsai
│   └── immer/  rxjs/  valibot/  types/   # wrappers libs tierces
├── tests/
│   ├── unit/strate-0/    # 161 tests, un dossier par composant
│   ├── integration/      # scénarios cross-package
│   └── e2e/              # 🚪 strate gates (un par strate)
├── lib/build/         # pipeline de build interne (Rollup + emit .d.ts)
├── tools/             # build-bonsai-package, pug-to-ts-template
└── docs/
    ├── rfc/           # 4 RFC — source de vérité
    └── adr/           # 38 ADR — décisions architecturales
```

## Développement

### Prérequis

- **Node.js** 23+
- **pnpm** 10+

### Commandes courantes

```bash
pnpm install                          # installe le workspace
pnpm tsc:check                        # type-check uniquement (no emit)
pnpm test                             # suite de tests complète
pnpm test:strate-0:regression         # suite de régression strate 0
pnpm jest tests/unit/strate-0         # tous les tests unit strate 0
pnpm jest tests/e2e --no-coverage     # gate E2E
pnpm test:coverage                    # coverage avec rapport HTML
pnpm run build                        # build tous les packages (watch)
pnpm run build:no-watch               # build one-shot
```

### Quality gates

- **TypeScript strict** : `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.
- **Seuils de coverage** verrouillés dans `jest.config.ts` — toute régression sous la baseline strate 0 fait échouer la CI.
- **Husky pre-commit / pre-push** : ADR-0034 continuous verification.

## Documentation

La documentation architecturale (RFC, ADR) est rédigée en **français** — la langue de conception du projet (cf. [ADR-0036](docs/adr/ADR-0036-documentation-internationalization-strategy.md)). Des traductions anglaises sont prévues pour les documents stables.

|             |                                                                                       |
| ----------- | ------------------------------------------------------------------------------------- |
| 📐 **RFC**  | [Source de vérité](docs/rfc/README.md) — architecture, contrats, invariants            |
| 📋 **ADR**  | [38 décisions](docs/adr/README.md) — chaque arbitrage architectural                    |
| 📖 **Guides** | [Conventions de code](docs/guides/) — style TypeScript, style framework             |
| 🚪 **Strates** | [ADR-0028](docs/adr/ADR-0028-strate-roadmap.md) — roadmap de livraison & gates      |
| 🛠️ **Build** | [lib/BUILD.md](lib/BUILD.md), [lib/DEVELOPER-GUIDE.md](lib/DEVELOPER-GUIDE.md)        |
| 🇬🇧          | [English version](README.md)                                                            |

## Licence

MIT © NCAC
