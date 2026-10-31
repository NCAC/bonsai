# Bonsai — Prototype du noyau de communication (lot M1)

*Rapport du 31 octobre 2026. Branche `feature/noyau-m1`, issue de `feature/documentation-big-bang` au commit `27ddbf9`. Code : `packages/event/src/kernel/` ; tests : `tests/unit/kernel/root.test.ts`. Ce rapport n'est pas normatif.*

## 1. Objet

Vérifier, par du code exécutable, que les garanties de l'infrastructure de communication fixées par la théorie V0.9.5 (§13 et annexe C) se réalisent, et relever ce que leur réalisation impose au reste du framework. Le prototype vit **à côté** de `Channel` et `Radio`, qu'il ne remplace pas ; `@bonsai/event` ne l'exporte pas encore.

## 2. Ce qui est réalisé

| Garantie | Réalisation | Test discriminant |
| --- | --- | --- |
| G1 | Command au propriétaire du Channel, Event aux propriétaires des abonnements, message local à son auteur, réponse à l'auteur de la Query | tous les blocs |
| G2, C.5 | Valeurs copiées puis gelées à la soumission (`structuredClone` + gel profond), réponses au retour ; une fonction ou un élément est refusé | mutation de la charge après `emit` sans effet ; `NOT_CAPTURABLE` |
| G3, C.2, C.6 | Réservation liée à un abonnement déterminé, vérifiée à la délivrance ; occurrence de vie non réutilisable | abonnement créé après l'émission non servi ; abonné détruit avant délivrance abandonné ; destruction annulée : réservation conservée |
| G5 | Messages différés mis en file à la fin réussie de l'unité ; une unité à la fois ; Query synchrone refusée vers une cible non prête ou active | exemple panier/promo du guide : affichage 20 puis 18 ; `A → Query B → Query A` et Query vers soi refusées |
| A3.g | Contexte en lecture seule pour le traitement d'une Query, transitivement | `trigger` dans une Query : `READ_ONLY`, unité de l'auteur annulée |
| G6 | Un registre de Channels, une file et des abonnements par `Root` | deux racines avec un Channel `cart` chacune |
| G7 | Journal d'annulation par unité ; créations, destructions et messages différés de l'unité abandonnés ; une erreur de Query « empoisonne » l'unité même si l'auteur l'intercepte | état restauré ; Event non délivré ; composant créé non publié ; `try/catch` autour d'une Query sans effet |
| G8 | Contextes créés par le noyau seul ; un parent par message ; retour de Query sans changement du contexte de l'auteur ; résultat corrélé par jeton lié à l'occurrence | chaîne clic → Command → résultat corrélé → Event ; origine inconnue ; jeton présenté à une autre occurrence refusé |
| D8 | Ordre de production ; abonnés dans l'ordre d'abonnement ; rang fixé à l'émission | `first`, `a`, `b`, `second` |
| D9 | Profondeur contrôlée avant toute soumission ; refus dans l'unité = erreur de transport et annulation ; refus au préambule = abandon tracé | boucle arrêtée à la borne, dernière unité annulée ; résultat corrélé au-delà de la borne abandonné |
| §2.5, C.1 | Démarrage : unité exceptionnelle ; messages et admissions en attente de sa réussite ; échec : modèle abandonné | message de démarrage délivré après la fin ; `StartupError` ; Query vers une cible en initialisation refusée |
| C.3 | Effets préparés, engagés dans l'ordre après validation, arrêt au premier échec synchrone, bilan admis | effet non engagé si l'unité échoue ; `engaged`, `failed`, `not-attempted` |
| A5.a | Un contexte conservé après son unité (par exemple dans un `.then()`) est refusé | `NO_UNIT` |

**Résultats.** 25 tests du noyau réussis ; la suite complète (302 tests) et `tsc --noEmit -p tsconfig.test.json` réussissent. Quatre mutations du code ont été vérifiées : suppression de l'empoisonnement, de l'annulation, du refus G5 et de la capture. Chacune fait échouer au moins un test. Sans contrôle D9, la boucle du test D9 ne termine pas : la borne est aussi ce qui garantit l'arrêt de la file.

## 3. Ce que le prototype apprend

**R1 — G7 n'est réalisable que si toute ressource interne passe par Bonsai.** Le noyau ne peut annuler que ce qui lui a été journalisé. Un champ ordinaire d'une classe de Feature, de View ou de Composer, modifié pendant un traitement, échappe à l'annulation. A0.c dit déjà que tout ce qu'on peut changer d'un composant est une ressource dont il est propriétaire ; il faut en tirer une garde : **pas de champ mutable dans une sous-classe de composant**, l'état passant par l'Entity (lot M2, patches Immer comme journal), l'état local de la View et le contenu du slot du Composer. Proposition : ajouter cette garde à `gardes.md` (lint, niveau statique) et l'expliquer dans le guide.

**R2 — L'empoisonnement de l'unité est la bonne réalisation de « aucune récupération locale ».** Le code applicatif peut intercepter l'erreur d'une Query, mais l'unité échoue quand même. C'est conforme à G7, mais surprenant pour un développeur. Proposition : un lint contre `try/catch` autour de `query`, et un message d'erreur qui le dit.

**R3 — La file est vidée de façon synchrone, jusqu'au bout.** C'est simple et commode à tester, et G5 ne demande rien d'autre. Mais une longue chaîne bloque le fil de l'hôte jusqu'à la borne D9. Rendre la main entre deux unités (microtâche ou tâche) reste compatible avec la théorie, puisque la frontière normative est la validation. **Question de conception pour la suite de M1**, à trancher dans un ADR.

**R4 — L'ordre des dépendances initiales est l'ordre de création.** C.1 demande des dépendances de consultation déclarées et un ordre qui les respecte ; le prototype se contente de l'ordre de création et refuse une Query vers une cible encore en initialisation. Le graphe de dépendances déclarées relève du lot M2 (démarrage).

**R5 — Le jeton de corrélation n'a pas de fin de vie.** C.2 veut qu'un contexte soit conservé jusqu'au résultat, à l'annulation ou à la clôture de l'occurrence. Le prototype vérifie l'occurrence à l'admission, mais ne libère jamais le jeton. À réaliser avec les opérations instrumentées (lot M4).

**R6 — Le bilan d'effets est admis par un message local réservé, `$effects`.** C'est une convention de prototype ; D16 demande que ces résultats soient déclarés. La forme de cette déclaration est à fixer avec l'API cible des rôles.

**R7 — Coût de la capture.** Chaque message et chaque réponse sont copiés puis gelés. C'est sûr, mais coûteux pour de grosses charges. Une immuabilité par construction (valeurs déjà gelées, structures persistantes) pourrait éviter la copie ; à mesurer avant de choisir.

## 4. Hors périmètre

Intégration de l'Entity et validation de ses invariants (M2) ; parts, désignations et DOM (M3–M4) ; qualification des sources par le monde fermé et D18 (M5) ; remplacement de `Channel` et `Radio`, et branchement des classes de base (M6).

## 5. Suite proposée

1. Valider les gardes R1 et R2 dans `gardes.md`.
2. Trancher R3 (vidage synchrone ou par tâches) dans un ADR.
3. Lot M2 : brancher l'Entity sur le journal d'unité et vérifier les invariants métier à la fin de chaque unité de validation.
