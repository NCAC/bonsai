# ADR-0018 : Contrat Foundation — TUIMap globale, données serveur initiales, persistance concrète et lifecycle asymétrique

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟠 Suspended — contrat minimal spécifié dans RFC-0001-composants §9, invariants I59–I62 en attente d'implémentation |
| **Date** | 2026-03-27 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0002 §11](../rfc/6-transversal/conventions-typage.md#11-foundation), [RFC-0001-composants §9](../rfc/2-architecture/README.md#9-foundation) |
| **Invariants impactés** | I33, I34, I38, I39 |
| **Décisions impactées** | D20, D27, D29 |

---

## Contexte

La Foundation est aujourd'hui le composant le plus **sous-spécifié** du framework Bonsai. Sa définition actuelle (RFC-0002 §11) se limite à :

- Point d'ancrage unique sur `<body>` (I33)
- Altération N1 (classes, attributs) sur `<html>` et `<body>` (D27)
- Déclaration de Composers racines via `get composers()` (D29)
- Capacités Channel (listen, trigger, request) — comme une View
- Écoute DOM « manuelle » dans `onAttach()` / `onDetach()` (`addEventListener` / `removeEventListener`)

**Quatre lacunes sont identifiées :**

### Lacune 1 — Événements DOM globaux : manuels, non typés, non auto-découverts

L'exemple actuel dans RFC-0002 §11.2 montre un pattern fragile :

```typescript
// Situation actuelle — problèmes identifiés
class AppFoundation extends Foundation {
  protected onAttach(): void {
    window.addEventListener('resize', this.handleResize);      // ❌ Pas auto-découvert
    document.addEventListener('visibilitychange', this.handleVisibility); // ❌ Pas typé
  }
  protected onDetach(): void {
    window.removeEventListener('resize', this.handleResize);   // ❌ Risque d'oubli
    window.removeEventListener('visibilitychange', this.handleVisibility);
  }
}
```

Ce pattern viole l'esprit de Bonsai :
- **Pas d'auto-discovery** (D12) — le framework ne câble rien, c'est du DOM brut
- **Pas de cleanup automatique** — risque de memory leak si le développeur oublie `removeEventListener`
- **Pas de type-safety** — aucune vérification compile-time des événements écoutés
- **Incohérent** avec les Views/Behaviors qui ont TUIMap + `uiEvents` + auto-discovery D48

### Lacune 2 — Aucun mécanisme de données initiales serveur

Dans une architecture SSR ou même en SPA classique, le serveur injecte fréquemment des données initiales via `<script type="application/json">` dans le HTML :

```html
<script type="application/json" id="initial-user">{"name":"Alice","role":"admin"}</script>
<script type="application/json" id="initial-config">{"locale":"fr","theme":"dark"}</script>
```

Ce pattern est standard (Next.js `__NEXT_DATA__`, Nuxt `__NUXT__`, Django templates, Rails ERB) et offre des avantages majeurs :
- **Zéro latence** — données disponibles dès le parsing HTML, pas de fetch initial
- **SEO-friendly** — le crawler voit les données dans le source HTML
- **Pas de flash** — l'UI se rend immédiatement avec les bonnes données

Aujourd'hui, la Foundation n'a aucun mécanisme formalisé pour exploiter ces données. Chaque développeur doit parser manuellement dans `onAttach()` — non typé, non standardisé, non documenté.

### Lacune 3 — Classification architecturale ambiguë

La Foundation est décrite comme composant de la **couche concrète** (créée à l'étape 6 du bootstrap, au même niveau que les Views). Mais elle est aussi décrite comme **persistante** (vit toute la session). Cette double nature n'est pas formellement documentée.

Tous les autres composants persistants (Application, Feature, Entity, Channel, Radio, Router) appartiennent à la **couche abstraite**. La Foundation est le seul composant qui est à la fois **concret** (accès DOM) et **persistant** (non détruit/recréé dynamiquement). Cette singularité mérite une formalisation.

### Lacune 4 — `onDetach()` sémantiquement invalide pour un composant persistant

Le lifecycle actuel de la Foundation emprunte celui des Views :

```
created → wired → attached → detached → [destroyed]
```

Or, `<body>` et `<html>` ne peuvent **jamais** être détachés du DOM pendant la durée de vie de l'application. Le passage par l'état `detached` est structurellement impossible. La Foundation est créée au bootstrap (étape 6) et ne meurt qu'au shutdown de la page.

Conséquences de cette lacune :
- **`onDetach()` est du code mort** — il ne sera jamais appelé en production (sauf shutdown complet)
- **Incohérence sémantique** — `onDetach()` implique un possible `re-attach`, ce qui est impossible pour Foundation
- **Confusion DX** — le développeur voit `onDetach()` et pense qu'il doit y mettre du cleanup, alors que le cleanup n'est jamais nécessaire (la page meurt)
- **Incohérent avec I59** (proposé Axe 3) — si Foundation est « concrète persistante », son lifecycle doit refléter cette persistance

Le lifecycle de Foundation devrait être **asymétrique** — un `onAttach()` sans `onDetach()` symétrique, avec un éventuel hook de shutdown distinct.

---

## Périmètre et hors périmètre

### Dans le périmètre

Cet ADR traite du contrat Foundation dans le **modèle Application unique** — une seule `Application` par page, une seule `Foundation` point racine du document.

La Foundation est le **seul composant** ayant accès exclusif aux 5 cibles globales du document :
- `document` — l'objet Document
- `window` — l'objet Window (viewport, système, réseau)
- `<html>` — l'élément racine `document.documentElement`
- `<body>` — l'élément `document.body`
- `<head>` — l'élément `document.head` (accès contrôlé N1, cf. Extension E4)

Aucune View, aucun Behavior, aucun Composer n'a accès à ces cibles.

### Hors périmètre

> **Multi-Application** : le cas d'Applications multiples isolées sur une même page (micro-apps, widgets EditorJS-like, contextes scopés) est **explicitement hors périmètre** de cet ADR. Ce sujet fera l'objet d'une **RFC dédiée** ultérieure, qui traitera notamment :
> - L'isolation des contextes Radio/Channel par Application
> - La généralisation de `rootElement` (aujourd'hui `<body>`, potentiellement un `<div>` scopé)
> - Le Router comme capacité optionnelle
> - La communication inter-applications (opt-in)
> - Les implications pour Foundation (profils « pleine page » vs « scopée »)
>
> Le design de cet ADR est pensé pour **ne pas fermer la porte** au multi-app — mais ne l'adresse pas.

---

## Contraintes

- **I33** : la Foundation est unique par application — un seul composant couvre `<body>` et `<html>`
- **I38** : Foundation = N1 uniquement sur `<html>` / `<body>` — pas de mutation structurelle
- **I39** : accès DOM via API framework, pas via DOM brut — exception Foundation déjà documentée (this.html, this.body)
- **D12** : auto-discovery par convention `onXXX` — standard pour tous les composants Channel
- **D48** : auto-discovery D48 pour les événements UI — standard pour Views et Behaviors
- **Pas de TUIMap** : la Foundation actuelle n'a pas de TUIMap (RFC-0002 §11 : « les clés ne sont pas des entrées TUIMap ») — cette contrainte est à reconsidérer
- **Compile-time > Runtime** : toute erreur détectable à la compilation ne doit jamais atteindre le runtime
- **Foundation = seul accès aux cibles globales** : `document`, `window`, `<html>`, `<body>`, `<head>` sont exclusivement accessibles via Foundation (renforce D20)

---

## Options considérées

### Option A — TUIMap pré-formée `<body>` / `<html>` + auto-discovery D48

**Description** : La Foundation reçoit un **TUIMap figé par le framework** (pas déclaré par le développeur) couvrant `<body>` et `<html>`, avec un catalogue d'événements DOM globaux auto-découvrables. Le développeur implémente les handlers qu'il souhaite via la convention `on<Target><Event>`.

```typescript
/**
 * TFoundationUIMap — TUIMap pré-formée par le framework.
 *
 * Non déclarable par le développeur — imposée par le framework.
 * Couvre exactement <body> et <html>, plus window et document
 * pour les événements globaux qui ne ciblent aucun élément.
 */
type TFoundationUIMap = {
  /** <body> — mutations N1 + événements DOM */
  body: {
    el: HTMLBodyElement;
    event: [
      'click', 'dblclick', 'contextmenu',
      'keydown', 'keyup', 'keypress',
      'focus', 'blur', 'focusin', 'focusout',
      'scroll', 'scrollend',
      'pointerdown', 'pointerup', 'pointermove',
      'dragstart', 'dragover', 'dragend', 'drop',
      'paste', 'copy', 'cut',
    ];
  };
  /** <html> — mutations N1 + événements structurels */
  html: {
    el: HTMLHtmlElement;
    event: [
      'fullscreenchange', 'fullscreenerror',
    ];
  };
  /** window — événements viewport et système */
  window: {
    el: Window;
    event: [
      'resize', 'orientationchange',
      'online', 'offline',
      'beforeunload', 'unload',
      'hashchange', 'popstate',
      'storage',
      'languagechange',
    ];
  };
  /** document — événements document-level */
  document: {
    el: Document;
    event: [
      'visibilitychange',
      'DOMContentLoaded',
      'readystatechange',
      'selectionchange',
    ];
  };
};
```

**Handlers auto-découverts** — le développeur implémente uniquement ceux qui l'intéressent :

```typescript
class AppFoundation extends Foundation {
  // ── body events (délégation globale) ──
  onBodyScroll?(e: Event): void;
  onBodyClick?(e: MouseEvent & { currentTarget: HTMLBodyElement }): void;
  onBodyKeydown?(e: KeyboardEvent & { currentTarget: HTMLBodyElement }): void;
  onBodyPaste?(e: ClipboardEvent & { currentTarget: HTMLBodyElement }): void;

  // ── html events ──
  onHtmlFullscreenchange?(e: Event): void;

  // ── window events ──
  onWindowResize?(e: UIEvent): void;
  onWindowOnline?(e: Event): void;
  onWindowOffline?(e: Event): void;
  onWindowBeforeunload?(e: BeforeUnloadEvent): void;
  onWindowPopstate?(e: PopStateEvent): void;
  onWindowStorage?(e: StorageEvent): void;

  // ── document events ──
  onDocumentVisibilitychange?(e: Event): void;
  onDocumentDOMContentLoaded?(e: Event): void;
}
```

**Cleanup automatique** : le framework câble les listeners au `onAttach()` et les décâble au shutdown — même pattern AbortController que pour les Views (RFC-0002-channel §6.5). Voir **Axe 4** pour la sémantique exacte du cleanup Foundation (`onShutdown()` vs absence de `onDetach()`).

| Avantages | Inconvénients |
|-----------|---------------|
| + Cohérent avec D48 (auto-discovery UI events) | - Catalogue figé — si un événement DOM futur n'est pas dans la liste, il faut mettre à jour le framework |
| + Type-safety complète (`MouseEvent`, `KeyboardEvent`, etc.) | - `window` et `document` ne sont pas des éléments HTML — extension du concept TUIMap |
| + Cleanup automatique (zéro risque de leak) | - 4 cibles (body, html, window, document) au lieu de 2 — plus de surface d'API |
| + Pas de `addEventListener` / `removeEventListener` manuels | |
| + IntelliSense : autocomplete les handlers disponibles | |
| + Vérification compile-time des noms d'événements | |

---

### Option B — TUIMap extensible avec catalogue + opt-in explicite

**Description** : Le framework fournit un catalogue d'événements disponibles, mais le développeur **déclare explicitement** lesquels il souhaite écouter dans un `get uiEvents()` (comme les Views). Pas de handlers implicitement disponibles.

```typescript
class AppFoundation extends Foundation {
  /**
   * Opt-in explicite — seuls les événements déclarés sont câblés.
   * Réduit la surface d'attaque et le nombre de listeners actifs.
   */
  get globalEvents() {
    return {
      window: ['resize', 'online', 'offline'] as const,
      document: ['visibilitychange'] as const,
      body: ['scroll', 'keydown'] as const,
    };
  }

  onWindowResize(e: UIEvent): void { /* ... */ }
  onWindowOnline(e: Event): void { /* ... */ }
  onDocumentVisibilitychange(e: Event): void { /* ... */ }
  onBodyScroll(e: Event): void { /* ... */ }
  onBodyKeydown(e: KeyboardEvent): void { /* ... */ }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Opt-in explicite — zéro listener inutile | - Boilerplate supplémentaire (déclaration `get globalEvents()`) |
| + Le développeur voit exactement ce qui est câblé | - Risque de désynchronisation : déclarer un event sans le handler (ou l'inverse) |
| + Plus facile d'étendre le catalogue | - Moins auto-discoverable que l'Option A |
| + Cleanup automatique | - Deux points d'entrée : `globalEvents` (déclaration) + handlers `onXXX` (implémentation) |

---

### Option C — TUIMap pré-formée + catalogue extensible (hybride)

**Description** : Le framework fournit un `TFoundationUIMap` pré-formé (Option A) **mais** le développeur peut l'étendre avec des événements custom via un mécanisme de déclaration. L'auto-discovery s'applique à l'union des événements pré-formés et custom.

```typescript
class AppFoundation extends Foundation {
  // Les handlers pré-formés sont auto-découverts (Option A)
  onWindowResize(e: UIEvent): void { /* ... */ }
  onDocumentVisibilitychange(e: Event): void { /* ... */ }

  // Extension : événements custom non prévus par le framework
  static readonly extendGlobalEvents = {
    window: ['devicemotion', 'deviceorientation'] as const,
  };

  onWindowDevicemotion(e: DeviceMotionEvent): void { /* ... */ }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Meilleur des deux mondes : catalogue pré-formé + extensible | - Complexité d'implémentation plus élevée |
| + Zéro boilerplate pour les cas courants | - Deux mécanismes (auto-discovery + extension) à comprendre |
| + Évolutif sans casser le catalogue existant | - Le développeur doit connaître la frontière catalogue / custom |
| + Cleanup automatique | |

---

## Analyse comparative — Axes 1 à 4

### Axe 1 : TUIMap pré-formée + événements DOM

| Critère | Option A (Pré-formée) | Option B (Opt-in) | Option C (Hybride) |
|---------|----------------------|-------------------|-------------------|
| DX (Developer Experience) | ⭐⭐⭐ — autocomplete immédiat | ⭐⭐ — boilerplate | ⭐⭐⭐ — autocomplete + extensible |
| Type-safety | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Cohérence D48 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Performance (listeners) | ⭐⭐ — listeners câblés dès qu'un handler existe | ⭐⭐⭐ — listeners uniquement si déclarés | ⭐⭐ — idem A |
| Maintenabilité | ⭐⭐ — catalogue framework à maintenir | ⭐⭐⭐ — rien à maintenir | ⭐⭐ — idem A + extension |
| Extensibilité | ⭐ — modifier le framework | ⭐⭐⭐ — le développeur décide | ⭐⭐⭐ — extensible |

### Axe 2 : Données initiales serveur (`<script type="application/json">`)

Pour cet axe, deux sous-options sont évaluées, indépendamment du choix Axe 1.

#### Sous-option S1 — `readServerData<T>(id)` : méthode typée avec scope `<body>`

```typescript
abstract class Foundation {
  /**
   * Lit et parse un <script type="application/json"> par son id.
   * Scope : enfants directs de <body> uniquement (pas de recherche profonde).
   *
   * @param id - L'attribut `id` du <script> (sans préfixe #)
   * @returns Les données parsées et typées, ou null si non trouvé
   * @throws BonsaiError si le JSON est invalide
   *
   * Le <script> est SUPPRIMÉ du DOM après lecture (one-shot).
   * Cela évite que les données restent accessibles dans le DOM
   * après consommation et garantit une seule lecture.
   */
  protected readServerData<T extends TJsonSerializable>(id: string): T | null;
}
```

```typescript
// Côté serveur (SSR, template serveur)
// <script type="application/json" id="initial-user">{"name":"Alice","role":"admin"}</script>
// <script type="application/json" id="initial-config">{"locale":"fr","theme":"dark"}</script>

// Côté Bonsai
class AppFoundation extends Foundation {
  protected onAttach(): void {
    const userData = this.readServerData<User.ServerPayload>('initial-user');
    if (userData) {
      this.trigger(User.channel, 'hydrate', userData);
    }

    const configData = this.readServerData<App.ConfigPayload>('initial-config');
    if (configData) {
      this.trigger(App.channel, 'configure', configData);
    }
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + API simple et explicite | - Pas de typage automatique (le développeur cast avec `<T>`) |
| + One-shot : suppression après lecture = propreté DOM | - Scope `<body>` uniquement — les `<script>` dans `<head>` sont ignorés |
| + Standard web (`<script type="application/json">`) | - Pas de validation JSON schema |
| + Compatible SSR (ADR-0014) | |

#### Sous-option S2 — `get serverDataSlots()` : déclaration statique typée avec validation

```typescript
class AppFoundation extends Foundation {
  /**
   * Déclaration des slots de données serveur attendus.
   * Le framework les lit, parse et injecte au bootstrap (étape 6).
   *
   * Chaque entrée définit :
   * - L'id du <script> dans le DOM
   * - Le type attendu (via validateur optionnel)
   * - La destination (Channel + Command) pour hydrater la Feature
   */
  get serverDataSlots() {
    return {
      'initial-user': {
        target: { channel: User.channel, command: 'hydrate' as const },
        validate: (data: unknown): data is User.ServerPayload =>
          typeof data === 'object' && data !== null && 'name' in data,
      },
      'initial-config': {
        target: { channel: App.channel, command: 'configure' as const },
      },
    } as const;
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Déclaratif — le framework gère tout | - Plus complexe à typer correctement |
| + Validation optionnelle | - Coupling déclaration ↔ implémentation |
| + Auto-dispatch vers les Features | - Moins flexible (doit passer par un Command) |
| + Visible dans les DevTools (RFC-0004) | - Over-engineering si peu de données serveur |

#### Sous-option S3 — `readServerData<T>(id)` avec scope configurable

Identique à S1 mais avec un scope de recherche explicite :

```typescript
abstract class Foundation {
  /**
   * @param id - L'attribut `id` du <script>
   * @param options.scope - 'body-children' (défaut) | 'document'
   *   - 'body-children' : document.body.querySelector (enfants directs de <body>)
   *   - 'document' : document.getElementById (tout le DOM, y compris <head>)
   */
  protected readServerData<T extends TJsonSerializable>(
    id: string,
    options?: { scope?: 'body-children' | 'document' }
  ): T | null;
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Flexible — couvre `<head>` et `<body>` | - `'document'` élargit le scope de la Foundation au-delà de `<body>` (tension avec D20/I33) |
| + One-shot + suppression | - Deux comportements selon l'option — moins prévisible |
| + Couvre le cas `__NEXT_DATA__` (souvent dans `<head>`) | |

### Axe 3 : Classification architecturale — « concret persistant »

Deux sous-options :

#### Sous-option P1 — Formaliser la catégorie « concret persistant » (nouvel invariant)

Ajouter un invariant I59 :

> **I59** : La Foundation est le **seul composant** qui appartient à la couche concrète (accès DOM) **et** qui est persistant (vit toute la session applicative). Tous les autres composants concrets (View, Behavior, Composer) sont éphémères. Tous les autres composants persistants (Application, Feature, Entity, Channel, Radio, Router) sont abstraits (pas d'accès DOM).

```
┌──────────────────────────────────────────────────────────┐
│                    Couche abstraite                      | 
│                    (persistante)                         │
│  Application  Feature  Entity  Channel  Radio  Router    │
└───────────────────────────┬──────────────────────────────┘
                            │
              ╔═════════════╪══════════════╗
              ║   Foundation (I59)         ║
              ║   Concrète + Persistante   ║
              ╚═════════════╪══════════════╝
                            │
┌───────────────────────────┴──────────────────────────────┐
│                    Couche concrète                       │
│                    (éphémère)                            │
│        View        Behavior        Composer              │
└──────────────────────────────────────────────────────────┘
```

#### Sous-option P2 — Pas de formalisation supplémentaire

La mention « Persistant » dans le tableau RFC-0001-composants §9 suffit. Pas besoin d'invariant supplémentaire.

### Axe 4 : Lifecycle asymétrique — `onShutdown()` vs absence de `onDetach()`

Foundation est le seul composant concret **persistant** (proposé I59, Axe 3). Les éléments `<body>` et `<html>` ne peuvent pas être détachés du DOM. Le lifecycle symétrique `onAttach()` / `onDetach()` hérité des Views est sémantiquement invalide pour Foundation.

#### Sous-option L1 — Supprimer `onDetach()`, lifecycle `onAttach()` uniquement

La Foundation n'a qu'un seul hook lifecycle : `onAttach()`. Aucun hook de fin de vie. Le cleanup est géré par la mort de la page (garbage collection naturelle).

```typescript
abstract class Foundation {
  /**
   * Appelé une seule fois au bootstrap (étape 6).
   * Pas de symétrique onDetach() — Foundation est persistante.
   */
  protected onAttach(): void;

  // ❌ PAS de onDetach() — <body> et <html> ne sont jamais détachés
}
```

```
Lifecycle Foundation (L1) :
  created → wired → attached → [page unload]
                                    └─ GC naturel, pas de hook
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Sémantiquement correct — pas de faux hook | - Pas de point d'extension pour le shutdown graceful |
| + Simple — moins de surface d'API | - Tests : impossible de nettoyer proprement entre tests |
| + Cohérent avec la réalité DOM | - Hot-reload : pas de hook pour libérer les ressources |
| + Pas de confusion DX | - Si l'app utilise un AbortController pour les listeners, qui le signale ? |

#### Sous-option L2 — Remplacer `onDetach()` par `onShutdown()`

La Foundation a un hook spécifique `onShutdown()` — distinct de `onDetach()` des Views. Il est appelé par `Application.shutdown()` (si ce concept existe) ou implicitement au `beforeunload`.

```typescript
abstract class Foundation {
  /** Appelé une seule fois au bootstrap (étape 6). */
  protected onAttach(): void;

  /**
   * Appelé au shutdown de l'Application — PAS un detach.
   *
   * Cas d'appel :
   * 1. Application.shutdown() explicite (tests, hot-reload)
   * 2. beforeunload (implicite, best-effort)
   *
   * Le framework :
   * - Signale l'AbortController (cleanup des listeners)
   * - Appelle onShutdown() pour le cleanup développeur
   * - Détache les Composers racines (cascade de detach Views)
   *
   * Différence avec onDetach() des Views :
   * - onDetach() implique un possible re-attach → pas le cas ici
   * - onShutdown() est terminal et irréversible
   */
  protected onShutdown?(): void;
}
```

```
Lifecycle Foundation (L2) :
  created → wired → attached ──────────────────→ shutdown
                    │                                │
                    │  (toute la durée de vie)       │  Application.shutdown()
                    │                                │  ou beforeunload
                    └────────────────────────────────┘
                         Pas de detach/re-attach
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Sémantiquement correct — « shutdown » ≠ « detach » | - Introduit un nouveau concept lifecycle distinct des Views |
| + Point d'extension pour tests et hot-reload | - `beforeunload` est best-effort (pas garanti par le navigateur) |
| + Cleanup explicite possible (analytics flush, etc.) | - Nécessite que `Application.shutdown()` existe formellement |
| + Nom différent = pas de confusion avec le pattern View | |
| + Cohérent avec I59 (persistance = fin de vie ≠ détachement) | |

#### Sous-option L3 — `onShutdown()` + `onBeforeUnload()` intégré

Comme L2, mais le framework intègre automatiquement la gestion de `beforeunload` et expose un hook dédié pour la confirmation de fermeture :

```typescript
abstract class Foundation {
  protected onAttach(): void;
  protected onShutdown?(): void;

  /**
   * Appelé automatiquement sur window.beforeunload.
   * Retourner une string active la boîte de confirmation native.
   * Retourner undefined = pas de confirmation.
   */
  protected onBeforeUnload?(): string | undefined;
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Tout L2 + gestion `beforeunload` intégrée | - `onBeforeUnload` est un anti-pattern UX dans beaucoup de cas |
| + Pas besoin d'écouter `window.beforeunload` manuellement | - Chrome/Safari ignorent le message custom depuis 2016 |
| + Le framework peut orchestrer : `onBeforeUnload` → confirmation → `onShutdown` | - Over-engineering si peu d'apps en ont besoin |

#### Comparaison Axe 4

| Critère | L1 (pas de hook) | L2 (`onShutdown`) | L3 (`onShutdown` + `beforeunload`) |
|---------|------------------|-------------------|------------------------------------|
| Cohérence sémantique | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| DX (tests, hot-reload) | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Simplicité | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Complétude | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Risque over-engineering | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |

---

## Idées supplémentaires — extensions envisagées

Les propositions ci-dessous enrichissent le périmètre de Foundation. Elles sont **indépendantes** des axes 1–3 et peuvent être acceptées ou rejetées séparément.

### Extension E1 — `getMedia()` : accès aux MediaQueryList

Les breakpoints CSS sont un cas d'usage récurrent pour la Foundation. Plutôt que d'écouter `resize` et de recalculer manuellement, la Foundation pourrait exposer un helper pour les `MediaQueryList` :

```typescript
abstract class Foundation {
  /**
   * Retourne un objet réactif sur une media query CSS.
   * Le framework gère automatiquement l'abonnement et le cleanup.
   *
   * @param query - Media query CSS (ex: '(min-width: 768px)')
   * @returns { matches: boolean } — mis à jour automatiquement
   */
  protected getMedia(query: string): { readonly matches: boolean };
}
```

```typescript
class AppFoundation extends Foundation {
  private desktop = this.getMedia('(min-width: 1024px)');
  private darkScheme = this.getMedia('(prefers-color-scheme: dark)');

  // Le framework câble les changements automatiquement
  // et peut émettre un Event sur un Channel si désiré
  onMediaChange(query: string, matches: boolean): void {
    this.html.classList.toggle('is-desktop', this.desktop.matches);
    this.html.classList.toggle('is-dark-scheme', this.darkScheme.matches);
  }
}
```

**Justification** : `window.matchMedia()` est l'API standard pour écouter les changements de media query. L'encapsuler dans la Foundation est cohérent avec son rôle de pont entre le système (viewport, preferences OS) et l'application Bonsai.

### Extension E2 — `onIdle()` : callback requestIdleCallback

Pour les tâches de fond (analytics, prefetch, logging), la Foundation pourrait fournir un hook `onIdle()` auto-câblé :

```typescript
class AppFoundation extends Foundation {
  /**
   * Appelé par le framework via requestIdleCallback.
   * Idéal pour les tâches non critiques.
   */
  onIdle(deadline: IdleDeadline): void {
    if (deadline.timeRemaining() > 10) {
      this.trigger(Analytics.channel, 'flush', undefined);
    }
  }
}
```

### Extension E3 — `onError()` global : pont vers ErrorReporter

La Foundation pourrait être le point d'ancrage de `window.onerror` et `window.onunhandledrejection`, faisant le pont entre les erreurs globales non capturées et l'ErrorReporter de Bonsai (ADR-0002) :

```typescript
class AppFoundation extends Foundation {
  // Auto-câblé par le framework si la méthode existe
  onWindowError?(event: ErrorEvent): void;
  onWindowUnhandledrejection?(event: PromiseRejectionEvent): void;
}
```

**Justification** : aujourd'hui, les erreurs globales ne sont pas captées par le framework. La Foundation, en tant que composant concret persistant ayant accès à `window`, est le point d'ancrage naturel.

### Extension E4 — `getHead()` : accès en lecture à `<head>` pour SEO/meta

Cas d'usage : modifier des `<meta>` tags (og:title, description, canonical) en réaction à une navigation SPA. La Foundation pourrait exposer un accès contrôlé (N1) à certains éléments de `<head>` :

```typescript
abstract class Foundation {
  /**
   * Accès en lecture/écriture N1 à un élément <meta> dans <head>.
   * Permet la mise à jour des meta tags SEO en SPA.
   *
   * @param selector - Sélecteur CSS pour le <meta> (ex: 'meta[property="og:title"]')
   * @returns L'élément ou null
   */
  protected getMeta(selector: string): HTMLMetaElement | null;

  /**
   * Modifie le <title> du document.
   */
  protected setTitle(title: string): void;
}
```

```typescript
class AppFoundation extends Foundation {
  static readonly listen = [Router.channel] as const;

  onRouterRouteChangedEvent(payload: { route: Route, meta: RouteMeta }): void {
    this.setTitle(payload.meta.title);
    const ogTitle = this.getMeta('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = payload.meta.title;
  }
}
```

**Justification** : `<head>` est hors du scope des Views (I34 : rootElement ∈ enfants de `<body>`). Seule la Foundation a légitimement accès à l'**ensemble** du document. Sans ce mécanisme, la modification des meta tags SPA nécessite du DOM brut hors framework.

> ⚠️ **Tension avec D20** : D20 dit « Foundation cible `<body>` ». L'extension E4 élargit le scope à `<head>`. Si E4 est retenue, D20 devra être amendée pour dire « Foundation couvre le **document** (body + head), mais les altérations structurelles (N2/N3) restent interdites partout ».

---

## Décision

> ⏳ **En attente de décision.** Les axes sont présentés pour discussion.

### Recommandation architecte

**Axe 1** : **Option A** (TUIMap pré-formée) — la Foundation est unique, le catalogue d'événements est fini et connu, l'auto-discovery est le standard Bonsai. Pas besoin de la flexibilité de B. L'extensibilité de C ajoute de la complexité pour un cas marginal.

**Axe 2** : **Sous-option S1** (`readServerData<T>(id)`) — simple, explicite, standard. Le scope est `<body>` par défaut mais extensible à `document` via option (emprunter S3). La variante déclarative S2 est over-engineered pour la majorité des cas.

**Axe 3** : **Sous-option P1** (formaliser I59) — la singularité de la Foundation mérite une formalisation explicite. Elle est structurellement différente de tous les autres composants et cette différence influence les décisions de conception.

**Axe 4** : **Sous-option L2** (`onShutdown()`) — le hook de shutdown est nécessaire pour les tests et le hot-reload, mais `onBeforeUnload` intégré (L3) est du over-engineering. Le lifecycle Foundation devient asymétrique et unique : `onAttach()` → `onShutdown()`, sans jamais passer par `detached`. `onDetach()` est **supprimé** du contrat Foundation.

**Extensions** :
- **E1 (getMedia)** : ✅ Recommandé — cas d'usage universel, API propre
- **E2 (onIdle)** : 🟡 Différé post-v1 — utile mais pas essentiel
- **E3 (onError global)** : ✅ Recommandé — pont naturel vers ErrorReporter (ADR-0002)
- **E4 (getHead/setTitle)** : ✅ Recommandé — indispensable pour SPA, Foundation seul composant légitime

---

## Conséquences (si recommandation retenue)

### Nouveaux invariants

> ⚠️ **Renumérotation** : I58 est déjà attribué au « Scope Composer immutable » (ADR-0020).
> Les invariants proposés ici commencent à **I59**.

| # | Invariant |
|---|------|------|
| **I59** | La Foundation est le seul composant **concret persistant** — couche concrète (accès DOM) mais persistant (vit toute la session). Tous les autres concrets sont éphémères, tous les autres persistants sont abstraits. |
| **I60** | La Foundation possède un `TFoundationUIMap` **pré-formé par le framework** couvrant `body`, `html`, `window` et `document`. Les handlers sont auto-découverts par convention `on<Target><Event>`. Le cleanup est automatique (AbortController). |
| **I61** | Les `<script type="application/json">` lus par `readServerData()` sont **supprimés du DOM** après lecture (one-shot, pas de donnée résiduelle). |
| **I62** | La Foundation n'a **pas** de `onDetach()`. Son lifecycle est asymétrique : `onAttach()` (bootstrap, une seule fois) → `onShutdown()` (terminal, irréversible). Il n'existe pas de cycle detach/re-attach pour Foundation — `<body>` et `<html>` ne sont jamais détachés du DOM. |

### Décisions nouvelles

| # | Décision |
|---|----------|
| **D49** | La Foundation a un `TFoundationUIMap` pré-formé couvrant 4 cibles (body, html, window, document) avec un catalogue d'événements DOM globaux. Auto-discovery D48 appliquée. |
| **D50** | `readServerData<T>(id)` : méthode typée pour lire les `<script type="application/json">`. Scope `document` (couvre `<head>` et `<body>`). Suppression one-shot. |
| **D51** | La Foundation a accès contrôlé en N1 à `<head>` pour les meta tags et le title. Amende D20 (Foundation couvre le document, pas seulement `<body>`). |
| **D52** | La Foundation remplace `onDetach()` par `onShutdown()`. Ce hook est appelé par `Application.shutdown()` (tests, hot-reload) ou au `beforeunload` (best-effort). Il est terminal et irréversible — distinct du `onDetach()` des Views qui peut précéder un re-attach. |

### Fichiers impactés

| Fichier | Impact |
|---------|--------|
| [RFC-0002 §11](../rfc/6-transversal/conventions-typage.md#11-foundation) | Réécriture majeure — ajout TFoundationUIMap, readServerData, getMedia, setTitle, getMeta |
| [RFC-0001-composants §9](../rfc/2-architecture/README.md#9-foundation) | Ajout classification « concret persistant », lifecycle asymétrique (`onAttach` → `onShutdown`), suppression `onDetach` |
| [RFC-0001-invariants-decisions](../rfc/reference/invariants.md) | Ajout I59, I60, I61, I62, D49, D50, D51, D52 ; amendement D20 |
| [RFC-0001-glossaire](../rfc/reference/glossaire.md) | Mise à jour définition Foundation |
| [RFC-0001-architecture](../rfc/1-philosophie.md) | Diagramme couches : ajout « pont concret-persistant » |

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-27 | Création (Proposed) — 3 axes + 4 extensions |
| 2026-03-27 | Ajout Axe 4 — lifecycle asymétrique (`onShutdown()` vs `onDetach()`) |
| 2026-03-27 | Ajout section Périmètre — multi-app explicitement hors périmètre (future RFC). Foundation = seul accès aux 5 cibles globales (document, window, head, html, body) |
| 2026-04-01 | Renumérotation I58→I59, I59→I60, I60→I61, I61→I62 — I58 attribué au « Scope Composer immutable » (ADR-0020 Accepted) |
