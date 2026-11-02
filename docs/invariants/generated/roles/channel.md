<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Channel — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 10 | 4 | 3 | 3 | 0 |

## Écarts

- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ⚠️ · ·⟩
  > Les tests prouvent seulement : Command sans handler → throw, Event sans abonné → ignoré.
  > Aucun mécanisme de refus d'un Command par son handler n'est testé.
- `C` I29 — Une Query rend synchroniquement une valeur du type de résultat déclaré, sans Promise ; ni l'absence de répondant ni une erreur technique ne sont converties en null. Une valeur null n'est admise que si le contrat métier la prévoit. ⟨run · ⚠️ · ·⟩
  > V0.9.4, 2026-10-30 : livre → partiel ; appel direct livré, contrat complet non réalisé.
  > Channel.request() retourne encore null sans répondant et après exception ; une Promise est acceptée.
  > Les citations historiques d'I29 testent l'ancien contrat, pas la conformité du présent énoncé.
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
  > Tests de type seulement ; aucune configuration ESLint dans le dépôt.
- `C` I55 — L'erreur technique d'une Query se propage à son auteur et entraîne l'échec de l'unité modifiante ou d'initialisation englobante selon G7 ; aucune réponse de substitution ni capture applicative ne peut transformer cet échec en validation réussie. ⟨run · ⏳ · ·⟩
  > V0.9.4, 2026-10-30 : règle historique inversée ; livre → cible.
  > Channel.request() absorbe encore l'exception ; aucune unité de rollback englobante n'est livrée.
  > Les anciens tests citant I55 prouvent le comportement désormais interdit, pas cette cible.
- `C` I65 — Toute erreur technique de Query est signalée avec son contexte causal, hors réponse et transport applicatif ; ce signalement ne remplace ni n'empêche la propagation et l'échec de l'unité exigés par I55. ⟨run · ⏳ · ·⟩
  > V0.9.4, 2026-10-30 : partiel → cible ; console.error existe, mais il accompagne encore null.
  > Le signalement causal obligatoire n'est pas livré ; sa réalisation ne doit pas intercepter l'échec I55.
- `D` I103 — Les clés de Commands, d'Events et de Requests d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. ⟨type · ⏳ · ·⟩
  > Écart relevé le 30/09 : `CamelCase<S>` ne contraint que les clés du manifest ; une clé
  > `addItem2` ou `add_item` dans un Channel compile aujourd'hui sans erreur. Mécanisme visé :
  > appliquer `CamelCase<K>` aux clés de `TChannelDefinition`. La grammaire des noms
  > (verbNoun, nounVerbed, nominal) reste une convention de style, hors de cette ligne.

## Invariants par principe

### P2 — Dépendances déclarées

- `C` I15 — Radio est une infrastructure interne, non exposée par `@bonsai/core` — un bus ambiant serait un canal non déclaré. ⟨type · ✅ · T⟩

### P3 — Sémantique des trois voies

- `E` I10 — Un Command a un seul handler — la Feature propriétaire du Channel. ⟨boot · ✅ · R⟩
- `E` I11 — Un Event peut avoir N abonnés. ⟨run · ✅ · R⟩
- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ⚠️ · ·⟩
- `C` I29 — Une Query rend synchroniquement une valeur du type de résultat déclaré, sans Promise ; ni l'absence de répondant ni une erreur technique ne sont converties en null. Une valeur null n'est admise que si le contrat métier la prévoit. ⟨run · ⚠️ · ·⟩
- `C` I55 — L'erreur technique d'une Query se propage à son auteur et entraîne l'échec de l'unité modifiante ou d'initialisation englobante selon G7 ; aucune réponse de substitution ni capture applicative ne peut transformer cet échec en validation réussie. ⟨run · ⏳ · ·⟩
- `C` I65 — Toute erreur technique de Query est signalée avec son contexte causal, hors réponse et transport applicatif ; ce signalement ne remplace ni n'empêche la propagation et l'échec de l'unité exigés par I55. ⟨run · ⏳ · ·⟩

### P9 — Garantie au plus tôt

- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I76 — Les méthodes de `Channel` sont typées par `TDef` — un nom de message est une clé de la voie, jamais une `string` libre. ⟨type · ✅ · T⟩
- `D` I103 — Les clés de Commands, d'Events et de Requests d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. ⟨type · ⏳ · ·⟩

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
