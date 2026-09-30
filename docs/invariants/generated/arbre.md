<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Arbre des invariants

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention · ∅ non qualifié ;
tests : `R` runtime · `T` type · `·` aucun (détection automatique des citations).

## P1 — Souveraineté du domaine

**Le domain state n'existe que dans une Entity ; seule la Feature propriétaire y accède et le modifie.**

- `E` I6 = I5 — L'Entity n'est accessible qu'à sa Feature propriétaire : aucun autre composant (View, Behavior, autre Feature, Composer, Foundation) ne peut la lire ni la modifier. ⟨type · ✅ · R T⟩
- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ↔ P5 ⟨type · ⚠️ · ·⟩
- `D` I22 — La relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte ; l'Entity est obligatoire, même vide. ↔ P8 ↔ P10 ⟨type+boot · ✅ · R⟩
- `D` I46 — `TStructure` (state d'une Entity) est contraint à `TJsonSerializable`. ⟨type · ✅ · R⟩
- `D` I97 — `Entity.mutate()` utilise `Immer.produceWithPatches`. ⟨run · ✅ · R⟩
- `D` I51 — Les notifications de mutation d'une Entity sont auto-découvertes sur sa Feature (`on<Key>EntityUpdated` / `onAnyEntityUpdated`) — résumé de I96. ⟨boot · ✅ · R⟩
  - `D` I96 — Le dispatch des notifications suit un ordre déterministe (clés changées par ordre alphabétique, puis catch-all) via une souscription unique, avec isolation des erreurs par handler. ⟨boot · ✅ · R⟩
    - `V` I53 — Une clé de handler `on<Key>EntityUpdated` inconnue du state de l'Entity est rejetée au bootstrap. ⟨boot · ✅ · R⟩
  - `D` I98 — Une mutation déclenchée pendant un cycle de notification est mise en file FIFO plutôt qu'exécutée immédiatement, avec une profondeur de ré-entrance bornée. ↔ P4 ↔ I102 ⟨run · ✅ · R⟩

*Rattachés en second parent :* I101, I63, I52

## P2 — Dépendances déclarées

**Un composant n'interagit qu'avec ce qu'il a déclaré statiquement ; il n'existe aucun canal implicite.**

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
  - `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `C` I2 — Une Feature écoute (`listen`) uniquement les Events des Channels externes qu'elle a déclarés. ⟨boot · ✅ · R⟩
- `C` I15 = I50 — Radio est une infrastructure interne, non exposée par `@bonsai/core` — un bus ambiant serait un canal non déclaré. ⟨type · ✅ · R T⟩
- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ✅ · R T⟩
- `V` I70 — Toute référence à un namespace externe (`listens`, `queries`, `request`) est validée contre le manifest au bootstrap. ↔ P8 ⟨boot · ✅ · R⟩

*Rattachés en second parent :* I4, I17, I77, I79, I89

## P3 — Sémantique des trois voies

**Une intention (Command) va à un seul propriétaire, qui peut la refuser ; un fait (Event) est publié par son seul propriétaire vers N abonnés ; une lecture (Request) est sans effet.**

- `E` I10 — Un Command a un seul handler — la Feature propriétaire du Channel. ⟨boot · ✅ · R⟩
- `E` I11 — Un Event peut avoir N abonnés. ⟨run · ✅ · R⟩
- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ⚠️ · R⟩
- `C` I1 = I12 = I26 — Une Feature n'émet (`emit`) que sur son propre Channel — aucune émission cross-domain, et seule la Feature propriétaire utilise `emit()`. ⟨type · ✅ · R⟩
- `C` I25 — Seuls les Views et Behaviors utilisent `trigger()` pour envoyer un Command. ↔ P5 ⟨type · ✅ · R⟩
- `C` I4 — Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. ↔ P2 ⟨type · ✅ · R⟩
- `C` I13 — La View est un point d'entrée (Command) et de projection (Event) — la causalité métier n'y transite jamais. ↔ P5 ⟨revue · 📐 · ·⟩
- `C` I3 — Une Feature ne répond (`reply`) que sur son propre Channel. ⟨boot · ✅ · R⟩
- `C` I17 — Une Feature ne `request` que sur les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. ↔ P2 ⟨type · ⚠️ · R⟩
- `D` I29 — `reply()` retourne toujours `T` de façon synchrone ; `request()` retourne `T | null`. ⟨run · ✅ · R⟩
  - `C` I64 — Aucun I/O (`fetch`, `Promise`, `setTimeout`, `async/await`) dans un replier. ⟨revue · 📐 · ·⟩
  - `D` I55 — Un replier qui throw ne propage jamais l'erreur — `request()` retourne `null`. ⟨run · ✅ · R⟩
    - `D` I65 — L'erreur d'un replier est reportée via l'`ErrorReporter` avant que `null` ne soit retourné. ↔ I102 ⟨run · ⚠️ · ·⟩

*Rattachés en second parent :* I76

## P4 — Causalité traçable et bornée

**Toute chaîne de messages est reconstituable jusqu'à l'action d'origine, et sa longueur est bornée.**

- `E` I7 — Tout message (Command, Event, Request) porte des métadonnées causales complètes (correlationId, causationId, hop, origin, timestamp). ⟨boot · ⏳ · ·⟩
- `C` I8 — Le `correlationId` est créé par l'UI et n'est jamais modifié ensuite. ↔ I102 ⟨run · ⏳ · ·⟩
- `D` I9 — Le `hop` est incrémenté à chaque réaction ; un message au-delà de `MAX_HOPS` est rejeté. ↔ I102 ⟨run · ⏳ · ·⟩
- `D` I54 — Les metas sont créées par le framework et propagées explicitement, jamais construites à la main. ⟨run · ⏳ · ·⟩

*Rattachés en second parent :* I98

## P5 — La couche concrète projette, elle ne décide pas

**Le rendu est une projection du domaine : les composants de la couche concrète (View, Behavior, Composer, Foundation) projettent l'état et relaient les intentions de l'utilisateur, sans porter d'état métier ni prendre de décision métier — accepter ou refuser une intention, calculer ou valider un état du domaine, enchaîner une réaction à un Event par un Command. Leurs seules décisions sont de présentation : quoi afficher et comment, où monter une View, quel état local de présentation tenir.**

- `C` I56 — La couche abstraite (Features, Entities) est active avant la couche concrète (Views). ⟨boot · ✅ · R⟩
- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩
  - `D` I57 — Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. ↔ P8 ⟨type+boot · ✅ · T⟩

*Rattachés en second parent :* I30, I25, I13

## P6 — Propriété exclusive du DOM

**Chaque nœud du DOM a au plus un propriétaire, seul composant autorisé à le muter. La propriété découle de scopes attribués et disjoints, fixés au montage du composant et stables jusqu'à son démontage.**

- `E` I99 — Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplacer. ↔ P7 ⟨boot · ⚠️ · ·⟩
  - `C` I40 — Le scope DOM d'une View est son `rootElement` moins les sous-arbres des slots qu'elle déclare. ⟨boot · ⚠️ · R⟩
  - `C` I34 — Le `rootElement` d'une View est un descendant strict de `<body>`, jamais `<body>` lui-même. ⟨boot · ✅ · R⟩
  - `D` I31 — Le `rootElement` d'une View est un sélecteur CSS fourni exclusivement par le Composer. ⟨boot · ⚠️ · R⟩
  - `D` I58 — Le scope DOM d'un Composer est fixé au bootstrap et ne migre jamais : vivant → suspendu → détruit. ↔ I20 ⟨boot · ⏳ · ·⟩
- `C` I41 — Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. ⟨type · ⏳ · ·⟩
- `C` I43 — Les clés `uiEvents` d'un Behavior sont disjointes de celles de sa View hôte. ⟨boot · ⏳ · ·⟩
- `D` I44 — Un Behavior n'a aucun accès aux propriétés de sa View hôte (`this.view`, `el`, `getUI`). ↔ P10 ⟨type · ⏳ · ·⟩
- `D` I38 = I18 — Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html>`/`<body>`, Composer aucune écriture. ⟨type · ⚠️ · ·⟩
  - `D` I35 — Un Composer n'écrit jamais dans le DOM ; il ne lit son scope que pour résoudre le `rootElement` d'une View enfant. ↔ P10 ⟨revue · ✅ · R⟩
  - `D` I33 — La Foundation est unique par application ; elle seule altère `<html>` et `<body>`, en N1 seulement — attributs et classes, sans ajouter ni retirer de nœud. ⟨boot · ⚠️ · R⟩
  - `D` I32 — La View peut altérer son `rootElement` en N1, mais ne le détruit ni ne le remplace jamais. ⟨revue · 📐 · ·⟩
  - `D` I39 — La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. ⟨type · ⚠️ · R⟩
  - `D` I45 — Un Behavior altère en N1 et N2 uniquement ses propres nœuds (clés ui déclarées), jamais en N3. ↔ P10 ⟨type · ⏳ · ·⟩

*Rattachés en second parent :* I78

## P7 — Cycle de vie hétéronome

**Aucun composant ne décide de sa propre existence ; création et destruction viennent d'un niveau supérieur.**

- `E` I19 — La View n'a aucune responsabilité sur son propre cycle de vie — ni création, ni destruction, ni remplacement. ⟨type · ⚠️ · ·⟩
- `D` I20 — Seuls la Foundation et les Composers créent, détruisent ou remplacent des Views. ⟨run · ⚠️ · R⟩
  - `D` I36 — La View ne compose jamais d'autres Views — elle déclare des slots, le Composer décide de l'instanciation. ↔ P10 ⟨type · ⚠️ · R⟩
  - `D` I37 — Il n'existe qu'un seul type de Composer, qui gère 0..N Views hétérogènes dans un scope DOM fixe. ⟨type · ⚠️ · R⟩
- `D` I67 — La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. ↔ P10 ⟨type+boot · ⚠️ · ·⟩
- `D` I23 — Application est dormante au runtime — aucune logique métier ni rôle actif entre le bootstrap et le shutdown. ↔ P10 ⟨type · ✅ · R⟩
- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ↔ P8 ⟨type+boot · ⚠️ · T⟩
- `D` I94 — Le constructeur d'une Feature est inerte — aucun side-effect au-delà de la validation et de l'assignation du namespace. ↔ P9 ⟨boot · ✅ · R⟩

*Rattachés en second parent :* I99

## P8 — Identité par le manifest

**Une Feature n'a d'identité que par sa clé dans un manifest unique.**

- `E` I69 — Le manifest est l'unique source de vérité de l'identité d'une Feature. ⟨type · ✅ · R⟩
  - `C` I68 — Aucune classe Feature ne déclare de `static namespace`. ⟨type · ✅ · R T⟩
  - `C` I72 — `TSelfNS` est la clé de la Feature dans le manifest. ⟨type · ✅ · R T⟩
  - `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩
  - `V` I95 — Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. ⟨type · ✅ · T⟩
- `D` I21 = I24 — Toute Feature est enregistrée dans le manifest sous une clé `camelCase` sans chiffre. ⟨type+boot · ✅ · R T⟩
- `D` I71 — Les namespaces `local` et `router` sont réservés (`RESERVED_NAMESPACES`). ⟨type+boot · ✅ · R T⟩

*Rattachés en second parent :* I22, I70, I57, I28

## P9 — Garantie au plus tôt *(méta-principe)*

**Toute règle imposée au code applicatif est garantie par construction au compile-time ; à défaut, vérifiée au bootstrap, frontière de confiance. Seule une règle qui dépend de données connues à l'exécution est vérifiée au runtime, et alors par une garde qui échoue explicitement dès la première violation.**

- `E` I66 — Le bootstrap est la frontière de confiance — après `app.start()` les garanties sont vérifiées, avant, aucun `trigger`/`emit`/`request` n'est accepté. ⟨boot · ⏳ · ·⟩
- `D` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I76 — Les méthodes de `Channel` sont typées par `TDef` — un nom de message est une clé de la voie, jamais une `string` libre. ↔ P3 ⟨type · ✅ · T⟩
  - `D` I103 — Les clés de Commands, d'Events et de Requests d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. ↔ I21 ⟨type · ⏳ · ·⟩
- `C` I77 — `View.trigger()` n'accepte qu'une clé `"ns:cmd"` validée contre le contrat de la View. ↔ P2 ⟨type · ✅ · T⟩
- `C` I78 — `View.getUI(key)` n'accepte qu'une clé déclarée dans le `TUIContract` de la View. ↔ P6 ⟨type · ✅ · T⟩
- `C` I79 — `Feature.request()` n'accepte qu'un `TChannelToken` typé, jamais un namespace `string` libre. ↔ P2 ⟨type · ✅ · R⟩
- `D` I48 — Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Request`, `on<Channel><Event>Event`, handlers DOM), découvertes et câblées par le framework. ⟨boot · ✅ · R⟩
  - `D` I88 — Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers requis. ⟨revue · 📐 · T⟩
    - `D` I92 — Toute Feature concrète `implements TFeatureCallbacks<TDef, TListens>` ; un handler absent ou mal signé est une erreur de compilation. ⟨type · ✅ · T⟩
    - `D` I82 — `implements TViewCallbacks<TVC>` rend obligatoires les handlers d'Event et les handlers DOM déclarés ; un filet au `mount()` couvre les contournements. ⟨type+boot · ✅ · R⟩
      - `C` I84 — Un élément UI déclaré avec `events` non vide exige ses handlers DOM ; `events` vide déclare un élément non interactif. ⟨type+boot · ✅ · R T⟩
- `D` I73 = I47 — Chaque Feature déclare `static readonly channel` — son contrat de communication typé, unique pont entre la classe et son Channel. ⟨type · ✅ · R T⟩
- `D` I74 = I49 — La définition du Channel, le type d'état et la classe Feature sont co-localisés dans le fichier `*.feature.ts` du domaine. ⟨revue · 📐 · R⟩
- `D` I93 — `listens` et `queries` sont des `abstract get` d'instance que toute Feature concrète implémente. ⟨type · ✅ · R T⟩
- `D` I81 — Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. ⟨boot · ✅ · R⟩
- `D` I83 — Tous les composants consommateurs composent leur contrat selon le même pattern modulaire (`TFeatureContract`, `TUIContract`, `TUIElements`). ⟨revue · 📐 · R⟩
- `D` I85 — `ui<TEl>()(events)` est le helper officiel pour construire une `TUIEntry`. ⟨revue · 📐 · R T⟩
  - `D` I86 — Le champ `events` d'une `TUIEntry` est toujours présent, tableau (éventuellement vide) sans doublons. ⟨type · ✅ · R T⟩
  - `D` I89 — Tout événement déclaré dans `events` appartient à `TEventsFor<TEl>` ; les `CustomEvent` arbitraires sont exclus. ↔ P2 ⟨type · ⚠️ · T⟩
  - `C` I90 — Un nom d'événement apparaît au plus une fois dans `events`. ⟨type · ✅ · T⟩
  - `D` I91 — `TEventsFor<TEl>` est la table officielle entre sous-types d'éléments HTML et événements DOM cohérents. ⟨type · ⚠️ · T⟩

*Rattachés en second parent :* I94

## P10 — Une responsabilité, un rôle *(méta-principe)*

**Chaque responsabilité du framework est portée par un seul rôle, et chaque rôle n'en porte qu'une ; aucun rôle n'empiète sur celle d'un autre.**

- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
  - `C` I101 — Une Entity ne porte aucune logique métier : elle garde l'état, applique les mutations que sa Feature lui fournit et expose des lectures pures ; toute décision (validation métier, transformation, refus d'une intention) appartient à la Feature. ↔ P1 ⟨revue · 📐 · ·⟩
    - `C` I63 — Un schema Entity ne contient ni `v.transform()` ni coercion — c'est un garde-fou en lecture, la transformation reste dans le command handler. ↔ P1 ⟨revue · ⏳ · ·⟩
    - `D` I52 — L'Entity expose des méthodes query pures (lecture seule). ↔ P1 ⟨revue · 📐 · R⟩

*Rattachés en second parent :* I22, I44, I35, I45, I36, I67, I23
