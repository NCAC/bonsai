# Application

> **Orchestrateur bootstrap/shutdown, configuration globale, BonsaiRegistry**

[← Retour a la couche abstraite](README.md)

---

> **ADR-0010 (Accepted)** : bootstrap par phases (Option C retenue — 6 phases sequentielles).
> **ADR-0019 (Accepted)** : deux modes de distribution (IIFE + ESM Modulaire).
> **ADR-0014 (Accepted)** : SSR hydration via `serverState` opt-in.

---

> ### ⏳ Périmètre d'implémentation (ADR-0028)
>
> Ce document décrit le **contrat cible complet** d'Application (6 phases, async,
> SSR, BonsaiRegistry, BootstrapError typée). Conformément au phasage kernel-first,
> certaines capacités sont **différées** :
>
> | Élément                                                              | Strate cible | Sections concernées |
> | -------------------------------------------------------------------- | ------------ | ------------------- |
> | Bootstrap async (`start(): Promise<void>`) + `BootstrapError` typée  | Strate 1     | §1, §2              |
> | Phases `'config'` et `'start'` (6 phases au total au lieu de 4)      | Strate 1     | §1                  |
> | `TBootstrapOptions.serverState` (SSR hydratation, ADR-0014)          | Strate 1     | §1                  |
> | `TApplicationConfig` complet (`mode`, `debug`, providers, registry…) | Strate 1     | §1                  |
> | `BonsaiRegistry` ESM modulaire (ADR-0019)                            | Strate 2     | §3                  |
> | `Application.stop()` / shutdown ordonnée                             | Strate 2     | —                   |
> | DevTools hooks                                                       | Strate 2     | —                   |
>
> **Strate 0 — périmètre effectif (post-ADR-0039)** : `Application` est instanciée via `new Application({ foundation, features })`. Le **manifest applicatif typé** (`features`) est l'autorité unique des namespaces (I68–I72) — vérifié compile-time par `StrictManifest<M>` (camelCase plat, non-réservé, `TSelfNS` aligné sur la clé). Aucun `static namespace` sur les classes Feature (I68). `start(): void` synchrone en **4 phases** (Channels → Entities implicites → Features+`bootstrap()`/`onInit` (I56) → Foundation.attach). Foundation **obligatoire** au start (I33). `app.started` exposé en lecture. Aucun runtime API (I23).
>
> Voir aussi : [ADR-0028](../../adr/ADR-0028-implementation-phasing-strategy.md), [ADR-0010](../../adr/ADR-0010-bootstrap-phases.md).

## 1. Types de bootstrap (ADR-0010)

```typescript
/**
 * Identifiant de phase dans la sequence de bootstrap.
 * 6 phases executees sequentiellement — chaque phase ne demarre
 * qu'une fois la precedente integralement terminee.
 *
 * @see ADR-0010 — Bootstrap par phases (Option C retenue)
 */
type PhaseKey =
  | "config"
  | "channels"
  | "entities"
  | "features"
  | "views"
  | "start";

/**
 * Contexte applicatif construit progressivement durant le bootstrap.
 * Chaque phase recoit les resultats des phases precedentes.
 * Disponible dans sa totalite apres la phase `'start'`.
 */
type TAppContext = {
  readonly config: TApplicationConfig;
  readonly radio: Radio;
  readonly channels: ReadonlyMap<string, Channel<TChannelDefinition>>;
  readonly entities: ReadonlyMap<string, Entity<TEntityStructure>>;
  readonly features: ReadonlyArray<Feature>;
  readonly views: ReadonlyArray<View>;
};

/**
 * Erreur de bootstrap localisee par phase.
 * Permet au developpeur d'identifier precisement quelle etape a echoue.
 *
 * @example
 * app.start().catch(err => {
 *   if (err instanceof BootstrapError) {
 *     console.error(`Failed at phase: ${err.phase}`);
 *     showErrorUI(err.phase, err.cause);
 *   }
 * });
 */
class BootstrapError extends Error {
  readonly name = "BootstrapError";
  constructor(
    /** Phase durant laquelle l'erreur s'est produite */
    readonly phase: PhaseKey,
    /** Erreur originale */
    readonly cause: Error
  ) {
    super(`Bootstrap failed at phase "${phase}": ${cause.message}`);
  }
}

/**
 * Options de bootstrap — passees a `Application.start()`.
 *
 * @see ADR-0014 — SSR hydration strategy (Option A + extension opt-in)
 */
type TBootstrapOptions = {
  /**
   * State initial serialise par le serveur (opt-in).
   * Cle = namespace Feature (I21, I22).
   * Valeur = TEntityStructure serialisee (D10 — JsonSerializable).
   *
   * Si fourni, le framework pre-peuple les Entities **silencieusement**
   * (sans emettre d'Events ni de notifications) **avant** le premier `onAttach()`.
   *
   * Validations en mode debug :
   * - Chaque cle DOIT correspondre a un namespace Feature declare (I21/I22)
   * - Chaque valeur DOIT etre du JSON valide
   * - Cles `'router'` (I28) et `'local'` (I57) -> erreur (namespaces reserves)
   * - Namespace inconnu -> warning (ignore en mode strict : throw)
   *
   * @default undefined — les Features re-fetchent au bootstrap (Option A pure)
   */
  serverState?: Record<string, TJsonSerializable>;
};
```

---

## 2. Classe Application

```typescript
import type { StrictManifest, AppNamespace } from "@bonsai/feature";
import type { Foundation } from "@bonsai/foundation";

/**
 * Manifest applicatif typé (ADR-0039) — l'autorité unique des namespaces.
 *
 * - Clé : namespace (validé camelCase, non-réservé, par `StrictManifest<M>`)
 * - Valeur : constructeur Feature `(namespace) => Feature<...>`
 *
 * Le compile-time vérifie via `satisfies StrictManifest<AppManifest>` que
 * la classe Feature exposée a `TSelfNS` aligné sur la clé (I72).
 */
type TFeaturesManifest = Readonly<
  Record<string, new (namespace: string) => Feature<any, any, any>>
>;

type TApplicationOptions<M extends TFeaturesManifest = TFeaturesManifest> = {
  /** Foundation concrète — obligatoire au `start()` (I33). */
  readonly foundation?: typeof Foundation;
  /** Manifest applicatif (clé = namespace, valeur = classe Feature). */
  readonly features?: M;
};

class Application<M extends TFeaturesManifest = TFeaturesManifest> {
  /**
   * Construit une Application — déclare le manifest applicatif (ADR-0039).
   * Aucun side-effect ici ; le bootstrap a lieu dans `start()`.
   */
  constructor(options?: TApplicationOptions<M>);

  /**
   * Démarre l'application — bootstrap synchrone en 4 phases (ADR-0010 simplifié strate 0) :
   *
   *   Phase 0 — Validation runtime du manifest (filet ADR-0039 — I70/I71/I72)
   *   Phase 1 — Channels   : `Radio.channel(namespace)` pour chaque entrée
   *   Phase 2 — Entities   : créées implicitement par `Feature.bootstrap()`
   *   Phase 3 — Features   : `new FeatureClass(namespace)` + `bootstrap()` + `onInit` (I56)
   *   Phase 4 — Foundation : `new FoundationClass()` puis `attach()`
   *
   * @throws si appelée deux fois (pas de re-bootstrap en strate 0)
   * @throws `BonsaiNamespaceError` si le manifest viole les invariants
   *         (filet runtime — le compile-time aurait dû l'attraper)
   * @throws si aucune `foundation` n'a été fournie au constructeur (I33).
   */
  start(): void;

  /** Vrai après un `start()` réussi. Lecture seule. */
  readonly started: boolean;
}
```

> **Pas de `register()`** (ADR-0039) — l'enregistrement statique est remplacé par la
> déclaration value-first du manifest dans le constructeur. Le namespace n'est plus
> porté par un `static namespace = "..."` sur la classe Feature (I68) mais par la
> clé du manifest, transmise au constructeur de la Feature `(namespace: string)`.

---

## 3. API de bootstrap (ADR-0010)

### Manifest applicatif typé (ADR-0039) — remplace `register()`

```typescript
// type-manifest — l'identité de chaque namespace, sans aucun import de classe.
export type AppManifest = {
  cart: unknown;
  user: unknown;
};
export type AppNamespace = keyof AppManifest;

// value-manifest — déclaré au point d'entrée de l'app.
// `satisfies StrictManifest<AppManifest>` valide compile-time :
//   • clé camelCase (I21) et non réservée (I71 — `local` interdit)
//   • clé en correspondance 1:1 avec AppManifest (I24)
//   • TSelfNS de la classe Feature aligné sur la clé (I72)
const features = {
  cart: CartFeature,
  user: UserFeature,
} satisfies StrictManifest<AppManifest>;

new Application({ foundation: AppFoundation, features }).start();
```

- Le **manifest** porte les namespaces ; la classe Feature reçoit son namespace via le constructeur (`new FeatureClass(namespace)`).
- L'**unicité** des namespaces est garantie par la nature même d'un `Record` (I22) ; le compile-time empêche les collisions.
- Les namespaces réservés (`'local'` — I57, I71 ; `'router'` — I28) sont rejetés au compile-time par `StrictManifest<M>`, et un filet runtime au `start()` lève `BonsaiNamespaceError` si la validation compile-time a été contournée.

### `start(options?)`

Execute les 6 phases du bootstrap sequentiellement (ADR-0010).
Si une phase echoue, le bootstrap s'arrete immediatement avec un `BootstrapError`.

| Phase | `PhaseKey`   | Etapes internes                                                                                                                                                                                                                                                                     |
| ----- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `'config'`   | Validation runtime du manifest (filet ADR-0039 — `StrictManifest<M>` aurait dû l'attraper compile-time). Chargement de la configuration.                                                                                                                                          |
| 2     | `'channels'` | Resolution des declarations (`listen`, `request`) — verifie que les Channels references existent dans Radio. Cablage Radio (introspection `onXXX`, peuplement des registres).                                                                                                       |
| 3     | `'entities'` | Instanciation des Entities via D17. Instanciation Router. **Si `options.serverState` est fourni** (ADR-0014 H5), le framework itere sur chaque entree et pre-peuple l'Entity correspondante via `entity.populateFromServer(state)` — silencieusement, sans notifications ni Events. |
| 4     | `'features'` | Couche abstraite active — `onInit()` de chaque Feature. Les Entities sont deja peuplees (soit via `serverState`, soit avec `initialState`).                                                                                                                                         |
| 5     | `'views'`    | Creation Foundation (couche concrete commence). Pour chaque View : detection du mode SSR vs SPA **par noeud** (ADR-0014 H1). `setup()` hydrate le DOM existant (H2), `create()` genere le DOM en SPA (D30). Resolution recursive des Composers et Views.                            |
| 6     | `'start'`    | Application dormante — evenement start (optionnel, voir Q9).                                                                                                                                                                                                                        |

### Diagramme de dependances entre phases

```
    Config
      |
      v
    Radio ----------------------------------------+
      |                                           |
      v                                           |
  +---------+    +---------+    +---------+       |
  |Channel A|    |Channel B|    |Channel C|       |
  +----+----+    +----+----+    +----+----+       |
       |              |              |             |
       v              v              v             |
  +---------+    +---------+    +---------+       |
  |Entity A |    |Entity B |    |Entity C |       |
  +----+----+    +----+----+    +----+----+       |
       |              |              |             |
       +--------------+--------------+             |
                      |                            |
                      v                            |
                +----------+                       |
                | Features | (accedent N channels/entities)
                +----+-----+                       |
                     |                             |
                     v                             |
                +----------+                       |
                |  Views   | (dans le DOM)         |
                +----+-----+                       |
                     |                             |
       +-------------+-------------+               |
       v             v             v               |
  +---------+  +----------+  +----------+          |
  |Behaviors|  | Composers|  |Projections|         |
  +---------+  +----------+  +----------+          |
```

> **Invariant de phase** : chaque phase ne demarre qu'une fois la phase precedente
> **integralement terminee**. Il n'existe pas de phase intermediaire ou une View
> existerait alors qu'une Feature serait "en cours de demarrage".

### `stop()`

Execute le shutdown en **ordre inverse** des phases de bootstrap (ADR-0010) :

| Etape | Phase inverse | Responsabilite                                                                                             |
| ----- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| 1     | `'views'`     | Detacher les Views (`onDetach()`), detruire les Behaviors, nettoyer localState, supprimer les projections. |
| 2     | `'features'`  | `onDestroy()` de chaque Feature (ordre inverse d'enregistrement).                                          |
| 3     | `'channels'`  | Desinscrire les Channels de Radio, detacher les handlers.                                                  |
| 4     | `'entities'`  | Reinitialiser les Entities.                                                                                |
| 5     | —             | Reset Radio, `isRunning = false`.                                                                          |

---

## 4. Configuration globale

```typescript
type TApplicationConfig = {
  /** Limite anti-boucle pour les metas (I9) — defaut : 10 */
  maxHops: number;

  /** Mode debug — active les logs et les validations supplementaires */
  debug: boolean;

  /** Mode strict — transforme les warnings en erreurs */
  strict: boolean;

  /** Granularite des logs (defaut : 'warn') */
  logLevel: "error" | "warn" | "info" | "debug" | "trace";

  /** Activer la validation des declarations au bootstrap (defaut : true) */
  validateAtBootstrap: boolean;

  /** Activer les hooks DevTools (defaut : false) — voir devtools */
  enableDevTools: boolean;
};
```

---

## 5. Namespace `app` reserve

> **Q9** : le namespace `app` est **reserve** (comme `router`),
> mais le Channel n'est pas cree tant qu'aucun cas d'usage concret ne le justifie.
>
> L'ordre de bootstrap rend les Events lifecycle
> (`app:started`, `feature:ready`) structurellement inutiles :
> aucun listener n'existe au moment ou ils seraient emis.

---

## Lecture suivante

→ [Router](router.md) — specialisation Feature pour la navigation
