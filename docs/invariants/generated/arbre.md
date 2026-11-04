<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Arbre des invariants

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention · ∅ non qualifié ;
tests : `R` runtime · `T` type · `·` aucun (détection automatique des citations).

## P1 — Souveraineté du domaine

**L'état métier de référence est encapsulé dans l'Entity de sa Feature ; seule cette Feature y accède directement et le modifie. Les valeurs capturées, projections et brouillons de l'interface ne créent aucune autorité métier concurrente.**

- `E` I6 = I5 — L'Entity n'est accessible qu'à sa Feature propriétaire : aucun autre composant (View, Behavior, autre Feature, Composer, Foundation) ne peut la lire ni la modifier. ⟨type · ✅ · R T⟩
- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ↔ P5 ⟨type · ⚠️ · ·⟩
- `D` I22 — La relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte ; l'Entity est obligatoire, même vide. ↔ P8 ↔ P10 ⟨type+boot · ✅ · R⟩
- `D` I46 — `TStructure` (state d'une Entity) est contraint à `TJsonSerializable`. ⟨type · ✅ · R T⟩
- `D` I97 — `ctx.mutate()` utilise `Immer.produceWithPatches`. ⟨run · ✅ · R⟩
- `D` I51 — Les notifications de mutation d'une Entity sont auto-découvertes sur sa Feature (`on<Key>EntityUpdated` / `onAnyEntityUpdated`) — résumé de I96. ⟨boot · ✅ · R⟩
  - `D` I96 — Le dispatch des notifications suit un ordre déterministe (clés changées par ordre alphabétique, puis catch-all) via une souscription unique, avec isolation des erreurs par handler. ⟨boot · ✅ · R⟩
    - `V` I53 — Une clé de handler `on<Key>EntityUpdated` inconnue du state de l'Entity est rejetée au bootstrap. ⟨boot · ✅ · R⟩
  - `D` I98 — Une mutation effective notifie sa Feature par un message local différé, délivré après la validation de l'unité, dans sa propre unité ; une mutation faite pendant une notification produit la sienne, et la chaîne est bornée par la borne causale (D9). ↔ P4 ↔ I102 ⟨run · ✅ · R⟩

*Rattachés en second parent :* I101, I63, I52

## P2 — Dépendances déclarées

**Les contrats connus avant le démarrage déclarent les Channels et messages accessibles, leurs modes, les faits admis, les résultats et bilans d'effets propres, leurs traitements locaux, les dépendances initiales et les protocoles de source. Aucune interaction ni aucun traitement applicatif implicite ne contourne ces déclarations.**

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
  - `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `C` I2 — Une Feature écoute (`listen`) uniquement les Events des Channels externes qu'elle a déclarés. ⟨boot · ✅ · R⟩
- `C` I15 = I50 — La racine du noyau (`Root`) est une infrastructure interne, non exposée par `@bonsai/core` — un bus ambiant serait un canal non déclaré. ⟨type · ✅ · R T⟩
- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ⚠️ · T⟩
- `V` I70 — Toute référence à un namespace externe (`listens`, `queries`, `dependsOn`) est validée contre le manifest au bootstrap. ↔ P8 ⟨boot · ✅ · R⟩

*Rattachés en second parent :* I4, I17, I77, I79, I89

## P3 — Sémantique des trois voies

**Une Command demande une action sans réponse à un seul propriétaire, qui peut la refuser ; un Event émis par le propriétaire sur sa ressource est diffusé à ses abonnés ; une Query demande une connaissance synchrone en lecture seule transitive. Les trois modes sont exclusifs ; un message local reste interne à son auteur.**

- `E` I10 — Un Command a un seul handler — la Feature propriétaire du Channel. ⟨boot · ✅ · R⟩
- `E` I11 — Un Event peut avoir N abonnés. ⟨run · ✅ · R⟩
- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ✅ · R⟩
- `C` I1 = I12 = I26 — Une Feature n'émet (`emit`) que sur son propre Channel — aucune émission cross-domain, et seule la Feature propriétaire utilise `emit()`. ⟨type · ✅ · R T⟩
- `C` I25 — Une Command vise un Channel déclaré dans les limites des parties ; une Feature n'en adresse pas à une autre Feature, mais peut en adresser à un adaptateur du domaine. Le domaine n'adresse rien à un adaptateur de l'interface et n'en reçoit rien. Les Commands de l'interface restent soumises à I13 ; le Behavior agit au nom de sa View, et le Composer n'adresse aucune Command. ↔ P5 ⟨run · ⚠️ · R T⟩
- `C` I4 — Une View ou un Behavior commande (`ctx.trigger`), écoute et interroge (`ctx.query`) uniquement les Features déclarées dans son contrat — jamais il n'émet. ↔ P2 ⟨type · ⚠️ · R T⟩
- `C` I13 — Un composant de l'interface n'adresse une Command que pendant une réaction à un fait admis d'indépendance établie ou une continuation corrélée déjà autorisée à commander, sous réserve des interdictions de son rôle. Event, relais local d'Event, résultat d'effet corrélé à un Event et observation d'antécédent inconnu n'accordent aucune permission. Une Query préalable conserve la permission de son auteur sans l'accorder au traitement consulté, toujours en lecture seule ; sa réponse n'est pas un déclencheur autonome. ↔ P5 ⟨run · ✅ · R⟩
- `C` I3 — Une Feature ne répond à une Query que sur son propre Channel. ⟨boot · ✅ · R⟩
- `C` I17 — Une Feature n'interroge (`ctx.query`) que les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. ↔ P2 ⟨type · ⚠️ · R⟩
- `C` I29 — Une Query rend synchroniquement une valeur du type de résultat déclaré, sans Promise ; ni l'absence de répondant ni une erreur technique ne sont converties en null. Une valeur null n'est admise que si le contrat métier la prévoit. ⟨run · ✅ · R⟩
  - `C` I64 — Aucun I/O (`fetch`, `Promise`, `setTimeout`, `async/await`) dans un handler de Query. ⟨revue · 📐 · ·⟩
  - `C` I55 — L'erreur technique d'une Query se propage à son auteur et entraîne l'échec de l'unité modifiante ou d'initialisation englobante selon G7 ; aucune réponse de substitution ni capture applicative ne peut transformer cet échec en validation réussie. ⟨run · ✅ · R⟩
    - `C` I65 — Toute erreur technique de Query est signalée avec son contexte causal, hors réponse et transport applicatif ; ce signalement ne remplace ni n'empêche la propagation et l'échec de l'unité exigés par I55. ↔ I102 ⟨run · ✅ · R⟩

*Rattachés en second parent :* I76

## P4 — Causalité observable et segments bornés

**L'infrastructure conserve les déclenchements observables et distingue continuation corrélée, indépendance établie et observation d'antécédent inconnu, sans parent inventé ni lien connu effacé. La borne causale porte sur les segments connus ; elle ne garantit ni terminaison ni absence de boucle à travers une coupure d'observation.**

- `E` I7 — Tout message, Command, Query, Event ou local, porte le contexte de son déclenchement observable ; chaque message hors origine a exactement un parent établi, et chaque origine conserve sa qualification démarrage, spontanée ou observation d'antécédent inconnu. Une réponse de Query n'est pas un message et ne crée aucun contexte propre. ⟨run · ✅ · R⟩
- `C` I8 — L'infrastructure de communication établit l'origine de démarrage et qualifie chaque admission selon son protocole déclaré en résultat corrélé, fait indépendant établi ou observation d'antécédent inconnu. Elle conserve les liens connus ; ni le code applicatif ni une sélection D19 ne peuvent inventer un parent, effacer un lien ou transformer l'inconnu en indépendance établie. ↔ I102 ⟨run · ✅ · R⟩
- `C` I9 — La borne causale fixée par le Manifest, commune à la racine, limite la profondeur des segments de continuations connues ; l'infrastructure la contrôle avant toute soumission de Command, Query, Event ou local, et avant toute réservation des branches d'un Event. Un refus pendant un traitement ou une initialisation fait échouer l'unité extérieure selon G7 ; au préambule d'admission, l'occurrence est abandonnée et signalée techniquement sans traitement ni révocation du passé. Aucun nouveau contrôle D9 n'est reporté à la délivrance d'un message accepté. ↔ I102 ⟨run · ✅ · R⟩
- `D` I54 — Les métadonnées causales sont établies et dérivées par l'infrastructure de communication ; le code applicatif les reçoit et les propage explicitement sans les fabriquer ni les remplacer. Le contexte des opérations corrélables est conservé jusqu'au résultat, à l'annulation ou à la clôture de l'occurrence de vie, même après un échec ; une Query restitue à son auteur son contexte sans le remplacer. ⟨run · ✅ · R⟩

*Rattachés en second parent :* I98

## P5 — Interface de projection, domaine autonome

**L'interface utilisateur projette le domaine sans décider ni valider son état métier. Ses décisions restent de présentation ou de composition, et son état local ne crée aucune autorité métier. Une Command exige un déclencheur autorisé par D18 ; ni Event, ni relais ou résultat d'effet corrélé à un Event, ni observation d'antécédent inconnu ne l'autorise. Une Query préalable conserve la permission de son auteur sans l'accorder au traitement consulté ; Composer n'adresse aucune Command.**

- `C` I56 — La couche abstraite (Features, Entities) est active avant la couche concrète (Views). ⟨boot · ✅ · R⟩
- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩
  - `D` I57 — Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. ↔ P8 ⟨type+boot · ✅ · T⟩

*Rattachés en second parent :* I30, I25, I13

## P6 — Propriété et parts de l'interface

**Chaque ressource du modèle a un propriétaire unique et immuable, seul à exécuter ses opérations exclusives. Dans l'interface, les attributions de parts disjointes soustraient les portions attribuées à l'accès du contenant ; leur restitution n'est pas un transfert. Cette propriété ne se confond pas avec celle du support DOM extérieur ; les effets sur ce support restent bornés par les ressources et désignations autorisées.**

- `E` I99 — La Foundation opère dans son élément admis, le Composer dans le contenu du slot attribué et la View dans sa part attribuée ; chacun exclut les portions attribuées à ses enfants. Le Behavior agit dans la part de sa View, sans part autonome. ↔ P7 ⟨run · ⚠️ · ·⟩
  - `C` I40 — La View conserve son élément racine et les éléments de ses slots, mais le contenu attribué à ses Composers est soustrait à sa part ; toute lecture, écriture ou admission respecte cette exclusion pendant l'attribution. ⟨run · ⚠️ · ·⟩
  - `C` I34 — L'élément racine d'une View appartient à la part que son Composer lui attribue dans le contenu de son slot ; il ne se confond pas avec l'élément du slot. Aucune contrainte universelle de descendance de `body` ne remplace cette vérification de propriété. ⟨run · ✅ · R⟩
  - `D` I31 — Le Composer fournit à la création de la View une désignation de sa part, jamais un élément de l'hôte ; sa résolution contrôlée vérifie la propriété et sa validité pour cette seule attribution, sans réactivation par réattribution du même emplacement. ⟨run · ✅ · R⟩
  - `C` I58 — Le Composer reçoit à sa création la désignation du contenu attribué pour son occurrence de vie ; il ne transfère ni ne déplace cette attribution. Son parent le détruit avant de retirer l'élément du slot ; une réutilisation du même emplacement ne réactive ni l'ancien Composer ni sa désignation. ↔ I20 ⟨run · ✅ · R⟩
- `C` I41 — Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. ⟨run · ✅ · R⟩
- `C` I43 — Les noms des clés de la View et de chacun de ses Behaviors sont tous disjoints, y compris entre Behaviors ; des noms distincts peuvent désigner le même élément, sans multiplier l'admission du fait par la View. ⟨boot · ⏳ · ·⟩
- `C` I44 — Le code d'un Behavior ne désigne ni la View qui le déclare ni les clés de celle-ci ; ses accès déclarés et ses messages sont imputés à cette View, jamais à un composant autonome. ↔ P10 ⟨type · ⏳ · ·⟩
- `C` I38 = I18 — Les droits de modification de l'interface respectent les parts attribuées et les rôles ; la View projette dans sa part hors contenu des slots, les opérations du Behavior lui sont imputées, la Foundation reste bornée à son élément admis hors parts attribuées, et le Composer ne modifie son contenu que pour la composition définie par I35. ⟨run · ⚠️ · ·⟩
  - `C` I35 — Le Composer ne modifie le contenu de son slot que pour attribuer ou restituer les parts de ses Views, créer ou retirer les éléments correspondants ; il ne réalise aucun rendu supplémentaire, ne tient aucun état local indépendant et n'adresse aucune Command. Il admet les seuls résultats instrumentés de ses propres effets de composition, déclarés avec leurs traitements locaux, jamais une notification générale de l'hôte. ↔ P10 ⟨run · ✅ · R⟩
  - `C` I33 — Unique par racine, la Foundation admet l'élément configuré par le Manifest, `body` par défaut, et reste bornée à cet élément hors contenu attribué aux Composers. Elle n'admet ni l'en-tête ni les sources de niveau document, réservés à l'adaptateur correspondant ; ses résultats instrumentés propres restent régis par C.3. ⟨run · ✅ · R⟩
  - `C` I32 — La View ne détruit ni ne remplace son élément racine ; elle peut en modifier les attributs et dispose de son contenu hors contenu attribué aux Composers. Avant de retirer un élément de slot, elle détruit le Composer concerné pour en obtenir restitution. ⟨run · ⚠️ · ·⟩
  - `D` I39 — La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. ⟨type · ✅ · R T⟩
  - `C` I45 — Un Behavior n'a ni existence, ni identité, ni part propres ; ses opérations et son état local appartiennent à sa View et restent hors contenu des slots de celle-ci. Il ne dispose ni d'une racine autonome ni d'une capacité de créer des Composers. ↔ P10 ⟨run · ⏳ · ·⟩

*Rattachés en second parent :* I78

## P7 — Cycle de vie hétéronome

**Chaque composant a une existence unique ; hors racine, son parent est propriétaire de cette existence et décide de sa création ou de sa destruction. La structure est finie et enracinée ; la fin du parent entraîne celle de ses descendants et de leurs ressources, avec restitutions de bas en haut. L'existence et la fin de la racine sont extérieures au modèle ; la vie logique ne se confond pas avec la matérialisation DOM.**

- `E` I19 — La View ne décide ni de sa création, ni de sa destruction, ni de son remplacement ; son existence appartient exclusivement à son Composer parent, y compris pendant une cascade annulable de destruction. ⟨run · ✅ · R⟩
- `C` I20 — Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. Le parent est seul propriétaire de l'existence de ses enfants et leur destruction entraîne celle de leurs descendants. ⟨run · ✅ · R⟩
  - `C` I36 — La View déclare les slots dont elle attribue le contenu à ses Composers enfants, jamais des Views enfants ; seuls ces Composers décident quelles Views occupent leurs parts. ↔ P10 ⟨run · ✅ · R⟩
  - `D` I37 — Un seul type d'API Composer exprime la composition de 0..N Views hétérogènes dans le contenu qui lui est attribué, sans recouvrement des parts ; cette multiplicité n'autorise ni transfert de part ni lecture des portions attribuées. ⟨type · ✅ · R T⟩
- `D` I67 — La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. ↔ P10 ⟨type+boot · ✅ · R⟩
- `D` I23 — Application est dormante au runtime — aucune logique métier ni rôle actif entre le bootstrap et le shutdown. ↔ P10 ⟨type · ✅ · R T⟩
- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ↔ P8 ⟨type+boot · ✅ · T⟩
- `D` I94 — Le constructeur d'une Feature est inerte — aucun side-effect au-delà de la validation et de l'assignation du namespace. ↔ P9 ⟨boot · ✅ · R T⟩

*Rattachés en second parent :* I99

## P8 — Identités et déclarations par racine

**Chaque racine a son Manifest, immuable pendant sa vie ; elle attribue les identités déclarées aux Features et adaptateurs. Le namespace en est une représentation textuelle, non l'identité elle-même. Le Manifest et ses contrats assemblés fixent les enfants, adaptateurs et périmètres, l'élément Foundation, les dépendances initiales, les protocoles de source et la borne causale ; aucun message ne traverse les racines.**

- `E` I69 — Le manifest est l'unique source de vérité de l'identité d'une Feature. ⟨type · ✅ · R T⟩
  - `C` I68 — Aucune classe Feature ne déclare de `static namespace`. ⟨type · ✅ · R T⟩
  - `C` I72 — `TSelfNS` est la clé de la Feature dans le manifest. ⟨type · ✅ · R T⟩
  - `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · T⟩
  - `V` I95 — Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. ⟨type · ✅ · T⟩
- `D` I21 = I24 — Toute Feature est enregistrée dans le manifest sous une clé `camelCase` sans chiffre. ⟨type+boot · ✅ · R T⟩
- `D` I71 — Les namespaces `local` et `router` sont réservés (`RESERVED_NAMESPACES`). ⟨type+boot · ✅ · R T⟩

*Rattachés en second parent :* I22, I70, I57, I28

## P9 — Garantie au plus tôt *(méta-principe)*

**Chaque obligation contrôlable reçoit une garde au niveau le plus précoce possible, à la compilation, au démarrage ou à l'exécution selon les données disponibles ; chaque obligation sémantique non vérifiable reçoit une justification explicite et une revue. La frontière de confiance comprend tous les points d'admission. Les tests de conformité de l'infrastructure ne remplacent ni les gardes applicatives ni une preuve générale.**

- `E` I66 — Le bootstrap est la frontière de confiance — après `app.start()` les garanties sont vérifiées, avant, aucun `trigger`/`emit`/`request` n'est accepté. ⟨boot · ✅ · R⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ✅ · R⟩
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I76 — Les méthodes de `Channel` sont typées par `TDef` — un nom de message est une clé de la voie, jamais une `string` libre. ↔ P3 ⟨type · ✅ · T⟩
  - `D` I103 — Les clés de Commands, d'Events et de Queries d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. ↔ I21 ⟨type · ⏳ · ·⟩
- `C` I77 — `View.trigger()` n'accepte qu'une clé `"ns:cmd"` validée contre le contrat de la View. ↔ P2 ⟨type · ✅ · T⟩
- `C` I78 — `View.getUI(key)` n'accepte qu'une clé déclarée dans le `TUIContract` de la View. ↔ P6 ⟨type · ✅ · T⟩
- `C` I79 — Le `ctx.query` d'une Feature n'accepte qu'un `TChannelToken` typé, jamais un namespace `string` libre. ↔ P2 ⟨type · ✅ · T⟩
- `D` I48 — Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Query`, `on<Channel><Event>Event`, handlers DOM), découvertes et câblées par le framework. ⟨boot · ✅ · R⟩
  - `D` I88 — Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers requis. ⟨type · ✅ · T⟩
    - `D` I92 — Toute Feature concrète `implements TFeatureCallbacks<TDef, TListens>` ; un handler absent ou mal signé est une erreur de compilation. ⟨type · ✅ · T⟩
    - `D` I82 — `implements TViewCallbacks<TVC>` rend obligatoires les handlers d'Event et les handlers DOM déclarés, sauf pour un Event référencé par le `on` d'un binding de template, dont le handler est facultatif ; un filet, quand la View est décrite au noyau, couvre les contournements. ⟨type+boot · ✅ · R T⟩
      - `C` I84 — Un élément UI déclaré avec `events` non vide exige ses handlers DOM ; `events` vide déclare un élément non interactif. ⟨type+boot · ✅ · R T⟩
- `D` I73 = I47 — Chaque Feature déclare `static readonly channel` — son contrat de communication typé, unique pont entre la classe et son Channel. ⟨type · ✅ · R T⟩
- `D` I74 = I49 — La définition du Channel, le type d'état et la classe Feature sont co-localisés dans le fichier `*.feature.ts` du domaine. ⟨revue · 📐 · R⟩
- `D` I93 — `listens` et `queries` sont des `abstract get` d'instance que toute Feature concrète implémente. ⟨type · ✅ · T⟩
- `D` I81 — Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, quand il est décrit au noyau à sa création. ⟨boot · ✅ · R⟩
- `D` I83 — Tous les composants consommateurs composent leur contrat selon le même pattern modulaire (`TFeatureContract`, `TUIContract`, `TUIElements`). ⟨revue · 📐 · R⟩
- `D` I85 — `ui<TEl>()(events)` est le helper officiel pour construire une `TUIEntry`. ⟨revue · 📐 · R T⟩
  - `D` I86 — Le champ `events` d'une `TUIEntry` est toujours présent, tableau (éventuellement vide) sans doublons. ⟨type · ✅ · R T⟩
  - `D` I89 — Tout événement déclaré dans `events` appartient à `TEventsFor<TEl>` ; les `CustomEvent` arbitraires sont exclus. ↔ P2 ⟨type · ⚠️ · T⟩
  - `C` I90 — Un nom d'événement apparaît au plus une fois dans `events`. ⟨type · ✅ · T⟩
  - `D` I91 — `TEventsFor<TEl>` est la table officielle entre sous-types d'éléments HTML et événements DOM cohérents. ⟨type · ⚠️ · T⟩

*Rattachés en second parent :* I94

## P10 — Une responsabilité, un rôle *(méta-principe)*

**Chaque rôle porte une seule fonction architecturale ; deux rôles ne portent pas la même. Entity et Behavior ne sont pas des composants ; leurs opérations sont imputées respectivement à leur Feature et à leur View. La répartition des rôles respecte les frontières de la théorie et n'ajoute aucune autorité absente de celle-ci.**

- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
  - `C` I101 — Une Entity ne porte aucune logique métier : elle garde l'état, applique les mutations que sa Feature lui fournit et expose des lectures pures ; toute décision (validation métier, transformation, refus d'une intention) appartient à la Feature. ↔ P1 ⟨revue · 📐 · ·⟩
    - `C` I63 — Un schema Entity ne contient ni `v.transform()` ni coercion — c'est un garde-fou en lecture, la transformation reste dans le command handler. ↔ P1 ⟨revue · ⏳ · ·⟩
    - `D` I52 — L'Entity expose des méthodes query pures (lecture seule). ↔ P1 ⟨revue · 📐 · ·⟩

*Rattachés en second parent :* I22, I44, I35, I45, I36, I67, I23
