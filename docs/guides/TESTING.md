# Guide de test — pratique Jest actuelle et `@bonsai/testing` (cible)

> **Ce guide a été scindé (2026-09-17, audit doc)** en deux parties nettement
> séparées :
>
> - **§1–§8 remaniés : la pratique réellement livrée**, normative — Jest,
>   `tests/unit/{kernel,domain}`, `tests/types`, la gate E2E, la traçabilité
>   ADR/invariants. C'est ce qu'un contributeur doit suivre aujourd'hui.
> - **§10 (ancien §2/§7) : `@bonsai/testing`, un package qui n'existe pas** et
>   qui ne correspond à **aucune** décision actée (aucun ADR ne le spécifie).
>   Les exemples qui suivent y sont **cible/spéculatif**, marqués ⏳, et ne
>   doivent pas être copiés dans du code réel.
>
> La version précédente de ce guide décrivait `@bonsai/testing` comme la
> pratique normative unique, recommandait Vitest, et donnait des exemples
> (`createTestFeature`, `feature.handle()`, `entity.query(fn)`,
> `MockChannel.mockReply(...).response`) qui ne correspondent à aucune API
> livrée — corrigé ci-dessous.
> **Helpers publics `@bonsai/testing`** : piste post-v1, voir la [roadmap](../ROADMAP.md).

---

| Champ | Valeur |
| ----- | ------ |
| **Statut** | 🟢 Normatif pour §1–§9 (pratique Jest livrée) ; §10 explicitement ⏳ cible |
| **Mis à jour** | 2026-11-02 |
| **ADR source** | [ADR-32](../adr/ADR-32-tests-preuve-architecture.md) (tests = preuve d'invariant, statut `🔵 Tested`) |

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
| --- | --- | --- |
| **Entity** | Aucune (Immer interne) | Instanciation directe (`new CartEntity()`), `mutate()`, `get query()` |
| **Feature** | Entity, racine du noyau (`Root`) | `drive(features)` (`tests/helpers/drive.ts`) démarre une vraie `Application` ; `d.send()` adresse une Command, `d.ask()` pose une Query, `d.received` liste les Events reçus |
| **Noyau (`Root`)** | Aucune | `tests/unit/kernel/*.test.ts` — interne, jamais manipulé par le code applicatif (I15) |
| **View** | DOM (jsdom), Composer, Foundation | `@jest-environment jsdom` en tête de fichier ; `drive(features, { foundation, document })` monte la Foundation, ses Composers et leurs Views |
| **Composer / Foundation** | DOM, Features, Views | Même approche jsdom, `tests/unit/domain/composer.test.ts` / `foundation.test.ts` |
| **Intégration multi-composants** | Tout | `tests/integration/`, gate E2E `tests/e2e/strate-0.cart-round-trip.test.ts` |

### Écosystème réel

- **Test runner** : **Jest** (`ts-jest`) pour tout `tests/` — le framework applicatif. **Vitest** est réservé à la pipeline de build (`lib/`) : ne pas confondre, ce sont deux runners pour deux périmètres disjoints (cf. `CLAUDE.md`).
- **DOM** : `jsdom`, activé **par fichier** via le docblock `/** @jest-environment jsdom */` en tête de fichier (`jest.config.ts` a `testEnvironment: "node"` par défaut — jsdom n'est donc pas global, il est opt-in fichier par fichier).
- **Simulation d'événements DOM** : appels directs (`element.click()`, `element.dispatchEvent(new Event(...))`) — pas de bibliothèque `userEvent`/Testing Library dans les dépendances du projet.
- **Type-checking des tests** : `ts-jest` tourne avec `isolatedModules: true` — **Jest ne type-check pas les fichiers de test**. Les tests `@ts-expect-error` de `tests/types/` ne sont vérifiés que par `pnpm tsc:check:tests` (`tsc --noEmit -p tsconfig.test.json`), une commande **séparée** de `pnpm test`, lancée par le pre-commit et la CI — voir §7.

---

## 2. Organisation réelle des tests

```text
tests/
├── unit/
│   ├── kernel/                      # noyau d'exécution (Root, @bonsai/kernel)
│   │   ├── root.test.ts
│   │   ├── capture.test.ts
│   │   ├── entity.test.ts
│   │   ├── host.test.ts
│   │   ├── permissions.test.ts
│   │   ├── report.test.ts
│   │   └── structure.test.ts
│   ├── domain/                      # classes de base branchées sur le noyau
│   │   ├── application.test.ts
│   │   ├── entity.test.ts
│   │   ├── feature.test.ts
│   │   ├── view.test.ts
│   │   ├── composer.test.ts
│   │   ├── foundation.test.ts
│   │   ├── router.test.ts
│   │   └── cart-journey.test.ts
│   ├── error/
│   │   └── errors.test.ts           # hiérarchie BonsaiError, helpers invariant
│   └── strate-0/
│       └── strate-0.regression.test.ts   # suite de non-régression agrégée
├── integration/
│   ├── bonsai-core-rxjs.test.ts
│   └── bundles-dev-prod.test.ts     # bundles de développement et de production (ADR-06)
├── e2e/
│   ├── strate-0.cart-round-trip.test.ts   # GATE strate 0 — ne pas casser
│   └── navigation-round-trip.test.ts
├── types/
│   └── strate-0/                    # tests compile-time (@ts-expect-error)
│       ├── capabilities.types.test.ts
│       ├── contract-callbacks.types.test.ts
│       ├── encapsulation.types.test.ts
│       ├── feature-callbacks.types.test.ts
│       ├── namespace-manifest.types.test.ts
│       └── view-contract.types.test.ts
├── fixtures/
│   └── cart-feature.fixture.ts      # CartEntity/CartFeature/CartView/Composer/Foundation partagés
├── helpers/
│   ├── drive.ts                     # sonde de la racine : send / ask / received / failures
│   ├── entity-of.ts                 # accès de test à Feature#entity (protected, I6)
│   ├── create-test-app.ts
│   └── dom-setup.ts
└── setup.ts
```

> Cette arborescence — pas `unit/entities|features|views`, pas de package `bonsai-testing` — est la seule qui existe. Voir [ADR-28](../adr/ADR-28-monorepo-packages.md) pour la topologie des packages (`packages/<composant>`, `core/` — pas de `packages/bonsai/`).

### Commandes

```bash
pnpm test                                          # suite complète
pnpm test:unit                                     # tests/unit uniquement
pnpm test:integration                              # tests/integration uniquement
pnpm test:e2e                                      # gates E2E (panier, navigation)
pnpm test:regression                               # tests/unit/strate-0/strate-0.regression.test.ts
pnpm test:ci                                       # suite complète avec seuils de couverture (CI)
npx jest tests/unit/domain/feature.test.ts         # un fichier précis
pnpm tsc:check:tests                               # type-check des tests (@ts-expect-error) — SÉPARÉ de `pnpm test`
```

---

## 3. Test d'une Entity

Une Entity ne se mute pas seule : son état est tenu par la racine du noyau et
ne change que par `ctx.mutate(intent, recipe)` dans un handler de sa Feature
(ADR-10). On la teste donc **à travers sa Feature**, démarrée par `drive()`
(voir §4), en observant l'état par une Query. C'est la pratique de
`tests/unit/domain/entity.test.ts` :

```typescript
import { describe, it, expect } from "@jest/globals";
import { Feature, type TFeatureContext } from "@bonsai/feature";
import { Entity } from "@bonsai/entity";
import type { TChannelToken } from "@bonsai/kernel";
import { drive } from "../../helpers/drive";

type TState = { count: number };

class CounterEntity extends Entity<TState> {
  protected defineInitialState(): TState {
    return { count: 0 };
  }
  // Business invariants (A4.a): checked at the end of every unit that touched the state.
  override get invariants() {
    return [{ name: "count-never-negative", check: (s: TState) => s.count >= 0 }];
  }
}

type TDef = {
  commands: { inc: { by: number }; noop: null };
  events: {};
  queries: { count: { params: null; result: number } };
};
type TCtx = TFeatureContext<TDef, CounterEntity>;

const log: string[] = []; // observations made outside the Feature

class CounterFeature extends Feature<CounterEntity, TDef, "counter"> {
  static readonly channel: TChannelToken<TDef, "counter"> = { namespace: "counter" };
  get listens() { return [] as const; }
  get queries() { return [] as const; }
  protected get Entity() { return CounterEntity; }

  onIncCommand(p: { by: number }, ctx: TCtx): void {
    ctx.mutate("inc", (d) => { d.count += p.by; });
  }
  onNoopCommand(_p: null, ctx: TCtx): void {
    log.push(String(ctx.mutate("noop", (d) => { d.count = d.count; })));
  }
  onCountQuery(): number {
    return this.entity.state.count;
  }
}

describe("CounterEntity", () => {
  it("ctx.mutate applique la recette de façon immuable", () => {
    const d = drive({ counter: CounterFeature });
    d.send("counter", "inc", { by: 2 });
    expect(d.ask<number>("counter", "count", null)).toBe(2);
  });

  it("une recette sans effet renvoie null", () => {
    const d = drive({ counter: CounterFeature });
    d.send("counter", "noop", null);
    expect(log).toEqual(["null"]);
  });

  it("un invariant violé fait échouer l'unité, et l'état est restauré (G7)", () => {
    const d = drive({ counter: CounterFeature });
    d.send("counter", "inc", { by: -1 });
    expect(d.failures()).toHaveLength(1);
    expect(d.ask<number>("counter", "count", null)).toBe(0);
  });
});
```

> **Hors d'un traitement**, une Entity n'expose que `initialState` ; lire
> `entity.state` lève une erreur (I6). Les tests qui ont besoin de lire l'état
> d'une Entity isolée lient une source d'état avec `bindEntityState()`, comme
> le fait le noyau.
>
> **Anti-pattern** : appeler des méthodes de mutation nommées sur l'Entity
> (`entity.addItem()`). Seule `ctx.mutate(intent, params?, recipe)` est
> autorisée (ADR-10). Elle retourne `TEntityEvent<TStructure> | null` —
> `null` si la recette ne produit aucun patch (no-op).

---

## 4. Test d'une Feature

Aucun helper `createTestFeature()` n'existe. La pratique réelle démarre une
vraie `Application` sur le manifest des Features à tester, avec `drive()`
(`tests/helpers/drive.ts`). Le helper ajoute à la racine du noyau une **sonde**,
composant d'interface qui adresse des Commands et pose des Queries comme le
ferait un clic (faits indépendants, A5.b). Chaque appel à `drive()` crée sa
propre racine : rien ne fuit d'un test à l'autre.

```typescript
import { describe, it, expect } from "@jest/globals";
import { Feature, type TFeatureCallbacks, type TFeatureContext } from "@bonsai/feature";
import { Entity } from "@bonsai/entity";
import type { TChannelToken } from "@bonsai/kernel";
import { drive } from "../../helpers/drive";

type TCartState = { items: { productId: string; price: number }[]; total: number };

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

type TCartDef = {
  commands: { addItem: { productId: string; price: number } };
  events: { itemAdded: { productId: string } };
  queries: { total: { params: null; result: number } };
};

const cartListens = [] as const;

class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens, CartEntity>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart", events: ["itemAdded"] };
  get listens() { return cartListens; }
  get queries() { return [] as const; }
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: TCartDef["commands"]["addItem"], ctx: TFeatureContext<TCartDef, CartEntity>): void {
    ctx.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price;
    });
    ctx.emit("itemAdded", { productId: payload.productId });
  }

  onTotalQuery(): number {
    return this.entity.state.total;
  }
}

describe("CartFeature", () => {
  it("émet itemAdded quand addItem est traité", () => {
    const d = drive({ cart: CartFeature }, { listen: [{ namespace: "cart", event: "itemAdded" }] });

    d.send("cart", "addItem", { productId: "1", price: 10 });

    expect(d.received).toEqual([{ namespace: "cart", event: "itemAdded", payload: { productId: "1" } }]);
    expect(d.ask<number>("cart", "total", null)).toBe(10);
    expect(d.failures()).toEqual([]);
  });
});
```

> L'état de l'Entity n'est lisible que **pendant** un traitement (I6) : un
> test l'observe en posant une Query (`d.ask()`), jamais en lisant
> `feature.entity`. `d.failures()` liste les unités échouées (et donc
> annulées) : un test qui attend un refus l'y cherche.

---

## 5. Test d'une View

Le DOM est activé **par fichier** via `/** @jest-environment jsdom */` (le
`testEnvironment` par défaut de `jest.config.ts` est `"node"`). Une View ne se
monte jamais seule : `drive()` démarre l'Application avec une Foundation, qui
monte ses Composers, qui montent leurs Views. Le test agit ensuite sur le DOM
et observe le domaine par des Queries :

```typescript
/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { drive } from "../../helpers/drive";
import { resetDOM } from "../../helpers/dom-setup";
import { CartFeature, AppFoundation } from "../../fixtures/cart-feature.fixture";

describe("CartView", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<main data-region="main"></main>`;
  });

  it("adresse cart:addItem au clic sur addButton", () => {
    const d = drive({ cart: CartFeature }, { foundation: AppFoundation, document });

    (document.querySelector("[data-ui='addButton']") as HTMLButtonElement).click();

    expect(d.ask<number>("cart", "getItemCount", null)).toBe(1);
    expect(document.querySelector("[data-ui='itemCount']")!.textContent).toBe("1");
    expect(d.failures()).toEqual([]);
  });
});
```

> Pas de `userEvent.click(...)` ni de `createTestView()` : `element.click()`
> et les méthodes DOM natives suffisent, jsdom les implémente directement.
> La fixture partagée (`tests/fixtures/cart-feature.fixture.ts`) est celle de
> la gate E2E ; `tests/unit/domain/view.test.ts` montre une View déclarée dans
> le fichier de test lui-même.

---

## 6. Tests d'intégration et gate E2E

`tests/integration/` couvre les scénarios cross-package (ex. les bibliothèques
tierces ré-exportées par `@bonsai/core`). La **gate strate 0** est
`tests/e2e/strate-0.cart-round-trip.test.ts` : elle traverse les six
composants (Entity, Feature, View, Composer, Foundation, Application) sans mock,
avec un vrai DOM jsdom, via la fixture partagée `tests/fixtures/cart-feature.fixture.ts`.
**Ne pas la casser** — avec `tests/e2e/navigation-round-trip.test.ts` (clic sur
un lien → route → adresse → retour arrière), ce sont les tests qui prouvent que
l'assemblage complet fonctionne de bout en bout.

`tests/helpers/create-test-app.ts` et `tests/helpers/dom-setup.ts` factorisent
le bootstrap d'application et le montage DOM communs à ces tests — ce sont des
fichiers `tests/` internes au projet, pas un package publié.

---

## 7. Tests de type (`tests/types`)

`tests/types/strate-0/*.types.test.ts` contient des assertions `@ts-expect-error`
qui prouvent qu'une violation de contrat **ne compile pas** (ex. accéder à
`Root` depuis `@bonsai/core`, omettre un handler requis par
`implements TFeatureCallbacks`). Ces fichiers ont l'extension `.test.ts` et
sont **listés par Jest**, mais Jest (`ts-jest`, `isolatedModules: true`) ne
type-check pas leur contenu — un `@ts-expect-error` mal formé ou devenu inutile
**ne fait pas échouer `pnpm test`**.

La seule vérification réelle est :

```bash
pnpm tsc:check:tests   # = tsc --noEmit -p tsconfig.test.json
```

> Cette commande (`pnpm tsc:check:tests`) est **séparée de `pnpm test`** mais
> câblée dans le hook pre-commit et dans la CI (`.github/workflows/regression.yml`,
> étape « Type-check (packages + tests) ») : un test de type cassé ou un
> `@ts-expect-error` devenu superflu (`TS2578`) bloque le commit.

---

## 8. Conventions et anti-patterns

### Patterns à suivre

| Pattern | Raison |
| --- | --- |
| ✅ Un `describe` par composant/invariant, citant l'invariant prouvé en commentaire d'en-tête | ADR-32 — un test documente l'invariant qu'il prouve |
| ✅ Un `drive()` par test pour les tests Feature/View/Composer | Chaque appel crée sa propre racine du noyau : aucune fuite entre tests |
| ✅ Observer l'état par une Query (`d.ask()`), jamais par `feature.entity` | I6 — l'état n'est lisible que pendant un traitement |
| ✅ `@jest-environment jsdom` uniquement sur les fichiers qui en ont besoin | `testEnvironment: "node"` par défaut — coût jsdom évité ailleurs |
| ✅ Fixtures partagées (`tests/fixtures/`) pour les mini-domaines réutilisés (Cart) | DRY, cohérence avec la gate E2E |

### Anti-patterns

| Anti-pattern | Pourquoi | Alternative |
| --- | --- | --- |
| ❌ Croire que `pnpm test` type-check `tests/types/` | `ts-jest` tourne en `isolatedModules: true` — aucun type-check | `pnpm tsc:check:tests` (§7) |
| ❌ Mocker la racine du noyau avec un objet fait main | Le test ne prouverait plus les garanties du noyau (unités, file, annulation) | `drive()` et une vraie `Application` (§4–§5) |
| ❌ Accéder à `feature.entity` depuis un test | `protected` (I6) — ne compile pas, et l'état est refusé hors traitement | Une Query via `d.ask()` |
| ❌ Référencer `createTestFeature`/`createTestView`/`MockChannel`/`@bonsai/testing` | N'existe pas dans le code livré | `drive()` (§4–§5) |
| ❌ Tests de View sans `@jest-environment jsdom` | `document` est `undefined` en environnement `node` | Ajouter le docblock en tête de fichier |

---

## 9. Traçabilité C-Sem — ADR Tested sans invariants

> **ADR-32** admet une voie **C-Sem** : un ADR peut être promu `🔵 Tested`
> sans ligne « Invariants impactés » quand sa décision est de nature
> sémantique (comportement d'exécution) plutôt que structurelle (pas
> d'invariant `I<n>` numéroté à citer dans les tests). **Aucun ADR n'emprunte
> cette voie aujourd'hui** : les cinq ADR `🔵 Tested` (ADR-02, 07, 08, 09, 10)
> portent tous une ligne d'invariants, vérifiée par
> `lib/check-adr-tested-status.ts`. La table ci-dessous trace néanmoins la
> couverture **sémantique** complémentaire de trois d'entre eux et de
> l'ADR-03 (🟢 Accepted, ⚠️ partiel — donc non promouvable), que le script ne
> peut pas vérifier.

| ADR | Décision testée | Fichier(s) de test |
| --- | --- | --- |
| [ADR-10](../adr/ADR-10-entity-mutation.md) | `mutate()` unique via Immer, détection no-op, notification diff | `tests/unit/domain/entity.test.ts` (`describe("ctx.mutate — immutable update (ADR-10)")`) |
| [ADR-03](../adr/ADR-03-channel-runtime.md) | Tri-lane (Commands/Events/Queries) porté par la racine du noyau, livraison différée | `tests/unit/kernel/root.test.ts` (`describe("G5 and D8 — deferred delivery in production order")`) |
| [ADR-07](../adr/ADR-07-application-bootstrap.md) | Ordre de bootstrap et dépendances entre phases | `tests/unit/domain/application.test.ts` (`describe("C.1 — start order by initial dependencies (\`dependsOn\`)")`, `describe("§2.5 — startup")`) |
| [ADR-02](../adr/ADR-02-request-synchrone.md) | Queries **synchrones** — pas de `Promise` | `tests/unit/kernel/root.test.ts` (`describe("G5 — synchronous Queries towards a ready, inactive target")`) |

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
boilerplate visible en §4–§5 (manifest à assembler, câblage DOM manuel) :

```typescript
// ⏳ Hypothétique — n'existe pas
declare function createTestFeature<TFeature extends Feature>(
  FeatureClass: new (namespace: string) => TFeature,
  namespace: string
): { feature: TFeature; send: TDrive["send"]; ask: TDrive["ask"] };

declare function createTestView<TView extends View>(
  ViewClass: new () => TView,
  html: string,
  rootSelector: string
): { view: TView; root: HTMLElement };
```

### Pourquoi ce n'est pas livré aujourd'hui

Le socle privilégie la **simplicité de la primitive** (`drive()`, une vraie
`Application`) plutôt que l'ajout d'un package supplémentaire dont la
surface devrait elle-même être maintenue et testée. Si le besoin de réduire le
boilerplate devient pressant à mesure que la base de tests grandit, ce sera
l'objet d'un ADR dédié — pas d'une extension silencieuse de ce guide.

---

## Références

- [Roadmap — helpers de test publics](../ROADMAP.md)
- [ADR-32 — Tests = preuve d'architecture, statut Tested](../adr/ADR-32-tests-preuve-architecture.md)
- [ADR-28 — Monorepo Topology](../adr/ADR-28-monorepo-packages.md)
- [Jest](https://jestjs.io/)
- [RFC feature.md §8](../spec/3-couche-abstraite/feature.md) (modèle d'erreurs pour les tests)
