# Glossaire

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (4 novembre 2026).** Le vocabulaire fondamental (composant, part, unité de validation, admission…) est défini par la [théorie](../../theorie.md), qui prévaut en cas d'écart ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)). « Channel » désigne le **contrat typé** d'une Feature, plus une classe d'exécution.

> **Terminologie officielle du framework Bonsai**
>
> Vocabulaire officiel du framework et conventions de nommage. Les décisions
> et leurs justifications sont dans les [ADR](../../adr/README.md).

[← Retour à l'index](../README.md) · [Invariants](invariants.md) · [ADR](../../adr/README.md)

---

| Champ | Valeur |
| --- | --- |
| **Document** | reference/glossaire |
| **Emplacement** | Référence |
| **Scope** | Terminologie, questions ouvertes |
| **Statut** | 🟢 Stable |
| **Mis à jour** | 2026-11-04 |

> ## Statut normatif
>
> Le **glossaire** (§1) est **normatif** — vocabulaire officiel.
> Les **questions ouvertes** (§2) sont **informatives** et ne font pas foi sur les contrats actifs.
> Les **conventions de nommage** (§3) sont **normatives** — conventions obligatoires.

---

## 📋 Table des matières

1. [Glossaire](#1-glossaire)
2. [Conventions de nommage](#2-conventions-de-nommage)

---

## 1. Glossaire

Vocabulaire officiel du framework. Chaque terme a une définition unique, non ambiguë,
référencée dans toute la documentation.

| Terme | Définition |
| --- | --- |
| **Admission** | Entrée d'un fait de l'hôte ou d'un résultat dans le modèle, par le composant qui en est l'admetteur (théorie C.4). Qualifiée `independent`, `correlated` (résultat d'une opération instrumentée) ou `unknown`. Seule une admission indépendante d'une saisie dans une part donne le droit de commander (D18). |
| **Application** | Racine du modèle : `new Application({ foundation, features, document })`, où `features` est le **manifest applicatif typé** (clé = namespace, ADR-08). `start()` valide le Manifest (phases 0a à 0c), puis démarre la racine du noyau dans une unité de démarrage ([application.md](../3-couche-abstraite/application.md), ADR-07). |
| **Behavior** | ⏳ Strate 2. Code UI réutilisable et **aveugle** (ADR-21), porté par une View : ses clés ui, ses handlers UI, son état local de présentation (I42). Pas un composant : ni existence, ni Channel, ni part propres ; ses traitements sont inclus dans l'unité de sa View. Aucun accès à la View hôte (`this.view`, I44). |
| **BonsaiRegistry** | ⏳ Singleton du mode ESM modulaire qui collecterait les modules chargés pour **alimenter le manifest applicatif** avant `start()`. Non livré, hors v1 ([ADR-27](../../adr/ADR-27-mode-esm-modulaire.md), [distribution.md §3](../2-architecture/distribution.md#3-mode-esm-modulaire--bonsairegistry)). |
| **Channel** | Contrat de communication typé d'une Feature (`TChannelDefinition`) : `commands` (un handler), `events` (N abonnés), `queries` (synchrones). Porté par `static readonly channel: TChannelToken<TDef, NS>`. La délivrance est assurée par la racine du noyau. |
| **Channel Declaration** | Déclaration statique des Channels avec lesquels un composant interagit : `get listens()` / `get queries()` (Feature), `get features()` (View, Composer). Contrat de dépendances de communication (ADR-01). |
| **Chorégraphie** | Modèle où chaque composant réagit de manière autonome aux Events, sans orchestrateur central (ADR-01). |
| **Command** | Intention d'action adressée à une Feature : `ctx.trigger("ns:cmd", payload)` depuis le handler d'un fait du DOM d'une View (D18). Cardinalité 1:1 : un seul handler, `on{Cmd}Command`. Une Command est refusée si son handler échoue (I27). Différée : délivrée après la validation de l'unité qui l'adresse (G5). Une Feature n'adresse jamais de Command (D17). |
| **Composer** | Décide la composition d'un slot : `resolve(ctx)` rend des Views du catalogue `get views()`, ordonnées, chacune sous une clé (`TComposition`). Interroge par `ctx.query` et recompose à chaque Event déclaré dans `get features()`. Ne commande ni n'émet (D12), n'écrit pas le DOM : le noyau crée, garde et détruit les Views (I35, I37). |
| **Contexte de handler** | Objet reçu en second paramètre par chaque handler : `TFeatureContext` (`mutate`, `emit`, `query`), `TFeatureQueryContext` (`query`), `TFactContext` (`trigger`, `query`), `TEventContext` (`query`), `TComposeContext` (`query`). Valide seulement pendant son unité (A5.a). |
| **Contexte causal** | Identité causale d'un traitement, créée par le noyau (G8) : `id`, `parentId`, `originId`, `originKind` (`startup`, `spontaneous`, `unknown`), `depth`. Écrit dans la trace ; `ctx.metas` côté applicatif est strate 1b. |
| **Effet** | Écriture sur l'hôte (projection, matérialisation d'une part, retrait) préparée dans une unité et engagée seulement après sa validation, dans l'ordre (C.3). Un effet engagé n'est pas annulé. |
| **Emit (C1)** | Capacité d'une Feature à diffuser un Event sur son propre Channel : `ctx.emit(event, payload)`. Réservé à la Feature propriétaire (I1) ; une View n'émet jamais (I4). |
| **Entity** | Ressource d'une Feature (pas un composant) portant son état, typé par `TStructure extends TJsonSerializable`. État détenu par le noyau, muté par `ctx.mutate(intent, recipe)` dans un handler de la Feature, lisible par `this.entity.state` pendant un handler seulement (I6). |
| **Event** | Fait accompli diffusé par `ctx.emit()` sur le Channel de sa Feature. Cardinalité 1:N. Ne peut être refusé (I27). Différé : délivré après la validation de l'unité émettrice, dans l'ordre de production, aux abonnements présents à l'émission (G5, C.6). Nommage : passé, `nounVerbed`. |
| **Fait du DOM** | Événement de l'hôte admis dans la part d'une View : `TFact` `{ type, ui }`. Son handler `on{UiKey}{DomEvent}(fact, ctx)` est le seul à pouvoir commander. |
| **Feature** | Composant de logique métier, une par namespace. Cinq capacités : emit (C1), handle (C2), listen (C3), répondre à une Query (C4), interroger (C5). Un seul type, pas de sous-types (ADR-01). |
| **FormBehavior** | ⏳ Behavior spécialisé dans les formulaires (pattern C d'[ADR-25](../../adr/ADR-25-formulaires.md)) : `touched`/`errors`/`values` vivent dans son état local, jamais dans l'Entity ; seules les valeurs soumises atteignent la Feature par une Command. |
| **Foundation** | Composant racine de la couche concrète, un par Application : admet son ancre (`<body>` par défaut, option `anchor`, D3) et y déclare les slots de ses Composers (`get composers()`, lu une fois, I67). Ni Channel, ni Query, ni projection, ni hook (ADR-20, I33). |
| **Handle (C2)** | Capacité d'une Feature à traiter les Commands de son Channel : `on{Cmd}Command(payload, ctx)`. Lever refuse la Command (I27). |
| **Listen (C3)** | Capacité d'une Feature, d'une View ou d'un Composer à recevoir les Events d'un Channel déclaré : `on{Ns}{Event}Event(payload, ctx)` (Feature, View) ou recomposition (Composer). |
| **Meta (TMessageMetas)** | ⏳ Strate 1b — voir [metas.md](../2-architecture/metas.md). Le noyau crée déjà le contexte causal de chaque traitement (G8) ; son exposition au code applicatif (`ctx.metas`) n'est pas livrée. Les metas servent à la **traçabilité**, jamais à la logique métier. |
| **Mode ESM Modulaire** | ⏳ Mode de distribution où Bonsai serait livré en modules ES natifs (`*.esm.js` + `*.d.ts`) enregistrés dans `BonsaiRegistry` (ADR-27). Le mode livré est le bundle (`core/dist/bonsai.js`). |
| **Namespace** | Clé d'identité d'une Feature, en `camelCase` plat : identité du Channel, de l'Entity, préfixe des clés plates (`ns:name`). Unique par racine. Relation 1:1:1 avec Feature et Entity (ADR-08). |
| **Part** | Portion d'un contenant attribuée à un composant (théorie 6.5) : la part d'une View est un élément `<div data-bonsai-part>` créé par le noyau dans le slot de son Composer. Une View reçoit une désignation de sa part, jamais un élément (I31). |
| **Phase 0a / 0b / 0c** | Phases sans effet de bord du démarrage ([ADR-07](../../adr/ADR-07-application-bootstrap.md)). 0a : format du namespace et `channel` (I70, I71, I73). 0b : instanciation pure (`new FeatureClass(ns)`, constructeur inerte, I94). 0c : `listens`/`queries`/`dependsOn` et validation croisée (I70). Précèdent le démarrage de la racine. |
| **PDR (Projection DOM Réactive)** | Stratégie de rendu : la View projette des données sur le DOM de sa part par des mutations ciblées (N1 livré ; N2/N3 ⏳ strate 1c, ADR-22). Zéro VDOM. |
| **Query (C4, C5)** | Lecture synchrone de l'état d'une Feature : `ctx.query(Feature.channel, name, params)` (Feature) ou `ctx.query("ns:name", params)` (View, Composer). Le handler `on{Name}Query(params, ctx)` reçoit un contexte en lecture seule (A3.g). Rend une valeur capturée par copie, jamais un `null` de substitution ; son échec fait échouer l'unité de l'auteur (G5, G7, ADR-02). |
| **Racine du noyau (`Root`)** | Infrastructure d'exécution d'une Application (`@bonsai/kernel`, G6) : registre, unités de validation, file différée, Queries, parts, effets, trace. Une par Application, jamais exposée au développeur (I15). |
| **Router** | Feature `router` fournie par le framework et adaptateur d'historique (D7, D15, `@bonsai/router`, ADR-13). Namespace réservé `router`. |
| **Slot** | Élément d'un contenant (ancre de la Foundation, `template` d'une View) désigné par un sélecteur qui doit y trouver exactement un élément, et rempli par un Composer. Sa clé est distincte des clés d'interface de la View (D13). |
| **Store logique distribué** | La somme des Entities, chacune identifiée par le namespace de sa Feature. Pas d'objet centralisé ; observable par Query. |
| **TBootstrapOptions** | ⏳ Options de `Application.start(options?)`, non livrées : `serverState?` pour le pré-peuplement SSR (ADR-24). |
| **`TChannelCallbacks<F>`** | Mapped type qui génère depuis un `TFeatureContract` les handlers `on{NS}{Event}Event` requis (ADR-14, I48). |
| **`TCommandPayloadFor<F, K>`** | Extracteur du payload d'une clé `"ns:cmd"` du contrat (ADR-14), pour `ctx.trigger`. |
| **`TComposition<TCC>`** | Retour de `resolve(ctx)` : `{ view, key, params? }[]`, où `view` est une clé du catalogue `views` (I37). |
| **`TEntitySchema<T>`** | ⏳ Schéma Valibot d'une Entity (ADR-11), non livré. |
| **`TEventPayloadFor<F, K>`** | Extracteur du payload d'une clé `"ns:event"` du contrat (ADR-14), pour les handlers `on{NS}{Event}Event`. |
| **`TEventsFor<TEl>`** | Mapping sous-type `HTMLElement` → événements DOM autorisés (ADR-15) ; sous-type de `keyof HTMLElementEventMap` (I89). Contraint `events` dans `ui<TEl>()(events)`, sans doublons (I90). |
| **TFeatureContract** | Module contractuel des interactions **Feature-groupées** (ADR-14) : `{ cart: { feature: CartFeature; listens: [...]; triggers: [...]; queries: [...] } }`. La clé d'objet DOIT être le namespace de la Feature (I87). |
| **`TFeatureCallbacks<TDef, TListens, TEntity>`** | Clause `implements` d'une Feature ([ADR-09](../../adr/ADR-09-feature-contract.md), I92) : `TCommandCallbacks<TDef> & TQueryCallbacks<TDef> & TListenCallbacks<TListens>`. Handler manquant → `TS2420` ; signature fautive → `TS2416`. |
| **`TFeatureRef<TDef, NS>`** / **`TFeatureRefForNS<NS>`** | Contrainte structurelle d'une référence Feature (objet exposant `channel: TChannelToken<TDef, NS>`), et sa spécialisation où le namespace est imposé par la clé du contrat (I87). |
| **`TFlatListens<F>` / `TFlatTriggers<F>` / `TFlatQueries<F>`** | Aplatissent un `TFeatureContract` en union de clés `"namespace:name"` (ADR-14), pour `ctx.trigger`, `ctx.query` et les handlers requis. |
| **`TQueryParamsFor<F, K>` / `TQueryResultFor<F, K>`** | Extracteurs des params et du résultat d'une clé `"ns:query"` du contrat (ADR-14), pour `ctx.query`. |
| **`TStrictFeatureClass<NS, TDef>`** | Contrainte appliquée par `StrictManifest<M>` à chaque entrée du manifest (ADR-09, I95) : constructeur `(namespace: NS) => Feature<…, TDef, NS>` (I72) et `static channel` aligné (I73, I22). |
| **TProjectionNode** | Projection N1 sur une clé d'interface, renvoyée par `getUI(key)` : `text()`, `attr()`, `toggleClass()`, `visible()`, `style()`. Chaque appel prépare un effet engagé après validation (C.3). Pas d'accès à l'élément (`element()` retiré, I39). |
| **TProjectionRead** | ⏳ Cible strate 1c : lecture seule d'une clé couverte par un template (N2/N3). |
| **Tri-lane** | Les trois voies d'un contrat de Channel : `commands`, `events`, `queries` (ADR-14). |
| **`TUICallbacks<U>`** | Mapped type qui génère depuis un `TUIContract` les handlers `on{UIKey}{DomEvent}(fact, ctx)` requis (ADR-15, I48). |
| **`TUIContract`** | Module contractuel des nœuds DOM typés (ADR-14) : chaque `TUIEntry<TEl, TEvts>` porte ses événements et, optionnellement, `cancelDefault` (D20). Le sélecteur vit dans `TUIElements`. |
| **`TUIElements<TUI>`** | Map clé → sélecteur CSS, résolu dans la part de la View (ADR-14). ⏳ Surcharge par le Composer (ADR-21) non livrée. |
| **`TUIEntry<TEl, TEvts>`** | Entrée d'un `TUIContract` : `{ events; cancelDefault?; _el? }`, construite par `ui<TEl>()(events, options?)`. Le phantom `_el?` encode `TEl` (I85) ; `events: []` = entrée non interactive (I86). |
| **`TViewCallbacks<TVC>`** | Clause `implements` d'une View (ADR-14, I88) : `TEventCallbacks<TVC> & TUICallbacks<TVC["ui"], TVC>`. |
| **`TViewClass`** | Surface structurelle d'une classe View, indépendante de son contrat : `abstract new (...args: any[]) => View<any>` ; utilisée par le catalogue d'un Composer. |
| **`TViewContract<F, U>`** | Contrat View composé : `{ features: F; ui: U }` (ADR-14). Un seul générique sur `View<TVC>`. |
| **Feature-groupé** | (ADR-14) Forme de déclaration où chaque Feature consommée est une clé d'objet portant ses voies (`{ cart: { listens, triggers, queries } }`). |
| **Helper `ui<TEl>()(events, options?)`** | (I85) Fabrique curryfiée d'une `TUIEntry<TEl, TEvts>` ; `options.cancelDefault` déclare l'annulation de l'action par défaut (D20). |
| **Module contractuel** | (ADR-14) Brique réutilisable de contrat : `TFeatureContract`, `TUIContract`, `TUIElements<TUI>`. View = features + ui ; Composer = features + views ; Behavior ⏳ = features + ui. |
| **Symétrie Contract/Callbacks** | (ADR-14, I88) Un composant dont le contrat dérive des handlers expose la paire `T{Component}Contract` / `T{Component}Callbacks<TC>` : Feature, View, ⏳ Behavior. |
| **Unité de validation** | Traitement exécuté par le noyau (Command, Event, notification, fait du DOM, démarrage) : il réussit entièrement ou est défait — état, structure, messages différés et effets (G7). |
| **`updateLocal()`** | ⏳ Strate 2 (ADR-17). Mutation du `localState` d'une View ou d'un Behavior : `updateLocal(recipe)`, callbacks `onLocal${Key}Updated`. L'état local disparaît avec la View (I42). |
| **Valibot** | Bibliothèque de validation de schémas **imposée** par le framework (ADR-11) ; wrappée par `@bonsai/valibot`. |
| **View** | Composant UI éphémère **sans état du domaine** (I30), enfant d'un Composer qui la résout ; le noyau la crée dans sa part, y projette son `template` et crée ses Composers de slots. Projette par `getUI(key)` (I39), reçoit les faits du DOM de sa part et les Events déclarés, commande depuis le handler d'un fait (D18), interroge par `ctx.query`. N'a ni `mount()` ni hook (I19). Son domaine DOM est sa part moins le contenu de ses slots (I40, ⚠️ partiel). ⏳ `localState` (I42, ADR-17). |

---

## 2. Conventions de nommage

### Nommage des composants (classes)

| Composant | Convention | Exemples |
| --- | --- | --- |
| Feature | `XFeature` | `CartFeature`, `InventoryFeature`, `UserProfileFeature` |
| View | `XView` | `CartView`, `ProductListView`, `CheckoutView` |
| Behavior | `XBehavior` | `DragDropBehavior`, `TooltipBehavior`, `InfiniteScrollBehavior` |
| Entity | `XEntity` | `CartEntity`, `UserEntity`, `ProductEntity` |
| Composer | `XComposer` | `SidebarComposer`, `MainContentComposer`, `HeaderComposer` |
| Foundation | `AppFoundation` (une par Application) | `AppFoundation` |

### Namespace Feature (clé d'identité universelle, ADR-08)

- Format : **`camelCase` plat** — pas de hiérarchie, pas de `/` ni `.`
- Réservés : `'local'` (I71), `'router'` (I28, Feature fournie par le framework) — interdits par `StrictManifest<M>` (compile-time)
- Déclaration : **portée par le manifest applicatif typé** (clé d'objet — I68). Aucun `static namespace` sur la classe Feature. Le namespace est passé au constructeur `(namespace) => Feature<...>` lors de la Phase 0b du bootstrap (instanciation pure, ctor inerte — I94)
- Conformité : `TSelfNS` du paramètre générique de la classe Feature **doit** correspondre à la clé du manifest (I72) — vérifié compile-time par `StrictManifest<AppManifest>`
- Unicité : garantie par la nature d'objet littéral du manifest (TS1117, I21) — collision impossible compile-time
- Rôle triple : identité du Channel (`TChannelToken.namespace`), clé du store logique d'Entity, préfixe des messages (`namespace:messageName`)

### Nommage des messages

| Aspect | Convention | Exemples |
| --- | --- | --- |
| **Format** | `namespace:messageName` — séparateur `:`, noms en `camelCase` | `cart:addItem`, `cart:itemAdded` |
| **Command** | Impératif métier | `cart:addItem`, `user:updateProfile` |
| **Event** | Événement métier (passé) | `cart:itemAdded`, `inventory:stockUpdated` |
| **Query** | Nominal métier (pas `getNoun`) | `cart:total`, `pricing:totalAmount` |

### Structure des fichiers et dossiers (Angular Style Guide)

- Un **dossier par domaine/fonctionnalité**, nommé en `PascalCase`
- Les fichiers suivent le pattern `kebab-case.type.ext`
- Le suffixe de type (`.feature`, `.view`, `.entity`, `.behavior`) est **obligatoire**
- Le contrat de Channel et le type d'état sont **co-localisés** dans le fichier `.feature.ts` (ADR-09 — le wrapper `namespace Cart { … }` est abandonné, ADR-14) — il n'y a **pas** de fichier `.channel.ts` séparé

Exemple d'une Feature `Product` :

```text
Product/
  product.feature.ts       # Feature + contrat de Channel (TChannelDefinition), co-localisés (ADR-09)
  product.entity.ts        # Entity (structure de données)
  product.view.ts          # View (rendu UI)
  product.composer.ts      # Composer(s) optionnel(s)
  product.behavior.ts      # Behavior(s) optionnel(s)
  --- hors scope framework ---
  product.styles.scss      # Styles
  product.template.pug     # Template PugJS
```

> Cette convention garantit :
>
> - **Lisibilité** : chaque fichier a un rôle identifiable par son suffixe
> - **Colocation** : tout le domaine est regroupé dans un seul dossier
> - **Cohérence** : alignement avec les pratiques Angular, familières à l'écosystème

---

## Références

- [Philosophie](../1-philosophie.md) et [Architecture](../2-architecture/README.md) — principes et composants
- [Invariants](invariants.md) — règles non négociables
- [ADR](../../adr/README.md) — décisions et leurs raisons
- [Framework Style Guide](../../guides/FRAMEWORK-STYLE-GUIDE.md) — Conventions d'usage du framework applicatif
- [Conventions de typage](../6-transversal/conventions-typage.md) — Contrats TypeScript
- [Glossaire des types exportés](types-index.md) — index des types publics
