# Adaptateur des cookies

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment l’annexe C et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

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
| 9 | Ressources admises et état d'observation | Cookies déclarés ; valeur initiale intégrée, puis résultats de lecture, écriture ou suppression, avec séquence si nécessaire. Indisponibilité explicite distincte d'une absence connue ; une intention d'écriture ne modifie pas la valeur observée et aucune fraîcheur physique n'est certifiée. |
| 10 | Faits admis | Résultats capturés de lecture, écriture ou suppression après validation interne ; bilan d'engagement avec échecs et non-tentatives. Une absence d'erreur ne garantit pas l'écriture effective ; aucune notification native de changement n'est supposée. |
| 11 | Faits spontanés | Aucun. |
| 12 | Faits provoqués | Résultat instrumenté de lecture, écriture ou suppression corrélé à l'opération déterminée : continuation du déclencheur conservé par l'infrastructure de communication (A5.c, G8), pour la même occurrence de vie. Une lecture de contrôle constate une valeur mais ne prouve pas à elle seule l'auteur physique de cette valeur. |
| 13 | Opérations exclusives | Écrire, supprimer. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace distinct déclaré par instance, par exemple `consentCookies`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `<ns>:set`, `<ns>:remove`, `<ns>:refresh` : lecture physique après validation, résultat local, intégration de l'observation puis Event. Une vérification dépendant du succès confirmé d'une écriture est préparée au prochain traitement de son résultat, pas par simple position après elle. |
| 17 | Queries acceptées | `<ns>:get` rend uniquement la valeur intégrée par initialisation ou admission ; jamais de lecture fraîche de `document.cookie`. Cible prête et inactive ; valeur initiale provisoire non publiée avant validation de l'unité. |
| 18 | Events émis | `<ns>:changed` pour une modification effectivement observée, `<ns>:refreshed`, `<ns>:failed` ; résultat intégré avant émission (A3.h), sans garantie de succès non observable. Intention, engagement, observation de réussite, échec et non-tentative sont distingués ; un cookie absent ou inchangé n'est pas un succès inventé. |
| 19 | Points d'extension | Sérialisation ; attributs par défaut (durée, chemin, `SameSite`) ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest et périmètre ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique et tentative d'annulation après validation, sans supprimer les cookies. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : disponibilité/publication, Query sur observation intégrée, capture sans alias mutable, G7, effets ordonnés et suffixe non tenté au premier échec synchrone, contrôle de vie avant admission/délivrance, B.4 réservé. Démarrage : catégorie/déclaration/identité valides ; périmètres physiques disjoints entre racines coordonnées tenant compte du nom, domaine et chemin. Aucune référence hôte publique. |
| 27 | Tests positifs | Scénarios de conformité : consentement observé sous la cause de démarrage d'une nouvelle racine ; `get` ne relit pas le cookie après changement physique, puis `refresh` intègre le résultat capturé avant `refreshed`. Un rejet silencieux n'est pas annoncé comme écriture réussie. |
| 28 | Tests négatifs | À refuser ou signaler : View lisant `document.cookie` (D7), Query le relisant, cible non prête/active, succès déduit de l'absence d'exception, cookie hors périmètre, alias mutable ou callback tardif réassigné, suffixe tenté après échec synchrone d'engagement. |
| 29 | Décisions et objectifs associés | D7, 18.3. |
| 30 | Questions restantes | Cookies `HttpOnly` : invisibles, donc hors du modèle. |
