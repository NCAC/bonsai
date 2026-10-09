# ADR-27 — Distribution : mode ESM modulaire, IIFE en alternative

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⏳ strate 2+ — aucun `BonsaiRegistry`, aucun module `*.esm.js` par composant, pas de CLI `bonsai build`. Seul le runtime est produit (`core/dist/bonsai.js`, format ES) |
| **Spec** | [distribution.md](../spec/2-architecture/distribution.md) |

## Contexte

Un bundle unique suppose que tout est connu à la compilation. Les cibles de
Bonsai (back-offices, CMS, tableaux de bord multi-équipes) ont besoin de
charger ce que la page utilise, d'accueillir des modules livrés séparément et,
idéalement, de se passer de bundler côté application : TypeScript compilé en
modules ES natifs chargés par `<script type="module">`.

## Décision

**Mode cible : ESM modulaire.** La distribution se compose :

- d'un **runtime** ESM unique (`bonsai.esm.js` + `bonsai.d.ts`) ;
- de **modules ESM autonomes**, un par composant applicatif, compilés sans bundler ;
- d'un **`BonsaiRegistry`** qui collecte les modules effectivement chargés et **alimente le manifest applicatif typé** (ADR-08) avant `start()` : l'API publique reste `new Application({ foundation, features })`, sans `app.register()`.

**Le `.d.ts` est un artefact de première classe** : un module n'est jamais
distribué sans sa paire `*.esm.js` + `*.d.ts` (source map recommandée).

**Mode IIFE conservé en alternative** pour les applications monolithiques
fermées : un bundle unique, sans registry. Les deux modes consomment les mêmes
imports source ; la différence est un paramètre de build.

## Alternatives rejetées

- **IIFE comme mode principal** — interdit le chargement par page ou par route, impose un bundler, ferme la porte aux modules tiers.
- **`BonsaiRegistry` remplaçant le manifest** (`registerFeature()` qui fixe le namespace) — contredit ADR-08 : le namespace vient de la clé du manifest.
- **Modules sans `.d.ts`** — perte d'IntelliSense et du contrôle compile-time, contraire à « le type est le contrat ».

## Conséquences

- Le build doit savoir produire les deux modes (ADR-29, « Build 2 »).
- **Point ouvert** : un manifest partiellement alimenté au runtime ne bénéficie plus de `satisfies StrictManifest` pour les modules chargés tardivement ; seul le filet runtime de `start()` s'applique (I21). À trancher avec le registry.
- Contributions tardives et plugins tiers : hors v1 ([roadmap](../ROADMAP.md)).
