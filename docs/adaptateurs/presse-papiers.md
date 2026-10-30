# Adaptateur du presse-papiers

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment §2.7 et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du presse-papiers. |
| 2 | Catégorie | Presse-papiers. |
| 3 | Statut V1 | Disponible (seule capacité soumise à autorisation en V1). |
| 4 | Source de l'hôte | Presse-papiers du système (annexe A.9). |
| 5 | Granularité de la source | Une seule source. |
| 6 | Instances par racine | Au plus une ; une seule instance dans l'hôte, activée par une seule des racines coexistantes. |
| 7 | Absence de recouvrement | Autorité physique unique sur le presse-papiers entre racines coordonnées ; aucune garantie contre les applications ou scripts non coordonnés (règles communes du catalogue). |
| 8 | Partie du modèle | Interface utilisateur ; Commands et Queries adressées par des composants de l'interface utilisateur uniquement ; aucun composant du domaine ne lui adresse rien ni ne reçoit ses Events (A4.b). Il peut recevoir les Events du domaine pour tenir ses ressources en projection (A4.d). |
| 9 | Ressources admises et état d'observation | Le contenu du presse-papiers dans les limites des autorisations de l'hôte ; état d'observation interne du dernier texte lu, résultat d'écriture ou refus, avec séquence pour les répétitions significatives (règles communes du catalogue). |
| 10 | Faits admis | Résultats corrélés d'écriture, lecture ou autorisation, refus et bilan d'engagement avec non-tentatives ; valeurs capturées intégrées au traitement du message local, pas dans le callback. |
| 11 | Faits spontanés | Aucun. |
| 12 | Faits provoqués | Tout résultat instrumenté, refus compris, est corrélé à une opération déterminée : continuation du déclencheur conservé par l'infrastructure de communication (A5.c, G8), visant la même occurrence de vie. Ce résultat ne permet pas une Command si son effet était déclenché par un Event UI (D18). |
| 13 | Opérations exclusives | Écrire un texte ; modifier son état d'observation pendant le traitement du résultat local. Lire n'est pas une opération exclusive mais reste une action physique post-validation via Command, jamais une Query fraîche, même si une API synchrone devenait disponible. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `clipboard`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `clipboard:writeText`, `clipboard:readText` : effets engagés après validation. `readText` produit un résultat local puis une observation et un Event. Si une lecture/écriture dépend d'une autorisation obtenue séparément, elle est préparée au prochain traitement de ce résultat, sans supposer la conservation de l'activation utilisateur. |
| 17 | Queries acceptées | Aucune ; une consultation future ne pourrait rendre que le texte déjà intégré, pas relire le presse-papiers. |
| 18 | Events émis | `clipboard:written`, `clipboard:read`, `clipboard:refused`, `clipboard:failed` ; résultat, texte capturé, refus, erreur ou non-tentative intégrés à l'observation avant émission, avec séquence si nécessaire (A3.h). Intention, engagement et réussite observée sont distincts ; aucun `written` au seul engagement de la demande. |
| 19 | Points d'extension | Aucun au-delà de B.4 ; aucun choix de contexte causal. Projection et état local autorisés, mais résultat corrélé d'effet déclenché par un Event UI ou observation inconnue ne donnent aucun droit de Command (D18). |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2). |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique et tentative d'annulation après validation, sans effacer le presse-papiers. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Permissions et activation utilisateur requises selon l'API et le navigateur, pour lecture comme écriture le cas échéant ; refus explicite. Ni le traitement différé ni la validation interne ne garantissent que l'activation sera encore valable à l'engagement. |
| 26 | Gardes | Contrats communs : disponibilité/publication, capture sans alias mutable, G7, ordre d'engagement et suffixe non tenté au premier échec synchrone, contrôle de vie avant admission/délivrance, B.4 réservé. Démarrage : catégorie/déclaration/identité valides, une seule instance dans l'hôte coordonné. Exécution : D18, aucune référence hôte publique ; refus inscrit avant Event, aucun succès anticipé. |
| 27 | Tests positifs | Scénarios de conformité : sur clic indépendant établi admis par la View, « Copier le lien » adresse `clipboard:writeText`, puis reçoit `clipboard:written` après résultat intégré. `readText` lit après validation et capture le texte ; refus d'autorisation explicite sans rollback de l'hôte. |
| 28 | Tests négatifs | À refuser ou signaler : Command d'une Feature (A4.b), double instance, Event sans observation, lecture physique en Query, Command UI après résultat d'effet déclenché par Event UI, alias mutable ou callback tardif réassigné. |
| 29 | Décisions et objectifs associés | D7, A4.b, A5.c. |
| 30 | Questions restantes | Validité de l'activation par l'utilisateur, la Command étant traitée après le traitement de la View (G5). |
