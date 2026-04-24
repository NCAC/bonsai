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
 *   I57 / I71 — Mots réservés (`local`)
 *   I68 — Pas de static namespace
 *   I72 — `TSelfNS` ↔ clé du manifest
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { Entity } from "@bonsai/entity";
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

class CartFeature extends Feature<NoopEntity, "cart"> {
  static readonly channels = [] as const;
  protected get Entity() {
    return NoopEntity;
  }
}

class UserFeature extends Feature<NoopEntity, "user"> {
  static readonly channels = [] as const;
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

  it("RESERVED_NAMESPACES contient 'local' (I57, I71)", () => {
    type Reserved = ReservedNamespace;
    const _local: Reserved = "local";
    void _local;
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

  it("Le `static namespace` n'existe plus sur Feature (I68)", () => {
    // CartFeature ne porte plus aucun `static namespace`.
    // @ts-expect-error — Property 'namespace' does not exist on type 'typeof CartFeature'
    const _ns = CartFeature.namespace;
    void _ns;
  });
});
