# Glossaire et Questions Ouvertes

> **Terminologie officielle du framework Bonsai**
>
> Ce document rassemble le vocabulaire officiel du framework et l'historique des questions
> architecturales résolues ou en attente.

[← Retour à l'index](../README.md) · [Invariants](invariants.md) · [Décisions](decisions.md)

---

| Champ             | Valeur                                      |
|-------------------|---------------------------------------------|
| **Document**      | reference/glossaire                         |
| **Emplacement**   | Référence                                   |
| **Scope**         | Terminologie, questions ouvertes            |
| **Statut**        | 🟢 Stable                                   |
| **Mis à jour**    | 2026-04-01                                  |

> ### Statut normatif
> Le **glossaire** (§1) est **normatif** — vocabulaire officiel.
> Les **questions ouvertes** (§2) sont **informatives** et ne font pas foi sur les contrats actifs.
> Les **conventions de nommage** (§3) sont **normatives** — conventions obligatoires.

---

## 📋 Table des matières

1. [Glossaire](#1-glossaire)
2. [Questions ouvertes](#2-questions-ouvertes)
3. [Conventions de nommage](#3-conventions-de-nommage)

---

## 1. Glossaire

Vocabulaire officiel du framework. Chaque terme a une définition unique, non ambiguë,
référencée dans toute la documentation.

| Terme               | Définition |
|----------------------|------------|
| **Application**      | Instance persistante légère. Point d'entrée et de sortie du framework. Orchestre le bootstrap (enregistrement Features, vérification unicité namespaces, câblage Radio, création Foundation et Composers) et le shutdown (destruction propre). Dormante au runtime — aucun rôle actif. Détient la configuration globale (D6). En Mode ESM Modulaire, la pré-étape `BonsaiRegistry.collect()` alimente `register()` avant `start()` (ADR-0019). |
| **Behavior**         | Plugin UI réutilisable et **aveugle** (D36), attaché à une View. Enrichit le comportement visuel (interactions DOM, animations) via ses propres clés ui, ses propres handlers UI auto-dérivés depuis `TUIMap` (D48), ses propres Channels et ses propres templates Mode C (îlots). Aucun **domain state** (I30). localState de présentation autorisé sous 5 contraintes (I42, D37). N'a aucun accès à sa View hôte — pas de `this.view` (I44). Alt. N1+N2 sur ses propres clés ui uniquement (I45). Pas de slots, pas de Composers. Ne peut jamais utiliser `emit()` (D7). Cycle de vie lié à sa View. |
| **BonsaiRegistry**   | Singleton du runtime Bonsai, exporté par `bonsai.esm.js`. Point de collecte des modules ESM : chaque module appelle `registerFeature()` / `registerView()` etc. au top-level, puis l'Application appelle `collect()` pour obtenir un snapshot immuable. Le registry est verrouillé après `collect()`. Existe uniquement en Mode ESM Modulaire (ADR-0019). Nature : composant runtime, comme Radio. |
| **Channel**          | Contrat de communication typé d'une Feature. Définit trois voies (tri-lane) : commands (1:1), events (1:N), requests (1:1 **synchrone**, D9 révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)). Identifié par le namespace de sa Feature propriétaire. |
| **Channel Declaration** | Déclaration statique dans la définition d'un composant des Channels avec lesquels il interagit. Constitue le contrat de dépendances de communication du composant (D1). |
| **Chorégraphie**     | Modèle d'architecture où chaque composant réagit de manière autonome aux événements, sans orchestrateur central. Le comportement global émerge de la composition des réactions individuelles (D2). |
| **Command (Trigger)** | Intention d'action, envoyée via `trigger()` par une **View ou un Behavior** sur le Channel d'une Feature. Cardinalité 1:1 : un seul handler (la Feature propriétaire, via `handle` C2). Un Command peut être refusé. Nommage : impératif métier, format `namespace:verbObjet` (ex: `cart:addItem`) (D5, D7). |
| **Composer**         | Décideur de composition attaché à un scope DOM. Décide quelle(s) View(s) instancier via `resolve()`. A des capacités Channel (listen, request) pour recueillir l'information nécessaire à sa décision. Gère **0/N Views hétérogènes** dans son scope fixe (ADR-0020, I37 révisé). Aucune **écriture** DOM — lecture du scope autorisée (I35 nuancé). Le Composer est un **décideur pur** (D21, D22, D23, D24). |
| **Emit (C1)**        | Capacité d'une Feature à diffuser un Event (fait accompli) sur son propre Channel. Cardinalité 1:N (broadcast). Réservé exclusivement à la Feature propriétaire du Channel — les Views/Behaviors ne peuvent jamais utiliser `emit()` (D7). |
| **Entity**           | Structure de données encapsulée portant le state d'une Feature. Typée par `TStructure extends TJsonSerializable`. Stocke le state, notifie sa Feature des mutations (diff). Peut contenir de la logique de données (calcul, tri, filtrage). Jamais accessible hors de sa Feature (I5, I6). |
| **Event**            | Notification d'un changement de state survenu, diffusée via `emit()` par la Feature propriétaire du Channel. Cardinalité 1:N (broadcast). Un Event est un fait accompli — il ne peut être refusé. Nommage : événement métier au passé, format `namespace:objetVerbe` (ex: `cart:itemAdded`) (D5, D7). |
| **Feature**          | Composant unique de logique métier. Possède 5 capacités : emit (propre, C1), handle (propre, C2), listen (déclarés, C3), reply (propre, C4), request (déclarés, C5). Un seul type, pas de sous-types (D2, D3, D7). |
| **FormBehavior**     | Behavior spécialisé dans la gestion de formulaires (ADR-0009 Option D). Gère la validation via `TEntitySchema` (ADR-0022), le dirty tracking, l'intéraction avec les champs DOM. Attaché à une View, aveugle vis-à-vis de la Feature. Le domain state (valeurs, erreurs) vit dans l'Entity de la Feature, pas dans le Behavior (I30). |
| **Foundation**       | Point d'ancrage **unique** de l'application dans le document DOM. Cible `<body>`. Composant persistant qui déclare les Composers racines, écoute les événements DOM globaux sur `<html>`/`<body>`, et peut altérer ces éléments en N1 (classes, attributs). A des capacités Channel (listen, trigger, request). Aucun rendu (pas de PDR, pas de templates). Un seul par application (D20, I33). |
| **Handle (C2)**      | Capacité implicite d'une Feature à recevoir et traiter les Commands entrants sur son propre Channel. La Feature décide d'accepter ou de refuser le Command. Cardinalité 1:1 (D7). |
| **Listen (C3)**      | Capacité d'une Feature (ou View/Behavior) à écouter les Events d'autres Channels. Réactif : "préviens-moi quand ça change". Nécessite une déclaration `listen` (D1). |
| **Meta (TMessageMetas)** | Métadonnées causales attachées à chaque message. Type `TMessageMetas` avec : `id` (ULID, préfixé `usr-` ou `sys-`), `correlationId` (transaction logique, créé au point d'entrée UI), `causationId` (message parent), `hop` (profondeur anti-boucle), `origin` (`{ kind: 'view'\|'feature'\|'behavior'\|'composer'\|'foundation', namespace: string }`), `timestamp`. Les handlers reçoivent `(payload, metas)` explicitement (ADR-0016) ; le développeur propage via `{ metas }` dans `emit()`, `request()`, `mutate()`. Les metas servent à la **traçabilité**, jamais à la logique métier. |
| **Mode ESM Modulaire** | Mode de distribution où Bonsai est livré sous forme de modules ES natifs (`*.esm.js` + `*.d.ts`), chargés par le navigateur via `<script type="module">`. Chaque module déclare ses composants dans `BonsaiRegistry` au top-level. Alternative au Mode IIFE (bundle unique). Défini par ADR-0019. |
| **Module ESM Bonsai** | Fichier JavaScript ES Module (`*.esm.js`) accompagné de sa déclaration TypeScript (`*.d.ts`). Contient un ou plusieurs composants Bonsai (Feature, View, Composer, Behavior) et les enregistre dans `BonsaiRegistry` au top-level. Le `.d.ts` est **obligatoire** — distribuer sans `.d.ts` est interdit (ADR-0019 C7). |
| **Namespace**        | Clé d'identité universelle d'une Feature, en `camelCase` plat. Sert simultanément d'identité du Channel, de clé de l'Entity dans le store logique, et de préfixe des messages. Unique dans toute l'application. Relation 1:1:1 avec Feature et Entity (D5). |
| **PDR (Projection DOM Réactive)** | Stratégie de rendu de Bonsai. La View ne "re-rend" pas — elle projette des données sur un DOM existant via des mutations chirurgicales. Zéro VDOM, zéro diff d'arbre. O(Δ) mutations directes (D19). |
| **TProjectionNode**   | Type de lecture + mutation N1 sur un @ui DOM. Primitives : `text()`, `attr()`, `toggleClass()`, `visible()`, `style()`. Retourné par `getUI(key)` pour les @ui sans template. N'expose **pas** `.node` (I39). |
| **TProjectionRead**   | Type de lecture seule sur un @ui DOM : `value()`, `checked()`, `getAttr()`, `getText()`, `hasClass()`. Retourné par `getUI(key)` pour les @ui couverts par un template (N2/N3). |
| **Radio**            | Infrastructure interne du framework. Gère le câblage des Channels. Jamais exposé au développeur (D1, I15). |
| **Reply (C4)**       | Capacité d'une Feature à répondre aux Requests sur son propre Channel. Retourne **toujours** `T \| null` **synchrone** (D9 révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)) — le replier lit l'état de son Entity, déjà en mémoire. `null` si le replier throw ou si le Channel n'est pas enregistré (D44 révisé). Un replier async est un anti-pattern. |
| **Request (C5)**     | Capacité d'une Feature (ou View/Behavior) à lire le state d'une autre Feature via son Channel. Retourne `T \| null` **synchrone** (D9 révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)). Lecture seule, pas de mutation. Interrogatif : "dis-moi la valeur maintenant". `null` si le replier throw ou si le Channel n'est pas enregistré (D44 révisé). Nécessite une déclaration `request` (D1, D3). |
| **Router**           | Composant framework spécialisé pour la navigation. Internement une spécialisation de Feature (modèle C1–C5) avec accès exclusif à l'History API du navigateur (BrowserHistory). Namespace réservé `router`. Entity = état de la route courante. Instancié par Application au bootstrap (D8). |
| **Store logique distribué** | Concept : la composition de toutes les Entities, chacune identifiée par le namespace de sa Feature propriétaire, forme logiquement le store global. Pas d'objet centralisé (pas de Redux), mais adressable via `request()`. |
| **TBootstrapOptions** | Options passées à `Application.start(options?)`. Inclut `serverState?: Record<string, TJsonSerializable>` pour le pré-peuplement SSR (ADR-0014 H5), `devTools?: boolean` (RFC-0004). Défini dans RFC-0002 §7.1. |
| **TEntitySchema<T>** | Type générique représentant le **schéma Valibot** d'une Entity. Chaque Entity concrète définit `abstract get schema(): TEntitySchema<TStructure>` pour la validation modale (ADR-0022). Validation au `mutate()` en dev (`__DEV__`), silencieuse en prod, stricte dans les formulaires (`FormBehavior`). |
| **Tri-lane**         | Architecture du Channel en trois voies : command lane (1:1), event lane (1:N), request lane (1:1 synchrone, D9 révisé par ADR-0023). |
| **updateLocal()**    | Méthode de mutation du **localState** d'une View ou Behavior (ADR-0015). Signature : `updateLocal(recipe: (draft: Draft<TLocal>) => void)`. Déclenche les callbacks granulaires `onLocal${Key}Updated` (N1) et le pipeline selector/template (N2/N3). Le localState n'est jamais broadcastable et meurt au `onDetach()` (I42). |
| **Valibot**          | Bibliothèque de validation de schémas TypeScript **imposée** par le framework (ADR-0022 Option E). Choisie pour sa légèreté (~5 KB gzip), son tree-shaking natif, son inférence de types statiques (`InferOutput<typeof schema>`), et sa compatibilité avec la contrainte `TJsonSerializable` de Bonsai. Remplace Zod (trop lourd, ~50 KB) comme validateur standard. |
| **View**             | Composant UI éphémère **sans domain state** (I30). Détient le monopole du rendu : seul composant qui produit une représentation visuelle dans le DOM. Projection pure : données reçues via listen/request → rendu DOM. **localState de présentation autorisé** sous 5 contraintes (I42, D33) : typé, réactif, encapsulé, non-broadcastable, détruit au `onDetach()`. Critère de migration : dès qu'un autre composant a besoin de la donnée → Feature + Entity. Accède au DOM **exclusivement** via `getUI(key)` — aucun accès DOM brut (I39). Son scope DOM est le `rootElement` en excluant les sous-arbres des slots déclarés (I40). Chaque @ui a une source de mutation unique : `TProjectionNode` (N1) ou `template.project()` (N2/N3) — jamais les deux (I41). Peut déclarer des Composers (via `get composers()`) pour exposer des slots de composition, mais ne contrôle jamais ce qui y est monté (I36). N'a aucune responsabilité sur son propre cycle de vie — créée et détruite par la Foundation ou les Composers (D4, I19, I20). |

---

## 2. Questions ouvertes

Questions architecturales. Chaque question est soit résolue (✅), soit en attente (⏳).

### [Q1] ~~Chorégraphie vs Orchestration~~ → ✅ Résolu (D2)

> **Décision** : Chorégraphie pure. Pas de ProcessFeature.
> Les Features réagissent aux Events de manière autonome.
> Les metas assurent la traçabilité.

### [Q2] ~~Écoute cross-domain~~ → ✅ Résolu (D2)

> **Décision** : Toute Feature peut déclarer des `listen` cross-domain.
> C'est le mécanisme normal de la chorégraphie.
> La déclaration D1 rend ces dépendances visibles.

### [Q3] ~~Features : granularité et découpage~~ → ✅ Hors scope (→ Style Guide)

> **Décision** : La granularité des Features est une question de design applicatif,
> pas d'architecture mécanique. Elle relève du **Bonsai Style Guide** (à produire).
>
> La convention de fichiers pousse naturellement vers un découpage par bounded context (DDD).
> Le Style Guide formalisera les heuristiques de découpage.

### [Q4] ~~ProcessFeature~~ → ✅ Résolu (D2)

> **Décision** : Pas de ProcessFeature. Un seul type de Feature.
> Les workflows multi-étapes émergent de la chorégraphie.

### [Q5] ~~Convention de nommage~~ → ✅ Résolu (D5)

> **Décision** : Toutes les conventions de nommage sont actées. Voir [§3 Conventions de nommage](#3-conventions-de-nommage).

### [Q6] ~~Request cross-domain Feature→Feature~~ → ✅ Résolu (D3)

> **Décision** : Oui, une Feature peut faire des requests cross-domain.
> Le request est une lecture seule du state — pas de mutation.
> La Feature interrogée contrôle ce qu'elle expose via reply (C4).

### [Q7] ~~Behavior : périmètre et responsabilités~~ → ✅ Résolu (D36, D37, D38)

> **Décision** : Le Behavior est un **plugin UI réutilisable et aveugle** (D36).
> Il déclare ses propres clés ui (TUIMap), ses propres handlers UI auto-dérivés
> depuis `TUIMap` (D48, convention `on${Capitalize<Key>}${Capitalize<Event>}`),
> ses propres templates Mode C (îlots sur ses clés ui), et ses propres Channels.
>
> **Réponses aux questions ouvertes** :
>
> 1. **Altération DOM** : N1 + N2 sur ses propres clés ui uniquement (I45). N3 interdit (pas de rootElement).
> 2. **Scope DOM** : Le framework résout les sélecteurs du Behavior dans le scope du rootElement de la View hôte, mais le Behavior l'ignore (I44). Il opère **exclusivement** via ses propres clés ui.
> 3. **Capacités Channel** : Propres et indépendantes (trigger, listen, request). Jamais `emit()` (D7).
> 4. **Relation avec la View** : Enrichissement déclaré par la View (`get behaviors()`). Le Behavior est aveugle — aucun `this.view` (I44).
>
> **Concurrence d'altération DOM** : résolue par I43 — les clés TUIMap du Behavior ne doivent pas entrer en collision avec celles de la View. Vérifié au bootstrap.
> **Concurrence d'event handlers** : non problématique — View et Behavior peuvent écouter le même événement DOM sur des clés ui différentes.
>
> **localState** : autorisé sous les mêmes 5 contraintes I42 que la View (D37).
> **Différence fondamentale View/Behavior** : le Behavior ne peut définir ni slots ni Composers.
> **Algorithme de décision** (D38) : View+options (couplage total) vs Behavior (couplage zéro) vs Héritage (couplage partiel, rare).
>
> #### Cas d'usage : TrackingBehavior (pattern "listener pur")
>
> ```typescript
> // Behavior générique, branchable sur n'importe quelle View (D36)
> type TTrackingUI = TUIMap<{
>   trackedElement: { el: HTMLElement; event: ['click'] };
> }>;
>
> class TrackingBehavior extends Behavior<[Analytics.Channel], TTrackingUI> {
>   static readonly trigger = [Analytics.channel] as const;
>
>   get params() {
>     return {
>       uiElements: { trackedElement: '[data-tracking-type]' }
>     };
>   }
>
>   // PAS de get uiEvents() — D48 (AUTO-UI-EVENT-DISCOVERY)
>   // Le framework auto-dérive le handler depuis TUIMap :
>   //   clé 'trackedElement' + event 'click' → onTrackedElementClick
>
>   onTrackedElementClick(e: TUIEventFor<TTrackingUI, 'trackedElement', 'click'>) {
>     const el = e.currentTarget; // typé HTMLElement
>     this.trigger(Analytics.channel, 'trackInteraction', {
>       type: el.getAttribute('data-tracking-type'),
>       value: el.getAttribute('data-tracking-value')
>     });
>   }
> }
> ```
>
> **Caractéristiques de ce pattern** :
> - ✅ TUIMap propre — aucune collision possible avec les clés ui de la View hôte (I43)
> - ✅ Handlers auto-dérivés depuis TUIMap (D48) — pas de `get uiEvents()` manuel
> - ✅ Aucun `this.view` — le Behavior est aveugle (I44)
> - ✅ **Générique** : branchable sur n'importe quelle View
> - ✅ Channels déclarés indépendamment de la View hôte
>
> Voir [RFC-0002 §10.4](../6-transversal/conventions-typage.md) pour d'autres exemples (IScrollBehavior, déclaration dans la View hôte).

### [Q8] ~~Périmètre du composant Application~~ → ✅ Résolu (D6)

> **Décision** : Application est une instance persistante légère.
> Active au **bootstrap** et au **shutdown**. **Dormante au runtime**.
> Modèle inspiré de Vue.js/Ember.js.

### [Q9] ~~Application Channel lifecycle~~ → ✅ Résolu (D6, RFC-0002 §8)

> **Décision** : namespace `app` **réservé** (comme `router`), Channel **non créé**.
> L'ordre de bootstrap rend les Events lifecycle structurellement inutiles :
>
> ```
> A.  Application démarre
> B.  Features instanciées + activées
>     ─── couche abstraite COMPLÈTE et ACTIVE ───
> C.  Foundation + Composers lancent la composition UI
>     ─── couche concrète commence ───
> ```
>
> - `app:started` n'a **aucun listener possible** : les Features n'existent pas
>   encore en A, et quand les Views sont créées en C, l'information n'a plus de valeur.
> - **Principe fort** : quand la couche concrète commence, la couche abstraite
>   est **intégralement définie et active**.
>
> Si un cas d'usage concret émerge post-v1, un Channel `app` pourra être introduit
> via un ADR dédié. Pour l'instant : **YAGNI**.

---

## 3. Conventions de nommage

### Nommage des composants (classes)

| Composant | Convention | Exemples |
|-----------|-----------|----------|
| Feature | `XFeature` | `CartFeature`, `InventoryFeature`, `UserProfileFeature` |
| View | `XView` | `CartView`, `ProductListView`, `CheckoutView` |
| Behavior | `XBehavior` | `DragDropBehavior`, `TooltipBehavior`, `InfiniteScrollBehavior` |
| Entity | `XEntity` | `CartEntity`, `UserEntity`, `ProductEntity` |
| Composer | `XComposer` | `SidebarComposer`, `MainContentComposer`, `HeaderComposer` |
| Foundation | `AppFoundation` (unique) | `AppFoundation` |

### Namespace Feature (clé d'identité universelle)

- Format : **`camelCase` plat** — pas de hiérarchie, pas de `/` ni `.`
- Déclaration : **explicite** dans la définition de la Feature (`static namespace = 'cart'`)
- Unicité : **obligatoire** dans toute l'application — collision = erreur au bootstrap
- Rôle triple : identité du Channel, clé de l'Entity dans le store logique, préfixe des messages

### Nommage des messages

| Aspect | Convention | Exemples |
|--------|-----------|----------|
| **Format** | `namespace:messageName` — séparateur `:`, noms en `camelCase` | `cart:addItem`, `cart:itemAdded` |
| **Command** | Impératif métier | `cart:addItem`, `user:updateProfile` |
| **Event** | Événement métier (passé) | `cart:itemAdded`, `inventory:stockUpdated` |
| **Request** | Nominal métier | `cart:total`, `pricing:totalAmount` |

### Structure des fichiers et dossiers (Angular Style Guide)

- Un **dossier par domaine/fonctionnalité**, nommé en `PascalCase`
- Les fichiers suivent le pattern `kebab-case.type.ext`
- Le suffixe de type (`.feature`, `.view`, `.entity`, `.behavior`) est **obligatoire**
- Le Channel et le State sont **co-localisés** dans le fichier `.feature.ts` (D13/D14) — il n'y a **pas** de fichier `.channel.ts` séparé

Exemple d'une Feature `Product` :

```
Product/
  product.feature.ts       # Feature + Channel (TChannelDefinition) + State (co-localisés, D13/D14)
  product.entity.ts        # Entity (structure de données)
  product.view.ts          # View (rendu UI)
  product.composer.ts      # Composer(s) optionnel(s)
  product.behavior.ts      # Behavior(s) optionnel(s)
  --- hors scope framework ---
  product.styles.scss      # Styles
  product.template.pug     # Template PugJS
```

> Cette convention garantit :
> - **Lisibilité** : chaque fichier a un rôle identifiable par son suffixe
> - **Colocation** : tout le domaine est regroupé dans un seul dossier
> - **Cohérence** : alignement avec les pratiques Angular, familières à l'écosystème

---

## Références

- [RFC-0001 Architecture Fondamentale](../1-philosophie.md) — Document maître
- [RFC-0001 Composants](../2-architecture/README.md) — Détail des 10 composants
- [RFC-0001 Invariants et Décisions](../reference/invariants.md) — Règles et historique
- [Framework Style Guide](../guides/FRAMEWORK-STYLE-GUIDE.md) — Conventions d'usage du framework applicatif
- [RFC-0002 API et Contrats de Typage](../6-transversal/conventions-typage.md) — Contrats TypeScript, glossaire des types §19
