# Application

> **Déclaration du Manifest, démarrage sur le noyau, arrêt partiel**

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lots M6.1 à M6.3, 1er novembre 2026).** Non livrés : arrêt complet, SSR, configuration globale (§5). En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

[← Retour à la couche abstraite](README.md)

---

> Décisions : [ADR-07](../../adr/ADR-07-application-bootstrap.md) (démarrage), [ADR-08](../../adr/ADR-08-namespace-manifest.md) (Manifest applicatif), [ADR-09](../../adr/ADR-09-feature-contract.md) (constructeur inerte), [ADR-24](../../adr/ADR-24-hydratation-ssr.md) (`serverState`, cible) ; théorie 16.9, D14, D15, D1, annexe B.

## 1. Rôle

`Application` est une **instance légère** : elle réunit le Manifest, crée **une racine de communication** (`Root`, G6) et la démarre. Ensuite elle est **dormante** : elle n'émet, n'écoute ni n'interroge rien (I23). La chorégraphie vit dans les Features (ADR-01).

Le Manifest (16.9) ne contient aucune référence (A3.d) : il désigne des **classes**. Il ne change pas pendant la vie de la racine (D14).

## 2. API

```typescript
const features = {
  cart: CartFeature,
  user: UserFeature
} satisfies StrictManifest<AppManifest>;

const app = new Application({
  features,
  router: true,                       // Feature de navigation (D15)
  adapters: [HistoryAdapter],         // adaptateurs de l'hôte (D7, annexe B)
  adapterOptions: { history: { traversalTimeoutMs: 2000 } },
  document,                           // hôte (D3) ; requis avec foundation ou adapters
  foundation: AppFoundation,
  anchor: "body",                     // élément de la Foundation (D3), "body" par défaut
  causalBound: 50                     // borne causale (D9), 50 par défaut
});
app.start();
```

| Option | Rôle |
| --- | --- |
| `features` | Features applicatives : clé = namespace, valeur = classe (I68, I69) |
| `router` | Active la Feature `router` fournie par le framework ([router.md](router.md)) |
| `adapters` | Classes d'adaptateurs de l'hôte, une par catégorie (B.2) ; chacune peut exiger des Features (`requires`) |
| `adapterOptions` | Paramètres de création sérialisables, par catégorie |
| `document` | Document hôte ; les ressources distribuables et les parts y sont admises et matérialisées |
| `foundation` | Classe de la Foundation, facultative ([foundation.md](../4-couche-concrete/foundation.md)) |
| `anchor` | Sélecteur de l'élément que la Foundation admet |
| `components` | Autres enfants de la racine (description `TManifestEntry`) : sondes de test |
| `causalBound` | Borne des chaînes causales (D9) |

```typescript
class Application<M extends TFeaturesManifest> {
  constructor(options?: TApplicationOptions<M>);  // aucun effet de bord ; valide les combinaisons d'options
  start(): void;                                  // une seule fois
  stop(): void;                                   // retire les observateurs de l'hôte (B.2) ; ne détruit pas le modèle
  readonly started: boolean;
  readonly root: Root | null;                     // la racine, après start()
}
```

`satisfies StrictManifest<AppManifest>` vérifie à la compilation : clé camelCase plate (I21), non réservée (`local`, `router`, I57, I71), `TSelfNS` accordé à la clé (I72). Le constructeur refuse : une `foundation` ou des `adapters` sans `document` ; deux adaptateurs de même catégorie ; un adaptateur dont la Feature requise (`router`) est absente.

## 3. `start()` — séquence

Les phases 0 n'ont **aucun effet de bord** : un Manifest invalide échoue avant qu'un composant existe.

| Phase | Contenu | Invariants |
| --- | --- | --- |
| **0a** | Format et réservation de chaque clé ; `static channel` présent ; `channel.namespace` = clé | I21, I22, I57, I71, I73 |
| **0b** | Instanciation de chaque Feature (constructeur inerte) | I94 |
| **0c** | Lecture de `listens` et `queries` ; tout namespace référencé existe dans le Manifest (`router` s'il est activé) | I70, I93 |
| **1** | Une `Root` ; dans **une seule unité de démarrage** (§2.5), création des enfants, dans cet ordre : Features (et `router`), adaptateurs, Foundation, `components` ; les Features respectent leurs dépendances initiales `queries` (C.1) | I56, G6 |

- Chaque Feature est créée avec son Entity, ses handlers, puis `onInit(ctx)` (I56) ; la Foundation admet son ancre et crée ses Composers, qui créent leurs Views.
- Si un composant échoue, tout le modèle en construction est abandonné (`StartupError`, cause conservée). Les messages différés et les admissions attendent le succès du démarrage.
- Les effets sur l'hôte (matérialisation des parts, écriture dans le document) sont engagés **après** validation du démarrage (C.3) : une erreur de slot y figure dans la trace du noyau, non dans une exception de `start()`.
- `start()` est la frontière de confiance (I66) : ce que le typage garantit et qu'un `as any` pourrait contourner y est revérifié.

**Erreurs** : `BonsaiNamespaceError` (`NAMESPACE_INVALID_FORMAT`, `NAMESPACE_RESERVED`, `NAMESPACE_UNKNOWN_REFERENCE`, `FEATURE_MISSING_CHANNEL`, `FEATURE_CHANNEL_NAMESPACE_MISMATCH`) ; `ManifestError` (dépendance initiale inconnue ou cyclique) ; `StartupError` (échec dans l'unité de démarrage).

## 4. `stop()` — partiel

`stop()` retire les observateurs que Bonsai a posés sur l'hôte (B.2). **Il ne détruit ni les composants ni l'état** : la racine reste en mémoire. L'arrêt complet est une cible (§5).

## 5. Non livré

| Élément | Statut |
| --- | --- |
| Arrêt ordonné (`onDestroy`, destruction de la racine) | Cible |
| `start({ serverState })` : pré-peuplement SSR silencieux ([ADR-24](../../adr/ADR-24-hydratation-ssr.md)) | Cible |
| Erreur de démarrage typée par phase | Cible |
| Configuration globale (mode strict, niveau de log, DevTools) | Point d'entrée non tranché |
| Foundation obligatoire (I33) | Suspendu : une Application sans Foundation est légitime (tests, sans interface) |

## 6. Pas de Channel `app`

Le framework ne crée aucun Channel de cycle de vie (`app:started`, `feature:ready`) : l'ordre du démarrage garantit qu'aucun abonné n'existerait à ce moment. `app` n'est **pas** un namespace réservé.

---

## Lecture suivante

→ [Router](router.md) — Feature de navigation et adaptateur historique
