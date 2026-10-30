# Bonsai expliqué — la théorie pour bien démarrer

Oct 27, 2026 · @ncac · aligné sur la théorie V0.9.2

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

Dans ce guide, les renvois entre parenthèses (A1, T2, D17, G5…) désignent l'énoncé exact dans la théorie, qui fait foi. Ce qui est marqué *« Ce qui découle »* est démontré ; ce qui est marqué *« choix de Bonsai »* est une décision ; les encadrés **Image** sont des comparaisons pour fixer les idées, jamais des règles.

### L'exemple qui nous suivra

Tout au long du guide, on prendra une petite boutique en ligne avec un **panier** : l'utilisateur ajoute des articles, voit le total, et valide sa commande. C'est assez simple pour tenir en tête, et assez riche pour illustrer chaque règle.

## 2. Le décor : le modèle et ce qui l'entoure

Avant de parler de règles, il faut savoir **de quoi** elles parlent. Bonsai distingue quatre zones, et tout ce qui intervient dans une application appartient à exactement l'une d'elles.

- **Le modèle**, c'est ton application : ce que Bonsai organise. Il contient trois sortes de choses, toujours distinctes : des **composants** (les acteurs), des **ressources** (ce dont les acteurs sont propriétaires) et des **messages** (ce qu'ils se transmettent).
- **L'hôte**, c'est l'environnement qui fait tourner l'application : le navigateur, le document, la fenêtre. L'application en dépend, mais il n'en fait pas partie, et Bonsai ne le contrôle pas.
- **L'infrastructure de communication**, c'est le service postal : elle achemine les messages entre composants. Elle ne fait pas partie du modèle non plus : elle n'est propriétaire de rien et ne prend part à aucune conversation.
- **Les systèmes extérieurs** sont les services avec lesquels l'application échange des informations : une API de paiement, un serveur de données. Ils ne fournissent pas à l'application ses conditions d'existence, comme l'hôte, et ne transportent pas ses messages, comme l'infrastructure de communication.

**Attention : l'infrastructure de communication n'est pas Radio.** Le nom est volontairement celui d'un ensemble : c'est **toute la logique de communication qui n'appartient pas à l'API publique** : Radio, qui en est la pièce centrale, mais aussi la tuyauterie interne des classes de base, celle qui se cache derrière `trigger()`, `query()`, `emit()` ou l'abonnement aux Events. Quand une View écrit `this.trigger("cart:addItem", …)`, elle ne voit jamais Radio : c'est la classe de base `View`, fournie par Bonsai, qui prend le message en charge, y attache son contexte causal et le fait acheminer. Cette tuyauterie fait partie de l'infrastructure de communication.

La frontière est simple : **ce que le développeur écrit appartient au modèle ; ce que Bonsai fait pour transporter ses messages appartient à l'infrastructure de communication.** Le développeur ne peut ni la contourner ni la modifier, et c'est ce qui lui permet de tenir ses garanties.

**Pourquoi cette séparation ?** Parce que les règles de Bonsai ne s'appliquent qu'au modèle. Si l'infrastructure de communication était un composant comme les autres, il faudrait lui inventer des exceptions partout : transmettre un message reviendrait à lui parler, ce qui demanderait un message, et ainsi de suite sans fin. En la sortant du modèle, on lui donne à la place sept **garanties** simples (G1 à G7) : elle livre chaque message au bon destinataire, ne modifie jamais un message, ne livre rien à un destinataire disparu, n'est propriétaire de rien, ne livre un message qu'une fois le traitement en cours terminé, ne fait passer aucun message d'une application à une autre sur la même page, et annule un traitement qui échoue.

### La règle : A0 — Cadre

> 1. Tout ce qui intervient relève d'une seule des quatre zones : le modèle, l'hôte, l'infrastructure de communication ou un système extérieur.
> 2. Le modèle ne contient que des composants, des ressources et des messages, et rien n'est à la fois deux de ces choses.
> 3. Tout ce qu'on peut connaître ou changer d'un composant est son existence ou une ressource dont il est propriétaire.
> 4. Tout composant, sauf la racine, a une existence, créée en même temps que lui ; la racine reçoit la sienne de l'hôte.

**Contre-exemples :** un registre de Channels fait à la fois partie de la tuyauterie de l'infrastructure et de l'état qu'un composant modifie ; un « service » qui n'est ni composant, ni ressource, ni message est appelé par les composants ; un composant expose un cache interne qui n'est pas une ressource, et un autre l'interroge.

**Pourquoi ?** A0 ferme les portes de sortie. Toutes les autres règles portent sur les composants, les ressources et les messages : s'il existait une quatrième sorte de chose dans le modèle, ou une zone floue entre le modèle et le reste, il suffirait d'y ranger ce qui gêne pour échapper à la théorie.

**Pourquoi « primitifs » ?** Modèle, hôte, infrastructure de communication, système extérieur, composant, ressource, message, propriété : ces huit mots ne sont pas définis à partir d'autres. Ce sont les briques de départ, comme « point » et « droite » en géométrie. Leur sens se précise par les règles qui les utilisent.

## 3. Qui est propriétaire de quoi

### Les mots

- Une **ressource** est quelque chose dont un composant peut être propriétaire : l'état du panier, une adresse de messagerie, un morceau de la page.
- La **propriété** est le lien entre un composant et une ressource. Le composant est son **propriétaire**.
- Une **opération exclusive** est une opération qui *modifie* ou *détruit* une ressource. Lire n'en est pas une.
- Un **état** est une ressource qui peut changer pendant la vie de l'application, comme le contenu du panier.

### La règle : A1 — Propriété unique

> Toute ressource a **exactement un** propriétaire, et **seul** ce propriétaire la modifie ou la détruit.

**Contre-exemples :** deux composants modifient chacun de leur côté le contenu du panier ; plusieurs composants modifient une variable globale que personne n'a admise.

**Pourquoi c'est la règle la plus importante.** La plupart des bugs d'une interface viennent d'un état modifié depuis plusieurs endroits : on ne sait plus qui a changé quoi, ni dans quel ordre. Avec A1, la question « qui a pu modifier ce panier ? » a toujours une seule réponse. Pour déboguer, tu sais où regarder.

**Et si un autre composant a besoin de modifier le panier ?** Il ne le fait pas : une View le **demande** à son propriétaire, par un message (§6) ; une autre Feature, elle, annonce ce qui s'est passé chez elle, et le panier décide d'y réagir (§9, D17). Bonsai n'autorise aucune « délégation » qui permettrait à un tiers d'agir à la place du propriétaire. C'est plus strict, mais la règle reste vraie sans exception.

**Pourquoi la lecture n'est pas réservée.** Lire ne change rien ; deux lecteurs ne se gênent pas. Ce qui est dangereux, c'est l'écriture concurrente.

## 4. D'où vient la propriété

A1 dit qu'il y a toujours un propriétaire. Il reste à savoir **comment on le devient**.

### Les mots

- La **création** est le moment où une ressource commence d'exister.
- Certaines ressources se découpent en **parts**. Une ressource qu'on peut ainsi partager entre plusieurs propriétaires est dite **distribuable**. Exemple : l'ensemble des noms disponibles dans l'application, ou la page affichée.
- L'**attribution** est l'acte par lequel le propriétaire d'une ressource distribuable en délimite une part, la lui retire, et désigne le propriétaire de cette part.

### La règle : A2 — Origine de la propriété

> 1. Celui qui crée une ressource en est le propriétaire. Une part, elle, appartient à celui que désigne le propriétaire de la ressource dont elle vient.
> 2. Une ressource distribuable vient toujours du haut : de la racine de l'application, de l'hôte, ou d'une ressource distribuable plus large.
> 3. On ne change jamais de propriétaire : la propriété dure jusqu'à la destruction de la ressource.
> 4. On n'attribue une part qu'à ses enfants, et une part ne prend fin qu'avec son propriétaire.

**Contre-exemples :** un composant se choisit lui-même son nom ; un composant crée son propre espace de noms pour s'y nommer ; un composant « donne » son état à un autre ; une View prête une zone de sa page à une View voisine, ou supprime son propre élément racine.

**L'image du prêt.** Attribuer une part, c'est comme prêter une pièce de sa maison à son enfant. Une fois prêtée, la pièce ne fait plus partie de ce que le propriétaire gère : sinon, les deux pourraient la réaménager en même temps. Il en découle que deux parts ne se recouvrent jamais (T7). Quand l'enfant part, la pièce revient au propriétaire, qui peut la vider et la prêter à nouveau. C'est pour cela qu'on ne prête qu'à ses enfants : le seul qui puisse faire partir l'enfant est son parent, donc la pièce revient toujours à celui qui l'avait prêtée.

**Pourquoi « par le haut ».** Imagine que chaque composant choisisse son propre nom : deux d'entre eux finiront par choisir `cart`. Si au contraire les noms sont distribués par un seul propriétaire, la racine, les collisions deviennent impossibles **par construction** : on n'a pas besoin de les détecter, elles ne peuvent pas exister. C'est le principe du `namespace` attribué à chaque Feature par l'Application, d'après le Manifest (§10).

**Pourquoi aucun transfert.** Si la propriété pouvait passer de main en main, la question « à qui est ceci ? » dépendrait du moment où on la pose. En la rendant fixe, elle a une réponse unique pour toute la vie de la ressource, et TypeScript peut même la vérifier à la compilation. Le prix à payer : on ne déplace pas un composant d'un parent à un autre, on le recrée.

### L'identité

Un nom comme `cart` est la **représentation** d'une **identité**, qui est elle-même une part de l'**espace des identités**. La différence compte : l'identité est la ressource attribuée, protégée par A2 ; le texte `"cart"` n'est qu'une manière de l'écrire. Le mot technique **namespace** désigne cette représentation textuelle.

## 5. La famille des composants

### Les mots

- L'**existence** d'un composant est une ressource à part, attachée à lui. La seule opération qu'on peut faire dessus : la détruire, ce qui détruit le composant.
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

Et le `localStorage`, qui survit pourtant au rechargement de la page ? Il n'y a pas de contradiction. Ce que le navigateur conserve appartient à l'hôte, pas à l'application. Il ne devient une ressource de l'application qu'au moment où un composant l'admet, et cette ressource disparaît avec son propriétaire. Au rechargement, une nouvelle application l'admet à nouveau : ce qu'elle y trouve entre comme un fait nouveau, une origine (§8), et non comme la suite de la session précédente.

## 6. Se parler sans se toucher

Puisqu'un composant ne peut pas toucher aux ressources des autres, il faut un moyen de communiquer. C'est le rôle des messages.

### Les mots

- Un **Channel** est un point de rendez-vous désigné par une identité : on y adresse des messages à son propriétaire, et lui seul y émet. Son propriétaire est celui de l'identité qui le désigne.
- **Adresser** un message, c'est le transmettre à un Channel pour qu'il y soit traité. Un composant peut adresser un message au Channel d'un autre, dans les limites de A4 (§7) et des décisions D17 et D18 (§9).
- **Émettre** un message, c'est le diffuser depuis son propre Channel à tous ceux qui ont demandé à le **recevoir**.
- **Traiter** un message, c'est exécuter quelque chose en réponse. Un traitement est **synchrone** : il se termine sans attendre aucun événement futur.
- Une **réponse** est l'information que le traitement d'un message adressé rend aussitôt à son auteur. Ce n'est pas un message : elle revient dans le même mouvement, pendant que l'auteur poursuit son propre traitement.
- Une **référence** est un moyen d'atteindre directement quelque chose, sans passer par un message : un pointeur, un objet JavaScript, un élément DOM. Une **référence structurelle** va d'un propriétaire vers sa propre ressource, ou d'un parent vers son enfant.
- Une **interaction fonctionnelle** est toute transmission d'information d'un composant à un autre.

### La règle : A3 — Médiation

> 1. Toute interaction passe par un message, adressé à un Channel ou émis sur un Channel, et transporté par l'infrastructure de communication.
> 2. Un Channel est désigné par une identité de son propriétaire.
> 3. Un composant n'utilise que des références structurelles.
> 4. Ce qu'un parent transmet à un enfant à sa création ne contient aucune référence.
> 5. Seul le propriétaire d'un Channel traite ce qu'on lui adresse et émet dessus.
> 6. Tout message est adressé à un Channel, émis sur un Channel, ou local : un message local est celui qu'un composant se transmet à lui-même, transporté comme les autres, mais sans Channel.
> 7. Un traitement qui rend une réponse ne modifie rien.
> 8. On n'informe que sur ce qu'on conserve : un composant n'émet d'information que sur une ressource dont il est propriétaire.

**Contre-exemples :** une View appelle directement une méthode de la Feature ; un composant ouvre un Channel sous le nom d'un autre ; un parent lit l'état de son enfant ; un parent passe une fonction de rappel à son enfant ; une View émet sur le Channel du panier ; la Feature panier compte les consultations de son total dans le traitement qui y répond ; la Feature des commandes émet « commande expédiée » dès la réponse du serveur, sans avoir d'abord inscrit ce statut dans son état.

**Pourquoi le point 8 ?** Un Event dit « voici ce que je sais ». Si ce n'était pas inscrit dans l'état de son émetteur, une Query juste après pourrait le contredire : l'Event annonce « commande expédiée », la Query répond « en préparation ». En inscrivant d'abord, puis en émettant, l'émetteur reste la source de vérité de ce qu'il annonce.

**Pourquoi tant de rigueur ?** Parce que chaque raccourci rouvre une porte dérobée. Prends la fonction de rappel passée à un enfant, le motif des « callbacks en props » de React : elle crée un lien direct et invisible entre deux composants. Personne ne le voit dans le graphe des messages, personne ne peut le tracer. En imposant que tout passe par un Channel, **chaque échange devient visible, traçable et remplaçable**. Les composants communiquent sans se connaître.

### Les trois voies (T2)

Voici sans doute la conséquence la plus élégante de la théorie. Toute interaction porte sur une ressource, qui a un propriétaire unique. Pose-toi deux questions :

1. Est-ce que je veux **changer** la ressource, ou **en savoir** quelque chose ?
2. Est-ce que **je suis** son propriétaire ?

| | Je veux la changer | Je veux en savoir quelque chose | J'en informe les autres |
| --- | --- | --- | --- |
| **Je suis le propriétaire** | je le fais moi-même, sans message | inutile : j'y ai accès | **Event** |
| **Je ne suis pas le propriétaire** | **Command** | **Query** | impossible : je ne la connais pas |

Il n'existe donc que **trois voies d'interaction**, et ce n'est pas un choix arbitraire : c'est la seule possibilité compatible avec A1 et A3. On en déduit aussi leurs comportements :

- une **Command** (`trigger`) et une **Query** (`query()`) n'ont qu'**un seul** destinataire, le propriétaire ;
- un **Event** (`emit`) peut avoir **plusieurs** destinataires (`listen`), puisque recevoir ne donne aucun droit.

Pour notre panier : la View *adresse* `cart:addItem` (Command), *demande* `cart:total` (Query), et *reçoit* `cart:itemAdded` (Event) émis par la Feature panier.

**La Query est une simple consultation.** Elle n'a rien d'une requête réseau. Quand la View demande `cart:total`, le traitement de la Feature s'exécute aussitôt, pendant celui de la View, et lui rend le total en réponse : la View s'en sert dans la ligne suivante, sans attendre. En contrepartie, ce traitement **ne modifie rien** (A3, point 7) : une Query n'a jamais d'effet de bord. Une Command, elle, change quelque chose et ne rend rien ; si tu as besoin de savoir ce qu'elle a changé, reçois l'Event qui suit, ou fais une Query ensuite. Et si la réponse demandait un appel réseau, ce ne serait plus une Query : ce serait une Command, puis un Event.

### Un traitement à la fois (G5)

Quand un composant adresse une Command, émet un Event ou se transmet un message local, le message n'est pas traité sur-le-champ : il attend la fin du traitement en cours. Seule la Query fait exception : son auteur a besoin de la réponse pour continuer, et un traitement n'attend rien. Elle est donc traitée aussitôt, et c'est sans danger parce qu'elle ne modifie rien.

Pourquoi ? Imagine que les messages soient traités immédiatement, à l'intérieur du traitement qui les produit. La Feature panier émet `itemAdded { total: 20 }` ; une Feature `promo`, abonnée la première, réagit en émettant `promo:applied { remise: 2 }` ; le panier, abonné à `promo:applied`, applique la remise et émet `totalChanged { total: 18 }`, que la View reçoit et affiche (18). Puis seulement `itemAdded` atteint la View, qui affiche… 20. Chaque traitement est juste, mais l'écran ment, et c'est l'ordre d'inscription des abonnés qui en décide. De même, une erreur dans le traitement d'une autre Feature interromprait le tien en plein milieu.

Avec un traitement à la fois, tout cela disparaît : chaque traitement se termine avant que le suivant commence, une erreur reste confinée au traitement où elle survient, et une Query lit toujours un état complet. La règle à retenir est simple : **après `trigger` ou `emit`, rien n'a encore changé ailleurs.**

**Dans quel ordre ?** Les messages en attente passent dans l'ordre où ils ont été produits, et un Event est délivré à ses abonnés dans l'ordre où ils se sont abonnés (D8). Si ta Feature adresse `A` puis `B`, `A` est traité avant `B`. C'est ce qui rend une exécution rejouable : avec les mêmes faits en entrée, la même suite de traitements.

> **Image : le journal de rejeu.** Rejouer une session, c'est réinjecter les faits enregistrés (clics, réponses du serveur) depuis le même état initial. L'heure et les valeurs aléatoires ne se relisent pas à l'identique : un outil de rejeu les note pendant l'exécution réelle et les restitue dans le même ordre. Cela ne fonctionne que parce que l'ordre des traitements est fixe. C'est une affaire d'outillage, pas une règle de la théorie.

**Et une boucle ?** Si `cart` émet `totalChanged`, que `promo` y réagit en émettant `promo:applied`, auquel `cart` réagit en changeant son total et en émettant à nouveau `totalChanged`, la chaîne ne s'arrêterait jamais. Bonsai compte la profondeur de chaque chaîne causale : au-delà d'une borne fixée, le message est rejeté et l'erreur te dit de quelle chaîne il venait (D9). Un Event reçu par cinquante abonnés ne compte que pour un pas.

**Et si un traitement échoue ?** Le traitement de `cart:addItem` ajoute la ligne, puis plante en recalculant le total. Sans précaution, le panier garderait la ligne avec l'ancien total : incohérent, sans que rien ne le signale. Bonsai annule le traitement (G7) : aucun changement de l'Entity n'est conservé, aucun Event produit pendant ce traitement n'est délivré, et l'erreur est signalée avec le clic d'origine. Une seule limite : ce que l'hôte a déjà fait (une écriture dans le stockage local, une requête partie) ne s'annule pas. D'où le réflexe : confie tes effets sur l'hôte à un adaptateur par une Command, qui ne partira qu'à la fin de ton traitement.

### Le message local

Une Feature lance une requête réseau. Quand la réponse arrive, elle ne peut pas modifier son état directement : le traitement d'origine est terminé, et la règle du traitement synchrone l'interdit. Elle **se transmet un message local** : l'infrastructure de communication le transporte et le lui délivre, à elle seule, sans passer par aucun Channel, et elle le traite normalement.

Pourquoi sans Channel ? Un Channel est désigné par une identité : d'autres composants peuvent y adresser un message ou s'y abonner. Le message local, lui, n'a qu'un destinataire possible, le composant qui l'a produit. Il n'est ni *adressé* ni *émis* : ces deux mots sont réservés aux messages qui passent par un Channel. Comme tout message, il porte un contexte causal : la réponse réseau reste rattachée à la chaîne causale de la requête qui l'a provoquée (§8). C'est un peu plus long à écrire, mais chaque changement d'état reste rattaché à un message, donc traçable.

**Et si une Feature s'adressait un message sur son propre Channel ?** Ce n'est pas interdit, mais cela n'apporte rien : le message attend la fin du traitement en cours, comme tout message, puis revient à la Feature. Pour réutiliser une logique, un appel de fonction interne suffit ; pour prolonger une chaîne causale après un fait provoqué, c'est le message local qui est prévu. Pour connaître l'état de sa propre Entity, la Feature la lit directement : elle n'a aucune Query à s'adresser.

## 7. Le domaine et l'interface

### Les mots

- L'**interface utilisateur** regroupe ce par quoi l'utilisateur voit l'application et agit sur elle (la page, les boutons, les champs), ainsi que les composants qui en sont propriétaires.
- Le **domaine** est tout le reste : la logique métier, la vérité de l'application. Une ressource appartient toujours à la même partie que son propriétaire.
- Un **invariant métier** est une règle que les données métier doivent toujours respecter, par exemple « le total du panier égale la somme de ses lignes ». **C'est toi qui les écris**, pour ton application : Bonsai n'en impose aucun, il garantit seulement qu'ils sont respectés.
- Un **système extérieur** est un service avec lequel le domaine échange des données métier, par exemple une API de paiement.

### La règle : A4 — Autosuffisance du domaine

> 1. Les invariants métier sont respectés à la fin de chaque traitement, qu'il y ait une interface ou non.
> 2. Le domaine n'adresse aucun message à un Channel de l'interface, et ne reçoit aucun message émis par elle.
> 3. Seul le domaine échange des informations métier avec les systèmes extérieurs.
> 4. Toute information métier affichée par l'interface vient d'un Event émis par le domaine ou de la réponse à une Query, et n'est remplacée que par une information de même provenance.
> 5. Un Channel du domaine ne disparaît qu'avec l'application.

**Contre-exemples :** une Command laisse le panier avec un total faux ; la Feature panier reçoit un Event émis par une View ; une View appelle elle-même l'API de paiement ; au clic sur « Ajouter », une View incrémente le compteur du panier affiché sans attendre l'Event de la Feature ; une Feature est détruite alors que l'application continue.

**Les quatre sens de communication.** Le point 2 n'interdit pas au domaine de parler : il interdit seulement deux directions.

| | Interface → domaine | Domaine → interface |
| --- | --- | --- |
| **Adresser** (Command, Query) | ✅ une View adresse `cart:addItem` | ❌ interdit (point 2) |
| **Émettre / recevoir** (Event) | ❌ le domaine ne reçoit rien de ce que l'interface émet | ✅ la Feature émet `cart:itemAdded`, la View le reçoit |

Autrement dit, le domaine ne sait pas que l'interface existe : il annonce ce qui change, et qui veut l'entend.

**Ce que le point 4 permet encore.** Une View peut afficher une copie d'une information métier, la filtrer, la trier ou la paginer. Elle ne peut pas l'altérer en dehors du traitement d'un message venu du domaine. Une information qui ne porte sur aucune donnée du domaine, comme la position d'un carrousel ou une saisie en cours, n'est pas une information métier : la View la gère librement dans son état local.

**Pourquoi le point 5 ?** À tout moment, une View ou un adaptateur peut adresser une Command au Channel `cart`, et une autre Feature lui poser une Query : son nom vient du Manifest, tout le monde peut le connaître. Ce message doit pouvoir être traité, et les invariants vérifiés. Le Channel doit donc toujours exister, et comme il disparaîtrait avec sa Feature, la Feature aussi.

**Pourquoi ?** Le domaine est la **source de vérité**. Si sa cohérence dépendait de l'interface, il suffirait de changer d'écran pour casser les données. Avec A4, tu pourrais supprimer toute l'interface : le domaine continuerait de fonctionner correctement, et tu peux le tester sans navigateur. L'interface, elle, dépend du domaine : elle lui adresse des demandes et reçoit ce qu'il annonce. Jamais l'inverse.

### Une conséquence qui guide ta modélisation (T5)

Un traitement est exécuté par un seul composant, qui ne modifie que ses propres ressources. Si un invariant liait les données de deux Features, modifier l'une laisserait l'autre en retard, et l'invariant serait faux entre les deux traitements. Conclusion : **un invariant qui relie plusieurs données porte toujours sur les données d'une seule Feature**.

C'est très concret : si tu veux écrire une règle qui relie le panier et le stock, la théorie te dit que tu as mal découpé ton domaine. Les deux données doivent appartenir à la même Feature.

## 8. Pourquoi les choses changent

### Les mots

- Une **cause** est le fait qui explique un message ou un changement d'état : un clic, une réponse réseau, une minuterie. Elle n'est pas dans l'application ; elle l'explique.
- Une **origine** est une cause première ; une **continuation** est une cause qui découle d'une autre. Ensemble, elles forment une **chaîne causale**. Un clic est une origine ; la réponse à un appel réseau lancé après ce clic en est une continuation, car c'est l'application elle-même qui l'a provoquée.
- Le **contexte causal** est l'information, portée par chaque message, qui le rattache à sa chaîne. Il voyage à côté des données, jamais mélangé avec elles.
- L'**admission** est le moment où un fait de l'hôte entre dans l'application, à la **frontière de confiance**.

### La règle : A5 — Causalité

> 1. Tout changement d'état résulte du traitement d'un message.
> 2. Tout message porte un contexte causal.
> 3. Un fait de l'hôte n'entre dans l'application que par un message. Si rien dans l'application ne l'a provoqué, c'est une origine ; s'il répond à quelque chose que l'application a lancé, c'est une continuation.
> 4. Un fait n'est admis que par un seul composant.

**Contre-exemples :** une minuterie modifie directement le panier ; un message circule sans contexte causal ; un gestionnaire `onclick` modifie un état sans passer par un message ; la View de recherche et l'adaptateur du document réagissent tous deux au même Ctrl+K.

**Le point 4 avec Ctrl+K.** Le focus est dans un champ d'une View, l'utilisateur appuie sur Ctrl+K : le navigateur produit un seul événement, qui traverse la part de la View puis remonte jusqu'au document. Si les deux l'admettaient, une seule cause donnerait deux chaînes causales. La règle (D10) : ce qui survient dans la part d'une View est admis par cette View, sauf les raccourcis déclarés globaux, admis par l'adaptateur du document quel que soit l'endroit où se trouve le focus.

**Pourquoi ?** Parce que tu veux toujours pouvoir répondre à la question « **pourquoi** cette valeur a-t-elle changé ? ». Si tout changement passe par un message, et si chaque message sait d'où il vient, tu peux remonter du symptôme jusqu'au clic d'origine. C'est ce qui rend possibles le débogage pas à pas, la journalisation complète, ou le rejeu d'une session.

Note que le clic lui-même n'est pas un message : c'est un fait de l'hôte. La View l'**admet** en produisant une Command. C'est à ce moment-là, et seulement à ce moment-là, qu'il entre dans l'application.

**Rien de ce qui entre n'est présumé correct.** Une saisie, une réponse du serveur, une valeur du stockage local : tout ce qui entre dans le modèle est admis par un composant, puis traité comme n'importe quel message. C'est la Feature qui le traite qui le vérifie, puisque ses invariants doivent tenir à l'issue du traitement (A4, 11.7).

### Un exemple complet : ajouter un article au panier

Suivons une seule action de bout en bout pour voir le contexte causal voyager. L'utilisateur clique sur « Ajouter cet article » ; la boutique doit faire confirmer l'ajout par son serveur (un système extérieur) avant de l'inscrire dans le panier.

1. **Le clic.** C'est un fait de l'hôte, *spontané* : rien dans l'application ne l'a provoqué. La View propriétaire du bouton l'admet et produit la Command `cart:addItem`, avec l'article dans les données, adressée au Channel `cart`. Son contexte causal est une **nouvelle origine** ; appelons-la O1.
2. **Premier traitement.** L'infrastructure de communication délivre la Command au propriétaire du Channel, la Feature `cart`. Elle vérifie la demande, lance la requête vers le serveur, et **son traitement s'arrête là** : un traitement n'attend jamais une réponse. Avant de rendre la main, la requête a été rattachée à O1.
3. **La réponse arrive.** C'est un fait *provoqué* : c'est le traitement de l'étape 2 qui a lancé la requête. La Feature l'admet, mais elle n'est plus en train de traiter un message ; modifier l'Entity dans le `.then()` violerait A5. Elle se transmet donc un **message local**, par exemple `articleConfirmed`, dont le contexte causal est une **continuation de O1** (§6, « Le message local »).
4. **Second traitement.** L'infrastructure délivre le message local à la Feature, et à elle seule. Elle met à jour l'Entity du panier ; les invariants métier sont vérifiés à la fin de ce traitement. Puis elle émet l'Event `cart:itemAdded` sur son Channel, lui aussi continuation de O1.
5. **L'affichage.** La View, abonnée au Channel `cart`, reçoit l'Event et met à jour le panier affiché avec l'information qu'il porte.

```text
clic ──admis──▶ Command cart:addItem        (O1, origine)
                  │ traitement : requête lancée
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

- **Qui garde le contexte pendant l'attente ?** Le composant qui a provoqué le fait, ici la Feature. Ce n'est pas ton code qui fabrique ou recopie le contexte : Bonsai le capture au lancement de la requête et le rend au message local. Si plusieurs requêtes sont en cours, chaque réponse retrouve le contexte de *sa* requête.
- **Si le serveur refuse ou ne répond pas**, c'est le même chemin : un message local `articleRejected`, continuation de O1. La Feature laisse le panier cohérent, inscrit l'échec dans son état, puis peut émettre un Event d'échec que la View affiche.
- **Pourquoi ne pas exposer `articleConfirmed` sur le Channel `cart` ?** Parce qu'alors d'autres composants pourraient y adresser ce message et simuler une confirmation du serveur. Le message local ne peut être produit que par la Feature, au moment où elle admet la réponse.

## 9. Les choix propres à Bonsai

Les axiomes valent pour toute application conforme à la théorie. Certaines règles, en revanche, sont des **choix de Bonsai** : une autre architecture respectant les mêmes axiomes pourrait décider autrement. On les appelle **décisions**, et chacune a son « pourquoi ».

Une décision se justifie toujours par l'une de deux choses :

- une **conséquence** : une qualité que les axiomes établissent déjà (la traçabilité causale, la cohérence métier, la continuité du domaine, l'isolation des composants) ;
- un **objectif** : un but que Bonsai poursuit sans que les axiomes l'imposent. Il y en a trois : la *rejouabilité* (rejouer les mêmes faits depuis le même état redonne les mêmes états, pourvu que ton code soit déterministe), la *détection précoce* des violations, et l'*ergonomie de développement*.

Un objectif est un but, pas une règle : aucune démonstration ne s'y appuie, et rien ne t'oblige à l'atteindre pour être conforme.

| Décision | Ce qu'elle dit | Pourquoi | Ce qu'elle écarte |
| --- | --- | --- | --- |
| **D1 — Enfants de l'Application** | Les Features et la Foundation sont des enfants directs de l'Application, qui ne détruit pas la Foundation. | Un domaine à plat : aucune Feature n'est responsable de l'existence d'une autre. La survie des Features, elle, découle de A4 (T6). | Des Features enfants d'autres Features. |
| **D2 — Entity pérenne** | Une Feature ne détruit pas son Entity. Son nom et son Channel, eux, durent autant qu'elle par A2 et A4. | Vider un panier est une modification, pas une destruction : détruire puis recréer l'Entity reviendrait au même. | Réinitialiser l'Entity en la détruisant puis en la recréant. |
| **D3 — Élément de la Foundation** | La Foundation prend en charge un élément de la page, par défaut son corps, et lui seul, et le découpe pour ses enfants. | La Foundation relève de l'interface utilisateur : elle ne peut pas aussi porter l'en-tête ou la taille de la fenêtre, qui ont leur adaptateur (D7). | Une Foundation qui prendrait en charge tout le document. |
| **D4 — Une Feature, une Entity** | Chaque Feature est propriétaire d'exactement un état métier. | T5 exige qu'un invariant relève d'un seul propriétaire ; un seul état par Feature le rend lisible. | Plusieurs Entities par Feature. |
| **D6 — Interface non adressable** | Ni une View ni un Composer n'a de nom, donc pas de Channel. | Ils peuvent être détruits à tout moment : on ne leur adresse rien, ils reçoivent. Les Views se coordonnent par le domaine. | Des Views qui s'adresseraient des messages entre elles. |
| **D7 — Adaptateurs de l'hôte** | Ce qui vient de l'hôte hors du corps de la page (en-tête et titre, taille de la fenêtre, historique, stockage local) est pris en charge par un seul composant dédié, enfant de l'Application. | Un seul point d'entrée par source : un redimensionnement produit un seul message, pas un par View qui l'observe. | Chaque composant qui prendrait en charge lui-même la source dont il a besoin. |
| **D8 — Ordre de délivrance** | Les messages en attente passent dans l'ordre où ils ont été produits ; un Event atteint ses abonnés dans l'ordre des abonnements. | Le même code avec les mêmes entrées donne la même suite de traitements : c'est ce qui rend le rejeu possible. | Un ordre non spécifié, ou le dernier message produit traité en premier. |
| **D9 — Borne causale** | Une chaîne causale a une profondeur maximale ; au-delà, le message est rejeté et signalé. | Une boucle entre Features n'est visible d'aucune d'elles. | Aucune borne, ou une détection des cycles. |
| **D10 — Admission par la cible** | Un fait de l'hôte est admis par le propriétaire de la part où il survient, sauf les raccourcis déclarés globaux, admis par l'adaptateur du document. | Un fait n'est admis qu'une fois (A5) ; un raccourci global n'appartient à aucune View. | Chaque View relaie le raccourci, ou le premier qui réagit l'admet. |
| **D11 — Composition réservée** | Une View est toujours enfant d'un Composer ; la Foundation et les Views n'ont pour enfants que des Composers. | Séparer ce qu'on affiche de la façon dont on l'affiche. | Une View qui crée elle-même d'autres Views. |
| **D12 — Décideur pur** | Un Composer ne dessine rien, n'a pas d'état hors le contenu de son slot, n'écoute pas l'utilisateur et n'envoie pas de Command. | Sa décision se recalcule à partir du domaine : elle en reste une projection. | Un Composer qui écrit dans le DOM ou garde sa propre mémoire. |
| **D13 — Behavior aveugle** | Un Behavior ne voit ni la View qui le porte ni ses clés. | Pour pouvoir le greffer sur n'importe quelle View. | Un Behavior qui lit `this.view`, ou un Behavior composant avec sa propre part. |
| **D14 — Enfants de la racine déclarés** | Toutes les Features et tous les adaptateurs sont créés au démarrage, d'après le Manifest, éventuellement assemblé depuis plusieurs modules. | Tout ce qui existe est connu avant le premier message, donc vérifiable. | Des Features enregistrées ou créées après le démarrage. |
| **D15 — Navigation fournie** | Bonsai fournit la Feature `router` (état de navigation), activée par le Manifest ; l'adresse, elle, est tenue par l'adaptateur historique. | Toute application à plusieurs pages en a besoin, et l'adaptateur doit savoir projeter son Event. | Un routeur maison par application, ou un routeur qui modifie l'adresse lui-même. |
| **D16 — Contrats déclarés** | Un composant déclare à l'avance ce qu'il écoute, adresse et admet ; ses traitements en sont dérivés. | Tout est connu avant le premier message : le compilateur et le démarrage vérifient. | Des abonnements enregistrés à l'exécution (`on("x", fn)`). |
| **D17 — Chorégraphie du domaine** | Une Feature n'adresse aucune Command à une autre Feature ; elles se coordonnent par Events. | Aucune Feature ne devient l'orchestratrice des autres ; le contexte causal reconstitue le déroulement. | Des Commands entre Features (orchestration). |
| **D18 — L'interface relaie, elle n'enchaîne pas** | Une View n'adresse de Command qu'en réponse à l'utilisateur, jamais en réaction à un Event. | Un enchaînement Event → Command est une décision métier, qui doit rester dans le domaine. | Une View qui orchestre un processus. |

*D5 n'existe plus.* Elle disait que l'Application distribue les identités aux Features : c'est une conséquence de A2 (un composant ne choisit pas son nom, seul son parent lui en attribue) et de D1, pas un choix.

### Les Features ne se commandent pas (D17, D18)

Une commande en ligne : `order`, `stock` et `payment`. Bonsai ne laisse pas `order` donner des ordres aux deux autres. Le déroulement est une **chorégraphie** :

1. la View adresse `order:place` ; `order` passe à « en cours » et émet `order:placed` ;
2. `stock`, abonné, réserve et émet `stock:reserved` (ou `stock:reservationFailed`) ;
3. `payment`, abonné à `stock:reserved`, débite et émet `payment:captured` (ou `payment:failed`) ;
4. `order` passe à « confirmée » ou « échouée » ; `stock`, abonné à `payment:failed`, libère sa réservation.

Aucune Feature ne devient le chef d'orchestre des autres : chacune ne décide que de ce qui est à elle. Le déroulement n'est écrit dans aucun fichier, mais le contexte causal le reconstitue en entier, depuis le clic sur « Commander ». La règle d'écriture qui rend cela tenable : **un Event dit ce qui s'est passé chez moi, jamais ce que j'attends des autres** (`order:placed`, pas `order:pleaseReserveStock`).

Une Feature peut en revanche poser des Queries aux autres, et adresser des Commands aux adaptateurs du domaine (écrire dans le stockage local, par exemple).

Et la View ne prend pas le relais (D18). Une View abonnée à `order:placed` qui adresserait `stock:reserve` deviendrait l'orchestratrice interdite aux Features, et le processus disparaîtrait avec elle. Une View n'adresse une Command qu'en réponse à l'utilisateur ; quand elle reçoit un Event, elle met seulement son affichage à jour.

### Le domaine survit à tout (T6)

Ce n'est pas une décision mais une conséquence de A4, point 5. Une Feature est propriétaire de son Channel ; si elle était détruite, son Channel le serait avec elle (T3), ce que A4 interdit. Personne ne peut donc la détruire avant la fin de l'application : ni une View, ni l'Application elle-même : seul l'hôte met fin à la racine. Une Feature survit donc à toute navigation, à tout changement d'écran, à tout redimensionnement. **Seule la fermeture de la page met fin à l'application**, et à tout ce qu'elle contient.

### Les adaptateurs de l'hôte (D7, annexe B)

Tout ce qui vient du navigateur hors du corps de la page (titre, taille de la fenêtre, adresse, stockage…), hors les requêtes et les minuteries, admises par le composant qui les lance, passe par un **adaptateur** : un composant fourni par Bonsai, seul à admettre sa source.

**Pourquoi plusieurs adaptateurs pour le même document ?** Un adaptateur appartient tout entier à l'interface ou au domaine. Le titre de l'onglet, « (3) Mon panier », est perçu par l'utilisateur : son adaptateur relève de l'interface, et met le titre à jour en recevant les Events du panier. La visibilité de l'onglet, elle, sert à une Feature qui suspend ses appels au serveur quand l'onglet est masqué : un composant du domaine ne recevant rien de l'interface (A4), son adaptateur relève du domaine. D'où deux adaptateurs, celui du document et celui du cycle de vie de la page. Même chose pour la fenêtre : les points de rupture servent au domaine (Viewport), le défilement relève de l'interface (adaptateur du défilement).

**Le catalogue des adaptateurs (annexe B).** Bonsai fournit une liste fermée de treize adaptateurs pour le navigateur : document, Viewport, défilement, historique, cinq stockages (local, session, base indexée, cache, cookies), cycle de vie, connectivité, environnement (langue, fuseau) et presse-papiers. Tu actives ceux dont tu as besoin, tu peux les spécialiser sur des valeurs déjà admises, mais tu ne touches jamais à ce qui relie l'adaptateur à l'hôte. Une API du navigateur absente du catalogue (géolocalisation, caméra…) n'est pas conforme en V1. Chaque adaptateur a sa fiche dans `docs/adaptateurs/`.

**Le routeur.** Bonsai fournit une Feature `router` (D15), que tu actives dans le Manifest. Elle garde l'état de navigation (chemin, paramètres) et émet `router:routeChanged { route, mode }` ; elle ne touche jamais l'adresse du navigateur, qui est une ressource de l'interface tenue par l'adaptateur historique. Le flux d'une navigation : une View adresse `router:navigate { /products/42, push }` ; le routeur met à jour son état et émet `routeChanged` ; l'adaptateur historique ajoute l'entrée `/products/42` ; `ProductFeature` charge le produit ; la View affiche le résultat. Pour revenir en arrière, une View adresse `history:back` à l'adaptateur : le routeur ne peut pas le faire, puisqu'un composant du domaine n'adresse rien à l'interface (A4).

**L'adresse et le bouton « retour ».** L'adresse est une projection de la Feature de navigation, tenue par l'adaptateur historique. Quand l'utilisateur clique sur « retour », l'adaptateur admet le fait et adresse lui-même `router:navigate { /admin, pop }` à la Feature. Si l'utilisateur n'est plus connecté, la Feature redirige et émet `router:routeChanged { login, pop }`. L'adaptateur compare : l'adresse projetée `/login` diffère de `/admin`, et le mode est `pop`, donc il **remplace** l'entrée au lieu d'en ajouter une. Sans cette règle, le « retour » suivant ramènerait sur `/admin`, qui redirigerait encore : l'utilisateur serait piégé. Et quand l'adresse projetée est déjà l'adresse courante, l'adaptateur ne fait rien (annexe B.5).

### Plusieurs applications sur une même page (G6)

Plusieurs applications Bonsai peuvent coexister sur une même page. Chacune a sa propre Foundation, montée sur son propre élément, et vit comme si l'autre était un autre onglet : elles ne s'adressent aucun message, et si l'une modifie le stockage local ou le titre, l'autre le perçoit comme un fait de l'hôte. Deux applications peuvent donc avoir chacune leur Feature `cart` sans se confondre.

## 10. Les rôles : ce que tu écris vraiment

Tout ce qui précède était abstrait. Les rôles sont les classes que tu manipules au quotidien. Ce ne sont pas des notions de base : chacun est une **combinaison** de termes, d'axiomes et de décisions. C'est pour cela qu'on peut justifier chacune de leurs règles.

### Application

La racine. Elle reçoit le Manifest à sa création et crée tous ses enfants au démarrage (D14). Elle est propriétaire de l'espace des identités et les distribue aux Features et aux adaptateurs (A2.a, A2.d, D1). Elle est le parent des Features, de la Foundation et des adaptateurs. Elle n'a pas de Channel : elle ne parle à personne. Sa fin vient de l'hôte : la fermeture de la page.

### Feature

Un composant du domaine. Elle est propriétaire d'un nom attribué par l'Application, le Channel désigné par ce nom, et une Entity. Elle traite les messages adressés à son Channel et émet ses propres Events.

*Ce qui en découle :* elle n'émet que sur son propre Channel (A3, T2) ; elle survit à toute l'interface (T6) ; elle ne modifie jamais son état dans un `.then()`, mais se transmet un message local (§6).

*Choix de Bonsai :* elle déclare à l'avance ce qu'elle écoute et interroge, et ses traitements en sont dérivés (D16) ; elle ne donne jamais d'ordre à une autre Feature, mais peut en donner aux adaptateurs du domaine (D17).

### Entity

L'état métier d'une Feature, avec les opérations qui le modifient. **Une Entity n'est pas un composant** : elle n'a ni nom, ni Channel, ni existence propre. C'est une ressource de sa Feature. Quand l'Entity exécute `mutate()`, c'est en réalité la Feature qui agit. Ses invariants métier sont écrits par toi et respectés à chaque fin de traitement (A4).

### Foundation

Un composant de l'interface, enfant de l'Application. Elle prend en charge le corps de la page, ou l'élément qu'on lui désigne (D3) et en attribue des parts à ses enfants : c'est en quelque sorte le Composer racine. L'en-tête et le titre relèvent d'un composant dédié, l'adaptateur du document (D7).

### Composer

Un composant de l'interface qui **décide quelle View afficher** dans une zone de la page. Il est propriétaire d'une part de la page, son *slot*, attribuée par son parent (la Foundation, ou une View qui déclare un emplacement). Il est le parent des Views qu'il affiche, et lui seul l'est : une View ne crée jamais une autre View (D11). Comme la View, il n'a ni nom ni Channel : on ne lui adresse rien, il reçoit des Events et peut poser des Queries (D6).

Son travail tient en une fonction : `resolve(event)`. À sa création, puis à chaque Event du domaine qu'il reçoit, il répond à une seule question : « quelle(s) View(s) doivent occuper mon slot maintenant ? », avec une View, plusieurs, ou aucune.

*Ce qui découle des axiomes :*

- **Seul lui détruit ses Views.** Il est propriétaire de leur existence, donc le seul à pouvoir les détruire (A1).
- **Il découpe sa part pour ses Views.** Le sélecteur qu'il donne à une View désigne une part de son slot (A2). Les parts ne se recouvrant pas (T7), deux Views d'un même Composer ne se chevauchent jamais, et le Composer ne lit pas l'intérieur des parts qu'il a confiées (A3).
- **Il évite de recréer inutilement.** Si `resolve` désigne la même View au même endroit, il la garde. Détruire une View détruit toute sa descendance (T3) : on ne le fait que si c'est nécessaire.
- **Son slot ne disparaît pas sous lui.** Si la View parente veut retirer l'élément du slot, elle détruit d'abord le Composer. Si le slot revient plus tard, c'est un nouveau Composer qui naît.

*Ce qui relève de choix de Bonsai (D12, « décideur pur ») :*

- **Il ne dessine rien.** Il est propriétaire de son slot et pourrait le modifier (A1 le permet), mais Bonsai sépare les responsabilités : le Composer décide de la **structure**, la View fait le **rendu**. Il ne crée que les éléments qui accueillent ses Views.
- **Il n'a pas d'état propre**, hors le contenu de son slot. Son choix ne dépend que de l'Event reçu et de ce que ses Queries lui rendent. La vérité est dans le domaine (A4) : si le Composer gardait sa propre mémoire de « ce qui devrait être affiché », elle pourrait contredire le domaine.
- **Il n'écoute pas l'utilisateur et ne commande rien.** Pas de gestionnaire de clic, pas de Command : c'est le travail de la View.

### View

Un composant de l'interface. Elle est propriétaire d'une part de la page, attribuée par son parent. Elle n'a pas de nom ni de Channel (D6).

*Ce qui en découle :*

- elle **adresse** des Commands et des Queries aux Features et aux adaptateurs, et **reçoit** leurs Events, mais n'émet jamais rien ;
- elle n'adresse une Command qu'en réponse à l'utilisateur, jamais en réaction à un Event (D18) ;
- elle reçoit à sa création un **sélecteur** désignant sa part, pas un élément DOM : un sélecteur est une simple information, alors qu'un élément serait une référence, interdite (A3) ;
- elle obtient l'élément elle-même, en résolvant ce sélecteur auprès de l'hôte ;
- sa part ne recouvre aucune autre part (T7) : c'est pourquoi elle ne touche jamais au DOM de ses voisines ni au contenu des slots qu'elle a confiés à ses Composers ; elle garde en revanche l'élément de chaque slot ;
- elle ne supprime jamais son propre élément racine : elle peut en changer les attributs et dispose librement de tout ce qu'il contient, hors le contenu de ses slots ;
- elle transforme les clics et saisies de l'utilisateur, faits de l'hôte, en messages (A5), sauf les raccourcis déclarés globaux, qui reviennent à l'adaptateur du document (D10).

### Behavior

Un morceau de code de View **réutilisable**, que tu greffes sur des Views sans rapport entre elles : tracking des clics `[data-track]`, défilement infini, validation de formulaire, champ qui s'agrandit. Ce n'est pas un composant : tout ce qu'il fait, c'est la View qui le fait (règle d'imputation).

C'est ce qui rend le tracking juste. Quand l'utilisateur clique sur « Ajouter au panier » (`data-track`), la View et son `TrackingBehavior` réagissent au même clic. Le clic est admis **une seule fois**, par la View, et les deux Commands (`cart:addItem` et `analytics:trackInteraction`) partagent la même origine : dans les outils de développement, le tracking apparaît dans la chaîne de l'ajout au panier.

- **Il est aveugle (D13).** Il ne voit ni la View qui le porte ni ses clés : c'est ce qui le rend réutilisable.
- **Il est borné à la part de sa View.** Il ne voit pas l'intérieur des Views enfants : un `TrackingBehavior` posé sur une View de haut niveau ne capte pas les clics de ses descendantes. Chaque View qui veut le tracking le déclare.
- **Il ne produit rien hors de cette part.** Une infobulle qui flotte au-dessus de la page relève d'un Composer ; le défilement de la fenêtre ou le focus qui sort de la View relèvent d'un adaptateur.

### Manifest

Une seule déclaration dit **qui existe et ce qui est à qui** : les Features et leurs noms (`cart`, `user`…), les adaptateurs activés et leurs périmètres (le préfixe `prefs:` du stockage local, par exemple), l'élément de la Foundation, les raccourcis globaux, la borne causale. L'Application la reçoit à sa création et crée tous ses enfants au démarrage (D14).

Ce n'est pas un composant : c'est une information, sans aucune référence (le sélecteur `#app`, jamais l'élément lui-même). Comme tout y est connu avant le premier message, Bonsai peut tout vérifier tôt : deux Features du même nom, un message vers un namespace inconnu, deux stockages qui se recouvrent.

Elle peut être assemblée à partir de plusieurs modules ESM, chargés séparément par la page, pourvu qu'ils le soient avant `start()`. Une Feature dont le module arriverait après le démarrage n'est pas prévue en V1.

### Adaptateur

Un composant fourni par Bonsai, enfant de l'Application, seul à admettre une source du navigateur hors du corps de la page (D7). Tu l'actives dans le Manifest et tu peux le spécialiser, sans jamais toucher à ce qui le relie au navigateur (annexe B). Il appartient tout entier au domaine (Viewport, stockages, cycle de vie…) ou à l'interface (document, défilement, historique, presse-papiers). Un adaptateur de l'interface tient ses ressources en projection du domaine (le titre, l'adresse) et ne les modifie que si elles diffèrent de ce que le domaine annonce.

### Pour notre panier

- La Feature `cart` est propriétaire de l'Entity du panier et du Channel `cart`.
- La View du panier adresse `cart:addItem` quand on clique sur « Ajouter », et reçoit `cart:itemAdded` pour mettre à jour l'affichage.
- Le Composer de la zone principale reçoit les Events de la Feature de navigation. Quand l'utilisateur change de page, son `resolve` désigne une autre View : il détruit la View du panier et monte la nouvelle. Le panier, lui, reste intact (T6).

## 11. Les gardes : ce qui vérifie les règles

Une règle qui n'est vérifiée par rien finit toujours par être violée. Les **gardes** sont les mécanismes qui détectent ou empêchent une violation. Chaque garde protège une règle précise, et on sait laquelle : la table complète est dans `docs/gardes.md`. Une garde vérifie une règle ; elle n'en est jamais la source.

### Les quatre niveaux de garde, du meilleur au moins bon

1. **Par construction.** La violation est impossible à écrire, parce que l'outil n'existe pas. Exemple : Radio n'est pas exporté par `@bonsai/core`, donc aucun composant ne peut ouvrir un Channel à la place de son propriétaire (A3.b).
2. **Avant l'exécution (statique).** TypeScript, ou à défaut une règle de lint, refuse le code. Exemple : une View déclare les Commands qu'elle peut adresser ; en adresser une autre est une erreur de type.
3. **Au démarrage.** L'application refuse de se lancer. Exemple : une référence à un namespace inexistant est détectée au bootstrap.
4. **À l'exécution.** Une erreur est levée au moment de la violation. Exemple : enregistrer un second traitement pour la même Command lève `DuplicateHandlerError` (A3.e).

**Pourquoi cette hiérarchie ?** Plus une erreur est détectée tôt, moins elle coûte. Une violation impossible à écrire ne coûte rien ; une erreur en production coûte cher. C'est le principe de Bonsai : **garantir au plus tôt**. La théorie en fait une règle de méthode (§19) : toute règle qui contraint ton code a une garde, au niveau le plus précoce possible, et une garde plus tardive doit dire pourquoi elle ne peut pas monter. Son meilleur allié, ce sont les **contrats déclarés** (D16) : tu décris à l'avance ce que ton composant écoute, adresse et admet (événements DOM, Events des Channels…), et les méthodes de traitement en sont dérivées. Tout est alors connu avant le premier message, et le compilateur peut refuser ce qui viole la théorie.

### Quelques gardes et la règle qu'elles protègent

| Garde | Niveau | Règle protégée |
| --- | --- | --- |
| Radio et Channel non exportés | construction | A3.b, A3.e : seul le propriétaire d'un Channel le désigne, y traite et y émet |
| `emit` absent du type de la View | compilation | D6 et A3.e : sans Channel, une View n'a rien sur quoi émettre |
| Handlers manquants détectés par `implements` | compilation | D16 : un traitement par message ou fait déclaré, et aucun autre |
| Namespaces vérifiés au bootstrap | démarrage | A2.a, A2.d et D1 : les identités sont attribuées à partir du manifest |
| `rootElement` différent de `body` | démarrage | D3 et A2.d : la Foundation admet le corps par défaut, une View ne reçoit qu'une part. La théorie autorise désormais un autre élément, pour plusieurs applications sur une page ; le code ne suit pas encore |
| `DuplicateHandlerError` | exécution | A3.e : seul le propriétaire d'un Channel traite ce qui y est adressé |
| Pas de Command vers une autre Feature dans le contrat d'une Feature | construction | D17 : chorégraphie du domaine |
| Pas de `trigger` dans le traitement d'un Event d'une View | compilation | D18 : l'interface relaie, elle n'enchaîne pas |
| Profondeur de chaîne dépassée | exécution | D9 : borne causale |

Quand tu tombes sur une de ces erreurs, ne cherche pas à la contourner : elle te signale que ton code viole une règle de la théorie, et la table te dit laquelle.

## 12. Aide-mémoire

### Les six axiomes en une phrase

| Axiome | En une phrase | Ce qu'il t'évite |
| --- | --- | --- |
| **A0 — Cadre** | Tout est dans une seule zone, et le modèle ne contient que composants, ressources et messages. | Les zones floues et les « services » hors règles |
| **A1 — Propriété unique** | Une chose, un propriétaire, seul à la modifier. | Les états modifiés de partout |
| **A2 — Origine** | On devient propriétaire en créant ou en recevant d'en haut, et pour toujours. | Les collisions de noms, les transferts flous |
| **A3 — Médiation** | On se parle uniquement par messages, via des Channels. | Les dépendances cachées entre composants |
| **A4 — Domaine** | Le métier est toujours cohérent, avec ou sans écran, et l'écran n'affiche que ce que le domaine annonce. | Un domaine cassé par l'interface, un affichage qui ment |
| **A5 — Causalité** | Tout changement a un message, et tout message a une cause. | Les changements inexpliqués |

### Les trois réflexes

- **Je veux modifier quelque chose qui n'est pas à moi** → depuis l'interface ou un adaptateur, j'adresse une **Command** à son propriétaire. Entre Features, jamais de Command (D17) : j'émets ce qui s'est passé chez moi, et le propriétaire décide d'y réagir.
- **Je veux savoir quelque chose qui n'est pas à moi** → j'adresse une **Query** à son propriétaire, qui me répond aussitôt, sans rien modifier.
- **J'ai modifié quelque chose qui est à moi** → j'émets un **Event**, qui dit ce qui s'est passé chez moi, jamais ce que j'attends des autres.

### Les questions à se poser devant un doute

1. Qui est le propriétaire de cette donnée ?
2. Est-ce que je passe par un message, ou est-ce que je touche directement à quelque chose qui n'est pas à moi ?
3. Ce changement d'état est-il le traitement d'un message, ou arrive-t-il « tout seul », dans un callback ou après un `await` ?
4. Est-ce que mon invariant relie des données de deux Features différentes ?
5. Quand ce composant disparaît, est-ce que tout ce qu'il a ouvert disparaît avec lui ?
6. Est-ce qu'une Feature donne un ordre à une autre, ou une View enchaîne-t-elle une Command sur un Event ?

Si tu sais répondre à ces six questions, tu respectes la théorie, même dans un cas qu'aucun exemple n'a prévu.
