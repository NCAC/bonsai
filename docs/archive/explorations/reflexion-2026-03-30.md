# Réflexion 2026-03-30 — ESM Modulaire & Composition Dynamique Hétérogène

> **Contexte** : session de réflexion architecturale. L'architecture Bonsai a été posée
> (RFCs, ADRs, invariants, décisions). On se confronte maintenant au monde réel :
> les applications concrètes (CMS, back-offices, dashboards) révèlent des
> limites dans le modèle de composition actuel.
>
> Deux axes émergent de cette session — liés mais distincts :
> 1. **Mode de distribution** : IIFE vs ESM modulaire → [Partie I](#partie-i--mode-esm-modulaire-et-mode-bundle-iife)
> 2. **Composition dynamique hétérogène** : l'insuffisance du modèle Composer/Slot statique → [Document dédié](reflexion-composition-dynamique-heterogene.md)

---

# Partie I — Mode ESM Modulaire et Mode Bundle IIFE

## Relation avec l'ancienne ADR-0019 (extension points)

Le cas des plugins « externes » (anciennement ADR-0019, [déclassée en réflexion pré-ADR](reflexion-extension-points-third-party-modules.md)) répondait à un problème mal posé — périmètre trop large, mélange de 4 niveaux d'extensibilité très différents. Le « Mode ESM Modulaire » proposé ici répond plus directement à la problématique soulevée :

- **L'ancienne ADR-0019** identifie les 4 niveaux de besoin d'extensibilité (Plugin package → Contribution point → Late registration → Micro-apps) et les tensions architecturales — ce matériau reste utile comme source de réflexion
- **Le mode ESM modulaire** fournit le **mécanisme technique concret** pour les Niveaux 1 (packages) et 2 (contribution points)
- Les Niveaux 3 (late registration) et 4 (micro-apps) restent hors périmètre pour l'instant

> **Décision prise (2026-04-01)** : Le découpage s'est affiné en trilogie d'ADR :
> - **[ADR-0019](adr/ADR-0019-mode-esm-modulaire.md)** — Mode ESM Modulaire (BonsaiRegistry, bootstrap dynamique)
> - **[ADR-0020](adr/ADR-0020-composers-n-instances-composition-heterogene.md)** — N-instances Composer & CDH périmètre réduit
> - **[ADR-0021](adr/ADR-0021-composition-monde-ouvert-plateforme.md)** — Monde ouvert / plateforme (anciennement ADR-0019 Extension Points, renommé)

---

## 1. Mode Bundle IIFE

Le mode IIFE consiste à produire un bundle unique contenant :

- le runtime Bonsai,
- l'ensemble des Features,
- les Views et Composers,
- toute la logique embarquée.

Ce bundle est ensuite chargé en une fois dans le navigateur.

**✔ Avantages**

- Livraison unique : un seul fichier JS, simple à distribuer.
- Environnement totalement maîtrisé : aucun risque de fuite de modules.
- Runtime instancié une seule fois, éliminant les collisions.
- Performances initiales bonnes en HTTP/1.

**❌ Inconvénients**

- Compilation centralisée obligatoire : tout doit être connu au build.
- Impossible d'ajouter des Features dynamiquement après compilation.
- Impossible de charger des modules contextuels selon la page, la route ou l'environnement.
- Import inter-modules impossible : les modules ne sont plus des unités autonomes.
- Dépendance à un bundler (Webpack, Rollup, Vite).
- Rigidité structurelle : l'architecture ne s'adapte pas aux scénarios multi-modules ou distribués.
- Faible granularité : une modification mineure peut entraîner un rebuild complet.

---

## 2. Mode ESM Modulaire

Le mode ESM modulaire propose de distribuer Bonsai sous forme :

- d'un runtime ESM (`bonsai.esm.js`)
- et d'un ensemble de fichiers ESM autonomes représentant chacun :
  - une Feature
  - un Composer
  - une View
  - un Behavior

Chaque module est un fichier JS distinct, compilé depuis TypeScript sans bundler, et chargé nativement via `type="module"`.

**✔ Avantages**

- Aucun bundler requis : compile TypeScript → ES Modules, terminé.
- Modularité totale : chaque Feature vit dans son fichier, importable individuellement.
- Découverte dynamique : un Registry central collecte les Features, Composers, Views déclarés dans les modules réellement chargés.
- Extensibilité naturelle : les modules peuvent importer les Features d'autres modules via ESM.
- Composition UI flexible : via des Composer Injection ou des Slots déclaratifs.
- Lazy-loading natif : `import()` dynamique.
- Modèle déclaratif : chaque module déclare ce qu'il apporte au runtime (`BonsaiRegistry.registerFeature(...)`).
- Granularité fine : modifier 1 module = recompiler 1 fichier.

**❌ Inconvénients**

- Multiplication des requêtes JS (atténué par HTTP/2 & HTTP/3).
- Nécessite une discipline modulaire (exposer ou non un module via une API publique).
- L'application doit effectuer un bootstrap dynamique, en collectant les modules présents via un Registry.

---

## 3. Comparaison synthétique

| Critère | Mode IIFE | Mode ESM Modulaire |
|---------|-----------|-------------------|
| Build | Bundler obligatoire | TS → JS direct |
| Découverte des Features | Statique | Dynamique |
| Extensibilité | Faible | Forte |
| Chargement par périmètre | Impossible | Natif |
| Cross‑module imports | ❌ | ✔ |
| Lazy loading | Complexe | `import()` natif |
| Granularité | Monolithique | Modulaire |
| Adaptation multi‑modules | Mauvaise | Excellente |
| Composition UI | Rigidité | Slots + injections dynamiques |

---

## 4. Modèle d'enregistrement des Features en mode ESM

Chaque module ESM fait :

```js
import { BonsaiRegistry } from "/bonsai/bonsai.esm.js";
import { MyFeature } from "./MyFeature.js";
BonsaiRegistry.registerFeature("my_namespace", MyFeature);
```

L'application hôte fait :

```js
import { Application, BonsaiRegistry } from "/bonsai/bonsai.esm.js";
const app = new Application();
const modules = BonsaiRegistry.collect();
modules.features.forEach(f => app.register(f));
app.start();
```

➡️ Le runtime Bonsai ne dépend plus du contexte de build,
➡️ mais uniquement des modules ESM réellement présents au chargement.

---

## 5. Composition UI en mode ESM

Le mode ESM permet une composition UI dynamique grâce à :

**✔ Slots déclaratifs dans les Composers**

```js
class MyComposer extends Composer {
  static slots = { widget: "slot:widget" };
}
```

**✔ Injections déclarées dans les modules**

```js
BonsaiRegistry.registerComposerInjection({
  target: "app:MyComposer",
  slot: "widget",
  view: MyWidgetView,
  match: (ctx) => ctx.id === "field_foo",
});
```

**Le Composer sélectionne la View adéquate via `resolve()` :**

```js
resolve(context) {
  const injections = this.requestExtensions({ slot: "widget" });
  const match = injections.find(i => i.match(context));
  return match?.view ?? null;
}
```

➡️ Composition dynamique,
➡️ isolation stricte,
➡️ jamais d'accès direct au DOM hôte,
➡️ et pas besoin de bundler.

> ⚠️ **Avertissement — illustrations conceptuelles**
>
> Les exemples ci-dessus (`static slots`, `registerComposerInjection()`, `requestExtensions()`,
> l'identifiant `"app:MyComposer"`) sont des **esquisses directionnelles**, pas des API spécifiées.
> Plusieurs mécanismes sous-jacents restent à formaliser :
>
> - **`static slots`** — n'existe pas dans les RFC/ADR actuels. Les Composers sont déclarés
>   via `get composers()` dans la View, pas via un `static slots` sur le Composer lui-même.
> - **`"app:MyComposer"`** — présuppose un identifiant string addressable par Composer.
>   Aujourd'hui, seuls les Features et Channels ont un namespace string public (I21, D14).
>   Les Composers n'ont pas de mécanisme d'identification formel.
> - **`BonsaiRegistry`** — sa nature (composant runtime vs convention d'usage) est une
>   question ouverte (QO-ESM-3).
> - **`registerComposerInjection` / `requestExtensions`** — mécanismes illustratifs.
>   Leur design dépend de la formalisation du Registry et du système d'identification
>   des Composers.
>
> Voir aussi : [réflexion extension points](reflexion-extension-points-third-party-modules.md)
> (anciennement ADR-0019) qui identifie les tensions architecturales liées à ces mécanismes.

---

## 6. Cas pratique : intégration dans un environnement CMS classique

Modèle applicable à n'importe quel CMS :

- Le CMS charge des scripts ESM par module fonctionnel.
- Chaque module déclare Feature-s, Entity-ies, View-s, Behavior-s ou Composer-s
- Le runtime Bonsai "recompose" l'application à chaque page/route.
- La composition UI est déterminée par les modules réellement présents.
- Les injections UI sont contrôlées via Slots sécurisés.

---

## 7. Conclusion Partie I

Le mode bundle IIFE est adapté aux applications front‑end uniques et fermées.
Le mode ESM modulaire est adapté aux architectures distribuées, extensibles, multi‑modules et évolutives.

Pour un framework comme Bonsai visant :

- modularité,
- typage strict,
- composition UI déclarative,
- intégration progressive dans des environnements complexes,
- chargement différentiel selon les pages,

le mode ESM modulaire est nettement supérieur :
c'est la seule approche qui offre la flexibilité et l'extensibilité nécessaires sans sacrifier la cohérence de l'architecture Bonsai.

---

## 🔶 Questions ouvertes — Partie I

### QO-ESM-1 — Ordre de chargement et `BonsaiRegistry.collect()`

Les modules ESM se chargent de manière asynchrone et non-déterministe (surtout avec `import()` dynamique). Or, `BonsaiRegistry.collect()` suppose que tous les modules ont fait leur `registerFeature()` **avant** que l'app appelle `collect()`.

**À résoudre** : comment garantir que tous les modules ESM ont terminé leur enregistrement avant `app.start()` ? Mécanisme envisageable : manifest déclaratif, `Promise.all()` explicite, pattern « prêt quand le DOM dit prêt » ?

### QO-ESM-2 — `registerComposerInjection` et I37

L'exemple §5 introduit `registerComposerInjection()` qui injecte des Views dans des slots de Composer depuis l'extérieur. I37 dit : « Un Composer gère 0 ou 1 View dans un slot ». Si plusieurs modules injectent dans le même slot, qui arbitre ?

**Hypothèse** : `registerComposerInjection` respecte le 1:1 — le Composer choisit **une** injection parmi N candidates via `match(context)`. Ce n'est pas N Views simultanées dans un slot, c'est N candidats pour un poste.

**Mais** : si le besoin est réellement N Views simultanées dans un scope, voir le [document sur la composition dynamique hétérogène](reflexion-composition-dynamique-heterogene.md).

### QO-ESM-3 — Nature de `BonsaiRegistry`

Est-ce un composant du runtime Bonsai (existe dans le code du framework) ou un pattern d'usage (convention pour les développeurs) ?

---

# Partie II — Composition Dynamique Hétérogène

> Ce sujet a été développé dans un document dédié en raison de sa densité et de son importance :
> **➡️ [reflexion-composition-dynamique-heterogene.md](reflexion-composition-dynamique-heterogene.md)**
>
> Résumé : le modèle Composer/Slot statique (I37, D24) ne couvre pas le cas des
> applications dont la structure UI est déterminée au runtime (CMS, dashboards,
> layout builders). Un nouveau modèle de « composition dynamique hétérogène »
> est nécessaire — le Composer pouvant gérer N Views hétérogènes dans N points
> de montage à l'intérieur de son scope fixe.
