# Mental Model — Les quatre lieux où vit le namespace

> **Guide concis** pour comprendre où, pourquoi et comment un namespace de Feature
> existe dans Bonsai depuis [ADR-0039](../adr/ADR-0039-namespace-authority-and-uniqueness.md)
> et [ADR-0040](../adr/ADR-0040-typescript-first-api-channel-definition-typed.md)
> (amendés par [ADR-0046](../adr/ADR-0046-feature-contract-refonte.md)).
> Lecture : 3 minutes.

---

| Champ        | Valeur                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audience** | Développeur applicatif écrivant une Feature Bonsai                                                                                                                  |
| **Statut**   | 🟢 Stable                                                                                                                                                            |
| **Date**     | 2026-09-17 (réécrit — audit doc, régression : le mécanisme `static readonly channels: ExternalOf<…>[]` décrit précédemment est supersédé depuis ADR-0040/ADR-0046) |
| **Sources**  | [ADR-0039](../adr/ADR-0039-namespace-authority-and-uniqueness.md), [ADR-0040](../adr/ADR-0040-typescript-first-api-channel-definition-typed.md), [ADR-0046](../adr/ADR-0046-feature-contract-refonte.md), [RFC feature.md](../rfc/3-couche-abstraite/feature.md), invariants I21, I24, I68–I73, I93, I95 |

---

## TL;DR

Un namespace de Feature vit **simultanément** dans **quatre lieux** qui se vérifient mutuellement :

1. **Le type-manifest** (interface `AppManifest`) — _la carte officielle_
2. **La signature de la Feature** (paramètre `TSelfNS`) — _la déclaration d'attente_
3. **Le token `static readonly channel`** (littéral `{ namespace: "cart" }`) — _le badge que la classe porte sur elle_
4. **Le value-manifest** (objet `satisfies StrictManifest<…>`) — _le point de rencontre vérifié_

Si les quatre s'accordent, ça compile. Sinon, l'IDE signale l'écart pour 1↔2↔4
(compile-time) ; 3 est vérifié par un mélange de compile-time (présence et
forme du token, `TStrictFeatureClass`) et de runtime (cohérence des
références croisées `listens`/`queries`, Phase 0c du bootstrap).

---

## 1. Le type-manifest — la carte

**Où** : `app/manifest.ts` (un seul fichier par application, zéro classe importée)

**Quoi** : une interface TypeScript qui **énumère tous les namespaces** de l'application.

```typescript
// app/manifest.ts
export interface AppManifest {
  user: unknown;
  cart: unknown;
  inventory: unknown;
}
export type AppNamespace = keyof AppManifest;
```

> `StrictManifest<M>` n'est **pas** redéfini ici — il vient de `@bonsai/feature`
> (source de vérité unique). Le redéfinir localement perdrait les vérifications
> camelCase (I21) et namespace réservé (I57, I71) qu'il porte réellement.

**Rôle** : **source de vérité des namespaces**. Ajouter une Feature = ajouter une clé ici. Renommer une Feature = renommer sa clé ici. **Rien d'autre**.

**Analogie** : c'est l'annuaire officiel. Il ne contient que des noms, pas de personnes.

---

## 2. La signature de la Feature — la déclaration d'attente

**Où** : dans la classe Feature elle-même, en troisième paramètre de type.

**Quoi** : la Feature **déclare** sous quel nom elle s'attend à être enregistrée.

```typescript
// app/cart/cart.feature.ts
export class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  //                                                    ↑
  //   « Je suis conçue pour vivre sous la clé "cart" du manifest »
}
```

**Rôle** : la Feature reste **anonyme en valeur** pour son namespace (aucun
littéral `"cart"` ne sort de sa signature de type à cet endroit précis) mais
**typée en signature**. Elle prévient le manifest de la clé sous laquelle
elle doit atterrir.

**Analogie** : c'est la carte de visite. Elle porte le nom attendu, pas encore le badge d'accès.

---

## 3. Le token `static readonly channel` — le badge

**Où** : dans la classe Feature, en membre statique (ADR-0040, I73).

**Quoi** : un littéral runtime qui porte le namespace **en valeur**, cette
fois — c'est le pont entre la classe et son `Channel` typé, consommé par les
autres Features (`request()`) et par les Views (`TFeatureContract`).

```typescript
// app/cart/cart.feature.ts (suite)
export class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  static readonly channel: TChannelToken<TCartDef, "cart"> = {
    namespace: "cart"
  };

  // Channels externes ÉCOUTÉS — abstract get d'INSTANCE depuis ADR-0046 (I93),
  // PAS un `static readonly channels: ExternalOf<…>[]` (pattern supersédé).
  get listens() { return [UserFeature.channel] as const; }
  get queries() { return [] as const; }
}
```

**Rôle** : `channel.namespace` DOIT être identique au `"cart"` de `TSelfNS`
(§2) — c'est `TStrictFeatureClass<NS>` (I95) qui l'exige au `satisfies` du
value-manifest (§4). C'est aussi la seule information dont dispose un
consommateur externe (`UserFeature.channel`, `CartFeature.channel`) : ni le
type-manifest ni `TSelfNS` ne sont visibles depuis l'extérieur du fichier.

**Analogie** : c'est le badge que la classe porte sur elle en permanence —
contrairement à la carte de visite (§2, un type effacé à la compilation), le
badge existe au runtime et n'importe qui peut le lire.

> ⚠️ **Pas de `ExternalOf<TSelfNS>` compile-time** : `listens`/`queries`
> retournent `readonly TChannelToken<TChannelDefinition, string>[]` — un type
> générique, pas contraint aux namespaces externes du manifest. Rien
> n'empêche *au compile-time* qu'une Feature déclare `get listens() { return
> [CartFeature.channel] }` dans `CartFeature` elle-même (auto-écoute), ni
> qu'elle référence un token dont le namespace n'existe dans aucun manifest.
> Les deux cas sont détectés **au runtime**, en Phase 0c du bootstrap
> (`Application.start()`, I70) — voir la table des garanties ci-dessous.

---

## 4. Le value-manifest — le point de rencontre

**Où** : `app/main.ts` (l'unique endroit où l'on voit toutes les Features de l'application).

**Quoi** : un objet qui **marie** chaque nom du type-manifest à sa classe Feature, vérifié par `satisfies`.

```typescript
// app/main.ts
import type { AppManifest } from "@app/manifest.js";
import type { StrictManifest } from "@bonsai/feature";
import { UserFeature } from "@user/user.feature.js";
import { CartFeature } from "@cart/cart.feature.js";
import { InventoryFeature } from "@inventory/inventory.feature.js";

const features = {
  user: UserFeature,
  cart: CartFeature,
  inventory: InventoryFeature
} satisfies StrictManifest<AppManifest>;

new Application({ foundation: AppFoundation, features }).start();
```

**Rôle** : **confronter** la carte (type-manifest) à la fois à la carte de
visite (`TSelfNS`, §2) et au badge (`channel.namespace`, §3) de chaque
Feature. Si une Feature arrive sous la mauvaise clé, ou si son `channel` n'a
pas le bon namespace, ou si `static readonly channel` est absent, TS le
signale **immédiatement** (`TStrictFeatureClass<NS>`, I95).

**Analogie** : c'est le bureau d'accueil. Il lit l'annuaire, lit la carte de visite, vérifie le badge — ou refuse l'entrée.

---

## Les garanties du quadruple accord

| Erreur                                    | Qui la détecte              | Quand               |
| ----------------------------------------- | ---------------------------- | -------------------- |
| Deux Features avec même namespace         | TS1117                       | Compile-time         |
| Clé non camelCase (`Cart`, `my-cart`)     | `CamelCaseNamespace`         | Compile-time         |
| Clé réservée (`local`, `router`)          | `StrictManifest<M>` → `never`| Compile-time         |
| Feature enregistrée sous la mauvaise clé (`TSelfNS` ≠ clé) | `TStrictFeatureClass<NS>` (I95) | Compile-time |
| `static readonly channel` absent ou mal typé | `TStrictFeatureClass<NS>` (I95) | Compile-time     |
| Handler `on{NS}{Event}Event` manquant après un rename | `implements TFeatureCallbacks` (I92) — TS2515 | Compile-time |
| `listens`/`queries` référence un namespace inconnu | `Application.start()` (I70) | Runtime (bootstrap, Phase 0c) |
| Feature s'écoute elle-même via `listens`  | ⚠️ **non détecté** — ni compile-time ni runtime | — |
| Cast `as any` + faute de frappe sur le namespace | `assertValidNamespace` | Runtime (bootstrap) |

---

## Le flux mental du développeur

### Ajouter une Feature

1. J'ouvre **l'annuaire** (`app/manifest.ts`) et j'ajoute `myFeature: unknown`.
2. Je crée la classe : `class MyFeature extends Feature<MyEntity, TMyDef, "myFeature">` avec `static readonly channel: TChannelToken<TMyDef, "myFeature"> = { namespace: "myFeature" }`.
3. J'implémente `implements TFeatureCallbacks<TMyDef, typeof myListens>` — le compilateur exige tous les handlers `onXxxCommand`/`onXxxRequest`/`on{NS}{Event}Event`.
4. J'ouvre **le bureau d'accueil** (`app/main.ts`) et j'ajoute `myFeature: MyFeature` dans l'objet `features`.

Si j'oublie une étape, **TS refuse de compiler** et m'indique laquelle.

### Renommer une Feature

1. Je renomme la clé dans l'annuaire (`cart` → `shoppingCart`).
2. TS explose **partout** où l'ancien nom apparaissait :
   - Dans `TSelfNS` (`Feature<_, _, "cart">`) → je corrige
   - Dans `channel.namespace: "cart"` → je corrige (sinon `TStrictFeatureClass` refuse)
   - Dans le value-manifest → je corrige
3. Les méthodes `onCartXxxEvent` chez les consommateurs externes sont
   **désormais couvertes par TS** (I92, `implements TFeatureCallbacks`) — un
   handler devenu orphelin après le rename lève `TS2515`, ce n'est plus une
   correction manuelle silencieuse.

**Aucun rename silencieux possible sur les trois premiers lieux ; le
quatrième (auto-écoute) reste un piège potentiel — voir la table ci-dessus.**

### Écouter une Feature externe

1. Dans `get listens()`, je retourne `[OtherFeature.channel]` — l'IDE
   autocomplète le token exposé par `OtherFeature`.
2. Je référence mon propre `channel` par erreur ? **TS ne le détecte pas** —
   l'erreur remonte seulement si le message écouté n'existe pas dans mon
   propre contrat, ou pas du tout avant le runtime (Phase 0c) si le
   namespace référencé n'existe dans aucun manifest.

---

## Pourquoi quatre lieux et pas un seul ?

**Question légitime.** Réponse en deux temps.

### Pourquoi pas un seul ?

Parce que plusieurs contraintes s'opposent :

- On veut le **manifest comme source de vérité unique** (un seul endroit à lire pour voir toute l'application) — §1.
- On veut que chaque Feature soit **anonyme en valeur** dans sa propre déclaration de type (§2), pour éviter un cycle `typeof` avec le value-manifest.
- On veut qu'un **consommateur externe** (une autre Feature, une View) puisse référencer le Channel d'une Feature **sans importer le manifest** — d'où le badge runtime autoporté (§3, ADR-0040).

La seule solution robuste combine le **pattern A bis** (type-manifest séparé
du value-manifest, reliés par `satisfies`) et le **token statique** porté par
chaque classe. Cf. [ADR-0039 §Le piège du typeof cyclique](../adr/ADR-0039-namespace-authority-and-uniqueness.md#le-piège-du-typeof-cyclique)
et [ADR-0040](../adr/ADR-0040-typescript-first-api-channel-definition-typed.md).

### Pourquoi `TSelfNS` en plus du token `channel` ?

Parce que le token `channel` (§3) est lu par les **consommateurs externes**
(ils ont besoin d'une valeur runtime), tandis que `TSelfNS` (§2) est lu par
le **manifest applicatif** au `satisfies` (il n'a besoin que d'un type). Les
deux doivent rester synchronisés — c'est exactement ce que vérifie
`TStrictFeatureClass<NS>` (I95) : `TSelfNS === NS` **et**
`channel.namespace === NS`. Cf. [ADR-0039 §Le paradoxe de l'auto-référence](../adr/ADR-0039-namespace-authority-and-uniqueness.md#le-paradoxe-de-lauto-référence-et-sa-résolution).

---

## Résumé visuel

```
┌─────────────────────────────────────────────────────────────┐
│  1. TYPE-MANIFEST                                           │
│     app/manifest.ts                                         │
│                                                             │
│     interface AppManifest {                                 │
│       user: unknown;        ← les noms officiels            │
│       cart: unknown;                                        │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ satisfies StrictManifest<AppManifest>
                          │
┌─────────────────────────┴───────────────────────────────────┐
│  4. VALUE-MANIFEST                                          │
│     app/main.ts                                             │
│                                                             │
│     const features = {                                      │
│       user: UserFeature,    ← le mariage nom ↔ classe       │
│       cart: CartFeature,                                    │
│     } satisfies StrictManifest<AppManifest>;                │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ vérifie TSelfNS == clé ET channel.namespace == clé (I95)
                          │
┌─────────────────────────┴───────────────────────────────────┐
│  2. SIGNATURE  +  3. TOKEN                                  │
│     app/cart/cart.feature.ts                                │
│                                                             │
│     class CartFeature extends Feature<_, TCartDef, "cart">{│
│                                              ↑                │
│       static readonly channel: TChannelToken<TCartDef,      │
│         "cart"> = { namespace: "cart" };    ↑                │
│                                              │                │
│       get listens() { return [...]; }       │                │
│     }                                       │                │
│                                              ↑                │
│               ADR-0039 I72, ADR-0046 I95 : "cart" ici DOIT   │
│                        matcher la clé du value-manifest      │
│                        ET le namespace du token              │
└─────────────────────────────────────────────────────────────┘
```

---

## Pour aller plus loin

- [ADR-0039 — Autorité, unicité et conformité des namespaces de Feature](../adr/ADR-0039-namespace-authority-and-uniqueness.md) — spécification complète
- [ADR-0040 — API TypeScript-first, définition de Channel typée](../adr/ADR-0040-typescript-first-api-channel-definition-typed.md) — le token `static readonly channel`
- [ADR-0046 — Refonte du contrat Feature](../adr/ADR-0046-feature-contract-refonte.md) — `listens`/`queries` en `abstract get` d'instance, `TStrictFeatureClass`
- [RFC feature.md](../rfc/3-couche-abstraite/feature.md) — contrat `Feature<TEntityClass, TChannelDef, TSelfNS>`
- [Invariants I68–I73, I93, I95](../rfc/reference/invariants.md) — règles non-négociables

---

_Si ce guide ne tient pas en quelques minutes de lecture, c'est qu'il est trop long — signalez-le._
