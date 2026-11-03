# Adaptateur de l'environnement

*V0.9.4 — 30 octobre 2026. Fiche non normative ; la [théorie](../theorie.md), notamment l’annexe C et A5, fait autorité. Les [contrats communs](README.md) s'appliquent aux 30 rubriques : disponibilité/publication, valeurs capturées sans alias mutable, effets post-validation, occurrences de vie et causalité observable. « Disponible » désigne le catalogue, non une implémentation vérifiée.*

| # | Rubrique | Contenu |
| --- | --- | --- |
| 1 | Nom canonique | Adaptateur de l'environnement. |
| 2 | Catégorie | Environnement. |
| 3 | Statut V1 | Disponible. |
| 4 | Source de l'hôte | Langues préférées, fuseau horaire, format régional (annexe A.8). |
| 5 | Granularité de la source | Une source par préférence. |
| 6 | Instances par racine | Une. |
| 7 | Absence de recouvrement | —. |
| 8 | Partie du modèle | Domaine ; Commands et Queries adressables par tout composant de la racine ; ses Events peuvent être reçus par le domaine comme par l'interface utilisateur (A4.b ne restreint que le domaine). |
| 9 | Ressources admises et état d'observation | Aucune ressource hôte modifiable ; langues, fuseau et format régional intégrés par initialisation ou traitement local d'admission. Valeurs indisponibles explicites ; observations connues sans garantie de fraîcheur physique. |
| 10 | Faits admis | Occurrences de changement des langues préférées ; résultats capturés de rafraîchissement des langues, fuseau et format, erreurs et non-tentatives compris. Aucune notification native de changement de fuseau/format n'est supposée. |
| 11 | Faits spontanés | Protocole du monde fermé (C.4) : aucune opération du modèle ne change les langues préférées, le fuseau ou le format régional. Une notification qui n'est pas le résultat corrélé de `environment:refresh` est un fait indépendant établi, dans le périmètre observé. |
| 12 | Faits provoqués | Résultat de rafraîchissement instrumenté corrélé à son opération : continuation du déclencheur conservé par G8, pour la même occurrence de vie. Une notification générale distincte n'est pas attribuée au dernier effet demandé. |
| 13 | Opérations exclusives | Aucune sur l'hôte ; mise à jour de son état d'observation en traitement du message d'admission, jamais d'une Query. |
| 14 | Identité | Attribuée par la racine (16.1) ; sa représentation est déclarée au Manifest (16.9). Namespace : `environment`. |
| 15 | Channel | Distingué par cette identité ; l'adaptateur est seul à y traiter et à y émettre (A3.e). |
| 16 | Commands acceptées | `environment:refresh` : lecture physique après validation, résultat capturé puis message local intégrant l'observation avant Event. |
| 17 | Queries acceptées | `environment:languages`, `environment:timeZone`, `environment:locale` : uniquement observations intégrées ou calcul interne, sans relire préférences ni configuration régionale de l'hôte. Cible prête et inactive ; initiales provisoires non publiées avant validation. |
| 18 | Events émis | `environment:languagesChanged`, `environment:refreshed`, `environment:failed` ; observation intégrée avant émission (A3.h), avec qualification causale conservée. Intention, engagement, réussite, échec et non-tentative du rafraîchissement restent distincts. |
| 19 | Points d'extension | Normaliser les identifiants de langue ; dans les limites de B.4. |
| 20 | Opérations réservées | Celles de B.4 : identité et Channel, connexion à la source, admission, contexte causal, transport, observateurs de l'hôte, contrôle du périmètre, destruction. |
| 21 | Références structurelles | Vers les ressources qu'il admet, résolues auprès de l'hôte à sa création (9.10) ; jamais transmises (A3.c, A3.d). |
| 22 | Paramètres de création | Configuration sérialisable déclarée au Manifest ; aucune référence (A3.d). |
| 23 | Cycle de vie | Créé au démarrage s'il est déclaré ; la racine ne le détruit pas, il prend fin avec elle (B.2) ; par A4.e, son Channel du domaine ne prend fin qu'avec la racine. |
| 24 | Nettoyage | Clôture logique de bas en haut, restitutions au propriétaire du contenant encore vivant ; structure provisoire annulable sous G7. Retrait physique et tentative d'annulation après validation. Contrôle de vie avant admission et délivrance ; callbacks tardifs abandonnés sans réassignation. Une capture pendant destruction provisoire attend l'issue ; fin de racine : contextes clos. |
| 25 | Autorisations | Aucune. |
| 26 | Gardes | Contrats communs : disponibilité/publication, Query sur observation intégrée, capture sans alias mutable, G7, ordre d'engagement et ressource fermée au premier échec synchrone qui la vise, vie vérifiée avant admission/délivrance, B.4 réservé et classification C.4. Démarrage : catégorie/déclaration/identité valides ; aucune référence hôte publique. |
| 27 | Tests positifs | Scénarios de conformité : la traduction consulte les langues intégrées ; changer le tableau reçu ne change pas la réponse capturée ni l'état interne. Un changement physique non admis attend `refresh`, puis résultat local et `refreshed` ; notification hors résultat de `refresh` qualifiée indépendante. |
| 28 | Tests négatifs | À refuser ou signaler : préférence hôte confondue avec la langue métier choisie, Query relisant les langues ou le fuseau, cible non prête/active, notification qualifiée spontanée sans preuve, alias mutable ou callback tardif réassigné. |
| 29 | Décisions et objectifs associés | D7. |
| 30 | Questions restantes | Préciser le profil navigateur de disponibilité des notifications ; en leur absence, le rafraîchissement explicite est requis, sans promettre une fraîcheur continue du fuseau ou du format régional. |
