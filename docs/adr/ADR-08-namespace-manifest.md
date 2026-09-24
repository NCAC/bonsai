# ADR-08 — Namespace : manifest applicatif typé

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I21, I22, I24, I57, I68, I69, I70, I71, I72 |
| **Livré** | ✅ |
| **Spec** | [application.md](../spec/3-couche-abstraite/application.md) · [NAMESPACE-MENTAL-MODEL.md](../guides/NAMESPACE-MENTAL-MODEL.md) |

## Contexte

Le namespace est la clé d'identité universelle d'un domaine : il nomme le
Channel, l'Entity et préfixe les messages (`"cart:addItem"`). Porté par un
`static namespace` sur la classe, son unicité ne pouvait être vérifiée qu'au
runtime (`Set.has()`), ce qui contredit « Compile-time > Runtime ».

## Décision

Le namespace est porté **uniquement par la clé du manifest applicatif** (I68, I69).
Deux artefacts séparés évitent le cycle `typeof` :

```ts
// type-manifest — zéro import de classe
export type AppManifest = { cart: unknown; user: unknown };

// value-manifest
const features = {
  cart: CartFeature,          // CartFeature extends Feature<CartEntity, TCartDef, "cart">
  user: UserFeature,
} satisfies StrictManifest<AppManifest>;
```

Garanties **compile-time** via `StrictManifest<M>` :

- **Unicité** : une clé dupliquée est rejetée par TS1117 (I21, I24).
- **Format** : `camelCase` plat, lettres uniquement (`CamelCaseNamespace<S>`).
- **Noms réservés** : `RESERVED_NAMESPACES = ["local", "router"]` résolus en `never` (I57, I71).
- **Cohérence classe ↔ clé** : le 3ᵉ générique `TSelfNS` de la Feature et `static channel.namespace` doivent égaler la clé (I72, I95 — ADR-09).

Le namespace est **injecté au constructeur** (`new CartFeature("cart")`) et
immuable dès construction. La Feature est anonyme en valeur (aucun littéral
`"cart"` dans son code) mais typée en signature.

**Filet runtime** au `start()` (phases 0a et 0c) pour les contournements (`as any`,
JS pur, manifest dynamique). Il lève `BonsaiNamespaceError` avec un code stable :
`assertValidNamespace()` → `NAMESPACE_INVALID_FORMAT` (non `camelCase`, vide) ou
`NAMESPACE_RESERVED` ; phase 0a → `FEATURE_MISSING_CHANNEL` (pas de `static channel`)
et `FEATURE_CHANNEL_NAMESPACE_MISMATCH` (`channel.namespace` ≠ clé) ; phase 0c →
`NAMESPACE_UNKNOWN_REFERENCE` (un token de `listens`/`queries` ne désigne aucune
clé du manifest, I70). `NAMESPACE_DUPLICATE` est déclaré mais **jamais levé** : les
clés d'un objet ne peuvent pas être dupliquées à l'exécution, l'unicité relève de TS1117.

Relation **1:1:1** : un namespace = une Feature = une Entity, Entity obligatoire
même vide (I22).

## Alternatives rejetées

- **Statu quo `static namespace` + durcissement runtime** — l'invariant le plus structurel du framework resterait runtime-only.
- **Builder fluent `app.register(ns, Feature)`** — API invasive, perd la vue déclarative centralisée.
- **Augmentation d'interface globale (`declare module`)** — disqualifiée : TypeScript fusionne silencieusement les doublons, l'unicité est impossible à porter.
- **Namespace hiérarchique, `kebab-case`, séparateur `/` ou `.`** — rejetés dès l'origine : `camelCase` plat se lit en identifiant TS et en préfixe de handler (`onCartItemAddedEvent`).

## Conséquences

- `Application.register()` n'existe pas : le manifest est la seule forme d'enregistrement.
- Renommer un domaine = changer la clé du manifest + le `TSelfNS` de la classe ; le compilateur signale tous les sites en cascade.
- L'existence d'un namespace **référencé** (`listens`, `queries`) n'est vérifiable qu'au runtime : le type-manifest a des valeurs `unknown` (I70).
- Plugins tiers ajoutant une Feature après bootstrap : hors périmètre (voir roadmap, plateforme).
