<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Foundation — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 5 | 0 | 5 | 0 | 0 |

## Écarts

- `C` I20 — Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. Le parent est seul propriétaire de l'existence de ses enfants et leur destruction entraîne celle de leurs descendants. ⟨run · ⚠️ · R⟩
  > Écart à P9 : règle structurelle non garantie avant l'exécution. `View` est exportée avec un
  > constructeur public et un `mount()` public : le code applicatif peut instancier et monter une
  > View lui-même. À remonter au compile-time (création réservée au Composer).
- `C` I33 — Unique par racine, la Foundation admet l'élément configuré par le Manifest, `body` par défaut, et reste bornée à cet élément hors contenu attribué aux Composers. Elle n'admet ni l'en-tête ni les sources de niveau document, réservés à l'adaptateur correspondant ; ses résultats instrumentés propres restent régis par C.3. ⟨run · ⚠️ · R⟩
  > Livré : attachement à body et garde par instance ; html exposé, configuration et confinement absents.
- `C` I38 — Les droits de modification de l'interface respectent les parts attribuées et les rôles ; la View projette dans sa part hors contenu des slots, les opérations du Behavior lui sont imputées, la Foundation reste bornée à son élément admis hors parts attribuées, et le Composer ne modifie son contenu que pour la composition définie par I35. ⟨run · ⚠️ · ·⟩
  > V0.9.4, 2026-10-30 : droits corrigés ; état partiel conservé, mode run pour les parts effectives.
  > Livré : primitives de projection View et montage Composer ; pas de contrôle complet des parts.
  > Non livré : exclusion des slots, Foundation configurable/bornée et imputation Behavior.
  > Lot 3 : spécialisations I33/I34/I45 alignées ; contrôles complets toujours non livrés.
- `D` I67 — La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. ⟨type+boot · ⚠️ · ·⟩
- `E` I99 — La Foundation opère dans son élément admis, le Composer dans le contenu du slot attribué et la View dans sa part attribuée ; chacun exclut les portions attribuées à ses enfants. Le Behavior agit dans la part de sa View, sans part autonome. ⟨run · ⚠️ · ·⟩
  > V0.9.4 : A2, §16.4–§16.7 ; l'admission Foundation n'est pas une attribution par un parent DOM.
  > Livré : montage et résolution locaux partiels ; aucun contrôle complet des parts et de leur durée.

## Invariants par principe

### P6 — Propriété et parts de l'interface

- `E` I99 — La Foundation opère dans son élément admis, le Composer dans le contenu du slot attribué et la View dans sa part attribuée ; chacun exclut les portions attribuées à ses enfants. Le Behavior agit dans la part de sa View, sans part autonome. ⟨run · ⚠️ · ·⟩
- `C` I38 — Les droits de modification de l'interface respectent les parts attribuées et les rôles ; la View projette dans sa part hors contenu des slots, les opérations du Behavior lui sont imputées, la Foundation reste bornée à son élément admis hors parts attribuées, et le Composer ne modifie son contenu que pour la composition définie par I35. ⟨run · ⚠️ · ·⟩
- `C` I33 — Unique par racine, la Foundation admet l'élément configuré par le Manifest, `body` par défaut, et reste bornée à cet élément hors contenu attribué aux Composers. Elle n'admet ni l'en-tête ni les sources de niveau document, réservés à l'adaptateur correspondant ; ses résultats instrumentés propres restent régis par C.3. ⟨run · ⚠️ · R⟩

### P7 — Cycle de vie hétéronome

- `C` I20 — Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. Le parent est seul propriétaire de l'existence de ses enfants et leur destruction entraîne celle de leurs descendants. ⟨run · ⚠️ · R⟩
- `D` I67 — La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. ⟨type+boot · ⚠️ · ·⟩

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
