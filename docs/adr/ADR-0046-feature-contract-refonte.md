# ADR-0046 : Refonte du contrat Feature — `listens`/`queries` `abstract get` instance, `TFeatureCallbacks` symétrique I88, enforcement compile-time via `TStrictFeatureClass`

| Champ   | Valeur           |
| ------- | ---------------- |
| **Statut**  | 🔵 Tested  |
| **Date**  | 2026-05-18     |
| **Décideurs**   | @NCAC    |
| **RFC liées**           | [feature.md](../rfc/3-couche-abstraite/feature.md), [invariants.md](../rfc/reference/invariants.md), [glossaire.md](../rfc/reference/glossaire.md)                                                                                                                                                                               |
| **ADRs liées**          | [ADR-0039](ADR-0039-namespace-authority-and-uniqueness.md), [ADR-0040](ADR-0040-typescript-first-api-channel-definition-typed.md), [ADR-0042](ADR-0042-view-contract-unified-ui-deps-single-generic.md), [ADR-0037](ADR-0037-feature-generic-entity-class.md), [ADR-0043](ADR-0043-adr-tested-status-as-proof-gate.md)           |
| **Décisions amendées**  | ADR-0039 — I70 reformulé (lecture après ctor inerte, plus lecture `static` avant instanciation). ADR-0040 — I79 amendé (syntaxe `abstract get` au lieu de `static readonly`, sémantique « tokens portés par `listens`/`queries` » préservée). ADR-0042 — I88 élargi (symétrie Contract/Callbacks vaut pour View **et** Feature). |
| **Invariants impactés** | I70 (amendé), I88 (élargi), I92, I93, I94, I95 (nouveaux)                                                                                                                                                                                                                                                                        |

---

## Contexte

ADR-0042 a établi pour la couche View un contrat compile-time strict : trois `abstract get` (`features`, `uiEvents`, `uiElements`), un seul générique `View<TVC>`, une clause `implements TViewCallbacks<TVC>` qui force la couverture des handlers via la symétrie Contract/Callbacks (I88). Le développeur ne peut pas oublier un handler — TS hurle.

**La couche Feature n'a pas reçu cette rigueur.** Trois trous DX subsistent.

### Surface 1 — `static readonly listens` / `static readonly queries` non-enforceable

```ts
// packages/feature/src/bonsai-feature.ts:156–173
static readonly listens: readonly TChannelToken<TChannelDefinition, string>[] = [];
static readonly queries: readonly TChannelToken<TChannelDefinition, string>[] = [];
```

Limitation TypeScript : `abstract static` n'existe pas. Une sous-classe peut hériter le défaut `[]` sans le déclarer explicitement, ce qui :

- masque silencieusement l'oubli de déclarer une dépendance externe ;
- repose sur un filet runtime (`Application.start#validateManifest`) pour rattraper, mais seulement si la Feature est _enregistrée_ — un test isolé d'une Feature concrète n'a aucune protection ;
- empêche le développeur d'utiliser une convention symétrique avec ce qu'il connaît déjà des Views.

### Surface 2 — Le `TChannelDef` reste générique dans les fixtures

```ts
// tests/unit/strate-0/feature.basic.test.ts:83
class CartFeature extends Feature<CartEntity, TChannelDefinition, "cart"> {
//                                              ^^^^^^^^^^^^^^^^^^
//                                              défaut générique — TDef effondré
```

Conséquences en cascade :

| Surface affectée                              | Effet                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `this.emit("itemAdded", payload)`             | `"itemAdded"` = `string` libre ; `payload` = `unknown` de fait                |
| `this.request(TOKEN, "getItemPrice", params)` | Retour `unknown` → cast `as number \| null` ligne 110                         |
| `onAddItemCommand(payload: …)`                | Signature écrite à la main, jamais confrontée à `TDef["commands"]["addItem"]` |
| Handler oublié (`onAddItemCommand` absent)    | Silence du compilateur → bug runtime                                          |
| Handler mal nommé (`onAddItmCommand`)         | Silence du compilateur → handler jamais découvert                             |

**ADR-0042 a résolu ce trou côté View via I88.** Le pendant Feature n'existe pas.

### Surface 3 — Aucune contrainte compile-time entre `TSelfNS`, `static channel` et la clé du manifest

```ts
class PricingFeature extends Feature<PricingEntity, TChannelDefinition, "pricing"> {
  // ✗ static channel oublié → silence à la déclaration de classe
}
const features = { pricing: PricingFeature } satisfies StrictManifest<…>;
// ↑ filet runtime à Application.start() — pas de feedback compile-time
```

`StrictManifest<M>` (ADR-0039) garantit `TSelfNS === clé` mais pas la présence ni la cohérence du token `static channel` (ADR-0040 — I73). C'est un trou couvert aujourd'hui par `Application#validateManifest` (runtime).

---

## Contraintes

| #   | Contrainte                                                                                                                                                                                                                     | Source                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| C1  | Préserver l'invariant _réel_ « pas de side-effect Radio/Entity avant validation complète du manifest » — sans dépendre du couplage actuel « tout statique »                                                                    | I70, ADR-0039 §Décision                                         |
| C2  | `static readonly channel` doit rester static — porteur de TYPE consommé sans instance (par Views dans `TFeatureContract`, par `static listens` d'autres Features dans des tableaux `as const` évalués au chargement de module) | ADR-0040 — I73, I74                                             |
| C3  | Enforcement compile-time **strict** de la couverture des handlers — handler oublié = erreur TS, pas warning runtime                                                                                                            | C4 ADR-0042 ; principe « le type EST le contrat »               |
| C4  | Symétrie Contract/Callbacks portée à Feature — pour tout `TChannelDef` (et tout `TListens`), il existe un `TFeatureCallbacks<TDef, TListens>` qui impose au compile-time les handlers `on*` dérivés                            | I88 élargi                                                      |
| C5  | Le constructeur de `Feature` doit rester **inerte** : `assertValidNamespace` + assignement `#namespace` uniquement. Aucun side-effect Radio, aucune création d'Entity, aucun enregistrement de handler dans le ctor            | C1 + nouveau ordonnancement Phase 0                             |
| C6  | `TStrictFeatureClass<NS, TDef>` doit pouvoir s'intégrer à `StrictManifest<M>` sans modifier la surface publique du manifest (la déclaration `features: { cart: CartFeature } satisfies StrictManifest<…>` reste identique)     | ADR-0039 §Décision                                              |
| C7  | Réutiliser `UnionToIntersection` (`@bonsai/types`) — déjà consommé par `@bonsai/view` pour `TUICallbacks`. Aucune nouvelle dépendance, aucune duplication d'utilitaire                                                         | view.ts:52 ; ADR-0042                                           |
| C8  | Aucun `any` ni `unknown` dans la surface publique des nouveaux types ; casts internes documentés et délimités                                                                                                                  | I75, ADR-0040                                                   |
| C9  | Migration des fixtures et tests **mécanique** : `static readonly listens = […] as const` → `get listens() { return […] as const; }` ; ajout de `implements TFeatureCallbacks<TDef, typeof listens>`                            | Q8 §QA-0046 — bottom-up, compile-error driven                   |
| C10 | Aucune dépendance circulaire entre M1 (`abstract get`), M2 (`TFeatureCallbacks`), M3 (`TStrictFeatureClass`) — les trois mouvements peuvent atterrir séparément si nécessaire (mais sont décidés ensemble)                     | Cohérence avec narratif « le type EST le contrat pour Feature » |

---

## Options considérées

### Option A — Statu quo (rejetée)

**Description** : conserver `static readonly listens/queries`, `TChannelDef = TChannelDefinition` par défaut dans les fixtures, enforcement uniquement runtime via `Application#validateManifest`.

| Avantages                      | Inconvénients                                                    |
| ------------------------------ | ---------------------------------------------------------------- |
| + Zéro changement de code      | − Trois surfaces de DX silencieuse (cf. Contexte) persistent     |
| + Aucune migration de fixtures | − Asymétrie permanente avec ADR-0042 (View strict, Feature laxe) |
|                                | − Tests isolés (sans `Application`) sans protection              |

**Verdict** : maintient les trois trous DX. Rejetée.

---

### Option B — Singleton `ConcreteFeature.me()` + CRTP (rejetée)

**Description** : éliminer **tous** les `static` (y compris `channel`), exposer un accesseur singleton `ConcreteFeature.me()` à la manière des services Symfony/Drupal, paramétrer `Feature<TSelf, …>` via CRTP pour propager le type concret vers la classe de base.

```ts
abstract class Feature<TSelf extends Feature<TSelf, …>, TEntity, TChannelDef, TSelfNS> {
  static me<T extends Feature<T, …>>(this: new (ns: string) => T): T { … }
  abstract get channel():   TChannelToken<TChannelDef, TSelfNS>;  // ← plus de static
  abstract get listens():   readonly TChannelToken<…>[];
  abstract get queries():   readonly TChannelToken<…>[];
}
class CartFeature extends Feature<CartFeature, CartEntity, TCartChannelDef, "cart"> { … }
```

| Avantages                                          | Inconvénients                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| + Symétrie totale Views ↔ Features (tout instance) | − `channel` instance casse les call-sites `[CartFeature.channel] as const` dans `static listens` d'autres Features (consommation type-only au chargement de module)                                                                   |
| + `me()` retourne le type concret                  | − `me()` inutilisable comme porteur de type au moment de l'import (la classe n'est pas encore instanciée) — donc `static channel` _doit_ rester de toute façon (C2)                                                                   |
| + Alignement vocabulaire « services »              | − CRTP `Feature<TSelf, …>` viral : `extends Feature<CartFeature, …>` (auto-référence syntaxique exigée), threadage de `TSelf` dans `TFeatureClass`, `TFeaturesManifest`, `StrictManifest`, `TStrictFeatureClass`, `TFeatureCallbacks` |
|                                                    | − Audit méthode par méthode (cf. annexe §1) : **0/7 méthodes de `Feature` nécessitent le type concret dans leur signature** — critère décisif rejette CRTP par construction                                                           |
|                                                    | − `me()` duplique l'identité (manifest = source de vérité, I69) ou pollue avec un argument `me(ns)` ré-déclaratif                                                                                                                     |
|                                                    | − Reset singleton entre tests → `__resetForTests()` à exposer, pollution API                                                                                                                                                          |
|                                                    | − Anti-pattern PHP-singleton ≠ vrai DI Symfony : Bonsai fait _déjà_ du container-DI via `StrictManifest` + `Application`                                                                                                              |

**Verdict** : trois objections décisives.

1. `static channel` ne peut pas disparaître (C2) → la symétrie totale est illusoire.
2. CRTP non motivé par le critère « une méthode de base mentionne le type concret » (annexe §1).
3. `me()` n'a pas de call-site légitime — il ne sert pas à typer les consommateurs (instance pas disponible à l'import) et le manifest est déjà la source de vérité d'identité.

Rejetée. Clause de réouverture : « si une future méthode de `Feature` doit mentionner le type concret dans sa signature (ex. `clone(): TSelf`, `withChild(child: TSelf)`), rouvrir CRTP via ADR dédié. »

---

### Option C — `abstract get` + `TFeatureCallbacks` + `TStrictFeatureClass` (retenue)

**Description** : trois mouvements coordonnés, narratif unique _« le type EST le contrat pour Feature »_.

#### M1 — `listens`/`queries` migrés en `abstract get` instance

```ts
// packages/feature/src/bonsai-feature.ts (cœur)
export abstract class Feature<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> {
  // ❶ Token : CONSERVÉ static (C2), exigence portée par TStrictFeatureClass (M3)
  //    static readonly channel: TChannelToken<TChannelDef, TSelfNS>;
  //    ↑ non déclaré ici (limitation abstract static), exigé via TStrictFeatureClass

  // ❷ Déclarations d'abonnement — abstract get instance (parité View)
  abstract get listens(): readonly TChannelToken<TChannelDefinition, string>[];
  abstract get queries(): readonly TChannelToken<TChannelDefinition, string>[];

  // ❸ Liaison Entity — inchangé (ADR-0037)
  protected abstract get Entity(): new () => TEntity;

  // ❹ Ctor inerte (C5)
  constructor(namespace: TSelfNS) {
    assertValidNamespace(namespace);
    this.#namespace = namespace;
  }

  // … reste inchangé (bootstrap, emit, request, auto-discovery)
}
```

Réordonnancement bootstrap dans `Application.start()` :

```
Phase 0 — Validation (toute inerte, aucun side-effect Radio/Entity)
  · 0a : assertValidNamespace de chaque clé du manifest
  · 0b : new FeatureClass(ns) pour chaque entrée → ctor inerte (C5)
  · 0c : pour chaque instance, lire instance.listens / instance.queries
         et valider que chaque token.namespace appartient au manifest (I70)
Phase 1 — Channels  : Radio.channel(ns) pour chaque Feature
Phase 3 — bootstrap : entity, handlers auto-discovery, onInit
Phase 4 — Foundation : composers → views → attach
```

→ La validation cross-refs se déplace de « avant tout side-effect » (lecture `static`) à « après instanciation pure, avant tout side-effect Radio/Entity » (lecture `instance`). L'invariant _réel_ est préservé grâce à C5.

#### M2 — `TFeatureCallbacks<TDef, TListens>` — symétrie I88 portée à Feature

```ts
// packages/feature/src/types.ts (nouveaux exports)
import type { UnionToIntersection } from "@bonsai/types";

export type TCommandCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["commands"] & string as `on${Capitalize<K>}Command`]: (
    payload: TDef["commands"][K]
  ) => void;
};

export type TRequestCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["requests"] & string as `on${Capitalize<K>}Request`]: (
    params: TDef["requests"][K]["params"]
  ) => TDef["requests"][K]["result"];
};

// CRITIQUE — UnionToIntersection OBLIGATOIRE (cf. POC §QA-0046 §9.5)
// Sans wrapper : distributivité du conditionnel sur Tok produit { …cart } | { …wishlist },
// que TS refuse comme cible `implements` (TS2422). Type inutilisable.
export type TListenCallbacks<
  TListens extends readonly TChannelToken<TChannelDefinition, string>[]
> = UnionToIntersection<
  TListens[number] extends infer Tok
    ? Tok extends TChannelToken<infer DEF, infer NS>
      ? {
          [E in keyof DEF["events"] &
            string as `on${Capitalize<NS & string>}${Capitalize<E>}Event`]: (
            payload: DEF["events"][E]
          ) => void;
        }
      : never
    : never
>;

export type TFeatureCallbacks<
  TDef extends TChannelDefinition,
  TListens extends readonly TChannelToken<TChannelDefinition, string>[] =
    readonly []
> = TCommandCallbacks<TDef> &
  TRequestCallbacks<TDef> &
  TListenCallbacks<TListens>;
```

DX cible (fixture migrée) :

```ts
type TCartChannelDef = {
  commands: { addItem: { productId: string; qty: number } };
  events: { itemAdded: { item: { productId: string; qty: number } } };
  requests: { getTotal: { params: null; result: number } };
};

const cartListens = [] as const;
const cartQueries = [PricingFeature.channel] as const;

class CartFeature
  extends Feature<CartEntity, TCartChannelDef, "cart">
  implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
{
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
    namespace: "cart"
  };

  get listens() {
    return cartListens;
  } // abstract get (M1)
  get queries() {
    return cartQueries;
  }
  protected get Entity() {
    return CartEntity;
  }

  // ✅ Signature IMPOSÉE — handler oublié → TS2515 ; signature fautive → TS2416
  onAddItemCommand(payload) {
    this.entity.mutate("cart:addItem", (draft) => {
      /* … */
    });
    this.emit("itemAdded", { item: payload }); // ✅ event + payload typés
  }

  onGetTotalRequest(_params) {
    return this.entity.query.getTotal(); // ✅ retour vérifié contre TDef
  }
}
```

#### M3 — `TStrictFeatureClass<NS, TDef>` intégré à `StrictManifest`

```ts
// packages/feature/src/types.ts (nouvel export)
export type TStrictFeatureClass<
  TNS extends string,
  TDef extends TChannelDefinition = TChannelDefinition
> = (new (
  namespace: TNS
) => Feature<Entity<TJsonSerializable>, TDef, TNS>) & {
  readonly channel: TChannelToken<TDef, TNS>;
};
```

Intégration `StrictManifest<M>` : pour chaque clé `NS` du manifest, la valeur doit satisfaire `TStrictFeatureClass<NS>` — erreur compile si `static channel` manque, si `channel.namespace !== NS`, ou si le `TSelfNS` du ctor diverge.

> **M3 n'impose PAS la couverture des handlers.** Une première rédaction le prévoyait (type instance contraint à `Feature<…> & TFeatureCallbacks<…>`), mais c'est **inimplémentable** : (a) TS n'infère pas `TDef` à travers un type constructeur dont le retour est intersecté (`new (...) => Feature<…, TDef> & TFeatureCallbacks<TDef>`), et (b) le type-manifest d'ADR-0039 porte des valeurs `unknown` — il n'expose donc aucun `TDef` par clé à extraire. Résultat de la première version : un fallback `TChannelDefinition` générique **insatisfiable par toute Feature** (index-signature `on${Capitalize<string>}Command`). La couverture des handlers est donc garantie **uniquement** par I92 (`implements TFeatureCallbacks` sur la classe — strictement symétrique à View/ADR-0042, qui n'a jamais eu d'enforcement au point manifest) + le filet runtime d'auto-discovery. Ce que M3 apporte réellement : faire passer la présence de `static channel` + l'alignement `channel.namespace === NS` du **runtime** (`#validateManifest`) au **compile-time**.

| Avantages                                                                          | Inconvénients                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| + Trois trous DX comblés simultanément                                             | − Migration mécanique des fixtures (rendue inévitable par M1 — passage `static` → `get`) |
| + Symétrie complète avec ADR-0042 (View)                                           | − Sentinel runtime nouveau pour I94 (ctor inerte) à ajouter dans `Application.start()`   |
| + Zéro nouvelle dépendance (`UnionToIntersection` déjà publié par `@bonsai/types`) | − Promotion 🔵 lourde (5 invariants × 5 paliers — cf. §QA-0046 §9.7.4)                   |
| + Trois mouvements logiquement séparables (C10)                                    | − ADR-0039 (I70) et ADR-0040 (I79) à amender                                             |
| + Critère « le type EST le contrat » strictement respecté                          |                                                                                          |

---

## Analyse comparative

| Critère                                                   | Option A (statu quo)                              | Option B (`me()` + CRTP)                                  | Option C (M1+M2+M3)                                 |
| --------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Enforcement présence `listens`/`queries`                  | ⚪ runtime seulement                              | ⭐⭐⭐ compile                                            | ⭐⭐⭐ compile (M1)                                 |
| Enforcement présence `static channel`                     | ⚪ runtime seulement                              | ⭐ via `abstract get channel` (mais casse C2)             | ⭐⭐⭐ compile via `TStrictFeatureClass` (M3)       |
| Enforcement couverture handlers                           | ⚪ aucun (silence sur oublis et fautes de frappe) | ⚪ aucun (pas couvert par CRTP)                           | ⭐⭐⭐ compile via `TFeatureCallbacks` (M2)         |
| `TChannelDef` strict aux call-sites                       | ⚪ générique par défaut                           | ⭐⭐ via fixtures                                         | ⭐⭐⭐ via M2 (rendu nécessaire)                    |
| Symétrie avec ADR-0042 (View)                             | ⚪ asymétrie permanente                           | ⭐⭐ partielle (mais `channel` reste static)              | ⭐⭐⭐ complète                                     |
| Préservation I70 (validation avant side-effect)           | ⭐⭐⭐ inchangée                                  | ⭐ régression silencieuse possible (`me()` instancie tôt) | ⭐⭐⭐ préservée via C5 + Phase 0c                  |
| Coût migration fixtures                                   | ⭐⭐⭐ nul                                        | ⭐ très élevé (CRTP threadé partout)                      | ⭐⭐ mécanique (compile-error driven, Q8)           |
| Complexité de la signature `Feature<…>`                   | ⭐⭐⭐ inchangée                                  | ⭐ `Feature<TSelf, TEntity, TDef, TSelfNS>` — viral       | ⭐⭐⭐ inchangée                                    |
| Compatibilité call-sites `[CartFeature.channel] as const` | ⭐⭐⭐                                            | ⚪ cassé (channel instance)                               | ⭐⭐⭐                                              |
| Réutilisation `@bonsai/types`                             | n/a                                               | partielle                                                 | ⭐⭐⭐ `UnionToIntersection` déjà consommé par View |

---

## Décision

Nous choisissons **Option C** (M1 + M2 + M3 dans un ADR unique) parce que :

1. **Les trois trous DX du Contexte sont indissociables.** M1 seul rend l'oubli de `listens`/`queries` compile-time strict mais laisse passer `TChannelDef = TChannelDefinition` dans les fixtures (Surface 2). M2 seul nécessite que les fixtures déclarent un `TChannelDef` concret — ce qu'on peut faire sans M1, mais la couverture des handlers d'events écoutés (`TListenCallbacks`) exige que `listens` soit lisible côté type. M3 seul attrape l'absence de `static channel` mais ne change rien aux handlers. Les trois mouvements forment **un seul narratif : « le type EST le contrat pour Feature »**.

2. **L'Option A maintient une asymétrie indéfendable.** ADR-0042 a démontré la valeur du strict compile-time côté View ; rien ne justifie de la refuser à Feature.

3. **L'Option B est rejetée sur trois points décisifs.** (a) `static channel` doit rester static (C2) — la symétrie totale Views/Features est techniquement impossible sans casser les call-sites `[CartFeature.channel] as const`. (b) CRTP est non motivé par le critère « une méthode de base mentionne le type concret » : 0/7 méthodes de `Feature` le nécessitent (annexe §1). (c) `ConcreteFeature.me()` n'a pas de call-site légitime — il ne sert pas à typer les consommateurs (instance pas disponible à l'import) et duplique l'identité portée par le manifest (I69).

4. **Aucune nouvelle dépendance, aucune duplication d'utilitaire.** `UnionToIntersection` est déjà publié par `@bonsai/types` et consommé par `@bonsai/view` (`view.ts:52`) pour `TUICallbacks`. M2 réutilise la même primitive — c'est la symétrie I88 portée à Feature, pas une invention nouvelle. Coût d'intégration nul.

5. **L'invariant _réel_ « pas de side-effect Radio/Entity avant validation » est préservé** grâce à C5 (ctor inerte) + Phase 0c. Le couplage actuel « tout statique » n'est qu'un moyen, pas la fin.

6. **Le découpage en ADR-0046 (M1) + ADR-0047 (M2+M3) a été examiné et rejeté.** Le narratif unique (« le type EST le contrat pour Feature ») perdrait sa cohérence ; la promotion 🔵 indépendante n'est pas un bénéfice tant que les trois mouvements peuvent atterrir en séquence (M1 → M2 ∥ M3, cf. §QA-0046 §9.6). C10 garantit l'indépendance technique sans imposer la séparation rédactionnelle.

---

## Conséquences

### Positives

- ✅ **Surface 1 (Contexte) comblée** — oubli `listens`/`queries` détecté à la compilation (TS2515 sur classes concrètes, garanti par `abstract get`).
- ✅ **Surface 2 comblée** — `TChannelDef` concret rendu nécessaire par la déclaration `implements TFeatureCallbacks<TDef, …>`. Le compilateur conduit la migration.
- ✅ **Surface 3 comblée** — absence/mismatch de `static channel` détectée à la déclaration du manifest (`satisfies StrictManifest<…>`), avant tout runtime.
- ✅ **Symétrie complète avec ADR-0042** — View et Feature partagent désormais la même structure d'enforcement : `abstract get` pour les déclarations, `implements` pour les callbacks, manifest-typed pour l'identité.
- ✅ **Aucune nouvelle dépendance** — `UnionToIntersection` mutualisé entre `@bonsai/view` et `@bonsai/feature` via `@bonsai/types`.
- ✅ **Tests isolés protégés** — une Feature concrète n'est plus dépendante de `Application.start()` pour découvrir un handler oublié.

### Négatives (acceptées)

- ⚠️ **Migration mécanique des fixtures et demos** — accepté parce que (a) compile-error driven (cf. C9 + §QA-0046 §9.6) ; (b) le nombre de Features concrètes en strate 0 est petit (4 fixtures : Cart, Pricing, CartListener, Observer).
- ⚠️ **Sentinel runtime nouveau pour I94 (ctor inerte)** — Phase 0b doit snapshooter `Radio.me()` avant `new FeatureClass(ns)` et comparer après. Accepté : coût O(1) au bootstrap (un appel), filet précieux face à une future violation silencieuse.
- ⚠️ **ADR-0039 (I70) et ADR-0040 (I79) amendés** — accepté : un ADR Accepted ne se modifie pas, mais un amendement (note dans l'ADR ancien pointant vers ADR-0046) est conforme à `docs/adr/README.md`.
- ⚠️ **Promotion 🔵 lourde (5 invariants × 5 paliers)** — accepté : la checklist §QA-0046 §9.7.4 rend la promotion mécanique.

### Risques identifiés

- 🔶 **Risque : régression silencieuse sur le ctor inerte** (un développeur futur ajoute un appel `Radio.me()` ou `new Entity` dans un constructeur de Feature concrète). Mitigation : sentinel runtime Phase 0b (I94) + test négatif `feature.ctor-inert.test.ts` exigé en promotion 🔵.
- 🔶 **Risque : `TListenCallbacks` régressé par suppression accidentelle de `UnionToIntersection`** (refactor naïf). Mitigation : test négatif `tests/types/TFeatureCallbacks.test-d.ts` transformé depuis le POC §QA-0046 §9.5.5 — capture le bug TS2422 par contradiction.
- 🔶 **Risque : `implements TFeatureCallbacks` oublié sur une Feature concrète.** Si le développeur omet la clause `implements`, la couverture des handlers retombe sur le filet runtime (auto-discovery `#registerEventListeners` → throw au bootstrap si handler manquant, analogue `view.ts:758–762`) au lieu d'une erreur compile. **C'est une parité avec View, pas une faiblesse propre à Feature** : ADR-0042 accepte déjà exactement ce risque résiduel (la couverture View dépend aussi du `implements TViewCallbacks` volontaire). Mitigation : `implements` documenté comme obligatoire (I92) + filet runtime. Option différée (écartée) : un helper valeur `defineFeature(Class)` rendrait `implements` non-oubliable, mais introduit un wrapper « magique » en conflit avec « Explicit > Implicit » — à rouvrir par ADR dédié si le besoin se confirme.
- 🔶 **Risque : intersection d'objets handlers `TFeatureCallbacks` produit des collisions de clés sur 2+ tokens écoutant le même event** (ex. `onCartItemAddedEvent` et `onWishlistItemAddedEvent` — non, _pas_ de collision puisque le préfixe NS diffère ; mais collision possible si deux tokens partagent le même `NS` — édge case). Mitigation : test négatif sur ce cas dans `TFeatureCallbacks.test-d.ts`.

---

## Invariants

### Amendés

- **I70** — Toute référence à un namespace externe DOIT être validée contre le manifest. ~~Lue depuis `static listens`/`static queries` AVANT instanciation~~ → **lue depuis `instance.listens`/`instance.queries` APRÈS instanciation pure (ctor inerte garanti par I94) et AVANT tout side-effect Radio (Phase 0c)**. L'invariant _réel_ (« pas de side-effect avant validation ») est préservé.

- **I88** — Symétrie Contract/Callbacks. ~~Pour tout `T{Component}Contract`, un `T{Component}Callbacks` correspondant impose au compile-time les handlers `on*` dérivés.~~ → **Élargi : vaut pour View (`TViewCallbacks<TVC>`) ET Feature (`TFeatureCallbacks<TDef, TListens>`). Un contrat sans son Callbacks est interdit dans les deux couches.**

### Nouveaux

- **I92** — Toute Feature concrète DOIT `implements TFeatureCallbacks<TDef, TListens>`. Le compilateur impose la présence et la signature de chaque handler dérivé : `onXxxCommand` pour chaque `K ∈ keyof TDef["commands"]`, `onXxxRequest` pour chaque `K ∈ keyof TDef["requests"]`, `on{NS}{Event}Event` pour chaque `(token, event) ∈ TListens`. Filet runtime symétrique de I82 côté Feature : si un handler de listen est manquant à l'auto-discovery, throw immédiat.

- **I93** — `listens` et `queries` sont des `abstract get` instance sur `Feature`. Toute Feature concrète DOIT les implémenter (TS2515 sinon). Migration depuis I79 (ADR-0040) : la syntaxe change (`get` au lieu de `static readonly`), la sémantique « tokens portés par `listens`/`queries` » est préservée.

- **I94** — Le constructeur de `Feature` est **inerte** : il ne DOIT effectuer aucun side-effect autre que `assertValidNamespace(namespace)` et l'assignement `#namespace = namespace`. Cette inertie est l'invariant qui rend l'instanciation en Phase 0b sûre (sans elle, C1 régresserait silencieusement). Filet runtime : sentinel Phase 0b dans `Application.start()` qui snapshoot `Radio.me()` avant `new` et compare après — throw si dérive.

- **I95** — Toute classe enregistrée dans un manifest applicatif DOIT satisfaire `TStrictFeatureClass<NS>` : présence de `static channel` avec `channel.namespace === NS`, et cohérence `TSelfNS === NS` (ctor `(ns: NS)`). Garantie compile-time via l'intégration de `TStrictFeatureClass` dans `StrictManifest<M>`. **La couverture des handlers n'est PAS imposée par I95** (inimplémentable sur un type-manifest à valeurs `unknown` — cf. M3) : elle relève de I92 (`implements TFeatureCallbacks`) + filet runtime. Filet runtime existant (`Application#validateManifest`) préservé pour les cas JS pur / cast `as any`.

---

## Actions de suivi

### Migration (séquencement §QA-0046 §9.6 — bottom-up par mouvement, M1 d'abord puis M2 ∥ M3)

#### M1 — `abstract get listens`/`queries` + ctor inerte + réordonnancement Phase 0

- [ ] **Types** : remplacer dans `packages/feature/src/bonsai-feature.ts` les `static readonly listens` / `static readonly queries` par `abstract get listens()` / `abstract get queries()`.
- [ ] **Runtime** : dans `packages/application/src/bonsai-application.ts`, déplacer `new FeatureClass(ns)` de Phase 3 vers Phase 0b ; ajouter sentinel I94 (snapshot Radio avant/après) ; lire `instance.listens` / `instance.queries` en Phase 0c.
- [ ] **Consumers** : migrer les 4 fixtures (`tests/fixtures/`, `tests/unit/strate-0/feature.basic.test.ts`) — `static readonly listens = […] as const` → `get listens() { return […] as const; }`. Idem `queries`.
- [ ] **Tests** : `pnpm tsc --noEmit -p tsconfig.test.json` puis `pnpm test:strate-0:regression` verts.

#### M2 — `TFeatureCallbacks` + `implements`

- [ ] **Types** : publier depuis `packages/feature/src/types.ts` (et ré-exporter via `bonsai-feature.ts`) les types `TCommandCallbacks`, `TRequestCallbacks`, `TListenCallbacks`, `TFeatureCallbacks`. `TListenCallbacks` DOIT utiliser `UnionToIntersection` (preuve : POC §QA-0046 §9.5).
- [ ] **Consumers** : pour chaque fixture, (a) remplacer `TChannelDefinition` par un `TXxxChannelDef` concret co-localisé (I74) ; (b) ajouter `implements TFeatureCallbacks<TXxxChannelDef, typeof xxxListens>` ; (c) corriger les signatures de handlers driven par les erreurs TS.
- [ ] **Runtime** : ajouter dans `Feature.#registerEventListeners` un filet symétrique à `view.ts:758–762` — si une méthode `on{NS}{Event}Event` est manquante pour un event de `instance.listens[i]`, throw.
- [ ] **Tests** : `pnpm test` vert.

#### M3 — `TStrictFeatureClass` + `StrictManifest` resserré

- [x] **Types** : ajouter `TStrictFeatureClass<NS, TDef = TChannelDefinition>` dans `packages/feature/src/types.ts` (ctor `(ns: NS) => Feature<…, TDef, NS>` + `static channel: TChannelToken<TDef, NS>`, **sans** `& TFeatureCallbacks`) ; `StrictManifest<M>` exige `TStrictFeatureClass<K, TChannelDefinition>` pour chaque entrée — pas d'`infer TDef` (insoluble sur manifest `unknown`).
- [x] **Tests** : `tsconfig.test.json` puis `pnpm test` verts. Test **positif** `StrictManifest` accepte une Feature valide + négatif `static channel` manquant.

### Tests négatifs (promotion 🔵 — §QA-0046 §9.7.4)

- [ ] `tests/types/TFeature.abstract-getters.test-d.ts` (I93) — classe sans `get listens()` → `@ts-expect-error TS2515`.
- [ ] `tests/types/TFeatureCallbacks.test-d.ts` (I92) — handler oublié → TS2515 ; signature fautive → TS2416 ; `UnionToIntersection` retiré → TS2422 (capture le POC §QA-0046 §9.5 comme régression-test permanent).
- [ ] `tests/unit/strate-0/feature.ctor-inert.test.ts` (I94) — `new CartFeature("cart")` puis assert que `Radio.me()` est inchangée (snapshot avant/après).
- [x] `tests/types/strate-0/namespace-manifest.types.test.ts` (I95) — **positif** : Feature valide acceptée par `StrictManifest` ; **négatifs** : classe sans `static channel`, `TSelfNS !== clé`. (Couverture handlers : NON imposée par I95 — voir `feature-callbacks.types.test.ts`/I92.)
- [ ] `tests/unit/strate-0/application.bootstrap-order.test.ts` (I70 amendé) — manifest avec référence à un NS inconnu → `Application.start()` throw AVANT que `Radio.me()._channels` ne soit peuplé.

### Filets runtime

- [ ] Sentinel I94 dans `Application.start()` Phase 0b.
- [ ] Filet I92 dans `Feature.#registerEventListeners` (handler manquant → throw).
- [ ] `Application#validateManifest` (I95) — PRÉSERVÉ, ne pas supprimer sous prétexte que `TStrictFeatureClass` couvre.

### Sondes bundle (promotion 🔵 — §QA-0046 §9.7.3)

- [ ] `grep -E "abstract get (listens|queries)" packages/feature/dist/bonsai-feature.d.ts` → 2 matches (I93).
- [ ] `grep -E "TStrictFeatureClass|TFeatureCallbacks" core/dist/bonsai.d.ts` → matches non vides.
- [ ] `grep -E "Missing handler|inert ctor|snapshot" core/dist/bonsai.esm.js` → filets runtime présents.

### Documentation

- [ ] Amender ADR-0039 — note pointant vers ADR-0046 sur I70.
- [ ] Amender ADR-0040 — note pointant vers ADR-0046 sur I79 (syntaxe).
- [ ] Amender ADR-0042 — note pointant vers ADR-0046 sur I88 (élargissement).
- [ ] Mettre à jour `docs/rfc/reference/invariants.md` — I70 reformulé, I88 élargi, I92/I93/I94/I95 ajoutés.
- [ ] Mettre à jour `docs/rfc/3-couche-abstraite/feature.md` — pattern modulaire (TChannelDef co-localisé, implements TFeatureCallbacks).
- [ ] Supprimer `/bonsai/QA-0046-feature-singleton.md` et `/bonsai/POC-Q7-tlisten-callbacks.ts` (ou transformer le POC en `tests/types/` selon §QA-0046 §9.5.5 option b — recommandé).

---

## Annexes

### Annexe §1 — Audit CRTP méthode par méthode (justification du rejet, Option B)

> Critère décisif : **CRTP est justifié si et seulement si une méthode de la classe de base doit, dans sa signature, mentionner le type concret de la sous-classe.**

| Méthode `Feature`                              | Signature                | Mentionne `TSelf` ? |
| ---------------------------------------------- | ------------------------ | ------------------- |
| `constructor(namespace: TSelfNS)`              | `TSelfNS` suffit         | ❌                  |
| `get namespace(): TSelfNS`                     | `TSelfNS` suffit         | ❌                  |
| `get entity(): TEntity`                        | `TEntity` suffit         | ❌                  |
| `bootstrap(): void`                            | —                        | ❌                  |
| `emit<K>(name: K, payload: TDef["events"][K])` | `TDef` suffit            | ❌                  |
| `request<TDef, TNS, K>(token, name, params)`   | inférence depuis `token` | ❌                  |
| `onInit(): void`                               | —                        | ❌                  |

**0/7 méthodes nécessitent `TSelf`** — le critère décisif rejette CRTP par construction.

### Annexe §2 — POC `UnionToIntersection` (preuve M2)

Fichier `POC-Q7-tlisten-callbacks.ts` (à la racine du repo, auto-ignoré ; à transformer en test négatif `tests/types/TFeatureCallbacks.test-d.ts` post-merge — cf. §QA-0046 §9.5.5 option b).

Compile : `npx tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler POC-Q7-tlisten-callbacks.ts` → **exit 0** (tous les `@ts-expect-error` consommés exactement, prouvant les deux comportements opposés des variantes naïve et fixée).

| Variante POC                                         | Erreur TS                                                                                                                | Sens                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `TListenCallbacksNaive` (sans `UnionToIntersection`) | **TS2422** _« A class can only implement an object type OR intersection of object types with statically known members »_ | L'union d'objets n'est pas un target `implements` valide. Type inutilisable. |
| `TListenCallbacksFixed` (avec `UnionToIntersection`) | **TS2420** sur classe incomplète, aucune erreur sur classe complète                                                      | Comportement attendu.                                                        |

---

## Références

- [RFC-0001 — Architecture fondamentale](../rfc/1-philosophie.md)
- [feature.md — Contrat Feature](../rfc/3-couche-abstraite/feature.md)
- [view.md — Contrat View (ADR-0042)](../rfc/4-couche-concrete/view.md)
- [invariants.md — Liste canonique](../rfc/reference/invariants.md)
- [ADR-0037 — Feature generic entity class](ADR-0037-feature-generic-entity-class.md)
- [ADR-0039 — Namespace authority and uniqueness](ADR-0039-namespace-authority-and-uniqueness.md)
- [ADR-0040 — TypeScript-first API + TChannelDefinition typed](ADR-0040-typescript-first-api-channel-definition-typed.md)
- [ADR-0042 — View contract unified (modèle de symétrie)](ADR-0042-view-contract-unified-ui-deps-single-generic.md)
- [ADR-0043 — Tested status as proof gate](ADR-0043-adr-tested-status-as-proof-gate.md)

---

## Historique

| Date       | Changement                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| 2026-05-18 | Création (Proposed) — trajectoire singleton `me()`/CRTP examinée puis rejetée, refonte M1+M2+M3 retenue |
| 2026-05-18 | Accepted — validation @NCAC après Q&A préparatoire, POC `UnionToIntersection` vert (cf. Annexe §2)      |
