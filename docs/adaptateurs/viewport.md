# Adaptateur Viewport

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment §2.7 et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur Viewport. |
| 2 | Catégorie | Viewport. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Dimensions et densité de pixels de la fenêtre, orientation de l'écran, requêtes média : points de rupture, préférences de couleur et de mouvement (annexe A.2). |
| 5 | Granularité de la source | Une source par caractéristique ; une par requête média déclarée. |
| 6 | Instances par racine | Une. |
| 7 | Absence de recouvrement | Le défilement de la fenêtre relève de l'adaptateur du défilement. |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Aucune ressource hôte modifiable ; observation des dimensions, densité, orientation et requêtes média intégrée par initialisation ou message local d'admission. Indisponibilité explicite ; connaissance intégrée distincte de la valeur physique actuelle. |
| 10 | Faits admis | Occurrences de redimensionnement, orientation ou correspondance média identifiées à la capture par source ; résultats de rafraîchissement instrumenté, erreurs et non-tentatives compris. La propagation d'une occurrence ne la duplique pas et les valeurs égales ne l'identifient pas. |
| 11 | Faits spontanés | Seulement si le protocole établit l'indépendance. `resize`, orientation et notifications média générales sans preuve sont des origines d'observation à antécédent inconnu, pas des faits spontanés démontrés. |
| 12 | Faits provoqués | Résultat d'une lecture instrumentée corrélée : continuation du déclencheur conservé par G8. Un `resize` voisin d'une demande de plein écran reste inconnu sans corrélation propre ; ni le résultat corrélé du plein écran, ni le dernier effet, ni `isTrusted` seul ne lui donnent un parent. |
| 13 | Opérations exclusives | Aucune sur l'hôte ; mise à jour de son état d'observation en traitement du message d'admission, jamais d'une Query. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `viewport`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `viewport:refresh` : prépare la lecture physique après validation ; résultat capturé, message local, intégration de l'observation puis Event. Ne modifie pas les dimensions de l'hôte. |
| 17 | Queries acceptées | `viewport:size`, `viewport:breakpoint`, `viewport:prefersDark`, `viewport:prefersReducedMotion` : uniquement observation intégrée ou calcul interne ; aucune lecture fraîche des dimensions ou médias. Cible prête et inactive ; initiales provisoires non publiées avant validation. |
| 18 | Events émis | `viewport:resized` (regroupé), `viewport:breakpointChanged`, `viewport:orientationChanged`, `viewport:preferenceChanged`, `viewport:refreshed`, `viewport:failed` ; observation intégrée avant émission (A3.h). Les notifications générales gardent leur qualification inconnue ; engagement, succès, échec et non-tentative d'un rafraîchissement restent distincts. |
| 19 | Points d'extension | Points de rupture et requêtes média déclarés ; D19 sélectionne une notification déjà contextualisée, notamment la dernière, et abandonne les autres sans fusion ni reconstruction causale. L'inconnu reste visible ; D9 borne les segments connus, pas les boucles traversant une coupure d'observation (B.4). |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique des observateurs et tentative d'annulation après validation. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : Query prête/inactive, capture sans alias mutable, G7, effets ordonnés et suffixe non tenté au premier échec synchrone, vie vérifiée avant admission/délivrance, B.4 réservé et classification §2.7.4. Démarrage : catégorie/déclaration/identité valides, points de rupture ordonnés sans recouvrement ; aucune référence hôte publique ni autre source. |
| 27 | Tests positifs | Scénarios de conformité : passage sous 768 px intégré avant un unique `viewport:breakpointChanged` ; `catalog` adapte sa pagination. `resize` non corrélable reste inconnu après sélection D19 ; `refresh` produit un résultat local corrélé puis `refreshed`. |
| 28 | Tests négatifs | À refuser ou signaler : lecture fraîche de `window.innerWidth` dans une Query, cible non prête/active, sous-classe écoutant le défilement, parent attribué au dernier plein écran, `isTrusted` utilisé seul, fusion multi-parent, alias mutable ou callback tardif réassigné ; D9 présenté comme bornant une boucle traversant l'inconnu. |
| 29 | Décisions et objectifs associés | D7, A5.d, 11.1, 18.14, O3. |
| 30 | Questions restantes | Valeur par défaut de la politique de regroupement. |
