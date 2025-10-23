# Historique des décisions (D1–D48)

> **Journal chronologique des décisions architecturales de Bonsai**

[← Retour à l'index](../README.md) · [Invariants](invariants.md) · [Anti-patterns](anti-patterns.md)

---

> ### 📌 Processus de numérotation
>
> **Décisions** : numérotation séquentielle stricte. Le prochain numéro disponible est **D49**.

---

## Décisions D1–D9 (2026-03-10 — 2026-03-11)

| Date       | Décision | Contexte | Alternatives rejetées |
|------------|----------|----------|-----------------------|
| 2026-03-10 | Création de la RFC | Phase de réflexion architecturale | — |
| 2026-03-10 | **D1 — Radio interne, Channels déclaratifs** | Les dépendances de communication doivent être visibles dans la définition du composant, pas cachées dans l'implémentation. Features déclarent `listen`. Views/Behaviors déclarent `listen`, `trigger` et `request`. Radio devient infrastructure interne, jamais exposé au développeur. | Radio comme API publique (`Radio.channel('name')`) — rejeté car couplages cachés, invariants non vérifiables à la compilation, testabilité réduite |
| 2026-03-10 | **D2 — Chorégraphie pure, Feature unique** | Une Feature a exactement 5 capacités (D7) : **emit** (propre Channel), **handle** (propre Channel), **listen** (Channels déclarés), **reply** (propre Channel), **request** (Channels déclarés, D3). Pas de sous-types. L'architecture est chorégraphique : les Features réagissent aux Events de manière autonome. Les metas assurent la traçabilité des chaînes causales. | 1) Orchestration via ProcessFeature (modèle C) — rejeté car introduit un sous-type avec droits supplémentaires, crée un couplage centralisé. 2) Typologie stricte à 4 sous-types — rejeté car over-engineering, pas de différence structurelle entre Domain/Integration/UI, rigidité inutile |
| 2026-03-10 | **D3 — Request cross-domain autorisé** | Une Feature peut faire des requests (lecture seule) sur les Channels d'autres Features, à condition de les déclarer dans sa définition (`request: [OtherFeature]`). Le request ne mute pas, ne produit pas de side-effect. La Feature interrogée contrôle ce qu'elle expose via reply (C4). | Interdire le request cross-domain — rejeté car forcerait la dénormalisation du state (cache local dans chaque Feature), source de bugs de synchronisation, complexité inutile |
| 2026-03-10 | **D4 — View : monopole du rendu, cycle de vie passif** | La View est le seul composant qui produit une représentation visuelle dans le DOM (monopole du rendu). En contrepartie, la View n'a aucune responsabilité sur son propre cycle de vie : ce sont la Foundation et les Composers qui ont le monopole de créer, détruire et remplacer les Views. La View est un composant passif du point de vue lifecycle. | View auto-gérée (la View décide de sa propre destruction/recréation) — rejeté car viole la séparation des responsabilités et rend le cycle de vie imprévisible |
| 2026-03-10 | **D5 — Conventions de nommage complètes** | **Composants** : `XFeature`, `XView`, `XBehavior`, `XEntity`. **Namespace** : explicite, `camelCase` plat, clé d'identité universelle (Channel + Entity store + préfixe messages). Relation 1:1:1. Unicité vérifiée au bootstrap. **Messages** : format `namespace:messageName`, séparateur `:`. Commands = impératif, Events = passé, Requests = nominal. **Fichiers** : Angular Style Guide. | Suffixes alternatifs, namespace implicite/hiérarchique, `kebab-case` pour namespace, séparateur `/` ou `.` — tous rejetés |
| 2026-03-11 | **D6 — Application : instance légère, boot + shutdown** | Application est une instance persistante légère. Active au bootstrap et au shutdown. Dormante au runtime. Les Features s'enregistrent avec leur namespace ; collision = erreur. Modèle inspiré de Vue.js/Ember.js. **Complément ADR-0019** : en Mode ESM, `register()` est alimenté par `BonsaiRegistry.collect()` (pré-étape avant `start()`). D6 reste valide. | Application bootstrap-only, Application orchestrateur actif — tous rejetés |
| 2026-03-11 | **D7 — Séparation trigger/emit, modèle à 5 capacités** | **`trigger()`** envoie un Command (1:1). **`emit()`** diffuse un Event (1:N). La Feature est la porte entre les deux. Le modèle passe à 5 capacités : C1 emit, C2 handle, C3 listen, C4 reply, C5 request. | `trigger()` unique pour Command et Event — rejeté |
| 2026-03-11 | **D8 — Router : composant framework spécialisé** | Le Router est en interne une spécialisation de Feature avec accès exclusif à l'History API. Namespace réservé `router`. Instancié par Application. | Router comme Feature ordinaire, Router comme composant séparé — tous rejetés |
| 2026-03-11 | **D9 — Reply toujours synchrone (`T`) ~~(révisé 2026-04-03, ex-`Promise<T>`)~~** | `reply()` retourne toujours `T` directement (synchrone). Le replier ne peut qu'accéder à l'état de son Entity, déjà en mémoire. Tout chargement async préalable est de la responsabilité des handlers Command ou des listeners Event. Un replier async est un anti-pattern. **Révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)** (ex-D9 : `Promise<T>`). | Reply mixte — rejeté. Reply async (`Promise<T>`) — révoqué par ADR-0023 |

> **Note** : les décisions D10–D19 proviennent de l'ancien RFC-0002-api-contrats-typage. Elles sont référencées dans les fichiers composants correspondants.

---

## Décisions D20–D32 (2026-03-16 — 2026-03-17)

| Date       | Décision | Contexte | Alternatives rejetées |
|------------|----------|----------|-----------------------|
| 2026-03-16 | **D20 — Foundation unique sur `<body>`** | La Foundation est le composant unique qui couvre `<html>` et `<body>`. Comble le trou de couverture DOM. Déclare les Composers racines. Ajout de I33, I34. | Plusieurs RootNodes, DomRoot séparé, Pas de composant racine — tous rejetés |
| 2026-03-16 | **D21 — Le Composer décide quelle View instancier** | Le Composer porte la logique de sélection via `resolve()`. La View ne compose jamais. Ajout de I36. | View parente décide, Configuration dans Application — tous rejetés |
| 2026-03-16 | **D22 — Le Composer a des capacités Channel** | Le Composer déclare `listen` et `request` pour recueillir l'information nécessaire à ses décisions. | Composer sans Channels — rejeté |
| 2026-03-16 | **D23 — Le Composer n'a aucune écriture DOM** | Le Composer ne possède aucun nœud DOM, ne peut rien muter. Lecture du scope autorisée pour résoudre le rootElement (ADR-0020). C'est un décideur pur avec capacité de lecture. Ajout de I35. | Composer avec droit d'altération — rejeté |
| 2026-03-16 | **D24 — Un seul type de Composer** | Pas de CollectionComposer. Un Composer gère 0/N Views hétérogènes dans un scope fixe (révisé par ADR-0020 — initialement 0/1 View). La multiplicité des Composers via querySelectorAll. Ajout de I37. | CollectionComposer — rejeté |
| 2026-03-16 | **D25 — View déclare `get composers()`** | La View expose ses Composers via un getter. Clés = entrées dans `uiElements`. | Déclaration statique, Configuration dans Application — tous rejetés |
| 2026-03-16 | **D26 — Niveaux d'altération DOM (N1/N2/N3)** | N1 = attributs, N2 = zones, N3 = template complet. Correspondance avec modes de template. Ajout de I38. | Pas de formalisation — rejeté |
| 2026-03-16 | **D27 — Foundation : droits N1 sur `<html>`/`<body>` uniquement** | La Foundation peut altérer `<html>` et `<body>` en N1 uniquement. | Foundation avec droits N2/N3 — rejeté |
| 2026-03-16 | **D28 — rootElement : ~~string ou descripteur objet~~ string CSS parseable uniquement (amendé par [ADR-0026](../../adr/ADR-0026-root-element-css-selector-from-composer.md))** | **Forme unique** : le rootElement est toujours un sélecteur CSS `string`, fourni exclusivement par le Composer via `TResolveResult.rootElement` (ADR-0026). Si l'élément n'existe pas dans le slot, le framework parse le sélecteur CSS pour en déduire tag, id, classes et créer l'élément (ex: `'section#main.Layout-body'` → `<section id="main" class="Layout-body">`). Le descripteur objet `{ selector, tagName?, attrs? }` est supprimé — le sélecteur CSS encode la même information de manière plus concise. La View ne déclare plus rootElement dans ses params. | Descripteur objet `{ selector, tagName?, attrs? }` — supprimé par ADR-0026. rootElement dans les params de la View — rejeté par ADR-0026 |
| 2026-03-16 | **D29 — Foundation `get composers()` : clés = sélecteurs CSS** | Les clés sont des sélecteurs CSS dans `<body>`. | Clés arbitraires — rejeté |
| 2026-03-16 | **D30 — Le framework crée le rootElement si absent** | Quand un Composer attache une View et que le rootElement n'existe pas, le framework crée l'élément. Le Composer reste décideur pur. | Le Composer crée, La View crée, Erreur stricte — tous rejetés |
| 2026-03-17 | **D31 — Scope DOM exclusif et accès via `uiElements` uniquement** | La View n'a aucun accès DOM brut. Le scope exclut les sous-arbres des slots. Ajout de I39, I40. | Exposer `querySelector`, Surveillance MutationObserver — tous rejetés |
| 2026-03-17 | **D32 — Source de mutation unique par @ui (TProjectionRead / TProjectionNode)** | Chaque @ui a une source de mutation unique. `getUI()` retourne `TProjectionRead` ou `TProjectionNode` selon le template. Pas de `.node`. Ajout de I41. | TProjectionNode avec `.node`, Pas de différenciation — tous rejetés |
| 2026-03-23 | **D33 — State local de présentation autorisé dans la View** | Le principe « View = zéro état mutable » (I30 original) est trop absolutiste. Il existe une catégorie de données qui ne relève ni de la configuration (immuable) ni du domain state (partagé) : le **state de présentation purement local** (ex: `currentStep` d'un wizard, `validationErrors` d'un formulaire, `isEditing` d'un toggle local). Forcer systématiquement une Feature + Entity + Channel pour ces cas génère de la sur-ingénierie (cérémonie disproportionnée pour un état que personne d'autre n'observe). **Décision** : la View peut déclarer un state local de présentation via un mécanisme dédié du framework, sous 5 contraintes strictes (I42) : typé, réactif, encapsulé, non-broadcastable, détruit au onDetach. La vraie ligne de défense n'est pas « aucun state dans la View » mais « **aucun state invisible dans la View** ». Révision de I30 (restreint au domain state). Ajout de I42. Le Behavior bénéficie des mêmes droits localState sous les mêmes 5 contraintes I42 (D37). | 1) Statu quo I30 strict (tout dans Feature+Entity) — rejeté car sur-ingénierie pour les cas purement locaux, cérémonie disproportionnée. 2) Propriétés `this.xxx` ad hoc libres — rejeté car state invisible, non réactif, non traçable, anti-pattern maintenu. 3) State local sans réactivité — rejeté car le développeur devrait manuellement appeler la re-projection, source d'oublis et d'incohérences |

---

## Décisions D34–D38 (2026-03-23) — View, Behavior, réutilisabilité

| Date       | Décision | Contexte | Alternatives rejetées |
|------------|----------|----------|-----------------------|
| 2026-03-23 | **D34 — View params + Composer options (réutilisabilité) ~~(amendé par ADR-0024 et ADR-0026)~~** | `abstract get params()` déclare le manifeste de la View (`listen`, `trigger`, `request`, `uiElements`, `behaviors`, `options`). `rootElement` n'est **plus** dans params (ADR-0026 : fourni par le Composer). Le pattern value-first `as const satisfies` (ADR-0024) élimine la double saisie. Le Composer override partiellement les options via `resolve()` → `{ view, rootElement, options? }`. Le framework merge shallow les options. | Getters abstraits en dur, Paramètres constructeur libres, Sous-classes légères — tous rejetés |
| 2026-03-23 | **D35 — TUIMap : type d'élément HTML** | `TUIMap` contraint `el` (type d'élément HTML) au lieu de `sel` (sélecteur CSS). Le sélecteur migre vers `params.uiElements`. `getUI()` retourne `TProjectionNode<TUI[K]['el']>` typé par l'élément. Les handlers reçoivent `currentTarget` typé. | `sel` littéral dans TUIMap — rejeté car sur-contraint. Pas de type d'élément — rejeté car perd le typage fin |
| 2026-03-23 | **D36 — Contrat Behavior** | Le Behavior est un plugin UI réutilisable aveugle (aucune connaissance de sa View hôte). TUIMap propre, uiEvents propres, templates Mode C uniquement, Channels indépendants, pas de rootElement, pas de slots/Composers, pas de `this.view` (I44), altération N1+N2 sur ses propres clés ui (I45), collision clés ui détectée au bootstrap (I43). | `this.view` accessible — rejeté. Behavior sans TUIMap — rejeté. Templates N3 — rejeté |
| 2026-03-23 | **D37 — Behavior localState** | Le Behavior peut déclarer un state local de présentation sous les mêmes 5 contraintes que la View (I42). Ferme le point ouvert de D33. | Interdire le localState pour Behavior — rejeté |
| 2026-03-23 | **D38 — Algorithme de décision View+options vs Behavior vs Héritage** | Arbre de décision formel : Q0 base de composition → View, Q1 même View contexte différent → View+options (D34), Q2 capacité orthogonale → Behavior, Q3 altération template principal → Héritage, Q4 Channels propres → Behavior. Critère : nature du couplage (zéro/total/partiel). | Complexité comme critère — rejeté. Pas d'algorithme formel — rejeté |

---

## Décisions D39–D42 (2026-03-19) — Rendu avancé

| Date       | Décision | Contexte | Alternatives rejetées |
|------------|----------|----------|-----------------------|
| 2026-03-19 | **D39 — Animations via Callbacks + CSS** | Les animations sont gérées via des callbacks lifecycle (`onBeforeEnter`, `onAfterEnter`, `onBeforeLeave`, `onAfterLeave`) couplées à des transitions CSS. Le framework ne fournit pas de moteur d'animation intégré. | Moteur d'animation intégré — rejeté car complexité excessive, surcharge de la surface d'API |
| 2026-03-19 | **D40 — VirtualizedList API séparée** | La virtualisation est une API distincte de `ProjectionList`, pas une option intégrée. Formalisé dans ADR-0012. | Virtualisation intégrée dans ProjectionList — rejeté car complexifie l'API de base |
| 2026-03-19 | **D41 — Nested `each` supporté nativement** | Les boucles `each` imbriquées dans les templates PugJS sont supportées nativement par le compilateur PDR. | Interdire le nesting — rejeté. Flat uniquement avec workaround — rejeté |
| 2026-03-19 | **D42 — VIEW-SUBSCRIPTION : Views s'abonnent via `any` + selectors** | Les Views s'abonnent aux Channels via l'événement `any` et des selectors namespacés. Le framework auto-gère la souscription et la projection réactive. | Abonnement par Event individuel — rejeté car trop verbeux et fragile face à l'ajout de nouveaux Events |

---

## Décisions D43–D45 (2026-03-23/26) — Metas, erreurs et collection patterns

| Date       | Décision | Contexte | Alternatives rejetées |
|------------|----------|----------|-----------------------|
| 2026-03-23 | **D43 — Metas : framework crée, développeur propage explicitement (amendé par [ADR-0016](../../adr/ADR-0016-metas-handler-signature.md))** | Le développeur ne forge jamais de metas (`correlationId`, `causationId`, `hop`, etc.). Le framework les **crée** au point d'entrée (trigger, onInit, timer). Les handlers **reçoivent** les metas explicitement en paramètre `(payload, metas)` et les **propagent** explicitement à `emit()`, `request()` et `mutate()`. Aucun contexte causal implicite — la closure capture les metas, rendant les handlers async-safe par construction. I54 formalisé. | Metas manuelles forgées par le développeur — rejeté car source d'erreurs. Contexte causal implicite (version initiale D43) — rejeté par ADR-0016 car vulnérable à l'interleaving async et violation du principe « Explicite > Implicite » |
| 2026-03-23 | **D44 — Reply en erreur retourne `null` sync (pas `Result<T>`) ~~(révisé 2026-04-03)~~** | `reply()` retourne `T | null` (synchrone). Si le handler reply throw ou si le Channel n'est pas enregistré, le résultat est `null`. Pas de type `Result<T>` complexe. Pas de `Promise`. Simplicité DX. Ajout de I55. **Révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)** (ex-D44 : `Promise<T | null>`). | `Result<T, E>` (Rust-style) — rejeté car over-engineering pour le cas d'usage. Throw + try/catch — rejeté car le request cross-domain ne doit pas crasher le consommateur. `Promise<T | null>` — révoqué par ADR-0023 |
| 2026-03-26 | **D45 — COLLECTION-PATTERN : ProjectionList + Event Delegation** | Le pattern canonique pour les listes dans Bonsai est `ProjectionList` + event delegation (Option D de l'ADR-0008). Simple (un seul pattern), performant (keyed reconcile O(n) + un seul listener), scalable (1000+ items), standard (event delegation = pattern DOM natif). Les child Views via Slots × Composers sont réservées aux cas complexes (composants autonomes avec lifecycle propre). Absorbe [ADR-0008](../../adr/ADR-0008-collection-patterns.md). | ViewFragment dédié — rejeté car abstraction redondante. CollectionComposer — rejeté car overhead disproportionné pour les listes simples |

---

## Décisions D46–D47 (2026-03-26) — Rendu : selector et state dérivé

| Date       | Décision | Contexte | Alternatives rejetées |
|------------|----------|----------|-----------------------|
| 2026-03-26 | **D46 — FULL-STATE-SELECTOR : NamespacedData = state complet par réf live** | Le selector de la View reçoit le **state complet** de chaque Channel écouté, pas seulement les clés changées par le dernier Event. Le framework passe une **référence live** vers le state frozen (Immer) de l'Entity — zéro copie, zéro coût. Le selector peut accéder à n'importe quelle clé du state pour calculer des dérivées (filtre, tri) sans être limité aux clés changées. Le `shallowEqual` opère sur la **sortie** du selector, pas sur l'input. | Q1-A : state des seules clés changées + `$changes` auxiliaire — rejeté car complexifie le selector, force deux accès (`data.catalog` + `$changes`), nécessite un objet de changes additionnel alors que la ref frozen est gratuite |
| 2026-03-26 | **D47 — NO-DERIVED-STATE : pas de données dérivées dans l'Entity** | Les données dérivées (filtrées, triées, paginées) ne sont **jamais** stockées dans l'Entity. L'Entity stocke les données brutes (`items: Product[]`) et les critères de vue (`sortCriteria`, `filters`, `page`). Les dérivées sont calculées dans le selector de la View — c'est une **projection**, pas un **état**. Un changement de tri génère 1 patch (`sortCriteria`) au lieu de N patches (items réordonnés). Compatible Event Sourcing. | Stocker la liste dérivée dans l'Entity — rejeté car explosion de patches, sémantique incorrecte (le state n'a pas changé, seule la présentation change), risque de désynchronisation brut/dérivé |

---

## Décision D48 (2026-03-26) — UI : auto-discovery des handlers DOM

| Date       | Décision | Contexte | Alternatives rejetées |
|------------|----------|----------|-----------------------|
| 2026-03-26 | **D48 — AUTO-UI-EVENT-DISCOVERY : handlers UI auto-dérivés depuis TUIMap** | Le framework dérive automatiquement les handlers DOM depuis `TUIMap` : clé `addButton` + event `['click']` → méthode `onAddButtonClick`. Convention `on${Capitalize<Key>}${Capitalize<Event>}`. Même pattern que D12 (handlers Feature auto-découverts). `get uiEvents()` est supprimé. `TAutoUIEventHandlers<TUI>` remplace `TUIEvents`. S'applique aux Views ET aux Behaviors. **Note** : la convention D12 (`onXxx` handlers auto-découverts) ne s'applique **plus au Composer** — le Composer reçoit l'Event en argument de `resolve(event)` (ADR-0027). | `get uiEvents()` déclaratif (map manuelle) — rejeté car mapping redondant avec TUIMap. Décorateurs (`@OnClick('addButton')`) — rejeté car dépendance stage 3, overhead runtime |

---

## Références

- [Invariants](invariants.md) — les règles formelles
- [Anti-patterns](anti-patterns.md) — ce qui est interdit
- [ADR index](../../adr/README.md) — les décisions formalisées en ADR
