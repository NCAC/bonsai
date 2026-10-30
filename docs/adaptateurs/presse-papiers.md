# Adaptateur du presse-papiers

*Fiche du catalogue des adaptateurs de l'hôte navigateur (théorie, annexe B). Non normative : en cas d'écart, l'annexe B fait autorité.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du presse-papiers. |
| 2 | Catégorie | Presse-papiers. |
| 3 | Statut V1 | Disponible (seule capacité soumise à autorisation en V1). |
| 4 | Source de l'hôte | Presse-papiers du système (annexe A.9). |
| 5 | Granularité de la source | Une seule source. |
| 6 | Instances par racine | Une. |
| 7 | Absence de recouvrement | —. |
| 8 | Partie du modèle | Interface utilisateur ; Commands et Queries adressées par des composants de l'interface utilisateur uniquement ; aucun composant du domaine ne lui adresse rien ni ne reçoit ses Events (A4.b). Il peut recevoir les Events du domaine pour tenir ses ressources en projection (A4.d). |
| 9 | Ressources admises | Le contenu écrit par l'application. |
| 10 | Faits admis | Réponse à une écriture ou à une lecture, refus. |
| 11 | Faits spontanés | Aucun. |
| 12 | Faits provoqués | Toute réponse, refus compris : continuation ; le contexte causal est conservé jusqu'à l'admission (A5.c). |
| 13 | Opérations exclusives | Écrire un texte ; lire un texte, après autorisation. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `clipboard`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `clipboard:writeText`, `clipboard:readText`. |
| 17 | Queries acceptées | Aucune. |
| 18 | Events émis | `clipboard:written`, `clipboard:read`, `clipboard:refused` ; il n'émet d'information que sur ce qu'il a admis (A3.h). |
| 19 | Points d'extension | —aucun au-delà de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2). |
| 24 | Nettoyage | À la fin de la racine, retrait de tous ses observateurs de l'hôte ; aucun message relatif à son Channel n'est délivré ensuite (G3). |
| 25 | Autorisations | Autorisation de l'hôte pour la lecture ; refus représenté explicitement. |
| 26 | Gardes | Démarrage : catégorie connue du catalogue, déclaration unique, identité sans collision ; construction : opérations de B.4 non surchargeables, aucune référence de l'hôte dans les types publics ; exécution : aucun message après destruction (G3). Propres : exécution : refus représenté par un Event explicite. |
| 27 | Tests positifs | « Copier le lien » : une View adresse `clipboard:writeText`, puis reçoit `clipboard:written`. |
| 28 | Tests négatifs | Une Feature adresse `clipboard:writeText` (A4.b) : chacun doit être refusé ou signalé. |
| 29 | Décisions et objectifs associés | D7, A4.b, A5.c. |
| 30 | Questions restantes | Validité de l'activation par l'utilisateur, la Command étant traitée après le traitement de la View (G5). |
