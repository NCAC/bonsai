# Application

> 🟠 **Partiellement aligné sur la théorie V0.9.5 (lot M6.1, 1er novembre 2026).** Le démarrage des Features sur le noyau est livré (§2, §3). La Foundation n'est **pas encore branchée** (lot M6.2) : son phase 4 et l'invariant I33 sont suspendus. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).


> **Déclaration du manifest, bootstrap par phases, arrêt**

[← Retour à la couche abstraite](README.md)

---

> Décisions : [ADR-07](../../adr/ADR-07-application-bootstrap.md) (bootstrap par phases),
> [ADR-08](../../adr/ADR-08-namespace-manifest.md) (manifest applicatif),
> [ADR-09](../../adr/ADR-09-feature-contract.md) (constructeur inerte, phases 0a–0c),
> [ADR-24](../../adr/ADR-24-hydratation-ssr.md) (`serverState`).
>
> ## ⏳ Périmètre d'implémentation
>
> | Élément | État |
> | --- | --- |
> | `new Application({ foundation, features })`, `start()` synchrone, phases 0a → 4 | ✅ |
> | `stop()` et arrêt ordonné | ⏳ strate 1 |
> | Erreur de bootstrap typée, localisée par phase | ⏳ strate 1 |
> | `start({ serverState })` — pré-peuplement SSR | ⏳ strate 2c (ADR-24) |
> | Configuration globale (debug, strict, DevTools…) | ⏳ point d'entrée non tranché (§4) |

## 1. Rôle

`Application` est une **instance légère** : elle déclare le manifest, démarre
l'application et, à terme, l'arrête. Entre les deux, elle est **dormante** : pas
de `handle`, `emit`, `listen` ni `request`, aucune logique métier (I23). La
chorégraphie vit dans les Features (ADR-01).

## 2. API

```typescript
import { Application, type StrictManifest } from "@bonsai/core";

// type-manifest — l'identité des namespaces, sans import de classe
export type AppManifest = { cart: unknown; user: unknown };
export type AppNamespace = keyof AppManifest;

// value-manifest — clé = namespace, valeur = classe Feature
const features = {
  cart: CartFeature,
  user: UserFeature,
} satisfies StrictManifest<AppManifest>;

const app = new Application({ features });
app.start();
app.started; // true
```

```typescript
type TFeaturesManifest = Readonly<
  Record<string, new (namespace: string) => Feature<any, any, any>>
>;

type TApplicationOptions<M extends TFeaturesManifest = TFeaturesManifest> = {
  readonly features?: M;
  readonly components?: readonly TManifestEntry[]; // autres enfants de la racine (Foundation, adaptateurs ; sondes en test)
  readonly causalBound?: number;                   // borne des chaînes causales fixée par le Manifest (D9) ; 50 par défaut
};

class Application<M extends TFeaturesManifest = TFeaturesManifest> {
  constructor(options?: TApplicationOptions<M>); // aucun side-effect
  start(): void;
  readonly started: boolean;
  readonly root: Root | null;                    // la racine de communication, après start() (G6)
}
```

- Le **manifest** est l'autorité unique des namespaces (I68, I69) : la classe Feature reçoit le sien par son constructeur, `new FeatureClass(namespace)`. Il n'y a ni `register()` ni `static namespace`.
- `satisfies StrictManifest<AppManifest>` vérifie au compile-time : clé camelCase plate (I21), non réservée — `local` (I57), `router` (I28) — (I71), `TSelfNS` de la classe aligné sur la clé (I72), présence et cohérence de `static channel` (I73, I95).
- Une clé dupliquée est une erreur de compilation (TS1117) : l'unicité (I21) ne dépend pas du runtime.

## 3. `start()` — séquence de bootstrap

`start()` exécute des phases **strictement ordonnées**. Les phases 0a–0c n'ont **aucun effet de bord** : un manifest invalide échoue avant qu'une seule Feature existe.

| Phase | Contenu | Effet | Invariants |
| --- | --- | --- | --- |
| **0a** | Filet runtime du manifest : format et réservation de chaque clé, `static channel` présent, `channel.namespace` = clé | aucun | I21, I22, I57, I71, I73 |
| **0b** | Instanciation de chaque Feature (constructeur inerte : ni Entity ni noyau) | aucun | I94 |
| **0c** | Lecture de `instance.listens` et `instance.queries` ; chaque namespace référencé doit exister dans le manifest | aucun | I70, I93 |
| **1** | Une `Root` ; les Features puis les `components` deviennent ses enfants, dans un ordre qui respecte les dépendances initiales (`queries`, C.1). Pour chaque Feature, dans l'unité de démarrage : création de l'Entity, déclaration des handlers (I48), `onInit(ctx)` | racine | I48, I56 |

- Le démarrage est **une seule unité** (§2.5) : si une Feature échoue, tout le modèle en construction est abandonné (`StartupError`, la cause d'origine est conservée).
- Les messages différés et les admissions attendent le succès du démarrage.
- La Foundation, ses Composers et ses Views seront des enfants de la racine à partir du lot M6.2 ; leur phase (ancienne phase 4) n'existe pas encore.
- `start()` est la **frontière de confiance** (I66) : ce que le typage garantit et qu'un `as any` ou du JavaScript pur pourrait contourner est revérifié ici.

**Erreurs** : `BonsaiNamespaceError` (codes `NAMESPACE_INVALID_FORMAT`, `NAMESPACE_RESERVED`, `NAMESPACE_UNKNOWN_REFERENCE`, `FEATURE_MISSING_CHANNEL`, `FEATURE_CHANNEL_NAMESPACE_MISMATCH`) ; `ManifestError` si les dépendances initiales sont cycliques ; `StartupError` si une unité de démarrage échoue ; erreur si `start()` est appelé deux fois.

### 3.1 Cible

> ⏳ Cible, non livré.

- **Erreur de bootstrap typée** : toute erreur levée par `start()` sera enveloppée dans une erreur qui porte la phase (`"0a"` … `"4"`) et la cause d'origine.
- **`start({ serverState })`** (ADR-24, H5) : entre les phases 1 et 3, chaque entrée pré-peuple l'Entity du namespace correspondant, **silencieusement** (ni notification ni Event). Clé inconnue : avertissement, erreur en mode strict ; clé réservée : erreur.

## 4. `stop()`

> ⏳ Strate 1.

Arrêt dans l'ordre **inverse** du bootstrap :

1. Foundation : détachement des Views (`onDetach()`), des Behaviors et du `localState` ;
2. Features, dans l'ordre inverse du manifest : `onDestroy()` ;
3. Channels : désinscription des handlers, puis retrait de Radio ;
4. `started` repasse à `false`.

## 5. Configuration globale

> ⏳ Non tranchée.

Plusieurs réglages sont prévus ailleurs dans la spec : limite anti-boucle
`maxHops` (I9), mode strict (erreurs au lieu d'avertissements, ADR-06), niveau
de log, activation des DevTools. Leur **point d'entrée n'est pas décidé** : champ
des options du constructeur, argument de `start()`, ou autre. Le code n'accepte
aujourd'hui que `{ foundation, features }` ; ne pas présumer d'une forme.

## 6. Pas de Channel `app`

Le framework ne crée aucun Channel de cycle de vie (`app:started`,
`feature:ready`) : l'ordre du bootstrap garantit qu'aucun listener n'existerait
au moment de leur émission. `app` n'est **pas** un namespace réservé ; une
Feature applicative peut s'appeler ainsi.

---

## Lecture suivante

→ [Router](router.md) — spécialisation Feature pour la navigation
