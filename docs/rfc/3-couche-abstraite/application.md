# Application

> **Orchestrateur bootstrap/shutdown, configuration globale, BonsaiRegistry**

[← Retour a la couche abstraite](README.md)

---

> **ADR-0010 (Accepted)** : bootstrap par phases (Option C retenue — 6 phases sequentielles).
> **ADR-0019 (Accepted)** : deux modes de distribution (IIFE + ESM Modulaire).
> **ADR-0014 (Accepted)** : SSR hydration via `serverState` opt-in.

## 1. Types de bootstrap (ADR-0010)

```typescript
/**
 * Identifiant de phase dans la sequence de bootstrap.
 * 6 phases executees sequentiellement — chaque phase ne demarre
 * qu'une fois la precedente integralement terminee.
 *
 * @see ADR-0010 — Bootstrap par phases (Option C retenue)
 */
type PhaseKey = 'config' | 'channels' | 'entities' | 'features' | 'views' | 'start';

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
  readonly name = 'BootstrapError';
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
class Application {
  /**
   * Enregistre une Feature aupres de l'application.
   *
   * Effet interne (D15) : le framework lit le token namespace
   * de la Feature et cree l'instance Channel runtime correspondante
   * (si elle n'existe pas deja). Le Channel est stocke dans Radio
   * et n'est jamais expose au developpeur.
   */
  register(feature: typeof Feature): void;

  /**
   * Demarre l'application — execute la sequence de bootstrap
   * par phases (ADR-0010).
   *
   * Si `options.serverState` est fourni (ADR-0014), le framework
   * pre-peuple les Entities silencieusement avant la phase `'features'`.
   *
   * @throws BootstrapError si une phase echoue
   */
  async start(options?: TBootstrapOptions): Promise<void>;

  /**
   * Arrete l'application — execute la sequence de shutdown
   * en ordre inverse des phases de bootstrap (ADR-0010).
   */
  async stop(): Promise<void>;

  /** Contexte applicatif — disponible apres `start()` */
  readonly context: TAppContext;
}
```

---

## 3. API de bootstrap (ADR-0010)

### `register(FeatureClass)`

- Stocke la reference a la classe Feature
- Lit `Feature.namespace` (derive du token `Namespace.channel`)
- Cree l'instance `Channel<TChannelDef>` interne (D15) et l'enregistre dans Radio
- Verifie l'unicite du namespace (I21, I24) — collision = erreur immediate
- Verifie que le namespace n'est pas `'local'` (I57) ni `'router'` (I28) — reserves

### `start(options?)`

Execute les 6 phases du bootstrap sequentiellement (ADR-0010).
Si une phase echoue, le bootstrap s'arrete immediatement avec un `BootstrapError`.

| Phase | `PhaseKey` | Etapes internes |
|-------|-----------|-----------------|
| 1 | `'config'` | Verification que `register()` a ete appele au moins une fois. Chargement de la configuration. |
| 2 | `'channels'` | Resolution des declarations (`listen`, `request`) — verifie que les Channels references existent dans Radio. Cablage Radio (introspection `onXXX`, peuplement des registres). |
| 3 | `'entities'` | Instanciation des Entities via D17. Instanciation Router. **Si `options.serverState` est fourni** (ADR-0014 H5), le framework itere sur chaque entree et pre-peuple l'Entity correspondante via `entity.populateFromServer(state)` — silencieusement, sans notifications ni Events. |
| 4 | `'features'` | Couche abstraite active — `onInit()` de chaque Feature. Les Entities sont deja peuplees (soit via `serverState`, soit avec `initialState`). |
| 5 | `'views'` | Creation Foundation (couche concrete commence). Pour chaque View : detection du mode SSR vs SPA **par noeud** (ADR-0014 H1). `setup()` hydrate le DOM existant (H2), `create()` genere le DOM en SPA (D30). Resolution recursive des Composers et Views. |
| 6 | `'start'` | Application dormante — evenement start (optionnel, voir Q9). |

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

| Etape | Phase inverse | Responsabilite |
|-------|---------------|----------------|
| 1 | `'views'` | Detacher les Views (`onDetach()`), detruire les Behaviors, nettoyer localState, supprimer les projections. |
| 2 | `'features'` | `onDestroy()` de chaque Feature (ordre inverse d'enregistrement). |
| 3 | `'channels'` | Desinscrire les Channels de Radio, detacher les handlers. |
| 4 | `'entities'` | Reinitialiser les Entities. |
| 5 | — | Reset Radio, `isRunning = false`. |

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
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';

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
