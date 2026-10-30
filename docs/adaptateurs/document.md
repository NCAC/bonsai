# Adaptateur du document

*Fiche du catalogue des adaptateurs de l'hôte navigateur (théorie, annexe B). Non normative : en cas d'écart, l'annexe B fait autorité.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du document. |
| 2 | Catégorie | Document. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Le document hors de son corps : en-tête (titre, `theme-color`, icône, métadonnées de référencement), attributs de l'élément racine (`lang`, `dir`, thème), plein écran, saisies de niveau document déclarées (annexe A.1). |
| 5 | Granularité de la source | Une source par élément d'en-tête ou attribut ; une source par raccourci déclaré. |
| 6 | Instances par racine | Une par hôte (B.2) : une seule des racines coexistantes l'active. |
| 7 | Absence de recouvrement | Le corps du document relève de la Foundation (D3) ; un fait survenant dans une part relève de la View, sauf raccourci déclaré (D10). |
| 8 | Partie du modèle | Interface utilisateur ; Commands et Queries adressées par des composants de l'interface utilisateur uniquement ; aucun composant du domaine ne lui adresse rien ni ne reçoit ses Events (A4.b). Il peut recevoir les Events du domaine pour tenir ses ressources en projection (A4.d). |
| 9 | Ressources admises et état d'observation | Titre, éléments d'en-tête qu'il gère, attributs de l'élément racine, état du plein écran ; état d'observation interne du dernier fait, notamment le raccourci et sa séquence pour distinguer les appuis répétés (règles communes du catalogue). |
| 10 | Faits admis | Entrée et sortie du plein écran ; appui sur un raccourci déclaré. |
| 11 | Faits spontanés | Appui sur un raccourci déclaré ; sortie du plein écran par l'utilisateur (touche Échap) : origines (A5.c). |
| 12 | Faits provoqués | Résultat d'une demande d'entrée ou de sortie du plein écran, refus compris : continuation du message déclencheur ; contexte conservé et restitué par l'infrastructure de communication (A5.c, G8). |
| 13 | Opérations exclusives | Modifier le titre, une métadonnée, un attribut de l'élément racine ; demander ou quitter le plein écran. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `document`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `document:setTitle`, `document:setMeta`, `document:setRootAttribute`, `document:enterFullscreen`, `document:exitFullscreen`. |
| 17 | Queries acceptées | `document:title`, `document:isFullscreen`. |
| 18 | Events émis | `document:fullscreenChanged`, `document:shortcut` (raccourci déclaré, avec son nom) ; chaque fait est inscrit dans son état d'observation avant émission, avec séquence pour les raccourcis répétés (A3.h). |
| 19 | Points d'extension | Projection : associer un Event reçu du domaine à une modification du titre ou d'une métadonnée (par exemple « (3) Mon panier » à partir de `cart:itemAdded`) ; normaliser le titre ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2). |
| 24 | Nettoyage | À la fin de la racine, retrait de tous ses observateurs de l'hôte ; aucun message relatif à son Channel n'est délivré ensuite (G3). |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Démarrage : catégorie connue du catalogue, déclaration unique, identité sans collision ; construction : opérations de B.4 non surchargeables, aucune référence de l'hôte dans les types publics ; exécution : aucun message après destruction (G3). Propres : démarrage : refus d'une View qui écoute un raccourci déclaré (D10) ; refus d'un second adaptateur du document dans l'hôte. |
| 27 | Tests positifs | Le titre suit `cart:itemAdded` par projection ; Ctrl+K déclaré produit un seul `document:shortcut`, origine d'une chaîne ; Échap en plein écran produit `document:fullscreenChanged`. |
| 28 | Tests négatifs | Une Feature adresse `document:setTitle` (A4.b) ; une View et l'adaptateur admettent le même raccourci (A5.d) ; une sous-classe lit le corps du document (D3) : chacun doit être refusé ou signalé. |
| 29 | Décisions et objectifs associés | D3, D7, D10, A4.b, A4.d, A5.d, O2, O3. |
| 30 | Questions restantes | Forme de déclaration des raccourcis (16.9) ; gestion des métadonnées rendues côté serveur à l'hydratation. |
