# Adaptateur du défilement

*Fiche du catalogue des adaptateurs de l'hôte navigateur (théorie, annexe B). Non normative : en cas d'écart, l'annexe B fait autorité.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du défilement. |
| 2 | Catégorie | Défilement. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Défilement de la fenêtre et sa restauration (annexe A.3). |
| 5 | Granularité de la source | Une seule source. |
| 6 | Instances par racine | Une. |
| 7 | Absence de recouvrement | Le défilement d'un conteneur situé dans une part relève de la View propriétaire (D10). |
| 8 | Partie du modèle | Interface utilisateur ; Commands et Queries adressées par des composants de l'interface utilisateur uniquement ; aucun composant du domaine ne lui adresse rien ni ne reçoit ses Events (A4.b). Il peut recevoir les Events du domaine pour tenir ses ressources en projection (A4.d). |
| 9 | Ressources admises | Position de défilement de la fenêtre ; mode de restauration de l'hôte. |
| 10 | Faits admis | Défilement de la fenêtre. |
| 11 | Faits spontanés | Défilement par l'utilisateur : origines (A5.c). |
| 12 | Faits provoqués | Défilement demandé par une Command ; le contexte causal est conservé jusqu'à l'admission (A5.c). |
| 13 | Opérations exclusives | Faire défiler la fenêtre ; fixer le mode de restauration. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `scroll`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `scroll:to`, `scroll:toTop`, `scroll:restore`. |
| 17 | Queries acceptées | `scroll:position`. |
| 18 | Events émis | `scroll:scrolled` (regroupé) ; il n'émet d'information que sur ce qu'il a admis (A3.h). |
| 19 | Points d'extension | Politique de regroupement ; seuils d'émission ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2). |
| 24 | Nettoyage | À la fin de la racine, retrait de tous ses observateurs de l'hôte ; aucun message relatif à son Channel n'est délivré ensuite (G3). |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Démarrage : catégorie connue du catalogue, déclaration unique, identité sans collision ; construction : opérations de B.4 non surchargeables, aucune référence de l'hôte dans les types publics ; exécution : aucun message après destruction (G3). |
| 27 | Tests positifs | « Retour en haut » : une View adresse `scroll:toTop` ; au retour arrière, l'adaptateur du défilement reçoit `history:navigated` et restaure la position, sans Command (D18). |
| 28 | Tests négatifs | Une Feature adresse `scroll:toTop` (A4.b) ; un Behavior écoute `window` (16.7) : chacun doit être refusé ou signalé. |
| 29 | Décisions et objectifs associés | D7, D10, A4.b, 18.14, O3. |
| 30 | Questions restantes | Coordination de la restauration avec l'adaptateur historique. |
