# Bonsai — Vocabulaire fondamental V0.5

Oct 8, 2026 · @ncac

**Version : V0.5 — ébauche de travail.**

## 1. Objet

Le vocabulaire fondamental fixe le sens des termes employés par les axiomes de Bonsai. La théorie se construit dans l'ordre suivant :

1. termes primitifs ;
2. définitions ;
3. axiomes, qui contraignent le modèle ;
4. garanties, qui contraignent le médiateur ;
5. conséquences établies, démontrées à partir des précédents ;
6. décisions de conception, propres à Bonsai sans être imposées par les axiomes ;
7. rôles dérivés ;
8. gardes.

Les rôles (`Application`, `Feature`, `Entity`, `Foundation`, `Composer`, `View`, `Behavior`, `Manifest`) ne font pas partie du vocabulaire fondamental. Un rôle dérivé n'est pas nécessairement un composant. `Command`, `Request` et `Event` sont les trois voies établies par T2.

## 2. Règles de définition

### 2.1 Termes primitifs

Un terme primitif n'est pas défini à partir d'autres termes de la théorie. Son sens résulte de son usage dans les définitions et les axiomes, des configurations qui les satisfont et des contre-exemples qui les violent. Son explication intuitive ne peut pas servir de prémisse dans une démonstration.

### 2.2 Termes définis

Chaque définition exprime une seule notion ; n'emploie ni le terme défini ni un synonyme ; n'utilise que des termes primitifs, des termes antérieurs dans la chaîne du §17 et le métalangage ; ne dépend d'aucun rôle dérivé ; ne comporte aucun exemple ; ne prescrit aucun mécanisme d'implémentation.

### 2.3 Métalangage admis

Sont admis sans définition : action, changer, commencer, contenir, continuer, délivrer, destinataire, détruire, distinguer, ensemble, exécuter, exécution, fait, information, limite, modifier, opération, partie, produire, règle, relation, suite, transmettre, utiliser, utilisateur.

« Exécution » désigne uniquement l'exécution d'une opération ; la marche du modèle dans le temps est désignée par « vie du modèle ». « Produire » et « transmettre » décrivent un acte matériel ; un énoncé normatif ne les emploie jamais seuls pour désigner qui traite ou qui reçoit un message.

Un mot entre dans le vocabulaire lorsqu'il reçoit un sens propre à Bonsai, modifie la portée d'un axiome, peut recevoir deux sens architecturaux différents, ou intervient dans plusieurs définitions comme notion technique autonome.

### 2.4 Unicité lexicale

Une notion possède un seul terme canonique ; les synonymes sont exclus des énoncés normatifs. Choix retenus :

- `propriétaire` ; « posséder » et « détenir » sont proscrits ;
- `médiateur`, et non `framework` ; « Bonsai » désigne la théorie et le logiciel dans leur ensemble ;
- `interface utilisateur`, et non `couche concrète` ;
- `Channel`, et non `canal` ;
- `namespace`, uniquement pour une représentation textuelle d'identité ;
- `adresser`, `émettre`, `recevoir` et `traiter` désignent quatre actes distincts (§9) ;
- `création`, `attribution` : deux actes distincts ; il n'existe aucun transfert de propriété.

« Modèle » désigne uniquement l'univers organisé par Bonsai (3.8). « Contre-exemple » désigne une configuration qui viole un axiome.

### 2.5 Définition, axiome et lecture des axiomes

Une définition dit **ce qu'est** une notion. Un axiome dit **ce qui est permis, interdit ou obligatoire** ; chacune de ses clauses doit pouvoir être fausse dans un contre-exemple concevable, qui l'accompagne.

**Règle de lecture.** Les axiomes sont satisfaits à l'issue de chaque opération. Les états intermédiaires au cours d'une opération n'y sont pas soumis.

## 3. Termes primitifs

### 3.1 Composant

**Terme primitif.** Explication intuitive : unité active ou structurelle susceptible de participer au modèle. Le terme ne présuppose ni rôle, ni classe TypeScript, ni représentation visuelle, ni autonomie, ni position dans une structure.

### 3.2 Ressource

**Terme primitif.** Explication intuitive : ce dont un composant peut être propriétaire. Principe de travail, non normatif : une catégorie n'est traitée comme ressource que si l'on peut nommer ses opérations exclusives.

### 3.3 Message

**Terme primitif.** Explication intuitive : ce qui est transmis au cours d'une interaction fonctionnelle. Le terme ne présuppose ni émetteur ou destinataire déterminé, ni catégorie, ni traitement synchrone, ni transport réseau.

### 3.4 Hôte

**Terme primitif de frontière.** Explication intuitive : ce qui fournit au modèle ses conditions initiales d'existence sans appartenir lui-même au modèle. Le terme ne présuppose ni navigateur, ni document, ni plateforme particulière.

### 3.5 Médiateur

**Terme primitif de frontière.** Explication intuitive : ce qui transporte les messages entre les composants sans appartenir lui-même au modèle. Le médiateur n'est soumis à aucun axiome ; il est tenu par ses garanties (§13).

### 3.6 Système extérieur

**Terme primitif de frontière.** Explication intuitive : ce avec quoi le modèle échange des informations sans appartenir lui-même au modèle, sans lui fournir ses conditions initiales d'existence et sans transporter ses messages. Le terme ne présuppose ni réseau, ni protocole, ni persistance.

Un système extérieur est distinct de l'hôte, qui fournit au modèle ses conditions initiales d'existence, et du médiateur, qui transporte ses messages.

### 3.7 Propriété

**Terme primitif.** Relation entre un composant et une ressource. Explication intuitive : ce qui rattache une ressource au composant qui en répond.

Son sens est fixé par les axiomes : A1 la rend unique et réserve à elle seule l'exécution des opérations exclusives ; A2 en fixe l'origine et l'immuabilité.

### 3.8 Modèle

**Terme primitif de frontière.** Explication intuitive : ce que Bonsai organise et dont parlent les axiomes. Le modèle, l'hôte, le médiateur et les systèmes extérieurs forment une partition : tout ce qui intervient relève de l'un des quatre.

Le modèle contient des composants, des ressources et des messages.

**Disjonction des catégories.** Composants, ressources et messages sont trois catégories disjointes : aucun composant n'est une ressource, aucune ressource n'est un message, aucun message n'est un composant. Ce dont un parent est propriétaire n'est pas son enfant, mais l'existence de celui-ci (7.1).

**Prémisse de lecture.** Ce qu'un composant offre à un autre de changer ou de connaître est son existence ou une ressource dont il est propriétaire. Un composant n'a, dans le modèle, rien d'interrogeable ou de modifiable qui ne soit une ressource.

## 4. Cadre

### 4.1 Périmètre

Ensemble déterminé de composants, de ressources et de messages considéré pour l'application d'une définition ou d'une règle.

**Dépendances :** composant, ressource, message.

### 4.2 État

Ressource susceptible de changer au cours de la vie du modèle.

**Dépendances :** ressource.

## 5. Autorité

### 5.1 Opération exclusive

Opération qui modifie ou détruit une ressource.

**Dépendances :** ressource.

La lecture d'une ressource n'est pas une opération exclusive. La création non plus : au moment où une ressource commence d'exister, elle n'a encore aucun propriétaire.

### 5.2 Propriétaire

Composant en relation de propriété avec une ressource.

**Dépendances :** composant, ressource, propriété.

L'unicité du propriétaire est imposée par A1.a.

## 6. Création et distribution

### 6.1 Création

Action par laquelle une ressource commence d'exister.

**Dépendances :** ressource.

Créer un composant consiste à créer son existence (7.1).

### 6.2 Paramètres de création

Information transmise par le composant qui crée une ressource, au cours de cette création.

**Dépendances :** composant, ressource, création.

Les paramètres sont transmis pendant la création, jamais après : la création d'un composant et la transmission de ses paramètres forment un seul acte. Le composant créé n'existant pas encore au moment de la transmission, celle-ci ne relève d'aucune interaction.

### 6.3 Part

Ressource délimitée au sein d'une ressource.

**Dépendances :** ressource.

Une part est elle-même une ressource ; d'autres parts peuvent à leur tour être délimitées en son sein.

### 6.4 Ressource distribuable

Ressource dont les parts peuvent avoir des propriétaires distincts.

**Dépendances :** ressource, part, propriétaire.

### 6.5 Attribution

Action par laquelle le propriétaire d'une ressource distribuable crée une part de celle-ci et en désigne le propriétaire.

**Dépendances :** propriétaire, ressource distribuable, création, part.

L'attribution crée une part ; elle ne modifie pas la ressource distribuable et n'est donc pas une opération exclusive. Sa réserve au propriétaire de la ressource distribuable découle d'A2.a. La définition de la création (6.1) s'applique à la part ; l'exception d'A2.a en désigne directement le propriétaire initial.

## 7. Structure

### 7.1 Existence

Ressource associée à un composant déterminé, dont la destruction entraîne celle de ce composant.

**Dépendances :** ressource, composant.

La destruction est la seule opération exclusive portant sur l'existence.

### 7.2 Parent

Propriétaire de l'existence d'un autre composant.

**Dépendances :** propriétaire, existence, composant.

### 7.3 Enfant

Composant dont l'existence a pour propriétaire un parent.

**Dépendances :** composant, existence, parent.

### 7.4 Racine

Composant du modèle qui n'est l'enfant d'aucun composant du modèle.

**Dépendances :** composant, enfant, modèle.

L'existence d'une racine satisfait la définition 7.1, mais elle est fournie par l'hôte et n'est pas une ressource du modèle ; A1 et T1 ne s'y appliquent pas. Sa fin vient de l'hôte.

### 7.5 Composition

Relation entre un parent et ses enfants produite par la propriété de leur existence.

**Dépendances :** parent, enfant, existence, propriétaire.

## 8. Identité

### 8.1 Identité

Ressource permettant de distinguer une ressource ou un composant au sein d'un ensemble.

**Dépendances :** ressource, composant.

Une identité est une part d'un espace des identités. Elle ne se modifie pas : sa seule opération exclusive est sa destruction. Des identités subordonnées peuvent être attribuées en son sein (6.5).

### 8.2 Espace des identités

Ressource distribuable dont les parts sont des identités.

**Dépendances :** ressource distribuable, part, identité.

### 8.3 Représentation d'identité

Information utilisée pour exprimer une identité.

**Dépendances :** identité.

Une représentation d'identité n'est pas une ressource.

### 8.4 Namespace

Représentation textuelle d'une identité dans un espace des identités.

**Dépendances :** représentation d'identité, identité, espace des identités.

## 9. Communication

### 9.1 Channel

Ressource relativement à laquelle un message est transmis.

**Dépendances :** ressource, message.

Ses opérations exclusives sont la modification des messages qui peuvent lui être adressés ou être émis sur lui, et sa destruction.

### 9.2 Abonnement

Ressource associant un Channel au composant qui en est propriétaire, et faisant de ce composant un destinataire des messages transmis depuis ce Channel.

**Dépendances :** ressource, Channel, composant, propriétaire.

Sa seule opération exclusive est sa destruction. Créer un abonnement n'est pas une interaction fonctionnelle : aucune information n'est transmise au propriétaire du Channel. Le médiateur matérialise l'abonnement sans en être propriétaire (G4).

### 9.3 Traitement

Exécution par un composant, en réponse à la délivrance d'un message, qui se termine sans attendre aucun fait ultérieur.

**Dépendances :** composant, message.

Un traitement est synchrone. Un fait survenant après son début entre dans le modèle par un nouveau message (A5).

### 9.4 Transport

Action par laquelle le médiateur prend en charge un message relatif à un Channel et le délivre aux composants qui en assurent le traitement.

**Dépendances :** médiateur, message, Channel, composant, traitement.

### 9.5 Adresser

Transmettre un message à un Channel en vue de son traitement.

**Dépendances :** message, Channel, traitement.

Adresser ne présume pas que l'auteur du message est propriétaire d'un Channel.

### 9.6 Émettre

Transmettre un message depuis un Channel aux propriétaires des abonnements à ce Channel.

**Dépendances :** message, Channel, abonnement, propriétaire.

### 9.7 Recevoir

Se voir délivrer par transport un message émis sur un Channel.

**Dépendances :** transport, message, émettre, Channel.

Recevoir n'est pas une opération exclusive : plusieurs composants reçoivent un même message sans être propriétaires du Channel.

### 9.8 Référence

Moyen permettant à un composant d'atteindre une ressource ou un autre composant sans transport.

**Dépendances :** composant, ressource, transport.

### 9.9 Référence structurelle

Référence d'un propriétaire vers une ressource dont il est propriétaire, ou d'un parent vers son enfant.

**Dépendances :** référence, propriétaire, ressource, parent, enfant.

**Résolution auprès de l'hôte.** Un composant établit une référence structurelle vers une ressource matérialisée par l'hôte en résolvant, auprès de l'hôte, la représentation de l'identité de cette ressource. L'hôte n'étant pas un composant, cette résolution n'est pas une interaction. L'hôte est le support matériel de la ressource ; l'opération est exécutée par le composant.

### 9.10 Interaction fonctionnelle

Transmission d'une information d'un composant à un autre composant, hors paramètres de création et hors transport.

**Dépendances :** composant, paramètres de création, transport.

Le contexte causal accompagne le message qui réalise l'interaction ; il ne fait pas partie de l'information transmise par celle-ci. Un message qu'un composant s'adresse à lui-même n'est pas une interaction fonctionnelle ; il reste soumis à A3.f.

## 10. Causalité

### 10.1 Cause

Fait auquel un message ou un changement d'état est rattaché.

**Dépendances :** message, état.

Une cause n'est ni un composant, ni une ressource, ni un message : c'est une relation explicative, extérieure au modèle, représentée dans celui-ci par le contexte causal.

### 10.2 Origine

Cause qui ne continue aucune cause antérieure dans le périmètre observé.

**Dépendances :** cause, périmètre.

### 10.3 Continuation

Cause qui continue une cause antérieure dans le périmètre observé.

**Dépendances :** cause, périmètre.

### 10.4 Chaîne causale

Suite constituée d'une origine et des continuations qui s'y rattachent directement ou indirectement.

**Dépendances :** origine, continuation.

### 10.5 Contexte causal

Information portée par un message permettant de le rattacher à une chaîne causale.

**Dépendances :** message, chaîne causale.

Le contexte causal n'est pas une ressource.

## 11. Parties du modèle et frontière

### 11.1 Interface utilisateur

Partie du modèle formée des ressources par lesquelles l'utilisateur perçoit le modèle ou agit sur lui, et des composants qui en sont propriétaires.

**Dépendances :** modèle, ressource, composant, propriétaire.

Une ressource appartient à la même partie du modèle que son propriétaire.

### 11.2 Domaine

Partie du modèle qui n'appartient pas à l'interface utilisateur.

**Dépendances :** modèle, interface utilisateur.

Une racine peut appartenir au domaine : créer des composants de l'interface utilisateur est un acte structurel, non une interaction.

### 11.3 Invariant métier

Règle portant sur des ressources du domaine et devant demeurer satisfaite au cours de la vie du modèle.

**Dépendances :** ressource, domaine.

Les invariants métier sont définis par l'application. Bonsai n'en fixe aucun ; il en contraint la satisfaction (A4.a) et la portée (T5).

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

## 12. Axiomes

Chaque clause est suivie de son contre-exemple.

### A1 — Propriété unique

> **A1.a** Toute ressource du modèle a exactement un propriétaire.
>
> **A1.b** Une opération exclusive n'est exécutée que par le propriétaire de la ressource.

**Contre-exemples :** une ressource du modèle n'a aucun propriétaire (A1.a) ; deux composants modifient le même état (A1.b).

Ce qu'exécute une partie d'un composant qui n'est pas elle-même un composant est exécuté par ce composant. Aucune délégation n'est admise.

La fin des ressources d'un composant, par l'effet de la destruction de son existence, fait partie de cette destruction ; ce n'est pas une opération exclusive exécutée par un autre composant.

### A2 — Origine de la propriété

> **A2.a** Le composant qui crée ou admet une ressource en est le propriétaire initial, sauf pour une part d'une ressource distribuable, dont le propriétaire initial est désigné par attribution du propriétaire de cette ressource. Deux parts existantes d'une même ressource distribuable ne se recouvrent pas.
>
> **A2.b** Toute ressource distribuable est créée par une racine, admise depuis l'hôte, ou bien est une part d'une ressource distribuable.
>
> **A2.c** Le propriétaire d'une ressource demeure le même jusqu'à la destruction de celle-ci.

**Contre-exemples :** un composant choisit lui-même son identité (A2.a) ; deux Features reçoivent la même identité (A2.a) ; un composant crée son propre espace des identités et s'y nomme (A2.b) ; un composant remet un état dont il est propriétaire à un autre composant (A2.c).

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
> **A3.f** Tout message est adressé à un Channel ou émis sur un Channel.

**Contre-exemples :** un composant obtient une information d'un autre en appelant l'une de ses méthodes (A3.a) ; un composant ouvre un Channel sous l'identité d'un autre (A3.b) ; un parent lit l'état de son enfant par une référence (A3.c) ; un parent transmet à son enfant une fonction de rappel vers lui-même, ou un élément de l'hôte (A3.d) ; deux composants traitent les messages d'un même Channel, ou un composant émet sur le Channel d'un autre (A3.e) ; une Feature construit un message et appelle directement son propre traitement (A3.f).

### A4 — Autosuffisance du domaine

> **A4.a** Les invariants métier sont satisfaits à l'issue de chaque traitement, en présence ou en l'absence d'interface utilisateur.
>
> **A4.b** Aucun composant du domaine n'adresse de message à un Channel dont le propriétaire appartient à l'interface utilisateur, ni ne reçoit de message émis sur un tel Channel.
>
> **A4.c** Seul le domaine échange des informations métier avec les systèmes extérieurs.

**Contre-exemples :** une Command laisse un panier dont le total ne correspond plus à ses lignes (A4.a) ; un composant du domaine reçoit un message émis par un composant de l'interface utilisateur (A4.b) ; un composant de l'interface utilisateur échange des informations métier avec un système extérieur (A4.c).

### A5 — Causalité

> **A5.a** Tout changement d'état résulte du traitement d'un message.
>
> **A5.b** Tout message porte un contexte causal.
>
> **A5.c** Un fait de l'hôte ou d'un système extérieur n'entre dans le modèle que comme origine d'un message, produit par le composant qui l'admet.

**Contre-exemples :** un composant modifie un état à l'expiration d'une minuterie, sans message (A5.a) ; un message est transmis sans contexte causal (A5.b) ; un composant modifie un état directement dans un gestionnaire d'événement de l'hôte (A5.c).

Un changement effectué par l'hôte lui-même n'est pas un changement d'état du modèle tant qu'il n'a pas été admis.

## 13. Garanties du médiateur

Le médiateur n'est soumis à aucun axiome. Toute réalisation du médiateur est tenue par les garanties suivantes.

- **G1** — Il délivre un message adressé à un Channel au seul propriétaire de ce Channel, et un message émis sur un Channel aux seuls propriétaires d'un abonnement à ce Channel.
- **G2** — Il ne modifie ni un message ni son contexte causal.
- **G3** — Il ne délivre aucun message relatif à un Channel détruit.
- **G4** — Il n'est partie à aucune interaction fonctionnelle et n'est propriétaire d'aucune ressource du modèle.

Par G4, matérialiser un Channel ne confère pas au médiateur la propriété de ce Channel : celle-ci suit l'identité qui le distingue (A3.b).

## 14. Conséquences établies

Chaque conséquence est suivie de sa démonstration. Les catégories `Command`, `Request` et `Event` n'apparaissent qu'en conclusion de T2, jamais en prémisse.

### L1 — Lemme de l'objet

> Toute interaction fonctionnelle porte sur une ressource.

**Démonstration.**

1. Une interaction fonctionnelle transmet une information d'un composant C à un autre composant D (9.10). Le contexte causal n'en fait pas partie (note de 9.10).
2. Le modèle ne contient que des composants, des ressources et des messages (3.8).
3. Elle ne porte pas sur un message pris comme objet : un message n'est ni une ressource ni un composant, et son seul effet dans le modèle est un changement d'état produit par son traitement (A5.a) ; l'interaction porte alors sur cet état, qui est une ressource (4.2).
4. Un fait de l'hôte ou d'un système extérieur n'est pas dans le modèle avant son admission ; admis, il devient l'origine d'un message (A5.c), et l'on revient au cas 3.
5. Reste une information sur un composant. Par la prémisse de lecture de 3.8, ce qu'un composant offre de changer ou de connaître est son existence ou une ressource dont il est propriétaire. L'existence est une ressource (7.1).
6. Dans tous les cas, l'interaction porte sur une ressource. ∎

### T1 — Composition par création

> Le composant qui crée un autre composant en est le parent.

**Démonstration.**

1. Créer un composant consiste à créer son existence (note de 6.1).
2. Cette existence est une ressource du modèle qui n'est pas une part ; son créateur en est le propriétaire initial (A2.a).
3. Le propriétaire de l'existence d'un composant est son parent (7.2). ∎

La racine n'est pas concernée : rien dans le modèle ne la crée (note de 7.4).

### T2 — Les trois voies

> Toute interaction fonctionnelle relève d'exactement l'une des trois voies suivantes : un composant autre que le propriétaire adresse à celui-ci une demande de changement (**Command**) ; un composant autre que le propriétaire lui adresse une demande de connaissance (**Request**) ; le propriétaire émet une information sur sa ressource (**Event**). Une Command et une Request sont traitées par le seul propriétaire ; un Event peut être reçu par plusieurs composants.

**Démonstration.**

1. Soit une interaction de C vers D. Par L1, elle porte sur une ressource R, de propriétaire unique O (A1.a).
2. **Première question : l'interaction vise-t-elle l'exécution d'une opération exclusive sur R ?** La réponse est oui ou non : la partition est exhaustive et exclusive. Une réservation ou une validation qui enregistre quelque chose vise une opération exclusive ; une vérification sans effet n'en vise pas ; une négociation ou une coordination est une suite d'interactions, dont chacune se range séparément.
3. **Si oui.** Seul O exécute l'opération (A1.b). Si C est O, il l'exécute lui-même et n'interagit avec personne. Sinon, C doit en transmettre la demande à O, ce qui passe par un message (A3.a) adressé à un Channel dont O est propriétaire, puisque seul le propriétaire d'un Channel traite ce qui lui est adressé (A3.e). C'est la voie **Command**.
4. **Si non**, l'interaction transmet une information sur R. Seul O dispose d'une référence vers R (A3.c, 9.9) : toute connaissance de R provient donc de O.
5. Si l'information va **vers** C, C la demande à O, qui seul peut y répondre : message adressé au Channel de O, traité par O (A3.e). C'est la voie **Request**. Si C est O, il n'a rien à demander.
6. Si l'information part **de** C, C la tient de R, donc C est O (point 4). Un composant qui relaie une copie de R informe en réalité sur sa propre copie, qui est une autre ressource dont il est propriétaire. O la transmet depuis son propre Channel, seul Channel sur lequel il peut émettre (A3.e). C'est la voie **Event**.
7. **Unicité du traitement.** Command et Request sont traitées par le propriétaire du Channel (A3.e), qui est unique (A1.a). Que ce propriétaire organise son traitement en plusieurs fonctions ne compte pas (note d'A1).
8. **Plusieurs destinataires.** Un Event est émis vers les propriétaires des abonnements au Channel de O (9.6). Recevoir n'est pas une opération exclusive (9.7) : plusieurs composants reçoivent sans devenir propriétaires. ∎

| | Vise un changement | Demande une connaissance | Informe |
| --- | --- | --- | --- |
| **C est O** | aucune interaction | impossible : O dispose d'une référence vers R | **Event** |
| **C n'est pas O** | **Command** | **Request** | impossible : seul O connaît R |

### T3 — Destruction en cascade

> La destruction d'un composant entraîne la destruction de toutes les ressources dont il est propriétaire.

**Démonstration.**

1. Un parent P détruit l'existence d'un enfant C : opération exclusive de P (7.1, A1.b).
2. À l'issue de l'opération, toute ressource restante du modèle a un propriétaire (A1.a, règle de lecture du §2.5).
3. Une ressource dont C était propriétaire ne peut pas recevoir un nouveau propriétaire (A2.c).
4. Elle ne peut donc pas subsister : sa fin fait partie de la destruction de C (note d'A1).
5. Parmi ces ressources figure l'existence des enfants de C ; leur fin entraîne celle de leurs propres ressources, et ainsi de suite. ∎

**Corollaires.**

- Détruire un composant détruit toute sa descendance.
- Les abonnements d'un composant détruit sont détruits avec lui : aucun message émis ne lui est plus délivré (G1).
- Une part dont C était propriétaire est détruite, non transférée. La ressource distribuable dont elle provenait demeure inchangée (note de 6.5).
- Une nouvelle attribution de la même portion produit une nouvelle part, qui est une autre ressource ; A2.c n'est pas en cause.

### T4 — Adressabilité

> Un composant propriétaire d'aucune identité n'est propriétaire d'aucun Channel : aucun message ne peut lui être adressé, et il ne reçoit que des messages émis sur les Channels d'autres composants.

**Démonstration.**

1. Tout Channel est distingué par une identité dont son propriétaire est propriétaire (A3.b) : sans identité, aucun Channel.
2. Un message adressé l'est à un Channel (9.5) et n'est traité que par le propriétaire de ce Channel (A3.e, G1).
3. Tout message est adressé ou émis (A3.f) ; il ne reste donc à ce composant que la réception de messages émis par d'autres (9.7). ∎

### T5 — Localité des invariants

> Un invariant métier qui lie plusieurs ressources porte sur des ressources d'un seul propriétaire.

**Démonstration.**

1. Soit un invariant liant une ressource R1 de propriétaire O1 et une ressource R2 de propriétaire O2, avec O1 distinct de O2 : la satisfaction de l'invariant dépend des valeurs conjointes de R1 et R2.
2. Un traitement est exécuté par un seul composant (9.3) et ne modifie que des ressources dont celui-ci est propriétaire (A1.b).
3. Il existe des changements de R1 qui exigent un changement correspondant de R2 pour maintenir l'invariant. À l'issue du traitement par O1 qui change R1, R2 n'a pas changé.
4. L'invariant est donc violé à l'issue de ce traitement, ce qu'interdit A4.a.
5. Donc O1 et O2 sont un même composant. ∎

Deux règles indépendantes posées sur deux ressources de propriétaires distincts ne sont pas concernées : elles ne lient rien.

### T6 — Survie du domaine

> Une Feature n'est détruite qu'avec la racine.

**Démonstration.**

1. L'existence d'une Feature a pour propriétaire la racine (D1).
2. Seul ce propriétaire peut la détruire (A1.b) : aucun composant de l'interface utilisateur, ni aucune autre Feature, ne le peut.
3. Un fait de l'hôte n'agit pas dans le modèle ; il n'y entre que comme origine d'un message (A5.c), qui ne peut conduire qu'un traitement par un composant.
4. La racine ne détruit l'existence d'aucune Feature (D1).
5. Reste la fin de la racine, qui vient de l'hôte (7.4) et emporte toute sa descendance (T3). ∎

T6 dépend d'une décision (D1) ; sans elle, les axiomes permettent la destruction d'une Feature.

## 15. Décisions de conception

Une décision fixe un choix propre à Bonsai que les axiomes n'imposent pas. Elle ne rétrécit pas la théorie : un autre modèle conforme aux axiomes pourrait décider autrement.

- **D1 — Pérennité des enfants de la racine.** Les Features et la Foundation sont des enfants de la racine. La racine ne détruit l'existence d'aucun d'eux. *Pourquoi :* sans pérennité, rien ne garantit qu'un invariant métier conserve les ressources sur lesquelles il porte (A4.a).
- **D2 — Pérennité des ressources d'une Feature.** Une Feature ne détruit ni son identité, ni son Channel, ni son Entity. Réinitialiser une Entity est une modification, non une destruction.
- **D3 — Admission du document.** La Foundation admet le corps du document comme ressource distribuable.
- **D4 — Une Feature, une Entity.** Une Feature est propriétaire d'exactement une Entity. *Pourquoi :* l'Entity est l'unité de cohérence que T5 rend nécessaire.
- **D5 — Identités des Features.** La racine est propriétaire de l'espace des identités et attribue à chaque Feature une identité.
- **D6 — View non adressable.** Une View n'est propriétaire d'aucune identité.

## 16. Rôles dérivés

### 16.1 Application

Racine du domaine, propriétaire de l'espace des identités (D5) et parent des Features et de la Foundation (D1).

### 16.2 Entity

État du domaine dont le propriétaire est une Feature, avec les opérations exclusives qui le modifient.

L'Entity n'est pas un composant : elle n'a ni existence propre, ni identité, ni Channel. Ce qu'elle exécute est exécuté par sa Feature (note d'A1). Les invariants métier qui la concernent sont définis par l'application et satisfaits à l'issue de chaque traitement (A4.a).

### 16.3 Feature

Composant du domaine, enfant de la racine, propriétaire d'une identité attribuée par celle-ci, du Channel distingué par cette identité et d'une Entity, qui traite les messages adressés à ce Channel et y émet.

Conséquences : une Feature n'émet que sur son propre Channel (A3.e, T2) ; elle survit à tout changement de l'interface utilisateur et de l'hôte (T6) ; un fait asynchrone qu'elle admet lui revient par un message adressé à son propre Channel (9.3, A3.f).

### 16.4 Foundation

Composant de l'interface utilisateur, enfant de la racine (D1), qui admet le corps du document (D3) et en attribue des parts à ses enfants.

### 16.5 View

Composant de l'interface utilisateur, propriétaire d'une part du DOM attribuée par son parent, sans identité (D6), qui admet les faits de l'hôte survenant dans cette part et adresse des messages aux Channels du domaine.

Conséquences :

- elle n'est pas adressable et n'émet aucun message (D6, T4) ; elle reçoit ce que les Features émettent ;
- son parent lui transmet, à sa création, une représentation de l'identité de sa part, jamais un élément de l'hôte (A3.d, 6.2) ;
- elle établit sa référence structurelle en résolvant cette représentation auprès de l'hôte (9.9) ;
- sa part ne recouvre aucune autre part existante (A2.a) : l'exclusion des slots de ses enfants en découle.

### 16.6 Rôles restant à dériver

Composer, Behavior et Manifest. Le Manifest pourra être défini comme la représentation de l'espace des identités dont la racine est propriétaire.

## 17. Chaîne de non-circularité

Une définition n'emploie aucun terme situé après elle. L'ordre de lecture du document suit exactement la chaîne.

1. composant *(primitif)*
2. ressource *(primitif)*
3. message *(primitif)*
4. hôte *(primitif)*
5. médiateur *(primitif)*
6. système extérieur *(primitif)*
7. propriété *(primitif)*
8. modèle *(primitif)*
9. périmètre
10. état
11. opération exclusive
12. propriétaire
13. création
14. paramètres de création
15. part
16. ressource distribuable
17. attribution
18. existence
19. parent
20. enfant
21. racine
22. composition
23. identité
24. espace des identités
25. représentation d'identité
26. namespace
27. Channel
28. abonnement
29. traitement
30. transport
31. adresser
32. émettre
33. recevoir
34. référence
35. référence structurelle
36. interaction fonctionnelle
37. cause
38. origine
39. continuation
40. chaîne causale
41. contexte causal
42. interface utilisateur
43. domaine
44. invariant métier
45. cohérence métier
46. information métier
47. admission
48. frontière de confiance

## 18. Questions ouvertes

### 18.1 Périmètre causal

Le périmètre observé d'une chaîne causale est-il le modèle, une racine ou une période de la vie du modèle ?

### 18.2 Navigation et adresse

L'état de navigation et l'adresse affichée par l'hôte appartiennent-ils à l'interface utilisateur ou au domaine ?

### 18.3 Stockage local

Le stockage local de l'hôte est-il un système extérieur, ou une ressource de l'hôte admise dans le modèle ? La pérennité de D1 ne couvre pas la survie au rechargement de la page.

### 18.4 Frontière de confiance

Une seule frontière suffit-elle, ou faut-il distinguer l'admission depuis l'hôte de l'admission depuis un système extérieur ?

### 18.5 Racines multiples

Lorsque plusieurs racines coexistent dans un même hôte, leurs arbres d'attribution sont indépendants (A2.b). Le médiateur doit-il garantir qu'aucun message ne passe d'un arbre à l'autre, ce qui exigerait une garantie G5 ?

### 18.6 Délégation

La délégation est exclue. Elle serait réexaminée si la dérivation d'un rôle rencontrait un cas que l'attribution, les messages et les paramètres de création ne couvrent pas.

### 18.7 Garantie au plus tôt et gardes

Le principe selon lequel toute règle imposée au code applicatif est garantie par construction, à défaut au démarrage, à défaut par une garde à l'exécution, relève-t-il de la théorie ? Il ne porte sur aucune notion du modèle, mais sur la manière d'en garantir les règles. Le §1 annonce les gardes comme huitième niveau ; aucune section ne les traite encore.

### 18.8 Déterminisme

Un même enchaînement de messages produit-il nécessairement les mêmes changements d'état ? Aucun axiome ne l'impose : un modèle dont l'ordre de délivrance serait arbitraire satisfait A1 à A5. Les invariants I29, I64, I96, I97 et I98, déjà livrés, le supposent pourtant. Si une exécution non rejouable n'est pas conforme, le déterminisme est un axiome ; si la rejouabilité est seulement une visée de Bonsai, il est une décision justifiée par cette visée (18.10).

### 18.9 Cohésion et borne causale

Le principe « un rôle, une responsabilité » (P10, I100) est-il un axiome, une décision ou une règle de méthode ? La borne de longueur d'une chaîne causale (`MAX_HOPS`) est-elle une décision, et quelle conséquence protège-t-elle ?

### 18.10 Objectifs

Certaines décisions ne découlent d'aucun axiome mais servent un but : la rejouabilité (18.8) ou l'ergonomie (I48, I74, I83, I85). Faut-il un type distinct, l'objectif, pour les justifier ? Si oui, la liste des objectifs doit être courte et nommée, et chaque décision qui en invoque un doit dire quelle alternative elle écarte.

### 18.11 Rattachement au registre

Les principes P1 à P10 (`docs/invariants/principes.yaml`) et les invariants `I<n>` ne sont rattachés à aucun axiome, conséquence ou décision de la présente théorie. Ce rattachement reste à établir ; il ne devrait l'être qu'après arbitrage de 18.7 à 18.10.
