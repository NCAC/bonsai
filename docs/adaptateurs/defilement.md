# Adaptateur du défilement

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment §2.7 et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du défilement. |
| 2 | Catégorie | Défilement. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Défilement de la fenêtre et sa restauration (annexe A.3). |
| 5 | Granularité de la source | Une seule source. |
| 6 | Instances par racine | Au plus une ; une seule instance dans l'hôte, activée par une seule des racines coexistantes. |
| 7 | Absence de recouvrement | Autorité d'écriture unique sur le défilement de la fenêtre entre racines coordonnées ; le défilement d'un conteneur situé dans une part relève de la View propriétaire (D10). |
| 8 | Partie du modèle | Interface utilisateur ; Commands et Queries adressées par des composants de l'interface utilisateur uniquement ; aucun composant du domaine ne lui adresse rien ni ne reçoit ses Events (A4.b). Il peut recevoir les Events du domaine pour tenir ses ressources en projection (A4.d). |
| 9 | Ressources admises et état d'observation | Position de fenêtre et mode de restauration admis ; observation intégrée par initialisation ou message local, dernière notification retenue et séquence si nécessaire. Position désirée distincte d'une position observée ; observation indisponible explicite et aucune fraîcheur physique garantie. |
| 10 | Faits admis | Occurrences de défilement de fenêtre identifiées à la capture, sans double admission par propagation ; résultats instrumentés de demande ou rafraîchissement, échecs et non-tentatives compris. Aucun défilement supprimé ou coalescé par l'hôte n'est reconstruit. |
| 11 | Faits spontanés | Seulement si un protocole établit l'indépendance. `scroll` général sans identifiant d'opération : origine d'observation à antécédent inconnu par défaut, pas preuve de défilement utilisateur spontané. |
| 12 | Faits provoqués | Résultat instrumenté corrélé à une demande déterminée : continuation du déclencheur conservé par G8. Le retour de l'appel ne prouve pas l'atteinte de la position ni la cause d'un `scroll` distinct ; dernier effet, proximité et `isTrusted` seul ne corrèlent rien. Un résultat d'effet déclenché par Event UI ne permet aucune Command (D18). |
| 13 | Opérations exclusives | Faire défiler la fenêtre ; fixer le mode de restauration. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `scroll`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `scroll:to`, `scroll:toTop`, `scroll:restore`, `scroll:refresh` : effets post-validation ; `refresh` lit physiquement puis résultat local, intégration et Event. B dépendant du succès de A est préparé seulement au traitement du résultat de A. |
| 17 | Queries acceptées | `scroll:position` rend la position intégrée par initialisation ou admission, jamais une lecture fraîche des coordonnées de fenêtre. Cible prête et inactive ; initiale provisoire non publiée avant validation de l'unité. |
| 18 | Events émis | `scroll:scrolled` (regroupé), `scroll:requestResult`, `scroll:refreshed`, `scroll:failed` ; résultat/notification intégré avant émission (A3.h). Une demande engagée n'est pas un défilement achevé ; intention, engagement, réussite observée, échec/non-tentative sont distincts. La qualification inconnue d'un `scroll` reste visible. |
| 19 | Points d'extension | Seuils et sélection D19 d'une notification déjà contextualisée, notamment la dernière, avec abandon explicite des autres ; ni fusion ni reconstruction de cause. D9 borne les segments connus, pas les boucles traversant l'inconnu. Projection/état local autorisés ; aucune Command depuis notification inconnue ou résultat d'effet déclenché par Event UI (D18, B.4). |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2). |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique des observateurs et tentative d'annulation après validation, sans promettre de restaurer la position. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : Query prête/inactive, capture sans alias mutable, G7, effets ordonnés et suffixe non tenté au premier échec synchrone, vie vérifiée avant admission/délivrance, B.4 réservé, classification §2.7.4 et D18. Catégorie/déclaration/identité valides, une seule instance dans l'hôte coordonné ; aucune référence hôte publique. |
| 27 | Tests positifs | Scénarios de conformité : clic indépendant établi admis par la View puis `scroll:toTop` ; résultat instrumenté corrélé et `scroll` général distinct, inconnu sans preuve. Une navigation validée du domaine portant une position déclenche sa projection sans Command UI ; le résultat n'en autorise aucune. D19 conserve l'inconnu de la notification sélectionnée. |
| 28 | Tests négatifs | À refuser ou signaler : Feature adressant `scroll:toTop`, Behavior écoutant `window`, double instance, Query lisant physiquement la position ou cible non prête/active, parent déduit du dernier défilement demandé, regroupement prétendant réparer la corrélation, Command depuis inconnu ou résultat d'effet déclenché par Event UI, alias mutable ou callback réassigné. |
| 29 | Décisions et objectifs associés | D7, D10, A4.b, 18.14, O3. |
| 30 | Questions restantes | Coordination avec l'historique et preuve de réussite d'un défilement différé/animé ; les notifications générales ne garantissent aucune corrélation. Sans preuve indépendante pour la navigation, son observation ne peut commander le domaine ; D9 ne couvre pas les boucles traversant ces coupures. |
