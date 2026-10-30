# Bonsai — Relecture de fond de la V0.9.4

*Relecture du 30 octobre 2026, sur la branche `feature/documentation-big-bang` au commit `be1659a`. Périmètre : `theorie.md` (V0.9.4), le guide, `gardes.md`, `tracabilite.md`, les fiches de `adaptateurs/`, les rapports datés et la spécification (`spec/`). La théorie fait autorité ; ce rapport n'est pas normatif. Il propose des amendements, dont aucun n'est appliqué tant qu'il n'est pas validé.*

*Identifiants propres à ce rapport : **R** défauts structurants, **L** incohérences locales, **S** spécification. Ils ne renvoient à aucune clause de la théorie.*

## 1. Verdict

**Le socle définitoire tient ; le socle normatif n'est pas encore gelable.**

Ce qui tient, et qu'il faut préserver :

- Aucun renvoi cassé. La chaîne du §17 compte 52 termes (8 primitifs, 44 définitions), dans l'ordre des titres, et chaque définition ne dépend que de termes antérieurs.
- Les 30 clauses d'axiomes ont un contre-exemple. D1 à D19 nomment justification, alternative écartée et objet protégé.
- L1 et T1 à T8 nomment leurs hypothèses. Le §14 qualifie honnêtement L1 (reformulation d'A3.i) et T2 (classification), au lieu de les présenter comme des découvertes.
- Les trois contradictions de la relecture V0.9.2 sont résolues : C1 par D7 et B.6 (moyens d'appel et minuteries admis par leur utilisateur), C2 par A5.a et la règle d'amorçage (§2.5), C3 par D12 (le contenu du slot est un état du Composer). La plupart des lacunes de l'audit V0.9.2 aussi : statut des exécutions hors traitement (V1), désignation d'une part (V3, 8.5), échec d'une Query (V5, G7).
- Les apports de fond de V0.9.3–V0.9.4 sont bons : admission en deux temps (capture sans mutation, puis message local) ; distinction désignation / référence ; séparation définition / commentaire / prescription normative ; A2.e, A3.i, A3.j ; G7 qui ne promet aucune transaction avec l'hôte ; abaissement honnête des statuts du registre.

Ce qui empêche le gel : trois défauts structurants (R1 à R3), un défaut de méthode du domaine (R4), une passe locale (L1 à L7) et l'état de la spécification (S1 à S3).

## 2. Défauts structurants

### R1 — Les axiomes reposent sur un vocabulaire qui n'est défini nulle part

Les §2.2 et §2.3 posent qu'un mot « entre dans le vocabulaire lorsqu'il reçoit un sens propre à Bonsai [ou] modifie la portée d'un axiome ». Or les axiomes, les garanties et deux démonstrations emploient une série de notions propres à Bonsai qui ne sont ni définies aux §3–§11, ni dans le métalangage :

| Notion | Occurrences dans la théorie | Emplois normatifs |
| --- | --- | --- |
| effet (préparé, engagé, appliqué) | 60 | A1.b, A3.g, A5.a, G7, G8, T8 |
| support (de l'hôte, extérieur) | 39 | A1.b, A2.e, A5.a, T8, 11.6 |
| message différé | 31 | A3.g, G5, G7, D8 |
| amorçage | 21 | §2.5, A5.b, G5, G7, G8, D14 |
| réservation | 10 | G3, D8, §2.7.6 |
| unité / frontière de validation | 10 | A4.a, G7, T3, T5 |
| occurrence de vie, vivant | 8 | A5.c, G3, G8 |
| pile active, prêt à consulter, publié | 9 | G5, §2.7.1 |

Conséquences :

1. A1.b, A3.g, A4.a, A5.a, A5.c, G5, G7 et T8 dépendent de notions dont le sens n'est fixé que par une prose opérationnelle (§2.5, §2.7). T3 (étape 2) et T5 (étapes 1 à 3) s'appuient sur « frontière de validation ».
2. **Doublon lexical** (§2.4) : « support de l'hôte » et « ressource de l'hôte » (3.2) désignent la même chose, ce que l'hôte matérialise. La théorie emploie l'un ou l'autre selon les sections.
3. La vérification du §17 (« 127 dépendances, aucune circularité ») porte sur les 44 définitions ; elle ne dit rien de ces notions, qui échappent au graphe.

**Proposition.** Faire entrer dans la chaîne du §17 les seules notions dont un axiome a besoin, chacune avec une définition d'une phrase :

- *effet* : changement d'une ressource de l'hôte ou d'un système extérieur demandé par un composant ;
- *message différé* : message dont la délivrance attend la fin de l'exécution qui le produit (Command, Event, message local) ;
- *unité de validation* : exécution à l'issue de laquelle les invariants d'état sont vérifiés (traitement modifiant, amorçage) ;
- unifier « support » sur « ressource de l'hôte », déjà défini en 3.2.

Les autres notions (réservation, occurrence de vie, pile active, phases d'un composant, engagement) sont des notions de protocole : elles vont en annexe C (R2), et aucun axiome ne doit plus les nommer.

**Statut : validé et appliqué le 30 octobre 2026 (théorie V0.9.5).** Définitions 9.12 Message différé, 9.13 Unité de validation et 11.8 Effet ; chaîne de 55 termes ; « support » et « amorçage » unifiés ; « traitement modifiant » et « frontière de validation » remplacés par l'unité de validation. A5.c et G5 ne nomment plus « composant vivant » ni « pile active ». Le sens « support de présentation » de 11.1, distinct, est conservé.

### R2 — Un protocole d'exécution s'est installé dans le noyau

La théorie est passée d'environ 14 500 à près de 23 000 mots entre V0.9.2 et V0.9.4. L'essentiel de l'ajout est opérationnel : §2.7 (six contrats), quatre des six règles de lecture du §2.5, les précisions de D8, D9, D14, D16 et D19.

Trois problèmes de construction, indépendants du volume :

1. **Ordre de lecture.** Le §2.7 est normatif et précède le §3, alors qu'il emploie Channel, Query, abonnement, admission, G3, G7, D9 et D18. Il est lu avant tout ce qu'il présuppose.
2. **Hiérarchie inversée.** Le §2.7.3 crée « une exception aux restrictions générales de D3, D7, D12 et §16.4 ». Une règle de lecture modifie ainsi des décisions, alors que chaque décision devrait porter elle-même sa portée. D12 l'a intégrée ; D3 et 16.4 ne le disent pas.
3. **Spécificités d'hôte et d'implémentation dans un texte qui s'en interdit.** 3.2 déclare que le terme « hôte » ne présuppose « ni navigateur, ni document ». Pourtant le §2.7.4 et A5 nomment `isTrusted`, et le §2.7.5 l'annotation TypeScript `readonly`. Le §2.2 interdit aux définitions de prescrire un mécanisme ; le §2.7 prescrit des phases de composant et un ordre d'engagement des effets.

**Proposition.** Créer une **annexe C normative, « Protocole d'exécution »**, qui reçoit :

- le §2.7 entier ;
- les règles de lecture « effets extérieurs », « phase post-validation » et « structure transactionnelle » ;
- les précisions opérationnelles de D8, D9, D14, D16 et D19.

Le noyau garde les définitions, les axiomes, la règle « autorité et validation », la règle « amorçage et création » réduite à trois phrases, et des garanties G1 à G8 courtes renvoyant à l'annexe C. Les mentions de `isTrusted` et `readonly` vont dans les fiches d'adaptateurs et la spécification.

Rien n'est perdu ni affaibli : l'annexe C reste normative. Le noyau redevient lisible et indépendant de l'hôte, comme le demandent le §2.2 et la feuille de route.

**Statut : validé et appliqué le 30 octobre 2026 (théorie V0.9.5).** Annexe C (C.1 à C.8) et profil de corrélation du navigateur en B.7 ; exceptions des résultats propres écrites dans D3, D7 et 16.4. Écart à la proposition : les garanties G1 à G8 gardent leur contenu, dont chaque phrase est une obligation ; seuls leurs renvois et leur vocabulaire changent. Le guide reçoit une section « Aller plus loin » qui reprend le protocole.

### R3 — Aucun protocole n'établit l'indépendance d'une saisie de l'utilisateur

D18 n'autorise une Command de l'interface qu'en réaction à « un fait admis dont l'indépendance est établie ». Le §2.7.4 exige que le protocole de chaque source établisse cette indépendance, et exclut `isTrusted` comme preuve. Or **aucun document ne définit ce protocole pour un clic ou une saisie dans une part** : ni la théorie, ni les fiches, ni la spécification de la View. Les documents le constatent eux-mêmes :

- le guide doit poser, pour rendre conforme son propre exemple du panier : « Dans cet exemple, le protocole établit l'indépendance de l'occurrence utilisateur » ;
- `adaptateurs/historique.md`, rubrique 30 : « le scénario complet de navigation n'est pas garanti par `popstate`/`hashchange` seuls » ;
- `spec/4-couche-concrete/behavior.md` : le chargement au défilement n'est pas couvert ;
- `rapports/corrections-V0.9.4`, §7 point 3 : ces protocoles restent à valider.

Lu à la lettre, **aucune application ne peut adresser de Command depuis un clic**, et le bouton « retour » du navigateur ne peut pas atteindre le routeur. D18 est intenable tant que ce point n'est pas tranché. La proposition détaillée est au §6. **Statut : validée et appliquée le 30 octobre 2026.**

### R4 — Un adaptateur du domaine peut orchestrer une Feature

16.8 permet à tout adaptateur, pendant le traitement local d'un fait, d'adresser une Command « sous les conditions d'A4.b et D18 ». D18 ne concerne que l'interface utilisateur. Un adaptateur du domaine (connectivité, cycle de vie, Viewport) peut donc commander une Feature, y compris sur une notification d'antécédent inconnu :

- c'est l'orchestration que D17 écarte entre Features (« les Features se coordonnent par les Events »), réintroduite par un composant qui n'est pas une Feature ;
- c'est une asymétrie : une observation d'antécédent inconnu n'accorde aucune Command à l'interface (D18), mais en accorde une au domaine.

**Proposition.** Étendre D17 aux adaptateurs du domaine : un adaptateur du domaine n'adresse aucune Command à une Feature ; il inscrit le fait dans son état d'observation et l'émet, et les Features qui en ont besoin y sont abonnées. Les fiches de connectivité, du cycle de vie et du Viewport ne listent aujourd'hui aucune Command sortante vers une Feature : la restriction ne retire rien au catalogue.

**Statut : validé et appliqué le 30 octobre 2026 (théorie V0.9.5).** D17 étendu aux adaptateurs du domaine, 16.8 et B.4 restreints, question tranchée 18.34 ; garde par construction dans `gardes.md`, guide, traçabilité et README des adaptateurs alignés.

## 3. Incohérences locales

| # | Constat | Où | Proposition |
| --- | --- | --- | --- |
| L1 | « Dans ce résultat, « lie » signifie… » : l'énoncé reformulé de T5 n'emploie plus le mot « lie ». | T5 | Supprimer la phrase, ou définir « transition requise », que l'énoncé emploie. |
| L2 | Le « champ des axiomes » (§12) pose des obligations non numérotées : une seule racine par modèle non abandonné, structure finie, une admission par racine. La dernière double A5.d et B.2 ; « abandonné » n'est pas défini. | §12 | Numéroter A0.e (structure finie et enracinée), avec le contre-exemple structurel déjà écrit ; retirer la phrase redondante sur l'admission. |
| L3 | La seconde phrase d'A4.a (« leur satisfaction ne peut exiger une transaction atomique… ») contraint l'écriture des invariants métier, pas le modèle ; elle n'a pas de contre-exemple. | A4.a | En faire un commentaire ou une règle de lecture, ou lui donner un contre-exemple. |
| L4 | 11.7 énumère les admetteurs en omettant les minuteries et rappels d'animation, que B.6 attribue au composant qui les arme. | 11.7 | Ajouter « les minuteries et rappels d'animation, admis par le composant qui les arme (B.6) ». |
| L5 | 18.11 renvoie à `registre-V0.9.2.md`, que les lots 1 à 3 de la migration ont remplacé par les YAML. | 18.B | Porter « Portée par » vers `docs/invariants/` et le rapport de migration. |
| L6 | Le guide présente `DuplicateHandlerError` comme garde d'exécution d'A3.e. Sous D16, les traitements sont dérivés du contrat, un par message : le doublon est impossible par construction. | guide §11 | Remplacer l'exemple, par exemple par une Query vers une cible active (G5). |
| L7 | Le guide affirme que TypeScript « peut même vérifier » à la compilation que la propriété ne change jamais. Rien dans `gardes.md` ne porte cette garde. | guide §4 | Retirer la phrase, ou la rattacher à une garde de `gardes.md`. |

**Statut : L1 à L7 validés et appliqués le 30 octobre 2026 (théorie V0.9.5).** A0.e porte la structure finie et enracinée (31 clauses d'axiomes) ; T3 et T6 y renvoient.

## 4. Guide

Le guide est **exact** au regard de la V0.9.4 : aucune contradiction relevée. Il a en revanche **perdu sa fonction**, qui est d'expliquer la théorie à un développeur junior. Les §5, §6 (G5, D9, G7), §8 et §10 recopient le protocole sous une forme à peine abrégée, par exemple les réservations, l'engagement « jusqu'au premier échec synchrone » ou les bilans d'engagement du Composer. Et l'exemple principal, le panier, n'est conforme que sous une hypothèse que la théorie ne fournit pas (R3).

**Proposition.** Une fois R2 appliqué, ramener le guide au noyau, et déplacer l'explication du protocole dans une section finale « Aller plus loin : le protocole d'exécution ». Une fois R3 tranché, retirer les conditionnels « dans cet exemple, le protocole établit l'indépendance ».

## 5. Spécification

| # | Constat | Proposition |
| --- | --- | --- |
| S1 | **18 fichiers de `spec/` n'ont pas été touchés depuis `89689ce`**, dont `2-architecture/communication.md` (449 lignes), `3-couche-abstraite/feature.md` (1 237), `entity.md` (1 209), `router.md`, `2-architecture/erreurs.md`, `5-rendu.md` (1 774), `reference/glossaire.md` et `reference/anti-patterns.md`. Ils décrivent `request`/`reply`, une délivrance synchrone et le `null` de substitution : l'inverse de G5, G7 et D15. Un lecteur qui ouvre `communication.md` apprend le contraire de la théorie. | Placer dès maintenant un bandeau « non aligné sur la théorie V0.9.4 ; la théorie prévaut (README, règle de confiance) » en tête de chacun, en attendant les lots suivants. |
| S2 | Le lot 3 retire l'API cible : `behavior.md` déclare qu'« aucun `get behaviors()`, type `TBehaviorContract` ou `TBehaviorCallbacks` […] n'est fixé par ce document », et `composer.md` laisse les choix d'API « encore ouverts ». Or D16 fait du contrat déclaré la source des traitements : l'API cible *est* la réalisation de D16, et l'ergonomie (O3) se juge sur elle. | Rétablir dans chaque fiche de rôle une section « API cible ⏳ », marquée comme telle, alignée sur la théorie, distincte de la section « livré ». |
| S3 | Lexique (§2.4) : « Request » dans 16 fichiers, `request(` dans 13, « couche concrète » dans 8, et les dossiers `3-couche-abstraite`, `4-couche-concrete`. Le code livré s'appelle encore `request()`, ce qui est légitime dans une description du livré. | Réserver ces termes aux passages « livré » ; renommer les dossiers au moment de la migration de la spécification, pas avant. |

## 6. Proposition détaillée pour R3 — protocole du monde fermé

1. **Problème.** Aucune source d'intention (clic, saisie, retour arrière, défilement) n'a de protocole d'indépendance. D18 interdit donc toute Command de l'interface.
2. **Catégorie.** Amendement d'un contrat normatif (§2.7.4, ou annexe C après R2). Ni axiome ni décision nouvelle.
3. **Formulation actuelle.** « Fait indépendant établi : le protocole de source établit l'absence d'antécédent dans le périmètre observé » (§2.7.4) ; aucun protocole n'est fourni.
4. **Formulation proposée.** Ajouter au §2.7.4 :

   > **Protocole du monde fermé.** Une source déclarée établit l'indépendance de ses occurrences lorsque toute opération du modèle susceptible d'en produire une passe par une interface Bonsai instrumentée. Une occurrence de cette source qu'aucune opération instrumentée en cours de la même racine n'est susceptible d'avoir produite est un fait indépendant établi. Si une telle opération est en cours sans corrélation univoque, l'occurrence est d'antécédent inconnu. L'indépendance ainsi établie vaut dans le périmètre observé : les occurrences produites par une autre racine ou par un auteur non coordonné y sont indistinguables d'une action humaine, comme le prévoit déjà B.2.

5. **Dépendances.** 10.2 (origine : « sans antécédent établi dans le périmètre observé »), A5.c, G8 (« un appel brut perdant un lien connu n'est pas conforme »), B.2, D18.
6. **Justification.** La proposition n'invente rien. Elle applique la définition d'origine (10.2) : si toute opération du modèle capable de produire l'occurrence est instrumentée et qu'aucune n'est en cours, aucun traitement du périmètre observé ne l'a provoquée. La preuve repose sur l'instrumentation, que G8 impose déjà, et non sur un indicateur de l'hôte comme `isTrusted`.
7. **Contre-exemple.** Une View appelle directement `button.click()` ou `input.focus()`, puis sa réaction au clic adresse une Command. L'occurrence est classée indépendante à tort. C'est une violation de G8 (appel brut), à détecter par une garde.
8. **Impacts sur les démonstrations.** Aucun : L1 et T1 à T8 n'emploient pas le §2.7.4.
9. **Impacts sur les rôles.** View, Behavior et les adaptateurs du document, de l'historique et du défilement disposent d'un protocole. Le retour arrière sans `history.back()` instrumenté en cours devient indépendant, ce qui débloque `router:navigate { mode: pop }`. D18 est inchangé.
10. **Impacts sur les gardes.** Nouvelle garde statique : les API de l'hôte productrices d'occurrences (`click()`, `focus()`, `blur()`, `dispatchEvent()`, `history.back()`/`forward()`/`go()`, `scrollTo()`…) sont interdites hors des interfaces Bonsai instrumentées. Nouveaux tests discriminants : retour utilisateur seul → indépendant ; `history:back` instrumenté en cours suivi d'un `popstate` → corrélé ; deux retours qui se chevauchent sans corrélation univoque → antécédent inconnu.
11. **Impacts sur le guide et les fiches.** Le guide retire ses conditionnels. Rubriques 11 et 30 des fiches historique, défilement et document, rubrique 11 des autres. 18.26 renvoie au protocole.
12. **Statut.** Validé le 30 octobre 2026 et appliqué : théorie (§2.7.4, commentaire d'A5, B.5, 18.26, nouvelle question tranchée 18.32, note d'amendement en tête) ; fiches historique, document, connectivité, environnement et README des adaptateurs ; spécification View (§4.3) et Behavior ; `gardes.md` ; guide ; traçabilité. La formulation appliquée précise deux points par rapport à la proposition : chaque source **déclare** ses opérations productrices, et les notifications générales de défilement, de redimensionnement et de focus restent hors du protocole, parce qu'une écriture de présentation peut les produire.

## 7. Ordre de traitement proposé

1. **R3**, parce qu'il décide si D18 est praticable : sans lui, aucune application de référence n'est conforme.
2. **R1 et R2 ensemble** : définitions minimales dans la chaîne, puis annexe C. C'est la seule restructuration du texte ; la faire en une fois évite deux réécritures des renvois.
3. **R4**, puis la passe locale **L1 à L7**.
4. **S1** (bandeaux, peu coûteux et immédiatement protecteur), puis **S2** au fil des lots de migration.
5. **Prototype de `packages/event` (lot M1 de la migration) avant toute nouvelle extension de la théorie.** Le protocole exigé (rollback structurel, pile des Queries actives, réservations, engagement ordonné des effets) n'a encore été réalisé nulle part. Un prototype contre G5, G7 et G8 est le seul moyen de vérifier qu'il se réalise, et que l'écriture d'une Feature et d'une View reste conforme à O3.

## 8. Remarque de méthode

Les V0.9.3 et V0.9.4 répondent à deux revues notées, 6/10 puis 7/10, avec 10/10 pour cible. 48 points ont été intégrés en une journée. Le texte en porte la trace : chaque énoncé se double de ce qu'il ne garantit pas. On compte 10 « ne constitue », 8 « ne prouve », 5 « ne promet » dans la théorie, et plusieurs dizaines de phrases de plus de 40 mots. Ces précisions sont souvent justes, mais un énoncé normatif qui dit d'abord ce qu'il ne promet pas devient difficile à appliquer. Pour la suite, l'arbitrage point par point, sans note cible, protège mieux la lisibilité du socle.
