/**
 * Tests de type — Compile-time enforcement du manifest applicatif (ADR-0039)
 *
 * Ces tests ne s'exécutent **pas** au runtime — ils vérifient que TypeScript
 * rejette correctement les manifestes mal formés via `@ts-expect-error`.
 *
 * Si un `@ts-expect-error` ne déclenche plus d'erreur (parce que le typage
 * a été relâché), le compilateur lève « Unused '@ts-expect-error' directive »
 * → la régression est détectée immédiatement.
 *
 * Couvre les invariants ADR-0039 :
 *   I21 — Format camelCase compile-time
 *   I28 / I57 / I71 — Mots réservés (`local`, `router`)
 *   I68 — Pas de static namespace
 *   I72 — `TSelfNS` ↔ clé du manifest
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { Entity } from "@bonsai/entity";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import {
  Feature,
  type StrictManifest,
  type CamelCaseNamespace,
  type ReservedNamespace,
  RESERVED_NAMESPACES
} from "@bonsai/feature";

// ─── Fixtures ────────────────────────────────────────────────────────────────

type TNoopState = Record<string, never>;
class NoopEntity extends Entity<TNoopState> {
  protected defineInitialState(): TNoopState {
    return {};
  }
}

// Ces fixtures ne prouvent que les invariants namespace d'ADR-0039 — `TChannelDef`
// reste générique. `static channel` est désormais requis au compile-time par
// `StrictManifest` (ADR-0046 — M3 dégradé, I95) ; `listens`/`queries` sont des
// getters instance (M1 — I93). Couverture des handlers : hors scope de ce test
// (cf. feature-callbacks.types.test.ts pour I92).
class CartFeature extends Feature<NoopEntity, TChannelDefinition, "cart"> {
  static readonly channel: TChannelToken<TChannelDefinition, "cart"> = {
    namespace: "cart"
  };
  get listens() {
    return [] as const;
  }
  get queries() {
    return [] as const;
  }
  protected get Entity() {
    return NoopEntity;
  }
}

class UserFeature extends Feature<NoopEntity, TChannelDefinition, "user"> {
  static readonly channel: TChannelToken<TChannelDefinition, "user"> = {
    namespace: "user"
  };
  get listens() {
    return [] as const;
  }
  get queries() {
    return [] as const;
  }
  protected get Entity() {
    return NoopEntity;
  }
}

// ─── Type-level assertions (ADR-0039 §Annexe) ───────────────────────────────

describe("ADR-0039 — Compile-time type enforcement", () => {
  it("CamelCaseNamespace<S> accepts camelCase strings", () => {
    type T1 = CamelCaseNamespace<"cart">;
    type T2 = CamelCaseNamespace<"userProfile">;
    type T3 = CamelCaseNamespace<"a">;
    // Asserts via assignability — no runtime work.
    const _t1: T1 = "cart";
    const _t2: T2 = "userProfile";
    const _t3: T3 = "a";
    void _t1;
    void _t2;
    void _t3;
  });

  it("CamelCaseNamespace<S> rejects non-camelCase strings (→ never)", () => {
    type T1 = CamelCaseNamespace<"Cart">; // PascalCase
    type T2 = CamelCaseNamespace<"my-cart">; // kebab
    type T3 = CamelCaseNamespace<"my_cart">; // snake
    type T4 = CamelCaseNamespace<"cart2">; // digit
    type T5 = CamelCaseNamespace<"">; // empty

    // @ts-expect-error — T1 résout à `never`, "Cart" n'est pas assignable
    const _t1: T1 = "Cart";
    // @ts-expect-error
    const _t2: T2 = "my-cart";
    // @ts-expect-error
    const _t3: T3 = "my_cart";
    // @ts-expect-error
    const _t4: T4 = "cart2";
    // @ts-expect-error
    const _t5: T5 = "";
    void _t1;
    void _t2;
    void _t3;
    void _t4;
    void _t5;
  });

  it("RESERVED_NAMESPACES contient 'local' et 'router' (I28, I57, I71)", () => {
    type Reserved = ReservedNamespace;
    const _local: Reserved = "local";
    const _router: Reserved = "router";
    // @ts-expect-error — "cart" n'est pas réservé
    const _cart: Reserved = "cart";
    void _local;
    void _router;
    void _cart;
    void RESERVED_NAMESPACES;
  });

  it("StrictManifest<M> — clé valide + TSelfNS aligné = OK", () => {
    type AppManifest = {
      cart: unknown;
      user: unknown;
    };
    const _features = {
      cart: CartFeature,
      user: UserFeature
    } satisfies StrictManifest<AppManifest>;
    void _features;
  });

  it("StrictManifest<M> — TSelfNS désaligné de la clé → erreur (I72)", () => {
    type AppManifest = {
      cart: unknown;
      user: unknown;
    };
    const _features = {
      cart: CartFeature,
      // CartFeature a TSelfNS="cart", on le met sous la clé "user"
      // → violation I72, refusée par satisfies
      // @ts-expect-error
      user: CartFeature
    } satisfies StrictManifest<AppManifest>;
    void _features;
  });

  it("StrictManifest<M> — Feature sans `static channel` → erreur (I95, M3 ADR-0046)", () => {
    type AppManifest = {
      cart: unknown;
    };
    class NoChannelFeature extends Feature<
      NoopEntity,
      TChannelDefinition,
      "cart"
    > {
      get listens() {
        return [] as const;
      }
      get queries() {
        return [] as const;
      }
      protected get Entity() {
        return NoopEntity;
      }
    }
    const _features = {
      // Pas de `static channel` → ne satisfait pas TStrictFeatureClass<"cart">.
      // C'est le filet compile-time M3 (avant : runtime #validateManifest I73).
      // @ts-expect-error
      cart: NoChannelFeature
    } satisfies StrictManifest<AppManifest>;
    void _features;
  });

  it("StrictManifest<M> — clé non camelCase → never (I21)", () => {
    type AppManifest = {
      "my-cart": unknown;
    };
    const _features = {
      // La clé "my-cart" est non camelCase → la valeur attendue est `never`
      // → aucune classe ne peut la satisfaire.
      // @ts-expect-error
      "my-cart": CartFeature
    } satisfies StrictManifest<AppManifest>;
    void _features;
  });

  it("StrictManifest<M> — clé réservée → never (I71)", () => {
    type AppManifest = {
      local: unknown;
    };
    const _features = {
      // "local" est réservé → la valeur attendue est `never`
      // @ts-expect-error
      local: CartFeature
    } satisfies StrictManifest<AppManifest>;
    void _features;
  });

  it("StrictManifest<M> — clé `router` réservée → never (I28, I71)", () => {
    type AppManifest = {
      router: unknown;
    };
    const _features = {
      // "router" est réservé au Router framework → la valeur attendue est `never`
      // @ts-expect-error
      router: CartFeature
    } satisfies StrictManifest<AppManifest>;
    void _features;
  });

  it("Le `static namespace` n'existe plus sur Feature (I68)", () => {
    // CartFeature ne porte plus aucun `static namespace`.
    // @ts-expect-error — Property 'namespace' does not exist on type 'typeof CartFeature'
    const _ns = CartFeature.namespace;
    void _ns;
  });
});
