# Bonsai expliqué — la théorie pour bien démarrer

Oct 8, 2026 · @ncac

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
| **Décisions** | Des choix propres à Bonsai, que les axiomes n'imposent pas | le temps à la pendule d'un tournoi |
| **Gardes** | Ce qui vérifie concrètement que les règles sont respectées | l'arbitre |

Deux habitudes du document de référence méritent d'être connues :

- **Un mot, un sens.** Chaque notion a un seul nom, et chaque nom une seule notion. Si deux personnes peuvent comprendre un mot différemment, il est défini précisément.
- **Chaque règle a son contre-exemple.** Pour chaque axiome, on décrit une situation qui le viole. Si on n'en trouve aucune, la règle ne sert à rien : elle répète une évidence.

### L'exemple qui nous suivra

Tout au long du guide, on prendra une petite boutique en ligne avec un **panier** : l'utilisateur ajoute des articles, voit le total, et valide sa commande. C'est assez simple pour tenir en tête, et assez riche pour illustrer chaque règle.

## 2. Le décor : le modèle, l'hôte et le médiateur

Avant de parler de règles, il faut savoir **de quoi** elles parlent. Bonsai distingue trois zones, et tout ce qui intervient dans une application appartient à exactement l'une d'elles.

- **Le modèle**, c'est ton application : ce que Bonsai organise. Il contient trois sortes de choses, toujours distinctes : des **composants** (les acteurs), des **ressources** (ce que les acteurs possèdent) et des **messages** (ce qu'ils s'envoient).
- **L'hôte**, c'est l'environnement qui fait tourner l'application : le navigateur, le document, la fenêtre. L'application en dépend, mais il n'en fait pas partie, et Bonsai ne le contrôle pas.
- **Le médiateur**, c'est le facteur : il achemine les messages entre composants. Dans le code, c'est Radio, interne et jamais exposé. Il ne fait pas partie du modèle non plus : il ne possède rien et ne prend part à aucune conversation.

**Pourquoi cette séparation ?** Parce que les règles de Bonsai ne s'appliquent qu'au modèle. Si le médiateur était un composant comme les autres, il faudrait lui inventer des exceptions partout : envoyer un message reviendrait à lui parler, ce qui demanderait un message, et ainsi de suite sans fin. En le sortant du modèle, on lui donne à la place quatre **garanties** simples : il livre chaque message au bon destinataire, ne modifie jamais un message, ne livre rien à une adresse disparue, et ne possède rien.

**Pourquoi « primitifs » ?** Modèle, hôte, médiateur, composant, ressource, message : ces mots ne sont pas définis à partir d'autres. Ce sont les briques de départ, comme « point » et « droite » en géométrie. Leur sens se précise par les règles qui les utilisent.

## 3. Qui possède quoi

### Les mots

- Une **ressource** est quelque chose qu'un composant peut posséder : l'état du panier, une adresse de messagerie, un morceau de la page.
- La **propriété** est le lien entre un composant et une ressource. Le composant est son **propriétaire**.
- Une **opération exclusive** est une opération qui *modifie* ou *détruit* une ressource. Lire n'en est pas une.
- Un **état** est une ressource qui peut changer pendant la vie de l'application, comme le contenu du panier.

### La règle : A1 — Propriété unique

> Toute ressource a **exactement un** propriétaire, et **seul** ce propriétaire la modifie ou la détruit.

**Contre-exemple :** deux composants modifient chacun de leur côté le contenu du panier.

**Pourquoi c'est la règle la plus importante.** La plupart des bugs d'une interface viennent d'un état modifié depuis plusieurs endroits : on ne sait plus qui a changé quoi, ni dans quel ordre. Avec A1, la question « qui a pu modifier ce panier ? » a toujours une seule réponse. Pour déboguer, tu sais où regarder.

**Et si un autre composant a besoin de modifier le panier ?** Il ne le fait pas : il le **demande** à son propriétaire, par un message (§6). Bonsai n'autorise aucune « délégation » qui permettrait à un tiers d'agir à la place du propriétaire. C'est plus strict, mais la règle reste vraie sans exception.

**Pourquoi la lecture n'est pas réservée.** Lire ne change rien ; deux lecteurs ne se gênent pas. Ce qui est dangereux, c'est l'écriture concurrente.

## 4. D'où vient la propriété

A1 dit qu'il y a toujours un propriétaire. Il reste à savoir **comment on le devient**.

### Les mots

- La **création** est le moment où une ressource commence d'exister.
- Certaines ressources se découpent en **parts**. Une ressource qu'on peut ainsi partager entre plusieurs propriétaires est dite **distribuable**. Exemple : l'ensemble des noms disponibles dans l'application, ou la page affichée.
- L'**attribution** est l'acte par lequel le propriétaire d'une ressource distribuable en découpe une part et désigne son propriétaire.

### La règle : A2 — Origine de la propriété

> 1. Celui qui crée une ressource en est le propriétaire. Une part, elle, appartient à celui que désigne le propriétaire de la ressource dont elle vient. Deux parts ne se recouvrent jamais.
> 2. Une ressource distribuable vient toujours du haut : de la racine de l'application, de l'hôte, ou d'une ressource distribuable plus large.
> 3. On ne change jamais de propriétaire : la propriété dure jusqu'à la destruction de la ressource.

**Contre-exemples :** un composant se choisit lui-même son nom ; deux composants reçoivent le même nom ; un composant crée son propre espace de noms pour s'y nommer ; un composant « donne » son état à un autre.

**Pourquoi « par le haut ».** Imagine que chaque composant choisisse son propre nom : deux d'entre eux finiront par choisir `cart`. Si au contraire les noms sont distribués par un seul propriétaire, la racine, les collisions deviennent impossibles **par construction** : on n'a pas besoin de les détecter, elles ne peuvent pas exister. C'est le principe du `namespace` attribué à chaque Feature par l'Application.

**Pourquoi aucun transfert.** Si la propriété pouvait passer de main en main, la question « à qui est ceci ? » dépendrait du moment où on la pose. En la rendant fixe, elle a une réponse unique pour toute la vie de la ressource, et TypeScript peut même la vérifier à la compilation. Le prix à payer : on ne déplace pas un composant d'un parent à un autre, on le recrée.

### L'identité

Un nom comme `cart` est la **représentation** d'une **identité**, qui est elle-même une part de l'**espace des identités**. La différence compte : l'identité est la ressource attribuée, protégée par A2 ; le texte `"cart"` n'est qu'une manière de l'écrire. Le mot technique **namespace** désigne cette représentation textuelle.

## 5. La famille des composants

### Les mots

- L'**existence** d'un composant est une ressource à part, attachée à lui. La seule opération qu'on peut faire dessus : la détruire, ce qui détruit le composant.
- Le **parent** d'un composant est le propriétaire de son existence. Ce composant est son **enfant**.
- La **racine** est le composant qui n'a pas de parent dans l'application. Son existence lui est donnée par l'hôte. Dans Bonsai, c'est l'`Application`.
- La **composition** est la relation parent–enfant qui résulte de tout cela.

### L'idée clé : le parent possède l'existence, pas l'enfant

C'est la subtilité qui fait la force de Bonsai. Un parent **ne possède pas son enfant** ; il possède seulement le droit de le faire disparaître. Il ne peut ni lire son état, ni le modifier, ni appeler ses méthodes. Composants, ressources et messages sont trois catégories qui ne se confondent jamais : un enfant n'est pas une ressource de son parent.

**Pourquoi ?** Dans beaucoup de frameworks, un parent tient une référence vers ses enfants et finit par aller fouiller dedans. Les dépendances cachées s'accumulent, et changer un enfant casse le parent. Ici, le parent contrôle le **cycle de vie** de l'enfant, et rien d'autre.

### Deux conséquences démontrées

- **Qui crée devient parent (T1).** Créer un composant, c'est créer son existence ; par A2, le créateur en devient propriétaire, donc parent. Aucune règle supplémentaire n'est nécessaire.
- **La destruction se propage (T3).** Quand un composant disparaît, toutes ses ressources disparaissent avec lui, y compris l'existence de ses enfants, qui disparaissent à leur tour. Pourquoi ? Une ressource ne peut pas rester sans propriétaire (A1), et elle ne peut pas en changer (A2). Il ne reste qu'une possibilité : disparaître aussi.

En pratique, cela signifie qu'**aucun abonnement ne doit survivre** à son composant : un écouteur oublié sur une View démontée est une violation directe de T3.

## 6. Se parler sans se toucher

Puisqu'un composant ne peut pas toucher aux ressources des autres, il faut un moyen de communiquer. C'est le rôle des messages.

### Les mots

- Un **Channel** est une adresse à laquelle on envoie des messages. Chaque Channel est désigné par une identité, et appartient au propriétaire de cette identité.
- **Adresser** un message, c'est l'envoyer à un Channel pour qu'il y soit traité. N'importe quel composant peut adresser.
- **Émettre** un message, c'est le diffuser depuis son propre Channel à tous ceux qui ont demandé à le **recevoir**.
- **Traiter** un message, c'est exécuter quelque chose en réponse. Un traitement est **synchrone** : il se termine sans attendre aucun événement futur.
- Une **référence** est un moyen d'atteindre directement quelque chose, sans passer par un message : un pointeur, un objet JavaScript, un élément DOM. Une **référence structurelle** va d'un propriétaire vers sa propre ressource, ou d'un parent vers son enfant.
- Une **interaction fonctionnelle** est toute transmission d'information d'un composant à un autre.

### La règle : A3 — Médiation

> 1. Toute interaction passe par un message, adressé à un Channel ou émis sur un Channel, et transporté par le médiateur.
> 2. Un Channel est désigné par une identité de son propriétaire.
> 3. Un composant n'utilise que des références structurelles.
> 4. Ce qu'un parent transmet à un enfant à sa création ne contient aucune référence.
> 5. Seul le propriétaire d'un Channel traite ce qu'on lui adresse et émet dessus.
> 6. Tout message, même envoyé à soi-même, passe par un Channel.

**Contre-exemples :** une View appelle directement une méthode de la Feature ; un composant ouvre un Channel sous le nom d'un autre ; un parent lit l'état de son enfant ; un parent passe une fonction de rappel à son enfant ; une View émet sur le Channel du panier.

**Pourquoi tant de rigueur ?** Parce que chaque raccourci rouvre une porte dérobée. Prends la fonction de rappel passée à un enfant, le motif des « callbacks en props » de React : elle crée un lien direct et invisible entre deux composants. Personne ne le voit dans le graphe des messages, personne ne peut le tracer. En imposant que tout passe par un Channel, **chaque échange devient visible, traçable et remplaçable**. Les composants communiquent sans se connaître.

### Les trois voies (T2)

Voici sans doute la conséquence la plus élégante de la théorie. Toute interaction porte sur une ressource, qui a un propriétaire unique. Pose-toi deux questions :

1. Est-ce que je veux **changer** la ressource, ou **en savoir** quelque chose ?
2. Est-ce que **je suis** son propriétaire ?

| | Je veux la changer | Je veux en savoir quelque chose | J'en informe les autres |
| --- | --- | --- | --- |
| **Je suis le propriétaire** | je le fais moi-même, sans message | inutile : j'y ai accès | **Event** |
| **Je ne suis pas le propriétaire** | **Command** | **Request** | impossible : je ne la connais pas |

Il n'existe donc que **trois sortes de messages**, et ce n'est pas un choix arbitraire : c'est la seule possibilité compatible avec A1 et A3. On en déduit aussi leurs comportements :

- une **Command** (`trigger`) et une **Request** (`request`) n'ont qu'**un seul** destinataire, le propriétaire ;
- un **Event** (`emit`) peut avoir **plusieurs** destinataires (`listen`), puisque recevoir ne donne aucun droit.

Pour notre panier : la View *adresse* `cart:addItem` (Command), *demande* `cart:total` (Request), et *reçoit* `cart:itemAdded` (Event) émis par la Feature panier.

### Le message envoyé à soi-même

Une Feature lance une requête réseau. Quand la réponse arrive, elle ne peut pas modifier son état directement : le traitement d'origine est terminé, et la règle du traitement synchrone l'interdit. Elle **s'adresse un message** à elle-même, qui sera traité normalement. C'est un peu plus long à écrire, mais chaque changement d'état reste rattaché à un message, donc traçable (§8).

## 7. Le domaine et l'interface

### Les mots

- L'**interface utilisateur** regroupe ce par quoi l'utilisateur voit l'application et agit sur elle (la page, les boutons, les champs), ainsi que les composants qui en sont propriétaires.
- Le **domaine** est tout le reste : la logique métier, la vérité de l'application. Une ressource appartient toujours à la même partie que son propriétaire.
- Un **invariant métier** est une règle que les données métier doivent toujours respecter, par exemple « le total du panier égale la somme de ses lignes ». **C'est toi qui les écris**, pour ton application : Bonsai n'en impose aucun, il garantit seulement qu'ils sont respectés.
- Un **système extérieur** est un service avec lequel le domaine échange des données métier, par exemple une API de paiement.

### La règle : A4 — Autosuffisance du domaine

> 1. Les invariants métier sont respectés à la fin de chaque traitement, qu'il y ait une interface ou non.
> 2. Le domaine n'envoie rien à l'interface et n'écoute rien de ce qu'elle émet.
> 3. Seul le domaine parle aux systèmes extérieurs.

**Contre-exemples :** une Command laisse le panier avec un total faux ; la Feature panier écoute un événement émis par une View ; une View appelle elle-même l'API de paiement.

**Pourquoi ?** Le domaine est la **source de vérité**. Si sa cohérence dépendait de l'interface, il suffirait de changer d'écran pour casser les données. Avec A4, tu pourrais supprimer toute l'interface : le domaine continuerait de fonctionner correctement, et tu peux le tester sans navigateur. L'interface, elle, dépend du domaine : elle lui adresse des demandes et écoute ce qu'il annonce. Jamais l'inverse.

### Une conséquence qui guide ta modélisation (T5)

Un traitement est exécuté par un seul composant, qui ne modifie que ses propres ressources. Si un invariant liait les données de deux Features, modifier l'une laisserait l'autre en retard, et l'invariant serait faux entre les deux traitements. Conclusion : **un invariant qui relie plusieurs données porte toujours sur les données d'une seule Feature**.

C'est très concret : si tu veux écrire une règle qui relie le panier et le stock, la théorie te dit que tu as mal découpé ton domaine. Les deux données doivent appartenir à la même Feature.

## 8. Pourquoi les choses changent

### Les mots

- Une **cause** est le fait qui explique un message ou un changement d'état : un clic, une réponse réseau, une minuterie. Elle n'est pas dans l'application ; elle l'explique.
- Une **origine** est une cause première ; une **continuation** est une cause qui découle d'une autre. Ensemble, elles forment une **chaîne causale**.
- Le **contexte causal** est l'information, portée par chaque message, qui le rattache à sa chaîne. Il voyage à côté des données, jamais mélangé avec elles.
- L'**admission** est le moment où un fait de l'hôte entre dans l'application, à la **frontière de confiance**.

### La règle : A5 — Causalité

> 1. Tout changement d'état résulte du traitement d'un message.
> 2. Tout message porte un contexte causal.
> 3. Un fait de l'hôte n'entre dans l'application que comme origine d'un message.

**Contre-exemples :** une minuterie modifie directement le panier ; un message circule sans contexte causal ; un gestionnaire `onclick` modifie un état sans passer par un message.

**Pourquoi ?** Parce que tu veux toujours pouvoir répondre à la question « **pourquoi** cette valeur a-t-elle changé ? ». Si tout changement passe par un message, et si chaque message sait d'où il vient, tu peux remonter du symptôme jusqu'au clic d'origine. C'est ce qui rend possibles le débogage pas à pas, la journalisation complète, ou le rejeu d'une session.

Note que le clic lui-même n'est pas un message : c'est un fait de l'hôte. La View l'**admet** en produisant une Command. C'est à ce moment-là, et seulement à ce moment-là, qu'il entre dans l'application.

## 9. Les choix propres à Bonsai

Les axiomes valent pour toute application conforme à la théorie. Certaines règles, en revanche, sont des **choix de Bonsai** : une autre architecture respectant les mêmes axiomes pourrait décider autrement. On les appelle **décisions**, et chacune a son « pourquoi ».

| Décision | Ce qu'elle dit | Pourquoi |
| --- | --- | --- |
| **D1 — Pérennité** | Les Features et la Foundation sont des enfants de l'Application, qui ne les détruit jamais. | Les données métier doivent survivre à tout changement d'écran ; sinon, rien ne garantit que les invariants gardent leurs données. |
| **D2 — Ressources pérennes** | Une Feature ne détruit ni son nom, ni son Channel, ni son Entity. | Même raison : vider un panier est une modification, pas une destruction. |
| **D3 — Admission du document** | La Foundation prend en charge le corps de la page et le découpe pour ses enfants. | Il faut un propriétaire unique de la page pour que A2 s'applique à l'affichage. |
| **D4 — Une Feature, une Entity** | Chaque Feature possède exactement un état métier. | T5 fait de cet état l'unité de cohérence. |
| **D5 — Noms des Features** | L'Application distribue les namespaces à partir du manifest. | Un seul distributeur, donc aucune collision. |
| **D6 — View non adressable** | Une View n'a pas de nom, donc pas de Channel. | Elle n'est pas une source de vérité : on ne lui demande rien, elle écoute. |

### Une conséquence de D1 : le domaine survit à tout (T6)

Une View ne peut pas détruire une Feature, puisqu'elle ne possède pas son existence. L'hôte ne peut pas non plus : il ne fait qu'envoyer des faits, qui deviennent des messages. Et l'Application s'interdit de le faire (D1). Une Feature survit donc à toute navigation, à tout changement d'écran, à tout redimensionnement. **Seule la fermeture de la page met fin à l'application**, et à tout ce qu'elle contient.

## 10. Les rôles : ce que tu écris vraiment

Tout ce qui précède était abstrait. Les rôles sont les classes que tu manipules au quotidien. Ce ne sont pas des notions de base : chacun est une **combinaison** de termes, d'axiomes et de décisions. C'est pour cela qu'on peut justifier chacune de leurs règles.

### Application

La racine. Elle possède l'espace des noms et les distribue aux Features à partir du manifest (D5). Elle est le parent des Features et de la Foundation (D1). Sa fin vient de l'hôte : la fermeture de la page.

### Feature

Un composant du domaine. Elle possède un nom attribué par l'Application, le Channel désigné par ce nom, et une Entity. Elle traite les messages adressés à son Channel et émet ses propres Events.

*Ce qui en découle :* elle n'émet que sur son propre Channel (A3, T2) ; elle survit à toute l'interface (T6) ; elle ne modifie jamais son état dans un `.then()`, mais s'adresse un message (§6).

### Entity

L'état métier d'une Feature, avec les opérations qui le modifient. **Une Entity n'est pas un composant** : elle n'a ni nom, ni Channel, ni existence propre. C'est une ressource de sa Feature. Quand l'Entity exécute `mutate()`, c'est en réalité la Feature qui agit. Ses invariants métier sont écrits par toi et respectés à chaque fin de traitement (A4).

### Foundation

Un composant de l'interface, enfant de l'Application. Elle prend en charge le corps de la page (D3) et en attribue des parts à ses enfants.

### Composer

Un composant de l'interface qui **décide quelle View afficher** dans une zone de la page. Il possède une part de la page, son *slot*, attribuée par son parent (la Foundation, ou une View qui déclare un emplacement). Il est le parent de la View qu'il affiche. Comme la View, il n'a ni nom ni Channel : on ne lui adresse rien, il écoute.

Son travail tient en une fonction : `resolve(event)`. À chaque Event du domaine qu'il reçoit, il répond à une seule question : « quelle View doit occuper mon slot maintenant ? », avec une View ou aucune.

*Ce qui découle des axiomes :*

- **Seul lui crée et détruit ses Views.** Il est propriétaire de leur existence, donc le seul à pouvoir les détruire (A1). Une View ne compose jamais directement une autre View : elle déclare un slot, et c'est un Composer qui le remplit.
- **Il découpe sa part pour sa View.** Le sélecteur qu'il donne à la View désigne une part de son slot (A2). Les parts ne se recouvrant pas, la View ne touche jamais aux slots de ses propres Composers enfants.
- **Il évite de recréer inutilement.** Si `resolve` désigne la même View au même endroit, il la garde. Détruire une View détruit toute sa descendance (T3) : on ne le fait que si c'est nécessaire.

*Ce qui relève de décisions de Bonsai :*

- **Il ne dessine rien.** Il possède son slot et pourrait le modifier (A1 le permet), mais Bonsai sépare les responsabilités : le Composer décide de la **structure**, la View fait le **rendu**. Un composant qui fait les deux devient vite impossible à remplacer.
- **Il n'a pas d'état propre.** Son choix ne dépend que de l'Event reçu. La vérité est dans le domaine (A4) : si le Composer gardait sa propre mémoire de « ce qui devrait être affiché », elle pourrait contredire le domaine. Sans état, il ne fait que **projeter** ce que dit le domaine, et le même Event donne toujours le même affichage.
- **Il n'a pas de hooks de cycle de vie.** Son seul point d'entrée est `resolve`, ce qui rend son comportement entièrement prévisible.

La théorie de référence n'a pas encore formalisé la dérivation du Composer : ce qui précède en est la lecture actuelle.

### View

Un composant de l'interface. Elle possède une part de la page, attribuée par son parent. Elle n'a pas de nom ni de Channel (D6).

*Ce qui en découle :*

- elle **adresse** des Commands et des Requests aux Features, et **reçoit** leurs Events, mais n'émet jamais rien ;
- elle reçoit à sa création un **sélecteur** désignant sa part, pas un élément DOM : un sélecteur est une simple information, alors qu'un élément serait une référence, interdite (A3) ;
- elle obtient l'élément elle-même, en résolvant ce sélecteur auprès de l'hôte ;
- sa part ne recouvre aucune autre part (A2) : c'est pourquoi elle ne touche jamais au DOM de ses voisines ni des zones de ses enfants ;
- elle transforme les clics et saisies de l'utilisateur, faits de l'hôte, en messages (A5).

### Pour notre panier

- La Feature `cart` possède l'Entity du panier et le Channel `cart`.
- La View du panier adresse `cart:addItem` quand on clique sur « Ajouter », et reçoit `cart:itemAdded` pour mettre à jour l'affichage.
- Le Composer de la zone principale écoute la Feature de navigation. Quand l'utilisateur change de page, son \`resolve\` désigne une autre View : il détruit la View du panier et monte la nouvelle. Le panier, lui, reste intact (T6).

## 11. Les gardes : ce qui vérifie les règles

Une règle qui n'est vérifiée par rien finit toujours par être violée. Les **gardes** sont les mécanismes qui détectent ou empêchent une violation. Leur liste n'est pas encore complètement formalisée dans la théorie, mais le principe est fixé : chaque garde protège une règle précise, et on sait laquelle.

### Les quatre niveaux de garde, du meilleur au moins bon

1. **Par construction.** La violation est impossible à écrire, parce que l'outil n'existe pas. Exemple : Radio n'est pas exporté par `@bonsai/core`, donc aucun composant ne peut ouvrir un Channel à la place de son propriétaire (A3).
2. **À la compilation.** TypeScript refuse le code. Exemple : une View déclare les Commands qu'elle peut adresser ; en adresser une autre est une erreur de type.
3. **Au démarrage.** L'application refuse de se lancer. Exemple : une référence à un namespace inexistant est détectée au bootstrap.
4. **À l'exécution.** Une erreur est levée au moment de la violation. Exemple : enregistrer un second traitement pour la même Command lève `DuplicateHandlerError` (A1, A3).

**Pourquoi cette hiérarchie ?** Plus une erreur est détectée tôt, moins elle coûte. Une violation impossible à écrire ne coûte rien ; une erreur en production coûte cher. C'est le principe de Bonsai : **garantir au plus tôt**. Chaque fois qu'une garde peut monter d'un niveau, elle doit le faire.

### Quelques gardes et la règle qu'elles protègent

| Garde | Niveau | Règle protégée |
| --- | --- | --- |
| Radio et Channel non exportés | construction | A3 : seul le propriétaire traite et émet |
| `emit` absent du type de la View | compilation | D6 : la View n'émet pas |
| Handlers manquants détectés par `implements` | compilation | A3 : tout message déclaré a son traitement |
| Namespaces vérifiés au bootstrap | démarrage | A2 : les noms viennent du manifest |
| `rootElement` différent de `body` | démarrage | A2 : une View ne possède qu'une part |
| `DuplicateHandlerError` | exécution | A1 : un seul propriétaire traite |

Quand tu tombes sur une de ces erreurs, ne cherche pas à la contourner : elle te signale que ton code viole une règle de la théorie, et la table te dit laquelle.

## 12. Aide-mémoire

### Les cinq axiomes en une phrase

| Axiome | En une phrase | Ce qu'il t'évite |
| --- | --- | --- |
| **A1 — Propriété unique** | Une chose, un propriétaire, seul à la modifier. | Les états modifiés de partout |
| **A2 — Origine** | On devient propriétaire en créant ou en recevant d'en haut, et pour toujours. | Les collisions de noms, les transferts flous |
| **A3 — Médiation** | On se parle uniquement par messages, via des Channels. | Les dépendances cachées entre composants |
| **A4 — Domaine** | Le métier est toujours cohérent, avec ou sans écran. | Un domaine cassé par l'interface |
| **A5 — Causalité** | Tout changement a un message, et tout message a une cause. | Les changements inexpliqués |

### Les trois réflexes

- **Je veux modifier quelque chose qui n'est pas à moi** → j'adresse une **Command** à son propriétaire.
- **Je veux savoir quelque chose qui n'est pas à moi** → j'adresse une **Request** à son propriétaire.
- **J'ai modifié quelque chose qui est à moi** → j'émets un **Event**.

### Les questions à se poser devant un doute

1. Qui est le propriétaire de cette donnée ?
2. Est-ce que je passe par un message, ou est-ce que je touche directement à quelque chose qui n'est pas à moi ?
3. Ce changement d'état est-il le traitement d'un message, ou arrive-t-il « tout seul », dans un callback ou après un `await` ?
4. Est-ce que mon invariant relie des données de deux Features différentes ?
5. Quand ce composant disparaît, est-ce que tout ce qu'il a ouvert disparaît avec lui ?

Si tu sais répondre à ces cinq questions, tu respectes la théorie, même dans un cas qu'aucun exemple n'a prévu.
