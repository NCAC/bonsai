# Bonsai — Vocabulaire fondamental V0.9.5

Oct 30, 2026 · @ncac

**Version : V0.9.5 — restructuration du 30 octobre 2026 : vocabulaire opérationnel défini, protocole d’exécution en annexe C ; conformité documentaire distincte de l’alignement de l’implémentation.**

> **Statut normatif.** Ce document fait autorité pour la théorie. Le guide, les gardes, la traçabilité et les fiches d’adaptateurs le développent sans modifier ses contrats. Les rapports datés conservent les constats historiques ; le [suivi des arbitrages V0.9.3](rapports/arbitrages-V0.9.3-2026-10-30.md) rattache les corrections aux 28 points de revue. Les choix maintiennent la propriété unique, la médiation, le domaine autonome et l’interface de projection ; ils ne promettent pas de transaction distribuée avec l’hôte.
>
> **Jalon V0.9.5.** Les notions de message différé (9.12), d’unité de validation (9.13) et d’effet (11.8) entrent dans la chaîne du §17 ; « support » est unifié sur « ressource de l’hôte » et « amorçage » sur « démarrage » ; le protocole d’exécution forme l’annexe C, normative, et le profil de corrélation du navigateur la section B.7. Aucune obligation n’est ajoutée ni retirée (points R1 et R2 de la [relecture de fond V0.9.4](rapports/relecture-V0.9.4-2026-10-30.md) ; question 18.33).
>
> **Amendement du 3 novembre 2026 — action par défaut déclarée.** L’action que l’hôte attache par défaut à un fait, comme suivre un lien ou soumettre un formulaire, n’est pas un effet du modèle. D20 permet à l’admetteur de déclarer son annulation pour un fait de son contrat, et Bonsai l’applique à la capture (B.4) ; aucun traitement ne la décide (question 18.35). Une annulation conditionnée par les données de l’occurrence reste ouverte (18.36). Aucune autre obligation n’est ajoutée ni retirée.
>
> **Amendement du 2 novembre 2026 — engagement par ressource visée.** Une erreur synchrone d’engagement ne rend plus non tenté tout le reste de la liste : elle ferme la ressource visée par l’effet en échec et les parts qui en descendent (C.3). Des parts sœurs étant disjointes (T7), un slot introuvable ne prive plus de matérialisation les slots déclarés après lui, et le rendu ne dépend plus de leur ordre de déclaration. La réponse 18.31 est amendée en conséquence ; aucune autre obligation n’est ajoutée ni retirée.
>
> **Amendement du 30 octobre 2026 — protocole du monde fermé.** Le C.4 fournit un protocole établissant l’indépendance des saisies dans une part et des parcours de l’historique, sans lequel D18 n’autorisait aucune Command de l’interface (point R3 de la [relecture de fond V0.9.4](rapports/relecture-V0.9.4-2026-10-30.md) ; question 18.32).
>
> **Jalon V0.9.4.** Le [suivi des vingt corrections](rapports/corrections-V0.9.4-2026-10-30.md) rattache les amendements à la revue V0.9.3, conservée comme rapport historique. La causalité garantie est désormais celle des déclenchements observables : une notification non corrélable porte explicitement un antécédent inconnu (C.4), jamais un parent inventé. Cette révision de contrat ne vaut ni preuve formelle de consistance ni note automatique de 10/10. Les ADR antérieurs Accepted ne sont pas réécrits par cette mise à jour ; leur éventuelle succession et l’alignement du code demeurent distincts.

Les rapports de chaque jalon sont dans `docs/rapports/`. La matrice de traçabilité (`docs/tracabilite.md`) recense chaque élément de la théorie, et la table de conformité (`docs/gardes.md`) leurs gardes. L'historique des modifications est dans git.

## 1. Objet

Le vocabulaire fondamental fixe le sens des termes employés par les axiomes de Bonsai. La théorie se construit dans l'ordre suivant :

1. termes primitifs ;
2. définitions ;
3. axiomes, qui contraignent le modèle ;
4. garanties, qui contraignent l'infrastructure de communication ;
5. conséquences établies, démontrées à partir des précédents ;
6. objectifs, qualités que Bonsai poursuit sans que les axiomes les imposent ;
7. décisions de conception, propres à Bonsai sans être imposées par les axiomes, et justifiées par un objectif, une conséquence, ou la clause d'axiome ou la définition qu'elles mettent en œuvre (2.6) ;
8. rôles dérivés ;
9. gardes (§19) ;
10. annexes : A, inventaire informatif des sources de l’hôte navigateur ; B, catalogue normatif de ses adaptateurs ; C, protocole d’exécution normatif.

Les rôles (`Application`, `Feature`, `Entity`, `Foundation`, `Composer`, `View`, `Behavior`, `Manifest`, adaptateur de l'hôte) ne font pas partie du vocabulaire fondamental. Un rôle dérivé n'est pas nécessairement un composant. `Command`, `Query` et `Event` sont les trois voies établies par T2.

## 2. Règles de définition

### 2.1 Termes primitifs

Un terme primitif n'est pas défini à partir d'autres termes de la théorie. Son sens résulte de son usage dans les définitions et les axiomes, des configurations qui les satisfont et des contre-exemples qui les violent. Son explication intuitive ne peut pas servir de prémisse dans une démonstration.

### 2.2 Termes définis

Chaque définition exprime une seule notion ; n'emploie ni le terme défini ni un synonyme ; n'utilise que des termes primitifs, des termes antérieurs dans la chaîne du §17 et le métalangage ; ne dépend d'aucun rôle dérivé ; ne comporte aucun exemple ; ne prescrit aucun mécanisme d'implémentation.

Dans les §4 à §11, le premier paragraphe après chaque titre est la **définition**. La rubrique **Dépendances** en décrit les dépendances définitoires. Les paragraphes suivants sont des **commentaires informatifs**, sauf les paragraphes explicitement marqués **Prescription normative**. Les commentaires peuvent renvoyer à des notions ultérieures, mais ne constituent aucune prémisse supplémentaire. Une prescription normative tire son autorité de la règle nommée, ou assume explicitement le statut de règle de lecture ; elle ne se dissimule pas dans une définition.

### 2.3 Métalangage admis

Sont admis sans définition : action, auteur, changer, code applicatif, commencer, contenir, continuer, déclarer, délimiter, délivrer, démarrage, désigner, destinataire, détruire, distinguer, ensemble, erreur, exécuter, exécution, exister, fait, information, limite, matérialiser, modifier, opération, partie, produire, règle, relation, signaler, suite, transmettre, utiliser, utilisateur.

« Exister » garde son sens ordinaire ; il ne renvoie pas à l'existence au sens de 7.1. « Code applicatif » désigne le code écrit pour une application, par opposition à Bonsai. « Exécution » désigne uniquement l'exécution d'une opération ; la marche du modèle dans le temps est désignée par « vie du modèle ». « Démarrage » désigne la création de la racine et de ses enfants déclarés, avec leur initialisation, avant l’ouverture de la délivrance des messages différés. L'auteur d'un message est le composant qui le produit. « Produire » et « transmettre » décrivent un acte matériel ; un énoncé normatif ne les emploie jamais seuls pour désigner qui traite ou qui reçoit un message.

Une information n'est ni un composant, ni une ressource, ni un message ; elle peut être contenue dans une ressource ou portée par un message.

Un mot entre dans le vocabulaire lorsqu'il reçoit un sens propre à Bonsai, modifie la portée d'un axiome, peut recevoir deux sens architecturaux différents, ou intervient dans plusieurs définitions comme notion technique autonome.

### 2.4 Unicité lexicale

Une notion a un seul terme canonique ; les synonymes sont exclus des énoncés normatifs. Choix retenus :

- `propriétaire` ; « posséder » et « détenir » sont proscrits ;
- `infrastructure de communication`, et non `médiateur` ou `framework` ; le terme s'emploie toujours sous sa forme complète. « Bonsai » désigne la théorie et le logiciel dans leur ensemble ;
- `interface utilisateur`, et non `couche concrète` ;
- `Channel`, et non `canal` ;
- `Query`, et non `Request` ; en français, « consultation ». Une Command demande une action sans réponse et peut être refusée ou sans effet ; une Query demande une connaissance en lecture seule et rend une réponse en cas de succès (A3.g, A3.j, T2) ;
- `namespace`, uniquement pour une représentation textuelle d'identité ;
- `adresser`, `émettre`, `recevoir` et `traiter` désignent quatre actes distincts (§9) ;
- `création`, `attribution` : deux actes distincts ; il n'existe aucun transfert de propriété (A2.c).

« Modèle » désigne uniquement l'univers organisé par Bonsai (3.1). « Contre-exemple » désigne une configuration qui viole un axiome.

### 2.5 Définition, axiome et lecture des axiomes

Une définition dit **ce qu'est** une notion. Un axiome dit **ce qui est permis, interdit ou obligatoire** ; chacune de ses clauses doit pouvoir être fausse dans un contre-exemple concevable, qui l'accompagne.

**Règle de lecture — autorité et validation.** Les règles d’autorité, d’accès, de médiation et de causalité s’appliquent pendant toute l’exécution. Les invariants d’état sont vérifiés à la fin réussie de chaque unité de validation (9.13) et à la fin de la racine. Les opérations internes d’une unité peuvent produire des états intermédiaires ; elles ne constituent pas chacune une validation. Une consultation imbriquée ne valide pas l’état de son auteur. G5 interdit d’interroger un composant actif ; A3.g impose la lecture seule transitive. Les échecs suivent G7 : seules les ressources internes bénéficient du rollback, pas les effets déjà appliqués à l’hôte.

**Règle de lecture — démarrage et création.** Le démarrage est une unité de validation exceptionnelle, dont la cause est une origine (A5.b). La racine crée ses enfants déclarés et établit leurs Channels avant les consultations initiales, puis les initialise ; les messages différés et les admissions survenues entre-temps attendent sa réussite, et son échec abandonne le modèle en construction (C.1). Après le démarrage, l’initialisation d’un composant créé pendant un traitement fait partie de l’unité de validation de son créateur, y compris pour l’échec ; elle reste exécutée par le composant propriétaire des ressources concernées, sans délégation d’autorité.

**Règle d'imputation.** Ce qu'exécute une partie d'un composant qui n'est pas elle-même un composant est exécuté par ce composant.

**Règle de cascade.** La fin des ressources d'un composant, par l'effet de la destruction de son existence, fait partie de cette destruction ; ce n'est pas une opération exclusive exécutée par un autre composant.

Cette règle règle l’imputation des fins, non la preuve de leur nécessité (T3). La destruction logique se déroule de bas en haut : la clôture des descendants et la restitution de leurs portions précèdent la fin des contenants et composants concernés. Chaque restitution, modification du contenant sans nouvelle attribution, est imputée à son propriétaire encore présent à cette étape, même si celui-ci disparaît ensuite dans la cascade. L’ancêtre initiateur ne reçoit aucune autorité sur les ressources de ses descendants. Ces étapes structurelles n’exécutent aucun traitement applicatif, ne délivrent aucun message et restent annulables ensemble sous G7. Le nettoyage physique est post-validation (C.7) ; sa réussite n’est pas une condition de fin logique.

### 2.6 Objectifs, conséquences et décisions

Une **conséquence établie** est une proposition démontrée à partir des définitions et d’hypothèses explicitement identifiées : axiomes, règles de lecture et garanties d’infrastructure ; une conséquence propre à un choix Bonsai nomme aussi la décision concernée. Les **garanties d’infrastructure** sont des obligations contractuelles prises comme hypothèses, non des résultats démontrés depuis les axiomes. Une propriété garantie du système est une conséquence dont ces hypothèses sont nommées. Un **objectif** est une qualité que Bonsai poursuit sans que les axiomes l’imposent (15.1).

Aucune démonstration ne s'appuie sur un objectif, et aucun objectif n'est une prémisse. Une décision (15.2) donne sa justification, nomme l'alternative qu'elle écarte, et désigne ce qu'elle protège : un objectif, une conséquence, ou la clause d'axiome ou la définition qu'elle met en œuvre.

### 2.7 Protocole d’exécution

Les contrats opérationnels que supposent les garanties et les décisions — disponibilité et publication, durée de vie, effets, corrélation des occurrences, observations consultables, réservations d’abonnements, structure transactionnelle — forment l’annexe C, normative. Elle précise ces règles sans modifier les définitions, les axiomes ni le graphe du §17.

## 3. Termes primitifs

### 3.1 Modèle

**Terme primitif de frontière.** Explication intuitive : ce que Bonsai organise et dont parlent les axiomes. Ce que le modèle contient, et ce qui lui reste extérieur, est fixé par A0.

### 3.2 Hôte

**Terme primitif de frontière.** Explication intuitive : ce qui fournit au modèle ses conditions initiales d'existence sans appartenir lui-même au modèle. Le terme ne présuppose ni navigateur, ni document, ni plateforme particulière.

Une ressource de l'hôte est ce que l'hôte matérialise, dont l'état persiste entre deux lectures et ne change que par des faits. Une valeur que l'hôte produit à chaque lecture, sans état persistant, comme l'heure courante ou une valeur aléatoire, n'est pas une ressource de l'hôte : la lire n'est pas une admission. L'expiration d'une minuterie, elle, est un fait (A5).

### 3.3 Infrastructure de communication

**Terme primitif de frontière.** Explication intuitive : l'ensemble de ce qui transporte les messages entre les composants, hors de ce qui est offert aux composants, sans appartenir lui-même au modèle. Le terme désigne un ensemble et non un objet particulier. L'infrastructure de communication n'est soumise à aucun axiome ; elle est tenue par ses garanties (§13).

Ce que Bonsai fournit pour transporter les messages relève de l'infrastructure de communication, y compris lorsqu'il est logé dans les classes de base des composants. La règle d'imputation (§2.5) ne s'y applique pas.

### 3.4 Système extérieur

**Terme primitif de frontière.** Explication intuitive : ce avec quoi le modèle échange des informations sans appartenir lui-même au modèle, sans lui fournir ses conditions initiales d'existence et sans transporter ses messages. Le terme ne présuppose ni réseau, ni protocole, ni persistance.

Un système extérieur est distinct de l'hôte, qui fournit au modèle ses conditions initiales d'existence, et de l'infrastructure de communication, qui transporte ses messages.

L'interlocuteur d'une requête réseau, d'une connexion persistante ou d'un flux d'événements serveur est un système extérieur : l'hôte en fournit le moyen d'appel sans être l'interlocuteur.

### 3.5 Composant

**Terme primitif.** Explication intuitive : unité active ou structurelle susceptible de participer au modèle. Le terme ne présuppose ni rôle, ni classe TypeScript, ni représentation visuelle, ni autonomie, ni position dans une structure.

### 3.6 Ressource

**Terme primitif.** Explication intuitive : ce dont un composant peut être propriétaire. Principe de travail, non normatif : une catégorie n'est traitée comme ressource que si l'on peut nommer ses opérations exclusives.

### 3.7 Message

**Terme primitif.** Explication intuitive : ce qui est transmis au cours d'une interaction fonctionnelle. Le terme ne présuppose ni émetteur ou destinataire déterminé, ni catégorie, ni traitement synchrone, ni transport réseau.

### 3.8 Propriété

**Terme primitif.** Relation entre un composant et une ressource. Explication intuitive : ce qui rattache une ressource au composant qui en répond.

Son sens est fixé par les axiomes : A1 la rend unique et réserve à elle seule l'exécution des opérations exclusives ; A2 en fixe l'origine et l'immuabilité.

## 4. Cadre

### 4.1 Périmètre

Ensemble déterminé de composants, de ressources, de messages et de faits considéré pour l'application d'une définition ou d'une règle.

**Dépendances :** composant, ressource, message.

### 4.2 État

Ressource susceptible de changer au cours de la vie du modèle.

**Dépendances :** ressource.

## 5. Autorité

### 5.1 Opération exclusive

Opération qui modifie ou détruit une ressource.

**Dépendances :** ressource.

La lecture d'une ressource n'est pas une opération exclusive. La création non plus : elle ne modifie ni ne détruit aucune ressource existante.

### 5.2 Propriétaire

Composant en relation de propriété avec une ressource.

**Dépendances :** composant, ressource, propriété.

L'unicité du propriétaire est imposée par A1.a.

## 6. Création et distribution

### 6.1 Création

Action par laquelle une ressource commence d'exister.

**Dépendances :** ressource.

Créer un composant consiste à créer son existence (A0.d).

### 6.2 Paramètres de création

Information transmise par le composant qui crée une ressource, au cours de cette création.

**Dépendances :** composant, ressource, création.

Une information transmise après la création n’est pas un paramètre de création. Elle constitue une interaction fonctionnelle seulement si elle satisfait 10.6, notamment ses exclusions ; elle est alors soumise à A3.a.

### 6.3 Part

Ressource délimitée au sein d'une ressource.

**Dépendances :** ressource.

Une part est elle-même une ressource ; d'autres parts peuvent à leur tour être délimitées en son sein. « Part de R » désigne une ressource délimitée au sein de R au moment de son attribution : elle reste une part de R après en avoir été soustraite (6.5).

### 6.4 Ressource distribuable

Ressource dont les parts peuvent avoir des propriétaires distincts.

**Dépendances :** ressource, part, propriétaire.

### 6.5 Attribution

Action par laquelle le propriétaire d'une ressource distribuable crée une part de celle-ci, en désigne le propriétaire et soustrait de cette ressource ce que la part en occupe, jusqu'à la fin de cette part.

**Dépendances :** propriétaire, ressource distribuable, création, part.

L'attribution crée une part et la soustrait de la ressource distribuable : la portion attribuée cesse d'en faire partie. Elle modifie donc la ressource distribuable : c'est une opération exclusive, réservée à son propriétaire (A1.b). La définition de la création (6.1) s'applique à la part ; l'exception d'A2.a en désigne directement le propriétaire initial. Lorsque la part prend fin, la portion qu'elle occupait (6.6) est rendue à la ressource distribuable dont elle a été soustraite : c'est la limite « jusqu'à la fin de cette part » de la définition (A2.d, T3).

### 6.6 Portion

Partie d'une ressource distribuable qu'occupe une part.

**Dépendances :** ressource distribuable, part.

Une portion n'est pas une ressource : elle désigne l'emplacement d'une part au sein de la ressource dont elle a été soustraite. Une même portion peut être occupée successivement par plusieurs parts, qui sont des ressources distinctes (T3, corollaires).

## 7. Structure

### 7.1 Existence

Ressource associée à un composant déterminé, dont la seule opération exclusive est la destruction, et dont la destruction entraîne celle de ce composant.

**Dépendances :** ressource, composant.

### 7.2 Parent

Propriétaire de l'existence d'un autre composant.

**Dépendances :** propriétaire, existence, composant.

### 7.3 Enfant

Composant dont l'existence a pour propriétaire un parent.

**Dépendances :** composant, existence, parent.

### 7.4 Racine

Composant du modèle qui n'est l'enfant d'aucun composant du modèle.

**Dépendances :** composant, enfant, modèle.

**Prescription normative — règle de lecture de la racine.** L’existence d’une racine satisfait 7.1, mais est fournie par l’hôte et n’est pas une ressource du modèle ; aucun composant ne l’admet (A0.d). A1.a et T1 ne s’y appliquent pas. Aucun composant n’est autorisé à en provoquer la destruction : sa fin ne peut venir que de l’hôte. L’abandon d’un démarrage échoué retire le modèle en construction, sans accorder à un composant la propriété de cette existence extérieure.

### 7.5 Composition

Relation entre un parent et ses enfants produite par la propriété de leur existence.

**Dépendances :** parent, enfant, existence, propriétaire.

## 8. Identité

### 8.1 Espace des identités

Ressource distribuable dont les parts permettent de distinguer une ressource ou un composant au sein d'un ensemble.

**Dépendances :** ressource distribuable, part, ressource, composant.

### 8.2 Identité

Part d'un espace des identités, dont les modifications sont limitées à l'attribution de parts en son sein et à l'action inverse lorsque ces parts prennent fin.

**Dépendances :** part, espace des identités, attribution.

Une identité se modifie par attribution et restitution structurelle de portions, sans réattribution implicite ni changement de propriétaire. Elle ne prend fin qu'avec son propriétaire (A2.d), par cascade (§2.5), et ne peut pas être détruite isolément. Une identité au sein de laquelle des parts sont attribuées est une ressource distribuable dont les parts permettent de distinguer : elle satisfait la définition 8.1, et ces parts sont donc elles-mêmes des identités, dites subordonnées.

### 8.3 Représentation d'identité

Information utilisée pour exprimer une identité.

**Dépendances :** identité.

Une représentation d'identité n'est pas une ressource (§2.3).

### 8.4 Namespace

Représentation textuelle d'une identité dans un espace des identités.

**Dépendances :** représentation d'identité, identité, espace des identités.

### 8.5 Désignation

Information nommant une ressource ou un composant en vue d’une résolution, sans en donner l’accès direct ni accorder d’autorité.

**Dépendances :** ressource, composant.

**Prescription normative — validité des désignations (A2.c, A2.d, A3.c).** Une désignation de part vise une attribution déterminée. Elle est utilisable seulement pendant la vie de cette part ; une nouvelle attribution du même emplacement ne la réactive pas. Elle ne requiert pas une identité du §8.2 dont le propriétaire de la part serait propriétaire.

## 9. Communication

### 9.1 Channel

Ressource relativement à laquelle un message est transmis, dont les opérations exclusives sont la modification des messages qui peuvent être transmis relativement à elle et sa destruction.

**Dépendances :** ressource, message.

### 9.2 Abonnement

Ressource dont le propriétaire est destinataire des messages transmis depuis un Channel déterminé, et dont la seule opération exclusive est la destruction.

**Dépendances :** ressource, propriétaire, message, Channel.

Créer un abonnement n'est pas une interaction fonctionnelle : aucune information n'est transmise au propriétaire du Channel. L'infrastructure de communication matérialise l'abonnement sans en être propriétaire (G4).

### 9.3 Traitement

Exécution par un composant, en réponse à la délivrance d'un message, qui se termine sans attendre aucun fait ultérieur.

**Dépendances :** composant, message.

Un traitement est synchrone. Un fait survenant après son début entre dans le modèle par un nouveau message (A5).

### 9.4 Transport

Action par laquelle l'infrastructure de communication prend en charge un message, le délivre aux composants qui en assurent le traitement et, le cas échéant, rend à son auteur l'information que ce traitement produit en retour.

**Dépendances :** infrastructure de communication, message, composant, traitement.

### 9.5 Message local

Message qu'un composant se transmet à lui-même, soumis au transport, sans Channel.

**Dépendances :** message, composant, transport, Channel.

Un message local n'est adressé à aucun Channel et n'est émis sur aucun Channel ; il porte un contexte causal comme tout message (A5.b).

### 9.6 Adresser

Transmettre un message à un Channel en vue de son traitement.

**Dépendances :** message, Channel, traitement.

Adresser ne présume pas que l'auteur du message est propriétaire d'un Channel.

### 9.7 Émettre

Transmettre un message depuis un Channel aux propriétaires des abonnements à ce Channel.

**Dépendances :** message, Channel, abonnement, propriétaire.

### 9.8 Recevoir

Se voir délivrer par transport un message émis sur un Channel.

**Dépendances :** transport, message, émettre, Channel.

Recevoir n'est pas une opération exclusive : plusieurs composants reçoivent un même message sans être propriétaires du Channel.

### 9.9 Référence

Information donnant à un composant un accès direct à une ressource, du modèle ou de l’hôte, ou à un autre composant, sans transport ni résolution préalable d’une désignation.

**Dépendances :** composant, ressource, hôte, transport, désignation.

Le code applicatif n'est ni une ressource ni une référence : désigner la classe d'un composant à créer ne permet d'atteindre aucune ressource ni aucun composant existant.

### 9.10 Référence structurelle

Référence d'un propriétaire vers une ressource dont il est propriétaire ou vers le périmètre de l'hôte lié à cette ressource, ou d'un parent vers son enfant.

**Dépendances :** référence, propriétaire, ressource, périmètre, hôte, parent, enfant.

**Prescription normative — usage structurel (A0.c, A3.a, A3.c).** Une référence du parent vers son enfant ne permet que la gestion de l’existence de cet enfant ; ni lecture de son état ni appel de méthode fonctionnelle. Une référence vers une ressource de l’hôte est une autorisation d’accès bornée, pas une dérogation au protocole d’observation et de Query (C.5).

**Prescription normative — résolution contrôlée (A3.c, A3.d).** Une désignation permet de demander une résolution ; elle n’accorde aucune autorité. Pour établir une référence structurelle, la résolution vérifie que la ressource désignée est bien celle dont le composant est propriétaire ; l'accès à la ressource de l’hôte qui lui est liée reste borné au périmètre autorisé par cette ressource (11.6), sans propriété de cette ressource de l’hôte. Un sélecteur n’autorise pas une recherche libre hors de ce périmètre. Une représentation d’identité peut servir de désignation sans devenir une référence. L’hôte n’étant pas un composant, sa résolution n’est pas une interaction fonctionnelle.

**Prescription normative — initialisation avant matérialisation (§2.5, C.3).** Une part peut être créée et attribuée dans le modèle avant que son élément soit matérialisé par l'hôte. Son initialisation utilise alors la ressource logique et prépare ses effets ; elle ne suppose ni élément physique déjà résoluble ni écriture hôte immédiate. La résolution de l'élément n'est effective qu'après sa matérialisation, pendant l'application des effets ou un traitement ultérieur. Une désignation ne permet pas de forcer cette application avant validation.

### 9.11 Réponse

Information rendue par transport à l'auteur d'un message adressé, produite par le traitement de ce message.

**Dépendances :** transport, message, adresser, traitement.

Une réponse n’est pas un message : elle n’a ni Channel ni contexte causal propre. Elle est rendue synchroniquement à l’auteur d’un message déclaré avec réponse (A3.j), pendant son traitement ou une initialisation autorisée (§2.5), sans attendre un fait ultérieur. Elle fait partie de cette interaction et non d’une interaction distincte (10.6). Une erreur n’est ni une réponse métier ni une valeur de substitution : elle se propage selon G7.

### 9.12 Message différé

Message adressé sans réponse, message émis ou message local.

**Dépendances :** message, adresser, réponse, émettre, message local.

Le nom tient à G5 : un message différé n’est délivré qu’à la fin réussie de l’unité de validation qui le produit. Un message adressé avec réponse, la Query (T2), n’est pas différé : il est traité pendant l’exécution de son auteur.

### 9.13 Unité de validation

Traitement d’un message différé, ou démarrage.

**Dépendances :** traitement, message différé.

Les invariants d’état sont vérifiés à la fin réussie de chaque unité de validation (§2.5), et son échec est régi par G7. L’initialisation d’un composant créé pendant un traitement fait partie de l’unité de son créateur (§2.5). Le traitement d’une Query n’est pas une unité de validation : il ne modifie rien (A3.g) et ne valide pas l’état de son auteur.

## 10. Causalité et interaction

### 10.1 Cause

Fait auquel un message ou un changement d'état est rattaché.

**Dépendances :** message, état.

Une cause est un fait, non une entité : elle n'est ni un composant, ni une ressource, ni un message. Le modèle la représente par le contexte causal.

### 10.2 Origine

Cause sans antécédent établi dans le périmètre observé.

**Dépendances :** cause, périmètre.

Le périmètre observé couvre les traitements du modèle et les faits extérieurs que ses interfaces peuvent leur corréler. Une origine est qualifiée démarrage, spontanée ou observation à antécédent inconnu selon C.4. La dernière qualification ne prouve pas l’absence d’une cause physique antérieure ; elle rend explicite son absence dans la connaissance garantie par le modèle.

### 10.3 Continuation

Cause qui continue une cause antérieure dans le périmètre observé.

**Dépendances :** cause, périmètre.

### 10.4 Chaîne causale

Ensemble constitué d'une origine et des continuations qui s'y rattachent directement ou indirectement.

**Dépendances :** origine, continuation.

### 10.5 Contexte causal

Information portée par un message permettant de le rattacher à une chaîne causale.

**Dépendances :** message, chaîne causale.

Le contexte causal n'est pas une ressource (§2.3).

La causalité décrit le déclenchement de l’exécution, avec un seul parent causal par message hors origine ; elle ne retrace pas toutes les dépendances historiques des données lues. Lire un état construit par des traitements antérieurs ne fusionne pas leurs origines. La création et la restitution des contextes relèvent de G8, non d’un choix du code applicatif.

**Prescription normative — sincérité causale (A5.b, A5.c, G8).** Le contexte distingue les qualifications d’origine du C.4 et les continuations corrélées. Un antécédent inconnu reste identifiable dans la trace ; il n’est ni une causalité complète ni une fusion multi-parent masquée. Toute chaîne est un arbre de déclenchements établis, non une reconstruction de toutes les causes physiques extérieures.

### 10.6 Interaction fonctionnelle

Transmission d'une information d'un composant à un autre composant, hors paramètres de création, hors transport et hors contexte causal.

**Dépendances :** composant, paramètres de création, transport, contexte causal.

Un message local n'est pas une interaction fonctionnelle ; il reste soumis à A3.f et A5.b.

## 11. Parties du modèle et frontière

### 11.1 Interface utilisateur

Partie du modèle formée des composants propriétaires d’une ressource servant de support de présentation à l’utilisateur ou d’expression de son intention, et de toutes les ressources dont ces composants sont propriétaires.

**Dépendances :** modèle, composant, ressource, propriétaire.

Une ressource appartient donc à la même partie du modèle que son propriétaire.

Une condition d’environnement n’est pas un support d’interaction du seul fait qu’une action humaine peut la modifier. Le focus d’un champ et le focus de la fenêtre sont ainsi distincts. Pour les cas limites de l’hôte navigateur, le classement normatif explicite est celui de B.3 ; l’annexe A en expose les motifs.

### 11.2 Domaine

Partie du modèle formée des composants et des ressources qui n'appartiennent pas à l'interface utilisateur.

**Dépendances :** modèle, composant, ressource, interface utilisateur.

Les messages ne relèvent d'aucune des deux parties : un message est émis, adressé ou traité par des composants de l'une ou de l'autre.

Une racine peut appartenir au domaine : créer un composant de l'interface utilisateur n'est pas une interaction fonctionnelle.

### 11.3 Invariant métier

Règle portant sur des ressources du domaine, dont le code applicatif exige la satisfaction.

**Dépendances :** ressource, domaine.

Les invariants métier sont définis par le code applicatif. Bonsai n'en fixe aucun ; il en contraint la satisfaction (A4.a) et la portée (T5).

### 11.4 Cohérence métier

Satisfaction des invariants métier.

**Dépendances :** invariant métier.

### 11.5 Information métier

Information portant sur une ressource du domaine.

**Dépendances :** ressource, domaine.

### 11.6 Admission

Action par laquelle une ressource ou un message est produit dans le modèle à partir d'un fait ou d'une ressource de l'hôte ou d'un système extérieur.

**Dépendances :** ressource, message, modèle, hôte, système extérieur.

**Prescription normative — admission (A5.a, A5.c).** L’admission d’un fait est un préambule sans mutation applicative qui soumet un message local au composant admetteur. Ses réactions, ses changements d’état et ses messages sortants sont exécutés pendant le traitement de ce message, sous G5 et G7. Admettre une ressource produit une ressource du modèle liée à une ressource de l’hôte, et non une double appartenance du même objet à A0.a. Les paramètres initiaux sont admis pendant le démarrage ; les faits ultérieurs passent par des messages. Une ressource de l’hôte peut changer hors du modèle ; sa nouvelle observation n’est intégrée que pendant le traitement du message local d’admission.

**Prescription normative — capture et disponibilité (annexe C).** L’unité de fait et la corrélation suivent C.4 ; les données capturées et observations consultables suivent C.5. Le préambule ne soumet le message qu’à une occurrence de vie valide (C.2). Capturer une notification pour la mettre en attente pendant le démarrage ou une destruction provisoire ne constitue pas une mutation applicative ni une permission de réentrance.

**Prescription normative — ressource de l’hôte et autorité (A1.b, A2.e).** « Admettre une ressource de l’hôte » est le raccourci pour produire une ressource du modèle liée à un périmètre de cette ressource de l’hôte. Son propriétaire est autorisé à préparer les effets de ce périmètre ; il ne devient pas propriétaire de la ressource de l’hôte. Cette autorité est exercée par le composant, même lorsque Bonsai fournit le mécanisme d’application. La conservation physique de la ressource de l’hôte n’entraîne pas celle de la ressource admise. Les conflits d’autorité entre racines coordonnées sont traités par B.2, distinctement de l’unicité interne A1.a.

**Prescription normative — portions de la ressource de l’hôte (6.5, A1.b).** L'attribution d'une part d'une telle ressource, directement ou par attributions successives, lie cette part à sa seule portion de la ressource de l’hôte. Son propriétaire exerce l'autorité sur cette portion ; le propriétaire de la ressource distribuable en est privé tant que la part existe. Cela n'est ni un transfert de propriété de ressource existante ni une admission supplémentaire de la même ressource de l’hôte. Les créations physiques dans cette portion restent des effets préparés soumis à C.3.

### 11.7 Frontière de confiance

Limite du modèle à laquelle s'opère l'admission.

**Dépendances :** modèle, admission.

La frontière de confiance n'a pas de propriétaire : elle est formée de tous les points d'admission. Ce qui la franchit n'est pas présumé conforme : un message admis est traité comme tout message, et les invariants métier sont satisfaits à l'issue de son traitement (A4.a) ; c'est ce traitement qui valide ce qui entre. En deçà de la frontière, toute ressource a un propriétaire (A1.a) et tout message une cause (A5.b) : c'est le sens du mot « confiance ».

Les différences entre l'hôte et les systèmes extérieurs ne tiennent pas à la frontière, mais à qui admet : seul le domaine échange des informations métier avec un système extérieur (A4.c) ; une source de l'hôte est admise par la Foundation (D3), par la View propriétaire de la part (16.5) ou par un adaptateur (D7) ; les minuteries et rappels d'animation sont admis par le composant qui les arme (B.6) ; le moyen d'appel d'un système extérieur, requête ou connexion, est une ressource de l'hôte admise par le composant du domaine qui l'utilise, et les faits qui y arrivent, réponse ou message poussé par le serveur, sont admis par ce composant (A5.c).

### 11.8 Effet

Changement demandé par un composant hors du modèle, sur une ressource de l’hôte ou auprès d’un système extérieur.

**Dépendances :** composant, modèle, ressource, hôte, système extérieur.

L’effet est la direction inverse de l’admission : il porte vers l’hôte ou un système extérieur ce que l’admission fait entrer dans le modèle. Un effet est préparé pendant une unité de validation et engagé après sa fin réussie (C.3) ; son engagement n’est pas sa réussite matérielle, dont le résultat est admis par un nouveau message (A5.c, G7).

## 12. Axiomes

Chaque clause est suivie de son contre-exemple.

**Champ des axiomes.** Lorsque plusieurs racines coexistent dans un même hôte, chacune et ses descendants forment un modèle distinct ; les axiomes s’appliquent séparément (A0.e). La finitude d’A0.e permet la clôture structurelle, sans garantir la terminaison d’un code applicatif arbitraire. Un changement provoqué par une autre racine n’est pas une continuation inter-racines (G6) ; il est indépendant pour la racine observatrice si le protocole l’établit, sinon qualifié antécédent inconnu (C.4).

### A0 — Cadre

> **A0.a** Tout ce qui intervient relève du modèle, de l'hôte, de l'infrastructure de communication ou d'un système extérieur, et d'un seul.
>
> **A0.b** Le modèle ne contient que des composants, des ressources et des messages ; ces trois catégories sont disjointes.
>
> **A0.c** Tout ce qu'on peut connaître ou changer d'un composant est son existence ou une ressource dont il est propriétaire.
>
> **A0.d** À chaque composant est associée exactement une existence, et chaque existence concerne exactement un composant ; cette association est immuable. Celle d’un non-racine est une ressource du modèle qui n’est une part d’aucune ressource ; créer ce composant consiste à créer cette existence. L’existence de la racine est extérieure et n’est admise par aucun composant.
>
> **A0.e** Tout modèle a exactement une racine ; tout autre composant y est relié par une chaîne finie de parents, et le modèle contient un nombre fini de composants et de ressources.

**Contre-exemples :** un registre de Channels est à la fois une partie de l'infrastructure de communication et une ressource qu'un composant modifie (A0.a) ; un service qui n'est ni composant, ni ressource, ni message est appelé par les composants, ou un parent traite son enfant comme une ressource (A0.b) ; un composant expose un cache interne qui n'est pas une ressource, et un autre l'interroge (A0.c) ; un composant est instancié sans existence : aucun composant ne peut le détruire, et il survit à son créateur ; ou un composant admet l'existence de la racine, et la détruit (A0.d).

Ce dont un parent est propriétaire n'est pas son enfant, mais l'existence de celui-ci (A0.b, 7.1).

**Contre-exemples structurels complémentaires :** deux existences différentes sont associées au même composant (A0.d) ; un cycle de parents, une chaîne sans racine ou une population structurelle infinie (A0.e).

### A1 — Propriété unique

> **A1.a** Toute ressource actuellement présente dans le modèle a exactement un propriétaire, lui-même composant actuellement présent dans ce modèle. Une relation historique vers un composant détruit ne satisfait pas cette obligation.
>
> **A1.b** Un composant n’exécute d’opération exclusive sur une ressource du modèle que s’il en est propriétaire. Il ne prépare d’effet sur une ressource de l’hôte qu’en vertu d’une ressource admise ou d'une part issue de celle-ci par attribution dont il est propriétaire, dans son seul périmètre (11.6) ; cela ne lui attribue pas la propriété de la ressource de l’hôte.

**Contre-exemples :** une ressource du modèle n'a aucun propriétaire (A1.a) ; deux composants modifient le même état, un composant modifie le titre du document alors qu'aucun composant ne l'a admis, ou plusieurs composants modifient une variable globale, ressource de l'hôte qu'aucun n'a admise (A1.b).

A1.b réserve au propriétaire les opérations sur les ressources du modèle et la préparation des effets autorisés sur les ressources de l’hôte admises (11.6, T8). Elle exclut toute délégation de cette autorité à un autre composant. La propriété de la ressource admise ne signifie pas la maîtrise des changements spontanés de la ressource de l’hôte. L’imputation et la cascade relèvent des règles de lecture (§2.5).

### A2 — Origine de la propriété

> **A2.a** Le composant qui crée ou admet une ressource en est le propriétaire initial, sauf pour une part d'une ressource distribuable, dont le propriétaire initial est désigné par attribution du propriétaire de cette ressource.
>
> **A2.b** Toute ressource distribuable est créée par une racine, admise depuis l'hôte, ou bien est une part d'une ressource distribuable.
>
> **A2.c** Le propriétaire d'une ressource demeure le même jusqu'à la destruction de celle-ci.
>
> **A2.d** Le propriétaire d'une ressource distribuable n'en attribue de part qu'à ses enfants. Une part ne prend fin qu'avec son propriétaire.
>
> **A2.e** Toute propriété initiale résulte exclusivement d’une création, d’une admission ou d’une attribution selon A2.a. Un composant n’est propriétaire d’aucune ressource extérieure non admise ; toute ressource dont il est propriétaire appartient au modèle.

**Contre-exemple d’A2.e :** un composant se déclare propriétaire d’un stockage extérieur avant toute admission, sans création ni attribution.

**Contre-exemples :** un composant choisit lui-même son identité (A2.a) ; un composant crée son propre espace des identités et s'y nomme (A2.b) ; un composant remet un état dont il est propriétaire à un autre composant (A2.c) ; une View attribue une part de son DOM à une View voisine, ou détruit son élément racine en cours de vie (A2.d).

A2.d maintient la restitution auprès du propriétaire du contenant, sans transfert de part. Dans une destruction directe comme dans une cascade profonde, cette restitution lui est imputée avant sa propre fin, selon l’ordre structurel du §2.5 ; l’ancêtre initiateur n’agit pas à sa place sur le contenant.

### A3 — Médiation

> **A3.a** Toute interaction fonctionnelle passe exclusivement par un message adressé à un Channel ou émis sur un Channel, soumis au transport.
>
> **A3.b** Tout Channel est distingué par une identité dont son propriétaire est propriétaire.
>
> **A3.c** Toute référence utilisée par un composant est une référence structurelle.
>
> **A3.d** Les paramètres de création ne contiennent aucune référence.
>
> **A3.e** Seul le propriétaire d'un Channel traite les messages adressés à ce Channel, et seul il émet sur ce Channel.
>
> **A3.f** Chaque occurrence de message relève d’exactement une catégorie de transport, fixée à sa production et immuable : adressée à un Channel, émise sur un Channel, ou locale sans Channel. Réutiliser une même valeur de charge utile dans deux catégories produit deux occurrences distinctes.
>
> **A3.g** Le traitement d’un message déclaré avec réponse est en lecture seule : il ne crée, ne modifie ni ne détruit aucune ressource du modèle, n’engage aucun effet sur l’hôte ou un système extérieur et ne produit aucun message différé. Il peut adresser d’autres messages avec réponse soumis à la même restriction. Les allocations temporaires de calcul ne constituent pas de ce seul fait des ressources du modèle.
>
> **A3.h** Un composant n'émet d'information que sur une ressource dont il est propriétaire.
>
> **A3.i** Toute interaction fonctionnelle a pour objet une ou plusieurs ressources déterminées. Une demande de connaissance porte sur ces ressources ou sur une information calculée à partir de celles-ci. Une demande d’action est adressée au propriétaire des ressources sur lesquelles elle lui demande d’agir ; une consultation accède aux ressources d’autres propriétaires uniquement par d’autres consultations conformes.
>
> **A3.j** Tout message adressé est déclaré avant sa délivrance soit comme une demande d’action sans réponse, soit comme une demande de connaissance avec réponse. Son mode ne dépend pas des effets constatés de son traitement. Un message émis annonce une information sur une ressource de son auteur (A3.h).

**Contre-exemples complémentaires :** une consultation lance une Command, remplit un cache persistant ou déclenche un appel réseau (A3.g) ; un composant expose comme interaction autonome un calcul sans aucune ressource pour objet (A3.i) ; une notification adressée sans demande d’action ni consultation, ou une demande d’action qui devient avec réponse seulement parce qu’elle n’a rien changé (A3.j).

**Contre-exemples :** un composant obtient une information d'un autre en appelant l'une de ses méthodes (A3.a) ; un composant ouvre un Channel sous l'identité d'un autre (A3.b) ; un parent lit l'état de son enfant par une référence (A3.c) ; un parent transmet à son enfant une fonction de rappel vers lui-même, ou un élément de l'hôte (A3.d) ; deux composants traitent les messages d'un même Channel, ou un composant émet sur le Channel d'un autre (A3.e) ; une Feature construit un message et appelle directement son propre traitement (A3.f) ; le traitement d'une demande de connaissance incrémente un compteur de consultations, ou le traitement d'une demande de changement rend une réponse (A3.g) ; une Feature émet qu'une commande a été expédiée, sur la foi d'une réponse du serveur, sans avoir inscrit ce statut dans son état (A3.h).

### A4 — Autosuffisance du domaine

> **A4.a** Les invariants métier sur l’état interne sont satisfaits à la fin réussie de chaque unité de validation (§2.5), en présence ou en l’absence d’interface utilisateur.
>
> **A4.b** Aucun composant du domaine n'adresse de message à un Channel dont le propriétaire appartient à l'interface utilisateur, ni ne reçoit de message émis sur un tel Channel.
>
> **A4.c** Seul le domaine échange des informations métier avec les systèmes extérieurs.
>
> **A4.d** Toute information présentée comme l’état métier validé provient d’un message émis par le domaine ou d’une réponse produite par celui-ci, éventuellement par dérivation de présentation. Une telle dérivation ne crée aucune autorité métier. Une intention ou un brouillon non validé peut porter sur le métier, mais ne doit pas être présenté comme son état confirmé.
>
> **A4.e** Un Channel dont le propriétaire appartient au domaine ne prend fin qu'avec la racine.

**Contre-exemples :** une Command laisse un panier dont le total ne correspond plus à ses lignes (A4.a) ; un composant du domaine reçoit un message émis par un composant de l'interface utilisateur, ou une Feature adresse un message au Channel de l'adaptateur du document (A4.b) ; un composant de l'interface utilisateur échange des informations métier avec un système extérieur (A4.c) ; au clic sur « Ajouter », une View incrémente le compteur du panier affiché sans attendre l'Event de la Feature (A4.d) ; une Feature est détruite par son parent, ou détruit son propre Channel, alors que l'application continue (A4.e).

A4.a n’exige aucune transaction atomique avec une ressource de l’hôte ou un système extérieur : la règle métier représente explicitement les intentions, observations, succès et échecs nécessaires (C.3).

A4.e pose la continuité d’existence des Channels du domaine pendant la vie de la racine ; elle ne se déduit pas de la seule cohérence d’A4.a. Une autre architecture pourrait détruire un Channel puis refuser les demandes ultérieures tout en conservant ses invariants. Bonsai exclut cette alternative par cet axiome. Existence ne signifie pas disponibilité inconditionnelle : une Query peut être refusée selon G5, une Command peut être refusée par le métier, et aucune progression générale n’est promise face à un traitement non terminant ou une activité infinie.

A4.d autorise les dérivations de présentation : copie, tri, filtre, pagination, formatage. Une règle faisant autorité sur le prix applicable, un total contractuel ou l’éligibilité est calculée par le domaine, non par la projection. Une saisie peut être une intention concernant le métier sans être une information validée. Un affichage optimiste est identifié comme non confirmé. Des réponses obtenues pendant des traitements distincts ne constituent pas automatiquement un instantané cohérent.

### A5 — Causalité

> **A5.a** Tout changement d’état interne résulte du traitement d’un message ou de l’initialisation autorisée au §2.5. Les changements des ressources de l’hôte par celui-ci ne sont intégrés comme observations du modèle que par admission ; les effets préparés par un traitement suivent sa validation interne.
>
> **A5.b** Tout message porte un contexte causal fidèle aux liens de déclenchement établis et aux limites de leur observation (C.4). Un message produit pendant un traitement en continue la causalité, y compris au retour d’une consultation imbriquée. Une nouvelle origine n’est établie que pour le démarrage, un fait indépendant établi ou une notification non corrélable explicitement qualifiée antécédent inconnu ; le code applicatif ne choisit, ne substitue ni ne réinitialise ce contexte.
>
> **A5.c** Une occurrence observable de l’hôte ou d’un système extérieur n’entre dans le modèle que par le message local du composant qui l’admet, tant que celui-ci existe. Un résultat corrélé à un traitement ou une initialisation en est une continuation ; un fait indépendant établi ouvre une origine spontanée ; une notification non corrélable ouvre une origine d’observation à antécédent inconnu. La qualification, la conservation et la restitution suivent C.2, C.4 et G8.
>
> **A5.d** Une même occurrence observable d’une source de l’hôte ou d’un système extérieur est admise par au plus un composant dans une racine. L’unité de notification et son identification sont fixées par le protocole de source (C.4), non par l’égalité des valeurs ni par l’intention humaine supposée.

**Contre-exemples :** un composant modifie un état à l'expiration d'une minuterie, sans message (A5.a) ; un message est transmis sans contexte causal (A5.b) ; un composant modifie un état directement dans un gestionnaire d'événement de l'hôte, ou la réponse à un appel lancé par une Feature est admise sans lien avec le message dont le traitement a lancé cet appel (A5.c) ; une View et l'adaptateur du document admettent tous deux le même appui sur une touche, et deux chaînes causales partent d'une seule cause (A5.d).

Un fait est **spontané** quand le protocole établit qu’aucun traitement du périmètre observé ne l’a provoqué ; il est **provoqué et corrélé** lorsqu’une interface instrumentée établit son rattachement à une opération. Une notification générale de redimensionnement ou de défilement peut rester d’antécédent inconnu : elle n’est pas déclarée spontanée par défaut. Les trois cas et les preuves de rattachement admises sont ceux du C.4, dont le protocole du monde fermé pour établir l’indépendance.

L'expiration d'une minuterie ou d'un rappel d'animation est un fait provoqué : elle est admise par le composant qui les a armés, et ne relève d'aucun adaptateur de l'hôte (D7).

Un changement effectué par l'hôte lui-même n'est pas un changement d'état du modèle tant qu'il n'a pas été admis.

A5.d est une règle de capture unique destinée à éviter les réactions dupliquées et les routages concurrents ; elle ne se déduit pas de la définition d’origine. Deux captures pourraient représenter la même cause, mais risqueraient aussi d’inventer deux origines. Bonsai interdit cette duplication indépendamment de ce risque. La règle s’applique par racine (§12) et n’oblige pas à admettre une source non activée ou une notification tardive dont le destinataire a disparu.

**Contre-exemples complémentaires :** attribuer une notification coalescée au dernier effet demandé sans preuve, qualifier d’inconnu un résultat dont le callback fournit la corrélation, ou admettre séparément les passages d’une même occurrence dans deux écouteurs violent A5.b–d.

## 13. Garanties de l'infrastructure de communication

L'infrastructure de communication n'est soumise à aucun axiome. Toute réalisation de l'infrastructure de communication est tenue par les garanties suivantes.

- **G1** — Elle délivre un message adressé à un Channel au seul propriétaire de ce Channel, et un message émis sur un Channel aux seuls propriétaires d'un abonnement à ce Channel, et un message local au seul composant qui l'a produit ; elle rend une réponse au seul auteur du message adressé dont le traitement l'a produite.
- **G2** — Elle garantit la capture des valeurs au point de transmission et leur absence d’alias mutable entre participants (C.5), sans modifier l’information transmise ni son contexte causal. La représentation matérielle peut changer sans changer la valeur ; chaque destinataire observe la valeur capturée.
- **G3** — Elle ne délivre aucun message relatif à un Channel détruit, ni aucun message, local compris, à un composant détruit. Les callbacks tardifs et réservations suivent C.2 et C.6 ; une occurrence de vie ou un abonnement nouveau ne récupère pas leurs anciennes délivrances.
- **G4** — Elle n'est partie à aucune interaction fonctionnelle et n'est propriétaire d'aucune ressource du modèle.
- **G5** — Elle ne délivre un message différé qu’à la fin réussie de l’unité de validation qui le produit. Un message déclaré avec réponse est traité synchroniquement pendant l’exécution de son auteur, uniquement si sa cible est prête à consulter (C.1) et n’a aucun traitement ni aucune initialisation en cours. Une cible non prête, détruite ou déjà active dans un traitement ou une initialisation, y compris l’auteur, entraîne un refus avec erreur et contexte causal selon G7 ; ni attente en file ni initialisation implicite n’est permise. Une consultation imbriquée ne valide pas son auteur. Les lectures initiales sont provisoires dans leur unité ; les traitements différés ne se chevauchent pas.
- **G6** — Elle ne délivre un message qu'à un composant de la même racine que son auteur ; une réponse n'est donc produite que dans cette racine.
- **G7** — L’échec d’une unité de validation restaure les ressources internes qu’elle a modifiées, abandonne ses créations internes et ses messages différés non délivrés, et ne rend aucune réponse de substitution. Une erreur de consultation interrompt son auteur et se propage jusqu’au traitement extérieur ou au démarrage ; aucune récupération locale n’est implicitement autorisée. Les consultations déjà exécutées restent dans la trace, sans effet grâce à A3.g. Les effets déjà appliqués à l’hôte ou aux systèmes extérieurs ne sont pas annulés : ils peuvent réussir partiellement, et les faits de succès ou d’échec sont admis par un nouveau message. L’erreur est signalée avec son contexte causal. Un refus métier attendu peut être une valeur normale de réponse ; une erreur de transport ne devient jamais un `null` de substitution.
- **G8** — Elle établit le contexte de démarrage et qualifie les admissions selon le protocole de source du C.4 : résultat corrélé, indépendance établie ou antécédent inconnu. Elle rattache les messages produits à leur traitement déclencheur et conserve le contexte des opérations corrélables jusqu’à leur résultat, annulation ou clôture de l’occurrence de vie (C.2), y compris après un échec. Un message hors origine a exactement un parent de déclenchement établi ; une origine d’observation inconnue n’en invente pas. Les consultations ne remplacent pas le contexte de leur auteur à son retour. Les effets passent par les interfaces Bonsai instrumentées ; un appel brut perdant un lien connu ou une heuristique fabriquant un parent n’est pas conforme. Aucune causalité physique exhaustive n’est garantie au-delà des corrélations observables.

Par G6, deux racines qui coexistent dans un même hôte ne se transmettent aucun message : un nom de Channel n'a de sens qu'au sein de sa racine.

Par G7, un traitement interrompu retrouve son état interne précédent et ne publie pas ses messages différés. Cette propriété ne promet aucune restauration des ressources de l’hôte. Une View peut laisser une projection partiellement appliquée si l’écriture hôte échoue ; les adaptateurs décrivent leurs possibilités de reprise et de compensation. Préparer les effets puis les appliquer après validation évite de publier une transaction interne annulée, mais ne prouve ni la réussite de ces effets ni leur atomicité. Une Command à un adaptateur ne transforme pas davantage l’hôte en transaction. L’annulation interne relève de l’infrastructure de communication (3.3).

Par G4, matérialiser un Channel ne confère pas à l'infrastructure de communication la propriété de ce Channel : celle-ci suit l'identité qui le distingue (A3.b).

Par G5, les traitements différés se succèdent. Les consultations seules peuvent s’imbriquer ; elles sont en lecture seule transitive (A3.g) et exigent une cible prête et inactive. Hors initialisation provisoire, elles lisent ses ressources internes validées ; pendant le démarrage ou l’unité de création, elles lisent uniquement les états prêts mais provisoires autorisés par C.1. Elles ne rééchantillonnent pas une ressource de l’hôte (C.5) et n’offrent pas d’instantané global entre traitements. Leur échec interrompt la pile synchrone selon G7. Les consultations déjà délivrées ne sont pas effacées rétroactivement si leur auteur échoue ensuite. L’ordre des messages différés et des réservations est fixé par D8.

## 14. Conséquences établies

Chaque conséquence est suivie de sa démonstration et nomme ses hypothèses. L1 est le corollaire immédiat d’une prémisse explicite ; T2 nomme et classe les contrats imposés par A3.j. Il ne prétend pas déduire cette discipline de la seule propriété.

**Statuts de lecture.** L1 est une **reformulation normative**, T2 une **classification et dénomination** sous contrats déclarés ; T1 et T3–T8 sont des **conséquences déductives sous hypothèses**. Ces catégories ne comptent pas autant de découvertes indépendantes. Les contre-exemples des axiomes illustrent leur violation ; sans vérification de toutes les autres prémisses, ils ne prouvent pas leur indépendance. Les démonstrations établissent des propriétés de sûreté sous les contrats nommés, non l’existence d’une implémentation ni la terminaison de tout traitement.

### L1 — Lemme de l'objet

> Toute interaction fonctionnelle a pour objet une ou plusieurs ressources déterminées.

L'objet d'une interaction est ce qu'elle demande de changer, ce qu'elle demande de connaître, ou ce sur quoi elle informe. Les autres valeurs qu'elle transmet, comme une quantité saisie ou une heure lue (3.2), n'en sont pas l'objet.

**Démonstration.**

1. A3.i impose explicitement un objet constitué d’une ou plusieurs ressources à toute interaction fonctionnelle.
2. Les informations accessoires et les calculs de présentation ne changent pas cet objet. ∎

L1 est une reformulation utile d’A3.i, non une découverte déduite d’A3.c. Un calcul pur sans ressource pour objet reste du code interne ; il n’est pas offert comme interaction autonome. Lire librement l’heure pendant un traitement reste permis (18.15), sans en faire l’objet d’un service de consultation dépourvu de ressource.

### T1 — Composition par création

> Le composant qui crée un autre composant en est le parent.

**Démonstration.**

1. Créer un composant consiste à créer son existence (A0.d).
2. Cette existence est une ressource du modèle qui n'est pas une part (A0.d) ; son créateur en est le propriétaire initial (A2.a).
3. Le propriétaire de l'existence d'un composant est son parent (7.2). A0.d rend cette existence unique ; A1.a rend donc ce parent unique. ∎

La racine n'est pas concernée : rien dans le modèle ne la crée (note de 7.4).

### T2 — Les trois voies

> Toute interaction fonctionnelle relève exactement d’un des trois contrats suivants : demande d’action adressée sans réponse (**Command**) ; demande de connaissance adressée avec réponse et en lecture seule (**Query**) ; information émise sur une ressource de l’auteur (**Event**). Command et Query sont traitées par le seul propriétaire du Channel ; un Event peut être reçu par plusieurs composants. Une Command exprime une intention de changement mais peut être refusée, devenue inutile ou sans effet. Une Query en échec ne rend pas de valeur et propage l’erreur selon G7.

**Démonstration.**

1. Par A3.a, une interaction passe par un message adressé ou émis, soumis au transport ; ces catégories sont exclusives par A3.f. Par A3.i, son objet est déterminé.
2. Un message adressé possède avant délivrance exactement un des modes d’A3.j. La demande d’action sans réponse est nommée **Command** ; la demande de connaissance avec réponse est nommée **Query**. Les modes sont disjoints et ne changent pas selon le résultat.
3. La Query respecte la lecture seule transitive d’A3.g. Une Command ne rend aucune réponse, même si son traitement ne modifie rien. L’autorité d’action demeure celle d’A1.b ; une consultation composée accède à une autre ressource uniquement par une autre Query (A3.i).
4. Le message émis est nommé **Event**. Seul le propriétaire du Channel y émet (A3.e), sur une ressource dont il est propriétaire (A3.h). Relayer une information exige de l’inscrire dans une ressource propre avant de l’émettre.
5. Le propriétaire du Channel, unique par A1.a, traite seul les messages adressés (A3.e, G1). Les propriétaires des abonnements peuvent recevoir le même Event (9.7, G1), sans devenir propriétaires de la ressource annoncée.
6. La partition est exhaustive sous A3.a et A3.j, et exclusive par A3.f et le contrat déclaré, non par une inférence sur l’intention cachée ou l’effet constaté. Les modes de délivrance du tableau suivent G5 et D8. ∎

| Contrat déclaré | Délivrance | Réponse | Effets |
| --- | --- | --- | --- |
| **Command** | différée | aucune | action autorisée, refus ou absence de changement possibles |
| **Query** | synchrone, hors réentrance | connaissance en cas de succès | lecture seule transitive |
| **Event** | différée vers les abonnés | aucune | annonce une ressource de l’auteur ; les abonnés réagissent séparément |

Un message local n’est pas une interaction fonctionnelle ; il n’ajoute pas une quatrième voie intercomposants. Une Command vers soi reste permise (18.13), sans constituer une interaction entre composants. Une Query vers soi est refusée par G5.

### T3 — Destruction en cascade

> La destruction d'un composant entraîne la destruction de toutes les ressources dont il est propriétaire.

**Démonstration.**

1. L'existence d'un composant C prend fin : soit son parent P la détruit, par une opération exclusive (7.1, A1.b), soit, si C est une racine, l'hôte y met fin (7.4).
2. À la fin réussie d’une unité de validation, toute ressource restante du modèle a un propriétaire encore présent dans ce modèle (A1.a, §2.5).
3. Une ressource dont C était propriétaire ne peut pas recevoir un nouveau propriétaire (A2.c).
4. Elle ne peut donc pas subsister : sa fin fait partie de la destruction de C (règle de cascade, §2.5).
5. Parmi ces ressources figure l'existence des enfants de C ; leur fin entraîne celle de leurs propres ressources. La configuration structurelle est finie et enracinée (A0.e) : l’application aux descendants n’exige aucune chaîne infinie. L’ordre d’imputation des fins et restitutions est celui du §2.5, pas une autorité générale donnée à C sur leurs ressources. ∎

Pour une ressource de l'hôte admise, sa fin dans le modèle n'est pas un effacement par l'hôte : elle cesse d'être une ressource du modèle, et ce que l'hôte matérialise lui reste. Une racine qui l'admet à nouveau en fait une nouvelle ressource, dont le composant qui l'admet est le propriétaire initial (A2.a) ; ce qu'elle y trouve entre dans le modèle par un message dont la cause est une origine (A5.c). Le stockage, l'adresse ou l'historique survivent ainsi au rechargement de la page sans qu'aucune ressource du modèle survive à sa racine.

**Corollaires.**

- Détruire un composant détruit toute sa descendance.
- Les abonnements d'un composant détruit sont détruits avec lui : aucun message émis ne lui est plus délivré (G1).
- Une part dont C était propriétaire prend fin sans transfert ; sa portion est rendue au contenant (6.5). Le propriétaire de ce contenant est le parent de C (A2.d). La restitution lui est imputée alors qu’il est encore présent dans l’ordre logique de cascade (§2.5), même si un ancêtre a initié cette cascade et que le contenant disparaît ensuite. Aucune méthode fonctionnelle du parent n’est appelée par cette règle structurelle.
- Une nouvelle attribution de la même portion produit une nouvelle part, qui est une autre ressource ; A2.c n'est pas en cause.

### T4 — Adressabilité

> Un composant propriétaire d'aucune identité n'est propriétaire d'aucun Channel : aucun message ne peut lui être adressé, et, hors ses messages locaux, il ne reçoit que des messages émis sur les Channels d'autres composants.

**Démonstration.**

1. Tout Channel est distingué par une identité dont son propriétaire est propriétaire (A3.b) : sans identité, aucun Channel.
2. Un message adressé l'est à un Channel (9.6) et n'est traité que par le propriétaire de ce Channel (A3.e, G1).
3. Tout message est adressé, émis ou local (A3.f) ; hors ses messages locaux (9.5), il ne reste donc à ce composant que la réception de messages émis par d'autres (9.8). ∎

Un tel composant peut néanmoins adresser des messages et recevoir les réponses à ceux-ci : une réponse n'est pas un message (9.11).

### T5 — Localité des invariants

> Une transition validée exigeant la modification conjointe de ressources internes préexistantes de propriétaires distincts ne peut pas être réalisée par des traitements séparés tout en préservant l’invariant à la fin de chaque unité de validation. Si cette transition doit être réalisable atomiquement, les ressources concernées relèvent du même propriétaire.

Dans ce résultat, une **transition requise** est une transition qui ne peut modifier une ressource sans modifier conjointement l’autre. Une simple relation mathématique conservée en refusant tout changement n’impose pas cette réalisabilité.

**Démonstration.**

1. Considérons une transition requise sur deux ressources internes préexistantes de propriétaires distincts ; sa réalisation exige de modifier les deux avant validation.
2. A1.b réserve chaque modification à son propriétaire. G5 interdit le chevauchement de leurs unités de validation ; les consultations imbriquées sont en lecture seule (A3.g).
3. À la première fin d’unité de validation où une des deux ressources est effectivement changée, l’autre ne peut donc pas avoir été modifiée conjointement par son propriétaire. L’invariant serait violé, contrairement à A4.a.
4. Refuser ou annuler cette transition préserve l’invariant mais ne réalise pas le changement requis. Pour qu’il soit réalisable atomiquement, il faut réunir les ressources sous un même propriétaire. ∎

Deux règles indépendantes, une relation maintenue par refus et une coordination à cohérence éventuelle ne sont pas ce résultat. L’initialisation d’un enfant crée de nouvelles ressources ; la cascade détruit les existences et ressources selon §2.5. Ces mécanismes ne fournissent pas une mutation atomique générale de ressources préexistantes de propriétaires distincts. Aucune atomicité avec l’hôte n’est déduite de T5.

### T6 — Survie du domaine

> Un composant du domaine propriétaire d'un Channel n'est détruit qu'avec la racine.

**Démonstration.**

1. Soit C un composant du domaine, propriétaire d'un Channel K. K est une ressource dont C est propriétaire.
2. Si C est détruit, toutes les ressources dont il est propriétaire prennent fin avec lui (T3), K compris.
3. Or K ne prend fin qu'avec la racine (A4.e).
4. C n'est donc pas détruit avant la fin de la racine ; A0.e le rattache à celle-ci par une chaîne finie. À la fin de la racine, qui vient de l'hôte (7.4), il prend fin avec sa descendance (T3). ∎

Toute Feature est propriétaire d'un Channel (16.3) : une Feature n'est détruite qu'avec la racine. Il en va de même d'un adaptateur de l'hôte qui appartient au domaine (D7). Aucune décision n'intervient dans cette démonstration.

### T7 — Disjonction des parts

> Deux parts existantes d'une même ressource distribuable ne se recouvrent pas.

**Démonstration.**

1. L'attribution soustrait de la ressource distribuable la portion qu'occupe la part attribuée (6.5, 6.6).
2. Une attribution ultérieure délimite sa part au sein de ce qui reste de cette ressource (6.3, 6.5) ; elle ne peut donc pas porter sur une portion déjà attribuée.
3. Une portion n'est rendue qu'à la fin de la part qui l'occupait (6.5) : tant que celle-ci existe, la portion reste soustraite. ∎

**Contre-exemple écarté :** deux Features reçoivent la même identité.

### T8 — Admission préalable

> Tout effet du modèle sur une ressource de l’hôte est autorisé par une ressource admise ou une part issue de celle-ci par attribution, dont le propriétaire est unique dans ce modèle.

**Démonstration.**

1. A1.b impose une ressource propre au composant, admise ou issue de celle-ci par attribution, pour préparer un effet sur la ressource de l’hôte dans son périmètre.
2. A2.e exclut une propriété arbitraire de la ressource de l’hôte ; l’admission produit la ressource du modèle liée à celui-ci (11.6), avec pour propriétaire initial son admetteur (A2.a). Les parts attribuées limitent l'autorité à leurs portions, soustraites à leur ressource d'origine (6.5).
3. La ressource autorisant l'effet a exactement un propriétaire dans le modèle (A1.a). La ressource de l’hôte n’a pas changé de catégorie. ∎

L’autorité d’effet sur l’historique, l’adresse, le titre ou le stockage appartient ainsi au propriétaire de la ressource admise, ou au propriétaire d’une part issue de celle-ci pour sa seule portion. Les restrictions supplémentaires des adaptateurs du profil navigateur relèvent de D7 et B.2, non de T8 seul.

## 15. Objectifs et décisions de conception

### 15.1 Objectifs

Un objectif est une qualité que Bonsai poursuit sans que les axiomes l'imposent. Il justifie des décisions ; il n'est pas une règle du modèle, et aucune démonstration ne s'y appuie (2.6). La liste est courte : elle ne s'allonge que si une décision ne peut se justifier ni par un de ces objectifs ni par une conséquence.

- **O1 — Rejouabilité.** Un code applicatif déterministe, rejoué depuis le même état initial sur la même suite de faits admis, produit les mêmes changements d'état. Bonsai n'ajoute aucun aléa (D8) ; les valeurs lues librement (18.15) ne se rejouent à l'identique que si l'implémentation les enregistre et les restitue, ce qui ne relève pas de la théorie.
- **O2 — Détection précoce des violations.** Une violation mécaniquement détectable est signalée au niveau le plus précoce possible : construction, analyse statique, démarrage ou exécution (18.7, §19). Une obligation sémantique non vérifiable mécaniquement fait l'objet d'une justification et d'une revue ; cet objectif ne promet ni détection exhaustive ni preuve automatique de conformité.
- **O3 — Ergonomie de développement.** Une application conforme s'écrit sans code ni notion étrangers à son métier, au-delà de ce que les axiomes exigent.

Les autres qualités souvent invoquées sont des conséquences, non des objectifs :

| Qualité | Établie par |
| --- | --- |
| Traçabilité causale observable : tout changement d’état interne se rattache à un traitement ou une initialisation ; les liens établis et les origines d’observation inconnues sont distingués, sans provenance exhaustive des données ni des causes physiques | C.4, A5.a, A5.b, G8 |
| Cohérence métier : les invariants d'état interne sont satisfaits à la fin des unités de validation ; une transition requise exigeant des mutations conjointes de ressources internes préexistantes relève d'un même propriétaire | §2.5, A4.a, T5 |
| Continuité des composants du domaine propriétaires d'un Channel, tant que la racine existe | A4.e, T6 |
| Isolation des composants : on n'agit sur une ressource que par son propriétaire | A1, A3.c, G1 |

Le déterminisme n'est ni un axiome ni un objectif distinct : un code qui lit l'heure ou une valeur aléatoire reste conforme (18.15), et ce que Bonsai garantit de son côté est l'ordre de délivrance (D8), au service de O1.

### 15.2 Décisions

Une décision fixe un choix propre à Bonsai que les axiomes n’imposent pas. Elle ne modifie pas les axiomes, mais restreint les réalisations conformes au profil Bonsai qui l’adopte : les décisions actives sont obligatoires pour une application revendiquant ce profil, non des options individuelles. Un autre profil pourrait choisir autrement tout en satisfaisant le noyau axiomatique. Chaque décision donne sa justification, nomme l’alternative écartée et désigne ce qu’elle protège : objectif, conséquence, clause d’axiome ou définition. Une règle déjà déduite des axiomes n’est pas une décision.

D3, D7, D10 et D15 nomment le document, son corps, l'adresse et l'historique : ces termes sont ceux de l'hôte navigateur (annexes A et B), que 3.2 ne présuppose pas. Pour un autre hôte, ces décisions portent sur ce qui en tient lieu.

- **D1 — Enfants de la racine.** Les Features et la Foundation sont des enfants de la racine. La racine ne détruit pas l'existence de la Foundation. *Pourquoi :* un domaine à plat, où aucune Feature n'est responsable de l'existence d'une autre, et une Foundation qui reste propriétaire du corps du document tant que la racine existe. *Alternative écartée :* des Features enfants d'autres composants ; A4.e le permettrait sous un parent qui ne les détruit jamais, mais leur existence dépendrait alors de la survie de ce parent. La survie des Features ne dépend pas de D1 (T6). *Protège :* A4.e, dont c'est la façon la plus simple de garantir le respect ; O3.
- **D2 — Pérennité de l'Entity.** Une Feature ne détruit pas son Entity. Réinitialiser une Entity est une modification, non une destruction. L'identité et le Channel d'une Feature, eux, ne prennent fin qu'avec elle par A2.d et A4.e. *Pourquoi :* détruire puis recréer une Entity revient à la modifier ; la détruire sans la recréer laisserait des invariants sans objet à l'issue du traitement. *Alternative écartée :* réinitialiser une Entity par destruction puis recréation. *Protège :* A4.a, A4.e.
- **D3 — Élément de la Foundation.** La Foundation admet un élément de l'hôte comme ressource distribuable, par défaut le corps du document. Elle n'admet rien d'autre de l'hôte, hormis les résultats instrumentés de ses propres effets (C.3). Deux racines n'admettent pas deux éléments dont l'un contient l'autre. *Pourquoi :* la Foundation relève de l'interface utilisateur, et une ressource relève de la même partie que son propriétaire (11.1) ; les autres sources du document relèvent de parties différentes et ont leur adaptateur (D7). Un élément autre que le corps permet à plusieurs racines de coexister sans se disputer l'affichage. *Alternative écartée :* une Foundation qui admettrait toutes les sources du document (en-tête, élément racine, fenêtre) ; une Foundation limitée au corps, qui exclurait plusieurs racines dans un même document. *Protège :* 11.1, D7, G6.
- **D4 — Une Feature, une Entity.** Une Feature est propriétaire d'exactement une Entity. *Pourquoi :* T5 exige un propriétaire commun pour rendre réalisable une transition requise qui impose des mutations conjointes de ressources internes préexistantes ; une seule Entity donne à chaque Feature un état unique et lisible, sans prétendre que toute relation entre ressources impose leur regroupement. *Alternative écartée :* une Feature propriétaire de plusieurs Entities. *Protège :* O3.
- **D5 — Retirée.** La règle qu'elle énonçait découle des axiomes : la racine attribue leur identité aux Features (16.1).
- **D6 — Interface non adressable.** Ni une View ni un Composer n'est propriétaire d'une identité. *Pourquoi :* une View ou un Composer est détruit par cascade à tout moment (T3) ; un Channel de l'un d'eux pourrait disparaître alors qu'un message lui est destiné, ce que A4.e évite pour le domaine. Toute coordination entre Views passe par le domaine, et l'interface reste une projection. *Alternative écartée :* des Views propriétaires d'une identité subordonnée, pour que des Views s'adressent des messages entre elles. *Protège :* A4.d, T3.
- **D7 — Adaptateurs de l'hôte.** Chaque source de faits ou de ressources de l'hôte située hors des éléments admis par les Foundations (D3) est admise par un seul composant, son adaptateur, enfant de la racine, hors les moyens d'appel des systèmes extérieurs, les minuteries et les rappels d'animation, admis par le composant qui les utilise ou les arme (B.6). Aucun autre composant n'admet cette source ; chaque composant admet en revanche les résultats instrumentés de ses propres effets (C.3). *Pourquoi :* une seule frontière de confiance par source, et un seul message d'origine par fait spontané (A5.d). Un adaptateur reçoit une identité de la racine (D1, A2.d), ce qui lui permet d'être propriétaire d'un Channel et d'émettre sur l'état d'observation où il a inscrit les faits admis (A3.h). Le document lui-même, hors des éléments admis par les Foundations (en-tête, élément racine, sources déclarées de niveau document), a son propre adaptateur, qui relève de l'interface utilisateur. Un adaptateur relève d'une seule partie (11.1) : les sources d'une même zone de l'hôte qui relèvent de parties différentes ont des adaptateurs distincts (B.3 ; motifs en annexe A). *Alternative écartée :* chaque composant qui a besoin d'une source l'admet lui-même ; un même fait produirait alors plusieurs origines. *Protège :* A5.c, A5.d, 11.7.
- **D8 — Ordre de délivrance.** Les messages différés en attente sont délivrés dans l'ordre où ils ont été produits, à la fin réussie de l’unité de validation qui les produit (G5, G7). Un message émis est délivré aux propriétaires des abonnements dans l'ordre des abonnements ; ces délivrances prennent rang au moment de l'émission. Les Queries suivent l'exception synchrone de G5, non cette file. *Pourquoi :* à code applicatif et faits admis identiques, la suite des traitements est la même, et c'est l'ordre que suit un développeur qui lit son code. *Alternative écartée :* un ordre non spécifié, ou une délivrance en profondeur d'abord, où un message différé produit au cours d'un traitement passerait avant les messages plus anciens. *Protège :* O1, O3. Précisions opérationnelles : C.8.

- **D9 — Borne causale.** Toute suite de continuations dont chacune continue la précédente, depuis l'origine, compte au plus un nombre fixé de termes, le même pour toute la racine. Un message qui allongerait une telle suite au-delà de la borne n'est pas délivré, et l'infrastructure de communication le signale. La borne porte seulement sur la profondeur, ni sur le travail total ni sur la terminaison de tout processus. Un message émis reçu par plusieurs composants ouvre des suites parallèles, et n'allonge chacune que d'un terme. Les continuations par faits provoqués comptent (A5.c, G8). Les expirations d'une minuterie répétitive armée une seule fois sont sœurs, rattachées à cet armement ; un réarmement effectué en réaction à une expiration ou à une réponse continue cette réaction. Un polling par réarmements successifs peut donc atteindre la borne ; aucune de ces étapes ne permet de réinitialiser l'origine (A5.b). *Pourquoi :* une suite de déclenchements entre composants peut s'allonger sans qu'aucun d'eux en voie l'ensemble ; la borne la signale, sans prétendre détecter toutes les boucles. *Alternative écartée :* aucune borne, ou une détection des cycles, qui signalerait à tort des répétitions légitimes et laisserait passer une chaîne longue sans cycle. *Protège :* O2, A5.b. La valeur de la borne est fixée par le Manifest (16.9). Précisions opérationnelles : C.8.

- **D10 — Admission par la cible.** Un fait de l'hôte qui survient dans une part est admis par le propriétaire de cette part. Un fait d'une source de niveau document déclarée, comme un raccourci global, est admis par l'adaptateur du document quelle que soit sa cible ; aucune View ne l'admet. *Pourquoi :* une View connaît sa part, mais un raccourci global n'appartient à aucune part ; la déclaration rend le partage connu dès le démarrage. *Alternative écartée :* l'admission par la cible seule, qui obligerait chaque View contenant un champ à relayer le raccourci ; l'admission par le premier composant qui réagit, qui dépendrait de l'exécution. *Protège :* A5.d, O2, O3.
- **D11 — Composition réservée.** Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. *Pourquoi :* séparer la décision de ce qui est affiché de son rendu (règle de méthode, §16). *Alternative écartée :* une View parente d'autres Views, qui décide elle-même de ce qu'elle monte. *Protège :* §16, O3.
- **D12 — Décideur pur.** Un Composer ne modifie son contenu que pour attribuer ou restituer les parts de ses Views, créer ou retirer les éléments correspondants ; il ne réalise aucune autre modification de présentation. Il n’est propriétaire d’aucun état autre que le contenu de son slot et l’existence de ses Views. Il n’admet aucune notification générale de l’hôte, mais admet les résultats instrumentés de ses propres effets de composition selon C.3 ; il n’adresse aucune Command. *Pourquoi :* sa composition se recalcule à partir des messages reçus, réponses à ses Queries et Views présentes ; elle reste une projection du domaine. *Alternative écartée :* un Composer qui réalise aussi le rendu ou conserve un état local indépendant de sa composition. *Protège :* §16, A4.d, T7, O3.
- **D13 — Behavior aveugle.** Le code d'un Behavior ne désigne ni la View qui le déclare ni les clés de celle-ci. Les noms des clés de la View et de chacun de ses Behaviors sont disjoints, y compris entre Behaviors ; des clés de noms différents peuvent désigner le même élément. *Pourquoi :* un même Behavior doit pouvoir se greffer sur des Views sans rapport, sans collision de noms ni interdiction de réagir au même élément. *Alternative écartée :* des noms de clés partagés ; un Behavior qui lit la View qui le déclare ; un Behavior composant, enfant de la View avec sa propre part, que T7, A5.d et A3.d excluent dès qu'il réagit à un fait sur un élément que la View utilise aussi. *Protège :* O3, O2.
- **D14 — Enfants de la racine déclarés.** Les enfants de la racine sont créés au démarrage, d'après le Manifest, et seulement ainsi. Le Manifest peut être composé de déclarations venues de plusieurs modules, chargés indépendamment, pourvu qu'elles soient réunies avant le démarrage. Le démarrage établit tous leurs Channels avant les consultations initiales ; les délivrances différées n'ont lieu qu'après sa réussite (§2.5). *Pourquoi :* les Channels et les contrats déclarés existent avant les premières consultations ; les cibles non déclarées peuvent être refusées avant l'ouverture du transport différé, sans prétendre connaître toutes les instances futures de l'interface. *Alternative écartée :* un enregistrement dynamique, ou des Features créées à la demande après le démarrage ; A4.e le permettrait, mais aucune vérification ne précéderait le premier message. Le chargement différé du code d'une Feature déclarée reste possible s'il respecte le protocole de démarrage. *Protège :* O2, O3. Précisions opérationnelles : C.8.

- **D15 — Navigation fournie.** Bonsai fournit une Feature de navigation, de namespace réservé `router`, activée par le Manifest (16.9). Son contrat est celui que projette l'adaptateur historique : la Command `router:navigate { location, mode }`, l'Event `router:routeChanged { route, mode }` et la Query `router:currentRoute`, où le mode est l'ajout d'une entrée, le remplacement de l'entrée courante ou le suivi d'un retour ou d'une avance (B.5). Une application peut ne pas l'activer et déclarer à la place la projection de sa propre Feature de navigation. La Feature de navigation n'est propriétaire que de l'état de navigation : l'adresse relève de l'adaptateur historique (18.2, D7), et un retour ou une avance se demande à celui-ci par une View (A4.b). *Pourquoi :* toute application à plusieurs pages en a besoin, et le contrat entre la Feature et l'adaptateur historique doit être le même partout. *Alternative écartée :* une Feature de navigation écrite par chaque application, sans contrat commun avec l'adaptateur ; une Feature de navigation qui modifierait elle-même l'adresse, ce que 11.1 et D7 excluent. *Protège :* O3, B.5.
- **D16 — Contrats déclarés.** Le code d'un composant déclare les Channels qu'il écoute et ceux auxquels il adresse des messages, les messages de son propre Channel et leur mode, et les faits de l'hôte qu'il admet ; ce contrat est connu avant le démarrage, même pour un composant créé après celui-ci. Ses traitements sont dérivés de ce contrat : un traitement par message déclaré, y compris le message local d'admission d'un fait déclaré, et aucun autre. *Pourquoi :* la structure des communications et les modes Command/Query peuvent être contrôlés avant délivrance ; cela ne prouve ni A3 dans son ensemble, notamment A3.h, ni les propriétés de toutes les instances futures. A4.b et D10 sont contrôlés dans la limite des déclarations ; les vérifications liées aux instances et aux traitements en cours restent à l'exécution (§19). *Alternative écartée :* des abonnements et des traitements enregistrés à l'exécution, invisibles avant le démarrage. *Protège :* O2, O3, A3.j. Précisions opérationnelles : C.8.

- **D17 — Chorégraphie du domaine.** Une Feature n'adresse aucune Command à une autre Feature, et un adaptateur de l'hôte du domaine n'adresse aucune Command. Les Features se coordonnent par les Events qu'elles émettent sur leurs propres ressources ; elles peuvent s'adresser des Queries, et adresser des Commands aux adaptateurs de l'hôte du domaine. *Pourquoi :* aucune Feature ni aucun adaptateur du domaine ne devient l'orchestrateur des autres ; un adaptateur du domaine annonce ce qu'il observe par ses Events (A3.h), et les Features qui en ont besoin y réagissent. Chacune ne décide que de sa propre ressource, en réaction à ce qu'elle apprend, et le contexte causal rend le déroulement d'ensemble reconstituable (A5). *Alternative écartée :* des Commands entre Features (orchestration), qui laissent émerger une Feature coordinatrice et concentrent la logique de plusieurs processus ; un adaptateur du domaine qui commande les Features, par exemple `cart:sync` au retour en ligne, y compris sur une notification d’antécédent inconnu que D18 refuse à l’interface. *Protège :* règle de méthode du §16, O3, A5.
- **D18 — L'interface relaie, elle n'enchaîne pas.** Un composant de l’interface utilisateur n’adresse de Command que dans une réaction à un fait admis dont l’indépendance est établie, ou dans une continuation corrélée d’une réaction déjà autorisée à commander. La permission suit le déclencheur, non la dernière enveloppe : Event, relais local d’Event et effet extérieur corrélé à un Event ne l’accordent pas. Des Queries peuvent être incluses ; leur retour conserve cette permission chez l’auteur sans l’accorder au traitement de Query, toujours en lecture seule. Une réponse n’est ni un message ni un déclencheur autonome. Une origine d’observation à antécédent inconnu n’accorde aucune Command à l’interface : seuls état local et projection restent possibles dans les autres limites du modèle. *Pourquoi :* préserver le domaine autonome sans transformer une causalité inconnue en preuve d’intention utilisateur. *Alternative écartée :* toute notification hôte ouvrant librement une nouvelle chaîne de Commands, ou l’interdiction excessive d’une Query préalable à une Command déjà autorisée. *Protège :* D17, A4.a, A5.b, C.4.
- **D19 — Regroupements à déclencheur unique en V1.** Une politique déclarée peut sélectionner une notification, notamment la dernière, et abandonner les autres. Le résultat continue le déclenchement de la notification retenue, sous le contrôle de l'infrastructure de communication ; il n'annonce pas une fusion de leurs contextes. Les agrégations exigeant plusieurs parents causaux sont reportées au-delà de la V1. Lire un état issu d'autres traitements ne constitue pas une telle agrégation de déclencheurs (10.5). *Pourquoi :* conserver une causalité de déclenchement à parent unique, dont la profondeur est calculable sans inventer une origine ni prétendre tracer toute provenance des données. *Alternative écartée :* une agrégation multi-parent en V1, ou un contexte choisi arbitrairement pour la masquer. *Protège :* A5.b, G8, D9, O2. Précisions opérationnelles : C.8.
- **D20 — Action par défaut déclarée.** L’action que l’hôte attache par défaut à un fait, comme suivre un lien ou soumettre un formulaire, n’est pas un effet du modèle : aucun composant ne la prépare, et l’hôte l’exécute après la propagation de l’occurrence, hors de toute unité de validation. Le contrat de l’admetteur (D16) peut déclarer, pour un fait qu’il admet, que l’action par défaut de ses occurrences est annulée ; Bonsai l’annule à la capture (B.4), avant tout traitement et quelle qu’en soit l’issue. Annuler ne modifie aucune ressource et ne demande donc aucune autorité sur celle que l’action aurait modifiée. La déclaration porte sur le fait déclaré, pour une View un événement d’une de ses clés, et ne dépend d’aucune autre donnée de l’occurrence (18.36). Une action par défaut non annulée reste un changement de l’hôte hors du modèle (11.6) : une ressource admise par un autre composant, comme l’adresse par l’adaptateur historique (D7), n’en est connue que par le protocole de sa source. *Pourquoi :* sans annulation, un clic sur un lien relayé à la Feature de navigation (D15) serait suivi du chargement de l’adresse du lien par l’hôte, qui met fin au document et au modèle. Déclarée, l’annulation est connue avant le démarrage ; elle ne dépend ni de l’issue du traitement (G7) ni du moment où il s’exécute, et le traitement ne reçoit toujours qu’une donnée. *Alternative écartée :* une annulation décidée par le traitement, qui exigerait de lui transmettre l’occurrence de l’hôte (A3.c) et laisserait l’action s’exécuter après un échec de l’unité ; une annulation implicite de toute action par défaut modifiant une ressource d’autrui, dont la liste n’est pas close et que le code ne montrerait pas. *Protège :* A3.c, D7, D15, O2, O3.

## 16. Rôles dérivés

**Règle de méthode.** Un rôle dérivé porte une seule fonction architecturale ; deux rôles ne portent pas la même.

### 16.1 Application

Racine du domaine, propriétaire de l'espace des identités et parent des Features, de la Foundation (D1) et des adaptateurs de l'hôte (D7). Ses paramètres de création sont le Manifest (16.9), d'après lequel elle crée ses enfants au démarrage (D14).

Chaque Feature reçoit son identité de la racine : une identité est une part d'un espace des identités (8.2), un composant ne choisit pas la sienne (A2.a), et seul le parent d'un composant lui attribue des parts (A2.d). Il en va de même des adaptateurs de l'hôte (D7), enfants de la racine.

### 16.2 Entity

État du domaine dont le propriétaire est une Feature, avec les opérations exclusives qui le modifient.

L'Entity n'est pas un composant : elle n'a ni existence propre, ni identité, ni Channel. Ce qu'elle exécute est exécuté par sa Feature (règle d'imputation, §2.5). Les invariants métier qui concernent son état interne sont définis par le code applicatif et satisfaits à la fin des unités de validation (§2.5, A4.a). Une observation ou une intention enregistrée ne garantit pas la matérialisation d'un effet extérieur.

### 16.3 Feature

Composant du domaine, enfant de la racine, propriétaire d'une identité attribuée par celle-ci, du Channel distingué par cette identité et d'une Entity, qui traite les messages adressés à ce Channel et y émet.

Bonsai en fournit une, la Feature de navigation, de namespace réservé `router` (D15). Une Feature n'adresse aucune Command à une autre Feature (D17).

Conséquences : une Feature n'émet que sur son propre Channel (A3.e, T2) ; elle survit aux changements de l'interface utilisateur et de l'hôte tant que la racine existe, mais prend fin avec celle-ci (T6) ; un fait asynchrone qu'elle admet lui revient par un message local (9.3, 9.5, A5.c).

### 16.4 Foundation

Composant de l'interface utilisateur, enfant de la racine (D1), qui admet un élément de l'hôte, par défaut le corps du document (D3), et en attribue des parts à ses enfants, qui sont des Composers (D11). Elle n'admet rien d'autre de l'hôte, hormis les résultats instrumentés de ses propres effets (C.3) : l'en-tête et les faits de niveau document relèvent de l'adaptateur du document (D7).

### 16.5 View

Composant de l'interface utilisateur, enfant d'un Composer (D11), propriétaire d'une part du DOM attribuée par celui-ci, sans identité (D6), qui admet les faits de l'hôte survenant dans cette part, hors ceux d'une source de niveau document déclarée (D10), et adresse des messages aux Channels du domaine et à ceux des adaptateurs de l'interface utilisateur.

Un **slot** est un élément de la part d'une View, ou de l'élément admis par la Foundation, dont le contenu est attribué à un Composer (16.6).

Conséquences :

- elle n'est pas adressable et n'émet aucun message (D6, T4) ; elle reçoit ce que les Features émettent et les réponses à ses Queries (9.11) ;
- son parent lui transmet, à sa création, une désignation de sa part, jamais un élément de l'hôte ni une identité dont elle devrait être propriétaire (8.5, A3.d, 6.2) ;
- elle établit sa référence structurelle par résolution contrôlée de cette désignation : la propriété est vérifiée, la désignation n'accorde aucun accès par elle-même et n'est valable que pour cette attribution ; une réattribution du même emplacement ne la réactive pas (8.5, 9.10) ;
- sa part ne recouvre aucune autre part existante (T7) ; le contenu des slots qu'elle attribue à ses Composers lui est soustrait (6.5), et elle conserve l'élément de chaque slot ;
- elle ne détruit jamais son élément racine (A2.d) ; elle peut en modifier les attributs et dispose de tout ce qu'il contient, hors le contenu de ses slots ;
- elle peut déclarer, pour un fait déclaré de sa part, l’annulation de l’action par défaut que l’hôte y attache ; ses traitements n’en décident pas (D20) ;
- retirer l'élément d'un slot mettrait fin au contenu attribué sans que son propriétaire prenne fin (A2.d) : la View détruit d'abord le Composer concerné, ce qui lui rend ce contenu (T3) ;
- elle peut être propriétaire d'un état local, initialisé selon §2.5 et modifié pendant tout traitement autorisé, y compris celui d'un Event reçu (A5.a). Cet état est confiné : aucun autre composant ne le modifie (A1.b) ni ne le lit (A3.c), aucun ne peut le lui demander (T4), elle ne le diffuse pas (A3.e), et il est détruit avec elle (T3). Elle peut en transmettre une valeur, figée, dans une Command autorisée par D18 ;
- l'état métier qu'elle présente comme validé provient du domaine, éventuellement par dérivation de présentation sans autorité métier ; un brouillon ou une intention reste distinct de l'état confirmé (A4.d). Préparer sa projection puis l'appliquer après validation interne ne rend pas les écritures DOM atomiques ; un échec hôte est admis par un nouveau message (C.3, G7) ;
- elle peut consulter le domaine puis adresser une Command dans une réaction autorisée par D18 ; elle n’en adresse jamais dans une réaction déclenchée par un Event, même par relais local, après une Query ou par résultat d’effet corrélé ; une observation d’antécédent inconnu ne l’autorise pas davantage.

### 16.6 Composer

Composant de l'interface utilisateur, enfant de la Foundation ou d'une View, propriétaire du contenu d'un slot que son parent lui attribue, et parent des Views qui en occupent des parts (D11).

Conséquences :

- il n'est propriétaire d'aucune identité (D6) : il n'est pas adressable et n'émet aucun message (T4) ; il reçoit des messages émis et adresse des Queries, dont il reçoit les réponses (T2, 9.11) ;
- pendant son initialisation autorisée (§2.5), puis à chaque message qu'il traite, il décide quelles Views occupent des parts de son contenu ; il crée ou détruit leur existence, dont il est propriétaire (7.2, A1.b). L'initialisation d'une View entre dans son unité de validation, sans lui déléguer l'autorité sur les ressources de celle-ci ;
- les parts qu'il attribue ne se recouvrent pas (T7) ; détruire une View lui rend sa part (A2.d, T3) ;
- à sa création, il reçoit de son parent une désignation du contenu attribué ; une View qu'il crée reçoit une désignation de sa part, jamais un élément de l'hôte. Ces désignations n'exigent aucune identité ; leur résolution contrôlée vérifie la propriété et leur validité s'arrête avec l'attribution concernée (8.5, 9.10, A3.d, 6.2) ;
- il ne lit de son contenu que la portion qui n'est pas attribuée à ses Views (6.5, A3.c) ;
- son slot ne disparaît pas tant qu'il existe : pour en retirer l'élément, son parent le détruit d'abord (16.5, A2.d) ;
- il est détruit avec son parent, et ses Views avec lui (T3) ;
- ses seules modifications de contenu sont l’attribution et la restitution des parts, la création et le retrait des éléments correspondants ; il n’est propriétaire d’aucun état autre que ce contenu et l’existence de ses Views. Il admet seulement les résultats instrumentés de ses propres effets de composition, aucune notification générale de l’hôte, et n’adresse aucune Command (D12, C.3).

### 16.7 Behavior

Partie réutilisable du code d'une View. Un Behavior n'est pas un composant : ce qu'il exécute est exécuté par la View qui le déclare (règle d'imputation, §2.5). Une **clé**, dans les déclarations d'une View ou d'un Behavior, est un nom local désignant un élément de la part de la View ; ce terme propre aux rôles n'ajoute pas une notion fondamentale au §17. Les clés qu'il déclare désignent des éléments de cette part, les messages qu'il produit sont adressés par cette View, et son état local fait partie de l'état local de celle-ci.

Conséquences :

- une occurrence survenant dans la part est admise une fois, par la View, même lorsque la View et ses Behaviors y réagissent tous (A5.d, D10) ; leurs réactions s’exécutent pendant le même traitement local et en continuent le contexte qualifié selon C.4. Une propagation entre écouteurs n’est pas une nouvelle occurrence, et un antécédent inconnu n’accorde aucune Command (D18) ;
- les réactions de la View et de ses Behaviors à un même fait s'exécutent dans un ordre fixe, celui de leur déclaration ; leurs messages différés sont délivrés dans l'ordre de production (D8), leurs Queries selon le contrat synchrone de G5 ;
- il n'a ni existence propre, ni identité, ni part ; il prend fin avec sa View (T3) ;
- il ne produit rien ni hors de la part de sa View, ni dans le contenu de ses slots (16.5) : un contenu affiché au-dessus du reste de la page relève d'un Composer ; seuls les faits de niveau document déclarés relèvent de l'adaptateur correspondant (D7, D10). Le cas général du clic ou du focus hors d'une View reste ouvert (18.30) ;
- son code ne désigne ni la View qui le déclare ni les clés de celle-ci. Les noms de clés de la View et des différents Behaviors sont disjoints, mais peuvent désigner les mêmes éléments sans multiplier les admissions (D13).

**Contre-exemples :** un Behavior insère une infobulle dans le corps du document, hors de la part de sa View ; un Behavior écoute le défilement de la fenêtre au lieu de recevoir les Events de l'adaptateur qui l'admet.

### 16.8 Adaptateur de l'hôte

Composant enfant de la racine (D7), propriétaire d'une identité attribuée par celle-ci (16.1) et du Channel qu'elle distingue, seul à admettre une ou plusieurs sources de l'hôte situées hors des éléments admis par les Foundations (D3). Les catégories d'adaptateurs, leur partie et leurs règles communes forment le catalogue de l'annexe B.

Conséquences :

- il relève d'une seule partie, celle des ressources qu'il admet (11.1, 18.14) ;
- il est seul à admettre ses sources (D7, A5.d), et propriétaire initial des ressources qu'il admet (A2.a) ;
- il inscrit dans un état d'observation dont il est propriétaire les faits qu'il entend annoncer, avant d'émettre sur son Channel une information sur cet état (A3.e, A3.h). Un fait brut n'est pas, à lui seul, une ressource ; les intentions d'effets ne sont pas annoncées comme des succès. Les autres composants lui adressent des Commands et des Queries, sous la réserve de A4.b ;
- un composant du domaine n'adresse rien à un adaptateur de l'interface utilisateur et ne reçoit rien de lui (A4.b) : un adaptateur de l'interface reçoit les Events du domaine et en tient ses ressources pour projection (A4.d), comme le titre ou l'adresse ;
- un adaptateur de l’interface peut, pendant le traitement local d’un fait, adresser une Command déclarée sous les conditions d’A4.b et D18 ; il ne relaie donc au domaine qu’un déclencheur autorisé, jamais une origine d’observation inconnue. Un adaptateur du domaine n’adresse aucune Command : il annonce ce qu’il observe par ses Events (D17). Le préambule d’admission ne mute pas l’état applicatif (11.6) ;
- une ressource qu'il tient en projection n'est modifiée que si la projection n'est pas déjà satisfaite selon l'équivalence de B.5 ; les effets sont préparés puis appliqués après validation interne, sans transaction extérieure ni rollback des effets déjà appliqués (C.3, G7) ;
- il utilise les interfaces Bonsai qui corrèlent les résultats instrumentés et qualifient les observations non corrélables sans inventer de parent ; il ne fabrique ni ne remplace lui-même un contexte (A5.c, G8, C.4) ;
- il ne transmet aucune référence vers une ressource de l'hôte (A3.c, A3.d).

### 16.9 Manifest

Paramètres de création de la racine (6.2) : la description de ses enfants et de ce qui leur est attribué au démarrage. Il peut réunir des déclarations issues de modules distincts, chargés indépendamment, pourvu qu'elles le soient avant la création de la racine (D14).

Il contient : les namespaces des Features et des adaptateurs, représentations des identités que la racine leur attribue (8.4, 16.1) ; la classe de chacun et celle de la Foundation ; les adaptateurs activés et leurs périmètres, donnés par des valeurs littérales (annexe B) ; l'élément de la Foundation (D3) ; les sources de niveau document déclarées (D10) ; la borne causale (D9) ; l'activation de la Feature de navigation (D15).

Les contrats assemblés avec le Manifest rendent aussi disponibles les dépendances initiales et protocoles de source de D16. La validation préalable refuse un cycle requis de consultations initiales et toute source sans politique de capture/corrélation explicite ; elle ne prétend pas inférer l’indépendance d’une notification à partir de sa seule forme.

Conséquences :

- il ne contient aucune référence (A3.d) : il désigne des classes, et le code applicatif n'est pas une référence (9.9) ;
- la racine le lit à sa création ; il ne change pas pendant la vie de la racine (D14) ;
- les contrats et les enfants déclarés de la racine sont connus avant l'ouverture du transport différé, non toutes les futures instances de Views et de Composers. L'unicité et la forme des namespaces, les cibles déclarées et la disjonction des périmètres déclarés sont vérifiables avant le démarrage, à la compilation lorsque ces données sont littérales et réunies, au démarrage lorsqu'elles viennent de modules (O2, D16). Les conflits physiques d'écriture entre racines d'un même hôte demandent une vérification commune au démarrage, notamment de la seconde racine (B.2) ; cette vérification ne garantit pas l'absence d'auteurs extérieurs non coordonnés ;
- chaque racine a son Manifest (G6).

**Contre-exemples :** un Manifest transmet l'élément du corps du document au lieu d'un sélecteur (A3.d) ; une Feature `chat` est créée au premier clic sur « Aide », et `chat:open` ne vise aucun Channel avant ce clic (D14).

## 17. Chaîne de non-circularité

Une définition n'emploie aucun terme situé après elle. L'ordre de lecture du document suit exactement cette chaîne de **55 termes**. Le graphe de dépendances porte sur les seules phrases définitoires et leurs dépendances définitoires (§2.2), non sur les commentaires informatifs ni sur les prescriptions normatives explicitement séparées. Leurs renvois vers l'aval ne sont pas des dépendances de définition.

1. modèle *(primitif)*
2. hôte *(primitif)*
3. infrastructure de communication *(primitif)*
4. système extérieur *(primitif)*
5. composant *(primitif)*
6. ressource *(primitif)*
7. message *(primitif)*
8. propriété *(primitif)*
9. périmètre
10. état
11. opération exclusive
12. propriétaire
13. création
14. paramètres de création
15. part
16. ressource distribuable
17. attribution
18. portion
19. existence
20. parent
21. enfant
22. racine
23. composition
24. espace des identités
25. identité
26. représentation d'identité
27. namespace
28. désignation
29. Channel
30. abonnement
31. traitement
32. transport
33. message local
34. adresser
35. émettre
36. recevoir
37. référence
38. référence structurelle
39. réponse
40. message différé
41. unité de validation
42. cause
43. origine
44. continuation
45. chaîne causale
46. contexte causal
47. interaction fonctionnelle
48. interface utilisateur
49. domaine
50. invariant métier
51. cohérence métier
52. information métier
53. admission
54. frontière de confiance
55. effet

## 18. Questions ouvertes

Les numéros des questions sont stables : une question tranchée garde son numéro et passe en 18.B, avec la réponse, l'endroit de la théorie qui la porte et la version qui l'a tranchée. Une réponse antérieure incompatible avec un arbitrage validé est mise à jour en conservant son jalon historique ; une question non tranchée demeure ou revient en 18.A. Aucune question n'est à la fois ouverte et tranchée.

Les précisions V0.9.3 ci-dessous regroupent les 28 points de revue arbitrés le 30 octobre 2026 ; elles ne valent ni clôture globale des audits historiques ni constat d'alignement de l'implémentation. En particulier, le cas V4 de l'audit V0.9.2 n'appartient pas à ces arbitrages.

**Lecture V0.9.4.** Les réponses 18.1, 18.5, 18.9, 18.15, 18.17–18.19, 18.22 et 18.26 sont précisées par les protocoles de l’annexe C et par 18.31 ci-dessous ; la date de leur premier arbitrage est conservée. Leur mention de causalité ou de contexte ne promet pas une connaissance physique au-delà du périmètre observable.

### 18.A Questions ouvertes

| # | Question | État et limites actuelles |
| --- | --- | --- |
| 18.30 | Clic ou déplacement du focus hors d'une View (audit V0.9.2, V4) | Protocole général toujours ouvert ; politique de conformité V1 fixée en V0.9.4 : un besoin exigeant cette capture sans admetteur déjà autorisé est non pris en charge. Aucun écouteur global de View/Behavior ni admission par Composer ne devient conforme. D10 et les sources document explicitement déclarées restent bornés à leurs contrats ; le focus de fenêtre n’autorise pas celui d’un élément hors View. Fermer un menu par clic extérieur dans une portion non attribuée exige un futur protocole, pas un contournement implicite. |
| 18.36 | Annulation conditionnelle de l’action par défaut | D20 annule l’action par défaut de toutes les occurrences d’un fait déclaré. Distinguer une occurrence par ses autres données, comme un clic avec modificateur qui ouvre le lien dans un autre onglet sans toucher au document, exigerait une condition déclarée sur ces données : non pris en charge en V1. Un fait dont toutes les occurrences ne doivent pas être annulées ne déclare pas l’annulation. |

L'[audit historique V0.9.2](rapports/audit-coherence-V0.9.2.md) conserve ses constats et propositions ; une proposition qui n'appartient pas aux arbitrages validés n'acquiert aucune autorité par sa seule présence dans ce rapport. L'alignement du guide, des gardes, des fiches, de la traçabilité et du code reste un travail distinct.

### 18.B Questions tranchées

| # | Question | Réponse | Portée par | Tranchée en |
| --- | --- | --- | --- | --- |
| 18.1 | Périmètre causal | Le périmètre garanti contient les déclenchements établis ; résultat corrélé, indépendance établie et observation d’antécédent inconnu sont distingués. D9 borne les segments connus, pas les boucles traversant une coupure d’observation, ni travail total ou terminaison. | C.4, 10.2, 10.5, A5.c, G8, D9 | V0.6 ; révisée en V0.9.4 |
| 18.2 | Navigation et adresse | L'adresse est perçue et modifiée par l'utilisateur : elle relève de l'interface utilisateur. Que l'état de navigation soit une information métier relève de chaque application ; s'il l'est, il vit dans une Feature et l'adresse en est une projection. | 11.1, A4.d | V0.6 |
| 18.3 | Stockage et survie à la racine | L'admission produit une ressource du modèle distincte de la ressource de stockage de l’hôte ; elle prend fin avec son propriétaire, sans effacer nécessairement cette ressource de l’hôte. Une nouvelle racine produit une nouvelle ressource admise dont les valeurs initiales relèvent de sa cause de démarrage, non de la session précédente. | A2.a, T3 (remarque), §2.5, 11.6, A5.c, G8 | V0.6 ; précisée en V0.9.3 |
| 18.4 | Frontière de confiance | Une seule notion : la frontière est formée de tous les points d'admission, et ce qui la franchit est validé par son traitement (A4.a). Les distinctions entre hôte et système extérieur tiennent à qui admet, et sont portées par A4.c, D3, D7 et 16.5. | 11.7 (remarque) | V0.8 |
| 18.5 | Racines multiples | Un modèle fini et enraciné par racine, sans message inter-racines (G6). Une modification d’une autre racine est indépendante si le protocole l’établit, sinon d’antécédent inconnu. Foundations disjointes et écritures globales exclusives selon B.2 ; aucune garantie contre les auteurs non coordonnés. | G6, §12, A0.e, C.4, D3, B.2, B.3 | V0.8 ; révisée en V0.9.4 |
| 18.6 | Délégation | La délégation est exclue : seul le propriétaire exécute une opération exclusive. Elle serait réexaminée si la dérivation d'un rôle rencontrait un cas que l'attribution, les messages et les paramètres de création ne couvrent pas. | A1.b | V0.6 |
| 18.7 | Garantie au plus tôt et gardes | Une obligation contrôlable reçoit une garde au niveau le plus précoce possible ; une obligation sémantique non vérifiable reçoit une justification explicite et une revue, notamment A3.h et une partie d'A4.d. D16 permet le contrôle de la structure et des modes déclarés, pas de tout A3 ni de toutes les instances futures. Les tests ne sont pas des preuves générales. | §19, D16, O2 | V0.9.1 ; précisée en V0.9.3 |
| 18.8 | Déterminisme | Le déterminisme n'est pas un axiome : lire librement l'heure ou une valeur aléatoire reste conforme (18.15). L'infrastructure de communication n'ajoute aucun aléa : les messages différés suivent l'ordre de production (D8), les Queries le contrat synchrone de G5. La rejouabilité reste un objectif ; restituer les valeurs lues librement relève de l'implémentation. | D8, G5, O1, 18.15 | V0.8 ; précisée en V0.9.3 |
| 18.9 | Cohésion et borne causale | D9 borne seulement la profondeur : un timer répétitif armé une fois produit des expirations sœurs ; un réarmement continue la réaction et un polling peut atteindre la borne. Ni le travail total ni la terminaison ne sont garantis ; aucune origine n'est réinitialisée pour contourner la borne. « Une responsabilité, un rôle » (P10) est une règle de méthode pour les rôles. | D9, A5.b, G8, §16 | V0.8 ; précisée en V0.9.3 |
| 18.10 | Objectifs | Les objectifs forment une catégorie distincte de la décision et de la conséquence : une qualité que les axiomes établissent est une conséquence. La liste est courte : rejouabilité (O1), détection précoce (O2) et ergonomie de développement (O3). | 2.6, 15.1 | V0.8 |
| 18.11 | Rattachement au registre | Chaque principe `P<n>` et chaque invariant `I<n>` reçoit un statut et l'élément de la théorie qui le fonde. Le report dans `docs/invariants/` relève de l'alignement du dépôt. | `docs/invariants/` (registre YAML) ; `docs/rapports/migration-invariants-runtime-V0.9.4-2026-10-30.md` | V0.9.2 ; précisée en V0.9.5 |
| 18.12 | Admission d'un fait dont la cible est dans une part | Un fait n'est admis qu'une fois (A5.d), par le propriétaire de la part où il survient, sauf source de niveau document déclarée, admise par l'adaptateur du document (D10). L'admission soumet un message local sans mutation applicative préalable. Cette réponse ne tranche pas le cas hors View de 18.30. | A5.d, D10, 11.6 | V0.8 ; précisée en V0.9.3 |
| 18.13 | Adresser son propre Channel | Une Command vers soi est permise et différée jusqu'à validation. Une Query vers soi est refusée avec erreur, comme toute Query vers un composant actif, jamais mise en file pour attendre une réponse. Le propriétaire lit directement ses propres ressources ; le message local reste la voie d'admission d'un fait. | G5, G7, A1.b, 9.5, T2 | V0.7 ; corrigée en V0.9.3 |
| 18.14 | Adaptateurs mixtes | Un adaptateur relève d'une seule partie (11.1). Le document, l'historique, le défilement et le presse-papiers sont des supports de présentation ou d'intention ; visibilité et focus de la fenêtre, Viewport et environnement sont des conditions d'environnement du domaine. Les cookies relèvent du stockage. Pour les cas limites, B.3 fixe explicitement la convention normative ; A en explique les motifs sans trancher le focus d'un élément hors View (18.30). | D7, 11.1, B.3 | V0.9 ; précisée en V0.9.3 |
| 18.15 | Lecture d'une information de l'hôte | Accès physique borné à la ressource autorisante ; Query limitée à l’observation intégrée, sans rééchantillonnage persistant. Rafraîchissement par action, capture post-validation, admission puis traitement local ; valeurs initiales sous la cause de démarrage. Heure et aléatoire restent libres selon 3.2. | C.5, 3.2, 9.9, 9.10, 11.6, A3.c | V0.7 ; précisée en V0.9.4 |
| 18.16 | Propriété, objet et modes des interactions | A2.e clôt les origines de propriété. A3.i impose une ou plusieurs ressources pour objet : pas de service de calcul pur autonome sans ressource. A3.j distingue avant délivrance action sans réponse et connaissance avec réponse ; une Command peut être refusée ou sans effet. L1 et T2 exposent ces prémisses explicites. | A2.e, A3.i, A3.j, L1, T2 | V0.9.3 — 30 octobre 2026 |
| 18.17 | Validation, démarrage et création | Les contraintes d'autorité restent permanentes ; les invariants d'état sont vérifiés à la fin des unités de validation. Le démarrage exceptionnel a une cause ; les Channels précèdent les consultations initiales et les délivrances différées attendent sa réussite. Les admissions survenues entre-temps attendent sa clôture ; un échec abandonne le modèle en construction et ses messages différés. L'initialisation d'un composant créé pendant un traitement entre dans l'unité du créateur, sans déplacement de l'autorité de chaque propriétaire. | §2.5, A5.a, G5, G7, D14 | V0.9.3 — 30 octobre 2026 |
| 18.18 | Lecture seule et réentrance des Queries | La lecture seule est transitive : aucune création de ressource du modèle, aucun effet extérieur, aucune Command, aucun Event ni message local ; seules les Queries imbriquées conformes sont permises. G5 refuse toute cible active, y compris soi. | A3.g, G5, T2 | V0.9.3 — 30 octobre 2026 |
| 18.19 | Échec et effets extérieurs | L'erreur de Query se propage jusqu'au traitement extérieur ou au démarrage, sans reprise locale ni réponse de substitution. Les Queries déjà délivrées restent dans la trace. Le rollback concerne les ressources internes et les messages différés non délivrés ; les effets hôte sont différés après validation mais non atomiques, avec admission ultérieure de leurs succès ou échecs. | §2.5, C.3, G7, 9.11 | V0.9.3 — 30 octobre 2026 |
| 18.20 | Désignation d'une part | Une désignation est une information à résoudre sous contrôle de propriété, non un accès ni une autorité. Views et Composers reçoivent des désignations de parts, sans devenir propriétaires d'identités ; une désignation expirée n'est pas réactivée par réattribution du même emplacement. | 8.5, 9.9, 9.10, 16.5, 16.6 | V0.9.3 — 30 octobre 2026 |
| 18.21 | Faits annoncés par les adaptateurs | A3.h est conservé : avant Event, le fait est inscrit dans un état d'observation dont l'adaptateur est propriétaire ; l'admission seule ne transforme pas un fait en ressource. | A3.h, 16.8, B.4 | V0.9.3 — 30 octobre 2026 |
| 18.22 | Fidélité et responsabilité causales | G8 qualifie les contextes : liens corrélés conservés, indépendance établie ou antécédent inconnu explicite. Aucun parent inventé, aucun lien connu effacé. Un message hors origine a un seul parent ; ce contrat ne retrace ni toute provenance des données ni toutes les causes physiques. | C.4, 10.5, A5.b, A5.c, G8 | V0.9.3 ; révisée en V0.9.4 |
| 18.23 | Regroupements et V1 | Sélectionner la dernière notification et abandonner les autres est permis ; son contexte de déclenchement est conservé. Les agrégations exigeant plusieurs parents causaux sont reportées au-delà de la V1 par une décision explicite, non introduites implicitement en annexe. | D19, B.4 | V0.9.3 — 30 octobre 2026 |
| 18.24 | Portée de T5 et de T6 | T5 concerne une transition requise sur des ressources internes préexistantes de propriétaires distincts, pas une simple relation maintenue par refus. T6 ne protège que les composants du domaine propriétaires d'un Channel, tant que leur racine existe, sans atomicité avec l'hôte. | T5, T6, A4.a, A4.e | V0.9.3 — 30 octobre 2026 |
| 18.25 | Projection et état métier | Les dérivations de présentation ne créent pas d'autorité métier ; les brouillons restent non confirmés. B.5 supprime les échos équivalents, sans preuve générale de convergence ; pour l'historique, l'équivalence dépend de la valeur et de l'opération demandée. | A4.a, A4.d, B.5 | V0.9.3 — 30 octobre 2026 |
| 18.26 | Déclencheur des Commands de l'interface | D18 exige un fait indépendant établi ou une continuation d’une réaction déjà autorisée ; Event, relais local, effet corrélé à Event et observation d’antécédent inconnu n’accordent aucune Command UI. Une Query préalable conserve la permission de son auteur. | D18, C.4, 9.11, G8, 18.32 | V0.9.3 ; précisée en V0.9.4 |
| 18.27 | Exclusivité physique entre racines | Défilement de fenêtre et presse-papiers sont uniques par hôte, comme les autres écritures globales du catalogue. Les préfixes, bases, caches et cookies doivent former des périmètres physiques disjoints entre racines d'un même hôte ; aucune exclusivité n'est garantie contre des auteurs non coordonnés. | B.2, B.3, 16.9 | V0.9.3 — 30 octobre 2026 |
| 18.28 | État local et clés des Behaviors | Une View peut modifier son état local pendant tout traitement autorisé, Event compris. Les noms de clés de la View et de ses Behaviors sont disjoints, y compris entre Behaviors ; les mêmes éléments peuvent être désignés. Une clé est une notion de rôle, non un terme fondamental supplémentaire. | A5.a, D13, 16.5, 16.7 | V0.9.3 — 30 octobre 2026 |
| 18.29 | Statut des définitions et des garanties | Le graphe du §17 porte uniquement sur les définitions, distinctes des commentaires et prescriptions normatives. Les garanties d'infrastructure sont des hypothèses contractuelles ; les conséquences en nomment les prémisses. Gardes, revues et tests ne prouvent pas à eux seuls la conformité générale, et leur prescription ne signifie pas qu'ils sont déjà réalisés. | §2.2, §2.6, §14, §17, §19 | V0.9.3 — 30 octobre 2026 |
| 18.31 | Complétude opérationnelle après revue V0.9.3 | Existence unique et propriété actuelle ; structure finie enracinée ; restitution bas en haut imputée au propriétaire ; partition exclusive du transport ; cible prête et inactive ; callbacks liés à l’occurrence de vie ; fermeture de la ressource visée, et des parts qui en descendent, après erreur synchrone d’engagement ; valeurs capturées sans alias mutable ; réservations liées aux abonnements déterminés. Le suivi P01–P20 documente les contrôles requis sans revendiquer leur réalisation. | §2.5, annexe C, A0.d, A1.a, A3.f, G2, G3, G5, D8, D12 | V0.9.4 — 30 octobre 2026 ; amendée le 2 novembre 2026 (fermeture par ressource visée, C.3) |
| 18.32 | Établissement de l’indépendance d’une intention | Protocole du monde fermé : une source déclare ses opérations productrices ; toutes instrumentées, une occurrence qu’aucune d’elles en cours n’a pu produire est indépendante, sinon d’antécédent inconnu. Un appel brut à une opération productrice n’est pas conforme. Saisies dans une part, raccourcis déclarés, plein écran, parcours de l’historique, connectivité et environnement en relèvent ; défilement, redimensionnement et focus généraux non. Aucune garantie contre les auteurs non coordonnés (B.2). | C.4, 10.2, G8, D18, B.2, B.5 | V0.9.4 — amendement du 30 octobre 2026 |
| 18.33 | Vocabulaire opérationnel et place du protocole | Les notions propres à Bonsai qu’emploient les axiomes sont définies : message différé (9.12), unité de validation (9.13), effet (11.8). « Ressource de l’hôte » et « démarrage » sont les seuls termes pour ce que les versions antérieures appelaient aussi « support » et « amorçage ». Le protocole d’exécution forme l’annexe C, normative ; le cœur n’en garde que les règles de lecture nécessaires aux axiomes. | §2.3, §2.5, §2.7, 9.12, 9.13, 11.8, §17, annexe C | V0.9.5 — 30 octobre 2026 |
| 18.34 | Commands des adaptateurs du domaine | Un adaptateur du domaine n’adresse aucune Command ; il inscrit ce qu’il observe dans son état d’observation et l’émet, et les Features y réagissent. Seul un adaptateur de l’interface peut relayer une Command, sous D18. | D17, D18, 16.8, B.4, A3.h | V0.9.5 — 30 octobre 2026 |
| 18.35 | Action par défaut d’un fait admis | L’action par défaut de l’hôte n’est pas un effet du modèle. Son annulation est déclarée dans le contrat de l’admetteur, par fait déclaré, et appliquée par Bonsai à la capture, avant tout traitement et quelle qu’en soit l’issue ; aucun traitement ne la décide. Non annulée, elle reste un changement de l’hôte hors du modèle. | D20, D16, B.4, 11.6 | V0.9.5 — 3 novembre 2026 |

## 19. Gardes

Une garde vérifie qu'une règle de la théorie est respectée par le code applicatif. Elle n'est pas une notion du modèle : elle relève de l'implémentation de Bonsai, et n'est jamais la source d'une règle.

**Règle de méthode.** Toute règle qui contraint le code applicatif, clause d'axiome ou décision, reçoit soit une garde au niveau le plus précoce que son énoncé permet, soit une justification explicite de sa non-vérifiabilité mécanique et une revue documentée. Une garde placée à un niveau plus tardif nomme ce qui empêche le niveau précédent. L'absence de garde ne supprime pas l'obligation normative.

| Niveau | La violation… |
| --- | --- |
| Construction | ne peut pas s'écrire : l'interface de programmation ne l'offre pas |
| Statique | s'écrit, mais l'analyse du code avant exécution la refuse |
| Démarrage | est refusée avant l'ouverture du transport applicatif différé, avec les contrôles requis avant les consultations initiales |
| Exécution | est détectée lorsqu'elle survient, et signalée avec son contexte causal |

Les contrats déclarés (D16) et le Manifest (16.9, D14) rendent connus les formes et modes des messages et les enfants déclarés de la racine avant l'ouverture du transport différé. Ils permettent des gardes de structure et de modes, sans prouver tout A3 ni connaître toutes les instances futures de Views et de Composers. La validité d'une désignation lors de sa résolution, l'absence de cible active d'une Query et les propriétés dépendant d'instances demandent aussi des contrôles à l'exécution. L'objectif servi est O2, dans ses limites explicites.

La [table de conformité](gardes.md) doit associer chaque obligation à sa garde et aux tests de validation prévus, ou à la justification de non-vérifiabilité et à la revue correspondante. A3.h et une partie d'A4.d imposent notamment une revue sémantique : on peut contrôler une inscription d'état ou une voie de projection, sans prouver mécaniquement que l'information émise porte bien sur cette ressource ni qu'une dérivation n'a créé aucune autorité métier. Les garanties (§13) et D8 engagent l'implémentation de Bonsai : elles appellent des tests de conformité, non des gardes du code applicatif.

Un test donne une vérification sur les cas exercés, pas une preuve générale. Ce paragraphe prescrit une couverture ; il n'affirme ni que les gardes existent déjà ni que les tests ont été exécutés ou réussis. L'état de réalisation, les résultats et les écarts doivent être consignés séparément de la norme V0.9.5.

## Annexe A — Inventaire des sources de l'hôte navigateur

*Annexe non normative.* Elle inventorie, pour un hôte navigateur, les sources de faits et de ressources situées hors des éléments admis par les Foundations (D3). Le catalogue des adaptateurs qui en découle forme l'annexe B, normative (D7, 16.8). Les règles qui découlent de la théorie ne sont pas énoncées ici : l'annexe renvoie aux clauses qui les portent.

La colonne « Partie » explique le classement à partir de 11.1 : les supports de présentation et d'expression d'une intention relèvent de l'interface utilisateur ; les conditions d'environnement ne deviennent pas des supports d'interaction parce qu'une action humaine peut les modifier. Pour les cas limites, B.3 fixe explicitement la convention normative, notamment le focus de la fenêtre dans le domaine, distinct du focus d'un champ. Le présent inventaire ne crée pas de règle de classement. Une ressource relevant de la même partie que son propriétaire, chaque adaptateur relève d'une seule partie (18.14). La colonne « Modifiable » indique si le modèle peut exécuter une opération exclusive après admission (T8), sans promettre une transaction avec l'hôte (C.3, G7).

### A.1 Le document hors corps — adaptateur du document (interface utilisateur)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Titre du document | — | oui | interface utilisateur |
| En-tête : `theme-color`, icône de l'onglet | — | oui | interface utilisateur |
| En-tête : métadonnées de référencement | — | oui | interface utilisateur |
| Attributs de l'élément racine : `lang`, `dir`, thème | — | oui | interface utilisateur |
| Plein écran | entrée, sortie | oui | interface utilisateur |
| Saisies de niveau document : raccourcis déclarés (D10) | appui | non | interface utilisateur |

Les métadonnées de référencement sont perçues à travers l'aperçu d'un partage ou un résultat de recherche : elles relèvent de l'interface utilisateur, et l'information métier qu'elles portent en est une projection (A4.d), comme le titre.

Cet inventaire ne résout pas le cas général du clic ou du déplacement du focus hors d'une View. Les raccourcis déclarés ne constituent pas une autorisation générale d'admettre tout fait au niveau document ; le constat V4 de l'audit historique reste ouvert en 18.30.

### A.2 La fenêtre — adaptateur Viewport (domaine)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Dimensions, densité de pixels | redimensionnement | non | domaine |
| Orientation de l'écran | changement | non | domaine |
| Requêtes média : points de rupture, préférences de couleur et de mouvement | changement de correspondance | non | domaine |

### A.3 Le défilement de la fenêtre — adaptateur du défilement (interface utilisateur)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Défilement de la fenêtre, restauration du défilement | défilement | oui | interface utilisateur |

Le défilement de la fenêtre est une écriture globale, distincte du défilement d'un élément d'une part. Des Foundations disjointes ne séparent pas cette ressource de l’hôte : le catalogue impose un seul adaptateur du défilement par hôte (B.2, B.3).

### A.4 La navigation — adaptateur historique (interface utilisateur)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Adresse : chemin, paramètres, ancre | changement par l'utilisateur | oui | interface utilisateur |
| Historique de session | retour, avance | oui | interface utilisateur |

L'adresse est perçue et modifiée par l'utilisateur : par 11.1, elle relève de l'interface utilisateur. L'état de navigation qui importe au métier vit alors dans une Feature, et l'adresse en est une projection (A4.d), comme le titre (18.2, tranchée).

### A.5 Le stockage — adaptateurs de stockage (domaine)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Stockage local | modification depuis un autre onglet | oui | domaine |
| Stockage de session | — | oui | domaine |
| Base de données indexée | — | oui (réponses : faits provoqués) | domaine |
| Cache de requêtes | — | oui | domaine |
| Cookies | — | oui | domaine |

Chaque ligne relève d'une catégorie d'adaptateur distincte : leurs modèles d'accès (synchrone ou par fait provoqué) et leurs durées de vie diffèrent (annexe B).

Ces ressources sont matérialisées par l'hôte : ce sont des ressources de l'hôte, non des systèmes extérieurs. Leur matérialisation survit à la fin de la racine, mais aucune ressource du modèle ne lui survit (T3, remarque ; 18.3, tranchée).

Les préfixes de clés, noms de bases, noms de caches et périmètres de cookies délimitent des ressources de l'hôte distinctes, non de simples noms logiques propres à une racine. Leur disjonction entre racines d'un même hôte est requise par B.2 ; elle n'offre aucune garantie contre les écritures d'onglets ou de scripts non coordonnés.

### A.6 Cycle de vie de la page — adaptateur du cycle de vie (domaine)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Visibilité de l'onglet | masqué, visible | non | domaine |
| Focus de la fenêtre | gain, perte | non | domaine |
| Cycle de vie de la page | arrière-plan, gel, reprise, retour depuis le cache | non | domaine |
| Fermeture imminente | fin annoncée | non | domaine |

La fermeture imminente précède la fin de la racine (7.4). L'admettre permet au domaine de tenter de conserver son état avant que l'hôte n'y mette fin, sans garantie d'achèvement de l'effet extérieur. Le fait est inscrit dans un état d'observation avant un éventuel Event (A3.h, 16.8).

### A.7 Connectivité — adaptateur de connectivité (domaine)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Connexion réseau | en ligne, hors ligne | non | domaine |

L'état du réseau et l'état de la page sont deux fonctions distinctes (règle de méthode, §16) : ils ont deux adaptateurs.

### A.8 Environnement de l'utilisateur — adaptateur de l'environnement (domaine)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Langues préférées | changement | non | domaine |
| Fuseau horaire, format régional | — | non | domaine |

### A.9 Capacités soumises à autorisation

Géolocalisation, presse-papiers, notifications, caméra et microphone, verrouillage de l'écran, vibration. Chacune relève d'un adaptateur distinct ; la réponse à une demande d'autorisation est un fait provoqué (A5.c). Seul le presse-papiers, support de présentation ou d'expression d'une intention, figure au catalogue V1 dans l'interface utilisateur ; ses écritures globales imposent une seule instance par hôte (B.2, B.3). Les autres capacités sont reportées (annexe B).

### A.10 Hors de l'hôte et cas limites

| Source | Classement |
| --- | --- |
| Requêtes réseau, connexions persistantes, flux d'événements serveur | systèmes extérieurs (3.4) |
| Messages entre onglets ou cadres | hors catalogue V1 : non conforme (B.1) ; l'interlocuteur est souvent une autre racine (G6, 18.5) |
| Horloge et générateur aléatoire | valeurs lues librement, sans admission (18.15, tranchée) ; rejeu : 18.8 |
| Minuteries, rappels d'animation | pas d'adaptateur (A5, remarque sur les faits provoqués) |

## Annexe B — Catalogue des adaptateurs de l'hôte navigateur

*Annexe normative.* Elle précise D7 pour l'hôte navigateur et applique D19 aux regroupements de notifications. B.3 explicite les conventions de classement des cas limites ; l'annexe A en expose les motifs sans autorité normative. Les [fiches détaillées des adaptateurs](adaptateurs/README.md) développent les messages, les gardes et les tests ; en cas d'écart, la présente annexe fait autorité. Leur alignement et leur validation ne sont pas présumés réalisés.

### B.1 Finitude

Les catégories d'adaptateurs de l'hôte navigateur forment une liste fermée (B.3). Une application en active un sous-ensemble, par déclaration (16.9) ; un adaptateur non déclaré n'est pas créé et n'admet rien. Spécialiser un adaptateur ne crée pas de catégorie ; une catégorie nouvelle demande une évolution de Bonsai.

Une source de l'hôte située hors des éléments admis par les Foundations (D3), absente du catalogue et que B.6 n'attribue à aucun autre composant, n'est admise par aucun composant conforme (D7). Un code applicatif qui l'observe directement n'est pas conforme ; la non-conformité est signalée autant que possible (O2), faute de pouvoir être empêchée par construction.

Un besoin de capture hors View sans admetteur explicitement autorisé est non pris en charge dans ce profil V1 (18.30). L’ouverture de sa conception future ne constitue aucune permission expérimentale implicite. Une capacité générale d’écoute du clic ou du focus au niveau document ne peut pas être ajoutée sous le nom d’un raccourci déclaré.

### B.2 Nature commune

Tout adaptateur satisfait 16.8. En outre :

- la racine ne détruit pas un adaptateur : il prend fin avec elle ;
- dans une racine, une source déterminée n'est admise que par une seule instance d'adaptateur (A5.d, D7) ; une catégorie à plusieurs instances leur attribue des périmètres disjoints, déclarés et vérifiés au démarrage ;
- une catégorie marquée « une par hôte » n'est activée que par une seule des racines qui coexistent dans un même hôte : document, historique, défilement de la fenêtre et presse-papiers ont une autorité exclusive d'écriture globale. L'isolation des messages (G6) et la disjonction des Foundations ne suffisent pas à assurer cette exclusivité physique ;
- pour le stockage local et de session, les préfixes de clés ne se recouvrent pas ; pour la base de données indexée et le cache, les noms de bases et de caches sont distincts ; les périmètres de cookies désignent des emplacements physiques disjoints, en tenant compte du nom, du domaine et du chemin. Cette exigence vaut aussi entre racines d'un même hôte, pas seulement entre instances d'une racine. Les opérations d'écriture ou de suppression restent dans le périmètre déclaré ; un effacement global ne devient pas conforme par l'usage de préfixes distincts ;
- le contrôle commun au démarrage doit refuser les conflits entre racines coordonnées, notamment lors de l'arrivée d'une seconde racine. Il ne garantit pas l'exclusivité contre les autres onglets, les scripts ou les auteurs non coordonnés. Leurs changements restent des faits extérieurs à admettre ; aucune transaction extérieure ni absence de concurrence physique n'est déduite des axiomes.

### B.3 Catégories V1

| Catégorie | Partie | Instances | Sources (annexe A) |
| --- | --- | --- | --- |
| Document | interface utilisateur | une par hôte | A.1 |
| Viewport | domaine | une par racine | A.2 |
| Défilement | interface utilisateur | une par hôte | A.3 |
| Historique | interface utilisateur | une par hôte | A.4 |
| Stockage local | domaine | plusieurs, par préfixe de clé | A.5 |
| Stockage de session | domaine | plusieurs, par préfixe de clé | A.5 |
| Base de données indexée | domaine | plusieurs, par nom de base | A.5 |
| Cache | domaine | plusieurs, par nom de cache | A.5 |
| Cookies | domaine | plusieurs, par nom de cookie | A.5 |
| Cycle de vie | domaine | une par racine | A.6 |
| Connectivité | domaine | une par racine | A.7 |
| Environnement | domaine | une par racine | A.8 |
| Presse-papiers | interface utilisateur | une par hôte | A.9 |

**Convention normative de classement.** Le document, l'historique, le défilement et le presse-papiers sont des supports de présentation ou d'expression d'une intention ; Viewport, cycle de vie, connectivité et environnement décrivent des conditions d'environnement. Le focus de la fenêtre reste donc dans le domaine, sans assimiler le focus d'un champ à cette condition. Les stockages, base indexée, caches et cookies relèvent du domaine. Le fait qu'un utilisateur puisse provoquer un changement n'inverse pas ces conventions (11.1). Elles ne tranchent pas l'admission d'un clic ou du focus hors d'une View (18.30).

Les catégories à plusieurs instances sont soumises aux périmètres physiques disjoints de B.2, y compris entre racines d'un même hôte. « Une par racine » autorise plusieurs observations des conditions d'environnement ; cela ne confère pas à chaque racine une autorité d'écriture sur une ressource globale.

Les autres capacités soumises à autorisation (géolocalisation, notifications, caméra, microphone, verrouillage de l'écran, vibration) sont reportées après la V1 : une application qui les utilise n'est pas conforme à la V1.

### B.4 Opérations réservées et points d'extension

Les opérations suivantes sont réalisées par Bonsai et ne sont pas surchargeables par le code applicatif : l'identité et le Channel ; la connexion à la source ; l'admission, y compris l’annulation déclarée de l’action par défaut (D20) ; l'établissement du contexte causal et la restitution de celui d'un fait provoqué (A5.b, A5.c, G8) ; le transport (G2) ; l'enregistrement et le retrait des observateurs de l'hôte ; le contrôle d'unicité du périmètre ; la destruction.

La capture est unique par occurrence définie par la source (C.4), liée à l’occurrence de vie de l’admetteur (C.2). Résultats instrumentés corrélés et notifications générales non corrélables sont distingués ; aucune égalité de valeur ou proximité temporelle ne prouve un parent. Les Queries rendent seulement les observations intégrées (C.5). Les lectures de rafraîchissement sont préparées par une action, engagées après validation et intégrées par le traitement du résultat local. Une source sans notification native ne devient pas fraîche par une Query : son contrat prévoit une observation indisponible ou un rafraîchissement explicite.

Une spécialisation n'intervient que sur des valeurs déjà admises et détachées de toute ressource de l'hôte : filtrer, normaliser, sélectionner l'information à inscrire dans son état d'observation puis à émettre (A3.h), associer une valeur à un message déclaré (un Event émis sur son Channel, ou, pour un adaptateur de l'interface utilisateur seulement, une Command adressée à un Channel déclaré, sous la réserve d'A4.b et de D18 ; D17). Ses opérations applicatives s'exécutent dans une initialisation autorisée ou un traitement, notamment celui du message local d'admission ; le préambule d'admission ne mute pas l'état applicatif (§2.5, 11.6). La spécialisation ne produit ni ne remplace un contexte causal, n'observe aucune autre source, n'émet sur aucun autre Channel et ne transmet aucune référence.

Une politique déclarée peut retenir une notification, notamment la dernière, et abandonner les autres (D19). L'infrastructure de communication conserve le contexte de la notification retenue : le résultat continue ce seul déclenchement. Ce mécanisme n'annonce pas une synthèse de toutes les causes des données. Une agrégation exigeant plusieurs parents causaux n'est pas prise en charge en V1 ; son report est le choix explicite de D19, non une liberté implicite du point d'extension. Ni le regroupement ni son délai éventuel ne permettent d'inventer une origine ou de réinitialiser la profondeur (A5.b, G8, D9).

**Contre-exemples :** une sous-classe de l'adaptateur Viewport ajoute son propre écouteur de défilement (autre source, autre catégorie) ; une sous-classe de l'adaptateur historique émet un Event avec un contexte causal qu'elle a construit (A5.c, A5.b) ; une sous-classe de l'adaptateur de stockage local transmet l'objet de stockage de l'hôte dans un message (A3.d).

### B.5 Projection

Un adaptateur de l'interface utilisateur qui tient une ressource en projection d'une information du domaine (A4.d) ne la modifie que si la projection demandée n'est pas déjà satisfaite. L'équivalence compare la valeur et, lorsque cela change le sens de l'effet, l'opération demandée. Pour une simple affectation, une valeur identique suffit à éviter une réécriture. La vérification supprime les échos équivalents ; elle ne prouve ni convergence générale ni absence de boucle entre transformations différentes. Une alternance de positions 0 et 100 peut respecter cette règle à chaque écriture. D9 n'y ajoute qu'une borne de profondeur, non une preuve de terminaison.

La manière de modifier la ressource, lorsqu'elle doit l'être, est portée par l'information du domaine elle-même, non par le contexte causal du message reçu, qui ne fait pas partie de l'information transmise (10.6). Pour l'historique, l'Event de navigation porte son mode : ajouter une entrée, remplacer l'entrée courante, ou suivre un retour ou une avance. Une égalité d'adresse ne suffit pas à considérer une demande d'ajout comme satisfaite : une nouvelle entrée peut être l'effet demandé. À l'inverse, suivre un retour ou une avance vers l'adresse courante ne crée pas d'entrée ; une adresse différente issue d'une redirection remplace l'entrée. L'équivalence porte donc sur la valeur **et** l'opération, pas sur l'adresse seule.

La projection prépare ses effets pendant le traitement puis les engage après validation interne (C.3, G7). Une erreur synchrone d’engagement ferme la ressource visée, dont les effets suivants sont marqués non tentés ; un échec asynchrone n’annule pas les engagements précédents (C.3). Résultats et notifications suivent le protocole de corrélation et la durée de vie de l’admetteur ; les observations sont inscrites avant Event (A3.h). Un état souhaité n’est pas une observation de succès, et aucune dérivation de présentation ne crée d’autorité métier. Une notification générale inconnue peut mettre à jour l’observation mais ne déclenche pas de Command UI (D18) ; le relais de navigation vers le domaine exige donc un protocole établissant l’indépendance ou une continuation déjà autorisée. Le seul nom `popstate`, `hashchange` ou `scroll` n’en est pas la preuve ; le protocole du monde fermé (C.4) l’établit pour un retour, une avance ou un changement d’ancre qu’aucune opération instrumentée de parcours de l’historique en cours n’est susceptible d’avoir produit.

**Contre-exemples :** au retour sur une adresse, l'adaptateur historique reçoit le changement de route qui en résulte et ajoute une entrée identique à l'adresse courante ; après une redirection, il ajoute une entrée au lieu de remplacer la précédente ; ou il ignore une nouvelle demande explicite d'ajout au seul motif que l'adresse est identique. Ces cas confondent l'égalité de valeur et l'opération demandée.

### B.6 Hors catalogue

| Source | Admise par |
| --- | --- |
| Élément de la Foundation, par défaut le corps du document | la Foundation (D3) |
| Faits survenant dans une part | la View propriétaire de la part, ou l'adaptateur du document pour une source déclarée (D10) |
| Systèmes extérieurs et leurs moyens d'appel | le composant du domaine qui les utilise (A4.c, 11.7) |
| Minuteries, rappels d'animation | le composant qui les a armés (A5.c) |
| Heure courante, valeurs aléatoires | aucune admission : lecture libre (18.15) |

### B.7 Profil de corrélation du navigateur

Dans le profil navigateur, relèvent de ce protocole les saisies dans une part (clic, appui sur une touche, saisie d’une valeur), les raccourcis de niveau document déclarés, le changement de plein écran, le retour, l’avance et le changement d’ancre de l’historique, ainsi que les changements de connectivité et d’environnement ; aucune opération du modèle ne produit ces deux derniers. Les fiches d’adaptateurs et la spécification de la View déclarent les opérations productrices de chaque source. Les notifications générales de défilement, de redimensionnement et de focus peuvent résulter d’une écriture de présentation ou d’un changement de composition : leur ensemble d’opérations productrices n’est pas clos. Sans identifiant d’opération, le profil navigateur leur attribue l’antécédent inconnu, sauf corrélation établie. L’indicateur `isTrusted` n’établit ni l’indépendance ni la parenté d’une occurrence (C.4) : un événement produit par une opération du navigateur déclenchée par le code peut le porter.

## Annexe C — Protocole d’exécution

*Annexe normative.* Elle fixe les contrats opérationnels que supposent les garanties (§13) et les décisions (15.2). Ses conventions explicitent les protocoles utilisés par les axiomes et garanties ; leurs états et qualificatifs appartiennent au protocole, non à de nouveaux rôles ni à des ressources supplémentaires, et ne modifient pas le graphe des définitions du §17. Elle prévaut sur toute formulation abrégée d’une garantie, d’une décision ou d’un rôle ; elle ne crée aucune obligation que la théorie n’impose pas.

### C.1 Démarrage, disponibilité et publication

**Démarrage.** Le démarrage est l’unité de validation exceptionnelle qui précède l’ouverture de la délivrance des messages différés. La racine crée ses enfants déclarés et établit leurs Channels avant les consultations initiales. L’initialisation des états et de la composition est autorisée pendant cette phase ; les messages différés attendent sa réussite. Les admissions survenues entre-temps attendent sa clôture. Un échec abandonne le modèle en construction et ses messages différés ; aucune application partiellement démarrée n’est publiée. Les effets hôte suivent les limites de G7. Après le démarrage, l’initialisation d’un composant créé pendant un traitement fait partie de l’unité de validation de son créateur, y compris pour l’échec ; elle reste exécutée par le composant propriétaire des ressources concernées. Cette inclusion ne délègue aucune autorité. Les Queries initiales respectent G5 et ne peuvent viser une initialisation encore active.

**Un Channel établi ne rend pas sa cible consultable.** Un composant passe par les phases déclaré, en initialisation, prêt à consulter, publié et détruit. « Prêt à consulter » exige la réussite de son initialisation logique et de ses validations propres. Une Query vers une cible non prête ou active échoue selon G7, sans attente ni initialisation à la demande. Les dépendances de consultation initiale sont déclarées ; leur ordre respecte ces dépendances, et un cycle requis est refusé. Parmi les cibles sans dépendance restante, l’ordre de déclaration tranche. Les dépendances conditionnelles restent soumises au contrôle de disponibilité à l’exécution.

Une cible prête pendant le démarrage fournit un état provisoire de cette unité, non celui d’un modèle déjà publié. La publication de tous les composants créés dans une unité dépend de la validation de celle-ci ; son échec les abandonne. Après le démarrage, cette règle s’applique à l’unité du créateur d’un enfant. Les composants provisoires ne sont pas accessibles depuis une unité extérieure ; G5 interdit le chevauchement. Hors initialisation provisoire, une cible prête et inactive expose son état interne validé. La disponibilité logique n’exige pas que la ressource de l’hôte soit déjà matérialisée (§9.10).

### C.2 Durée de vie des admissions et délivrances

**Une délivrance ne ressuscite jamais son destinataire.** Chaque création associe au composant une occurrence de vie non réutilisable, distincte d’un namespace ou d’un emplacement réattribuable. Callbacks, opérations et messages locaux visent cette occurrence. Sa validité est vérifiée avant admission et avant délivrance. Une destruction validée retire ses délivrances encore en attente ; un callback tardif est écarté avant admission, sans transfert à un autre composant. Une trace technique peut constater cet abandon sans exécuter de code applicatif. La fin de la racine clôt toutes ces occurrences et leurs conservations causales.

La destruction provisoire suit G7 : son annulation conserve la même occurrence, les abonnements et réservations antérieurs. Si une notification est capturée pendant une telle destruction provisoire, son admission attend l’issue de l’unité ; elle est abandonnée si la destruction est validée, admise après annulation sinon. La capture technique n’est pas un traitement. L’annulation physique des opérations extérieures est tentée lors du nettoyage, sans garantie contre les callbacks déjà engagés. Un contexte est conservé jusqu’au résultat attendu, à l’annulation ou à la clôture de son occurrence ; les opérations répétitives le conservent jusqu’à leur annulation ou cette clôture.

### C.3 Effets : préparation, engagement et résultat

**Préparation.** Un traitement prépare ses effets irréversibles sur l’hôte et les systèmes extérieurs ; ils ne sont engagés qu’après validation de son état interne. Leur application n’est pas une transaction distribuée : plusieurs effets peuvent réussir partiellement, et leur échec est admis par un nouveau message. Différer une projection DOM ne rend pas sa série d’écritures atomique. Aucune émission ne doit annoncer la réussite d’un effet encore seulement prévu. Les ressources d’observation et les intentions enregistrées restent distinctes de la matérialisation extérieure qu’elles décrivent.

**Phase post-validation.** Après validation interne, les effets préparés sont engagés dans leur ordre de préparation, hormis ceux qu’une erreur synchrone d’engagement rend non tentés (alinéa suivant), avant la prochaine délivrance différée. Leur achèvement asynchrone n’est pas attendu ; leurs résultats et les notifications synchrones de l’hôte suivent l’admission et la mise en file, jamais la réentrance, sous réserve de la durée de vie du destinataire (C.2). Une erreur d’application ne revient pas sur la validation déjà acquise et ne fait pas passer une intention publiée pour un succès. Les messages différés d’une unité annulée sont retirés sans réordonner les autres. D8 règle l’ordre de la file, non une attente de tous les résultats extérieurs.

**Un engagement n’est pas une réussite matérielle.** Tout effet vise une ressource (11.8) : la part qu’il matérialise ou dans laquelle il écrit, sinon la ressource de l’hôte qu’il modifie ; auprès d’un système extérieur, chaque requête vise une ressource distincte, une dépendance entre requêtes passant par le traitement du résultat (alinéa suivant). Une erreur synchrone d’engagement ferme, pour le reste de la liste, la ressource visée par l’effet en échec et, s’il s’agit d’une part, toutes les parts qui en descendent : les effets suivants qui les visent sont marqués non tentés. Toute erreur ferme sa ressource, quel que soit l’effet : une écriture interrompue peut laisser l’élément incohérent. Les autres effets restent engagés dans leur ordre de préparation ; les effets précédemment engagés ne sont pas annulés. Cette règle suppose que toute dépendance synchrone entre effets d’une même liste suit l’arbre des parts ou porte sur la même ressource : la matérialisation d’une part et les écritures dans celle-ci visent la même part, une part attribuée dans une autre en descend, et nul n’écrit dans la part d’autrui (A3, 9.10). Des parts sœurs étant disjointes (T7), l’échec de l’une ne prive pas les autres de leur engagement, quel que soit leur ordre de déclaration. Une part placée par rapport à une sœur non matérialisée est placée à la fin de son conteneur : sa position est fausse, son engagement n’échoue pas. Le bilan d’engagement, avec les échecs et non-tentatives, est admis comme résultat corrélé pour le composant vivant concerné. Les effets peuvent appartenir à des composants différents pendant une création : le résultat reste routé à l’occurrence de chacun, non réattribué au créateur. Un échec asynchrone ne supprime pas rétroactivement les engagements déjà effectués. Les résultats effectivement capturés prennent rang à leur admission ; l’ordre d’engagement ne fixe pas leur ordre d’achèvement.

Si un effet B exige la réussite confirmée de A, B n’est préparé que pendant un traitement du résultat de A ; sa seule position après A dans une liste ne satisfait pas cette dépendance. Chaque contrat distingue au minimum intention, engagement, observation de réussite, échec et non-tentative lorsqu’ils sont pertinents. Le signalement technique d’une erreur de nettoyage reste possible après disparition du composant ; il n’est pas une admission applicative à un destinataire détruit. Les invariants d’état validés ne sont pas révoqués par un échec extérieur.

**Résultats propres, non sources générales.** L’admission du résultat instrumenté de ses propres effets autorisés est permise même à un rôle qui n’admet pas de notifications générales de l’hôte : Composer et Foundation compris. D3, D7, D12 et 16.4 prévoient cette admission ; elle ne donne accès à aucune autre source. Pour le Composer, le traitement ne concerne que le contenu du slot et l’existence de ses Views ; il n’introduit aucun état local indépendant, rendu de présentation ou droit de Command. D16 déclare ces résultats et leurs traitements locaux, y compris les bilans d’engagement ; aucun gestionnaire arbitraire n’est ajouté à l’exécution. Durée de vie et borne D9 s’appliquent aussi à ces résultats.

### C.4 Occurrences de faits et corrélation observable

**La capture unique porte sur une occurrence observable, non sur une intention humaine reconstruite.** Pour chaque source déclarée, Bonsai fixe l’unité de notification et son identification au point de capture. La propagation d’une même occurrence entre écouteurs ne crée pas plusieurs faits ; touche, clic et changement de valeur distincts restent plusieurs occurrences, même issus d’une même action humaine. Des valeurs égales ne prouvent pas l’identité des faits. Aucune occurrence supprimée ou fusionnée par l’hôte n’est reconstruite fictivement.

Chaque source déclare son protocole de corrélation et classe ses occurrences admises dans exactement l’un des cas suivants, sous contrôle de l’infrastructure de communication :

| Cas | Condition | Contexte |
| --- | --- | --- |
| Résultat corrélé | L’interface instrumentée associe sans ambiguïté le résultat à une opération déterminée. | Continuation du déclencheur conservé. |
| Fait indépendant établi | Le protocole de source établit l’absence d’antécédent dans le périmètre observé. | Origine qualifiée spontanée. |
| Notification non corrélable | Aucun antécédent unique ni indépendance ne peut être établi. | Origine d’observation qualifiée antécédent inconnu, sans parent attribué. |

Une origine d’observation ne déclare pas une nouvelle cause physique spontanée ; elle signale une coupure de connaissance. Le code applicatif ne choisit jamais cette qualification. Un lien connu ne peut pas être effacé pour créer une telle origine. Proximité temporelle, égalité de valeur, dernier effet demandé ou seul indicateur de confiance fourni par l’hôte ne constituent pas une preuve de parenté. Un résultat d’opération corrélé et une notification générale de l’hôte sont des occurrences distinctes ; le premier n’établit pas à lui seul la cause de la seconde.

**Protocole du monde fermé.** Le protocole d’une source peut déclarer l’ensemble des opérations du modèle susceptibles de produire ses occurrences. Lorsque toutes passent par une interface Bonsai instrumentée (G8), une occurrence qu’aucune opération de cet ensemble, engagée et non close dans la même racine, n’est susceptible d’avoir produite est un fait indépendant établi : aucun traitement du périmètre observé ne l’a provoquée (10.2). Si une telle opération est en cours sans corrélation univoque, l’occurrence est d’antécédent inconnu. Une source dont cet ensemble ne peut être déclaré ou instrumenté ne relève pas de ce protocole. L’indépendance ainsi établie vaut dans le périmètre observé : une occurrence produite par une autre racine ou par un auteur non coordonné y est indistinguable d’une action humaine (B.2). Hors interface instrumentée, un appel brut à une opération de l’hôte déclarée productrice d’occurrences d’une telle source n’est pas conforme (G8).

*Contre-exemple :* une View simule une saisie dans sa part par une opération brute de l’hôte, et sa réaction à cette saisie adresse une Command ; l’occurrence passerait pour indépendante.

Le profil de l’hôte navigateur est fixé en B.7. Les callbacks liés à une opération, comme une réponse réseau ou l’expiration d’une minuterie instrumentée, sont corrélés. Un adaptateur ou une spécialisation ne peut pas substituer une heuristique à ce contrat. D19 sélectionne des notifications déjà contextualisées ; il ne répare pas une causalité perdue par l’hôte. D9 ne borne pas les boucles traversant une coupure non corrélable. Une origine d’observation inconnue n’accorde aucun droit de commander à l’interface (D18).

### C.5 Observations consultables et capture des valeurs

**Une Query ne rééchantillonne pas une ressource de l’hôte.** Elle rend exclusivement l’observation intégrée par initialisation ou par traitement d’un message d’admission, ou un calcul interne à partir des ressources ainsi accessibles. Un rafraîchissement nécessitant une lecture physique est une action : son échantillonnage s’effectue après validation, puis sa valeur capturée entre par admission ; seul le traitement local intègre l’observation. Le préambule capture sans mutation applicative et ne relit pas la ressource de l’hôte à la délivrance. L’initialisation autorisée peut intégrer les valeurs initiales sous la cause de démarrage. Une observation indisponible est représentée explicitement ; une observation connue ne certifie pas la valeur physique actuelle. Les lectures libres de l’heure et de l’aléatoire restent l’exception de 3.2, non des observations persistantes déguisées.

Les valeurs de messages sont capturées lors de leur soumission au transport, les réponses lors de leur retour : ni l’auteur, ni le destinataire, ni un autre abonné ne dispose d’un alias mutable permettant de changer la valeur transmise. Les paramètres de création suivent la même règle de capture. Copie détachée et immuabilité profonde sont des mécanismes possibles ; une annotation de type en lecture seule ne suffit pas à elle seule. Une réponse conservée représente un état au moment de la consultation, pas une autorité durable ni un instantané global de plusieurs traitements. Toute Command réévalue ses préconditions dans son propre traitement.

### C.6 Réservations d’abonnements

**Une réservation de délivrance vise un abonnement déterminé, non le simple fait d’être actuellement abonné.** À l’émission, les occurrences d’abonnement présentes et leur ordre sont fixés. Avant chaque délivrance, G1/G3 vérifient que l’abonnement réservé, son propriétaire et le Channel sont encore valides. Une destruction validée annule la réservation correspondante ; une annulation de destruction la conserve. Un abonnement créé ou recréé plus tard ne reprend aucun Event antérieur. L’abandon d’une réservation ne réordonne pas les autres et ne constitue pas un échec du traitement émetteur déjà validé.

### C.7 Structure transactionnelle

Le rollback interne de G7 inclut les existences, abonnements, attributions et restitutions : une destruction structurelle reste provisoire jusqu’à validation. Son annulation conserve les composants, propriétaires, parts et désignations antérieurs ; elle n’est ni une nouvelle création ni un transfert de propriété. Les créations abandonnées et leurs désignations ne deviennent pas publiées. Le nettoyage physique irréversible est différé à la phase post-validation. Ces règles ne restaurent pas une ressource de l’hôte déjà changée par celui-ci et ne promettent pas une restauration DOM après échec d’un effet.

### C.8 Précisions opérationnelles des décisions

**Précision D8.** Les réservations sont attachées aux occurrences d’abonnement présentes à l’émission (C.6), sous réserve de G3. Un remplacement d’abonnement ne récupère pas le rang de l’ancien. *Alternative écartée :* recalculer les destinataires à la délivrance ou offrir implicitement un rejeu historique aux nouveaux abonnés.

**Précision D9.** La profondeur compte les liens établis dans le périmètre observable. Une origine d’observation à antécédent inconnu commence un autre segment déclaré ; D9 ne borne pas une boucle physique traversant cette coupure. Seule l’infrastructure de communication peut constater une coupure selon le protocole de source ; un lien connu ne peut être perdu intentionnellement pour contourner la borne. La limite observable fait partie du contrat, pas d’une preuve de terminaison cachée.

**Refus D9 et validation.** Le contrôle précède toute soumission au transport : adressage de Query, production de Command ou d’Event, soumission d’un local. La profondeur d’un Event est contrôlée pour ses branches avant toute réservation ; le nombre d’abonnés n’ajoute pas de profondeur. Si le refus survient pendant un traitement ou une initialisation, c’est une erreur de transport : elle interrompt l’unité de validation extérieure selon G7, annule ses mutations et ses différés, et empêche ses effets préparés d’être engagés. Une Query refusée propage cette erreur, sans réponse de substitution. Le code ne peut transformer ce refus en poursuite réussie de la même unité. Si le refus survient au préambule d’une admission, notamment pour un résultat post-validation, aucun traitement applicatif ne commence ; l’occurrence est abandonnée et signalée techniquement, sans révoquer une unité déjà validée ni annuler ses effets. Ce signalement est une trace d’infrastructure hors transport applicatif : il ne produit ni nouveau message ni origine destinée à contourner la borne. Le contrôle n’est pas reporté à la délivrance d’un message accepté. *Alternative écartée :* valider l’auteur puis abandonner silencieusement ses messages à la délivrance.

**Précision D14.** L’établissement des Channels précède l’initialisation ordonnée par dépendances déclarées ; il ne remplace pas le contrôle de disponibilité du C.1. Ni résolution d’un cycle requis par attente, ni initialisation paresseuse déclenchée par Query n’est permise. *Alternative écartée :* exposer une cible non initialisée au seul motif que son Channel existe.

**Précision D16.** Le contrat nomme aussi les dépendances de consultation pendant l’initialisation et le protocole de chaque source : unité de fait, capture, corrélation ou antécédent inconnu (C.1, C.4). Ces déclarations bornent les capacités sans prouver mécaniquement toutes leurs obligations sémantiques.

Les résultats instrumentés des effets autorisés et les bilans d’engagement sont également déclarés, avec leurs traitements locaux, pour tous les rôles concernés (C.3). Leur admission ne vaut pas abonnement à une source générale de l’hôte.

**Précision D19.** La politique sélectionne exclusivement des notifications déjà contextualisées selon C.4. Elle conserve aussi la qualification inconnue lorsqu’elle existe et ne reconstitue pas les causes d’une coalescence effectuée par l’hôte. *Alternative écartée :* attribuer la notification retenue à un effet antérieur seulement supposé.
