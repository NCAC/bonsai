# Adaptateur du stockage de session

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment §2.7 et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du stockage de session. |
| 2 | Catégorie | Stockage de session. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Stockage de session de l'hôte (annexe A.5), restreint au préfixe de clé déclaré. |
| 5 | Granularité de la source | Un préfixe de clé. |
| 6 | Instances par racine | Plusieurs, à périmètres disjoints. |
| 7 | Absence de recouvrement | Périmètres d'écriture disjoints entre instances et entre racines coordonnées du même hôte : aucun préfixe n'en prolonge un autre ; vérification au démarrage au niveau de l'hôte. Observation multiple possible selon contrat, sans autorité d'écriture supplémentaire (règles communes du catalogue). |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Les entrées du préfixe ; valeurs et clés intégrées initialement, puis résultats de lecture ou écriture, erreurs comprises, avec séquence si nécessaire. Observation indisponible explicite, distincte d'une absence connue ; aucune garantie de fraîcheur physique. |
| 10 | Faits admis | Résultats capturés de lecture, écriture, suppression ou vidage après validation, même si l'API est synchrone ; bilan d'engagement avec échecs et non-tentatives. Ce contrat n'active pas d'écoute de notifications extérieures de session. |
| 11 | Faits spontanés | Aucun. |
| 12 | Faits provoqués | Résultat instrumenté de lecture, écriture, suppression ou vidage : corrélé à une opération déterminée, continuant son déclencheur par l'infrastructure de communication (A5.c, G8) et visant la même occurrence de vie. |
| 13 | Opérations exclusives | Écrire, supprimer une entrée ; vider le périmètre. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : déclaré. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `<ns>:set`, `<ns>:remove`, `<ns>:clear`, `<ns>:refresh` (lecture du périmètre après validation). Résultat local capturé puis observation et Event ; B dépendant du succès de A est préparé seulement au traitement du résultat de A. |
| 17 | Queries acceptées | `<ns>:get`, `<ns>:keys` : valeurs/clés déjà intégrées par initialisation ou admission, aucune lecture `sessionStorage`. Cible prête et inactive ; initiales provisoires non publiées avant validation de l'unité. |
| 18 | Events émis | `<ns>:changed` après modification confirmée, `<ns>:refreshed`, `<ns>:failed` ; résultats intégrés à l'observation avant émission (A3.h), sans confondre intention, engagement, réussite, échec et non-tentative. Une lecture réussie n'est pas une modification confirmée. |
| 19 | Points d'extension | Sérialisation et validation des valeurs ; schéma des entrées ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest et périmètre ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique et tentative d'annulation après validation, sans vider le stockage. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : disponibilité/publication, Query sur observation intégrée, capture sans alias mutable, G7, effets ordonnés et suffixe non tenté au premier échec synchrone, contrôle de vie avant admission/délivrance et B.4 réservé. Démarrage : catégorie/déclaration/identité valides, préfixes disjoints entre racines coordonnées ; aucune référence hôte publique ni écriture hors périmètre. |
| 27 | Tests positifs | Scénarios de conformité : `prefs:set` puis résultat corrélé ; au rechargement, nouvelle observation initiale sous la cause de démarrage. `get` reste inchangé après changement physique sans admission ; `refresh` puis résultat local intègrent les nouvelles valeurs avant `refreshed`. |
| 28 | Tests négatifs | À refuser ou signaler : Feature lisant directement `sessionStorage`, Query relisant le support, cible non prête ou active, préfixes `cart` et `cart:lines` recouvrants entre racines, alias mutable, callback réassigné, effet du suffixe engagé malgré échec synchrone. |
| 29 | Décisions et objectifs associés | D7, A5.d, 18.3, 18.15, O3. |
| 30 | Questions restantes | Forme contractuelle des erreurs de quota et des échecs partiels de vidage ; ces résultats exigent un nouveau message et n'annulent pas les écritures hôte déjà effectuées (règles communes du catalogue). |
