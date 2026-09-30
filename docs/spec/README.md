# Spécification Bonsai

> Le **quoi** : contrats, signatures, sémantique, invariants.
> Le **pourquoi** vit dans les [ADR](../adr/README.md) ; ce qui est réellement
> livré se lit sur la ligne **Livré** de chaque ADR.

## Structure

Parcours de lecture progressif, des principes jusqu'aux détails.

```text
spec/
├── 1-philosophie.md              ← Pourquoi Bonsai existe
├── 2-architecture/               ← Comment c'est structuré
│   ├── communication.md, state.md, lifecycle.md
│   └── metas.md, distribution.md, erreurs.md
├── 3-couche-abstraite/           ← Composants persistants (métier)
│   └── application.md, feature.md, entity.md, router.md
├── 4-couche-concrete/            ← Composants éphémères (DOM)
│   └── foundation.md, composer.md, view.md, behavior.md
├── 5-rendu.md                    ← PDR, templates, ProjectionList, hydratation
├── 6-transversal/                ← conventions-typage.md, formulaires.md, validation.md
├── devtools.md                   ← Instrumentation et observabilité
└── reference/                    ← invariants.md, anti-patterns.md, glossaire.md, types-index.md
```

## Index

| Document | Contenu | ADR | Statut |
| --- | --- | --- | --- |
| [1-philosophie](1-philosophie.md) | Contexte, objectifs, principes fondateurs | — | 🟢 |
| [2-architecture](2-architecture/README.md) | Taxonomie des composants, couches, principes structurants | — | 🟢 |
| ↳ [communication](2-architecture/communication.md) | Flux unidirectionnel, tri-lane, Radio, namespaces | [01](../adr/ADR-01-channels-tri-lane.md), [02](../adr/ADR-02-request-synchrone.md), [03](../adr/ADR-03-channel-runtime.md) | 🟢 |
| ↳ [state](2-architecture/state.md) | Entity seul détenteur du state, ownership strict | [10](../adr/ADR-10-entity-mutation.md) | 🟢 |
| ↳ [lifecycle](2-architecture/lifecycle.md) | Persistants et éphémères, nettoyage déterministe | [07](../adr/ADR-07-application-bootstrap.md), [16](../adr/ADR-16-view-scope-projection.md) | 🟢 |
| ↳ [metas](2-architecture/metas.md) | Traçabilité causale, ULID, propagation explicite | [04](../adr/ADR-04-metas-explicites.md) | 🟢 |
| ↳ [distribution](2-architecture/distribution.md) | Modes IIFE et ESM modulaire | [27](../adr/ADR-27-mode-esm-modulaire.md) | 🟢 |
| ↳ [erreurs](2-architecture/erreurs.md) | Catégories, propagation, diagnostics | [05](../adr/ADR-05-propagation-erreurs.md) | 🟢 |
| [3-couche-abstraite](3-couche-abstraite/README.md) | Ce qui vit toute la session | — | 🟢 |
| ↳ [application](3-couche-abstraite/application.md) | Bootstrap, manifest applicatif typé | [07](../adr/ADR-07-application-bootstrap.md), [08](../adr/ADR-08-namespace-manifest.md) | 🟢 |
| ↳ [feature](3-couche-abstraite/feature.md) | Unité métier, 5 capacités, handlers auto-découverts | [09](../adr/ADR-09-feature-contract.md), [14](../adr/ADR-14-contrats-types.md) | 🟢 |
| ↳ [entity](3-couche-abstraite/entity.md) | State, mutations Immer, notifications, schema | [10](../adr/ADR-10-entity-mutation.md), [11](../adr/ADR-11-entity-schema-valibot.md), [12](../adr/ADR-12-entity-intent-typing.md) | 🟢 |
| ↳ [router](3-couche-abstraite/router.md) | Feature framework de navigation | [13](../adr/ADR-13-router.md) | 🟢 |
| [4-couche-concrete](4-couche-concrete/README.md) | Ce qui touche le DOM | — | 🟢 |
| ↳ [foundation](4-couche-concrete/foundation.md) | Racine `<body>`, Composers racines, N1 | [20](../adr/ADR-20-foundation.md) | 🟢 |
| ↳ [composer](4-couche-concrete/composer.md) | Décideur de composition, `resolve(event)` | [18](../adr/ADR-18-composer.md), [19](../adr/ADR-19-root-element.md) | 🟢 |
| ↳ [view](4-couche-concrete/view.md) | Projection, contrat modulaire, `getUI`, `localState` | [14](../adr/ADR-14-contrats-types.md)–[17](../adr/ADR-17-local-state.md) | 🟢 |
| ↳ [behavior](4-couche-concrete/behavior.md) | Plugin UI réutilisable et aveugle | [21](../adr/ADR-21-behavior-reutilisation.md) | 🟡 |
| [5-rendu](5-rendu.md) | PDR, templates Pug, ProjectionList, hydratation, selectors | [22](../adr/ADR-22-pdr.md)–[26](../adr/ADR-26-souscription-view.md) | 🟢 |
| [6-transversal/conventions-typage](6-transversal/conventions-typage.md) | Préfixes, contraintes, patterns TypeScript | [08](../adr/ADR-08-namespace-manifest.md), [14](../adr/ADR-14-contrats-types.md) | 🟢 |
| [6-transversal/formulaires](6-transversal/formulaires.md) | Patterns de formulaire | [25](../adr/ADR-25-formulaires.md) | 🟢 |
| [6-transversal/validation](6-transversal/validation.md) | Compile-time, bootstrap, runtime | [06](../adr/ADR-06-modes-validation.md), [11](../adr/ADR-11-entity-schema-valibot.md) | 🟢 |
| [devtools](devtools.md) | Instrumentation, Event Ledger, hooks | [31](../adr/ADR-31-strates-perimetre-v1.md) (strate 2c) | 🟡 |
| [reference/invariants](reference/invariants.md) | Règles non négociables et leur vérification | — | 🟢 |
| [reference/anti-patterns](reference/anti-patterns.md) | Patterns interdits | — | 🟢 |
| [reference/glossaire](reference/glossaire.md) | Vocabulaire officiel | — | 🟢 |
| [reference/types-index](reference/types-index.md) | Index des types TypeScript | — | 🟢 |

**Statut** : 🟢 stable — le contrat est figé, prêt à implémenter ; 🟡 brouillon —
en cours de rédaction. Le statut dit si la **spécification** est finie, pas si
le **code** l'est : une section non livrée porte un encadré ⏳ qui renvoie à
l'ADR et à sa strate ([ADR-31](../adr/ADR-31-strates-perimetre-v1.md)).

## Règles

1. Un document dédié (`feature.md`, `entity.md`…) prévaut sur une vue d'ensemble (`README.md` de chapitre).
2. La spec et les ADR ne se contredisent pas : si c'est le cas, l'un des deux est à corriger. En attendant, l'ADR fait foi.
3. La spec décrit le contrat en vigueur, sans historique : les versions antérieures sont dans git et dans l'[archive](../archive/adr-v0/README.md).

## Index des invariants par composant

Les invariants sont définis dans [reference/invariants.md](reference/invariants.md),
sauf I46–I56 (contrats TypeScript), définis dans
[conventions-typage.md](6-transversal/conventions-typage.md). I59–I62 sont
réservés aux extensions de la Foundation ([roadmap](../ROADMAP.md)).

L'index par composant est **généré** depuis le registre (champ `roles`) :
[invariants par rôle](../invariants/generated/roles/README.md) — une vue par
package (Application, Feature, Entity, Channel, View, Behavior, Composer,
Foundation), avec son bilan ✅/⚠️/⏳/📐 et la liste de ses écarts.

## Anciens identifiants `RFC-000x`

Certains textes citent encore l'ancienne numérotation :

| Ancien | Aujourd'hui |
| --- | --- |
| `RFC-0001` (architecture, composants, invariants, glossaire) | [1-philosophie](1-philosophie.md), [2-architecture/](2-architecture/README.md), [3-couche-abstraite/](3-couche-abstraite/README.md), [4-couche-concrete/](4-couche-concrete/README.md), [reference/](reference/invariants.md) |
| `RFC-0002` (API et contrats : channel, feature, entity) | [conventions-typage](6-transversal/conventions-typage.md), [communication](2-architecture/communication.md), [feature](3-couche-abstraite/feature.md), [entity](3-couche-abstraite/entity.md), [types-index](reference/types-index.md) |
| `RFC-0003` (rendu avancé) | [5-rendu](5-rendu.md) |
| `RFC-0004` (devtools) | [devtools](devtools.md) |
