# Invariants architecturaux

> **Les règles NON NÉGOCIABLES du framework Bonsai**

[← Retour à l'index](../README.md) · [Décisions](decisions.md) · [Anti-patterns](anti-patterns.md)

---

> ### 📌 Processus de numérotation
>
> **Invariants** : numérotation séquentielle stricte. Le prochain invariant disponible est **I64**
> (I1–I58 dans ce document, I63 dans ADR-0022). Les ADR `🟠 Suspended` qui revendiquent
> des numéros (ex: ADR-0018 I59–I62) utilisent des numéros **provisoires** — ils seront
> renumérotés lors de l'acceptation si un conflit existe avec des invariants acceptés entre-temps.
>
> **Règle anti-collision** : seul un ADR `🟢 Accepted` peut revendiquer définitivement un numéro.
> La propagation dans ce document source de vérité acte le numéro.

---

## Invariants I1–I58

Les invariants sont les règles **NON NÉGOCIABLES** du framework.
Chaque invariant est numéroté, formulé sans ambiguïté, rattaché à un principe fondateur,
et vérifiable mécaniquement (compile-time ou runtime).

| #     | Invariant | Principe |
|-------|-----------|----------|
| **I1** | Une Feature ne peut **emit** (diffuser un Event) que sur son propre Channel — sans exception (C1) | Flux unidirectionnel |
| **I2** | Une Feature peut **listen** les Events des Channels externes qu'elle a déclarés (C3) | Dépendances déclaratives |
| **I3** | Une Feature ne peut **reply** que sur son propre Channel (C4) | Encapsulation du state |
| **I4** | Une View/Behavior peut **trigger** (Command), **listen** (Event) et **request** uniquement sur les Channels déclarés dans sa définition — **jamais** `emit()` (D7) | Dépendances déclaratives |
| **I5** | Les Views et Behaviors n'ont **jamais** accès aux Entities | Encapsulation du state |
| **I6** | Seule une Feature peut modifier son Entity | Encapsulation du state |
| **I7** | Tout message (Command, Event **et Request**) porte des **métadonnées causales complètes** (correlationId, causationId, hop, origin, timestamp) | Découplage événementiel |
| **I8** | Le `correlationId` est créé par l'UI et **jamais modifié** ensuite | Traçabilité |
| **I9** | Le `hop` est incrémenté à chaque réaction — rejet si `hop > MAX_HOPS` (anti-boucle) | Garde-fous |
| **I10** | Un Command a un **seul handler** : la Feature propriétaire du Channel (C2) — garanti mécaniquement par le Channel (D7) | Flux unidirectionnel |
| **I11** | Un Event peut avoir **N subscribers** — garanti mécaniquement par le Channel (D7) | Découplage événementiel |
| **I12** | **Aucune** Feature ne peut **emit** sur le Channel d'une autre Feature — pas de cross-domain event emission (D2, D7) | Chorégraphie |
| **I13** | La View est un point d'entrée (**trigger** = Command) et de projection (**listen** = Event) — la causalité métier n'y transite jamais | View |
| **I14** | Tout composant DOIT déclarer statiquement les Channels avec lesquels il interagit | Dépendances déclaratives |
| **I15** | Radio est une infrastructure interne : aucun composant n'y accède directement | Dépendances déclaratives |
| **I16** | Un accès à un Channel non déclaré est une erreur (compilation ou runtime) | Dépendances déclaratives |
| **I17** | Une Feature peut **request** (lecture seule) sur les Channels qu'elle a déclarés en `request` (C5) — pas de mutation, pas de side-effect | Encapsulation du state |
| **I18** | La View a le **monopole du rendu** — c'est le seul composant qui produit une représentation visuelle dans le DOM (D4) | View |
| **I19** | La View n'a **aucune responsabilité sur son propre cycle de vie** — elle ne décide ni de sa création, ni de sa destruction, ni de son remplacement (D4) | View, Cycle de vie |
| **I20** | Seuls la **Foundation** et les **Composers** peuvent créer, détruire ou remplacer des Views (D4, D20, D21) | Foundation, Composer |
| **I21** | Chaque Feature DOIT déclarer un **namespace unique**, explicite, `camelCase` plat — collision = erreur au bootstrap (D5) | Dépendances déclaratives |
| **I22** | La relation **namespace ↔ Feature ↔ Entity** est **1:1:1** stricte — un namespace identifie exactement une Feature et une Entity. L'Entity est **obligatoire**, même vide (type `void` ou `{}`) (D5) | Feature, Store logique |
| **I23** | Application est **dormante au runtime** — aucune logique métier, aucun rôle actif entre le bootstrap et le shutdown (D6) | Application |
| **I24** | Application **garantit l'unicité des namespaces** au bootstrap — collision = erreur (D6, I21) | Application, Feature |
| **I25** | `trigger()` envoie un **Command** (intention, 1:1) — seuls les Views/Behaviors utilisent `trigger()` (D7) | Capacités, Primitives |
| **I26** | `emit()` diffuse un **Event** (fait accompli, 1:N) — seule la Feature propriétaire du Channel utilise `emit()` (D7) | Capacités, Primitives |
| **I27** | Un Command peut être **refusé** par la Feature (handle) — un Event est un **fait** qui ne peut être refusé (D7) | Capacités |
| **I28** | Le Router est une **spécialisation interne de Feature** avec namespace réservé `router` et accès exclusif à l'History API — instancié par Application, pas par le développeur (D8) | Router |
| **I29** | `reply()` retourne **toujours** `T` **synchrone** — le replier ne peut qu'accéder à l'état de son Entity, déjà en mémoire. Tout chargement async est de la responsabilité des handlers Command ou listeners Event. Un replier async est un anti-pattern. `request()` retourne `T | null` (D9 révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md), D44 révisé) | Encapsulation, Primitives |
| **I30** | Une View **et un Behavior** ne possèdent **aucun domain state**. Toute donnée partagée entre composants, issue de ou alimentant la logique métier, vit **exclusivement** dans une Entity gérée par une Feature. Règle immuable : **Entity gère le domain state, Feature a l'exclusivité de la relation directe à Entity**. La View est une **projection pure** (données → rendu DOM), le Behavior un **enrichissement comportemental pur** (interactions DOM, animations). Un **state local de présentation** est autorisé sous les contraintes de I42. | Encapsulation, View, Behavior |
| **I31** | Au moment de `onAttach()`, la View **DOIT** avoir un `el` (élément DOM racine) existant dans le DOM. Le `rootElement` est un **sélecteur CSS string** fourni exclusivement par le **Composer** via `TResolveResult.rootElement` (ADR-0026). Le framework résout le sélecteur dans le slot : si l'élément existe → réutilisation (hydratation SSR, H1) ; si absent → le framework **parse le sélecteur CSS** et crée l'élément (D30, ADR-0026 §3). Le rootElement n'est **PAS** dans les `params` de la View. | View, Composer |
| **I32** | Le `rootElement` est **altérable en N1** (classes, attributs, textContent) par la View, mais **jamais détruit ni remplacé** par elle — c'est le framework (via Composer) qui gère sa création/destruction. La View peut déclarer des handlers DOM sur `rootElement` via une clé réservée (ex: `root` ou `el`) dans `uiEvents`. Le `rootElement` reste un conteneur structurel dont le cycle de vie échappe à la View. (D19) | View |
| **I33** | La **Foundation** est **unique** par application. Elle cible `<body>`. Les éléments `<html>` et `<body>` ne sont dans le scope d'aucune View — seule la Foundation peut les altérer (N1 uniquement). (D20, D27) | Foundation |
| **I34** | Le **rootElement** d'une View est forcément un **enfant** de `<body>` (direct ou indirect), jamais `<body>` lui-même. (D20) | View, Foundation |
| **I35** | Un **Composer** n'a **aucune écriture DOM** dans son scope — il ne possède aucun nœud, ne peut rien muter. **Lecture du scope autorisée** : `querySelector`, `getAttribute` dans le scope pour résoudre le `rootElement` de la child View (ADR-0020). `resolve(event)` est l'**unique méthode abstraite** (ADR-0027). Pas de hooks lifecycle (`onMount`/`onUnmount` supprimés — ADR-0025). Pas de handlers `onXxxEvent` — l'Event est passé en argument de `resolve()` (ADR-0027). Pas de state local décisionnel. Le Composer est un **décideur pur** avec capacité de lecture. (D23, ADR-0020, ADR-0025, ADR-0027) | Composer |
| **I36** | La **View ne compose jamais** d'autres Views. Elle déclare des slots (via `get composers()`) et des Composers associés, mais la décision d'instanciation est entièrement portée par le Composer. La View n'a aucune responsabilité de composition. (D21, D25) | View, Composer |
| **I37** | Il n'existe qu'**un seul type de Composer**. Un Composer gère **0/N Views hétérogènes** dans un scope DOM fixe via `resolve()` étendu (`TResolveResult \| TResolveResult[] \| null`). La multiplicité des Composers est gérée par la sémantique `querySelectorAll` de `uiElements` (ADR-0020). (D24, ADR-0020) | Composer |
| **I38** | Les **niveaux d'altération DOM** (D26) contraignent chaque composant : Foundation = N1 sur `<html>`/`<body>` uniquement ; View = N1, N2 ou N3 selon le mode template ; Composer = **aucune écriture DOM** (lecture du scope autorisée pour résolution rootElement — I35, ADR-0020). | Foundation, Composer, View |
| **I39** | La View accède au DOM **exclusivement** via l'API `getUI(key)` fournie par le framework. Aucun `querySelector`, `getElementById` ou accès DOM brut n'est exposé à la View. Tous les nœuds d'interaction sont déclarés dans `get uiElements()` et résolus par le framework. `TProjectionNode` n'expose pas `.node`. (D31, D32) **Exception Foundation** : la Foundation accède directement à `this.html` (`<html>`) et `this.body` (`<body>`) pour les altérations N1 autorisées par D27. Ces propriétés sont fournies par le framework, pas par un accès DOM brut. | View, Foundation |
| **I40** | Le **scope DOM** d'une View est son `rootElement` **en excluant** les sous-arbres des slots déclarés dans `get composers()`. Le framework résout les `uiElements` dans ce scope restreint : un sélecteur qui résout vers un élément à l'intérieur d'un slot déclaré est une **erreur** au bootstrap. Le slot element lui-même reste dans le scope de la View parente (altérable en N1). **Garde-fous** (ADR-0020) : Mode C (compile-time — les templates ne peuvent pas cibler un @ui dans un slot), Mode B (runtime — le framework vérifie l'exclusion à l'attachement). (D31, ADR-0020) | View, Composer |
| **I41** | Chaque @ui a une **source de mutation unique** (D32). Si un @ui est couvert par un template (`get templates()`), la mutation passe exclusivement par `template.project()` — `getUI(key)` retourne `TProjectionRead` (lecture seule). Si un @ui n'a pas de template, `getUI(key)` retourne `TProjectionNode` (lecture + mutation N1). Corrélation : N1 ↔ Mode A / @ui non-templatés, N2 ↔ Mode C (templates partiels), N3 ↔ Mode B (template root). Garanti au compile-time. (D32) | View |
| **I42** | Une View **PEUT** déclarer un **state local de présentation** via un mécanisme dédié du framework (D33). Ce state : (1) est **typé et déclaré explicitement** — pas de propriétés ad hoc `this.xxx` ; (2) est **réactif** — ses mutations déclenchent le même cycle de projection que les events `listen` ; (3) est **encapsulé** — inaccessible depuis l'extérieur de la View (ni Behavior, ni Feature, ni autre View) ; (4) est **non-broadcastable** — aucun trigger/emit possible sur ce state, il ne transite jamais par un Channel ; (5) **ne survit pas** à la destruction de la View (nettoyé au `onDetach()`). **Critère de migration** : dès qu'un autre composant a besoin de cette donnée → migrer vers Feature + Entity. Le Behavior bénéficie des mêmes droits (D37). (D33) | View, Behavior, Encapsulation |
| **I43** | Les clés TUIMap d'un Behavior **NE DOIVENT PAS** entrer en collision avec les clés TUIMap de sa View hôte. `keyof TBehaviorUI ∩ keyof TViewUI = ∅`. La vérification est effectuée au **bootstrap** (erreur runtime). La responsabilité de la cohérence incombe à la **View** (qui déclare ses Behaviors), pas au Behavior (qui est aveugle). (D36) | Behavior, View |
| **I44** | Un Behavior n'a **aucun accès** aux propriétés de sa View hôte. Pas de `this.view`, pas de `this.view.el`, pas de `this.view.getUI()`. Le Behavior interagit avec le DOM **exclusivement** via ses propres clés ui (`this.getUI(key)`) et avec le reste de l'application via ses propres Channels. Le framework résout les sélecteurs du Behavior dans le scope du `rootElement` de la View hôte, mais le Behavior l'ignore. (D36) | Behavior, Encapsulation |
| **I45** | Un Behavior peut effectuer des altérations **N1** (attributs, classes, text) et **N2** (insertion/suppression de nœuds dans des îlots `@ui`) **uniquement sur ses propres clés ui déclarées**. L'altération **N3** (remplacement complet d'un rootElement) est **interdite** — le Behavior n'a pas de rootElement. Le Behavior n'a **aucune capacité** de définir des slots ni des Composers. (D36) | Behavior |
| **I57** | Le namespace `local` est **réservé par le framework** pour le mécanisme `localState` (I42, ADR-0015). Aucun Channel, Feature ou Entity ne peut déclarer `local` comme namespace. Le framework injecte les données du localState sous la clé `local` dans `NamespacedData`, mais ce n'est **pas** un Channel — c'est un data key interne. Même pattern de réservation que `router` (I28/D8). Violation détectée au **bootstrap**. (D33, ADR-0015) | View, Behavior, Channel |
| **I58** | Le **scope DOM d'un Composer** est assigné **une seule fois** au bootstrap et **ne migre jamais**. Il existe exactement 3 états : **vivant** (scope dans le DOM, Composer actif) → **suspendu** (scope retiré du DOM, Views détachées proprement) → **détruit** (Composer libéré — irréversible). Un Composer « déplacé » dans le DOM est en réalité une destruction + re-création. Le nouveau Composer reçoit le nouvel élément comme scope ; l'ancien est détruit. (ADR-0020 §6.4) | Composer |

> **I46–I56** : invariants spécifiques aux **contrats TypeScript** (conventions de typage, generics, signatures). Définis dans [conventions-typage.md](../6-transversal/conventions-typage.md). Séparés ici car ils relèvent du type system, pas de l'architecture runtime.

---

## Matrice de vérification des invariants

> Chaque invariant est **vérifiable mécaniquement**. La colonne « Phase » indique
> quand la vérification a lieu ; la colonne « Mécanisme » décrit comment.
> La colonne « Sévérité » classe l'impact si l'invariant est violé.

| Invariant | Phase | Sévérité | Mécanisme | Message d'erreur attendu |
|-----------|-------|----------|-----------|--------------------------|
| **I1** | Compile-time | Bloquante | `emit()` non disponible hors Feature — absent du type `View`/`Behavior` | `Property 'emit' does not exist on type 'View'` |
| **I4** | Compile-time | Bloquante | `emit()` absent du type `View`/`Behavior` | Idem I1 |
| **I5** | Compile-time | Bloquante | `entity` absent des types `View`/`Behavior` | `Property 'entity' does not exist on type 'View'` |
| **I6** | Compile-time + Bootstrap | Bloquante | `entity` en `protected` dans Feature, absent partout ailleurs | Compile : `entity is private`. Bootstrap : assertion d'ownership |
| **I7** | Bootstrap | Bloquante | Le framework injecte les metas — jamais manuelles | Assertion interne si metas absentes ou malformées |
| **I8** | Runtime | Bloquante | Vérification que `correlationId` ne change pas dans la chaîne | `[Bonsai] correlationId mutation detected in hop N` |
| **I9** | Runtime | Bloquante | Compteur `hop` vérifié à chaque dispatch | `[Bonsai] MAX_HOPS exceeded (hop={N}). Possible infinite loop. correlationId={id}` |
| **I10** | Bootstrap | Bloquante | Registre Command Lane : un seul handler possible | `[Bonsai] Duplicate command handler for '{ns}:{cmd}'` |
| **I12** | Compile-time | Bloquante | `emit()` contraint au Channel propre via generic `TChannel` | `Argument of type '"other:event"' is not assignable…` |
| **I14** | Compile-time + Bootstrap | Importante | Types déclaratifs statiques — accès non déclaré = erreur compile. Bootstrap : vérification croisée | Compile : type error. Bootstrap : `[Bonsai] Undeclared channel usage: '{ns}'` |
| **I15** | Compile-time | Importante | `Radio` non exporté du package framework | `Cannot find name 'Radio'` |
| **I16** | Compile-time + Bootstrap | Importante | Identique à I14 | Identique à I14 |
| **I18** | Architectural | Importante | Convention + code review — pas de vérification mécanique v1 | — |
| **I21** | Bootstrap | Bloquante | Application vérifie l'unicité des namespaces | `[Bonsai] Namespace collision: 'cart' already registered` |
| **I22** | Bootstrap | Bloquante | Application vérifie la relation 1:1:1 | `[Bonsai] Feature 'cart' must have exactly one Entity` |
| **I30** | Compile-time | Importante | Propriété `entity` absente de `View`/`Behavior`. `localState` via API dédiée (I42) | Compile : si accès direct. Bootstrap : si `this.xxx` ad hoc détecté (mode strict) |
| **I33** | Bootstrap | Bloquante | Foundation est un singleton — double instanciation = erreur | `[Bonsai] Only one Foundation allowed per application` |
| **I35** | Architectural | Bloquante | `Composer` n'a pas de méthodes d'**écriture** DOM ni de hooks lifecycle dans son type. `resolve(event)` est l'unique méthode abstraite (ADR-0025, ADR-0027). Lecture du scope autorisée (`querySelector`, `getAttribute`) pour résoudre le rootElement (ADR-0020). | Compile : aucune méthode d'écriture DOM ni hook lifecycle sur `Composer` |
| **I39** | Compile-time | Importante | `TProjectionNode` n'expose pas `.node`. Pas de `querySelector` dans l'API | Compile : `Property 'node' does not exist on type 'TProjectionNode'` |
| **I40** | Bootstrap | Importante | Framework résout les `uiElements` et détecte les sélecteurs dans les slots | `[Bonsai] uiElement '{key}' resolves inside slot '{slot}' — out of scope` |
| **I41** | Compile-time | Importante | `getUI(key)` retourne `TProjectionRead` ou `TProjectionNode` selon le template | Compile : `Property 'set' does not exist on type 'TProjectionRead'` |
| **I42** | Compile-time + Bootstrap | Importante | API `localState` dédiée. `this.xxx` ad hoc absent des types | Compile : pas de `this.xxx` non déclaré. Bootstrap : vérification en mode strict |
| **I43** | Bootstrap | Importante | Application vérifie la disjonction des clés UIMap Behavior/View | `[Bonsai] UIMap key collision between '{BehaviorName}' and '{ViewName}': '{key}'` |
| **I57** | Bootstrap | Importante | Application vérifie que le namespace `local` n'est pas utilisé par un Channel développeur | `[Bonsai] Reserved namespace 'local' — choose a different name for Feature '{name}'` |
| **I58** | Bootstrap | Importante | Le framework vérifie que le scope DOM d'un Composer ne migre jamais. Un Composer déplacé dans le DOM déclenche destruction + re-création. | `[Bonsai] Composer '{name}' scope element moved in DOM — destroying and re-creating` |

> **Priorisation v1** :
> - **Non négociables** (I1, I4, I6, I8, I9, I10, I12, I21, I22, I33) : doivent être garantis mécaniquement avant la première version stable.
> - **Importantes** (I14, I16, I30, I39, I40, I41, I43) : peuvent être partiellement couverts par des assertions bootstrap en v1, avec durcissement compile-time progressif.
> - Les invariants architecturaux sans mécanisme compile-time (I18) sont enforced par convention + code review + outillage de lint à terme. I35 est enforced par le type `Composer` qui n'expose pas de méthodes d'écriture DOM.

---

## Références

- [Anti-patterns](anti-patterns.md)
- [Décisions historiques](decisions.md)
- [Glossaire](glossaire.md)
