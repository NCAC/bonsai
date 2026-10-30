# Adaptateur des cookies

*Fiche du catalogue des adaptateurs de l'hôte navigateur (théorie, annexe B). Non normative : en cas d'écart, l'annexe B fait autorité.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur des cookies. |
| 2 | Catégorie | Cookies. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Cookies accessibles au document (annexe A.5). |
| 5 | Granularité de la source | Un cookie. |
| 6 | Instances par racine | Plusieurs, par nom de cookie. |
| 7 | Absence de recouvrement | Périmètres d'écriture sans recouvrement entre instances et racines coordonnées du même hôte ; le nom seul ne suffit pas : domaine et chemin participent au périmètre. Vérification au démarrage au niveau de l'hôte ; observation multiple possible selon contrat (règles communes du catalogue). |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Les cookies déclarés ; état d'observation interne du dernier résultat d'écriture ou de suppression, avec séquence si nécessaire (règles communes du catalogue). |
| 10 | Faits admis | Résultat observable d'une écriture ou suppression différée après validation interne ; ne pas assimiler une absence d'erreur à une garantie d'écriture effective. |
| 11 | Faits spontanés | Aucun. |
| 12 | Faits provoqués | Résultat observable d'une écriture ou suppression : nouveau message continuant le message déclencheur, avec contexte hérité par l'infrastructure de communication (A5.c, G8). |
| 13 | Opérations exclusives | Écrire, supprimer. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `cookies`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `<ns>:set`, `<ns>:remove`. |
| 17 | Queries acceptées | `<ns>:get`. |
| 18 | Events émis | `<ns>:changed` ; porte sur le résultat observable inscrit dans son état d'observation avant émission (A3.h), sans garantie de succès non observable. |
| 19 | Points d'extension | Sérialisation ; attributs par défaut (durée, chemin, `SameSite`) ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest et périmètre ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | À la fin de la racine, retrait de tous ses observateurs de l'hôte ; aucun message relatif à son Channel n'est délivré ensuite (G3). |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Démarrage : catégorie connue du catalogue, déclaration unique, périmètres d'écriture disjoints dans l'hôte entre racines coordonnées, identité sans collision ; construction : opérations de B.4 non surchargeables, aucune référence de l'hôte dans les types publics ; exécution : aucun message après destruction (G3). Propres : périmètres de cookies sans recouvrement, en tenant compte des noms, domaines et chemins, pas des seuls noms. |
| 27 | Tests positifs | Un consentement est écrit puis relu à la racine suivante. |
| 28 | Tests négatifs | Une View lit `document.cookie` (D7) : chacun doit être refusé ou signalé. |
| 29 | Décisions et objectifs associés | D7, 18.3. |
| 30 | Questions restantes | Cookies `HttpOnly` : invisibles, donc hors du modèle. |
