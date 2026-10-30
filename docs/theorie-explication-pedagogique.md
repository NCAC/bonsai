# Bonsai expliqué — la théorie pour bien démarrer

30 octobre 2026 · @ncac · théorie V0.9.5

Ce guide explique la [théorie V0.9.5](theorie.md). Il reste informatif : la théorie fait autorité, et son annexe C normative prévaut pour les protocoles transversaux, même sur une formulation abrégée d'une garantie ou d'un rôle. Cette explication n'atteste aucune conformité de l'implémentation.

## 1. Pourquoi une théorie ?

La plupart des frameworks se présentent comme une liste de bonnes pratiques : « ne fais pas ceci », « préfère cela ». On les apprend par cœur, puis on les oublie dès qu'un cas sort du tutoriel.

Bonsai fait autrement. Il part de **quelques règles de base**, et presque tout le reste **en découle**. Si tu comprends pourquoi une règle existe, tu sais quoi faire même dans un cas que personne n'a prévu. C'est le but de ce guide : non pas te donner des consignes, mais te montrer d'où elles viennent.

### Comment est construite la théorie

Pense aux règles d'un jeu de société. Il y a des pièces, un plateau, quelques règles fondamentales, puis des situations qu'on peut déduire de ces règles, et enfin des choix propres à une variante du jeu. Bonsai est organisé de la même façon :

| Niveau | Ce que c'est | Exemple aux échecs |
| --- | --- | --- |
| **Termes primitifs** | Les mots de base, qu'on ne définit pas | « pièce », « case » |
| **Définitions** | Des mots construits à partir des précédents | « échec » : un roi attaqué |
| **Axiomes** | Les règles fondamentales, imposées | « le fou se déplace en diagonale » |
| **Conséquences** | Ce qu'on démontre à partir des axiomes | « un fou reste toujours sur la même couleur » |
| **Garanties** | Ce que Bonsai promet de faire lui-même, pour toi | la pendule qui ne s'arrête jamais en cours de coup |
| **Objectifs** | Les buts que Bonsai poursuit, sans en faire des règles | une partie agréable à jouer et à rejouer |
| **Décisions** | Des choix propres à Bonsai, que les axiomes n'imposent pas | le temps à la pendule d'un tournoi |
| **Rôles** | Les pièces que tu manipules, construites à partir de tout le reste | le cavalier, la tour |
| **Gardes** | Ce qui vérifie concrètement que les règles sont respectées | l'arbitre |

Deux habitudes du document de référence méritent d'être connues :

- **Un mot, un sens.** Chaque notion a un seul nom, et chaque nom une seule notion. Si deux personnes peuvent comprendre un mot différemment, il est défini précisément.
- **Chaque règle a son contre-exemple.** Pour chaque axiome, on décrit une situation qui le viole. Si on n'en trouve aucune, la règle ne sert à rien : elle répète une évidence.

Dans ce guide, les renvois entre parenthèses (A1, T2, D17, G5…) identifient les énoncés de la théorie. Ce qui est marqué *« Ce qui découle »* est établi sous ses hypothèses explicites, garanties contractuelles comprises ; ce qui est marqué *« choix de Bonsai »* est une décision obligatoire dans le profil qui l'adopte ; les encadrés **Image** sont des comparaisons, jamais des règles. Au §14 de la théorie, **L1 est une reformulation normative d'A3.i**, et **T2 une classification et dénomination des contrats**, non deux découvertes depuis la seule propriété. Les garanties d'infrastructure sont des hypothèses contractuelles, pas des théorèmes déduits des axiomes.

### L'exemple qui nous suivra

Tout au long du guide, on prendra une petite boutique en ligne avec un **panier** : l'utilisateur ajoute des articles, voit le total, et valide sa commande. C'est assez simple pour tenir en tête, et assez riche pour illustrer chaque règle.

## 2. Le décor : le modèle et ce qui l'entoure

Avant de parler de règles, il faut savoir **de quoi** elles parlent. Bonsai distingue quatre zones, et tout ce qui intervient dans une application appartient à exactement l'une d'elles. Chaque modèle non abandonné a une seule racine ; les autres composants lui sont reliés par une chaîne finie de parents. Les composants et ressources présents sont en nombre fini ; cela ne promet pas la terminaison d'un code applicatif arbitraire.

- **Le modèle**, c'est ton application : ce que Bonsai organise. Il contient trois sortes de choses, toujours distinctes : des **composants** (les acteurs), des **ressources** (ce dont les acteurs sont propriétaires) et des **messages** (ce qu'ils se transmettent).
- **L'hôte**, c'est l'environnement qui fait tourner l'application : le navigateur, le document, la fenêtre. L'application en dépend, mais il n'en fait pas partie, et Bonsai ne le contrôle pas.
- **L'infrastructure de communication**, c'est le service postal : elle achemine les messages entre composants. Elle ne fait pas partie du modèle non plus : elle n'est propriétaire de rien et ne prend part à aucune conversation.
- **Les systèmes extérieurs** sont les services avec lesquels l'application échange des informations : une API de paiement, un serveur de données. Ils ne fournissent pas à l'application ses conditions d'existence, comme l'hôte, et ne transportent pas ses messages, comme l'infrastructure de communication.

**Attention : l'infrastructure de communication n'est pas Radio.** Le nom est volontairement celui d'un ensemble : c'est **toute la logique de communication qui n'appartient pas à l'API publique** : Radio, qui en est la pièce centrale, mais aussi la tuyauterie interne des classes de base, celle qui se cache derrière `trigger()`, `query()`, `emit()` ou l'abonnement aux Events. Quand une View écrit `this.trigger("cart:addItem", …)`, elle ne voit jamais Radio : c'est la classe de base `View`, fournie par Bonsai, qui prend le message en charge, y attache son contexte causal et le fait acheminer. Cette tuyauterie fait partie de l'infrastructure de communication.

La frontière est simple : **ce que le développeur écrit appartient au modèle ; ce que Bonsai fait pour transporter ses messages appartient à l'infrastructure de communication.** Le développeur ne peut ni la contourner ni la modifier, et c'est ce qui lui permet de tenir ses garanties.

**Pourquoi cette séparation ?** Parce que les règles de Bonsai ne s'appliquent qu'au modèle. Si l'infrastructure de communication était un composant comme les autres, il faudrait lui inventer des exceptions partout : transmettre un message reviendrait à lui parler, ce qui demanderait un message, et ainsi de suite sans fin. En la sortant du modèle, on lui donne des **garanties** (G1 à G8), explicitées par l’annexe C : bon destinataire, capture des valeurs sans alias mutable, aucune délivrance à un destinataire détruit même sans Channel, absence de propriété dans le modèle, Queries vers des cibles prêtes et inactives, isolation des racines, annulation interne en cas d'échec et gestion des déclenchements observables. Ces garanties engagent Bonsai : elles appellent des tests de conformité de l'infrastructure, pas des gardes du code applicatif.

### La règle : A0 — Cadre

> 1. Tout ce qui intervient relève d'une seule des quatre zones : le modèle, l'hôte, l'infrastructure de communication ou un système extérieur.
> 2. Le modèle ne contient que des composants, des ressources et des messages, et rien n'est à la fois deux de ces choses.
> 3. Tout ce qu'on peut connaître ou changer d'un composant est son existence ou une ressource dont il est propriétaire.
> 4. À chaque composant est associée exactement une existence, et chaque existence concerne exactement un composant ; cette association ne change pas. Celle d'un non-racine est une ressource du modèle créée avec lui ; celle de la racine reste extérieure, fournie par l'hôte et jamais admise par un composant.
> 5. Une application a une seule racine ; tout autre composant y remonte par une chaîne finie de parents, et elle contient un nombre fini de composants et de ressources.

**Contre-exemples :** un registre de Channels fait à la fois partie de la tuyauterie de l'infrastructure et de l'état qu'un composant modifie ; un « service » qui n'est ni composant, ni ressource, ni message est appelé par les composants ; un composant expose un cache interne qui n'est pas une ressource, et un autre l'interroge ; deux composants sont chacun le parent de l'autre.

**Pourquoi ?** A0 ferme les portes de sortie. Toutes les autres règles portent sur les composants, les ressources et les messages : s'il existait une quatrième sorte de chose dans le modèle, ou une zone floue entre le modèle et le reste, il suffirait d'y ranger ce qui gêne pour échapper à la théorie.

**Pourquoi « primitifs » ?** Modèle, hôte, infrastructure de communication, système extérieur, composant, ressource, message, propriété : ces huit mots ne sont pas définis à partir d'autres. Ce sont les briques de départ, comme « point » et « droite » en géométrie. Leur sens se précise par les règles qui les utilisent.

## 3. Qui est propriétaire de quoi

### Les mots

- Une **ressource** est quelque chose dont un composant peut être propriétaire : l'état du panier, une adresse de messagerie, un morceau de la page.
- La **propriété** est le lien entre un composant et une ressource. Le composant est son **propriétaire**.
- Une **opération exclusive** est une opération qui *modifie* ou *détruit* une ressource. Lire n'en est pas une.
- Un **état** est une ressource qui peut changer pendant la vie de l'application, comme le contenu du panier.

### La règle : A1 — Propriété unique

> Toute ressource actuellement présente dans le modèle a **exactement un** propriétaire lui-même présent, et **seul** ce propriétaire la modifie ou la détruit. Un propriétaire historique détruit ne suffit pas. Cela ne confère pas la propriété du support hôte.

**Contre-exemples :** deux composants modifient chacun de leur côté le contenu du panier ; plusieurs composants modifient une variable globale que personne n'a admise.

**Pourquoi c'est la règle la plus importante.** La plupart des bugs d'une interface viennent d'un état modifié depuis plusieurs endroits : on ne sait plus qui a changé quoi, ni dans quel ordre. Avec A1, la question « qui a pu modifier ce panier ? » a toujours une seule réponse. Pour déboguer, tu sais où regarder.

**Et si un autre composant a besoin de modifier le panier ?** Il ne le fait pas : une View le **demande** à son propriétaire, par un message (§6) ; une autre Feature, elle, annonce ce qui s'est passé chez elle, et le panier décide d'y réagir (§9, D17). Bonsai n'autorise aucune « délégation » qui permettrait à un tiers d'agir à la place du propriétaire. C'est plus strict, mais la règle reste vraie sans exception.

**Pourquoi la consultation n'est pas exclusive.** Plusieurs composants peuvent demander à connaître une même ressource sans en devenir propriétaires. Cela ne donne pas un accès direct à la ressource d'autrui : la consultation passe par une Query à son propriétaire (A3).

## 4. D'où vient la propriété

A1 dit qu'il y a toujours un propriétaire. Il reste à savoir **comment on le devient**.

### Les mots

- La **création** est le moment où une ressource commence d'exister.
- Certaines ressources se découpent en **parts**. Une ressource qu'on peut ainsi partager entre plusieurs propriétaires est dite **distribuable**. Exemple : l'ensemble des noms disponibles dans l'application, ou la page affichée.
- L'**attribution** est l'acte par lequel le propriétaire d'une ressource distribuable en délimite une part, la lui retire, et désigne le propriétaire de cette part.

### La règle : A2 — Origine de la propriété

> 1. Celui qui crée ou admet une ressource en est le propriétaire initial. Une part, elle, appartient à celui que désigne le propriétaire de la ressource dont elle vient.
> 2. Une ressource distribuable vient toujours du haut : de la racine de l'application, de l'hôte, ou d'une ressource distribuable plus large.
> 3. On ne change jamais de propriétaire : la propriété dure jusqu'à la destruction de la ressource.
> 4. On n'attribue une part qu'à ses enfants, et une part ne prend fin qu'avec son propriétaire.
> 5. Toute ressource du modèle provient d'une création, d'une admission ou d'une attribution (A2.e) : aucune autre voie ne donne la propriété.

**Contre-exemples :** un composant se choisit lui-même son nom ; un composant crée son propre espace de noms pour s'y nommer ; un composant « donne » son état à un autre ; une View prête une zone de sa page à une View voisine, ou supprime son propre élément racine.

**L'image du prêt.** Attribuer une part, c'est comme prêter une pièce de sa maison à son enfant. Une fois attribuée, sa portion est soustraite au contenant : sinon, les deux pourraient la réaménager en même temps. Deux parts d'un même contenant ne se recouvrent donc pas (T7). À la fin de l'enfant, la part est détruite, pas transférée ; sa portion revient au contenant. Cette **restitution modifie le contenant sans créer de nouvelle part**. Une nouvelle attribution de la même portion crée une autre part. Dans une cascade, les descendants sont clôturés avant les parents : chaque restitution est imputée au propriétaire du contenant encore présent à cette étape, même s'il disparaît ensuite. L'ancêtre initiateur ne reçoit aucune autorité sur les ressources de ses descendants (§2.5).

**Pourquoi « par le haut ».** Imagine que chaque composant choisisse son propre nom : deux d'entre eux finiront par choisir `cart`. Si au contraire les noms sont distribués par un seul propriétaire, la racine, les collisions deviennent impossibles **par construction** : on n'a pas besoin de les détecter, elles ne peuvent pas exister. C'est le principe du `namespace` attribué à chaque Feature par l'Application, d'après le Manifest (§10).

**Pourquoi aucun transfert.** Si la propriété pouvait passer de main en main, la question « à qui est ceci ? » dépendrait du moment où on la pose. En la rendant fixe, elle a une réponse unique pour toute la vie de la ressource. Le prix à payer : on ne déplace pas un composant d'un parent à un autre, on le recrée.

**Admettre ne signifie pas s'approprier le navigateur.** L'admission produit une ressource du modèle distincte de son support hôte : admettre un périmètre de stockage ne transfère pas la propriété de l'objet `localStorage` du navigateur. Les opérations du modèle passent par le propriétaire de la ressource admise ; l'hôte et les acteurs extérieurs gardent leur existence propre. Cette distinction, jointe à A2.e, ferme les prétendues ressources « déjà là » auxquelles aucun propriétaire n'aurait été donné.

### L'identité

Un nom comme `cart` est la **représentation** d'une **identité**, qui est elle-même une part de l'**espace des identités**. La différence compte : l'identité est la ressource attribuée, protégée par A2 ; le texte `"cart"` n'est qu'une manière de l'écrire. Le mot technique **namespace** désigne cette représentation textuelle. Une identité peut être modifiée par attribution de parts subordonnées et par restitution de leurs portions ; elle ne peut pas être détruite isolément avant son propriétaire.

## 5. La famille des composants

### Les mots

- L'**existence** d'un non-racine est une ressource à part, associée à lui seul, et lui n'en a qu'une. La seule opération exclusive qu'on peut faire dessus : la détruire, ce qui détruit le composant. Celle de la racine reste extérieure au modèle.
- Le **parent** d'un composant est le propriétaire de son existence. Ce composant est son **enfant**.
- La **racine** est le composant qui n'a pas de parent dans l'application. Son existence lui est donnée par l'hôte. Dans Bonsai, c'est l'`Application`.
- La **composition** est la relation parent–enfant qui résulte de tout cela.

### L'idée clé : le parent est propriétaire de l'existence, pas de l'enfant

C'est la subtilité qui fait la force de Bonsai. Un parent **n'est pas propriétaire de son enfant** ; il est seulement propriétaire de son existence, c'est-à-dire du droit de le faire disparaître. Il ne peut ni lire son état, ni le modifier, ni appeler ses méthodes. Composants, ressources et messages sont trois catégories qui ne se confondent jamais : un enfant n'est pas une ressource de son parent.

**Pourquoi ?** Dans beaucoup de frameworks, un parent tient une référence vers ses enfants et finit par aller fouiller dedans. Les dépendances cachées s'accumulent, et changer un enfant casse le parent. Ici, le parent contrôle le **cycle de vie** de l'enfant, et rien d'autre.

### Deux conséquences démontrées

- **Qui crée devient parent (T1).** Créer un composant, c'est créer son existence ; par A2, le créateur en devient propriétaire, donc parent. Aucune règle supplémentaire n'est nécessaire.
- **La destruction se propage (T3).** Quand un composant disparaît, toutes ses ressources disparaissent avec lui, y compris l'existence de ses enfants, qui disparaissent à leur tour. Pourquoi ? Une ressource ne peut pas rester sans propriétaire (A1), et elle ne peut pas en changer (A2). Il ne reste qu'une possibilité : disparaître aussi.

En pratique, cela signifie qu'**aucun abonnement ne doit survivre** à son composant : un abonnement oublié sur une View démontée est une violation directe de T3.

Et le `localStorage`, qui survit pourtant au rechargement de la page ? Il n'y a pas de contradiction. Le support conservé par le navigateur reste dans l'hôte. Son admission produit une ressource distincte dans le modèle, pour un périmètre déterminé, qui disparaît avec son propriétaire sans effacer nécessairement ce support. Au rechargement, une nouvelle admission produit une nouvelle ressource ; les valeurs initiales sont rattachées au démarrage de cette application (§8), jamais à une continuation de la session précédente.

## 6. Se parler sans se toucher

Puisqu'un composant ne peut pas toucher aux ressources des autres, il faut un moyen de communiquer. C'est le rôle des messages.

### Les mots

- Un **Channel** est un point de rendez-vous désigné par une identité : on y adresse des messages à son propriétaire, et lui seul y émet. Son propriétaire est celui de l'identité qui le désigne.
- **Adresser** un message, c'est le transmettre à un Channel pour qu'il y soit traité. Un composant peut adresser un message au Channel d'un autre, dans les limites de A4 (§7) et des décisions D17 et D18 (§9).
- **Émettre** un message, c'est le diffuser depuis son propre Channel à tous ceux qui ont demandé à le **recevoir**.
- **Traiter** un message, c'est exécuter quelque chose en réponse. Un traitement est **synchrone** : il se termine sans attendre aucun événement futur.
- Une **réponse** est l'information que le traitement d'un message adressé rend aussitôt à son auteur. Ce n'est pas un message : elle revient dans le même mouvement, pendant que l'auteur poursuit son propre traitement.
- Une **référence** est un moyen d'atteindre directement une ressource ou un composant, sans transport : un pointeur vers une instance ou un élément DOM, par exemple. Une **référence structurelle** va d'un propriétaire vers sa propre ressource ou le périmètre hôte lié à celle-ci, ou d'un parent vers son enfant. L'accès au support ne donne pas sa propriété : une part attribuée ne permet d'agir que dans sa portion, soustraite au parent. Une **désignation**, comme un sélecteur, ne donne pas cet accès direct : sa résolution reste contrôlée par la propriété et le périmètre attribué.
- Un **message différé** est une Command, un Event ou un message local : tout message sauf la Query. Son nom vient de G5 : il n'est délivré qu'une fois terminé avec succès le traitement qui l'a produit.
- Une **unité de validation** est le traitement d'un message différé, ou le démarrage de l'application. C'est à sa fin que Bonsai vérifie les invariants ; si elle échoue, tout ce qu'elle a changé dans le modèle est annulé (G7).
- Une **interaction fonctionnelle** est une transmission d'information d'un composant à un autre, hors paramètres de création, transport et contexte causal. Un calcul interne n'en est pas une.

### La règle : A3 — Médiation

> 1. Toute interaction passe par un message, adressé à un Channel ou émis sur un Channel, et transporté par l'infrastructure de communication.
> 2. Un Channel est désigné par une identité de son propriétaire.
> 3. Un composant n'utilise que des références structurelles.
> 4. Ce qu'un parent transmet à un enfant à sa création ne contient aucune référence.
> 5. Seul le propriétaire d'un Channel traite ce qu'on lui adresse et émet dessus.
> 6. Chaque occurrence de message relève d'exactement une catégorie de transport, fixée à sa production : adressée à un Channel, émise sur un Channel ou locale sans Channel. Réutiliser la même valeur de charge produit des occurrences distinctes. Un local est celui qu'un composant se transmet à lui-même, transporté comme les autres.
> 7. Un traitement qui rend une réponse est en lecture seule, transitivement : aucune mutation, création de ressource, effet sur l'hôte, Command, Event ou message local ; seules les Queries imbriquées sont permises comme messages produits (A3.g).
> 8. On n'informe que sur ce qu'on conserve : un composant n'émet d'information que sur une ressource dont il est propriétaire ; un fait observé doit être inscrit dans son état avant l'Event (A3.h).
> 9. Toute interaction porte sur des ressources déterminées ; un calcul pur interne n'est pas un service autonome auquel les composants pourraient s'adresser hors de ce cadre (A3.i).
> 10. Tout message adressé relève d'un contrat pré-déclaré : demande d'action sans réponse, ou demande de connaissance avec réponse (A3.j). Une action peut être refusée ou ne rien changer ; cela n'en fait pas une Query.

**Contre-exemples :** une View appelle directement une méthode de la Feature ; un composant ouvre un Channel sous le nom d'un autre ; un parent lit l'état de son enfant ; un parent passe une fonction de rappel à son enfant ; une View émet sur le Channel du panier ; la Feature panier compte les consultations de son total dans le traitement qui y répond ; la Feature des commandes émet « commande expédiée » dès la réponse du serveur, sans avoir d'abord inscrit ce statut dans son état.

**Pourquoi le point 8 ?** Un Event dit « voici ce que je sais ». Si ce n'était pas inscrit dans l'état de son émetteur, une Query juste après pourrait le contredire : l'Event annonce « commande expédiée », la Query répond « en préparation ». En inscrivant d'abord, puis en émettant, l'émetteur reste la source de vérité de ce qu'il annonce.

**Pourquoi tant de rigueur ?** Parce que chaque raccourci rouvre une porte dérobée. Prends la fonction de rappel passée à un enfant, le motif des « callbacks en props » de React : elle crée un lien direct et invisible entre deux composants. Personne ne le voit dans le graphe des messages, personne ne peut le tracer. En imposant que tout passe par un Channel, **chaque échange devient visible, traçable et remplaçable**. Les composants communiquent sans se connaître.

### Les trois voies (T2)

T2 **classe et nomme les contrats imposés par A3**, il ne les découvre pas depuis la seule propriété unique. L1 reformule l'obligation d'objet d'A3.i ; A3.j impose les modes adressés, A3.f sépare les catégories de transport, A3.g impose la lecture seule et A3.e/G1 règlent les destinataires. Pour utiliser ce classement, pose-toi deux questions :

1. Est-ce que je veux **changer** la ressource, ou **en savoir** quelque chose ?
2. Est-ce que **je suis** son propriétaire ?

| | Je veux la changer | Je veux en savoir quelque chose | J'en informe les autres |
| --- | --- | --- | --- |
| **Je suis le propriétaire** | je le fais moi-même, sans message | inutile : j'y ai accès | **Event** |
| **Je ne suis pas le propriétaire** | **Command** | **Query** | impossible : je ne la connais pas |

Il existe donc **trois voies d'interaction**, dans le cadre fermé par A1 et A3, notamment l'objet déterminé (A3.i) et le contrat pré-déclaré des messages adressés (A3.j). Le classement dépend du contrat, pas du fait qu'une exécution ait effectivement changé quelque chose : une Command refusée ou sans effet reste une Command. On en déduit aussi leurs comportements :

- une **Command** (`trigger`) et une **Query** (`query()`) n'ont qu'**un seul** destinataire, le propriétaire ;
- un **Event** (`emit`) peut avoir **plusieurs** destinataires (`listen`), puisque recevoir ne donne aucun droit.

Pour notre panier : la View *adresse* `cart:addItem` (Command), *demande* `cart:total` (Query), et *reçoit* `cart:itemAdded` (Event) émis par la Feature panier.

**La Query est une simple consultation.** Elle n'a rien d'une requête réseau. Quand la View demande `cart:total`, le traitement de la Feature s'exécute aussitôt, pendant celui de la View, et lui rend le total en réponse : la View s'en sert dans la ligne suivante, sans attendre. La lecture seule est **transitive** (A3.g) : ni elle ni les Queries qu'elle appelle ne peuvent modifier ou créer une ressource, agir sur l'hôte, produire une Command, un Event ou un message local. Les allocations temporaires nécessaires au calcul restent permises : construire un tableau résultat n'est pas créer une ressource du modèle. Lire librement l'heure ou une valeur aléatoire reste permis, sans promesse de déterminisme. Une Command demande une action et ne rend pas de réponse, même si elle est refusée ou sans effet ; pour connaître le résultat, reçois un Event éventuel ou fais une Query ensuite. Si la connaissance exige un appel réseau, il faut une Command, puis un Event.

### Un traitement à la fois (G5)

Quand un composant adresse une Command, émet un Event ou se transmet un message local, le message attend la validation du traitement de message différé en cours ou la réussite du démarrage. Seule la Query fait exception : son auteur a besoin de la réponse pour continuer, et un traitement n'attend rien. Elle est traitée aussitôt en lecture seule **si sa cible est prête à consulter et inactive** (C.1). Un Channel établi ne suffit pas : une cible non prête est refusée avec erreur, sans attente ni initialisation à la demande. G5 refuse aussi toute cible active dans la pile des traitements ou initialisations, soi-même compris : `A → Query B → Query A` est refusé.

Pourquoi ? Imagine que les messages soient traités immédiatement, à l'intérieur du traitement qui les produit. La Feature panier émet `itemAdded { total: 20 }` ; une Feature `promo`, abonnée la première, réagit en émettant `promo:applied { remise: 2 }` ; le panier, abonné à `promo:applied`, applique la remise et émet `totalChanged { total: 18 }`, que la View reçoit et affiche (18). Puis seulement `itemAdded` atteint la View, qui affiche… 20. Chaque traitement est juste, mais l'écran ment, et c'est l'ordre d'inscription des abonnés qui en décide. De même, une erreur dans le traitement d'une autre Feature interromprait le tien en plein milieu.

Avec cet ordonnancement, chaque traitement extérieur se termine avant le suivant ; les seules imbrications sont les Queries vers des cibles prêtes et inactives. En fonctionnement publié, elles lisent un état interne validé ; pendant l'initialisation autorisée, une cible prête peut encore appartenir à l'unité provisoire, abandonnée si celle-ci échoue. Une erreur de Query remonte jusqu'au traitement extérieur ou au démarrage (G7), au lieu de rester confinée au répondant. La règle à retenir est simple : **après `trigger` ou `emit`, rien n'a encore changé ailleurs.**

**Dans quel ordre ?** Les messages en attente passent dans l'ordre de production. À l'émission d'un Event, ses délivrances réservent leur rang pour les **occurrences d'abonnement alors présentes**, dans leur ordre (C.6, D8). Avant chaque délivrance, Bonsai vérifie la survie du Channel, de l'abonnement réservé et de son propriétaire. Si S est détruit puis remplacé par S′, S′ ne reprend aucun ancien Event ; un abonnement tardif non plus. Une annulation de destruction conserve S et sa réservation. Abandonner une réservation ne réordonne pas les autres et ne fait pas échouer l'émetteur déjà validé. Si ta Feature adresse `A` puis `B`, `A` passe avant `B` ; un message produit par un abonné ne dépasse pas les délivrances déjà réservées. Cet ordre sert le rejeu, à code et faits admis identiques, sous les conditions de déterminisme et d'outillage d'O1.

> **Image : le journal de rejeu.** Rejouer une session, c'est réinjecter les faits enregistrés (clics, réponses du serveur) depuis le même état initial. L'heure et les valeurs aléatoires ne se relisent pas à l'identique : un outil de rejeu les note pendant l'exécution réelle et les restitue dans le même ordre. Cela ne fonctionne que parce que l'ordre des traitements est fixe. C'est une affaire d'outillage, pas une règle de la théorie.

**Et une boucle ?** Si `cart` émet `totalChanged`, que `promo` y réagit en émettant `promo:applied`, auquel `cart` réagit en changeant son total et en émettant à nouveau `totalChanged`, la chaîne pourrait se prolonger sans fin. Bonsai borne la **profondeur des segments de déclenchements établis** : au-delà, le message est rejeté et signalé (D9). Un Event reçu par cinquante abonnés ouvre cinquante branches, chacune allongée d'un pas : D9 ne borne ni le travail total ni la terminaison. Les expirations d'un timer instrumenté répétitif issu d'un même armement sont des continuations sœurs ; réarmer depuis une expiration poursuit la branche. Un polling par réarmements successifs peut atteindre la borne. En revanche, D9 ne borne pas une boucle traversant des notifications non corrélables : la coupure de connaissance reste visible, sans inventer de parent (C.4). Un lien connu ne peut jamais être effacé pour contourner la borne.

**Et si un traitement échoue ?** Le traitement de `cart:addItem` ajoute la ligne, puis plante en recalculant le total. Bonsai restaure ses ressources internes et annule les messages **différés** produits par le traitement (G7). Si l'erreur vient d'une Query imbriquée, elle se propage jusqu'au traitement extérieur : ni remplacement par `null`, ni reprise locale implicite. Aucune réponse réussie n'est fabriquée. Les Queries déjà exécutées restent dans la trace : elles ne sont pas des messages en attente que l'on pourrait annuler.

### Quand vérifier la cohérence (§2.5)

L'autorité du propriétaire est **permanente** : aucun état intermédiaire n'autorise à modifier la ressource d'autrui. Les invariants métier internes sont vérifiés à la fin des unités de validation, à la réussite du démarrage et à la fin de la racine, sans exiger d'atomicité avec l'hôte. Une Query imbriquée ne valide pas son auteur suspendu : celui-ci peut rétablir son invariant, et G5 interdit de le consulter pendant ce temps.

**Le démarrage a sa propre cause.** La structure, les ressources et les Channels sont établis avant les Queries initiales, mais chaque cible doit aussi avoir réussi son initialisation logique et ses validations propres. Les dépendances initiales déclarées ordonnent les initialisations ; un cycle requis est refusé ; l'ordre de déclaration tranche entre cibles sans dépendance restante. Une dépendance conditionnelle reste contrôlée à l'exécution. Les réponses d'une cible prête sont encore **provisoires dans l'unité**, pas celles d'un modèle publié. La publication et les messages différés attendent le succès global ; les admissions survenues entre-temps attendent la clôture. Un échec abandonne le modèle en construction. Créer un composant pendant un traitement suit la même unité provisoire chez son créateur, sans accès d'une unité extérieure ni transfert d'autorité : le créateur est propriétaire de l'existence, pas des ressources de l'enfant. Être logiquement prêt n'exige pas un support hôte déjà matérialisé.

### Le message local

Une Feature lance une requête réseau. Quand la réponse arrive, elle ne peut pas modifier son état directement : le traitement d'origine est terminé, et la règle du traitement synchrone l'interdit. Elle **se transmet un message local** : l'infrastructure de communication le transporte et le lui délivre, à elle seule, sans passer par aucun Channel, et elle le traite normalement.

Pourquoi sans Channel ? Un Channel est désigné par une identité : d'autres composants peuvent y adresser un message ou s'y abonner. Le message local, lui, n'a qu'un destinataire possible, le composant qui l'a produit. Il n'est ni *adressé* ni *émis* : ces deux mots sont réservés aux messages qui passent par un Channel. Comme tout message, il porte un contexte causal : la réponse réseau reste rattachée à la chaîne causale de la requête qui l'a provoquée (§8). C'est un peu plus long à écrire, mais chaque changement d'état reste rattaché à un message, donc traçable.

**Et si une Feature s'adressait une Command sur son propre Channel ?** Elle est différée comme les autres Commands, puis revient à la Feature. Une **Query vers soi pendant un traitement est en revanche refusée** par G5, comme toute Query vers un composant actif dans la pile. Pour réutiliser une logique, un appel de fonction interne suffit ; pour prolonger une chaîne après un fait provoqué, c'est le message local qui est prévu. Pour connaître sa propre Entity, la Feature la lit directement.

## 7. Le domaine et l'interface

### Les mots

- L'**interface utilisateur** regroupe les ressources de présentation du modèle et d'expression des intentions de l'utilisateur (page, boutons, champs), ainsi que leurs propriétaires. Une donnée d'environnement simplement perceptible n'en relève pas pour ce seul motif : le classement existant reste celui du catalogue, notamment Viewport, cycle de vie, connectivité et environnement dans le domaine.
- Le **domaine** est tout le reste : la logique métier, la vérité de l'application. Une ressource appartient toujours à la même partie que son propriétaire.
- Un **invariant métier** est une règle que les données métier doivent respecter à la fin des unités de validation, par exemple « le total du panier égale la somme de ses lignes ». **C'est toi qui les écris**, pour ton application : Bonsai n'en fixe aucun ; la théorie en exige la satisfaction à ces frontières, sans promettre une transaction avec l'hôte ni attester l'implémentation des contrôles.
- Un **système extérieur** est un service avec lequel le domaine échange des données métier, par exemple une API de paiement.

### La règle : A4 — Autosuffisance du domaine

> 1. Les invariants métier internes sont respectés à la fin des unités de validation, démarrage et fin de racine compris, avec ou sans interface ; les Queries imbriquées ne valident pas leur auteur suspendu (§2.5). Ils représentent explicitement intentions, observations, succès et échecs sans exiger d'atomicité avec l'hôte.
> 2. Le domaine n'adresse aucun message à un Channel de l'interface, et ne reçoit aucun message émis par elle.
> 3. Seul le domaine échange des informations métier avec les systèmes extérieurs.
> 4. Les faits métier affichés viennent d'un Event du domaine ou d'une réponse à une Query. Les dérivations de présentation sont permises, sans devenir une autorité métier ; un brouillon reste distinct d'un fait validé (A4.d).
> 5. Un Channel du domaine ne disparaît qu'avec l'application.

**Contre-exemples :** une Command laisse le panier avec un total faux ; la Feature panier reçoit un Event émis par une View ; une View appelle elle-même l'API de paiement ; au clic sur « Ajouter », une View incrémente le compteur du panier affiché sans attendre l'Event de la Feature ; une Feature est détruite alors que l'application continue.

**Les quatre sens de communication.** Le point 2 n'interdit pas au domaine de parler : il interdit seulement deux directions.

| | Interface → domaine | Domaine → interface |
| --- | --- | --- |
| **Adresser** (Command, Query) | ✅ une View adresse `cart:addItem` | ❌ interdit (point 2) |
| **Émettre / recevoir** (Event) | ❌ le domaine ne reçoit rien de ce que l'interface émet | ✅ la Feature émet `cart:itemAdded`, la View le reçoit |

Autrement dit, le domaine ne sait pas que l'interface existe : il annonce ce qui change, et qui veut l'entend.

**Ce que le point 4 permet encore.** Une View peut filtrer, trier, paginer ou reformater une copie du domaine, y compris en réaction à un clic qui change un filtre local. Ces dérivations de présentation n'inventent pas un nouveau fait métier. Une saisie ou un brouillon peut exprimer une valeur souhaitée, mais reste identifiable comme tel, distinct de la valeur validée par le domaine : cliquer sur « Ajouter » n'autorise pas à annoncer un total confirmé que le domaine n'a pas fourni. L'état local de la View peut changer dans **tout traitement autorisé**, y compris celui d'un Event ; c'est l'envoi d'une Command que D18 restreint, pas toute mutation locale.

**Pourquoi le point 5 ?** A4.e pose la continuité des Channels du domaine jusqu'à la fin de la racine ; ce n'est pas une conséquence des seuls invariants d'A4.a. Une autre architecture pourrait détruire un Channel puis refuser les demandes ultérieures tout en restant cohérente ; Bonsai exclut cette alternative. **Existence ne signifie pas disponibilité inconditionnelle** : une Query vers une cible non prête ou active est refusée, et une Command peut être refusée par le métier. Aucune progression générale n'est promise face à un traitement non terminant ou une activité infinie.

**Pourquoi ?** Le domaine est la **source de vérité**. Si sa cohérence dépendait de l'interface, il suffirait de changer d'écran pour casser les données. Avec A4, tu pourrais supprimer toute l'interface : le domaine continuerait de fonctionner correctement, et tu peux le tester sans navigateur. L'interface, elle, dépend du domaine : elle lui adresse des demandes et reçoit ce qu'il annonce. Jamais l'inverse.

### Une conséquence qui guide ta modélisation (T5)

Un traitement ne peut pas modifier conjointement deux ressources **préexistantes** de propriétaires distincts. Si une transition exige de changer les deux pour préserver un invariant strict à chaque frontière, elle est donc irréalisable avec ce découpage. **Si cette transition doit être réalisable, regroupe les ressources sous un même propriétaire**, dans une même Feature pour ses données métier (T5).

Cela ne condamne pas toute relation entre panier et stock : des règles indépendantes ou une coordination par états intermédiaires explicitement admis restent possibles. T5 vise l'exigence d'une transition conjointe, pas toute corrélation entre Features ni un état que l'application n'a pas besoin de pouvoir atteindre.

## 8. Pourquoi les choses changent

### Les mots

- Une **cause** est le fait auquel un message ou un changement d'état est rattaché : un clic, une réponse réseau, une minuterie. Ce n'est ni un composant, ni une ressource, ni un message.
- Une **origine** est une cause sans antécédent établi dans le périmètre observé ; une **continuation** poursuit une cause antérieure dans ce périmètre. Ensemble, elles forment une **chaîne causale**. L'origine est qualifiée **démarrage**, **spontanée** si l'indépendance est établie, ou **observation à antécédent inconnu** quand le protocole ne peut établir ni parent unique ni indépendance. Ce dernier cas signale une limite de connaissance, pas une spontanéité physique. Une réponse réseau instrumentée continue le déclencheur de son appel.
- Le **contexte causal** est l'information, portée par chaque message, qui le rattache à sa chaîne. Il voyage à côté des données, jamais mélangé avec elles. Il décrit un **parent de déclenchement**, pas la provenance exhaustive de chaque valeur utilisée.
- L'**admission** est le moment où un fait de l'hôte entre dans l'application, à la **frontière de confiance**.
- Un **effet** est le mouvement inverse : un changement demandé par un composant hors du modèle, sur l'hôte (le titre, l'adresse, le DOM) ou auprès d'un système extérieur (une requête au serveur). Il est préparé pendant le traitement et n'est engagé qu'après sa réussite.

### La règle : A5 — Causalité

> 1. Tout changement d'état interne résulte d'un traitement ou d'une initialisation autorisée (§2.5). Les changements extérieurs ne sont intégrés comme observations que par admission ; les effets préparés suivent la validation interne.
> 2. Tout message porte un contexte fidèle aux déclenchements établis et aux limites observables (C.4). Un message produit en traitement le continue, y compris au retour d'une Query ; le code applicatif ne choisit ni ne réinitialise ce contexte.
> 3. Une occurrence observable entre par le message local de son admettant vivant. Résultat corrélé : continuation ; fait indépendant établi : origine spontanée ; notification non corrélable : origine d'observation à antécédent inconnu. Avec le démarrage, ce sont les seuls cas de création d'une origine, qualifiés par l'infrastructure (G8, C.2, C.4).
> 4. Une même occurrence observable est admise par au plus un composant par racine, selon l'unité et l'identification fixées par le protocole de source, pas selon l'égalité des valeurs ni l'intention humaine supposée.

**Contre-exemples :** une minuterie modifie directement le panier ; un message circule sans contexte causal ; un gestionnaire `onclick` modifie un état sans passer par un message ; la View de recherche et l'adaptateur du document réagissent tous deux au même Ctrl+K.

**Le point 4 avec Ctrl+K.** Le focus est dans un champ d'une View, l'utilisateur appuie sur Ctrl+K : une occurrence se propage dans plusieurs écouteurs, mais ne doit être admise qu'une fois. Deux captures risqueraient de dupliquer les réactions et d'inventer deux origines ; même en partageant une origine, elles violeraient A5.d. La capture unique est une règle fondatrice, pas une conséquence de la seule définition d'origine. D10 répartit l'admission : View propriétaire de la part, sauf source de niveau document déclarée, comme un raccourci global, admise par l'adaptateur du document. Une touche, un clic puis un changement de valeur distincts restent plusieurs occurrences, même issus d'une même action humaine ; les événements supprimés ou fusionnés par l'hôte ne sont pas reconstruits.

**Pourquoi ?** Pour rattacher chaque changement interne à son déclenchement observable. Tu peux remonter les liens établis, jusqu'au clic si sa chaîne est connue, ou jusqu'à une origine d'observation explicitement inconnue. La trace ne promet ni de reconstituer toutes les causes physiques extérieures ni toute la provenance des données. Elle sert au débogage, à la journalisation et, sous les conditions d'O1, au rejeu.

Note que le clic lui-même n'est pas un message : c'est un fait de l'hôte. Pour une occurrence de vie valide, le préambule capture les valeurs et le contexte **sans modifier l'état applicatif**, puis soumet un message local. Le traitement peut modifier l'état local, poser une Query et, **si D18 l'autorise**, adresser une Command. Réponse réseau, minuterie et faits des adaptateurs suivent la même séparation, sans mutation cachée dans le callback ni relecture du support à la délivrance.

**G8 confie la causalité à l'infrastructure de communication.** Elle crée, conserve et restitue le contexte ; le code applicatif ne le fabrique ni ne le remplace. Une continuation a un parent de déclenchement unique, même si son calcul utilise plusieurs valeurs déjà connues. Dans une réaction à un clic indépendant établi, la réponse d'une Query peut fournir la charge d'une Command après son retour : le déclencheur reste le clic. D18 suit la réaction autorisée, pas l'enveloppe « message local » ni la provenance d'une valeur. Envelopper un Event dans un local, ou provoquer depuis lui un effet hôte dont le résultat est corrélé, **n'autorise jamais une Command UI**. Une continuation ne crée pas une permission absente de la réaction initiale.

**Quand l'hôte ne fournit pas la corrélation (C.4).** Une notification générale de défilement, redimensionnement, focus ou environnement sans identifiant d'opération porte un antécédent inconnu, sauf corrélation ou indépendance établie par le protocole de source. Le dernier effet demandé, une proximité temporelle, une valeur égale ou le seul `isTrusted` ne prouvent pas la parenté. Un résultat d'opération corrélé et une notification générale sont deux occurrences distinctes : le premier ne prouve pas la cause de la seconde. D19 peut sélectionner une notification **déjà contextualisée**, pas recréer le parent perdu. Cette coupure observable ne donne aucun droit de commander à l'interface et D9 ne borne pas les boucles qui la traversent.

**Comment sait-on qu'un clic vient de l'utilisateur ? Le monde fermé (C.4).** Un clic peut aussi être simulé par du code (`button.click()`). Bonsai ne se fie pas à l'indicateur `isTrusted` du navigateur. Il s'assure plutôt que **tout ce qui, dans l'application, peut produire un clic passe par lui** : un appel direct à `click()` ou `dispatchEvent()` est refusé par une garde. Dès lors, un clic qu'aucune opération de Bonsai en cours n'a pu produire ne vient d'aucun traitement de l'application : c'est un fait indépendant, et sa réaction peut adresser une Command. Même raisonnement pour le bouton « retour » du navigateur, avec `history.back()`. Les notifications de défilement, de redimensionnement ou de focus n'en profitent pas : une simple mise à jour de l'affichage peut les provoquer, sans qu'aucune opération dédiée ne l'annonce. La limite est assumée : un script étranger à l'application qui simule un clic n'est pas distingué de l'utilisateur.

**Rien de ce qui entre n'est présumé correct.** Une saisie, une réponse du serveur, une valeur du stockage local : tout ce qui entre dans le modèle est admis par un composant, puis traité comme n'importe quel message. C'est la Feature qui le traite qui le vérifie, puisque ses invariants doivent tenir à l'issue du traitement (A4, 11.7).

### Un exemple complet : ajouter un article au panier

Suivons une seule action de bout en bout pour voir le contexte causal voyager. L'utilisateur clique sur « Ajouter cet article » ; la boutique doit faire confirmer l'ajout par son serveur (un système extérieur) avant de l'inscrire dans le panier.

1. **Le clic.** Aucune opération instrumentée de la View n'est en train de simuler un clic : par le protocole du monde fermé, l'occurrence est un fait indépendant établi, qualifié *spontané*. La View propriétaire du bouton capture ses données sans mutation applicative ; l'infrastructure crée O1 et lui délivre un message local. Dans cette réaction autorisée, la View adresse la Command `cart:addItem`, avec l'article, au Channel `cart` ; elle reste rattachée à O1.
2. **Premier traitement métier.** L'infrastructure de communication délivre la Command à la Feature `cart`. Elle vérifie la demande et prépare la requête vers le serveur. Après validation interne, l'effet réseau est lancé avec son contexte O1 capturé par Bonsai. **Le traitement s'arrête sans attendre la réponse.**
3. **La réponse arrive.** C'est un fait *provoqué* : c'est le traitement de l'étape 2 qui a lancé la requête. La Feature l'admet, mais elle n'est plus en train de traiter un message ; modifier l'Entity dans le `.then()` violerait A5. Elle se transmet donc un **message local**, par exemple `articleConfirmed`, dont le contexte causal est une **continuation de O1** (§6, « Le message local »).
4. **Second traitement.** L'infrastructure délivre le message local à la Feature, et à elle seule. Elle met à jour l'Entity du panier ; les invariants métier sont vérifiés à la fin de ce traitement. Puis elle émet l'Event `cart:itemAdded` sur son Channel, lui aussi continuation de O1.
5. **L'affichage.** La View, abonnée au Channel `cart`, reçoit l'Event et met à jour le panier affiché avec l'information qu'il porte.

```text
clic ──admis──▶ message local de la View    (O1, origine)
                  │ traitement : Command cart:addItem
                  │ traitement métier validé : requête lancée
réponse ─admise─▶ message local             (continuation de O1)
                  │ traitement : Entity mise à jour
                  ▼
                Event cart:itemAdded        (continuation de O1)
                  │
                  ▼
                View : affichage mis à jour
```

Toute la chaîne remonte au même clic. Si l'on se demande un jour « pourquoi cet article est-il dans le panier ? », on remonte de l'Event au message local, puis à la Command, puis au clic.

Trois remarques :

- **Qui garde le contexte pendant l'attente ?** Bonsai, pour le composant qui a provoqué le fait, ici la Feature (G8). Ce n'est pas ton code qui le fabrique ou le recopie : l'infrastructure le capture au lancement de la requête et le restitue au message local. Si plusieurs requêtes sont en cours, chaque réponse retrouve le contexte de *sa* requête.
- **Si le serveur refuse, si un échec réseau est observé ou si un délai instrumenté expire**, c'est le même chemin : un message local `articleRejected`, continuation de O1. La Feature laisse le panier cohérent, inscrit l'échec dans son état, puis peut émettre un Event d'échec que la View affiche. Le silence du serveur ne produit pas à lui seul un fait observable ; sans délai instrumenté ni autre résultat, aucune progression n'est promise.
- **Pourquoi ne pas exposer `articleConfirmed` sur le Channel `cart` ?** Parce qu'alors d'autres composants pourraient y adresser ce message et simuler une confirmation du serveur. Le message local ne peut être produit que par la Feature, au moment où elle admet la réponse.

## 9. Les choix propres à Bonsai

Les axiomes valent pour toute application conforme à la théorie. Certaines règles sont des **choix de Bonsai** : une autre architecture respectant les mêmes axiomes pourrait décider autrement. On les appelle **décisions**, et chacune a son « pourquoi ». Une décision ne modifie pas les axiomes, mais **restreint les réalisations conformes au profil qui l'adopte** : D17 et D18 ne sont donc pas facultatives pour une application Bonsai V1.

Une décision nomme ce qu'elle protège ou met en œuvre :

- une **conséquence** : une qualité que les axiomes établissent déjà (la traçabilité causale, la cohérence métier, la continuité du domaine, l'isolation des composants) ;
- un **objectif** : un but que Bonsai poursuit sans que les axiomes l'imposent. Il y en a trois : la *rejouabilité* (rejouer les mêmes faits depuis le même état redonne les mêmes états, pourvu que ton code soit déterministe), la *détection précoce* des violations, et l'*ergonomie de développement*.
- une **clause d'axiome ou une définition**, lorsque le choix précise sa mise en œuvre plutôt que de rechercher un objectif supplémentaire.

Un objectif est un but, pas une règle : aucune démonstration ne s'y appuie, et rien ne t'oblige à l'atteindre pour être conforme.

| Décision | Ce qu'elle dit | Pourquoi | Ce qu'elle écarte |
| --- | --- | --- | --- |
| **D1 — Enfants de l'Application** | Les Features et la Foundation sont des enfants directs de l'Application, qui ne détruit pas la Foundation. | Un domaine à plat : aucune Feature n'est responsable de l'existence d'une autre. La survie des Features, elle, découle de A4 (T6). | Des Features enfants d'autres Features. |
| **D2 — Entity pérenne** | Une Feature ne détruit pas son Entity. Son nom et son Channel, eux, durent autant qu'elle par A2 et A4. | Vider un panier est une modification, pas une destruction : détruire puis recréer l'Entity reviendrait au même. | Réinitialiser l'Entity en la détruisant puis en la recréant. |
| **D3 — Élément de la Foundation** | La Foundation prend en charge un élément de la page, par défaut son corps, et lui seul, et le découpe pour ses enfants. | La Foundation relève de l'interface utilisateur : elle ne peut pas aussi porter l'en-tête ou la taille de la fenêtre, qui ont leur adaptateur (D7). | Une Foundation qui prendrait en charge tout le document. |
| **D4 — Une Feature, une Entity** | Chaque Feature est propriétaire d'exactement un état métier. | T5 impose le regroupement si une transition conjointe doit préserver un invariant strict ; un seul état par Feature rend ce périmètre lisible. | Plusieurs Entities par Feature. |
| **D6 — Interface non adressable** | Ni une View ni un Composer n'a de nom, donc pas de Channel. | Ils peuvent être détruits à tout moment : on ne leur adresse rien, ils reçoivent. Les Views se coordonnent par le domaine. | Des Views qui s'adresseraient des messages entre elles. |
| **D7 — Adaptateurs de l'hôte** | Ce qui vient de l'hôte hors du corps de la page (en-tête et titre, taille de la fenêtre, historique, stockage local) est pris en charge par un seul composant dédié, enfant de l'Application. | Un seul point d'entrée par source : un redimensionnement produit un seul message, pas un par View qui l'observe. | Chaque composant qui prendrait en charge lui-même la source dont il a besoin. |
| **D8 — Ordre de délivrance** | Rang réservé à l'émission pour les occurrences d'abonnement présentes ; survie du Channel, de l'abonnement et de son propriétaire vérifiée à la délivrance. | Un ordre déterminé sert le rejeu ; un abonnement recréé n'hérite pas des anciens Events. | Un ordre non spécifié ou la reprise d'un Event par un nouvel abonnement. |
| **D9 — Borne causale** | Contrôle à soumission, Event avant réservations : refus dans l'unité = erreur et rollback G7 ; au préambule = abandon technique sans révoquer le passé. Profondeur des segments établis seulement. | Une chaîne peut s'allonger sans qu'un composant en voie l'ensemble ; le refus ne doit pas laisser valider l'auteur puis supprimer son message. | Contrôle tardif à délivrance, récupération locale réussie, borne du travail total ou des coupures non corrélables, parent inventé. |
| **D10 — Admission par la cible** | Un fait de l'hôte est admis par le propriétaire de la part où il survient, sauf les raccourcis déclarés globaux, admis par l'adaptateur du document. | Un fait n'est admis qu'une fois (A5) ; un raccourci global n'appartient à aucune View. | Chaque View relaie le raccourci, ou le premier qui réagit l'admet. |
| **D11 — Composition réservée** | Une View est toujours enfant d'un Composer ; la Foundation et les Views n'ont pour enfants que des Composers. | Séparer ce qu'on affiche de la façon dont on l'affiche. | Une View qui crée elle-même d'autres Views. |
| **D12 — Décideur pur** | Un Composer attribue/restitue les parts et prépare la création/le retrait des éléments correspondants ; admet les seuls résultats instrumentés de ses propres effets de composition, pas les notifications générales. Jamais Command, autre rendu ni état hors slot et existence de ses Views. | Sa décision se recalcule depuis les messages reçus, ses Queries et les Views présentes : elle reste une projection du domaine. | Un Composer qui fait du rendu de présentation ou garde une mémoire indépendante. |
| **D13 — Behavior aveugle** | Un Behavior ne voit ni la View qui le porte ni ses clés ; leurs noms sont disjoints, entre Behaviors aussi. | Pour pouvoir le greffer sur n'importe quelle View. | Un Behavior qui lit `this.view`, ou un Behavior composant avec sa propre part. |
| **D14 — Enfants de la racine déclarés** | Toutes les Features et tous les adaptateurs sont créés au démarrage, d'après le Manifest, éventuellement assemblé depuis plusieurs modules. | Les enfants de la racine et les contrats sont connus tôt ; pas toutes les futures instances de Views et Composers. | Des Features enregistrées ou créées après le démarrage. |
| **D15 — Navigation fournie** | Bonsai fournit la Feature `router`, activable au Manifest ; une projection déclarée d'une autre Feature de navigation reste possible. L'adresse est tenue par l'adaptateur historique. | Un contrat de navigation commun, séparé du support d'adresse. | Une Feature de navigation qui modifie elle-même l'adresse. |
| **D16 — Contrats déclarés** | Un composant déclare à l'avance ce qu'il écoute, adresse et admet, résultats propres instrumentés et bilans d'engagement compris avec leurs traitements locaux, Composer et Foundation inclus. | Les contrats sont connus avant le démarrage et vérifiables tôt, sans présumer toutes les futures instances ni leur comportement. | Des abonnements ou gestionnaires arbitraires enregistrés à l'exécution (`on("x", fn)`). |
| **D17 — Chorégraphie du domaine** | Une Feature n'adresse aucune Command à une autre Feature, et un adaptateur du domaine n'en adresse aucune ; tous se coordonnent par Events. | Personne dans le domaine ne devient l'orchestrateur des autres ; le contexte causal reconstitue le déroulement. | Des Commands entre Features, ou d'un adaptateur du domaine vers une Feature (orchestration). |
| **D18 — L'interface relaie, elle n'enchaîne pas** | Command seulement en réaction à un fait admis dont le déclencheur indépendant est établi, ou en continuation d'une réaction déjà autorisée ; jamais depuis un Event, même via effet hôte corrélé. | Une Query ne change pas le déclencheur ; une observation inconnue n'accorde pas de permission. | Event → local/effet hôte → Command, ou observation inconnue → Command. |
| **D19 — Sélection à déclencheur unique** | Sélectionner une notification déjà contextualisée, notamment la dernière, et abandonner les autres conserve son contexte, sans parent recréé. | Ne pas confondre sélection et découverte de corrélation ; agrégations multi-parents hors V1. | Synthèse causale fictive, heuristique du dernier effet ou réinitialisation de profondeur. |

*D5 n'existe plus.* Elle disait que l'Application distribue les identités aux Features : c'est une conséquence de A2 (un composant ne choisit pas son nom, seul son parent lui en attribue) et de D1, pas un choix.

### Les Features ne se commandent pas (D17, D18)

Une commande en ligne : `order`, `stock` et `payment`. Le clic sur « Commander » est un fait indépendant établi : il autorise la réaction de la View. Bonsai ne laisse pas `order` donner des ordres aux deux autres. Le déroulement est une **chorégraphie** :

1. la View adresse `order:place` ; `order` passe à « en cours » et émet `order:placed` ;
2. `stock`, abonné, réserve et émet `stock:reserved` (ou `stock:reservationFailed`) ;
3. `payment`, abonné à `stock:reserved`, débite et émet `payment:captured` (ou `payment:failed`) ;
4. `order` passe à « confirmée » ou « échouée » ; `stock`, abonné à `payment:failed`, libère sa réservation.

Aucune Feature ne devient le chef d'orchestre des autres : chacune ne décide que de ce qui est à elle. Le déroulement n'est écrit dans aucun fichier, mais le contexte causal le reconstitue en entier, depuis le clic sur « Commander ». La règle d'écriture qui rend cela tenable : **un Event dit ce qui s'est passé chez moi, jamais ce que j'attends des autres** (`order:placed`, pas `order:pleaseReserveStock`).

Une Feature peut en revanche poser des Queries aux autres, et adresser des Commands aux adaptateurs du domaine (écrire dans le stockage local, par exemple). L'inverse n'est pas permis : un adaptateur du domaine ne commande personne. Quand la connexion revient, l'adaptateur de connectivité émet `connectivity:online` ; c'est le panier, abonné, qui décide de se synchroniser.

Et la View ne prend pas le relais (D18). Une View abonnée à `order:placed` qui adresserait `stock:reserve` deviendrait l'orchestratrice interdite aux Features, et le processus disparaîtrait avec elle. Commander exige un fait admis dont le déclencheur indépendant est établi, ou la continuation d'une réaction déjà autorisée. Un Event permet affichage, état local et Queries, **jamais Command**, même après un local, une Query ou un effet hôte corrélé. Une Query dans la réaction à un clic indépendant établi conserve la permission après son retour ; sa réponse ne crée pas de déclencheur. Une origine d'observation inconnue permet projection et état local, mais ne donne pas cette permission.

### Le domaine survit à tout (T6)

Ce n'est pas une décision mais une conséquence de A4, point 5 : **T6 concerne les composants du domaine propriétaires d'un Channel**, pas tout composant imaginable du domaine. Une Feature en fait partie ; si elle était détruite, son Channel le serait avec elle (T3), ce que A4 interdit avant la fin de la racine. Elle survit donc à toute navigation et à tout changement d'écran. La fin de l'application vient de l'hôte, par exemple lors de la fermeture ou du rechargement de la page, et met fin à sa descendance.

### Les adaptateurs de l'hôte (D7, annexe B)

Tout ce qui vient du navigateur hors du corps de la page (titre, taille de la fenêtre, adresse, stockage…), hors les requêtes et les minuteries, admises par le composant qui les lance, passe par un **adaptateur** : un composant fourni par Bonsai, seul à admettre sa source.

**Pourquoi plusieurs adaptateurs pour le même document ?** Un adaptateur appartient tout entier à l'interface ou au domaine. Le titre de l'onglet, « (3) Mon panier », présente le modèle : son adaptateur relève de l'interface et reçoit les Events du panier. La visibilité de l'onglet décrit l'environnement : le catalogue la classe dans le domaine, comme le focus de la fenêtre. D'où deux adaptateurs, document et cycle de vie. Même distinction pour la fenêtre : Viewport reste dans le domaine ; le défilement, qui agit sur la présentation, relève de l'interface. On ne reclasse pas une source selon le simple fait qu'un utilisateur puisse la percevoir.

**Le catalogue des adaptateurs (annexe B).** Bonsai fournit une liste fermée de catégories pour le navigateur : document, Viewport, défilement, historique, stockages (local, session, base indexée, cache, cookies), cycle de vie, connectivité, environnement (langue, fuseau) et presse-papiers. Tu actives ceux dont tu as besoin ; une spécialisation agit sur des valeurs déjà admises, jamais sur la connexion à l'hôte ni sur la causalité. En V1, sélectionner la dernière notification **déjà contextualisée** conserve sa qualification et son contexte et abandonne les autres ; cela ne répare pas une causalité perdue par l'hôte. Une agrégation nécessitant plusieurs parents est hors V1 (D19, B.4). Une API absente du catalogue et non prévue par B.6, comme la caméra, n'est pas conforme en V1. Les fiches sont dans [adaptateurs/](adaptateurs/).

**Une seule écriture physique coordonnée (B.2/B.3).** Document, historique, **défilement et presse-papiers** sont chacun limités à une instance par hôte, toutes racines Bonsai coordonnées confondues. Les périmètres des stockages sont disjoints aussi **entre racines** : préfixes de clés, noms de bases, caches ou cookies. L'exclusivité porte sur le périmètre physique piloté, pas seulement sur les noms des Channels. Elle ne prétend pas contrôler les scripts ou onglets non coordonnés, dont les modifications restent des faits extérieurs.

**Le routeur.** Bonsai fournit une Feature `router` (D15), activable au Manifest ; l'application peut aussi déclarer la projection de sa propre Feature de navigation. Elle garde l'état de navigation et émet `router:routeChanged { route, mode }`, sans toucher à l'adresse, support de l'interface tenu par l'adaptateur historique. En réaction à un clic, fait indépendant établi, une View adresse `router:navigate { location: /products/42, mode: push }` ; le routeur met à jour son état et émet `routeChanged` ; l'adaptateur prépare l'ajout d'entrée, engagé après validation ; `ProductFeature` charge le produit ; la View affiche le résultat. Dans une réaction autorisée, la View peut aussi demander `history:back` : le routeur ne le peut pas, car le domaine n'adresse rien à l'interface (A4).

**L'adresse et le bouton « retour ».** L'adresse est une projection de la Feature de navigation. **Quand l'utilisateur clique sur « retour »** sans qu'aucun `history:back` instrumenté soit en cours, le monde fermé établit l'indépendance du `popstate` : l'adaptateur historique admet le fait puis peut adresser `router:navigate { location: /admin, mode: pop }`. Si l'utilisateur n'est plus connecté, la Feature redirige et émet `router:routeChanged { route: login, mode: pop }`. L'adaptateur projette `/login` en **remplaçant** l'entrée, sans en ajouter une. L'équivalence compare valeur **et opération** : suivre un retour vers l'adresse courante est déjà satisfait, mais demander explicitement un ajout à la même adresse peut exiger une nouvelle entrée (B.5). Cela supprime des échos équivalents, sans prouver la convergence.

**Limite navigation et défilement.** Une notification générale à antécédent inconnu ne permet **pas** à l'adaptateur de commander le routeur ou le domaine (D18). Elle peut être intégrée dans l'état local d'observation et servir à une projection autorisée, sans devenir un nouveau déclencheur métier. De même, recevoir un Event puis préparer un défilement ou un changement d'historique ne permet pas de commander depuis le résultat corrélé de cet effet. Un défilement général sans corrélation ni indépendance établie reste inconnu (C.4) ; il n'autorise donc pas à lui seul une Command de chargement supplémentaire. Le retour et l'avance de l'utilisateur sont couverts par le monde fermé ; un défilement infini, lui, ne peut pas être présenté comme automatiquement couvert : il doit partir d’une saisie indépendante dans la part, et non de la notification générale de défilement.

### Plusieurs applications sur une même page (G6)

Plusieurs applications Bonsai peuvent coexister sur une même page. Chacune a sa Foundation sur un élément distinct, non emboîté, et sa Feature `cart` sans confusion de Channel. Aucun message ni réponse ne passe entre elles. Une modification de l'hôte par une autre racine n'est pas une continuation inter-racines : pour l'observatrice autorisée, elle est indépendante si le protocole l'établit, sinon qualifiée antécédent inconnu (C.4). L'isolation des messages ne dispense pas de coordonner l'exclusivité physique des adaptateurs et les périmètres de stockage (B.2/B.3).

## 10. Les rôles : ce que tu écris vraiment

Tout ce qui précède était abstrait. Les rôles sont les classes que tu manipules au quotidien. Ce ne sont pas des notions de base : chacun est une **combinaison** de termes, d'axiomes et de décisions. C'est pour cela qu'on peut justifier chacune de leurs règles.

### Application

La racine. Elle reçoit le Manifest à sa création et crée tous ses enfants au démarrage (D14). Elle est propriétaire de l'espace des identités et les distribue aux Features et aux adaptateurs (A2.a, A2.d, D1). Elle est le parent des Features, de la Foundation et des adaptateurs. Elle n'a pas de Channel : elle ne parle à personne. Sa fin vient de l'hôte, par exemple lors de la fermeture ou du rechargement de la page.

### Feature

Un composant du domaine. Elle est propriétaire d'un nom attribué par l'Application, le Channel désigné par ce nom, et une Entity. Elle traite les messages adressés à son Channel et émet ses propres Events.

*Ce qui en découle :* elle n'émet que sur son propre Channel (A3, T2) ; elle survit à toute l'interface (T6) ; elle ne modifie jamais son état dans un `.then()`, mais se transmet un message local (§6).

*Choix de Bonsai :* elle déclare à l'avance ce qu'elle écoute et interroge, et ses traitements en sont dérivés (D16) ; elle ne donne jamais d'ordre à une autre Feature, mais peut en donner aux adaptateurs du domaine (D17).

### Entity

L'état métier d'une Feature, avec les opérations qui le modifient. **Une Entity n'est pas un composant** : elle n'a ni nom, ni Channel, ni existence propre. C'est une ressource de sa Feature. Quand l'Entity exécute `mutate()`, c'est en réalité la Feature qui agit. Ses invariants métier sont écrits par toi et vérifiés à la fin du démarrage et à la fin des unités de validation (A4, §2.5), pas à chaque Query imbriquée de sa Feature.

### Foundation

Un composant de l'interface, enfant de l'Application. Elle prend en charge le corps de la page, ou l'élément qu'on lui désigne (D3) et en attribue des parts à ses enfants : c'est en quelque sorte le Composer racine. L'en-tête et le titre relèvent d'un composant dédié, l'adaptateur du document (D7).

Cette restriction des sources générales n'interdit pas les **résultats instrumentés de ses propres effets autorisés**, ni leurs bilans d'engagement (C.3). Elle les déclare avec leurs traitements locaux avant démarrage (D16), sans obtenir pour autant un abonnement général au document ou à la fenêtre. Les résultats d'effets de ses enfants reviennent à leurs occurrences vivantes, pas à elle par simple parenté.

### Composer

Un composant de l'interface qui **décide quelle View afficher** dans une zone de la page. Il est propriétaire d'une part de la page, son *slot*, attribuée par son parent (la Foundation, ou une View qui déclare un emplacement). Il est le parent des Views qu'il affiche, et lui seul l'est : une View ne crée jamais une autre View (D11). Comme la View, il n'a ni nom ni Channel : on ne lui adresse rien, il reçoit des Events et peut poser des Queries (D6).

Son travail tient en une fonction : `resolve(event)`. À sa création, puis à chaque message autorisé qu'il traite — Event reçu ou résultat instrumenté de son propre effet de composition déclaré — il répond à une seule question : « quelle(s) View(s) doivent occuper mon slot maintenant ? », avec une View, plusieurs, ou aucune.

*Ce qui découle des axiomes :*

- **Seul lui détruit ses Views.** Il est propriétaire de leur existence, donc le seul à pouvoir les détruire (A1).
- **Il découpe sa part pour ses Views.** La désignation qu'il donne à une View sert à résoudre sa part de DOM dans le périmètre attribué (A2), sans constituer une identité au sens de l'espace des identités : View et Composer restent sans identité (D6). La résolution est valide seulement pour la durée de cette attribution ; une réutilisation de la même portion produit une nouvelle part et invalide l'ancienne désignation. Les parts ne se recouvrant pas (T7), deux Views d'un même Composer ne se chevauchent jamais, et le Composer ne lit pas l'intérieur des parts confiées (A3). Leur destruction restitue leurs portions sans nouvelle attribution ni transfert.
- **Son slot ne disparaît pas sous lui.** Si la View parente veut retirer l'élément du slot, elle détruit d'abord le Composer. Si le slot revient plus tard, c'est un nouveau Composer qui naît.

*Optimisation possible, non conséquence axiomatique :* lorsque `resolve` désigne la même View au même endroit, conserver son occurrence évite de détruire puis recréer toute sa descendance (T3). T3 explique le coût structurel d'une destruction ; il n'impose pas, à lui seul, une politique de conservation des instances.

*Ce qui relève de choix de Bonsai (D12, « décideur pur ») :*

- **Il compose, sans faire le rendu de présentation.** Ses opérations autorisées sont l'attribution et la restitution des parts, ainsi que la préparation de création et de retrait de leurs éléments correspondants. Il ne s'agit pas d'une interdiction absolue d'écriture structurelle : le retrait est aussi permis que la création. Ces effets restent post-validation ; pas d'écriture dans une part encore attribuée à une View.
- **Il n'a pas d'état indépendant**, hors le contenu de son slot et l'existence de ses Views. Son choix se recalcule à partir des messages reçus, des réponses à ses Queries et des Views présentes. La vérité est dans le domaine (A4) : une mémoire supplémentaire de « ce qui devrait être affiché » pourrait la contredire. Le traitement d'un résultat propre n'autorise pas davantage un journal local indépendant.
- **Il admet ses résultats propres, pas les notifications générales.** Résultats instrumentés des effets de composition et bilans d'engagement sont déclarés avec leurs traitements locaux par D16, soumis à durée de vie et D9 ; ils ne permettent que la composition, aucun rendu de présentation supplémentaire.
- **Il n'écoute pas l'utilisateur et ne commande jamais.** Pas de gestionnaire de clic ou de focus général, pas de Command, même depuis un résultat propre : l'exception d'admission ne retire aucune autre restriction de D12 et D18 n'accorde pas au Composer un droit que son rôle interdit.

### View

Un composant de l'interface. Elle est propriétaire d'une part de la page, attribuée par son parent. Elle n'a pas de nom ni de Channel (D6).

*Ce qui en découle :*

- elle **adresse** des Commands et des Queries aux Features et aux adaptateurs, et **reçoit** leurs Events, mais n'émet jamais rien ;
- elle n'adresse une Command qu'en réaction à un fait admis dont le déclencheur indépendant est établi, ou en continuation d'une réaction déjà autorisée ; jamais depuis un Event, même via un effet hôte corrélé, ni sur la seule base d'une origine d'observation inconnue ; une Query intermédiaire ne crée ni ne retire cette permission après son retour (D18) ;
- elle reçoit à sa création une **désignation** de sa part, pas un élément DOM : un sélecteur est une information à résoudre, alors qu'un élément serait une référence directe interdite dans les paramètres (A3.d) ; cette désignation n'est pas une identité (D6) ;
- elle obtient l'élément, une fois matérialisé, par une résolution contrôlée auprès de l'hôte, limitée à sa propriété et à la durée de l'attribution ; si l'élément n'existe pas encore pendant son initialisation, elle utilise sa part logique et prépare ses effets sans exiger d'accès DOM immédiat ; une ancienne désignation ne donne aucun droit sur une nouvelle part au même endroit ;
- sa part ne recouvre aucune autre part (T7) : c'est pourquoi elle ne touche jamais au DOM de ses voisines ni au contenu des slots qu'elle a confiés à ses Composers ; elle garde en revanche l'élément de chaque slot ;
- elle ne supprime jamais son propre élément racine : elle peut en changer les attributs et dispose librement de tout ce qu'il contient, hors le contenu de ses slots ;
- elle transforme les clics et saisies de l'utilisateur, faits de l'hôte, en messages locaux après un préambule d'admission sans mutation applicative (A5), sauf les raccourcis déclarés globaux, admis par l'adaptateur du document (D10) ;
- elle peut modifier son état local dans tous ses traitements autorisés, y compris les Events, sans en faire une autorité métier (A4.d) ; D18 garde séparément le droit d'adresser une Command selon le déclencheur.

### Behavior

Un morceau de code de View **réutilisable**, que tu greffes sur des Views sans rapport entre elles : tracking des clics `[data-track]`, validation de formulaire, champ qui s'agrandit. Un comportement lié au défilement doit respecter la limite précédente : une observation générale inconnue ne donne pas de droit de Command pour du chargement infini. Ce n'est pas un composant : tout ce qu'il fait, c'est la View qui le fait (règle d'imputation).

C'est ce qui rend le tracking juste. Pour un clic utilisateur sur « Ajouter au panier » (`data-track`), la View et son `TrackingBehavior` réagissent au même fait admis **une seule fois** par la View. Dans cette réaction autorisée, les deux Commands (`cart:addItem` et `analytics:trackInteraction`) partagent la même origine : le tracking peut apparaître dans la chaîne de l'ajout au panier. Le Behavior ne crée aucune permission supplémentaire de commander.

- **Il est aveugle (D13).** Il ne voit ni la View qui le porte ni ses clés : c'est ce qui le rend réutilisable.
- **Les noms de clés sont disjoints.** Aucun nom n'est partagé entre la View et un Behavior, ni entre deux Behaviors de cette View. Des clés de noms différents peuvent néanmoins désigner le même élément : ce n'est pas un partage de propriété entre composants, puisque tout est imputé à la View.
- **Il est borné à la part de sa View.** Il ne voit pas l'intérieur des Views enfants : un `TrackingBehavior` posé sur une View de haut niveau ne capte pas les clics de ses descendantes. Chaque View qui veut le tracking le déclare.
- **Il ne produit rien hors de cette part.** Une infobulle qui flotte au-dessus de la page relève d'un Composer ; le défilement de la fenêtre relève de son adaptateur. Le clic ou focus hors View **sans admetteur explicitement autorisé est hors V1 tant que 18.30 reste ouvert** : pas d'écouteur global improvisé dans un Behavior pour fermer un menu, ni d'admission par le Composer. Les raccourcis document déclarés ne constituent pas une autorisation générale, et le focus de fenêtre du domaine ne résout pas celui d'un élément.

### Manifest

Une seule déclaration dit **qui existe et ce qui est à qui** : les Features et leurs noms (`cart`, `user`…), les adaptateurs activés et leurs périmètres (le préfixe `prefs:` du stockage local, par exemple), l'élément de la Foundation, les raccourcis globaux, la borne causale. L'Application la reçoit à sa création et crée tous ses enfants au démarrage (D14).

Ce n'est pas un composant : c'est une information, sans aucune référence (le sélecteur `#app`, jamais l'élément lui-même). Les enfants de la racine et les contrats sont connus avant le démarrage : Bonsai peut vérifier tôt les noms en double, un namespace inconnu ou des périmètres déclarés qui se recouvrent. Cela ne signifie ni que toutes les futures instances de Views et Composers existent déjà, ni que tout leur comportement est vérifiable au démarrage. Les conflits physiques avec d'autres racines se contrôlent lors de leur démarrage coordonné.

Elle peut être assemblée à partir de plusieurs modules ESM, chargés séparément par la page, pourvu qu'ils le soient avant `start()`. Une Feature dont le module arriverait après le démarrage n'est pas prévue en V1.

### Adaptateur

Un composant fourni par Bonsai, enfant de l'Application, seul à admettre sa source du navigateur hors des éléments des Foundations (D7). Tu l'actives dans le Manifest et tu peux le spécialiser, sans toucher à sa connexion ni au contexte causal (annexe B). Il appartient tout entier au domaine (Viewport, stockages, cycle de vie…) ou à l'interface (document, défilement, historique, presse-papiers). Avant un Event, il inscrit le fait observé dans son état (A3.h) ; ses Queries rendent l'observation intégrée, jamais un échantillonnage physique à la demande. Une projection du domaine n'est préparée que sur différence selon l'équivalence définie, valeur et opération comprises (B.5). Un adaptateur UI reste soumis à D18 : ni Event, ni effet corrélé issu d'un Event, ni origine d'observation inconnue ne lui donne la permission de commander. L'autorité sur le support vient de la ressource admise ou d'une part propre issue de celle-ci, dans son périmètre ; les restrictions supplémentaires du catalogue restent applicables.

### Pour notre panier

- La Feature `cart` est propriétaire de l'Entity du panier et du Channel `cart`.
- La View du panier adresse `cart:addItem` quand on clique sur « Ajouter », et reçoit `cart:itemAdded` pour mettre à jour l'affichage.
- Le Composer de la zone principale reçoit les Events de la Feature de navigation. Quand l'utilisateur change de page, son `resolve` désigne une autre View : il détruit la View du panier et monte la nouvelle. Le panier, lui, reste intact (T6).

## 11. Aller plus loin : le protocole d'exécution (annexe C)

Les sections précédentes suffisent pour écrire une application. Cette section résume le protocole que Bonsai réalise pour toi, et qui forme l'annexe C de la théorie. Tu n'as pas à le mettre en œuvre ; il explique ce que tu observeras en déboguant.

**Durée de vie (C.2).** Chaque création a une **occurrence de vie non réutilisable**, distincte de son emplacement ou de son namespace. Une destruction validée retire les délivrances en attente, messages locaux compris ; un callback tardif est ignoré **avant admission**. Il ne ressuscite pas la View et ne vise pas celle qui serait recréée au même endroit. Une annulation de destruction conserve au contraire la même occurrence et ses réservations. Une notification capturée pendant une destruction provisoire attend son issue : abandon après validation, admission après annulation. La fin de la racine clôt aussi les contextes conservés ; l'annulation physique d'une opération extérieure reste une tentative, pas une garantie contre les callbacks déjà engagés.

**Une observation consultable n'est pas une nouvelle lecture physique (C.5).** La Query rend l'observation intégrée par initialisation ou par traitement d'admission, ou un calcul interne à partir des ressources accessibles. Elle ne rééchantillonne pas le stockage, le DOM ou un autre support persistant. Si le support a changé mais que sa notification n'est pas encore traitée, la Query rend encore l'ancienne observation. Un rafraîchissement physique est une action : échantillonnage après validation, capture puis admission, intégration seulement au traitement local. Le préambule ne relit pas le support à la délivrance. Une observation indisponible est explicite ; une observation connue ne certifie pas la valeur physique actuelle. L'heure et l'aléatoire restent les exceptions de lecture libre, pas un moyen de contourner ce protocole.

**Les valeurs sont capturées, pas partagées par alias mutable (G2, C.5).** Le transport capture la charge et le contexte à la soumission, la réponse à son retour ; les paramètres de création suivent la même règle. Ni l'auteur, ni le destinataire, ni un autre abonné ne peut modifier la valeur transmise par un alias conservé. Une copie détachée ou l'immuabilité profonde sont des mécanismes possibles ; un type sérialisable ne prouve pas qu'une copie a eu lieu, et `readonly` TypeScript ne suffit pas. Une réponse conservée représente le moment de la consultation, pas une autorité durable ni un instantané global ; chaque Command revérifie ses préconditions dans son traitement.

**À quel moment D9 refuse-t-il ?** Avant toute soumission au transport : Query, Command, Event ou local. Pour un Event, le contrôle des branches précède toute réservation d'abonnement ; le nombre d'abonnés n'ajoute pas de profondeur. Pendant un traitement ou une initialisation, le refus est une **erreur de transport** qui interrompt l'unité de validation extérieure sous G7 : mutations annulées, différés retirés, effets préparés abandonnés. Une Query refusée propage l'erreur sans réponse de substitution ; intercepter le refus ne permet pas de poursuivre avec succès la même unité.

**Et si l'unité est déjà validée ?** Un refus au préambule d'admission, notamment d'un résultat post-validation, ne commence aucun traitement applicatif : l'occurrence est abandonnée et signalée par une **trace technique hors transport applicatif**. Ni nouveau message ni origine de contournement ; ni révocation de l'unité passée ni annulation de ses effets. D9 n'attend pas la délivrance pour rejeter un message accepté à sa soumission. Les contrôles de durée de vie et d'abonnement à la délivrance sont distincts.

**L'annulation couvre aussi la structure.** Si un Composer prépare le retrait d'une View puis échoue, l'ancienne View, ses abonnements, sa part et ses désignations sont conservés. Bonsai ne les recrée pas : les destructions et restitutions étaient provisoires jusqu'à validation. Les créations de l'unité annulée sont retirées, sans transfert de propriété.

**Pas de transaction globale avec l'hôte.** Les effets sont préparés pendant le traitement et engagés après validation interne. Une Command vers un adaptateur est d'abord délivrée à celui-ci ; ses effets suivent sa propre validation. La phase post-validation engage la liste dans l'ordre de préparation **jusqu'au premier échec synchrone d'engagement**, avant la prochaine délivrance différée et sans attendre l'achèvement asynchrone (C.3). Le suffixe est alors marqué **non tenté** ; les engagements précédents ne sont pas annulés. Un échec asynchrone ultérieur n'annule pas rétroactivement les engagements déjà effectués. Si B exige la réussite confirmée de A, on prépare B seulement au traitement du résultat de A, pas simplement après A dans la même liste.

Le bilan d'engagement et les résultats effectivement capturés sont admis pour l'occurrence encore vivante de chaque composant concerné, jamais réattribués au créateur ; ils prennent rang à leur admission. L'ordre d'engagement ne fixe donc pas celui d'achèvement. Une notification synchrone suit aussi admission et file, sans réentrance et sous réserve de durée de vie. Ces résultats distinguent intention, engagement, observation de réussite, échec et non-tentative. Ils ne révoquent pas la validation interne et ne restaurent pas le support hôte. Après destruction, une erreur de nettoyage peut être signalée techniquement, mais pas admise à un destinataire disparu.

**Résultat propre ne veut pas dire source générale (C.3).** Composer et Foundation peuvent eux aussi admettre les résultats instrumentés de leurs propres effets autorisés, bilans d'engagement compris, malgré leurs restrictions générales d'admission. Ces résultats et leurs traitements locaux sont déclarés **avant le démarrage** par D16 : pas de gestionnaire ajouté arbitrairement à l'exécution. Ils restent soumis à la durée de vie et à D9. Pour le Composer, cela ne permet que la composition du slot et la gestion de l'existence de ses Views : jamais Command, rendu de présentation ou état indépendant. La corrélation d'un résultat ne lui ouvre aucune autre source de l'hôte.

## 12. Les gardes : ce qui vérifie les règles

Les **gardes** sont les mécanismes qui détectent ou empêchent une violation du code applicatif. Chaque garde protège une règle précise : la table est dans [gardes.md](gardes.md). Une garde vérifie une règle ; elle n'en est jamais la source. Une obligation s'accompagne d'une garde au plus tôt **ou d'une justification précise de sa non-vérifiabilité**, avec revue pour la partie sémantique. Les garanties G relèvent, elles, de tests de conformité de l'infrastructure, pas de gardes applicatives.

### Les quatre niveaux de garde, du meilleur au moins bon

1. **Par construction.** La violation est impossible à écrire, parce que l'outil n'existe pas. Exemple : Radio n'est pas exporté par `@bonsai/core`, donc aucun composant ne peut ouvrir un Channel à la place de son propriétaire (A3.b).
2. **Avant l'exécution (statique).** TypeScript, ou à défaut une règle de lint, refuse le code. Exemple : une View déclare les Commands qu'elle peut adresser ; en adresser une autre est une erreur de type.
3. **Au démarrage.** L'application refuse de se lancer. Exemple : une référence à un namespace inexistant est détectée au bootstrap.
4. **À l'exécution.** Une erreur est levée au moment de la violation. Exemple : une Query vers un composant dont un traitement est en cours est refusée avec une erreur (G5).

**Pourquoi cette hiérarchie ?** Plus une erreur est détectée tôt, moins elle coûte. C'est le principe de Bonsai : **garantir au plus tôt** (§19), en justifiant un contrôle plus tardif ou l'absence de contrôle possible. Son meilleur allié, ce sont les **contrats déclarés** (D16) : tu décris à l'avance ce que ton composant écoute, adresse et admet, et ses traitements en sont dérivés. Les contrats sont connus avant le démarrage, même pour des classes instanciées plus tard ; pas toutes les futures instances ni toutes les propriétés sémantiques de leur code. La table décrit les contrôles et scénarios requis, pas une preuve qu'ils sont déjà implémentés ou exécutés.

### Quelques gardes et la règle qu'elles protègent

| Garde | Niveau | Règle protégée |
| --- | --- | --- |
| Radio et Channel non exportés | construction | A3.b, A3.e : seul le propriétaire d'un Channel le désigne, y traite et y émet |
| `emit` absent du type de la View | compilation | D6 et A3.e : sans Channel, une View n'a rien sur quoi émettre |
| Handlers manquants détectés par `implements` | compilation | D16 : un traitement par message ou fait déclaré, et aucun autre |
| Namespaces vérifiés au bootstrap | démarrage | A2.a, A2.d et D1 : les identités sont attribuées à partir du manifest |
| Éléments des Foundations distincts et non emboîtés ; désignation d'une View bornée à sa part vivante | démarrage, puis exécution pour les attributions futures | D3, A2.d et A3.c : pas d'accès à une part étrangère ni de réutilisation d'une attribution périmée |
| Query vers une cible en cours de traitement refusée | exécution | G5 : pas de consultation réentrante, aucune lecture d'un état intermédiaire |
| Pas de Command vers une autre Feature dans le contrat d'une Feature | construction | D17 : chorégraphie du domaine |
| Capacité de commander liée à la réaction autorisée, conservée à travers appels, locaux et effets corrélés | statique, puis exécution pour le contexte dynamique | D18 : Event → local/effet hôte → Command interdit ; fait indépendant établi → Query → Command permis après retour ; observation inconnue sans permission |
| Profondeur d'un segment de déclenchements établis dépassée | exécution | D9 : pas de borne sur les boucles traversant une coupure non corrélable |

Quand tu tombes sur une de ces erreurs, ne cherche pas à la contourner : elle te signale que ton code viole une règle de la théorie, et la table te dit laquelle.

## 13. Aide-mémoire

### Les six axiomes en une phrase

| Axiome | En une phrase | Ce qu'il t'évite |
| --- | --- | --- |
| **A0 — Cadre** | Tout est dans une seule zone, et le modèle ne contient que composants, ressources et messages. | Les zones floues et les « services » hors règles |
| **A1 — Propriété unique** | Une chose, un propriétaire, seul à la modifier. | Les états modifiés de partout |
| **A2 — Origine** | Création, admission ou attribution donnent un propriétaire, sans transfert ultérieur ni appropriation du support hôte. | Les ressources sans origine, les transferts flous |
| **A3 — Médiation** | On se parle par messages contractuels sur des ressources déterminées ; les Queries restent transitivement en lecture seule. | Les dépendances cachées et services hors cadre |
| **A4 — Domaine** | Le métier est cohérent aux frontières validées, avec ou sans écran ; l'interface projette sans devenir autorité métier. | Un domaine cassé par l'interface, un affichage qui ment |
| **A5 — Causalité** | Tout changement interne relève d'un traitement ou d'une initialisation autorisée ; les contextes distinguent liens établis, indépendance établie et antécédent inconnu. | Les parents inventés et limites d'observation masquées |

### Les trois réflexes

- **Je veux modifier quelque chose qui n'est pas à moi** → j'adresse une **Command** contractuelle à son propriétaire si mon rôle et le déclencheur du traitement le permettent (A4.b, D18). Entre Features, jamais de Command (D17) : j'émets ce qui s'est passé chez moi, et le propriétaire décide d'y réagir.
- **Je veux savoir quelque chose qui n'est pas à moi** → j'adresse une **Query** à son propriétaire, qui répond à partir des ressources accessibles et observations intégrées s'il est prêt et inactif ; sinon, G5 refuse la Query. Pendant l'initialisation autorisée, une réponse peut rester provisoire dans son unité.
- **J'ai modifié quelque chose qui est à moi** → j'émets un **Event**, qui dit ce qui s'est passé chez moi, jamais ce que j'attends des autres.

### Les questions à se poser devant un doute

1. Qui est le propriétaire de cette donnée ?
2. Est-ce que je passe par un message, ou est-ce que je touche directement à quelque chose qui n'est pas à moi ?
3. Ce changement d'état est-il le traitement d'un message, ou arrive-t-il « tout seul », dans un callback ou après un `await` ?
4. Est-ce que mon invariant relie des données de deux Features différentes ?
5. Quand ce composant disparaît, est-ce que tout ce qu'il a ouvert disparaît avec lui ?
6. Est-ce qu'une Feature donne un ordre à une autre, ou l'interface enchaîne-t-elle une Command sur un Event, même par effet hôte corrélé ? Le déclencheur indépendant ou la continuation d'une réaction déjà autorisée est-il établi, plutôt que supposé depuis une observation inconnue ?

Ces questions orientent la revue ; elles ne remplacent ni les contrats et gardes, ni la vérification des obligations sémantiques.
