<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Application — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 11 | 11 | 0 | 0 | 0 |

## Écarts

*Aucun écart.*

## Invariants par principe

### P2 — Dépendances déclarées

- `V` I70 — Toute référence à un namespace externe (`listens`, `queries`, `dependsOn`) est validée contre le manifest au bootstrap. ⟨boot · ✅ · R⟩

### P5 — Interface de projection, domaine autonome

- `C` I56 — La couche abstraite (Features, Entities) est active avant la couche concrète (Views). ⟨boot · ✅ · R⟩
- `D` I57 — Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. ⟨type+boot · ✅ · T⟩

### P7 — Cycle de vie hétéronome

- `D` I23 — Application est dormante au runtime — aucune logique métier ni rôle actif entre le bootstrap et le shutdown. ⟨type · ✅ · R T⟩
- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ⟨type+boot · ✅ · T⟩

### P8 — Identités et déclarations par racine

- `E` I69 — Le manifest est l'unique source de vérité de l'identité d'une Feature. ⟨type · ✅ · R T⟩
- `C` I72 — `TSelfNS` est la clé de la Feature dans le manifest. ⟨type · ✅ · R T⟩
- `D` I21 — Toute Feature est enregistrée dans le manifest sous une clé `camelCase` sans chiffre. ⟨type+boot · ✅ · R T⟩
- `D` I71 — Les namespaces `local` et `router` sont réservés (`RESERVED_NAMESPACES`). ⟨type+boot · ✅ · R T⟩
- `V` I95 — Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. ⟨type · ✅ · T⟩

### P9 — Garantie au plus tôt

- `E` I66 — Le bootstrap est la frontière de confiance — après `app.start()` les garanties sont vérifiées, avant, aucun `trigger`/`emit`/`request` n'est accepté. ⟨boot · ✅ · R⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `C` I25 — Une Command vise un Channel déclaré dans les limites des parties ; une Feature n'en adresse pas à une autre Feature, mais peut en adresser à un adaptateur du domaine. Le domaine n'adresse rien à un adaptateur de l'interface et n'en reçoit rien. Les Commands de l'interface restent soumises à I13 ; le Behavior agit au nom de sa View, et le Composer n'adresse aucune Command. ⟨run · ⚠️ · R T⟩
- `C` I13 — Un composant de l'interface n'adresse une Command que pendant une réaction à un fait admis d'indépendance établie ou une continuation corrélée déjà autorisée à commander, sous réserve des interdictions de son rôle. Event, relais local d'Event, résultat d'effet corrélé à un Event et observation d'antécédent inconnu n'accordent aucune permission. Une Query préalable conserve la permission de son auteur sans l'accorder au traitement consulté, toujours en lecture seule ; sa réponse n'est pas un déclencheur autonome. ⟨run · ✅ · R⟩
- `E` I7 — Tout message, Command, Query, Event ou local, porte le contexte de son déclenchement observable ; chaque message hors origine a exactement un parent établi, et chaque origine conserve sa qualification démarrage, spontanée ou observation d'antécédent inconnu. Une réponse de Query n'est pas un message et ne crée aucun contexte propre. ⟨run · ✅ · R⟩
- `C` I8 — L'infrastructure de communication établit l'origine de démarrage et qualifie chaque admission selon son protocole déclaré en résultat corrélé, fait indépendant établi ou observation d'antécédent inconnu. Elle conserve les liens connus ; ni le code applicatif ni une sélection D19 ne peuvent inventer un parent, effacer un lien ou transformer l'inconnu en indépendance établie. ⟨run · ✅ · R⟩
- `C` I9 — La borne causale fixée par le Manifest, commune à la racine, limite la profondeur des segments de continuations connues ; l'infrastructure la contrôle avant toute soumission de Command, Query, Event ou local, et avant toute réservation des branches d'un Event. Un refus pendant un traitement ou une initialisation fait échouer l'unité extérieure selon G7 ; au préambule d'admission, l'occurrence est abandonnée et signalée techniquement sans traitement ni révocation du passé. Aucun nouveau contrôle D9 n'est reporté à la délivrance d'un message accepté. ⟨run · ✅ · R⟩
- `D` I54 — Les métadonnées causales sont établies et dérivées par l'infrastructure de communication ; le code applicatif les reçoit et les propage explicitement sans les fabriquer ni les remplacer. Le contexte des opérations corrélables est conservé jusqu'au résultat, à l'annulation ou à la clôture de l'occurrence de vie, même après un échec ; une Query restitue à son auteur son contexte sans le remplacer. ⟨run · ⚠️ · ·⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
