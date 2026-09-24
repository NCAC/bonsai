# Glossaire

> **Terminologie officielle du framework Bonsai**
>
> Vocabulaire officiel du framework et conventions de nommage. Les décisions
> et leurs justifications sont dans les [ADR](../../adr/README.md).

[← Retour à l'index](../README.md) · [Invariants](invariants.md) · [ADR](../../adr/README.md)

---

| Champ | Valeur |
| --- | --- |
| **Document** | reference/glossaire |
| **Emplacement** | Référence |
| **Scope** | Terminologie, questions ouvertes |
| **Statut** | 🟢 Stable |
| **Mis à jour** | 2026-09-25 |

> ## Statut normatif
>
> Le **glossaire** (§1) est **normatif** — vocabulaire officiel.
> Les **questions ouvertes** (§2) sont **informatives** et ne font pas foi sur les contrats actifs.
> Les **conventions de nommage** (§3) sont **normatives** — conventions obligatoires.

---

## 📋 Table des matières

1. [Glossaire](#1-glossaire)
2. [Conventions de nommage](#2-conventions-de-nommage)

---

## 1. Glossaire

Vocabulaire officiel du framework. Chaque terme a une définition unique, non ambiguë,
référencée dans toute la documentation.

| Terme | Définition |
| --- | --- |
| **Application** | Instance persistante légère, point d'entrée et de sortie du framework : `new Application({ foundation, features })`, où `features` est le **manifest applicatif typé** (clé = namespace, ADR-08). `start()` exécute le bootstrap par phases 0a → 4 ([application.md §3](../3-couche-abstraite/application.md#3-start--séquence-de-bootstrap), ADR-07) ; dormante ensuite (I23). |
| **Behavior** | Plugin UI réutilisable et **aveugle** (ADR-21), attaché à une View. Enrichit le comportement visuel (interactions DOM, animations) via ses propres clés ui, ses propres handlers UI auto-dérivés depuis son contrat UI (`TUIContract`, [ADR-14](../../adr/ADR-14-contrats-types.md), [ADR-15](../../adr/ADR-15-evenements-ui.md)), ses propres Channels et ses propres templates Mode C (îlots). Aucun **domain state** (I30). localState de présentation autorisé sous 5 contraintes (I42, ADR-17). N'a aucun accès à sa View hôte — pas de `this.view` (I44). Alt. N1+N2 sur ses propres clés ui uniquement (I45). Pas de slots, pas de Composers. Ne peut jamais utiliser `emit()` (ADR-01). Cycle de vie lié à sa View. |
| **BonsaiRegistry** | ⏳ Singleton du mode ESM modulaire qui collecte les modules chargés dans la page pour **alimenter le manifest applicatif** avant `start()` ; `collect()` le verrouille. Non livré, hors v1 ([ADR-27](../../adr/ADR-27-mode-esm-modulaire.md), [distribution.md §3](../2-architecture/distribution.md#3-mode-esm-modulaire--bonsairegistry)). |
| **Channel** | Contrat de communication typé d'une Feature. Définit trois voies (tri-lane) : commands (1:1), events (1:N), requests (1:1 **synchrone**, [ADR-02](../../adr/ADR-02-request-synchrone.md)). Identifié par le namespace de sa Feature propriétaire. |
| **Channel Declaration** | Déclaration statique dans la définition d'un composant des Channels avec lesquels il interagit. Constitue le contrat de dépendances de communication du composant (ADR-01). |
| **Chorégraphie** | Modèle d'architecture où chaque composant réagit de manière autonome aux événements, sans orchestrateur central. Le comportement global émerge de la composition des réactions individuelles (ADR-01). |
| **Command (Trigger)** | Intention d'action, envoyée via `trigger()` par une **View ou un Behavior** sur le Channel d'une Feature. Cardinalité 1:1 : un seul handler (la Feature propriétaire, via `handle` C2). Un Command peut être refusé. Nommage : impératif métier, format `namespace:verbObjet` (ex: `cart:addItem`) (ADR-08, ADR-01). |
| **Composer** | Décideur de composition attaché à un scope DOM. Décide quelle(s) View(s) instancier via `resolve()`. ⏳ Aura des capacités Channel (listen, request) pour recueillir l'information nécessaire à sa décision — non livrées : `resolve(event: unknown | null)` ne reçoit aucun Event aujourd'hui. Gère **0/N Views hétérogènes** dans son scope fixe (ADR-18, I37 révisé). Aucune **écriture** DOM — lecture du scope autorisée (I35 nuancé). Le Composer est un **décideur pur** (ADR-18). |
| **Emit (C1)** | Capacité d'une Feature à diffuser un Event (fait accompli) sur son propre Channel. Cardinalité 1:N (broadcast). Réservé exclusivement à la Feature propriétaire du Channel — les Views/Behaviors ne peuvent jamais utiliser `emit()` (ADR-01). |
| **Entity** | Structure de données encapsulée portant le state d'une Feature. Typée par `TStructure extends TJsonSerializable`. Stocke le state, notifie sa Feature des mutations (diff). Peut contenir de la logique de données (calcul, tri, filtrage). Jamais accessible hors de sa Feature (I5, I6). |
| **Event** | Notification d'un changement de state survenu, diffusée via `emit()` par la Feature propriétaire du Channel. Cardinalité 1:N (broadcast). Un Event est un fait accompli — il ne peut être refusé. Nommage : événement métier au passé, format `namespace:objetVerbe` (ex: `cart:itemAdded`) (ADR-08, ADR-01). |
| **Feature** | Composant unique de logique métier. Possède 5 capacités : emit (propre, C1), handle (propre, C2), listen (déclarés, C3), reply (propre, C4), request (déclarés, C5). Un seul type, pas de sous-types (ADR-01). |
| **FormBehavior** | Behavior spécialisé dans la gestion de formulaires — c'est l'**Option C** d'[ADR-25](../../adr/ADR-25-formulaires.md), utilisée comme brique du Pattern « réutilisable » de la stratégie globale recommandée (Option D, cf. [formulaires.md](../6-transversal/formulaires.md)). Gère la validation via `TEntitySchema` (ADR-11), le dirty tracking, l'intéraction avec les champs DOM. Attaché à une View, aveugle vis-à-vis de la Feature. **`touched`/`errors`/`values` en cours de saisie vivent dans le `localState` du Behavior, PAS dans l'Entity** (ADR-25 rejette explicitement l'inverse — traiter ces données comme du domain state viole I30) ; seules les valeurs **validées et soumises** atteignent l'Entity via une Command, après la soumission. |
| **Foundation** | Point d'ancrage **unique** de l'application dans le document DOM. Cible `<body>`. Composant persistant qui déclare les Composers racines, écoute les événements DOM globaux sur `<html>`/`<body>`, et peut altérer ces éléments en N1 (classes, attributs). ⏳ Capacités Channel (listen, trigger, request) non livrées ; l'écoute d'événements DOM globaux passe par `onAttach()`. Aucun rendu (pas de PDR, pas de templates). Un seul par application (ADR-20, I33). |
| **Handle (C2)** | Capacité implicite d'une Feature à recevoir et traiter les Commands entrants sur son propre Channel. La Feature décide d'accepter ou de refuser le Command. Cardinalité 1:1 (ADR-01). |
| **Listen (C3)** | Capacité d'une Feature (ou View/Behavior) à écouter les Events d'autres Channels. Réactif : "préviens-moi quand ça change". Nécessite une déclaration `listen` (ADR-01). |
| **Meta (TMessageMetas)** | ⏳ Cible strate 1b, non livré — voir [metas.md](../2-architecture/metas.md) pour la spécification faisant foi. Métadonnées causales attachées à chaque message. Type `TMessageMetas` avec : `messageId` (ULID), `correlationId` (transaction logique, préfixé `usr-`/`sys-` selon l'origine, créé au point d'entrée), `causationId` (message parent), `hop` (profondeur anti-boucle), `origin` (`{ kind: 'view'\|'feature'\|'behavior'\|'composer'\|'foundation', name: string, namespace?: string }`), `timestamp`. Les handlers recevraient `(payload, metas)` explicitement (ADR-04) ; le développeur propagerait via `{ metas }` dans `emit()`, `request()`, `mutate()`. Les metas serviraient à la **traçabilité**, jamais à la logique métier. |
| **Mode ESM Modulaire** | Mode de distribution où Bonsai est livré sous forme de modules ES natifs (`*.esm.js` + `*.d.ts`), chargés par le navigateur via `<script type="module">`. Chaque module déclare ses composants dans `BonsaiRegistry` au top-level. Alternative au Mode IIFE (bundle unique). Défini par ADR-27. |
| **Module ESM Bonsai** | Fichier JavaScript ES Module (`*.esm.js`) accompagné de sa déclaration TypeScript (`*.d.ts`). Contient un ou plusieurs composants Bonsai (Feature, View, Composer, Behavior) et les enregistre dans `BonsaiRegistry` au top-level. Le `.d.ts` est **obligatoire** — distribuer sans `.d.ts` est interdit (ADR-27). |
| **Namespace** | Clé d'identité universelle d'une Feature, en `camelCase` plat. Sert simultanément d'identité du Channel, de clé de l'Entity dans le store logique, et de préfixe des messages. Unique dans toute l'application. Relation 1:1:1 avec Feature et Entity (ADR-08). |
| **Phase 0a / 0b / 0c** | Phases sans effet de bord du bootstrap ([ADR-07](../../adr/ADR-07-application-bootstrap.md), [ADR-09](../../adr/ADR-09-feature-contract.md)). 0a : validation format namespace + `channel` (I70/I71/I73). 0b : instanciation pure de chaque Feature (`new FeatureClass(ns)`, ctor inerte, I94). 0c : lecture `instance.listens`/`instance.queries` et validation croisée (I70). Précèdent la création des Channels (phase 1). |
| **PDR (Projection DOM Réactive)** | Stratégie de rendu de Bonsai. La View ne "re-rend" pas — elle projette des données sur un DOM existant via des mutations chirurgicales. Zéro VDOM, zéro diff d'arbre. O(Δ) mutations directes (ADR-22). |
| **TProjectionNode** | Type de lecture + mutation N1 sur un @ui DOM, **générique sur le sous-type HTMLElement** depuis ADR-14 (`TProjectionNode<TEl>`). Primitives : `text()`, `attr()`, `toggleClass()`, `visible()`, `style()`, `element(): TEl`. Retourné par `getUI(key)` pour les @ui sans template ; `TEl` extrait du phantom `_el?` de l'entrée UI. N'expose pas de `.node` ; `element()` est une échappatoire typée réservée aux API DOM non couvertes par N1 (I39). |
| **TProjectionRead** | ⏳ Cible strate 1c, n'existe pas. Type de lecture seule sur un @ui DOM : `value()`, `checked()`, `getAttr()`, `getText()`, `hasClass()`. Retourné par `getUI(key)` pour les @ui couverts par un template (N2/N3). |
| **Module contractuel** | (ADR-14) Brique réutilisable de contrat consommateur : `TFeatureContract` (Feature-groupé : channels par Feature), `TUIContract` (entrées DOM typées avec events), `TUIElements<TUI>` (sélecteurs CSS overridables ADR-21). Chaque composant compose son propre `T{Component}Contract` à partir des modules dont il a besoin (View = features+ui, Composer = features seul, Behavior = features+ui+spécificités, Foundation = vide en strate 0). |
| **TFeatureContract** | Module contractuel des interactions channel **Feature-groupées** (ADR-14). Une entrée par Feature consommée : `{ feature: typeof CartFeature; listens: ["itemAdded"]; triggers: ["addItem"]; requests: [] }`. La clé d'objet (`cart`) DOIT correspondre au namespace de la Feature (I87). |
| **`TFeatureRef<TDef, NS>`** | Contrainte structurelle minimale d'une référence Feature (ADR-14) : tout objet exposant `channel: TChannelToken<TDef, NS>`. Sert de borne supérieure dans `TFeatureContract` et les types dérivés. |
| **`TFeatureRefForNS<NS>`** | Spécialisation de `TFeatureRef` où le namespace est imposé par la clé du contrat (I87). Utilisé dans la signature de `TFeatureContract` pour vérifier compile-time que `channel.namespace === clé`. |
| **`TFeatureCallbacks<TDef, TListens>`** | Clause `implements` unique d'une Feature ([ADR-09](../../adr/ADR-09-feature-contract.md), I92) : `TCommandCallbacks<TDef> & TRequestCallbacks<TDef> & TListenCallbacks<TListens>`. Handler manquant → `TS2515` ; signature fautive (payload/retour) → `TS2416`. |
| **`TStrictFeatureClass<NS, TDef>`** | Contrainte compile-time appliquée par `StrictManifest<M>` à chaque entrée du manifest applicatif (ADR-09, I95) : exige un constructeur `(namespace: NS) => Feature<…, TDef, NS>` (force `TSelfNS === NS`, I72) et un `static channel: TChannelToken<TDef, NS>` aligné (`channel.namespace === NS`, I73/I22). |
| **`TFlatListens<F>` / `TFlatTriggers<F>` / `TFlatRequests<F>`** | Types qui aplatissent un `TFeatureContract` Feature-groupé en **union** de clés `"namespace:name"` (ADR-14). Alimentent les signatures des méthodes consommateur (`trigger`, `request`) et la génération des handlers requis. |
| **`TCommandPayloadFor<F, K>`** | Extracteur de payload typé pour une clé `"ns:cmd"` du contrat (ADR-14). Utilisé dans la signature de `trigger` pour inférer exactement le payload depuis la classe Feature référencée. |
| **`TEventPayloadFor<F, K>`** | Extracteur de payload typé pour une clé `"ns:event"` du contrat (ADR-14). Utilisé dans la signature des handlers `on{NS}{Event}Event` générés par `TChannelCallbacks`. |
| **`TRequestParamsFor<F, K>` / `TRequestResultFor<F, K>`** | Extracteurs des params et du résultat typés pour une clé `"ns:req"` du contrat (ADR-14). Utilisés dans la signature de `request`. |
| **`TChannelCallbacks<F>`** | Mapped type qui génère depuis `TFeatureContract` les signatures `on{NS}{Event}Event(payload): void` requises par `implements` (ADR-14 — I48 channel). Symétrie : pour chaque clé de `F.{ns}.listens`, un handler imposé. |
| **`TUIEntry<TEl, TEvts>`** | Entrée UI typée d'un `TUIContract` (ADR-14) : `{ events: TEvts; _el?: TEl }`. Le phantom `_el?` encode `TEl` sans allocation runtime (I85). `events: []` = entrée non-interactive explicite (I86). Construit via `ui<TEl>()(events)`. |
| **`TEventsFor<TEl>`** | Mapping sémantique sous-type `HTMLElement` → events DOM autorisés (ADR-15). Plus strict que `lib.dom.d.ts` pour les éléments connus (le fallback large prévu est inatteignable, ADR-15). Sous-type de `keyof HTMLElementEventMap` (I89). Contraint `events` dans `ui<TEl>()(events)` — les doublons y sont interdits (I90). |
| **`TUICallbacks<U>`** | Mapped type qui génère depuis `TUIContract` les signatures `on{UIKey}{DomEvent}` requises par `implements` (ADR-15 — I48 UI). Pour chaque clé `K` d'`U` et chaque event `E ∈ U[K].events`, un handler `on${Capitalize<K>}${Capitalize<E>}(e: TDOMEventFor<E>)` imposé. |
| **`TUIContract`** | Module contractuel des nœuds DOM typés (ADR-14). `Readonly<Record<string, TUIEntry>>` où chaque `TUIEntry<TEl, TEvts>` porte les events DOM (`["click"]`) et un phantom `_el?: TEl` pour le typage de `getUI(k).element() → TEl`. Le sélecteur CSS n'est PAS dans ce module — il vit dans `TUIElements`. |
| **`TUIElements<TUI>`** | Map nom → sélecteur CSS, contraint aux clés de `TUI` (ADR-14). Vit dans le getter concret `get uiElements()` — ⏳ overridable par le Composer via `resolve() → options.uiElements` (ADR-21, non livré). |
| **`TViewContract<F, U>`** | Contrat View composé : `{ features: F; ui: U }` où F extends `TFeatureContract` et U extends `TUIContract` (ADR-14). Un seul générique sur `View<TVC>`. |
| **`TViewCallbacks<TVC>`** | Contrat `implements` unique (ADR-14, I88) : intersection de `TChannelCallbacks<F>` (handlers `on{NS}{Event}Event` requis) et `TUICallbacks<U>` (handlers `on{UIKey}{DomEvent}` requis pour events non-vides). Symétrie totale channel ↔ DOM. |
| **`TViewClass`** | Surface structurelle d'une classe View concrète, indépendante de son contrat : `abstract new (...args: any[]) => View<any>` (ADR-14). Utilisée par les composants orchestrateurs (Composer, Foundation) qui ne dépendent que de la surface publique de `mount()`, pas du `TViewContract` spécifique. Un seul `any` (vs `<any, any>` avant ADR-14) — un seul générique sur la classe. |
| **Feature-groupé** | (ADR-14) Forme de déclaration des interactions channel où chaque Feature consommée est une clé d'objet portant ses lanes (`{ cart: { listens: [...], triggers: [...], requests: [...] } }`). Élimine la répétition du préfixe namespace (`"cart:"`) et co-localise tout ce qui concerne une Feature. Remplace la forme lane-groupée d'ADR-14 (`{ listens: ["cart:itemAdded"], triggers: [...] }`). |
| **Helper `ui<TEl>()(events)`** | (ADR-14 I85) Fonction factory curryfiée qui construit une `TUIEntry<TEl, TEvts>`. `TEl` annoté explicitement, `events` inféré littéralement via `const TEvts`. La forme curryfiée contourne une limitation TypeScript (le `const` modifier ne préserve pas le littéral si un seul type arg explicite + défauts). |
| **Symétrie Contract/Callbacks** | (ADR-14, I88) Règle universelle : tout package Bonsai exposant un `T{Component}Contract` DOIT exposer un `T{Component}Callbacks<TC>` correspondant. Les composants concrets écrivent toujours la paire `extends X<TXxxContract>` + `implements TXxxCallbacks<TXxxContract>`. « On respecte toujours un contrat signé. » |
| **Radio** | Infrastructure interne du framework. Gère le câblage des Channels. Jamais exposé au développeur (ADR-01, I15). |
| **Reply (C4)** | Capacité d'une Feature à répondre aux Requests sur son propre Channel. Retourne **toujours** `T \| null` **synchrone** ([ADR-02](../../adr/ADR-02-request-synchrone.md)) — le replier lit l'état de son Entity, déjà en mémoire. `null` si le replier throw ou si le Channel n'est pas enregistré (ADR-02). Un replier async est un anti-pattern. |
| **Request (C5)** | Capacité d'une Feature (ou View/Behavior) à lire le state d'une autre Feature via son Channel. Retourne `T \| null` **synchrone** ([ADR-02](../../adr/ADR-02-request-synchrone.md)). Lecture seule, pas de mutation. Interrogatif : "dis-moi la valeur maintenant". `null` si le replier throw ou si le Channel n'est pas enregistré (ADR-02). Nécessite une déclaration `request` (ADR-01). |
| **Router** | ⏳ Strate 2 (seul le namespace réservé `router` existe). Composant framework spécialisé pour la navigation. Internement une spécialisation de Feature (modèle C1–C5) avec accès exclusif à l'History API du navigateur (BrowserHistory). Namespace réservé `router`. Entity = état de la route courante. Instancié par Application au bootstrap (ADR-13). |
| **Store logique distribué** | Concept : la composition de toutes les Entities, chacune identifiée par le namespace de sa Feature propriétaire, forme logiquement le store global. Pas d'objet centralisé (pas de Redux), mais adressable via `request()`. |
| **TBootstrapOptions** | ⏳ Options de `Application.start(options?)`, non livrées : `serverState?: Record<string, TJsonSerializable>` pour le pré-peuplement SSR (ADR-24 H5). Voir [application.md §3.1](../3-couche-abstraite/application.md#31-cible). |
| **`TEntitySchema<T>`** | Type générique représentant le **schéma Valibot** d'une Entity. ⏳ Non livré (ADR-11) : chaque Entity concrète définirait `protected get schema(): TEntitySchema<TStructure> | null` pour la validation modale. Validation au `mutate()` en dev (`__DEV__`), silencieuse en prod, stricte dans les formulaires (`FormBehavior`). |
| **Tri-lane** | Architecture du Channel en trois voies : command lane (1:1), event lane (1:N), request lane (1:1 synchrone, ADR-02). |
| **`updateLocal()`** | Méthode de mutation du **`localState`** d'une View ou Behavior (ADR-17). Signature : `updateLocal(recipe: (draft: Draft<TLocal>) => void)`. Déclenche les callbacks granulaires `onLocal${Key}Updated` (N1) et le pipeline selector/template (N2/N3). Le `localState` n'est jamais broadcastable et meurt au `onDetach()` (I42). |
| **Valibot** | Bibliothèque de validation de schémas TypeScript **imposée** par le framework (ADR-11 Option E). Choisie pour sa légèreté (~5 KB gzip), son tree-shaking natif, son inférence de types statiques (`InferOutput<typeof schema>`), et sa compatibilité avec la contrainte `TJsonSerializable` de Bonsai. Remplace Zod (trop lourd, ~50 KB) comme validateur standard. |
| **View** | Composant UI éphémère **sans domain state** (I30). Détient le monopole du rendu : seul composant qui produit une représentation visuelle dans le DOM. Projection pure : données reçues via listen/request → rendu DOM. **`localState` de présentation autorisé** sous 5 contraintes (I42, ADR-17) : typé, réactif, encapsulé, non-broadcastable, détruit au `onDetach()`. Critère de migration : dès qu'un autre composant a besoin de la donnée → Feature + Entity. Accède au DOM **exclusivement** via `getUI(key)` — aucun accès DOM brut (I39). Son scope DOM est le `rootElement` en excluant les sous-arbres des slots déclarés (I40). Chaque @ui a une source de mutation unique : `TProjectionNode` (N1) ou `template.project()` (N2/N3) — jamais les deux (I41). Peut déclarer des Composers (via `get composers()`) pour exposer des slots de composition, mais ne contrôle jamais ce qui y est monté (I36). N'a aucune responsabilité sur son propre cycle de vie — créée et détruite par la Foundation ou les Composers (ADR-16, I19, I20). |

---

## 2. Conventions de nommage

### Nommage des composants (classes)

| Composant | Convention | Exemples |
| --- | --- | --- |
| Feature | `XFeature` | `CartFeature`, `InventoryFeature`, `UserProfileFeature` |
| View | `XView` | `CartView`, `ProductListView`, `CheckoutView` |
| Behavior | `XBehavior` | `DragDropBehavior`, `TooltipBehavior`, `InfiniteScrollBehavior` |
| Entity | `XEntity` | `CartEntity`, `UserEntity`, `ProductEntity` |
| Composer | `XComposer` | `SidebarComposer`, `MainContentComposer`, `HeaderComposer` |
| Foundation | `AppFoundation` (unique) | `AppFoundation` |

### Namespace Feature (clé d'identité universelle, ADR-08)

- Format : **`camelCase` plat** — pas de hiérarchie, pas de `/` ni `.`
- Réservés : `'local'` (I71), `'router'` (I28) — interdits par `StrictManifest<M>` (compile-time)
- Déclaration : **portée par le manifest applicatif typé** (clé d'objet — I68). Aucun `static namespace` sur la classe Feature. Le namespace est passé au constructeur `(namespace) => Feature<...>` lors de la Phase 0b du bootstrap (instanciation pure, ctor inerte — I94)
- Conformité : `TSelfNS` du paramètre générique de la classe Feature **doit** correspondre à la clé du manifest (I72) — vérifié compile-time par `StrictManifest<AppManifest>`
- Unicité : garantie par la nature d'objet littéral du manifest (TS1117, I21/I24) — collision impossible compile-time
- Rôle triple : identité du Channel (`Radio.channel(namespace)`), clé du store logique d'Entity, préfixe des messages (`namespace:messageName`)

### Nommage des messages

| Aspect | Convention | Exemples |
| --- | --- | --- |
| **Format** | `namespace:messageName` — séparateur `:`, noms en `camelCase` | `cart:addItem`, `cart:itemAdded` |
| **Command** | Impératif métier | `cart:addItem`, `user:updateProfile` |
| **Event** | Événement métier (passé) | `cart:itemAdded`, `inventory:stockUpdated` |
| **Request** | Nominal métier | `cart:total`, `pricing:totalAmount` |

### Structure des fichiers et dossiers (Angular Style Guide)

- Un **dossier par domaine/fonctionnalité**, nommé en `PascalCase`
- Les fichiers suivent le pattern `kebab-case.type.ext`
- Le suffixe de type (`.feature`, `.view`, `.entity`, `.behavior`) est **obligatoire**
- Le Channel et le State sont **co-localisés** dans le fichier `.feature.ts` (ADR-09 — le wrapper `namespace Cart { … }` est abandonné, ADR-14) — il n'y a **pas** de fichier `.channel.ts` séparé

Exemple d'une Feature `Product` :

```text
Product/
  product.feature.ts       # Feature + Channel (TChannelDefinition) + State (co-localisés, ADR-09)
  product.entity.ts        # Entity (structure de données)
  product.view.ts          # View (rendu UI)
  product.composer.ts      # Composer(s) optionnel(s)
  product.behavior.ts      # Behavior(s) optionnel(s)
  --- hors scope framework ---
  product.styles.scss      # Styles
  product.template.pug     # Template PugJS
```

> Cette convention garantit :
>
> - **Lisibilité** : chaque fichier a un rôle identifiable par son suffixe
> - **Colocation** : tout le domaine est regroupé dans un seul dossier
> - **Cohérence** : alignement avec les pratiques Angular, familières à l'écosystème

---

## Références

- [Philosophie](../1-philosophie.md) et [Architecture](../2-architecture/README.md) — principes et composants
- [Invariants](invariants.md) — règles non négociables
- [ADR](../../adr/README.md) — décisions et leurs raisons
- [Framework Style Guide](../../guides/FRAMEWORK-STYLE-GUIDE.md) — Conventions d'usage du framework applicatif
- [Conventions de typage](../6-transversal/conventions-typage.md) — Contrats TypeScript
- [Glossaire des types exportés](types-index.md) — index des types publics
