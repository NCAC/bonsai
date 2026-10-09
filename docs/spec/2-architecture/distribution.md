# Distribution : mode IIFE et mode ESM modulaire

> **Deux modes de distribution, `BonsaiRegistry`, topologie des packages**

[← Retour à l'architecture](README.md)

---

> Décisions : [ADR-27](../../adr/ADR-27-mode-esm-modulaire.md) (modes de distribution),
> [ADR-28](../../adr/ADR-28-monorepo-packages.md) (topologie), [ADR-29](../../adr/ADR-29-toolchain-build.md) (build).
>
> ## ⏳ Périmètre d'implémentation
>
> **Livré** : un runtime unique `core/dist/bonsai.js` (format ES) + `bonsai.d.ts`,
> consommé comme une application monolithique (§2). **Non livré** (strate 2+, hors v1) :
> `BonsaiRegistry`, modules `*.esm.js` par composant, bundle IIFE, CLI `bonsai build`.

## 1. Deux modes de distribution

| Aspect | Mode IIFE (bundle) | Mode ESM modulaire (cible) |
| --- | --- | --- |
| **Livraison** | un fichier (`bonsai.iife.js` + code applicatif) | runtime `bonsai.esm.js` + un module `*.esm.js` par composant |
| **Chargement** | `<script>` classique | `<script type="module">` |
| **Résolution** | au build (bundler) | au runtime (navigateur) |
| **`BonsaiRegistry`** | inutile | obligatoire |
| **Types** | `bonsai.d.ts` | un `*.d.ts` par module, toujours livré avec son `.esm.js` |
| **Cas d'usage** | application monolithique fermée | CMS, back-offices, modules livrés par des équipes différentes |

## 2. Bootstrap monolithique

Tous les composants sont connus au build. C'est le mode livré aujourd'hui.

```typescript
import { Application, type StrictManifest } from "@bonsai/core";
import { AppFoundation } from "./app.foundation";
import { CartFeature } from "./Cart/cart.feature";
import { UserFeature } from "./User/user.feature";

export type AppManifest = { cart: unknown; user: unknown };

const features = {
  cart: CartFeature,   // clé = namespace (ADR-08)
  user: UserFeature,
} satisfies StrictManifest<AppManifest>;

new Application({ foundation: AppFoundation, features }).start();
```

## 3. Mode ESM modulaire — `BonsaiRegistry`

> ⏳ Cible, non livré.

Les composants sont des modules ES natifs chargés par le navigateur. Chaque
module déclare ses composants auprès du `BonsaiRegistry` au chargement ; le
bootstrap collecte ces déclarations pour **alimenter le manifest applicatif**,
puis démarre l'Application exactement comme en §2.

```html
<!-- 1. Runtime -->
<script type="module" src="/bonsai/bonsai.esm.js"></script>
<!-- 2. Modules métier : l'ordre HTML est l'ordre d'exécution -->
<script type="module" src="/modules/cart/cart.feature.esm.js"></script>
<script type="module" src="/modules/user/user.feature.esm.js"></script>
<!-- 3. Bootstrap, en dernier -->
<script type="module" src="/app/bootstrap.esm.js"></script>
```

Contraintes du registry :

- le **namespace reste la clé du manifest** (ADR-08) : le registry ne l'invente pas et ne le lit pas sur la classe ;
- l'API publique reste `new Application({ foundation, features })` : pas de `app.register()` ;
- `collect()` rend un instantané immuable et **verrouille** le registry ; un enregistrement après `collect()` est une erreur en mode strict, ignoré sinon ;
- déclarer deux fois le même namespace est une erreur (I21) ;
- `reset()` n'existe que pour les tests ;
- c'est un singleton runtime, comme Radio.

> **Point ouvert** (ADR-27) : un manifest alimenté au runtime ne bénéficie plus
> de `satisfies StrictManifest` pour les modules chargés tard ; seul le filet
> runtime de `start()` (I21) s'applique. La forme exacte de l'API de
> déclaration sera fixée avec ce point.

---

## 4. Topologie des packages (ADR-28)

Un package pnpm par composant. Dépendances `@bonsai/*` **déclarées** aujourd'hui
dans les `package.json` :

```text
@bonsai/types      @bonsai/immer    @bonsai/rxjs    @bonsai/valibot   (feuilles)
@bonsai/error      → types
@bonsai/event      → types, error, rxjs
@bonsai/entity     → error, immer
@bonsai/feature    → entity, error, event, types
@bonsai/view       → event
@bonsai/composer   → view
@bonsai/foundation → composer
@bonsai/application→ event, feature, foundation
@bonsai/core       → barrel : ré-exporte les packages publics
```

Le graphe est un DAG. `@bonsai/behavior` n'existe pas encore (strate 2).

> ⚠️ **Frontières non imposées** : TypeScript et Jest résolvent `@bonsai/*` par
> alias de chemins, sans consulter les `dependencies`. `view` importe
> `@bonsai/feature` et `@bonsai/types` sans les déclarer, et cela compile. Voir
> ADR-28 (références de projet ou règle de lint à mettre en place).

### Convention d'import — deux audiences, deux règles

**Développeur d'application** (consommateur du framework) :

```typescript
// ✅ Un seul import à connaître
import { Application, Feature, Entity, View, Composer } from "@bonsai/core";

// ❌ Interdit — imports internes réservés au framework
import { Entity } from "@bonsai/entity";
```

> ⚠️ `@bonsai/core` n'exporte pas encore `@bonsai/entity` ni `@bonsai/error`
> (ADR-28) : en attendant, le premier import ne compile pas pour `Entity`.

**Développeur framework** (code inter-packages) :

```typescript
// ✅ Import depuis le package du composant — dépendance explicite
import { Entity } from "@bonsai/entity";
import { Feature } from "@bonsai/feature";
import { Channel, Radio } from "@bonsai/event";

// ❌ Interdit — crée des dépendances circulaires et masque le DAG
import { Entity } from "@bonsai/core";
```

**Tests — l'import dépend du niveau :**

| Niveau | Import | Objectif |
| --- | --- | --- |
| **Unit** (`tests/unit/`) | `from "@bonsai/entity"` | Prouve l'isolation, charge le minimum |
| **Intégration** (`tests/integration/`) | `from "@bonsai/core"` | Teste comme un consommateur |
| **E2E** (`tests/e2e/`) | `from "@bonsai/application"` et la fixture partagée (`@bonsai/entity`, `@bonsai/feature`, `@bonsai/view`…) | ⚠️ pas `@bonsai/core` : le barrel n'exporte pas `Entity` (ADR-28) |

### Structure d'un package composant

```text
packages/{name}/
  package.json          → "@bonsai/{name}", dépendances @bonsai/* nécessaires uniquement
  tsconfig.json         → extends tsconfig.base.json (présent sur error, event, immer, rxjs, types, valibot seulement)
  src/
    bonsai-{name}.ts    ← point d'entrée : classe principale et exports publics
    *.class.ts, types.ts ← découpage optionnel (ex. event/channel.class.ts, feature/types.ts)
  dist/                 → artefact versionné (ADR-30)
```

`@bonsai/core` (dans `core/`) est le seul méta-package : barrel pur, sans code
propre, qui ré-exporte la surface publique des composants (pas `Channel` ni `Radio`, I80).

---

## Lecture suivante

→ [Erreurs](erreurs.md) — categories d'erreurs, propagation, diagnostics
