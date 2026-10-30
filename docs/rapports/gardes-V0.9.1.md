# Bonsai — Classement des gardes (jalon V0.9.1)

*Rapport de travail. Chaque invariant du registre (`docs/invariants/P*.yaml`) est rattaché à la règle de la théorie V0.9 qu'il protège, et son niveau est jugé selon la règle de méthode du §19 : une garde se place au niveau le plus précoce que l'énoncé de sa règle permet. Le niveau « revue » n'est pas une garde.*

## Synthèse

| Verdict | Nombre |
| --- | --- |
| conforme | 53 |
| hors théorie | 17 |
| contredit la théorie | 10 |
| peut monter | 8 |
| conséquence, pas une contrainte | 2 |
| règle sans garde | 1 |

- **Contredit la théorie** : l'invariant énonce une règle incompatible avec une clause ou une décision ; il est à reformuler, ou la théorie est à compléter par une décision.
- **Peut monter** : la règle est protégée, mais un niveau plus précoce est accessible.
- **Hors théorie** : l'invariant ne protège aucune règle du modèle (organisation interne d'un composant, convention, choix d'implémentation). Il reste légitime, mais relève de la spécification, non de la théorie ; certains sont des décisions candidates.
- **Conséquence** : l'invariant énonce une propriété démontrée, qui ne contraint pas le code.

## Règles de la théorie sans garde

| Règle | Énoncé | Garde possible, niveau le plus précoce |
| --- | --- | --- |
| A2.c | aucun transfert de propriété | statique : aucune API ne transfère un état ; à énoncer |
| A3.d | paramètres de création sans référence | statique : paramètres et charges des messages typés sérialisables |
| A3.h | n'émettre que sur ce qu'on conserve | aucune : l'origine de l'information émise n'est pas observable ; garde impossible, à nommer comme telle (§19) |
| A4.a | invariants métier satisfaits à l'issue de chaque traitement | exécution : validation de l'Entity par son schéma après chaque traitement |
| A4.b | le domaine n'adresse rien à l'interface et n'en reçoit rien | statique : par D16, un contrat de Feature ne liste aucun Channel de l'interface |
| A4.c | seul le domaine parle aux systèmes extérieurs | statique (lint) : pas d'appel réseau dans le code d'une View, d'un Composer ou d'un Behavior |
| A4.e | un Channel du domaine ne prend fin qu'avec la racine | construction : aucune API de destruction d'une Feature |
| A5.a | tout changement d'état résulte d'un traitement | exécution : `mutate()` refusée hors d'un traitement |
| A5.d, D10 | un fait, une admission | démarrage : refus d'une View qui écoute un raccourci déclaré global |
| B.2 | périmètres disjoints, adaptateurs « un par hôte » | démarrage |
| B.5 | projection seulement sur différence | construction : réalisée par l'adaptateur fourni |
| G7 | traitement sans effet s'il échoue | garantie de Bonsai, à tester (annulation des patches d'Entity, file des messages vidée) ; aucun invariant du registre |

## Invariants du registre

| Id | Énoncé (abrégé) | Règle protégée | Niveau actuel | Verdict | Note |
| --- | --- | --- | --- | --- | --- |
| I1 | Une Feature n'émet (`emit`) que sur son propre Channel — aucune émission cross-domain, et seule la Feature propriétaire utilise `emit()`. | A3.e, T2 | construction (livre) | conforme |  |
| I2 | Une Feature écoute (`listen`) uniquement les Events des Channels externes qu'elle a déclarés. | D16, A4.b | démarrage (livre) | peut monter | Les abonnements sont dérivés du contrat déclaré : vérifiable à la compilation (construction par D16). |
| I3 | Une Feature ne répond (`reply`) que sur son propre Channel. | A3.e, 9.11 | démarrage (livre) | peut monter | La réponse est liée au Channel du traitement : vérifiable par construction. |
| I4 | Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. | D6, D16 | statique (partiel) | conforme |  |
| I6 | L'Entity n'est accessible qu'à sa Feature propriétaire : aucun autre composant (View, Behavior, autre Feature, Composer, Foundation) ne peut… | A1.b, A3.c | construction (livre) | conforme |  |
| I7 | Tout message (Command, Event, Request) porte des métadonnées causales complètes (correlationId, causationId, hop, origin, timestamp). | A5.b | démarrage (cible) | conforme |  |
| I8 | Le `correlationId` est créé par l'UI et n'est jamais modifié ensuite. | A5.c, G2 | exécution (cible) | contredit la théorie | Le contexte d'une origine est créé par le composant qui admet le fait (A5.c) : View, mais aussi adaptateur, y compris du domaine. « Créé par l'UI » est à reformuler. |
| I9 | Le `hop` est incrémenté à chaque réaction ; un message au-delà de `MAX_HOPS` est rejeté. | D9 | exécution (cible) | conforme | Ne peut pas monter : la profondeur n'est connue qu'à l'exécution. |
| I10 | Un Command a un seul handler — la Feature propriétaire du Channel. | A3.e, T2 | démarrage (livre) | peut monter | Par D16, un seul traitement dérivé par Command : la duplication devient impossible par construction. |
| I11 | Un Event peut avoir N abonnés. | T2 | exécution (livre) | conséquence, pas une contrainte |  |
| I13 | La View est un point d'entrée (Command) et de projection (Event) — la causalité métier n'y transite jamais. | A4.d, 16.5 | revue (aucune garde) (convention) | règle sans garde | Vérifiée par revue seulement. |
| I14 | Tout composant déclare statiquement les Channels avec lesquels il interagit. | D16 | statique + démarrage (partiel) | conforme |  |
| I15 | Radio est une infrastructure interne, non exposée par `@bonsai/core` — un bus ambiant serait un canal non déclaré. | A3.b, A3.e, G4 | construction (livre) | conforme |  |
| I16 | Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). | D16 | statique + démarrage (partiel) | conforme |  |
| I17 | Une Feature ne `request` que sur les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. | D16, A3.g | statique (partiel) | conforme |  |
| I19 | La View n'a aucune responsabilité sur son propre cycle de vie — ni création, ni destruction, ni remplacement. | 7.2, D11 | construction (partiel) | conforme |  |
| I20 | Seuls la Foundation et les Composers créent, détruisent ou remplacent des Views. | D11 | exécution (partiel) | peut monter | La View n'a pas d'API de création de View (I36) : la garde d'exécution est redondante. |
| I21 | Toute Feature est enregistrée dans le manifest sous une clé `camelCase` sans chiffre. | 16.9, 8.4 | statique + démarrage (livre) | conforme |  |
| I22 | La relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte ; l'Entity est obligatoire, même vide. | D4, 16.3 | statique + démarrage (livre) | conforme |  |
| I23 | Application est dormante au runtime — aucune logique métier ni rôle actif entre le bootstrap et le shutdown. | 16.1 | statique (livre) | conforme | 16.1 pourrait l'énoncer explicitement : la racine n'a pas de Channel. |
| I25 | Seuls les Views et Behaviors utilisent `trigger()` pour envoyer un Command. | D17, D12, 16.8 | statique (partiel) | contredit la théorie | À reformuler : seuls les composants de l'interface et les adaptateurs adressent des Commands aux Features (D17) ; un Composer n'en adresse aucune (D12) ; une Feature peut en adresser aux adaptateurs du domaine. La garde devient de construction par D16. |
| I27 | Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. | T2 | exécution (partiel) | conséquence, pas une contrainte |  |
| I28 | Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. | D15, D14 | statique + démarrage (partiel) | contredit la théorie | Le Router est activé par le Manifest (D14, D15), pas instancié en dehors. |
| I29 | `reply()` retourne toujours `T` de façon synchrone ; `request()` retourne `T \| null`. | 9.11, G5 | exécution (livre) | conforme | `null` relève de la politique d'erreur, hors théorie. |
| I30 | Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. | A4.d, 16.5 | statique (partiel) | contredit la théorie | A4.d permet à une View de contenir une copie d'information métier ; la règle est qu'elle ne la remplace que par une information issue du domaine. À reformuler. |
| I31 | Le `rootElement` d'une View est un sélecteur CSS fourni exclusivement par le Composer. | D11, A3.d | démarrage (partiel) | conforme |  |
| I32 | La View peut altérer son `rootElement` en N1, mais ne le détruit ni ne le remplace jamais. | 16.5, A2.d | revue (aucune garde) (convention) | peut monter | Revue seulement ; l'API de la View peut ne pas offrir de retrait de son élément racine (construction). |
| I33 | La Foundation est unique par application ; elle seule altère `<html>` et `<body>`, en N1 seulement — attributs et classes, sans ajouter ni r… | D1, D3 | démarrage (partiel) | contredit la théorie | Même écart que I38 pour `<html>`. |
| I34 | Le `rootElement` d'une View est un descendant strict de `<body>`, jamais `<body>` lui-même. | A2.d, D3 | démarrage (livre) | contredit la théorie | Avec D3 élargie, le `rootElement` d'une View est un descendant strict de l'élément de la Foundation, pas forcément de `<body>`. |
| I35 | Un Composer n'écrit jamais dans le DOM ; il ne lit son scope que pour résoudre le `rootElement` d'une View enfant. | D12 | revue (aucune garde) (livre) | peut monter | Le type du Composer n'offre aucune écriture : c'est déjà une garde de construction, le registre l'indique en « revue ». |
| I36 | La View ne compose jamais d'autres Views — elle déclare des slots, le Composer décide de l'instanciation. | D11 | statique (partiel) | conforme |  |
| I37 | Il n'existe qu'un seul type de Composer, qui gère 0..N Views hétérogènes dans un scope DOM fixe. | 16.6 | statique (partiel) | conforme | Forme de l'API. |
| I38 | Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html… | D12, 16.4, 16.5, 16.7 | statique (partiel) | contredit la théorie | Les attributs de `<html>` relèvent de l'adaptateur du document (annexe A.1), pas de la Foundation (D3). |
| I39 | La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. | A3.c, 9.10 | construction (partiel) | conforme |  |
| I40 | Le scope DOM d'une View est son `rootElement` moins les sous-arbres des slots qu'elle déclare. | 6.5, 16.5 | démarrage (partiel) | conforme |  |
| I41 | Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. | règle d'imputation (§2.5) | statique (cible) | hors théorie | Organisation interne du rendu d'une View. |
| I42 | Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. | 16.5, 9.5 | statique + démarrage (cible) | conforme |  |
| I43 | Les clés `uiEvents` d'un Behavior sont disjointes de celles de sa View hôte. | D13 | démarrage (cible) | peut monter | Les clés de la View et du Behavior sont connues dans les types : vérifiable à la compilation. |
| I44 | Un Behavior n'a aucun accès aux propriétés de sa View hôte (`this.view`, `el`, `getUI`). | D13 | construction (cible) | conforme |  |
| I45 | Un Behavior altère en N1 et N2 uniquement ses propres nœuds (clés ui déclarées), jamais en N3. | D13, 16.7 | statique (cible) | conforme |  |
| I46 | `TStructure` (state d'une Entity) est contraint à `TJsonSerializable`. | — | statique (livre) | hors théorie | Sert O1 (rejeu) : candidate à une décision si la sérialisabilité de l'état devient une exigence. |
| I48 | Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Request`, `on<Channel><Event>Event`, handlers DOM), décou… | D16 | démarrage (livre) | conforme |  |
| I51 | Les notifications de mutation d'une Entity sont auto-découvertes sur sa Feature (`on<Key>EntityUpdated` / `onAnyEntityUpdated`) — résumé de … | règle d'imputation (§2.5) | démarrage (livre) | hors théorie | Organisation interne d'une Feature : les notifications de son Entity ne sont pas des messages. |
| I52 | L'Entity expose des méthodes query pures (lecture seule). | règle d'imputation (§2.5) | revue (aucune garde) (convention) | hors théorie | Organisation interne ; rappelle A3.g sans en relever. |
| I53 | Une clé de handler `on<Key>EntityUpdated` inconnue du state de l'Entity est rejetée au bootstrap. | — | démarrage (livre) | hors théorie | Cohérence interne entre une Feature et son Entity. |
| I54 | Les metas sont créées par le framework et propagées explicitement, jamais construites à la main. | A5.c, B.4 | construction (cible) | conforme |  |
| I55 | Un replier qui throw ne propage jamais l'erreur — `request()` retourne `null`. | G7 | exécution (livre) | contredit la théorie | Par G7, une Query dont le traitement échoue ne rend aucune réponse : rendre `null` la confond avec une réponse légitime. À reformuler (échec distinct de `null`, forme laissée à la spécification). |
| I56 | La couche abstraite (Features, Entities) est active avant la couche concrète (Views). | D14 | démarrage (livre) | conforme |  |
| I57 | Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. | 9.5 | statique + démarrage (livre) | conforme |  |
| I58 | Le scope DOM d'un Composer est fixé au bootstrap et ne migre jamais : vivant → suspendu → détruit. | 16.6 | démarrage (cible) | contredit la théorie | L'état « suspendu » contredit 16.6 : un slot qui disparaît entraîne la destruction de son Composer. |
| I63 | Un schema Entity ne contient ni `v.transform()` ni coercion — c'est un garde-fou en lecture, la transformation reste dans le command handler… | — | revue (aucune garde) (cible) | hors théorie | Choix d'implémentation (Valibot). |
| I64 | Aucun I/O (`fetch`, `Promise`, `setTimeout`, `async/await`) dans un replier. | A3.g, 9.3 | revue (aucune garde) (convention) | peut monter | Revue seulement ; le type de retour d'un traitement de Query peut exclure `Promise` (statique). |
| I65 | L'erreur d'un replier est reportée via l'`ErrorReporter` avant que `null` ne soit retourné. | G7 | exécution (partiel) | conforme | Le signalement avec contexte causal est exigé par G7. |
| I66 | Le bootstrap est la frontière de confiance — après `app.start()` les garanties sont vérifiées, avant, aucun `trigger`/`emit`/`request` n'est… | D14 | démarrage (cible) | contredit la théorie | « Frontière de confiance » désigne les points d'admission (11.7). Le démarrage est une phase : à renommer. Le fond (aucun message avant le démarrage) découle de D14. |
| I67 | La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. | — | statique + démarrage (partiel) | hors théorie | Aucune règle ne fixe les Composers de la Foundation : décision candidate (D11 la complèterait). |
| I68 | Aucune classe Feature ne déclare de `static namespace`. | 16.9 | statique (livre) | conforme |  |
| I69 | Le manifest est l'unique source de vérité de l'identité d'une Feature. | D14, 16.9 | statique (livre) | conforme |  |
| I70 | Toute référence à un namespace externe (`listens`, `queries`, `request`) est validée contre le manifest au bootstrap. | D14, D16 | démarrage (livre) | conforme | Démarrage justifié : un Manifest assemblé à partir de modules n'est pas vérifiable à la compilation (16.9). |
| I71 | Les namespaces `local` et `router` sont réservés (`RESERVED_NAMESPACES`). | 9.5, D15 | statique + démarrage (livre) | conforme |  |
| I72 | `TSelfNS` est la clé de la Feature dans le manifest. | 16.9 | statique (livre) | conforme |  |
| I73 | Chaque Feature déclare `static readonly channel` — son contrat de communication typé, unique pont entre la classe et son Channel. | D16, A3.b | statique (livre) | conforme |  |
| I74 | La définition du Channel, le type d'état et la classe Feature sont co-localisés dans le fichier `*.feature.ts` du domaine. | — | revue (aucune garde) (convention) | hors théorie | Convention d'organisation des fichiers. |
| I75 | Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. | O2 | revue (aucune garde) (partiel) | hors théorie | Qualité des types ; une règle de lint la rendrait statique. |
| I76 | Les méthodes de `Channel` sont typées par `TDef` — un nom de message est une clé de la voie, jamais une `string` libre. | D16 | construction (livre) | conforme |  |
| I77 | `View.trigger()` n'accepte qu'une clé `"ns:cmd"` validée contre le contrat de la View. | D16, A4.b | statique (livre) | conforme |  |
| I78 | `View.getUI(key)` n'accepte qu'une clé déclarée dans le `TUIContract` de la View. | D16, A3.c | statique (livre) | conforme |  |
| I79 | `Feature.request()` n'accepte qu'un `TChannelToken` typé, jamais un namespace `string` libre. | D16 | statique (livre) | conforme |  |
| I80 | Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` dire… | D16 | statique (partiel) | conforme | Forme du contrat. |
| I81 | Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. | D16 | démarrage (partiel) | conforme |  |
| I82 | `implements TViewCallbacks<TVC>` rend obligatoires les handlers d'Event et les handlers DOM déclarés ; un filet au `mount()` couvre les cont… | D16 | statique + démarrage (livre) | conforme |  |
| I83 | Tous les composants consommateurs composent leur contrat selon le même pattern modulaire (`TFeatureContract`, `TUIContract`, `TUIElements`). | — | revue (aucune garde) (convention) | hors théorie | Convention d'API. |
| I84 | Un élément UI déclaré avec `events` non vide exige ses handlers DOM ; `events` vide déclare un élément non interactif. | D16 | statique + démarrage (livre) | conforme |  |
| I85 | `ui<TEl>()(events)` est le helper officiel pour construire une `TUIEntry`. | — | revue (aucune garde) (convention) | hors théorie | Convention d'API. |
| I86 | Le champ `events` d'une `TUIEntry` est toujours présent, tableau (éventuellement vide) sans doublons. | D16 | statique (livre) | conforme |  |
| I87 | La clé d'un `TFeatureContract` est le namespace de la Feature référencée. | 16.9, D16 | statique (partiel) | conforme |  |
| I88 | Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers requis. | D16 | statique (livre) | conforme |  |
| I89 | Tout événement déclaré dans `events` appartient à `TEventsFor<TEl>` ; les `CustomEvent` arbitraires sont exclus. | D16 | statique (partiel) | hors théorie | L'exclusion des `CustomEvent` n'a pas de règle : décision candidate (faits de l'hôte admissibles). |
| I90 | Un nom d'événement apparaît au plus une fois dans `events`. | D16 | statique (livre) | conforme |  |
| I91 | `TEventsFor<TEl>` est la table officielle entre sous-types d'éléments HTML et événements DOM cohérents. | D16 | statique (partiel) | conforme |  |
| I92 | Toute Feature concrète `implements TFeatureCallbacks<TDef, TListens>` ; un handler absent ou mal signé est une erreur de compilation. | D16 | statique (livre) | conforme |  |
| I93 | `listens` et `queries` sont des `abstract get` d'instance que toute Feature concrète implémente. | D16 | statique (livre) | conforme |  |
| I94 | Le constructeur d'une Feature est inerte — aucun side-effect au-delà de la validation et de l'assignation du namespace. | A5.a | démarrage (livre) | conforme |  |
| I95 | Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. | 16.9 | statique (livre) | conforme |  |
| I96 | Le dispatch des notifications suit un ordre déterministe (clés changées par ordre alphabétique, puis catch-all) via une souscription unique,… | O1 | démarrage (livre) | hors théorie | Ordre interne à une Feature ; sert O1, à la manière de D8. |
| I97 | `Entity.mutate()` utilise `Immer.produceWithPatches`. | — | exécution (livre) | hors théorie | Choix d'implémentation (Immer). |
| I98 | Une mutation déclenchée pendant un cycle de notification est mise en file FIFO plutôt qu'exécutée immédiatement, avec une profondeur de ré-e… | — | exécution (livre) | hors théorie | Ré-entrance interne à une Feature ; entre composants, G5 l'exclut déjà. |
| I99 | Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplac… | A2.d, 6.5, T7 | démarrage (partiel) | conforme |  |
| I100 | Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placem… | règle de méthode §16 | revue (aucune garde) (convention) | conforme | Règle de méthode, sans garde par nature. |
| I101 | Une Entity ne porte aucune logique métier : elle garde l'état, applique les mutations que sa Feature lui fournit et expose des lectures pure… | règle d'imputation (§2.5), 16.2 | revue (aucune garde) (convention) | hors théorie | Organisation interne d'une Feature. |
| I102 | Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son co… | §19 | exécution (partiel) | conforme | C'est la définition du niveau « exécution ». |
| I103 | Les clés de Commands, d'Events et de Requests d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. | — | statique (cible) | hors théorie | Convention de nommage. |
