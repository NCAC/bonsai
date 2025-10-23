# ADR-0013 : View Code Reuse

| Champ | Valeur |
|-------|--------|
| **Statut** | ⚪ Superseded |
| **Date** | 2026-03-18 |
| **Mis à jour** | 2026-03-25 |
| **Décideurs** | @ncac |
| **RFC liée** | D36/D38 (anciennement [ADR-0007](ADR-0007-behavior-contract.md)) |
| **Superseded by** | D34–D38 (RFC-0001-invariants-decisions, 2026-03-23) |

---

## Contexte

Plusieurs Views peuvent partager des **rendus** et/ou des **comportements** communs. C'est un pattern courant :

- Boutons avec états (loading, disabled, error)
- Formulaires avec validation inline
- Listes avec drag-and-drop
- Tooltips attachés à divers éléments
- Animations d'entrée/sortie

### Le problème DRY

Sans mécanisme de réutilisation, on duplique du code :

```typescript
// ❌ Duplication dans chaque View
class UserCardView extends View {
  private setupTooltips() { /* ... */ }
  private setupLoadingState() { /* ... */ }
}

class ProductCardView extends View {
  private setupTooltips() { /* ... */ }      // Copié
  private setupLoadingState() { /* ... */ }  // Copié
}
```

### Question fondamentale

> **Comment permettre la réutilisation de rendus/comportements entre Views sans violer les principes du framework (pas de state dans le mécanisme, isolation, etc.) ?**

Cette ADR explore les options **avant** de décider si un composant "Behavior" est la bonne réponse.

---

## Options

### Option A — Héritage (Classes View abstraites)

Créer des classes View intermédiaires qui encapsulent les comportements communs.

```typescript
// Classe abstraite avec comportement partagé
abstract class TooltipableView extends View {
  protected initTooltips(): void {
    this.ui.tooltipTriggers.forEach(el => {
      el.addEventListener('mouseenter', this.showTooltip);
    });
  }
  
  protected showTooltip = (e: Event) => { /* ... */ };
}

// Utilisation
class UserCardView extends TooltipableView {
  onRender() {
    this.initTooltips();  // Hérité
  }
}
```

**Avantages :**
- ✅ Pattern familier (OOP classique)
- ✅ Pas de nouveau concept à apprendre
- ✅ Accès complet au contexte de la View (`this`, `ui`, etc.)
- ✅ TypeScript vérifie tout à la compilation

**Inconvénients :**
- ❌ **Héritage simple** : impossible de combiner plusieurs comportements (`TooltipableView` + `DraggableView`)
- ❌ Hiérarchie de classes fragile (diamond problem conceptuel)
- ❌ Couplage fort entre comportement et View
- ❌ Difficile de réutiliser entre projets

---

### Option B — Composition (Behavior comme composant)

Introduire un composant `Behavior` dédié, attachable à n'importe quelle View.

```typescript
// Behavior indépendant
const TooltipBehavior = defineBehavior({
  ui: { triggers: '[data-tooltip]' },
  
  onAttach(view) {
    this.ui.triggers.forEach(el => {
      el.addEventListener('mouseenter', this.show);
    });
  },
  
  show(e: Event) { /* ... */ }
});

// Utilisation
class UserCardView extends View {
  behaviors = [TooltipBehavior, DraggableBehavior];  // Composition !
}
```

**Avantages :**
- ✅ **Composition libre** : plusieurs Behaviors sur une View
- ✅ Réutilisable entre Views différentes
- ✅ Séparation des préoccupations claire
- ✅ Testable en isolation
- ✅ Pattern éprouvé (MarionetteJS, React hooks conceptuellement)

**Inconvénients :**
- ❌ Nouveau concept à documenter
- ❌ Surcoût si peu de réutilisation
- ❌ Interaction Behavior ↔ View à définir précisément
- ❌ Risque de collision DOM/événements

---

### Option C — Mixins TypeScript

Utiliser les mixins TypeScript pour injecter des capacités.

```typescript
// Mixin
function Tooltipable<T extends Constructor<View>>(Base: T) {
  return class extends Base {
    initTooltips() { /* ... */ }
    showTooltip(e: Event) { /* ... */ }
  };
}

// Utilisation
class UserCardView extends Tooltipable(DraggableMixin(View)) {
  onRender() {
    this.initTooltips();
  }
}
```

**Avantages :**
- ✅ Composition possible (chaîne de mixins)
- ✅ Pattern TypeScript natif
- ✅ Pas de runtime overhead

**Inconvénients :**
- ❌ Syntaxe complexe (`extends Mixin1(Mixin2(Base))`)
- ❌ Types difficiles à inférer
- ❌ Conflits de noms de méthodes
- ❌ Difficile à débugger

---

### Option D — Hooks / Utilitaires fonctionnels

Exposer des fonctions utilitaires que les Views appellent explicitement.

```typescript
// Utilitaire fonctionnel
function setupTooltips(rootEl: HTMLElement, options?: TooltipOptions): Cleanup {
  const triggers = rootEl.querySelectorAll('[data-tooltip]');
  // setup...
  return () => { /* cleanup */ };
}

// Utilisation
class UserCardView extends View {
  private cleanupTooltips?: Cleanup;
  
  onRender() {
    this.cleanupTooltips = setupTooltips(this.el);
  }
  
  onDestroy() {
    this.cleanupTooltips?.();
  }
}
```

**Avantages :**
- ✅ Maximum de flexibilité
- ✅ Pas de nouveau concept
- ✅ Facile à tester
- ✅ Explicite (pas de magie)

**Inconvénients :**
- ❌ Boilerplate dans chaque View (cleanup manuel)
- ❌ Pas d'intégration avec le lifecycle View
- ❌ Risque d'oublier le cleanup

---

### Option E — Décorateurs TypeScript

Utiliser des décorateurs pour injecter des comportements.

```typescript
@Tooltipable({ selector: '[data-tooltip]' })
@Draggable()
class UserCardView extends View {
  // Comportements injectés automatiquement
}
```

**Avantages :**
- ✅ Syntaxe déclarative élégante
- ✅ Composition via stacking

**Inconvénients :**
- ❌ Décorateurs TC39 encore en évolution (stage 3)
- ❌ Différences legacy vs modern decorators
- ❌ Magie implicite (difficile à débugger)
- ❌ Support IDE variable

---

## Critères de décision

| Critère | Poids | A (Héritage) | B (Behavior) | C (Mixins) | D (Hooks) | E (Décorateurs) |
|---------|-------|--------------|--------------|------------|-----------|-----------------|
| Composition multiple | ⭐⭐⭐ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Simplicité conceptuelle | ⭐⭐⭐ | ✅ | ⚠️ | ❌ | ✅ | ⚠️ |
| Intégration lifecycle | ⭐⭐ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Typage fort | ⭐⭐ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| Réutilisabilité | ⭐⭐ | ❌ | ✅ | ⚠️ | ✅ | ✅ |
| Pas de magie | ⭐ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Pattern éprouvé | ⭐ | ✅ | ✅ | ⚠️ | ✅ | ❌ |

---

## Questions à trancher

### Q1 : Quels types de "comportements" veut-on réutiliser ?

**Catégories identifiées :**

| Type | Exemple | Besoin DOM | Besoin State |
|------|---------|------------|--------------|
| Interaction UI | Tooltip, Dropdown | Oui (N1) | Non |
| Manipulation DOM | Drag-and-drop | Oui (N1+N2) | Non |
| Validation | Form validation | Oui (N1) | ⚠️ ? |
| Animation | Fade-in/out | Oui (N1) | Non |
| Accessibilité | Focus trap | Oui (N1) | Non |

➡️ **La majorité n'a pas besoin de state propre** → Confirme I30 si Behavior

---

### Q2 : Fréquence d'utilisation anticipée ?

- Si réutilisation **rare** → Option A (héritage) ou D (hooks) suffisent
- Si réutilisation **fréquente** → Option B (Behavior) justifiée

➡️ À évaluer sur cas concrets du projet pilote

---

### Q3 : Combinaison de comportements requise ?

```typescript
// Scénario : une View avec PLUSIEURS comportements
class ComplexFormView extends View {
  // Tooltip + Validation + FocusTrap + Draggable ?
}
```

- Si combinaison **fréquente** → Élimine Option A (héritage simple)
- Si combinaison **rare** → Option A viable

➡️ À évaluer sur cas concrets

---

### Q4 : Priorité entre simplicité et flexibilité ?

- **Simplicité** → Moins de concepts, courbe d'apprentissage facile
- **Flexibilité** → Plus de patterns, cas d'usage couverts

➡️ Choix architectural stratégique

---

## Réflexions supplémentaires

### L'héritage MarionetteJS est-il pertinent ?

MarionetteJS Behaviors ont été conçus dans un contexte :
- Pas de TypeScript (typage faible)
- Backbone.View avec conventions spécifiques
- Avant les hooks React, composition patterns modernes

**Faut-il s'en inspirer ou repartir de zéro ?**

### Alternative : pas de mécanisme dédié

Une position radicale serait de **ne pas fournir** de mécanisme de réutilisation au niveau framework :

> "Les développeurs utilisent l'héritage ou des helpers selon leurs besoins. Le framework ne prescrit pas."

**Avantage** : Framework plus simple, moins de concepts
**Inconvénient** : Patterns incohérents entre projets

---

## Décision

> **⚪ Superseded** — Cette ADR exploratoire a été entièrement résolue par les décisions D34–D38 (2026-03-23) dans RFC-0001-invariants-decisions.

**Résumé des décisions :**

| Option ADR-0013 | Verdict | Source |
|---|---|---|
| **A — Héritage** | ⚠️ Cas rare, découragé. Anti-pattern « Excessive View Inheritance » documenté. | D38 Q3 |
| **B — Behavior** | ✅ **Adopté** comme composant framework first-class (1 des 10 composants). | D36, I43–I45, ADR-0007 Superseded |
| **C — Mixins** | ❌ Rejeté implicitement. Incompatible avec le modèle « composant aveugle » (I44). | D36 |
| **D — Hooks/Utils** | ⚠️ Absorbé par D38 Q4 : « sinon → méthode privée ». Pas de mécanisme dédié. | D38 Q4 |
| **E — Décorateurs** | ❌ Rejeté implicitement. Magie implicite contraire à « Explicite > Implicite ». | Philosophie Bonsai |

**Algorithme de décision D38 :**
- **Q0** : Sert de base de composition → **View**
- **Q1** : Même View, contexte différent → **View + options** (D34)
- **Q2** : Capacité orthogonale, applicable à des Views sans rapport → **Behavior** (D36)
- **Q3** : Altération template principal → **Héritage** (rare, à décourager)
- **Q4** : Channels propres nécessaires → **Behavior** ; sinon → méthode privée

---

## Références

- [ADR-0007 : Behavior Contract](ADR-0007-behavior-contract.md) — ⚪ Superseded par D36
- [RFC-0001-invariants-decisions](../rfc/reference/invariants.md) — D34–D38, anti-pattern « Excessive View Inheritance »
- [RFC-0001-composants §8](../rfc/2-architecture/README.md) — Contrat Behavior, algorithme D38
- MarionetteJS Behaviors : https://marionettejs.com/docs/master/marionette.behavior.html
- React Hooks (pattern conceptuel) : https://react.dev/reference/react
