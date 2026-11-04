# Bonsai — Audit du noyau formel (jalon V0.7)

> **État au 26 octobre 2026 : tous les constats sont résolus.**

> *Terminologie : ce rapport a été rédigé quand la voie s'appelait `Request`. Elle s'appelle désormais `Query` (méthode `query()`) ; le texte est aligné.*

*Audit de `docs/theorie.md` V0.6 (25 octobre 2026), §2 à §14 et §17. Chaque constat donne son emplacement, le problème et une proposition. Rien n'est appliqué tant que l'arbitrage n'est pas validé.*

Gravité : **critique** = contradiction ou démonstration invalide ; **important** = règle de définition violée, prémisse implicite, contre-exemple non discriminant ; **mineur** = précision lexicale.

## Critiques

### C1 — La réponse à une Query n'a pas de statut

> **Résolu le 25 octobre 2026 — option B (lecture synchrone).** La réponse n'est pas un message : elle est rendue par le transport du message adressé (9.4), définie en 9.11. Nouvelle clause A3.g : le traitement qui rend une réponse n'exécute aucune opération exclusive. G1 et G2 couvrent la réponse ; T2 (points 3 et 5) et T4 (note) ajustés. La proposition ci-dessous (réponse comme quatrième forme de message) a été écartée.

- **Où :** A3.f, G1, T2 (point 5), T4, A4.d.
- **Problème :** T2 établit la Query : un message adressé au Channel du propriétaire, qui « seul peut y répondre ». Mais la réponse elle-même n'est nulle part. Elle n'est ni adressée (le demandeur, une View par exemple, n'a pas de Channel), ni émise, ni locale : A3.f l'exclut. Si elle n'est pas un message, c'est une information transmise d'un composant à un autre hors message, donc une interaction fonctionnelle qui viole A3.a. T4 affirme en outre qu'un composant sans identité ne reçoit que des messages émis ou locaux, ce qui interdit à une View de recevoir la réponse à sa Query. A4.d invoque pourtant cette réponse.
- **Proposition :** définir la réponse comme une quatrième forme de message.
  - Nouvelle définition après 9.7 : **Répondre** — transmettre un message, au cours du traitement d'un message adressé, au seul auteur de ce message.
  - A3.f : « Tout message est adressé à un Channel, émis sur un Channel, réponse à un message adressé, ou local. »
  - G1 : ajouter « et une réponse au seul auteur du message auquel elle répond ».
  - A3.e : « … seul il émet sur ce Channel et répond aux messages qui y sont adressés. »
  - T4 : « hors ses messages locaux et les réponses à ses messages adressés ».
  - T2 point 5 : la réponse est un message transmis par O à C (« répondre »).
  - « Auteur » entre au métalangage : le composant qui produit un message.

### C2 — A4.d emploie « Query » avant T2

> **Résolu le 25 octobre 2026.** A4.d : « … provient d'un message émis par un composant du domaine ou d'une réponse produite par un tel composant, et n'est remplacée que par une information de même provenance. »

- **Où :** A4.d.
- **Problème :** la feuille de route interdit d'employer `Command`, `Query` ou `Event` avant leur établissement par T2 ; le §14 l'annonce aussi. A4.d est un axiome, antérieur à T2.
- **Proposition (suppose C1) :** « Toute information métier contenue dans une ressource de l'interface utilisateur provient d'un message émis par un composant du domaine ou de sa réponse à un message adressé, et n'est remplacée qu'en traitement d'un tel message. »

### C3 — Le transport exclut le message local qu'il doit porter

> **Résolu le 25 octobre 2026**, avec C1 : 9.4 ne mentionne plus de Channel.

- **Où :** 9.4 et 9.5.
- **Problème :** 9.4 définit le transport pour « un message relatif à un Channel » ; 9.5 définit le message local comme « soumis au transport, sans Channel ». Par définition, un message local ne peut donc pas être transporté.
- **Proposition :** 9.4 : « Action par laquelle l'infrastructure de communication prend en charge un message et le délivre aux composants qui en assurent le traitement. » Dépendances : retirer Channel.

### C4 — T5 suppose des traitements successifs, ce que rien ne garantit

> **Résolu le 25 octobre 2026.** G5 : « Elle ne délivre un message qu'après la fin du traitement en cours. Seul le traitement d'un message adressé qui rend une réponse s'exécute au cours d'un autre traitement. » T5 (point 3) et la règle de lecture la citent ; l'isolation des racines (18.5) devient G6 ; l'ordre de délivrance reste en 18.8. Écart d'implémentation : `trigger()` et `emit()` appellent aujourd'hui les traitements directement (`channel.class.ts`) et doivent passer par une file.

- **Où :** T5, point 3 ; §13.
- **Problème :** T5 conclut que l'invariant est violé « à l'issue du traitement par O1 », parce que R2 n'a pas changé. Si O2 traitait un message au même moment, les deux traitements pourraient s'achever ensemble et l'invariant être satisfait à chaque issue : la démonstration tombe. Aucune garantie n'interdit deux traitements simultanés ; la règle de lecture (« à l'issue de chaque opération ») le présuppose sans le dire.
- **Proposition :** une garantie de sérialisation : **« Elle délivre les messages un à un : aucun traitement ne commence avant la fin du précédent. »** T5 la cite au point 3. **Depuis C1 :** la garantie doit admettre que le traitement d'un message adressé qui rend une réponse s'exécute au cours du traitement de son auteur (9.11) ; A3.g garantit qu'il ne modifie rien. Numérotation à décider : G5 (la feuille de route réserve aujourd'hui G5 à l'isolation des racines, 18.5, qui deviendrait G6).

### C5 — La démonstration de L1 contient une inférence invalide

> **Résolu le 26 octobre 2026.** 18.15 tranchée (critère : une ressource de l'hôte a un état qui persiste et ne change que par des faits ; l'heure et l'aléatoire se lisent librement). Nouvelle clause A3.h : « Un composant n'émet d'information que sur une ressource dont il est propriétaire. » L1 redémontrée à partir de A3.a, A3.c, A3.e, A3.h, A1.b et A0.c ; T2 (point 6) cite A3.h. M2 est résolu par la même occasion.

- **Où :** L1, points 3 et 4.
- **Problème :**
  - Point 3 : A5.a dit que tout changement d'état résulte du traitement d'un message ; il ne dit pas que le seul effet d'un message est un changement d'état. La démonstration utilise la réciproque.
  - Point 4 : une information sur l'hôte peut circuler sans qu'aucun fait ait été admis : un composant qui lit la taille de la fenêtre et la transmet. Le cas dépend de 18.15 (une lecture de l'hôte est-elle une admission ?), encore ouverte.
- **Proposition :** réécrire L1 en traitant explicitement trois cas : information sur une ressource (immédiat) ; information sur un composant (A0.c, comme aujourd'hui) ; information sur un message ou sur l'hôte. Pour ce dernier cas, deux voies : (a) trancher 18.15 dans le sens « toute lecture de l'hôte est une admission », et l'information porte alors sur une ressource admise ; (b) reformuler L1 en « porte sur une ressource ou sur un message ». La voie (a) préserve T2 tel quel.

### C6 — La définition d'identité emploie le terme défini

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** 8.2.
- **Problème :** « Part d'un espace des identités, dont la seule opération exclusive est l'attribution d'**identités** subordonnées » : le terme défini figure dans sa définition (§2.2).
- **Proposition :** « Part d'un espace des identités, dont la seule opération exclusive est l'attribution de parts en son sein. » La note existante explique déjà que ces parts sont elles-mêmes des identités.

## Importants

### I1 — « Portion » n'est pas défini

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** 6.5 (note), A2 (note), T3 (corollaires), T7.
- **Problème :** T7 repose sur la distinction entre part et portion (point de vigilance de la feuille de route), mais « portion » n'est ni défini ni au métalangage.
- **Proposition :** nouvelle définition **6.6 Portion** — « Partie d'une ressource distribuable qu'occupe une part. » Dépendances : ressource distribuable, part. Une portion n'est pas une ressource. Chaîne : 50 termes.

### I2 — Une règle utilisée comme prémisse n'est écrite que dans une note

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** note de 6.5, citée par T7 (point 3) et T3 (corollaires).
- **Problème :** « Lorsque la part prend fin, la portion qu'elle occupait est rendue » n'est énoncé que dans une note, qui sert pourtant de prémisse à T7.
- **Proposition :** l'intégrer à la définition : « Action par laquelle le propriétaire d'une ressource distribuable crée une part de celle-ci, en désigne le propriétaire et soustrait de cette ressource la portion qu'elle occupe, jusqu'à la fin de cette part. »

### I3 — Le périmètre ne peut pas contenir de faits

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** 4.1 et 10.2.
- **Problème :** 4.1 définit le périmètre comme un ensemble de composants, ressources et messages ; 10.2 étend le périmètre observé « aux faits extérieurs », qui ne sont rien de cela.
- **Proposition :** 4.1 : « Ensemble déterminé de composants, de ressources, de messages et de faits… »

### I4 — Le domaine contient tous les messages

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** 11.1 et 11.2.
- **Problème :** l'interface utilisateur ne comprend que des composants et des ressources ; le domaine est défini par complément dans le modèle, qui contient aussi les messages (A0.b). Tout message relève donc du domaine.
- **Proposition :** 11.2 : « Partie du modèle formée des composants et des ressources qui n'appartiennent pas à l'interface utilisateur. » Les messages ne relèvent d'aucune des deux parties.

### I5 — « Une cause est extérieure au modèle »

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** note de 10.1.
- **Problème :** une continuation a pour cause le traitement d'un message, qui a lieu dans le modèle. Et A0.a range tout ce qui intervient dans l'une des quatre zones : une cause « extérieure au modèle » devrait relever de l'hôte, de l'infrastructure ou d'un système extérieur.
- **Proposition :** « Une cause est un fait, non une entité : elle n'est ni un composant, ni une ressource, ni un message. Le modèle la représente par le contexte causal. »

### I6 — La référence n'a pas de catégorie

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** 9.9, A0.b.
- **Problème :** une référence n'est ni composant, ni ressource, ni message ; A0.b ne lui laisse pas de place, alors que A3.d la traite comme pouvant être contenue dans des paramètres de création.
- **Proposition :** 9.9 : « **Information** permettant à un composant d'atteindre… », comme la représentation d'identité et le contexte causal.

### I7 — La définition d'abonnement est ambiguë

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** 9.2.
- **Problème :** « associant un Channel au composant qui **en** est propriétaire » : « en » peut renvoyer au Channel. On lit alors qu'un abonnement relie un Channel à son propre propriétaire.
- **Proposition :** « Ressource dont le propriétaire est destinataire des messages transmis depuis un Channel déterminé, et dont la seule opération exclusive est la destruction. »

### I8 — La définition d'invariant métier contient une obligation, en désaccord avec A4.a

> **Résolu le 25 octobre 2026**, selon la proposition ci-dessous.

- **Où :** 11.3.
- **Problème :** « devant demeurer satisfaite au cours de la vie du modèle » : une obligation dans une définition, et plus forte que A4.a (« à l'issue de chaque traitement ») et que la règle de lecture.
- **Proposition :** « Règle portant sur des ressources du domaine, dont le code applicatif exige la satisfaction. » L'obligation reste à A4.a. (« Code applicatif » est déjà employé dans la note ; à ajouter au métalangage.)

### I9 — Le contre-exemple de A0.a ne discrimine pas

> **Résolu le 26 octobre 2026.**

- **Où :** A0, contre-exemples.
- **Problème :** une variable globale relève de l'hôte, une seule zone : A0.a n'est pas violé. Ce qui est violé, c'est A1.b ou T8.
- **Proposition :** « un registre de Channels est à la fois une partie de l'infrastructure de communication et une ressource qu'un composant modifie (A0.a) ».

### I10 — Le contre-exemple de A4.b ne couvre que la moitié de la clause

> **Résolu le 26 octobre 2026.**

- **Où :** A4, contre-exemples.
- **Proposition :** ajouter « une Feature adresse une Command au Channel de l'adaptateur du document (A4.b) ».

### I11 — La justification de A4.e dépend d'une décision

> **Résolu le 26 octobre 2026.**

- **Où :** note sous A4.
- **Problème :** l'axiome vaut pour tout modèle conforme, mais sa justification invoque le manifest et D5, propres à Bonsai.
- **Proposition :** « A4.e vient de ce qu'un message peut être adressé au domaine à tout moment : tout composant qui dispose d'une représentation de l'identité d'un Channel du domaine peut y adresser un message tant que la racine existe. »

### I12 — Une obligation sans clause : conserver le contexte causal

> **Résolu le 26 octobre 2026.**

- **Où :** note sous A5.
- **Problème :** « Le composant qui provoque un fait conserve le contexte causal du message en cours » est une obligation, que A5.c présuppose mais n'énonce pas. C'est ce que le catalogue des adaptateurs met au cœur de son contrat.
- **Proposition :** soit l'intégrer à A5.c (« … il en est alors une continuation, et le composant qui l'a provoqué en conserve le contexte causal »), soit la présenter comme conséquence démontrée de A5.c. La première voie est plus simple.

## Mineurs

- **M1 — Métalangage.** *(Résolu le 25 octobre 2026 ; « attribution » reformulée sans le mot « portion », qui est défini après elle en 6.6.)* Ajouter « auteur » (C1), « code applicatif » (I8), « délimiter » (6.3), « désigner » (6.5), « exister ». « Exister » demande une note : le verbe garde son sens ordinaire, distinct de l'existence au sens de 7.1.
- **M2 — T2, point 6.** *(Résolu le 26 octobre 2026 par A3.h.)* Une information relayée au cours du traitement même où elle a été reçue n'est pas encore une copie conservée. Préciser : « une information transmise par C hors du traitement qui l'a reçue est conservée dans une ressource dont C est propriétaire ».
- **M3 — T5, portée.** *(Résolu le 26 octobre 2026.)* Définir dans T5 ce que « lier » veut dire : un invariant lie R1 et R2 lorsqu'un changement de R1 permis par le code applicatif n'est compatible avec l'invariant qu'accompagné d'un changement de R2.
- **M4 — Classes de base.** *(Résolu le 26 octobre 2026.)* Le guide range la « tuyauterie » des classes de base dans l'infrastructure de communication ; la règle d'imputation impute à un composant ce qu'exécute une de ses parties. Il faut préciser que cette tuyauterie n'est pas une partie du composant, sinon A0.a est violé. À traiter avec le rôle des classes de base (V0.9).

## Ce qui tient

- La chaîne de non-circularité : aucune définition n'emploie un terme postérieur (hors C6, qui est une autoréférence).
- Les contre-exemples des autres clauses discriminent chacun leur clause.
- T1, T3, T6, T8 : prémisses complètes.
- T7 : valide une fois I1 et I2 faits.
- L1 ne présuppose pas T2 ; T2 n'introduit Command, Query et Event qu'en conclusion.

## Ordre de traitement proposé

1. C1 et C2 (la réponse), qui touchent A3, G1, T2, T4 et A4.
2. C3, C6, I1, I2 : corrections de définitions sans effet sur les axiomes.
3. C4 : nouvelle garantie, et sa numérotation.
4. C5 : L1, lié à 18.15.
5. I3 à I12, puis les mineurs.
