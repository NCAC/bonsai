# Décisions d'architecture (ADR)

> Le **pourquoi** de Bonsai : une décision par fichier, 30–80 lignes.
> Le **quoi** (contrats, signatures) vit dans la spec ; les règles non négociables
> dans le [registre des invariants](../spec/reference/invariants.md).
>
> **Autorité normative.** La [théorie validée](../theorie.md) prévaut sur tous les ADR, quel que soit leur statut. Un contrat incompatible est un écart à corriger, pas une alternative encore admissible. Les ADR tracent les décisions passées et justifient les choix de réalisation compatibles ; ils ne rouvrent pas les arbitrages théoriques. Voir la [règle de confiance](../README.md#règle-de-confiance-et-dalignement).

## Comment lire un ADR

| Statut | Sens |
| --- | --- |
| 🟡 Proposed | Question ouverte, options documentées, pas de décision |
| 🟢 Accepted | Décidé ; livré ou non (voir la ligne **Livré**) |
| 🔵 Tested | Décidé, livré, et chaque invariant impacté est cité dans un test (ADR-32) |

Dans l'index, ⚠️ / ⏳ signalent une livraison partielle ou à venir (ligne **Livré** de l'ADR).

Une décision Accepted ou Tested est conservée comme trace historique. Si elle
change, un nouvel ADR documente sa succession, désigne explicitement la décision
remplacée et distingue les obligations imposées par la théorie des choix de
réalisation encore ouverts. La succession est référencée dans cet index ; elle
n’efface pas les arguments ni les preuves de l’ancien contrat. Une proposition
non acceptée peut évoluer ; une piste reportée va dans la [roadmap](../ROADMAP.md).

Les statuts et indicateurs de livraison ci-dessous se rapportent aux contrats
documentés par les ADR : ils n’attestent pas leur conformité à V0.9.4. Les
incompatibilités déjà identifiées sont suivies dans le [plan de migration](../rapports/migration-invariants-runtime-V0.9.4-2026-10-30.md#7-successions-et-décisions-préparatoires).
L’obligation d’alignement découle directement de la théorie, sans attendre un
nouvel arbitrage sur cette obligation.

Modèle : [TEMPLATE.md](TEMPLATE.md). Correspondance avec l'ancienne numérotation
(`ADR-00xx`, `D1–D48`) : [archive/adr-v0](../archive/adr-v0/README.md).

## Index

### Communication et runtime

| ADR | Décision | Statut |
| --- | --- | --- |
| [ADR-01](ADR-01-channels-tri-lane.md) | Radio + Channels tri-lane déclaratifs, chorégraphie, `trigger`/`emit` | 🟢 ⚠️ |
| [ADR-02](ADR-02-request-synchrone.md) | `request` synchrone → `T \| null` | 🔵 |
| [ADR-03](ADR-03-channel-runtime.md) | Sémantique runtime du Channel | 🟢 ⚠️ |
| [ADR-04](ADR-04-metas-explicites.md) | Metas causales explicites `(payload, metas)` | 🟢 ⏳ |
| [ADR-05](ADR-05-propagation-erreurs.md) | Propagation des erreurs | 🟢 ⚠️ |
| [ADR-06](ADR-06-modes-validation.md) | Modes de validation | 🟢 ⚠️ |
| [ADR-35](ADR-35-vidage-file-differee.md) | Vidage synchrone de la file des messages différés ; unités longues signalées | 🟢 ⚠️ |

### Couche abstraite

| ADR | Décision | Statut |
| --- | --- | --- |
| [ADR-07](ADR-07-application-bootstrap.md) | Application dormante, bootstrap par phases | 🔵 |
| [ADR-08](ADR-08-namespace-manifest.md) | Namespace : manifest applicatif typé | 🔵 |
| [ADR-09](ADR-09-feature-contract.md) | Contrat Feature `Feature<TEntity, TChannelDef, TSelfNS>` | 🔵 |
| [ADR-10](ADR-10-entity-mutation.md) | Entity : mutation Immer, patches, pas de state dérivé | 🔵 |
| [ADR-11](ADR-11-entity-schema-valibot.md) | Entity : schema Valibot | 🟢 |
| [ADR-12](ADR-12-entity-intent-typing.md) | Typage de l'`intent` de `mutate()` | 🟡 |
| [ADR-13](ADR-13-router.md) | Router : Feature framework spécialisée | 🟢 |

### Contrats typés

| ADR | Décision | Statut |
| --- | --- | --- |
| [ADR-14](ADR-14-contrats-types.md) | Contrats typés : `TChannelDefinition`, Feature unité publique, contrat consommateur modulaire | 🟢 ⚠️ |
| [ADR-15](ADR-15-evenements-ui.md) | Événements UI : `ui<TEl>()`, `TEventsFor<TEl>`, auto-discovery | 🟢 ⚠️ |

### Couche concrète

| ADR | Décision | Statut |
| --- | --- | --- |
| [ADR-16](ADR-16-view-scope-projection.md) | View : scope de rendu exclusif, `getUI`, niveaux N1/N2/N3 | 🟢 ⚠️ |
| [ADR-17](ADR-17-local-state.md) | `localState` de présentation | 🟢 ⏳ |
| [ADR-18](ADR-18-composer.md) | Composer : décideur pur, `resolve(event)`, N instances | 🟢 ⚠️ |
| [ADR-19](ADR-19-root-element.md) | `rootElement` : sélecteur CSS fourni par le Composer | 🟢 ⚠️ |
| [ADR-20](ADR-20-foundation.md) | Foundation : `<body>`, `Record` stable, N1 seul | 🟢 ⚠️ |
| [ADR-21](ADR-21-behavior-reutilisation.md) | Behavior et réutilisation de View | 🟢 ⏳ |

### Rendu

| ADR | Décision | Statut |
| --- | --- | --- |
| [ADR-22](ADR-22-pdr.md) | PDR chirurgicale (pas de VDOM), modes de template A/B/C | 🟢 ⚠️ |
| [ADR-23](ADR-23-listes.md) | Listes : `ProjectionList` + délégation, `VirtualizedList` séparée | 🟢 ⏳ |
| [ADR-24](ADR-24-hydratation-ssr.md) | Hydratation SSR structurelle, `serverState` opt-in | 🟢 ⏳ |
| [ADR-25](ADR-25-formulaires.md) | Formulaires : `localState` pendant la saisie, Command à la soumission | 🟢 ⏳ |
| [ADR-26](ADR-26-souscription-view.md) | Souscription View : handlers granulaires ou `any` + selectors | 🟡 |

### Distribution et build

| ADR | Décision | Statut |
| --- | --- | --- |
| [ADR-27](ADR-27-mode-esm-modulaire.md) | Mode ESM modulaire, IIFE en alternative | 🟢 ⏳ |
| [ADR-28](ADR-28-monorepo-packages.md) | Monorepo : un package par composant, `@bonsai/core` barrel | 🟢 ⚠️ |
| [ADR-29](ADR-29-toolchain-build.md) | Toolchain : Rollup + `rollup-plugin-dts`, zéro dépendance transitive | 🟢 ⚠️ |
| [ADR-30](ADR-30-artefacts-versionnes.md) | Artefacts de build versionnés, reconstruits à chaque changement | 🟢 ⚠️ |

### Processus

| ADR | Décision | Statut |
| --- | --- | --- |
| [ADR-31](ADR-31-strates-perimetre-v1.md) | Strates d'implémentation et périmètre v1 gelé | 🟢 |
| [ADR-32](ADR-32-tests-preuve-architecture.md) | Tests = preuve d'architecture, statut `Tested` | 🟢 |
| [ADR-33](ADR-33-workflow-git-ci.md) | Workflow git, SemVer, hooks et CI | 🟢 ⚠️ |
| [ADR-34](ADR-34-documentation-francais.md) | Documentation et commits en français, code et JSDoc en anglais | 🟢 ⚠️ |

### Pistes post-v1

Ce qui n'est pas une décision (helpers de test publics, event sourcing,
extensions de la Foundation, plateforme et plugins…) vit dans la
[roadmap](../ROADMAP.md).
