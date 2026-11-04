# Cycle de vie des composants

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lots M3 et M6, 4 novembre 2026).** Les limites restantes sont listées au §5. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Existence logique, composition, validation et nettoyage physique : ce que le noyau garantit**

[← Retour à l'architecture](README.md) · [← State](state.md)

---

La référence normative est la [théorie](../../theorie.md), notamment §2.5, C.1 à C.3, C.6, A0 à A2 et §16.4 à §16.7. Le mécanisme est porté par la racine du noyau (`Root`, `@bonsai/kernel`, lot M3) : registre des existences, parts et désignations, cascade et restitutions, journal de l'unité de validation.

## 1. Deux catégories de composants

La durée de vie est celle de l'**existence logique**, pas celle du montage physique. Créer un composant non racine crée une existence, ressource dont son créateur est propriétaire : ce créateur est son parent (A0.d, A1, A2). Le parent n'est pas propriétaire du composant lui-même : une référence structurelle ne lui donne aucun accès à l'état de son enfant.

Une part, une identité ou un abonnement sont des ressources, pas des existences. La propriété ne se transfère pas ; une nouvelle attribution d'un même emplacement produit une autre part. Un élément DOM conservé, retiré ou réutilisé ne détermine pas à lui seul la présence du composant dans le modèle.

### Composants persistants (couche abstraite)

| Élément | Nature et durée de vie |
| --- | --- |
| **Application** | Racine ; existence fournie par l'hôte, extérieure au modèle. Possède une racine du noyau (`Root`), une par Application (G6) |
| **Feature** | Enfant déclaré de la racine, dans le Manifest (D14) ; vit jusqu'à la fin de la racine |
| **Entity** | Ressource de la Feature, **pas un composant** ; son état est détenu par le noyau (D2 : jamais détruite pour être réinitialisée) |
| **Channel d'une Feature** | Ressource liée à sa vie, enregistrée par le noyau sous son namespace |
| **Adaptateur de l'hôte** | Enfant déclaré de la racine ; seul admetteur de ses sources (D7). Livré : l'adaptateur d'historique (`@bonsai/router`) |
| **Navigation** | Feature `router` fournie par le framework et adaptateur d'historique (D15) |

`Feature.onInit(ctx)` est appelé une fois, dans l'unité de démarrage, après l'initialisation des Features qu'elle déclare dans `dependsOn` (C.1).

### Composants éphémères (couche concrète)

| Élément | Parent et durée de vie |
| --- | --- |
| **Foundation** | Une par racine, enfant de celle-ci ; jamais détruite pendant sa vie (D1). Admet son ancre (option `anchor`, `<body>` par défaut, D3) |
| **Composer** | Enfant d'une Foundation ou d'une View ; reçoit le contenu d'un slot de son parent |
| **View** | Enfant d'un Composer ; créée par le noyau quand le Composer la résout, propriétaire de la part qu'il lui attribue ; prend fin quand sa clé disparaît de la composition ou par cascade |
| **Behavior** | ⏳ strate 2. Partie du code d'une View, **pas un composant** : sans existence, identité, Channel ni part propres |

Foundation et View ne sont parents **que de Composers** ; une View n'est enfant que d'un Composer (D11, I20). Un Behavior n'est donc jamais un maillon de la cascade.

---

## 2. Création et destruction

### 2.1 Qui crée, qui détruit

| Opération | Auteur | Garantie |
| --- | --- | --- |
| Créer une View | Le noyau, sur décision de `resolve(ctx)` du Composer | La View reçoit une désignation de sa part, jamais un élément (I31) ; sa description entre au noyau, son `template` est projeté, ses Composers sont créés dans la même unité |
| Créer un Composer | Le noyau, pour chaque slot déclaré par `get composers()` (Foundation, View) | Un slot désigne exactement un élément du contenant |
| Détruire une View | Son Composer, quand sa clé disparaît ou que sa View ou ses `params` changent | Seul le parent détruit (I19, A1.b) ; une destruction par un autre composant est refusée |

Une View n'a ni `mount()`, ni destruction propre, ni hook de cycle de vie : elle est passive (I19).

### 2.2 Nettoyage déterministe

Le noyau distingue **clôture logique annulable** et **nettoyage physique post-validation**.

1. **Cascade logique de bas en haut.** La destruction d'un sous-arbre clôt les descendants avant leurs contenants, sans transfert d'autorité à l'ancêtre qui l'a initiée.
2. **Restitution au propriétaire encore vivant.** La fin d'une part rend sa portion au contenant dont elle était soustraite ; la restitution est imputée au propriétaire de ce contenant (I58).
3. **Rollback commun.** Créations, destructions, abonnements, attributions et restitutions appartiennent à l'unité de validation. Si l'unité échoue, une destruction est annulée avec les mêmes occurrences, Channels et réservations ; les créations abandonnées ne sont pas publiées (G7).
4. **Aucun traitement applicatif pendant la cascade.** Aucune délivrance ni hook applicatif. Le retrait des éléments est un effet, engagé après validation (C.3), par le propriétaire du contenant qui survit.
5. **Aucune résurrection.** Après destruction validée, une délivrance qui visait le composant est abandonnée, pas exécutée (`delivery-abandoned` dans la trace, C.6) ; un fait du DOM n'est plus admis vers lui.

Par exemple, pour une View contenant un Composer enfant : les Views de ce Composer prennent fin et leurs portions lui sont restituées ; son contenu revient ensuite à la View encore vivante ; la part de cette View revient enfin à son Composer parent. C'est l'ordre logique des restitutions, pas une suite de hooks.

| Ressource | Ce que fait le noyau |
| --- | --- |
| Abonnements aux Events | Clôturés dans l'unité ; une réservation antérieure n'est jamais reprise par un nouvel abonnement |
| Sources DOM d'une part | Enregistrées par le noyau sur l'élément de la part ; retirées avec lui ; un fait vers un destinataire détruit n'est pas admis |
| Parts et désignations | Fin logique selon la propriété et la cascade ; l'élément d'une part dont le contenant survit est retiré après validation |
| Effets préparés | Engagés après validation, dans l'ordre ; pas de transaction distribuée ni de restauration d'un DOM déjà modifié (C.3) |

Une erreur d'effet ne révoque pas la validation interne : elle est consignée dans la trace (`effects`) et, en développement, sur la console (O2).

### 2.3 Occurrences de vie et réservations

Chaque création reçoit une occurrence de vie non réutilisable, distincte du namespace et de l'emplacement DOM. Sa validité est contrôlée **avant admission et avant délivrance**. Une nouvelle View sous la même clé est une autre occurrence : elle ne reçoit rien de l'ancienne.

À l'émission d'un Event, ses réservations fixent les abonnements et leur ordre (C.6). Un abonnement créé après l'émission ne reçoit pas l'Event ; un abonnement détruit puis recréé est un autre abonnement ($S \ne S'$). Une destruction annulée conserve au contraire $S$ et ses réservations ; un abandon ne réordonne pas les autres délivrances et ne fait pas échouer rétroactivement l'émetteur.

---

## 3. Démarrage

`Application.start()` valide le Manifest (phases 0a à 0c), puis démarre la racine du noyau dans une **unité de démarrage** (§2.5, C.1). Détail : [application.md](../3-couche-abstraite/application.md), [ADR-07](../../adr/ADR-07-application-bootstrap.md).

| Étape | Garantie livrée |
| --- | --- |
| Déclaration | Manifest propre à chaque racine : Features, Feature `router` et adaptateurs fournis par le framework, Foundation et son ancre |
| Disponibilité | Channels établis avant les Queries initiales ; `onInit` ordonnés par `dependsOn`, puis ordre déclaré ; une Query vers une cible encore en initialisation est refusée ; un cycle de dépendances est refusé (`ManifestError`) |
| Ordre | Features (I56), adaptateurs, Foundation, puis Composers et Views résolus |
| Publication | Les messages produits au démarrage ne sont délivrés qu'après sa réussite ; en cas d'échec, le modèle en construction est abandonné (`StartupError`) et une racine ne démarre qu'une fois |

Les contextes causaux du démarrage ont pour origine `startup` (G8, I7).

### Arrêt

La fin de la racine vient **de l'hôte** (A0.d, §7.4). Aucun composant ne reçoit le droit de la détruire.

`Application.stop()` existe mais ne fait aujourd'hui qu'une chose : retirer les observateurs que Bonsai a posés sur l'hôte (B.2, adaptateur d'historique). Le modèle n'est pas détruit. Ni fin de racine ni abandon de démarrage ne promettent un rollback de l'hôte : DOM, stockage ou adresse déjà modifiés subsistent.

---

## 4. Points de décision des composants

Il n'existe **aucun hook de montage ou de démontage** (`onAttach`, `onDetach`, `mount`, `onMount`, `onUnmount` sont retirés) : un hook de ce type ferait exécuter du code applicatif pendant la cascade ou avant la validation.

| Composant | Point de décision | Contexte |
| --- | --- | --- |
| **Feature** | `onInit(ctx)` au démarrage ; handlers de Command, d'Event, de Query et de notification d'Entity | `TFeatureContext` (`mutate`, `emit`, `query`) ou `TFeatureQueryContext` (`query`) |
| **View** | Handlers des faits du DOM et des Events écoutés | `TFactContext` (`trigger`, `query`) ou `TEventContext` (`query`, sans `trigger`, D18) |
| **Composer** | `resolve(ctx)` à sa création, puis à chaque Event déclaré | `TComposeContext` (`query`) ; il ne commande ni n'émet (D12) |
| **Foundation** | Aucun : elle déclare ses slots par `get composers()`, lu une fois au démarrage (I67) | — |
| **Behavior** | ⏳ strate 2 : inclus dans le traitement de la View qui le porte | — |

---

## 5. Limites connues

- **Arrêt** : pas de fin ordonnée du modèle ; `stop()` ne retire que les observateurs de l'hôte.
- **Ressources libres** : minuteries ou requêtes créées par du code applicatif ne sont ni instrumentées ni annulées par le noyau ; seules les sources déclarées (DOM des parts, adaptateurs) le sont.
- **Behavior et état local** (strate 2) : inclusion des Behaviors dans l'unité de la View, état local de présentation (ADR-17).
- **Hydratation** (strate 2) : la part d'une View est toujours un élément créé par le noyau ; un DOM pré-rendu n'est pas réutilisé.

---

## Lecture suivante

→ [Metas et traçabilité](metas.md) — contextes causaux et propagation
→ [Foundation](../4-couche-concrete/foundation.md) — ancrage configurable par racine
→ [Behavior](../4-couche-concrete/behavior.md) — code réutilisable imputé à la View
