# Bonsai — Arbitrages de cohérence V0.9.3

| Champ | Valeur |
| --- | --- |
| **Date** | 2026-10-30 |
| **Statut** | Arbitrages validés par l’auteur ; intégration documentaire V0.9.3 |
| **Origine** | [Revue des 28 points](revue-academique-architecture-V0.9.2-2026-10-30.md) |
| **Source normative résultante** | [Théorie V0.9.3](../theorie.md) |
| **Condition de validation** | Préserver l’esprit global de Bonsai |
| **Périmètre** | Théorie et documents associés ; aucune implémentation du framework |

## 1. Condition de validation et portée

**Les corrections préservent les principes structurants.** La validation du 30 octobre 2026 porte sur les propositions recommandées pour les 28 points, sous cette condition : propriété unique, absence de délégation, communication médiée, domaine autonome, chorégraphie entre Features, interface de projection et causalité explicite sont conservés.

Les évolutions de contrat sont néanmoins réelles : lecture seule transitive, refus des Queries réentrantes, origine exclusive de la propriété, objet ressource explicite et exclusivité physique d’écriture entre racines coordonnées. Les garanties excessives sont réduites : ni rollback des effets hôte déjà appliqués, ni convergence automatique des projections, ni terminaison générale par la borne de profondeur.

Ce rapport trace les arbitrages ; il ne remplace pas la théorie et ne constitue pas un ADR modifiant implicitement une décision Accepted. Les contrats et ADR antérieurs incompatibles restent des éléments à aligner séparément selon leur procédure de révision.

## 2. Suivi point par point

**« Appliqué » signifie intégré aux documents, pas livré ou testé dans le framework.** La colonne de contrôle décrit les critères documentaires et scénarios exigés ; elle ne prétend pas qu’un test applicatif a été exécuté. Les identifiants sont ceux de la revue initiale.

| Point | Arbitrage validé et appliqué | Conséquences et emplacement normatif | Contrôle documentaire / scénario requis |
| --- | --- | --- | --- |
| 1 | Objet constitué d’une ou plusieurs ressources déterminées ; pas de service de calcul pur autonome sans ressource. | [A3.i et L1](../theorie.md#l1--lemme-de-lobjet) : L1 est un corollaire immédiat d’une prémisse explicite. Calculs internes et lecture libre de l’heure restent permis. | Retirer la preuve faisant de toute connaissance une référence ; distinguer valeur accessoire et objet. |
| 2 | Modes adressés déclarés avant délivrance : action sans réponse ou connaissance avec réponse ; émission sur une ressource propre. | [T2](../theorie.md#t2--les-trois-voies), A3.j : classification contractuelle, non déduction depuis la propriété seule. Command refusée ou sans effet permise. | Même mode avant et après un refus ; notification adressée hors de ces contrats refusée. |
| 3 | Clôture de la propriété par création, admission ou attribution. | A2.e, [T8](../theorie.md#t8--admission-préalable), §11.6 : la ressource admise appartient au modèle ; le support reste extérieur. | Refuser une autorité non admise ; ne pas attribuer la propriété du support à deux catégories. |
| 4 | T5 concerne une transition requise et réalisable, non toute relation mathématique. | [T5](../theorie.md#t5--localité-des-invariants) : ressources internes préexistantes ; propriétaire commun si la mutation conjointe doit être réalisable atomiquement. | Une relation conservée par refus n’impose pas le regroupement ; pas de transaction distribuée implicite. |
| 5 | Autorité permanente, invariants d’état aux frontières de validation. | [§2.5](../theorie.md#25-définition-axiome-et-lecture-des-axiomes), A4.a : traitement modifiant comme unité ; Query imbriquée sans validation anticipée de l’auteur. | Mutation interne en plusieurs étapes, état intermédiaire non observable par une Query réentrante. |
| 6 | Amorçage exceptionnel causé par le démarrage ; admission par préambule puis message local. | §2.5, §11.6, A5.a, D14 : Channels avant consultations initiales, file différée après succès ; création d’enfant dans l’unité du créateur, autorité inchangée. | Échec initial : modèle abandonné, pas de publication partielle ; réactions applicatives jamais dans le préambule. |
| 7 | Mode avec/sans réponse connu avant exécution. | A3.j, [G5](../theorie.md#13-garanties-de-linfrastructure-de-communication), D16 : choix de la délivrance fondé sur le contrat. | Un résultat conditionnel ne modifie pas rétroactivement l’ordonnancement. |
| 8 | Query vers un composant actif refusée, soi compris. | G5, 18.13 : pas d’instantanés ajoutés ni de réponse différée attendant la libération de la cible. | A→B→A et auto-Query refusés avec contexte ; dépendances conditionnelles contrôlées à l’exécution. |
| 9 | Lecture seule transitive ; allocations temporaires de calcul permises. | A3.g : aucune ressource créée, mutation, destruction, effet extérieur, Command, Event ou message local ; autres Queries conformes permises. | Refuser cache persistant, réseau et Command différée depuis une Query ; heure libre ne signifie pas déterminisme. |
| 10 | Erreur de Query propagée jusqu’au traitement extérieur ou à l’amorçage. | G7, §9.11 : pas de `null` de substitution ni récupération locale implicite. Un refus métier attendu peut être une réponse normale. | L’auteur ne poursuit pas avec une fausse valeur ; trace et contexte de l’erreur conservés. |
| 11 | Seuls les messages différés non délivrés sont annulés. | G7, G5, D8 : les Queries déjà exécutées restent dans la trace ; retrait des messages annulés sans réordonner les autres. | Query réussie puis échec de l’auteur : Query tracée, messages différés supprimés. |
| 12 | Rollback interne, pas atomicité des effets hôte. | §2.5, G7, A4.a : effets préparés puis engagés après validation, succès/échecs admis ensuite ; observation distincte de l’intention. | Écriture partiellement appliquée : ne pas annoncer un succès complet et ne pas promettre la restauration du DOM. |
| 13 | Désignation transmissible distincte d’une référence d’accès. | [§8.5](../theorie.md#85-désignation), §9.9–9.10 : résolution contrôlée par la propriété ; nommer ne donne aucune autorité. | Sélecteur étranger ou désignation non attribuée refusés ; pas de recherche globale libre. |
| 14 | Désignation de part DOM, sans identité attribuée aux Views/Composers. | §8.5, §16.5–16.6 : désignation liée à une attribution, expirée à sa fin, jamais réactivée par réutilisation d’emplacement. | Ancienne désignation face à une nouvelle part refusée ; D6 et T4 inchangés. |
| 15 | A3.h conservé ; inscription du fait dans l’état d’observation avant Event. | §16.8, B.4 : pas de fait brut transformé implicitement en ressource, pas de journal infini imposé. | Deux faits identiques significatifs restent distincts par une séquence ; Event uniquement après validation interne. |
| 16 | Héritage causal obligatoire, conservation assurée par l’infrastructure. | A5.b–c, G8 : nouvelles origines limitées à l’amorçage et au spontané ; retour de Query sans remplacement du contexte auteur. | Refuser contexte substitué, remise à zéro opportuniste et appels bruts perdant la continuation. |
| 17 | Parent unique de déclenchement ; sélection possible, fusion causale multi-parent reportée. | §10.5, D19, B.4 : dernière notification retenue avec abandon des autres ; lecture d’un état historique non assimilée à une fusion. | Ne pas annoncer une provenance exhaustive des données ni masquer une agrégation multi-parent. |
| 18 | D9 borne la profondeur seulement. | D9, 18.9 : timer répétitif armé une fois → expirations sœurs ; réarmement → continuation ; polling susceptible d’atteindre la borne. | Pas de promesse de terminaison ou de travail total borné ; pas de nouvelle origine pour contourner la limite. |
| 19 | Supports de présentation/intention distincts des conditions d’environnement. | §11.1, B.3 : conventions normatives explicites, notamment focus de fenêtre dans le domaine. | Ne pas confondre focus d’un champ et focus de fenêtre ; classement maintenu du catalogue. |
| 20 | Dérivations de présentation sans autorité métier ; brouillon distinct de l’état confirmé. | A4.d, §16.5 : tri, filtre et formatage permis ; prix, éligibilité et total contractuel décident dans le domaine. | Affichage optimiste marqué non confirmé ; plusieurs réponses de traitements distincts ne donnent pas un instantané implicite. |
| 21 | Suppression des écritures équivalentes, pas preuve générale anti-boucle. | B.5 : équivalence valeur et opération ; historique `push`/`replace`/`pop` distingué. | Oscillation 0/100 non exclue par comparaison ; redirection et ajout explicite à même adresse testés séparément. |
| 22 | Autorité d’écriture exclusive sur les périmètres physiques coordonnés. | B.2–B.3 : défilement et presse-papiers uniques par hôte ; stockages partitionnés entre racines ; observation multiple selon contrat. | Deux racines sur un même support refusées ; pas de promesse contre scripts ou onglets non coordonnés. |
| 23 | Garde mécanique ou justification et revue documentée. | O2, §19, D16 : modes/contrats connus, pas toutes instances futures ; contrôle sémantique distinct des tests. | A3.h et A4.d restent obligatoires ; un scénario réussi ne prouve pas une propriété universelle. |
| 24 | État local de View modifiable pendant tout traitement autorisé, Event compris. | §16.5, D18 : pas de Command déclenchée par Event, même déguisée en message local ; Query préalable autorisée dans une réaction au fait admis. | Réinitialiser une sélection locale sur Event permis ; relancer une action métier depuis cet Event interdit. |
| 25 | Définitions, commentaires et prescriptions séparés. | §2.2, §17 : graphe sur les seules définitions ; 52 termes, dont 44 définis. | Renvois informatifs aval non pris pour dépendances ; prémisses nécessaires explicitement normatives. |
| 26 | Garanties = hypothèses contractuelles, conséquences = propositions démontrées. | §2.6, §14 : les prémisses sont nommées ; aucune garantie supposée démontrée par son seul intitulé. | L1 et T2 assument leurs prémisses nouvelles ; pas d’objectif comme prémisse de T5. |
| 27 | Collision des noms de clés interdite ; éléments communs permis. | D13, §16.7 : noms disjoints entre View et tous ses Behaviors ; une seule admission par View. | Deux clés distinctes peuvent viser le même bouton ; collision entre deux Behaviors également contrôlée. |
| 28 | Pérennité limitée aux composants du domaine propriétaires d’un Channel. | T6, §15.1, §16.3 : Feature pérenne tant que sa racine subsiste ; pas de nouvel axiome sur tout le domaine. | Ne pas généraliser à un composant sans Channel ni à la survie à la fin de la racine. |

## 3. Compléments nécessaires à la cohérence des arbitrages

**La contre-relecture ne doit pas introduire silencieusement une architecture différente.** Quatre compléments explicitent la mise en œuvre logique des choix validés :

1. La règle d’existence et de fin de la racine est explicitement une prescription normative, car T3 l’utilise ; les commentaires ne suffisent pas à la fonder.
2. A1.b et T8 distinguent la propriété de la ressource admise et l’autorisation d’effet sur son support extérieur ; ils ne changent pas la catégorie de ce support. Les parts issues de cette ressource par attribution autorisent leurs propriétaires dans leurs seules portions, soustraites au parent, sans transfert de propriété. Les références structurelles vers le support sont bornées à ces périmètres (§9.10, §11.6).
3. Le rollback structurel conserve les composants, propriétaires, parts, abonnements et désignations antérieurs lorsqu’une destruction provisoire est annulée. Il ne recrée pas une autre part et ne transfère aucune propriété. Le nettoyage physique attend la validation.
4. Les effets préparés sont engagés dans l’ordre avant la prochaine délivrance différée, sans attente de leurs résultats asynchrones. Leurs notifications, même synchrones, passent par admission et mise en file. Cette phase ne procure pas d’atomicité extérieure.

La validité des désignations est explicitement normative (§8.5). L'initialisation d'une part non encore matérialisée utilise sa ressource logique et prépare ses effets : elle ne suppose pas de résolution DOM immédiate ni d'écriture avant validation (§9.10). La fiche Viewport distingue aussi les redimensionnements spontanés de ceux provoqués par un effet du modèle, qui doivent conserver leur déclencheur même sans Command adressée à cet adaptateur (A5.c, G8).

## 4. Propagation documentaire

**Les rapports antérieurs restent historiques.** Le guide, les gardes, la matrice et les treize fiches d’adaptateurs sont alignés sur les contrats V0.9.3 ; les scénarios indiqués sont des exigences, non des résultats de tests exécutés.

| Document | Traitement |
| --- | --- |
| [Théorie](../theorie.md) | Source normative amendée, nouvelles clauses A2.e/A3.i/A3.j, garantie G8, décision D19 et réponses 18.16–18.29. |
| [Guide pédagogique](../theorie-explication-pedagogique.md) | Queries, amorçage, erreurs, causalité, désignations et projections alignés. |
| [Gardes](../gardes.md) | Couverture et scénarios requis actualisés ; non-vérifiabilité mécanique distinguée du défaut d’obligation. |
| [Traçabilité](../tracabilite.md) | Index V0.9.3, sans revendication de génération automatique ni de conformité implémentée. |
| [Adaptateurs](../adaptateurs/README.md) | Règles communes et fiches alignées : observation avant Event, effets, regroupements et périmètres physiques. |
| [Revue initiale](revue-academique-architecture-V0.9.2-2026-10-30.md) | Constats et note historiques conservés ; lien vers ce suivi. |
| [Registre rattaché V0.9.2](registre-V0.9.2.md) et [écarts V0.9.2](ecarts-V0.9.2.md) | Rapports historiques non réécrits, signalés comme antérieurs aux présents arbitrages. |

## 5. Conséquences sur le registre et l’implémentation

**Aucun statut de livraison ou de test ne découle de cet amendement documentaire.** Les spécifications et le registre opérationnel antérieurs, ainsi que leurs vues générées, ne sont pas déclarés intégralement alignés par cette passe. Leur révision et celle des ADR suivent un chantier séparé ; les écarts ci-dessous constituent ses entrées, pas une preuve d’exhaustivité du code audité.

| Élément concerné | Révision attendue sous l’autorité de V0.9.3 |
| --- | --- |
| P3, I10, I17, I27 | Contrats explicites ; refus/no-op de Command ; lecture seule transitive des Queries. |
| P4, I7–I9, I54 | G8 gère les contextes ; profondeur, pas travail total ni terminaison ; origines non réservées à l’UI. |
| P9, I13, I14, I16 | Gardes structurelles séparées des revues sémantiques et du contrôle des instances actives. |
| I29, I55, I65 | L’échec de consultation se propage ; aucun `null` de substitution ni confinement silencieux du replier. Les ADR antérieurs incompatibles nécessitent une révision formelle, pas une réécriture rétroactive. |
| I30, I42 | Brouillon, représentation et état confirmé distincts ; état local permis sur Event, sans Command de réaction. |
| I31, I39, I99 | Désignation contrôlée et bornée à l’attribution ; pas d’accès global ni réactivation après réattribution. |
| I43–I45 | Noms disjoints entre tous les Behaviors et la View ; éléments physiques communs permis. |
| I56, I66 | Amorçage encadré : Channels établis avant consultations initiales ; publication différée après réussite ; pas « aucun message » au sens absolu. |
| Infrastructure et lifecycle | Transaction interne incluant structure, phase post-validation, effets hôte partiels, refus de réentrance et propagation des erreurs. |
| Catalogue et Manifest | Autorité physique commune au démarrage des racines coordonnées, au-delà de l’unicité locale des noms. |

## 6. Limites et question hors arbitrage

**L’ancien constat V4 n’est pas arbitré par les 28 points.** Le clic et le déplacement du focus hors d’une View, notamment sur une portion non attribuée, restent ouverts sous 18.30. Le focus de fenêtre ne tranche pas ce cas. Aucun nouveau droit d’admission global n’est créé implicitement.

La note **6/10** de la revue initiale reste une appréciation de V0.9.2. Aucun nouveau score n’est attribué sans nouvelle revue indépendante. La présente intégration corrige des contrats documentaires ; elle ne démontre ni l’existence de toutes les gardes ni la conformité du runtime.
