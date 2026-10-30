# Bonsai — Revue académique et architecturale de la théorie V0.9.3

| Champ | Valeur |
| --- | --- |
| **Date** | 2026-10-30 — 30 octobre 2026 |
| **Document analysé** | [Théorie — Vocabulaire fondamental V0.9.3](../theorie.md) |
| **Étendue** | Document intégral : définitions, axiomes, garanties, conséquences, décisions, rôles, questions et annexes A/B |
| **Posture** | Revue académique et architecture logicielle ; analyse documentaire, sans audit du runtime |
| **Statut** | Rapport critique non normatif ; propositions soumises à arbitrage |
| **Référence historique consultée** | [Arbitrages V0.9.3](arbitrages-V0.9.3-2026-10-30.md) |

> **Rapport historique — suite donnée le 30 octobre 2026.** Les corrections sont intégrées à la théorie V0.9.4 et décrites dans le [suivi des vingt corrections](corrections-V0.9.4-2026-10-30.md). Les constats, citations et la note de 7/10 ci-dessous restent ceux de V0.9.3 ; ils ne sont pas réévalués rétroactivement. Les liens de lignes visent la version examinée et peuvent désormais être décalés dans le document amendé. Le suivi documentaire n’atteste pas la conformité du runtime.

## Synthèse

**La V0.9.3 constitue une théorie architecturale structurée, mais pas encore une spécification opérationnelle entièrement fermée.** Elle distingue correctement définitions, axiomes, garanties contractuelles, décisions et objectifs. Les limites concernant le rollback extérieur, la convergence, la terminaison et la rejouabilité sont désormais explicites : elles ne sont pas retenues ici comme des défauts.

Cette revue relève **20 problèmes : 5 de gravité forte, 13 de gravité moyenne et 2 de gravité faible**. Plusieurs sont liés et ne constituent pas autant de défauts indépendants. Les contradictions locales les plus nettes concernent la restitution dans une identité et la restriction du Composer à la seule attribution. Les principaux contrats incomplets concernent la disponibilité des cibles pendant l’amorçage, les résultats tardifs après destruction et la causalité des notifications coalescées par l’hôte.

**Aucune circularité définitoire directe n’est établie dans les 52 termes du §17.** Les difficultés identifiées portent davantage sur les hypothèses structurelles implicites et sur les protocoles d’exécution que sur un cercle lexical.

Le diagnostic n’est pas « les axiomes sont globalement contradictoires » : aucun argument de ce rapport ne démontre l’inexistence de tout modèle conforme. Il est : **certaines opérations annoncées comme possibles ne disposent pas encore d’une sémantique univoque compatible avec toutes les restrictions énoncées.**

## Méthode et grille de gravité

**Une absence de précision n’est pas automatiquement une contradiction.** Chaque constat distingue autant que possible :

- **contradiction locale** : deux prescriptions incompatibles pour un scénario donné ;
- **lacune de preuve** : une conclusion utilise une prémisse non explicitée ;
- **contrat incomplet** : plusieurs comportements restent compatibles avec le texte ;
- **risque de lecture** : la rédaction encourage une interprétation plus forte que la règle réelle.

Les citations en bloc sont reproduites textuellement ; les liens renvoient à leur emplacement dans la version examinée. Les scénarios sont des tests discriminants : lorsqu’ils ne sont pas des contre-modèles complets satisfaisant toutes les autres règles, cela est indiqué. L’emploi de « contre-exemple » dans la théorie est plus étroit ; la présente revue n’assimile pas un scénario incomplet à une preuve d’indépendance.

| Gravité | Critère |
| --- | --- |
| **Fort** | Menace un mécanisme central annoncé, une garantie de sûreté ou la réalisabilité d’un protocole. |
| **Moyen** | Affecte une démonstration, un cas limite ou l’interopérabilité de deux implémentations raisonnables. |
| **Faible** | Défaut principalement éditorial ou taxonomique, sans contre-exemple opérationnel établi. |

## Couverture des dix axes demandés

| Axe | Résultat et constats associés |
| --- | --- |
| **1. Cohérence logique interne** | Noyau structuré ; restrictions de restitution à reprendre : P03–P05. |
| **2. Contradictions potentielles** | Contradictions locales P03/P05 ; tension d’autorité P04 ; commentaire trop restrictif P15. |
| **3. Définitions circulaires** | Aucun cercle définitoire direct identifié ; distinction importante entre circularité et prémisse normative dans P02/P18. |
| **4. Axiomes implicites non formalisés** | Unicité de l’existence, enracinement, présence du propriétaire, exclusivité des modes et disponibilité des cibles : P01/P02/P06/P07. |
| **5. Contre-exemples possibles** | Scénarios discriminants dans P01–P17 ; les limites de leur portée sont précisées. |
| **6. Cas limites** | Amorçage, destruction, erreurs d’effets, coalescence, abonnements et observations extérieures : P07–P14/P19. |
| **7. Ambiguïtés terminologiques** | « Une existence », « fait », « validé », « accès » et « ne rétrécit pas » : P01/P07/P11/P20. |
| **8. Concepts redondants** | L1 et T2 assument une fonction de reformulation ; risque de confusion avec des résultats indépendants : P18. |
| **9. Théorèmes découlant déjà des axiomes** | Classement de T1–T8 et de L1 plus bas ; attention aux pseudo-déductions dans les motivations d’A4.e et A5.d : P16/P17. |
| **10. Risques d’interprétation par un développeur** | Confusion entre état prêt et Channel existant, entre accès et admission, entre valeur détachée et immuable, entre sélection et corrélation causales : P07/P10/P12/P13. |

## Constats détaillés

### P01 — L’unicité de l’existence d’un composant reste implicite

**Axes :** 1, 4, 5, 7. **Gravité : moyen. Nature : lacune de formalisation.**

**Citations exactes — [§7.1](../theorie.md#L216) et [A0.d](../theorie.md#L496) :**

> Ressource associée à un composant déterminé, dont la seule opération exclusive est la destruction, et dont la destruction entraîne celle de ce composant.

> À tout composant qui n'est pas une racine est associée une existence, qui n'est une part d'aucune ressource ; créer un composant consiste à créer son existence. L'existence d'une racine n'est admise par aucun composant.

**Problème.** « Une existence » peut se lire comme une quantification existentielle, tandis que les preuves utilisent une association fonctionnelle. A1.a assure un propriétaire unique *par ressource* ; cela ne suffit pas à assurer une existence unique *par composant*, donc un parent unique.

**Scénario discriminant.** Deux ressources d’existence sont associées au même composant, avec deux propriétaires différents. La propriété de chacune demeure unique, mais le composant a deux parents possibles. Ce n’est pas un contre-modèle opérationnel complet : l’expression « son existence » peut être interprétée comme interdisant précisément cette situation. C’est cette interprétation qui doit devenir explicite.

**Correction proposée.** Énoncer que chaque composant possède, au sens de l’association et non de la propriété, **exactement une existence**, que cette association est immuable et qu’une existence concerne exactement un composant. Employer « est associé à » pour éviter de confondre association et propriété. En déduire séparément l’unicité du parent d’un non-racine.

### P02 — L’enracinement et la validité temporelle de la propriété ne sont pas entièrement explicités

**Axes :** 1, 3, 4, 6, 9. **Gravité : moyen. Nature : hypothèses structurelles de preuve.**

**Citations exactes — [§12](../theorie.md#L486) et [preuve de T3](../theorie.md#L672) :**

> Lorsque plusieurs racines coexistent dans un même hôte, chacune forme avec ses descendants un modèle distinct, et les axiomes s'appliquent à chacun séparément.

> À la frontière de validation, toute ressource restante du modèle a un propriétaire encore présent dans le modèle (A1.a, A2.e, §2.5).

**Problème.** Deux hypothèses naturelles sont utilisées : tout composant du modèle est relié à sa racine par une chaîne finie de parents ; le propriétaire d’une ressource actuelle est un composant encore présent. La première apparaît surtout dans un énoncé conditionnel sur plusieurs racines ; la seconde ne découle d’A1.a que si la relation de propriété est explicitement interprétée sur les composants actuels.

**Test discriminant.** Une chaîne de parents sans premier ancêtre satisfait les contraintes locales de parenté, mais n’est pas constructible par un démarrage fini depuis une racine. De même, une relation historique vers un propriétaire détruit ne doit pas compter comme une propriété actuelle. Ces tests montrent les hypothèses nécessaires, non la conformité de telles configurations au sens voulu du texte.

**Correction proposée.** Fixer explicitement : un modèle a exactement une racine ; chaque autre composant lui est relié par une chaîne finie de parents ; la propriété actuelle relie exclusivement des composants et ressources actuellement présents. Citer ces règles dans T3/T6. Distinguer cette accessibilité de la finitude totale du modèle : une preuve de terminaison effective du nettoyage demanderait des hypothèses supplémentaires.

**Circularité.** T3 n’est pas nécessairement circulaire : A1.a et A2.c peuvent imposer la disparition des ressources si la présence actuelle du propriétaire est acquise. La règle de cascade doit alors être présentée comme une règle d’imputation de cette disparition, non comme une prémisse qui énoncerait déjà tout T3.

### P03 — Les opérations permises sur une identité excluent littéralement sa restitution

**Axes :** 1, 2, 5, 6. **Gravité : fort. Nature : contradiction locale.**

**Citations exactes — [§8.2](../theorie.md#L256), [§5.1](../theorie.md#L150) et [§6.5](../theorie.md#L202) :**

> Part d'un espace des identités, dont la seule opération exclusive est l'attribution de parts en son sein.

> Opération qui modifie ou détruit une ressource.

> Lorsque la part prend fin, la portion qu'elle occupait (6.6) est rendue à la ressource distribuable dont elle a été soustraite : c'est la limite « jusqu'à la fin de cette part » de la définition (A2.d, T3).

**Problème.** Rendre une portion au contenant le modifie. Cette restitution est donc une opération exclusive, mais n’est pas une attribution de nouvelle part. La définition de l’identité exclut ainsi une modification requise par la fin d’une identité subordonnée.

**Scénario.** Un composant P utilise son identité comme espace distribuable et attribue une identité subordonnée à son enfant C. C n’a aucun Channel : A4.e n’impose pas sa pérennité. P détruit C et survit. La portion de l’identité de C doit être rendue à l’identité de P, alors que celle-ci n’autorise que l’attribution. La règle de cascade sur les fins de ressources ne résout pas la modification d’une identité qui, elle, demeure vivante.

**Correction proposée.** Inclure explicitement la restitution structurelle parmi les modifications autorisées des identités. Autre formulation possible, à arbitrer : définir un régime de distribution comprenant attribution et restitution. Ne pas traiter la restitution comme une attribution nouvelle, qui désignerait à tort un nouveau propriétaire.

### P04 — L’autorité de restitution n’est pas définie pour une cascade profonde

**Axes :** 1, 2, 4, 6. **Gravité : fort. Nature : contrat structurel incomplet.**

**Citation exacte — [corollaire de T3](../theorie.md#L683) :**

> Une part dont C était propriétaire est détruite, non transférée ; la portion qu'elle occupait est rendue à la ressource distribuable dont elle avait été soustraite (6.5). Cette ressource a pour propriétaire le parent de C (A2.d), qui exécute la destruction : la restitution fait partie d'une opération de son propriétaire (A1.b).

**Problème.** La justification couvre la destruction directe par le parent. Elle ne décrit pas l’exécution des restitutions lorsque ce parent disparaît lui-même dans une cascade initiée par un ancêtre. La fin d’une ressource et la modification de son contenant sont deux opérations distinctes au regard d’A1.b.

**Scénario.** A détruit son enfant B ; B est parent de C et propriétaire d’un contenant dont C a reçu une part. La cascade détruit C. La portion doit être rendue au contenant de B. A n’a pas autorité pour le modifier ; B est en cours de destruction ; et le contenant lui-même peut disparaître dans la même unité. Le texte ne choisit pas entre restitution intermédiaire, suppression de cette restitution devenue inutile ou exécution structurelle particulière.

**Correction proposée.** Définir l’ordre logique de destruction et la règle des contenants survivants. Recommandation : ne restituer effectivement qu’aux contenants survivant à l’unité ; préciser l’imputation normative de ces restitutions. Si des restitutions intermédiaires sont conservées, nommer leur exécutant autorisé. Le rollback structurel doit respecter le même protocole.

### P05 — Deux formulations du Composer ne donnent pas les mêmes droits de modification

**Axes :** 1, 2, 6, 10. **Gravité : moyen. Nature : contradiction textuelle locale.**

**Citations exactes — [D12](../theorie.md#L788) et [§16.6](../theorie.md#L856) :**

> Un Composer ne modifie son contenu que pour créer ou retirer les éléments des parts qu'il attribue.

> il ne modifie son contenu que pour attribuer des parts, n'est propriétaire d'aucun état autre que le contenu de son slot et l'existence de ses Views, n'admet aucun fait de l'hôte et n'adresse aucune Command (D12).

**Problème.** D12 permet le retrait ; sa reformulation au §16.6 ne permet plus que l’attribution. Or retirer une View entraîne aussi restitution de sa portion, donc modification du contenu sans nouvelle attribution.

**Scénario.** Un Event rend une View inutile. Le Composer détruit son existence, récupère sa portion et prépare le retrait physique correspondant. Le rôle annonce cette possibilité, mais sa dernière restriction l’exclut littéralement.

**Correction proposée.** Donner une formulation canonique dans D12, puis y renvoyer sans la rétrécir : attribution et restitution des parts, création et retrait des éléments correspondants, sans modification de présentation étrangère à cette composition.

### P06 — L’exclusivité entre message adressé et message émis n’est pas formalisée

**Axes :** 1, 4, 5, 9. **Gravité : moyen. Nature : lacune dans la partition de T2.**

**Citations exactes — [A3.f](../theorie.md#L542) et [T2](../theorie.md#L655) :**

> Tout message est adressé à un Channel, émis sur un Channel, ou local.

> La partition est donc exhaustive sous A3.j et exclusive par le contrat déclaré, non par une inférence sur l’intention cachée ou l’effet constaté.

**Problème.** A3.j sépare bien les deux modes des messages adressés. Il ne dit pas expressément qu’une même occurrence de message ne peut être à la fois adressée et émise. L’alternative d’A3.f peut se lire comme une disjonction inclusive. Le cas local est mieux séparé par « sans Channel » dans sa définition.

**Scénario discriminant.** Un message annonce une ressource de P et demande une action sur une ressource de Q ; P l’émet sur son Channel et l’adresse à celui de Q. Choisir Q comme seul abonné évite de violer les restrictions de destinataires. L’objet et le mode adressé peuvent satisfaire A3.i/A3.j sans que le cumul de transports soit expressément interdit.

**Correction proposée.** Énoncer qu’une occurrence de message a exactement une catégorie de transport, fixée et immuable : adressée, émise ou locale. Distinguer occurrence et réutilisation d’une même valeur de charge utile. T2 pourra alors invoquer une véritable partition préalable.

### P07 — Une cible inactive n’est pas nécessairement initialisée ou validée

**Axes :** 1, 4, 5, 6, 7, 10. **Gravité : fort. Nature : inférence insuffisante et amorçage incomplet.**

**Citations exactes — [§2.5](../theorie.md#L70) et [commentaire de G5](../theorie.md#L613) :**

> La racine crée ses enfants déclarés et établit leurs Channels avant les consultations initiales.

> Les Queries initiales respectent G5 et ne peuvent viser une initialisation encore active.

> Elles lisent donc ses ressources internes validées, sans garantie d’immobilité du support extérieur ni d’instantané global entre plusieurs traitements.

**Problème.** G5 refuse une cible présente dans la pile active. Cela ne refuse pas une cible dont le Channel existe, mais dont l’initialisation n’a pas encore commencé. En outre, une initialisation terminée pendant l’amorçage reste susceptible d’être abandonnée avec celui-ci : « initialisé », « consultable » et « globalement validé » ne sont pas synonymes.

**Scénario.** Tous les Channels sont établis ; l’initialisation de la Feature A consulte B, encore inactive et non initialisée. Le refus de réentrance ne s’applique pas, mais aucune disponibilité sûre de B n’est établie. Imposer une initialisation implicite de B dans la Query introduirait un autre problème avec sa lecture seule.

**Correction proposée.** Formaliser les phases « déclaré », « en initialisation », « prêt à consulter », « publié » et « détruit », ou un équivalent minimal. Fixer la politique de Query avant disponibilité et l’ordre des dépendances initiales. Réserver la conclusion « ressources validées » au fonctionnement normal, ou qualifier explicitement les lectures provisoires d’amorçage.

### P08 — Les faits tardifs après destruction de l’admetteur n’ont pas de protocole

**Axes :** 1, 5, 6, 10. **Gravité : fort. Nature : contrat de durée de vie incomplet.**

**Citations exactes — [§2.5](../theorie.md#L74), [§11.6](../theorie.md#L466) et [A5, commentaire](../theorie.md#L588) :**

> Leur achèvement asynchrone n’est pas attendu ; leurs résultats et les notifications synchrones de l’hôte sont admis puis mis en file, jamais traités par réentrance.

> L’admission d’un fait est un préambule sans mutation applicative qui soumet un message local au composant admetteur.

> L'expiration d'une minuterie ou d'un rappel d'animation est un fait provoqué : elle est admise par le composant qui les a armés, et ne relève d'aucun adaptateur de l'hôte (D7).

**Problème.** Un composant peut disparaître avant le résultat d’un effet, d’une minuterie ou d’une notification déjà engagée. G8 conserve le contexte, mais ne crée pas un admetteur encore vivant. G3 ne suffit pas : un message local n’a pas de Channel.

**Scénario.** Une View arme une minuterie, puis son Composer la détruit avant que le callback soit exécuté. Le rappel survient malgré une tentative d’annulation. Le texte ne précise pas le sort du fait, ni celui d’un message local déjà en file lorsque la destruction survient. Le même problème existe à la fin de la racine.

**Correction proposée.** Définir une invalidation logique liée à la génération du composant ; aucun callback tardif ne le ressuscite. Préciser si le fait est écarté avant admission, seulement tracé, ou traité selon un mécanisme explicitement prévu. Distinguer annulation physique, abandon d’une délivrance et clôture de la conservation causale. Il ne faut pas transférer silencieusement l’admission à un autre composant.

### P09 — L’ordre des effets ne règle pas leur poursuite après échec

**Axes :** 5, 6, 10. **Gravité : moyen. Nature : protocole post-validation incomplet.**

**Citations exactes — [§2.5](../theorie.md#L74) :**

> Après validation interne, les effets préparés sont engagés dans leur ordre de préparation, avant la prochaine délivrance différée.

> Une erreur d’application ne revient pas sur la validation déjà acquise : elle produit un fait d’échec et ne fait pas passer une intention publiée pour un succès.

**Problème.** Le texte peut se lire comme exigeant la poursuite de tous les effets, mais ne traite pas explicitement les dépendances ni les effets rendus impossibles par un échec précédent. Un ordre total de tentative ne définit pas ce qu’il faut faire du suffixe après erreur.

**Scénario.** Trois effets créent un élément, le configurent, puis lui donnent le focus. Le premier échoue synchroniquement. Faut-il tenter les deux autres, les déclarer non exécutables, ou abandonner tout le suffixe ? Une implémentation ne peut pas déduire la réponse de la seule absence de rollback hôte.

**Correction proposée.** Fixer une politique explicite de poursuite ou d’arrêt et la représentation des dépendances. Distinguer « engagé », « échoué » et « non tenté ». Préciser quels résultats deviennent des admissions et dans quel ordre. Cette correction ne demande aucune transaction extérieure.

### P10 — La fidélité causale exige une corrélation que l’hôte ne fournit pas toujours

**Axes :** 1, 4, 5, 6, 10. **Gravité : fort. Nature : hypothèse de réalisabilité manquante.**

**Citations exactes — [G8](../theorie.md#L605) et [B.4](../theorie.md#L1177) :**

> Un message possède un seul parent causal de déclenchement ; les consultations s’y inscrivent sans remplacer le contexte de leur auteur à son retour.

> Une politique déclarée peut retenir une notification, notamment la dernière, et abandonner les autres (D19). L'infrastructure de communication conserve le contexte de la notification retenue : le résultat continue ce seul déclenchement.

**Problème.** Sélectionner une notification déjà contextualisée n’est pas la même opération qu’identifier le déclencheur d’une notification produite par l’hôte. Un navigateur peut coalescer plusieurs changements et ne pas fournir d’identifiant corrélant son événement aux effets demandés. G8 pose une garantie absolue sans expliciter les conditions permettant de la réaliser pour ces sources.

**Scénario.** Deux traitements demandent des positions de défilement différentes avant une notification de l’hôte ; une intervention utilisateur survient dans l’intervalle. La notification observée ne permet pas nécessairement de distinguer origine spontanée et continuation, ni de sélectionner fidèlement un seul effet parent.

**Correction proposée.** Définir, par source, la granularité du fait et le protocole de corrélation requis. Si l’association fidèle est impossible, déclarer la restriction de conformité ou arbitrer une représentation causale adaptée. Ne pas assimiler sans justification « dernier effet demandé » et « déclencheur réel ». D19 peut rester une sélection mono-parent ; il ne résout pas à lui seul la perte d’information survenue avant l’admission.

### P11 — L’identité et la granularité d’un « même fait » restent indéterminées

**Axes :** 4, 5, 6, 7, 10. **Gravité : moyen. Nature : obligation non suffisamment opérationnalisée.**

**Citations exactes — [A5.d](../theorie.md#L582) et [D10](../theorie.md#L786) :**

> Un fait de l'hôte ou d'un système extérieur est admis par un seul composant.

> Un fait de l'hôte qui survient dans une part est admis par le propriétaire de cette part.

**Problème.** L’unicité d’admission exige de décider quand deux observations représentent le même fait. « Fait » est admis comme métalangage, mais reçoit ici une fonction technique d’identité et de routage. Une action humaine, un événement navigateur, ses passages dans plusieurs écouteurs et les événements consécutifs ne sont pas nécessairement la même unité.

**Scénario.** Une activation au clavier provoque un événement de touche, un clic synthétique puis un changement de valeur. S’agit-il d’un fait ou de trois faits ? À l’inverse, la propagation d’un seul événement vers plusieurs écouteurs ne doit pas devenir plusieurs admissions. A5.d ne permet pas de trancher cette granularité seul.

**Correction proposée.** Définir l’unité de fait par source et distinguer occurrence observée, propagation d’une occurrence et conséquence distincte. Prévoir un critère d’identité au point de capture unique. Ne pas promettre l’unicité d’une « intention utilisateur » si l’unité garantie est seulement une notification de l’hôte.

### P12 — Accès physique autorisé et observation admise ne sont pas suffisamment séparés

**Axes :** 1, 5, 6, 7, 10. **Gravité : moyen. Nature : articulation normative incomplète.**

**Citations exactes — [§11.6](../theorie.md#L466) et [18.15](../theorie.md#L991) :**

> Un support physique peut changer hors du modèle ; sa nouvelle observation n’est intégrée qu’à son admission.

> Un autre composant consulte le propriétaire par Query.

**Problème.** Le propriétaire est autorisé à accéder physiquement au support dans son périmètre. Le texte ne dit pas assez clairement si une Query rend seulement l’observation déjà admise, ou peut échantillonner le support à cet instant. Une nouvelle observation intégrée pendant une Query serait en tension avec le message local d’admission obligatoire et l’interdiction d’y produire un message différé.

**Scénario.** Une valeur de stockage est modifiée par un auteur extérieur ; sa notification n’est pas encore traitée. Une Query consulte l’adaptateur. Lire et rendre immédiatement la nouvelle valeur contournerait le protocole d’admission ; rendre l’ancienne observation respecte ce protocole, mais exige une règle de fraîcheur explicite.

**Correction proposée.** Séparer dans le contrat : accès physique, échantillonnage et observation admise consultable. Recommandation : les Queries rendent l’observation admise ; un rafraîchissement nécessitant une nouvelle observation suit un traitement modifiant et une admission définis. Préciser le cas de l’observation initiale et les éventuelles exceptions, sans les déduire de la seule autorisation d’accès.

### P13 — La capture des valeurs et leur absence d’alias mutable ne sont pas garanties transversalement

**Axes :** 4, 5, 6, 10. **Gravité : moyen. Nature : contrat de données incomplet.**

**Citations exactes — [G2](../theorie.md#L599) et [§16.5](../theorie.md#L839) :**

> Elle ne modifie ni un message, ni son contexte causal, ni une réponse.

> Elle peut en transmettre une valeur, figée, dans une Command autorisée par D18 ;

**Problème.** G2 contraint l’infrastructure, pas expressément l’auteur d’une charge utile détachée. Le caractère « figé » est prescrit localement pour la View, sans contrat général de capture. Interdire les références vers des ressources ne suffit pas à définir le partage d’objets mutables ne désignant plus ces ressources.

**Scénario.** Une Feature émet une collection copiée depuis son état, conserve cette copie, puis la modifie avant la délivrance différée. L’infrastructure n’a rien modifié et aucune référence vers l’Entity n’a circulé ; pourtant, la valeur reçue n’est plus celle de l’émission. Deux abonnés peuvent également partager un objet mutable.

**Correction proposée.** Spécifier que les valeurs de messages et de réponses sont capturées au point de transmission et ne présentent aucun alias mutable entre participants. Laisser ouvert le mécanisme conforme — immuabilité profonde, copie ou autre — sans confondre un type TypeScript en lecture seule avec une garantie générale à l’exécution. Préciser qu’une réponse conservée représente un état au moment de la consultation, non une autorisation durable ; une Command réévalue ses préconditions.

### P14 — Le remplacement d’un abonnement entre émission et délivrance est indéterminé

**Axes :** 5, 6, 10. **Gravité : moyen. Nature : contrat temporel incomplet.**

**Citations exactes — [D8](../theorie.md#L784) et [G1](../theorie.md#L598) :**

> Un message émis est délivré aux propriétaires des abonnements dans l'ordre des abonnements ; ces délivrances prennent rang au moment de l'émission.

> un message émis sur un Channel aux seuls propriétaires d'un abonnement à ce Channel

**Problème.** Le rang paraît fixé à l’émission, mais l’éligibilité n’est pas explicitement liée à l’abonnement précis présent à cet instant. Le cas du composant détruit est traité par T3 ; celui d’un abonnement détruit et remplacé alors que le composant reste vivant ne l’est pas.

**Scénario.** Un Event réserve une délivrance à C via l’abonnement S. Un traitement déjà en attente détruit S et crée S′ au même Channel. C doit-il recevoir l’ancien Event grâce à S′, ou la réservation liée à S doit-elle disparaître ? Les deux politiques peuvent être implémentées à partir des formulations actuelles.

**Correction proposée.** Lier une réservation à une occurrence déterminée d’abonnement présente à l’émission. Vérifier sa survie à la délivrance ; un nouvel abonnement ne reprend pas ses anciennes réservations. Préciser que supprimer une réservation conserve l’ordre relatif des autres. Une autre politique est possible, mais doit être déclarée expressément.

### P15 — La dernière phrase de T8 oublie l’autorité des propriétaires de parts

**Axes :** 1, 2, 5, 9, 10. **Gravité : moyen. Nature : commentaire plus restrictif que le résultat.**

**Citations exactes — [énoncé de T8](../theorie.md#L740), [commentaire de T8](../theorie.md#L748) et [§11.6](../theorie.md#L470) :**

> Tout effet du modèle sur un support de l’hôte est autorisé par une ressource admise ou une part issue de celle-ci par attribution, dont le propriétaire est unique dans ce modèle.

> L'historique, l'adresse, le titre du document ou le stockage local ne peuvent donc être modifiés que par le composant qui les a admis.

> Son propriétaire exerce l'autorité sur cette portion ; le propriétaire de la ressource distribuable en est privé tant que la part existe.

**Problème.** Le résultat principal distingue l’admetteur et les propriétaires de parts ; sa conclusion en prose les confond. Un propriétaire de part peut avoir autorité sans avoir admis le support initial. Les restrictions supplémentaires du catalogue ne découlent pas de T8 seul.

**Scénario.** Dans le noyau axiomatique, un composant admet un stockage distribuable puis attribue à son enfant une part de son périmètre. L’enfant prépare un effet dans cette portion selon A1.b et §11.6 ; il n’est pas l’admetteur initial. Ce scénario teste la conséquence générale, pas la conformité à toutes les décisions du catalogue navigateur.

**Correction proposée.** Conclure en termes de propriétaire de la ressource admise **ou de la part autorisant la portion concernée**. Si les exemples navigateur sont volontairement plus restrictifs, citer les décisions correspondantes et présenter cette restriction comme propre au catalogue.

### P16 — La motivation d’A4.e suppose une disponibilité que les autres règles ne garantissent pas

**Axes :** 1, 4, 5, 9. **Gravité : moyen. Nature : justification insuffisante, pas invalidité de l’axiome.**

**Citation exacte — [motivation d’A4.e](../theorie.md#L570) :**

> Pour que ce message puisse être traité, et les invariants métier vérifiés à l'issue de ce traitement (A4.a), le Channel doit exister.

**Problème.** A4.a exige la cohérence aux frontières de validation ; il n’oblige pas le système à accepter toute demande vers un ancien Channel. G3 interdit même la délivrance sur un Channel détruit. L’obligation de garder le Channel vivant suppose donc une politique supplémentaire de disponibilité des adresses connues.

**Contre-scénario à la motivation.** Une variante architecturale détruit un Channel et refuse explicitement les messages ultérieurs. Elle peut préserver propriété, médiation et invariants d’état. Elle viole A4.e, mais montre qu’A4.e n’est pas imposé par ces autres obligations seules. C’est un choix fondateur légitime, non une nécessité démontrée depuis A4.a.

**Correction proposée.** Présenter la disponibilité pendant toute la vie de la racine comme la motivation propre d’A4.e. Ne pas laisser entendre qu’elle serait déduite des invariants métier. Si une obligation de traitement est revendiquée, préciser séparément ses conditions : validité de l’adresse, refus possibles et absence de garantie générale de progression face à une file infinie.

### P17 — Une cause unique n’implique pas une admission unique

**Axes :** 1, 4, 5, 9. **Gravité : moyen. Nature : non sequitur dans la motivation d’A5.d.**

**Citation exacte — [motivation d’A5.d](../theorie.md#L592) :**

> A5.d tient à ce qu'une origine est une cause (10.2) : deux admissions d'un même fait lui donneraient deux contextes causaux, et le modèle représenterait une cause comme deux.

**Problème.** Deux représentations ne signifient pas nécessairement deux causes distinctes. Plusieurs messages possèdent déjà des contextes différents qui renvoient à une même chaîne causale, notamment lors d’une diffusion. La définition d’origine ne rend pas la représentation injective et n’interdit pas deux admissions contextualisées vers le même fait.

**Contre-scénario à la motivation.** Deux observateurs reconnaissent le même fait et partagent une même identité d’origine, sans prétendre qu’il existe deux causes. Cette organisation viole l’unicité d’admission d’A5.d, mais pas la définition d’origine à elle seule. La démonstration implicite de nécessité ne tient donc pas.

**Correction proposée.** Conserver A5.d comme règle fondatrice de capture unique, motivée par l’absence de réactions dupliquées et la simplicité du routage. Dire que deux captures indépendantes *risquent* de créer deux origines, plutôt qu’elles le font nécessairement. La définition de l’identité d’un fait proposée en P11 rendra ce contrat vérifiable.

### P18 — Les reformulations normatives et les théorèmes ne sont pas assez différenciés visuellement

**Axes :** 3, 8, 9. **Gravité : faible. Nature : taxonomie éditoriale.**

**Citations exactes — [introduction du §14](../theorie.md#L617) et [L1](../theorie.md#L630) :**

> L1 est le corollaire immédiat d’une prémisse explicite ; T2 nomme et classe les contrats imposés par A3.j.

> L1 est une reformulation utile d’A3.i, non une découverte déduite d’A3.c.

**Problème.** Le texte est honnête : il ne revendique plus de découverte indue. Mais un lemme muni d’une démonstration qui répète sa prémisse apparaît au même niveau que T5, résultat réellement contraignant sur les transitions. Un lecteur peut compter ces entrées comme autant de résultats indépendants ou prendre leur nombre pour une mesure de puissance déductive.

**Correction proposée.** Étiqueter explicitement les sous-catégories : « reformulation normative » pour L1, « classification et dénomination » pour T2, « conséquence » pour les autres résultats. Conserver L1 si son nom facilite les renvois ; sa suppression n’est pas nécessaire. « Cohérence métier » peut également rester un raccourci défini : une abréviation utile n’est pas, en soi, une notion redondante à éliminer.

**Circularité.** Le fait qu’une prescription réemploie des termes ultérieurs n’établit pas une circularité des définitions : le graphe du §17 exclut expressément ces prescriptions. Il faut vérifier leurs prémisses normatives, pas leur appliquer abusivement l’ordre lexical des phrases définitoires.

### P19 — La question ouverte sur les faits hors View a une conséquence de conformité à expliciter

**Axes :** 6, 7, 10. **Gravité : moyen. Nature : limite reconnue, mais politique de conformité incomplète.**

**Citations exactes — [18.30](../theorie.md#L969) et [D12](../theorie.md#L788) :**

> La granularité et l'admetteur d'un clic ou d'un déplacement du focus hors de la View concernée, notamment dans une portion non attribuée, restent à décider sans double admission.

> n'admet aucun fait de l'hôte et n'adresse aucune Command.

**Problème.** L’ouverture est correctement déclarée ; elle n’est ni une contradiction cachée ni une régression V0.9.3. Cependant, le lecteur doit encore savoir ce qu’il peut livrer en V1 lorsqu’un besoin courant, comme fermer un menu au clic extérieur, dépend de cette question. Un Composer peut avoir la portion cible sans être autorisé à admettre le fait ; les raccourcis document déclarés ne constituent pas une permission générique de capture.

**Scénario.** Un menu doit se fermer après un clic dans une portion de slot non attribuée. Le développeur risque d’ajouter un écouteur global dans son Behavior, alors que le document l’interdit par ailleurs.

**Correction proposée.** Sans résoudre 18.30 par défaut, ajouter une politique normative de conformité : cas non pris en charge en V1, cas soumis à une capacité expérimentale explicite, ou protocole dédié une fois arbitré. Décrire ce qui est interdit en attendant ; ne pas présenter une solution issue d’un rapport historique comme déjà autorisée.

### P20 — Le statut des décisions et des références structurelles conserve deux ambiguïtés de lecture

**Axes :** 7, 10. **Gravité : faible. Nature : clarification terminologique.**

**Citations exactes — [§15.2](../theorie.md#L773) et [§9.10](../theorie.md#L354) :**

> Elle ne rétrécit pas la théorie : un autre modèle conforme aux axiomes pourrait décider autrement.

> Référence d'un propriétaire vers une ressource dont il est propriétaire ou vers le périmètre de l'hôte lié à cette ressource, ou d'un parent vers son enfant.

**Problème.** Deux distinctions utiles doivent être rendues explicites. Premièrement, une décision ne change pas les axiomes, mais réduit bien les réalisations conformes au profil Bonsai concerné : une application V1 ne peut pas simplement choisir une autre décision. Deuxièmement, la référence parent-enfant autorisée pour la structure ne doit pas être comprise comme une permission d’appeler ses méthodes métier ou de lire son état. A3.a/A3.c et leurs contre-exemples l’interdisent déjà ; c’est l’interface de lecture qui manque de précision.

**Risque développeur.** Considérer D17/D18 comme facultatifs parce qu’ils sont « décisions » ; ou traiter une référence structurelle vers un enfant comme une capacité générale d’accès.

**Correction proposée.** Remplacer la première formulation par : « Une décision ne modifie pas les axiomes ; elle restreint les réalisations conformes au profil Bonsai qui l’adopte. » Ajouter à la seconde un renvoi explicite vers les seuls usages structurels autorisés, sans nouvelle dérogation à la médiation fonctionnelle. Ces clarifications ne demandent pas de changer l’architecture.

## Examen des définitions et des conséquences

### Non-circularité : résultat de la revue

**Aucun cercle définitoire direct n’a été identifié.** La distinction entre huit primitifs et quarante-quatre termes définis est cohérente avec l’intention du §17. En particulier :

- « propriétaire » dépend de « propriété », mais cette dernière est primitive : ce n’est pas une boucle de définition ;
- « part » est d’abord définie sans « attribution » ; l’attribution peut donc dépendre de la part sans cercle ;
- les renvois informatifs de l’identité vers la distribution ou de l’attribution vers T3 ne suffisent pas à établir une circularité ;
- la présence d’une règle normative hors de la liste des axiomes ne la rend pas illégitime : le §2.6 admet explicitement ces prémisses.

La réserve académique porte sur la **complétude des hypothèses**, non sur une preuve générale que les 52 notions seraient circulaires. P02 précise le seul risque de raisonnement quasi tautologique autour de la cascade : il dépend du statut exact donné à sa règle d’imputation.

### Statut des conséquences établies

**Un résultat déduit des axiomes n’est pas un axiome supplémentaire ni une décision.** La V0.9.3 respecte globalement cette distinction ; les corrections requises sont ciblées.

| Élément | Appréciation | Réserve ou action |
| --- | --- | --- |
| **L1 — Objet** | Reformulation explicite d’A3.i. | Aucune indépendance à revendiquer ; étiquette plus claire, P18. |
| **T1 — Composition par création** | Déduction locale correcte d’A0.d, A2.a et §7.2. | N’établit pas à lui seul l’unicité du parent ; P01. |
| **T2 — Trois voies** | Classification largement posée par A3.j, complétée par A3.g/A3.e/G1. | Formaliser l’exclusivité des catégories de transport ; P06. Le tableau d’ordonnancement utilise aussi G5 et D8. |
| **T3 — Cascade** | Noyau déductif recevable sous propriété actuelle et immuable. | Expliciter les hypothèses structurelles et la restitution ; P02–P04. |
| **T4 — Adressabilité** | Déduction convaincante d’A3.b/A3.e/A3.f et G1. | La distinction entre réponse et message évite correctement un faux contre-exemple. |
| **T5 — Localité des invariants** | Conséquence substantielle sous A1.b, A3.g, G5 et A4.a. | La portée « transition requise, ressources préexistantes » évite l’ancienne sur-généralisation. Aucun nouveau défaut retenu sur ce noyau. |
| **T6 — Survie du domaine** | Non-destruction anticipée correctement déduite d’A4.e et T3. | La fin avec la racine utilise le rattachement structurel global ; P02. |
| **T7 — Disjonction des parts** | Argument convaincant par soustraction puis restitution différée. | Porte d’abord sur les parts d’un même contenant ; expliciter les périmètres physiques pour généraliser aux supports. Ne pas y voir une preuve d’exclusivité entre admissions indépendantes. |
| **T8 — Admission préalable** | Énoncé principal correctement appuyé sur A1.b/A2.e/A2.a. | Sa dernière phrase oublie les parts ; P15. |

La présence d’exemples qui violent une clause ne prouve pas l’indépendance de cette clause : il faudrait montrer qu’ils satisfont toutes les autres prémisses. Le document exige des contre-exemples concevables, pas une preuve d’indépendance complète ; cette limite n’est donc pas comptée comme un défaut supplémentaire.

## Corrections prioritaires et critères de fermeture

**La priorité est de fermer les protocoles, pas d’ajouter des rôles.** Les propositions suivantes conservent propriété unique, médiation, causalité explicite et séparation domaine/interface.

| Priorité | Chantier | Constats | Critère documentaire de fermeture |
| --- | --- | --- | --- |
| **1** | Distribution et destruction | P03/P04/P05 | Attribution, restitution et cascade ont un exécutant autorisé ; le contenant survivant et celui détruit dans la même unité sont distingués ; identité et Composer autorisent exactement ces opérations. |
| **1** | Disponibilité pendant l’amorçage | P07 | Toute Query a une cible dont la disponibilité est explicitement établie ; les dépendances initiales et états provisoires sont définis. |
| **1** | Faits et callbacks tardifs | P08 | Aucun destinataire détruit n’est réactivé ; les messages locaux en attente et les contextes résiduels ont une règle de clôture. |
| **1** | Réalisabilité de la causalité hôte | P10/P11 | Chaque source définit l’unité de fait et la possibilité réelle de corrélation ; les cas non corrélables ne sont pas masqués par D19. |
| **2** | Exécution après validation | P09/P14 | Poursuite des effets, non-tentative et éligibilité des abonnements sont univoques. |
| **2** | Observations et valeurs | P12/P13 | Observation admise, capture des valeurs, aliasing et fraîcheur des réponses sont distingués. |
| **2** | Complétude des hypothèses | P01/P02/P06 | Existence unique, enracinement, présence du propriétaire et partition des transports sont explicités et cités dans les preuves. |
| **3** | Précision académique et DX | P15–P20 | Motivations non présentées comme déductions, reformulations étiquetées et profil de conformité lisible. |

Les arbitrages modifieraient d’abord la [théorie](../theorie.md), puis devraient être propagés vers les [gardes](../gardes.md), la [traçabilité](../tracabilite.md), le [guide pédagogique](../theorie-explication-pedagogique.md) et les [contrats des adaptateurs](../adaptateurs/README.md). Aucun de ces amendements n’est effectué ni réputé validé par le présent rapport. Aucun statut de test ou de conformité du framework n’en découle.

## Note globale de solidité théorique

**Note : 7/10.**

La théorie a une ossature sérieuse : vocabulaire ordonné, autorité documentaire explicite, distinction des catégories normatives, frontières architecturales stables et limites des garanties désormais reconnues. T5 est correctement borné ; L1/T2 n’affichent plus une indépendance déductive fictive ; l’absence de transaction hôte et de terminaison générale n’est plus dissimulée.

Les points retranchés sanctionnent surtout les **opérations structurelles encore incompatibles dans certains cas** et les **protocoles centraux insuffisamment fermés**, non des préférences de style. Une implémentation devrait encore inventer des règles de disponibilité initiale, de restitution, de callback tardif et de corrélation hôte. Ces inventions risqueraient de diverger tout en revendiquant le même texte.

**Appréciation finale : fondation architecturale crédible et nettement clarifiée, mais solidité opérationnelle encore conditionnelle.** Cette note est une appréciation argumentée de la V0.9.3 examinée, pas une preuve de consistance formelle ni une mesure de conformité du code.
