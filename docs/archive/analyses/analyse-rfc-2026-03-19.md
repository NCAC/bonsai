# Analyse Experte des RFCs Bonsai

> **Analyse réalisée par un expert front-end framework**
> Perspective : aucune connaissance préalable de Bonsai, expertise en TypeScript, architecture, DX, performance/UX

---

| Champ | Valeur |
|-------|--------|
| **Date** | 2026-03-19 |
| **Scope** | RFC-0001, RFC-0002 (Feature, Entity, Channel), RFC-0003 |
| **ADRs consultés** | ADR-0001 à ADR-0013 |
| **Objectif** | Identifier forces, faiblesses, incohérences, recommandations |

---

## 📋 Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Points forts](#2-points-forts)
3. [Points de friction](#3-points-de-friction)
4. [Incohérences détectées](#4-incohérences-détectées)
5. [Recommandations concrètes](#5-recommandations-concrètes)
6. [Verdict global](#6-verdict-global)
7. [Actions suggérées](#7-actions-suggérées)

---

## 1. Vue d'ensemble

**Bonsai** est un framework front-end ambitieux avec une architecture **opinionated** proposant :

| Concept | Description |
|---------|-------------|
| **Flux unidirectionnel strict** | Command → Feature → Entity → Event → View |
| **Channel tri-lane** | Commands (1:1), Events (1:N), Requests (1:1 async) |
| **View stateless (I30)** | Aucun state UI, même éphémère |
| **PDR** | Projection DOM Réactive — mutations directes sans VDOM |
| **Compilation Pug → TypeScript** | Templates compilés au build time |

**Première impression** : La rigueur architecturale et la quantité de documentation sont impressionnantes. Les 41 invariants (I1-I41) et les anti-patterns documentés démontrent une réflexion profonde et mature.

---

## 2. Points forts

### 2.1 ✅ Architecture de communication Channel

Le **tri-lane Channel** (Commands 1:1, Events 1:N, Requests 1:1 async) est une excellente abstraction :

| Aspect | Évaluation |
|--------|------------|
| Clarté sémantique | ⭐⭐⭐⭐⭐ — `trigger` vs `emit` vs `request` sont distincts |
| Cardinalités garanties | ⭐⭐⭐⭐⭐ — I10, I11 mécaniquement vérifiés |
| Typage | ⭐⭐⭐⭐⭐ — Vérification compile-time |

Le pattern namespace TypeScript (D14) est particulièrement élégant :

```typescript
// Ce pattern est vraiment bien pensé
export namespace Cart {
  export type Channel = TChannelDefinition & { ... };
  export type State = { ... };
  export const channel = declareChannel<Channel>('cart');
}
```

Un seul import `{ Cart }` donne accès au type (`Cart.Channel`), au state (`Cart.State`) et au token (`Cart.channel`). C'est le seul construct TypeScript qui réunit types et valeurs sous un même nom.

### 2.2 ✅ Typage TypeScript first-class

Le système de types est soigné :

| Mécanisme | Bénéfice |
|-----------|----------|
| `RequiredCommandHandlers<TChannel>` | Force l'implémentation de tous les handlers |
| `RequiredRequestHandlers<TChannel>` | Idem pour les requests |
| Convention `onXXXCommand`, `onXXXEvent` | Autocomplétion IDE, pattern découvrable |
| Channels déclarés statiquement | Vérification compile-time des dépendances |

### 2.3 ✅ Documentation des anti-patterns

Excellente initiative. Les anti-patterns documentés sont précis et expliquent le *pourquoi* :

- **Smart View** : View qui orchestre le métier → viole I13
- **Cross-domain Trigger** : Feature A trigger sur Channel B → viole I25, D2
- **Cross-domain Emit** : Feature A emit sur Channel B → viole I1, I12
- **Stateful View** : View avec state local → viole I30
- **Entity Leaking** : Entity accessible hors Feature → viole I5, I6
- **Meta-driven Logic** : Logique qui branche sur les metas → viole traçabilité

**Valeur ajoutée** : Un développeur sait immédiatement ce qui est interdit et pourquoi.

### 2.4 ✅ PDR vs VDOM — Choix justifié

Le choix de mutations DOM directes (ProjectionList keyed) vs VDOM est justifiable :

| Aspect | VDOM | PDR Bonsai |
|--------|------|------------|
| Diff | Runtime (arbre complet) | Build-time (keyed reconcile généré) |
| Mémoire | Double buffering | Direct |
| Complexité | Framework gère tout | Développeur structure les templates |
| Performance | O(n) diff + O(n) patch | O(n) reconcile direct |

L'algorithme de réconciliation O(n) dans `ProjectionList` est standard et bien documenté.

### 2.5 ✅ RFC-0003 — Template pur + réactivité déclarative

La séparation entre :
- **Template Pug pur** (structure DOM, pas de métadonnées réactivité)
- **View TypeScript** (déclare la réactivité via selectors)

...est architecturalement propre. Le template reste portable, la réactivité est typée.

```typescript
// La View déclare la réactivité
get templates() {
  return {
    items: {
      template: CartItemsTemplate,
      select: (data) => data.cart?.items,  // Namespace 'cart'
    }
  };
}
```

---

## 3. Points de friction

### 3.0 Clarification importante : View ≠ Component UI

> **À documenter dans les RFCs** : Une View Bonsai n'est **pas** un composant UI atomique.
> C'est une **zone de responsabilité** — une page, une région, un panneau significatif.

```
ProductPageView                    ← UNE View pour toute la page
├── header (@ui="header")
├── product gallery (@ui="gallery")    ← Peut contenir un carrousel (HTML/CSS natif)
├── product details (@ui="details")
├── reviews list (@ui="reviews")       ← Peut contenir des <details> natifs
└── add to cart (@ui="addToCart")
```

Ce n'est **PAS** :
```
ProductGalleryView     ← ❌ Trop granulaire
ProductGalleryItemView ← ❌ 
ReviewItemView         ← ❌
StarRatingView         ← ❌
```

Les interactions UI simples (accordéon, tabs, toggle) utilisent **HTML natif** (`<details>`, `<input type="radio">`, attribut `hidden`) ou des **manipulations N1** (`toggleClass`), pas des Views séparées.

### 3.1 🟡 I30 — View stateless : Friction réelle mais limitée

**L'invariant I30** : Tout état vit dans une Entity, y compris l'état UI.

#### Cas NON problématiques (HTML natif ou N1)

| Pattern UI | Solution native | State nécessaire ? |
|------------|-----------------|-------------------|
| Accordéon | `<details><summary>` | ❌ Non |
| Tabs | `<input type="radio">` + CSS | ❌ Non |
| Toggle visibility | `hidden` attribute | ❌ Non |
| Modal basique | `<dialog>` | ❌ Non |
| Dropdown menu | `:focus-within` + CSS | ❌ Non |

#### Cas de friction réelle — État éphémère pendant interaction

Le vrai problème de I30 apparaît pour l'**état intermédiaire pendant une interaction** :

```typescript
// Exemple : Color Picker avec preview en temps réel pendant le drag
// 
// L'utilisateur drag sur un gradient de couleurs.
// La couleur intermédiaire (pendant le drag) doit être affichée en preview.
// Cette valeur change à 60fps pendant le drag.

// ❌ Avec I30 strict — chaque mousemove passe par le cycle complet
class ColorPickerView extends View {
  onGradientMouseMove(e: MouseEvent) {
    // trigger → Feature → Entity.mutate → emit → View
    // à 60fps = 60 cycles/seconde = latence perceptible
    this.trigger(ColorPicker.channel, 'preview', { 
      color: this.computeColorFromPosition(e) 
    });
  }
}

// ✅ Ce qu'on voudrait — état éphémère local pour le drag
class ColorPickerView extends View {
  private previewColor: string | null = null;  // ❌ Interdit par I30
  
  onGradientMouseMove(e: MouseEvent) {
    this.previewColor = this.computeColorFromPosition(e);
    this.getUI('preview').style('background', this.previewColor);
  }
  
  onGradientMouseUp() {
    // Seulement au relâchement → envoie la valeur finale à la Feature
    this.trigger(ColorPicker.channel, 'selectColor', { 
      color: this.previewColor 
    });
  }
}
```

#### Autres cas de friction réelle

| Cas | Problème avec I30 |
|-----|-------------------|
| **Drag & drop** | Position (x, y) pendant le drag = 60 updates/sec |
| **Resize handle** | Dimensions pendant le resize |
| **Range slider avec tooltip** | Valeur affichée pendant le drag |
| **Canvas drawing** | Coordonnées du tracé en cours |
| **Gesture recognition** | État intermédiaire (pinch, swipe) |

#### Ce qui N'EST PAS une friction

- **Onglet sélectionné** → Souvent lié à une route ou un état métier
- **Modal ouverte** → État métier (quelle action en cours)
- **Formulaire dirty** → État métier (validation, sauvegarde)
- **Item sélectionné dans une liste** → État métier

#### Piste de résolution

Le Behavior pourrait être le lieu naturel pour l'état éphémère d'interaction (Q7 à trancher).
Ou un decorator `@ephemeral` explicite pour ces cas rares.

### 3.1.1 Justification robuste de I30 — Pourquoi le state UI doit être dans Entity

> **Remarque de l'auteur du framework**

L'invariant I30 peut sembler contraignant, mais il repose sur une expérience concrète et une question fondamentale.

#### La question à se poser

> **"Est-ce que ce changement d'état pourrait *éventuellement* avoir un impact sur d'autres composants UI ?"**

Si la réponse est "peut-être", ou "pas aujourd'hui mais un jour", alors le state **doit** être dans une Entity.

#### L'expérience MarionetteJS — Deux sources de vérité

Dans MarionetteJS, une View avait :
- `this.model` (le Model Backbone partagé avec d'autres Views)
- Des propriétés directes (`this.isOpen`, `this.selectedIndex`)

Cette dualité créait une **double source de vérité** :

```javascript
// ❌ Pattern MarionetteJS problématique
class AccordionView extends Marionette.View {
  this.isOpen = false;        // State local
  this.model.get('data');     // State partagé
  
  toggle() {
    this.isOpen = !this.isOpen;  // Qui d'autre sait que c'est ouvert ?
  }
}
```

**Problèmes rencontrés** :
- Analytics veut tracker les ouvertures d'accordéon → où est l'info ?
- Persistence de l'état UI au refresh → le state local est perdu
- Une autre View veut afficher "3 sections dépliées" → elle ne peut pas
- Tests E2E ne peuvent pas assert l'état UI → pas d'API pour le récupérer

#### Exemple : la modale qui semble "locale"

Prenons une modale qui s'ouvre au clic sur un bouton :

```typescript
// Première impression : "c'est juste local à mon composant"
class ProductView {
  private isModalOpen = false;  // ❌ Semble innocent
  
  onBuyClick() {
    this.isModalOpen = true;
    this.renderModal();
  }
}
```

**Mais en réalité** :

1. Quand la modale s'ouvre, un **overlay** doit apparaître (autre composant)
2. L'overlay empêche le scroll du body (Foundation)
3. Le focus doit être trappé dans la modale (accessibility)
4. Les autres modales potentielles doivent se fermer (coordination)
5. Analytics veut savoir quelle modale est vue (observabilité)

→ Ce qui semblait être un état "purement local" **impacte en réalité** :
- La Foundation (scroll, overlay)
- Potentiellement d'autres Views
- Des services transverses

**La communication passe forcément par un Channel** :

```
Bouton → trigger('modal:open') → ModalFeature → emit('modal:opened') → OverlayView, ModalView, Analytics
```

#### Conclusion : I30 est une protection, pas une contrainte arbitraire

I30 empêche la **prolifération de sources de vérité**.

| Avec state local | Avec Entity |  
|------------------|-------------|
| N sources de vérité | 1 source de vérité |
| "Qui sait que c'est ouvert ?" | "L'Entity sait" |
| Tests : mock complexe | Tests : assert sur Entity |
| Debug : chercher dans chaque View | Debug : inspecter l'Entity |

**Rappel** : La friction de I30 est réelle uniquement pour l'**état éphémère haute fréquence** (60fps pendant drag/resize). Le Behavior avec état éphémère (ADR-0007 Option E) résout ce cas.

### 3.2 🟡 Réactivité template via `any` — Granularité perdue

La décision **D-VIEW-SUBSCRIPTION** fait que les Views s'abonnent à l'événement `any` :

```typescript
// CartFeature mute items ET total
// → Le Channel émet 'any' avec { changes: { items, total } }
// → TOUS les selectors de la View sont évalués

get templates() {
  return {
    items: { select: (data) => data.cart?.items },    // Évalué
    total: { select: (data) => data.cart?.total },    // Évalué
    header: { select: (data) => data.cart?.header },  // Évalué (inutilement)
  };
}
```

#### Analyse

| Aspect | Observation |
|--------|-------------|
| **Pragmatisme** | ✅ Simple à implémenter, un seul abonnement par Channel |
| **Performance** | ⚠️ Tous les selectors évalués à chaque mutation |
| **Garde-fou** | ✅ `shallowEqual` empêche le re-render inutile |
| **Scaling** | ⚠️ Feature avec 10 keys de state → 10 évaluations |

**Risque** : Pour une View complexe avec 20 templates, chaque micro-mutation évalue 20 selectors. Le `shallowEqual` mitigue le DOM update, mais pas l'évaluation.

### 3.3 🟡 Relation Composer-View — Complexité cognitive

La chaîne `Foundation → Composer → View` avec le Composer comme "décideur pur" :

```
Foundation (unique, sur <body>)
  └─ Composer (décide quelle View)
       └─ View (projette le DOM)
           └─ Composer enfant (via get composers())
                └─ View enfant
```

#### Analyse

| Aspect | Observation |
|--------|-------------|
| **Séparation responsabilités** | ✅ Propre conceptuellement |
| **Cognitive load** | ⚠️ 3 concepts pour afficher une View |
| **Documentation** | ⚠️ Quand la Foundation suffit-elle vs Composer ? |
| **Cas simple** | ⚠️ Over-engineering pour une page statique |

**Question non répondue** : Heuristique pour décider "ici Composer, là Foundation suffit".

### 3.4 🟡 Absence de gestion d'effets explicite

Les RFCs ne mentionnent pas :
- Appels réseau (fetch)
- Timers (debounce, throttle)
- WebSockets
- Cleanup d'effets

#### Où vit `fetch` ?

Pattern implicite (non documenté) :

```typescript
// Dans un handler de Feature ?
async onLoadProductsCommand(): Promise<void> {
  this.entity.mutate('products:loading', null, draft => {
    draft.isLoading = true;
  });
  
  const products = await fetch('/api/products').then(r => r.json());
  
  this.entity.mutate('products:loaded', { products }, draft => {
    draft.products = products;
    draft.isLoading = false;
  });
  
  this.emit('productsLoaded', { products });
}
```

**Manque** : Une section "Side Effects" dans RFC-0002-feature.md.

### 3.5 🟠 Q7 Behavior — Toujours ouvert

Le glossaire indique que Q7 (périmètre exact des Behaviors) est **OPEN**.

| Question | Statut |
|----------|--------|
| Behavior = enrichissement DOM sans état ? | ❓ |
| Behavior peut avoir un état local pour animations ? | ❓ |
| Behavior accède à quels @ui ? | Partiellement défini |

C'est un trou conceptuel : les Behaviors ont les mêmes contraintes que les Views (I30 — stateless), mais leur rôle d'enrichissement comportemental (animations, drag & drop) implique souvent du state local.

### 3.6 🟡 Réutilisation de Views avec propriétés différentes

**Problème** : Comment réutiliser une View (ex: `CarouselView`) dans différents slots avec des configurations différentes (`rootElement`, options, etc.) ?

#### Exemple concret

Une `ProductPageView` contient trois carrousels similaires :

```
ProductPageView
├── gallery-carousel (images produit, plein écran)
├── related-products-carousel (produits similaires, 4 items visibles)
└── reviews-carousel (avis clients, autoplay)
```

Les trois ont le **même code View** (`CarouselView`), mais diffèrent par :
- Le `rootElement` (selectors différents)
- Les options (items visibles, autoplay, etc.)
- Potentiellement les Behaviors attachés

#### Pattern MarionetteJS

Dans MarionetteJS, on pouvait passer des options au constructeur :

```javascript
// MarionetteJS — override via constructeur
const carousel1 = new CarouselView({
  el: '#gallery-carousel',
  itemsVisible: 1,
  autoplay: false
});

const carousel2 = new CarouselView({
  el: '#related-carousel',
  itemsVisible: 4,
  autoplay: true
});
```

#### Question non résolue dans Bonsai

| Aspect | Documentation actuelle |
|--------|------------------------|
| Plusieurs instances d'une View | Oui, possible |
| `rootElement` différent par instance | ❓ Non spécifié |
| Options de configuration par instance | ❓ Non spécifié |
| Pattern recommandé | ❓ Non documenté |

#### Pistes de résolution

1. **Via le Composer** : Le Composer `resolve()` pourrait passer des options à la View instanciée
2. **Via l'Entity** : La Feature fournit la configuration via Channel
3. **Via un getter overridable** : `get config()` dans la View, surchargeable
4. **Via factory function** : `createCarouselView(options)` retourne une classe configurée

```typescript
// Piste 1 — Composer passe les options
class GalleryComposer extends Composer {
  resolve() {
    return {
      view: CarouselView,
      options: { itemsVisible: 1, autoplay: false }  // ← Passé à la View
    };
  }
}

// Piste 4 — Factory function (pattern classe configurée)
const GalleryCarouselView = createCarouselView({
  itemsVisible: 1,
  autoplay: false
});
```

**→ Voir [ADR-0013-view-code-reuse.md](adr/ADR-0013-view-code-reuse.md)** pour l'exploration complète des options.

---

## 4. Incohérences détectées

### 4.1 Nomenclature `TStructure` vs `TEntityStructure`

RFC-0002-entity.md :
> "Convention de nommage : `TEntityStructure` est le nom formel. [...] abrégé en `TStructure`"

Dans RFC-0002-feature.md, c'est directement `TStructure`.

**Impact** : Mineur, mais pourrait être unifié (toujours `TState` ou toujours `TStructure`).

### 4.2 Prolifération de Features non contrainte

L'architecture permet théoriquement des dizaines de Features :
- `CartFeature`, `CartUiFeature`, `ModalUiFeature`, `TooltipUiFeature`, `DropdownUiFeature`...

Chaque feature → 1 Entity → 1 Channel.

**Risque** : Prolifération de Features UI pour contourner I30. Sans heuristique de regroupement, ça peut devenir ingérable.

**Manque** : Patterns de regroupement documentés (ex: `UiStateFeature` générique ?).

### 4.3 Metas et Requests async — Propagation du `hop`

I7 dit que tout message porte des metas, incluant `hop`.

**Question** : Si Feature A request Feature B qui request Feature C, le `hop` est-il incrémenté ?

```
FeatureA.onCommand() {
  const data = await this.request(B.channel, 'getData');  // hop = ?
  // B.onGetDataRequest() {
  //   const more = await this.request(C.channel, 'getMore');  // hop = ?
  // }
}
```

**Non spécifié clairement** dans RFC-0001 §10 ni RFC-0002-channel.

### 4.4 `@ui` obligatoire vs sélecteurs CSS classiques

RFC-0003 §8.2 rend `@ui` obligatoire :
> "Chaque élément référencé dans `uiElements` de la View **doit** avoir un attribut `@ui`"

Mais RFC-0002 mentionne `uiElements` avec des sélecteurs CSS :

```typescript
get uiElements() {
  return {
    items: '.Cart-items',  // Sélecteur CSS
    total: '.Cart-total',
  };
}
```

**Clarification nécessaire** : 
- `@ui` est le mécanisme unique ? 
- Ou les sélecteurs CSS sont aussi valides ?
- Coexistence possible ?

---

## 5. Recommandations concrètes

### R0 — Documenter que View ≠ Component UI — Priorité HAUTE

Ajouter dans RFC-0001 ou RFC-0002-api une section explicite :

> **Une View est une zone de responsabilité**, pas un composant UI atomique.
> Une View peut gérer une page entière, un panneau, une région significative.
> Les widgets UI (accordéon, tabs, carrousel) utilisent HTML natif ou des manipulations N1,
> pas des Views séparées.

### R1 — Clarifier l'état éphémère d'interaction — Priorité MOYENNE

**Problème** : I30 est strict, mais l'état *pendant* une interaction (drag, resize, draw) 
est fondamentalement différent de l'état *résultant*.

**Options** :
1. **Behavior comme lieu de l'état éphémère** — Q7 à trancher
2. **Decorator `@ephemeral`** — pour les cas rares de haute fréquence
3. **Documenter le pattern debounce** — trigger seulement au relâchement

```typescript
// Pattern recommandé pour état haute fréquence
class ColorPickerBehavior extends Behavior {
  // Behavior gère l'état éphémère (si Q7 le permet)
  private previewColor: string | null = null;
  
  onDrag(e: MouseEvent) {
    this.previewColor = computeColor(e);
    this.view.getUI('preview').style('background', this.previewColor);
  }
  
  onDragEnd() {
    // Seulement à la fin → Feature
    this.view.trigger(ColorPicker.channel, 'select', { color: this.previewColor });
  }
}
```

### R2 — Documenter les effets (side effects) — Priorité MOYENNE

Ajouter une section RFC-0002-feature §7 "Effets et I/O" :

| Pattern | Documentation |
|---------|---------------|
| `fetch` + loading + error | Exemple complet |
| Timers (`setTimeout`, `setInterval`) | Cleanup dans `onDestroy` |
| WebSockets | Pattern d'abonnement |
| Debounce/throttle | Framework ou applicatif ? |

### R3 — Clarifier le rôle du Behavior (Q7) — Priorité HAUTE

Écrire un **ADR-0014** qui tranche :

| Question | Décision attendue |
|----------|-------------------|
| Behavior = enrichissement DOM sans état ? | Oui/Non |
| Behavior peut avoir un état local pour animations ? | Oui/Non |
| Comportement drag & drop → state où ? | Entity ou exception locale |

### R4 — Ajouter des benchmarks perfs — Priorité BASSE

Pour valider que PDR > VDOM dans les cas d'usage Bonsai :
- Benchmarks style [js-framework-benchmark](https://github.com/nicokoenig/js-framework-benchmark)
- Comparaison avec React, Vue, Svelte, Solid
- Mesures : création, update, suppression, mémoire

### R5 — Créer un guide de migration — Priorité BASSE

Pour convaincre des équipes de migrer depuis React/Vue :

| Concept React | Équivalent Bonsai |
|---------------|-------------------|
| `useState` | Feature + Entity |
| `useEffect` | `onInit`, `onDestroy`, handlers |
| `useContext` | Channel (listen/request) |
| Component | View |
| Custom Hook | Behavior (?) |

### R6 — Clarifier `@ui` vs sélecteurs CSS — Priorité HAUTE

Dans RFC-0003 ou RFC-0002, ajouter une section qui tranche :

```markdown
### Résolution des uiElements

| Mode | Syntaxe | Cas d'usage |
|------|---------|-------------|
| `@ui` (recommandé) | `items: '@ui'` | Templates compilés |
| Sélecteur CSS | `items: '.Cart-items'` | Views sans template |
| Mixte | Interdit / Autorisé ? | ? |
```

### R7 — Documenter la réutilisation de Views configurables — Priorité HAUTE

**Problème** : Une View peut avoir plusieurs instances dans différents slots, mais comment configurer chaque instance différemment (`rootElement`, options) ?

**À documenter dans RFC-0002 ou ADR-0013** :

```typescript
// Pattern 1 : Composer passe les options à la View
class GalleryComposer extends Composer {
  resolve() {
    return {
      view: CarouselView,
      options: { itemsVisible: 1, autoplay: false }  // ← Comment accéder ?
    };
  }
}

// Pattern 2 : Factory function crée une View configurée
const GalleryCarouselView = createCarouselView({
  rootElement: '.gallery-carousel',
  itemsVisible: 1
});

// Pattern 3 : L'Entity contient la configuration
// → La Feature expose la config, la View la lit via request
```

**Questions ouvertes** :
- Le Composer peut-il passer des options à la View instanciée ?
- La View a-t-elle un constructeur ou un hook d'initialisation avec options ?
- Pattern recommandé pour plusieurs instances d'une même View ?

**→ Voir [ADR-0013-view-code-reuse.md](adr/ADR-0013-view-code-reuse.md)**
| Sélecteur CSS | `items: '.Cart-items'` | Views sans template |
| Mixte | Interdit / Autorisé ? | ? |
```

---

## 6. Verdict global

| Critère | Note | Commentaire |
|---------|------|-------------|
| **Cohérence architecturale** | ⭐⭐⭐⭐ | Très cohérente, parfois au détriment de la flexibilité |
| **Typage TypeScript** | ⭐⭐⭐⭐⭐ | Excellent, first-class citizen |
| **DX (Developer Experience)** | ⭐⭐⭐ | Boilerplate élevé, I30 frictionnel |
| **Documentation** | ⭐⭐⭐⭐⭐ | Exemplaire, très détaillée |
| **Pragmatisme** | ⭐⭐⭐ | Dogmatisme sur le state UI |
| **Adoption potentielle** | ⭐⭐⭐ | Courbe d'apprentissage raide |

### Synthèse

Bonsai est un framework **architecturalement solide** avec une vision claire. Les RFCs sont d'une qualité rare dans l'écosystème open-source.

**La question centrale** : Bonsai est-il un framework pour **équipes disciplinées** (assume la complexité), ou cherche-t-il une **adoption large** (doit faire des compromis DX) ?

Les deux voies sont valides, mais la documentation actuelle penche vers la première sans l'assumer explicitement.

**Recommandation** : Ajouter un positionnement explicite dans RFC-0001 §1 :

> "Bonsai est conçu pour des applications métier complexes où la traçabilité, 
> la prévisibilité et la testabilité priment sur la rapidité de prototypage.
> Si votre priorité est le time-to-market d'un MVP, d'autres frameworks 
> peuvent être plus adaptés."

---

## 7. Actions suggérées

### 🔴 Priorité Haute (bloquant adoption)

| Action | Type | Effort |
|--------|------|--------|
| Documenter que View ≠ Component UI | RFC-0001/0002 update | S |
| Clarifier `@ui` vs sélecteurs CSS | RFC-0002/0003 update | S |
| Documenter la réutilisation de Views configurables (R7) | RFC-0002 ou ADR-0013 update | M |
| ADR-0014 Behavior contract (fermer Q7) | ADR | M |

### 🟡 Priorité Moyenne (amélioration significative)

| Action | Type | Effort |
|--------|------|--------|
| Clarifier état éphémère d'interaction (drag, resize) | ADR ou RFC update | M |
| Section "Side Effects" dans RFC-0002-feature | RFC update | S |
| Documenter propagation metas dans Requests async | RFC-0002-channel update | S |

### 🟢 Priorité Basse (nice-to-have)

| Action | Type | Effort |
|--------|------|--------|
| Benchmarks perfs vs React/Vue/Svelte | Benchmark | L |
| Guide migration React → Bonsai | Guide | M |
| Positionnement explicite Bonsai | RFC-0001 update | S |

---

## Conclusion

Bonsai a le potentiel d'être un framework de référence pour les applications métier TypeScript. La rigueur architecturale est un atout différenciant. 

### Clarification essentielle : View ≠ Component UI

Une **View** Bonsai est une **zone de responsabilité** (page, région, panneau), pas un widget atomique.
Les patterns UI simples (accordéon, tabs, toggle) utilisent HTML natif (`<details>`, `<dialog>`, `:focus-within`)
ou des manipulations N1, sans créer de Views séparées.

### Complexité réelle — 6 composants à maîtriser

| Composant | Statut | Remarque |
|-----------|--------|----------|
| **Foundation** | ✅ À connaître | Point d'ancrage unique |
| **Composer** | ✅ À connaître | Décideur de composition |
| **View** | ✅ À connaître | Zone de responsabilité DOM |
| **Behavior** | ✅ À connaître | Enrichissement comportemental |
| **Feature** | ✅ À connaître | Logique métier |
| **Entity** | ✅ À connaître | Structure de données |
| **Channel** | ➖ Déduit de Feature | Pas un concept séparé |
| **Application** | ➖ Minimal | Dormant au runtime (D6) |
| **Router** | ➖ Optionnel | Feature spécialisée |

**6 composants**, c'est comparable à d'autres frameworks. La complexité perçue vient de la **rigueur des invariants** (I1-I41), pas du nombre de concepts.

### Friction réelle de I30

L'invariant I30 (View stateless) n'est **pas** un problème pour la majorité des cas UI 
(HTML natif couvre accordéons, tabs, modales basiques).

La **vraie friction** apparaît pour l'**état éphémère haute fréquence** :
- Position pendant un drag (60 updates/sec)
- Valeur pendant le slide d'un range
- Coordonnées pendant un tracé canvas

**Piste** : Le Behavior (Q7) pourrait être le lieu naturel pour cet état éphémère d'interaction.

---

*Analyse réalisée le 2026-03-19*





## Réponse de l'auteur :

### Staless View

J()
