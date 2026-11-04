# Bonsai — Audit de cohérence du corps théorique (jalon V0.9.2)

*Audit du 29 octobre 2026. Périmètre : `theorie.md` (V0.9.2), le guide (`theorie-explication-pedagogique.md`), `tracabilite.md`, `gardes.md`, les fiches de `adaptateurs/`, `rapports/registre-V0.9.2.md` et `rapports/ecarts-V0.9.2.md`. Il fusionne et remplace deux rapports du même jour : la relecture de fond de la V0.9.2 et la relecture complémentaire. La théorie fait autorité ; cet audit n'est pas normatif.*

*Identifiants : **C** contradictions, **V** vides (lacunes), **F** formulations imprécises, **E** guide et fiches, **M** matrice. Ils ne renvoient à aucune clause de la théorie : C1 n'est pas une conséquence, et V1 n'a pas de rapport avec L1. La table de correspondance (§12) relie ces identifiants aux numéros des deux rapports d'origine.*

## 1. Verdict

**Le socle tient.**

- Aucun renvoi n'est cassé et la chaîne des définitions est intacte.
- Chaque clause d'axiome a son contre-exemple.
- Chaque décision a sa justification, son alternative écartée et l'objet qu'elle protège.
- Les démonstrations de L1 et de T1 à T8 n'emploient que des prémisses admises. Aucun constat ci-dessous ne les invalide : ils portent sur des énoncés voisins, des notes, des rôles ou des annexes.

**Le corps théorique n'est pas encore gelable.** Deux faiblesses touchent sa mécanique centrale :

1. **Autour de G5 et G7** (C2, C3, C4, V5), l'infrastructure de communication reçoit un critère qu'elle ne peut pas appliquer. Une note de §13 tire de G5 une conclusion fausse, et l'issue d'un échec n'est définie ni pour les parts des Views ni pour l'auteur d'une Query.
2. **Le statut des exécutions qui ne sont pas des traitements** n'est pas défini (V1) : admission d'un fait, création d'un composant, démarrage. Or ce sont elles qui ouvrent toutes les chaînes causales.

Le reste se corrige localement : six constats sans arbitrage, une passe de formulation, et le générateur de la matrice.

## 2. Contrôles mécaniques

| Contrôle | Résultat |
| --- | --- |
| Renvois de la théorie (clauses, garanties, théorèmes, décisions, objectifs, sections, questions, annexes) | tous résolus |
| Renvois des autres documents vers la théorie | tous résolus, sauf « D27 » dans `ecarts-V0.9.2.md` (décision de l'ancien dépôt, à qualifier) |
| Chemins de fichiers cités (`docs/…`) | tous présents depuis la séparation des documents |
| Chaîne de non-circularité (§17) | 51 termes, identiques aux titres des §3 à §11, dans le même ordre |
| Contre-exemples | aucune clause d'axiome sans contre-exemple (27 clauses) |
| Décisions | D1 à D18 nomment justification, alternative écartée et objet protégé ; D5 retirée |
| Table des gardes | 43 obligations (24 clauses, 16 décisions, B.2, B.4, B.5) ; bilan par niveau exact (21, 10, 7, 3, 2) |
| Tableaux Markdown | colonnes cohérentes dans tous les documents |
| Matrice de traçabilité | **en écart** : voir M |

## 3. Synthèse

| Id | Constat | Traitement |
| --- | --- | --- |
| C1 | D7 et B.1 rendent `fetch` et les minuteries non conformes | mécanique |
| C2 | Le critère de G5 n'est connu qu'après l'exécution | arbitrage |
| C3 | La Query réentrante lit un état intermédiaire | arbitrage |
| C4 | §2.5 et la note sous G7 promettent plus que G7 | arbitrage |
| C5 | 8.2 : « une identité ne se modifie pas » contredit 6.5 | mécanique |
| C6 | D12 : le Composer « n'est propriétaire d'aucun état » | mécanique |
| C7 | D9 compte en largeur ce qu'il dit compter en profondeur | mécanique |
| C8 | A3.h ne couvre pas les faits émis par les adaptateurs | arbitrage |
| V1 | Exécutions hors traitement : admission, création, démarrage | arbitrage |
| V2 | A5.c charge le composant de ce que fait l'infrastructure | arbitrage léger |
| V3 | L'identité d'une part du DOM et le statut du sélecteur | arbitrage |
| V4 | Le clic ou le focus hors d'une View n'a pas d'admetteur | arbitrage |
| V5 | L'échec d'une Query n'a pas d'issue définie | arbitrage |
| V6 | D13 : « clés qui ne se recoupent pas » est ambigu | confirmation |
| V7 | 16.9 promet à la compilation un contrôle entre racines | mécanique |
| F1 | Termes normatifs sans définition ni place dans le métalangage | mécanique |
| F2 | O2 compte trois niveaux de garde, le §19 en compte quatre | mécanique |
| F3 | 18.11 encore ouverte | mécanique |
| F4 | A.10 : messages entre onglets « frontière ambiguë » | mécanique |
| F5 | G6 : la clause sur la réponse ne dit pas ce qu'elle vise | mécanique |
| E1–E6 | Guide et fiches | suivent la théorie |
| M | Matrice de traçabilité périmée | générateur |

## 4. Contradictions

### C1 — D7 et B.1 rendent `fetch` et les minuteries non conformes

- **Où :** D7, B.1, 11.7 (second paragraphe), remarque sous A5, B.6 ; guide, « Les adaptateurs de l'hôte » (E4).
- **Problème :**
  - D7 fait admettre par un adaptateur *toute* source de l'hôte « située hors du corps du document », et B.1 déclare non conforme toute source absente du catalogue.
  - Or 11.7, la remarque sous A5 et B.6 font admettre les moyens d'appel des systèmes extérieurs (requête, connexion) et les minuteries par le composant qui les utilise ou les arme. Lu à la lettre, un `fetch` dans une Feature est non conforme.
  - De plus, depuis que D3 permet à la Foundation d'admettre un autre élément que le corps, « hors du corps du document » ne délimite plus le champ de D7 : la partie du corps qui n'est l'élément d'aucune Foundation n'est couverte ni par D3 ni par D7.
- **Proposition :**
  - D7 et B.1 excluent explicitement ce que B.6 attribue à un autre composant : « hors les moyens d'appel des systèmes extérieurs et les minuteries, admis par le composant qui les utilise ou les arme (B.6) ».
  - Dans D7, 16.8, B.1 et le préambule de l'annexe A, remplacer « hors du corps du document » par « hors des éléments admis par les Foundations (D3) ».

### C2 — Le critère de G5 n'est connu qu'après l'exécution

- **Où :** G5, A3.g, 9.11, T2 (point 3), contre-exemple de A3.g.
- **Problème :** G5 fait exception pour « le traitement d'un message adressé qui rend une réponse ». Qu'un traitement rende une réponse ne se sait qu'à la fin. L'infrastructure de communication doit pourtant choisir *avant* de délivrer : maintenant, ou en file. Deux suites :
  1. A3.g n'interdit la réponse qu'à un traitement qui exécute une opération exclusive. Une demande de changement refusée sans rien modifier peut donc rendre une réponse, et il aurait fallu, rétroactivement, l'exécuter de façon synchrone.
  2. Le contre-exemple de A3.g, « le traitement d'une demande de changement rend une réponse », ne viole A3.g que si ce traitement exécute aussi l'opération.

  Par ailleurs, 9.11 et G5 situent la réponse « au cours du traitement de l'auteur ». Or l'auteur d'une Query n'est pas toujours en traitement : c'est le cas d'une View qui admet un clic, ou d'un Composer à sa création (voir V1).
- **Proposition :** porter le critère sur l'acte d'adresser, connu avant la délivrance.
  - 9.6 (note) : « Un message est adressé pour réponse ou sans réponse ; son auteur en décide en l'adressant. »
  - 9.11 : « Information rendue par transport à l'auteur d'un message adressé pour réponse, produite par le traitement de ce message, pendant l'exécution de l'auteur, qui la reçoit sans attendre aucun fait ultérieur. »
  - A3.g : « Seul le traitement d'un message adressé pour réponse rend une réponse, et il n'exécute aucune opération exclusive. »
  - G5 : « Seul le traitement d'un message adressé pour réponse s'exécute pendant l'exécution de son auteur. »
  - T2, point 3 : « Son traitement exécute une opération exclusive : le message est adressé sans réponse (A3.g). » Point 5 : « message adressé pour réponse ».
- **Arbitrage :** le terme. « Pour réponse » évite « attente », qui heurterait 9.3 : un traitement n'attend aucun fait ultérieur, et si une réponse n'en est pas un, le mot prête à confusion. Le terme retenu entre au §2.4.

### C3 — La Query réentrante lit un état intermédiaire

- **Où :** G5 et sa note (§13), 18.13, T2 (point 5) ; guide, « Un traitement à la fois » (E1).
- **Problème :**
  - C, en cours de traitement, adresse une Query à D ; le traitement de D adresse à son tour une Query à C. C y répond pendant son propre traitement, inachevé, donc à partir d'un état intermédiaire, que les axiomes ne contraignent pas (§2.5).
  - La note sous G5 devient fausse : « le composant qui y répond n'est en cours de traitement que s'il en est lui-même l'auteur, puisque seul l'auteur l'est ». Ici, C est en cours de traitement sans être l'auteur de la Query de D. La conclusion « elle est donc produite, pour tout autre composant, à partir d'un état issu d'un traitement achevé » tombe avec elle, de même que la phrase du guide « une Query lit toujours un état complet ».
  - 18.13 dit qu'un message adressé à son propre Channel « est mis en file comme tout message (G5) ». C'est impossible pour une Query, que G5 exécute aussitôt : un composant qui s'interroge lui-même lit son propre état intermédiaire.
- **Proposition :**
  - G5, nouvelle phrase : « Elle ne délivre pas un message adressé pour réponse à un composant dont une exécution est en cours ; l'adressage est refusé et signalé avec le contexte causal de l'auteur. » La Query vers soi-même en est un cas particulier.
  - Note sous G5 : remplacer le raisonnement par un renvoi à cette phrase.
  - 18.13 : restreindre la réponse aux messages adressés sans réponse.
  - `gardes.md` : la Query vers son propre Channel est détectable au démarrage (D16) ; la réentrance en général ne l'est qu'à l'exécution, et relève d'un test de conformité de G5.
- **Arbitrage :** interdire (recommandé), ou permettre en déclarant que la réponse peut provenir d'un état intermédiaire. T5 n'en dépend pas, puisqu'une Query ne modifie rien. Mais la seconde voie retire au développeur la seule promesse simple de la Query : lire un état achevé.

### C4 — §2.5 et la note sous G7 promettent plus que G7

- **Où :** §2.5 (règle de lecture, dernière phrase), note sous G7 (§13), G7, 16.5 ; guide, « Et si un traitement échoue ? » (E5).
- **Problème :** G7 exclut expressément « les ressources du modèle que l'hôte matérialise ». Or la part d'une View, le titre tenu par l'adaptateur du document ou le stockage admis en sont. Pourtant :
  - §2.5 : « Un traitement interrompu par une erreur est sans effet sur les ressources du modèle (G7) : son issue est l'état qui le précédait. »
  - §13 : « Par G7, un traitement interrompu n'a pas d'autre issue que l'état qui le précédait. »

  Une View dont le traitement échoue à mi-chemin laisse une part qui mêle l'ancien et le nouvel affichage. Le conseil de la note et du guide, confier ses effets sur l'hôte à un adaptateur par une Command, ne s'applique pas à la part d'une View : aucun adaptateur ne la tient.
- **Proposition :**
  - §2.5 : « … est sans effet sur les ressources du modèle que l'hôte ne matérialise pas (G7) : pour celles-ci, son issue est l'état qui le précédait. »
  - Note sous G7 : même restriction.
- **Arbitrage :** ce qui vaut pour les parts des Views.
  1. **Écritures différées** : Bonsai n'applique les projections d'une View à sa part qu'à la fin du traitement ; G7 couvre alors les parts. C'est cohérent avec les projections N1 (`getUI(…).text(…)`), qui passent déjà par Bonsai.
  2. **Issue partielle admise** : la part peut rester incohérente jusqu'au message suivant ; la règle de lecture et le guide le disent.

  Recommandation : l'option 1, qui rend la règle de lecture vraie partout où Bonsai écrit lui-même.

### C5 — 8.2 : « une identité ne se modifie pas » contredit 6.5

- **Où :** 8.2 (note), 6.5 (note).
- **Problème :** 8.2 : « Une identité ne se modifie pas et ne prend fin qu'avec son propriétaire. » La même définition donne pour opération exclusive l'attribution de parts en son sein, et 6.5 établit que l'attribution « modifie donc la ressource distribuable ».
- **Proposition :** « Une identité ne se modifie que par l'attribution de parts en son sein, et ne prend fin qu'avec son propriétaire (A2.d). »

### C6 — D12 : le Composer « n'est propriétaire d'aucun état »

- **Où :** D12, 16.6 (premier et dernier points) ; guide, Composer.
- **Problème :** 16.6 fait du Composer le propriétaire du contenu de son slot, qui change à chaque attribution : c'est un état (4.2). Le dernier point de 16.6 reprend la même formule (« n'a pas d'état »).
- **Proposition :** dans D12 et 16.6 : « Il n'est propriétaire d'aucun état autre que le contenu de son slot et l'existence de ses Views. » Le guide (« il n'a pas d'état propre ») ajoute « hors le contenu de son slot ».

### C7 — D9 compte en largeur ce qu'il dit compter en profondeur

- **Où :** 10.4, D9 ; guide, « Et une boucle ? ».
- **Problème :**
  - 10.4 définit la chaîne causale comme une « suite constituée d'une origine et des continuations qui s'y rattachent directement ou indirectement ». Dès qu'un Event a plusieurs destinataires qui produisent chacun des messages, ce n'est pas une suite mais une arborescence.
  - D9 : « Une chaîne causale compte au plus un nombre fixé de continuations », ce qui compte toutes les branches, puis : « La borne porte sur la profondeur d'une chaîne, non sur sa largeur. » Les deux phrases se contredisent, et « profondeur » n'est défini nulle part.
- **Proposition :**
  - 10.4 : « Ensemble constitué d'une origine et des continuations qui s'y rattachent directement ou indirectement. » L'ordre du §17 ne change pas.
  - D9 : « Toute suite de continuations dont chacune continue la précédente, depuis l'origine, compte au plus un nombre fixé de termes, le même pour toute la racine. » La phrase sur la largeur devient une conséquence : un message émis reçu par plusieurs composants ouvre des suites parallèles, et n'allonge chacune que d'un terme.

### C8 — A3.h ne couvre pas les faits émis par les adaptateurs

- **Où :** A3.h, L1 (point 2), 16.8 (troisième point) ; fiches, rubrique 18 ; `document:shortcut`, fermeture imminente (cycle de vie), retour et avance (historique).
- **Problème :**
  - A3.h : un composant « n'émet d'information que sur une ressource dont il est propriétaire ». Un appui sur un raccourci ou une fermeture imminente est un fait, non une ressource : 3.2 ne range parmi les ressources de l'hôte que ce dont l'état persiste.
  - `document:shortcut` informe donc sur un fait, et L1, dont dépend la voie Event de T2, ne s'applique plus à lui.
  - Les fiches ont remplacé le critère par un autre, plus large : « il n'émet d'information que sur ce qu'il a admis (A3.h) ».
- **Arbitrage :**
  1. **Inscrire avant d'émettre** : un adaptateur inscrit chaque fait qu'il émet dans un état dont il est propriétaire (dernier raccourci, état de fermeture), puis l'émet. A3.h reste intact ; c'est la règle déjà imposée aux Features (contre-exemple de A3.h).
  2. **Source admise comme ressource** : 11.6 pose que l'admission d'une source de faits en fait une ressource de l'admetteur, sur laquelle portent ses Events. Il faut alors élargir 3.2.
  3. **Amender A3.h** : « … ou sur un fait qu'il a admis ». L1 et le point 1 de T2 doivent alors traiter un objet qui n'est pas une ressource.

  Recommandation : l'option 1, la seule qui ne touche ni A3.h ni L1. Dans 16.8 : « il inscrit dans son état les faits qu'il admet, puis les émet sur son Channel » ; dans les fiches, rubrique 18 : « il n'émet d'information que sur son état (A3.h) ».

## 5. Lacunes

### V1 — Exécutions hors traitement : admission, création, démarrage

- **Où :** 9.3, 11.6, A5.a, G5, G7, D8, D14, D18, 16.5, 16.6, 16.9 ; guide, §8.
- **Problème :** un traitement répond à la délivrance d'un message (9.3). Trois sortes d'exécution n'en sont donc pas, et la théorie ne leur donne aucun statut.
  1. **L'admission d'un fait** : une View sur un clic, une Feature à l'arrivée d'une réponse, un adaptateur sur un redimensionnement. Rien ne dit :
     - si elle peut exécuter une opération exclusive (A5.a l'exclut, mais ce n'est écrit nulle part pour l'admission elle-même) ;
     - si elle peut adresser une Query ;
     - si G7 la couvre (une erreur après la production d'une Command : la Command est-elle délivrée ?) ;
     - dans quel ordre D8 range les messages qu'elle produit.

     D18 et 16.5 parlent de « traitement d'un fait », expression sans définition.
  2. **La création d'un composant** : attributions initiales de la Foundation et d'un Composer (premier `resolve`, avec ses Queries « à sa création », 16.6), premier rendu d'une View, état initial d'une Entity. Aucune n'est le traitement d'un message, alors que A5.a pose que « tout changement d'état résulte du traitement d'un message ».
  3. **Le démarrage de la racine**, qui n'est précédé d'aucun message : rien ne lui donne de cause, donc de contexte causal (A5.b) pour ce qu'il produit.
- **Proposition, pour l'admission :**
  - 11.6, note : « L'exécution par laquelle un composant admet un fait n'exécute aucune opération exclusive ; elle produit des messages, qui ont ce fait pour cause, et peut adresser des messages pour réponse (C2). G5, G7 et D8 s'y appliquent comme à un traitement. »
  - D18 et 16.5 : « à l'admission d'un fait ».
- **Arbitrage, pour la création et le démarrage :**
  1. **Amender A5.a** : « Tout changement d'état résulte du traitement d'un message ou de la création d'un composant. » Une règle de lecture s'y ajoute : ce qu'un composant exécute à sa création, avant toute délivrance de message, fait partie de l'opération qui le crée ; la création de la racine a pour cause une origine, le démarrage. Le contre-exemple de A5.a ne change pas.
  2. **Règle de lecture seule**, sans toucher A5.a : la création d'un composant compte comme une partie du traitement en cours chez son créateur, et le démarrage comme le traitement d'un message dont la cause est une origine. C'est plus léger, mais le démarrage n'est le traitement d'aucun message réel : c'est une fiction.
  3. **Statu quo** : interdire tout changement d'état à la création. C'est incompatible avec D14 (enfants créés au démarrage), 16.6 (décision du Composer à sa création) et l'état initial d'une Entity.

  Recommandation : l'option 1, qui dit ce qui se passe réellement sans fiction. Elle est à compléter sur deux points :
  - la création d'un composant au cours d'un traitement fait partie de ce traitement, y compris pour G7 : si la création échoue, le traitement du créateur est interrompu ;
  - les messages adressés pour réponse à la création relèvent de G5 comme ceux d'un traitement.

### V2 — A5.c charge le composant de ce que fait l'infrastructure

- **Où :** A5.c (dernière phrase), remarque sous 3.3, B.4, D9 ; `gardes.md`, ligne A5.c ; guide, §8 (« Ce n'est pas ton code qui fabrique ou recopie le contexte »).
- **Problème :**
  - A5.c : « le composant qui a provoqué le fait en conserve le contexte causal jusqu'à son admission ». Selon la remarque sous 3.3, ce que Bonsai fournit pour transporter les messages relève de l'infrastructure, même logé dans les classes de base, et la règle d'imputation ne s'y applique pas. B.4 range cette restitution parmi les opérations réservées, et le guide l'attribue à Bonsai.
  - L'axiome impose donc au modèle un acte qu'accomplit l'infrastructure.
  - Si le composant conservait lui-même cette information, ce serait une ressource (A0.c) ; or 10.5 dit que le contexte causal n'en est pas une.
- **Proposition :**
  - Nouvelle garantie **G8** : « Elle conserve le contexte causal du traitement au cours duquel un fait est provoqué, et le donne au message par lequel ce fait est admis. »
  - A5.c garde la qualification : « … il en est alors une continuation. »
  - D9 : renvoyer à « (A5.c, G8) ».
  - `gardes.md` : A5.c passe en test de conformité de G8.
  - Conséquence à écrire : G8 ne peut tenir que si le fait est provoqué par une interface fournie par Bonsai. Un `fetch` ou un `setTimeout` bruts perdent le contexte ; d'où une garde statique (lint) sur les appels bruts dans le code des composants.

### V3 — L'identité d'une part du DOM et le statut du sélecteur

- **Où :** 8.1 à 8.4, 9.9, 9.10 (résolution auprès de l'hôte), 16.5 (deuxième et troisième points), 16.6, D6, A2.b, T4.
- **Problème :**
  1. **Qui est propriétaire de l'identité d'une part ?** Une View reçoit « une représentation de l'identité de sa part ». Une identité est une part d'un espace des identités, donc une ressource avec un propriétaire (8.2, A1.a).
     - Si c'est la View, D6 est violée : « ni une View ni un Composer n'est propriétaire d'une identité ».
     - Si c'est son parent, 9.10 fait résoudre à la View une identité dont elle n'est pas propriétaire.
     - L'espace des identités dont elle relève n'est pas nommé : ce n'est pas celui de la racine, qui distingue les Features.
  2. **Un sélecteur satisfait la définition de la référence.** 9.9 : « Information permettant à un composant d'atteindre une ressource […] sans transport. » Résolu auprès de l'hôte, un sélecteur atteint l'élément sans transport : c'est donc, à la lettre, une référence, que A3.d exclut des paramètres de création. La théorie suppose, sans l'écrire, qu'une représentation d'identité n'est pas une référence.
- **Proposition :**
  - 9.9, note : « Une représentation d'identité n'est pas une référence : elle ne permet d'atteindre ce qu'elle désigne qu'après résolution par le propriétaire de la ressource désignée (9.10). »
  - L'élément admis par la Foundation est aussi un espace des identités admis depuis l'hôte (A2.b). L'identité d'une part est une identité subordonnée (8.2), dont le propriétaire est celui de la part.
  - D6 porte alors directement sur ce qui compte : « Ni une View ni un Composer n'est propriétaire d'un Channel. » Dans 16.5 et 16.6, « elle n'est pas adressable (D6, T4) » devient « (D6, 9.6) ».
- **Arbitrage :** l'option ci-dessus, ou bien désigner les parts sans identité, par une simple information. Cette seconde voie perd l'appui de la note proposée pour 9.9, et le sélecteur redevient une référence.

### V4 — Le clic ou le focus hors d'une View n'a pas d'admetteur

- **Où :** 16.7 (quatrième point), D10, D12, A.1 ; fiche du document, rubrique 10.
- **Problème :**
  - Fermer un menu quand on clique ou qu'on déplace le focus ailleurs est un besoin courant. Le fait survient soit dans la part d'une autre View, qui l'admet (D10), soit dans la portion non attribuée d'un Composer, qui n'admet rien (D12) : la View du menu ne peut pas l'admettre.
  - 16.7 renvoie « le focus qui sort de la part » à un adaptateur, mais aucun ne le prévoit. A.1 ne liste comme saisies de niveau document que les raccourcis déclarés, et le focus de la fenêtre (A.6) n'est pas celui d'un élément.
  - Faire admettre le même clic à la fois par la View cible et par l'adaptateur du document violerait A5.d.
- **Proposition :** l'appui du pointeur et l'entrée du focus sont des faits de l'hôte distincts du clic et de la saisie. Les ajouter à A.1 comme sources de niveau document déclarables, admises par le seul adaptateur du document. Celui-ci émet par exemple `document:pointerDown` et `document:focusMoved`, avec l'information désignant la part concernée. Les Views continuent d'admettre le clic et la saisie. 16.7 renvoie alors à A.1.
- **Arbitrage :** la granularité des faits (pointeur et clic distincts), ou bien ne rien prévoir en V1 et le dire.

### V5 — L'échec d'une Query n'a pas d'issue définie

- **Où :** G7, 9.11, note sous G5 ; `ecarts-V0.9.2.md`, X7 (`null` en cas d'échec, I55).
- **Problème :** G7 : « aucune réponse n'est rendue ». Mais l'auteur est en pleine exécution et compte sur la réponse pour continuer (9.11). Rien ne dit ce qu'il advient de lui. La note sous G5 affirme : « une erreur survenue dans un traitement ne peut pas en interrompre un autre ».
- **Arbitrage :**
  1. **Propagation** : l'exécution de l'auteur est interrompue avec la Query, G7 s'applique à elle, et ainsi de suite jusqu'à l'exécution la plus extérieure.
  2. **Absence signalée** : l'auteur reçoit une absence de réponse, distincte de toute valeur (cf. X7), et poursuit.

  Recommandation : l'option 1. Elle préserve G7, l'auteur ne pouvant agir sur une information qu'il n'a pas, et elle est simple à tester. G7 : « … et aucune réponse n'est rendue : l'exécution de l'auteur est interrompue à son tour. » Note sous G5 : « … ne peut pas en interrompre un autre, hors l'exécution de l'auteur d'une Query (G7). »

### V6 — D13 : « clés qui ne se recoupent pas » est ambigu

- **Où :** D13, 16.7 ; `gardes.md`, ligne D13 ; guide, Behavior (`TrackingBehavior`).
- **Problème :** « … et ses clés ne recoupent pas les siennes » : le possessif est ambigu (Behavior ou View), et surtout on ne sait pas si ce sont les noms ou les éléments désignés qui ne doivent pas se recouper. Si ce sont les éléments, l'exemple du guide viole D13 : la View et son `TrackingBehavior` réagissent au même bouton « Ajouter au panier ».
- **Proposition (si le sens est « noms ») :** « Le code d'un Behavior ne désigne ni la View qui le déclare ni les clés de celle-ci ; les noms de ses clés sont distincts de ceux des clés de la View. Une clé du Behavior et une clé de la View peuvent désigner le même élément : un fait qui y survient est admis une fois, par la View (16.7). »

### V7 — 16.9 promet à la compilation un contrôle entre racines

- **Où :** 16.9 (troisième conséquence), B.2 (troisième point) ; `gardes.md`, ligne B.2 ; fiches du document et de l'historique, rubrique 26.
- **Problème :** 16.9 range « l'unicité par hôte des adaptateurs (B.2) » parmi ce qui est vérifiable « à la compilation lorsque le Manifest est écrit d'un seul tenant ». L'unicité par hôte oppose pourtant les Manifests de racines distinctes, qui ne se transmettent rien (G6) et qu'aucune compilation ne voit ensemble.
- **Proposition :** retirer l'unicité par hôte de cette énumération, et ajouter : « L'unicité par hôte, qui oppose les Manifests de racines distinctes, n'est vérifiable qu'au démarrage de la seconde racine. » `gardes.md` (niveau démarrage) est déjà juste.

## 6. Formulations imprécises

| Id | Constat | Où | Proposition |
| --- | --- | --- | --- |
| F1 | Termes employés dans des énoncés normatifs sans définition ni place dans le métalangage : « démarrage » (D14, §19), « erreur » (G7, §2.5), « signaler » (D9, G7), « déclarer » (D10, D16). « Slot » (16.5, 16.6, D11) n'est défini nulle part. | §2.3, §16 | Ajouter les quatre premiers au métalangage, et gloser « démarrage » : la création de la racine et de ses enfants. Définir le slot dans 16.5 : « élément de la part d'une View dont le contenu est attribué à un Composer ». |
| F2 | O2 énumère trois niveaux (construction, démarrage, exécution), alors que le §19 en fixe quatre, avec le niveau statique. D16 dit « à la compilation ». | O2, D16, §19 | Aligner O2 et D16 sur les quatre niveaux du §19. |
| F3 | 18.11 (rattachement au registre) est encore ouverte. Or `registre-V0.9.2.md` donne à chaque principe et à chaque invariant un statut et son fondement, `gardes.md` cite les `I<n>`, et l'en-tête annonce le registre rattaché. Les questions 18.7 à 18.10, dont elle attendait l'arbitrage, sont toutes tranchées. De fait, elle est à la fois ouverte et tranchée, ce que l'introduction du §18 exclut. | 18.A, en-tête, `theorie-passation.md` (ligne 44) | Ligne de 18.B : « Chaque principe `P<n>` et chaque invariant `I<n>` reçoit un statut et l'élément de la théorie qui le fonde. Le report dans `docs/invariants/` relève de l'alignement du dépôt. » Portée par `rapports/registre-V0.9.2.md`. 18.B triée par numéro. |
| F4 | A.10 : « messages entre onglets ou cadres : frontière ambiguë ». Le catalogue étant fermé, ces sources sont hors catalogue V1, donc non conformes (B.1). | A.10 | « Hors catalogue V1 : non conforme (B.1) ; l'interlocuteur est souvent une autre racine (G6). » |
| F5 | G6 : « ni ne rend une réponse qu'à un composant de la même racine que son auteur ». Une réponse va toujours à l'auteur : la clause visée est que la Query ne soit pas traitée dans une autre racine. | G6 | « Elle ne délivre un message qu'à un composant de la même racine que son auteur ; une réponse n'est donc produite que dans cette racine. » |

**Suggestion liée à F3 :** plutôt que de laisser 18.A vide, y ouvrir les constats qui attendent un arbitrage (C2, C3, C4, C8, V1, V3, V4, V5), sous les numéros 18.16 et suivants. La théorie enregistre ainsi elle-même ce qui reste à trancher, et chaque réponse viendra s'inscrire en 18.B.

## 7. Guide et fiches

Le guide et les fiches suivent la théorie : chaque point se corrige après le constat dont il dépend.

| Id | Constat | Où | Proposition |
| --- | --- | --- | --- |
| E1 | « Un traitement à la fois » oublie le message local. Il donne la condition d'innocuité de la Query (« puisqu'elle ne modifie rien ») pour sa raison d'être. Et « une Query lit toujours un état complet » ne tient pas sans C3. | guide, §6 | « Quand un composant adresse une Command, émet un Event ou se transmet un message local, le message n'est pas traité sur-le-champ : il attend la fin du traitement en cours. Seule la Query fait exception : son auteur a besoin de la réponse pour continuer, et un traitement n'attend rien. Elle est donc traitée aussitôt, et c'est sans danger parce qu'elle ne modifie rien. » Garder la phrase sur l'état complet si C3 est tranché par l'interdiction. |
| E2 | En cas de refus du serveur, la Feature « peut émettre un Event d'échec ». Par A3.h, elle doit d'abord inscrire l'échec dans son Entity : c'est le contre-exemple même que le guide donne pour A3.h. | guide, §8, deuxième remarque | « … laisse le panier cohérent, inscrit l'échec dans son état, puis peut émettre un Event d'échec. » |
| E3 | « Personne ne peut donc la détruire […] : ni une View, ni l'hôte » contredit la phrase qui suit : c'est l'hôte qui met fin à la racine. | guide, §9, « Le domaine survit à tout » | « ni une View, ni l'Application ; seul l'hôte met fin à la racine, et à tout ce qu'elle contient. » |
| E4 | « Tout ce qui vient du navigateur hors du corps de la page […] passe par un adaptateur » : même raccourci que C1. | guide, §9, « Les adaptateurs de l'hôte » | Suivre C1 : « hors les requêtes et les minuteries, admises par le composant qui les lance ». |
| E5 | « Bonsai annule le traitement (G7) : aucun changement de l'Entity n'est conservé » : juste pour l'Entity, mais le paragraphe laisse croire que rien ne subsiste. | guide, §6, « Et si un traitement échoue ? » | Suivre C4 : dire ce qu'il advient de la part d'une View. |
| E6 | Fiches, rubrique 18 : « il n'émet d'information que sur ce qu'il a admis (A3.h) » élargit A3.h (C8). Fiche du défilement, rubrique 27 : « la position est restaurée en continuation de `history:navigated` ». Si c'est une View qui adresse `scroll:restore` en réaction à cet Event, D18 est violée ; la restauration doit être une projection tenue par l'adaptateur lui-même. | `adaptateurs/` | Rubrique 18 selon C8 ; rubrique 27 du défilement : « l'adaptateur du défilement reçoit `history:navigated` et restaure la position, sans Command (D18) ». |

## 8. Matrice de traçabilité (M)

| Constat | Ligne | Cause probable |
| --- | --- | --- |
| A3.g et A3.h absents : « Axiomes (25) » au lieu de 27. | section Axiomes | le générateur ne reconnaît que les clauses a à f |
| 11.7 (frontière de confiance) absente : « Définitions (42) » au lieu de 43. Le §17 compte 51 termes, soit 8 primitifs et 43 définitions. | section Définitions | le générateur s'arrête à 11.6 |
| T5 dépend de « O1, O2 ». C'est la démonstration qui nomme « O1 » et « O2 » les propriétaires de R1 et R2. Lue telle quelle, la matrice fait reposer T5 sur des objectifs, ce que 2.6 interdit. | T5 | identifiants reconnus hors de tout renvoi |
| 18.11 dépend de « 9.2 » (abonnement) : c'est le jalon « V0.9.2 ». | 18.11 | même cause |
| Les dépendances des décisions ignorent les renvois aux sections : D11 n'a que « O3 » (la théorie : « §16, O3 ») ; D17 « A5, O3 » (la théorie : « règle de méthode du §16, O3, A5 »). | D11, D17 | les renvois `§n` ne sont pas reconnus |
| Les rôles 16.2 et 16.3 n'ont aucune dépendance, alors que leurs notes renvoient à A4.a, D15, D17, T6, 9.5. | 16.2, 16.3 | seule la phrase de définition est lue |
| D5 (retirée) affiche « à rédiger (V0.8) ». | D5 | valeur par défaut |
| Jalons des questions : toutes portent « V0.6 ». D'après l'ancien journal de l'en-tête, repris dans la colonne « Tranchée en » de 18.B, 18.13 et 18.15 sont tranchées en V0.7 ; 18.4, 18.5, 18.8, 18.9, 18.10 et 18.12 en V0.8 ; 18.14 en V0.9 ; 18.7 en V0.9.1. « V0.6 » ne vaut que pour 18.1, 18.2, 18.3 et 18.6. | section Questions | jalon fixe |
| L'ordre des questions reproduit le désordre de 18.B. | section Questions | suit la théorie |
| L'en-tête annonce comme « laissées pour plus tard » les colonnes garde et test, désormais dans `gardes.md`. | en-tête | texte figé |

**Proposition :** corriger le générateur (il n'est pas dans le dépôt) :

- ne reconnaître un identifiant que dans un renvoi (entre parenthèses, ou après « par », « voir ») ;
- reconnaître `§n` et toutes les lettres de clause ;
- lire les notes des rôles ;
- reprendre le jalon des questions dans la colonne « Tranchée en » de 18.B ;
- rendre neutre la ligne d'une décision retirée ;
- tirer la colonne « Garde » de `gardes.md` ;
- trier par identifiant.

Ne régénérer la matrice qu'une fois les corrections de la théorie faites, en dernier.

## 9. Points mineurs

- En-tête de la théorie daté du 26 octobre. Le journal des versions, un seul paragraphe de plusieurs centaines de mots, gagnerait à passer en annexe.
- §1 : l'item 7 dit « justifiées par un objectif ou une conséquence », alors que le §2.6 dit « un objectif, une conséquence, ou la clause d'axiome ou la définition qu'elle met en œuvre ». La liste des rôles du §1 omet l'adaptateur de l'hôte.
- 16.1 : « parent des Features et de la Foundation » omet les adaptateurs, mentionnés plus bas.
- 16.5 : la View adresse des messages « aux Channels du domaine », mais aussi aux adaptateurs de l'interface (`history:back`, presse-papiers).
- 16.7 : « hors de la part de sa View, hors le contenu de ses slots » se lit mal ; écrire « ni hors de la part de sa View, ni dans le contenu de ses slots ».
- 16.9 : le Manifest déclare l'élément de la Foundation, pas sa classe.
- D16 : « un composant déclare, avant le démarrage » ; une View est créée après le démarrage, mais son contrat est dans son code, connu avant.
- D3, D7, D10 et D15 parlent du document, de son corps et de l'adresse, alors que 3.2 ne présuppose aucun navigateur. Les présenter comme propres à l'hôte navigateur, comme l'annexe B.
- 18.B : lignes hors de l'ordre numérique (18.15 avant 18.14, 18.6 en dernier).
- `ecarts-V0.9.2.md`, X8 : « D27 » désigne une décision de l'ancien dépôt.

## 10. Arbitrages requis

| Id | Question | Recommandation |
| --- | --- | --- |
| C2 | Terme pour l'acte d'adresser avec réponse | « adressé pour réponse » |
| C3 | Query réentrante | interdire, refus signalé par l'infrastructure |
| C4 | Échec d'un traitement et parts des Views | écritures différées : G7 couvre les parts |
| C8 | Faits émis par les adaptateurs | inscrire avant d'émettre |
| V1 | Création et démarrage | amender A5.a (option 1), avec ses deux compléments |
| V2 | Conservation du contexte des faits provoqués | nouvelle garantie G8 |
| V3 | Identité des parts du DOM | identité subordonnée de l'élément de la Foundation ; D6 porte sur les Channels |
| V4 | Clic ou focus hors d'une View | sources de niveau document déclarables (pointeur, focus), ou rien en V1 |
| V5 | Échec d'une Query | propagation à l'auteur |
| V6 | Sens de « clés » dans D13 | les noms |

## 11. Ordre de traitement proposé

1. **Corrections sans arbitrage** : C1, C5, C6, C7, V7, F1 à F5, points mineurs.
2. **Zone G5 et G7**, à traiter ensemble car les formulations s'emboîtent : C2 (le terme), puis C3 et V5, puis V1, puis C4.
3. **Statut des informations** : V2 (G8), C8, V3.
4. **Interface utilisateur** : V4, V6.
5. **Répercussions**, en dernier :
   - `gardes.md` : lignes nouvelles ou modifiées pour C3, C4, V2 et V7 ;
   - le guide et les fiches (E1 à E6) ;
   - la matrice régénérée (M).

**État au 29 octobre.** L'étape 1 est appliquée : C1, C5, C6, C7, V7, F1 à F5, et les points mineurs. Le journal des versions est supprimé plutôt que déplacé en annexe : l'en-tête renvoie aux rapports, l'historique est dans git, et la version qui a tranché chaque question figure dans 18.B (colonne « Tranchée en »). Avec elles, les points du guide et des fiches qui ne dépendent d'aucun arbitrage : E1 (la phrase « une Query lit toujours un état complet » attend C3), E2, E3, E4, et la rubrique 27 de la fiche du défilement (E6). Les autres points attendent leur arbitrage, et la matrice (M) attend la correction de son générateur. 18.11 est passée en 18.B ; 18.A renvoie au §10 du présent audit.

## 12. Correspondance avec les rapports fusionnés

« Relecture » désigne la relecture de fond du 29 octobre ; « Complémentaire » la relecture complémentaire du même jour, dont les numéros 1 à 15 sont ceux employés en conversation.

| Audit | Relecture | Complémentaire |
| --- | --- | --- |
| C1 | C1 | 1 |
| C2 | I2 (en partie) | 2 |
| C3 | — | 3 |
| C4 | — | 4 |
| C5 | — | 5 |
| C6 | C3 | 6 |
| C7 | — | 7 |
| C8 | — | 8 |
| V1 | C2, I1, §5 | 9 |
| V2 | — | 10 |
| V3 | — | 11 |
| V4 | — | 12 |
| V5 | — | 13 |
| V6 | — | 14 |
| V7 | — | 15 |
| F1 | I3 | — |
| F2 | I4 | — |
| F3 | I5 | Q |
| F4 | I6 | — |
| F5 | I7 | — |
| E1 à E6 | §4 (guide, en partie) | — |
| M | I8 | M |
