# Bonsai — Migration V0.9.4 : théorie, invariants et runtime

| Champ | Valeur |
| --- | --- |
| **Date** | 2026-10-30 |
| **Statut** | Diagnostic et plan non normatifs ; lots documentaires 1–3 appliqués (§11–§13), runtime inchangé |
| **Autorité** | [Théorie V0.9.4](../theorie.md), notamment §2.5, §2.7 et G1–G8 |
| **Point de départ** | [Suivi des vingt corrections](corrections-V0.9.4-2026-10-30.md) |
| **Périmètre inspecté** | Dix branches du registre, principes, outillage, sept packages du kernel et tests associés |
| **Diagnostic initial** | Lecture et cartographie ; aucun invariant, ADR, test ou fichier runtime modifié lors de l’audit |
| **Suite du 2026-10-30** | Autorité clarifiée ; dix principes et vingt-cinq invariants réalignés en trois lots, copies et vues actualisées (§11–§13) |

> **Règle de lecture.** Ce rapport ne crée aucun invariant et ne réserve aucun identifiant. Les états du registre décrivent les anciens contrats et ne prouvent pas les contrats V0.9.4. Les tests cités ont été lus, pas exécutés. L’alignement sur la théorie validée est obligatoire, non soumis à un nouvel arbitrage. Les successions d’ADR tracent le remplacement des anciennes décisions ; seuls les choix de réalisation compatibles restent à arbitrer.

## Table des matières

- [1. Diagnostic structurant](#1-diagnostic-structurant)
- [2. Référentiel et contraintes du registre](#2-référentiel-et-contraintes-du-registre)
- [3. Principes à réaligner](#3-principes-à-réaligner)
- [4. Contrats existants à corriger](#4-contrats-existants-à-corriger)
- [5. Couverture des protocoles transversaux](#5-couverture-des-protocoles-transversaux)
- [6. État observé du kernel](#6-état-observé-du-kernel)
- [7. Successions et décisions préparatoires](#7-successions-et-décisions-préparatoires)
- [8. Lots de migration et portes de sortie](#8-lots-de-migration-et-portes-de-sortie)
- [9. Tests discriminants à préserver ou introduire](#9-tests-discriminants-à-préserver-ou-introduire)
- [10. Prochaine modification du registre](#10-prochaine-modification-du-registre)
- [11. Premier lot appliqué — 30 octobre 2026](#11-premier-lot-appliqué--30-octobre-2026)
- [12. Lot 2 — Causalité et permissions](#12-lot-2--causalité-et-permissions)
- [13. Lot 3 — Propriété et cycle de vie](#13-lot-3--propriété-et-cycle-de-vie)

## 1. Diagnostic structurant

**Le socle d’exécution doit être conçu avant d’ajouter des métadonnées aux messages.** Le runtime inspecté ne possède pas encore le protocole commun de validation, de délivrance différée, de durée de vie et d’engagement d’effets exigé par V0.9.4.

Trois ruptures sont immédiates :

1. une Query en erreur devient actuellement `null`, alors que G7 exige sa propagation et l’échec de l’unité extérieure ;
2. Commands et Events sont exécutés dans la pile de leur auteur, alors que G5/D8 exigent une délivrance différée après validation ;
3. Radio indexe globalement les Channels par namespace, sans isolation par racine, alors que G6 interdit les échanges entre modèles.

Corriger uniquement le vocabulaire du registre produirait une conformité fictive. À l’inverse, modifier directement ces méthodes sans unité transactionnelle, sans journal de structure et sans protocole de publication produirait un kernel intermédiaire dont les garanties ne seraient pas définies.

Le travail se déroule donc en deux niveaux distincts : **contrat opérationnel enregistré honnêtement**, puis **implémentation et preuve discriminante**. Une cible documentaire n’est pas une livraison. Tous les éléments actifs en aval doivent converger vers la théorie ; aucun ancien statut ni test ne constitue une dérogation. Les rapports et décisions historiques conservent leur contenu sans autorité concurrente.

## 2. Référentiel et contraintes du registre

**Les identifiants existants sont stables ; une citation n’est pas une preuve sémantique.** Le [guide de maintenance](../guides/INVARIANTS.md) et le [validateur](../../tools/invariants/invariants.ts) encadrent la migration.

### État initial observé, avant le premier lot

- Dix principes dans [principes.yaml](../invariants/principes.yaml), distincts des axiomes A0–A5.
- 91 entrées canoniques dans les dix branches : 42 `livre`, 27 `partiel`, 13 `cible`, neuf `convention`.
- Alias existants : I5, I12, I18, I24, I26, I47, I49 et I50.
- Prochain numéro annoncé : **I104**, dans la [référence opérationnelle](../spec/reference/invariants.md). I59–I62 restent réservés selon cette référence.
- Les constats **P01–P20 de la revue** ne sont pas les principes **P1–P10 du registre**. Ils ne deviennent jamais des parents YAML.

### Contraintes à respecter

| Élément | Contrat actuel de l’outil | Conséquence pour la migration |
| --- | --- | --- |
| Champs | `id`, `nature`, `parents`, `roles`, `alias`, `enonce`, `pourquoi`, `mode`, `etat`, `preuves` | Ne pas ajouter implicitement `source`, `theorie`, `supersedes` ou un autre champ rejeté par le validateur. |
| Nature | `E`, `C`, `D`, `V` | Distinguer obligation, conséquence, choix et mécanisme de contrôle ; une décision exige `pourquoi`. |
| Modes | `type`, `boot`, `type+boot`, `run`, `revue` | Scinder les obligations si leurs contrôles et états doivent être suivis indépendamment. |
| États | `livre`, `partiel`, `cible`, `convention` | Requalifier chaque contrat modifié à partir de sa réalisation réelle ; ne pas conserver `livre` par héritage. |
| Rôles | Application, Feature, Entity, Channel, View, Behavior, Composer, Foundation, ou `['*']` seul | Adaptateur, Manifest et infrastructure ne sont pas des rôles reconnus par l’outil. Employer un périmètre transversal explicite, ou faire évoluer séparément le schéma. |
| Parents | Identifiants connus du registre ; premier parent structure l’arbre | A0.d, G7, D12 et §2.7 sont des références théoriques, pas des parents valides. |
| Alias | Fusion de règles, pas succession générique | Ne pas transformer une décision inversée en simple alias. |
| Preuves | Fichiers existants et citations détectées dans les tests | Une ancienne citation d’I55 ne prouve pas sa future politique opposée. |

Les vues de [generated/](../invariants/generated/) sont des sorties : **ne jamais les éditer manuellement**. Leur régénération appartient au lot qui modifie effectivement le registre. Aucun nouveau numéro n’est attribué dans le présent plan ; le découpage atomique doit précéder la réservation.

## 3. Principes à réaligner

**Le registre opérationnel développe la théorie ; il ne constitue pas un second socle concurrent.** Lors du diagnostic, le commentaire de [principes.yaml](../invariants/principes.yaml) présentait encore leur hiérarchie comme ouverte. Le premier lot (§11) leur donne désormais un rattachement explicite au socle V0.9.4 ; le tableau suivant conserve les objectifs de cet alignement.

| Principe | Réalignement attendu |
| --- | --- |
| P1 — Souveraineté du domaine | Conserver l’autorité exclusive de la Feature sur son Entity ; distinguer état validé, copie de présentation et brouillon. Une copie n’est pas une autorité métier. |
| P2 — Dépendances déclarées | Inclure modes, faits admis, traitements locaux, résultats/bilans d’effets, dépendances initiales et protocoles de source de D16. |
| P3 — Trois voies | Employer Query dans la norme ; action sans réponse, connaissance avec réponse et lecture seule transitive ; local hors interaction intercomposants. Ne pas décider ici seul du renommage public de `request()`. |
| P4 — Causalité | Remplacer la reconstruction absolue jusqu’à l’action d’origine par les déclenchements observables ; antécédent inconnu explicite ; borne des segments connus seulement. |
| P5 — Projection | Employer interface utilisateur ; D18 suit une permission liée au déclencheur, pas le seul nom du handler ; état local possible sur Event sans Command. |
| P6 — DOM | Propriété des ressources du modèle et autorité d’effet sur le support extérieur, dans les parts soustraites ; ne pas attribuer littéralement le support hôte au composant. |
| P7 — Existence | Existence unique, parent propriétaire de l’existence, cascade finie enracinée ; existence et fin de la racine extérieures. |
| P8 — Identité | Distinguer identité et namespace textuel ; Manifest par racine, adaptateurs et périmètres déclarés, dépendances initiales et borne disponibles. |
| P9 — Gardes | Garde au plus tôt ou justification de non-vérifiabilité et revue ; ne pas promettre une vérification automatique universelle. Séparer gardes applicatives et tests de conformité de l’infrastructure. |
| P10 — Rôles | Règle de méthode ; Entity et Behavior ne sont pas des composants et leurs opérations sont imputées respectivement à Feature et View. |

## 4. Contrats existants à corriger

**Une règle inversée doit être identifiée comme rupture, pas comme simple précision.** Les groupes ci-dessous conservent les écarts relevés au diagnostic initial ; le §11 précise les contrats et états effectivement corrigés depuis. Les autres groupes restent à traiter.

| Branche | IDs concernés | Écart et cible |
| --- | --- | --- |
| [P3](../invariants/P3.yaml) | I29, I55, I65 | `null` technique et confinement de l’exception contraires à G7. Query synchrone, erreur propagée, pas de réponse de substitution ; `null` métier déclaré reste possible. |
| [P3](../invariants/P3.yaml) | I17, I64 | Lecture seule transitive : ni mutation/création/destruction, ni effet, ni Command/Event/local ; Queries imbriquées conformes permises. |
| [P3](../invariants/P3.yaml) | I25, I13, I4 | Ne pas réserver globalement toute Command à View/Behavior : une Feature peut commander un adaptateur du domaine. D18 borne toute l’interface ; Composer toujours sans Command. |
| [P3](../invariants/P3.yaml) | I10, I1, I3, I27 | Généraliser au propriétaire du Channel, adaptateurs compris ; Command sans réponse et refus possible ; Event sur ressource propre, sans promettre le succès du traitement de chaque abonné. |
| [P4](../invariants/P4.yaml) | I7, I8, I9, I54 | Origine non exclusivement UI ; qualification par l’infrastructure, conservation corrélée et clôture ; D9 avant soumission, refus transactionnel dans l’unité ou abandon technique au préambule. |
| [P2](../invariants/P2.yaml) | I14, I16, I70 | Déclarations D16 complètes ; namespace déclaré et Channel établi ne rendent pas une cible prête. |
| [P6](../invariants/P6.yaml) | I35, I38 | Remplacer « aucune écriture Composer » par composition structurelle seule, sans rendu de présentation ni état indépendant ; résultats propres instrumentés admis. |
| [P6](../invariants/P6.yaml), [P7](../invariants/P7.yaml) | I33, I34, I28 | Élément Foundation configurable et borné ; Feature de navigation distincte de l’adaptateur historique ; ne plus attribuer History à la Feature Router. |
| [P6](../invariants/P6.yaml) | I99, I40, I31, I39, I58 | Parts, soustraction, désignations et durée d’attribution ; slot : élément à la View, contenu au Composer. Création après amorçage possible ; ne pas confondre retrait physique et suspension logique. |
| [P6](../invariants/P6.yaml) | I43, I44, I45 | Behavior sans propriété autonome ; clés disjointes entre tous Behaviors et View, éléments communs possibles ; une admission puis réactions dans l’ordre déclaré. |
| [P7](../invariants/P7.yaml) | I19, I20, I36, I37 | Seul un Composer est parent de Views ; Foundation et Views créent des Composers. Création/destruction, parts et abonnements entrent dans une unité annulable. |
| [P5](../invariants/P5.yaml), [P9](../invariants/P9.yaml) | I56, I66 | Queries initiales conformes autorisées ; frontière de confiance = admissions, pas bootstrap seul ; disponibilité ordonnée et publication collective. |
| [P1](../invariants/P1.yaml) | I30, I46, I97, I51, I96, I98 | Préserver mécanismes valides sans les surinterpréter : JSON n’est pas copie ; rollback de recipe n’est pas rollback d’unité ; FIFO Entity n’est ni file transport ni D9. Examiner l’isolation des handlers au regard de G7. |
| [P10](../invariants/P10.yaml), [P9](../invariants/P9.yaml) | I100, I102 | Rôles non tous composants ; erreurs d’unité distinctes des erreurs d’effets et traces techniques. Fail-fast ne signifie ni rollback hôte ni message d’erreur contournant D9. |

Le tableau est une carte de travail, pas une preuve que chaque groupe doit rester dans son fichier actuel. Vérifier les parents principaux avant tout déplacement, notamment pour I58 et les spécialisations croisées.

## 5. Couverture des protocoles transversaux

**Les exigences générales absentes doivent devenir des entrées identifiables, non être enfouies dans une ligne trop large.** Le découpage ci-dessous constitue des familles de contrats à atomiser avant numérotation.

| Source V0.9.4 | Raccords existants | Obligations à enregistrer et critère discriminant |
| --- | --- | --- |
| A0.d, A1, A2, T3 | I6, I19, I20, I99 | Existence unique, propriétaire actuel, structure finie enracinée ; propriété immuable ; attribution aux enfants, restitution sans transfert et cascade bas en haut. A détruisant B n’acquiert aucune autorité sur les ressources de B/C. |
| §2.7.1, G5 | I29, I56, I66, I70 | Cible prête et inactive ; dépendances initiales, cycles refusés, états prêts provisoires et publication de l’unité. B non prête mais Channel présent : refus sans attente ni initialisation implicite. |
| §2.7.2, G3/G8 | I19, I20, I54, I58 | Occurrence de vie non réutilisable ; contrôle avant admission/délivrance ; destruction provisoire, callbacks tardifs, clôture causale. Ancienne View remplacée : aucun rappel transféré. |
| §2.7.3, G7 | I35, I38, I97, I102 | Préparation puis engagement après validation ; premier échec synchrone arrête le suffixe non tenté ; résultats propres déclarés et routés au composant vivant concerné. B dépendant d’un succès de A préparé seulement au traitement de ce résultat. |
| §2.7.4, A5/G8 | I7, I8, I9, I54 | Unité de fait fixée par source ; admission au plus une fois ; préambule sans mutation ; corrélé/indépendant établi/inconnu exclusifs ; D19 conserve la qualification, jamais une heuristique de dernier effet. |
| §2.7.5, G2 | I17, I29, I46, I64, I81 | Observation intégrée seule consultable ; rafraîchissement par action ; capture des messages, paramètres et réponses sans alias mutable. Modifier la copie auteur après soumission ne change pas la valeur reçue. |
| §2.7.6, G1/G3, D8 | I11, I2, I81, I82 | Occurrence d’abonnement réservée à l’émission ; survie contrôlée ; S′ ne reprend aucun ancien Event de S ; annulation conservant S et sa réservation. |
| G4 | I15 | Infrastructure ni propriétaire de ressources du modèle ni interlocuteur fonctionnel ; matérialiser un Channel ne donne pas sa propriété. |
| G6 | P2, P8, identité | Messages et réponses isolés par racine ; mêmes namespaces dans deux modèles sans partage de Channel fonctionnel. |
| G7, §2.5 | I97, I55 | Unité de rollback incluant mutations, créations, destructions, attributions, restitutions et abonnements ; différés abandonnés, Queries exécutées conservées dans la trace, aucun rollback extérieur. |
| A3.f, G1, T2 | I10, I11, I27 | Une catégorie de transport immuable par occurrence ; routage propriétaire/abonnés/auteur du local ; réponse au seul demandeur. |
| A4.e, T6 | I22, I28 | Continuité du domaine propriétaire d’un Channel jusqu’à la fin de racine, sans la confondre avec disponibilité ou progression générale. |

Les [scénarios des vingt points](../gardes.md#couverture-des-vingt-points-de-revue-v094) restent les critères documentaires de référence. Les nouvelles entrées devront distinguer obligation de sûreté, décision de profil et mécanisme choisi pour la garantir.

## 6. État observé du kernel

**Les faits suivants décrivent le code inspecté, pas des résultats de tests.** Ils permettent de localiser les changements sans imposer prématurément une architecture de classes interne.

| Source | Comportement présent | Limite pour V0.9.4 |
| --- | --- | --- |
| [Channel](../../packages/event/src/channel.class.ts) | `trigger()` appelle directement son handler ; `emit()` utilise immédiatement `Subject.next()` ; `request()` retourne `null` sans replier ou après exception ; listeners isolés par `try/catch`. | Ni file transactionnelle ni contrôle de disponibilité/pile active ; mutation d’un destinataire défaillant non restaurée par ce confinement. Charges et réponses passent par référence. |
| [Radio](../../packages/event/src/radio.singleton.ts) | Singleton, Channels indexés par namespace et créés à la demande. | Pas d’isolation de racine ni distinction résolution déclarée/création implicite. Un singleton technique peut rester, mais son espace de routage doit être scindé par modèle. |
| [Application](../../packages/application/src/bonsai-application.ts) | Validation déclarative, Channels puis bootstrap séquentiel des Features puis Foundation. | Pas de graphe de dépendances initiales, publication collective ni annulation complète de l’amorçage échoué ; indicateur de démarrage positionné avant la fin. |
| [Feature](../../packages/feature/src/bonsai-feature.ts) | Enregistrement des handlers, initialisation et notifications Entity ; exceptions des notifications isolées. | Pas d’unité transactionnelle englobante ni de déclaration/traitement général des résultats locaux instrumentés. |
| [Entity](../../packages/entity/src/bonsai-entity.ts) | Immer protège une recipe en échec ; état appliqué avant notifications ; FIFO de réentrance locale. | Pas de restauration de l’ensemble du traitement si une erreur suit une mutation réussie ; patches inverses non employés comme journal d’unité. |
| [Composer](../../packages/composer/src/bonsai-composer.ts) | Résolution et montage immédiats, conservation de l’instance si sélection identique ; destruction actuelle retirant surtout les références. | Pas de clôture transactionnelle, démontage complet ou restitution instrumentée ; pas de séparation composition logique/matérialisation. |
| [View](../../packages/view/src/bonsai-view.ts) | Résolution DOM globale, écritures immédiates, handlers DOM directs et abonnements non conservés pour une destruction complète. | Confinement structurel incomplet, aucune admission locale ou permission dynamique D18, aucune préparation d’effets. |
| [Foundation](../../packages/foundation/src/bonsai-foundation.ts) | Capture directe du document/body et montage immédiat des Composers. | Autorité non bornée au seul élément admis ; pas de protocole collectif de fin de vie et de résultats propres. |

Le champ optionnel `meta`, pouvant contenir un `correlationId` fourni par l’appelant dans les événements Entity, ne réalise pas G8. Le contrôle des doublons de handlers ne réalise pas la propriété générale. La sérialisabilité de l’Entity ne réalise pas la capture G2. Aucun de ces rapprochements ne doit justifier un état `livre` sur les nouvelles obligations.

## 7. Successions et décisions préparatoires

**Une décision acceptée n’est pas réécrite rétroactivement pour effacer une incompatibilité ; elle ne peut pas non plus bloquer l’application de la théorie validée.** Le diagnostic initial avait relevé que l’[index ADR](../adr/README.md) prescrivait encore la réécriture en place. Sa règle de gouvernance est désormais alignée sur le [README courant](../README.md#règle-de-confiance-et-dalignement) : conservation historique et succession explicite. Ce raccord ne réalise pas encore les successions individuelles ni la migration des contrats.

| Décision actuelle | Traitement à préparer |
| --- | --- |
| [ADR-02](../adr/ADR-02-request-synchrone.md), [ADR-03](../adr/ADR-03-channel-runtime.md), [ADR-05](../adr/ADR-05-propagation-erreurs.md) | Succession pour erreur Query sans `null` technique, temporalité différée et rollback de l’unité ; distinguer échec d’un destinataire et réussite passée de l’émetteur. |
| [ADR-04](../adr/ADR-04-metas-explicites.md) | Succession des règles d’origine et d’autorisation causales ; passage explicite des métadonnées conservable, mais qualification et contexte contrôlés par l’infrastructure. |
| [ADR-07](../adr/ADR-07-application-bootstrap.md) | Compléter/remplacer le protocole de bootstrap : disponibilité, dépendances, états provisoires et abandon collectif. Ne pas effacer les preuves de l’ancien ordre de phases. |
| [ADR-13](../adr/ADR-13-router.md) | Succession pour séparation état de navigation / adaptateur historique et activation au Manifest. |
| [ADR-18](../adr/ADR-18-composer.md), [ADR-20](../adr/ADR-20-foundation.md) | Succession des interdictions/droits trop généraux : composition structurelle du Composer, source Foundation bornée, résultats propres autorisés sans source générale. |
| [ADR-31](../adr/ADR-31-strates-perimetre-v1.md) | Faire évoluer explicitement le plan gelé de livraison ; conserver gates kernel-first sans déclarer V0.9.4 déjà couverte par la strate 0 historique. |
| [ADR-10](../adr/ADR-10-entity-mutation.md), [ADR-11](../adr/ADR-11-entity-schema-valibot.md) | Immer et schéma sans transformation restent utilisables. Succession si les décisions sur FIFO, isolation des handlers ou frontière de validation changent ; ne pas prétendre que le rollback recipe suffit à G7. |
| [ADR-14](../adr/ADR-14-contrats-types.md) | Extension des déclarations et dépendances ; succession seulement si le choix public existant change. Distinguer défaut de réalisation et nouvelle décision. |
| [ADR-12](../adr/ADR-12-entity-intent-typing.md) | Proposed : question non acceptée, pas une décision historique à faire succéder ; ne pas bloquer le socle d’exécution sur ce sujet indépendant. |

Les nouvelles décisions de réalisation doivent comparer au moins deux options compatibles avec la théorie, leurs conséquences, et les critères Performance, Complexité, DX, Maintenabilité et Type-safety. Un comportement déjà exclu par la théorie peut être documenté comme ancien choix rejeté, jamais comme option encore admissible. Une succession imposée par la théorie constate cette obligation sans simuler un nouvel arbitrage. Le présent rapport identifie les besoins ; il ne tient pas lieu de ces ADR et n’attribue pas leurs numéros.

## 8. Lots de migration et portes de sortie

**Transport, validation et durée de vie sont conçus ensemble, puis livrés par incréments verticaux.** Les lots suivants sont un ordre proposé, pas une nouvelle strate officiellement acceptée.

| Lot | Périmètre | Porte de sortie |
| --- | --- | --- |
| M0 — Contrats et gouvernance | Principes, ruptures du registre, successions ADR, modèle de preuves ; ni code ni API nouveaux implicites. | Chaque exigence a un rattachement théorique, un état justifié et un scénario ; aucune citation historique présentée comme preuve du contrat inversé. |
| M1 — Noyau par racine | Conception commune de l’unité, contexte de traitement, pile Query, capture, file et réservations ; identité de racine et transport sans création implicite. | Tests isolant deux modèles ; Query prête/inactive ; erreur propagée ; Event avant réservations ; mécanisme d’abandon d’unité défini avant publication du scheduler. |
| M2 — État et amorçage | Entity rattachée au journal d’unité ; validation aux frontières ; dépendances initiales ; publication et échec d’amorçage. | Mutation réussie puis exception restaurée ; Query intermédiaire ne validant pas son auteur ; amorçage tardivement échoué sans publication partielle. |
| M3 — Structure transactionnelle | Existence, parts, cascade, création/destruction provisoires, occurrences de vie et abonnements. | Annulation conservant mêmes instances, parts et réservations ; aucune réanimation ni réattribution de callback tardif ; restitutions imputées bas en haut. |
| M4 — Effets et admissions | DOM logique avant matérialisation, effets engagés après validation, bilans et résultats propres ; capture/admission/intégration séparées. | Effet 2 en erreur, effet 3 non tenté ; résultat d’enfant non transféré ; échec extérieur ne révoquant pas le passé ; callback détruit abandonné. |
| M5 — Causalité et permissions | Trois qualifications, source déclarée, D9/D18/D19 ; intégrer le contrôle D9 au transport conçu en M1. | Aucun parent inventé, lien connu effacé ou permission blanchie ; D9 pendant unité et au préambule discriminés ; Query conservant la permission de son auteur sans l’accorder à son traitement. |
| M6 — Intégration et catalogue | Contrats publics, fixtures, parcours Cart, remplacement, multiracine ; adaptateurs déclarés suivant les mécanismes stabilisés. | Parcours nominaux et d’échec couverts ; états du registre et de livraison mis à jour sur résultats réels, build et vues générées cohérents. |

M1 doit prévoir dès la conception les interfaces nécessaires à M2–M5, sans prétendre livrer leurs garanties avant leur intégration. Un changement de temporalité ne signifie pas obligatoirement une Promise ni un nouveau tour de boucle : la frontière normative est la validation, pas une technique particulière d’ordonnancement.

## 9. Tests discriminants à préserver ou introduire

**Les tests historiques gardent leur valeur sur leur contrat d’origine, mais certains attendus doivent changer.** Il faut modifier explicitement les assertions incompatibles, pas simplement ajouter une citation V0.9.4.

| Corpus existant | Apport présent et limite | Scénario cible |
| --- | --- | --- |
| [Channel strate 0](../../tests/unit/strate-0/channel.basic.test.ts), [Channel général](../../tests/unit/channel.class.test.ts) | Unicité, diffusion, synchronisme et `null` ; un cas général admet un replier asynchrone. | Refus Promise, absence de replier technique signalée ; aucune substitution `null` ; délivrance après validation et capture profonde. |
| [Radio](../../tests/unit/radio.singleton.test.ts) | Singleton et identité par nom, sans isolation de modèle. | Même namespace dans deux racines sans communication croisée ; singleton technique éventuel sans identité fonctionnelle globale. |
| [Gate Cart](../../tests/e2e/strate-0.cart-round-trip.test.ts) | Parcours nominal et DOM final, sans démonstration de transaction ou causalité. | Conserver le résultat nominal après clôture d’unité ; ajouter parcours d’échec, remplacement de View et racines indépendantes. |
| [Tests Entity/Feature](../../tests/unit/strate-1/) | Recipes, notifications et FIFO internes ; pas preuve d’une unité complète. | Plusieurs mutations puis échec, structure provisoire et Query imbriquée ; isolation conforme par unité du destinataire. |
| [Tests de types](../../tests/types/) | Capacités et noms refusés statiquement. | Compléter déclarations, lecture seule et APIs autorisées sans prétendre prouver capture, état physique ou causalité par types seuls. |

Scénarios transversaux indispensables :

1. A émet, puis échoue : aucune délivrance issue de son unité ; Queries exécutées toujours tracées.
2. A → Query B → Query A : refus, sans attente ni réentrance ; B non prête refusée aussi.
3. Un Event réserve S, puis S est remplacé par S′ : aucun ancien Event pour S′ ; annulation de la destruction conserve S.
4. Auteur ou premier abonné modifiant un objet : valeurs capturées des autres inchangées ; mêmes exigences pour paramètres de création et réponses.
5. View détruite puis recréée au même emplacement : anciens locaux et callbacks non transférés.
6. Résultat corrélé, indépendance établie et notification inconnue restent distincts ; Event → effet → résultat n’accorde aucune Command UI.
7. Support modifié sans traitement d’admission : Query renvoyant l’observation antérieure ; rafraîchissement par action.
8. D9 dans un traitement : rollback et effets préparés abandonnés ; D9 au préambule d’un résultat post-validation : abandon technique sans révocation du passé.
9. Composer/Foundation : résultats propres déclarés admis, notifications générales refusées ; Composer sans Command ni état indépendant.
10. Clic/focus hors View sans admetteur autorisé : hors V1, sans écouteur global improvisé. Le protocole général 18.30 reste ouvert.

Lors d’une passe de développement, exécuter les contrôles du [guide](../guides/INVARIANTS.md) : registre et vues générées, tests runtime pertinents, vérification des tests de types, puis build si les sources de packages changent. Les commandes et sorties réelles devront être consignées au lot livré. **Aucun de ces tests n’a été exécuté pour ce diagnostic.**

## 10. Prochaine modification du registre

**Le premier changement doit rendre les contradictions visibles sans mélanger cible et livraison.** Ordre concret de M0, engagé partiellement au §11 :

1. réaligner les commentaires d’autorité et les dix principes sur la théorie, en conservant leurs IDs ;
2. corriger d’abord I29/I55/I65 et I35/I38, avec nouveaux énoncés, justifications et états fondés sur l’audit ; garder trace de la rupture historique ;
3. préciser I7/I8/I9/I54, I13/I25, I20/I33/I34/I28/I66 et leurs parents ;
4. atomiser les obligations nouvelles du §5 avant d’attribuer des numéros à partir du prochain ID réellement libre ; ne pas regrouper plusieurs mécanismes et états incompatibles dans un invariant géant ;
5. aligner la référence manuelle, les gardes et la traçabilité, puis régénérer les vues avec l’outil existant ;
6. vérifier que le validateur ne confond pas l’existence d’une citation avec une preuve sémantique actualisée ; conserver les tests de l’ancien comportement comme trace historique dans git, sans les qualifier de preuves de la cible ;
7. préparer les ADR de succession et le contrat du socle d’exécution avant de modifier le runtime.

Le maintien d’un état `partiel` doit décrire précisément la portion encore réalisée ; `cible` décrit l’exigence non réalisée. `convention` ne doit pas servir à masquer une garde dynamique obligatoire mais absente. La lecture stricte de chaque énoncé et de ses assertions décide, pas la volonté de conserver un bilan vert.

**Bilan initial : le registre peut conserver ses identifiants et une grande partie de ses mécanismes locaux. Il doit abandonner les garanties historiques incompatibles et enregistrer explicitement les obligations transversales manquantes avant toute déclaration de conformité V0.9.4 du code.**

## 11. Premier lot appliqué — 30 octobre 2026

**Ce lot aligne des contrats ; il ne livre aucun mécanisme runtime.** Les identifiants restent inchangés et aucun nouvel invariant n’est créé. M0 reste partiel : le reste des branches, les contrats dédiés et les successions individuelles d’ADR ne sont pas déclarés alignés.

### Modifications réalisées

- [Principes](../invariants/principes.yaml) : P1–P10 rattachés explicitement à la théorie V0.9.4, avec fondements en commentaires YAML. Les principes ne constituent ni des axiomes concurrents ni des obligations universellement prouvées par types.
- [Branche P3](../invariants/P3.yaml) : résultat Query déclaré sans Promise ni `null` technique (I29), propagation et échec d’unité G7 (I55), signalement causal obligatoire hors réponse et transport applicatif (I65). Un résultat métier déclaré peut rester nullable ; une API `ErrorReporter` particulière n’est pas imposée.
- [Branche P6](../invariants/P6.yaml) : composition structurelle seule et résultats propres instrumentés du Composer (I35), droits bornés aux parts et imputation du Behavior à sa View (I38). Les spécialisations historiques contraires restent des écarts, jamais des exceptions.
- [Référence manuelle](../spec/reference/invariants.md) : énoncés, matrice des cinq règles, portée des gardes et avertissement de migration actualisés. [Copie I55](../spec/6-transversal/conventions-typage.md#6-invariants-de-contrats-typescript-i46i56) corrigée.
- [Arbre](../invariants/generated/arbre.md) et [vues par rôle](../invariants/generated/roles/README.md) régénérés par l’outil existant, sans édition manuelle.

Les cinq entrées passent de la nature `D` à **`C`** : leurs obligations sont imposées par la théorie validée, non des choix de réalisation révisables indépendamment d’elle. Les justifications restent enregistrées. Les modes d’I35 et I38 deviennent `run` pour les contrôles dynamiques des parts et de la composition ; cette qualification décrit le contrôle requis, pas une garde déjà livrée.

| ID | État initial | État après le lot | Justification |
| --- | --- | --- | --- |
| I29 | `livre` | `partiel` | Appel direct présent, mais Promise acceptée, absence et exception encore converties en `null`. |
| I55 | `livre` | `cible` | L’erreur est encore absorbée ; aucune unité de rollback englobante n’est livrée. |
| I65 | `partiel` | `cible` | La journalisation existante n’établit aucun signalement avec contexte causal conforme. |
| I35 | `livre` | `partiel` | Décision 0/1 View et absence de `trigger` présentes ; attributions/restitutions annulables, retrait complet et résultats propres absents. |
| I38 | `partiel` | `partiel` | Projection View et montage Composer présents ; contrôle complet des parts, Foundation bornée/configurable et Behavior absents. |

Le bilan devient **91 entrées : 39 `livre`, 28 `partiel`, 15 `cible`, neuf `convention`**. Cette baisse du nombre livré corrige le périmètre des affirmations ; elle n’est ni une régression du runtime inchangé ni un audit achevé des 86 autres entrées. Le prochain numéro reste I104.

### Contrôles effectués

- Contre-lecture des cinq contrats et des principes contre la théorie et les mécanismes inspectés ; corrections du signalement causal I65 et de l’unicité des fonctions P10.
- `pnpm invariants` : réussite, 91 lignes et dix branches, arbre et neuf vues par rôle générés.
- `pnpm invariants:check` : réussite, sans erreur ni avertissement affiché.
- Aucun test runtime, test de types ou build exécuté pour ce lot documentaire ; aucune source de package modifiée.

Les marques `R`/`T` des vues générées restent des **citations détectées**, pas une certification du nouvel énoncé. En particulier, les anciens tests d’absorption d’erreur I55 vérifient encore un comportement à remplacer. La suite de M0 porte sur les autres contrats prioritaires du §10, les obligations transversales manquantes et l’alignement des spécifications dédiées, sans rouvrir les obligations théoriques.

## 12. Lot 2 — Causalité et permissions

**L’alignement documentaire ne réalise pas le protocole causal dans le code.** Ce deuxième lot, du 30 octobre 2026, traite I7/I8/I9/I54/I13/I25 ; les états des deux lots sont cumulatifs, sans nouvel identifiant ni modification des sources runtime. Les modifications utilisateur déjà présentes dans la théorie et les autres documents sont préservées.

### Contrats et copies réalignés

| ID | Contrat actuel | Qualification après le lot |
| --- | --- | --- |
| I7 | Contexte de chaque Command, Query, Event et local ; un parent établi hors origine, qualification explicite de l’origine ; réponse sans contexte propre. | `E`, `run`, `cible` ; ancien mode `boot` insuffisant. |
| I8 | Démarrage établi et admissions qualifiées par protocole sous contrôle de l’infrastructure ; corrélé, indépendant établi ou inconnu, sans invention ni effacement ; D19 conserve la qualification. | `C`, `run`, `cible` ; origine non réservée à l’UI. |
| I9 | Borne du Manifest commune à la racine ; contrôle avant soumission, Event avant réservations ; refus G7 dans l’unité ou abandon technique au préambule, sans révocation du passé. | `C` au lieu de `D`, `run`, `cible` ; profondeur des segments connus, pas garantie générale anti-boucle. |
| I54 | Établissement et dérivation par l’infrastructure, propagation explicite sans fabrication applicative, conservation liée aux opérations et occurrences de vie, restitution à l’auteur après Query. | `D`, `run`, `cible` ; `D` conservé pour le choix compatible de propagation explicite, ancien mode `type` insuffisant. |
| I13 | Permission dynamique D18 dans toute l’interface ; Query préalable sans création de permission, Event et origine inconnue sans droit de Command. | `C`, `run`, `cible` au lieu de `revue`/`convention` ; aucune garde dynamique livrée. |
| I25 | Capacités selon les parties ; Feature vers adaptateur domaine permise, pas vers autre Feature ; domaine isolé des adaptateurs UI, Behavior imputé à View et Composer sans Command. | `C`, `run`, `partiel` ; capacité View présente, adaptateurs et contrôles dynamiques absents. |

Les six règles utilisent désormais `roles: ['*']` : leur portée couvre tous les rôles concernés, y compris les adaptateurs que le schéma ne connaît pas comme rôle distinct. Les énoncés restent conditionnés par la partie et la fonction ; ce périmètre transversal n’accorde aucune Command à tous les composants. Les IDs, parents et alias sont conservés.

Les [branches P4](../invariants/P4.yaml) et [P3](../invariants/P3.yaml), la [référence manuelle](../spec/reference/invariants.md) et la [copie I54](../spec/6-transversal/conventions-typage.md#6-invariants-de-contrats-typescript-i46i56) sont alignées. La [spécification des métadonnées](../spec/2-architecture/metas.md) est réécrite sous l’autorité théorique, sans pseudo-API : les anciennes origines créées à chaque `trigger()` ou minuterie sont retirées, les principales sections de navigation conservées. Les signatures exactes et la représentation des métadonnées restent à concevoir ; les obligations G8/D9/D18 ne sont pas ouvertes pour autant. Aucun ADR Accepted n’est réécrit.

### Scénarios discriminants requis pour la réalisation

1. Une même occurrence propagée entre écouteurs ne crée pas plusieurs origines ; résultat corrélé et notification générale restent distincts. Dernier effet, temps proche, valeur égale ou `isTrusted` seul ne prouvent aucun parent.
2. Minuterie armée une fois : expirations sœurs ; réarmements successifs : profondeur croissante, sans nouvelle origine fabriquée. D19 conserve le contexte et la qualification de la notification sélectionnée.
3. Command, Query, Event et local dépassant la borne dans l’unité : échec G7, opérations internes restaurées, différés abandonnés et effets préparés non engagés. Un Event est contrôlé avant toute réservation, sans profondeur supplémentaire par abonné.
4. Résultat post-validation dépassant la borne au préambule : abandon technique sans exécution applicative, révocation du passé ou message de contournement. Message déjà accepté : aucun contrôle D9 reporté à sa délivrance.
5. View autorisée → Query → Command : permission conservée chez la View, aucune dans le traitement consulté. Event → local → effet corrélé → résultat, ou observation inconnue : aucune permission nouvelle de Command UI.
6. Feature → adaptateur du domaine déclaré : capacité admise ; Feature → autre Feature ou adaptateur UI : refus. Composer : Command toujours interdite, y compris sur résultat propre. Behavior : auteur imputé à la View.
7. Résultat après échec encore corrélable : contexte conservé ; résultat après clôture de l’occurrence : abandon sans transfert à un remplaçant. Une opération répétitive conserve son contexte jusqu’à annulation ou clôture.

Ces scénarios sont des critères de réalisation, pas des tests déclarés exécutés. Le code `Channel`, `View`, `Feature` et `Entity` a été relu sur le périmètre des capacités/metas ; les citations historiques des tests de types ne prouvent pas ces contrats élargis.

### Bilan et limites

Le bilan devient **91 entrées : 39 `livre`, 28 `partiel`, 16 `cible`, huit `convention`**. La seule transition d’état de ce lot est I13, de convention à cible : une obligation dynamique absente ne doit pas être présentée comme une simple règle de revue. Les cinq autres états sont conservés, sans présomption de conformité des 80 entrées hors des deux lots.

Contrôles du lot : contre-revue en lecture seule sans erreur confirmée ; `pnpm invariants` puis `pnpm invariants:check` réussis, sans avertissement affiché ; décomptes YAML vérifiés ; `git diff --check` sans erreur. Vérification de 242 références locales dans les cinq documents contrôlés, ancres comprises, sans erreur ; aucun renvoi actif cassé vers les ancres de la spécification des métadonnées hors archives et notes de réorganisation. Les diagnostics de l’éditeur ne signalent plus de problème après correction du remplacement de cette spécification. Aucun test runtime, test de types ou build exécuté ; aucun fichier de packages, du core, des tests ou de l’outillage modifié.

Le lot suivant est **propriété et cycle de vie** : parenté, création/destruction des Views et Composers, élément Foundation, durée d’attribution et imputation du Behavior. Les contrats déclaratifs, obligations transversales manquantes et consolidation restent ensuite à traiter ; M0 n’est pas terminé.

## 13. Lot 3 — Propriété et cycle de vie

**Ce lot documentaire du 30 octobre 2026 ne réalise ni propriété contrôlée, ni destruction transactionnelle dans le runtime.** Quatorze contrats existants sont réalignés ; leurs identifiants, parents et alias restent stables. Aucun numéro n'est créé : I104 reste le prochain libre. Les modifications préexistantes, notamment celles de la théorie et de la revue historique, sont préservées.

### Contrats et états

| IDs | Contrat réaligné | État après le lot et limite réelle |
| --- | --- | --- |
| I19, I20, I36 | View enfant exclusivement de Composer ; Foundation et View parents exclusivement de Composers ; le parent possède l'existence de ses enfants, jamais une autorité fonctionnelle générale sur leurs ressources. | `partiel` : montage et absence d'API de composition directe dans View ; constructeurs/montage publics, slots enfants et cascade complète non contrôlés. |
| I37 | Un type d'API Composer pour 0..N Views, sous les contraintes de parts disjointes. | `partiel` : type unique et 0/1 View livrés. Le choix reste actif dans le registre, sans être une nécessité théorique ; tableau et rapprochement multi-Views non livrés. |
| I99, I40 | Foundation dans son élément admis, Composer dans le contenu attribué du slot, View dans sa part ; soustraction des portions attribuées. Élément du slot conservé par le parent, pas son contenu attribué. | `partiel` : résolution locale et projection présentes ; aucun contrôle complet des parts et de leur durée. |
| I34, I31 | Racine View dans la part attribuée par son Composer ; désignation fournie à création, résolution contrôlée pour cette attribution, jamais élément hôte passé à l'enfant. | `partiel` : chaîne CSS fournie, mais recherche globale et absence de contrôle d'attribution. **I34 passe de `livre` à `partiel`** ; le refus de `body` ne prouve pas ce confinement général. |
| I58 | Attribution du Composer liée à son occurrence de vie, non au bootstrap ou à la présence physique du slot ; aucun transfert, déplacement ou réactivation implicite. | `cible` : protocole d'attribution, d'occurrence et de destruction absent. Réutiliser l'emplacement ne réactive pas la désignation antérieure. |
| I33 | Une Foundation par racine, élément configuré au Manifest, `body` par défaut ; aucune autorité globale sur `html`, `document` ou `window`, résultats propres seulement selon §2.7.3. | `partiel` : ancrage `body` et refus du second `attach()` par instance ; configuration, isolation et confinement absents, `html` encore exposé. |
| I32 | View sans droit de détruire/remplacer sa racine ; avant retrait d'un élément slot, destruction du Composer et restitution de son contenu. | **`convention` → `cible`** : obligation dynamique, pas simple recommandation de revue ; accès brut et absence de cascade empêchent sa garantie. |
| I43, I44, I45 | Behavior partie du code View, sans existence, identité ou part propres ; aveuglement du code, clés de tous les fragments disjointes, éléments communs possibles, admission unique par View. | `cible` : aucun package Behavior ni agrégation, contrôle des noms, état imputé, admission unique ou orchestration des réactions livré. |

Sept natures `D` deviennent `C` : I20/I36/I58/I44/I33/I32/I45 expriment des obligations théoriques. I31 conserve `D` pour le choix de représentation CSS compatible, I37 pour le choix d'une API unique de multiplicité ; I19/I99 restent `E`, les autres restent `C`. Les contrôles sont qualifiés `run`, sauf I37 et I44 (`type`) et I43 (`boot`, pour la disjonction des déclarations ; l'admission unique reste une obligation d'exécution également portée par I45 et les spécifications). Ces modes ne prétendent pas qu'une garde soit livrée.

### Spécifications et copies

- [P6](../invariants/P6.yaml), [P7](../invariants/P7.yaml) et [référence manuelle](../spec/reference/invariants.md) : énoncés, modes, états, matrices, alias et limites synchronisés ; retrait de l'exception Foundation sur `html`/`body` dans la copie I39, sans prétendre traiter tout son contrat d'accès brut.
- [Cycle de vie](../spec/2-architecture/lifecycle.md) : existence logique distincte du montage, cascade de bas en haut sans traitement applicatif, restitution imputée au propriétaire encore vivant, rollback structurel commun, nettoyage physique post-validation ; occurrences et réservations non réutilisables explicités.
- [Foundation](../spec/4-couche-concrete/foundation.md), [Composer](../spec/4-couche-concrete/composer.md), [Behavior](../spec/4-couche-concrete/behavior.md) et [index concret](../spec/4-couche-concrete/README.md) : contrats incompatibles remplacés, sans inventer de signatures cibles. Les API et hooks réellement présents sont distingués des mécanismes à concevoir.
- [View](../spec/4-couche-concrete/view.md) : sections d'ancrage, création/destruction, slots, composition, Behavior et raccords de l'état local corrigés. Ses autres exemples et contrats historiques ne sont pas déclarés intégralement audités.
- [Arbre](../invariants/generated/arbre.md) et [vues par rôle](../invariants/generated/roles/README.md) régénérés automatiquement, sans édition manuelle. Les marques de citations ne prouvent pas les nouveaux contrats.

La disparition du DOM n'est plus prescrite comme détecteur normal de destruction après coup. Le nettoyage irréversible ne précède pas la validation, et aucun `onDetach()` applicatif n'est requis pendant la cascade. Les effets hôte peuvent échouer partiellement après validation : ni rollback DOM ni transaction extérieure n'est promis. Les résultats instrumentés propres de Foundation et Composer restent autorisés, sans source générale ni Command Composer.

**Hors lot :** I67 conserve son contrat historique de stabilité Foundation ; les pages concernées le signalent comme choix à réexaminer, pas conséquence de sa persistance. I28 et la navigation, les autres contrats déclaratifs, les entrées transversales atomiques manquantes, les guides et index généraux ainsi que les successions individuelles d'ADR restent à traiter. Aucun ADR Accepted n'est modifié et aucune conformité globale du corpus n'est annoncée.

### Scénarios discriminants pour la réalisation

1. Une désignation de View ou Composer cesse avec son attribution ; un nouvel occupant au même emplacement ne peut utiliser l'ancienne. Un sélecteur qui sort de la part ou atteint du contenu attribué est refusé.
2. Une View retire un slot : ses descendants prennent fin et les contenus sont restitués avant le retrait logique du contenant, sans hook applicatif. Une erreur ultérieure de l'unité restaure les mêmes instances, parts, désignations et réservations.
3. Création d'une View suivie d'un échec d'initialisation : aucun enfant, abonnement, attribution, différé ou effet préparé de cette unité n'est publié ; absence de DOM déjà matérialisé non assimilée à absence d'existence logique.
4. Callback capturé pendant une destruction provisoire : attente de l'issue ; admission après annulation, abandon après validation ; jamais remis à une nouvelle occurrence.
5. Event réservé à S puis destruction/recréation S′ : aucun Event ancien repris par S′ ; annulation de la destruction conserve S et sa réservation sans réordonner les autres.
6. Même élément visé par View et plusieurs Behaviors aux noms disjoints : une seule admission, réactions dans l'ordre déclaré et unité commune. Collision de noms entre deux Behaviors refusée ; contenu de slot ou accès global hors part refusé.
7. Deux racines sur éléments admis disjoints : Foundation et attribution propres à chacune ; périmètres recouvrants refusés. Les résultats propres autorisés ne deviennent pas des notifications générales de l'hôte.

Ce sont des critères de tests futurs, pas des tests exécutés dans ce lot.

### Contrôles et bilan

- Contre-revue indépendante en lecture seule : deux désynchronisations de la page View confirmées puis corrigées (I34 et portée du choix I37) ; rappel correspondant clarifié dans Composer.
- `pnpm invariants` : réussite, 91 lignes, dix branches et neuf vues par rôle ; `pnpm invariants:check` réussi.
- Recomptage YAML : **91 entrées, 38 `livre`, 29 `partiel`, 17 `cible`, sept `convention`**. Les deux transitions d'état sont I34 et I32 ; les douze autres états restent inchangés.
- Contrôle de **211 références locales** dans les sept pages de spécification et de **47 renvois entrants avec ancre** vers les six pages structurelles : aucune cible ni ancre invalide détectée, hors archives, rapports et notes historiques pour les renvois entrants. Les ancres historiques sont préservées.
- Diagnostics des fichiers du lot sans erreur ; `git diff --check` sans erreur. Aucune source de package, du core, des tests ou de l'outillage modifiée.
- Aucun test runtime, test de types ni build exécuté : il s'agit d'une migration documentaire, pas d'une livraison du protocole structurel.

Les trois lots couvrent désormais vingt-cinq entrées existantes et les dix principes. **M0 reste incomplet** : le prochain lot porte sur les contrats déclaratifs et la disponibilité ; viennent ensuite l'atomisation des obligations transversales manquantes et la consolidation avant conception puis migration du runtime.
