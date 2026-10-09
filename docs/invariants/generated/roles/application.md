<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Application — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 11 | 9 | 1 | 1 | 0 |

## Écarts

- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ⟨type+boot · ⚠️ · T⟩
  > Seule la réservation du namespace `router` est livrée (via I71) ; aucun Router n'existe.
- `E` I66 — Le bootstrap est la frontière de confiance — après `app.start()` les garanties sont vérifiées, avant, aucun `trigger`/`emit`/`request` n'est accepté. ⟨boot · ⏳ · ·⟩

## Invariants par principe

### P2 — Dépendances déclarées

- `V` I70 — Toute référence à un namespace externe (`listens`, `queries`, `request`) est validée contre le manifest au bootstrap. ⟨boot · ✅ · R⟩

### P5 — La couche concrète projette, elle ne décide pas

- `C` I56 — La couche abstraite (Features, Entities) est active avant la couche concrète (Views). ⟨boot · ✅ · R⟩
- `D` I57 — Le namespace `local` est réservé au mécanisme de state local ; aucun Channel, Feature ou Entity ne peut le déclarer. ⟨type+boot · ✅ · T⟩

### P7 — Cycle de vie hétéronome

- `D` I23 — Application est dormante au runtime — aucune logique métier ni rôle actif entre le bootstrap et le shutdown. ⟨type · ✅ · R T⟩
- `D` I28 — Le Router est une Feature interne, de namespace réservé `router`, instanciée par Application et non par le développeur. ⟨type+boot · ⚠️ · T⟩

### P8 — Identité par le manifest

- `E` I69 — Le manifest est l'unique source de vérité de l'identité d'une Feature. ⟨type · ✅ · R T⟩
- `C` I72 — `TSelfNS` est la clé de la Feature dans le manifest. ⟨type · ✅ · R T⟩
- `D` I21 — Toute Feature est enregistrée dans le manifest sous une clé `camelCase` sans chiffre. ⟨type+boot · ✅ · R T⟩
- `D` I71 — Les namespaces `local` et `router` sont réservés (`RESERVED_NAMESPACES`). ⟨type+boot · ✅ · R T⟩
- `V` I95 — Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. ⟨type · ✅ · T⟩

### P9 — Garantie au plus tôt

- `E` I66 — Le bootstrap est la frontière de confiance — après `app.start()` les garanties sont vérifiées, avant, aucun `trigger`/`emit`/`request` n'est accepté. ⟨boot · ⏳ · ·⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
