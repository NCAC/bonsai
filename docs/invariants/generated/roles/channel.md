<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Channel — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 14 | 6 | 3 | 5 | 0 |

## Écarts

- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ⚠️ · R⟩
  > Les tests prouvent seulement : Command sans handler → throw, Event sans abonné → ignoré.
  > Aucun mécanisme de refus d'un Command par son handler n'est testé.
- `D` I65 — L'erreur d'un replier est reportée via l'`ErrorReporter` avant que `null` ne soit retourné. ⟨run · ⚠️ · ·⟩
- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
  > Tests de type seulement ; aucune configuration ESLint dans le dépôt.
- `E` I7 — Tout message (Command, Event, Request) porte des métadonnées causales complètes (correlationId, causationId, hop, origin, timestamp). ⟨boot · ⏳ · ·⟩
- `C` I8 — Le `correlationId` est créé par l'UI et n'est jamais modifié ensuite. ⟨run · ⏳ · ·⟩
- `D` I9 — Le `hop` est incrémenté à chaque réaction ; un message au-delà de `MAX_HOPS` est rejeté. ⟨run · ⏳ · ·⟩
  > Borne la profondeur d'une chaîne, pas sa largeur : un fan-out massif à hop constant passe.
  > Complémentaire de I98 (ré-entrance synchrone dans une même Entity) : I9 couvre les chaînes
  > inter-Features, y compris async.
  > Ouvert : valeur et point d'injection de `MAX_HOPS` non tranchés (metas.md §6).
- `D` I54 — Les metas sont créées par le framework et propagées explicitement, jamais construites à la main. ⟨type · ⏳ · ·⟩
  > Mécanisme visé pour « jamais forgées » : un type opaque (brand) que seul le framework peut
  > construire. Aujourd'hui `Entity.mutate()` accepte `metas?: Record<string, unknown>` : forgeable.
  > Arbitré le 30/09 : `metas` est requis partout (`emit`, `request`, `mutate`). Les points
  > d'entrée système (`onInit()`, timers) reçoivent des metas racine `sys-` en paramètre, comme
  > un handler ; aucune émission sans metas n'ouvre implicitement de corrélation — sinon un oubli
  > de propagation couperait la chaîne sans erreur. Écart : l'overload `mutate(intent, recipe)`
  > (strate 1a) n'a pas de metas.
- `D` I103 — Les clés de Commands, d'Events et de Requests d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. ⟨type · ⏳ · ·⟩
  > Écart relevé le 30/09 : `CamelCase<S>` ne contraint que les clés du manifest ; une clé
  > `addItem2` ou `add_item` dans un Channel compile aujourd'hui sans erreur. Mécanisme visé :
  > appliquer `CamelCase<K>` aux clés de `TChannelDefinition`. La grammaire des noms
  > (verbNoun, nounVerbed, nominal) reste une convention de style, hors de cette ligne.

## Invariants par principe

### P2 — Dépendances déclarées

- `C` I15 — Radio est une infrastructure interne, non exposée par `@bonsai/core` — un bus ambiant serait un canal non déclaré. ⟨type · ✅ · R T⟩

### P3 — Sémantique des trois voies

- `E` I10 — Un Command a un seul handler — la Feature propriétaire du Channel. ⟨boot · ✅ · R⟩
- `E` I11 — Un Event peut avoir N abonnés. ⟨run · ✅ · R⟩
- `E` I27 — Un Command peut être refusé par la Feature qui le traite ; un Event est un fait accompli qui ne peut être refusé. ⟨run · ⚠️ · R⟩
- `D` I29 — `reply()` retourne toujours `T` de façon synchrone ; `request()` retourne `T | null`. ⟨run · ✅ · R⟩
- `D` I55 — Un replier qui throw ne propage jamais l'erreur — `request()` retourne `null`. ⟨run · ✅ · R⟩
- `D` I65 — L'erreur d'un replier est reportée via l'`ErrorReporter` avant que `null` ne soit retourné. ⟨run · ⚠️ · ·⟩

### P4 — Causalité traçable et bornée

- `E` I7 — Tout message (Command, Event, Request) porte des métadonnées causales complètes (correlationId, causationId, hop, origin, timestamp). ⟨boot · ⏳ · ·⟩
- `C` I8 — Le `correlationId` est créé par l'UI et n'est jamais modifié ensuite. ⟨run · ⏳ · ·⟩
- `D` I9 — Le `hop` est incrémenté à chaque réaction ; un message au-delà de `MAX_HOPS` est rejeté. ⟨run · ⏳ · ·⟩
- `D` I54 — Les metas sont créées par le framework et propagées explicitement, jamais construites à la main. ⟨type · ⏳ · ·⟩

### P9 — Garantie au plus tôt

- `C` I75 — Aucun `any` ni `unknown` dans les signatures publiques de `Channel`, `Feature` ou `View`. ⟨revue · ⚠️ · T⟩
- `C` I76 — Les méthodes de `Channel` sont typées par `TDef` — un nom de message est une clé de la voie, jamais une `string` libre. ⟨type · ✅ · T⟩
- `D` I103 — Les clés de Commands, d'Events et de Requests d'un `TChannelDefinition` sont en `camelCase` plat, lettres uniquement. ⟨type · ⏳ · ·⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
