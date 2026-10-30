# Adaptateur du cycle de vie

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment §2.7 et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur du cycle de vie. |
| 2 | Catégorie | Cycle de vie. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Visibilité de l'onglet, focus de la fenêtre, gel et reprise, retour depuis le cache, fermeture imminente (annexe A.6). |
| 5 | Granularité de la source | Une source par signal. |
| 6 | Instances par racine | Une. |
| 7 | Absence de recouvrement | —. |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Intention de garde de sortie distincte de son engagement et de son résultat ; visibilité, focus de fenêtre et dernier signal intégrés par initialisation ou admission, séquence si nécessaire. Indisponibilité explicite ; aucun focus d'élément hors View assimilé au focus de fenêtre. |
| 10 | Faits admis | Occurrences de visibilité, focus/perte de focus de fenêtre, gel, reprise, retour depuis le cache, fermeture imminente ; résultats capturés de garde et rafraîchissement avec échecs/non-tentatives. Leur admission/délivrance exige une occurrence de vie encore valide. |
| 11 | Faits spontanés | Seulement si le protocole établit l'indépendance. Notifications générales de focus et cycle de vie non corrélables : origine d'observation à antécédent inconnu, pas preuve de spontanéité ni parent attribué au dernier effet. |
| 12 | Faits provoqués | Résultats instrumentés de garde ou rafraîchissement corrélés à une opération déterminée : continuation du déclencheur conservé par G8. Un callback de résultat et une notification générale de focus sont distincts ; ni voisinage ni `isTrusted` seul ne les corrèlent. |
| 13 | Opérations exclusives | Activer ou retirer la garde de sortie après validation interne ; mettre à jour son état d'observation en traitement d'un message d'admission, jamais d'une Query. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `lifecycle`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `lifecycle:guardExit`, `lifecycle:releaseExit`, `lifecycle:refresh` ; effets de garde ou lecture engagés après validation. Le résultat capturé est intégré par traitement local avant Event ; une action dépendante du succès est préparée seulement au traitement de ce résultat. |
| 17 | Queries acceptées | `lifecycle:visibility`, `lifecycle:hasFocus` : uniquement observation intégrée, aucune lecture fraîche de visibilité ou `hasFocus()` hôte. Cible prête et inactive ; initiales provisoires non publiées avant validation de l'unité. |
| 18 | Events émis | `lifecycle:hidden`, `lifecycle:visible`, `lifecycle:focused`, `lifecycle:blurred`, `lifecycle:frozen`, `lifecycle:resumed`, `lifecycle:restored`, `lifecycle:closing`, `lifecycle:guardResult`, `lifecycle:refreshed`, `lifecycle:failed` ; observation intégrée avant émission (A3.h). Garde : intention, engagement, réussite observée, échec/non-tentative distincts. Aucun Event final garanti si l'hôte termine la racine avant délivrance. |
| 19 | Points d'extension | Aucun au-delà de B.4 ; aucun écouteur global de Behavior. Clic/focus d'élément hors View sans admetteur autorisé explicitement : non pris en charge en V1 tant que 18.30 reste ouvert (P19) ; le focus de fenêtre ne résout pas ce cas. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique des observateurs/garde et tentative d'annulation après validation. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos, aucun résultat applicatif de nettoyage. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : disponibilité/publication, Query sur observation intégrée, capture sans alias mutable, G7, effets ordonnés et suffixe non tenté au premier échec synchrone, vie vérifiée avant admission/délivrance, B.4 réservé et classification §2.7.4. Catégorie/déclaration/identité valides, aucune référence hôte publique ; aucun traitement ne retarde la fin décidée par l'hôte ni ne résout implicitement 18.30. |
| 27 | Tests positifs | Scénarios de conformité : `notifications` suspend ses appels sur l'observation `hidden` intégrée ; un formulaire modifié conduit le domaine à demander la garde, dont l'effet suit la validation. Focus de fenêtre non corrélable qualifié inconnu ; `refresh` intègre le résultat avant `refreshed`. |
| 28 | Tests négatifs | À refuser ou signaler : Feature écoutant directement `visibilitychange`, Query lisant physiquement le focus, cible non prête/active, focus attribué au dernier effet ou déclaré spontané sans preuve, Behavior global pour focus hors View, promesse de message `closing` après fin de racine, alias mutable ou callback réassigné. |
| 29 | Décisions et objectifs associés | D7, A4.b, 18.14, 7.4. |
| 30 | Questions restantes | Garanties effectives de garde/notification de fermeture selon navigateur : une fermeture peut empêcher toute délivrance finale. La garde doit être engagée en amont ; le message différé `closing` ne garantit ni veto synchrone ni sauvegarde finale. Le cas du focus d'élément hors View reste ouvert en 18.30. |
