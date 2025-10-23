# ADR-0007 : Behavior Contract

| Champ | Valeur |
|-------|--------|
| **Statut** | ⚪ Superseded — absorbé par RFC-0001 (D36, D37, D38, I43–I45) et RFC-0002 §10 |
| **Date** | 2026-03-18 |
| **Mis à jour** | 2026-03-23 |
| **Dépend de** | [ADR-0013](ADR-0013-view-code-reuse.md) |
| **Décideurs** | @ncac |
| **RFC liée** | RFC-0001 D36/D37/D38, RFC-0001-composants §8, RFC-0002 §10 |

> ⚠️ **Cet ADR est superseded.** Le contrat Behavior a été entièrement retravaillé et formalisé
> directement dans les RFC. Les décisions finales diffèrent sensiblement de l'option
> retenue ici (E — Deux types + état éphémère).
>
> **Différences principales RFC vs cet ADR :**
>
> | Aspect | ADR-0007 (obsolète) | RFC (normatif) |
> |--------|---------------------|----------------|
> | Types | `Behavior` + `RenderableBehavior` | `Behavior` unique (D36) |
> | Accès View | `this.view.el` implicite | **Aucun** `this.view` (I44) |
> | DOM | Container isolé par RenderableBehavior | TUIMap propre + templates Mode C (I45) |
> | Collision | Container isolé | Clés ui disjointes, vérif. bootstrap (I43) |
> | État local | État éphémère (exception I30) | localState I42 (mêmes 5 contraintes que View, D37) |
> | Réutilisabilité | Non formalisée | Algorithme Q0–Q4 (D38) |
>
> **Documents normatifs :**
> - [RFC-0001-invariants-decisions](../rfc/reference/invariants.md) — D36, D37, D38, I43, I44, I45
> - [RFC-0001-composants §8](../rfc/2-architecture/README.md) — contrat Behavior complet
> - [RFC-0002 §10](../rfc/6-transversal/conventions-typage.md) — classe abstraite, types, API, exemples

---

## Contexte

Le Behavior est identifié comme composant mais son périmètre exact n'est pas défini (Q7 dans le glossaire). L'héritage conceptuel vient de **MarionetteJS Behaviors**.

### Ce qu'on sait (RFC-0001)

- Unité de logique UI réutilisable, attachée à une View
- Enrichit le comportement visuel sans modifier la structure du rendu
- **Aucun domain state** (I30, révisé par D33/D37 — localState autorisé sous I42)
- Ne peut **jamais** utiliser `emit()` (D7)
- Cycle de vie lié à sa View

### Questions ouvertes (Q7)

1. **Niveau d'altération DOM** : N1 uniquement, ou N1+N2 ?
2. **Scope DOM** : `rootElement` de la View, @ui déclarés, ou les deux ?
3. **Capacités Channel** : propres ou héritées de la View ?
4. **Relation avec la View** : déclaré par la View ou attaché dynamiquement ?
5. **Concurrence** : collision de handlers/rendu avec la View ?
6. **État éphémère** : peut-il avoir un state local pour les interactions haute fréquence ?

### Problématique de l'état éphémère d'interaction (ajout 2026-03-19)

L'invariant **I30** (View stateless) est justifié pour l'état métier et l'état UI persistant.
Cependant, une friction réelle apparaît pour l'**état éphémère pendant une interaction** :

| Cas d'usage | Fréquence | Problème avec I30 strict |
|-------------|-----------|--------------------------|
| **Drag & drop** | Position (x, y) à 60fps | 60 cycles trigger→Feature→Entity→emit→View par seconde |
| **Resize handle** | Dimensions pendant resize | Idem |
| **Color picker** | Couleur pendant drag sur gradient | Latence perceptible |
| **Range slider** | Valeur affichée pendant drag | Idem |
| **Canvas drawing** | Coordonnées du tracé | Impossible à 60fps via Channel |
| **Gesture recognition** | État pinch/swipe en cours | Idem |

**Distinction clé** :
- **État pendant l'interaction** : position du drag, valeur pendant slide, couleur preview
- **État résultant** : position finale, valeur validée, couleur sélectionnée

L'état *résultant* doit aller dans une Entity (traçabilité, persistance).
L'état *pendant* l'interaction est **éphémère** — il n'a de sens que durant le geste.

**Le Behavior est le lieu naturel pour cet état éphémère** car :
1. Il gère les interactions DOM (son rôle)
2. Il n'a pas vocation à être tracé/persisté (éphémère)
3. Il `trigger()` uniquement le résultat final vers la Feature

---

## Contraintes

### Modèle MarionetteJS (référence)

- Un **même Behavior** peut être branché à **plusieurs Views**
- Le Behavior **ne connaît pas** le type de la View (`any View`)
- La View **sait** quels Behaviors sont branchés (déclaration explicite)
- Conséquence : Behavior doit être **générique**

### Architecturales

- **I30** : Aucun **domain** state (révisé par D33 — localState autorisé sous I42)
- **D7** : Jamais `emit()`, seulement `trigger()`
- Pas de violation du scope DOM de la View

### Taxonomie émergente (Q7)

| Type | Exemples | Altération DOM | Risque collision |
|------|----------|----------------|------------------|
| **Listener** | TrackingBehavior, ShortcutsBehavior | Aucune ou N1 minimal | Faible |
| **Renderable** | TooltipBehavior, DragDropBehavior | N1 ou N2 | Élevé |

---

## Options considérées

### Option A — Behavior minimal (Listener only)

**Description** : Behavior limité à l'écoute d'événements, pas d'altération DOM.

```typescript
class TrackingBehavior extends Behavior {
  // Écoute d'events DOM uniquement
  get uiEvents() {
    return {
      '[data-track]': { click: 'onTrackClick' }
    };
  }
  
  onTrackClick(e: Event) {
    const el = e.currentTarget as HTMLElement;
    this.trigger('analytics:track', { action: el.dataset.trackAction });
  }
  
  // Capacités Channel
  get channels() {
    return { trigger: ['analytics'] };
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Simple | - Use cases limités |
| + Pas de collision DOM | - TooltipBehavior impossible |
| + Générique par nature | |

---

### Option B — Behavior avec N1 uniquement

**Description** : Peut altérer le DOM mais seulement en N1 (classes, attributs).

```typescript
class TooltipBehavior extends Behavior {
  // Sélecteur pour trouver les éléments dans la View
  static selector = '[data-tooltip]';
  
  onMouseEnter(e: Event) {
    const el = e.currentTarget as HTMLElement;
    // N1 uniquement : classes, attributs
    el.classList.add('tooltip-active');
    el.setAttribute('aria-describedby', 'tooltip-' + this.id);
  }
  
  onMouseLeave(e: Event) {
    const el = e.currentTarget as HTMLElement;
    el.classList.remove('tooltip-active');
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Altération encadrée | - Tooltip content : où le créer ? |
| + Pas de collision structurelle | - DragDrop : où drop l'élément ? |
| + Réversible | |

---

### Option C — Behavior avec zones réservées

**Description** : Behavior peut faire du N2 mais dans des zones qu'il déclare.

```typescript
class TooltipBehavior extends Behavior {
  // Déclare ses besoins
  static requirements = {
    // La View DOIT fournir un container pour les tooltips
    container: '[data-tooltip-container]'
  };
  
  // Ou le Behavior crée son propre container (une seule fois)
  private container: HTMLElement;
  
  onAttach() {
    // Crée un container à la fin du rootElement
    this.container = document.createElement('div');
    this.container.className = 'behavior-tooltip-container';
    this.view.el.appendChild(this.container);
  }
  
  onDetach() {
    this.container.remove();
  }
  
  showTooltip(content: string, target: HTMLElement) {
    // N2 dans SON container
    this.container.innerHTML = `<div class="tooltip">${content}</div>`;
    // Position relative à target
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + N2 possible | - Complexité |
| + Isolation dans container | - Coordination View/Behavior |
| + Pattern explicite | |

---

### Option D — Deux types de Behavior (recommandé)

**Description** : Distinguer `Behavior` (listener) et `RenderableBehavior` (N1/N2).

```typescript
// TYPE 1 : Behavior simple (listener only)
abstract class Behavior {
  // Écoute d'events DOM
  abstract get uiEvents(): Record<string, EventHandlers>;
  
  // Capacités Channel (trigger, listen, request)
  abstract get channels(): ChannelDeclaration;
  
  // Lifecycle lié à la View
  onAttach(): void { }
  onDetach(): void { }
  
  // PAS d'accès DOM direct, PAS de render
}

// TYPE 2 : RenderableBehavior (N1 + container N2)
abstract class RenderableBehavior extends Behavior {
  // Container créé par le Behavior
  protected container: HTMLElement;
  
  // Type d'élément à créer
  protected containerTag: string = 'div';
  protected containerClass: string = '';
  
  onAttach() {
    this.container = document.createElement(this.containerTag);
    this.container.className = `behavior-container ${this.containerClass}`;
    this.view.el.appendChild(this.container);
  }
  
  onDetach() {
    this.container.remove();
  }
  
  // API de projection dans le container
  protected render(html: string): void {
    this.container.innerHTML = html;
  }
}
```

```typescript
// Usage : Listener
class TrackingBehavior extends Behavior {
  get uiEvents() {
    return { '[data-track]': { click: 'onTrack' } };
  }
  get channels() {
    return { trigger: ['analytics'] };
  }
  onTrack(e: Event) {
    this.trigger('analytics:track', { ... });
  }
}

// Usage : Renderable
class TooltipBehavior extends RenderableBehavior {
  containerClass = 'tooltip-container';
  
  get uiEvents() {
    return { '[data-tooltip]': { mouseenter: 'show', mouseleave: 'hide' } };
  }
  
  show(e: Event) {
    const el = e.currentTarget as HTMLElement;
    this.render(`<div class="tooltip">${el.dataset.tooltip}</div>`);
    this.position(el);
  }
  
  hide() {
    this.render('');
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Deux contrats clairs** | - Deux types à connaître |
| + Listener = simple, safe | - Héritage |
| + Renderable = encadré | |
| + Pas de collision (container isolé) | |

---

### Option E — Behavior avec état éphémère d'interaction (recommandé)

**Description** : Étend l'Option D avec la possibilité d'avoir un **état local éphémère**
pour les interactions haute fréquence. Cet état est **non tracé** et **reset au détachement**.

```typescript
abstract class Behavior {
  // État éphémère autorisé pour les interactions
  // Non tracé, non persisté, reset au detach
  // Exemples : position drag, valeur slider pendant drag
}

// Exemple : DragDropBehavior avec état éphémère
class DragDropBehavior extends RenderableBehavior {
  // ════════════════════════════════════════════════════════════════
  // ÉTAT ÉPHÉMÈRE — valide uniquement pendant l'interaction
  // ════════════════════════════════════════════════════════════════
  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private currentPosition = { x: 0, y: 0 };
  
  get uiEvents() {
    return {
      '[data-draggable]': {
        mousedown: 'onDragStart',
      }
    };
  }
  
  get channels() {
    return { trigger: ['items'] };
  }
  
  onAttach() {
    super.onAttach();
    // Listeners globaux pour drag
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
  }
  
  onDetach() {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    // Reset état éphémère
    this.isDragging = false;
    super.onDetach();
  }
  
  onDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.dragOffset = { x: e.offsetX, y: e.offsetY };
    // Feedback visuel immédiat (N1)
    (e.currentTarget as HTMLElement).classList.add('is-dragging');
  };
  
  onDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    // État éphémère mis à jour à 60fps — PAS de trigger
    this.currentPosition = { 
      x: e.clientX - this.dragOffset.x, 
      y: e.clientY - this.dragOffset.y 
    };
    // Feedback visuel direct (N1)
    this.updateDragPreview();
  };
  
  onDragEnd = (e: MouseEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    // ══════════════════════════════════════════════════════════════
    // SEULEMENT ICI → trigger vers la Feature avec la position FINALE
    // ══════════════════════════════════════════════════════════════
    this.trigger('items:reorder', { 
      itemId: this.draggedItemId,
      finalPosition: this.currentPosition 
    });
    
    // Cleanup visuel
    this.clearDragPreview();
  };
}
```

```typescript
// Exemple : ColorPickerBehavior avec état éphémère
class ColorPickerBehavior extends RenderableBehavior {
  // État éphémère pendant le drag sur le gradient
  private previewColor: string | null = null;
  
  get uiEvents() {
    return {
      '.gradient': {
        mousedown: 'onPickStart',
        mousemove: 'onPickMove',
        mouseup: 'onPickEnd',
        mouseleave: 'onPickCancel',
      }
    };
  }
  
  get channels() {
    return { trigger: ['colorPicker'] };
  }
  
  onPickMove = (e: MouseEvent) => {
    // État éphémère à 60fps — feedback visuel immédiat
    this.previewColor = this.computeColorFromPosition(e);
    this.updatePreview(this.previewColor);  // N1 : background-color
  };
  
  onPickEnd = () => {
    if (this.previewColor) {
      // Seulement au relâchement → Feature
      this.trigger('colorPicker:select', { color: this.previewColor });
    }
  };
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Résout la friction I30** pour les cas réels | - État local (exception à I30) |
| + Performance 60fps possible | - Doit être bien documenté |
| + Trigger seulement le résultat final | - Risque de dérive si mal utilisé |
| + Cohérent avec le rôle du Behavior | |
| + État reset au detach (pas de fuite) | |

#### Règles pour l'état éphémère

| Règle | Description |
|-------|-------------|
| **Scope** | Uniquement dans Behavior, jamais dans View |
| **Durée** | Valide pendant l'interaction uniquement |
| **Reset** | Automatique au `onDetach()` |
| **Traçabilité** | Non tracé (pas dans DevTools) |
| **Trigger** | Seulement le résultat final vers Feature |
| **Interdit** | État qui survit entre interactions |

---

## Analyse comparative

| Critère | A (Minimal) | B (N1 only) | C (Zones) | D (Deux types) | E (État éphémère) |
|---------|-------------|-------------|-----------|----------------|-------------------|
| **Use cases** | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Simplicité** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐ |
| **Safety** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Collision risk** | ✅ None | ⚠️ Low | ⚠️ Medium | ✅ None | ✅ None |
| **60fps interactions** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Résout friction I30** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Décision

**🟠 Mise à jour 2026-03-19**

### Option retenue : E (Deux types + État éphémère)

Cette option étend D avec la possibilité d'avoir un **état local éphémère** pour les interactions haute fréquence.

Justification :

1. **Contrats clairs** : Behavior vs RenderableBehavior
2. **Safety** : container isolé pour les Renderables
3. **MarionetteJS compatible** : reste générique, attachable à toute View
4. **Pas de collision** : View et Behavior ont des zones distinctes
5. **Résout la friction I30** : permet les interactions 60fps (drag, resize, draw)
6. **État éphémère encadré** : règles strictes, reset au detach

### Clarification sur I30 et l'état éphémère

```
┌─────────────────────────────────────────────────────────────────────┐
│  ÉTAT INTERDIT (I30 strict)                                         │
│  ─────────────────────────────────────────────────────────────────  │
│  • État métier → Entity                                             │
│  • État UI persistant (isModalOpen, selectedTab) → Entity           │
│  • État dans View → JAMAIS                                          │
├─────────────────────────────────────────────────────────────────────┤
│  ÉTAT AUTORISÉ (exception encadrée)                                 │
│  ─────────────────────────────────────────────────────────────────  │
│  • État éphémère d'interaction → Behavior UNIQUEMENT                │
│  • Exemples : position pendant drag, couleur pendant pick           │
│  • Règles : reset au detach, trigger seulement le résultat final    │
└─────────────────────────────────────────────────────────────────────┘
```

### Relation View ↔ Behavior

```typescript
class CartView extends View {
  // Déclaration des Behaviors
  get behaviors() {
    return [
      TrackingBehavior,           // Listener (pas d'état)
      TooltipBehavior,            // Renderable (pas d'état)
      new DragDropBehavior({      // Avec config + état éphémère
        axis: 'y',
        container: '.items'
      })
    ];
  }
}
```

### Scope DOM

```
┌─────────────────────────────────────────────┐
│  View.rootElement                           │
│  ┌──────────────────────────────────────┐   │
│  │  View content (View's scope)         │   │
│  │  ┌────────────────────────────────┐  │   │
│  │  │  Slot (Composer's territory)   │  │   │
│  │  └────────────────────────────────┘  │   │
│  └──────────────────────────────────────┘   │
│  ┌──────────────────────────────────────┐   │
│  │  Behavior container (Behavior's)     │   │  ← RenderableBehavior
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Capacités Channel

```typescript
abstract class Behavior {
  // Comme View : trigger, listen, request
  // Jamais emit (D7)
  get channels(): {
    trigger?: string[];   // Channels sur lesquels trigger
    listen?: string[];    // Channels à écouter
    request?: string[];   // Channels pour requests
  };
}
```

### Concurrence de handlers

```typescript
// View et Behavior peuvent écouter le même event
// Les deux handlers s'exécutent (comportement DOM standard)

class CartView extends View {
  get uiEvents() {
    return { '.item': { click: 'onItemClick' } };
  }
}

class TrackingBehavior extends Behavior {
  get uiEvents() {
    return { '.item': { click: 'onTrackClick' } };
  }
}

// Click sur .item → onItemClick ET onTrackClick exécutés
// Ordre : View d'abord, puis Behaviors dans l'ordre de déclaration
```

---

## Conséquences

### Positives

- ✅ Q7 résolu : périmètre défini
- ✅ Deux types avec contrats clairs
- ✅ Pas de collision DOM (containers isolés)
- ✅ Compatible MarionetteJS (générique)
- ✅ **Friction I30 résolue** : interactions 60fps possibles via état éphémère
- ✅ **View reste stateless** : l'exception est dans Behavior, pas dans View

### Négatives (acceptées)

- ⚠️ Deux classes à connaître — mitigé par nommage explicite
- ⚠️ RenderableBehavior crée un élément — overhead minimal
- ⚠️ État éphémère = exception à documenter — règles strictes

---

## Exemples complets

### TrackingBehavior (Listener)

```typescript
class TrackingBehavior extends Behavior {
  get uiEvents() {
    return {
      '[data-track-action]': { click: 'onTrack' }
    };
  }
  
  get channels() {
    return { trigger: ['analytics'] };
  }
  
  onTrack(e: Event) {
    const el = e.currentTarget as HTMLElement;
    this.trigger('analytics:track', {
      action: el.dataset.trackAction,
      category: el.dataset.trackCategory,
      label: el.dataset.trackLabel
    });
  }
}
```

### TooltipBehavior (Renderable)

```typescript
class TooltipBehavior extends RenderableBehavior {
  containerClass = 'tooltip-layer';
  
  get uiEvents() {
    return {
      '[data-tooltip]': {
        mouseenter: 'show',
        mouseleave: 'hide',
        focus: 'show',
        blur: 'hide'
      }
    };
  }
  
  show(e: Event) {
    const el = e.currentTarget as HTMLElement;
    const text = el.dataset.tooltip;
    const rect = el.getBoundingClientRect();
    
    this.render(`
      <div class="tooltip" 
           style="top: ${rect.bottom + 8}px; left: ${rect.left}px"
           role="tooltip">
        ${text}
      </div>
    `);
  }
  
  hide() {
    this.render('');
  }
}
```

### InfiniteScrollBehavior (Renderable + Channel)

```typescript
class InfiniteScrollBehavior extends RenderableBehavior {
  containerClass = 'scroll-sentinel';
  private observer: IntersectionObserver;
  
  get channels() {
    return { trigger: ['list'] };
  }
  
  onAttach() {
    super.onAttach(); // Crée le container
    
    // Le container sert de sentinel
    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        this.trigger('list:loadMore');
      }
    });
    this.observer.observe(this.container);
  }
  
  onDetach() {
    this.observer.disconnect();
    super.onDetach();
  }
}
```

---

## Actions de suivi

- [ ] Implémenter `Behavior` base class
- [ ] Implémenter `RenderableBehavior` avec container
- [ ] Définir ordre d'exécution View → Behaviors
- [ ] Tests : collision handlers, lifecycle
- [ ] Mettre à jour RFC-0001-glossaire Q7 → résolu
- [ ] Documenter les règles de l'état éphémère dans RFC-0001 ou guide
- [ ] Ajouter exemples DragDropBehavior, ColorPickerBehavior

---

## Références

- [MarionetteJS Behaviors](https://marionettejs.com/docs/master/marionette.behavior.html)
- [Stimulus Controllers](https://stimulus.hotwired.dev/)
- [Alpine.js Directives](https://alpinejs.dev/)
- [analyse-rfc-2026-03-19.md](../archive/analyses/analyse-rfc-2026-03-19.md) — Analyse experte identifiant la friction I30

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) — Deux types proposés |
| 2026-03-18 | **Accepted** — `Behavior` + `RenderableBehavior` |
| 2026-03-19 | **Mise à jour** — Option E : état éphémère d'interaction autorisé dans Behavior |
| 2026-03-23 | **Superseded** — Contrat Behavior entièrement retravaillé et absorbé dans les RFC (D36, D37, D38, I43–I45). Design final : Behavior unique (pas de RenderableBehavior), aucun `this.view`, TUIMap propre, templates Mode C, localState I42. |
