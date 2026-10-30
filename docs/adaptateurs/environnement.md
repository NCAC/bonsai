# Adaptateur de l'environnement

*Fiche du catalogue des adaptateurs de l'hôte navigateur (théorie, annexe B). Non normative : en cas d'écart, l'annexe B fait autorité.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur de l'environnement. |
| 2 | Catégorie | Environnement. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Langues préférées, fuseau horaire, format régional (annexe A.8). |
| 5 | Granularité de la source | Une source par préférence. |
| 6 | Instances par racine | Une. |
| 7 | Absence de recouvrement | —. |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Aucune ressource de l'hôte modifiable ; état d'observation interne des langues, du fuseau et du format régional, propriété de l'adaptateur (règles communes du catalogue). |
| 10 | Faits admis | Changement des langues préférées. |
| 11 | Faits spontanés | Tous : origines (A5.c). |
| 12 | Faits provoqués | Aucun. |
| 13 | Opérations exclusives | Aucune sur l'hôte ; mise à jour de son état d'observation en traitement du message d'admission, jamais d'une Query. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `environment`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | Aucune. |
| 17 | Queries acceptées | `environment:languages`, `environment:timeZone`, `environment:locale`. |
| 18 | Events émis | `environment:languagesChanged` ; porte sur les langues inscrites dans son état d'observation avant émission (A3.h). |
| 19 | Points d'extension | Normaliser les identifiants de langue ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | À la fin de la racine, retrait de tous ses observateurs de l'hôte ; aucun message relatif à son Channel n'est délivré ensuite (G3). |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Démarrage : catégorie connue du catalogue, déclaration unique, identité sans collision ; construction : opérations de B.4 non surchargeables, aucune référence de l'hôte dans les types publics ; exécution : aucun message après destruction (G3). |
| 27 | Tests positifs | La Feature de traduction choisit la langue à partir de `environment:languages`. |
| 28 | Tests négatifs | Une préférence de l'utilisateur est confondue avec la langue choisie dans l'application (information métier d'une Feature) : chacun doit être refusé ou signalé. |
| 29 | Décisions et objectifs associés | D7. |
| 30 | Questions restantes | —. |
