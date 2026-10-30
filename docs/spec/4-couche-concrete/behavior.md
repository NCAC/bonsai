# Behavior — Plugin UI réutilisable et aveugle

> **Partie du code d'une View, sans statut de composant : déclarations propres, admission unique et état imputé à la View**

[← Retour couche concrète](README.md) | [← View](view.md) | [→ Foundation](foundation.md)

---

| Champ | Valeur |
| --- | --- |
| **Nature** | Partie réutilisable du code d'une View, **pas un composant** |
| **Couche** | Interface utilisateur, par imputation à la View |
| **Statut** | Contrat documentaire V0.9.4 ; aucun package Behavior livré |
| **Référence normative** | [Théorie](../../theorie.md), §2.5, C.2–C.6, D10, D11, D13, D16, D18 et §16.5–§16.7 |
| **Historique** | [ADR-21](../../adr/ADR-21-behavior-reutilisation.md), [ADR-14](../../adr/ADR-14-contrats-types.md), [ADR-15](../../adr/ADR-15-evenements-ui.md), [ADR-17](../../adr/ADR-17-local-state.md), [ADR-25](../../adr/ADR-25-formulaires.md) ; Accepted conservés sans modification |

> ## ⏳ Périmètre d'implémentation
>
> **Aucun mécanisme Behavior n'est livré** : ni package `@bonsai/behavior`, ni agrégation des déclarations et réactions, ni contrôle des collisions de clés, ni état local intégré à la View. Les anciens exemples de classes, types génériques, hooks et `get behaviors()` ne sont pas des API disponibles ; ils sont remplacés ici par des obligations et cas de conception sans syntaxe inventée.
>
> [La View livrée](../../../packages/view/src/bonsai-view.ts) possède ses contrats UI/Feature et `onAttach()`, mais pas `onDetach()`, ni orchestration Behavior. [Le Composer livré](../../../packages/composer/src/bonsai-composer.ts) oublie la View courante sans retirer ses listeners. Les garanties de cycle de vie cible ne sont donc pas fournies par ce runtime.

---

## Table des matières

1. [Contrat](#1-contrat)
2. [Déclarations](#2-déclarations)
3. [Cycle de vie](#3-cycle-de-vie)
4. [Exemples](#4-exemples)

---

## 1. Contrat

Un Behavior est une **partie réutilisable du code d'une View**, aveugle à celle-ci. Il n'est ni un composant enfant, ni une seconde autorité sur le DOM. Selon la règle d'imputation (§2.5), ce qu'il exécute est exécuté par la View qui le déclare.

| Sujet | Obligation normative |
| --- | --- |
| Existence et structure | Aucune existence, identité, part ou Channel propres ; pas de parent ni d'enfants au sens du modèle |
| État | État de présentation permis, mais partie de l'état local confiné de la View ; pas d'état métier faisant autorité |
| Aveuglement | Le **code** du Behavior ne désigne ni la View qui le déclare ni les clés de celle-ci ; aucune lecture implicite via référence, callback ou fermeture capturée |
| Clés UI | Noms disjoints de ceux de la View **et de chacun des autres Behaviors** déclarés par elle ; des noms différents peuvent désigner le même élément |
| Périmètre | Ses clés désignent seulement des éléments de la part de la View ; aucune capture, lecture ou production hors de cette part ou dans le contenu attribué à ses Composers |
| Effets de présentation | N1 et îlots N2 sur ses clés déclarées, dans les limites de la View ; pas de remplacement du template principal, de `rootElement` ou de composition N3 autonomes |
| Communication | Dépendances déclarées agrégées à celles de la View ; les messages sont adressés par cette dernière, aucun `emit()` ni Channel Behavior |
| Command | Restrictions D18 inchangées ; réutilisation et partage d'un élément ne créent aucune permission supplémentaire |

« Aveugle » ne signifie pas seulement l'absence d'une propriété `view` publique. Injecter une fonction qui lit l'état de la View ou appelle ses méthodes contournerait la séparation. Les paramètres éventuels doivent rester des valeurs capturées ou du code de calcul indépendant, sans référence cachée vers un autre composant ou ses ressources.

Les disjonctions de **noms** ne créent pas des parts DOM distinctes : View et Behaviors peuvent réagir au même élément parce qu'il n'y a qu'un composant propriétaire et qu'un admetteur. Inversement, des clés distinctes ne donnent aucun droit sur le contenu d'un slot attribué à un Composer enfant.

---

## 2. Déclarations

Les déclarations d'un Behavior font partie du contrat agrégé de sa View. Elles doivent être connues avant le démarrage selon D16, y compris pour les classes de Views instanciées plus tard. Cela ne prétend pas résoudre à l'avance toutes les instances et tous les éléments physiques. L'écriture et le typage de cette agrégation restent à concevoir ; les types View existants ne prouvent pas qu'elle fonctionne aujourd'hui.

### 2.1 Clés UI propres (I43)

La validation doit refuser tout nom commun entre les clés de la View et celles d'un Behavior, ou entre deux Behaviors de cette View (D13). Le contrôle doit aussi couvrir des occurrences réutilisées d'un même Behavior ; le mécanisme de configuration ou de nommage de ces occurrences n'est pas fixé ici.

Les sélecteurs sont résolus **sous contrôle de la part** de la View, et pas seulement sous un ancêtre DOM : le contenu de ses slots en est soustrait. L'élément du slot reste à la View, contrairement à ce contenu. Un simple `querySelector()` descendant n'établit pas à lui seul l'autorité requise.

Deux clés de noms différents peuvent désigner le même élément, notamment pour partager un clic entre présentation et tracking. Le contrôle porte donc sur les noms et le périmètre, pas sur une interdiction de toute coïncidence d'éléments. Le runtime livré ne réalise aucun de ces contrôles Behavior.

### 2.2 Handlers auto-découverts

Les traitements sont dérivés des messages et faits déclarés (D16), pas enregistrés librement à l'exécution. Les conventions historiques de noms de handlers View ne fixent pas à elles seules une future API Behavior.

Une occurrence de fait dans la part est **admise une fois, par la View**, même si ses propres réactions et celles de plusieurs Behaviors sont concernées. Le préambule capture la notification et ses valeurs sans mutation applicative ; les réactions ont lieu pendant **le même traitement du même message local**, dans la **même unité de validation** et le même contexte causal qualifié. La propagation entre écouteurs ne constitue pas de nouvelles occurrences (C.4, D10).

Les réactions s'exécutent dans l'ordre fixe de leur déclaration, y compris celles de la View ; une implémentation doit rendre cet ordre explicite et vérifiable. Aucun ordre fondé sur la propagation DOM, la découverte fortuite des méthodes ou des admissions distinctes n'est acceptable. Les messages différés suivent ensuite l'ordre de production D8 ; les Queries suivent le contrat synchrone G5.

### 2.3 Channels propres

Ce titre conserve le repère historique : **« propres » qualifie les dépendances déclarées, jamais la propriété d'un Channel**. Un Behavior n'a ni identité ni Channel. Les écoutes, Queries et Commands nécessaires à son code appartiennent au contrat de la View et sont exécutées par elle. Il n'est ni adressable ni une source d'Events autonome.

L'agrégation des déclarations Channel et la représentation des abonnements doivent encore être spécifiées. Elles doivent préserver l'imputation à la View, l'ordre des réactions et les réservations par occurrence d'abonnement (C.6), sans transformer plusieurs fragments de code en composants indépendants.

| Déclencheur de la réaction imputée à la View | Droit de Command selon D18 |
| --- | --- |
| Fait admis dont l'indépendance est établie par le protocole de source | Permis dans les limites des déclarations et de l'autorité de la View |
| Continuation corrélée d'une réaction déjà autorisée à commander | Permission conservée, non créée par le Behavior |
| Event reçu, relais local de cet Event, résultat extérieur corrélé à cet Event | Aucun droit de Command, même après une Query |
| Observation à antécédent inconnu | Aucun droit de Command ; état local et projection possibles dans leurs autres limites |
| Retour d'une Query | Pas un déclencheur autonome ; conserve chez l'auteur la permission préexistante, sans l'accorder au traitement de Query, toujours en lecture seule |

Un clic n'est pas autorisé à commander par son seul nom, sa proximité temporelle ou `isTrusted` : la qualification dépend du protocole de source (C.4). Pour les saisies dans la part, c'est le protocole du monde fermé : une saisie qu'aucune opération instrumentée en cours n'a pu produire est indépendante ([View §4.3](view.md#43-délégation-dévénements)). Un Behavior qui appelle directement `click()` ou `dispatchEvent()` viole G8. Les réactions d'un Behavior ne fabriquent ni origine indépendante ni nouveau contexte pour contourner D18 ou D9.

### 2.4 Templates en îlots (N2)

Un îlot de présentation peut être préparé sur une clé déclarée, dans la portion restant à la View. Un Behavior ne remplace pas le template principal et n'attribue aucune part à un Composer. Foundation et View ne sont parents que de Composers (D11) ; le Behavior agit seulement par imputation, sans rôle de composition autonome.

Le code ne capture ni ne produit rien hors de la part ou dans le contenu des slots : pas d'écoute de fenêtre, de capture globale « click outside » ou de focus extérieur par contournement. Les sources de niveau document déclarées sont admises par l'adaptateur D7/D10 ; le cas général du clic/focus extérieur reste ouvert dans la théorie (§18.30). Une infobulle ou modale hors de la part doit relever d'une composition appropriée, pas d'une insertion libre dans `body`.

Une écriture N2 ne peut supprimer un slot dont le Composer existe encore. La View doit d'abord faire prendre fin ce Composer selon la cascade et récupérer son contenu. Les effets de projection sont préparés pendant le traitement et appliqués après validation ; aucun rollback DOM ou succès atomique n'en découle.

### 2.5 localState

L'état utilisé par un Behavior est **une partie de l'état local de la View**. Le Behavior n'en est pas un propriétaire distinct. Cet état est initialisé dans l'unité autorisée de la View, modifié seulement pendant ses traitements, et soumis au même rollback interne. Il peut évoluer en réaction à un Event sans autoriser pour autant une Command.

L'état reste confiné : aucun autre composant ne le lit, ne le modifie ou ne le demande ; il n'est pas diffusé. Une valeur figée peut entrer dans une Command autorisée par D18, sans alias mutable (C.5). Un brouillon ou une validation de saisie n'est pas une certification de l'état métier du domaine. Il prend fin avec la View, pas lors d'un « détachement Behavior » indépendant.

Les noms historiques `localState`, `updateLocal()` et callbacks de mise à jour décrits dans [View §7](view.md#7-api-localstate) ne sont pas livrés pour Behavior. Le partitionnement interne, le typage et l'ordre des réactions de projection restent à concevoir, sans relâcher la règle d'imputation.

---

## 3. Cycle de vie

Un Behavior ne naît ni ne meurt comme composant. Sa contribution est initialisée avec la View ; tout état et toute réaction sont imputés à celle-ci. Il n'a pas de part à restituer, d'occurrence de vie séparée ni de cascade autonome.

| Moment | Obligation cible |
| --- | --- |
| Préparation de la View | Agréger les déclarations, vérifier les noms et les périmètres, fixer l'ordre déclaré ; aucune mutation pendant le préambule d'admission |
| Initialisation autorisée | Initialiser l'état et les réactions dans l'unité de la View ; si elle est créée pendant un traitement, cette initialisation entre dans l'unité de son créateur (§2.5) |
| Traitement d'un fait admis | Une admission View, un message local, réactions ordonnées dans le même traitement et contexte qualifié ; validation commune, effets seulement préparés |
| Échec de cette unité | Rollback interne commun, y compris créations/destructions structurelles et différés ; aucune garantie de restauration d'effets hôte déjà appliqués |
| Destruction provisoire de la View | Notifications capturées en attente de l'issue ; annulation : même occurrence de vie et mêmes réservations ; validation : abandon |
| Fin logique de la View | Cascade de ses descendants de bas en haut, restitutions aux propriétaires encore vivants ; aucun hook ou traitement applicatif Behavior pendant la cascade |
| Après validation | Nettoyage physique des ressources instrumentées ; callbacks tardifs filtrés avant admission et délivrance vers l'occurrence de la View |

Un callback destiné à cette View ne peut être repris par une nouvelle View au même emplacement. Un abonnement recréé n'hérite pas des Events réservés au précédent : $S \ne S'$ (C.2, C.6). Les résultats instrumentés reviennent à la View encore vivante, non à un Behavior destinataire autonome. Les échecs de nettoyage après sa fin peuvent être tracés techniquement, sans réaction applicative d'un destinataire détruit.

Il n'existe aujourd'hui ni `Behavior.onAttach()` ni `Behavior.onDetach()`. Ces noms figurant dans l'ancienne cible ne sont pas des signatures garanties ; surtout, un hook de nettoyage applicatif pendant la cascade serait incompatible avec §2.5. Le [cycle de vie commun](../2-architecture/lifecycle.md) distingue les hooks View/Foundation effectivement présents et les mécanismes encore à concevoir.

### 3.1 Behavior, View + options ou héritage ? (ADR-21)

| Question | Orientation de conception, non promesse d'API |
| --- | --- |
| Sert de base de composition ? | View avec Composers enfants, pas Behavior composant |
| Même View dans un autre contexte ? | Paramétrage de présentation ; les surcharges/options par Composer restent non livrées |
| Capacité orthogonale à réutiliser dans des Views sans rapport ? | Code Behavior aveugle, déclarations agrégées et imputation à chaque View |
| Modifie le template principal ? | Responsabilité View ; l'héritage n'est pas un moyen d'élargir l'autorité |
| Nécessite des dépendances Channel déclarées ? | Possible dans le code Behavior, mais communications et abonnements restent ceux de la View ; pas de « Channels propres » au sens de propriété |
| Nécessite sa propre existence ou une part indépendante ? | Ce n'est pas un Behavior ; revoir la décomposition par Composer et View |

---

## 4. Exemples

Les cas suivants fixent des responsabilités, **sans pseudo-code ni syntaxe d'API anticipée**. Les ancres historiques sont conservées pour les références entrantes ; les anciens snippets ne sont plus un contrat exécutable.

### 4.1 TrackingBehavior — handlers auto-découverts, pas d'altération DOM

Un fragment de tracking déclare ses propres noms de clés et ses dépendances de communication. Sa clé peut viser le même bouton qu'une clé de la View ou d'un autre Behavior si leurs noms sont disjoints. Un clic sur ce bouton produit une seule admission par la View ; les réactions de présentation et de tracking suivent l'ordre déclaré dans le même traitement.

Une Command de tracking n'est possible que si le déclencheur satisfait D18. Un changement de présentation déclenché par un Event du domaine n'autorise pas une Command de tracking par relais. Le fragment ne lit ni état privé, ni clés, ni méthodes de la View ; les valeurs utiles viennent de ses déclarations et de la capture autorisée du fait.

### 4.2 ScrollBehavior — localState et projection N1

Le défilement visé est celui d'un élément déclaré dans la part de la View, hors contenu de slot attribué, jamais une écoute directe de `window`. Position et indicateurs de présentation appartiennent à l'état local de la View. Le traitement peut les actualiser et préparer une projection sur les clés du fragment.

Une notification générale de défilement peut être qualifiée à antécédent inconnu par le protocole navigateur (C.4). Elle n'autorise alors aucune Command, notamment pour demander automatiquement la page suivante au domaine. Un mécanisme de chargement supplémentaire exige un déclencheur autorisé et un protocole causal explicite ; une minuterie ou une Query ne blanchit pas une causalité inconnue.

### 4.3 ContactFormBehavior — formulaire réutilisable (ADR-25, pattern C)

Le code réutilisable peut préparer saisie, erreurs de présentation et projection d'un formulaire dans la part. Le brouillon et les erreurs sont des portions de l'état local de la View ; les invariants métier restent vérifiés par le domaine dans son traitement de Command.

Une soumission admise avec indépendance établie, ou sa continuation autorisée, peut conduire la View à adresser une Command déclarée contenant des valeurs capturées et figées. Il n'y a pas d'appel fonctionnel « Behavior vers View » : le Behavior n'est pas un composant émetteur ; le code de soumission est imputé à la View. Une configuration réutilisable ne doit pas capturer une référence à celle-ci ou désigner ses clés pour appeler ses méthodes.

La forme de configuration d'une destination métier et l'assemblage déclaratif restent à concevoir. L'ancien exemple de callback fermant sur la View n'est donc pas conservé comme contrat. Un calcul de validation indépendant peut être réutilisé sans autorité métier ; la réussite effective de la soumission provient ensuite du domaine. L'Event de confirmation peut actualiser le rendu, pas déclencher une nouvelle Command.

### 4.4 Déclaration dans la View hôte

La View déclare les fragments réutilisables et leur ordre ; leurs noms de clés sont contrôlés ensemble, ainsi que ses propres clés. Les dépendances Channel et sources déclarées sont agrégées sans multiplier les admissions de faits. Le comportement ne dépend pas de l'ordre fortuit de branchement des listeners.

**Restent à concevoir et non livrés :** syntaxe de déclaration, classes ou autre forme de code réutilisable, configuration par valeurs, occurrences multiples, agrégation des contrats, contrôle des noms et des périmètres, capture unique, ordre de toutes les réactions, état local et rollback commun, suivi des abonnements et nettoyage post-validation. Aucun `get behaviors()`, type `TBehaviorContract` ou `TBehaviorCallbacks`, constructeur ou hook nouveau n'est fixé par ce document.

---

## Lecture suivante

→ [foundation.md](foundation.md) — ancrage configurable par racine
→ [View §7](view.md#7-api-localstate) — cible historique de l'état local, à lire sous la règle d'imputation
→ [Cycle de vie](../2-architecture/lifecycle.md) — occurrences de vie, réservations, cascade et limites du livré
→ [ADR-25](../../adr/ADR-25-formulaires.md) — historique des patterns de formulaire, sans nouvelle API promise ici
