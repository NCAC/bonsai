# Adaptateur de base de données indexée

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment l’annexe C et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur de base de données indexée. |
| 2 | Catégorie | Base de données indexée. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Bases de données indexées de l'hôte (annexe A.5). |
| 5 | Granularité de la source | Une base. |
| 6 | Instances par racine | Plusieurs, une par nom de base. |
| 7 | Absence de recouvrement | Un nom de base par instance d'écriture ; noms disjoints entre toutes les racines coordonnées du même hôte, vérifiés au démarrage au niveau de l'hôte. Observation multiple possible si le contrat le prévoit sans ouverture modifiant le schéma (règles communes du catalogue). |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | La base déclarée et ses magasins ; état d'observation interne du dernier résultat, données chargées ou erreur, avec séquence pour les répétitions significatives (règles communes du catalogue). |
| 10 | Faits admis | Résultats capturés des opérations instrumentées, bilan d'engagement (échec et effets non tentés compris), succès ou échec de transaction ; intégration uniquement au traitement du message local. |
| 11 | Faits spontanés | Aucun. |
| 12 | Faits provoqués | Chaque résultat corrélé à une opération déterminée continue son déclencheur, Command ou initialisation autorisée (A5.c, G8). Le callback conserve ce contexte et vise la même occurrence de vie ; aucun dernier appel supposé ne remplace la corrélation. |
| 13 | Opérations exclusives | Modifier le schéma, écrire, supprimer ; ouvrir une connexion crée une ressource et peut entraîner une migration. Ouverture, migration, lecture et écriture physiques sont des effets post-validation ; initialiser la configuration ne prouve pas l'ouverture réussie. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : déclaré. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `<ns>:put`, `<ns>:delete`, `<ns>:load` ; `load` prépare une lecture après validation, suivie d'un résultat local, de l'intégration de l'observation et de `loaded`. Si une opération dépend du succès d'ouverture ou de migration, elle est préparée au traitement de ce résultat, pas simplement placée après. |
| 17 | Queries acceptées | Aucune dans ce contrat. Une éventuelle consultation future ne pourrait rendre que l'observation déjà intégrée, jamais ouvrir ou lire la base, même synchroniquement. |
| 18 | Events émis | `<ns>:loaded`, `<ns>:written`, `<ns>:failed` ; résultats corrélés inscrits dans l'état d'observation avant émission (A3.h). `written` exige la réussite observée de transaction, pas seulement celle d'une requête ; intention, engagement, échec et non-tentative restent distincts. L'atomicité d'une transaction hôte n'étend pas le rollback interne à tous les effets. |
| 19 | Points d'extension | Schéma et migrations déclarés ; sérialisation des valeurs détachées ; aucun contexte ni callback substitué. Une migration ne donne pas un accès libre au support pendant le traitement : son effet suit la validation (B.4). |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest et périmètre ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Après validation, retrait des observateurs, fermeture des connexions et tentative d'annulation. Validité de l'occurrence de vie contrôlée avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : disponibilité/publication, capture sans alias mutable, G7, engagement ordonné et ressource fermée au premier échec synchrone qui la vise, vérification de vie avant admission/délivrance, B.4 réservé. Démarrage : catégorie et déclaration valides, identités sans collision, noms de bases physiquement disjoints entre racines coordonnées. Exécution : périmètre et corrélation de chaque résultat, aucune référence hôte publique. |
| 27 | Tests positifs | Scénarios de conformité : `load` lit après validation ; son résultat local intègre une valeur détachée avant `loaded`. Une écriture dépendant de l'ouverture réussie est préparée au traitement de son résultat. Un résultat d'une occurrence close est abandonné. |
| 28 | Tests négatifs | À refuser ou signaler : `loaded` sans corrélation ; `written` au seul succès d'une requête avant validation de transaction ; lecture dans une Query ; opération dépendante lancée avant résultat ; effet du suffixe engagé malgré échec synchrone ; callback transféré à une nouvelle occurrence ou alias mutable transmis. |
| 29 | Décisions et objectifs associés | D7, A5.c, D8, O1. |
| 30 | Questions restantes | Migrations de schéma entre versions de l'application. |
