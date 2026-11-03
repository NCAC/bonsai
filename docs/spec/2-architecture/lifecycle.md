# Cycle de vie des composants

> 🗑️ **La classe `Channel` est retirée (lot M6.3b, 1er novembre 2026)** : les messages passent par la racine du noyau (`Root`, `@bonsai/kernel`). Les passages qui décrivent la classe sont historiques ; voir [communication.md](../2-architecture/communication.md).


> **Existence logique, composition, validation et nettoyage physique : contrat V0.9.4 et limites du livré**

[← Retour à l'architecture](README.md) · [← State](state.md)

---

> ## ⏳ Périmètre d'implémentation (ADR-31)
>
> Ce document est une **conception documentaire**, non une annonce de mécanismes runtime livrés. La référence normative est la [théorie V0.9.4](../../theorie.md), notamment §2.5, C.2, C.3, C.6, A0–A2, T3 et §16.4–§16.7. Les ADR Accepted restent des traces historiques ; leurs contrats incompatibles ne prévalent pas sur cette théorie.
>
> | Observation vérifiée dans les sources | Portée réelle |
> | --- | --- |
> | `Feature.onInit()` appelé par `bootstrap()` | Initialisation synchrone avant la création concrète ; aucune `Promise` attendue |
> | `View.mount()` appelle `onAttach()` après branchement des handlers | Aucun `View.onDetach()` déclaré ou invoqué ; aucun démontage complet |
> | `Foundation.attach()` appelle `onAttach()` après ses Composers | `Foundation.onDetach()` est déclaré, mais jamais appelé |
> | `Composer.#detachCurrent()` efface ses références courantes | Ni destruction logique conforme, ni désabonnement : les listeners Channel et DOM de la View restent actifs |
> | Pas de package Behavior, ni de `Application.stop()` ou `Feature.onDestroy()` | Aucun protocole complet de fin, de cascade ou de nettoyage livré |
>
> Sources : [Application](../../../packages/application/src/bonsai-application.ts), [Foundation](../../../packages/foundation/src/bonsai-foundation.ts), [Composer](../../../packages/composer/src/bonsai-composer.ts), [View](../../../packages/view/src/bonsai-view.ts). La gestion transactionnelle des existences, les occurrences de vie, les réservations et le nettoyage post-validation décrits ci-dessous restent à implémenter.

## 1. Deux catégories de composants

La durée de vie est d'abord celle de l'**existence logique**, pas celle du montage physique. Créer un composant non racine crée une existence, ressource dont son créateur est propriétaire : ce créateur est son parent (A0.d, A1, A2, T1). Le parent n'est pas propriétaire du composant lui-même. Une référence structurelle ne lui donne aucun accès fonctionnel à l'état de son enfant.

Une part, une identité ou un abonnement sont des ressources, pas des existences interchangeables avec celle du composant. La propriété ne se transfère pas ; une nouvelle attribution d'un même emplacement produit une autre part. Un élément DOM conservé, retiré ou réutilisé ne détermine pas à lui seul la présence du composant dans le modèle.

### Composants persistants (couche abstraite)

| Élément | Nature et durée de vie dans le contrat cible |
| --- | --- |
| **Application** | Racine ; existence fournie par l'hôte, extérieure au modèle et jamais admise par un composant |
| **Feature** | Composant enfant déclaré de la racine ; survit aux changements de l'interface et prend fin avec la racine |
| **Entity** | Ressource de la Feature, **pas un composant** ; D2 interdit à la Feature de la détruire pour la réinitialiser |
| **Channel et identité d'une Feature** | Ressources liées à sa vie, non des composants indépendants |
| **Adaptateur de l'hôte** | Composant déclaré enfant de la racine ; seul admetteur de ses sources selon D7 |
| **Racine du noyau (`Root`)** | Infrastructure de communication, une par Application (G6) |
| **Navigation** | Rôle de Feature et d'adaptateur selon D15 ; pas un singleton global déduit des axiomes |

Le cycle attach/detach répété de navigation ne s'applique pas aux Features. Le livré appelle `onInit()` une fois pendant le démarrage réussi ordinaire ; il ne fournit ni shutdown ordonné ni garantie de rollback d'un démarrage échoué. Les enfants de la racine sont déclarés dans son Manifest, non enregistrés à la demande (D14).

### Composants volatils (couche concrète)

| Élément | Parent et durée de vie cible |
| --- | --- |
| **Foundation** | Une par racine, enfant de celle-ci ; D1 interdit à la racine de la détruire pendant sa vie. Elle prend fin avec la racine ; ce n'est pas un singleton global |
| **Composer** | Enfant d'une Foundation ou d'une View ; son parent possède son existence et lui attribue le contenu d'un slot |
| **View** | Enfant d'un Composer, propriétaire d'une part attribuée par lui ; prend fin par destruction de son existence ou cascade |
| **Behavior** | Partie du code d'une View, **pas un composant**, sans existence, identité, Channel ou part propres ; état et opérations imputés à cette View |

La Foundation appartient à la couche concrète mais reste persistante au sens de D1. Foundation et View ne sont parents **que de Composers** ; une View n'est enfant que d'un Composer (D11). Un Behavior n'est donc jamais un maillon supplémentaire de la cascade.

Le montage est une matérialisation sur l'hôte. Une initialisation logique peut être prête sans DOM déjà matérialisé (C.1). Oublier une référence JavaScript, enlever un nœud ou appeler un hook ne constitue pas le protocole de destruction de l'existence.

---

## 2. Nettoyage déterministe

Le contrat cible distingue **clôture logique annulable** et **nettoyage physique post-validation**. Il ne garantit aujourd'hui aucun nettoyage automatique complet, ni récupération de toute ressource créée librement par du code applicatif.

### Cinq règles de nettoyage

1. **Cascade logique de bas en haut.** La décision du parent peut initier la destruction d'un sous-arbre, mais les descendants sont clôturés avant les contenants et composants concernés. Les fins de leurs ressources font partie de la destruction, sans transfert d'autorité à l'ancêtre initiateur.
2. **Restitution au propriétaire encore vivant.** La fin d'une part rend sa portion à la ressource distribuable dont elle était soustraite. Cette modification est imputée au propriétaire de ce contenant alors qu'il est encore présent dans l'ordre logique, même s'il disparaît ensuite. Aucune nouvelle attribution ni méthode fonctionnelle du parent n'est implicite.
3. **Structure provisoire et rollback commun.** Existences, abonnements, attributions et restitutions appartiennent à l'unité de validation. Une destruction annulée conserve les composants, propriétaires, parts, désignations et occurrences de vie antérieurs. Les créations abandonnées et leurs désignations ne sont pas publiées. Créations et destructions de cette unité s'annulent ensemble sous G7.
4. **Aucun traitement applicatif pendant la cascade.** Ces étapes ne délivrent aucun message et n'exécutent aucun hook applicatif. La fermeture logique n'attend pas la réussite du nettoyage matériel. Retrait DOM, désinscription physique et annulation extérieure irréversibles sont préparés puis engagés après validation (§2.5).
5. **Aucune résurrection par notification.** Après destruction validée, les délivrances en attente sont retirées et les callbacks tardifs sont écartés avant admission. Une trace technique peut signaler un abandon ou un échec de nettoyage, sans appeler le composant disparu (C.2–C.3).

Par exemple, pour une View contenant un Composer enfant, les Views de ce Composer prennent fin et leurs portions lui sont restituées avant sa propre fin ; son contenu revient ensuite à la View encore vivante ; la part de cette View revient enfin à son Composer parent. C'est l'ordre logique des restitutions, non une suite de hooks de destruction.

| Ressource ou opération | Obligation cible et limite |
| --- | --- |
| Abonnements Channel | Clôture logique dans l'unité ; retrait physique après validation ; aucune réservation reprise par un nouvel abonnement |
| Listeners DOM instrumentés | Arrêt des admissions vers l'occurrence clôturée, puis désinscription physique ; pas de garantie livrée pour des listeners arbitraires |
| Minuteries et opérations extérieures instrumentées | Tentative d'annulation au nettoyage ; les callbacks déjà engagés restent possibles, mais ne sont pas admis vers un destinataire détruit |
| Parts, désignations et états locaux | Fin logique selon la propriété et la cascade ; leur conservation physique éventuelle ne les maintient pas dans le modèle |
| Écritures DOM, retraits et autres effets préparés | Engagement post-validation ; pas de transaction distribuée, d'atomicité DOM ni de restauration d'un support déjà modifié |

Une erreur d'effet ne révoque pas la validation interne. Les bilans d'engagement et résultats instrumentés déclarés reviennent à l'occurrence **encore vivante** du composant concerné, y compris Foundation ou Composer pour leurs effets autorisés (C.3). Après sa disparition, seule une observation technique de l'erreur est possible. L'idempotence matérielle, les reprises et la prise en charge exhaustive des ressources restent à concevoir ; elles ne se déduisent pas de T3.

### 2.1 Occurrences de vie et réservations

Chaque création reçoit une occurrence de vie non réutilisable, distincte du namespace et de l'emplacement DOM. Callbacks, opérations et messages locaux visent cette occurrence ; sa validité est contrôlée **avant admission et avant délivrance**. Une nouvelle View au même emplacement ne reçoit jamais les résultats de l'ancienne.

Pendant une destruction provisoire, une notification techniquement capturée attend l'issue de l'unité : abandon si la destruction est validée, admission après annulation sinon. La capture n'exécute pas de traitement applicatif. L'annulation conserve la même occurrence et les conservations causales antérieures.

À l'émission d'un Event, ses réservations fixent les occurrences d'abonnement et leur ordre (C.6). Avant chaque délivrance, abonnement réservé, propriétaire et Channel doivent encore être valides. Un abonnement détruit puis recréé est un autre abonnement : **$S \ne S'$**, même si cible et déclaration sont identiques. Il ne reprend aucun Event réservé à $S$. Une destruction annulée conserve au contraire $S$ et ses réservations ; un abandon ne réordonne pas les autres et ne fait pas échouer rétroactivement l'émetteur validé.

---

## 3. Bootstrap

La [spécification Application](../3-couche-abstraite/application.md) et [ADR-07](../../adr/ADR-07-application-bootstrap.md) décrivent les phases historiques du livré. Elles ne constituent pas une implémentation du protocole transactionnel de la théorie.

| Sujet | Contrat cible V0.9.4 | Livré observé |
| --- | --- | --- |
| Déclaration | Manifest propre à chaque racine ; enfants déclarés, classe et élément de la Foundation, sources et dépendances connus avant démarrage | Options `foundation` et `features` ; pas de sélection de l'élément Foundation |
| Disponibilité | Channels établis avant les consultations initiales ; initialisations ordonnées par dépendances, puis ordre déclaré ; Query vers cible active ou non prête refusée | Features instanciées et Channels créés avant `bootstrap()` des Features ; pas de protocole complet de disponibilité |
| Initialisation | Sous la cause de démarrage, avant ouverture du transport différé ; admissions en attente jusqu'à clôture | `Feature.onInit()` synchrone, puis Foundation, Composers et Views |
| Publication | Après réussite de toute l'unité ; échec : abandon du modèle en construction et de ses différés | Pas de rollback structurel complet ni de publication transactionnelle |
| Création après démarrage | Initialisation de l'enfant incluse dans l'unité de validation du créateur, échec compris ; chaque propriétaire exécute ses propres opérations | Instanciation et montage directs par le Composer ; aucune garantie transactionnelle correspondante |

L'inclusion de l'initialisation d'un enfant dans l'unité du créateur ne délègue aucune autorité sur ses ressources. Les Queries initiales ne visent pas une initialisation encore active. Les effets irréversibles restent soumis à la préparation et à l'engagement post-validation ; un échec extérieur ne restaure pas l'hôte.

### Shutdown

La fin de la racine vient **de l'hôte**. Aucun composant n'en admet l'existence ni ne reçoit le droit de la détruire (A0.d, §7.4). Elle clôt toutes les occurrences de vie et leurs conservations causales ; les descendants et ressources prennent fin selon la cascade. Les restitutions structurelles restent imputées avant la fin de leurs propriétaires.

Ce n'est pas un shutdown livré en trois appels, ni une promesse de hooks dans l'ordre inverse d'enregistrement. L'ordre nécessaire est structurel, de bas en haut ; il ne fixe pas à lui seul l'ordre entre frères. Une éventuelle API d'arrêt et son articulation avec le signal de l'hôte restent à concevoir : le nom historique `Application.stop()` ne constitue pas une API disponible ni un droit de détruire l'existence extérieure.

La fin du modèle n'efface pas ce que l'hôte conserve : DOM, stockage, adresse ou opérations déjà engagées peuvent subsister. Une admission ultérieure par une autre racine crée de nouvelles ressources. Ni fin de racine ni abandon de démarrage ne promettent un rollback de l'hôte.

---

## 4. Hooks de lifecycle — composants concrets

Les noms ci-dessous sont vérifiés dans le code. **Un hook de montage existant n'est pas une garantie de disponibilité logique, de publication ou de transaction.** Aucun de ces hooks ne doit être présenté comme le mécanisme de cascade cible.

### View

| Hook | Réalité du livré | Conséquence documentaire |
| --- | --- | --- |
| `onAttach()` | Déclaré et appelé à la fin de `mount()`, après branchement des handlers DOM et Channel | Ne prouve ni validation transactionnelle ni publication ; le `rootElement` est aujourd'hui résolu globalement |
| `onDetach()` | **Absent** de la classe View, sans appelant | Ne pas prescrire une surcharge de ce nom pour obtenir un nettoyage ; protocole cible à concevoir sans hook applicatif pendant la cascade |

### Behavior

Aucune classe ni aucun hook Behavior n'est livré. Un Behavior n'a pas de cycle de vie autonome : initialisation, état et réactions sont imputés à sa View. Les anciens noms `onAttach()` et `onDetach()` n'établissent aucune API future ; une éventuelle initialisation réutilisable devra respecter l'unité de la View et ne pas introduire de traitement applicatif dans la cascade. Voir [Behavior](../4-couche-concrete/behavior.md#3-cycle-de-vie).

### Composer

`resolve(event)` est le point de décision livré, avec `null` lors de l'attachement initial. Le Composer ne déclare ni `onMount()`, ni `onUnmount()`, ni `onAttach()`, ni `onDetach()`. Aucun abonnement Channel ne déclenche actuellement sa résolution en application. D12 exclut état local indépendant, présentation générale et Command ; les résultats instrumentés déclarés de ses propres effets de composition restent autorisés (C.3).

### Foundation

`onAttach()` est appelé après l'attachement des Composers racines ; `onDetach()` est déclaré mais non invoqué. Les commentaires historiques suggérant des listeners globaux ne sont pas conformes au périmètre D3/D7 cible. La Foundation admet seulement son élément configuré, et les résultats instrumentés de ses effets autorisés ; aucun hook ne lui accorde `html`, `document`, `window` ou des sources globales supplémentaires.

### 4.1 Ce qui reste à concevoir

- Représentation et validation des existences, parts, désignations, occurrences et réservations ; journal de rollback commun aux créations et destructions.
- Capture unique, attente pendant destruction provisoire, filtrage avant admission/délivrance et retrait des différés vers une occurrence clôturée.
- Registre des ressources instrumentées, préparation du nettoyage, engagement post-validation, résultats déclarés, diagnostics et stratégie de reprise après échec partiel.
- Articulation du démarrage, des hooks historiques, de la disponibilité et de la fin signalée par l'hôte ; aucune nouvelle signature n'est fixée ici.
- Composition par Composers enfants, inclusion des Behaviors dans le traitement de la View et isolation effective entre racines.

---

## Lecture suivante

→ [Metas et tracabilite](metas.md) — traçabilité et propagation du contexte
→ [Foundation](../4-couche-concrete/foundation.md) — ancrage configurable par racine
→ [Behavior](../4-couche-concrete/behavior.md) — code réutilisable imputé à la View
