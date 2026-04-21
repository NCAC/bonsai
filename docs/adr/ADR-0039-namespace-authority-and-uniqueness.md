# ADR-0039 : Autorité, unicité et conformité des namespaces de Feature

| Champ                   | Valeur                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Statut**              | 🟢 Accepted                                                                                                                                                                                                                                                                                                                                                              |
| **Date**                | 2026-04-21                                                                                                                                                                                                                                                                                                                                                               |
| **Décideurs**           | @ncac                                                                                                                                                                                                                                                                                                                                                                    |
| **RFC liées**           | RFC-0001-invariants-decisions, RFC-0002-feature, RFC-0002-channel                                                                                                                                                                                                                                                                                                        |
| **ADR liées**           | [ADR-0001](ADR-0001-entity-diff-notification-strategy.md), [ADR-0003](ADR-0003-channel-runtime-semantics.md), [ADR-0004](ADR-0004-validation-modes.md), [ADR-0015](ADR-0015-local-state-mechanism.md), [ADR-0019](ADR-0019-mode-esm-modulaire.md), [ADR-0024](ADR-0024-component-capabilities-manifest-pattern.md), [ADR-0037](ADR-0037-feature-generic-entity-class.md) |
| **Décisions amendées**  | I21, I24 (formulation runtime → compile-time + filet runtime) ; D5, D6 (registre de namespaces)                                                                                                                                                                                                                                                                          |
| **Invariants impactés** | I21, I22, I24, I57 (amendés) — I68 à I72 (nouveaux, à intégrer dans RFC-0001-invariants-decisions)                                                                                                                                                                                                                                                                       |

---

## Contexte

Garantir, le plus tôt possible — idéalement au compile-time —, que tout namespace de Feature enregistré dans une `Application` est :

1. **Conforme** à un format strict (camelCase plat, lettres uniquement)
2. **Unique** dans l'application (pas de collision)
3. **Non-réservé** (`local` aujourd'hui ; ouvert à extension future)

Et garantir que les références croisées entre Features (Channels écoutés via `static channels`) pointent vers des namespaces réellement existants dans cette application.

### État actuel (strate 0)

[packages/feature/src/bonsai-feature.ts](../../packages/feature/src/bonsai-feature.ts) :

```typescript
export abstract class Feature<
  TEntity extends JsonSerializable = JsonSerializable
> {
  static readonly namespace: string; // ← chaîne libre, non vérifiée
  static readonly channels: readonly string[] = []; // ← chaînes libres, non vérifiées
}
```

Vérifications effectives ([packages/application/src/bonsai-application.ts](../../packages/application/src/bonsai-application.ts), `register()`) :

- ✅ Existence (truthy + `typeof === "string"`)
- ✅ Mot réservé `"local"` (hard-codé)
- ✅ Collision (`Set` d'instance)
- ❌ Format camelCase
- ❌ Cohérence des `static channels`
- ❌ Aucune garantie compile-time

### Pourquoi c'est critique

| Faille                                                      | Conséquence                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Deux Features avec même namespace                           | Channels qui se marchent dessus, Entities mélangées, état corrompu silencieusement   |
| Namespace mal-formé (`my-cart`, `Cart`, `cart_v2`)          | Incohérence du nommage des handlers (`onCartItemAddedEvent`), bugs de matching regex |
| Référence à un Channel inexistant (`channels = ["catlog"]`) | Listener silencieusement ignoré, bug de propagation indétectable                     |
| Mot réservé (`local`) utilisé comme namespace               | Confusion avec mécanismes framework (ADR-0015), comportements imprévisibles          |

Toute la couche événementielle et tout le state reposent sur ces invariants. Un bug détecté à l'exécution dans cette zone est, par construction, un bug détecté **trop tard**.

### Hypothèse de cadrage

Bonsai n'a **pas** de cas d'usage multi-`Application` dans un même runtime. Une page = une Application. Cette hypothèse simplifie radicalement la conception (pas de scoping multi-instance, pas de registre global).

---

## Contraintes

- **C1** — Respecter les invariants existants : I21 (namespace unique camelCase), I22 (1:1:1 namespace ↔ Feature ↔ Entity), I24 (Application garante au bootstrap), I57 (`local` réservé, ADR-0015)
- **C2** — Respecter [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) (`Entity.mutate()` unique — l'Entity est tirée du namespace)
- **C3** — Respecter [ADR-0019](ADR-0019-mode-esm-modulaire.md) — namespaces vérifiés cross-module
- **C4** — Respecter [ADR-0037](ADR-0037-feature-generic-entity-class.md) — la signature `Feature<TEntityClass, TChannel>` est désormais celle en vigueur ; tout ajout de paramètre de type vient s'**ajouter** sans casser cet acquis
- **C5** — Conserver l'auto-discovery par convention de nommage (`onXxxCommand`, `onXxxRequest`, `onChannelXxxEvent`) — pas de migration vers décorateurs dans le périmètre de cet ADR
- **C6** — Conserver un filet de sécurité runtime (cas où le compile-time est contourné par cast `as any`, code JS pur, manifest dynamique)

---

## Options considérées

### Option A — Statu quo + durcissement runtime seul

**Description** : conserver `static namespace` sur la classe, ajouter au `register()` une regex camelCase et une validation des `channels` contre le `Set` interne. Aucune garantie compile-time.

| Avantages                                                 | Inconvénients                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| + Aucun changement d'API                                  | - Toute violation reste détectée au runtime, donc potentiellement après déploiement |
| + Zéro coût de migration                                  | - L'IDE ne guide pas, la doc reste l'unique source d'apprentissage                  |
| + Compatible avec n'importe quel pattern d'enregistrement | - Aucune garantie de cohérence des références croisées (`channels`)                 |
|                                                           | - Échec frontal vs philosophie Bonsai « Compile-time > Runtime »                    |

```typescript
// Inchangé
class CartFeature extends Feature<CartEntity, CartChannel> {
  static readonly namespace = "cart";
  static readonly channels = ["user"];
}
app.register(CartFeature); // validation runtime renforcée
```

---

### Option B — Builder fluent paramétré

**Description** : `Application.use(Feature)` retourne un `Application<{...prev, ns: Feature}>`. L'unicité émerge de l'accumulation des types des namespaces dans la signature de l'instance.

| Avantages                           | Inconvénients                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| + Unicité compile-time stricte      | - Impose un style fluent invasif (`app.use(F1).use(F2).use(F3).start()`)                  |
| + Pas de manifest séparé            | - Pas de **vue centralisée** des namespaces (dispersés sur N appels chaînés)              |
| + Aucun effort déclaratif explicite | - Mauvaise lisibilité au-delà de 3-4 Features                                             |
|                                     | - Force le namespace à être passé en string littérale dans chaque `use()` → couplage fort |

```typescript
const app = new Application({ foundation: AppFoundation })
  .use("user", UserFeature)
  .use("cart", CartFeature)
  .start();
```

---

### Option C — Augmentation d'interface globale (`declare module`)

**Description** : chaque Feature augmente une interface globale `BonsaiNamespaceRegistry` ; la clé d'enregistrement est dérivée de `keyof BonsaiNamespaceRegistry`.

| Avantages                             | Inconvénients                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| + Déclaratif, sans manifest explicite | - **TS merge silencieusement** les augmentations en doublon : ne signale PAS les collisions de clés |
| + Type centralisé virtuel             | - Mécanisme global, difficile à scoper à plusieurs Applications (hors cadre, mais futur fragile)    |
|                                       | - Comportement opaque, difficile à enseigner                                                        |
|                                       | - **Disqualifié** pour porter l'unicité                                                             |

---

### Option D — Manifest applicatif typé (`satisfies StrictManifest<M>`) ✅

**Description** : le namespace n'est plus déclaré sur la classe Feature. Il est porté par un **manifest applicatif** central : un objet TypeScript dont les clés sont les namespaces et les valeurs les classes Feature. La cohérence classe ↔ clé est vérifiée par un mapped type au `satisfies`. Une Feature déclare en paramètre de type `TSelfNS` le nom sous lequel elle s'attend à être enregistrée — ce qui résout le paradoxe de l'auto-référence (cf. _Décision_ §6).

| Avantages                                                                                | Inconvénients                                                                |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| + **Unicité gratuite** : un objet TS ne peut pas avoir deux fois la même clé (TS1117)    | - Deux artefacts manifest (interface + valeur) — séparation `type` / `value` |
| + **Format compile-time** : index signature `[K in string as CamelCaseNamespace<K>]`     | - Légère verbosité : paramètre de type `TSelfNS` en plus sur Feature         |
| + **Centralisation** : un seul endroit où l'on voit la totalité des namespaces actifs    | - Disparition de `Application.register()` (breaking change vs API strate 0)  |
| + **Cohérence classe ↔ clé** vérifiée par `StrictManifest<M>` au `satisfies`             |                                                                              |
| + **Inversion de responsabilité** : la Feature est anonyme en valeur, typée en signature |                                                                              |
| + **Compatible** avec un futur typage des events `Exclude<AppNamespace, "self">`         |                                                                              |

```typescript
// app/manifest.ts — TYPE-MANIFEST, zéro classe importée
export interface AppManifest {
  user: unknown;
  cart: unknown;
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

```typescript
// app/cart/cart.feature.ts
import type { ExternalOf } from "@app/manifest.js"; // type-only

export class CartFeature extends Feature<CartEntity, CartChannel, "cart"> {
  static readonly channels: readonly ExternalOf<"cart">[] = ["user"];
  // "catlog" → erreur compile-time
  // "cart"   → erreur compile-time (auto-écoute interdite)
}
```

```typescript
// app/main.ts — VALUE-MANIFEST
import type { AppManifest, StrictManifest } from "@app/manifest.js";

const features = {
  user: UserFeature,
  cart: CartFeature
  // cart: AnotherFeature, ← TS1117 (clé dupliquée)
  // Cart: CartFeature,    ← clé non camelCase → never
  // user: CartFeature,    ← TSelfNS "cart" ≠ clé "user" → erreur satisfies
} satisfies StrictManifest<AppManifest>;

const app = new Application({ foundation: AppFoundation, features });
app.start();
```

---

## Analyse comparative

| Critère                               | A — Statu quo runtime | B — Builder fluent | C — `declare module`  | D — Manifest typé |
| ------------------------------------- | --------------------- | ------------------ | --------------------- | ----------------- |
| Unicité compile-time                  | ❌                    | ⭐⭐⭐             | ❌ (merge silencieux) | ⭐⭐⭐ (TS1117)   |
| Format camelCase compile-time         | ❌                    | ⚠️ (par littéral)  | ❌                    | ⭐⭐⭐            |
| Cohérence `channels` compile-time     | ❌                    | ⭐⭐⭐             | ⭐⭐                  | ⭐⭐⭐            |
| Centralisation / lisibilité           | ⭐⭐                  | ⭐                 | ⭐                    | ⭐⭐⭐            |
| Coût de migration                     | ⭐⭐⭐ (nul)          | ⭐                 | ⭐⭐                  | ⭐⭐              |
| DX (autocomplétion / erreurs guidées) | ⭐                    | ⭐⭐               | ⭐⭐                  | ⭐⭐⭐            |
| Conformité philosophie Bonsai         | ⭐                    | ⭐⭐               | ⭐                    | ⭐⭐⭐            |
| Risque cyclique de type               | ⭐⭐⭐ (nul)          | ⭐⭐⭐ (nul)       | ⭐⭐⭐ (nul)          | ⭐⭐ (mitigé §8)  |

---

## Décision

Nous choisissons **Option D — Manifest applicatif typé**, complétée par :

1. **Pattern A bis** : séparation `type-manifest` (interface) / `value-manifest` (objet `satisfies`) pour éviter le piège du `typeof` cyclique.
2. **Paramètre de type `TSelfNS extends string`** sur la classe `Feature`, résolvant le paradoxe de l'auto-référence (la Feature est anonyme en valeur, typée en signature).
3. **Injection du namespace par constructeur paramétré** (option c des 5 examinées), garantissant l'immuabilité dès construction.
4. **Filet de sécurité runtime** conservé au `start()` pour les cas où le compile-time est contourné.

### Pourquoi D (et pas A, B, C)

- **A** est rejetée parce qu'elle laisse l'invariant le plus structurel du framework dépendre d'un check `Set.has()` au runtime — incompatible avec le principe « Compile-time > Runtime » de Bonsai.
- **B** est rejetée parce qu'elle impose une API fluent invasive sans bénéfice supplémentaire vs D pour l'unicité, et perd la centralisation déclarative.
- **C** est **disqualifiée techniquement** : TypeScript merge silencieusement les augmentations d'interface en doublon, donc l'augmentation globale ne peut pas porter l'unicité.

### Le paradoxe de l'auto-référence et sa résolution

Une formulation initiale typait les Channels externes via `Exclude<AppNamespace, "cart">` directement dans `cart.feature.ts`. Cela suppose que la Feature connaît déjà son propre nom — ce qui contredit l'intention « la Feature est anonyme, c'est le manifest qui la nomme ». Et c'est fragile au renommage : si le manifest renomme `cart → shoppingCart`, l'`Exclude<…, "cart">` continue à compiler en silence.

| Option de résolution                      | Anonymat valeur                      | Self-exclusion compile-time | Détection rename | Compat. auto-discovery `on…Event` |
| ----------------------------------------- | ------------------------------------ | --------------------------- | ---------------- | --------------------------------- |
| **① Paramètre de type `TSelfNS`** ✅      | Anonyme en valeur, typé en signature | ✅                          | ✅               | ✅                                |
| ② Renoncer à `Exclude` (auto-ref runtime) | Total                                | ❌                          | ⚠️               | ✅                                |
| ③ Déplacer `channels` dans le manifest    | Total                                | ✅                          | ✅               | ❌ (casse `on…Event`)             |

L'option ① est retenue : la Feature **déclare en paramètre de type** son namespace attendu, et `StrictManifest<M>` confronte ce paramètre à la clé d'enregistrement.

### Mécanisme d'injection retenu — option c (constructeur paramétré)

Cinq mécanismes ont été examinés (méthode publique préfixée, Symbol non exporté, constructeur paramétré, friend pattern, WeakMap externe). Le **constructeur paramétré** est retenu :

- ✅ Immuable dès construction — pas de phase « avant bootstrap »
- ✅ Sémantique forte (« une Feature N'EXISTE PAS sans son namespace »)
- ✅ Idiomatique TypeScript
- ✅ Pas de Symbol/WeakMap partagé entre packages (sécurité de dépendances)
- ⚠️ Casse la signature `new ()` du manifest → `new (namespace: K) =>` — **accepté**, car c'est précisément ce qui permet à `StrictManifest<M>` de vérifier la cohérence `K ↔ TSelfNS`

```typescript
// packages/feature/src/bonsai-feature.ts (extrait après ADR-0039)
export abstract class Feature<
  TEntityClass extends Entity<TJsonSerializable>,
  TChannel extends TChannelDefinition,
  TSelfNS extends string = string
> {
  readonly #namespace: TSelfNS;

  constructor(namespace: TSelfNS) {
    assertValidNamespace(namespace); // filet runtime
    this.#namespace = namespace;
  }

  get namespace(): TSelfNS {
    return this.#namespace;
  }

  protected abstract get Entity(): new () => TEntityClass;
  // … emit, request, bootstrap → inchangés sur le fond
}
```

> **Note** — Cette signature **étend** sans casser celle d'[ADR-0037](ADR-0037-feature-generic-entity-class.md) : `TSelfNS` est ajouté en troisième paramètre avec une valeur par défaut `string`, donc tout code existant qui écrit `Feature<MyEntity, MyChannel>` continue de compiler.

### Le piège du `typeof` cyclique

Un premier réflexe naturel — `type AppManifest = typeof features` — provoque un cycle d'évaluation de type quand `Feature.channels` est typé via `Exclude<AppNamespace, "self">` :

1. `typeof features` exige le type de la valeur
2. La valeur contient les classes Feature
3. Le type des classes inclut `static channels: readonly Exclude<AppNamespace, "self">[]`
4. `AppNamespace = keyof typeof features` → cycle

TS résout en `string` par fallback (élargissement silencieux) ou émet `TS7022`. **Indéterministe.**

Le **pattern A bis** brise le cycle : déclarer `AppManifest` comme **interface explicite** (zéro classe importée), puis vérifier la cohérence du `value-manifest` par `satisfies`. Les cycles **type-only** (`interface ↔ interface` via `import type`) restent autorisés ; le piège est spécifique à `typeof` appliqué à une valeur littérale qui contient les classes.

### Mots réservés

```typescript
// packages/feature/src/types.ts (nouveau)
export const RESERVED_NAMESPACES = ["local"] as const;
export type ReservedNamespace = (typeof RESERVED_NAMESPACES)[number];

export type ValidatedManifest<M> = {
  [K in keyof M as K extends ReservedNamespace ? never : K]: M[K];
};
```

`RESERVED_NAMESPACES` est une constante framework, **non configurable** par l'application — toute extension future (`router`, `extensions`, `any`, …) se fera par modification de cette constante, propagée via le typage dérivé.

### Filet de sécurité runtime

Conservé au `start()` :

```typescript
for (const ns of Object.keys(this.#manifest)) {
  assertCamelCase(ns);
  assertNotReserved(ns);
}
for (const FeatureClass of Object.values(this.#manifest)) {
  for (const declared of FeatureClass.channels ?? []) {
    assertNamespaceExists(declared, this.#manifest);
  }
}
```

Erreur typée : `BonsaiNamespaceError` (étend `BonsaiRegistryError` mentionné par [ADR-0003](ADR-0003-channel-runtime-semantics.md)). Codes stables :

- `NAMESPACE_INVALID_FORMAT`
- `NAMESPACE_RESERVED`
- `NAMESPACE_DUPLICATE` (théoriquement impossible avec le manifest, mais filet)
- `NAMESPACE_UNKNOWN_REFERENCE` (pour `static channels`)

> L'erreur `NAMESPACE_NOT_ASSIGNED` envisagée pour les options a/b/d/e du mécanisme d'injection devient **caduque** avec l'option c (constructeur paramétré).

---

## Conséquences

### Positives

- ✅ **Unicité des namespaces garantie au compile-time** par TS1117 (clé d'objet dupliquée)
- ✅ **Format camelCase garanti au compile-time** via `CamelCaseNamespace<S>` template literal type
- ✅ **Cohérence classe ↔ clé manifest garantie au compile-time** via `StrictManifest<M>` au `satisfies`
- ✅ **Cohérence des références croisées (`channels`) garantie au compile-time** via `ExternalOf<TSelfNS>`
- ✅ **Auto-référence interdite au compile-time** (Feature ne peut pas s'écouter elle-même)
- ✅ **Détection des renames** : modifier un namespace dans `AppManifest` provoque une cascade d'erreurs sur tous les sites concernés
- ✅ **Centralisation** : un seul endroit (le manifest) où l'on voit la totalité des namespaces actifs
- ✅ **Immuabilité** du namespace dès construction (option c)
- ✅ **Disparition d'une zone d'erreur silencieuse** : faute de frappe dans `channels` détectée par l'IDE avant compilation
- ✅ **Filet runtime conservé** pour les cas de contournement (`as any`, code JS, manifest dynamique)

### Négatives (acceptées)

- ⚠️ **Disparition de `Application.register()`** — _breaking change_ vs API strate 0. Accepté car la strate 0 est toute fraîche et le volume de code consommateur est faible (tests + fixtures internes).
- ⚠️ **Deux artefacts manifest** (interface `AppManifest` + valeur `features`) — accepté comme prix de la résolution du cycle `typeof` et de la séparation type/valeur.
- ⚠️ **Verbosité légère** : le paramètre de type `TSelfNS` ajoute une annotation par classe Feature. Compensé par la clarté contractuelle (« cette Feature s'attend à être enregistrée sous _cette_ clé »).
- ⚠️ **La Feature N'EST PAS purement anonyme** : elle déclare en signature de type le nom sous lequel elle s'attend à être enregistrée. C'est un **couplage typé et vérifié**, pas un couplage par chaîne libre — assumé comme le bon compromis entre anonymat et robustesse.
- ⚠️ **Renommer une Feature** dans une application requiert de modifier (a) la clé du manifest, (b) le `TSelfNS` de la classe, (c) ses méthodes `on{Channel}{Event}Event` qui référencent d'autres Features. (b) et (c) sont signalés par TS — c'est exactement le comportement souhaité.

### Risques identifiés

- 🔶 **TS lent sur `CamelCaseNamespace<S>` profond** — mitigation : templates simples (lettres seules), longueur max raisonnable des namespaces ; benchmark à surveiller dans la CI.
- 🔶 **Sortie du pattern par cast `as any`** — mitigation : filet runtime conservé, erreurs typées explicites avec codes stables.
- 🔶 **Plugins tiers (futur) qui veulent ajouter une Feature post-bootstrap** — _hors-scope ADR-0039_ ; un futur ADR « extension manifest » traitera ce cas.
- 🔶 **Migration des tests strate 0** — volume faible, ADR fait office de breaking change documenté avant strate 1.

### Invariants nouveaux (à intégrer dans RFC-0001-invariants-decisions)

| Réf | Contenu                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I68 | Le namespace d'une Feature est porté par le **manifest applicatif** uniquement (clé), pas par un `static` sur la classe Feature.                                                                      |
| I69 | Le manifest applicatif est l'unique source de vérité de l'identité des Features.                                                                                                                      |
| I70 | Toute référence à un namespace externe (`Feature.channels`) DOIT être validée contre le manifest, compile-time si possible, runtime au minimum.                                                       |
| I71 | Les namespaces réservés sont définis dans une constante framework `RESERVED_NAMESPACES` — une Feature applicative ne peut pas les utiliser.                                                           |
| I72 | Le paramètre de type `TSelfNS` d'une Feature DOIT correspondre exactement à la clé sous laquelle elle est enregistrée dans le manifest — vérifié compile-time par `StrictManifest<M>` au `satisfies`. |

### Invariants amendés

| Réf | Avant                                                | Après                                                                                                                                       |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| I21 | « Chaque Feature DOIT déclarer un namespace unique » | « Chaque Feature DOIT être enregistrée dans le manifest applicatif sous une clé namespace unique camelCase plat »                           |
| I24 | « Application garantit l'unicité au bootstrap »      | « Le typage du manifest garantit l'unicité au compile-time ; Application valide format + réservés + cohérence des `channels` au bootstrap » |

### Impact sur le code existant

| Fichier                                                                                                      | Changement                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [packages/feature/src/bonsai-feature.ts](../../packages/feature/src/bonsai-feature.ts)                       | Suppression `static namespace`, ajout `#namespace` immuable, constructeur paramétré, getter sans throw, ajout `TSelfNS` en 3ᵉ paramètre de type                              |
| [packages/application/src/bonsai-application.ts](../../packages/application/src/bonsai-application.ts)       | Refonte : prend `features: TManifest` au lieu de `register()`, validation format/réservés/channels au start, `#namespaces: Set<string>` supprimé (clés du manifest font foi) |
| `packages/feature/src/types.ts` (nouveau)                                                                    | `CamelCaseNamespace<S>`, `RESERVED_NAMESPACES`, `ValidatedManifest`, `BonsaiNamespaceError`                                                                                  |
| [tests/fixtures/cart-feature.fixture.ts](../../tests/fixtures/cart-feature.fixture.ts)                       | Suppression `static namespace`, ajustement constructeur paramétré                                                                                                            |
| [tests/e2e/strate-0.cart-round-trip.test.ts](../../tests/e2e/strate-0.cart-round-trip.test.ts)               | Le test crée son propre manifest                                                                                                                                             |
| [tests/unit/strate-0/application.bootstrap.test.ts](../../tests/unit/strate-0/application.bootstrap.test.ts) | Tests de l'API manifest, plus de `register()`                                                                                                                                |
| RFC-0002-feature, RFC-0001-invariants-decisions                                                              | Mise à jour des sections namespace + invariants amendés/nouveaux                                                                                                             |

---

## Actions de suivi

- [ ] Implémenter sur branche dédiée `feature/strate-1-namespace-manifest`
- [ ] Mettre à jour [RFC-0002-feature](../rfc/3-couche-abstraite/feature.md) — section namespace
- [ ] Mettre à jour [RFC-0001-invariants-decisions](../rfc/reference/invariants.md) — invariants I21, I24 amendés ; ajout I68 à I72
- [ ] Migrer les tests strate 0 (fixtures + tests `application.bootstrap`)
- [ ] Ajouter tests de type dédiés (`expectError<…>` sur clé non camelCase, clé réservée, mismatch `TSelfNS`)
- [ ] Documenter le pattern dans un guide concis « Mental Model — Les trois lieux où vit le namespace » (manifeste-type, manifeste-valeur, instance)
- [ ] Valider par exécution complète de la suite de tests (gate E2E inclus)
- [ ] Supprimer le pré-ADR `docs/namespace-feature.md` une fois ce document acté

---

## Hors-scope explicite

À NE PAS confondre avec ce sujet, à instruire séparément :

- **Typage des events** par namespace (`emit("itemAdded", payload)` typé) — sujet « pattern C — `listenOn` typé »
- **Découverte par décorateurs** au lieu de conventions de nommage `on…Event`
- **Système de plugins** qui injecte des Features tierces post-bootstrap
- **Multi-Application** dans un même runtime — non couvert par Bonsai (confirmé)
- **Renommage propagé** dans les noms de méthode `onCartItemAddedEvent` — la convention de nommage des handlers reste manuelle

---

## Annexe — Esquisse de `CamelCaseNamespace<S>`

```typescript
type Letter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type LowerLetter = Letter;
type AnyLetter = LowerLetter | Uppercase<Letter>;

type AllLetters<S extends string> = S extends ""
  ? true
  : S extends `${infer Head}${infer Tail}`
    ? Head extends AnyLetter
      ? AllLetters<Tail>
      : false
    : false;

/** camelCase plat = première lettre minuscule + reste exclusivement lettres. */
export type CamelCaseNamespace<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends LowerLetter
      ? AllLetters<Rest> extends true
        ? S
        : never
      : never
    : never;
```

**Tests de type attendus** :

| Entrée                   | Résultat           |
| ------------------------ | ------------------ |
| `"cart"`                 | `"cart"` ✅        |
| `"userProfile"`          | `"userProfile"` ✅ |
| `"Cart"` (PascalCase)    | `never` ❌         |
| `"my-cart"` (kebab-case) | `never` ❌         |
| `"my_cart"` (snake_case) | `never` ❌         |
| `"cart2"` (chiffres)     | `never` ❌         |
| `""`                     | `never` ❌         |
| `"a"`                    | `"a"` ✅           |

> Si tolérer les chiffres après la première lettre devient nécessaire, étendre `AnyLetter` à `Letter | Uppercase<Letter> | Digit` avec `type Digit = "0" | "1" | … | "9"`. Une telle évolution fera l'objet d'un nouvel ADR.

---

## Références

- [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) — `Entity.mutate()` unique
- [ADR-0003](ADR-0003-channel-runtime-semantics.md) — `BonsaiRegistryError` (parent de `BonsaiNamespaceError`)
- [ADR-0004](ADR-0004-validation-modes.md) — Bootstrap = phase de validation
- [ADR-0015](ADR-0015-local-state-mechanism.md) — `local` réservé
- [ADR-0019](ADR-0019-mode-esm-modulaire.md) — Namespaces vérifiés cross-module
- [ADR-0024](ADR-0024-component-capabilities-manifest-pattern.md) — Pattern manifeste value-first (`as const satisfies`)
- [ADR-0037](ADR-0037-feature-generic-entity-class.md) — Signature `Feature<TEntityClass, TChannel>`
- TypeScript Handbook — [Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
- TypeScript Handbook — [Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)

---

## Historique

| Date       | Changement                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------- |
| 2026-04-21 | Pré-ADR rédigé (`docs/namespace-feature.md`) puis amendé pour intégrer Option ① (`TSelfNS`) |
| 2026-04-21 | Promotion en ADR formel — Accepted                                                          |
