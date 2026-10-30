# Adaptateur de connectivité

*Fiche du catalogue des adaptateurs de l'hôte navigateur (théorie, annexe B). Non normative : en cas d'écart, l'annexe B fait autorité.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur de connectivité. |
| 2 | Catégorie | Connectivité. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | État de la connexion réseau (annexe A.7). |
| 5 | Granularité de la source | Une seule source. |
| 6 | Instances par racine | Une. |
| 7 | Absence de recouvrement | —. |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises | Aucune ressource modifiable. |
| 10 | Faits admis | Passage en ligne, hors ligne. |
| 11 | Faits spontanés | Tous : origines (A5.c). |
| 12 | Faits provoqués | Aucun. |
| 13 | Opérations exclusives | Aucune. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `connectivity`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | Aucune. |
| 17 | Queries acceptées | `connectivity:online`. |
| 18 | Events émis | `connectivity:online`, `connectivity:offline` ; il n'émet d'information que sur ce qu'il a admis (A3.h). |
| 19 | Points d'extension | —aucun au-delà de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | À la fin de la racine, retrait de tous ses observateurs de l'hôte ; aucun message relatif à son Channel n'est délivré ensuite (G3). |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Démarrage : catégorie connue du catalogue, déclaration unique, identité sans collision ; construction : opérations de B.4 non surchargeables, aucune référence de l'hôte dans les types publics ; exécution : aucun message après destruction (G3). |
| 27 | Tests positifs | Hors ligne : une Feature met ses envois en file. |
| 28 | Tests négatifs | Une Feature déduit la connectivité d'une erreur réseau et l'émet comme fait de l'hôte (un système extérieur n'est pas l'hôte) : chacun doit être refusé ou signalé. |
| 29 | Décisions et objectifs associés | D7, règle de méthode §16. |
| 30 | Questions restantes | Qualité de connexion : reportée. |
