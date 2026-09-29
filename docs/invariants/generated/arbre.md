<!-- Fichier généré par tools/invariants/invariants.ts — ne pas modifier à la main. -->

# Arbre des invariants

⟨mode · état · tests⟩ — état : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention · ∅ non qualifié ;
tests : `R` runtime · `T` type · `·` aucun (détection automatique des citations).

## P1 — Souveraineté du domaine

**Le domain state n'existe que dans une Entity ; seule la Feature propriétaire y accède et le modifie.**

*Branche non encore migrée.*

## P2 — Dépendances déclarées

**Un composant n'interagit qu'avec ce qu'il a déclaré statiquement ; il n'existe aucun canal implicite.**

*Branche non encore migrée.*

## P3 — Sémantique des trois voies

**Une intention (Command) va à un seul propriétaire, qui peut la refuser ; un fait (Event) est publié par son seul propriétaire vers N abonnés ; une lecture (Request) est sans effet.**

*Branche non encore migrée.*

## P4 — Causalité traçable et bornée

**Toute chaîne de messages est reconstituable jusqu'à l'action d'origine, et sa longueur est bornée.**

*Branche non encore migrée.*

## P5 — La View projette, elle ne décide pas

**Le rendu est une projection du domaine ; seule la View produit du DOM, et elle ne porte aucun état métier.**

*Branche non encore migrée.*

## P6 — Propriété exclusive du DOM

**Chaque nœud DOM a au plus un composant qui peut le muter, et ce partage est fixé au bootstrap.**

*Branche non encore migrée.*

## P7 — Cycle de vie hétéronome

**Aucun composant ne décide de sa propre existence ; création et destruction viennent d'un niveau supérieur.**

*Branche non encore migrée.*

## P8 — Identité par le manifest

**Une Feature n'a d'identité que par sa clé dans un manifest unique.**

- `E` I69 — Le manifest est l'unique source de vérité de l'identité d'une Feature. ⟨type · ✅ · R⟩
  - `C` I68 — Aucune classe Feature ne déclare de `static namespace`. ⟨type · ✅ · R T⟩
  - `C` I72 — `TSelfNS` est la clé de la Feature dans le manifest. ⟨type · ✅ · R T⟩
  - `C` I87 — La clé d'un `TFeatureContract` est le namespace de la Feature référencée. ⟨type · ⚠️ · R T⟩
  - `V` I95 — Chaque entrée du manifest est contrainte par `TStrictFeatureClass<NS>`. ⟨type · ✅ · T⟩
- `D` I21 = I24 — Toute Feature est enregistrée dans le manifest sous une clé `camelCase` sans chiffre. ⟨type+boot · ✅ · R T⟩
- `D` I71 — Les namespaces `local` et `router` sont réservés (`RESERVED_NAMESPACES`). ⟨type+boot · ✅ · R T⟩

## P9 — Garantie au plus tôt *(méta-principe)*

**Toute règle est garantie par construction au compile-time ; à défaut, vérifiée au bootstrap, frontière de confiance. Rien n'est laissé au runtime courant.**

> ❓ Arbitrer la tension avec les invariants vérifiés en mode run (I8, I9, I20, I37, I65, I97, I98).

*Branche non encore migrée.*
