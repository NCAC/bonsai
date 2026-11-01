# Bonsai — Prototype du noyau de communication (lot M1)

*Rapport du 31 octobre 2026. Branche `feature/noyau-m1`, issue de `feature/documentation-big-bang` au commit `27ddbf9`. Code : `packages/event/src/kernel/` ; tests : `tests/unit/kernel/root.test.ts`. Ce rapport n'est pas normatif.*

## 1. Objet

Vérifier, par du code exécutable, que les garanties de l'infrastructure de communication fixées par la théorie V0.9.5 (§13 et annexe C) se réalisent, et relever ce que leur réalisation impose au reste du framework. Le prototype vit **à côté** de `Channel` et `Radio`, qu'il ne remplace pas ; `@bonsai/event` ne l'exporte pas encore.

## 2. Ce qui est réalisé

| Garantie | Réalisation | Test discriminant |
| --- | --- | --- |
| G1 | Command au propriétaire du Channel, Event aux propriétaires des abonnements, message local à son auteur, réponse à l'auteur de la Query | tous les blocs |
| G2, C.5 | Valeurs copiées puis gelées à la soumission (`structuredClone` + gel profond), réponses au retour ; une fonction ou un élément est refusé | mutation de la charge après `emit` sans effet ; `NOT_CAPTURABLE` |
| G3, C.2, C.6 | Réservation liée à un abonnement déterminé, vérifiée à la délivrance ; occurrence de vie non réutilisable | abonnement créé après l'émission non servi ; abonné détruit avant délivrance abandonné ; destruction annulée : réservation conservée |
| G5 | Messages différés mis en file à la fin réussie de l'unité ; une unité à la fois ; Query synchrone refusée vers une cible non prête ou active | exemple panier/promo du guide : affichage 20 puis 18 ; `A → Query B → Query A` et Query vers soi refusées |
| A3.g | Contexte en lecture seule pour le traitement d'une Query, transitivement | `trigger` dans une Query : `READ_ONLY`, unité de l'auteur annulée |
| G6 | Un registre de Channels, une file et des abonnements par `Root` | deux racines avec un Channel `cart` chacune |
| G7 | Journal d'annulation par unité ; créations, destructions et messages différés de l'unité abandonnés ; une erreur de Query « empoisonne » l'unité même si l'auteur l'intercepte | état restauré ; Event non délivré ; composant créé non publié ; `try/catch` autour d'une Query sans effet |
| G8 | Contextes créés par le noyau seul ; un parent par message ; retour de Query sans changement du contexte de l'auteur ; résultat corrélé par jeton lié à l'occurrence | chaîne clic → Command → résultat corrélé → Event ; origine inconnue ; jeton présenté à une autre occurrence refusé |
| D8 | Ordre de production ; abonnés dans l'ordre d'abonnement ; rang fixé à l'émission | `first`, `a`, `b`, `second` |
| D9 | Profondeur contrôlée avant toute soumission ; refus dans l'unité = erreur de transport et annulation ; refus au préambule = abandon tracé | boucle arrêtée à la borne, dernière unité annulée ; résultat corrélé au-delà de la borne abandonné |
| §2.5, C.1 | Démarrage : unité exceptionnelle ; messages et admissions en attente de sa réussite ; échec : modèle abandonné | message de démarrage délivré après la fin ; `StartupError` ; Query vers une cible en initialisation refusée |
| C.3 | Effets préparés, engagés dans l'ordre après validation, arrêt au premier échec synchrone, bilan admis | effet non engagé si l'unité échoue ; `engaged`, `failed`, `not-attempted` |
| A5.a | Un contexte conservé après son unité (par exemple dans un `.then()`) est refusé | `NO_UNIT` |

**Résultats.** 25 tests du noyau réussis ; la suite complète (302 tests) et `tsc --noEmit -p tsconfig.test.json` réussissent. Quatre mutations du code ont été vérifiées : suppression de l'empoisonnement, de l'annulation, du refus G5 et de la capture. Chacune fait échouer au moins un test. Sans contrôle D9, la boucle du test D9 ne termine pas : la borne est aussi ce qui garantit l'arrêt de la file.

## 3. Ce que le prototype apprend

**R1 — G7 n'est réalisable que si toute ressource interne passe par Bonsai.** Le noyau ne peut annuler que ce qui lui a été journalisé. Un champ ordinaire d'une classe de Feature, de View ou de Composer, modifié pendant un traitement, échappe à l'annulation. A0.c dit déjà que tout ce qu'on peut changer d'un composant est une ressource dont il est propriétaire ; il faut en tirer une garde : **pas de champ mutable dans une sous-classe de composant**, l'état passant par l'Entity (lot M2, patches Immer comme journal), l'état local de la View et le contenu du slot du Composer. Proposition : ajouter cette garde à `gardes.md` (lint, niveau statique) et l'expliquer dans le guide. **Validé le 31 octobre 2026** : ligne A0.c / G7 de `gardes.md` (lint, gel de l'instance à l'exécution, revue) et explication dans le guide.

**R2 — L'empoisonnement de l'unité est la bonne réalisation de « aucune récupération locale ».** Le code applicatif peut intercepter l'erreur d'une Query, mais l'unité échoue quand même. C'est conforme à G7, mais surprenant pour un développeur. Proposition : un lint contre `try/catch` autour de `query`, et un message d'erreur qui le dit. **Validé le 31 octobre 2026** : ligne G7 de `gardes.md` ; le prototype lève désormais une `TransportError` `UNRECOVERABLE`, avec l'erreur d'origine en `cause`, quand l'auteur a intercepté l'échec.

**R3 — La file est vidée de façon synchrone, jusqu'au bout.** C'est simple et commode à tester, et G5 ne demande rien d'autre. Mais une longue chaîne bloque le fil de l'hôte jusqu'à la borne D9. Rendre la main entre deux unités (microtâche ou tâche) reste compatible avec la théorie, puisque la frontière normative est la validation. **Question de conception pour la suite de M1**, à trancher dans un ADR. **Tranché le 1er novembre 2026 par [ADR-35](../adr/ADR-35-vidage-file-differee.md)** : vidage synchrone conservé ; le noyau mesure unités et vidages et signale ceux qui dépassent un seuil (50 ms par défaut). Une liste longue se projette dans une seule View plutôt qu'en N Views.

**R4 — L'ordre des dépendances initiales est l'ordre de création.** C.1 demande des dépendances de consultation déclarées et un ordre qui les respecte ; le prototype se contente de l'ordre de création et refuse une Query vers une cible encore en initialisation. Le graphe de dépendances déclarées relève du lot M2 (démarrage).

**R5 — Le jeton de corrélation n'a pas de fin de vie.** C.2 veut qu'un contexte soit conservé jusqu'au résultat, à l'annulation ou à la clôture de l'occurrence. Le prototype vérifie l'occurrence à l'admission, mais ne libère jamais le jeton. À réaliser avec les opérations instrumentées (lot M4).

**R6 — Le bilan d'effets est admis par un message local réservé, `$effects`.** C'est une convention de prototype ; D16 demande que ces résultats soient déclarés. La forme de cette déclaration est à fixer avec l'API cible des rôles.

**R7 — Coût de la capture.** Chaque message et chaque réponse sont copiés puis gelés. C'est sûr, mais coûteux pour de grosses charges. Une immuabilité par construction (valeurs déjà gelées, structures persistantes) pourrait éviter la copie ; à mesurer avant de choisir.

## 3 bis. Lot M2 — Entity, invariants et démarrage (1er novembre 2026)

**Réalisé.** Une Feature déclare son Entity (`entity: { name, initial, invariants }`, D4) ; son traitement la lit par `ctx.state()` et la modifie par `ctx.mutate(recette)`, via Immer. Chaque modification est journalisée dans l'unité. À la fin réussie de l'unité, le noyau vérifie les invariants de chaque Entity créée ou modifiée ; une violation fait échouer l'unité, qui est annulée (A4.a, G7). `Root.startFromManifest()` crée les enfants de la racine dans un ordre qui respecte leurs dépendances de consultation initiales (`dependsOn`), puis l'ordre de déclaration, et refuse un cycle ou une dépendance inconnue avant le démarrage (C.1).

| Porte de sortie du lot M2 (rapport de migration) | Test |
| --- | --- |
| Mutation réussie puis exception : état restauré | `addThenCrash` : total inchangé, Event non délivré |
| Une Query intermédiaire ne valide pas son auteur | `addInTwoSteps` : invariant rompu, Query vers une autre Feature, invariant rétabli, unité validée |
| Démarrage tardivement échoué sans publication partielle | deuxième enfant en échec : `StartupError`, le premier n'est jamais publié, admission abandonnée |
| Invariant violé à la fin d'une unité | `addBroken` : `InvariantError`, état restauré, Event abandonné |
| Invariant violé par l'état initial | `StartupError` |
| Écriture directe dans l'état gelé (garde A0.c / G7) | `TypeError`, unité annulée |
| Modification d'une Entity pendant une Query (A3.g) | `READ_ONLY` |
| Ordre et cycle des dépendances initiales | `analytics`, `catalog`, puis `cart` qui consulte `catalog` ; cycle et dépendance inconnue : `ManifestError` |

36 tests du noyau, suite complète réussie. Trois mutations vérifiées (vérification des invariants, annulation de l'Entity, ordre des dépendances) : chacune fait échouer au moins un test.

**Ce que le lot M2 apprend.**

- **L'annulation n'a pas besoin des patches inverses.** Les états Immer sont immuables : restaurer la référence précédente est une annulation exacte, plus simple et sans risque d'application partielle. Les patches restent utiles pour notifier les clés modifiées et pour les outils de développement.
- **Le gel de l'état réalise déjà la garde A0.c pour l'Entity.** Une écriture directe lève une `TypeError` et l'unité échoue. Les champs de classe restent couverts par le lint.
- **Les invariants ne sont vérifiés que pour les Entities touchées par l'unité.** Le coût suit le travail fait. Une vérification doit être une fonction pure de l'état ; une exception levée par elle fait échouer l'unité.
- **`dependsOn` est déclaré à part.** On ne peut pas le déduire du contrat : celui-ci dit quelles Queries un composant peut adresser, pas lesquelles il adresse pendant son initialisation. À garder déclaratif, et à intégrer à la forme du Manifest.
- **L'Entity livrée (`packages/entity`) a sa propre file de réentrance et ses notifications (`onAnyEntityUpdated`).** Dans le noyau, ces notifications deviennent des Events émis dans l'unité et délivrés après sa validation. Le raccordement de la classe livrée relève du lot M6.

## 3 ter. Lot M3 — Structure transactionnelle (1er novembre 2026)

**Réalisé, sans DOM.** Un composant admet un élément de l'hôte comme ressource distribuable (`admitDistributable`, D3). À la création d'un enfant, son parent peut lui attribuer une portion d'une ressource dont il est propriétaire (`create(spec, { part })`) : une part est créée, soustraite de la ressource, et l'enfant reçoit une **désignation** de cette attribution avec ses paramètres de création, capturés par copie (6.2, A3.d). L'enfant obtient sa part par **résolution contrôlée** (`resolve`), valide seulement pour une attribution vivante dont il est propriétaire (8.5, 9.10). Il n'existe aucune autre voie de fin d'une part que la fin de son propriétaire (A2.d). La destruction en cascade rend les portions de bas en haut, chaque restitution étant imputée au propriétaire du contenant encore présent ; une destruction annulée restaure exactement la structure antérieure.

| Porte de sortie du lot M3 (rapport de migration) | Test |
| --- | --- |
| Annulation conservant mêmes instances, parts et réservations | destruction de `view-a` puis échec : même occurrence, même part, même désignation, portions dans le même ordre ; aucune restitution publiée |
| Aucune réanimation ni réattribution de callback tardif | résultat corrélé adressé à la View détruite : abandonné ; présenté à la nouvelle View de la même portion : abandonné |
| Restitutions imputées de bas en haut | `view-a → composer`, `view-b-sub → view-b`, `view-b → composer`, `composer → foundation` |
| Parts disjointes (T7) | seconde attribution de la portion `a` : `PORTION_TAKEN` |
| Attribution par le seul propriétaire (A1.b) | portion d'une ressource d'autrui : `NOT_OWNER` |
| Désignation d'autrui ou périmée (8.5) | `INVALID_DESIGNATION`, y compris l'ancienne désignation après réattribution de la même portion |
| Paramètres de création par valeur (6.2, A3.d) | copie gelée ; fonction refusée : `NOT_CAPTURABLE` |

45 tests du noyau, suite complète réussie. Trois mutations vérifiées (cascade de haut en bas, contrôle de la désignation, contrôle T7) : chacune fait échouer au moins un test.

**Ce que le lot M3 apprend.**

- **L'annulation doit restaurer l'ordre, pas seulement le contenu.** Le premier essai réinsérait les portions rendues à la fin : la structure était équivalente, mais l'ordre d'attribution changeait (`b,a` au lieu de `a,b`). Comme l'ordre des parts d'un slot est l'ordre d'affichage (Composer §1.3), « conserver les parts antérieures » (C.7) inclut leur ordre. Le noyau restaure désormais un instantané exact.
- **Les restitutions d'une destruction annulée ne doivent pas apparaître dans la trace.** Elles sont collectées pendant l'unité et publiées seulement à sa validation, comme les messages différés.
- **Attribuer à la création suffit.** Théorie et API cible ne prévoient l'attribution qu'à la création de l'enfant ; le prototype n'offre pas d'autre voie, ce qui élimine par construction l'attribution à un non-enfant (A2.d) et la fin d'une part sans celle de son propriétaire.
- **Une désignation est un objet de données, comparable et transmissible.** Sa validité ne tient qu'à l'attribution qu'elle nomme ; un même emplacement réattribué donne une autre désignation. C'est ce qui permettra au lot M4 de passer un sélecteur à la View sans lui donner d'accès par lui-même.

## 3 quater. Lot M4 — Matérialisation dans l'hôte et effets (1er novembre 2026)

**Réalisé.** Avec un document hôte (jsdom dans les tests), `admitDistributable("#app")` admet l'élément désigné, une fois, à l'admission (D3). Chaque attribution prépare un effet du **propriétaire du contenant** : la création de l'élément de la part, engagée après validation (D12, C.3). Une View projette par `ctx.project(part, label, write)` : l'élément n'est remis à `write` qu'à l'engagement, et jamais pendant le traitement ; le code applicatif n'a donc aucune voie d'écriture immédiate. Une destruction validée prépare le retrait physique des parts dont le contenant survit (C.7) ; une destruction annulée ne touche pas l'hôte. La position d'une part est explicite (`before`).

| Porte de sortie du lot M4 (rapport de migration) | Test |
| --- | --- |
| Effet 2 en erreur, effet 3 non tenté | lot M1 (`engaged`, `failed`, `not-attempted`) |
| Résultat d'un enfant non transféré au créateur | au démarrage, le Composer reçoit le bilan de ses deux matérialisations, chaque View celui de sa propre projection |
| Échec extérieur ne révoquant pas le passé | l'hôte refuse l'écriture : bilan `failed`, ancien texte affiché, Entity conservant sa nouvelle valeur validée |
| Callback d'un composant détruit abandonné | lot M3 |
| DOM logique avant matérialisation | aucun élément de part pendant l'unité de démarrage ; parts créées dans l'ordre ensuite |
| Destruction validée, puis annulée | élément retiré et remplacé à sa place ; unité annulée : hôte inchangé |
| Élément hôte absent | `HOST_NOT_FOUND`, démarrage abandonné |

51 tests du noyau, suite complète (328 tests) réussie. Trois mutations vérifiées (matérialisation imputée à l'enfant, projection immédiate, absence de retrait) : chacune fait échouer au moins un test.

**Ce que le lot M4 apprend.**

- **L'ordre des parts ne peut pas venir de l'historique des attributions.** Réattribuer une portion la place en fin d'ordre d'attribution ; remplacer une View la déplaçait donc après sa voisine. L'ordre d'affichage est une décision de composition : il est désormais **explicite** (`before`), ce que la réconciliation du Composer (§1.3) calculera à partir du tableau rendu par `resolve`. À reporter dans la spécification du Composer.
- **`structuredClone` n'existe pas dans tous les hôtes** (jsdom). Le noyau a maintenant son propre copieur, identique partout et plus strict : il n'accepte que des données (primitives, tableaux, objets simples, `Date`, `Map`, `Set`) et refuse toute instance de classe, ce qui réalise A3.d sans dépendre de l'hôte.
- **Remettre l'élément seulement à l'engagement suffit à empêcher l'écriture pendant le traitement.** C'est une garde par construction de C.3 pour la View. En revanche, une projection peut encore écrire dans le contenu des slots de sa part ; ce point reste à la revue, ou à un futur découpage de l'élément confié.
- **La matérialisation est un effet du parent, la projection un effet de l'enfant.** Le bilan de chacun lui revient : c'est la règle de C.3, et le prototype montre qu'elle découle simplement du propriétaire de l'effet.

## 3 quinquies. Lot M5 — Admission dans les parts, monde fermé et D18 (1er novembre 2026)

**Réalisé.** Un composant déclare les événements de l'hôte qu'il admet dans sa part (`dom: { click: "click" }`, D10, D16). Bonsai enregistre l'écouteur à la matérialisation de la part (B.4) ; une occurrence n'est admise que par le propriétaire de la **part la plus intérieure** qui la contient, une seule fois (A5.d). Qualification par le monde fermé (C.4) : une occurrence produite par `ctx.simulate`, opération instrumentée engagée après validation, est corrélée au traitement qui l'a demandée ; toute autre est un fait indépendant. Droit de commander (D18) : il est attaché au contexte causal de chaque message. Un fait indépendant l'accorde ; un Event, une observation d'antécédent inconnu et le démarrage ne l'accordent pas ; une Command, un message local ou un résultat corrélé portent celui du traitement qui les a produits ou armés. Un composant marqué `ui` qui adresse une Command sans ce droit fait échouer son unité (`NOT_AUTHORIZED`).

| Porte de sortie du lot M5 (rapport de migration) | Test |
| --- | --- |
| Aucun parent inventé, aucun lien connu effacé | clic simulé dans une réaction à un Event : continuation de la chaîne, pas une nouvelle origine |
| Aucune permission blanchie | Event → Command ; Event → message local → Command ; Event → clic simulé → Command : tous refusés |
| Query conservant la permission de son auteur | clic → Query → Command : permis |
| Résultat corrélé | armé dans une réaction autorisée : peut commander ; armé dans une réaction à un Event : refusé |
| Observation d'antécédent inconnu | Command refusée |
| Admission unique, dans la part la plus intérieure | clic dans la View intérieure : admis par elle seule ; clic dans la View extérieure hors du slot : admis par elle seule |
| Limite documentée (B.2) | un `dispatchEvent` brut, hors de Bonsai, est indiscernable d'un clic de l'utilisateur |

D9 pendant l'unité et au préambule était déjà couvert au lot M1. 60 tests du noyau, suite complète (337 tests) réussie. Quatre mutations vérifiées (contrôle D18 désactivé, simulation qualifiée indépendante, admission hors de la part la plus intérieure, droit non retiré à la délivrance d'un Event) : chacune fait échouer au moins un test, la première et la dernière presque tous, car la boucle Event → Command repart alors jusqu'à la borne D9.

**Ce que le lot M5 apprend.**

- **Le droit de commander se réalise simplement comme une propriété du contexte causal.** Il naît à l'admission, se transmet avec les messages produits, et une seule règle le retire : la délivrance d'un Event. Toutes les variantes de « blanchiment » (relais local, Query, effet hôte corrélé) échouent sans règle particulière, parce qu'elles continuent la même chaîne.
- **Le noyau s'exécute à l'intérieur de la propagation de l'événement de l'hôte.** Avec le vidage synchrone (ADR-35), tout le traitement d'un clic, effets compris, a lieu pendant que le navigateur propage encore ce clic. Le navigateur ignore alors un `element.click()` imbriqué sur le même élément (« click in progress ») : la première version de `simulate` ne produisait rien. Elle passe désormais par `dispatchEvent`. Plus largement, les actions par défaut de l'hôte (soumission d'un formulaire, déplacement du focus) ont lieu **après** les effets engagés. **À ajouter aux conséquences d'ADR-35.**
- **Une View créée par un Composer en réaction à un Event n'a pas le droit de commander à son initialisation.** Charger les données d'une page à son montage ne peut donc pas venir de la View : c'est la Feature qui réagit à `router:routeChanged` (chorégraphie, D17). Le prototype confirme la règle de D18 ; **le guide doit le dire explicitement**, car c'est le premier réflexe d'un développeur venant d'un autre framework.
- **La carte des droits par contexte n'est jamais purgée.** Comme les jetons de corrélation (R5), sa durée de vie doit suivre celle des contextes conservés (C.2).

## 4. Hors périmètre

Intégration de l'Entity et validation de ses invariants (M2) ; parts, désignations et DOM (M3–M4) ; qualification des sources par le monde fermé et D18 (M5) ; remplacement de `Channel` et `Radio`, et branchement des classes de base (M6).

## 5. Suite proposée

1. ~~Valider les gardes R1 et R2 dans `gardes.md`~~ : fait.
2. ~~Trancher R3 dans un ADR~~ : ADR-35, mesure ajoutée au prototype (27 tests).
3. ~~Lot M2~~ : fait (section 3 bis).
4. ~~Lot M3~~ : fait (section 3 ter).
5. ~~Lot M4~~ : fait (section 3 quater).
6. ~~Lot M5~~ : fait (section 3 quinquies).
7. ~~Compléter ADR-35 et le guide avec les deux constats de M5~~ : fait, avec l'ordre explicite dans Composer §1.3.
8. Lot M6 : intégration (classes de base, contrats publics, parcours panier, multiracine, catalogue d'adaptateurs).
