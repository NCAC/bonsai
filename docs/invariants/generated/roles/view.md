<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# View — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 33 | 9 | 17 | 2 | 5 |

## Écarts

- `C` I4 — Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. ⟨type · ⚠️ · R T⟩
  > Livré pour la View (capabilities.types, I77) ; le Behavior n'existe pas encore (strate 2b).
- `E` I19 — La View n'a aucune responsabilité sur son propre cycle de vie — ni création, ni destruction, ni remplacement. ⟨type · ⚠️ · ·⟩
  > View n'expose que `mount()`, appelé par le Composer ; aucune destruction n'existe encore
  > (une View remplacée n'est pas détruite, cf. I20). Aucun test ne cite I19.
- `D` I20 — Seuls la Foundation et les Composers créent, détruisent ou remplacent des Views. ⟨run · ⚠️ · R⟩
  > Écart à P9 : règle structurelle non garantie avant l'exécution. `View` est exportée avec un
  > constructeur public et un `mount()` public : le code applicatif peut instancier et monter une
  > View lui-même. À remonter au compile-time (création réservée au Composer).
- `C` I25 — Seuls les Views et Behaviors utilisent `trigger()` pour envoyer un Command. ⟨type · ⚠️ · R T⟩
  > Feature, Composer et Foundation n'ont pas de `trigger` (capabilities.types) ; la View l'a.
  > Le Behavior n'existe pas encore (strate 2b).
- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ⟨type · ⚠️ · ·⟩
- `D` I31 — Le `rootElement` d'une View est un sélecteur CSS fourni exclusivement par le Composer. ⟨boot · ⚠️ · R⟩
- `D` I36 — La View ne compose jamais d'autres Views — elle déclare des slots, le Composer décide de l'instanciation. ⟨type · ⚠️ · R⟩
  > View n'a aucune méthode de composition ; la déclaration des slots (`get composers()`) n'est pas
  > livrée. Seul l'en-tête de view.basic.test.ts cite I36 : aucun test ne le prouve.
- `D` I38 — Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html>`/`<body>`, Composer aucune écriture. ⟨type · ⚠️ · ·⟩
  > N1 (getUI) et « Composer sans écriture » (I35) livrés ; N2/N3 (templates) non livrés, strate 1c.
- `D` I39 — La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. ⟨type · ⚠️ · R⟩
- `C` I40 — Le scope DOM d'une View est son `rootElement` moins les sous-arbres des slots qu'elle déclare. ⟨boot · ⚠️ · R⟩
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
  > Tests de type seulement ; aucune configuration ESLint dans le dépôt.
- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ⚠️ · R T⟩
  > Livré pour la View (`TFeatureContract`) ; le Behavior n'existe pas encore (strate 2b).
- `D` I81 — Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. ⟨boot · ⚠️ · R⟩
  > Livré pour la View (`mount()`) ; le Behavior n'existe pas encore (strate 2b).
- `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩
- `D` I89 — Tout événement déclaré dans `events` appartient à `TEventsFor<TEl>` ; les `CustomEvent` arbitraires sont exclus. ⟨type · ⚠️ · T⟩
- `D` I91 — `TEventsFor<TEl>` est la table officielle entre sous-types d'éléments HTML et événements DOM cohérents. ⟨type · ⚠️ · T⟩
- `E` I99 — Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplacer. ⟨boot · ⚠️ · ·⟩
  > Livré : Foundation sur `<body>`, rootElement de la View fourni par le Composer (I31).
  > Non livré : exclusion des slots (I40), scope du Composer figé (I58).
- `C` I41 — Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. ⟨type · ⏳ · ·⟩
- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩

## Invariants par principe

### P1 — Souveraineté du domaine

- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ⟨type · ⚠️ · ·⟩

### P2 — Dépendances déclarées

- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ⚠️ · R T⟩

### P3 — Sémantique des trois voies

- `C` I25 — Seuls les Views et Behaviors utilisent `trigger()` pour envoyer un Command. ⟨type · ⚠️ · R T⟩
- `C` I4 — Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. ⟨type · ⚠️ · R T⟩
- `C` I13 — La View est un point d'entrée (Command) et de projection (Event) — la causalité métier n'y transite jamais. ⟨revue · 📐 · ·⟩

### P5 — La couche concrète projette, elle ne décide pas

- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩
- `D` I57 — Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. ⟨type+boot · ✅ · T⟩

### P6 — Propriété exclusive du DOM

- `E` I99 — Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplacer. ⟨boot · ⚠️ · ·⟩
- `C` I40 — Le scope DOM d'une View est son `rootElement` moins les sous-arbres des slots qu'elle déclare. ⟨boot · ⚠️ · R⟩
- `C` I34 — Le `rootElement` d'une View est un descendant strict de `<body>`, jamais `<body>` lui-même. ⟨boot · ✅ · R⟩
- `D` I31 — Le `rootElement` d'une View est un sélecteur CSS fourni exclusivement par le Composer. ⟨boot · ⚠️ · R⟩
- `C` I41 — Chaque clé `@ui` a une source de mutation unique — son template ou `getUI()`, jamais les deux. ⟨type · ⏳ · ·⟩
- `D` I38 — Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html>`/`<body>`, Composer aucune écriture. ⟨type · ⚠️ · ·⟩
- `D` I32 — La View peut altérer son `rootElement` en N1, mais ne le détruit ni ne le remplace jamais. ⟨revue · 📐 · ·⟩
- `D` I39 — La View accède au DOM exclusivement via `getUI(key)` ; aucun `querySelector` ni accès DOM brut ne lui est exposé. ⟨type · ⚠️ · R⟩

### P7 — Cycle de vie hétéronome

- `E` I19 — La View n'a aucune responsabilité sur son propre cycle de vie — ni création, ni destruction, ni remplacement. ⟨type · ⚠️ · ·⟩
- `D` I20 — Seuls la Foundation et les Composers créent, détruisent ou remplacent des Views. ⟨run · ⚠️ · R⟩
- `D` I36 — La View ne compose jamais d'autres Views — elle déclare des slots, le Composer décide de l'instanciation. ⟨type · ⚠️ · R⟩

### P8 — Identité par le manifest

- `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩

### P9 — Garantie au plus tôt

- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I77 — `View.trigger()` n'accepte qu'une clé `"ns:cmd"` validée contre le contrat de la View. ⟨type · ✅ · T⟩
- `C` I78 — `View.getUI(key)` n'accepte qu'une clé déclarée dans le `TUIContract` de la View. ⟨type · ✅ · T⟩
- `D` I48 — Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Request`, `on<Channel><Event>Event`, handlers DOM), découvertes et câblées par le framework. ⟨boot · ✅ · R⟩
- `D` I88 — Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers requis. ⟨revue · 📐 · T⟩
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
- `D` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
