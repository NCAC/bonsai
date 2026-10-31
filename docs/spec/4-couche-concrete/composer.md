# Composer -- Décideur de composition

> **Propriétaire du contenu attribué d'un slot et de l'existence de ses Views ; composition structurelle, jamais rendu de présentation supplémentaire**

[<- Retour couche concrete](README.md) | [<- Foundation](foundation.md) | [-> View](view.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Composer |
| **Couche** | Concrète (éphémère) |
| **Statut** | Alignement documentaire V0.9.5 ; API cible ⏳ au §1.3 ; contrat cible distinct du runtime livré |
| **Référence normative** | [Théorie](../../theorie.md), §2.5, annexe C, D11, D12 et §16.5–§16.7 |
| **Historique** | [ADR-18](../../adr/ADR-18-composer.md), [ADR-19](../../adr/ADR-19-root-element.md), [ADR-14](../../adr/ADR-14-contrats-types.md) ; ADR Accepted conservés sans modification |

> ## ⏳ Périmètre d'implémentation
>
> Les obligations ci-dessous ne décrivent pas des garanties déjà fournies par le runtime. Les §1.1, §1.2, §2 à §6 décrivent la surface livrée de [la source Composer](../../../packages/composer/src/bonsai-composer.ts) et [la source View](../../../packages/view/src/bonsai-view.ts) ; l'API cible est au §1.3, marquée ⏳.
>
> | Sujet | Livré | Contrat cible / limite |
> | --- | --- | --- |
> | Décision | Classe `Composer` non générique ; `resolve(event: unknown \| null)` retourne `TResolveResult \| null` | 0/1 View aujourd'hui ; tableau non livré (§3.2) |
> | Attachement | `attach(parentElement)` cherche le slot puis le crée physiquement s'il manque, avant la résolution | Pas de préparation transactionnelle ni de résolution contrôlée des attributions |
> | Montage View | `View.mount()` fait un `document.querySelector()` global, sans créer la racine absente | Ne garantit ni confinement au slot ni propriété de la part |
> | Détachement | `#detachCurrent()` oublie seulement les références | La View n'est pas démontée ; ses listeners DOM et Channel restent actifs |
> | Recalcul | `performResolve(event)` existe ; aucune écoute Channel ne le déclenche en application | Contrat Feature, écoute et `request()` Composer non livrés |
> | États | Champ privé `#state: "idle" \| "active"` | Pas de destruction logique, cascade, rollback structurel ni occurrences de vie instrumentées |
> | Composition imbriquée | Aucun `View.composers` livré | Désignations, restitutions, réservations et nettoyage post-validation restent à concevoir |

---

## Table des matieres

1. [Classe abstraite Composer](#1-classe-abstraite-composer) — dont [l'API cible](#13-api-cible-)
2. [Exemples](#2-exemples)
3. [Méthode resolve()](#3-méthode-resolve)
4. [Cycle de vie et attachement](#4-cycle-de-vie-et-attachement)
5. [Cascade de destruction](#5-cascade-de-destruction)
6. [Cycle de vie -- machine a états](#6-cycle-de-vie----machine-a-états)

---

## 1. Classe abstraite Composer

Le Composer est un composant enfant d'une Foundation ou d'une View. **Une View n'est enfant que d'un Composer ; Foundation et View ne sont parents que de Composers** (D11). La Foundation ne crée donc pas directement de View dans le contrat cible.

Son parent lui attribue le **contenu** d'un slot, pas l'élément du slot lui-même. Cet élément reste au parent. Le Composer est propriétaire de ce contenu seulement **hors des parts qu'il attribue à ses Views**, et de l'existence de ces Views. Il ne lit pas les parts déjà attribuées, même si elles restent physiquement sous le même ancêtre DOM. Les parts attribuées ne se recouvrent pas ; la destruction d'une View restitue sa part au Composer.

**D12 corrige la lecture trop générale d'I35 « jamais d'écriture DOM ».** Le Composer ne modifie la structure que pour attribuer ou restituer les parts de ses Views, créer ou retirer les éléments correspondants. Il n'effectue aucun rendu de présentation supplémentaire et ne possède aucun état local indépendant de ce contenu et de ces existences. Il n'adresse aucune Command et, sans identité ni Channel propre, n'émet aucun message. Les décisions se recalculent à partir des messages reçus, des réponses aux Queries et des Views présentes.

Il n'admet aucune notification générale de l'hôte. En revanche, les **résultats instrumentés de ses propres effets de composition** sont permis (C.3) : leur contrat et leurs traitements locaux sont déclarés selon D16, bilans d'engagement compris. Cette admission n'ajoute ni source générale, ni handler arbitraire, ni état indépendant, ni droit de Command. Elle reste soumise à l'occurrence de vie et à la borne causale D9.

### 1.1 Types

| Nom historique | Surface réellement livrée / portée |
| --- | --- |
| `TResolveResult` | Objet avec `view: TViewClass` et `rootElement: string`, sans `options` |
| `TComposerOptions` | Objet avec `rootElement: string`, utilisé pour le sélecteur du slot |
| `TViewClass` | Type structurel exporté par View ; ne prouve aucune propriété ni validité d'attribution |
| `TComposerContract`, `TComposerFeatures`, `TComposeContext`, `TComposition` | API cible ⏳ du §1.3 ; non livrés. `TComposerEvent` historique est abandonné : `resolve` ne reçoit pas d'Event |

**I31 :** le sélecteur CSS est un **choix de représentation compatible**, livré sous la forme `rootElement: string`, pas une obligation déduite de la théorie. Le contrat impose une **désignation fournie à la création**, dont la résolution contrôlée vérifie la propriété et la validité pour l'attribution concernée. La désignation ne confère pas d'accès à elle seule. Aucun élément de l'hôte n'est transmis à l'enfant. Une réattribution du même emplacement ne réactive jamais une ancienne désignation.

La syntaxe de ces désignations et leur liaison aux attributions restent à concevoir. Un sélecteur égal ou une référence DOM retrouvée ne prouvent pas qu'il s'agit de la même attribution. Le passage actuel d'un `HTMLElement` à `attach()` est un fait du code livré, pas la réalisation de ce contrat cible.

### 1.2 Classe

La surface existante comprend le constructeur recevant `TComposerOptions`, les getters `rootElement`, `slot`, `currentView`, les méthodes `attach()`, `performResolve()` et la méthode abstraite `resolve()`. `slot` expose actuellement un `HTMLElement | null` ; `currentView` conserve au plus une View. Cette surface ne doit pas être interprétée comme une autorisation théorique d'accéder aux ressources de l'enfant.

`attach()` cherche par `parentElement.querySelector(rootElement)`. En cas d'absence, il ajoute immédiatement un élément créé au parent, puis appelle `resolve(null)`. Le parseur simplifié crée toujours un `div`, ignore le tag demandé et extrait les attributs, la première classe et l'id. Il crée le **slot**, pas la racine de la View. Ce comportement ne réalise ni un parseur CSS général ni une création post-validation.

Il n'existe aujourd'hui ni module Feature Composer, ni `request()`, ni branchement des Events écoutés, ni hook de destruction. L'absence de hook applicatif pendant une cascade est une obligation cible, non la preuve qu'il n'y aurait aucune ressource d'observation à nettoyer.

### 1.3 API cible ⏳

> ⏳ **Cible non livrée**, validée le 31 octobre 2026 (point S2 de la [relecture V0.9.4](../../rapports/relecture-V0.9.4-2026-10-30.md)), avec quatre choix : `resolve` sans l'Event déclencheur ; une entrée de `composers` pour exactement un slot ; une Foundation sans Channel en V1 ; aucun handler applicatif pour les résultats de composition.

Le parent déclare ses slots ; chaque entrée désigne **exactement un** élément de sa part et le Composer qui en reçoit le contenu :

```typescript
// ─── View ou Foundation : déclaration des slots ──────────────────────────────
get composers() {
  return {
    main: { slot: "[data-slot='main']", composer: MainComposer },
    side: { slot: "[data-slot='side']", composer: CartPanelComposer },
  } as const;                      // clés de slot disjointes des clés UI
}
```

Le Composer déclare ses dépendances et le catalogue fini des Views qu'il peut créer, puis une seule fonction de décision :

```typescript
const mainFeatures = {
  router: { feature: RouterFeature, listens: ["routeChanged"],   queries: ["currentRoute"] },
  auth:   { feature: AuthFeature,   listens: ["sessionChanged"], queries: ["session"] },
} satisfies TComposerFeatures;     // pas de lane `triggers` : D12

const mainViews = { login: LoginView, product: ProductView, cart: CartView } as const;

type TMainContract = TComposerContract<typeof mainFeatures, typeof mainViews>;

class MainComposer extends Composer<TMainContract> {
  get features() { return mainFeatures; }
  get views()    { return mainViews; }   // catalogue fini des Views possibles

  resolve(ctx: TComposeContext<TMainContract>): TComposition<TMainContract> {
    if (!ctx.query("auth:session", {}).loggedIn) return [{ view: "login", key: "login" }];
    const route = ctx.query("router:currentRoute", {});
    switch (route.name) {
      case "product": return [{ view: "product", key: `product:${route.params.id}`,
                                params: { productId: route.params.id } }];
      case "cart":    return [{ view: "cart", key: "cart" }];
      default:        return [];
    }
  }
}
```

| Règle | Ce que l'API garantit |
| --- | --- |
| D12, aucune Command | `TComposerFeatures` n'a pas de lane `triggers` ; `TComposeContext` n'offre que `query`. |
| D12, aucun état propre | `resolve` ne reçoit pas l'Event déclencheur : elle se recalcule à partir des seules Queries. Un même état du domaine donne une même composition, quel que soit l'ordre des Events qui y ont mené. Un champ mutable de sous-classe est un état indépendant, refusé en revue et par lint. |
| D11, T7 | Le tableau rendu donne les Views et leur ordre dans le slot. Le Composer crée pour chacune un élément et lui en attribue la part, sans recouvrement. |
| A3.d | `params` ne contient que des valeurs, typées par le contrat de la View visée. |
| T3, réconciliation | Même `key` et même View : instance conservée (optimisation). `params` différents : destruction puis recréation, car ce sont des paramètres de création. `key` absente : destruction, avec sa descendance. Les clés sont uniques dans une composition. |
| C.3, échec de création | Une View dont l'élément n'a pas pu être créé est détruite logiquement ; l'erreur est signalée avec son contexte causal (G7), sans nouvel essai ni handler applicatif. Le prochain Event déclaré relance `resolve` à partir de l'état du domaine. |
| Répétition | Une entrée de `composers` correspond à un seul slot ; une recherche qui ne trouve pas exactement un élément est refusée à l'exécution. N zones composées passent par N Views, chacune avec son slot ; une liste purement visuelle relève de la projection de la View. |

**Quand `resolve` est appelée.** Par Bonsai seulement, à deux moments : pendant l'initialisation du Composer, dans l'unité de validation de son créateur (au démarrage pour les Composers de la Foundation) ; puis pendant le traitement de chaque Event déclaré dans `listens`, qui forme sa propre unité de validation. Jamais au retour d'une Query, sur un fait de l'hôte, sur un résultat de composition, ni à la demande du code applicatif.

**Limite connue.** Deux Events successifs, par exemple `auth:sessionChanged` puis `router:routeChanged` lors d'une connexion suivie d'une redirection, donnent deux appels ; les effets de la première unité sont engagés avant la seconde délivrance (C.3). Une composition intermédiaire peut donc s'afficher brièvement. Elle correspond à un état validé du domaine. Un regroupement à la manière de D19, ou un Event unique émis par le domaine, sont des pistes hors V1.

---

## 2. Exemples

Ces cas décrivent des responsabilités ; leur écriture cible est celle du §1.3, dont l'exemple réalise le cas 2.3.

### 2.1 Composer statique — aucun Channel (forme livrée)

Un pied de page peut être choisi sans Event : la résolution initiale retourne sa classe View et un sélecteur de racine. Le code livré instancie cette View et appelle son `mount()` ; l'élément doit déjà exister, et sa recherche est globale. Dans la cible, la part doit être attribuée et sa désignation transmise à la création ; l'initialisation de la View entre dans l'unité de validation du Composer.

### 2.2 Composer conditionnel — un Channel

Un panneau dépendant de l'authentification choisit la View de connexion ou de profil d'après le message reçu et les réponses aux Queries autorisées. Il ne mémorise pas un état d'authentification indépendant. Ce branchement Channel et ces Queries ne sont pas livrés pour Composer. Un résultat instrumenté de projection peut signaler une non-tentative ou un échec ; son traitement reste borné à la composition, sans Command.

### 2.3 Composer multi-Channel — routeur et authentification

Un contenu principal peut dépendre de la route et de l'authentification. Consulter plusieurs réponses ne constitue pas un instantané global, ni une permission d'interroger une cible encore active ou non prête (C.1, C.5). La sélection ne crée ou ne détruit que les Views et parts dont le Composer est propriétaire ; elle ne commande ni navigation ni authentification. Ces dépendances se déclarent dans `features` et se consultent par `ctx.query` (§1.3).

---

## 3. Méthode resolve()

`resolve(event)` est le point de décision livré. L'appel initial reçoit `null` ; `performResolve(event)` permet de le rappeler, mais seuls les tests le font actuellement, sans écoute Channel applicative. Le contrat cible autorise l'initialisation puis les traitements déclarés ; il ne déduit aucun nouvel appel de la seule présence physique d'un slot.

La réapparition d'un élément DOM n'est **ni une création logique, ni une réactivation**. Après destruction validée, une composition ultérieure exige une nouvelle occurrence, une nouvelle attribution et de nouvelles désignations. Une annulation de destruction provisoire, au contraire, conserve les existences et désignations antérieures : ce n'est pas une recréation.

### 3.1 Diff pour le retour simple (`TResolveResult | null`)

Ce tableau décrit **l'algorithme livré**, pas une destruction conforme à la théorie. L'égalité porte sur la classe et la chaîne `rootElement`, non sur une preuve de part ou d'attribution.

| Nouveau résultat | View courante | Action du code |
| --- | --- | --- |
| Même classe, même `rootElement` | Instance présente | No-op, instance conservée |
| Même classe, autre `rootElement` | Instance présente | Oublier les références, créer et monter une nouvelle View |
| Autre classe | Instance présente | Oublier les références, créer et monter une nouvelle View |
| Résultat non nul | Aucune | Créer et monter la View |
| `null` | Instance présente | Oublier les références seulement |
| `null` | Aucune | No-op |

`#attachNew()` appelle le constructeur sans argument puis `mount(result.rootElement)`, et ne renseigne ses références qu'après ce montage. Il n'y a pas de rollback complet si le montage échoue ; les opérations déjà réalisées, dont les listeners, ne sont pas annulées. `#detachCurrent()` ne retire ni racine, ni slot, ni abonnement.

### 3.2 Diff pour le retour tableau (`TResolveResult[]`)

**Non livré. I37 :** « un type unique de Composer, 0..N Views hétérogènes » reste le **choix d'API cible du registre**, non une nécessité théorique sur la cardinalité ou la forme du retour. Le runtime gère 0/1 View ; il n'accepte pas de tableau. La conservation d'une instance à sélection identique est également un choix de rapprochement, pas une conséquence des axiomes.

Le futur rapprochement d'une décision avec la composition existante doit contrôler les attributions, leur non-recouvrement et leurs occurrences, sans prendre la présence DOM comme source de vérité. Identification par `key`, conservation, ordre et représentation des résultats multiples sont fixés par l'API cible (§1.3). L'ancien pseudo-diff basé sur « élément disparu du DOM → cleanup » ne constitue plus un contrat cible.

---

## 4. Cycle de vie et attachement

Les séquences suivantes sont des **obligations cibles**, non des signatures ni une liste d'appels runtime déjà disponibles. Voir aussi le [cycle de vie commun](../2-architecture/lifecycle.md).

### 4.1 Sequence d'attachement (normative)

1. Le parent crée le Composer et lui fournit la désignation du contenu attribué. L'élément du slot reste au parent ; son contenu lui est soustrait.
2. La résolution contrôlée établit la référence structurelle après vérification de la propriété et de la validité de l'attribution. Aucun élément hôte n'est passé à l'enfant.
3. Pendant son initialisation autorisée, ou un traitement déclaré ultérieur, le Composer décide des Views ; il crée leur existence et leur attribue des parts disjointes, qu'il cesse alors de lire ou modifier directement.
4. Chaque View reçoit à sa création la désignation de sa part et réalise son initialisation sur ses propres ressources. Cette initialisation appartient à l'unité de validation du créateur, sans transfert d'autorité sur ces ressources. Les consultations respectent la disponibilité et la lecture seule.
5. Les validations portent sur l'unité complète, pas sur chaque opération intermédiaire. Les existences, abonnements, attributions, restitutions et messages différés sont provisoires jusqu'à sa réussite. Un échec les annule ensemble ; les créations abandonnées et leurs désignations ne sont pas publiées.
6. Les effets physiques préparés ne sont engagés **qu'après validation interne**, dans l'ordre de préparation, avant la délivrance différée suivante. Le démarrage ne publie aucune application partiellement démarrée.

Cette projection n'est pas une transaction hôte : les écritures peuvent réussir partiellement. Au premier échec synchrone d'engagement, les suivantes sont non tentées ; les engagements précédents ne sont pas annulés. Les résultats capturés sont admis par de nouveaux messages vers l'occurrence vivante concernée, sans réentrance ni annonce anticipée de réussite. L'ordre des engagements ne garantit pas celui des achèvements asynchrones (C.3).

### 4.2 Sequence de detachement (normative)

Le titre historique « détachement » désigne ici la **fin logique** d'une View ou d'un Composer, pas une suspension réactivable ni un hook applicatif.

| Étape cible | Obligation |
| --- | --- |
| Décision structurelle | Le propriétaire décide la destruction de l'existence concernée dans son unité de validation |
| Descendants | Clôturer les descendants et restituer leurs portions de bas en haut, avant les contenants |
| Restitution | Chaque modification du contenant est imputée à son propriétaire encore présent ; l'ancêtre initiateur ne reçoit pas l'autorité des descendants |
| Cascade | Aucun hook, traitement applicatif ou message délivré pendant les étapes structurelles |
| Annulation de l'unité | Conserver composants, occurrences, propriétaires, parts, désignations, abonnements et réservations antérieurs ; retirer les différés de l'unité annulée sans réordonner les autres |
| Validation de la destruction | Clôturer l'occurrence et annuler ses délivrances en attente ; les callbacks tardifs ne sont pas admis |
| Après validation | Nettoyer physiquement les ressources instrumentées et appliquer les retraits préparés ; une erreur hôte ne révoque pas la fin logique |

Un nettoyage technique peut signaler un échec après la disparition du composant ; il n'exécute pas de réaction applicative d'un destinataire détruit. Aucun `onDetach()` applicatif n'est requis ou permis **pendant la cascade** par cette séquence.

---

## 5. Cascade de destruction

**Avant de supprimer ou remplacer l'élément d'un slot, le parent détruit le Composer concerné.** Cela lui rend le contenu attribué. Supprimer le slot puis scanner le DOM pour en déduire une destruction inverserait cette obligation. Une projection, un template ou un `reconcile()` doit respecter ce préalable ; un `MutationObserver` ne prouve pas l'existence logique ni la propriété.

Pour une View contenant un Composer qui contient une View, la fin part des descendants les plus profonds : leurs ressources prennent fin, leurs parts sont restituées aux propriétaires encore présents, puis les contenants prennent fin à leur tour. Le Composer restitue enfin le contenu du slot au parent ; celui-ci peut alors préparer le retrait de l'élément qu'il conserve. Le même ordre s'applique quand le parent entier est détruit.

Toutes ces étapes structurelles sont dans l'unité de validation et restent annulables ensemble, **sans hook applicatif ni délivrance pendant la cascade**. Le nettoyage physique irréversible vient après validation. Aucun rollback de support déjà changé par l'hôte ni restauration DOM après échec extérieur n'est promis.

L'existence ne se déduit donc ni de la connexion au document, ni de la présence du slot, ni de l'existence de listeners résiduels. Le runtime livré n'effectue aucune de ces cascades et laisse précisément des listeners après l'oubli de la View.

---

## 6. Cycle de vie -- machine a états

Le nom de section est conservé comme repère historique. Il n'impose pas la machine `idle → resolving → active → detaching → destroyed` précédemment proposée.

| Niveau | Lecture correcte |
| --- | --- |
| Code livré | `#state` passe à `active` après montage, à `idle` à l'oubli des références ; pas de destruction, de transaction ni de garde d'occurrence |
| Protocole cible (C.1) | Déclaré, en initialisation, prêt à consulter, publié, détruit ; disponibilité logique distincte de la matérialisation DOM |
| Destruction provisoire | Annulable avec la même occurrence, sans nouvelle création ; les admissions capturées attendent l'issue de l'unité |
| Destruction validée | Terminale pour cette occurrence ; aucune réactivation au retour d'un élément au même emplacement |

Chaque création réserve une **occurrence de vie non réutilisable**, distincte de l'emplacement ou du namespace. Callbacks, opérations et messages locaux visent cette occurrence ; sa validité est vérifiée avant admission et avant délivrance. Une notification capturée pendant une destruction provisoire est abandonnée si celle-ci est validée, admise après annulation sinon (C.2).

De même, les réservations d'Events portent sur les **occurrences d'abonnement présentes à l'émission**, dans leur ordre (C.6). Un abonnement créé ou recréé plus tard ne reprend aucun Event réservé à l'ancien. L'annulation d'une destruction conserve les réservations antérieures ; sa validation les annule sans réordonner les autres. Ni une même chaîne CSS, ni un même élément retrouvé, ni un même type de View ne remplacent ces contrôles.

**Choix API encore ouverts :** représentation des désignations et des attributions, déclarations de dépendances et de résultats instrumentés, cardinalité et rapprochement des résultats, composition imbriquée, instrumentation de validation/rollback et de nettoyage. Ces obligations ne prescrivent ici aucun constructeur, hook, getter ou type nouveau.

---

## Lecture suivante

-> [view.md](view.md) -- propriété de la part, projection et code Behavior
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- validation, occurrences, cascade et nettoyage
-> [Théorie](../../theorie.md) -- §2.5, annexe C, D11–D13 et §16.5–§16.7
