<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Foundation — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 5 | 0 | 5 | 0 | 0 |

## Écarts

- `D` I20 — Seuls la Foundation et les Composers créent, détruisent ou remplacent des Views. ⟨run · ⚠️ · R⟩
  > Écart à P9 : règle structurelle non garantie avant l'exécution. `View` est exportée avec un
  > constructeur public et un `mount()` public : le code applicatif peut instancier et monter une
  > View lui-même. À remonter au compile-time (création réservée au Composer).
- `D` I33 — La Foundation est unique par application ; elle seule altère `<html>` et `<body>`, en N1 seulement — attributs et classes, sans ajouter ni retirer de nœud. ⟨boot · ⚠️ · R⟩
- `D` I38 — Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html>`/`<body>`, Composer aucune écriture. ⟨type · ⚠️ · ·⟩
  > N1 (getUI) et « Composer sans écriture » (I35) livrés ; N2/N3 (templates) non livrés, strate 1c.
- `D` I67 — La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. ⟨type+boot · ⚠️ · ·⟩
- `E` I99 — Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplacer. ⟨boot · ⚠️ · ·⟩
  > Livré : Foundation sur `<body>`, rootElement de la View fourni par le Composer (I31).
  > Non livré : exclusion des slots (I40), scope du Composer figé (I58).

## Invariants par principe

### P6 — Propriété exclusive du DOM

- `E` I99 — Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplacer. ⟨boot · ⚠️ · ·⟩
- `D` I38 — Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html>`/`<body>`, Composer aucune écriture. ⟨type · ⚠️ · ·⟩
- `D` I33 — La Foundation est unique par application ; elle seule altère `<html>` et `<body>`, en N1 seulement — attributs et classes, sans ajouter ni retirer de nœud. ⟨boot · ⚠️ · R⟩

### P7 — Cycle de vie hétéronome

- `D` I20 — Seuls la Foundation et les Composers créent, détruisent ou remplacent des Views. ⟨run · ⚠️ · R⟩
- `D` I67 — La structure de la Foundation est stable — `get composers()` est lu une seule fois au bootstrap et n'est jamais modifié. ⟨type+boot · ⚠️ · ·⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `D` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
