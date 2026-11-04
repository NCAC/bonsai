<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Composer — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 8 | 6 | 2 | 0 | 0 |

## Écarts

- `C` I38 — Les droits de modification de l'interface respectent les parts attribuées et les rôles ; la View projette dans sa part hors contenu des slots, les opérations du Behavior lui sont imputées, la Foundation reste bornée à son élément admis hors parts attribuées, et le Composer ne modifie son contenu que pour la composition définie par I35. ⟨run · ⚠️ · ·⟩
  > Livré : projections de la View dans sa part, composition structurelle du Composer, Foundation bornée à son élément admis.
  > Non livré : exclusion du contenu des slots pour les projections (I40), imputation du Behavior (strate 2).
- `E` I99 — La Foundation opère dans son élément admis, le Composer dans le contenu du slot attribué et la View dans sa part attribuée ; chacun exclut les portions attribuées à ses enfants. Le Behavior agit dans la part de sa View, sans part autonome. ⟨run · ⚠️ · ·⟩
  > V0.9.4 : A2, §16.4–§16.7 ; l'admission Foundation n'est pas une attribution par un parent DOM.
  > Livré : élément admis de la Foundation, slots attribués aux Composers, parts des Views (noyau, M3–M6.2).
  > Non livré : exclusion des portions des enfants pour les projections de la View (I40) ; Behavior (strate 2).

## Invariants par principe

### P6 — Propriété et parts de l'interface

- `E` I99 — La Foundation opère dans son élément admis, le Composer dans le contenu du slot attribué et la View dans sa part attribuée ; chacun exclut les portions attribuées à ses enfants. Le Behavior agit dans la part de sa View, sans part autonome. ⟨run · ⚠️ · ·⟩
- `D` I31 — Le Composer fournit à la création de la View une désignation de sa part, jamais un élément de l'hôte ; sa résolution contrôlée vérifie la propriété et sa validité pour cette seule attribution, sans réactivation par réattribution du même emplacement. ⟨run · ✅ · R⟩
- `C` I58 — Le Composer reçoit à sa création la désignation du contenu attribué pour son occurrence de vie ; il ne transfère ni ne déplace cette attribution. Son parent le détruit avant de retirer l'élément du slot ; une réutilisation du même emplacement ne réactive ni l'ancien Composer ni sa désignation. ⟨run · ✅ · R⟩
- `C` I38 — Les droits de modification de l'interface respectent les parts attribuées et les rôles ; la View projette dans sa part hors contenu des slots, les opérations du Behavior lui sont imputées, la Foundation reste bornée à son élément admis hors parts attribuées, et le Composer ne modifie son contenu que pour la composition définie par I35. ⟨run · ⚠️ · ·⟩
- `C` I35 — Le Composer ne modifie le contenu de son slot que pour attribuer ou restituer les parts de ses Views, créer ou retirer les éléments correspondants ; il ne réalise aucun rendu supplémentaire, ne tient aucun état local indépendant et n'adresse aucune Command. Il admet les seuls résultats instrumentés de ses propres effets de composition, déclarés avec leurs traitements locaux, jamais une notification générale de l'hôte. ⟨run · ✅ · R⟩

### P7 — Cycle de vie hétéronome

- `C` I20 — Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. Le parent est seul propriétaire de l'existence de ses enfants et leur destruction entraîne celle de leurs descendants. ⟨run · ✅ · R⟩
- `C` I36 — La View déclare les slots dont elle attribue le contenu à ses Composers enfants, jamais des Views enfants ; seuls ces Composers décident quelles Views occupent leurs parts. ⟨run · ✅ · R⟩
- `D` I37 — Un seul type d'API Composer exprime la composition de 0..N Views hétérogènes dans le contenu qui lui est attribué, sans recouvrement des parts ; cette multiplicité n'autorise ni transfert de part ni lecture des portions attribuées. ⟨type · ✅ · R T⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `C` I25 — Une Command vise un Channel déclaré dans les limites des parties ; une Feature n'en adresse pas à une autre Feature, mais peut en adresser à un adaptateur du domaine. Le domaine n'adresse rien à un adaptateur de l'interface et n'en reçoit rien. Les Commands de l'interface restent soumises à I13 ; le Behavior agit au nom de sa View, et le Composer n'adresse aucune Command. ⟨run · ⚠️ · R T⟩
- `C` I13 — Un composant de l'interface n'adresse une Command que pendant une réaction à un fait admis d'indépendance établie ou une continuation corrélée déjà autorisée à commander, sous réserve des interdictions de son rôle. Event, relais local d'Event, résultat d'effet corrélé à un Event et observation d'antécédent inconnu n'accordent aucune permission. Une Query préalable conserve la permission de son auteur sans l'accorder au traitement consulté, toujours en lecture seule ; sa réponse n'est pas un déclencheur autonome. ⟨run · ✅ · R⟩
- `E` I7 — Tout message, Command, Query, Event ou local, porte le contexte de son déclenchement observable ; chaque message hors origine a exactement un parent établi, et chaque origine conserve sa qualification démarrage, spontanée ou observation d'antécédent inconnu. Une réponse de Query n'est pas un message et ne crée aucun contexte propre. ⟨run · ✅ · R⟩
- `C` I8 — L'infrastructure de communication établit l'origine de démarrage et qualifie chaque admission selon son protocole déclaré en résultat corrélé, fait indépendant établi ou observation d'antécédent inconnu. Elle conserve les liens connus ; ni le code applicatif ni une sélection D19 ne peuvent inventer un parent, effacer un lien ou transformer l'inconnu en indépendance établie. ⟨run · ✅ · R⟩
- `C` I9 — La borne causale fixée par le Manifest, commune à la racine, limite la profondeur des segments de continuations connues ; l'infrastructure la contrôle avant toute soumission de Command, Query, Event ou local, et avant toute réservation des branches d'un Event. Un refus pendant un traitement ou une initialisation fait échouer l'unité extérieure selon G7 ; au préambule d'admission, l'occurrence est abandonnée et signalée techniquement sans traitement ni révocation du passé. Aucun nouveau contrôle D9 n'est reporté à la délivrance d'un message accepté. ⟨run · ✅ · R⟩
- `D` I54 — Les métadonnées causales sont établies et dérivées par l'infrastructure de communication ; le code applicatif les reçoit et les propage explicitement sans les fabriquer ni les remplacer. Le contexte des opérations corrélables est conservé jusqu'au résultat, à l'annulation ou à la clôture de l'occurrence de vie, même après un échec ; une Query restitue à son auteur son contexte sans le remplacer. ⟨run · ✅ · R⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ✅ · R⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
