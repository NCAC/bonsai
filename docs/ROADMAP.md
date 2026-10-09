# Roadmap — pistes post-v1

> Ce qui n'est **pas** dans la v1 (périmètre gelé par [ADR-31](adr/ADR-31-strates-perimetre-v1.md)).
> Une piste n'est pas une décision : elle devient un ADR le jour où on la travaille.
> Les textes d'exploration d'origine sont archivés dans [archive/adr-v0](archive/adr-v0/README.md).

## Décidé, reporté après la v1

Ces sujets ont un ADR accepté ; seule la livraison est reportée.

| Sujet | ADR | Ce qui manque |
| --- | --- | --- |
| Listes virtualisées | [ADR-23](adr/ADR-23-listes.md) | `VirtualizedList` (viewport, scroll, placeholders) |
| FormBehavior complet | [ADR-25](adr/ADR-25-formulaires.md) | Behavior réutilisable de formulaire (dirty tracking, validation Valibot) |
| Mode ESM modulaire | [ADR-27](adr/ADR-27-mode-esm-modulaire.md) | `BonsaiRegistry`, modules `*.esm.js`, CLI `bonsai build` |

## Pistes à instruire

### Helpers de test publics — `@bonsai/testing`

*Origine : ADR-0006.* Un package de test officiel pour les applications :
`createTestFeature()` (Channels déclarés simulés, accès au state),
`createTestView()` (DOM simulé, assertions sur les `trigger`), `MockChannel`,
et un `contractTest()` déclaratif, compatibles Jest et Vitest. Le framework se
teste déjà sans eux ; la question est l'ergonomie côté application, à trancher
quand l'API publique sera stable.

### Event sourcing et historique des mutations

*Origine : ADR-0011.* Les fondations existent : patches Immer (ADR-10), metas
causales (ADR-04). Piste retenue : niveaux **à la carte** par Entity —
`Entity` (niveau 0), `TrackedEntity` (journal des mutations, `undo`/`redo`),
`EventSourcedEntity` (enregistrement et rejeu d'Events). Débloque le
time-travel, le rejeu de session et un Event Ledger dans les DevTools.
Questions ouvertes : stockage (mémoire, IndexedDB, distant), rétention,
snapshots, divergence store/Entity, migration du format des Events.

### Extensions de la Foundation

*Origine : ADR-0018. Invariants provisoires I59–I62, non attribués.* La
Foundation serait le seul composant à accéder à `document`, `window`,
`<html>`, `<body>` et `<head>`. Recommandations non actées :

- événements globaux déclarés comme une View (contrat UI pré-rempli, auto-discovery) ;
- lecture de données serveur initiales : `readServerData<T>(id)` ;
- hook `onShutdown()` pour les tests et le rechargement à chaud ;
- extensions : `getMedia()`, `onError` global relié au rapport d'erreurs (ADR-05), `getHead()`/`setTitle()` ; `onIdle` plus tard.

À articuler avec `serverState` (ADR-24), qui couvre déjà une partie du besoin
de données serveur.

### Plateforme, plugins et composition ouverte

*Origine : ADR-0021.* Quatre niveaux d'extensibilité : package de composants
enregistré au bootstrap, contributions dans des points d'extension, chargement
tardif, micro-kernel. Piste en deux temps :

1. **Packages de plugins** : `app.use(plugin)` qui ajoute des Features au manifest et vérifie les Channels dont le plugin dépend ;
2. **Registre d'extensions** : `ContributionRegistry` (Feature framework réservée, comme le Router), points d'extension typés, `registerLate()`, re-résolution de Composer.

Le micro-kernel est écarté. Règle d'or : un plugin n'affecte jamais un autre
plugin hors des points d'extension officiels. **À revoir** : la convention de
namespaces en notation pointée proposée pour les plugins contredit ADR-08
(camelCase plat) ; l'enregistrement tardif contredit le manifest statique
(même point ouvert qu'ADR-27).

### Autres pistes hors v1

| Piste | Remarque |
| --- | --- |
| Time-travel (`inversePatches`) | dépend de l'event sourcing |
| Extension navigateur DevTools, visualisation du graphe causal | la v1 se limite aux hooks DevTools et à l'Event Ledger |
| Profiling par handler | prématuré sans utilisateurs réels |
| Rejeu de session | dépend du time-travel |
| Rendu serveur Node.js, streaming SSR | la v1 ne fait que l'hydratation côté client (ADR-24) |
| Plusieurs Applications par page (micro-apps) | isolation Radio par Application, Foundation scopée, Router optionnel |
| Transactions distribuées | hors champ |
