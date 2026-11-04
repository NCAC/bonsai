[![🇬🇧 English documentation](https://img.shields.io/badge/docs-english-blue)](./README-EN.md)
[![Version](https://img.shields.io/badge/version-0.2.0-informational)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/tests-419%20passed-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-100%25%20lignes%20%C2%B7%2097%25%20branches-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)]()

# Framework Bonsai

> ⚠️ **Work in Progress** — version `0.2.0` (novembre 2026) : strate 0 livrée, noyau d'exécution et navigation livrés, strate 1 en cours. L'API est en `0.x` et peut encore changer avant la `1.0` (ADR-33).

Framework TypeScript pour applications frontend opinionées — architecture événementielle, flux de données strictement unidirectionnel, sécurité au compile-time, et une philosophie « le type EST le contrat ».

---

## Pourquoi Bonsai

La plupart des frameworks frontend te _laissent_ structurer une app. Bonsai te **force** à la structurer correctement — le type system rejette de lui-même les architectures qui violent le flux unidirectionnel.

- **Une seule direction, sans exception** : `View → Command → Feature → Event → View`. Les Views n'émettent jamais. Les Features ne touchent jamais le DOM. Le compilateur l'impose.
- **State encapsulé** : chaque Feature possède exactement une Entity. La mutation passe par une unique méthode `mutate(intent, recipe)` (Immer en interne). Pas de setters, pas de proxies réactifs qui fuient.
- **Traitements transactionnels** : chaque traitement s'exécute dans une unité de validation. Un échec la défait entièrement — état et messages — et aucun de ses effets sur le DOM n'est engagé : ils ne le sont qu'après validation.
- **TypeScript DX-first** : les handlers sont auto-découverts par leur nom (`onAddItemCommand`, `onCartItemAddedEvent`). Pas de boilerplate d'enregistrement, pas de décorateurs, IntelliSense complète.
- **DOM chirurgical** : les vues se mettent à jour par projections N1 (`getUI("total").text("9.99")`) — pas de virtual DOM, pas de diffing. Les templates Pug (N2/N3) sont ⏳ strate 1c.

## Statut

| Composant | Rôle | Statut |
| --- | --- | --- |
| `@bonsai/kernel` | Noyau d'exécution : `Root`, unités de validation, file différée, Queries, parts, effets | 🟢 Livré |
| `@bonsai/application` | Bootstrap depuis le manifest applicatif, une racine par Application | 🟢 Livré |
| `@bonsai/feature` · `@bonsai/entity` | Logique métier et état (strate 1a : patches, handlers par clé) | 🟢 Livré |
| `@bonsai/foundation` · `@bonsai/composer` · `@bonsai/view` | Layout, composition des Views, projections DOM N1 | 🟢 Livré |
| `@bonsai/router` | Feature `router` et adaptateur d'historique | 🟢 Livré |
| `@bonsai/behavior` | Comportements DOM réutilisables | ⏳ Strate 2 |

Strates ([ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md)) : strate 0 ✅ · 1a ✅ · 1b, 1c, 1d ⏳ · strate 2 ⏳.

**Gates E2E** verts, sans aucun mock, dans un vrai DOM (jsdom) :

- [`strate-0.cart-round-trip.test.ts`](tests/e2e/strate-0.cart-round-trip.test.ts) — clic → Command → mutation → Event → projection ;
- [`navigation-round-trip.test.ts`](tests/e2e/navigation-round-trip.test.ts) — clic sur un lien → route → adresse → retour arrière de l'utilisateur.

## Aperçu rapide

```ts
// Entity — l'état d'une Feature, modifié uniquement par des recettes Immer.
class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

// Feature — possède l'Entity, traite les Commands, émet les Events, répond aux Queries.
// Le namespace vient de la clé du manifest applicatif (ADR-08) — pas de `static namespace`.
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

// View — contrat modulaire (ADR-14) : features + uiEvents + uiElements.
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
  get template()   { return `<button data-ui="addButton">Ajouter</button> <span data-ui="total">0.00</span>`; }

  // Imposé par `events: ["click"]` sur addButton (vérifié au compile-time).
  onAddButtonClick(_fact: TFact, ctx: TFactContext<TCartViewContract>): void {
    ctx.trigger("cart:addItem", { productId: "p1", qty: 1, price: 9.99 });
  }

  // Imposé par `listens: ["itemAdded"]` ; un handler d'Event peut interroger, jamais commander.
  onCartItemAddedEvent(_payload: { item: TCartItem }, ctx: TEventContext<TCartViewContract>): void {
    this.getUI("total").text(ctx.query("cart:total", null).toFixed(2));
  }
}

// Composer — décide quelles Views occupent son slot ; Foundation — le layout de la page.
class MainComposer extends Composer<TComposerContract<Record<string, never>, { cart: typeof CartView }>> {
  get features() { return {}; }
  get views() { return { cart: CartView }; }
  resolve() { return [{ view: "cart" as const, key: "cart" }]; }
}
class AppFoundation extends Foundation {
  get composers() { return { main: { slot: "#main", composer: MainComposer } } as const; }
}

// Bootstrap — manifest applicatif typé (ADR-08).
new Application({
  features: { cart: CartFeature } satisfies StrictManifest<{ cart: unknown }>,
  foundation: AppFoundation,
  document,
}).start();
```

Exemple complet avec ses imports, vérifié par la gate E2E : [`tests/fixtures/cart-feature.fixture.ts`](tests/fixtures/cart-feature.fixture.ts).

## Architecture en 30 secondes

```text
┌─────────────────────────────────────┐
│             Application             │  ← manifest, bootstrap
└─────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Foundation  │        │   Features   │  ← possèdent l'état (Entity),
│   (slots)    │        │              │     traitent Commands et Queries
└──────────────┘        └──────────────┘
        │                    ▲      │
        ▼                    │      │
┌──────────────┐    Commands │      │ Events,
│   Composer   │     Queries │      │ réponses
│  (resolve)   │             │      ▼
└──────────────┘        ┌──────────────┐
        │               │     Root     │  ← racine du noyau,
        ▼               │   (kernel)   │     une par Application
┌──────────────┐ ─────▶ │              │
│     View     │ ◀───── │              │
│  (DOM N1)    │        └──────────────┘
└──────────────┘
```

- **Foundation** possède le layout de la page : un point d'ancrage (`<body>` par défaut) et des slots confiés à des Composers.
- **Composer** décide quelles **Views** monter, par clé, et ne recrée que ce qui a changé.
- **View** reçoit les faits du DOM, adresse des **Commands**, écoute des **Events**, interroge par **Queries** et projette sur le DOM.
- **Root**, la racine du noyau (`@bonsai/kernel`), exécute chaque traitement dans une unité de validation et achemine Commands, Events et Queries ; une par Application, interne au framework. Le **Channel** d'une Feature n'est qu'un contrat typé.
- **Feature** est le seul composant qui **émet des Events** et **possède de l'état mutable** (son Entity).

→ Théorie (fait autorité) : [docs/theorie.md](docs/theorie.md) · architecture : [docs/spec/1-philosophie.md](docs/spec/1-philosophie.md)

## Structure du dépôt

```text
bonsai/
├── core/              # méta-package @bonsai/core (re-exports) et bundles dist/
├── packages/          # 13 packages
│   ├── kernel/        application/  feature/  entity/
│   ├── foundation/    composer/     view/     router/
│   ├── error/         # hiérarchie BonsaiError, helpers invariant
│   ├── types/         # utilitaires TypeScript
│   └── immer/  rxjs/  valibot/   # wrappers de bibliothèques tierces
├── tests/
│   ├── unit/          # kernel/, domain/, error/ ; strate-0/ = gate de régression
│   ├── types/         # tests compile-time
│   ├── integration/   # scénarios cross-package, bundles dev/prod
│   └── e2e/           # 🚪 gates (panier, navigation)
├── lib/build/         # pipeline de build interne (Rollup + .d.ts)
├── tools/             # build-bonsai-package, invariants, pug-to-ts-template
└── docs/
    ├── theorie.md     # théorie — fait autorité
    ├── spec/          # spécification — les contrats
    └── adr/           # 35 ADR — décisions architecturales
```

## Développement

### Prérequis

- **Node.js** 23 (devcontainer) — la CI tourne sur Node 20
- **pnpm** 10+

### Commandes courantes

```bash
pnpm install                    # installe le workspace
pnpm tsc:check                  # type-check de lib/ uniquement
pnpm tsc:check:tests            # type-check de packages/ + tests/
pnpm test                       # suite de tests complète
pnpm test:unit                  # tests unitaires
pnpm test:e2e                   # gates E2E
pnpm test:regression            # gate de régression
pnpm test:coverage              # couverture avec rapport HTML
pnpm invariants:check           # cohérence du registre des invariants
pnpm run build                  # build de tous les packages (watch)
pnpm run build:no-watch         # build one-shot
```

### Quality gates

- **TypeScript** : aucun `tsconfig` n'active `strict` (le contrat `Feature` ne compile pas sous `strictFunctionTypes`, cf. ADR-14) ; `packages/` et `tests/` sont type-checkés par `pnpm tsc:check:tests`.
- **Seuils de couverture** verrouillés dans `jest.config.ts` au niveau mesuré — toute régression fait échouer la CI.
- **Husky** ([ADR-33](docs/adr/ADR-33-workflow-git-ci.md)) : au commit, type-checks, invariants, gate de régression et format du message ; au push, suite complète. La **CI** GitHub Actions rejoue type-checks, couverture et invariants.
- **Artefacts versionnés** : tout changement de source dans `packages/` ou `core/` s'accompagne d'un `pnpm run build:no-watch` ([ADR-30](docs/adr/ADR-30-artefacts-versionnes.md)).

## Documentation

La documentation est rédigée en **français** — la langue de conception du projet (cf. [ADR-34](docs/adr/ADR-34-documentation-francais.md)). Des traductions anglaises sont prévues pour les documents stables.

| | |
| --- | --- |
| 🌱 **Théorie** | [docs/theorie.md](docs/theorie.md) — vocabulaire, axiomes, garanties, décisions ; fait autorité sur tout le reste |
| 📐 **Spec** | [docs/spec/](docs/spec/README.md) — contrats, signatures, invariants |
| 📋 **ADR** | [35 décisions](docs/adr/README.md) — chaque arbitrage architectural |
| 📖 **Guides** | [Conventions de code](docs/guides/) — style TypeScript, style framework, tests |
| 🚪 **Strates** | [ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md) — roadmap de livraison & gates |
| 🗂️ **Index** | [docs/README.md](docs/README.md) — point d'entrée de toute la documentation |
| 🛠️ **Build** | [lib/BUILD.md](lib/BUILD.md), [lib/DEVELOPER-GUIDE.md](lib/DEVELOPER-GUIDE.md) |
| 🇬🇧 | [English version](README-EN.md) — non maintenue en priorité tant que le projet n'est pas exposé publiquement |

## Licence

MIT © NCAC
