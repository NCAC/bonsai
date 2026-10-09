<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Entity — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 11 | 8 | 0 | 1 | 2 |

## Écarts

- `C` I63 — Un schema Entity ne contient ni `v.transform()` ni coercion — c'est un garde-fou en lecture, la transformation reste dans le command handler. ⟨revue · ⏳ · ·⟩

## Invariants par principe

### P1 — Souveraineté du domaine

- `E` I6 — L'Entity n'est accessible qu'à sa Feature propriétaire : aucun autre composant (View, Behavior, autre Feature, Composer, Foundation) ne peut la lire ni la modifier. ⟨type · ✅ · R T⟩
- `D` I22 — La relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte ; l'Entity est obligatoire, même vide. ⟨type+boot · ✅ · R⟩
- `D` I46 — `TStructure` (state d'une Entity) est contraint à `TJsonSerializable`. ⟨type · ✅ · R T⟩
- `D` I97 — `Entity.mutate()` utilise `Immer.produceWithPatches`. ⟨run · ✅ · R⟩
- `D` I51 — Les notifications de mutation d'une Entity sont auto-découvertes sur sa Feature (`on<Key>EntityUpdated` / `onAnyEntityUpdated`) — résumé de I96. ⟨boot · ✅ · R⟩
- `D` I96 — Le dispatch des notifications suit un ordre déterministe (clés changées par ordre alphabétique, puis catch-all) via une souscription unique, avec isolation des erreurs par handler. ⟨boot · ✅ · R⟩
- `V` I53 — Une clé de handler `on<Key>EntityUpdated` inconnue du state de l'Entity est rejetée au bootstrap. ⟨boot · ✅ · R⟩
- `D` I98 — Une mutation déclenchée pendant un cycle de notification est mise en file FIFO plutôt qu'exécutée immédiatement, avec une profondeur de ré-entrance bornée. ⟨run · ✅ · R⟩

### P10 — Une responsabilité, un rôle

- `C` I101 — Une Entity ne porte aucune logique métier : elle garde l'état, applique les mutations que sa Feature lui fournit et expose des lectures pures ; toute décision (validation métier, transformation, refus d'une intention) appartient à la Feature. ⟨revue · 📐 · ·⟩
- `C` I63 — Un schema Entity ne contient ni `v.transform()` ni coercion — c'est un garde-fou en lecture, la transformation reste dans le command handler. ⟨revue · ⏳ · ·⟩
- `D` I52 — L'Entity expose des méthodes query pures (lecture seule). ⟨revue · 📐 · R⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
