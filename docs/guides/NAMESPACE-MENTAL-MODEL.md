# Mental Model — Les trois lieux où vit le namespace

> **Guide concis** pour comprendre où, pourquoi et comment un namespace de Feature
> existe dans Bonsai depuis [ADR-0039](../adr/ADR-0039-namespace-authority-and-uniqueness.md).
> Lecture : 2 minutes.

---

| Champ        | Valeur                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audience** | Développeur applicatif écrivant une Feature Bonsai                                                                                                      |
| **Statut**   | 🟢 Stable                                                                                                                                               |
| **Date**     | 2026-04-21                                                                                                                                              |
| **Sources**  | [ADR-0039](../adr/ADR-0039-namespace-authority-and-uniqueness.md), [RFC feature.md](../rfc/3-couche-abstraite/feature.md), invariants I21, I24, I68–I72 |

---

## TL;DR

Un namespace de Feature vit **simultanément** dans **trois lieux** qui se vérifient mutuellement :

1. **Le type-manifest** (interface `AppManifest`) — _la carte officielle_
2. **La signature de la Feature** (paramètre `TSelfNS`) — _la déclaration d'attente_
3. **Le value-manifest** (objet `satisfies StrictManifest<…>`) — _le point de rencontre vérifié_

Si les trois s'accordent, ça compile. Sinon, l'IDE signale l'écart. **Rien d'autre à retenir.**

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
export type ExternalOf<TSelfNS extends AppNamespace> = Exclude<
  AppNamespace,
  TSelfNS
>;
export type StrictManifest<M> = {
  [K in keyof M & string]: new (namespace: K) => Feature<any, any, K>;
};
```

**Rôle** : **source de vérité des namespaces**. Ajouter une Feature = ajouter une clé ici. Renommer une Feature = renommer sa clé ici. **Rien d'autre**.

**Analogie** : c'est l'annuaire officiel. Il ne contient que des noms, pas de personnes.

---

## 2. La signature de la Feature — la déclaration d'attente

**Où** : dans la classe Feature elle-même, en troisième paramètre de type.

**Quoi** : la Feature **déclare** sous quel nom elle s'attend à être enregistrée.

```typescript
// app/cart/cart.feature.ts
import type { ExternalOf } from "@app/manifest.js";

export class CartFeature extends Feature<CartEntity, Cart.Channel, "cart"> {
  //                                                              ↑
  //   « Je suis conçue pour vivre sous la clé "cart" du manifest »
  static readonly channels: readonly ExternalOf<"cart">[] = ["user"];
  //                                                          ↑
  //   « J'écoute les autres — pas moi-même »
}
```

**Rôle** : la Feature reste **anonyme en valeur** (aucun littéral `"cart"` ne sort de sa signature de type) mais **typée en signature**. Elle prévient le manifest de la clé sous laquelle elle doit atterrir.

**Analogie** : c'est la carte de visite. Elle porte le nom attendu, pas le nom effectif — c'est l'annuaire qui valide.

---

## 3. Le value-manifest — le point de rencontre

**Où** : `app/main.ts` (l'unique endroit où l'on voit toutes les Features de l'application).

**Quoi** : un objet qui **marie** chaque nom du type-manifest à sa classe Feature, vérifié par `satisfies`.

```typescript
// app/main.ts
import type { AppManifest, StrictManifest } from "@app/manifest.js";
import { UserFeature } from "@user/user.feature.js";
import { CartFeature } from "@cart/cart.feature.js";

const features = {
  user: UserFeature,
  cart: CartFeature,
  inventory: InventoryFeature
} satisfies StrictManifest<AppManifest>;

new Application({ foundation: AppFoundation, features }).start();
```

**Rôle** : **confronter** la carte (type-manifest) aux cartes de visite (signatures des Features). Si une Feature arrive sous la mauvaise clé, TS le signale **immédiatement**.

**Analogie** : c'est le bureau d'accueil. Il lit l'annuaire, lit la carte de visite, vérifie la correspondance — ou refuse l'entrée.

---

## Les garanties du triptyque

| Erreur                                    | Qui la détecte         | Quand               |
| ----------------------------------------- | ---------------------- | ------------------- |
| Deux Features avec même namespace         | TS1117                 | Compile-time        |
| Clé non camelCase (`Cart`, `my-cart`)     | `CamelCaseNamespace`   | Compile-time        |
| Clé réservée (`local`)                    | `ValidatedManifest`    | Compile-time        |
| Feature enregistrée sous la mauvaise clé  | `StrictManifest`       | Compile-time        |
| `channels` référence un namespace inconnu | `ExternalOf<…>`        | Compile-time        |
| Feature s'écoute elle-même                | `ExternalOf<…>`        | Compile-time        |
| Cast `as any` + faute de frappe           | `assertValidNamespace` | Runtime (bootstrap) |

---

## Le flux mental du développeur

### Ajouter une Feature

1. J'ouvre **l'annuaire** (`app/manifest.ts`) et j'ajoute `myFeature: unknown`.
2. Je crée la classe : `class MyFeature extends Feature<MyEntity, MyChannel, "myFeature">`.
3. J'ouvre **le bureau d'accueil** (`app/main.ts`) et j'ajoute `myFeature: MyFeature` dans l'objet `features`.

Si j'oublie une étape, **TS refuse de compiler** et m'indique laquelle.

### Renommer une Feature

1. Je renomme la clé dans l'annuaire (`cart` → `shoppingCart`).
2. TS explose **partout** où l'ancien nom apparaissait :
   - Dans `TSelfNS` (`Feature<_, _, "cart">`) → je corrige
   - Dans `ExternalOf<"cart">` de toutes les autres Features → je corrige
   - Dans le value-manifest → je corrige
3. Je corrige les noms de méthodes `onCartXxxEvent` manuellement (pas couvert par TS).

**Aucun rename silencieux possible.**

### Écouter une Feature externe

1. Dans `ExternalOf<"myFeature">[]`, je tape `"` → l'IDE me propose **exactement** les namespaces externes valides.
2. Je pique mon propre nom par erreur ? TS refuse (auto-écoute interdite).

---

## Pourquoi trois lieux et pas un seul ?

**Question légitime.** Réponse en deux temps.

### Pourquoi pas un seul ?

Parce que deux contraintes s'opposent :

- On veut le **manifest comme source de vérité unique** (un seul endroit à lire pour voir toute l'application).
- On veut que chaque Feature puisse **typer ses Channels externes** (`channels: ExternalOf<TSelfNS>`) **dans son propre fichier**, sans introduire un cycle `typeof` avec le value-manifest.

La seule solution robuste est le **pattern A bis** : séparer `type-manifest` (interface) de `value-manifest` (objet), et relier les deux par `satisfies`. Cf. [ADR-0039 §Le piège du typeof cyclique](../adr/ADR-0039-namespace-authority-and-uniqueness.md#le-piège-du-typeof-cyclique).

### Pourquoi `TSelfNS` en plus ?

Parce que sans lui, la Feature devrait écrire `Exclude<AppNamespace, "cart">` **en dur** dans son propre fichier, ce qui contredit son anonymat de valeur et devient fragile au rename. Avec `TSelfNS`, la Feature **déclare une attente typée** qui est ensuite confrontée à la clé d'enregistrement par `StrictManifest<M>`. Cf. [ADR-0039 §Le paradoxe de l'auto-référence](../adr/ADR-0039-namespace-authority-and-uniqueness.md#le-paradoxe-de-lauto-référence-et-sa-résolution).

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
│  3. VALUE-MANIFEST                                          │
│     app/main.ts                                             │
│                                                             │
│     const features = {                                      │
│       user: UserFeature,    ← le mariage nom ↔ classe       │
│       cart: CartFeature,                                    │
│     } satisfies StrictManifest<AppManifest>;                │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ vérifie que TSelfNS == clé
                          │
┌─────────────────────────┴───────────────────────────────────┐
│  2. SIGNATURE DE LA FEATURE                                 │
│     app/cart/cart.feature.ts                                │
│                                                             │
│     class CartFeature extends Feature<_, _, "cart"> {       │
│                                     ↑                       │
│       constructor(namespace) { … }  │                       │
│                                     │                       │
│       static readonly channels:     │                       │
│         readonly ExternalOf<"cart">[] = ["user"];           │
│     }                               │                       │
│                                     ↑                       │
│               ADR-0039 I72 : "cart" ici DOIT matcher         │
│                        la clé du value-manifest             │
└─────────────────────────────────────────────────────────────┘
```

---

## Pour aller plus loin

- [ADR-0039 — Autorité, unicité et conformité des namespaces de Feature](../adr/ADR-0039-namespace-authority-and-uniqueness.md) — spécification complète
- [RFC feature.md](../rfc/3-couche-abstraite/feature.md) — contrat `Feature<TEntityClass, TChannel, TSelfNS>`
- [Invariants I68–I72](../rfc/reference/invariants.md) — règles non-négociables

---

_Si ce guide ne tient pas en 2 minutes de lecture, c'est qu'il est trop long — signalez-le._
