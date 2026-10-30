# Couche concrète — Ancrage, composition et projection

> **Foundation, Composer et View sont des composants ; Behavior est du code imputé à la View**

[← Retour à l'index](../README.md) · [← Couche abstraite](../3-couche-abstraite/README.md)

---

## Vue d'ensemble

La couche concrète réalise l'interface dans les périmètres admis ou attribués. La [théorie](../../theorie.md), notamment D3/D11–D13 et §16.4–§16.7, prévaut sur les anciens contrats d'API. Ce lot documentaire ne livre pas le protocole de parts, de destruction et de nettoyage décrit dans les pages dédiées.

### Caractéristiques communes

- **Durée logique** : la Foundation persiste pendant la vie de sa racine ; les Composers et Views suivent leur parent, pas la seule présence physique d'un nœud.
- **Parts exclusives** : attribuer un contenu le soustrait au parent ; la fin de la part le restitue, sans transfert de propriété.
- **Projection du domaine** : aucune autorité métier indépendante ; Composer sans Command ni état de présentation supplémentaire.
- **Niveaux N1/N2/N3 historiques** : choix d'API subordonnés à la propriété, jamais un droit d'empiéter sur les parts attribuées.

---

## Composants

L'ordre suit la composition logique ; le Behavior n'ajoute pas un enfant à l'arbre :

| # | Composant | Rôle | Altérations DOM | Document |
| --- | --- | --- | --- | --- |
| 1 | **Foundation** | Une par racine, élément admis configurable (`body` par défaut) | Périmètre admis hors contenu attribué ; configuration non livrée | [foundation.md](foundation.md) |
| 2 | **Composer** | Décideur de composition, parent des Views | Structure des parts et éléments correspondants seulement ; protocole complet non livré | [composer.md](composer.md) |
| 3 | **View** | Rendu et interaction UI | N1 livré ; N2, N3 via templates ⏳ | [view.md](view.md) |
| 4 | **Behavior** | Code réutilisable aveugle, pas un composant ; non livré | Opérations imputées à la View, hors contenu de ses slots | [behavior.md](behavior.md) |

> **Parenté réservée** : Foundation et View ne sont parents que de Composers ; une View n'est enfant que d'un Composer. Un Behavior n'a ni existence, ni identité, ni part propres.

---

## Flux de vie typique

1. **Foundation** est créée par la racine au démarrage ; elle admet l'élément déclaré et attribue le contenu de slots à ses Composers.
2. **Composer** décide quelles Views occupent des parts disjointes du contenu reçu. Le livré offre `resolve()` pour 0/1 View, sans écoute Channel applicative.
3. **View** reçoit à sa création une désignation de sa part ; la résolution contrôlée cible diffère du `document.querySelector()` global livré. Elle peut déclarer des Composers enfants, mécanisme non livré.
4. **Behavior** contribue au code de la View : une admission, réactions dans l'ordre déclaré et unité commune. La forme de déclaration reste à concevoir.
5. **Destruction** : descendants et restitutions de bas en haut dans l'unité annulable, aucun hook applicatif pendant la cascade, nettoyage physique après validation. Le code livré oublie encore les références View sans désabonnement.

---

## Ordre de lecture recommandé

1. [foundation.md](foundation.md) — le point d'entrée concret
2. [composer.md](composer.md) — comment le framework décide quoi afficher
3. [view.md](view.md) — le composant le plus riche (templates, events, localState)
4. [behavior.md](behavior.md) — les plugins UI réutilisables

---

## Lecture suivante

→ [5-rendu.md](../5-rendu.md) — PDR, templates PugJS, ProjectionList
