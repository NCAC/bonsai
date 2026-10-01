<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Behavior — invariants

[← Tous les rôles](README.md) · [Arbre des invariants](../arbre.md)

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention ;
tests : `R` runtime · `T` type · `·` aucun.

| Invariants | ✅ livré | ⚠️ partiel | ⏳ cible | 📐 convention |
| --- | --- | --- | --- | --- |
| 13 | 0 | 8 | 4 | 1 |

## Écarts

- `C` I4 — Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. ⟨type · ⚠️ · R T⟩
  > Livré pour la View (capabilities.types, I77) ; le Behavior n'existe pas encore (strate 2b).
- `C` I25 — Seuls les Views et Behaviors utilisent `trigger()` pour envoyer un Command. ⟨type · ⚠️ · R T⟩
  > Feature, Composer et Foundation n'ont pas de `trigger` (capabilities.types) ; la View l'a.
  > Le Behavior n'existe pas encore (strate 2b).
- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ⟨type · ⚠️ · ·⟩
- `D` I38 — Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html>`/`<body>`, Composer aucune écriture. ⟨type · ⚠️ · ·⟩
  > N1 (getUI) et « Composer sans écriture » (I35) livrés ; N2/N3 (templates) non livrés, strate 1c.
- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ⚠️ · R T⟩
  > Livré pour la View (`TFeatureContract`) ; le Behavior n'existe pas encore (strate 2b).
- `D` I81 — Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. ⟨boot · ⚠️ · R⟩
  > Livré pour la View (`mount()`) ; le Behavior n'existe pas encore (strate 2b).
- `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩
- `E` I99 — Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplacer. ⟨boot · ⚠️ · ·⟩
  > Livré : Foundation sur `<body>`, rootElement de la View fourni par le Composer (I31).
  > Non livré : exclusion des slots (I40), scope du Composer figé (I58).
- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩
- `C` I43 — Les clés `uiEvents` d'un Behavior sont disjointes de celles de sa View hôte. ⟨boot · ⏳ · ·⟩
- `D` I44 — Un Behavior n'a aucun accès aux propriétés de sa View hôte (`this.view`, `el`, `getUI`). ⟨type · ⏳ · ·⟩
  > Aucun package Behavior n'existe (strate 2b).
- `D` I45 — Un Behavior altère en N1 et N2 uniquement ses propres nœuds (clés ui déclarées), jamais en N3. ⟨type · ⏳ · ·⟩
  > Aucun package Behavior n'existe (strate 2b).

## Invariants par principe

### P1 — Souveraineté du domaine

- `C` I30 — Une View et un Behavior ne portent aucun domain state — seul un state local de présentation borné (I42) est toléré. ⟨type · ⚠️ · ·⟩

### P2 — Dépendances déclarées

- `D` I80 — Les composants consommateurs déclarent leurs dépendances via des classes Feature dans `TFeatureContract`, jamais via un `TChannelToken` direct. ⟨type · ⚠️ · R T⟩

### P3 — Sémantique des trois voies

- `C` I25 — Seuls les Views et Behaviors utilisent `trigger()` pour envoyer un Command. ⟨type · ⚠️ · R T⟩
- `C` I4 — Une View ou un Behavior peut `trigger`, `listen` et `request` uniquement sur les Channels déclarés — jamais `emit()`. ⟨type · ⚠️ · R T⟩

### P5 — La couche concrète projette, elle ne décide pas

- `D` I42 — Une View peut déclarer un state local de présentation — typé, réactif, encapsulé, non diffusable, détruit avec elle. ⟨type+boot · ⏳ · ·⟩

### P6 — Propriété exclusive du DOM

- `E` I99 — Tout composant de la couche concrète opère dans un scope DOM explicite, attribué par le niveau supérieur, qu'il ne peut ni étendre ni déplacer. ⟨boot · ⚠️ · ·⟩
- `C` I43 — Les clés `uiEvents` d'un Behavior sont disjointes de celles de sa View hôte. ⟨boot · ⏳ · ·⟩
- `D` I44 — Un Behavior n'a aucun accès aux propriétés de sa View hôte (`this.view`, `el`, `getUI`). ⟨type · ⏳ · ·⟩
- `D` I38 — Chaque rôle a des droits d'altération bornés : View N1 à N3 sur son scope, Behavior N1 et N2 sur ses propres nœuds, Foundation N1 sur `<html>`/`<body>`, Composer aucune écriture. ⟨type · ⚠️ · ·⟩
- `D` I45 — Un Behavior altère en N1 et N2 uniquement ses propres nœuds (clés ui déclarées), jamais en N3. ⟨type · ⏳ · ·⟩

### P8 — Identité par le manifest

- `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩

### P9 — Garantie au plus tôt

- `D` I81 — Les getters `features`, `uiEvents` et `uiElements` d'un consommateur sont évalués une seule fois, au `mount()`. ⟨boot · ⚠️ · R⟩
- `D` I83 — Tous les composants consommateurs composent leur contrat selon le même pattern modulaire (`TFeatureContract`, `TUIContract`, `TUIElements`). ⟨revue · 📐 · R⟩

## Règles transversales

- `E` I14 — Tout composant déclare statiquement les Channels avec lesquels il interagit. ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — Un accès à un Channel non déclaré est une erreur (compilation ou bootstrap). ⟨type+boot · ⚠️ · ·⟩
- `E` I102 — Une règle qui ne peut être vérifiée qu'à l'exécution l'est par une garde fail-fast : erreur explicite dès la première violation, avec son contexte, jamais de dégradation silencieuse. ⟨run · ⚠️ · ·⟩
- `E` I100 — Chaque rôle porte une seule responsabilité : Entity garde et mute l'état, Feature décide du métier, View projette, Composer décide du placement, Behavior enrichit le comportement, Foundation porte le layout racine, Application amorce. ⟨revue · 📐 · ·⟩
