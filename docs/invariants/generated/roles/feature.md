<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Feature — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 25 | 21 | 2 | 0 | 2 |

## Écarts

- `C` I17 — Une Feature n'interroge (`ctx.query`) que les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. ⟨type · ⚠️ · R⟩
  > Lecture seule livrée (READ_ONLY, A3.g) ; `ctx.query` accepte tout jeton typé, sans contrôle contre `queries` (même écart que I14).
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
  > Tests de type seulement ; aucune configuration ESLint dans le dépôt.

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
- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ✅ · R⟩
- `C` I1 — Une Feature n'émet (`emit`) que sur son propre Channel — aucune émission cross-domain, et seule la Feature propriétaire utilise `emit()`. ⟨type · ✅ · R T⟩
- `C` I3 — Une Feature ne répond à une Query que sur son propre Channel. ⟨boot · ✅ · R⟩
- `C` I17 — Une Feature n'interroge (`ctx.query`) que les Channels déclarés en `queries`, en lecture seule — sans mutation ni side-effect. ⟨type · ⚠️ · R⟩
- `C` I64 — Aucun I/O (`fetch`, `Promise`, `setTimeout`, `async/await`) dans un handler de Query. ⟨revue · 📐 · ·⟩

### P7 — Cycle de vie hétéronome

- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ⟨type+boot · ✅ · T⟩
- `D` I94 — Le constructeur d'une Feature est inerte — aucun side-effect au-delà de la validation et de l'assignation du namespace. ⟨boot · ✅ · R T⟩

### P8 — Identités et déclarations par racine

- `C` I68 — Aucune classe Feature ne déclare de `static namespace`. ⟨type · ✅ · R T⟩
- `C` I72 — `TSelfNS` est la clé de la Feature dans le manifest. ⟨type · ✅ · R T⟩
- `V` I95 — Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. ⟨type · ✅ · T⟩

### P9 — Garantie au plus tôt

- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I79 — Le `ctx.query` d'une Feature n'accepte qu'un `TChannelToken` typé, jamais un namespace `string` libre. ⟨type · ✅ · T⟩
- `D` I48 — Les handlers sont des méthodes nommées par convention (`on<Name>Command`, `on<Name>Query`, `on<Channel><Event>Event`, handlers DOM), découvertes et câblées par le framework. ⟨boot · ✅ · R⟩
- `D` I88 — Tout package qui expose un `T{Component}Contract` expose aussi le `T{Component}Callbacks` qui en dérive les handlers requis. ⟨type · ✅ · T⟩
- `D` I92 — Toute Feature concrète `implements TFeatureCallbacks<TDef, TListens>` ; un handler absent ou mal signé est une erreur de compilation. ⟨type · ✅ · T⟩
- `D` I73 — Chaque Feature déclare `static readonly channel` — son contrat de communication typé, unique pont entre la classe et son Channel. ⟨type · ✅ · R T⟩
- `D` I74 — La définition du Channel, le type d'état et la classe Feature sont co-localisés dans le fichier `*.feature.ts` du domaine. ⟨revue · 📐 · R⟩
- `D` I93 — `listens` et `queries` sont des `abstract get` d'instance que toute Feature concrète implémente. ⟨type · ✅ · T⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `C` I25 — Une Command vise un Channel déclaré dans les limites des parties ; une Feature n'en adresse pas à une autre Feature, mais peut en adresser à un adaptateur du domaine. Le domaine n'adresse rien à un adaptateur de l'interface et n'en reçoit rien. Les Commands de l'interface restent soumises à I13 ; le Behavior agit au nom de sa View, et le Composer n'adresse aucune Command. ⟨run · ⚠️ · R T⟩
- `C` I13 — Un composant de l'interface n'adresse une Command que pendant une réaction à un fait admis d'indépendance établie ou une continuation corrélée déjà autorisée à commander, sous réserve des interdictions de son rôle. Event, relais local d'Event, résultat d'effet corrélé à un Event et observation d'antécédent inconnu n'accordent aucune permission. Une Query préalable conserve la permission de son auteur sans l'accorder au traitement consulté, toujours en lecture seule ; sa réponse n'est pas un déclencheur autonome. ⟨run · ✅ · R⟩
- `E` I7 — Tout message, Command, Query, Event ou local, porte le contexte de son déclenchement observable ; chaque message hors origine a exactement un parent établi, et chaque origine conserve sa qualification démarrage, spontanée ou observation d'antécédent inconnu. Une réponse de Query n'est pas un message et ne crée aucun contexte propre. ⟨run · ✅ · R⟩
- `C` I8 — L'infrastructure de communication établit l'origine de démarrage et qualifie chaque admission selon son protocole déclaré en résultat corrélé, fait indépendant établi ou observation d'antécédent inconnu. Elle conserve les liens connus ; ni le code applicatif ni une sélection D19 ne peuvent inventer un parent, effacer un lien ou transformer l'inconnu en indépendance établie. ⟨run · ✅ · R⟩
- `C` I9 — La borne causale fixée par le Manifest, commune à la racine, limite la profondeur des segments de continuations connues ; l'infrastructure la contrôle avant toute soumission de Command, Query, Event ou local, et avant toute réservation des branches d'un Event. Un refus pendant un traitement ou une initialisation fait échouer l'unité extérieure selon G7 ; au préambule d'admission, l'occurrence est abandonnée et signalée techniquement sans traitement ni révocation du passé. Aucun nouveau contrôle D9 n'est reporté à la délivrance d'un message accepté. ⟨run · ✅ · R⟩
- `D` I54 — Les métadonnées causales sont établies et dérivées par l'infrastructure de communication ; le code applicatif les reçoit et les propage explicitement sans les fabriquer ni les remplacer. Le contexte des opérations corrélables est conservé jusqu'au résultat, à l'annulation ou à la clôture de l'occurrence de vie, même après un échec ; une Query restitue à son auteur son contexte sans le remplacer. ⟨run · ✅ · R⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
