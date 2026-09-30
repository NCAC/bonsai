<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Feature — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 26 | 18 | 4 | 1 | 3 |

## Écarts

- `C` I17 — Une Feature ne `request` que sur les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. ⟨type · ⚠️ · R⟩
  > `Feature.request()` accepte tout token typé, sans contrôle contre `queries` (même écart que I14).
- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ⚠️ · R⟩
  > Les tests prouvent seulement : Command sans handler → throw, Event sans abonné → ignoré.
  > Aucun mécanisme de refus d'un Command par son handler n'est testé.
- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ⟨type+boot · ⚠️ · T⟩
  > Seule la réservation du namespace `router` est livrée (via I71) ; aucun Router n'existe.
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
  > Tests de type seulement ; aucune configuration ESLint dans le dépôt.
- `D` I54 — Les metas sont créées par le framework et propagées explicitement, jamais construites à la main. ⟨type · ⏳ · ·⟩
  > Mécanisme visé pour « jamais forgées » : un type opaque (brand) que seul le framework peut
  > construire. Aujourd'hui `Entity.mutate()` accepte `metas?: Record<string, unknown>` : forgeable.
  > Arbitré le 30/09 : `metas` est requis partout (`emit`, `request`, `mutate`). Les points
  > d'entrée système (`onInit()`, timers) reçoivent des metas racine `sys-` en paramètre, comme
  > un handler ; aucune émission sans metas n'ouvre implicitement de corrélation — sinon un oubli
  > de propagation couperait la chaîne sans erreur. Écart : l'overload `mutate(intent, recipe)`
  > (strate 1a) n'a pas de metas.

## Invariants par principe

### P1 — Souveraineté du domaine

- `E` I6 — L'Entity n'est accessible qu'à sa Feature propriétaire : aucun autre composant (View, Behavior, autre Feature, Composer, Foundation) ne peut la lire ni la modifier. ⟨type · ✅ · R T⟩
- `D` I22 — La relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte ; l'Entity est obligatoire, même vide. ⟨type+boot · ✅ · R⟩
- `D` I51 — Les notifications de mutation d'une Entity sont auto-découvertes sur sa Feature (`on<Key>EntityUpdated` / `onAnyEntityUpdated`) — résumé de I96. ⟨boot · ✅ · R⟩
- `D` I96 — Le dispatch des notifications suit un ordre déterministe (clés changées par ordre alphabétique, puis catch-all) via une souscription unique, avec isolation des erreurs par handler. ⟨boot · ✅ · R⟩
- `V` I53 — Une clé de handler `on<Key>EntityUpdated` inconnue du state de l'Entity est rejetée au bootstrap. ⟨boot · ✅ · R⟩

### P2 — Dépendances déclarées

- `C` I2 — Une Feature écoute (`listen`) uniquement les Events des Channels externes qu'elle a déclarés. ⟨boot · ✅ · R⟩

### P3 — Sémantique des trois voies

- `E` I10 — Un Command a un seul handler — la Feature propriétaire du Channel. ⟨boot · ✅ · R⟩
- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ⚠️ · R⟩
- `C` I1 — Une Feature n'émet (`emit`) que sur son propre Channel — aucune émission cross-domain, et seule la Feature propriétaire utilise `emit()`. ⟨type · ✅ · R T⟩
- `C` I3 — Une Feature ne répond (`reply`) que sur son propre Channel. ⟨boot · ✅ · R⟩
- `C` I17 — Une Feature ne `request` que sur les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. ⟨type · ⚠️ · R⟩
- `C` I64 — Aucun I/O (`fetch`, `Promise`, `setTimeout`, `async/await`) dans un replier. ⟨revue · 📐 · ·⟩

### P4 — Causalité traçable et bornée

- `D` I54 — Les metas sont créées par le framework et propagées explicitement, jamais construites à la main. ⟨type · ⏳ · ·⟩

### P7 — Cycle de vie hétéronome

- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ⟨type+boot · ⚠️ · T⟩
- `D` I94 — Le constructeur d'une Feature est inerte — aucun side-effect au-delà de la validation et de l'assignation du namespace. ⟨boot · ✅ · R⟩

### P8 — Identité par le manifest

- `C` I68 — Aucune classe Feature ne déclare de `static namespace`. ⟨type · ✅ · R T⟩
- `C` I72 — `TSelfNS` est la clé de la Feature dans le manifest. ⟨type · ✅ · R T⟩
- `V` I95 — Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. ⟨type · ✅ · T⟩

### P9 — Garantie au plus tôt

- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I79 — `Feature.request()` n'accepte qu'un `TChannelToken` typé, jamais un namespace `string` libre. ⟨type · ✅ · R T⟩
- `D` I48 — Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Request`, `on<Channel><Event>Event`, handlers DOM), découvertes et câblées par le framework. ⟨boot · ✅ · R⟩
- `D` I88 — Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers requis. ⟨revue · 📐 · T⟩
- `D` I92 — Toute Feature concrète `implements TFeatureCallbacks<TDef, TListens>` ; un handler absent ou mal signé est une erreur de compilation. ⟨type · ✅ · T⟩
- `D` I73 — Chaque Feature déclare `static readonly channel` — son contrat de communication typé, unique pont entre la classe et son Channel. ⟨type · ✅ · R T⟩
- `D` I74 — La définition du Channel, le type d'état et la classe Feature sont co-localisés dans le fichier `*.feature.ts` du domaine. ⟨revue · 📐 · R⟩
- `D` I93 — `listens` et `queries` sont des `abstract get` d'instance que toute Feature concrète implémente. ⟨type · ✅ · R T⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `D` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
