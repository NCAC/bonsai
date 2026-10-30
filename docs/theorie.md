# Bonsai — Vocabulaire fondamental V0.9.2

Oct 29, 2026 · @ncac

**Version : V0.9.2 — registre, guide et conformité (en cours : reste l'alignement du dépôt).**

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
9. gardes (§19).

Les rôles (`Application`, `Feature`, `Entity`, `Foundation`, `Composer`, `View`, `Behavior`, `Manifest`, adaptateur de l'hôte) ne font pas partie du vocabulaire fondamental. Un rôle dérivé n'est pas nécessairement un composant. `Command`, `Query` et `Event` sont les trois voies établies par T2.

## 2. Règles de définition

### 2.1 Termes primitifs

Un terme primitif n'est pas défini à partir d'autres termes de la théorie. Son sens résulte de son usage dans les définitions et les axiomes, des configurations qui les satisfont et des contre-exemples qui les violent. Son explication intuitive ne peut pas servir de prémisse dans une démonstration.

### 2.2 Termes définis

Chaque définition exprime une seule notion ; n'emploie ni le terme défini ni un synonyme ; n'utilise que des termes primitifs, des termes antérieurs dans la chaîne du §17 et le métalangage ; ne dépend d'aucun rôle dérivé ; ne comporte aucun exemple ; ne prescrit aucun mécanisme d'implémentation.

### 2.3 Métalangage admis

Sont admis sans définition : action, auteur, changer, code applicatif, commencer, contenir, continuer, déclarer, délimiter, délivrer, démarrage, désigner, destinataire, détruire, distinguer, ensemble, erreur, exécuter, exécution, exister, fait, information, limite, matérialiser, modifier, opération, partie, produire, règle, relation, signaler, suite, transmettre, utiliser, utilisateur.

« Exister » garde son sens ordinaire ; il ne renvoie pas à l'existence au sens de 7.1. « Code applicatif » désigne le code écrit pour une application, par opposition à Bonsai. « Exécution » désigne uniquement l'exécution d'une opération ; la marche du modèle dans le temps est désignée par « vie du modèle ». « Démarrage » désigne la création de la racine et de ses enfants. L'auteur d'un message est le composant qui le produit. « Produire » et « transmettre » décrivent un acte matériel ; un énoncé normatif ne les emploie jamais seuls pour désigner qui traite ou qui reçoit un message.

Une information n'est ni un composant, ni une ressource, ni un message ; elle peut être contenue dans une ressource ou portée par un message.

Un mot entre dans le vocabulaire lorsqu'il reçoit un sens propre à Bonsai, modifie la portée d'un axiome, peut recevoir deux sens architecturaux différents, ou intervient dans plusieurs définitions comme notion technique autonome.

### 2.4 Unicité lexicale

Une notion a un seul terme canonique ; les synonymes sont exclus des énoncés normatifs. Choix retenus :

- `propriétaire` ; « posséder » et « détenir » sont proscrits ;
- `infrastructure de communication`, et non `médiateur`, `framework` ou `Radio` ; le terme s'emploie toujours sous sa forme complète. « Bonsai » désigne la théorie et le logiciel dans leur ensemble ;
- `interface utilisateur`, et non `couche concrète` ;
- `Channel`, et non `canal` ;
- `Query`, et non `Request` ; en français, « consultation ». Avec `Command`, le couple suit la séparation commande-consultation : une Command change sans rendre, une Query rend sans changer (A3.g, T2) ;
- `namespace`, uniquement pour une représentation textuelle d'identité ;
- `adresser`, `émettre`, `recevoir` et `traiter` désignent quatre actes distincts (§9) ;
- `création`, `attribution` : deux actes distincts ; il n'existe aucun transfert de propriété (A2.c).

« Modèle » désigne uniquement l'univers organisé par Bonsai (3.1). « Contre-exemple » désigne une configuration qui viole un axiome.

### 2.5 Définition, axiome et lecture des axiomes

Une définition dit **ce qu'est** une notion. Un axiome dit **ce qui est permis, interdit ou obligatoire** ; chacune de ses clauses doit pouvoir être fausse dans un contre-exemple concevable, qui l'accompagne.

**Règle de lecture.** Les axiomes sont satisfaits à l'issue de chaque opération et de chaque fin de racine. Les états intermédiaires au cours d'une opération n'y sont pas soumis. G5 garantit que ces issues se succèdent : deux traitements ne se chevauchent pas. Un traitement interrompu par une erreur est sans effet sur les ressources du modèle (G7) : son issue est l'état qui le précédait.

**Règle d'imputation.** Ce qu'exécute une partie d'un composant qui n'est pas elle-même un composant est exécuté par ce composant.

**Règle de cascade.** La fin des ressources d'un composant, par l'effet de la destruction de son existence, fait partie de cette destruction ; ce n'est pas une opération exclusive exécutée par un autre composant.

### 2.6 Objectifs, conséquences et décisions

Une **conséquence** est un lemme, un théorème ou une garantie : ce que les définitions, les axiomes et les garanties établissent. Un **objectif** est une qualité que Bonsai poursuit sans que les axiomes l'imposent (15.1). Une qualité que les axiomes établissent est une conséquence, non un objectif.

Aucune démonstration ne s'appuie sur un objectif, et aucun objectif n'est une prémisse. Une décision (15.2) donne sa justification, nomme l'alternative qu'elle écarte, et désigne ce qu'elle protège : un objectif, une conséquence, ou la clause d'axiome ou la définition qu'elle met en œuvre.

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

Une information transmise après la création n'est pas un paramètre de création : c'est une interaction fonctionnelle, soumise à A3.a.

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

L'existence d'une racine satisfait la définition 7.1, mais elle est fournie par l'hôte et n'est pas une ressource du modèle ; aucun composant ne l'admet (A0.d). A1.a et T1 ne s'y appliquent pas. Aucun composant n'en étant propriétaire, aucun ne peut la détruire (A1.b) : sa fin ne peut venir que de l'hôte.

### 7.5 Composition

Relation entre un parent et ses enfants produite par la propriété de leur existence.

**Dépendances :** parent, enfant, existence, propriétaire.

## 8. Identité

### 8.1 Espace des identités

Ressource distribuable dont les parts permettent de distinguer une ressource ou un composant au sein d'un ensemble.

**Dépendances :** ressource distribuable, part, ressource, composant.

### 8.2 Identité

Part d'un espace des identités, dont la seule opération exclusive est l'attribution de parts en son sein.

**Dépendances :** part, espace des identités, attribution.

Une identité ne se modifie que par l'attribution de parts en son sein, et ne prend fin qu'avec son propriétaire (A2.d). Une identité au sein de laquelle des parts sont attribuées est une ressource distribuable dont les parts permettent de distinguer : elle satisfait la définition 8.1, et ces parts sont donc elles-mêmes des identités, dites subordonnées.

### 8.3 Représentation d'identité

Information utilisée pour exprimer une identité.

**Dépendances :** identité.

Une représentation d'identité n'est pas une ressource (§2.3).

### 8.4 Namespace

Représentation textuelle d'une identité dans un espace des identités.

**Dépendances :** représentation d'identité, identité, espace des identités.

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

Information permettant à un composant d'atteindre une ressource, du modèle ou de l'hôte, ou un autre composant, sans transport.

**Dépendances :** composant, ressource, transport.

Le code applicatif n'est ni une ressource ni une référence : désigner la classe d'un composant à créer ne permet d'atteindre aucune ressource ni aucun composant existant.

### 9.10 Référence structurelle

Référence d'un propriétaire vers une ressource dont il est propriétaire, ou d'un parent vers son enfant.

**Dépendances :** référence, propriétaire, ressource, parent, enfant.

**Résolution auprès de l'hôte.** Un composant peut établir une référence structurelle vers une ressource dont il est propriétaire et que l'hôte matérialise, en résolvant auprès de l'hôte la représentation de l'identité de cette ressource. L'hôte n'étant pas un composant, cette résolution n'est pas une interaction fonctionnelle ; l'opération est exécutée par le composant.

### 9.11 Réponse

Information rendue par transport à l'auteur d'un message adressé, produite par le traitement de ce message.

**Dépendances :** transport, message, adresser, traitement.

Une réponse n'est pas un message : elle n'a ni Channel ni contexte causal propre. Le traitement qui la produit s'exécute au cours du traitement de l'auteur (seule exception de G5), qui la reçoit sans attendre aucun fait ultérieur (9.3). Elle n'est pas une interaction distincte : elle fait partie de l'interaction portée par le message adressé auquel elle répond (10.6, « hors transport »).

## 10. Causalité et interaction

### 10.1 Cause

Fait auquel un message ou un changement d'état est rattaché.

**Dépendances :** message, état.

Une cause est un fait, non une entité : elle n'est ni un composant, ni une ressource, ni un message. Le modèle la représente par le contexte causal.

### 10.2 Origine

Cause qui ne continue aucune cause antérieure dans le périmètre observé.

**Dépendances :** cause, périmètre.

Le périmètre observé d'une chaîne causale est le modèle, étendu aux faits extérieurs que son propre traitement a provoqués : un fait spontané de l'hôte ou d'un système extérieur est une origine, un fait provoqué est une continuation (A5.c).

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

### 10.6 Interaction fonctionnelle

Transmission d'une information d'un composant à un autre composant, hors paramètres de création, hors transport et hors contexte causal.

**Dépendances :** composant, paramètres de création, transport, contexte causal.

Un message local n'est pas une interaction fonctionnelle ; il reste soumis à A3.f et A5.b.

## 11. Parties du modèle et frontière

### 11.1 Interface utilisateur

Partie du modèle formée des composants propriétaires d'une ressource par laquelle l'utilisateur perçoit le modèle ou agit sur lui, et de toutes les ressources dont ces composants sont propriétaires.

**Dépendances :** modèle, composant, ressource, propriétaire.

Une ressource appartient donc à la même partie du modèle que son propriétaire.

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

### 11.7 Frontière de confiance

Limite du modèle à laquelle s'opère l'admission.

**Dépendances :** modèle, admission.

La frontière de confiance n'a pas de propriétaire : elle est formée de tous les points d'admission. Ce qui la franchit n'est pas présumé conforme : un message admis est traité comme tout message, et les invariants métier sont satisfaits à l'issue de son traitement (A4.a) ; c'est ce traitement qui valide ce qui entre. En deçà de la frontière, toute ressource a un propriétaire (A1.a) et tout message une cause (A5.b) : c'est le sens du mot « confiance ».

Les différences entre l'hôte et les systèmes extérieurs ne tiennent pas à la frontière, mais à qui admet : seul le domaine échange des informations métier avec un système extérieur (A4.c) ; une source de l'hôte est admise par la Foundation (D3), par la View propriétaire de la part (16.5) ou par un adaptateur (D7) ; le moyen d'appel d'un système extérieur, requête ou connexion, est une ressource de l'hôte admise par le composant du domaine qui l'utilise, et les faits qui y arrivent, réponse ou message poussé par le serveur, sont admis par ce composant (A5.c).

## 12. Axiomes

Chaque clause est suivie de son contre-exemple.

**Champ des axiomes.** Lorsque plusieurs racines coexistent dans un même hôte, chacune forme avec ses descendants un modèle distinct, et les axiomes s'appliquent à chacun séparément. Une même source de l'hôte peut être admise une fois par racine. Pour une racine, un changement de l'hôte que provoque une autre racine est un fait spontané de l'hôte, comme une modification du stockage local depuis un autre onglet (G6).

### A0 — Cadre

> **A0.a** Tout ce qui intervient relève du modèle, de l'hôte, de l'infrastructure de communication ou d'un système extérieur, et d'un seul.
>
> **A0.b** Le modèle ne contient que des composants, des ressources et des messages ; ces trois catégories sont disjointes.
>
> **A0.c** Tout ce qu'on peut connaître ou changer d'un composant est son existence ou une ressource dont il est propriétaire.
>
> **A0.d** À tout composant qui n'est pas une racine est associée une existence, qui n'est une part d'aucune ressource ; créer un composant consiste à créer son existence. L'existence d'une racine n'est admise par aucun composant.

**Contre-exemples :** un registre de Channels est à la fois une partie de l'infrastructure de communication et une ressource qu'un composant modifie (A0.a) ; un service qui n'est ni composant, ni ressource, ni message est appelé par les composants, ou un parent traite son enfant comme une ressource (A0.b) ; un composant expose un cache interne qui n'est pas une ressource, et un autre l'interroge (A0.c) ; un composant est instancié sans existence : aucun composant ne peut le détruire, et il survit à son créateur ; ou un composant admet l'existence de la racine, et la détruit (A0.d).

Ce dont un parent est propriétaire n'est pas son enfant, mais l'existence de celui-ci (A0.b, 7.1).

### A1 — Propriété unique

> **A1.a** Toute ressource du modèle a exactement un propriétaire.
>
> **A1.b** Un composant n'exécute d'opération exclusive que sur une ressource dont il est propriétaire.

**Contre-exemples :** une ressource du modèle n'a aucun propriétaire (A1.a) ; deux composants modifient le même état, un composant modifie le titre du document alors qu'aucun composant ne l'a admis, ou plusieurs composants modifient une variable globale, ressource de l'hôte qu'aucun n'a admise (A1.b).

A1.b porte sur toute ressource, y compris celles de l'hôte : une ressource de l'hôte n'est modifiable qu'après avoir été admise (T8). A1.b exclut toute délégation : faire exécuter une opération exclusive par un autre composant que le propriétaire, c'est la faire exécuter par un non-propriétaire. L'imputation et la cascade relèvent des règles de lecture (§2.5).

### A2 — Origine de la propriété

> **A2.a** Le composant qui crée ou admet une ressource en est le propriétaire initial, sauf pour une part d'une ressource distribuable, dont le propriétaire initial est désigné par attribution du propriétaire de cette ressource.
>
> **A2.b** Toute ressource distribuable est créée par une racine, admise depuis l'hôte, ou bien est une part d'une ressource distribuable.
>
> **A2.c** Le propriétaire d'une ressource demeure le même jusqu'à la destruction de celle-ci.
>
> **A2.d** Le propriétaire d'une ressource distribuable n'en attribue de part qu'à ses enfants. Une part ne prend fin qu'avec son propriétaire.

**Contre-exemples :** un composant choisit lui-même son identité (A2.a) ; un composant crée son propre espace des identités et s'y nomme (A2.b) ; un composant remet un état dont il est propriétaire à un autre composant (A2.c) ; une View attribue une part de son DOM à une View voisine, ou détruit son élément racine en cours de vie (A2.d).

A2.d garantit que la portion rendue à la fin d'une part revient au propriétaire qui l'avait attribuée, par une opération que celui-ci exécute : seul le parent du propriétaire de la part peut détruire ce dernier (A1.b).

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
> **A3.f** Tout message est adressé à un Channel, émis sur un Channel, ou local.
>
> **A3.g** Le traitement d'un message adressé qui rend une réponse n'exécute aucune opération exclusive.
>
> **A3.h** Un composant n'émet d'information que sur une ressource dont il est propriétaire.

**Contre-exemples :** un composant obtient une information d'un autre en appelant l'une de ses méthodes (A3.a) ; un composant ouvre un Channel sous l'identité d'un autre (A3.b) ; un parent lit l'état de son enfant par une référence (A3.c) ; un parent transmet à son enfant une fonction de rappel vers lui-même, ou un élément de l'hôte (A3.d) ; deux composants traitent les messages d'un même Channel, ou un composant émet sur le Channel d'un autre (A3.e) ; une Feature construit un message et appelle directement son propre traitement (A3.f) ; le traitement d'une demande de connaissance incrémente un compteur de consultations, ou le traitement d'une demande de changement rend une réponse (A3.g) ; une Feature émet qu'une commande a été expédiée, sur la foi d'une réponse du serveur, sans avoir inscrit ce statut dans son état (A3.h).

### A4 — Autosuffisance du domaine

> **A4.a** Les invariants métier sont satisfaits à l'issue de chaque traitement, en présence ou en l'absence d'interface utilisateur.
>
> **A4.b** Aucun composant du domaine n'adresse de message à un Channel dont le propriétaire appartient à l'interface utilisateur, ni ne reçoit de message émis sur un tel Channel.
>
> **A4.c** Seul le domaine échange des informations métier avec les systèmes extérieurs.
>
> **A4.d** Toute information métier contenue dans une ressource de l'interface utilisateur provient d'un message émis par un composant du domaine ou d'une réponse produite par un tel composant, et n'est remplacée que par une information de même provenance.
>
> **A4.e** Un Channel dont le propriétaire appartient au domaine ne prend fin qu'avec la racine.

**Contre-exemples :** une Command laisse un panier dont le total ne correspond plus à ses lignes (A4.a) ; un composant du domaine reçoit un message émis par un composant de l'interface utilisateur, ou une Feature adresse un message au Channel de l'adaptateur du document (A4.b) ; un composant de l'interface utilisateur échange des informations métier avec un système extérieur (A4.c) ; au clic sur « Ajouter », une View incrémente le compteur du panier affiché sans attendre l'Event de la Feature (A4.d) ; une Feature est détruite par son parent, ou détruit son propre Channel, alors que l'application continue (A4.e).

A4.e vient de ce qu'un message peut être adressé au domaine à tout moment : tout composant qui dispose d'une représentation de l'identité d'un Channel du domaine peut y adresser un message tant que la racine existe. Pour que ce message puisse être traité, et les invariants métier vérifiés à l'issue de ce traitement (A4.a), le Channel doit exister.

A4.d ne restreint pas la projection : une ressource de l'interface utilisateur peut contenir une copie d'une information métier, la filtrer, la trier ou la paginer. Elle interdit de la remplacer par une information que le domaine n'a ni émise ni rendue en réponse. Une information qui ne porte sur aucune ressource du domaine, comme la position d'un carrousel ou une saisie en cours, n'est pas une information métier (11.5).

### A5 — Causalité

> **A5.a** Tout changement d'état résulte du traitement d'un message.
>
> **A5.b** Tout message porte un contexte causal.
>
> **A5.c** Un fait de l'hôte ou d'un système extérieur n'entre dans le modèle que par un message, produit par le composant qui l'admet. Ce message a pour cause une origine, sauf si le fait a été provoqué par le traitement d'un message antérieur : il en est alors une continuation, et le composant qui a provoqué le fait en conserve le contexte causal jusqu'à son admission.
>
> **A5.d** Un fait de l'hôte ou d'un système extérieur est admis par un seul composant.

**Contre-exemples :** un composant modifie un état à l'expiration d'une minuterie, sans message (A5.a) ; un message est transmis sans contexte causal (A5.b) ; un composant modifie un état directement dans un gestionnaire d'événement de l'hôte, ou la réponse à un appel lancé par une Feature est admise sans lien avec le message dont le traitement a lancé cet appel (A5.c) ; une View et l'adaptateur du document admettent tous deux le même appui sur une touche, et deux chaînes causales partent d'une seule cause (A5.d).

Un fait est **spontané** quand rien dans le modèle ne l'a provoqué (un clic, un redimensionnement, un message poussé par un serveur) ; il est **provoqué** quand il résulte du traitement d'un message (la réponse à un appel, l'expiration d'une minuterie armée par un composant).

L'expiration d'une minuterie ou d'un rappel d'animation est un fait provoqué : elle est admise par le composant qui les a armés, et ne relève d'aucun adaptateur de l'hôte (D7).

Un changement effectué par l'hôte lui-même n'est pas un changement d'état du modèle tant qu'il n'a pas été admis.

A5.d tient à ce qu'une origine est une cause (10.2) : deux admissions d'un même fait lui donneraient deux contextes causaux, et le modèle représenterait une cause comme deux. Lorsque plusieurs racines coexistent, A5.d s'applique à chacune (§12, champ des axiomes).

## 13. Garanties de l'infrastructure de communication

L'infrastructure de communication n'est soumise à aucun axiome. Toute réalisation de l'infrastructure de communication est tenue par les garanties suivantes.

- **G1** — Elle délivre un message adressé à un Channel au seul propriétaire de ce Channel, et un message émis sur un Channel aux seuls propriétaires d'un abonnement à ce Channel, et un message local au seul composant qui l'a produit ; elle rend une réponse au seul auteur du message adressé dont le traitement l'a produite.
- **G2** — Elle ne modifie ni un message, ni son contexte causal, ni une réponse.
- **G3** — Elle ne délivre aucun message relatif à un Channel détruit.
- **G4** — Elle n'est partie à aucune interaction fonctionnelle et n'est propriétaire d'aucune ressource du modèle.
- **G5** — Elle ne délivre un message qu'après la fin du traitement en cours. Seul le traitement d'un message adressé qui rend une réponse s'exécute au cours d'un autre traitement.
- **G6** — Elle ne délivre un message qu'à un composant de la même racine que son auteur ; une réponse n'est donc produite que dans cette racine.
- **G7** — Un traitement interrompu par une erreur ne produit aucun changement d'état des ressources du modèle que l'hôte ne matérialise pas ; aucun des messages qu'il a produits n'est délivré, et aucune réponse n'est rendue. L'erreur est signalée avec le contexte causal du message traité.

Par G6, deux racines qui coexistent dans un même hôte ne se transmettent aucun message : un nom de Channel n'a de sens qu'au sein de sa racine.

Par G7, un traitement interrompu n'a pas d'autre issue que l'état qui le précédait : A4.a ne peut pas être violé par un traitement qui échoue à mi-chemin, et aucun Event n'annonce un état qui n'a pas été atteint (A3.h). Ce que l'hôte matérialise, une écriture dans un stockage ou un élément du DOM modifié, ne peut pas être annulé : un traitement confie ses effets sur l'hôte à un adaptateur par une Command, qui n'est délivrée qu'à la fin du traitement (G5), ou les exécute en dernier. L'annulation fait partie de l'infrastructure de communication, au sens de la remarque sous 3.3.

Par G4, matérialiser un Channel ne confère pas à l'infrastructure de communication la propriété de ce Channel : celle-ci suit l'identité qui le distingue (A3.b).

Par G5, les traitements se succèdent : un message produit au cours d'un traitement n'est délivré qu'après la fin de celui-ci, et une erreur survenue dans un traitement ne peut pas en interrompre un autre. La seule exception, le traitement d'un message adressé qui rend une réponse (9.11), n'exécute aucune opération exclusive (A3.g) ; et le composant qui y répond n'est en cours de traitement que s'il en est lui-même l'auteur, puisque seul l'auteur l'est ; la réponse ne sort alors pas de lui (T2). Elle est donc produite, pour tout autre composant, à partir d'un état issu d'un traitement achevé. L'ordre dans lequel les messages en attente sont délivrés n'est pas fixé par G5 : c'est la décision D8.

## 14. Conséquences établies

Chaque conséquence est suivie de sa démonstration. Les catégories `Command`, `Query` et `Event` n'apparaissent qu'en conclusion de T2, jamais en prémisse.

### L1 — Lemme de l'objet

> Toute interaction fonctionnelle porte sur une ressource.

L'objet d'une interaction est ce qu'elle demande de changer, ce qu'elle demande de connaître, ou ce sur quoi elle informe. Les autres valeurs qu'elle transmet, comme une quantité saisie ou une heure lue (3.2), n'en sont pas l'objet.

**Démonstration.**

1. Une interaction fonctionnelle transmet une information d'un composant C à un autre composant D, hors contexte causal (10.6). Elle passe par un message adressé à un Channel ou émis sur un Channel (A3.a).
2. **Message émis.** Seul le propriétaire du Channel y émet (A3.e) : C informe, et n'émet d'information que sur une ressource dont il est propriétaire (A3.h).
3. **Message adressé.** Il est traité par le propriétaire du Channel, ici D (A3.e) : C lui demande de changer ou de faire connaître quelque chose.
4. Ce que D peut changer, ce sont des ressources dont il est propriétaire (A1.b).
5. Ce que D peut faire connaître sans autre interaction, il l'atteint par une référence structurelle (A3.c) : une ressource dont il est propriétaire, du modèle ou admise de l'hôte (9.9, 9.10), ou l'un de ses enfants, dont il ne connaît sans interaction que l'existence (A0.c, A3.a), qui est une ressource (7.1).
6. Dans tous les cas, l'interaction porte sur une ressource. ∎

L1 ne présuppose aucune des trois voies : elle n'emploie que les clauses de A3 et la définition de l'interaction fonctionnelle.

### T1 — Composition par création

> Le composant qui crée un autre composant en est le parent.

**Démonstration.**

1. Créer un composant consiste à créer son existence (A0.d).
2. Cette existence est une ressource du modèle qui n'est pas une part (A0.d) ; son créateur en est le propriétaire initial (A2.a).
3. Le propriétaire de l'existence d'un composant est son parent (7.2). ∎

La racine n'est pas concernée : rien dans le modèle ne la crée (note de 7.4).

### T2 — Les trois voies

> Toute interaction fonctionnelle relève d'exactement l'une des trois voies suivantes : un composant autre que le propriétaire adresse à celui-ci une demande de changement (**Command**) ; un composant autre que le propriétaire lui adresse une demande de connaissance, dont le traitement lui rend une réponse sans exécuter d'opération exclusive (**Query**) ; le propriétaire émet une information sur sa ressource (**Event**). Une Command et une Query sont traitées par le seul propriétaire ; un Event peut être reçu par plusieurs composants.

**Démonstration.**

1. Soit une interaction de C vers D. Par L1, elle porte sur une ressource R, de propriétaire unique O (A1.a).
2. **Première question : l'interaction vise-t-elle l'exécution d'une opération exclusive sur R ?** La réponse est oui ou non : la partition est exhaustive et exclusive. Une réservation ou une validation qui enregistre quelque chose vise une opération exclusive ; une vérification sans effet n'en vise pas ; une négociation ou une coordination est une suite d'interactions, dont chacune se range séparément.
3. **Si oui.** Seul O exécute l'opération (A1.b). Si C est O, il l'exécute lui-même et n'interagit avec personne. Sinon, C doit en transmettre la demande à O, ce qui passe par un message (A3.a) adressé à un Channel dont O est propriétaire, puisque seul le propriétaire d'un Channel traite ce qui lui est adressé (A3.e). Son traitement exécute une opération exclusive : il ne rend pas de réponse (A3.g). C'est la voie **Command**.
4. **Si non**, l'interaction transmet une information sur R. Seul O dispose d'une référence vers R (A3.c, 9.10) : toute connaissance de R provient donc de O.
5. Si l'information va **vers** C, C la demande à O, qui seul peut la fournir : message adressé au Channel de O, traité par O (A3.e), dont le traitement rend l'information à C en réponse (9.11), sans exécuter d'opération exclusive (A3.g). C'est la voie **Query**. Si C est O, il n'a rien à demander.
6. Si l'information part **de** C sans avoir été demandée, elle passe par un message émis (A3.a), et porte sur une ressource dont C est propriétaire (A3.h) : C est O. Un composant qui veut relayer une information reçue d'un autre doit d'abord la conserver : il informe alors sur sa propre copie, qui est une autre ressource dont il est propriétaire. O la transmet depuis son propre Channel, seul Channel sur lequel il peut émettre (A3.e). C'est la voie **Event**.
7. **Unicité du traitement.** Command et Query sont traitées par le propriétaire du Channel (A3.e), qui est unique (A1.a). Que ce propriétaire organise son traitement en plusieurs fonctions ne compte pas (règle d'imputation, §2.5).
8. **Plusieurs destinataires.** Un Event est émis vers les propriétaires des abonnements au Channel de O (9.7). Recevoir n'est pas une opération exclusive (9.8) : plusieurs composants reçoivent sans devenir propriétaires. ∎

| | Vise un changement | Demande une connaissance | Informe |
| --- | --- | --- | --- |
| **C est O** | aucune interaction | impossible : O dispose d'une référence vers R | **Event** |
| **C n'est pas O** | **Command** | **Query** | impossible : seul O connaît R |

### T3 — Destruction en cascade

> La destruction d'un composant entraîne la destruction de toutes les ressources dont il est propriétaire.

**Démonstration.**

1. L'existence d'un composant C prend fin : soit son parent P la détruit, par une opération exclusive (7.1, A1.b), soit, si C est une racine, l'hôte y met fin (7.4).
2. À l'issue de l'opération, toute ressource restante du modèle a un propriétaire (A1.a, règle de lecture du §2.5).
3. Une ressource dont C était propriétaire ne peut pas recevoir un nouveau propriétaire (A2.c).
4. Elle ne peut donc pas subsister : sa fin fait partie de la destruction de C (règle de cascade, §2.5).
5. Parmi ces ressources figure l'existence des enfants de C ; leur fin entraîne celle de leurs propres ressources, et ainsi de suite. ∎

Pour une ressource de l'hôte admise, sa fin dans le modèle n'est pas un effacement par l'hôte : elle cesse d'être une ressource du modèle, et ce que l'hôte matérialise lui reste. Une racine qui l'admet à nouveau en fait une nouvelle ressource, dont le composant qui l'admet est le propriétaire initial (A2.a) ; ce qu'elle y trouve entre dans le modèle par un message dont la cause est une origine (A5.c). Le stockage, l'adresse ou l'historique survivent ainsi au rechargement de la page sans qu'aucune ressource du modèle survive à sa racine.

**Corollaires.**

- Détruire un composant détruit toute sa descendance.
- Les abonnements d'un composant détruit sont détruits avec lui : aucun message émis ne lui est plus délivré (G1).
- Une part dont C était propriétaire est détruite, non transférée ; la portion qu'elle occupait est rendue à la ressource distribuable dont elle avait été soustraite (6.5). Cette ressource a pour propriétaire le parent de C (A2.d), qui exécute la destruction : la restitution fait partie d'une opération de son propriétaire (A1.b).
- Une nouvelle attribution de la même portion produit une nouvelle part, qui est une autre ressource ; A2.c n'est pas en cause.

### T4 — Adressabilité

> Un composant propriétaire d'aucune identité n'est propriétaire d'aucun Channel : aucun message ne peut lui être adressé, et, hors ses messages locaux, il ne reçoit que des messages émis sur les Channels d'autres composants.

**Démonstration.**

1. Tout Channel est distingué par une identité dont son propriétaire est propriétaire (A3.b) : sans identité, aucun Channel.
2. Un message adressé l'est à un Channel (9.6) et n'est traité que par le propriétaire de ce Channel (A3.e, G1).
3. Tout message est adressé, émis ou local (A3.f) ; hors ses messages locaux (9.5), il ne reste donc à ce composant que la réception de messages émis par d'autres (9.8). ∎

Un tel composant peut néanmoins adresser des messages et recevoir les réponses à ceux-ci : une réponse n'est pas un message (9.11).

### T5 — Localité des invariants

> Un invariant métier qui lie plusieurs ressources porte sur des ressources d'un seul propriétaire.

Un invariant lie deux ressources lorsqu'un changement de l'une, permis par le code applicatif, n'est compatible avec l'invariant qu'accompagné d'un changement de l'autre.

**Démonstration.**

1. Soit un invariant liant une ressource R1 de propriétaire O1 et une ressource R2 de propriétaire O2, avec O1 distinct de O2 : la satisfaction de l'invariant dépend des valeurs conjointes de R1 et R2.
2. Un traitement est exécuté par un seul composant (9.3) et ne modifie que des ressources dont celui-ci est propriétaire (A1.b).
3. Il existe des changements de R1 qui exigent un changement correspondant de R2 pour maintenir l'invariant. Aucun traitement de O2 ne s'exécute au cours de celui de O1, hors traitements qui rendent une réponse et ne modifient rien (G5, A3.g) : à l'issue du traitement par O1 qui change R1, R2 n'a donc pas changé.
4. L'invariant est donc violé à l'issue de ce traitement, ce qu'interdit A4.a.
5. Donc O1 et O2 sont un même composant. ∎

Deux règles indépendantes posées sur deux ressources de propriétaires distincts ne sont pas concernées : elles ne lient rien.

### T6 — Survie du domaine

> Un composant du domaine propriétaire d'un Channel n'est détruit qu'avec la racine.

**Démonstration.**

1. Soit C un composant du domaine, propriétaire d'un Channel K. K est une ressource dont C est propriétaire.
2. Si C est détruit, toutes les ressources dont il est propriétaire prennent fin avec lui (T3), K compris.
3. Or K ne prend fin qu'avec la racine (A4.e).
4. C n'est donc pas détruit avant la fin de la racine ; à la fin de la racine, qui vient de l'hôte (7.4), il prend fin avec toute la descendance de celle-ci (T3). ∎

Toute Feature est propriétaire d'un Channel (16.3) : une Feature n'est détruite qu'avec la racine. Il en va de même d'un adaptateur de l'hôte qui appartient au domaine (D7). Aucune décision n'intervient dans cette démonstration.

### T7 — Disjonction des parts

> Deux parts existantes d'une même ressource distribuable ne se recouvrent pas.

**Démonstration.**

1. L'attribution soustrait de la ressource distribuable la portion qu'occupe la part attribuée (6.5, 6.6).
2. Une attribution ultérieure délimite sa part au sein de ce qui reste de cette ressource (6.3, 6.5) ; elle ne peut donc pas porter sur une portion déjà attribuée.
3. Une portion n'est rendue qu'à la fin de la part qui l'occupait (6.5) : tant que celle-ci existe, la portion reste soustraite. ∎

**Contre-exemple écarté :** deux Features reçoivent la même identité.

### T8 — Admission préalable

> Toute ressource de l'hôte que le modèle modifie a été admise, et a exactement un propriétaire.

**Démonstration.**

1. Pour modifier une ressource, un composant doit en être propriétaire (A1.b).
2. Une ressource de l'hôte n'a de propriétaire qu'après son admission, et le composant qui l'admet en est le propriétaire initial (A2.a).
3. Une fois admise, elle est une ressource du modèle et a exactement un propriétaire (A1.a). ∎

L'historique, l'adresse, le titre du document ou le stockage local ne peuvent donc être modifiés que par le composant qui les a admis.

## 15. Objectifs et décisions de conception

### 15.1 Objectifs

Un objectif est une qualité que Bonsai poursuit sans que les axiomes l'imposent. Il justifie des décisions ; il n'est pas une règle du modèle, et aucune démonstration ne s'y appuie (2.6). La liste est courte : elle ne s'allonge que si une décision ne peut se justifier ni par un de ces objectifs ni par une conséquence.

- **O1 — Rejouabilité.** Un code applicatif déterministe, rejoué depuis le même état initial sur la même suite de faits admis, produit les mêmes changements d'état. Bonsai n'ajoute aucun aléa (D8) ; les valeurs lues librement (18.15) ne se rejouent à l'identique que si l'implémentation les enregistre et les restitue, ce qui ne relève pas de la théorie.
- **O2 — Détection précoce des violations.** Une violation d'une règle du modèle est signalée au plus tôt : à la construction, à défaut par l'analyse statique, à défaut au démarrage, à défaut à l'exécution (18.7, §19).
- **O3 — Ergonomie de développement.** Une application conforme s'écrit sans code ni notion étrangers à son métier, au-delà de ce que les axiomes exigent.

Les autres qualités souvent invoquées sont des conséquences, non des objectifs :

| Qualité | Établie par |
| --- | --- |
| Traçabilité causale : tout changement d'état se rattache à une cause | A5.a, A5.b |
| Cohérence métier : les invariants sont satisfaits à l'issue de chaque traitement, et un invariant qui lie plusieurs ressources relève d'un seul propriétaire | A4.a, T5 |
| Continuité du domaine : le domaine ne prend fin qu'avec la racine | A4.e, T6 |
| Isolation des composants : on n'agit sur une ressource que par son propriétaire | A1, A3.c, G1 |

Le déterminisme n'est ni un axiome ni un objectif distinct : un code qui lit l'heure ou une valeur aléatoire reste conforme (18.15), et ce que Bonsai garantit de son côté est l'ordre de délivrance (D8), au service de O1.

### 15.2 Décisions

Une décision fixe un choix propre à Bonsai que les axiomes n'imposent pas. Elle ne rétrécit pas la théorie : un autre modèle conforme aux axiomes pourrait décider autrement. Elle donne sa justification, nomme l'alternative écartée et désigne ce qu'elle protège : un objectif (15.1), une conséquence, ou la clause d'axiome ou la définition qu'elle met en œuvre (2.6). Une règle qui découle des axiomes n'est pas une décision.

D3, D7, D10 et D15 nomment le document, son corps, l'adresse et l'historique : ces termes sont ceux de l'hôte navigateur (annexes A et B), que 3.2 ne présuppose pas. Pour un autre hôte, ces décisions portent sur ce qui en tient lieu.

- **D1 — Enfants de la racine.** Les Features et la Foundation sont des enfants de la racine. La racine ne détruit pas l'existence de la Foundation. *Pourquoi :* un domaine à plat, où aucune Feature n'est responsable de l'existence d'une autre, et une Foundation qui reste propriétaire du corps du document tant que la racine existe. *Alternative écartée :* des Features enfants d'autres composants ; A4.e le permettrait sous un parent qui ne les détruit jamais, mais leur existence dépendrait alors de la survie de ce parent. La survie des Features ne dépend pas de D1 (T6). *Protège :* A4.e, dont c'est la façon la plus simple de garantir le respect ; O3.
- **D2 — Pérennité de l'Entity.** Une Feature ne détruit pas son Entity. Réinitialiser une Entity est une modification, non une destruction. L'identité et le Channel d'une Feature, eux, ne prennent fin qu'avec elle par A2.d et A4.e. *Pourquoi :* détruire puis recréer une Entity revient à la modifier ; la détruire sans la recréer laisserait des invariants sans objet à l'issue du traitement. *Alternative écartée :* réinitialiser une Entity par destruction puis recréation. *Protège :* A4.a, A4.e.
- **D3 — Élément de la Foundation.** La Foundation admet un élément de l'hôte comme ressource distribuable, par défaut le corps du document. Elle n'admet rien d'autre de l'hôte. Deux racines n'admettent pas deux éléments dont l'un contient l'autre. *Pourquoi :* la Foundation relève de l'interface utilisateur, et une ressource relève de la même partie que son propriétaire (11.1) ; les autres sources du document relèvent de parties différentes et ont leur adaptateur (D7). Un élément autre que le corps permet à plusieurs racines de coexister sans se disputer l'affichage. *Alternative écartée :* une Foundation qui admettrait toutes les sources du document (en-tête, élément racine, fenêtre) ; une Foundation limitée au corps, qui exclurait plusieurs racines dans un même document. *Protège :* 11.1, D7, G6.
- **D4 — Une Feature, une Entity.** Une Feature est propriétaire d'exactement une Entity. *Pourquoi :* T5 exige seulement qu'un invariant qui lie plusieurs ressources relève d'un seul propriétaire ; une seule Entity donne à chaque Feature un état unique et lisible. *Alternative écartée :* une Feature propriétaire de plusieurs Entities. *Protège :* O3.
- **D5 — Retirée.** La règle qu'elle énonçait découle des axiomes : la racine attribue leur identité aux Features (16.1).
- **D6 — Interface non adressable.** Ni une View ni un Composer n'est propriétaire d'une identité. *Pourquoi :* une View ou un Composer est détruit par cascade à tout moment (T3) ; un Channel de l'un d'eux pourrait disparaître alors qu'un message lui est destiné, ce que A4.e évite pour le domaine. Toute coordination entre Views passe par le domaine, et l'interface reste une projection. *Alternative écartée :* des Views propriétaires d'une identité subordonnée, pour que des Views s'adressent des messages entre elles. *Protège :* A4.d, T3.
- **D7 — Adaptateurs de l'hôte.** Chaque source de faits ou de ressources de l'hôte située hors des éléments admis par les Foundations (D3) est admise par un seul composant, son adaptateur, enfant de la racine, hors les moyens d'appel des systèmes extérieurs, les minuteries et les rappels d'animation, admis par le composant qui les utilise ou les arme (B.6). Aucun autre composant n'admet cette source. *Pourquoi :* une seule frontière de confiance par source, et un seul message d'origine par fait spontané (A5.d). Un adaptateur reçoit une identité de la racine (D1, A2.d), ce qui lui permet d'être propriétaire d'un Channel et d'émettre les faits qu'il admet. Le document lui-même, hors de son corps (en-tête, élément racine, faits de l'utilisateur survenant au niveau du document), a son propre adaptateur, qui relève de l'interface utilisateur. Un adaptateur relève d'une seule partie (11.1) : les sources d'une même zone de l'hôte qui relèvent de parties différentes ont des adaptateurs distincts (annexe A). *Alternative écartée :* chaque composant qui a besoin d'une source l'admet lui-même ; un même fait produirait alors plusieurs origines. *Protège :* A5.c, A5.d, 11.7.
- **D8 — Ordre de délivrance.** Les messages en attente sont délivrés dans l'ordre où ils ont été produits. Un message émis est délivré aux propriétaires des abonnements dans l'ordre des abonnements ; ces délivrances prennent rang au moment de l'émission. *Pourquoi :* à code applicatif et faits admis identiques, la suite des traitements est la même, et c'est l'ordre que suit un développeur qui lit son code. *Alternative écartée :* un ordre non spécifié, ou une délivrance en profondeur d'abord, où un message produit au cours d'un traitement passerait avant les messages plus anciens. *Protège :* O1, O3.
- **D9 — Borne causale.** Toute suite de continuations dont chacune continue la précédente, depuis l'origine, compte au plus un nombre fixé de termes, le même pour toute la racine. Un message qui allongerait une telle suite au-delà de la borne n'est pas délivré, et l'infrastructure de communication le signale. Un message émis reçu par plusieurs composants ouvre des suites parallèles, et n'allonge chacune que d'un terme. Les continuations par faits provoqués comptent (A5.c). *Pourquoi :* une boucle entre composants n'est visible d'aucun d'eux ; sans borne, elle se prolonge sans fin, loin de sa cause. *Alternative écartée :* aucune borne, ou une détection des cycles, qui signalerait à tort des répétitions légitimes et laisserait passer une chaîne longue sans cycle. *Protège :* O2, A5.b. La valeur de la borne est fixée par le Manifest (16.9).
- **D10 — Admission par la cible.** Un fait de l'hôte qui survient dans une part est admis par le propriétaire de cette part. Un fait d'une source de niveau document déclarée, comme un raccourci global, est admis par l'adaptateur du document quelle que soit sa cible ; aucune View ne l'admet. *Pourquoi :* une View connaît sa part, mais un raccourci global n'appartient à aucune part ; la déclaration rend le partage connu dès le démarrage. *Alternative écartée :* l'admission par la cible seule, qui obligerait chaque View contenant un champ à relayer le raccourci ; l'admission par le premier composant qui réagit, qui dépendrait de l'exécution. *Protège :* A5.d, O2, O3.
- **D11 — Composition réservée.** Une View n'est enfant que d'un Composer ; la Foundation et les Views ne sont parents que de Composers. *Pourquoi :* séparer la décision de ce qui est affiché de son rendu (règle de méthode, §16). *Alternative écartée :* une View parente d'autres Views, qui décide elle-même de ce qu'elle monte. *Protège :* §16, O3.
- **D12 — Décideur pur.** Un Composer ne modifie son contenu que pour créer ou retirer les éléments des parts qu'il attribue. Il n'est propriétaire d'aucun état autre que le contenu de son slot et l'existence de ses Views, n'admet aucun fait de l'hôte et n'adresse aucune Command. *Pourquoi :* sa décision se recalcule entièrement à partir des messages qu'il reçoit et des réponses à ses Queries : elle reste une projection du domaine, et sa seule fonction est de composer. *Alternative écartée :* un Composer qui écrit dans le DOM, deux producteurs se partageant alors un même contenu ; un Composer doté de gestionnaires d'événements ou d'un état local. *Protège :* §16, A4.d, T7, O3.
- **D13 — Behavior aveugle.** Le code d'un Behavior ne désigne ni la View qui le déclare ni les clés de celle-ci, et ses clés ne recoupent pas les siennes. *Pourquoi :* un même Behavior doit pouvoir se greffer sur des Views sans rapport. *Alternative écartée :* un Behavior qui lit la View qui le déclare ; un Behavior composant, enfant de la View avec sa propre part, que T7, A5.d et A3.d excluent dès qu'il réagit à un fait sur un élément que la View utilise aussi. *Protège :* O3, O2.
- **D14 — Enfants de la racine déclarés.** Les enfants de la racine sont créés au démarrage, d'après le Manifest, et seulement ainsi. Le Manifest peut être composé de déclarations venues de plusieurs modules, chargés indépendamment, pourvu qu'elles soient réunies avant le démarrage. *Pourquoi :* tout ce qui détermine les Channels existe avant le premier message ; un message adressé à un Channel non déclaré est détecté au démarrage, non au moment où il est adressé. *Alternative écartée :* un enregistrement dynamique, ou des Features créées à la demande après le démarrage ; A4.e le permettrait, mais aucune vérification ne précéderait le premier message. Le chargement différé du code d'une Feature déclarée reste possible. *Protège :* O2, O3.
- **D15 — Navigation fournie.** Bonsai fournit une Feature de navigation, de namespace réservé `router`, activée par le Manifest (16.9). Son contrat est celui que projette l'adaptateur historique : la Command `router:navigate { location, mode }`, l'Event `router:routeChanged { route, mode }` et la Query `router:currentRoute`, où le mode est l'ajout d'une entrée, le remplacement de l'entrée courante ou le suivi d'un retour ou d'une avance (B.5). Une application peut ne pas l'activer et déclarer à la place la projection de sa propre Feature de navigation. La Feature de navigation n'est propriétaire que de l'état de navigation : l'adresse relève de l'adaptateur historique (18.2, D7), et un retour ou une avance se demande à celui-ci par une View (A4.b). *Pourquoi :* toute application à plusieurs pages en a besoin, et le contrat entre la Feature et l'adaptateur historique doit être le même partout. *Alternative écartée :* une Feature de navigation écrite par chaque application, sans contrat commun avec l'adaptateur ; une Feature de navigation qui modifierait elle-même l'adresse, ce que 11.1 et D7 excluent. *Protège :* O3, B.5.
- **D16 — Contrats déclarés.** Le code d'un composant déclare les Channels qu'il écoute et ceux auxquels il adresse des messages, les messages de son propre Channel, et les faits de l'hôte qu'il admet ; ce contrat est connu avant le démarrage, même pour un composant créé après celui-ci. Ses traitements sont dérivés de ce contrat : un traitement par message ou fait déclaré, et aucun autre. *Pourquoi :* tout ce qu'un composant peut recevoir et adresser est connu avant le premier message ; A3, A4.b et D10 deviennent vérifiables par construction, par analyse statique ou au démarrage (§19). *Alternative écartée :* des abonnements et des traitements enregistrés à l'exécution, invisibles avant le démarrage. *Protège :* O2, O3.
- **D17 — Chorégraphie du domaine.** Une Feature n'adresse aucune Command à une autre Feature. Les Features se coordonnent par les Events qu'elles émettent sur leurs propres ressources ; elles peuvent s'adresser des Queries, et adresser des Commands aux adaptateurs de l'hôte du domaine. *Pourquoi :* aucune Feature ne devient l'orchestratrice des autres ; chacune ne décide que de sa propre ressource, en réaction à ce qu'elle apprend, et le contexte causal rend le déroulement d'ensemble reconstituable (A5). *Alternative écartée :* des Commands entre Features (orchestration), qui laissent émerger une Feature coordinatrice et concentrent la logique de plusieurs processus. *Protège :* règle de méthode du §16, O3, A5.
- **D18 — L'interface relaie, elle n'enchaîne pas.** Un composant de l'interface utilisateur n'adresse de Command qu'en traitement d'un fait qu'il admet, intention de l'utilisateur ou fait de l'hôte, jamais en traitement d'un Event ou d'une réponse. *Pourquoi :* enchaîner une Command à un Event est une décision métier ; placée dans l'interface, elle échappe au domaine, cesse d'opérer sans interface (A4.a) et rouvre l'orchestration que D17 ferme. *Alternative écartée :* une View qui réagit à un Event par une Command. *Protège :* D17, A4.a.

## 16. Rôles dérivés

**Règle de méthode.** Un rôle dérivé porte une seule fonction architecturale ; deux rôles ne portent pas la même.

### 16.1 Application

Racine du domaine, propriétaire de l'espace des identités et parent des Features, de la Foundation (D1) et des adaptateurs de l'hôte (D7). Ses paramètres de création sont le Manifest (16.9), d'après lequel elle crée ses enfants au démarrage (D14).

Chaque Feature reçoit son identité de la racine : une identité est une part d'un espace des identités (8.2), un composant ne choisit pas la sienne (A2.a), et seul le parent d'un composant lui attribue des parts (A2.d). Il en va de même des adaptateurs de l'hôte (D7), enfants de la racine.

### 16.2 Entity

État du domaine dont le propriétaire est une Feature, avec les opérations exclusives qui le modifient.

L'Entity n'est pas un composant : elle n'a ni existence propre, ni identité, ni Channel. Ce qu'elle exécute est exécuté par sa Feature (règle d'imputation, §2.5). Les invariants métier qui la concernent sont définis par le code applicatif et satisfaits à l'issue de chaque traitement (A4.a).

### 16.3 Feature

Composant du domaine, enfant de la racine, propriétaire d'une identité attribuée par celle-ci, du Channel distingué par cette identité et d'une Entity, qui traite les messages adressés à ce Channel et y émet.

Bonsai en fournit une, la Feature de navigation, de namespace réservé `router` (D15). Une Feature n'adresse aucune Command à une autre Feature (D17).

Conséquences : une Feature n'émet que sur son propre Channel (A3.e, T2) ; elle survit à tout changement de l'interface utilisateur et de l'hôte (T6) ; un fait asynchrone qu'elle admet lui revient par un message local (9.3, 9.5, A3.f).

### 16.4 Foundation

Composant de l'interface utilisateur, enfant de la racine (D1), qui admet un élément de l'hôte, par défaut le corps du document (D3), et en attribue des parts à ses enfants, qui sont des Composers (D11). Elle n'admet rien d'autre de l'hôte : l'en-tête et les faits de niveau document relèvent de l'adaptateur du document (D7).

### 16.5 View

Composant de l'interface utilisateur, enfant d'un Composer (D11), propriétaire d'une part du DOM attribuée par celui-ci, sans identité (D6), qui admet les faits de l'hôte survenant dans cette part, hors ceux d'une source de niveau document déclarée (D10), et adresse des messages aux Channels du domaine et à ceux des adaptateurs de l'interface utilisateur.

Un **slot** est un élément de la part d'une View, ou de l'élément admis par la Foundation, dont le contenu est attribué à un Composer (16.6).

Conséquences :

- elle n'est pas adressable et n'émet aucun message (D6, T4) ; elle reçoit ce que les Features émettent et les réponses à ses Queries (9.11) ;
- son parent lui transmet, à sa création, une représentation de l'identité de sa part, jamais un élément de l'hôte (A3.d, 6.2) ;
- elle établit sa référence structurelle en résolvant cette représentation auprès de l'hôte (9.10) ;
- sa part ne recouvre aucune autre part existante (T7) ; le contenu des slots qu'elle attribue à ses Composers lui est soustrait (6.5), et elle conserve l'élément de chaque slot ;
- elle ne détruit jamais son élément racine (A2.d) ; elle peut en modifier les attributs et dispose de tout ce qu'il contient, hors le contenu de ses slots ;
- retirer l'élément d'un slot mettrait fin au contenu attribué sans que son propriétaire prenne fin (A2.d) : la View détruit d'abord le Composer concerné, ce qui lui rend ce contenu (T3) ;
- elle peut être propriétaire d'un état local, modifié uniquement en traitement de ses messages locaux (A5.a, 9.5). Cet état est confiné : aucun autre composant ne le modifie (A1.b) ni ne le lit (A3.c), aucun ne peut le lui demander (T4), elle ne le diffuse pas (A3.e), et il est détruit avec elle (T3). Elle peut en transmettre une valeur, figée, dans une Command ;
- l'information métier qu'elle affiche provient du domaine et n'est remplacée qu'en traitement d'un message issu de celui-ci (A4.d) ;
- elle n'adresse de Command qu'en traitement d'un fait qu'elle admet, jamais en réaction à un Event ou à une réponse (D18).

### 16.6 Composer

Composant de l'interface utilisateur, enfant de la Foundation ou d'une View, propriétaire du contenu d'un slot que son parent lui attribue, et parent des Views qui en occupent des parts (D11).

Conséquences :

- il n'est propriétaire d'aucune identité (D6) : il n'est pas adressable et n'émet aucun message (T4) ; il reçoit des messages émis et adresse des Queries, dont il reçoit les réponses (T2, 9.11) ;
- à sa création, puis à chaque message qu'il traite, il décide quelles Views occupent des parts de son contenu ; il crée ou détruit leur existence, dont il est propriétaire (7.2, A1.b) ;
- les parts qu'il attribue ne se recouvrent pas (T7) ; détruire une View lui rend sa part (A2.d, T3) ;
- une View qu'il crée reçoit une représentation de l'identité de sa part, jamais un élément de l'hôte (A3.d, 6.2) ;
- il ne lit de son contenu que la portion qui n'est pas attribuée à ses Views (6.5, A3.c) ;
- son slot ne disparaît pas tant qu'il existe : pour en retirer l'élément, son parent le détruit d'abord (16.5, A2.d) ;
- il est détruit avec son parent, et ses Views avec lui (T3) ;
- il ne modifie son contenu que pour attribuer des parts, n'est propriétaire d'aucun état autre que le contenu de son slot et l'existence de ses Views, n'admet aucun fait de l'hôte et n'adresse aucune Command (D12).

### 16.7 Behavior

Partie réutilisable du code d'une View. Un Behavior n'est pas un composant : ce qu'il exécute est exécuté par la View qui le déclare (règle d'imputation, §2.5). Les clés qu'il déclare désignent des éléments de la part de cette View, les messages qu'il produit sont adressés par cette View, et son état local fait partie de l'état local de celle-ci.

Conséquences :

- un fait survenant dans la part est admis une fois, par la View, même lorsque la View et ses Behaviors y réagissent tous (A5.d, D10) ; les messages produits en réaction partagent la même origine ;
- les réactions de la View et de ses Behaviors à un même fait s'exécutent dans un ordre fixe, celui de leur déclaration ; les messages qu'elles produisent sont délivrés dans cet ordre (D8) ;
- il n'a ni existence propre, ni identité, ni part ; il prend fin avec sa View (T3) ;
- il ne produit rien ni hors de la part de sa View, ni dans le contenu de ses slots (16.5) : un contenu affiché au-dessus du reste de la page relève d'un Composer, et un fait de niveau document, comme le focus qui sort de la part, relève d'un adaptateur (D7, D10) ;
- son code ne désigne ni la View qui le déclare ni les clés de celle-ci (D13).

**Contre-exemples :** un Behavior insère une infobulle dans le corps du document, hors de la part de sa View ; un Behavior écoute le défilement de la fenêtre au lieu de recevoir les Events de l'adaptateur qui l'admet.

### 16.8 Adaptateur de l'hôte

Composant enfant de la racine (D7), propriétaire d'une identité attribuée par celle-ci (16.1) et du Channel qu'elle distingue, seul à admettre une ou plusieurs sources de l'hôte situées hors des éléments admis par les Foundations (D3). Les catégories d'adaptateurs, leur partie et leurs règles communes forment le catalogue de l'annexe B.

Conséquences :

- il relève d'une seule partie, celle des ressources qu'il admet (11.1, 18.14) ;
- il est seul à admettre ses sources (D7, A5.d), et propriétaire initial des ressources qu'il admet (A2.a) ;
- il émet sur son Channel les faits qu'il admet et ce qu'il sait de ses ressources (A3.e, A3.h) ; les autres composants lui adressent des Commands et des Queries, sous la réserve de A4.b ;
- un composant du domaine n'adresse rien à un adaptateur de l'interface utilisateur et ne reçoit rien de lui (A4.b) : un adaptateur de l'interface reçoit les Events du domaine et en tient ses ressources pour projection (A4.d), comme le titre ou l'adresse ;
- à l'admission d'un fait, il peut adresser une Command déclarée, y compris au domaine : un adaptateur de l'interface informe ainsi le domaine sans que celui-ci reçoive ses Events (A4.b) ;
- une ressource qu'il tient en projection n'est modifiée que si la valeur projetée diffère de sa valeur courante (annexe B.5) ;
- il conserve le contexte causal des faits qu'il provoque jusqu'à leur admission (A5.c) ;
- il ne transmet aucune référence vers une ressource de l'hôte (A3.c, A3.d).

### 16.9 Manifest

Paramètres de création de la racine (6.2) : la description de ses enfants et de ce qui leur est attribué au démarrage. Il peut réunir des déclarations issues de modules distincts, chargés indépendamment, pourvu qu'elles le soient avant la création de la racine (D14).

Il contient : les namespaces des Features et des adaptateurs, représentations des identités que la racine leur attribue (8.4, 16.1) ; la classe de chacun et celle de la Foundation ; les adaptateurs activés et leurs périmètres, donnés par des valeurs littérales (annexe B) ; l'élément de la Foundation (D3) ; les sources de niveau document déclarées (D10) ; la borne causale (D9) ; l'activation de la Feature de navigation (D15).

Conséquences :

- il ne contient aucune référence (A3.d) : il désigne des classes, et le code applicatif n'est pas une référence (9.9) ;
- la racine le lit à sa création ; il ne change pas pendant la vie de la racine (D14) ;
- tout ce qu'il déclare est connu avant le premier message : l'unicité et la forme des namespaces, les namespaces désignés par les messages, le caractère disjoint des périmètres (B.2) sont vérifiables avant le démarrage, à la compilation lorsque le Manifest est écrit d'un seul tenant, au démarrage lorsqu'il est assemblé à partir de modules (O2). L'unicité par hôte des adaptateurs (B.2), qui oppose les Manifests de racines distinctes, n'est vérifiable qu'au démarrage de la seconde racine ;
- chaque racine a son Manifest (G6).

**Contre-exemples :** un Manifest transmet l'élément du corps du document au lieu d'un sélecteur (A3.d) ; une Feature `chat` est créée au premier clic sur « Aide », et `chat:open` ne vise aucun Channel avant ce clic (D14).

## 17. Chaîne de non-circularité

Une définition n'emploie aucun terme situé après elle. L'ordre de lecture du document suit exactement la chaîne.

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
28. Channel
29. abonnement
30. traitement
31. transport
32. message local
33. adresser
34. émettre
35. recevoir
36. référence
37. référence structurelle
38. réponse
39. cause
40. origine
41. continuation
42. chaîne causale
43. contexte causal
44. interaction fonctionnelle
45. interface utilisateur
46. domaine
47. invariant métier
48. cohérence métier
49. information métier
50. admission
51. frontière de confiance

## 18. Questions ouvertes

Les numéros des questions sont stables : une question tranchée garde son numéro et passe en 18.B, avec la réponse, l'endroit de la théorie qui la porte et la version qui l'a tranchée. Aucune question n'est à la fois ouverte et tranchée.

### 18.A Questions ouvertes

Aucune question n'est ouverte. Les constats de l'audit de cohérence qui attendent un arbitrage sont recensés dans `docs/rapports/audit-coherence-V0.9.2.md` (§10).

### 18.B Questions tranchées

| # | Question | Réponse | Portée par | Tranchée en |
| --- | --- | --- | --- | --- |
| 18.1 | Périmètre causal | Le périmètre observé est le modèle, étendu aux faits extérieurs qu'il a provoqués. La longueur d'une suite de continuations qui traverse plusieurs faits provoqués est bornée par D9. | 10.2, A5.c | V0.6 |
| 18.2 | Navigation et adresse | L'adresse est perçue et modifiée par l'utilisateur : elle relève de l'interface utilisateur. Que l'état de navigation soit une information métier relève de chaque application ; s'il l'est, il vit dans une Feature et l'adresse en est une projection. | 11.1, A4.d | V0.6 |
| 18.3 | Stockage et survie à la racine | Le stockage n'est une ressource du modèle qu'une fois admis ; il prend fin avec son propriétaire. Sa matérialisation survit hors du modèle ; une nouvelle racine l'admet à nouveau, comme une origine. | A2.a, T3 (remarque), A5.c | V0.6 |
| 18.4 | Frontière de confiance | Une seule notion : la frontière est formée de tous les points d'admission, et ce qui la franchit est validé par son traitement (A4.a). Les distinctions entre hôte et système extérieur tiennent à qui admet, et sont portées par A4.c, D3, D7 et 16.5. | 11.7 (remarque) | V0.8 |
| 18.5 | Racines multiples | Plusieurs racines peuvent coexister dans un même hôte. Chacune forme un modèle distinct ; l'infrastructure de communication ne transmet aucun message d'une racine à une autre (G6), et chacune perçoit les changements que l'autre provoque dans l'hôte comme des faits spontanés. La Foundation de chaque racine admet un élément distinct (D3). | G6, §12, D3 | V0.8 |
| 18.6 | Délégation | La délégation est exclue : seul le propriétaire exécute une opération exclusive. Elle serait réexaminée si la dérivation d'un rôle rencontrait un cas que l'attribution, les messages et les paramètres de création ne couvrent pas. | A1.b | V0.6 |
| 18.7 | Garantie au plus tôt et gardes | Le principe relève de la théorie à deux titres : comme règle de méthode, qui impose à toute règle contraignant le code applicatif une garde au niveau le plus précoce possible (§19), et comme décision, les contrats déclarés (D16). O2 en est le but. | §19, D16, O2 | V0.9.1 |
| 18.8 | Déterminisme | Le déterminisme n'est pas un axiome : un code qui lit librement l'heure ou une valeur aléatoire reste conforme (18.15). L'infrastructure de communication n'ajoute aucun aléa : les messages sont délivrés dans l'ordre de leur production (D8). La rejouabilité est un objectif (O1) ; restituer les valeurs lues librement relève de l'implémentation. | D8, O1, 18.15 | V0.8 |
| 18.9 | Cohésion et borne causale | La longueur des suites de continuations d'une chaîne causale est bornée par décision (D9), au service de la détection précoce (O2). « Une responsabilité, un rôle » (P10) est une règle de méthode pour la dérivation des rôles, non un axiome ni une décision. | D9, §16 | V0.8 |
| 18.10 | Objectifs | Les objectifs forment une catégorie distincte de la décision et de la conséquence : une qualité que les axiomes établissent est une conséquence. La liste est courte : rejouabilité (O1), détection précoce (O2) et ergonomie de développement (O3). | 2.6, 15.1 | V0.8 |
| 18.11 | Rattachement au registre | Chaque principe `P<n>` et chaque invariant `I<n>` reçoit un statut et l'élément de la théorie qui le fonde. Le report dans `docs/invariants/` relève de l'alignement du dépôt. | `docs/rapports/registre-V0.9.2.md` | V0.9.2 |
| 18.12 | Admission d'un fait dont la cible est dans une part | Un fait n'est admis qu'une fois (A5.d). Il l'est par le propriétaire de la part où il survient, sauf s'il relève d'une source de niveau document déclarée, admise par l'adaptateur du document (D10). | A5.d, D10 | V0.8 |
| 18.13 | Adresser son propre Channel | Permis, sans conséquence propre pour le modèle : un message adressé à son propre Channel est mis en file comme tout message (G5) et traité après le traitement en cours. Un propriétaire exécute ses opérations lui-même (A1.b) et lit ses ressources sans rien demander (T2). Le message local (9.5) reste le moyen prévu pour se transmettre un fait provoqué. | G5, A1.b, T2 | V0.7 |
| 18.14 | Adaptateurs mixtes | Un adaptateur relève d'une seule partie (11.1) : les adaptateurs dont les sources relevaient des deux parties sont scindés. L'adaptateur du document (interface) garde l'en-tête, l'élément racine, le plein écran et les faits de l'utilisateur de niveau document ; la visibilité et le focus de la fenêtre passent à l'adaptateur du cycle de vie (domaine), les cookies à l'adaptateur de stockage (domaine) ; le défilement de la fenêtre quitte l'adaptateur Viewport (domaine) pour un adaptateur du défilement (interface). | D7, 11.1, annexe A | V0.9 |
| 18.15 | Lecture d'une information de l'hôte | Lire une ressource de l'hôte, dont l'état persiste et ne change que par des faits, exige d'en être propriétaire, donc de l'avoir admise. Lire une valeur que l'hôte produit à chaque lecture, comme l'heure ou une valeur aléatoire, n'est pas une admission. | 3.2 (note), 9.9, A3.c | V0.7 |

## 19. Gardes

Une garde vérifie qu'une règle de la théorie est respectée par le code applicatif. Elle n'est pas une notion du modèle : elle relève de l'implémentation de Bonsai, et n'est jamais la source d'une règle.

**Règle de méthode.** Toute règle qui contraint le code applicatif, clause d'axiome ou décision, est protégée par une garde, au niveau le plus précoce que son énoncé permet. Une garde placée à un niveau plus tardif nomme ce qui empêche le niveau précédent.

| Niveau | La violation… |
| --- | --- |
| Construction | ne peut pas s'écrire : l'interface de programmation ne l'offre pas |
| Statique | s'écrit, mais l'analyse du code avant exécution la refuse |
| Démarrage | est refusée avant le premier message |
| Exécution | est détectée lorsqu'elle survient, et signalée avec son contexte causal |

Les contrats déclarés (D16) et le Manifest (16.9, D14) rendent connus avant le premier message tout ce qu'un composant peut recevoir et adresser, et tous les composants qui existent : ils portent l'essentiel des gardes statiques et de démarrage. L'objectif qu'elles servent est O2.

La table de conformité (`docs/gardes.md`) associe chaque obligation que la théorie impose au code applicatif à sa garde et à au moins un test, ou justifie l'absence de garde. Deux obligations n'en admettent pas : A3.h, dont l'origine de l'information émise n'est pas observable, et A4.d en partie, dont la provenance d'une valeur affichée ne l'est pas. Les garanties (§13) et D8 engagent l'implémentation de Bonsai : elles reçoivent des tests de conformité, non des gardes.

## Annexe A — Inventaire des sources de l'hôte navigateur

*Annexe non normative.* Elle inventorie, pour un hôte navigateur, les sources de faits et de ressources situées hors des éléments admis par les Foundations (D3). Le catalogue des adaptateurs qui en découle forme l'annexe B, normative (D7, 16.8). Les règles qui découlent de la théorie ne sont pas énoncées ici : l'annexe renvoie aux clauses qui les portent.

La colonne « Partie » applique 11.1 à chaque source : une source relève de l'interface utilisateur lorsque l'utilisateur perçoit le modèle ou agit sur lui à travers elle ; sinon, du domaine. Une ressource relevant de la même partie que son propriétaire, chaque adaptateur relève d'une seule partie, et les sources sont groupées en conséquence (18.14, tranchée). La colonne « Modifiable » indique si le modèle peut exécuter une opération exclusive sur la ressource une fois admise (T8).

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

### A.6 Cycle de vie de la page — adaptateur du cycle de vie (domaine)

| Source | Faits observés | Modifiable | Partie |
| --- | --- | --- | --- |
| Visibilité de l'onglet | masqué, visible | non | domaine |
| Focus de la fenêtre | gain, perte | non | domaine |
| Cycle de vie de la page | arrière-plan, gel, reprise, retour depuis le cache | non | domaine |
| Fermeture imminente | fin annoncée | non | domaine |

La fermeture imminente précède la fin de la racine (7.4). L'admettre permet au domaine de conserver son état avant que l'hôte n'y mette fin.

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

Géolocalisation, presse-papiers, notifications, caméra et microphone, verrouillage de l'écran, vibration. Chacune relève d'un adaptateur distinct ; la réponse à une demande d'autorisation est un fait provoqué (A5.c). Seul le presse-papiers, qui relève de l'interface utilisateur, figure au catalogue V1 ; les autres capacités sont reportées (annexe B).

### A.10 Hors de l'hôte et cas limites

| Source | Classement |
| --- | --- |
| Requêtes réseau, connexions persistantes, flux d'événements serveur | systèmes extérieurs (3.4) |
| Messages entre onglets ou cadres | hors catalogue V1 : non conforme (B.1) ; l'interlocuteur est souvent une autre racine (G6, 18.5) |
| Horloge et générateur aléatoire | valeurs lues librement, sans admission (18.15, tranchée) ; rejeu : 18.8 |
| Minuteries, rappels d'animation | pas d'adaptateur (A5, remarque sur les faits provoqués) |

## Annexe B — Catalogue des adaptateurs de l'hôte navigateur

*Annexe normative.* Elle précise D7 pour l'hôte navigateur, sans créer de décision. Les fiches détaillées de chaque catégorie (`docs/adaptateurs/`) en développent les messages, les gardes et les tests ; en cas d'écart, la présente annexe fait autorité.

### B.1 Finitude

Les catégories d'adaptateurs de l'hôte navigateur forment une liste fermée (B.3). Une application en active un sous-ensemble, par déclaration (16.9) ; un adaptateur non déclaré n'est pas créé et n'admet rien. Spécialiser un adaptateur ne crée pas de catégorie ; une catégorie nouvelle demande une évolution de Bonsai.

Une source de l'hôte située hors des éléments admis par les Foundations (D3), absente du catalogue et que B.6 n'attribue à aucun autre composant, n'est admise par aucun composant conforme (D7). Un code applicatif qui l'observe directement n'est pas conforme ; la non-conformité est signalée autant que possible (O2), faute de pouvoir être empêchée par construction.

### B.2 Nature commune

Tout adaptateur satisfait 16.8. En outre :

- la racine ne détruit pas un adaptateur : il prend fin avec elle ;
- dans une racine, une source déterminée n'est admise que par une seule instance d'adaptateur (A5.d, D7) ; une catégorie à plusieurs instances leur attribue des périmètres disjoints, déclarés et vérifiés au démarrage ;
- une catégorie marquée « une par hôte » n'est activée que par une seule des racines qui coexistent dans un même hôte (G6) : deux racines qui pilotent la même ressource de l'hôte se contrediraient.

### B.3 Catégories V1

| Catégorie | Partie | Instances | Sources (annexe A) |
| --- | --- | --- | --- |
| Document | interface utilisateur | une par hôte | A.1 |
| Viewport | domaine | une par racine | A.2 |
| Défilement | interface utilisateur | une par racine | A.3 |
| Historique | interface utilisateur | une par hôte | A.4 |
| Stockage local | domaine | plusieurs, par préfixe de clé | A.5 |
| Stockage de session | domaine | plusieurs, par préfixe de clé | A.5 |
| Base de données indexée | domaine | plusieurs, par nom de base | A.5 |
| Cache | domaine | plusieurs, par nom de cache | A.5 |
| Cookies | domaine | plusieurs, par nom de cookie | A.5 |
| Cycle de vie | domaine | une par racine | A.6 |
| Connectivité | domaine | une par racine | A.7 |
| Environnement | domaine | une par racine | A.8 |
| Presse-papiers | interface utilisateur | une par racine | A.9 |

Les autres capacités soumises à autorisation (géolocalisation, notifications, caméra, microphone, verrouillage de l'écran, vibration) sont reportées après la V1 : une application qui les utilise n'est pas conforme à la V1.

### B.4 Opérations réservées et points d'extension

Les opérations suivantes sont réalisées par Bonsai et ne sont pas surchargeables par le code applicatif : l'identité et le Channel ; la connexion à la source ; l'admission ; la création du contexte causal d'une origine et la restitution de celui d'un fait provoqué (A5.c) ; le transport (G2) ; l'enregistrement et le retrait des observateurs de l'hôte ; le contrôle d'unicité du périmètre ; la destruction.

Une spécialisation n'intervient que sur des valeurs déjà admises et détachées de toute ressource de l'hôte : filtrer, normaliser, sélectionner l'information émise, associer une valeur à un message déclaré (un Event émis sur son Channel, ou une Command adressée à un Channel déclaré, sous la réserve de A4.b), regrouper des notifications selon une politique déclarée. Elle ne produit ni ne remplace un contexte causal, n'observe aucune autre source, n'émet sur aucun autre Channel et ne transmet aucune référence.

**Contre-exemples :** une sous-classe de l'adaptateur Viewport ajoute son propre écouteur de défilement (autre source, autre catégorie) ; une sous-classe de l'adaptateur historique émet un Event avec un contexte causal qu'elle a construit (A5.c, A5.b) ; une sous-classe de l'adaptateur de stockage local transmet l'objet de stockage de l'hôte dans un message (A3.d).

### B.5 Projection

Un adaptateur de l'interface utilisateur qui tient une ressource en projection d'une information du domaine (A4.d) ne la modifie que si la valeur projetée diffère de sa valeur courante. Une projection ne produit donc aucun fait lorsque la ressource reflète déjà le domaine, ce qui exclut qu'un fait admis, projeté en retour, en produise un autre.

La manière de modifier la ressource, lorsqu'elle doit l'être, est portée par l'information du domaine elle-même, non par le contexte causal du message reçu, qui ne fait pas partie de l'information transmise (10.6). Pour l'historique, l'Event de navigation porte son mode : ajouter une entrée, remplacer l'entrée courante, ou suivre un retour ou une avance, auquel cas une adresse différente de l'adresse courante, issue d'une redirection, remplace l'entrée.

**Contre-exemple :** au retour sur une adresse, l'adaptateur historique reçoit le changement de route qui en résulte et ajoute une entrée identique à l'adresse courante ; ou, après une redirection, il ajoute une entrée au lieu de remplacer la précédente, et le retour suivant ramène à l'adresse redirigée.

### B.6 Hors catalogue

| Source | Admise par |
| --- | --- |
| Élément de la Foundation, par défaut le corps du document | la Foundation (D3) |
| Faits survenant dans une part | la View propriétaire de la part, ou l'adaptateur du document pour une source déclarée (D10) |
| Systèmes extérieurs et leurs moyens d'appel | le composant du domaine qui les utilise (A4.c, 11.7) |
| Minuteries, rappels d'animation | le composant qui les a armés (A5.c) |
| Heure courante, valeurs aléatoires | aucune admission : lecture libre (18.15) |
