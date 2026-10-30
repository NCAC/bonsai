# Bonsai — Revue académique et architecturale de la théorie V0.9.2

| Champ | Valeur |
| --- | --- |
| **Date** | 2026-10-30 |
| **Document examiné** | [Vocabulaire fondamental V0.9.2](../theorie.md) |
| **Nature** | Revue critique académique et architecturale |
| **Statut** | Revue historique non normative — 28 points arbitrés le 2026-10-30 ; suivi séparé |
| **Périmètre** | Lecture intégrale de la théorie, avec confrontation à l’[audit existant](audit-coherence-V0.9.2.md) |

> Ce rapport consigne les remarques de la revue du 30 octobre 2026. Il ne modifie pas la théorie et ne constitue pas un arbitrage. Les références de sections, de clauses et de lignes visent la version examinée ; les liens de lignes pourront se décaler lors des révisions ultérieures.

> **Suite donnée le 2026-10-30.** Les corrections recommandées ont été validées sous réserve de préserver l’esprit de Bonsai, puis intégrées à la théorie V0.9.3 et aux documents associés. Le [suivi des 28 arbitrages](arbitrages-V0.9.3-2026-10-30.md) décrit les choix retenus, leurs conséquences et les contrôles requis. Les constats, citations et la note ci-dessous restent ceux de V0.9.2 ; ils ne sont ni effacés ni réévalués rétroactivement. L’alignement documentaire ne vaut pas livraison de l’implémentation.

## Table des matières

- [Appréciation générale](#appréciation-générale)
- [I. Démonstrations et prémisses implicites](#i-démonstrations-et-prémisses-implicites)
- [II. Exécution, Queries et échecs](#ii-exécution-queries-et-échecs)
- [III. Références, identités et ressources](#iii-références-identités-et-ressources)
- [IV. Causalité et limites](#iv-causalité-et-limites)
- [V. Frontières architecturales et projections](#v-frontières-architecturales-et-projections)
- [VI. Gardes, circularité et statut des énoncés](#vi-gardes-circularité-et-statut-des-énoncés)
- [VII. Théorèmes déjà impliqués, redondances et résultats solides](#vii-théorèmes-déjà-impliqués-redondances-et-résultats-solides)
- [VIII. Bilan selon les dix axes demandés](#viii-bilan-selon-les-dix-axes-demandés)
- [Ordre de correction recommandé](#ordre-de-correction-recommandé)
- [Note globale de solidité théorique](#note-globale-de-solidité-théorique--610)

## Appréciation générale

**Le document constitue une architecture conceptuelle sérieuse, mais pas encore une théorie dont toutes les conséquences annoncées sont établies.**

Ses points forts sont réels : séparation des catégories normatives, propriété explicite, distinction entre composants et ressources, prise en compte de la causalité et documentation des alternatives.

La difficulté principale est ailleurs : **plusieurs intuitions architecturales sont employées dans les démonstrations sans avoir été formalisées comme prémisses**. À cela s’ajoutent des contradictions opérationnelles concernant les Queries synchrones, les échecs et les effets sur l’hôte.

La revue distingue :

- les **défauts de démonstration**, qui ne prouvent pas que l’architecture est mauvaise ;
- les **contradictions entre énoncés** ;
- les **sous-spécifications**, qui permettent plusieurs implémentations incompatibles ;
- les **limites assumables**, mais insuffisamment explicites pour un développeur.

## I. Démonstrations et prémisses implicites

### 1. L1 ne couvre pas les consultations sans ressource

**Gravité : fort — défaut de démonstration.**

**Citation — [L1, démonstration](../theorie.md#L588)**

> « Ce que D peut faire connaître sans autre interaction, il l'atteint par une référence structurelle »

**Problème.** A3.c contraint les références utilisées ; il n’impose pas que toute connaissance provienne d’une référence.

**Contre-exemple :** un composant demande à un autre l’heure courante. Celui-ci la lit et la rend sans modifier de ressource. Cette lecture est expressément permise par 3.2 et 18.15. Ici, l’heure est l’objet de la consultation, pas une valeur accessoire.

Un service de calcul pur pose la même difficulté.

**Correction proposée.** Ajouter une restriction explicite selon laquelle toute interaction admissible porte sur une ressource, ou élargir L1 aux valeurs et calculs purs. Dans le premier cas, cette restriction devient une prémisse normative : elle n’est pas démontrée par les axiomes actuels.

### 2. T2 ne démontre pas l’exhaustivité des trois voies

**Gravité : fort — défaut de démonstration indépendant de L1.**

**Citation — [T2, étape 6](../theorie.md#L616)**

> « Si l'information part **de** C sans avoir été demandée, elle passe par un message émis (A3.a) »

**Problème.** A3.a autorise un message **adressé ou émis**. Il ne réserve pas les informations non sollicitées aux messages émis.

**Contre-exemple :** C adresse à D une information concernant sa propre ressource. D la traite sans changement et sans réponse. Cette interaction respecte les contraintes explicites de médiation et de propriété, mais n’est :

- ni une demande de changement ;
- ni une demande de connaissance avec réponse ;
- ni un message émis.

**Correction proposée.** Formaliser la discipline des messages adressés : ils doivent être des demandes de changement ou de connaissance. Présenter cette discipline comme un axiome supplémentaire ou une décision de conception, puis démontrer la partition.

**En l’état, T2 formalise une architecture souhaitée davantage qu’il ne la déduit.**

### 3. T8 utilise la réciproque non établie d’A2.a

**Gravité : fort — prémisse manquante.**

**Citation — [T8, étape 2](../theorie.md#L706)**

> « Une ressource de l'hôte n'a de propriétaire qu'après son admission »

**Problème.** A2.a indique qui devient propriétaire lorsqu’un composant crée ou admet une ressource. Il n’énonce pas explicitement que **toute relation de propriété doit exclusivement provenir d’un de ces actes**.

Le raisonnement passe de :

> création ou admission ⇒ propriété initiale

à :

> propriété d’une ressource de l’hôte ⇒ admission préalable.

Cette réciproque exige une prémisse supplémentaire. La remarque sous A1 affirme déjà l’obligation en renvoyant à T8 : l’utiliser pour justifier T8 créerait une dépendance circulaire.

**Correction proposée.** Ajouter un axiome de clôture : toute propriété initiale résulte exclusivement d’une création, d’une admission ou d’une attribution ; aucune ressource extérieure non admise n’a de composant propriétaire.

### 4. T5 doit distinguer dépendance mathématique et transition réalisable

**Gravité : moyen — quantification ambiguë.**

**Citation — [définition utilisée par T5](../theorie.md#L662)**

> « Un invariant lie deux ressources lorsqu'un changement de l'une, permis par le code applicatif, n'est compatible avec l'invariant qu'accompagné d'un changement de l'autre. »

**Problème.** La preuve suppose ensuite qu’un tel changement peut effectivement aboutir.

Deux propriétaires peuvent conserver indéfiniment des ressources satisfaisant $x=y$ en refusant tout changement isolé. L’égalité entre leurs valeurs n’impose pas, à elle seule, un propriétaire commun.

T5 reste défendable si « permis » signifie : **réalisable jusqu’à une issue validée dans une exécution conforme**. Mais cette lecture doit être explicite.

**Correction proposée.** Énoncer d’abord le résultat opérationnel :

> Une transition validée exigeant des changements conjoints de ressources de propriétaires distincts est impossible.

L’obligation de regrouper les ressources suit alors d’une exigence supplémentaire : cette transition doit être réalisable.

## II. Exécution, Queries et échecs

### 5. L’unité d’atomicité n’est pas définie

**Gravité : fort — ambiguïté structurante.**

**Citations — [règle de lecture](../theorie.md#L64), [A4.a](../theorie.md#L516)**

> « Les axiomes sont satisfaits à l'issue de chaque opération »
>
> « Les invariants métier sont satisfaits à l'issue de chaque traitement »

**Problème.** Une opération n’est pas identifiée à un traitement. Un traitement peut comprendre plusieurs opérations exclusives.

Pour maintenir $x=y$, un traitement peut modifier successivement $x$, puis $y$. L’état intermédiaire est-il autorisé ? La réponse dépend de ce qui compte comme « opération ».

G5 sérialise des traitements, pas nécessairement toutes les opérations du métalangage.

**Correction proposée.** Définir une transition atomique et distinguer :

1. les contraintes applicables aux actions elles-mêmes ;
2. les invariants applicables aux frontières de validation ;
3. les règles d’observation pendant les Queries imbriquées.

### 6. Le démarrage et l’admission ne disposent pas d’un protocole complet

**Gravité : fort — lacune opérationnelle.**

**Citations — [A5.a](../theorie.md#L534), [Composer](../theorie.md#L810)**

> « Tout changement d'état résulte du traitement d'un message. »
>
> « à sa création, puis à chaque message qu'il traite, il décide quelles Views occupent des parts de son contenu »

**Problème.** Un traitement répond à la délivrance d’un message. Or le démarrage initial, certaines attributions et l’exécution initiale du Composer précèdent le premier message.

De même, D18 parle de « traitement d’un fait », alors que seul le traitement d’un message est défini.

La création pure peut être exclue du changement d’état ; en revanche, une attribution modifie explicitement une ressource existante. Cette exception ne suffit donc pas à résoudre le démarrage.

**Correction proposée.** Définir un protocole d’amorçage : soit un message initial explicite, soit une phase d’initialisation autorisée avec cause, frontières de validation et règles d’échec. Décrire également l’admission comme un préambule précis au traitement, ou comme une opération encadrée distincte.

### 7. G5 utilise un critère connu trop tard pour décider de la délivrance

**Gravité : fort — contrat d’ordonnancement incomplet.**

**Citation — [G5](../theorie.md#L560)**

> « Seul le traitement d'un message adressé qui rend une réponse s'exécute au cours d'un autre traitement. »

**Problème.** L’infrastructure doit décider **avant l’exécution** si elle délivre immédiatement le message ou le met en attente. Pourtant, le critère porte sur ce que le traitement rendra effectivement.

Un traitement conditionnel peut répondre dans un cas et ne rien rendre dans un autre. A3.g ne suffit pas à établir une catégorie connue avant exécution.

**Correction proposée.** Déclarer avant délivrance un mode « avec réponse » ou « sans réponse », par exemple dans le contrat de message. Contraindre ensuite les traitements associés, indépendamment de leur résultat particulier.

### 8. Les Queries réentrantes invalident la promesse de lecture d’un état achevé

**Gravité : fort — contre-exemple direct.**

**Citation — [explication de G5](../theorie.md#L570)**

> « le composant qui y répond n'est en cours de traitement que s'il en est lui-même l'auteur, puisque seul l'auteur l'est »

**Contre-exemple.**

1. A modifie partiellement son état.
2. A adresse une Query à B.
3. B adresse à son tour une Query à A.
4. A répond en lisant son état intermédiaire.

Les traitements imbriqués ne modifient rien et respectent l’exception de G5. Pourtant, A répond pendant son traitement initial sans être l’auteur de la Query de B.

La règle sur l’[adressage de son propre Channel](../theorie.md#L942), annoncé comme toujours mis en file, ne distingue pas non plus cette exception synchrone.

**Correction proposée.** Interdire les Queries vers un composant déjà actif, ou imposer une lecture sur instantané validé. À défaut, retirer la garantie de lecture d’un état achevé.

### 9. L’absence d’opération exclusive ne garantit pas la pureté d’une Query

**Gravité : fort — risque d’interprétation du contrat.**

**Citation — [A3.g](../theorie.md#L508)**

> « Le traitement d'un message adressé qui rend une réponse n'exécute aucune opération exclusive. »

**Problème.** Cette formulation n’interdit pas explicitement :

- de créer une ressource ;
- de produire une Command qui sera traitée ensuite ;
- de lancer un effet extérieur ;
- de provoquer indirectement un changement.

La création est même expressément exclue des opérations exclusives.

Une Query peut donc « ne rien modifier » pendant son traitement tout en déclenchant un changement ultérieur. Cela affaiblit fortement la formule « une Query rend sans changer ».

**Correction proposée.** Définir une contrainte de lecture seule couvrant les créations, les effets extérieurs et les messages produits, y compris les effets différés. Ne pas assimiler cette contrainte à la seule absence d’opération exclusive.

### 10. L’échec d’une Query ne définit pas la suite de l’auteur

**Gravité : fort — issue manquante.**

**Citations — [G7](../theorie.md#L562), [explication de G5](../theorie.md#L570)**

> « aucune réponse n'est rendue »
>
> « une erreur survenue dans un traitement ne peut pas en interrompre un autre »

**Problème.** L’auteur attend un résultat synchrone pour poursuivre son exécution. Si aucune réponse n’est rendue, que fait-il ?

Les possibilités sont incompatibles : propagation de l’erreur, résultat d’échec explicite, absence conventionnelle, interruption de l’ensemble de la transaction.

**Correction proposée.** Choisir une sémantique unique. La propagation à l’auteur est cohérente, mais exige de corriger la seconde citation et de définir le périmètre du rollback à travers la pile des Queries.

### 11. G7 ne peut pas annuler rétroactivement une Query déjà délivrée

**Gravité : fort — incompatibilité littérale entre garanties.**

**Citation — [G7](../theorie.md#L562)**

> « aucun des messages qu'il a produits n'est délivré »

**Contre-exemple.**

1. A traite un message.
2. A produit une Query vers B.
3. G5 autorise sa délivrance immédiate ; B répond.
4. A échoue ensuite.

Le traitement interrompu a produit un message qui a déjà été délivré. G7 ne peut plus être satisfaite littéralement.

**Correction proposée.** Restreindre l’annulation de délivrance aux messages différés : Commands, Events et messages locaux en attente. Traiter séparément les Queries déjà exécutées, avec une contrainte de lecture seule suffisamment forte.

### 12. Le rollback annoncé est plus large que le rollback garanti

**Gravité : fort — contradiction explicite de portée.**

**Citations — [règle de lecture](../theorie.md#L64), [G7](../theorie.md#L562)**

> « Un traitement interrompu par une erreur est sans effet sur les ressources du modèle »
>
> « les ressources du modèle que l'hôte ne matérialise pas »

**Problème.** Une part du DOM, un stockage admis ou le titre sont des ressources du modèle matérialisées par l’hôte. Elles sont exclues de G7, mais incluses dans la promesse générale.

Exécuter les effets « en dernier » ne garantit pas l’atomicité : une première écriture peut réussir et une seconde échouer. Confier l’effet à un adaptateur déplace le problème sans le supprimer.

**Correction proposée.** Séparer explicitement :

- l’atomicité des ressources internes ;
- la validation des messages sortants ;
- les effets sur l’hôte, avec leurs échecs partiels et éventuelles compensations.

Pour le DOM, préciser si les projections sont différées, restaurées ou laissées partiellement appliquées.

## III. Références, identités et ressources

### 13. Une représentation résoluble satisfait potentiellement la définition de « référence »

**Gravité : fort — conflit terminologique affectant A3.d.**

**Citations — [référence](../theorie.md#L326), [View](../theorie.md#L794)**

> « Information permettant à un composant d'atteindre une ressource, du modèle ou de l'hôte, ou un autre composant, sans transport. »
>
> « une représentation de l'identité de sa part, jamais un élément de l'hôte »

**Problème.** Un sélecteur permet précisément d’atteindre une ressource par résolution auprès de l’hôte, sans transport.

La distinction voulue entre représentation transmissible et référence interdite n’est donc pas exprimée par la définition actuelle.

**Correction proposée.** Distinguer une désignation d’une capacité d’accès. La résolution d’une désignation doit être une opération contrôlée qui vérifie la propriété ; elle ne doit pas constituer un accès libre à toute ressource nommable.

### 14. La propriété de l’identité d’une part du DOM n’est pas située

**Gravité : moyen — modèle incomplet.**

**Citations — [D6](../theorie.md#L743), [View](../theorie.md#L794)**

> « Ni une View ni un Composer n'est propriétaire d'une identité. »
>
> « une représentation de l'identité de sa part »

**Problème.** Une identité est une ressource : elle doit donc avoir un propriétaire. Le texte ne précise ni l’espace auquel appartient cette identité de part, ni son propriétaire.

Ce n’est pas nécessairement contradictoire : le propriétaire de l’identité pourrait être distinct de celui de la ressource identifiée. Mais cette solution doit être décrite et compatible avec les règles d’attribution et de durée de vie.

**Correction proposée.** Définir séparément les identités d’adressage des Channels et les désignations des parts DOM, ou expliciter leur espace, leur propriétaire et leur cycle de vie.

### 15. Les adaptateurs peuvent annoncer des faits qui ne sont pas des ressources

**Gravité : fort — incompatibilité possible avec A3.h.**

**Citations — [A3.h](../theorie.md#L510), [adaptateur](../theorie.md#L840)**

> « Un composant n'émet d'information que sur une ressource dont il est propriétaire. »
>
> « il émet sur son Channel les faits qu'il admet et ce qu'il sait de ses ressources »

**Problème.** Un raccourci clavier ou une fermeture imminente est un fait, pas une ressource persistante selon 3.2. Le fait d’être admis ne suffit pas à en faire une ressource du composant.

**Correction proposée.** Imposer aux adaptateurs d’inscrire les faits annoncés dans une ressource avant émission, ou élargir explicitement A3.h aux faits admis. Cette seconde option impose de réviser L1 et T2.

## IV. Causalité et limites

### 16. La présence d’un contexte causal ne garantit pas sa fidélité

**Gravité : fort — axiome implicite manquant.**

**Citation — [A5.b](../theorie.md#L536)**

> « Tout message porte un contexte causal. »

**Problème.** Cette clause exige un contexte, mais n’impose pas explicitement qu’un message produit pendant un traitement prolonge la chaîne de ce traitement.

A5.c règle les faits extérieurs. G2 interdit de modifier le contexte pendant le transport. Aucune de ces obligations ne fixe à elle seule le bon contexte lors de toute production interne.

**Contre-exemple :** un message interne reçoit le contexte d’une autre chaîne existante. Il possède bien un contexte, conservé par le transport, mais sa traçabilité est fausse.

**Correction proposée.** Imposer l’héritage causal pour tous les messages produits pendant un traitement, et réserver la création d’origines aux points explicitement autorisés.

### 17. Les regroupements de notifications n’ont pas de sémantique causale définie

**Gravité : moyen — cas limite non traité.**

**Citations — [B.4](../theorie.md#L1100), [D9](../theorie.md#L746)**

> « regrouper des notifications selon une politique déclarée »
>
> « Toute suite de continuations dont chacune continue la précédente, depuis l'origine »

**Problème.** Un regroupement peut dépendre de plusieurs notifications issues de branches différentes, voire d’origines différentes.

Quel contexte porte son résultat ? Comment calcule-t-on sa profondeur ? Conserver uniquement la dernière notification peut effacer une partie des dépendances réelles.

**Correction proposée.** Choisir entre une causalité à parent unique, dont les limites sont explicites, et une causalité à plusieurs parents. Définir ensuite le calcul de la borne pour les regroupements.

### 18. D9 limite certains processus légitimes sans borner toutes les répétitions

**Gravité : moyen — limite de conception à expliciter.**

**Citation — [D9](../theorie.md#L746)**

> « Les continuations par faits provoqués comptent (A5.c). »

**Problème.**

- Un polling qui réarme une minuterie après chaque réponse finit par atteindre la borne, même s’il est légitime.
- Un timer répétitif armé une seule fois peut produire des expirations sœurs : la profondeur reste faible alors que le nombre de traitements devient illimité.

La borne ne constitue donc ni une borne générale de travail ni une détection générale des boucles.

**Correction proposée.** Documenter précisément ce que D9 garantit : une profondeur maximale. Spécifier les timers répétitifs et les processus durables ; ajouter, si nécessaire, des mécanismes distincts de quota, d’annulation ou de surveillance.

## V. Frontières architecturales et projections

### 19. La définition de l’interface utilisateur ne suffit pas à retrouver le catalogue

**Gravité : moyen — classification ambiguë.**

**Citations — [11.1](../theorie.md#L396), [annexe A](../theorie.md#L1024)**

> « une ressource par laquelle l'utilisateur perçoit le modèle ou agit sur lui »
>
> « | Focus de la fenêtre | gain, perte | non | domaine | »

**Problème.** Donner le focus, redimensionner une fenêtre ou modifier une préférence peut constituer, au sens ordinaire, une action sur le comportement du modèle. Pourtant, plusieurs de ces sources sont classées dans le domaine.

Le catalogue peut être cohérent avec une lecture plus étroite, mais celle-ci n’est pas formulée.

**Correction proposée.** Distinguer les moyens de présentation et d’interaction des conditions d’environnement. Présenter les classements difficiles comme des conventions normatives explicites, plutôt que comme des applications évidentes de 11.1.

### 20. A4.d n’explicite pas la fermeture par transformation

**Gravité : moyen — ambiguïté sur les valeurs dérivées.**

**Citations — [A4.d](../theorie.md#L522), [commentaire](../theorie.md#L530)**

> « n'est remplacée que par une information de même provenance »
>
> « la filtrer, la trier ou la paginer »

**Problème.** Une liste filtrée ou un montant formaté n’a pas nécessairement été émis tel quel par le domaine. « Provenance » doit donc signifier une dérivation autorisée, pas l’identité de la valeur.

La frontière devient incertaine pour un total calculé, une conversion monétaire ou une fusion de plusieurs réponses. Par ailleurs, une saisie peut déjà porter sur une ressource métier : « saisie en cours » n’est pas automatiquement synonyme d’information non métier.

**Correction proposée.** Définir les transformations de projection autorisées et distinguer information métier faisant autorité, représentation dérivée et intention utilisateur non validée.

### 21. B.5 ne démontre pas l’absence générale de boucle

**Gravité : fort — conclusion excessive.**

**Citation — [B.5](../theorie.md#L1106)**

> « ce qui exclut qu'un fait admis, projeté en retour, en produise un autre »

**Problème.** Ne pas réécrire une valeur identique élimine les échos identiques, pas les cycles de transformation.

**Contre-exemple :** un fait de défilement fournit $y$ ; le domaine décide d’une cible $100-y$ ; l’adaptateur projette cette cible. Les positions peuvent alterner entre 0 et 100. Chaque écriture diffère de la valeur courante : B.5 est respectée.

**Correction proposée.** Limiter la conclusion aux échos à valeur inchangée. Une garantie générale exige des propriétés supplémentaires du trajet admission–domaine–projection : point fixe, idempotence globale ou convergence.

### 22. L’exclusivité physique entre racines n’est pas garantie pour toutes les écritures

**Gravité : fort — trou dans l’isolation multi-racines.**

**Citations — [B.2](../theorie.md#L1074), [B.3](../theorie.md#L1082)**

> « deux racines qui pilotent la même ressource de l'hôte se contrediraient »
>
> « | Défilement | interface utilisateur | une par racine | A.3 | »

**Problème.** Deux racines peuvent avoir des Foundations disjointes tout en pilotant le défilement de la même fenêtre. Chacune peut alors restaurer une position différente sans violer l’unicité locale.

Les ressources logiques sont séparées par modèle ; leur matérialisation physique ne l’est pas nécessairement.

**Correction proposée.** Distinguer observation multiple et autorité exclusive d’écriture. Rendre le défilement de fenêtre unique par hôte, ou définir des périmètres physiques réellement disjoints et vérifiables.

## VI. Gardes, circularité et statut des énoncés

### 23. Le caractère universel des gardes contredit les exceptions reconnues

**Gravité : moyen — contradiction de portée.**

**Citations — [§19](../theorie.md#L950), [exceptions](../theorie.md#L961)**

> « Toute règle qui contraint le code applicatif, clause d'axiome ou décision, est protégée par une garde »
>
> « Deux obligations n'en admettent pas »

**Problème.** Une règle universelle est suivie d’exceptions sans être reformulée.

De même, D16 affirme qu’« A3 » devient vérifiable, alors qu’A3.h est explicitement déclaré non observable. Enfin, connaître les contrats des composants ne revient pas à connaître toutes les instances futures de Views.

**Correction proposée.** Séparer :

- les obligations mécaniquement contrôlables ;
- les obligations sémantiques nécessitant revue ou preuve ;
- les contrats connus avant démarrage ;
- les propriétés des instances vérifiables seulement à l’exécution.

### 24. La restriction des mutations locales des Views n’est pas une conséquence des prémisses citées

**Gravité : moyen — décision présentée comme déduction.**

**Citation — [16.5](../theorie.md#L799)**

> « un état local, modifié uniquement en traitement de ses messages locaux (A5.a, 9.5) »

**Problème.** A5.a exige le traitement d’un message, pas nécessairement d’un message local. Rien dans les deux références citées n’interdit à une View de modifier un état local non métier pendant le traitement d’un Event reçu.

**Correction proposée.** Ajouter cette restriction comme décision explicite avec justification et alternative, ou retirer « uniquement » et définir les traitements autorisés.

Ce point est important méthodologiquement : **une règle architecturale raisonnable ne devient pas pour autant une conséquence démontrée.**

### 25. La non-circularité dépend d’une séparation non explicitée entre définitions et commentaires

**Gravité : moyen — circularité potentielle de présentation.**

**Citations — [règle de définition](../theorie.md#L33), [paramètres de création](../theorie.md#L168)**

> « n'utilise que des termes primitifs, des termes antérieurs dans la chaîne du §17 et le métalangage »
>
> « Une information transmise après la création n'est pas un paramètre de création : c'est une interaction fonctionnelle, soumise à A3.a. »

**Problème.** L’interaction fonctionnelle est définie plus tard en utilisant les paramètres de création.

- Si ce commentaire participe à la définition, la dépendance est réciproque.
- Si seule la phrase définitoire principale compte, le graphe peut rester acyclique, mais il faut le préciser.

Par ailleurs, toute information postérieure à la création n’est pas une interaction fonctionnelle : il faut encore respecter les exclusions de 10.6.

**Correction proposée.** Marquer formellement les définitions, commentaires et propositions normatives. Construire le graphe de dépendances sur les seules définitions ; déplacer et qualifier les conséquences.

### 26. « Garantie » désigne simultanément une hypothèse et une conséquence

**Gravité : moyen — ambiguïté épistémique.**

**Citation — [2.6](../theorie.md#L72)**

> « Une **conséquence** est un lemme, un théorème ou une garantie : ce que les définitions, les axiomes et les garanties établissent. »

**Problème.** Les garanties figurent à la fois parmi ce qui est établi et parmi les prémisses permettant de l’établir. Pourtant, G1–G7 sont des obligations imposées à l’infrastructure, pas des résultats démontrés depuis A0–A5.

Ce n’est pas forcément une circularité logique effective, mais le vocabulaire masque le statut des hypothèses.

**Correction proposée.** Réserver :

- « garantie d’infrastructure » aux hypothèses contractuelles ;
- « conséquence établie » aux propositions démontrées ;
- « propriété garantie du système » à une conclusion dont les hypothèses sont nommées.

### 27. Les « clés » des Behaviors ne disposent pas d’une sémantique suffisante

**Gravité : faible — ambiguïté susceptible de produire des implémentations divergentes.**

**Citation — [D13](../theorie.md#L750)**

> « ses clés ne recoupent pas les siennes »

**Problème.** Le possessif est ambigu. Surtout, le recoupement concerne-t-il les noms des clés, les éléments DOM désignés, ou les traitements associés ?

Deux clés distinctes peuvent désigner le même bouton. La réaction commune d’une View et de ses Behaviors est d’ailleurs prévue en 16.7.

**Correction proposée.** Définir une clé et préciser que l’interdiction concerne, si telle est l’intention, la collision des noms. Autoriser explicitement des désignations distinctes d’un même élément, sous l’unicité d’admission par la View.

## VII. Théorèmes déjà impliqués, redondances et résultats solides

La présence de conséquences directement issues des axiomes **n’est pas en soi un défaut** : c’est justement le rôle d’un théorème architectural de rendre leurs implications utilisables.

| Élément | Appréciation |
| --- | --- |
| **T1 — Composition par création** | Déduction convaincante d’A0.d, A2.a et de la définition du parent. |
| **T3 — Cascade** | Cohérent sous la lecture naturelle où le propriétaire d’une ressource restante doit lui-même subsister. La règle de cascade fait déjà partie des prémisses explicites ; ne pas présenter la conséquence comme indépendante de cette règle. |
| **T4 — Adressabilité** | Déduction claire. La distinction entre message et réponse évite une contradiction apparente. |
| **T6 — Survie du domaine** | Correct pour les composants du domaine **propriétaires d’un Channel**. |
| **T7 — Disjonction** | Correct pour les parts d’une même ressource distribuable. Ne garantit pas, seul, l’absence d’alias entre ressources physiques distinctes. |
| **D5 retirée** | Bonne correction méthodologique : une conséquence n’est plus présentée comme un choix. |
| **A3.e et G1** | Recouvrement justifié : restriction du comportement des composants d’un côté, obligation du transport de l’autre. Ce n’est pas une redondance inutile. |

En revanche, la synthèse contient encore une généralisation excessive.

### 28. La continuité est attribuée à tout le domaine alors que T6 est conditionnel

**Gravité : moyen — généralisation non démontrée.**

**Citation — [table des conséquences](../theorie.md#L727)**

> « Continuité du domaine : le domaine ne prend fin qu'avec la racine »

**Problème.** T6 concerne les composants du domaine propriétaires d’un Channel. Un composant du domaine sans Channel peut, au niveau des axiomes, être détruit avant la racine.

La survie des Features est bien établie ; celle de tout élément possible du domaine ne l’est pas.

**Correction proposée.** Écrire :

> Les composants du domaine propriétaires d’un Channel subsistent jusqu’à la fin de la racine.

Ou ajouter une obligation couvrant tous les composants du domaine.

## VIII. Bilan selon les dix axes demandés

| Axe | Résultat principal |
| --- | --- |
| **1. Cohérence logique interne** | Plusieurs conclusions dépassent leurs prémisses : L1, T2, T8, B.5. |
| **2. Contradictions potentielles** | G5/G7, rollback général/partiel, universalité des gardes/exceptions. |
| **3. Définitions circulaires** | Pas de circularité certaine établie dans les seules phrases définitoires ; dépendances réciproques possibles si les commentaires sont normatifs. |
| **4. Axiomes implicites** | Clôture de la propriété, discipline des messages adressés, héritage causal, lecture seule transitive. |
| **5. Contre-exemples** | Consultation de l’heure, notification adressée, Query réentrante, Query suivie d’un échec, projection oscillante. |
| **6. Cas limites** | Démarrage, échecs imbriqués, regroupements causaux, timers répétitifs, écritures multi-racines. |
| **7. Ambiguïtés terminologiques** | Opération/traitement, référence/désignation, garantie/conséquence, provenance, clés. |
| **8. Concepts redondants** | Peu de redondances réellement nuisibles ; le problème est surtout le chevauchement de statuts normatifs. |
| **9. Théorèmes découlant des axiomes** | T1, T4 et T6 sont convaincants ; T3 et T7 dépendent fortement des règles et définitions explicites. |
| **10. Interprétation développeur** | Risques majeurs : croire les Queries pures, les lectures toujours validées, les échecs totalement annulés et les projections exemptes de boucles. |

## Ordre de correction recommandé

1. **Fixer la sémantique d’exécution** : atomicité, démarrage, Queries, réentrance et échecs.
2. **Réparer les fondations démonstratives** : L1, T2 et clôture de la propriété pour T8.
3. **Formaliser la causalité** : héritage interne, regroupements et portée exacte de D9.
4. **Clarifier les frontières** : références, identités DOM, ressources physiques partagées et projections.
5. **Aligner les statuts documentaires** : hypothèses, conséquences, décisions, obligations contrôlables.

## Note globale de solidité théorique : 6/10

**Le cadre architectural est substantiel et cohérent dans son intention, mais sa fermeture logique et sa sémantique opérationnelle restent insuffisantes pour une spécification normative stabilisée.**

Les défauts relevés ne démontrent pas que Bonsai serait irréalisable. Ils montrent que certaines propriétés annoncées exigent des restrictions supplémentaires, des garanties plus étroites ou des décisions encore explicites à prendre. La priorité n’est pas d’ajouter des concepts : **elle est de préciser les transitions autorisées et de ne plus demander aux démonstrations de porter des prémisses absentes.**
