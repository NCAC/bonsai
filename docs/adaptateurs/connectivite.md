# Adaptateur de connectivité

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment l’annexe C et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

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
| 9 | Ressources admises et état d'observation | Aucune ressource hôte modifiable ; connectivité intégrée par initialisation ou traitement local d'admission avant émission. Indisponibilité explicite ; « en ligne » est une observation de l'hôte, pas une preuve d'accès à un système extérieur ni de fraîcheur physique. |
| 10 | Faits admis | Occurrences identifiées de passage en ligne/hors ligne et résultats capturés de rafraîchissement, erreurs et non-tentatives compris ; aucune mutation dans le préambule de capture. |
| 11 | Faits spontanés | Protocole du monde fermé (C.4) : aucune opération du modèle ne produit un passage en ligne ou hors ligne. Une notification qui n'est pas le résultat corrélé de `connectivity:refresh` est un fait indépendant établi, dans le périmètre observé. |
| 12 | Faits provoqués | Résultat d'une lecture instrumentée : corrélé à l'opération et continuation du déclencheur conservé par G8, pour la même occurrence de vie. Une notification générale distincte n'hérite pas automatiquement de ce contexte. |
| 13 | Opérations exclusives | Aucune sur l'hôte ; mise à jour de son état d'observation en traitement du message d'admission, jamais d'une Query. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `connectivity`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `connectivity:refresh` : lecture physique après validation, résultat capturé puis message local intégrant l'observation avant Event. |
| 17 | Queries acceptées | `connectivity:online` : uniquement observation intégrée, jamais lecture fraîche de `navigator.onLine`. Cible prête et inactive ; initiale provisoire non publiée avant validation de l'unité. |
| 18 | Events émis | `connectivity:online`, `connectivity:offline`, `connectivity:refreshed`, `connectivity:failed` ; portent sur l'observation déjà intégrée (A3.h), avec contexte sincère. Le rafraîchissement distingue intention, engagement, réussite, échec et non-tentative. |
| 19 | Points d'extension | Aucun au-delà de B.4 ; aucun choix de parent ni qualification spontanée sans preuve. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique et tentative d'annulation après validation. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : disponibilité/publication, Query sur observation intégrée, capture sans alias mutable, G7, ordre d'engagement et ressource fermée au premier échec synchrone qui la vise, vie vérifiée avant admission/délivrance, B.4 réservé et classification C.4. Démarrage : catégorie/déclaration/identité valides ; aucune référence hôte publique. |
| 27 | Tests positifs | Scénarios de conformité : observation hors ligne intégrée puis Event ; une Feature met ses envois en file. Query stable sans admission malgré changement physique ; `refresh` puis résultat local intègrent l'observation. Notification hors résultat de `refresh` qualifiée indépendante. |
| 28 | Tests négatifs | À refuser ou signaler : Feature assimilant une erreur réseau à la connectivité de l'hôte, Query relisant `navigator.onLine`, cible non prête/active, origine spontanée inférée de la seule absence de Command, alias mutable ou callback réassigné après clôture. |
| 29 | Décisions et objectifs associés | D7, règle de méthode §16. |
| 30 | Questions restantes | Qualité de connexion : reportée. |
