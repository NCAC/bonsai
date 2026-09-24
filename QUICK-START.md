# 🚀 Guide de Démarrage Rapide - Framework Bonsai

> État du code : strate 0 livrée, strate 1a livrée (Entity : patches, handlers par clé,
> ré-entrance). Voir [ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md) pour le périmètre
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
│   ├── application/  composer/  entity/  event/  feature/
│   ├── foundation/   view/      error/
│   └── immer/  rxjs/  valibot/  types/    # wrappers de bibliothèques tierces
├── lib/                    # pipeline de build (Rollup + rollup-plugin-dts)
├── tools/                  # pug-to-ts-template (prototype), build-bonsai-package
├── tests/                  # unit/strate-N, types, integration, e2e, fixtures, helpers
├── docs/                   # spec (le QUOI), adr (le POURQUOI), guides (le COMMENT)
└── .github/agents/         # agents conversationnels
```

## Commandes principales

```bash
pnpm run build              # build en mode watch
pnpm run build:no-watch     # build one-shot (à lancer après toute modification de packages/ ou core/, ADR-30)
pnpm test                   # suite complète (Jest)
pnpm run test:coverage      # couverture (seuils dans jest.config.ts)
pnpm run test:unit          # tests/unit
pnpm run test:e2e           # gate E2E strate 0
pnpm run test:strate-0:regression
pnpm tsc:check              # type-check de lib/ uniquement
npx tsc --noEmit -p tsconfig.test.json   # type-check de packages/ + tests/ (à lancer à la main)
```

Jest ne type-check pas les tests (`isolatedModules`) : voir [TESTING.md](docs/guides/TESTING.md).

## Un premier flux complet

Extrait de la fixture de la gate E2E
([`tests/fixtures/cart-feature.fixture.ts`](tests/fixtures/cart-feature.fixture.ts)) :

```ts
import { Entity } from "@bonsai/entity";           // ⚠️ @bonsai/core ne ré-exporte pas encore Entity (ADR-28)
import { type TChannelToken } from "@bonsai/event";
import { Feature, type TFeatureCallbacks } from "@bonsai/feature";

type TCartState = { items: TCartItem[]; total: number };

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

type TCartChannelDef = {
  commands: { addItem: TCartItem };
  events: { itemAdded: { item: TCartItem } };
  requests: { getItemCount: { params: null; result: number } };
};

const cartListens = [] as const;

class CartFeature
  extends Feature<CartEntity, TCartChannelDef, "cart">
  implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
{
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = { namespace: "cart" };
  get listens() { return cartListens; }
  get queries() { return [] as const; }
  protected get Entity() { return CartEntity; }

  // I48 : handler découvert par son nom → Command "addItem"
  onAddItemCommand(payload: TCartItem): void {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    this.emit("itemAdded", { item: payload });
  }

  onGetItemCountRequest(_params: null): number {
    return this.entity.state.items.length;
  }
}
```

La View, le Composer, la Foundation et le bootstrap (`new Application({ foundation, features }).start()`)
suivent le même principe : voir la fixture et le [README](README.md).

## Points d'attention

- **Radio et Channel sont internes** (I15) : le code applicatif ne les manipule jamais ;
  il passe par `Feature.emit()`, `Feature.request()`, `View.trigger()` et `View.request()`.
- **`request()` est synchrone** et retourne `T | null` (ADR-02) : pas de `Promise`.
- **Le namespace vient du manifest applicatif** (`features = { cart: CartFeature } satisfies StrictManifest<…>`,
  ADR-08), jamais d'un `static namespace`.
- **Mutation** : uniquement `this.entity.mutate("ns:intent", recipe)` depuis la Feature propriétaire.

## Workflow de développement

1. **TDD** : écrire le test dans `tests/unit/strate-N/<composant>.<sujet>.test.ts`, citer l'invariant prouvé (ADR-32).
2. **Régression** : ajouter le fichier à `tests/unit/strate-0/strate-0.regression.test.ts` (ADR-33).
3. **Build** : `pnpm run build:no-watch` avant de commiter une modification de source (ADR-30).
4. **Commit** : `type(portée): description en français` (Conventional Commits, ADR-33/ADR-34).

Détails : [CONTRIBUTING.md](CONTRIBUTING.md).

## Ressources

- 📖 [Documentation complète](docs/README.md)
- 🏗️ [Guide du Build System](lib/DEVELOPER-GUIDE.md)
- 🧪 [Guide des Tests](docs/guides/TESTING.md)
- 🤖 [Agent de Développement](.github/agents/dev-framework.agent.md)
