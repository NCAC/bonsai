<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# View — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 32 | 9 | 17 | 4 | 2 |

## Écarts

- `C` I4 — Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. ⟨type · ⚠️ · R T⟩
  > Livré pour la View (capabilities.types, I77) ; le Behavior n'existe pas encore (strate 2b).
- `E` I19 — La View ne décide ni de sa création, ni de sa destruction, ni de son remplacement ; son existence appartient exclusivement à son Composer parent, y compris pendant une cascade annulable de destruction. ⟨run · ⚠️ · ·⟩
  > View n'expose que `mount()`, appelé par le Composer ; aucune destruction n'existe encore
  > (une View remplacée n'est pas détruite, cf. I20). Aucun test ne cite I19.
- `C` I20 — Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. Le parent est seul propriétaire de l'existence de ses enfants et leur destruction entraîne celle de leurs descendants. ⟨run · ⚠️ · R⟩
  > Écart à P9 : règle structurelle non garantie avant l'exécution. `View` est exportée avec un
  > constructeur public et un `mount()` public : le code applicatif peut instancier et monter une
  > View lui-même. À remonter au compile-time (création réservée au Composer).
- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ⟨type · ⚠️ · ·⟩
- `D` I31 — Le Composer fournit à la création de la View une désignation de sa part, jamais un élément de l'hôte ; sa résolution contrôlée vérifie la propriété et sa validité pour cette seule attribution, sans réactivation par réattribution du même emplacement. ⟨run · ⚠️ · R⟩
  > Livré : string fournie par Composer ; résolution globale et aucune durée d'attribution vérifiée.
- `C` I34 — L'élément racine d'une View appartient à la part que son Composer lui attribue dans le contenu de son slot ; il ne se confond pas avec l'élément du slot. Aucune contrainte universelle de descendance de `body` ne remplace cette vérification de propriété. ⟨run · ⚠️ · R⟩
  > V0.9.4 : livre → partiel ; le montage via document.querySelector ne prouve pas le confinement.
- `C` I36 — La View déclare les slots dont elle attribue le contenu à ses Composers enfants, jamais des Views enfants ; seuls ces Composers décident quelles Views occupent leurs parts. ⟨run · ⚠️ · R⟩
  > View n'a aucune méthode de composition ; la déclaration des slots (`get composers()`) n'est pas
  > livrée. Seul l'en-tête de view.basic.test.ts cite I36 : aucun test ne le prouve.
- `C` I38 — Les droits de modification de l'interface respectent les parts attribuées et les rôles ; la View projette dans sa part hors contenu des slots, les opérations du Behavior lui sont imputées, la Foundation reste bornée à son élément admis hors parts attribuées, et le Composer ne modifie son contenu que pour la composition définie par I35. ⟨run · ⚠️ · ·⟩
  > V0.9.4, 2026-10-30 : droits corrigés ; état partiel conservé, mode run pour les parts effectives.
  > Livré : primitives de projection View et montage Composer ; pas de contrôle complet des parts.
  > Non livré : exclusion des slots, Foundation configurable/bornée et imputation Behavior.
  > Lot 3 : spécialisations I33/I34/I45 alignées ; contrôles complets toujours non livrés.
- `D` I39 — La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. ⟨type · ⚠️ · R⟩
- `C` I40 — La View conserve son élément racine et les éléments de ses slots, mais le contenu attribué à ses Composers est soustrait à sa part ; toute lecture, écriture ou admission respecte cette exclusion pendant l'attribution. ⟨run · ⚠️ · R⟩
  > Résolution UI locale livrée ; slots enfants et exclusion dynamique absents.
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
  > Tests de type seulement ; aucune configuration ESLint dans le dépôt.
- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ⚠️ · R T⟩
  > Livré pour la View (`TFeatureContract`) ; le Behavior n'existe pas encore (strate 2b).
- `D` I81 — Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. ⟨boot · ⚠️ · R⟩
  > Livré pour la View (`mount()`) ; le Behavior n'existe pas encore (strate 2b).
- `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩
- `D` I89 — Tout événement déclaré dans `events` appartient à `TEventsFor<TEl>` ; les `CustomEvent` arbitraires sont exclus. ⟨type · ⚠️ · T⟩
- `D` I91 — `TEventsFor<TEl>` est la table officielle entre sous-types d'éléments HTML et événements DOM cohérents. ⟨type · ⚠️ · T⟩
- `E` I99 — La Foundation opère dans son élément admis, le Composer dans le contenu du slot attribué et la View dans sa part attribuée ; chacun exclut les portions attribuées à ses enfants. Le Behavior agit dans la part de sa View, sans part autonome. ⟨run · ⚠️ · ·⟩
  > V0.9.4 : A2, §16.4–§16.7 ; l'admission Foundation n'est pas une attribution par un parent DOM.
  > Livré : montage et résolution locaux partiels ; aucun contrôle complet des parts et de leur durée.
- `C` I32 — La View ne détruit ni ne remplace son élément racine ; elle peut en modifier les attributs et dispose de son contenu hors contenu attribué aux Composers. Avant de retirer un élément de slot, elle détruit le Composer concerné pour en obtenir restitution. ⟨run · ⏳ · ·⟩
  > Aucun mécanisme : `protected get el()` expose le nœud brut, la View peut le retirer du DOM.
- `C` I41 — Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. ⟨type · ⏳ · ·⟩
- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩
- `C` I43 — Les noms des clés de la View et de chacun de ses Behaviors sont tous disjoints, y compris entre Behaviors ; des noms distincts peuvent désigner le même élément, sans multiplier l'admission du fait par la View. ⟨boot · ⏳ · ·⟩

## Invariants par principe

### P1 — Souveraineté du domaine

- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ⟨type · ⚠️ · ·⟩

### P2 — Dépendances déclarées

- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ⚠️ · R T⟩

### P3 — Sémantique des trois voies

- `C` I4 — Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. ⟨type · ⚠️ · R T⟩

### P5 — Interface de projection, domaine autonome

- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩
- `D` I57 — Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. ⟨type+boot · ✅ · T⟩

### P6 — Propriété et parts de l'interface

- `E` I99 — La Foundation opère dans son élément admis, le Composer dans le contenu du slot attribué et la View dans sa part attribuée ; chacun exclut les portions attribuées à ses enfants. Le Behavior agit dans la part de sa View, sans part autonome. ⟨run · ⚠️ · ·⟩
- `C` I40 — La View conserve son élément racine et les éléments de ses slots, mais le contenu attribué à ses Composers est soustrait à sa part ; toute lecture, écriture ou admission respecte cette exclusion pendant l'attribution. ⟨run · ⚠️ · R⟩
- `C` I34 — L'élément racine d'une View appartient à la part que son Composer lui attribue dans le contenu de son slot ; il ne se confond pas avec l'élément du slot. Aucune contrainte universelle de descendance de `body` ne remplace cette vérification de propriété. ⟨run · ⚠️ · R⟩
- `D` I31 — Le Composer fournit à la création de la View une désignation de sa part, jamais un élément de l'hôte ; sa résolution contrôlée vérifie la propriété et sa validité pour cette seule attribution, sans réactivation par réattribution du même emplacement. ⟨run · ⚠️ · R⟩
- `C` I41 — Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. ⟨type · ⏳ · ·⟩
- `C` I43 — Les noms des clés de la View et de chacun de ses Behaviors sont tous disjoints, y compris entre Behaviors ; des noms distincts peuvent désigner le même élément, sans multiplier l'admission du fait par la View. ⟨boot · ⏳ · ·⟩
- `C` I38 — Les droits de modification de l'interface respectent les parts attribuées et les rôles ; la View projette dans sa part hors contenu des slots, les opérations du Behavior lui sont imputées, la Foundation reste bornée à son élément admis hors parts attribuées, et le Composer ne modifie son contenu que pour la composition définie par I35. ⟨run · ⚠️ · ·⟩
- `C` I32 — La View ne détruit ni ne remplace son élément racine ; elle peut en modifier les attributs et dispose de son contenu hors contenu attribué aux Composers. Avant de retirer un élément de slot, elle détruit le Composer concerné pour en obtenir restitution. ⟨run · ⏳ · ·⟩
- `D` I39 — La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. ⟨type · ⚠️ · R⟩

### P7 — Cycle de vie hétéronome

- `E` I19 — La View ne décide ni de sa création, ni de sa destruction, ni de son remplacement ; son existence appartient exclusivement à son Composer parent, y compris pendant une cascade annulable de destruction. ⟨run · ⚠️ · ·⟩
- `C` I20 — Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. Le parent est seul propriétaire de l'existence de ses enfants et leur destruction entraîne celle de leurs descendants. ⟨run · ⚠️ · R⟩
- `C` I36 — La View déclare les slots dont elle attribue le contenu à ses Composers enfants, jamais des Views enfants ; seuls ces Composers décident quelles Views occupent leurs parts. ⟨run · ⚠️ · R⟩

### P8 — Identités et déclarations par racine

- `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩

### P9 — Garantie au plus tôt

- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I77 — `View.trigger()` n'accepte qu'une clé `"ns:cmd"` validée contre le contrat de la View. ⟨type · ✅ · T⟩
- `C` I78 — `View.getUI(key)` n'accepte qu'une clé déclarée dans le `TUIContract` de la View. ⟨type · ✅ · T⟩
- `D` I48 — Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Request`, `on<Channel><Event>Event`, handlers DOM), découvertes et câblées par le framework. ⟨boot · ✅ · R⟩
- `D` I88 — Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers requis. ⟨type · ✅ · T⟩
- `D` I82 — `implements TViewCallbacks<TVC>` rend obligatoires les handlers d'Event et les handlers DOM déclarés ; un filet au `mount()` couvre les contournements. ⟨type+boot · ✅ · R⟩
- `C` I84 — Un élément UI déclaré avec `events` non vide exige ses handlers DOM ; `events` vide déclare un élément non interactif. ⟨type+boot · ✅ · R T⟩
- `D` I81 — Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. ⟨boot · ⚠️ · R⟩
- `D` I83 — Tous les composants consommateurs composent leur contrat selon le même pattern modulaire (`TFeatureContract`, `TUIContract`, `TUIElements`). ⟨revue · 📐 · R⟩
- `D` I85 — `ui<TEl>()(events)` est le helper officiel pour construire une `TUIEntry`. ⟨revue · 📐 · R T⟩
- `D` I86 — Le champ `events` d'une `TUIEntry` est toujours présent, tableau (éventuellement vide) sans doublons. ⟨type · ✅ · R T⟩
- `D` I89 — Tout événement déclaré dans `events` appartient à `TEventsFor<TEl>` ; les `CustomEvent` arbitraires sont exclus. ⟨type · ⚠️ · T⟩
- `C` I90 — Un nom d'événement apparaît au plus une fois dans `events`. ⟨type · ✅ · T⟩
- `D` I91 — `TEventsFor<TEl>` est la table officielle entre sous-types d'éléments HTML et événements DOM cohérents. ⟨type · ⚠️ · T⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `C` I25 — Une Command vise un Channel déclaré dans les limites des parties ; une Feature n'en adresse pas à une autre Feature, mais peut en adresser à un adaptateur du domaine. Le domaine n'adresse rien à un adaptateur de l'interface et n'en reçoit rien. Les Commands de l'interface restent soumises à I13 ; le Behavior agit au nom de sa View, et le Composer n'adresse aucune Command. ⟨run · ⚠️ · R T⟩
- `C` I13 — Un composant de l'interface n'adresse une Command que pendant une réaction à un fait admis d'indépendance établie ou une continuation corrélée déjà autorisée à commander, sous réserve des interdictions de son rôle. Event, relais local d'Event, résultat d'effet corrélé à un Event et observation d'antécédent inconnu n'accordent aucune permission. Une Query préalable conserve la permission de son auteur sans l'accorder au traitement consulté, toujours en lecture seule ; sa réponse n'est pas un déclencheur autonome. ⟨run · ⏳ · ·⟩
- `E` I7 — Tout message, Command, Query, Event ou local, porte le contexte de son déclenchement observable ; chaque message hors origine a exactement un parent établi, et chaque origine conserve sa qualification démarrage, spontanée ou observation d'antécédent inconnu. Une réponse de Query n'est pas un message et ne crée aucun contexte propre. ⟨run · ⏳ · ·⟩
- `C` I8 — L'infrastructure de communication établit l'origine de démarrage et qualifie chaque admission selon son protocole déclaré en résultat corrélé, fait indépendant établi ou observation d'antécédent inconnu. Elle conserve les liens connus ; ni le code applicatif ni une sélection D19 ne peuvent inventer un parent, effacer un lien ou transformer l'inconnu en indépendance établie. ⟨run · ⏳ · ·⟩
- `C` I9 — La borne causale fixée par le Manifest, commune à la racine, limite la profondeur des segments de continuations connues ; l'infrastructure la contrôle avant toute soumission de Command, Query, Event ou local, et avant toute réservation des branches d'un Event. Un refus pendant un traitement ou une initialisation fait échouer l'unité extérieure selon G7 ; au préambule d'admission, l'occurrence est abandonnée et signalée techniquement sans traitement ni révocation du passé. Aucun nouveau contrôle D9 n'est reporté à la délivrance d'un message accepté. ⟨run · ⏳ · ·⟩
- `D` I54 — Les métadonnées causales sont établies et dérivées par l'infrastructure de communication ; le code applicatif les reçoit et les propage explicitement sans les fabriquer ni les remplacer. Le contexte des opérations corrélables est conservé jusqu'au résultat, à l'annulation ou à la clôture de l'occurrence de vie, même après un échec ; une Query restitue à son auteur son contexte sans le remplacer. ⟨run · ⏳ · ·⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
