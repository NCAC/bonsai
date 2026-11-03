# Adaptateur du cache

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment l’annexe C et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du cache. |
| 2 | Catégorie | Cache. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Caches de requêtes de l'hôte (annexe A.5). |
| 5 | Granularité de la source | Un cache. |
| 6 | Instances par racine | Plusieurs, une par nom de cache. |
| 7 | Absence de recouvrement | Un nom de cache par instance d'écriture ; noms disjoints entre toutes les racines coordonnées du même hôte, vérifiés au démarrage au niveau de l'hôte. Observation multiple possible selon contrat, sans création ni écriture (règles communes du catalogue). |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Le cache déclaré ; état d'observation interne du dernier résultat, correspondance ou erreur, avec séquence pour les répétitions significatives (règles communes du catalogue). |
| 10 | Faits admis | Résultats capturés des opérations instrumentées et bilan d'engagement, échecs et non-tentatives compris ; intégration au traitement d'un message local. |
| 11 | Faits spontanés | Aucun. |
| 12 | Faits provoqués | Résultats corrélés à une opération déterminée : continuation du déclencheur conservé par l'infrastructure de communication (A5.c, G8), pour la même occurrence de vie. Aucune notification extérieure sans protocole n'est assimilée à ce résultat. |
| 13 | Opérations exclusives | Ajouter, supprimer une entrée. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : déclaré. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `<ns>:put`, `<ns>:delete`, `<ns>:match` ; `match` prépare l'effet de lecture après validation, puis résultat local, intégration de l'observation et Event. Une opération exigeant le succès de l'ouverture ou d'une écriture précédente est préparée au traitement de son résultat, pas dans la même liste par simple ordre. |
| 17 | Queries acceptées | Aucune ; une consultation future serait limitée aux observations intégrées, sans lecture fraîche du cache. |
| 18 | Events émis | `<ns>:matched`, `<ns>:failed` et résultats d'écriture/suppression prévus au contrat ; résultats inscrits dans son état d'observation avant émission (A3.h). Correspondance absente, observation indisponible, engagement, réussite, échec et non-tentative sont distincts. Aucun objet hôte `Response` ni corps mutable partagé n'est transmis. |
| 19 | Points d'extension | Politique d'expiration déclarée sur les valeurs intégrées ; une éviction physique reste un effet post-validation. Toute minuterie conserve son déclencheur et son occurrence de vie ; aucune nouvelle source ni reconstruction causale (B.4). |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest et périmètre ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique des observateurs et tentative d'annulation après validation, sans effacement implicite du cache. Validité de vie contrôlée avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : disponibilité/publication, capture sans alias mutable, effets après validation, ressource fermée au premier échec synchrone qui la vise, dépendances au traitement du résultat, contrôle de vie avant admission/délivrance et B.4 réservé. Démarrage : catégorie et déclaration valides, identités sans collision, noms de caches disjoints entre racines coordonnées. Aucune référence hôte publique ni écriture hors périmètre. |
| 27 | Tests positifs | Scénarios de conformité : `match` puis résultat local et `matched` corrélés ; une absence de correspondance est explicite. Un échec asynchrone ne révoque pas les engagements effectués ; un callback tardif est abandonné. |
| 28 | Tests négatifs | À refuser ou signaler : une Feature ouvre directement le cache (D7) ; Query lisant physiquement ; `Response` ou alias de corps mutable transmis ; effet suivant un échec synchrone encore tenté ; résultat réassigné à une nouvelle occurrence. |
| 29 | Décisions et objectifs associés | D7, A5.c. |
| 30 | Questions restantes | Protocole éventuel de partage avec un service worker ; les règles d'autorité entre racines coordonnées ne garantissent pas l'absence d'écritures d'un service worker ou d'un script non coordonné. |
