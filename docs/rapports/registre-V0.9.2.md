# Bonsai — Registre rattaché à la théorie (jalon V0.9.2)

*Chaque principe `P<n>` et chaque invariant `I<n>` du registre (`docs/invariants/`) reçoit exactement un statut parmi ceux de la feuille de route, et l'élément de la théorie qui le fonde. La théorie fait autorité : un élément du registre qui la contredit est à reformuler, jamais l'inverse.*

## Principes

| Id | Titre | Statut | Fondé sur | Note |
| --- | --- | --- | --- | --- |
| P1 | Souveraineté du domaine | reformulation pédagogique | A1.b, A3.c, 16.2, 16.3 | « domain state » s'entend de l'état de référence : une View peut en contenir une copie (A4.d). |
| P2 | Dépendances déclarées | décision | D16 |  |
| P3 | Sémantique des trois voies | conséquence existante | T2, A3.g | « Request » devient « Query ». |
| P4 | Causalité traçable et bornée | reformulation pédagogique | A5.b, A5.c (traçable), D9 (bornée) |  |
| P5 | La couche concrète projette, elle ne décide pas | décision | A4.d, D12, D18 |  |
| P6 | Propriété exclusive du DOM | conséquence existante | A1.b, A2.d, T7 |  |
| P7 | Cycle de vie hétéronome | conséquence existante | A0.d, 7.2, A1.b |  |
| P8 | Identité par le manifest | décision | D14, 16.9, A2.a |  |
| P9 | Garantie au plus tôt | règle de méthode | §19, O2 | « Bootstrap, frontière de confiance » : le démarrage est une phase ; la frontière de confiance est formée des points d'admission (11.7). |
| P10 | Une responsabilité, un rôle | règle de méthode | §16 |  |

## Invariants

| Statut | Nombre |
| --- | --- |
| garde | 51 |
| contrainte d'implémentation | 17 |
| garde (à reformuler) | 10 |
| garde (à remonter) | 9 |
| conséquence existante | 2 |
| règle de méthode | 2 |

« Garde » : l'invariant vérifie une règle de la théorie (voir `docs/gardes.md`). « Contrainte d'implémentation » : il fixe un choix de réalisation, légitime dans la spécification, sans fonder de règle du modèle. Aucun invariant n'est obsolète en entier ; I58 l'est en partie.

| Id | Énoncé (abrégé) | Statut | Fondé sur | Note |
| --- | --- | --- | --- | --- |
| I1 | Une Feature n'émet (`emit`) que sur son propre Channel — aucune émission cross-domain, et seule la Feature propriétaire … | garde | A3.e, T2 |  |
| I2 | Une Feature écoute (`listen`) uniquement les Events des Channels externes qu'elle a déclarés. | garde (à remonter) | D16, A4.b | Les abonnements sont dérivés du contrat déclaré : vérifiable à la compilation (construction par D16). |
| I3 | Une Feature ne répond (`reply`) que sur son propre Channel. | garde (à remonter) | A3.e, 9.11 | La réponse est liée au Channel du traitement : vérifiable par construction. |
| I4 | Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. | garde | D6, D16 |  |
| I6 | L'Entity n'est accessible qu'à sa Feature propriétaire : aucun autre composant (View, Behavior, autre Feature, Composer,… | garde | A1.b, A3.c |  |
| I7 | Tout message (Command, Event, Request) porte des métadonnées causales complètes (correlationId, causationId, hop, origin… | garde | A5.b |  |
| I8 | Le `correlationId` est créé par l'UI et n'est jamais modifié ensuite. | garde (à reformuler) | A5.c, G2 | Le contexte d'une origine est créé par le composant qui admet le fait (A5.c) : View, mais aussi adaptateur, y compris du domaine. « Créé par l'UI » est à reformuler. |
| I9 | Le `hop` est incrémenté à chaque réaction ; un message au-delà de `MAX_HOPS` est rejeté. | garde | D9 | Ne peut pas monter : la profondeur n'est connue qu'à l'exécution. |
| I10 | Un Command a un seul handler — la Feature propriétaire du Channel. | garde (à remonter) | A3.e, T2 | Par D16, un seul traitement dérivé par Command : la duplication devient impossible par construction. |
| I11 | Un Event peut avoir N abonnés. | conséquence existante | T2 |  |
| I13 | La View est un point d'entrée (Command) et de projection (Event) — la causalité métier n'y transite jamais. | garde (à remonter) | D18, A4.d | Vérifiée par revue ; par D16, vérifiable à la compilation. |
| I14 | Tout composant déclare statiquement les Channels avec lesquels il interagit. | garde | D16 |  |
| I15 | Radio est une infrastructure interne, non exposée par `@bonsai/core` — un bus ambiant serait un canal non déclaré. | garde | A3.b, A3.e, G4 |  |
| I16 | Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). | garde | D16 |  |
| I17 | Une Feature ne `request` que sur les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. | garde | D16, A3.g |  |
| I19 | La View n'a aucune responsabilité sur son propre cycle de vie — ni création, ni destruction, ni remplacement. | garde | 7.2, D11 |  |
| I20 | Seuls la Foundation et les Composers créent, détruisent ou remplacent des Views. | garde (à remonter) | D11 | La View n'a pas d'API de création de View (I36) : la garde d'exécution est redondante. |
| I21 | Toute Feature est enregistrée dans le manifest sous une clé `camelCase` sans chiffre. | garde | 16.9, 8.4 |  |
| I22 | La relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte ; l'Entity est obligatoire, même vide. | garde | D4, 16.3 |  |
| I23 | Application est dormante au runtime — aucune logique métier ni rôle actif entre le bootstrap et le shutdown. | garde | 16.1 | 16.1 pourrait l'énoncer explicitement : la racine n'a pas de Channel. |
| I25 | Seuls les Views et Behaviors utilisent `trigger()` pour envoyer un Command. | garde (à reformuler) | D17, D12, 16.8 | À reformuler : seuls les composants de l'interface et les adaptateurs adressent des Commands aux Features (D17) ; un Composer n'en adresse aucune (D12) ; une Feature peut en adresser aux adaptateurs du domaine. La garde devient de construction par D16. |
| I27 | Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. | conséquence existante | T2 |  |
| I28 | Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. | garde (à reformuler) | D15, D14 | Le Router est activé par le Manifest (D14, D15), pas instancié en dehors. |
| I29 | `reply()` retourne toujours `T` de façon synchrone ; `request()` retourne `T \| null`. | garde | 9.11, G5 | `null` relève de la politique d'erreur, hors théorie. |
| I30 | Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. | garde (à reformuler) | A4.d, 16.5 | A4.d permet à une View de contenir une copie d'information métier ; la règle est qu'elle ne la remplace que par une information issue du domaine. À reformuler. |
| I31 | Le `rootElement` d'une View est un sélecteur CSS fourni exclusivement par le Composer. | garde | D11, A3.d |  |
| I32 | La View peut altérer son `rootElement` en N1, mais ne le détruit ni ne le remplace jamais. | garde (à remonter) | 16.5, A2.d | Revue seulement ; l'API de la View peut ne pas offrir de retrait de son élément racine (construction). |
| I33 | La Foundation est unique par application ; elle seule altère `<html>` et `<body>`, en N1 seulement — attributs et classe… | garde (à reformuler) | D1, D3 | Même écart que I38 pour `<html>`. |
| I34 | Le `rootElement` d'une View est un descendant strict de `<body>`, jamais `<body>` lui-même. | garde (à reformuler) | A2.d, D3 | Avec D3 élargie, le `rootElement` d'une View est un descendant strict de l'élément de la Foundation, pas forcément de `<body>`. |
| I35 | Un Composer n'écrit jamais dans le DOM ; il ne lit son scope que pour résoudre le `rootElement` d'une View enfant. | garde (à remonter) | D12 | Le type du Composer n'offre aucune écriture : c'est déjà une garde de construction, le registre l'indique en « revue ». |
| I36 | La View ne compose jamais d'autres Views — elle déclare des slots, le Composer décide de l'instanciation. | garde | D11 |  |
| I37 | Il n'existe qu'un seul type de Composer, qui gère 0..N Views hétérogènes dans un scope DOM fixe. | garde | 16.6 | Forme de l'API. |
| I38 | Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foun… | garde (à reformuler) | D12, 16.4, 16.5, 16.7 | Les attributs de `<html>` relèvent de l'adaptateur du document (annexe A.1), pas de la Foundation (D3). |
| I39 | La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. | garde | A3.c, 9.10 |  |
| I40 | Le scope DOM d'une View est son `rootElement` moins les sous-arbres des slots qu'elle déclare. | garde | 6.5, 16.5 |  |
| I41 | Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. | contrainte d'implémentation | règle d'imputation (§2.5) | Organisation interne du rendu d'une View. |
| I42 | Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. | garde | 16.5, 9.5 |  |
| I43 | Les clés `uiEvents` d'un Behavior sont disjointes de celles de sa View hôte. | garde (à remonter) | D13 | Les clés de la View et du Behavior sont connues dans les types : vérifiable à la compilation. |
| I44 | Un Behavior n'a aucun accès aux propriétés de sa View hôte (`this.view`, `el`, `getUI`). | garde | D13 |  |
| I45 | Un Behavior altère en N1 et N2 uniquement ses propres nœuds (clés ui déclarées), jamais en N3. | garde | D13, 16.7 |  |
| I46 | `TStructure` (state d'une Entity) est contraint à `TJsonSerializable`. | contrainte d'implémentation | — | Sert O1 (rejeu) : candidate à une décision si la sérialisabilité de l'état devient une exigence. |
| I48 | Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Request`, `on<Channel><Event>Event`, … | garde | D16 |  |
| I51 | Les notifications de mutation d'une Entity sont auto-découvertes sur sa Feature (`on<Key>EntityUpdated` / `onAnyEntityUp… | contrainte d'implémentation | règle d'imputation (§2.5) | Organisation interne d'une Feature : les notifications de son Entity ne sont pas des messages. |
| I52 | L'Entity expose des méthodes query pures (lecture seule). | contrainte d'implémentation | règle d'imputation (§2.5) | Organisation interne ; rappelle A3.g sans en relever. |
| I53 | Une clé de handler `on<Key>EntityUpdated` inconnue du state de l'Entity est rejetée au bootstrap. | contrainte d'implémentation | — | Cohérence interne entre une Feature et son Entity. |
| I54 | Les metas sont créées par le framework et propagées explicitement, jamais construites à la main. | garde | A5.c, B.4 |  |
| I55 | Un replier qui throw ne propage jamais l'erreur — `request()` retourne `null`. | garde (à reformuler) | G7 | Par G7, une Query dont le traitement échoue ne rend aucune réponse : rendre `null` la confond avec une réponse légitime. À reformuler (échec distinct de `null`, forme laissée à la spécification). |
| I56 | La couche abstraite (Features, Entities) est active avant la couche concrète (Views). | garde | D14 |  |
| I57 | Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. | garde | 9.5 |  |
| I58 | Le scope DOM d'un Composer est fixé au bootstrap et ne migre jamais : vivant → suspendu → détruit. | garde (à reformuler) | 16.6 | L'état « suspendu » est obsolète. |
| I63 | Un schema Entity ne contient ni `v.transform()` ni coercion — c'est un garde-fou en lecture, la transformation reste dan… | contrainte d'implémentation | — | Choix d'implémentation (Valibot). |
| I64 | Aucun I/O (`fetch`, `Promise`, `setTimeout`, `async/await`) dans un replier. | garde (à remonter) | A3.g, 9.3 | Revue seulement ; le type de retour d'un traitement de Query peut exclure `Promise` (statique). |
| I65 | L'erreur d'un replier est reportée via l'`ErrorReporter` avant que `null` ne soit retourné. | garde | G7 | Le signalement avec contexte causal est exigé par G7. |
| I66 | Le bootstrap est la frontière de confiance — après `app.start()` les garanties sont vérifiées, avant, aucun `trigger`/`e… | garde (à reformuler) | D14 | « Frontière de confiance » désigne les points d'admission (11.7). Le démarrage est une phase : à renommer. Le fond (aucun message avant le démarrage) découle de D14. |
| I67 | La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. | contrainte d'implémentation | — | Aucune règle ne fixe les Composers de la Foundation : décision candidate (D11 la complèterait). |
| I68 | Aucune classe Feature ne déclare de `static namespace`. | garde | 16.9 |  |
| I69 | Le manifest est l'unique source de vérité de l'identité d'une Feature. | garde | D14, 16.9 |  |
| I70 | Toute référence à un namespace externe (`listens`, `queries`, `request`) est validée contre le manifest au bootstrap. | garde | D14, D16 | Démarrage justifié : un Manifest assemblé à partir de modules n'est pas vérifiable à la compilation (16.9). |
| I71 | Les namespaces `local` et `router` sont réservés (`RESERVED_NAMESPACES`). | garde | 9.5, D15 |  |
| I72 | `TSelfNS` est la clé de la Feature dans le manifest. | garde | 16.9 |  |
| I73 | Chaque Feature déclare `static readonly channel` — son contrat de communication typé, unique pont entre la classe et son… | garde | D16, A3.b |  |
| I74 | La définition du Channel, le type d'état et la classe Feature sont co-localisés dans le fichier `*.feature.ts` du domain… | contrainte d'implémentation | — | Convention d'organisation des fichiers. |
| I75 | Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. | contrainte d'implémentation | O2 | Qualité des types ; une règle de lint la rendrait statique. |
| I76 | Les méthodes de `Channel` sont typées par `TDef` — un nom de message est une clé de la voie, jamais une `string` libre. | garde | D16 |  |
| I77 | `View.trigger()` n'accepte qu'une clé `"ns:cmd"` validée contre le contrat de la View. | garde | D16, A4.b |  |
| I78 | `View.getUI(key)` n'accepte qu'une clé déclarée dans le `TUIContract` de la View. | garde | D16, A3.c |  |
| I79 | `Feature.request()` n'accepte qu'un `TChannelToken` typé, jamais un namespace `string` libre. | garde | D16 |  |
| I80 | Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un … | garde | D16 | Forme du contrat. |
| I81 | Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. | garde | D16 |  |
| I82 | `implements TViewCallbacks<TVC>` rend obligatoires les handlers d'Event et les handlers DOM déclarés ; un filet au `moun… | garde | D16 |  |
| I83 | Tous les composants consommateurs composent leur contrat selon le même pattern modulaire (`TFeatureContract`, `TUIContra… | contrainte d'implémentation | — | Convention d'API. |
| I84 | Un élément UI déclaré avec `events` non vide exige ses handlers DOM ; `events` vide déclare un élément non interactif. | garde | D16 |  |
| I85 | `ui<TEl>()(events)` est le helper officiel pour construire une `TUIEntry`. | contrainte d'implémentation | — | Convention d'API. |
| I86 | Le champ `events` d'une `TUIEntry` est toujours présent, tableau (éventuellement vide) sans doublons. | garde | D16 |  |
| I87 | La clé d'un `TFeatureContract` est le namespace de la Feature référencée. | garde | 16.9, D16 |  |
| I88 | Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers req… | garde | D16 |  |
| I89 | Tout événement déclaré dans `events` appartient à `TEventsFor<TEl>` ; les `CustomEvent` arbitraires sont exclus. | contrainte d'implémentation | D16 | L'exclusion des `CustomEvent` n'a pas de règle : décision candidate (faits de l'hôte admissibles). |
| I90 | Un nom d'événement apparaît au plus une fois dans `events`. | garde | D16 |  |
| I91 | `TEventsFor<TEl>` est la table officielle entre sous-types d'éléments HTML et événements DOM cohérents. | garde | D16 |  |
| I92 | Toute Feature concrète `implements TFeatureCallbacks<TDef, TListens>` ; un handler absent ou mal signé est une erreur de… | garde | D16 |  |
| I93 | `listens` et `queries` sont des `abstract get` d'instance que toute Feature concrète implémente. | garde | D16 |  |
| I94 | Le constructeur d'une Feature est inerte — aucun side-effect au-delà de la validation et de l'assignation du namespace. | garde | A5.a |  |
| I95 | Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. | garde | 16.9 |  |
| I96 | Le dispatch des notifications suit un ordre déterministe (clés changées par ordre alphabétique, puis catch-all) via une … | contrainte d'implémentation | O1 | Ordre interne à une Feature ; sert O1, à la manière de D8. |
| I97 | `Entity.mutate()` utilise `Immer.produceWithPatches`. | contrainte d'implémentation | — | Choix d'implémentation (Immer). |
| I98 | Une mutation déclenchée pendant un cycle de notification est mise en file FIFO plutôt qu'exécutée immédiatement, avec un… | contrainte d'implémentation | — | Ré-entrance interne à une Feature ; entre composants, G5 l'exclut déjà. |
| I99 | Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut … | garde | A2.d, 6.5, T7 |  |
| I100 | Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Compo… | règle de méthode | §16 |  |
| I101 | Une Entity ne porte aucune logique métier : elle garde l'état, applique les mutations que sa Feature lui fournit et expo… | contrainte d'implémentation | règle d'imputation (§2.5), 16.2 | Organisation interne d'une Feature. |
| I102 | Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première vi… | règle de méthode | §19 |  |
| I103 | Les clés de Commands, d'Events et de Requests d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. | contrainte d'implémentation | — | Convention de nommage. |
