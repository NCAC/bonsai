# Bonsai — Suivi des corrections de la théorie V0.9.4

| Champ | Valeur |
| --- | --- |
| **Date** | 2026-10-30 — 30 octobre 2026 |
| **Source normative amendée** | [Théorie V0.9.4](../theorie.md) |
| **Revue de départ** | [Revue académique et architecturale V0.9.3](revue-academique-architecture-V0.9.3-2026-10-30.md), vingt constats P01–P20 |
| **Nature** | Suivi documentaire des corrections et des arbitrages, non normatif |
| **Périmètre** | Théorie, gardes, traçabilité, guide et catalogue des adaptateurs |
| **Exclusions** | Implémentation, exécution de tests applicatifs, certification et preuve formelle de consistance |

> **Règle de lecture.** La théorie fait autorité ; ce rapport explique les modifications sans ajouter de permission. « Corrigé » signifie que le défaut identifié reçoit une réponse documentaire explicite, non que le runtime applique déjà ce contrat. La revue historique et sa note de **7/10 pour V0.9.3** sont conservées. L’objectif de 10/10 motive la fermeture des réserves, pas une réévaluation automatique.

## Table des matières

- [1. Résultat et portée](#1-résultat-et-portée)
- [2. Matrice des vingt corrections](#2-matrice-des-vingt-corrections)
- [3. Arbitrages de fond](#3-arbitrages-de-fond)
- [4. Fermeture des raccords de contre-relecture](#4-fermeture-des-raccords-de-contre-relecture)
- [5. Documents alignés](#5-documents-alignés)
- [6. Contrôles et limites](#6-contrôles-et-limites)
- [7. Conditions de validation ultérieure](#7-conditions-de-validation-ultérieure)

## 1. Résultat et portée

**Les vingt constats reçoivent une correction, une clarification ou une restriction explicite du périmètre.** Les principes de propriété unique, médiation, domaine autonome et interface de projection sont maintenus. Aucun nouveau rôle applicatif n’est créé pour contourner une difficulté.

La V0.9.4 ajoute six contrats opérationnels au [§2.7](../theorie.md#27-contrats-opérationnels-transversaux) : disponibilité/publication, durée de vie, engagement/résultat des effets, occurrences/corrélation, observations/capture des valeurs et réservations d’abonnements. Elle corrige aussi les clauses, démonstrations, décisions et rôles qui utilisaient auparavant des conventions implicites.

Deux traitements ne sont pas de simples reformulations :

1. **P10 : révision de la garantie causale.** Une corrélation physique non observable n’est plus promise ; son absence devient explicite et ne crée aucun droit de Command à l’interface.
2. **P19 : restriction de conformité V1.** Le protocole général de clic/focus hors View reste ouvert ; sans admetteur déjà autorisé, le besoin n’est pas pris en charge. La fermeture de menu par écouteur global improvisé ne devient pas conforme.

Les garde-fous sur l’hôte, la terminaison, la convergence et la rejouabilité restent des limites assumées. Les supprimer du discours pour augmenter une note rendrait la spécification moins solide.

## 2. Matrice des vingt corrections

**Chaque ligne rattache le constat historique à un contrat vérifiable.** Les scénarios détaillés sont prescrits dans les [gardes](../gardes.md#couverture-des-vingt-points-de-revue-v094), sans attestation de leur exécution. « Correction documentaire » n’équivaut pas à validation de l’implémentation.

| Point | Réponse appliquée | Source normative | Critère discriminant de fermeture |
| --- | --- | --- | --- |
| P01 | Association existence–composant exactement unique et immuable ; unicité du parent explicitée dans T1. | [A0.d](../theorie.md#a0--cadre), [T1](../theorie.md#t1--composition-par-création) | Ni seconde existence, ni double parent, ni réassociation. |
| P02 | Racine unique, rattachement fini, configuration structurelle finie ; propriétaire actuel encore présent ; hypothèses citées dans T3/T6. | [Champ des axiomes](../theorie.md#12-axiomes), [A1.a](../theorie.md#a1--propriété-unique), [T3](../theorie.md#t3--destruction-en-cascade) | Pas de chaîne sans racine, cycle ou ressource à propriétaire seulement historique ; aucune promesse de terminaison du code arbitraire. |
| P03 | L’identité autorise l’attribution et son inverse structurel à la fin des parts subordonnées. | [§8.2](../theorie.md#82-identité) | Restituer modifie le contenant sans créer ni transférer une part ; pas de destruction isolée de l’identité. |
| P04 | Cascade logique de bas en haut, restitutions imputées au propriétaire encore présent, rollback conjoint et nettoyage physique post-validation. | [§2.5](../theorie.md#25-définition-axiome-et-lecture-des-axiomes), [T3](../theorie.md#t3--destruction-en-cascade) | A → B → C : restitution à B avant sa fin, sans autorité d’A sur le contenant de B ni traitement applicatif intercalaire. |
| P05 | D12 et rôle Composer alignés : attribution/restitution et création/retrait des éléments correspondants ; résultats propres instrumentés admis sans source générale. | [D12](../theorie.md#152-décisions), [§16.6](../theorie.md#166-composer), [§2.7.3](../theorie.md#273-engagement-et-résultat-des-effets) | Retrait et bilan d’échec de composition possibles, sans rendu de présentation, état indépendant ou Command. |
| P06 | Exactement une catégorie de transport par occurrence, fixée et immuable ; T2 invoque cette partition. | [A3.f](../theorie.md#a3--médiation), [T2](../theorie.md#t2--les-trois-voies) | Une charge réutilisée donne plusieurs occurrences ; aucune occurrence à la fois adressée et émise. |
| P07 | Cible prête et inactive exigée ; dépendances initiales ordonnées ; état prêt provisoire distingué de la publication. | [§2.7.1](../theorie.md#271-disponibilité-et-publication), [G5](../theorie.md#13-garanties-de-linfrastructure-de-communication) | Channel établi mais cible non prête : erreur, sans attente ni initialisation implicite ; échec d’unité abandonnant les états provisoires. |
| P08 | Callbacks et délivrances liés à une occurrence de vie non réutilisable ; contrôle avant admission et délivrance ; destruction provisoire distinguée. | [§2.7.2](../theorie.md#272-durée-de-vie-des-admissions-et-délivrances), [G3/G8](../theorie.md#13-garanties-de-linfrastructure-de-communication) | Callback tardif écarté ; aucune réassignation à une nouvelle View ; annulation conservant l’occurrence et ses réservations. |
| P09 | Arrêt du suffixe au premier échec synchrone d’engagement ; échec asynchrone sans annulation rétroactive ; résultat et non-tentative distincts. | [§2.7.3](../theorie.md#273-engagement-et-résultat-des-effets) | Deuxième effet en erreur : troisième non tenté ; si B dépend du succès de A, préparer B seulement dans le traitement du résultat de A. |
| P10 | Trois qualifications exclusives : résultat corrélé, indépendance établie, antécédent inconnu ; révision assumée d’A5/G8, D9/D18/D19 alignées. | [§2.7.4](../theorie.md#274-occurrences-de-faits-et-corrélation-observable), [A5](../theorie.md#a5--causalité), [D9/D18/D19](../theorie.md#152-décisions) | Notification coalescée ambiguë sans parent inventé, sans spontanéité présumée, sans Command UI ni borne annoncée au-delà de la coupure. |
| P11 | Unité et identification de l’occurrence fixées par source ; propagation, faits distincts et valeurs égales séparés. | [§2.7.4](../theorie.md#274-occurrences-de-faits-et-corrélation-observable), [A5.d](../theorie.md#a5--causalité) | Une occurrence propagée capturée au plus une fois ; touche/clic/changement distincts non fusionnés en intention humaine supposée. |
| P12 | Query sur observation intégrée seulement ; rafraîchissement physique par action, capture puis traitement local ; intégration non faite au préambule. | [§2.7.5](../theorie.md#275-observations-consultables-et-capture-des-valeurs), [§11.6](../theorie.md#116-admission) | Support changé avant traitement d’admission : ancienne observation consultable ; indisponibilité explicite et aucune certification de fraîcheur physique. |
| P13 | Capture sans alias mutable des messages, paramètres et réponses ; réponse historique sans autorité durable ; préconditions revérifiées par Command. | [§2.7.5](../theorie.md#275-observations-consultables-et-capture-des-valeurs), [G2](../theorie.md#13-garanties-de-linfrastructure-de-communication) | Modifier une collection sérialisable après soumission ne change pas la valeur transmise ; `readonly` seul insuffisant. |
| P14 | Réservations liées aux occurrences d’abonnement présentes à l’émission ; survie contrôlée avant délivrance. | [§2.7.6](../theorie.md#276-réservations-dabonnements), [D8](../theorie.md#152-décisions) | S remplacé par S′ : ancien Event non repris ; annulation conservant S ; ordre des autres réservations préservé. |
| P15 | Conclusion de T8 incluant le propriétaire de la ressource admise ou de sa part autorisante ; restrictions du catalogue distinguées du noyau. | [T8](../theorie.md#t8--admission-préalable) | Propriétaire de part autorisé dans sa portion ; admetteur parent exclu de cette portion tant que la part existe. |
| P16 | Continuité A4.e motivée comme choix fondateur ; existence séparée de disponibilité et progression. | [A4.e et commentaire](../theorie.md#a4--autosuffisance-du-domaine) | Channel vivant mais Query non prête/active refusée ; Command refusée par le métier possible ; pas de déduction abusive depuis A4.a. |
| P17 | Capture unique présentée comme règle fondatrice, non conséquence de la seule définition d’origine. | [A5.d et commentaire](../theorie.md#a5--causalité) | Deux captures restent interdites même si elles revendiquent la même origine. |
| P18 | Statuts explicités : L1 reformulation normative, T2 classification/dénomination, autres résultats déductifs sous hypothèses. | [§14](../theorie.md#14-conséquences-établies) | Aucun décompte de découvertes indépendantes ni confusion entre garanties contractuelles et preuves. |
| P19 | Politique de conformité V1 explicite sans prétendre résoudre le protocole général. | [18.30](../theorie.md#18a-questions-ouvertes), [B.1](../theorie.md#b1-finitude) | Sans admetteur autorisé, clic/focus hors View non pris en charge ; ni écouteur global Behavior ni admission générale Composer. |
| P20 | Décisions obligatoires pour le profil adopté ; référence parent–enfant limitée à la gestion de l’existence. | [§15.2](../theorie.md#152-décisions), [§9.10](../theorie.md#910-référence-structurelle) | D17/D18 non facultatives ; référence structurelle sans lecture de l’état ni appel fonctionnel de l’enfant. |

## 3. Arbitrages de fond

### 3.1 Restitutions intermédiaires conservées

**Chaque restitution est imputée à son propriétaire encore présent, même si celui-ci disparaît ensuite.** La suggestion historique de ne restituer qu’aux contenants survivant à l’unité n’est pas retenue.

Le choix adopté fixe un ordre logique local : descendants clôturés, portions restituées, puis contenants et parents clôturés. Il ne demande pas de connaître à l’avance la survie finale d’un contenant au cours d’un traitement qui peut encore utiliser sa portion avant de décider de sa fin. L’ancêtre initiateur ne devient jamais propriétaire des ressources descendantes. Aucun traitement applicatif ne s’intercale entre les étapes structurelles de la cascade ; leur annulation conserve les ressources antérieures sans recréation.

Les alternatives rejetées sont l’autorité générale de l’ancêtre et la restitution conditionnée à la survie finale. Le nettoyage physique reste différé et sa réussite n’est pas une condition de fin logique.

### 3.2 Causalité observable plutôt que causalité physique supposée

**L’infrastructure conserve les liens établis, elle ne reconstruit pas ceux que l’hôte ne rend pas observables.** Une notification générale n’est attribuée ni au dernier effet demandé, ni à une valeur égale, ni à la proximité temporelle, ni au seul `isTrusted`.

L’origine d’observation à antécédent inconnu rend la perte d’information visible. Elle n’est pas une preuve d’indépendance. D19 sélectionne parmi des notifications déjà contextualisées ; il ne corrige pas la coalescence antérieure de l’hôte. D9 borne seulement les segments connus ; une boucle passant par une coupure d’observation ne bénéficie pas de cette garantie.

Cette limite affecte réellement la navigation et le défilement : le seul nom `popstate`, `hashchange` ou `scroll` ne donne pas la permission de commander le domaine. D18 exige une indépendance établie ou une continuation corrélée d’une réaction déjà autorisée. Un Event ne devient jamais habilitant via un local, une Query ou un effet extérieur corrélé.

Les alternatives rejetées sont une corrélation heuristique présentée comme fidèle et une notification inconnue assimilée par défaut à une intention utilisateur. La conformité d’un protocole de source reste à établir ; aucun protocole navigateur complet ni runtime n’est livré ici.

### 3.3 Effets : engagement ordonné, dépendances confirmées

**L’ordre de préparation ne prouve pas une réussite préalable.** Après validation interne, les engagements suivent cet ordre jusqu’au premier échec synchrone ; le suffixe est non tenté et les engagements précédents restent acquis. L’échec asynchrone n’annule rien rétroactivement.

Si B exige un succès de A, B n’est préparé que dans le traitement du résultat de A. Les résultats restent affectés aux occurrences vivantes des composants concernés, même si une création a été initiée par un parent. Les réattribuer au créateur masquerait la propriété et le cycle de vie.

L’alternative rejetée est une poursuite implicite du suffixe après erreur, avec dépendances supposées satisfaites. Aucune compensation extérieure automatique ou transaction distribuée n’est introduite.

## 4. Fermeture des raccords de contre-relecture

**Les nouvelles prescriptions doivent rester compatibles avec les restrictions des rôles et G7.** La contre-relecture a détecté cinq raccords supplémentaires, corrigés avant clôture de ce suivi.

| Raccord | Correction finale | Scénario requis |
| --- | --- | --- |
| Composer interdit d’admission mais destinataire de ses résultats d’effets | Exception étroite §2.7.3/D12 : résultats propres instrumentés et bilans déclarés par D16 ; pas de notifications générales, Command ou état indépendant. La Foundation reçoit la même clarification vis-à-vis de D3/D7/§16.4. | Échec d’engagement de composition admis par le Composer vivant ; résultat d’une View jamais transféré à son Composer ; notification générale toujours interdite. |
| Refus D9 sans sort transactionnel déterminé | Contrôle à soumission ; Event avant réservations. Dans une unité : erreur de transport et G7, sans poursuite locale réussie. Au préambule : abandon technique sans révocation du passé. Trace hors transport applicatif. | Mutation puis Command/Event/local/Query dépassant la borne : rollback et aucun effet préparé engagé ; résultat post-validation dépassant la borne : aucun traitement, ancienne unité conservée. |
| Intégration de l’observation confondue avec admission | §11.6 dit explicitement « pendant le traitement du message local d’admission », conformément au §2.7.5. | Entre capture et délivrance, la nouvelle observation n’est pas consultable. |
| Résumé View trop permissif | §16.5 renvoie à une réaction autorisée par D18 ; Event et observation inconnue restent sans permission. | Query préalable conservant une permission existante, sans en créer une. |
| Suivi annoncé mais absent | Création du présent rapport, liaison depuis théorie/traçabilité et avertissement historique dans la revue V0.9.3. | Liens locaux vers une cible effectivement présente. |

Le refus transactionnel à soumission est préféré à un abandon tardif après validation de l’auteur : deux implémentations ne peuvent plus diverger sur la conservation de sa mutation. Au préambule d’un résultat extérieur, il n’existe plus d’unité antérieure révocable ; la borne peut donc conduire à un résultat non intégré, explicitement tracé. Aucun message d’erreur supplémentaire ne franchit la borne pour signaler le refus.

## 5. Documents alignés

**La source normative et ses développements utilisent les mêmes contrats.** Les modifications sont documentaires :

- [Théorie](../theorie.md) : axiomes, garanties, conséquences, décisions, rôles, questions et annexes.
- [Gardes](../gardes.md) : obligations et scénarios P01–P20, plus scénarios Composer/Foundation et refus D9.
- [Traçabilité](../tracabilite.md) : index des prescriptions et dépendances, 31 questions dont 30 tranchées et 18.30 ouverte.
- [Guide pédagogique](../theorie-explication-pedagogique.md) : explications réécrites, sans maintenir les anciennes permissions dans les exemples.
- [Contrats communs des adaptateurs](../adaptateurs/README.md) et treize fiches : [document](../adaptateurs/document.md), [Viewport](../adaptateurs/viewport.md), [défilement](../adaptateurs/defilement.md), [historique](../adaptateurs/historique.md), [stockage local](../adaptateurs/stockage-local.md), [session](../adaptateurs/stockage-session.md), [base indexée](../adaptateurs/base-indexee.md), [cache](../adaptateurs/cache.md), [cookies](../adaptateurs/cookies.md), [cycle de vie](../adaptateurs/cycle-de-vie.md), [connectivité](../adaptateurs/connectivite.md), [environnement](../adaptateurs/environnement.md), [presse-papiers](../adaptateurs/presse-papiers.md).
- [Revue V0.9.3](revue-academique-architecture-V0.9.3-2026-10-30.md) : ajout d’un avertissement historique, sans réécriture des citations, constats ou note.

Les ADR Accepted ne sont pas réécrits. Ce jalon n’établit pas à lui seul l’alignement de tout le registre d’invariants ou des RFC opérationnelles : leurs éventuels écarts doivent être traités explicitement, avec un nouvel ADR de succession si une décision acceptée change.

## 6. Contrôles et limites

**Un contrôle documentaire n’est pas un test de conformité du logiciel.** Les contrôles réalisés portent sur :

- la lecture des constats P01–P20 et leur rattachement à une modification explicite ;
- la contre-relecture des protocoles centraux et la correction des cinq raccords ci-dessus ;
- l’alignement des développements documentaires et la vérification des liens locaux et ancres ;
- les diagnostics de l’éditeur et les contrôles de mise en forme des fichiers édités ;
- les 30 rubriques de chacune des treize fiches d’adaptateur ;
- les décomptes lexicaux et structurels de la traçabilité : huit primitifs, 44 définitions, 52 termes, 30 clauses d’axiomes, huit garanties, L1 et T1–T8, trois objectifs, 19 identifiants de décisions dont D5 retirée, neuf rôles et 31 questions.

La contre-revue finale n’a établi aucune contradiction normative résiduelle de gravité forte ou moyenne dans le périmètre examiné. Elle a contrôlé **381 occurrences de liens locaux et 298 fragments d’ancres dans 19 documents**, sans cible ou ancre cassée, ainsi que les **390 rubriques** des treize fiches. Les **127 dépendances déclarées des 44 définitions** respectent l’ordre lexical et correspondent à la traçabilité ; ce contrôle n’est pas une preuve sémantique exhaustive de non-circularité. Les vérifications de diff n’ont signalé aucune erreur de mise en forme.

Deux réserves pédagogiques faibles issues de cette contre-revue ont aussi été corrigées : la conservation d’une View identique est présentée comme une optimisation possible, non une conséquence de T3 ; le silence d’un serveur n’est plus assimilé à un résultat observable sans échec réseau ou expiration d’un délai instrumenté. Ces corrections ne créent aucun contrat runtime supplémentaire.

**Non réalisés :** exécution des scénarios P01–P20, audit du runtime, compilation d’une implémentation de ces contrats, preuve formelle de consistance, validation exhaustive des protocoles navigateur, inventaire de conformité de tous les invariants et ADR. Les tests requis ne sont ni déclarés présents ni déclarés réussis.

Les restrictions sont conservées dans le contrat : pas de transaction distribuée, pas de convergence ou terminaison générale, pas de causalité physique exhaustive, pas de permission UI issue de l’inconnu, pas de prise en charge implicite de 18.30. Les statuts « disponible » des adaptateurs désignent le catalogue, non une disponibilité démontrée du logiciel.

## 7. Conditions de validation ultérieure

**La fermeture des réserves identifiées ne justifie pas une certification universelle de 10/10.** Le suivi fournit les éléments nécessaires à une nouvelle appréciation argumentée, séparée de la revue historique :

1. soumettre la V0.9.4 amendée à une contre-revue adversariale, sans limiter les recherches aux vingt constats connus ;
2. produire une réalisation et des tests discriminants pour disponibilité, rollback structurel, durée de vie, effets et refus D9 ;
3. valider les protocoles de capture et de corrélation de chaque source, notamment ceux qui prétendent établir l’indépendance d’une intention utilisateur ;
4. tracer séparément les écarts aux ADR et invariants opérationnels, sans réécrire leur histoire ;
5. maintenir explicitement hors périmètre les besoins non pris en charge, jusqu’à nouvel arbitrage.

**Bilan : les vingt réserves de la revue V0.9.3 ont une réponse documentaire traçable, et les raccords relevés pendant la correction ont été traités. Aucune nouvelle note indépendante n’est attribuée par ce suivi ; aucun 10/10 n’est fabriqué pour satisfaire l’objectif.**
