# Réflexion — Composition Dynamique Hétérogène

> **Date** : 2026-03-30
> **Mis à jour** : 2026-03-31
> **Origine** : [reflexion-2026-03-30.md](reflexion-2026-03-30.md) — Partie II
> **Statut** : 🟡 Réflexion en cours — pré-ADR — **direction stabilisée**
>
> **Constat fondateur** : l'architecture Bonsai actuelle est conçue pour des applications
> où la structure UI est connue au compile-time. Les slots sont statiques (`get composers()`
> déclaré dans la classe). Or, les applications réelles — CMS, back-offices, dashboards
> configurables — ont une structure UI déterminée au **runtime**.
>
> Ce document explore le problème, établit une hiérarchie des invariants, et pose
> les bases d'une direction architecturale.
>
> **Direction retenue** : le scope de responsabilité de View est **clos** (aucune nouvelle
> capacité). C'est le **Composer** qui est révisé pour porter la composition dynamique
> hétérogène via `resolve()` étendu (retour `TResolveResult | TResolveResult[] | null`),
> en s'appuyant sur la lecture DOM de son scope (`rootElement: Element | string`) et les
> informations décisionnelles des Channels.

---

## Table des matières

1. [Le problème](#1-le-problème)
2. [Cas concrets](#2-cas-concrets)
3. [Hiérarchie des invariants](#3-hiérarchie-des-invariants--ce-qui-est-négociable-et-ce-qui-ne-lest-pas)
4. [Invariant découvert : immutabilité du scope Composer](#4-invariant-découvert--limmutabilité-du-scope-composer)
5. [Approche explorée puis écartée : `async get composers()`](#5-approche-explorée-puis-écartée--async-get-composers)
6. [Direction retenue : View close, Composer révisé](#6-direction-retenue--view-close-composer-révisé)
7. [Le Composer révisé en détail](#7-le-composer-révisé-en-détail)
8. [Comment le Composer découvre-t-il les points de montage ?](#8-comment-le-composer-découvre-t-il-les-points-de-montage-)
9. [Lien avec le mode ESM modulaire](#9-lien-avec-le-mode-esm-modulaire)
10. [Questions ouvertes](#10-questions-ouvertes)
11. [Prochaines étapes](#11-prochaines-étapes)

---

## 1. Le problème

### 1.1 Énoncé

L'invariant I37 pose : *« Un Composer gère toujours 0 ou 1 View dans un slot »* et les slots sont déclarés statiquement via `get composers()` dans la View. Combiné avec D24 (*pas de CollectionComposer*), le modèle actuel ne gère que :

- **Slots statiques** : nombre et position connus au compile-time
- **Listes homogènes** : via ProjectionList + event delegation (ADR-0008)

Il ne couvre **pas** le cas de la **composition dynamique hétérogène** : un nombre inconnu de Views de types différents, déterminés au runtime.

### 1.2 Pourquoi ProjectionList ne répond pas

ProjectionList (ADR-0008, D24) résout le problème des **listes d'items homogènes** — le même template appliqué à N données. Le problème posé ici est fondamentalement différent :

| Aspect | ProjectionList (ADR-0008, D24) | Composition dynamique hétérogène |
|--------|-------------------------------|----------------------------------|
| **Nature des enfants** | Homogènes (même template × N données) | Hétérogènes (types radicalement différents) |
| **Itération** | Oui (boucle sur une collection) | Non (chaque enfant est unique) |
| **Besoin de View enfant** | Pas forcément (event delegation) | Oui — chaque enfant complexe est une View à part entière |
| **Connu au build** | La structure oui, les données non | Ni la structure ni les types |

### 1.3 Pourquoi les autres patterns ne répondent pas

- ❌ **Slots statiques** (`get composers()`) — on ne connaît pas les slots au compile-time
- ❌ **Behavior** — un WYSIWYG, un MediaPicker, un éditeur Paragraphs sont trop complexes pour un Behavior ; ce sont de vraies Views avec lifecycle, TUIMap, Channels, Behaviors propres
- ❌ **Giant View** — mettre toute la logique dans une seule View est un anti-pattern reconnu
- ❌ **`addSlot()` dans View** — cela donnerait un rôle de composition à View → viole I36

---

## 2. Cas concrets

### 2.1 Formulaire CMS dynamique (Drupal) — cas déclencheur

Back-office Drupal 10 : un module `node` expose `NodeEditFormView`. Selon le bundle de contenu (Article, Page, Événement…), le formulaire contient des champs différents. Certains sont triviaux (input texte), d'autres nécessitent une View complète.

```
NodeEditFormView
  ├── field_title        → simple input (template suffit)
  ├── field_body         → EditorJSView (View complète — WYSIWYG)
  ├── field_image        → MediaPickerView (View complète — upload, crop, alt)
  ├── field_tags         → simple select (template suffit)
  ├── field_paragraphs   → ParagraphsView (View complète — nested, drag-and-drop)
  └── ...                → inconnu au compile-time
```

**Contraintes spécifiques** :

- Le backend **sait exactement** quels champs doivent être affichés (et quelles Views il faudrait instancier)
- La source peut être un `<script type="application/json">`, un endpoint API, ou le HTML SSR avec des marqueurs DOM
- En mode Drupal legacy, tout est rendu en SSR : Bonsai **enrichit** des éléments DOM déjà présents
- La logique cache/montre est définie dans la config du formulaire côté back-office, pas côté JS

### 2.2 Dashboard configurable (widgets)

Un dashboard où l'utilisateur choisit quels widgets afficher (graphique, tableau, calendrier, carte…). Chaque widget est une View complète. Le layout est stocké en base, pas connu au compile-time.

```
DashboardView
  ├── ChartView        (configuré par l'utilisateur)
  ├── TableView        (configuré par l'utilisateur)
  ├── CalendarView     (ajouté par un plugin)
  └── ???              (dépend de la config user)
```

### 2.3 Page/Layout Builder

Drupal Layout Builder, WordPress Gutenberg, tout CMS qui permet de composer des pages à partir de **blocs**. Chaque type de bloc a sa propre View. La page est définie par un éditeur, pas par le code.

```
PageView
  ├── HeroBannerView       (bloc "Hero")
  ├── RichTextView         (bloc "Texte")
  ├── MediaGalleryView     (bloc "Galerie")
  ├── FormView             (bloc "Contact")
  └── ???                  (nouveau bloc ajouté par un module tiers)
```

### 2.4 IDE-like / Panneaux extensibles

Un back-office avec des panneaux (sidebar, inspecteur, toolbar) dont le contenu dépend du contexte et des modules installés.

```
WorkspaceView
  ├── FileTreeView         (module core)
  ├── SearchPanelView      (module core)
  ├── GitPanelView         (module git — optionnel)
  ├── AIAssistantView      (module IA — optionnel)
  └── ???                  (extension tierce)
```

### 2.5 Configurateur produit (e-commerce)

Un produit configurable dont les options dépendent du type de produit. Un T-shirt a { taille, couleur }, une cuisine équipée a { dimensions, matériaux, plan 3D, configurateur visuel }. Le configurateur visuel est une View complexe.

### 2.6 Dénominateur commun

Tous ces cas partagent **3 propriétés** :

| Propriété | Description |
|-----------|-------------|
| **Hétérogénéité** | Les enfants sont de types radicalement différents (pas une liste d'items) |
| **Indétermination au build** | Le nombre et le type des enfants dépendent d'une source runtime (config, API, HTML serveur, permissions) |
| **Complexité des enfants** | Certains enfants sont trop complexes pour un Behavior — ce sont de vraies Views avec leur propre lifecycle, TUIMap, Channels, voire Behaviors |

---

## 3. Hiérarchie des invariants — ce qui est négociable et ce qui ne l'est pas

La discussion révèle que tous les invariants n'ont pas le même poids. On établit une hiérarchie explicite :

| Priorité | Invariant | Énoncé | Pourquoi non-négociable / négociable |
|----------|-----------|--------|--------------------------------------|
| 🔴 **Absolue** | **I36 — View ne compose jamais** | View déclare des limites de scope, mais ne décide jamais quoi y mettre | Si View compose, on retombe dans les God Views / Marionette LayoutView. C'est le pilier de la séparation des responsabilités. |
| 🔴 **Absolue** | **I35 — Composer = décideur pur** | Aucune écriture DOM | Le Composer est un cerveau, pas des mains. |
| 🟡 **Négociable** | **I37 — Composer gère 0/1 View** | Un Composer, un slot, 0 ou 1 View | C'est un choix de simplification, pas un pilier structurel. Il peut être assoupli sans détruire l'architecture. |

### 3.1 Précision cruciale sur I36 — « View ne compose jamais »

Il faut distinguer **rendre** et **composer** :

- **Rendre** = produire du markup à partir de données. La View rend un template qui *se trouve contenir* des éléments DOM. Ce n'est pas de la composition, c'est du rendu.
- **Composer** = décider quelle View instancier et où. C'est le monopole du Composer.

Une View qui rend `<div data-field="body"></div>` ne « compose » pas : elle ne sait pas que cet élément deviendra un point de montage. C'est le Composer qui **donne le sens** de slot à un élément DOM. La View reste aveugle.

> **Invariant renforcé** : il n'y a **aucune relation organique parent-enfant entre Views**. Qu'une View contienne visuellement une autre View est un accident du DOM, pas une relation architecturale.

### 3.2 Pourquoi I37 est négociable

I37 a été posé par D24 comme simplification. La motivation était d'éviter un `CollectionComposer` (un Composer spécialisé pour les listes). Mais le problème posé ici n'est pas une liste — c'est un **conteneur hétérogène dynamique**. Assouplir I37 ne réintroduit pas CollectionComposer.

L'invariant plus important — celui qu'on tient vraiment à protéger — est que **View n'a aucune responsabilité de composition** (I36). Tant que ce principe tient, le fait qu'un Composer gère 1 ou N Views est une question de mécanisme, pas de principe.

---

## 4. Invariant découvert — l'immutabilité du scope Composer

### 4.1 Question posée

Est-ce qu'il y a des cas concrets où le scope d'un Composer serait amené à changer ?

### 4.2 Inventaire exhaustif des scénarios

| Scénario | Que se passe-t-il ? | Le scope change-t-il ? |
|----------|---------------------|------------------------|
| **Route change** | Le Composer résout une View différente | ❌ — le contenu change, pas le scope |
| **Slot supprimé** (projection parent) | La View conteneur retire l'élément du DOM | ❌ — le scope n'a pas « bougé », il a **cessé d'exister**. Le Composer détache proprement ses Views. |
| **Slot restauré** | L'élément réapparaît dans le DOM | ❌ — c'est le même élément au même endroit. Le Composer re-résout. |
| **Layout responsive** | CSS repositionne visuellement | ❌ — l'élément DOM est le même |
| **Drag-and-drop de panneaux** | Un panneau est déplacé dans le DOM | ❌ — c'est une destruction + re-création. L'ancien Composer meurt, un nouveau naît. |
| **View conteneur re-rend** | Le template est reprojeté | ❌ — soit le slot survit (mutation chirurgicale PDR), soit il est détruit/recréé (cycle complet). Pas de « migration » de scope. |
| **Formulaire dynamique Drupal** | Des champs apparaissent/disparaissent | ❌ — le scope du Composer (le `<form>`) reste le même. Ce sont les **points de montage internes** qui apparaissent/disparaissent. |

### 4.3 Conclusion — invariant candidat

**Le scope d'un Composer ne change jamais.** Il y a exactement 3 états possibles :

```
assigné → vivant   (scope existe, Composer travaille)
         → suspendu (scope retiré du DOM, Views détachées proprement)
         → détruit  (Composer libéré, irréversible)
```

Il n'existe pas de scénario « le Composer migre vers un autre élément DOM ». C'est toujours soit le même scope, soit la mort.

### 4.4 Propriétés dérivées

| Propriété | Statut |
|-----------|--------|
| Le scope est **immutable** — assigné une fois, jamais déplacé | ✅ Invariant candidat |
| Le Composer **ne crée pas** son scope — il le reçoit | ✅ Invariant (cohérent avec I35) |
| La **View** contrôle l'existence du slot (ajout/retrait DOM) | ✅ Cohérent avec I36 (View ne compose pas, elle rend du markup) |
| Le Composer **réagit** à l'apparition/disparition de points de montage **dans** son scope | 🆕 C'est la capacité nouvelle nécessaire pour le pattern dynamique |
| La disparition du scope = **cleanup total** des Views gérées | ✅ Mécanique, pas décisionnel |

### 4.5 Intégrité DOM du slot Composer — garde-fous

Le scope Composer est immutable (§4.3) mais cela ne suffit pas. Il faut poser une
règle plus forte : **le sous-arbre d'un élément enregistré comme slot de Composer
est un domaine exclu pour la View déclarante**. La View peut conserver ou détruire
l'élément slot, mais elle ne peut **jamais modifier la structure interne** de ce
sous-arbre, car celui-ci appartient au Composer et aux Views qu'il gère.

> **Règle d'intégrité DOM du slot Composer** :
> Le domaine DOM d'un slot Composer est soit **existant** (intact, le Composer y
> travaille), soit **détruit** (l'élément a été retiré du DOM, le Composer fait son
> cleanup), mais **jamais modifié structurellement** par la View qui a déclaré le slot.

Cette règle est une extension logique de I40 (scope DOM exclusif) et de I36 (View ne
compose jamais). Elle se décline en **deux garde-fous mécaniques** :

#### Garde-fou 1 — Exclusivité clé `composers` / clé `templates` (Mode C)

Une clé `@ui` déclarée dans `get composers()` **ne peut pas** être consommée
simultanément dans `get templates()` en Mode C (island-render / îlots). Les deux
usages s'excluent mutuellement :

- **Clé Composer** : l'élément DOM est un **trou** dans le scope View — le Composer
  en est le propriétaire exclusif, la View n'a aucune autorité sur son contenu
- **Clé template (îlot)** : l'élément DOM est une **zone de projection** — le template
  en est le propriétaire exclusif, il remplace le contenu à chaque `project()`

Ces deux sémantiques sont incompatibles. Si la View projette un template dans un
élément que le Composer considère comme son scope, le template écraserait le travail
du Composer à chaque re-projection.

```typescript
// ❌ INTERDIT — même clé dans composers ET templates (Mode C)
class BadView extends View {
  get uiElements() {
    return {
      sidebar: '#sidebar',
      content: '#content',
      total:   '.Cart-total',
    };
  }

  get composers() {
    return {
      sidebar: SidebarComposer,  // sidebar = slot Composer
    };
  }

  get templates() {
    return {
      sidebar: {                          // ❌ sidebar = aussi island-render
        template: SidebarTemplate,        // → conflit : le template projette dans le slot du Composer
        select: (d) => d.layout?.sidebar,
      },
      content: {                          // ✅ content n'est pas un slot Composer
        template: ContentTemplate,
        select: (d) => d.page?.content,
      },
    };
  }
}

// ✅ CORRECT — clés disjointes
class GoodView extends View {
  get uiElements() {
    return {
      sidebar: '#sidebar',
      content: '#content',
      total:   '.Cart-total',
    };
  }

  get composers() {
    return {
      sidebar: SidebarComposer,  // sidebar = slot Composer → exclu du rendu View
    };
  }

  get templates() {
    return {
      content: {                 // ✅ content ≠ sidebar
        template: ContentTemplate,
        select: (d) => d.page?.content,
      },
    };
  }
  // 'total' est en Mode A (N1) → getUI('total').text(val) — pas de conflit
  // 'sidebar' n'apparaît ni dans templates ni dans getUI() — c'est le domaine du Composer
}
```

**Vérification** : cette règle est vérifiable statiquement au niveau du type system :

```typescript
// Contrainte type-level : les clés de composers et de templates (Mode C) sont disjointes
type TViewTemplatesModeC<TUI extends TUIMap<any>, TComposerKeys extends string> = {
  [K in Exclude<keyof TUI & string, TComposerKeys>]?: TViewTemplateBinding;
};
// Si un développeur tente d'ajouter une clé Composer dans templates → erreur TS
```

#### Garde-fou 2 — Mode root (Mode B) : destruction autorisée, modification structurelle interdite

En Mode B (`{ root: template }`), le template possède `this.el` entier et peut
re-projeter l'intégralité du sous-arbre. Si un enfant de `this.el` est un slot
Composer, le template a le droit de le **détruire** (l'élément disparaît du DOM →
le framework détecte la disparition → cleanup Composer → `onDetach()` sur toutes
les Views gérées). Mais il **n'a pas le droit** de modifier la structure interne
du slot tant que celui-ci est vivant.

| Action du template root sur un slot Composer | Autorisé ? | Raison |
|----------------------------------------------|-----------|--------|
| **Conserver** l'élément slot tel quel | ✅ | Le Composer continue de travailler dedans |
| **Détruire** l'élément slot (ne pas le re-créer dans la projection) | ✅ | Lifecycle normal : le Composer détache ses Views et meurt |
| **Ajouter** des enfants à l'intérieur du slot | ❌ | Le contenu du slot est le domaine du Composer |
| **Retirer** des enfants à l'intérieur du slot | ❌ | Idem — le Composer décide seul de ses Views |
| **Réordonner** les enfants à l'intérieur du slot | ❌ | Idem |
| **Modifier les attributs** de l'élément slot lui-même | ✅ | L'élément slot reste dans le scope View (I40 : « N1 ») |

> **Invariant** : le mode root **saute** les sous-arbres des slots Composer pendant
> la projection. Le slot est une « île protégée » dans le flux de re-render.

```typescript
// Mode B (root) avec un slot Composer
class DashboardView extends View {
  get composers() {
    return {
      widgetArea: WidgetComposer,   // <div id="widget-area"> = slot Composer
    };
  }

  get templates() {
    return {
      root: {
        template: DashboardTemplate,
        // Le template re-projette tout this.el
        // MAIS le framework protège #widget-area :
        //   - L'élément slot est conservé tel quel pendant project()
        //   - Ses enfants (Views du Composer) ne sont pas touchés
        //   - Si le template ne produit pas #widget-area → destruction propre
      }
    };
  }
}
```

**Mécanisme framework** : lors du `project()` en Mode B, le framework :
1. Identifie les éléments slot déclarés dans `get composers()` et vivants dans le DOM
2. Les **extrait temporairement** du flux de diff/projection (ou les marque comme intouchables)
3. Projette le reste du sous-arbre normalement
4. **Réinsère** les slots survivants à leur position dans le résultat projeté
5. Les slots **absents** du résultat projeté → cleanup Composer propre

Ce mécanisme de « slot protégé » est comparable au concept de « portals » dans
d'autres frameworks (React, Vue), mais **inversé** : ici c'est le parent qui protège
un trou dans son rendu, pas l'enfant qui projette ailleurs.

#### Synthèse des deux garde-fous

| Mode de rendu | Garde-fou | Vérification |
|--------------|-----------|---------------|
| **Mode A** (null) | Pas de template → pas de conflit. `getUI()` sur clé Composer → **interdit** (I40). | Compile-time (I40) |
| **Mode C** (îlots) | `keyof templates ∩ keyof composers = ∅` | **Compile-time** (type system) |
| **Mode B** (root) | Le template saute les sous-arbres des slots Composer vivants | **Runtime** (framework, post-projection) |

> **Invariant candidat** : le domaine DOM d'un slot Composer est un domaine exclu
> de tout mécanisme de rendu de la View déclarante. Destruction de l'élément slot :
> autorisée. Modification structurelle de ses enfants : interdite.

---

## 5. Approche explorée puis écartée : `async get composers()`

### 5.1 L'idée

Une première piste a été explorée : rendre `get composers()` de la View asynchrone,
permettant à la View de faire un `request()` sur son Channel pour obtenir la liste
des champs, puis de construire dynamiquement la map `{ slot → Composer }` :

```typescript
// ❌ Approche explorée puis écartée
class NodeEditFormView extends View {
  async get composers() {
    const fields = await this.request('nodeEditForm', 'fields');
    // La View construit la map slot → Composer à partir des données Feature
    const composersMap = {};
    for (const field of fields) {
      composersMap[`field_${field.name}`] = resolveComposerForType(field.type);
    }
    return composersMap;
  }
}
```

### 5.2 Avantages

- ✅ **I37 préservé** — chaque Composer dans la map reste 1:1 (0 ou 1 View)
- ✅ **I35 préservé** — le Composer n'a pas besoin de lire le DOM
- ✅ **D24 préservé** — pas de CollectionComposer, ce sont N Composers classiques

### 5.3 Pourquoi cette approche est écartée

| Problème | Détail |
|----------|--------|
| **I36 en tension** | La View **décide** quel Composer va dans quel slot. Même si les données viennent de la Feature, c'est la View qui fait le mapping `type → Composer`. C'est une décision de composition déguisée. |
| **View comme passe-plat** | Si la Feature retourne directement la map de Composers, la View ne fait que transmettre — *wrong level of abstraction*. Pourquoi est-ce la View qui porte cette logique ? |
| **Bootstrap async** | `get composers()` async change fondamentalement le flow du bootstrap (ADR-0010). En SPA, problème d'œuf et de poule : les clés `composers` doivent correspondre à des entrées `uiElements`, qui doivent matcher des éléments DOM, qui n'existent qu'après le rendu. |
| **View devient data-aware** | La View fait un `request()` → elle acquiert une connaissance du domaine. Cela va à l'encontre du principe « View rend, ne raisonne pas ». |

### 5.4 Enseignement

Cette exploration a confirmé que le bon porteur de la composition dynamique n'est pas la View.
Le Composer est le seul acteur qui a **les deux** : l'information décisionnelle (via Channel)
et l'accès au scope (via son élément assigné).

---

## 6. Direction retenue : View close, Composer révisé

### 6.1 Position architecturale

> **Le scope de responsabilité de View est clos.** Aucune nouvelle capacité ne sera
> ajoutée à View. Si un composant doit évoluer pour porter la composition dynamique,
> c'est le Composer — qui a aujourd'hui des capacités « faibles » par rapport aux
> autres composants du framework.

| Composant | Capacités actuelles | Évolution |
|-----------|--------------------|-----------|
| **View** | Rend, déclare des limites de scope, TUIEvents, TUIMap, Behaviors | ❄️ **Fermée** — aucune nouvelle capacité |
| **Composer** | `resolve()` → 0/1 View, Channel (listen, request) | 🔓 **Ouvert à révision** |

### 6.2 Justification

Le Composer est le composant le moins spécifié du framework. Sa raison d'être est
la **décision de composition**. Si un composant doit évoluer pour porter la
composition dynamique hétérogène, c'est lui — pas la View qui est déjà un composant
riche et bien cerné.

### 6.3 Le fait établi : la couche abstraite est prête avant la couche concrète

Le timing n'est pas un problème. Grâce à l'ordre de bootstrap (ADR-0010) :

```
Phase 1-4 : Config → Radio/Channels → Entities → Features
            ══════════════════════════════════════════════
            La Feature SAIT déjà quels champs, quels types.
            L'Entity contient la structure.
            Les Channels sont câblés.

Phase 5-6 : Composers → Views
            ═════════════════
            Le Composer démarre avec TOUTE l'info disponible
            via request() sur les Channels.
```

Le Composer n'a pas besoin d'attendre quoi que ce soit. Au moment où il est instancié,
la Feature a déjà les données (endpoint API, `<script type="application/json">`, config serveur).

---

## 7. Le Composer révisé en détail

### 7.1 Ce que le Composer gagne

```
Avant (I35+I37 stricts)               Après (I35 nuancé, I37 révisé)
───────────────────────               ──────────────────────────────
scope: 1 élément DOM                  scope: 1 élément DOM (inchangé, immutable)
resolve() → TResolveResult | null     resolve() → TResolveResult | TResolveResult[] | null
rootElement: résolu par le framework   rootElement: résolu par le Composer (Element | string)
Channel: listen, request              Channel: listen, request (inchangé)
DOM: aucun accès                      DOM: lecture seule sur son scope (querySelector, getAttribute)
lifecycle: 0/1 View                   lifecycle: 0/N Views
```

**Point clé — `resolve()` unifié** : pas de `resolveAll()` distinct. La méthode `resolve()`
existante accepte un type de retour élargi (tableau en plus du résultat unique). Un Composer
simple retourne `TResolveResult | null` comme avant. Un Composer dynamique retourne un
tableau. Le framework traite les deux uniformément.

**Point clé — le Composer résout le `rootElement`** : conséquence directe de I35 nuancé.
Puisque le Composer peut lire le DOM, c'est **lui** qui fait `querySelector` dans son scope
pour trouver l'élément cible — pas le framework. Le framework se contente de **vérifier**
que l'élément est dans le scope (`slot.contains(el)`) et de l'attacher à la View.

### 7.2 Ce que le Composer ne gagne PAS

- ❌ **Pas de TUIEvents** — monopole View/Behavior
- ❌ **Pas d'écriture DOM** — il ne crée pas de `<div>`, il ne mute pas d'attributs
- ❌ **Pas de template** — il ne rend rien
- ❌ **Pas de state** — ni Entity, ni localState
- ❌ **Pas de `trigger()`/`emit()`** — il ne produit pas d'événements vers les Channels

### 7.3 Découverte par le DOM — attributs conventionnels

Le rendu SSR (ou le template SPA) **doit** rendre des éléments avec des attributs DOM
reconnaissables. Deux informations sont nécessaires par point de montage :

| Attribut | Rôle | Exemple |
|----------|------|---------|
| `data-field-type` | Dit **quelle View** instancier | `data-field-type="wysiwyg"` |
| `data-field-id` | Identifie **précisément** l'élément DOM | `data-field-id="field_body"` |

Ces attributs peuvent aussi être des attributs déjà présents dans le markup existant
(ex: Drupal fournit déjà `data-drupal-selector="edit-field-description-page-0-value"`).

Exemple concret — rendu SSR Drupal :

```html
<form class="node-form">
  <div data-field-type="string"     data-field-id="field_title">...</div>
  <div data-field-type="wysiwyg"    data-field-id="field_body">...</div>
  <div data-field-type="media"      data-field-id="field_image">...</div>
  <div data-field-type="paragraphs" data-field-id="field_paragraphs">...</div>
</form>
```

Tout est déjà là dans le DOM : le **type** dit « quelle View » et l'**élément** dit « où ».

### 7.4 `TResolveResult` révisé — `rootElement` comme champ dédié

Le `rootElement` sort de `options` pour devenir un champ dédié de `TResolveResult`.
Cela reflète le fait que c'est le **Composer** qui résout l'élément (I35 nuancé), pas
le framework.

```typescript
/**
 * Type de retour de resolve().
 *
 * Évolution par rapport à la version initiale :
 * - rootElement est un champ dédié (pas dans options)
 * - rootElement accepte Element (résolu par le Composer) ou string (résolu par le framework)
 */
type TResolveResult<V extends typeof View = typeof View> = {
  view: V;
  rootElement: Element | string;
  //  Element → le Composer a trouvé l'élément dans son scope (SSR, CDH)
  //            le framework vérifie slot.contains(el), puis view.el = el
  //  string  → sélecteur, le framework résout via slot.querySelector() + D30 si absent (SPA)
  options?: Partial<ExtractViewParams<V>>;  // autres params passés à la View (D34)
};
```

### 7.5 Qui résout le `rootElement` ? — évolution du rôle Composer vs framework

Historiquement (I35 strict : « aucun accès DOM »), le Composer ne pouvait pas toucher
au DOM. Le framework devait faire le `querySelector` dans le slot pour résoudre le
`rootElement` string déclaré par la View.

Maintenant que I35 est nuancé (lecture autorisée), **le Composer est mieux placé** pour
résoudre le `rootElement` car :

- Il est dans la **couche concrète** — il connaît le DOM
- Il fait déjà un `querySelectorAll` pour découvrir les points de montage (cas N Views)
- Même pour le cas 1 View, c'est plus cohérent qu'il fasse la résolution lui-même

| Responsabilité | Avant (I35 strict) | Après (I35 nuancé) |
|---------------|-------------------|-------------------|
| **Résoudre l'élément DOM** | Framework (`querySelector`) | **Composer** (Element) ou framework (string, D30) |
| **Créer l'élément si absent (D30)** | Framework (`create()`) | **Framework** — inchangé (le Composer ne crée jamais, I35) |
| **Vérifier que l'élément est dans le scope** | Implicite (querySelector sur le slot) | **Framework** — validation défensive (`slot.contains(el)`) |
| **Attacher la View sur l'élément** | Framework (`view.el = el`, câblage, `onAttach()`) | **Framework** — inchangé |
| **Détacher la View** | Framework | **Framework** — inchangé |
| **Diff resolve précédent vs actuel** | Framework | **Framework** — inchangé |

### 7.6 Le flow concret — Composer N Views (CDH)

```typescript
class NodeEditFormComposer extends Composer {
  static readonly listen = [NodeEditForm.channel] as const;
  static readonly request = [NodeEditForm.channel] as const;

  resolve(): TResolveResult[] | null {
    // 1. Scanner le scope — lecture DOM (I35 nuancé : lecture seule)
    const mountPoints = this.slot.querySelectorAll('[data-field-type]');
    if (mountPoints.length === 0) return null;

    // 2. Pour chaque point de montage, résoudre View + élément
    const results: TResolveResult[] = [];

    for (const el of mountPoints) {
      const fieldType = el.getAttribute('data-field-type');
      const fieldId = el.getAttribute('data-field-id');

      // 3. Résoudre type → View
      //    Map locale dans le Composer (QO-CDH-4 stabilisé).
      //    Le développeur connaît ses imports au compile-time.
      const viewClass = this.resolveViewForFieldType(fieldType);

      if (viewClass) {
        results.push({
          view: viewClass,
          rootElement: el,     // ← Element résolu par le Composer
          options: {
            fieldId: fieldId,  // ← paramètre passé à la View
            // ...autres params obtenus via request() sur le Channel
          }
        });
      }
      // Si null → champ simple, pas de View (le DOM SSR suffit)
    }

    return results;
  }

  // Réaction à un Event (ex: structure de champs modifiée)
  onNodeEditFormFieldsChangedEvent(): void {
    // Le framework re-appelle resolve() automatiquement,
    // diff avec l'état précédent,
    // detach les Views obsolètes, attach les nouvelles.
  }
}
```

### 7.7 Le flow concret — Composer 1 View (cas simple, inchangé sauf résolution)

```typescript
// Avant : le Composer passait un sélecteur string → le framework résolvait
// Après : le Composer peut aussi résoudre l'élément lui-même

// Option A — résolution par le Composer (Element)
class FooterComposer extends Composer {
  resolve(): TResolveResult | null {
    const el = this.slot.querySelector('.footer');
    if (!el) return null;
    return { view: FooterView, rootElement: el };
  }
}

// Option B — résolution par le framework (string) — rétrocompatible, D30
class FooterComposer extends Composer {
  resolve(): TResolveResult | null {
    return { view: FooterView, rootElement: '.footer' };
    // Le framework fait slot.querySelector('.footer')
    // Si absent + descripteur objet → framework crée l'élément (D30)
  }
}
```

Les deux fonctionnent. Le cas `Element` est naturel pour la CDH (les éléments existent
déjà). Le cas `string` reste pour la rétrocompatibilité et le mode SPA pur (D30).

### 7.8 Côté View — inchangée, aveugle

```typescript
// La View est PARFAITEMENT AVEUGLE
// Elle ne sait pas si elle est seule ou parmi 15 autres.
// Elle a juste son rootElement et ses paramètres.
class EditorJSView extends View {
  // Reçoit rootElement (déjà résolu par le Composer) et fieldId via les params (D34)
  // Ne sait pas qu'elle est dans un formulaire
  // Ne sait pas qu'elle cohabite avec d'autres Views
  // C'est juste un éditeur WYSIWYG monté sur un rootElement
}
```

### 7.9 Synthèse — le modèle complet

```
┌─────────────────────────────────────────────────────────────┐
│                    COUCHE ABSTRAITE                          │
│                                                             │
│  NodeEditFormFeature                                        │
│    → Entity: { fields: Map<fieldId, TFieldDescriptor> }     │
│    → Channel: répond à request("fields")                    │
│    → Source: endpoint API, <script data/application>, SSR   │
│                                                             │
│  Mécanisme de résolution type → View (map locale Composer) :  │
│    → "wysiwyg"    → EditorJSView                            │
│    → "media"      → MediaPickerView                         │
│    → "paragraphs" → ParagraphsView                          │
│    → "string"     → null (pas de View, template suffit)     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    COUCHE CONCRÈTE                           │
│                                                             │
│  NodeEditFormView  ❄️ (close, pas de nouvelle capacité)     │
│    → Rend le template (ou adopte le DOM SSR)                │
│    → Déclare UNE limite de scope (le formulaire)            │
│    → Ne sait rien des champs                                │
│                                                             │
│  NodeEditFormComposer  🔓 (révisé)                          │
│    → Scope: l'élément du formulaire (immutable)             │
│    → resolve(): scanne [data-field-type] dans le scope      │
│    → Croise type → View via mécanisme de résolution         │
│    → Passe rootElement + params à chaque View résolue       │
│    → Réagit aux Events pour re-résoudre (delta)             │
│                                                             │
│  EditorJSView, MediaPickerView, ParagraphsView...           │
│    → Chacune montée sur son rootElement                     │
│    → Totalement indépendantes entre elles                   │
│    → Ne savent pas qu'elles cohabitent                      │
└─────────────────────────────────────────────────────────────┘
```

### 7.10 Distinction rendre vs composer — illustration

```
┌─────────────────────────────────────────────────────────┐
│  NodeEditFormView (rend le template)                    │
│                                                         │
│  ┌─ scope View ──────────────────────────────────┐      │
│  │  <h1>Edit Article</h1>                        │      │
│  │  <form>                                       │      │
│  │    ┌─ limite de scope (slot) ───────────────┐ │      │
│  │    │  <div data-field-type="wysiwyg"        │ │      │
│  │    │       data-field-id="field_body">      │ │      │
│  │    │    → EditorJSView (monté par Composer) │ │      │
│  │    │  </div>                                │ │      │
│  │    │  <div data-field-type="media"          │ │      │
│  │    │       data-field-id="field_image">     │ │      │
│  │    │    → MediaPickerView (Composer)        │ │      │
│  │    │  </div>                                │ │      │
│  │    │  <div data-field-type="paragraphs"     │ │      │
│  │    │       data-field-id="field_paragraphs">│ │      │
│  │    │    → ParagraphsView (Composer)         │ │      │
│  │    │  </div>                                │ │      │
│  │    └────────────────────────────────────────┘ │      │
│  │  <button type="submit">Save</button>          │      │
│  └───────────────────────────────────────────────┘      │
│                                                         │
│  La View REND le <form>, le <h1>, le <button>.          │
│  La View NE SAIT PAS quelles Views sont dans le slot.   │
│  Le Composer DÉCIDE quoi monter dans chaque data-field. │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Comment le Composer découvre-t-il les points de montage ?

Trois options identifiées, la troisième étant la direction retenue :

### 8.1 Option 1 — Par convention DOM seul

Le Composer scanne son scope pour des éléments marqués (ex: `[data-field-type]`).

- ✔ Fonctionne en SSR et SPA
- ✔ Pas de dépendance Channel pour la découverte spatiale
- ❓ Le Composer doit « lire » le DOM → I35 à nuancer (lecture ≠ écriture)
- ❓ Pattern de re-scan quand le DOM du scope change (MutationObserver ?)
- ❌ Les métadonnées non-DOM (validation rules, permissions, cardinality) ne sont pas accessibles

### 8.2 Option 2 — Par Channel seul

Une Feature envoie au Composer une liste de descripteurs : `[{ name: "body", type: "wysiwyg" }, { name: "image", type: "media" }, ...]`.

- ✔ Cohérent avec le modèle Channel actuel
- ✔ Pas de lecture DOM par le Composer
- ❌ Nécessite une correspondance descripteur → élément DOM (qui fait la liaison ?)
- ❌ Le Channel dit « il y a un champ body de type wysiwyg » mais pas « il se trouve dans tel élément DOM »

### 8.3 Option 3 — Hybride (Channel + DOM) ✅ Direction retenue

Le DOM fournit le **où** et le **type** (via `data-field-type` et `data-field-id`). Le Channel fournit les **métadonnées** complémentaires (validation, permissions, état initial).

Constat clé (2026-03-31) : côté champs, le rendu SSR **doit déjà** rendre des éléments avec
des attributs DOM reconnaissables (`data-field-type="wysiwyg"`, `data-field-id="field_body"`,
ou encore `data-drupal-selector="edit-field-description-page-0-value"` que Drupal fournit nativement).
Le DOM contient donc **déjà** les deux informations essentielles (type + localisation).

```
DOM     → <div data-field-type='wysiwyg' data-field-id='field_body'>  (type + où)
Channel → { fieldId: 'field_body', required: true, maxLength: 5000 }  (métadonnées)
Composer→ EditorJSView dans [data-field-id='field_body']
            avec options { fieldId, required, maxLength, rootElement }
```

- ✔ Séparation des responsabilités : DOM sait où + quel type, Feature sait les métadonnées
- ✔ Le Composer fait la jonction — c'est de la **décision**, pas de la manipulation
- ✔ Fonctionne en SSR (DOM existe déjà) et en SPA (DOM rendu par la View conteneur)
- ✔ Le `rootElement` est passé en paramètre à la View via `TResolveResult.options` (mécanisme D34 existant)
- ✔ Pas de timing problem : le DOM est prêt quand le Composer est instancié

---

## 9. Lien avec le mode ESM modulaire

Les deux axes de la réflexion du 2026-03-30 convergent naturellement :

| Partie I (ESM Modulaire) | Partie II (Composition Dynamique) |
|--------------------------|-----------------------------------|
| `BonsaiRegistry.registerFeature()` | `BonsaiRegistry.registerFieldType()` |
| Module ESM autonome déclare ses composants | Module ESM déclare quels types de champs/widgets il fournit |
| Découverte dynamique des Features | Découverte dynamique des points de montage |
| Composition UI via injections | Composition UI via résolution type → View |

Le mode ESM modulaire fournit le **véhicule de distribution**. La composition dynamique hétérogène fournit le **modèle de composition au runtime**. Les deux sont nécessaires ensemble pour une architecture CMS réelle.

**Exemple concret de convergence** :

```js
// Module ESM "wysiwyg" — chargé si le bundle de contenu a un champ body
import { BonsaiRegistry } from "/bonsai/bonsai.esm.js";
import { EditorJSView } from "./editor-js.view.js";

// Le module déclare qu'il fournit une View pour les champs de type "wysiwyg"
BonsaiRegistry.registerFieldType("wysiwyg", {
  view: EditorJSView,
  // optionnel : un Composer spécifique si le générique ne suffit pas
  // composer: EditorJSFieldComposer,
});
```

```js
// Module ESM "media" — chargé si le bundle a un champ image
import { BonsaiRegistry } from "/bonsai/bonsai.esm.js";
import { MediaPickerView } from "./media-picker.view.js";

BonsaiRegistry.registerFieldType("media", {
  view: MediaPickerView,
});
```

Le Composer du formulaire consulte le Registry pour résoudre `type: "wysiwyg"` → `EditorJSView`, `type: "media"` → `MediaPickerView`, etc.

> **Clarification (QO-CDH-4 stabilisé)** : cet exemple illustre le **cas plateforme**
> (monde ouvert) où le Composer de core ne connaît pas les Views au compile-time.
> Le `BonsaiRegistry` est alors un vrai mécanisme de **composition** — le Composer
> y délègue la résolution tout en restant décideur (D21).
>
> Dans le **cas application** (monde fermé, majorité des cas), la résolution est
> une simple map locale avec des imports explicites — pas besoin de Registry.
>
> La Partie I (ESM Modulaire) fournit le **véhicule de distribution** (chargement
> des modules `.esm.js`). La composition (qui résout `type → View`) est traitée
> par QO-CDH-4 avec deux mécanismes selon le cas. Voir QO-CDH-4 pour la
> distinction complète.

---

## 10. Questions ouvertes

### QO-CDH-1 — `resolve()` → `resolveAll()` ? ✅ Stabilisé → `resolve()` étendu

**Réponse** : `resolve()` unifié — pas de `resolveAll()` séparé. La méthode `resolve()`
existante accepte un type de retour élargi :

```typescript
abstract resolve(): TResolveResult | TResolveResult[] | null;
```

- `TResolveResult | null` → cas 1 View (inchangé, rétrocompatible)
- `TResolveResult[]` → cas N Views (extension additive)

Raisons du choix `resolve()` étendu plutôt que `resolveAll()` :
- **Rétrocompatibilité totale** — le retour existant fonctionne tel quel
- **Un seul protocole** — pas de bifurcation dans le contrat Composer
- **Le framework traite uniformément** — il normalise en tableau, diff, attach/detach
- **Principe de moindre surprise** — extension d'un concept existant, pas un nouveau nom

De plus, `rootElement` est monté en champ dédié de `TResolveResult` (pas dans `options`)
et accepte `Element | string`. Voir §7.4–7.7.

### QO-CDH-2 — I35 : lecture DOM autorisée ? ✅ Stabilisé

**Réponse** : oui. I35 devrait être reformulé en « aucune **écriture** DOM ». La lecture
pour découverte est une capacité de **décision**, pas de **manipulation**. Lire le DOM
pour savoir *ce qui est là* est du même ordre que lire un Channel pour savoir
*ce qui s'est passé*.

Concrètement, le Composer fait `this.scope.querySelectorAll('[data-field-type]')` —
c'est de la lecture, pas de l'écriture. Le montage effectif des Views (appendChild, etc.)
est fait par le **framework**, pas par le Composer.

### QO-CDH-3 — TUIEvents sur Composer ✅ Stabilisé

**Réponse** : **non**. Les TUIEvents restent le monopole de View et Behavior. Le Composer
n'écoute pas d'événements DOM utilisateur. Sa source d'information est :

- Le Channel (pour les **métadonnées** — descripteurs, événements applicatifs)
- La lecture DOM (pour le **type et la localisation** — `data-field-type`, `data-field-id`)

### QO-CDH-4 — Mécanisme de résolution `type → View` ✅ Stabilisé

La résolution `fieldType: string → typeof View` dépend de **qui écrit le Composer**.
Deux cas fondamentalement différents existent, et les deux respectent D21 (« la décision
d'instanciation est entièrement portée par le Composer ») — seule la **source de
connaissance** du Composer diffère.

#### Cas 1 — Composer d'application (monde fermé)

Le développeur écrit le Composer **et** l'application. Il connaît tous les types de
champs et leurs Views. Il les importe explicitement — dépendances statiques, vérifiées
par le type system, proposées par l'IDE.

On ne peut pas écrire `case 'acme': return AcmeView` sans importer `AcmeView`.
L'import est obligatoire. Le mapping est une connaissance du développeur.

```typescript
import { EditorJSView } from '@acme/editor-js-view';
import { MediaPickerView } from '@media-corp/media-picker-view';
import { ParagraphsView } from './paragraphs.view';

class NodeEditFormComposer extends Composer {
  /**
   * Résolution type → View — monde fermé.
   * Le développeur de l'application connaît ses dépendances.
   * Même pour des Views externes (packages npm, modules ESM),
   * l'import est explicite et statique.
   */
  private resolveViewForFieldType(type: string | null): typeof View | null {
    switch (type) {
      case 'wysiwyg':    return EditorJSView;    // @acme/editor-js-view
      case 'media':      return MediaPickerView;  // @media-corp/media-picker-view
      case 'paragraphs': return ParagraphsView;   // local
      default:           return null;             // champ simple, pas de View
    }
  }
}
```

#### Cas 2 — Composer de plateforme (monde ouvert)

Le développeur écrit un **core extensible** (IDE, CMS à plugins, layout builder) et
livre des Composers qui ouvrent des slots à des **contributeurs externes**. Au
compile-time du core, les types de contributions et leurs Views sont **inconnus**.

Exemple : un IDE qui expose un slot `editorPane` pour des éditeurs contribués :

```typescript
// core/editor-pane.composer.ts — livré dans le core de l'IDE
// Au compile-time : AUCUNE connaissance des éditeurs contribués.

class EditorPaneComposer extends Composer {
  /**
   * Résolution type → View — monde ouvert.
   * Le Composer de plateforme délègue la résolution à un Registry.
   * Il reste un DÉCIDEUR (D21) : il choisit de consulter le Registry,
   * il valide le résultat, il peut appliquer des politiques (priorité,
   * fallback, filtrage par contexte).
   */
  private resolveViewForEditorType(type: string | null): typeof View | null {
    if (!type) return null;

    // Consulter le Registry — les contributeurs s'y sont enregistrés
    const registration = BonsaiRegistry.resolveContribution('editorType', type);
    if (!registration) return null;

    // Le Composer reste le décideur : il peut filtrer, valider, prioriser
    return registration.view;
  }
}
```

```typescript
// extensions/markdown-editor/index.ts — contribué par un tiers
import { BonsaiRegistry } from '@bonsai/core';
import { MarkdownEditorView } from './markdown-editor.view';

// Le contributeur déclare sa View pour le type 'markdown'
BonsaiRegistry.registerContribution('editorType', 'markdown', {
  view: MarkdownEditorView,
});
```

Dans ce cas, le Registry **est** un mécanisme de composition — le Composer de plateforme
ne peut pas fonctionner sans. Ce n'est pas un dispatcher générique : il reste D21 parce
qu'il **choisit** de consulter le Registry, **valide** le résultat, et peut appliquer des
**politiques** (priorité entre contributions concurrentes, fallback, filtrage contextuel).

#### Synthèse des deux cas

| Dimension | Composer d'application | Composer de plateforme |
|-----------|----------------------|------------------------|
| **Qui l'écrit** | Le développeur de l'app | Le développeur du core |
| **Connaît les Views au compile-time** | ✅ Oui — imports explicites | ❌ Non — contributeurs externes |
| **Mécanisme de résolution** | Map locale (switch/Record) | Registry (`BonsaiRegistry`) |
| **Respecte D21** | ✅ Décideur direct | ✅ Décideur par délégation contrôlée |
| **Type-safety** | ✅ Compile-time | 🟡 Runtime (le Registry retourne `typeof View \| null`) |
| **Hypothèse** | Monde fermé | Monde ouvert |

> **Principe** : le cas 1 (monde fermé) est le **cas par défaut**. La majorité des
> applications Bonsai seront en monde fermé. Le cas 2 (monde ouvert) est réservé
> aux **plateformes extensibles** — il ne justifie pas de complexifier le contrat
> Composer de base. Le `BonsaiRegistry` est un mécanisme **optionnel** qui n'existe
> que si l'application est une plateforme.

#### Piste `request()` vers la Feature — écartée

La Feature connaît les *métadonnées* des champs (validation, permissions), pas le
mapping `type → View`. Le mapping est une décision de couche concrète — la Feature
est couche abstraite. Le Composer demanderait à la Feature une information qui ne
lui appartient pas. Écarté dans les deux cas (application et plateforme).

### QO-CDH-5 — Cascade de cleanup ✅ Stabilisé

Si le scope du Composer est supprimé du DOM, il doit détacher **toutes** ses Views
(pas juste une). Le mécanisme de cleanup est récursif et déterministe. C'est une extension
du mécanisme existant (qui ne gère qu'une seule View) — pas un nouveau concept.

### QO-CDH-6 — `route:change` et recomposition coordonnée ✅ Stabilisé

Un `route:change` survient en contexte **SPA** — le framework re-rend les Views concernées
via le PDR. Le Composer réagit **à condition que son slot survive au re-render**.

Deux sous-cas selon la nature du changement de route :

#### Sous-cas A — changement de type de View

`nodeEditForm:entityA` → `settings:development` : `NodeEditFormView` est détruite,
son DOM disparaît, le slot (`<form>`) est supprimé. Le Composer entre dans l'état
*détruit* (§4.3). Aucun problème, aucune coordination nécessaire.

#### Sous-cas B — même View, entité différente

`nodeEditForm:entityA` → `nodeEditForm:entityB` : le PDR réconcilie la View —
l'élément `<form>` (structure inchangée) **survit**. Le Composer reste vivant,
son scope est intact.

Ses anciens mount points `[data-field-type]` (champs d'entityA) ont été remplacés
par les nouveaux (champs d'entityB) lors de la réconciliation PDR. Le Composer
reçoit l'Event de routing via son Channel, re-scanne son scope, appelle `resolve()` :

```
route:change (entityB)
  → Composer reçoit l'Event
  → re-scanne this.scope.querySelectorAll('[data-field-type]')  ← nouveaux éléments
  → resolve() → TResolveResult[] pour les champs d'entityB
  → framework diff :
      • Views d'entityA absentes du nouveau résultat → detach + destroy
      • Views d'entityB nouvelles → attach + mount
      • Views communes (même type, même mount point) → update options si nécessaire
```

C'est le **cycle normal** du Composer (`resolve()` → diff → attach/detach),
juste déclenché par un Event de routing plutôt qu'un Event métier.

**La condition « slot survit »** est la condition naturelle de survie du Composer
(§4.3 : vivant / suspendu / détruit). Elle est garantie par la réconciliation PDR
pour une View dont la structure racine est inchangée.

**Réponse** : la réaction indépendante de chaque Composer à son propre Channel est
suffisante. Aucun mécanisme de coordination globale n'est nécessaire — la coordination
visuelle éventuelle (éviter le flicker) est une préoccupation UX (CSS transitions,
rendu différé) hors du périmètre du contrat Composer.

### QO-CDH-7 — Impact sur I40 (scope DOM exclusif) 🟡 Partiellement stabilisé

I40 dit que les `uiElements` de la View parente excluent les sous-arbres des slots.
Si un Composer gère N points de montage dans son scope, chacun de ces points de montage
devient un sous-arbre exclu du scope de la View conteneur. Le mécanisme I40 doit-il être
étendu pour gérer des exclusions dynamiques (le nombre de sous-arbres exclus n'est pas
connu au compile-time) ?

**Partiellement stabilisé (§4.5)** : la règle d'intégrité DOM du slot Composer pose
les garde-fous pour les cas statiques (exclusivité clé `composers`/`templates` en Mode C,
protection des slots en Mode B root). La question ouverte restante concerne
spécifiquement le cas CDH où les points de montage sont découverts dynamiquement par
le Composer via `resolve()` étendu : le framework doit savoir **à runtime** quels
sous-arbres sont des domaines Composer pour appliquer la protection (cf. §4.5 garde-fou 2).

---

## 11. Prochaines étapes

### Stabilisé — prêt à formaliser

1. ✅ **Direction retenue** : View close, Composer révisé
2. ✅ **I35 nuancé** : lecture DOM autorisée, écriture interdite
3. ✅ **I37 révisé** : 0/N Views hétérogènes dans un scope fixe
4. ✅ **Nouvel invariant candidat** : immutabilité du scope Composer
5. ✅ **TUIEvents Composer** : non — monopole View/Behavior confirmé
6. ✅ **`resolve()` unifié** : retour `TResolveResult | TResolveResult[] | null` (pas de `resolveAll()`)
7. ✅ **`rootElement` en champ dédié** : `Element | string` dans `TResolveResult` (plus dans `options`)
8. ✅ **Composer résout le rootElement** : `querySelector` fait par le Composer, pas le framework
9. ✅ **Rétrocompatibilité D30** : `rootElement: string` → le framework résout + crée si absent (SPA)
10. ✅ **Intégrité DOM du slot Composer** : domaine exclu — destruction autorisée, modification structurelle interdite. Deux garde-fous : exclusivité clé `composers`/`templates` (compile-time, Mode C) + protection des slots en Mode B root (runtime, framework)
11. ✅ **Résolution `type → View`** : deux cas selon qui écrit le Composer. *Application* (monde fermé) : map locale, imports explicites. *Plateforme* (monde ouvert, IDE, CMS à plugins) : `BonsaiRegistry` comme mécanisme de composition par délégation contrôlée. D21 respecté dans les deux cas
12. ✅ **`route:change` et recomposition** : le Composer réagit à son Channel de routing et re-appelle `resolve()`. Précondition : le slot survit au re-render PDR (garanti pour même structure de View). Deux sous-cas : View détruite → Composer détruit (§4.3) ; même View, entité différente → Composer re-résout, framework diff. Aucune coordination globale nécessaire.
13. ✅ **Périmètre CDH révisé (2026-03-31)** : le cas « types encodés dans attributs DOM » est résolu par la sémantique TUIMap + sélecteurs d'attribut + N instances Composer par clé — **sans mécanisme CDH**. Les sélecteurs `uiElements` sont résolus par `querySelectorAll` (0/1/N éléments) ; si la clé est dans `get composers()`, le framework instancie N Composers. CDH vrai se réduit à deux cas résiduels : (a) DOM sans type, résolution nécessitant un croisement Channel + DOM ; (b) monde ouvert / plateforme extensible (couvert par ADR-0021).

### À faire

1. **Formaliser** l'invariant d'immutabilité du scope Composer → candidat I-nouveau dans RFC-0001-invariants-decisions
2. **Spécifier la sémantique N-instances de `get composers()`** → RFC-0002 §9.6 + ADR-0020
   - Un sélecteur `uiElements` peut matcher 0, 1 ou N éléments (`querySelectorAll`)
   - Si la clé est dans `get composers()` : le framework instancie N Composers, un par élément matché
   - Cette sémantique couvre la majorité des cas CDH supposés (champs typés par attribut)
3. **Rédiger ADR-0020** — Sémantique N-instances Composer & CDH (périmètre réduit) :
   - **✅ Rédigé** → [ADR-0020-composers-n-instances-composition-heterogene.md](adr/ADR-0020-composers-n-instances-composition-heterogene.md)
   - Scope réduit : exclut le cas « types en attributs DOM » (traité par TUIMap + N-instances)
   - Couverture : (a) DOM sans type, résolution via Channel ; (b) monde ouvert → ADR-0021
   - `resolve()` étendu : `TResolveResult | TResolveResult[] | null`
   - `rootElement: Element | string` comme champ dédié de `TResolveResult`
   - Impact sur la séquence d'attachement §12.4 de RFC-0002
4. **Valider** sur les 5 cas concrets (§2) avec la lecture révisée (items 2+3 épuisent la majorité des cas)
5. **Explorer** l'impact sur I40 (exclusions dynamiques de sous-arbres) — QO-CDH-7 résiduelle
6. **Rédiger ADR** ESM modulaire (Partie I) — décision séparée mais convergente

### Matrice d'impact sur les invariants et décisions existants

| Élément | Impact | Détail |
|---------|--------|--------|
| **I35** | 🟡 Nuancé | « Aucun droit DOM » → « Aucune **écriture** DOM. Lecture du scope autorisée. Le Composer résout le `rootElement` par `querySelector`. » |
| **I36** | ❄️ Inchangé | « View ne compose jamais » — confirmé et renforcé |
| **I37** | 🔴 Révisé | « 0/1 View » → « 0/N Views hétérogènes dans un scope fixe via `resolve()` étendu » |
| **D24** | 🟡 Précisé | « Pas de CollectionComposer » — toujours vrai. Un Composer classique gère N mount points hétérogènes (pas une liste itérative). |
| **I40** | 🟡 Renforcé | Exclusions dynamiques de sous-arbres (QO-CDH-7 partiellement stabilisé, §4.5). Deux garde-fous posés : exclusivité clé `composers`/`templates` (Mode C compile-time) + protection slots en Mode B root (runtime). |
| **ADR-0010** | ❄️ Compatible | Le timing bootstrap est naturellement compatible (couche abstraite prête avant concrète) |
| **TResolveResult** | 🟡 Révisé | `rootElement` promu en champ dédié (`Element \| string`). `options` ne contient plus que les params View (D34). |
| **RFC-0002 §12.4** | 🟡 Impacté | La séquence d'attachement change : étape 5 (résolution rootElement) est faite par le Composer si `Element`, par le framework si `string`. |
