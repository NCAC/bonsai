# Composer -- Décideur de composition

> **Propriétaire du contenu attribué d'un slot et de l'existence de ses Views ; composition structurelle, jamais rendu de présentation supplémentaire**

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lot M6.2, 1er novembre 2026)** pour la décision, la réconciliation et les slots. Les séquences de cycle de vie des §4 à §6 sont les obligations de la théorie ; leur réalisation dans le noyau est signalée au §7. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

[<- Retour couche concrete](README.md) | [<- Foundation](foundation.md) | [-> View](view.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Composer |
| **Couche** | Concrète (éphémère) |
| **Paquet** | `@bonsai/composer` |
| **Référence normative** | [Théorie](../../theorie.md), §2.5, annexe C, D11, D12 et §16.5–§16.7 |
| **Décisions** | [ADR-18](../../adr/ADR-18-composer.md), [ADR-19](../../adr/ADR-19-root-element.md), [ADR-14](../../adr/ADR-14-contrats-types.md) |

## Table des matieres

1. [Rôle et propriété](#1-rôle-et-propriété)
2. [API](#2-api)
3. [Réconciliation et exécution](#3-réconciliation-et-exécution)
4. [Cycle de vie et attachement](#4-cycle-de-vie-et-attachement)
5. [Cascade de destruction](#5-cascade-de-destruction)
6. [Occurrences de vie](#6-occurrences-de-vie)
7. [Livré et limites](#7-livré-et-limites)

---

## 1. Rôle et propriété

Le Composer est un composant enfant d'une Foundation ou d'une View. **Une View n'est enfant que d'un Composer ; Foundation et View ne sont parents que de Composers** (D11). La Foundation ne crée donc pas directement de View dans le contrat cible.

Son parent lui attribue le **contenu** d'un slot, pas l'élément du slot lui-même. Cet élément reste au parent. Le Composer est propriétaire de ce contenu seulement **hors des parts qu'il attribue à ses Views**, et de l'existence de ces Views. Il ne lit pas les parts déjà attribuées, même si elles restent physiquement sous le même ancêtre DOM. Les parts attribuées ne se recouvrent pas ; la destruction d'une View restitue sa part au Composer.

**D12 corrige la lecture trop générale d'I35 « jamais d'écriture DOM ».** Le Composer ne modifie la structure que pour attribuer ou restituer les parts de ses Views, créer ou retirer les éléments correspondants. Il n'effectue aucun rendu de présentation supplémentaire et ne possède aucun état local indépendant de ce contenu et de ces existences. Il n'adresse aucune Command et, sans identité ni Channel propre, n'émet aucun message. Les décisions se recalculent à partir des messages reçus, des réponses aux Queries et des Views présentes.

Il n'admet aucune notification générale de l'hôte. En revanche, les **résultats instrumentés de ses propres effets de composition** sont permis (C.3) : leur contrat et leurs traitements locaux sont déclarés selon D16, bilans d'engagement compris. Cette admission n'ajoute ni source générale, ni handler arbitraire, ni état indépendant, ni droit de Command. Elle reste soumise à l'occurrence de vie et à la borne causale D9.

## 2. API

Livrée (`Composer<TComposerContract>`), identique pour un Composer enfant d'une Foundation ou d'une View. Le parent crée le Composer en lui attribuant un slot ; le Composer ne se crée jamais lui-même.

> Validée le 31 octobre 2026 (point S2 de la [relecture V0.9.4](../../rapports/relecture-V0.9.4-2026-10-30.md)) et **livrée au lot M6.2**, avec quatre choix : `resolve` sans l'Event déclencheur ; une entrée de `composers` pour exactement un slot ; une Foundation sans Channel en V1 ; aucun handler applicatif pour les résultats de composition.

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
    if (!ctx.query("auth:session", null).loggedIn) return [{ view: "login", key: "login" }];
    const route = ctx.query("router:currentRoute", null);       // { path, query, hash }
    const product = /^\/products\/(\w+)$/.exec(route.path);
    if (product) return [{ view: "product", key: `product:${product[1]}`, params: { productId: product[1] } }];
    return route.path === "/cart" ? [{ view: "cart", key: "cart" }] : [];
  }
}
```

| Règle | Ce que l'API garantit |
| --- | --- |
| D12, aucune Command | `TComposerFeatures` n'a pas de lane `triggers` ; `TComposeContext` n'offre que `query`. |
| D12, aucun état propre | `resolve` ne reçoit pas l'Event déclencheur : elle se recalcule à partir des seules Queries. Un même état du domaine donne une même composition, quel que soit l'ordre des Events qui y ont mené. Un champ mutable de sous-classe est un état indépendant, refusé en revue et par lint. |
| D11, T7 | Le tableau rendu donne les Views et leur ordre dans le slot. Le Composer crée pour chacune un élément et lui en attribue la part, sans recouvrement. |
| Ordre d'affichage | L'ordre du tableau rendu est l'ordre dans le slot. La réconciliation place chaque View explicitement, avant celle qui la suit dans le tableau ; elle ne se fie jamais à l'ordre historique des attributions. Sans cela, remplacer une View la déplacerait après ses voisines (constat du prototype, lot M4 : le noyau prend une position `before` à chaque attribution). |
| A3.d | `params` ne contient que des valeurs, typées par le contrat de la View visée. |
| T3, réconciliation | Même `key` et même View : instance conservée (optimisation). `params` différents : destruction puis recréation, car ce sont des paramètres de création. `key` absente : destruction, avec sa descendance. Les clés sont uniques dans une composition. |
| C.3, échec de création | Une View dont l'élément n'a pas pu être créé est détruite logiquement ; l'erreur est signalée avec son contexte causal (G7), sans nouvel essai ni handler applicatif. Le prochain Event déclaré relance `resolve` à partir de l'état du domaine. |
| Répétition | Une entrée de `composers` correspond à un seul slot ; une recherche qui ne trouve pas exactement un élément est refusée à l'exécution. N zones composées passent par N Views, chacune avec son slot ; une liste purement visuelle relève de la projection de la View. |

**Quand `resolve` est appelée.** Par Bonsai seulement, à deux moments : pendant l'initialisation du Composer, dans l'unité de validation de son créateur (au démarrage pour les Composers de la Foundation) ; puis pendant le traitement de chaque Event déclaré dans `listens`, qui forme sa propre unité de validation. Jamais au retour d'une Query, sur un fait de l'hôte, sur un résultat de composition, ni à la demande du code applicatif.

**Limite connue.** Deux Events successifs, par exemple `auth:sessionChanged` puis `router:routeChanged` lors d'une connexion suivie d'une redirection, donnent deux appels ; les effets de la première unité sont engagés avant la seconde délivrance (C.3). Une composition intermédiaire peut donc s'afficher brièvement. Elle correspond à un état validé du domaine. Un regroupement à la manière de D19, ou un Event unique émis par le domaine, sont des pistes hors V1.

---

## 3. Réconciliation et exécution

`resolve` est appelée par le framework, **jamais par le code applicatif** ni au retour d'une Query, d'un fait de l'hôte ou d'un résultat de composition. Elle reçoit `ctx = { query }` seulement.

| Étape | Comportement livré |
| --- | --- |
| Validation | Une clé dupliquée, ou une View hors du catalogue, fait échouer l'unité (aucune trace dans le slot, registre interne restauré, G7) |
| Conserver | Même `key`, même View, `params` égaux (comparaison indépendante de l'ordre des champs) |
| Détruire | `key` disparue, View différente ou `params` différents ; les descendants partent avec elle, de bas en haut |
| Créer | Nouvelle `key` : `create(description de la View, { params, part: { resource: slot, portion: key, before? } })` ; `before` est la clé de la prochaine View conservée, ce qui place chaque View explicitement (ordre du tableau) |
| Journal | La table interne des Views présentes est modifiée avec un `journal` d'annulation : un échec de l'unité la restaure |

La réapparition d'un élément DOM n'est **ni une création logique, ni une réactivation** : après destruction validée, une composition ultérieure crée une nouvelle occurrence, une nouvelle attribution et de nouvelles désignations.

## 4. Cycle de vie et attachement

Les séquences suivantes sont les **obligations de la théorie** ; le noyau les réalise (§7). Voir aussi le [cycle de vie commun](../2-architecture/lifecycle.md).

### 4.1 Sequence d'attachement (normative)

1. Le parent crée le Composer et lui fournit la désignation du contenu attribué. L'élément du slot reste au parent ; son contenu lui est soustrait.
2. La résolution contrôlée établit la référence structurelle après vérification de la propriété et de la validité de l'attribution. Aucun élément hôte n'est passé à l'enfant.
3. Pendant son initialisation autorisée, ou un traitement déclaré ultérieur, le Composer décide des Views ; il crée leur existence et leur attribue des parts disjointes, qu'il cesse alors de lire ou modifier directement.
4. Chaque View reçoit à sa création la désignation de sa part et réalise son initialisation sur ses propres ressources. Cette initialisation appartient à l'unité de validation du créateur, sans transfert d'autorité sur ces ressources. Les consultations respectent la disponibilité et la lecture seule.
5. Les validations portent sur l'unité complète, pas sur chaque opération intermédiaire. Les existences, abonnements, attributions, restitutions et messages différés sont provisoires jusqu'à sa réussite. Un échec les annule ensemble ; les créations abandonnées et leurs désignations ne sont pas publiées.
6. Les effets physiques préparés ne sont engagés **qu'après validation interne**, dans l'ordre de préparation, avant la délivrance différée suivante. Le démarrage ne publie aucune application partiellement démarrée.

Cette projection n'est pas une transaction hôte : les écritures peuvent réussir partiellement. Un échec synchrone d'engagement ferme la part visée et celles qui en descendent : les écritures suivantes qui les visent sont non tentées, les autres restent engagées ; les engagements précédents ne sont pas annulés. Les résultats capturés sont admis par de nouveaux messages vers l'occurrence vivante concernée, sans réentrance ni annonce anticipée de réussite. L'ordre des engagements ne garantit pas celui des achèvements asynchrones (C.3).

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

## 6. Occurrences de vie

Le nom de section est conservé comme repère historique. Il n'impose pas la machine `idle → resolving → active → detaching → destroyed` précédemment proposée.

| Niveau | Lecture correcte |
| --- | --- |
| Code livré | Les occurrences de vie, la destruction provisoire et leur annulation sont assurées par le noyau (lot M3) ; le Composer n'a pas d'état propre |
| Protocole cible (C.1) | Déclaré, en initialisation, prêt à consulter, publié, détruit ; disponibilité logique distincte de la matérialisation DOM |
| Destruction provisoire | Annulable avec la même occurrence, sans nouvelle création ; les admissions capturées attendent l'issue de l'unité |
| Destruction validée | Terminale pour cette occurrence ; aucune réactivation au retour d'un élément au même emplacement |

Chaque création réserve une **occurrence de vie non réutilisable**, distincte de l'emplacement ou du namespace. Callbacks, opérations et messages locaux visent cette occurrence ; sa validité est vérifiée avant admission et avant délivrance. Une notification capturée pendant une destruction provisoire est abandonnée si celle-ci est validée, admise après annulation sinon (C.2).

De même, les réservations d'Events portent sur les **occurrences d'abonnement présentes à l'émission**, dans leur ordre (C.6). Un abonnement créé ou recréé plus tard ne reprend aucun Event réservé à l'ancien. L'annulation d'une destruction conserve les réservations antérieures ; sa validation les annule sans réordonner les autres. Ni une même chaîne CSS, ni un même élément retrouvé, ni un même type de View ne remplacent ces contrôles.

**Choix API encore ouverts :** représentation des désignations et des attributions, déclarations de dépendances et de résultats instrumentés, cardinalité et rapprochement des résultats, composition imbriquée, instrumentation de validation/rollback et de nettoyage. Ces obligations ne prescrivent ici aucun constructeur, hook, getter ou type nouveau.

---

## 7. Livré et limites

| Sujet | État |
| --- | --- |
| `Composer<TComposerContract>` : `features`, `views`, `resolve(ctx)`, composition `{ view, key, params? }` | Livré |
| Réconciliation par clé, ordre explicite, annulation avec l'unité | Livré (tests `tests/unit/domain/composer.test.ts`) |
| Exécution à l'initialisation et sur chaque Event déclaré | Livré |
| Composition imbriquée (View → Composer → View) | Livré |
| Création des parts, restitutions, destruction en cascade, occurrences de vie | Fournis par le noyau (lots M3–M4) |
| Destruction logique d'une View dont l'élément n'a pas pu être créé | **Non livré** : l'échec est rapporté dans la trace (C.3) |
| Typage des `params` de composition par le contrat de la View visée | Non livré : `Readonly<Record<string, unknown>>` |
| Hooks applicatifs de cycle de vie (`onDetach`, etc.) | Supprimés ; absents par décision (§4.2) |
| `TResolveResult`, `TComposerOptions`, `attach()`, `performResolve()`, `rootElement` | Supprimés |

---

## Lecture suivante

-> [view.md](view.md) -- propriété de la part, projection et handlers
-> [foundation.md](foundation.md) -- racine de composition
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- validation, occurrences, cascade et nettoyage
-> [Théorie](../../theorie.md) -- §2.5, annexe C, D11–D13 et §16.5–§16.7
