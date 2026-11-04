# 🚀 Guide de Démarrage Rapide - Framework Bonsai

> État du code (`0.2.0`) : strate 0 livrée, strate 1a livrée (Entity : patches, handlers par clé,
> notifications différées), noyau d'exécution et navigation livrés. Voir [ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md) pour le périmètre
> et la ligne **Livré** de chaque [ADR](docs/adr/README.md) pour l'état réel.

## Pré-requis

- **Node.js 23** (devcontainer) — la CI tourne sur Node 20
- **pnpm** 10 (`packageManager` du `package.json`)
- **VS Code** avec Dev Container (recommandé)

## Installation et configuration

### Option 1 : Dev Container (recommandé)

1. Cloner le dépôt : `git clone https://github.com/NCAC/bonsai.git && cd bonsai`
2. Ouvrir avec VS Code (`code .`) et accepter « Reopen in Container » (image `node:23-bookworm`).

### Option 2 : installation locale

```bash
pnpm install
pnpm run build:no-watch   # régénère les artefacts versionnés (core/dist, packages/*/dist)
```

## Structure du projet

```text
bonsai/
├── core/                   # @bonsai/core — barrel (ré-exporte, sans code propre)
├── packages/               # un package par composant (ADR-28)
│   ├── application/  composer/  entity/  kernel/  feature/
│   ├── foundation/   view/      router/   error/
│   └── immer/  rxjs/  valibot/  types/    # wrappers de bibliothèques tierces
├── lib/                    # pipeline de build (Rollup + rollup-plugin-dts)
├── tools/                  # pug-to-ts-template (prototype), build-bonsai-package, invariants
├── tests/                  # unit/{kernel,domain,error,strate-0}, types, integration, e2e, fixtures, helpers
├── docs/                   # theorie.md (fait autorité), spec (le QUOI), adr (le POURQUOI), guides (le COMMENT)
└── .github/agents/         # agents conversationnels
```

## Commandes principales

```bash
pnpm run build              # build en mode watch
pnpm run build:no-watch     # build one-shot (à lancer après toute modification de packages/ ou core/, ADR-30)
pnpm test                   # suite complète (Jest)
pnpm run test:coverage      # couverture (seuils dans jest.config.ts)
pnpm run test:unit          # tests/unit
pnpm run test:e2e           # gates E2E (panier, navigation)
pnpm run test:regression    # gate de régression
pnpm tsc:check              # type-check de lib/ uniquement
pnpm tsc:check:tests        # type-check de packages/ + tests/ (pre-commit et CI)
```

Jest ne type-check pas les tests (`isolatedModules`) : voir [TESTING.md](docs/guides/TESTING.md).

## Un premier flux complet

Extrait de la fixture de la gate E2E
([`tests/fixtures/cart-feature.fixture.ts`](tests/fixtures/cart-feature.fixture.ts), qui importe les packages
directement ; une application passe par `@bonsai/core`) :

```ts
import {
  Entity, Feature,
  type TChannelToken, type TFeatureCallbacks, type TFeatureContext, type TFeatureQueryContext
} from "@bonsai/core";

type TCartState = { items: TCartItem[]; total: number };

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

type TCartChannelDef = {
  commands: { addItem: TCartItem };
  events: { itemAdded: { item: TCartItem } };
  queries: { getItemCount: { params: null; result: number } };
};

const cartListens = [] as const;

class CartFeature
  extends Feature<CartEntity, TCartChannelDef, "cart">
  implements TFeatureCallbacks<TCartChannelDef, typeof cartListens, CartEntity>
{
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = { namespace: "cart", events: ["itemAdded"] };
  get listens() { return cartListens; }
  get queries() { return [] as const; }
  protected get Entity() { return CartEntity; }

  // I48 : handler découvert par son nom → Command "addItem"
  onAddItemCommand(payload: TCartItem, ctx: TFeatureContext<TCartChannelDef, CartEntity>): void {
    ctx.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    ctx.emit("itemAdded", { item: payload });
  }

  // I48 : handler découvert par son nom → Query "getItemCount"
  onGetItemCountQuery(_params: null, _ctx: TFeatureQueryContext): number {
    return this.entity.state.items.length;
  }
}
```

La View, le Composer, la Foundation et le bootstrap (`new Application({ foundation, features, document }).start()`)
suivent le même principe : voir la fixture et le [README](README.md).

## Points d'attention

- **La racine du noyau (`Root`, `@bonsai/kernel`) est interne** (I15) : le code applicatif ne la manipule jamais ;
  il passe par le contexte reçu par chaque handler : `ctx.mutate()`, `ctx.emit()` et `ctx.query()` côté Feature,
  `ctx.trigger()` et `ctx.query()` côté View.
- **Chaque traitement est une unité de validation** : un échec la défait entièrement (G7), et ses effets
  sur le DOM ne sont engagés qu'après validation (C.3).
- **Une Query est synchrone** (G5) : pas de `Promise`.
- **Seul le handler d'un fait du DOM commande** : un handler d'Event peut interroger, jamais adresser une Command (D18).
- **Le namespace vient du manifest applicatif** (`features = { cart: CartFeature } satisfies StrictManifest<…>`,
  ADR-08), jamais d'un `static namespace`.
- **Mutation** : uniquement `ctx.mutate(intent, recipe)` dans un handler de la Feature propriétaire.

## Workflow de développement

1. **TDD** : écrire le test dans `tests/unit/kernel/` (noyau) ou `tests/unit/domain/` (composants), citer l'invariant prouvé (ADR-32).
2. **Régression** : ajouter la suite validée à `tests/unit/strate-0/strate-0.regression.test.ts` (ADR-33).
3. **Build** : `pnpm run build:no-watch` avant de commiter une modification de source (ADR-30).
4. **Commit** : `type(portée): description en français` (Conventional Commits, ADR-33/ADR-34).

Détails : [CONTRIBUTING.md](CONTRIBUTING.md).

## Ressources

- 📖 [Documentation complète](docs/README.md)
- 🏗️ [Guide du Build System](lib/DEVELOPER-GUIDE.md)
- 🧪 [Guide des Tests](docs/guides/TESTING.md)
- 🤖 [Agent de Développement](.github/agents/dev-framework.agent.md)
