# Adaptateur historique

*Fiche du catalogue des adaptateurs de l'hôte navigateur (théorie, annexe B). Non normative : en cas d'écart, l'annexe B fait autorité.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur historique. |
| 2 | Catégorie | Historique. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Adresse (chemin, paramètres, ancre) et historique de session (annexe A.4). |
| 5 | Granularité de la source | Une seule source. |
| 6 | Instances par racine | Une par hôte (B.2). |
| 7 | Absence de recouvrement | —. |
| 8 | Partie du modèle | Interface utilisateur ; Commands et Queries adressées par des composants de l'interface utilisateur uniquement ; aucun composant du domaine ne lui adresse rien ni ne reçoit ses Events (A4.b). Il peut recevoir les Events du domaine pour tenir ses ressources en projection (A4.d). |
| 9 | Ressources admises et état d'observation | Adresse affichée, entrée courante de l'historique de session ; état d'observation interne de la dernière navigation et de son mode, avec séquence pour les répétitions significatives (règles communes du catalogue). |
| 10 | Faits admis | Navigation arrière ou avant, modification de l'adresse par l'utilisateur ; résultat d'une opération d'historique exécutée après validation interne, même sans notification native. |
| 11 | Faits spontanés | Retour, avance ou saisie d'une adresse dans la même application non provoqués par le modèle : origines (A5.c). |
| 12 | Faits provoqués | Ajout, remplacement, retour ou avance demandés par une Command ou une projection : continuation du message déclencheur ; contexte conservé et restitué par l'infrastructure de communication jusqu'à l'admission (A5.c, G8). |
| 13 | Opérations exclusives | Ajouter ou remplacer une entrée ; revenir ou avancer. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `history`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `history:push`, `history:replace`, `history:back`, `history:forward` ; il adresse lui-même la Command déclarée `router:navigate` au domaine. |
| 17 | Queries acceptées | `history:location`. |
| 18 | Events émis | `history:navigated` (pour l'interface) ; porte sur la navigation inscrite dans son état d'observation avant émission (A3.h), non sur une intention d'écriture non confirmée. |
| 19 | Points d'extension | Projection d'un Event du domaine (`router:routeChanged`) en adresse, selon son mode (B.5) ; Command déclarée adressée au domaine à l'admission d'un retour ou d'une avance (`router:navigate`) ; sérialiser et analyser l'adresse ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2). |
| 24 | Nettoyage | À la fin de la racine, retrait de tous ses observateurs de l'hôte ; aucun message relatif à son Channel n'est délivré ensuite (G3). |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Démarrage : catégorie connue du catalogue, déclaration unique, identité sans collision ; construction : opérations de B.4 non surchargeables, aucune référence de l'hôte dans les types publics ; exécution : aucun message après destruction (G3). Propres : démarrage : refus d'un second adaptateur historique dans l'hôte. |
| 27 | Tests positifs | Retour utilisateur vers `/a` : le message d'admission a pour cause une origine ; l'adaptateur adresse `router:navigate { /a, pop }` en continuation ; la Feature émet `router:routeChanged { a, pop }` ; aucun nouvel effet si l'entrée courante est déjà équivalente (B.5). Retour vers `/admin` sans session : la Feature redirige, émet `router:routeChanged { login, pop }`, et l'adaptateur remplace l'entrée par `/login`. Un ajout intentionnel d'entrée à la même adresse conserve sa sémantique `push` et n'est pas supprimé par la seule égalité d'URL. |
| 28 | Tests négatifs | La Feature de navigation adresse `history:push` (A4.b) ; une View appelle `history.pushState` directement (D7) ; après une redirection, une entrée est ajoutée au lieu d'être remplacée (B.5) ; le mode est déduit du contexte causal (10.6) ; une simple égalité d'URL supprime une opération d'historique significative : chacun doit être refusé ou signalé. |
| 29 | Décisions et objectifs associés | D7, D15, A4.b, A4.d, B.5, 18.2, O3. |
| 30 | Questions restantes | Le contrat précise l'équivalence sémantique des opérations : mode (`push`, `replace`, `pop`), entrée et état pertinent, pas seulement URL. Un `push` intentionnel ajoute une entrée même à adresse identique ; `replace` et `pop` ne réécrivent pas une entrée déjà équivalente, et une redirection en mode `pop` remplace l'entrée courante. La suppression des écritures équivalentes ne prouve ni l'absence de boucle ni la terminaison (B.5, D9). |
