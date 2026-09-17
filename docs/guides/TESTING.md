# Guide de test — pratique Jest actuelle et `@bonsai/testing` (cible)

> **Ce guide a été scindé (2026-09-17, audit doc)** en deux parties nettement
> séparées :
> - **§1–§8 remaniés : la pratique réellement livrée**, normative — Jest,
>   `tests/unit/strate-N`, `tests/types`, la gate E2E, la traçabilité
>   ADR/invariants. C'est ce qu'un contributeur doit suivre aujourd'hui.
> - **§9 (ancien §2/§7) : `@bonsai/testing`, un package qui n'existe pas** et
>   qui ne correspond à **aucune** décision actée (aucun ADR ne le spécifie).
>   Les exemples qui suivent y sont **cible/spéculatif**, marqués ⏳, et ne
>   doivent pas être copiés dans du code réel.
>
> La version précédente de ce guide décrivait `@bonsai/testing` comme la
> pratique normative unique, recommandait Vitest, et donnait des exemples
> (`createTestFeature`, `feature.handle()`, `entity.query(fn)`,
> `MockChannel.mockReply(...).response`) qui ne correspondent à aucune API
> livrée — corrigé ci-dessous.

> **Absorbé depuis** : [ADR-0006](../adr/ADR-0006-testing-strategy.md) (Accepted).

---

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Normatif pour §1–§8 (pratique Jest livrée) ; §9 explicitement ⏳ cible |
| **Mis à jour** | 2026-09-17 |
| **ADR source** | [ADR-0006](../adr/ADR-0006-testing-strategy.md), [ADR-0030](../adr/ADR-0030-testing-as-architecture-proof.md) (tests = preuve d'invariant), [ADR-0043](../adr/ADR-0043-adr-tested-status-as-proof-gate.md) (statut `🔵 Tested`) |

---

## 📋 Table des matières

1. [Principes de test](#1-principes-de-test)
2. [Organisation réelle des tests](#2-organisation-réelle-des-tests)
3. [Test d'une Entity](#3-test-dune-entity)
4. [Test d'une Feature](#4-test-dune-feature)
5. [Test d'une View](#5-test-dune-view)
6. [Tests d'intégration et gate E2E](#6-tests-dintégration-et-gate-e2e)
7. [Tests de type (`tests/types`)](#7-tests-de-type-teststypes)
8. [Conventions et anti-patterns](#8-conventions-et-anti-patterns)
9. [Traçabilité C-Sem — ADR Tested sans invariants](#9-traçabilité-c-sem--adr-tested-sans-invariants)
10. [`@bonsai/testing` — package cible, non livré ⏳](#10-bonsaitesting--package-cible-non-livré-)

---

## 1. Principes de test

### Testabilité par design

Chaque composant Bonsai est **testable en isolation** grâce à l'architecture déclarative :

| Composant | Dépendances | Comment on le teste aujourd'hui |
|-----------|-------------|-----------------------------------|
| **Entity** | Aucune (Immer interne) | Instanciation directe (`new CartEntity()`), `mutate()`, `get query()` |
| **Feature** | Entity, `Radio` (Channel) | `Radio.reset()` + `new FeatureClass(namespace)` + `.bootstrap()` ; assertions via `Radio.me().channel(ns)` |
| **Channel** | `Radio` (interne) | `tests/unit/channel.class.test.ts`, `tests/unit/radio.singleton.test.ts` — rarement testé depuis le code applicatif |
| **View** | DOM (jsdom), `Radio` | `@jest-environment jsdom` en tête de fichier, DOM construit via `document.body.innerHTML`, `view.mount(selector)` |
| **Composer / Foundation** | DOM, Channels, Views | Même approche jsdom, `tests/unit/strate-0/composer.basic.test.ts` / `foundation.basic.test.ts` |
| **Intégration multi-composants** | Tout | `tests/integration/`, gate E2E `tests/e2e/strate-0.cart-round-trip.test.ts` |

### Écosystème réel

- **Test runner** : **Jest** (`ts-jest`) pour tout `tests/` — le framework applicatif. **Vitest** est réservé à la pipeline de build (`lib/`) : ne pas confondre, ce sont deux runners pour deux périmètres disjoints (cf. `CLAUDE.md`).
- **DOM** : `jsdom`, activé **par fichier** via le docblock `/** @jest-environment jsdom */` en tête de fichier (`jest.config.ts` a `testEnvironment: "node"` par défaut — jsdom n'est donc pas global, il est opt-in fichier par fichier).
- **Simulation d'événements DOM** : appels directs (`element.click()`, `element.dispatchEvent(new Event(...))`) — pas de bibliothèque `userEvent`/Testing Library dans les dépendances du projet.
- **Type-checking des tests** : `ts-jest` tourne avec `isolatedModules: true` — **Jest ne type-check pas les fichiers de test**. Les tests `@ts-expect-error` de `tests/types/` ne sont vérifiés que par `npx tsc --noEmit -p tsconfig.test.json`, une commande **séparée**, non câblée dans `pnpm test` ni dans les hooks Husky/CI actuels — voir §7.

---

## 2. Organisation réelle des tests

```
tests/
├── unit/
│   ├── strate-0/                    # un fichier par composant, socle strate 0
│   │   ├── entity.basic.test.ts
│   │   ├── feature.basic.test.ts
│   │   ├── feature.ctor-inert.test.ts
│   │   ├── channel.basic.test.ts
│   │   ├── radio.singleton.test.ts
│   │   ├── view.basic.test.ts
│   │   ├── composer.basic.test.ts
│   │   ├── foundation.basic.test.ts
│   │   ├── application.basic.test.ts
│   │   └── strate-0.regression.test.ts   # suite de non-régression agrégée
│   ├── strate-1/                    # sophistication métier (patches, ré-entrance)
│   │   ├── entity.patches.test.ts
│   │   ├── entity.reentrance.test.ts
│   │   └── feature.entity-handlers.test.ts
│   ├── channel.class.test.ts        # tests hors strate (historiques)
│   └── radio.singleton.test.ts
├── integration/
│   └── bonsai-core-rxjs.test.ts
├── e2e/
│   └── strate-0.cart-round-trip.test.ts   # GATE strate 0 — ne pas casser
├── types/
│   └── strate-0/                    # tests compile-time (@ts-expect-error)
│       ├── encapsulation.types.test.ts
│       ├── feature-callbacks.types.test.ts
│       ├── namespace-manifest.types.test.ts
│       └── view-contract.types.test.ts
├── fixtures/
│   └── cart-feature.fixture.ts      # CartEntity/CartFeature/CartView/Composer/Foundation partagés
├── helpers/
│   ├── entity-of.ts                 # accès de test à Feature#entity (protected, I5/I6)
│   ├── create-test-app.ts
│   └── dom-setup.ts
└── setup.ts
```

> Cette arborescence — pas `unit/entities|features|views`, pas de package `bonsai-testing` — est la seule qui existe. Voir [ADR-0031](../adr/ADR-0031-monorepo-package-topology.md) pour la topologie des packages (`packages/<composant>`, `core/` — pas de `packages/bonsai/`).

### Commandes

```bash
pnpm test                                          # suite complète
pnpm test:unit                                     # tests/unit uniquement
pnpm test:integration                              # tests/integration uniquement
pnpm test:e2e                                      # gate E2E strate 0
pnpm test:strate-0:regression                      # tests/unit/strate-0/strate-0.regression.test.ts
npx jest tests/unit/strate-0/feature.basic.test.ts # un fichier précis
npx tsc --noEmit -p tsconfig.test.json             # type-check des tests (@ts-expect-error) — SÉPARÉ de `pnpm test`
```

---

## 3. Test d'une Entity

Les Entities sont testées **directement**, sans passer par une Feature — `tests/unit/strate-0/entity.basic.test.ts` le fait explicitement (I5/I6 protègent `Feature#entity` de l'accès applicatif, pas l'Entity elle-même en dehors de ce contexte). On teste `mutate()` (ADR-0001, seule API de mutation) et les méthodes du `get query()` (I52) :

```typescript
import { describe, it, expect, beforeEach } from "@jest/globals";
import { Entity } from "@bonsai/entity";

type TCartState = {
  items: Array<{ productId: string; qty: number; price: number }>;
  total: number;
};

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }

  // Convention query — I52 : méthodes de lecture pures, jamais de mutation.
  get query() {
    return {
      getTotal: () => this.state.total,
      getItemCount: () => this.state.items.length
    };
  }
}

describe("CartEntity", () => {
  let entity: CartEntity;

  beforeEach(() => {
    entity = new CartEntity();
  });

  it("mutate() ajoute un item de façon immuable", () => {
    entity.mutate("addItem", (draft) => {
      draft.items.push({ productId: "1", qty: 1, price: 10 });
      draft.total += 10;
    });

    expect(entity.query.getItemCount()).toBe(1);
    expect(entity.query.getTotal()).toBe(10);
  });

  it("mutate() sans patch (no-op) retourne null", () => {
    const event = entity.mutate("noop", () => {});
    expect(event).toBeNull();
  });
});
```

> **Anti-pattern** : appeler des méthodes de mutation nommées directement sur
> l'Entity (`entity.addItem()`). Seule `mutate(intent, params?, recipe)` est
> autorisée (ADR-0001). `mutate()` retourne `TEntityEvent<TStructure> | null` —
> `null` si la recipe ne produit aucun patch (no-op) **ou** si l'appel est mis
> en file par la garde de ré-entrance (I98, strate 1a) — ne jamais présumer
> qu'un retour non-`null` signifie "appliqué immédiatement".

---

## 4. Test d'une Feature

Aucun helper `createTestFeature()` n'existe. La pratique réelle instancie la
Feature directement, contre un `Radio` réinitialisé à chaque test :

```typescript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Feature, type TFeatureCallbacks } from "@bonsai/feature";
import { Entity } from "@bonsai/entity";
import { Radio, type TChannelToken } from "@bonsai/event";
import { entityOf } from "../../helpers/entity-of"; // Feature#entity est protected (I5, I6)

class CartEntity extends Entity<{ items: unknown[]; total: number }> {
  protected defineInitialState() {
    return { items: [], total: 0 };
  }
  get query() {
    return { getTotal: () => this.state.total };
  }
}

type TCartDef = {
  commands: { addItem: { productId: string; price: number } };
  events: { itemAdded: { productId: string } };
  requests: {};
};

const cartListens = [] as const;

class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
  get listens() { return cartListens; }
  get queries() { return [] as const; }
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: { productId: string; price: number }): void {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price;
    });
    this.emit("itemAdded", { productId: payload.productId });
  }
}

describe("CartFeature", () => {
  beforeEach(() => {
    Radio.reset(); // chaque test repart d'un Radio vierge — pas de fuite entre tests
  });

  it("émet itemAdded quand addItem est traité", () => {
    const feature = new CartFeature("cart");
    feature.bootstrap();
    const listener = jest.fn();
    Radio.me().channel("cart").listen("itemAdded", listener);

    Radio.me().channel("cart").trigger("addItem", { productId: "1", price: 10 });

    expect(listener).toHaveBeenCalledWith({ productId: "1" });
    expect(entityOf(feature).query.getTotal()).toBe(10);
  });
});
```

> `Feature#entity` est `protected` (I5, I6) — un test qui doit observer l'état
> après un Command passe par `entityOf(feature)` (`tests/helpers/entity-of.ts`),
> un cast structurel explicite réservé à `tests/`, jamais utilisé en dehors.

---

## 5. Test d'une View

Le DOM est activé **par fichier** via `/** @jest-environment jsdom */` (le
`testEnvironment` par défaut de `jest.config.ts` est `"node"`) :

```typescript
/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Radio } from "@bonsai/event";
import { CartView } from "../../fixtures/cart-feature.fixture";

function setupDOM(): void {
  document.body.innerHTML = `
    <div data-view="cart">
      <span data-ui="itemCount">0</span>
      <button data-ui="addButton">Add</button>
    </div>
  `;
}

describe("CartView", () => {
  beforeEach(() => {
    Radio.reset();
    setupDOM();
  });

  it("déclenche cart:addItem au clic sur addButton", () => {
    Radio.me().channel("cart"); // Channel doit exister avant mount() en pratique
    const view = new CartView();
    view.mount("[data-view='cart']");

    const trigger = jest.spyOn(
      Radio.me().channel("cart"),
      "trigger" as never
    );
    (document.querySelector("[data-ui='addButton']") as HTMLButtonElement).click();

    expect(trigger).toHaveBeenCalled();
  });
});
```

> Pas de `userEvent.click(...)` ni de `createTestView()` — `element.click()`
> et les méthodes DOM natives suffisent, jsdom les implémente directement.

---

## 6. Tests d'intégration et gate E2E

`tests/integration/` couvre les scénarios cross-package (ex. `@bonsai/rxjs`
au cœur du Channel). La **gate strate 0** est
`tests/e2e/strate-0.cart-round-trip.test.ts` : elle traverse les six
composants (Entity, Feature, Channel, View, Composer, Foundation) sans mock,
avec un vrai DOM jsdom, via la fixture partagée `tests/fixtures/cart-feature.fixture.ts`.
**Ne pas la casser** — c'est le seul test qui prouve que l'assemblage complet
fonctionne de bout en bout.

`tests/helpers/create-test-app.ts` et `tests/helpers/dom-setup.ts` factorisent
le bootstrap d'application et le montage DOM communs à ces tests — ce sont des
fichiers `tests/` internes au projet, pas un package publié.

---

## 7. Tests de type (`tests/types`)

`tests/types/strate-0/*.types.test.ts` contient des assertions `@ts-expect-error`
qui prouvent qu'une violation de contrat **ne compile pas** (ex. accéder à
`Radio`/`Channel` depuis `@bonsai/core`, omettre un handler requis par
`implements TFeatureCallbacks`). Ces fichiers ont l'extension `.test.ts` et
sont **listés par Jest**, mais Jest (`ts-jest`, `isolatedModules: true`) ne
type-check pas leur contenu — un `@ts-expect-error` mal formé ou devenu inutile
**ne fait pas échouer `pnpm test`**.

La seule vérification réelle est :

```bash
npx tsc --noEmit -p tsconfig.test.json
```

> ⚠️ **Trou de couverture connu (audit doc 2026-09-17)** : cette commande
> n'est **pas** câblée dans `pnpm test`, ni dans un hook Husky, ni dans la CI
> actuelle (à vérifier/corriger — cf. `.husky/`, workflows GitHub Actions). Un
> test de type cassé ou un `@ts-expect-error` devenu superflu (`TS2578`) peut
> donc rester silencieusement invalide tant que personne ne lance cette
> commande manuellement. Avant de merger un changement touchant
> `tests/types/`, lancez-la explicitement.

---

## 8. Conventions et anti-patterns

### Patterns à suivre

| Pattern | Raison |
|---------|--------|
| ✅ Un `describe` par composant/invariant, citant l'invariant prouvé en commentaire d'en-tête | ADR-0030 — un test documente l'invariant qu'il prouve |
| ✅ `Radio.reset()` dans `beforeEach` pour les tests Feature/View/Composer | Isole chaque test (Radio est un singleton) |
| ✅ `entityOf(feature)` pour lire l'Entity depuis un test (jamais `feature.entity` — `protected`) | I5, I6 |
| ✅ `@jest-environment jsdom` uniquement sur les fichiers qui en ont besoin | `testEnvironment: "node"` par défaut — coût jsdom évité ailleurs |
| ✅ Fixtures partagées (`tests/fixtures/`) pour les mini-domaines réutilisés (Cart) | DRY, cohérence avec la gate E2E |

### Anti-patterns

| Anti-pattern | Pourquoi | Alternative |
|-------------|----------|-------------|
| ❌ Croire que `pnpm test` type-check `tests/types/` | `ts-jest` tourne en `isolatedModules: true` — aucun type-check | `npx tsc --noEmit -p tsconfig.test.json` (§7) |
| ❌ Mocker `Radio` avec un objet fait main | Radio est un singleton simple à réinitialiser | `Radio.reset()` + `Radio.me()` réels |
| ❌ Accéder à `feature.entity` depuis un test | `protected` (I5, I6) — ne compile pas | `entityOf(feature)` (`tests/helpers/entity-of.ts`) |
| ❌ Référencer `createTestFeature`/`createTestView`/`MockChannel`/`@bonsai/testing` | N'existe pas dans le code livré | Instanciation directe + `Radio.reset()` (§3–§5) |
| ❌ Tests de View sans `@jest-environment jsdom` | `document` est `undefined` en environnement `node` | Ajouter le docblock en tête de fichier |

---

## 9. Traçabilité C-Sem — ADR Tested sans invariants

> **ADR-0043** admet une voie **C-Sem** : un ADR peut être promu `🔵 Tested`
> sans ligne « Invariants impactés » quand sa décision est de nature
> sémantique (comportement d'exécution) plutôt que structurelle (pas
> d'invariant `I<n>` numéroté à citer dans les tests). C'est le cas pour
> ADR-0001, ADR-0003, ADR-0010, ADR-0023 et ADR-0024. Cette table trace
> explicitement quels fichiers de test couvrent leur sémantique, en
> l'absence du garde-fou automatique (script annexe A.3 de l'audit doc)
> qui ne peut vérifier que les invariants numérotés.

| ADR | Décision testée | Fichier(s) de test |
|-----|------------------|---------------------|
| [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) | `mutate()` unique via Immer, détection no-op, notification diff | `tests/unit/strate-0/entity.basic.test.ts` (`describe("mutate() — Immer produce")`, `describe("No-op detection")`) |
| [ADR-0003](../adr/ADR-0003-channel-runtime-semantics.md) | Tri-lane Channel (commands/events/requests), garde-fous d'enregistrement | `tests/unit/strate-0/channel.basic.test.ts` |
| [ADR-0010](../adr/ADR-0010-bootstrap-order.md) | Ordre de bootstrap et dépendances entre phases | `tests/unit/strate-0/application.basic.test.ts` (`describe("start() — 4-phase bootstrap")`, `describe("Bootstrap guards [I33, I56, ADR-0010]")`) |
| [ADR-0023](../adr/ADR-0023-request-reply-sync-vs-async.md) | `request()`/`reply()` **synchrones** — pas de `Promise`, `null` si pas de replier ou si le replier throw | `tests/unit/strate-0/channel.basic.test.ts` (`describe("Lane 3 — Requests (request → reply) [I29, I55]")`) |
| [ADR-0024](../adr/ADR-0024-component-capabilities-manifest-pattern.md) | Pattern manifeste value-first (`as const satisfies` + `abstract get`), lu une seule fois au mount | `tests/unit/strate-0/view.basic.test.ts` (`describe("View — strate-0 core (ADR-0024 value-first + ADR-0042 modulaire)")`, `describe("ADR-0024 — manifeste modulaire lu une seule fois au mount")`, `describe("ADR-0024 — contextual contract read from root element dataset")`) |

> À maintenir manuellement — contrairement à l'annexe A.3 (invariants numérotés),
> rien ne vérifie automatiquement que ces citations restent à jour si les
> fichiers de test sont renommés ou réorganisés.

---

## 10. `@bonsai/testing` — package cible, non livré ⏳

> ⚠️ **Aucun ADR ne spécifie ce package.** Ce qui suit est une proposition
> illustrative, pas une décision actée — à ne pas anticiper dans du code
> applicatif. Elle a été laissée ici à titre d'inspiration, corrigée sur les
> points qui ne correspondraient de toute façon à aucune API réelle (ex.
> `TDef['requests'][K]['result']`, pas `.response`).

### Idée générale

Un package `@bonsai/testing` fournirait des helpers pour réduire le
boilerplate visible en §4–§5 (`Radio.reset()` manuel, câblage DOM manuel) :

```typescript
// ⏳ Hypothétique — n'existe pas
declare function createTestFeature<TFeature extends Feature>(
  FeatureClass: new (namespace: string) => TFeature,
  namespace: string
): { feature: TFeature; channel: Channel };

declare function createTestView<TView extends View>(
  ViewClass: new () => TView,
  html: string,
  rootSelector: string
): { view: TView; root: HTMLElement };
```

### Pourquoi ce n'est pas livré aujourd'hui

Le socle strate 0 privilégie la **simplicité de la primitive** (`Radio.reset()`,
instanciation directe) plutôt que l'ajout d'un package supplémentaire dont la
surface devrait elle-même être maintenue et testée. Si le besoin de réduire le
boilerplate devient pressant à mesure que la base de tests grandit, ce sera
l'objet d'un ADR dédié — pas d'une extension silencieuse de ce guide.

---

## Références

- [ADR-0006 — Testing Strategy](../adr/ADR-0006-testing-strategy.md) (décision architecturale source)
- [ADR-0030 — Tests as Architecture Proof](../adr/ADR-0030-testing-as-architecture-proof.md)
- [ADR-0031 — Monorepo Topology](../adr/ADR-0031-monorepo-package-topology.md)
- [ADR-0043 — ADR Tested Status Lifecycle](../adr/ADR-0043-adr-tested-status-as-proof-gate.md)
- [Jest](https://jestjs.io/)
- [RFC feature.md §8](../rfc/3-couche-abstraite/feature.md) (modèle d'erreurs pour les tests)
