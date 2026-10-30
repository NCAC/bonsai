# Adaptateur du stockage local

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment l’annexe C et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du stockage local. |
| 2 | Catégorie | Stockage local. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Stockage local de l'hôte (annexe A.5), restreint au préfixe de clé déclaré. |
| 5 | Granularité de la source | Un préfixe de clé. |
| 6 | Instances par racine | Plusieurs, à périmètres disjoints. |
| 7 | Absence de recouvrement | Périmètres d'écriture disjoints entre instances et entre racines coordonnées du même hôte : aucun préfixe n'en prolonge un autre ; vérification au démarrage au niveau de l'hôte. Observation multiple possible selon contrat, sans autorité d'écriture supplémentaire (règles communes du catalogue). |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Les entrées du préfixe de clé ; observation intégrée des valeurs et clés initiales, puis des résultats de lecture, modification ou écriture, erreurs comprises, avec séquence si nécessaire. Une valeur ou liste non observée est explicitement indisponible ; la connaissance intégrée ne certifie pas la fraîcheur physique. |
| 10 | Faits admis | Modification extérieure observable, capturée avec son périmètre et ses valeurs ; résultats de lecture, écriture, suppression ou vidage engagés après validation même si l'API est synchrone ; bilan d'engagement incluant les non-tentatives. |
| 11 | Faits spontanés | Seulement si le protocole établit l'indépendance dans le périmètre observé. Une notification `storage` d'un autre onglet/auteur ne la prouve pas à elle seule : sans corrélation ni preuve indépendante, origine d'observation à antécédent inconnu, sans parent inventé. Aucune autre racine coordonnée ne reçoit ainsi un droit d'écriture dans ce périmètre. |
| 12 | Faits provoqués | Résultat instrumenté de lecture, écriture, suppression ou vidage : corrélation à l'opération et continuation du déclencheur par l'infrastructure de communication (A5.c, G8), pour la même occurrence de vie. Une notification `storage` distincte n'est pas attribuée au dernier effet demandé. |
| 13 | Opérations exclusives | Écrire, supprimer une entrée ; vider le périmètre. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : déclaré (par exemple `prefs`). |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `<ns>:set`, `<ns>:remove`, `<ns>:clear`, `<ns>:refresh` (lecture du périmètre après validation). Le résultat capturé entre par message local, puis observation et Event ; pas de relecture à la délivrance. Si B dépend du succès de A, B est préparé au traitement du résultat de A. |
| 17 | Queries acceptées | `<ns>:get`, `<ns>:keys` : exclusivement valeurs/clés déjà intégrées par initialisation ou admission ; aucune lecture `localStorage`. Cible prête et inactive ; observations initiales provisoires non publiées avant validation. Absence connue et indisponibilité sont distinctes. |
| 18 | Events émis | `<ns>:changed` (modification confirmée), `<ns>:changedElsewhere` (observation extérieure avec sa qualification, inconnue par défaut sans preuve), `<ns>:refreshed`, `<ns>:failed` ; portent sur l'observation intégrée avant émission (A3.h). Intention, engagement, réussite, échec et non-tentative sont distincts ; un résultat de lecture ne devient pas une écriture réussie. |
| 19 | Points d'extension | Sérialisation et validation des valeurs ; schéma des entrées ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest et périmètre ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique des observateurs et tentative d'annulation après validation, sans vider le stockage. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : Query prête/inactive sur observation intégrée, capture sans alias mutable, G7, effets ordonnés et suffixe non tenté au premier échec synchrone, contrôle de vie avant admission/délivrance, B.4 réservé et classification C.4. Démarrage : catégorie/déclaration/identité valides, préfixes disjoints entre racines coordonnées ; aucune référence hôte publique ni écriture hors périmètre. |
| 27 | Tests positifs | Scénarios de conformité : `prefs:set` puis résultat corrélé ; nouvelle racine intégrant l'entrée sous sa cause de démarrage (18.3). Une modification physique sans admission ne change pas `get` ; `refresh` lit après validation puis `refreshed` suit l'intégration. `storage` sans preuve indépendante reste inconnu. |
| 28 | Tests négatifs | À refuser ou signaler : Feature lisant directement `localStorage` (D7), Query `get` ou `keys` relisant le support, cible non prête/active, préfixes `cart` et `cart:lines` recouvrants, notification extérieure déclarée spontanée sans preuve, alias mutable ou callback tardif réassigné ; vidage continuant son suffixe après échec synchrone d'engagement. |
| 29 | Décisions et objectifs associés | D7, A5.d, 18.3, 18.15, O3. |
| 30 | Questions restantes | Forme contractuelle des erreurs de quota et des échecs partiels de vidage ; ces résultats exigent un nouveau message et n'annulent pas les écritures hôte déjà effectuées (règles communes du catalogue). |
