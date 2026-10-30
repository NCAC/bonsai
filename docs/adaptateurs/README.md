# Catalogue des adaptateurs de l'hôte navigateur — fiches

*Une fiche par catégorie de l'annexe B de la théorie, selon les 30 rubriques du catalogue V1. Les noms de messages sont indicatifs : la convention `namespace:nom` suit la spécification ; `<ns>` désigne le namespace déclaré d'une instance.*

| Fiche | Partie | Instances | Statut V1 |
| --- | --- | --- | --- |
| [Adaptateur du document](document.md) | interface utilisateur | une par hôte (B.2) : une seule des racines coexistantes l'active | disponible |
| [Adaptateur Viewport](viewport.md) | domaine | une | disponible |
| [Adaptateur du défilement](defilement.md) | interface utilisateur | une par hôte | disponible |
| [Adaptateur historique](historique.md) | interface utilisateur | une par hôte (B.2) | disponible |
| [Adaptateur du stockage local](stockage-local.md) | domaine | plusieurs, à périmètres disjoints | disponible |
| [Adaptateur du stockage de session](stockage-session.md) | domaine | plusieurs, à périmètres disjoints | disponible |
| [Adaptateur de base de données indexée](base-indexee.md) | domaine | plusieurs, une par nom de base | disponible |
| [Adaptateur du cache](cache.md) | domaine | plusieurs, une par nom de cache | disponible |
| [Adaptateur des cookies](cookies.md) | domaine | plusieurs, par nom de cookie | disponible |
| [Adaptateur du cycle de vie](cycle-de-vie.md) | domaine | une | disponible |
| [Adaptateur de connectivité](connectivite.md) | domaine | une | disponible |
| [Adaptateur de l'environnement](environnement.md) | domaine | une | disponible |
| [Adaptateur du presse-papiers](presse-papiers.md) | interface utilisateur | une par hôte | disponible (seule capacité soumise à autorisation en V1) |

## Règles communes de lecture des fiches

Ces règles développent la [théorie V0.9.3](../theorie.md) (A3.h, G7, G8, D9, D19 et annexe B). Les fiches restent non normatives ; leur mise à jour ne vaut ni modification de la théorie ni preuve d'implémentation. Elles s'appliquent aussi aux points d'extension, sans réécrire les 30 rubriques de chaque fiche.

### Ressources et état d'observation — A3.h conservé

Un Event informe sur une ressource dont l'adaptateur est propriétaire, jamais sur un fait simplement relayé. Chaque fait annoncé est d'abord inscrit, par le traitement de son message d'admission, dans un **état d'observation** appartenant à l'adaptateur : valeur observée, résultat, refus, erreur ou raccourci. Cet état interne est distinct de la ressource matérialisée par l'hôte ; observer une source non modifiable n'empêche pas d'être propriétaire de cet état.

Le dernier fait suffit ; une séquence est ajoutée lorsque des répétitions identiques ont un sens (deux raccourcis identiques, deux lectures ou deux refus, par exemple). A3.h n'exige aucun journal infini. L'Event porte sur cet état déjà mis à jour ; sa délivrance reste subordonnée à la validation interne du traitement. Une Query ne rafraîchit pas cet état : une actualisation nécessaire entre par un autre message d'admission.

La ressource admise n'est pas le support extérieur : son propriétaire prépare des effets sur ce support en vertu de cette ressource et dans son périmètre, sans devenir propriétaire du support (A1.b, §11.6, T8). Une part issue de cette ressource par attribution autorise son propriétaire dans sa seule portion, soustraite au parent. La référence structurelle vers le support reste confinée à ce périmètre ; elle ne lui donne pas de propriété supplémentaire. Cette autorité appartient au composant même si le mécanisme d'application est fourni par Bonsai ; les conflits physiques entre racines relèvent de B.2.

### Queries : mode connu, lecture seule transitive

Le contrat déclare avant délivrance si le message est une Query avec réponse ou une Command sans réponse ; cette distinction ne se déduit pas de ce que le traitement finit par retourner. Une Query rend une information connue, issue d'une ressource admise ou de l'état d'observation, sans déclencher de nouveau travail asynchrone.

La lecture seule s'applique à toute la chaîne des appels : aucune mutation, création de ressource ou de composant, opération sur l'hôte à effet, requête réseau, Command, Event ni message local. Cela interdit aussi les compteurs de consultation, la mise en cache paresseuse et le rafraîchissement d'observation dans une Query. Les lectures asynchrones du cache, de la base indexée ou du presse-papiers passent par une Command puis un nouveau fait et un Event, non par une Query.

Les Queries imbriquées sont permises vers des composants inactifs, sans réentrance dans un composant déjà actif, même indirectement. Une erreur de Query est propagée à l'appelant, sans réponse `null` de substitution ; une absence prévue par le contrat reste distincte d'une erreur. Les Queries et réponses déjà délivrées restent dans la trace si le traitement appelant échoue ensuite.

### Validation interne et effets hôte — G7

Le rollback ne couvre que les ressources internes du modèle : il annule leurs changements ainsi que les messages différés non encore délivrés du traitement échoué ; les effets hôte seulement préparés sont également abandonnés. Il n'efface ni les Queries déjà délivrées et leur trace, ni les effets déjà matérialisés par l'hôte.

Les effets hôte non atomiques sont préparés puis **différés après validation interne**, y compris lorsque l'adaptateur les exécute lui-même ; « les exécuter en dernier » dans un traitement encore susceptible d'être annulé ne suffit pas. Leur résultat, succès ou échec, est admis par un nouveau message, y compris pour un accès hôte synchrone. Un échec partiel est admis et décrit explicitement dans l'état d'observation puis, si le contrat le prévoit, dans un Event ; aucune atomicité globale ni annulation de l'hôte n'est promise. Les noms de messages des fiches sont indicatifs : le contrat doit prévoir la représentation des échecs pertinents.

La phase post-validation engage les effets dans leur ordre de préparation avant la prochaine délivrance différée, sans attendre leur achèvement asynchrone. Les notifications hôte synchrones sont admises puis mises en file, sans réentrance. Un échec d'application ne révoque pas la validation interne acquise. Le rollback interne inclut aussi les existences, abonnements, attributions et restitutions provisoires : il conserve la structure antérieure sans recréation ni transfert ; le nettoyage physique définitif est post-validation.

### Causalité, regroupement et minuteries — G8, D9

Le contexte causal hérité d'un fait provoqué est conservé et restitué par les mécanismes de l'infrastructure de communication (G8). Le code applicatif et les spécialisations ne le fabriquent, ne le remplacent et ne le fusionnent jamais. Une origine spontanée est également établie par ces mécanismes à l'admission. Un appel de projection peut provoquer un fait même sans Command intermédiaire : ce fait continue alors le message déclencheur.

En V1, une continuation a **un seul parent de déclenchement**, pas une provenance exhaustive des données consultées ; une origine n'a pas de parent. Une politique de regroupement peut sélectionner la dernière notification et abandonner les autres : l'émission se rattache à la notification retenue, sans prétendre représenter toutes leurs causes. Une agrégation exigeant plusieurs parents causaux est reportée hors V1. La politique et les abandons doivent être explicites.

D9 borne uniquement la profondeur des suites de continuations, non le nombre de branches, le nombre total de messages ou la terminaison. Les expirations d'une minuterie répétitive sont des continuations sœurs rattachées au même armement ; un réarmement provoqué par une expiration continue celle-ci. Une minuterie ou un rappel d'animation reste admis par le composant qui l'arme, sans nouvel adaptateur ; sa continuation et son contexte ne sont pas fabriqués pour contourner la borne. Un rappel de regroupement ne transforme pas les notifications sélectionnées en origine nouvelle.

### Projection et classification — B.5

La comparaison avec la ressource courante supprime les **écritures équivalentes**, pas toutes les boucles. L'égalité tient compte de la sémantique de l'opération et de l'état pertinent : ajouter une entrée d'historique à la même adresse peut être une nouvelle opération significative. B.5 n'est pas une preuve anti-boucle ; D9 n'est pas une preuve de terminaison non plus. Le mode de navigation reste une donnée du contrat, jamais une déduction du contexte causal.

Les supports de présentation et d'intention restent dans l'interface utilisateur (document, défilement, historique, presse-papiers). Les informations décrivant l'environnement restent dans le domaine (Viewport, cycle de vie, connectivité, environnement, stockages). Le fait qu'une préférence de couleur ou une langue soit perceptible ne reclassifie pas son observation : son application à une présentation relève de l'interface utilisateur. Les restrictions A4.b et A4.d restent inchangées.

### Autorité physique entre racines — B.2

L'unicité d'admission dans une racine ne suffit pas à protéger une ressource physique partagée. Document, historique, **défilement de la fenêtre et presse-papiers : une instance par hôte**, activée par une seule des racines coexistantes. Le défilement d'un conteneur dans une part reste du ressort de sa View.

Pour les stockages local et de session, bases indexées, caches et cookies, les **périmètres d'écriture sont disjoints entre toutes les racines coordonnées d'un même hôte**, pas seulement entre instances d'une racine : préfixes sans inclusion, noms de bases ou de caches distincts, périmètres de cookies sans recouvrement. Vider un stockage est limité au périmètre attribué. Plusieurs racines peuvent observer une même source si leur contrat le prévoit sans leur donner plusieurs autorités d'écriture ; chaque fait n'est admis qu'une fois dans chacune.

Ces contraintes doivent être vérifiées entre racines au démarrage par une coordination au niveau de l'hôte ; un Manifest isolé ne prouve pas leur respect. Elles ne garantissent rien contre des écritures d'autres onglets, scripts ou service workers non coordonnés. Ces modifications restent des faits extérieurs lorsqu'elles sont observables ; aucune notification native n'est supposée lorsque l'API n'en offre pas.

### Vérifications communes à décliner dans les tests de conformité

- Deux faits identiques significatifs mettent à jour la séquence avant leurs Events ; un Event sans état d'observation correspondant est non conforme.
- Une Query imbriquée vers un composant inactif réussit ; création, effet indirect, message différé ou réentrance sont refusés ; une erreur remonte sans `null` de secours.
- Après une erreur interne, état restauré et messages différés annulés, mais Queries déjà délivrées toujours tracées ; aucun effet hôte préparé n'est exécuté avant validation.
- Un effet hôte partiellement exécuté puis échoué produit un nouveau message de résultat, sans prétendre annuler les effets physiques.
- Un regroupement « dernière notification » conserve son seul parent et abandonne les autres ; une agrégation multi-parent n'est pas offerte en V1.
- Deux racines ne peuvent activer chacune le défilement ou le presse-papiers, ni déclarer des écritures recouvrantes sur un même stockage ; l'observation seule reste possible selon contrat.
- Une projection équivalente évite l'écriture ; un ajout d'historique intentionnel à la même adresse n'est pas supprimé par une simple égalité d'URL. Les expirations sœurs ne démontrent pas la terminaison.
