# ADR-0021 : Composition monde ouvert — Plateforme & extension points

> **Comment permettre à des modules tiers de contribuer dynamiquement des composants (Views, Features, Behaviors) dans une application Bonsai jouant le rôle de plateforme, sans casser l'isolation ni l'architecture ?**

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟡 Proposed |
| **Date** | 2026-03-27 |
| **Mis à jour** | 2026-04-01 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0001-composants](../rfc/2-architecture/README.md), [RFC-0002 §7](../rfc/6-transversal/conventions-typage.md#7-application) |
| **Invariants impactés** | I21, I23, I24, I33, I35, I37 |
| **Décisions impactées** | D1, D6, D15, D21, D22 |
| **Dépendances** | ADR-0010 (bootstrap order), ADR-0018 (Foundation contract), ADR-0019 (Mode ESM — mécanisme BonsaiRegistry), ADR-0020 (N-instances Composer) |

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Pourquoi anticiper maintenant](#pourquoi-anticiper-maintenant)
3. [Taxonomie des cas d'usage](#taxonomie-des-cas-dusage)
4. [Tensions architecturales](#tensions-architecturales)
5. [Contraintes non négociables](#contraintes-non-négociables)
6. [Options considérées](#options-considérées)
   - [Option A — Plugin packages (bootstrap-time)](#option-a--plugin-packages-bootstrap-time)
   - [Option B — Extension Point Registry (runtime contributions)](#option-b--extension-point-registry-runtime-contributions)
   - [Option C — Micro-kernel (tout est plugin)](#option-c--micro-kernel-tout-est-plugin)
7. [Analyse comparative](#analyse-comparative)
8. [Sous-problèmes transversaux](#sous-problèmes-transversaux)
9. [Décision](#décision)
10. [Conséquences](#conséquences)
11. [Historique](#historique)

---

## Relation avec ADR-0019 et ADR-0020

Ce document (ADR-0021) est le **troisième volet** d'une trilogie architecturale :

| ADR | Sujet | Relation avec ADR-0021 |
|-----|-------|------------------------|
| **ADR-0019** | Mode ESM Modulaire | Fournit `BonsaiRegistry` comme mécanisme technique — ADR-0021 l'utilise pour la contribution ouverte |
| **ADR-0020** | N-instances Composer + CDH réduit | Fournit `resolve()` étendu et la sémantique N-instances — ADR-0021 en dépend pour le Platform Composer |
| **ADR-0021** | Monde ouvert / Plateforme | Ce document — Niveaux 2-3 d'extensibilité bâtis sur les primitives des deux ADR précédents |

Le découpage résulte de la réflexion architecturale du 2026-03-30/31 :
- Le périmètre initial de cet ADR était trop large (4 niveaux d'extensibilité très différents mélangés)
- **Niveau 1** (Plugin packages bootstrap-time) → couvert par **ADR-0019** (ESM + `BonsaiRegistry`)
- **Niveau 2** (Contribution points) + **Niveau 3** (Late registration) → couvert par **ADR-0021** (ce document)
- **Niveau 4** (Micro-apps isolées) → hors périmètre, future RFC multi-application

> **Note (2026-04-01)** : Ce document a été renommé de ADR-0019 en ADR-0021 pour refléter
> le nouveau découpage. Le contenu (options, tensions, contraintes, SP1–SP5) est conservé intégralement.

---

## Contexte

L'architecture Bonsai actuelle repose sur un modèle **fermé et statique** :

1. **Toutes les Features** sont enregistrées via `app.register()` **avant** `app.start()` (D6)
2. **Tous les Channels** sont créés et câblés au bootstrap (D15, étape 3)
3. **Tous les Composers** connaissent statiquement les Views qu'ils peuvent instancier (`resolve()` retourne un constructeur connu)
4. **Les namespaces** sont vérifiés une seule fois pour unicité (I21, I24, étape 2)
5. **Radio** est câblé une fois pour toutes (étape 3) — pas de re-câblage

Ce modèle garantit des propriétés fortes : vérification compile-time, isolation des composants, pas de race condition au démarrage, bootstrap déterministe. **C'est un atout, pas un défaut.**

Mais si Bonsai a du succès — et c'est le but — un besoin va émerger inévitablement : **l'extensibilité par des tiers.**

### Le besoin fondamental

> *Comment permettre à des modules tiers (packages npm, plugins internes, widgets isolés) d'enregistrer dynamiquement des Features, Views, Composers, Behaviors, ou des « points d'intégration » dans une application Bonsai existante, sans casser l'isolation ni l'architecture ?*

Ce besoin est universel dans les frameworks qui atteignent une certaine maturité :

| Framework | Mécanisme d'extension | Modèle |
|-----------|----------------------|--------|
| **VS Code** | Extension API + contribution points (JSON manifest) | Déclaratif + lazy |
| **WordPress** | Hooks (actions + filters) + plugin registry | Impératif |
| **Vue.js** | `app.use(plugin)` avant `app.mount()` | Bootstrap-time |
| **EditorJS** | `tools` config object (constructors) | Bootstrap-time |
| **Backstage** | Plugin API + extension points | Déclaratif + runtime |
| **Eclipse** | Extension points + extension registry (XML) | Déclaratif |

---

## Pourquoi anticiper maintenant

On ne va pas implémenter les extension points en v1. Mais on doit **s'assurer que l'architecture v1 ne ferme pas la porte**. Concrètement :

| Risque | Si non anticipé | Si anticipé |
|--------|----------------|-------------|
| **`register()` avant `start()` uniquement** | Un tiers ne peut pas s'ajouter après le bootstrap. Migration douloureuse. | L'API `register()` est conçue pour être extensible (phase 2). |
| **Namespaces hardcodés** | Collision de namespaces entre l'hôte et un plugin — crash runtime. | Convention de namespaces scopés (ex: `@plugin/feature`). |
| **Composer fermé** | `resolve()` ne peut retourner que des Views connues à la compilation. Pas de slot extensible. | `resolve()` peut consulter un registre de contributions. |
| **Radio singleton global** | Pas de cloisonnement — un plugin voit tous les Channels de l'hôte. | Radio scopable (préparation multi-app, cf. ADR-0018 §hors périmètre). |

L'objectif de cet ADR est de **documenter les options et les implications** pour que les décisions v1 soient compatibles avec l'extensibilité future.

---

## Taxonomie des cas d'usage

Les besoins d'extensibilité ne sont pas tous identiques. On identifie **4 niveaux** de complexité croissante :

### Niveau 1 — Plugin package (bibliothèque de composants)

> *Un package npm exporte des composants Bonsai que l'application hôte importe et enregistre au bootstrap.*

**Exemples** :
- `@bonsai/rich-text-editor` exporte `EditorFeature`, `EditorToolbarView`, `MarkdownBehavior`
- `@my-org/analytics` exporte `AnalyticsFeature` qui écoute des Events applicatifs
- `@bonsai/forms` exporte `FormBehavior` pour la validation de formulaires

**Caractéristiques** :
- Enregistrement **avant** `start()` — phase bootstrap classique
- Types connus à la compilation (import statique)
- Pas de late registration
- L'hôte contrôle totalement ce qu'il importe

```typescript
import { EditorFeature } from '@bonsai/rich-text-editor';
import { AnalyticsFeature } from '@my-org/analytics';

const app = new Application();
app.register(CartFeature);          // Feature hôte
app.register(EditorFeature);        // Plugin package — enregistré identiquement
app.register(AnalyticsFeature);     // Plugin package — enregistré identiquement
app.start();
```

### Niveau 2 — Contribution point (slot extensible)

> *L'application hôte définit des « points de contribution » où des modules tiers peuvent injecter du contenu sans que l'hôte les connaisse à l'avance.*

**Exemples** :
- Un back-office définit un menu latéral → des plugins ajoutent des entrées de menu
- Un dashboard définit une zone « widgets » → des plugins ajoutent des cartes
- Un éditeur définit une toolbar → des plugins ajoutent des outils

**Caractéristiques** :
- L'hôte déclare **où** l'extension est possible (le contrat)
- Le tiers déclare **quoi** il contribue (l'implémentation)
- La liaison se fait au bootstrap (pas de late registration)
- Le Composer du slot consulte un registre de contributions

```typescript
// ── L'hôte déclare un extension point ──
interface IToolbarContribution {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly viewClass: typeof View;
  readonly order?: number;
}

// ── Le plugin contribue ──
class MarkdownPlugin extends Feature {
  static readonly contributions = {
    'toolbar:tools': {
      id: 'markdown',
      label: 'Markdown',
      icon: 'edit',
      viewClass: MarkdownToolView,
      order: 10,
    } satisfies IToolbarContribution,
  };
}
```

### Niveau 3 — Late registration (enregistrement post-bootstrap)

> *Un module est chargé dynamiquement (lazy-loading, code-splitting) et doit s'intégrer dans une application déjà démarrée.*

**Exemples** :
- Un route handler charge un feature module à la demande : `/admin → AdminFeature`
- Un plugin marketplace installe un plugin sans recharger la page
- Un A/B test active une Feature expérimentale au runtime

**Caractéristiques** :
- Le module arrive **après** `start()` — la couche abstraite est déjà câblée
- Nécessite un re-câblage partiel de Radio (nouveaux Channels)
- Les Views existantes doivent être notifiées (nouveau contenu dans un slot)
- Risque de race condition (messages émis avant que le listener soit câblé)

```typescript
// Late registration — le module est chargé dynamiquement
const AdminFeature = await import('./features/admin.feature');
app.registerLate(AdminFeature.default);
// → Radio re-câble le Channel 'admin'
// → Le Composer du slot admin est notifié
// → Il appelle resolve() à nouveau → instancie AdminDashboardView
```

### Niveau 4 — Micro-applications isolées

> *Plusieurs instances d'Application coexistent sur la même page, chacune avec son scope DOM, son Radio et ses Features.*

**Exemples** :
- Un back-office avec des widgets EditorJS (chacun est une micro-app Bonsai)
- Un portail agrège plusieurs micro-frontends Bonsai
- Un outil de démonstration monte/démonte des apps dans des iframes logiques

**Caractéristiques** :
- Chaque Application a son propre Radio, ses propres Features
- Les micro-apps ne partagent rien par défaut (isolation totale)
- Communication inter-apps via un canal dédié (opt-in)
- Le scope DOM de chaque app est un conteneur (pas `<body>`)

> ⚠️ **Le Niveau 4 est hors périmètre de cet ADR.** Il est tracé ici pour complétude mais fera l'objet d'une future RFC dédiée sur le multi-application (cf. ADR-0018 §hors périmètre).

---

## Tensions architecturales

L'extensibilité par des tiers crée des tensions avec **5 piliers** de l'architecture Bonsai :

### Tension T1 — Bootstrap statique vs enregistrement dynamique

| Aujourd'hui (D6, ADR-0010) | Besoin extensibilité |
|---------------------------|---------------------|
| `register()` puis `start()` — séquence figée | Un plugin doit pouvoir s'enregistrer après `start()` (Niveau 3) |
| La couche abstraite est **intégralement définie** avant la couche concrète | Un lazy-loaded plugin apporte Feature + Views ensemble |
| Vérifications d'unicité au bootstrap (I21, I24) | Un plugin post-bootstrap doit aussi être vérifié |

**Impact** : `Application` (D6) doit rester dormante au runtime, mais pouvoir accepter un `registerLate()` qui relance une micro-séquence de bootstrap pour le nouveau module.

### Tension T2 — Typage compile-time vs contributions runtime

| Aujourd'hui | Besoin extensibilité |
|-------------|---------------------|
| `listen: [Cart.channel]` — type vérifié à la compilation | Un plugin peut écouter un Channel qui n'existe pas encore dans l'hôte |
| `trigger(Cart.channel, 'addItem', payload)` — commande et payload typés | Un plugin contribue des commandes inconnues de l'hôte |
| `resolve()` retourne `typeof View` — constructeur connu | Un Composer ouvert reçoit des View classes d'un registre |

**Impact** : Deux niveaux de typage :
- **Intra-module** : full compile-time safety (le plugin connaît ses propres types)
- **Inter-module** : contrat d'extension point (interface publique, vérification au `register()`)

### Tension T3 — Isolation Channel vs communication inter-modules

| Aujourd'hui (D1, D14) | Besoin extensibilité |
|-----------------------|---------------------|
| Radio câble uniquement les Channels déclarés statiquement | Un plugin apporte de nouveaux Channels |
| `listen` / `trigger` requièrent un token importé → couplage explicite | Un plugin doit pouvoir écouter des Events de l'hôte sans import circulaire |
| Pas de « bus global » — chaque Channel est scopé | Un mécanisme de découverte est nécessaire pour les contributions |

**Impact** : Un Channel dédié `extensions` (namespace réservé) pourrait servir de point de coordination, sans casser l'isolation des autres Channels.

### Tension T4 — Composer fermé vs slot extensible

| Aujourd'hui (D21) | Besoin extensibilité |
|-------------------|---------------------|
| `resolve()` retourne un constructeur de View connu | `resolve()` doit pouvoir consulter un registre de contributions |
| Le Composer connaît statiquement ses Views possibles | Les contributions peuvent arriver de n'importe quel plugin |
| Un Composer gère 0/1 View (D24) | Un slot extensible peut accueillir N contributions (liste) |

**Impact** : Le Composer reste un décideur pur (D23). Mais son `resolve()` peut recevoir les contributions en input (via `request` sur le Channel `extensions`).

### Tension T5 — Namespace unicité vs namespace tiers

| Aujourd'hui (I21) | Besoin extensibilité |
|-------------------|---------------------|
| Namespace = `camelCase` plat, unique dans l'app | Risque de collision entre l'hôte et un plugin, ou entre deux plugins |
| Collision = erreur fatale au bootstrap | Le message d'erreur doit aider à diagnostiquer (quel plugin ?) |
| Pas de convention de scoping | Pas de garantie qu'un plugin npm ne squatte un namespace interne |

**Impact** : Convention de namespaces scopés pour les plugins : `@vendor/featureName` ou préfixe conventionnel `pluginName.featureName`.

---

## Contraintes non négociables

Quel que soit le modèle d'extensibilité retenu, les contraintes suivantes **ne sont pas négociables** :

| # | Contrainte | Justification |
|---|-----------|---------------|
| **C1** | **Isolation des Channels** — un plugin ne peut pas accéder à un Channel qu'il n'a pas déclaré dans `listen` / `trigger` / `request` | I4, I10, D14. L'extensibilité ne doit pas créer de couplages cachés. |
| **C2** | **Vérification des namespaces** — collision = erreur, même pour les plugins | I21, I24. L'unicité des namespaces est un invariant non négociable. |
| **C3** | **Pas de modification des composants hôte** — un plugin ne peut pas monkey-patcher une Feature, une View ou un Behavior de l'hôte | Principe d'encapsulation. Un plugin **ajoute**, il ne **modifie** pas. |
| **C4** | **Type-safety intra-module** — le code d'un plugin est compile-time safe en interne | Philosophie Bonsai. Un plugin mal typé est un bug du plugin, pas du framework. |
| **C5** | **Bootstrap déterministe** — l'ordre des plugins ne doit pas changer le comportement (sauf priorité explicite) | ADR-0010. La reproductibilité du bootstrap est critique. |
| **C6** | **Pas de bus global** — pas de `EventEmitter` générique, pas de `*` wildcard cross-channel, pas de `Radio.channel('any')` | D1, D14. L'architecture Channel est structurée, pas un bus. |
| **C7** | **Pas d'import dynamique implicite** — tout chargement de code tiers est explicite et auditable | Convention Bonsai. `import()` dynamique interdit sauf cas documenté (D9). |

---

## Options considérées

### Option A — Plugin packages (bootstrap-time)

**Description** : L'extensibilité se limite à des **packages npm** qui exportent des composants Bonsai standard. L'application hôte les importe et les enregistre **avant** `start()`, exactement comme ses propres composants. Le framework ne change pas. La seule addition est un **contrat de plugin** (interface `IBonsaiPlugin`) et une convention de namespaces scopés.

#### Contrat plugin

```typescript
/**
 * Contrat qu'un package tiers doit respecter pour être un plugin Bonsai.
 *
 * Un plugin est un module qui exporte :
 * - Des Features (avec leurs Channels, Entities)
 * - Des Views, Behaviors (optionnels — composants de couche concrète)
 * - Des déclarations de contribution (optionnel — si l'hôte expose des extension points)
 *
 * Le plugin NE modifie PAS les composants de l'hôte (C3).
 * Le plugin NE crée PAS de side-effects à l'import (C7).
 */
interface IBonsaiPlugin {
  /** Identifiant unique du plugin (convention : @vendor/plugin-name) */
  readonly id: string;

  /** Version semver du plugin */
  readonly version: string;

  /** Features à enregistrer auprès de Application */
  readonly features: ReadonlyArray<typeof Feature>;

  /**
   * Dépendances Channel — namespaces que le plugin déclare écouter.
   * Le framework vérifie au bootstrap que ces Channels existent.
   * Si un Channel manque → erreur explicite (pas un silence).
   */
  readonly channelDependencies?: ReadonlyArray<string>;

  /**
   * Contributions aux extension points de l'hôte.
   * Chaque clé est un extension point id, la valeur est la contribution.
   * Le framework ne valide les contributions que si un ContributionRegistry existe.
   */
  readonly contributions?: Readonly<Record<string, unknown>>;
}
```

#### Enregistrement

```typescript
import { RichTextPlugin } from '@bonsai/rich-text-editor';
import { AnalyticsPlugin } from '@my-org/analytics';

const app = new Application();

// Features hôte
app.register(CartFeature);
app.register(UserFeature);

// Plugins tiers — enregistrés via le contrat
app.use(RichTextPlugin);
app.use(AnalyticsPlugin);

// Le framework :
// 1. Vérifie l'id du plugin (unicité)
// 2. Enregistre chaque Feature du plugin (app.register(...) en interne)
// 3. Vérifie les channelDependencies (existent-elles déjà ?)
// 4. Stocke les contributions (si ContributionRegistry activé)

app.start();
```

#### Namespaces scopés

```typescript
// Convention de nommage pour les plugins :
// @vendor/feature-name → namespace "vendor.featureName"

// Plugin
class EditorFeature extends Feature {
  // Namespace scopé par le vendor — pas de collision avec l'hôte
  static readonly channel = declareChannel('bonsai.richTextEditor', { /* ... */ });
}

// Hôte — namespace classique (pas de scope)
class CartFeature extends Feature {
  static readonly channel = declareChannel('cart', { /* ... */ });
}
```

> **Convention** : les plugins **tiers** utilisent un namespace préfixé par le vendor en dot-notation (`vendor.featureName`). Les Features de l'application **hôte** utilisent un namespace plat (`featureName`). I21 s'applique sur l'ensemble.

| Avantages | Inconvénients |
|-----------|---------------|
| + **Zéro changement d'architecture** — l'existant suffit | - Pas de late registration (Niveau 3 impossible) |
| + Typage compile-time complet (import statique) | - L'hôte doit importer explicitement chaque plugin |
| + Vérification bootstrap (D6) intacte | - Pas de slot extensible natif (Niveau 2 limité) |
| + Convention simple (`app.use(plugin)` est un helper, pas un nouveau concept) | - Les contributions sont un tableau non typé (`unknown`) |
| + Pas de re-câblage Radio | - Pas de mécanisme de découverte de plugins |
| + Le développeur contrôle exactement ce qui entre dans l'app | |

---

### Option B — Extension Point Registry (runtime contributions)

**Description** : L'application hôte peut déclarer des **extension points** — des emplacements formalisés où des plugins peuvent contribuer des composants. Un **ContributionRegistry** (Feature framework réservée, comme Router) gère les contributions. Le Composer peut consulter ce registre pour décider quoi monter dans un slot extensible.

#### Concepts introduits

```
┌────────────────────────────────────────────────────────────┐
│  Application hôte                                          │
│                                                            │
│  ┌───────────────────┐     ┌───────────────────────────┐   │
│  │ Extension Point   │───▶│  ContributionRegistry     │   │
│  │ "toolbar:tools"   │     │  (Feature framework)      │   │
│  │ "sidebar:menu"    │     │                           │   │
│  │ "dashboard:cards" │     │  namespace: 'extensions'  │   │
│  └───────────────────┘     └──────────┬────────────────┘   │
│                                       │                    │
│                          ┌────────────┴──────────┐         │
│                          │  Contributions        │         │
│                          │  Plugin A → toolbar   │         │
│                          │  Plugin B → toolbar   │         │
│                          │  Plugin B → sidebar   │         │
│                          └───────────────────────┘         │
└────────────────────────────────────────────────────────────┘
```

#### Extension Point — déclaré par l'hôte

```typescript
/**
 * Déclaration d'un extension point par l'application hôte.
 *
 * Un extension point définit :
 * - Un identifiant unique (convention: 'zone:type')
 * - Le contrat TypeScript que les contributions doivent respecter
 * - Des contraintes optionnelles (max contributions, ordre, etc.)
 *
 * L'extension point est déclaratif — il ne contient pas de logique.
 */
interface IExtensionPoint<TContribution> {
  /** Identifiant unique de l'extension point */
  readonly id: string;

  /** Description humaine pour les DevTools (RFC-0004) */
  readonly description: string;

  /**
   * Nombre maximum de contributions acceptées.
   * undefined = illimité.
   */
  readonly maxContributions?: number;
}

// Déclaré par l'hôte
const ToolbarToolsExtensionPoint: IExtensionPoint<IToolContribution> = {
  id: 'toolbar:tools',
  description: 'Outils additionnels dans la toolbar principale',
};

interface IToolContribution {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly viewClass: typeof View;
  readonly order?: number;
}
```

#### ContributionRegistry — Feature framework

```typescript
/**
 * ContributionRegistry — Feature framework réservée (comme Router).
 *
 * Namespace réservé : 'extensions' (I21 — collision impossible).
 *
 * Capacités Channel :
 * - Command  'contribute'         → un plugin enregistre une contribution
 * - Command  'retract'            → un plugin retire une contribution
 * - Event    'contributionAdded'  → notifie les Composers intéressés
 * - Event    'contributionRemoved'→ notifie les Composers intéressés
 * - Request  'getContributions'   → un Composer demande les contributions d'un point
 * - Request  'getExtensionPoints' → liste les extension points déclarés (DevTools)
 */
const extensionsChannel = declareChannel('extensions', {
  commands: {
    contribute: {} as {
      extensionPoint: string;
      pluginId: string;
      contribution: unknown;
    },
    retract: {} as {
      extensionPoint: string;
      pluginId: string;
      contributionId: string;
    },
    declareExtensionPoint: {} as {
      extensionPoint: IExtensionPoint<unknown>;
    },
  },
  events: {
    contributionAdded: {} as {
      extensionPoint: string;
      pluginId: string;
      contribution: unknown;
    },
    contributionRemoved: {} as {
      extensionPoint: string;
      contributionId: string;
    },
  },
  requests: {
    getContributions: {} as {
      params: { extensionPoint: string };
      reply: ReadonlyArray<unknown>;
    },
    getExtensionPoints: {} as {
      params: Record<string, never>;
      reply: ReadonlyArray<IExtensionPoint<unknown>>;
    },
  },
});
```

#### Composer ouvert — consulte le registre

```typescript
/**
 * Un Composer "ouvert" — son resolve() consulte le ContributionRegistry
 * au lieu d'un switch/case statique.
 *
 * Il reste un décideur pur (D23) — il ne connaît pas les Views à l'avance,
 * mais il applique une logique de sélection sur les contributions disponibles.
 */
class ToolbarComposer extends Composer {
  static readonly listen = [extensionsChannel] as const;
  static readonly request = [extensionsChannel] as const;

  resolve(): typeof View | null {
    const contributions = this.request(
      extensionsChannel, 'getContributions', { extensionPoint: 'toolbar:tools' }
    ) as ReadonlyArray<IToolContribution>;

    // Logique de sélection — le Composer décide (D21)
    const activeToolId = this.request(ToolsPanel.channel, 'getActiveTool');
    const active = contributions.find(c => c.id === activeToolId);
    return active?.viewClass ?? null;
  }

  // Réagit à l'ajout/suppression de contributions pour re-résoudre
  onExtensionsContributionAddedEvent(payload: { extensionPoint: string }): void {
    if (payload.extensionPoint === 'toolbar:tools') {
      this.reevaluate(); // Méthode framework — relance resolve()
    }
  }
}
```

#### Plugin avec contributions

```typescript
// ── Plugin package ──
const MarkdownPlugin: IBonsaiPlugin = {
  id: '@bonsai/markdown',
  version: '1.0.0',
  features: [MarkdownFeature],
  contributions: {
    'toolbar:tools': {
      id: 'markdown-editor',
      label: 'Markdown',
      icon: 'edit',
      viewClass: MarkdownEditorView,
      order: 20,
    } satisfies IToolContribution,
  },
};

// ── Enregistrement ──
const app = new Application();
app.register(ToolsPanelFeature);    // Feature hôte qui déclare l'extension point
app.use(MarkdownPlugin);            // Plugin — Feature + contributions
app.use(EmojiPlugin);               // Autre plugin — même extension point
app.start();
```

#### Late registration (Niveau 3)

```typescript
// Le plugin est chargé après start() — lazy loading
const SpellCheckPlugin = await import('@bonsai/spell-check');

/**
 * registerLate() exécute une micro-séquence de bootstrap :
 * 1. Vérification namespace (I21)
 * 2. Création Channel dans Radio (D15)
 * 3. Câblage des déclarations listen/trigger/request
 * 4. onInit() de la Feature
 * 5. Enregistrement des contributions
 * 6. Émission 'contributionAdded' → Composers notifiés → reevaluate()
 */
await app.registerLate(SpellCheckPlugin.default);
```

> ⚠️ **Garantie d'ordre** : les Events émis **avant** `registerLate()` ne sont pas rejoués. Le plugin late-registered démarre dans l'état courant. S'il a besoin de données antérieures, il utilise `request` pour interroger les Features existantes.

| Avantages | Inconvénients |
|-----------|---------------|
| + Extension points formalisés — contrat typé | - Nouveau concept (ContributionRegistry) |
| + Late registration possible (Niveau 3) | - Complexité de `registerLate()` (re-câblage Radio) |
| + Composer ouvert — sans casser D21/D23 | - Le type des contributions est `unknown` au point de liaison (cast nécessaire) |
| + `contributionAdded` / `contributionRemoved` = réactivité native | - Race conditions possibles avec late registration |
| + Visible dans DevTools (RFC-0004) — extension points, contributions | - Over-engineering si peu de plugins |
| + Compatible avec le modèle Bootstrap-time (Option A ⊂ Option B) | - Le Composer doit comprendre `reevaluate()` (nouveau concept) |
| + Contributions retirées quand le plugin est détruit | |

---

### Option C — Micro-kernel (tout est plugin)

**Description** : L'Application devient un **micro-kernel**. Il n'y a plus de distinction entre « composants hôte » et « plugins ». **Tout** est un plugin : les Features, le Router, même la Foundation. Le bootstrap est un assemblage de plugins déclaré dans une configuration.

```typescript
// Tout est plugin — y compris les "composants hôte"
const app = new Application({
  plugins: [
    CorePlugin,           // Foundation, Router, Extensions Registry
    CartPlugin,           // Feature Cart
    UserPlugin,           // Feature User
    MarkdownPlugin,       // Plugin tiers
    AnalyticsPlugin,      // Plugin tiers
  ],
  extensionPoints: [
    ToolbarToolsExtensionPoint,
    SidebarMenuExtensionPoint,
  ],
});

app.start();
```

```typescript
// Chaque plugin déclare ses dépendances
const CartPlugin: IBonsaiPlugin = {
  id: 'cart',
  version: '1.0.0',
  features: [CartFeature],
  dependencies: ['user'],           // Dépend du plugin User
  optionalDependencies: ['analytics'], // Optionnel — si présent, envoie des events
};
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Architecture maximalement extensible | - **Remise en cause profonde** de D6 (Application légère) |
| + Modèle uniforme (tout est plugin) | - Complexité exponentielle (résolution de dépendances, ordre, cycles) |
| + Lazy-loading natif par plugin | - Le développeur perd la vue d'ensemble — tout est indirect |
| + Très proche des patterns Eclipse/VS Code | - Over-engineering massif pour la majorité des apps Bonsai |
| + Testabilité : chaque plugin est indépendant | - Les invariants Bonsai (I21, I24, I33) deviennent des contraintes de graphe de dépendances |
| | - Le bootstrap déterministe (ADR-0010) est beaucoup plus dur à garantir |
| | - **v1 release retardée significativement** |

---

## Analyse comparative

| Critère | Option A (Plugin packages) | Option B (Extension Registry) | Option C (Micro-kernel) |
|---------|---------------------------|-------------------------------|------------------------|
| **Niveaux couverts** | 1 | 1, 2, 3 | 1, 2, 3 |
| **Changement d'architecture** | Aucun (convention + helper) | Moyen (1 Feature framework + `registerLate`) | Majeur (refonte Application) |
| **Type-safety** | ⭐⭐⭐ — compile-time complet | ⭐⭐ — intra-module compile-time, inter-module runtime | ⭐⭐ — idem B |
| **DX** | ⭐⭐⭐ — simple, familier | ⭐⭐ — concepts nouveaux mais cohérents | ⭐ — courbe d'apprentissage élevée |
| **Late registration** | ❌ | ✅ (`registerLate()`) | ✅ (natif) |
| **Extension points** | ❌ (convention manuelle) | ✅ (formalisés) | ✅ (formalisés) |
| **Risque v1** | Nul | Faible (Feature framework isolée) | Élevé (refonte) |
| **Compatibilité ascendante** | A ⊂ B ⊂ C | B ⊃ A | C ⊃ B ⊃ A |
| **Complexité implémentation** | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Cohérence Bonsai** | ⭐⭐⭐ — zéro nouveau concept | ⭐⭐⭐ — bâti sur les primitives existantes (Channel, Feature, Composer) | ⭐ — remet en cause des piliers |
| **Scalabilité (écosystème)** | ⭐ — pas de découverte, pas de slots | ⭐⭐⭐ — écosystème de plugins viable | ⭐⭐⭐ — idem |
| **Testabilité plugins** | ⭐⭐ — test comme une Feature | ⭐⭐⭐ — test contributions isolément | ⭐⭐⭐ — test par plugin |

### Matrice de compatibilité

```
Option A ─────────────▶ Option B ─────────────▶ Option C
  (v1)         (migration douce)     (migration lourde)
  Plugin       Extension Points     Micro-kernel
  packages     + Late registration  Tout est plugin
```

> **Propriété clé** : A ⊂ B ⊂ C — chaque option est un **surensemble** de la précédente. Un plugin écrit pour l'Option A fonctionne dans B et C. Cela permet une **migration incrémentale**.

---

## Sous-problèmes transversaux

### SP1 — Découverte et documentation des extension points

Comment un développeur de plugin sait-il quels extension points existent dans une application hôte ?

| Approche | Description |
|----------|-------------|
| **Documentation** | L'hôte documente ses extension points dans un README. Le plugin lit la doc. |
| **TypeScript** | L'hôte exporte un package de types (`@app/extension-types`) avec les interfaces de contribution. Le plugin les importe. |
| **DevTools** | RFC-0004 expose les extension points déclarés dans le panneau DevTools. |
| **Manifest** | Un fichier `bonsai-extensions.json` dans l'hôte liste les points. Outillage CLI de validation. |

### SP2 — Versioning des contrats d'extension

Que se passe-t-il quand l'hôte modifie le contrat d'un extension point ?

```typescript
// v1 du contrat
interface IToolContribution_v1 {
  id: string;
  label: string;
  viewClass: typeof View;
}

// v2 du contrat — ajout d'un champ obligatoire
interface IToolContribution_v2 extends IToolContribution_v1 {
  icon: string;          // Nouveau champ obligatoire
  category?: string;     // Nouveau champ optionnel
}
```

**Règle proposée** : les extension points suivent le **même principe que les ADR** — un contrat publié ne se modifie pas de façon breaking. Si le contrat doit changer de façon incompatible, on crée un nouvel extension point (`toolbar:tools:v2`) et on déprécie l'ancien.

### SP3 — Sécurité et sandboxing

Un plugin tiers malveillant ou bogué pourrait :
- Écouter des Channels sensibles (ex: `user.privateData`)
- Envoyer des Commands non autorisées
- Causer des erreurs qui crashent l'application hôte

**Mesures immédiates (v1)** :
- **C1** s'applique : un plugin ne peut écouter que les Channels déclarés dans ses dépendances
- **ADR-0002** (error propagation) isole les erreurs : un crash dans un handler de plugin ne bloque pas les autres
- **C3** empêche le monkey-patching

**Extension future (v2+) — modèle de capabilities** :

Pour les cas sensibles, un mécanisme de **permissions déclaratives** (inspiré Android / VS Code) est anticipé. Le plugin déclare ses capacités dans son contrat ; le framework les vérifie au `register()` / `registerLate()` et refuse les accès non déclarés.

```typescript
interface IBonsaiPlugin {
  // ... (champs existants)

  /**
   * Capabilities déclaratives — modèle read/write.
   *
   * Chaque entrée référence un namespace de Channel.
   * - read  : le plugin peut écouter (listen) des Events et envoyer des Requests
   * - write : le plugin peut émettre (trigger) des Commands et émettre des Events
   *
   * Si capabilities est absent → pas de restriction (v1 compat, trust-all).
   * Si capabilities est présent → le framework vérifie chaque accès Channel
   * au câblage et refuse les accès non déclarés.
   */
  readonly capabilities?: {
    /** Channels/Events/Requests que le plugin peut lire (listen, request) */
    readonly read?: ReadonlyArray<string>;
    /** Commands/Events que le plugin peut émettre (trigger) */
    readonly write?: ReadonlyArray<string>;
  };
}
```

```typescript
// Exemple : plugin analytics en lecture seule
const AnalyticsPlugin: IBonsaiPlugin = {
  id: '@my-org/analytics',
  version: '2.0.0',
  features: [AnalyticsFeature],
  channelDependencies: ['cart', 'user'],
  capabilities: {
    read: ['cart', 'user', 'router'],  // Écoute les Events de ces Channels
    write: ['myOrg.analytics'],         // N'émet que sur son propre Channel
  },
};
// → Le framework refuse si AnalyticsFeature tente un trigger('cart', 'addItem', ...)
//   car 'cart' n'est pas dans capabilities.write
```

> ⏳ **Ce modèle est informatif** — il ne sera implémenté qu'en v2+, quand le besoin de sandboxing sera confirmé. En v1, le modèle est trust-all (pas de `capabilities` = accès complet aux Channels déclarés dans `listen`/`trigger`/`request`).

### SP4 — Cycle de vie des plugins

| Phase | Action |
|-------|--------|
| **Installation** | `app.use(plugin)` (avant `start()`) ou `app.registerLate(plugin)` (après) |
| **Activation** | Les Features sont instanciées, les Channels câblés, les contributions enregistrées |
| **Runtime** | Le plugin participe normalement à l'application (Events, Commands, Requests, Views) |
| **Désactivation** | Les contributions sont retirées, les Channels décâblés, les Views détachées |
| **Destruction** | `onDestroy()` des Features du plugin. Les Composers réagissent (reevaluate → slot vide). |

### SP4b — Garanties formelles de `registerLate()`

Si l'Option B est retenue (Phase 2), `registerLate()` est le point d'entrée le plus critique du système d'extension. Ses garanties doivent être **non ambiguës** :

| Garantie | Spécification |
|----------|---------------|
| **Asynchrone** | `registerLate()` retourne **toujours** une `Promise<void>`. La micro-séquence de bootstrap est asynchrone (câblage, `onInit()`, enregistrement contributions). L'appelant **doit** `await` le résultat avant d'interagir avec le plugin. |
| **Non annulable** | Une fois `registerLate()` appelée, la séquence s'exécute **jusqu'au bout**. Il n'existe pas de `AbortController` ni de mécanisme d'annulation. Si le plugin échoue en cours de route (namespace collision, Channel manquant), une `BonsaiError` est levée **après** rollback des étapes déjà exécutées. |
| **Idempotente** | Appeler `registerLate(plugin)` deux fois avec le même `plugin.id` **ne produit pas d'erreur** — le deuxième appel est un no-op silencieux (mode debug : warning). Un plugin déjà enregistré n'est pas ré-enregistré. |
| **Micro-bootstrap séquentiel** | La séquence interne est identique à celle du bootstrap initial, mais pour un seul plugin : (1) vérification namespace I21, (2) création Channel D15, (3) câblage Radio, (4) `onInit()`, (5) enregistrement contributions, (6) émission `contributionAdded`. |
| **Pas de replay** | Les Events émis **avant** `registerLate()` ne sont **jamais** rejoués. Le plugin démarre dans l'état courant. S'il a besoin de données antérieures, il utilise `request` pour interroger les Features existantes. |
| **Sérialisée** | Deux appels concurrents à `registerLate()` sont exécutés **séquentiellement** (file d'attente interne). Pas de race condition entre deux enregistrements tardifs simultanés. |

```typescript
/**
 * Enregistre un plugin après le bootstrap initial.
 *
 * @param plugin - Contrat IBonsaiPlugin à enregistrer
 * @returns Promise résolue quand le plugin est pleinement intégré
 * @throws BonsaiError si namespace collision (I21) ou channelDependency manquante
 *
 * Garanties :
 * - Toujours async (même si le plugin est trivial)
 * - Non annulable — s'exécute jusqu'au bout ou rollback complet
 * - Idempotente — double appel = no-op
 * - Sérialisée — pas de concurrence entre registerLate() simultanés
 */
async registerLate(plugin: IBonsaiPlugin): Promise<void>;
```

### SP5 — Namespaces scopés — convention formelle

```
Namespace plat (application hôte) :
  cart, user, router, dashboard

Namespace scopé (plugin tiers) :
  bonsai.richTextEditor    → @bonsai/rich-text-editor
  myOrg.analytics          → @my-org/analytics
  acme.spellCheck          → @acme/spell-check

Règles :
  - Le '.' est le séparateur de scope (interdit dans les namespaces plats)
  - Un namespace avec '.' est considéré comme un plugin tiers
  - L'unicité I21 s'applique sur le namespace complet (scope inclus)
  - Convention : vendor = nom npm scope sans @
```

---

## Décision

> ⏳ **En attente de décision.** Les options sont présentées pour discussion et réflexion.

### Recommandation architecte

**Stratégie incrémentale en deux phases :**

#### Phase 1 — v1 : Option A (Plugin packages)

Implémentation **minimale** pour la v1 :

1. **`app.use(plugin: IBonsaiPlugin)`** — helper qui appelle `register()` pour chaque Feature du plugin et stocke les métadonnées (id, version, channelDependencies)
2. **Convention de namespaces scopés** — dot-notation pour les plugins tiers
3. **Vérification des `channelDependencies`** au bootstrap — erreur si un Channel requis n'existe pas
4. **Pas de ContributionRegistry** — les contributions sont gérées manuellement par les Features (via Commands)

**Coût** : très faible. C'est un helper + une convention. L'architecture ne change pas.

**Ce que ça débloque** : les plugins EditorJS, les bibliothèques de Behaviors, les Feature packages réutilisables.

#### Phase 2 — v2+ : Option B (Extension Registry)

Une fois la v1 stabilisée et le besoin de Niveau 2-3 confirmé :

1. **ContributionRegistry** — Feature framework réservée (comme Router)
2. **Extension points formalisés** — `IExtensionPoint<TContribution>`
3. **`registerLate()`** — enregistrement post-bootstrap avec micro-séquence
4. **`Composer.reevaluate()`** — re-résolution d'un Composer quand une contribution change
5. **DevTools** — extension points visibles dans RFC-0004

**Ce que ça débloque** : les slots extensibles, le lazy-loading de plugins, l'écosystème.

#### Option C rejetée

L'Option C (micro-kernel) est **rejetée** pour la foreseeable future :
- Complexité disproportionnée par rapport au bénéfice
- Remise en cause de piliers fondamentaux (D6, ADR-0010)
- Le modèle A → B couvre 95% des besoins d'extensibilité réels
- Si un jour le micro-kernel est nécessaire, B → C est une migration possible (mais pas certaine)

#### Principe fondamental — Isolation contractuelle des plugins

> **Un plugin ne peut jamais affecter le comportement interne d'un autre plugin, excepté via les extension points officiels définis par l'hôte.**

Ce principe est la **règle d'or** de l'extensibilité Bonsai. Il découle directement de C1 (isolation Channel), C3 (pas de monkey-patching) et C6 (pas de bus global). Concrètement :

- Un plugin **A** ne peut pas écouter les Events internes d'un plugin **B** — sauf si **B** exporte explicitement son Channel token et que **A** le déclare dans ses dépendances.
- Un plugin ne peut pas intercepter, filtrer ou modifier les Commands/Events d'un autre plugin en transit.
- La seule surface de contact entre plugins est le **ContributionRegistry** (Phase 2) ou les **Channels explicitement partagés** (Phase 1) — jamais un mécanisme implicite.
- Un plugin qui crashe est isolé par ADR-0002 (error propagation) — les autres plugins continuent de fonctionner.

Ce principe garantit que l'ajout ou le retrait d'un plugin ne peut pas provoquer de régression dans le reste de l'application.

---

## Conséquences

### Si Phase 1 retenue (v1)

#### Nouveaux éléments

| # | Élément | Impact |
|---|---------|--------|
| **Interface `IBonsaiPlugin`** | Contrat TypeScript pour les packages tiers. Pas un concept framework — un type d'aide. |
| **`Application.use(plugin)`** | Helper qui itère sur `plugin.features` et appelle `register()`. Vérifie `channelDependencies`. |
| **Convention dot-notation** | Les namespaces avec `.` sont réservés aux plugins tiers. Documenté dans le glossaire. |

#### Invariants préservés

Tous les invariants actuels (I1–I45, I57) restent **intacts**. La Phase 1 n'ajoute aucun nouveau concept architectural — seulement une convention et un helper.

#### Fichiers impactés

| Fichier | Impact |
|---------|--------|
| [RFC-0002 §7](../rfc/6-transversal/conventions-typage.md#7-application) | Ajout de `use(plugin)` dans l'API Application |
| [RFC-0001-glossaire](../rfc/reference/glossaire.md) | Ajout définition « Plugin package », « Namespace scopé » |
| [RFC-0001-invariants-decisions](../rfc/reference/invariants.md) | Note sur I21 : les namespaces scopés (dot-notation) sont autorisés |

### Si Phase 2 retenue (v2+)

#### Nouveaux invariants (proposés)

<!-- Note : I59–I62 réservés par ADR-0018 (Suspended), I63 acté par ADR-0022 (Accepted).
     Numérotation à partir de I65 pour éviter les collisions. -->

| # | Invariant |
|---|-----------|
| **I65** | Le Channel `extensions` est un namespace **réservé** par le framework (comme `router`). Il est créé automatiquement si l'application déclare au moins un extension point. |
| **I66** | Un plugin ne peut contribuer qu'à des extension points **déclarés**. Une contribution vers un extension point inexistant est une erreur au bootstrap (strict) ou un warning (debug). |
| **I67** | `registerLate()` exécute une **micro-séquence de bootstrap** complète (vérification namespace, création Channel, câblage, onInit) avant que le plugin ne participe à l'application. Les Events émis avant `registerLate()` ne sont **pas** rejoués. |

#### Nouvelles décisions (proposées)

| # | Décision |
|---|----------|
| **D53** | Le ContributionRegistry est une Feature framework réservée (comme Router). Namespace `extensions`. Opt-in : créé uniquement si au moins un extension point est déclaré. |
| **D54** | `Composer.reevaluate()` est une méthode framework qui relance `resolve()` quand une contribution change. Le Composer **écoute** `extensions:contributionAdded` pour savoir quand ré-évaluer. |
| **D55** | Les namespaces de plugins tiers utilisent la dot-notation (`vendor.featureName`). Le `.` est le séparateur de scope. Un namespace plat (sans `.`) est réservé à l'application hôte. |

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-27 | Création sous numéro ADR-0019 (Proposed) — 3 options, stratégie incrémentale A → B recommandée |
| 2026-03-27 | Enrichissement : capabilities model (SP3), garanties formelles `registerLate()` (SP4b), isolation contractuelle des plugins |
| 2026-04-01 | Renommé ADR-0019 → ADR-0021. Découpage en trilogie : ADR-0019 (ESM), ADR-0020 (N-instances), ADR-0021 (monde ouvert). Relation avec ADR-0019/0020 documentée. |
