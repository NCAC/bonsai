# ADR-0015 : Mécanisme de localState pour View et Behavior

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-25 |
| **Décideurs** | @ncac |
| **RFC liées** | RFC-0001-composants §7–8 (View, Behavior), [RFC-0003](../rfc/5-rendu.md) §2.1 (niveaux N1/N2/N3) |
| **ADR liée** | [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) (pattern Immer `mutate()`) |
| **Invariants** | I42, I30, I57 |
| **Décisions** | D33, D37 |

---

## Contexte

### Le problème

D33 et I42 autorisent la View (et le Behavior, D37) à déclarer un **state local de présentation** sous 5 contraintes strictes :

1. **Typé et déclaré explicitement** — pas de `this.xxx` ad hoc
2. **Réactif** — mutations → re-projection automatique
3. **Encapsulé** — inaccessible depuis l'extérieur de la View
4. **Non-broadcastable** — aucun transit par un Channel
5. **Éphémère** — ne survit pas à la destruction (nettoyé au `onDetach()`)

Le corpus définit le **quoi** (I42) et le **pourquoi** (D33), mais pas le **comment** :

- Quelle API de mutation ?
- Quelle mécanique de réactivité ?
- Le localState est-il une Entity ? Un objet Immer ? Autre chose ?
- Y a-t-il des callbacks de notification (`onLocalXxxUpdated`) ?
- Comment la re-projection est-elle déclenchée ?

### Arbre de décision (formalisé dans RFC-0001-composants §7)

```
Q1. Ce state pourrait-il intéresser un autre composant ?
    ├── OUI → domain state (Feature + Entity + Channel)
    └── NON → Q2

Q2. Ce state doit-il survivre à la destruction de la View ?
    ├── OUI → domain state (Feature + Entity + Channel)
    └── NON → localState suffit ✅
```

Le localState existe pour éviter la cérémonie disproportionnée (Feature + Entity + Channel) pour un état que personne d'autre n'observe.

---

## Contraintes

| # | Contrainte | Source |
|---|-----------|--------|
| C1 | Le localState DOIT respecter les 5 contraintes de I42 | I42 |
| C2 | Le mécanisme DOIT déclencher la re-projection automatiquement (même pipeline que les Events `listen`) | I42.2 (réactif) |
| C3 | Le mécanisme NE DOIT PAS créer de Channel, namespace, ou entry Radio | I42.4 (non-broadcastable) |
| C4 | Le mécanisme DOIT être typé statiquement (IntelliSense sur les clés du localState) | DX TypeScript |
| C5 | Le mécanisme DOIT être compatible avec le Behavior (D37) — même API exactement | D37 |
| C6 | Le localState DOIT être `TJsonSerializable` (cohérence avec Entity, D10) | D10 |
| C7 | Le mécanisme DOIT être compatible avec le snapshot DevTools (RFC-0004) — mais le localState N'EST PAS inclus dans `app.snapshot()` (c'est un état volatile, pas un domain state) | RFC-0004 |

---

## Options considérées

### Option A — Entity locale implicite avec `updateLocal(recipe)` et mécanisme dual N1/N2-N3

Le localState est une **micro-Entity interne** gérée par le framework. Même mécanique Immer que `entity.mutate()`, mais sans Channel, sans namespace, sans metas causales.

**Mécanisme dual** aligné sur les niveaux d'altération DOM (RFC-0003 §2.1) :

| Niveau | Mécanisme de réactivité | Détail |
|--------|-------------------------|--------|
| **N1** — Mutation d'attributs | Callbacks `onLocal{Key}Updated(update: TLocalUpdate<T>)` | La View réagit granulairment par clé, manipule le DOM directement |
| **N2/N3** — Mutation par zones / complète | Selector `select: (data) => data.local?.xxx` dans `get templates()` | Le pipeline PDR existant gère la re-projection automatique |

```typescript
/**
 * Notification de changement d'une clé du localState.
 * Un seul argument objet — le destructuring permet de ne prendre que ce qu'on veut.
 */
type TLocalUpdate<T> = {
  /** Valeur courante (post-mutation, frozen) */
  readonly actual: T;
  /** Valeur précédente (pré-mutation, frozen) */
  readonly previous: T;
};

/**
 * Génère le nom de handler per-key depuis une clé de TLocal.
 * "isOpen"      → "onLocalIsOpenUpdated"
 * "currentStep" → "onLocalCurrentStepUpdated"
 */
type TLocalKeyHandlerName<TKey extends string> = `onLocal${Capitalize<TKey>}Updated`;

/**
 * Mapped type — signatures optionnelles des handlers localState per-key.
 * Même pattern que TEntityKeyHandlers (RFC-0002-entity §6)
 * mais avec TLocalUpdate au lieu de (prev, next, patches).
 */
type TLocalKeyHandlers<TLocal extends TJsonSerializable> = Partial<{
  [K in keyof TLocal as TLocalKeyHandlerName<K & string>]: (
    update: TLocalUpdate<TLocal[K]>
  ) => void;
}>;

/**
 * View avec localState — l'API est identique pour Behavior.
 *
 * TLocal est contraint à TJsonSerializable (C6).
 * Le second generic est optionnel — `{}` par défaut.
 */
abstract class View<
  TChannels extends TChannelConfig,
  TLocal extends TJsonSerializable = Record<string, never>
> {

  /**
   * Déclare la structure et les valeurs initiales du localState.
   * Appelé une seule fois, au premier `attached` (I42.5).
   * Retourne un plain object frozen.
   */
  protected get localState(): TLocal {
    return {} as TLocal;
  }

  /**
   * Mutation du state local via recipe Immer.
   *
   * - Produit un nouvel état immutable (Immer produceWithPatches)
   * - Si l'état n'a pas changé (no-op) → ni callback ni re-projection
   * - Si l'état a changé :
   *   - N1 path : pour chaque clé K changée, si onLocal{K}Updated() existe → appel
   *   - N2/N3 path : inject { local: changedKeys } dans le pipeline selector/template
   * - Pas de metas causales, pas de patches exposés
   *
   * @param recipe - Fonction Immer qui mute le draft
   */
  protected updateLocal(recipe: (draft: Draft<TLocal>) => void): void;

  /**
   * Lecture du state local courant.
   * Retourne un objet frozen (Readonly<TLocal>).
   * Accessible uniquement depuis la View elle-même.
   */
  protected get local(): Readonly<TLocal>;
}
```

#### Usage — N1 (callbacks granulaires)

```typescript
// ── Accordion — N1 pur, pas de template ──
class AccordionView extends View<
  UI.ChannelConfig,
  { isOpen: boolean }
> {

  protected get localState() {
    return { isOpen: false };
  }

  onToggleClick() {
    this.updateLocal(draft => { draft.isOpen = !draft.isOpen; });
    // → framework détecte que 'isOpen' a changé
    // → appelle onLocalIsOpenUpdated() ci-dessous
  }

  // Callback N1 — manipulation DOM directe
  onLocalIsOpenUpdated({ actual }: TLocalUpdate<boolean>) {
    this.getUI('panel').toggleClass('open', actual);
    this.getUI('toggle').attr('aria-expanded', String(actual));
  }
}

// ── Wizard — N1 pour data-direction + N2 pour le contenu ──
class WizardView extends View<
  Wizard.ChannelConfig,
  { currentStep: number; validationErrors: string[] }
> {
  static readonly listen = [Wizard.channel] as const;

  protected get localState() {
    return { currentStep: 0, validationErrors: [] };
  }

  get templates() {
    return {
      // N2 — le template gère le contenu via selector 'local'
      stepContent: {
        template: WizardStepTemplate,
        select: (data) => data.local?.currentStep,  // Namespace 'local' (I57)
      },
      errors: {
        template: ErrorListTemplate,
        select: (data) => data.local?.validationErrors,
      },
    };
  }

  // N1 — attribut data-step sur le wrapper (CSS transitions)
  onLocalCurrentStepUpdated({ actual, previous }: TLocalUpdate<number>) {
    const direction = actual > previous ? 'forward' : 'backward';
    this.getUI('wizard').attr('data-direction', direction);
    this.getUI('wizard').attr('data-step', String(actual));
  }

  onNextStepClicked() {
    this.updateLocal(draft => {
      draft.currentStep += 1;
      draft.validationErrors = [];
    });
  }

  onValidationFailed(errors: string[]) {
    this.updateLocal(draft => {
      draft.validationErrors = errors;
    });
  }
}
```

#### Usage — N2/N3 (templates avec selector `data.local`)

```typescript
// ── Dashboard avec configuration locale N3 ──
class DashboardView extends View<
  Dashboard.ChannelConfig,
  { layout: 'grid' | 'list'; sidebarCollapsed: boolean }
> {
  static readonly listen = [Dashboard.channel] as const;

  protected get localState() {
    return { layout: 'grid' as const, sidebarCollapsed: false };
  }

  get templates() {
    return {
      // Template mixant domain state ET localState
      content: {
        template: DashboardContentTemplate,
        select: (data) => ({
          widgets: data.dashboard?.widgets,    // Namespace Channel
          layout: data.local?.layout,          // Namespace 'local'
          collapsed: data.local?.sidebarCollapsed,
        }),
      },
    };
  }

  onToggleLayoutClick() {
    this.updateLocal(draft => {
      draft.layout = draft.layout === 'grid' ? 'list' : 'grid';
    });
  }
}
```

#### Usage — Behavior avec localState

```typescript
// ── Behavior avec localState (même API exactement — C5) ──
class DragAndDropBehavior extends Behavior<
  DragDrop.ChannelConfig,
  { isDragging: boolean; dragStartX: number; dragStartY: number }
> {

  protected get localState() {
    return { isDragging: false, dragStartX: 0, dragStartY: 0 };
  }

  // N1 — toggle classe CSS pendant le drag
  onLocalIsDraggingUpdated({ actual }: TLocalUpdate<boolean>) {
    this.getUI('handle').toggleClass('dragging', actual);
  }

  onMouseDownEvent(event: MouseEvent) {
    this.updateLocal(draft => {
      draft.isDragging = true;
      draft.dragStartX = event.clientX;
      draft.dragStartY = event.clientY;
    });
  }

  onMouseUpEvent() {
    this.updateLocal(draft => {
      draft.isDragging = false;
    });
  }
}
```

#### Avantages

| Critère | Évaluation |
|---------|-----------|
| **Cohérence avec ADR-0001** | ⭐⭐⭐ — Même pattern Immer (`recipe`), familiarité immédiate |
| **DX TypeScript** | ⭐⭐⭐ — `this.local.currentStep` typé, IntelliSense sur les clés, erreur compile si clé invalide |
| **Réactivité** | ⭐⭐⭐ — Re-projection automatique via le même pipeline PDR que les Events |
| **Simplicité** | ⭐⭐⭐ — Une seule méthode (`updateLocal`), un seul getter (`local`), pas de callbacks |
| **Encapsulation** | ⭐⭐⭐ — `protected` = invisible depuis l'extérieur, pas de Channel |
| **Coût framework** | ⭐⭐ — Nécessite un mini-Immer par View/Behavior avec localState |
| **DevTools** | ⭐⭐ — Observable via `onEntityMutation` étendu (si souhaité post-v1), mais pas dans le snapshot |

#### Inconvénients

| Inconvénient | Mitigation |
|-------------|-----------|
| Immer en dépendance par View/Behavior | Immer est déjà une dépendance core (Entity) — pas de coût supplémentaire |
| Pas de callbacks granulaires (`onLocalXxxUpdated`) | Voulu : la View re-projette tout, pas besoin de granularité par clé |
| Pas de traçabilité causale | Voulu : le localState n'a pas de cause externe, c'est une décision interne de la View |

---

### Option B — Callbacks `onLocal{Key}Updated` comme mécanisme UNIQUE (pattern Entity)

Le localState utilise le même système de notification que l'Entity : des callbacks nommés par clé, appelés après chaque mutation. Les callbacks sont le **seul** mécanisme de réactivité — pas de pipeline template automatique.

```typescript
class WizardView extends View<Wizard.ChannelConfig, { currentStep: number }> {

  protected get localState() {
    return { currentStep: 0 };
  }

  // Callback appelé quand `currentStep` change
  onLocalCurrentStepUpdated(prev: number, next: number) {
    // re-projection manuelle ? automatique ?
    this.projectTemplate('stepContent');
  }

  onNextStepClicked() {
    this.updateLocal(draft => { draft.currentStep += 1; });
  }
}
```

#### Avantages

| Critère | Évaluation |
|---------|-----------|
| **Granularité** | ⭐⭐⭐ — Réaction par clé, précis |
| **Cohérence avec Entity** | ⭐⭐⭐ — Même pattern `onXxxUpdated` |
| **Contrôle** | ⭐⭐⭐ — La View décide quoi re-projeter |

#### Inconvénients

| Inconvénient | Pourquoi c'est problématique |
|-------------|------|
| **Crée un mini-Feature dans la View** | Si le callback est le seul mécanisme : la View reçoit des notifications et décide quoi re-projeter → c'est de la logique de routing déguisée |
| **Verbosité pour N2/N3** | Un callback qui ne fait que re-projeter un template = bruit. La re-projection automatique suffit. |
| **Re-projection manuelle vs auto** | Si le callback doit appeler `projectTemplate()` manuellement, on perd la réactivité automatique (I42.2). Si c'est automatique, le callback ne sert à rien **pour N2/N3**. |
| **DX** | Le développeur doit écrire `onLocalCurrentStepUpdated` pour chaque clé, même quand un template N2 suffirait |

> **Note importante** : les callbacks `onLocal{Key}Updated` ne sont pas rejetés *en soi* —
> ils sont rejetés comme **mécanisme unique de réactivité**.
> L'Option A retenue les **intègre** comme complément optionnel pour le cas N1
> (mutation DOM directe sans template). Voir la section Décision.

---

### Option C — Channel local scopé à la View

Le localState passe par un Channel invisible, scopé à la View, avec Events internes (`local:currentStepUpdated`).

```typescript
class WizardView extends View<Wizard.ChannelConfig> {
  // Le framework crée un Channel interne `_local:wizard` avec events auto-générés

  onLocalCurrentStepUpdated(prev: number, next: number) {
    // …
  }
}
```

#### Avantages

| Critère | Évaluation |
|---------|-----------|
| **Cohérence avec Channels** | ⭐⭐ — Même mécanique que le domain state |
| **Extensibilité** | ⭐⭐ — On pourrait rendre le Channel visible post-v1 |

#### Inconvénients

| Inconvénient | Pourquoi c'est éliminatoire |
|-------------|------|
| **Viole I42.4** | Le localState ne doit PAS transiter par un Channel (non-broadcastable). Même scopé, c'est un Channel. |
| **Viole I42.3** | Un Channel est observable par le framework (Radio, DevTools, logs). Le localState doit être encapsulé. |
| **Sur-ingénierie** | Créer un Channel = créer un mini-domaine. Autant créer une Feature, ce qui annule l'intérêt du localState. |
| **Pollution Radio** | Chaque View avec localState crée un Channel dans Radio — invisible au développeur mais réel. |

---

## Analyse comparative

| Critère | Option A (updateLocal + dual N1/N2-N3) | Option B (callbacks uniquement) | Option C (Channel local) |
|---------|----------------------|---------------------|------------------------|
| Cohérence avec I42 | ⭐⭐⭐ | ⭐⭐ | ❌ (viole I42.3, I42.4) |
| DX TypeScript | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Simplicité | ⭐⭐⭐ | ⭐ | ⭐ |
| Réactivité N1 (DOM direct) | ⭐⭐⭐ (callbacks optionnels) | ⭐⭐⭐ (callbacks obligatoires) | ⭐⭐ |
| Réactivité N2/N3 (templates) | ⭐⭐⭐ (selector `data.local`) | ⭐ (manuelle ou redondante) | ⭐⭐ |
| Encapsulation | ⭐⭐⭐ | ⭐⭐ | ❌ |
| Surface API | ⭐⭐⭐ (3 membres + callbacks optionnels) | ⭐ (N callbacks obligatoires) | ⭐ (Channel + callbacks) |
| Coût implémentation | ⭐⭐⭐ (Immer existant) | ⭐⭐ | ⭐ (Channel machinery) |
| Pas de mini-Feature dans la View | ⭐⭐⭐ | ❌ | ❌ |

---

## Décision

### **Option A retenue** — `updateLocal(recipe)` avec mécanisme dual N1/N2-N3

Le localState est une **Entity sans Channel** — Immer produit un nouvel état immutable, et deux mécanismes complémentaires assurent la réactivité :

| Niveau | Mécanisme | Quand |
|--------|-----------|-------|
| **N1** | Callbacks optionnels `onLocal{Key}Updated(update: TLocalUpdate<T>)` | Mutation DOM directe (attributs, classes, texte) |
| **N2/N3** | Selector `select: (data) => data.local?.xxx` dans `get templates()` | Re-projection automatique via pipeline PDR |

Les deux mécanismes ne s'excluent pas. Un même `updateLocal()` peut déclencher un callback N1 **et** une re-projection N2/N3 si les clés concernent des zones différentes.

**Namespace `local` réservé** (I57) : le data key `local` dans `NamespacedData` est réservé par le framework. Aucun Channel ne peut utiliser le namespace `local`. Ce n'est **pas** un Channel — c'est un data key interne injecté dans le même pipeline.

### Justification du rejet des autres options

| Option | Raison du rejet |
|--------|-----------------|
| **B — Callbacks comme mécanisme UNIQUE** | En tant que mécanisme unique, les callbacks créent un mini-Feature dans la View — chaque clé nécessite un callback, même quand un template N2/N3 suffirait. La re-projection doit être automatique (I42.2), rendant les callbacks redondants **pour N2/N3**. En revanche, les callbacks sont **adoptés** dans l'Option A enrichie comme complément pour N1. |
| **C — Channel local scopé** | Viole I42.3 (encapsulé) et I42.4 (non-broadcastable). Un Channel, même scopé, est observable et transite par Radio. C'est une Feature déguisée, ce qui annule l'intérêt du localState. |

---

## Spécification détaillée

### API surface

| Membre | Type | Accès | Description |
|--------|------|-------|-------------|
| `get localState()` | `TLocal` | `protected` | Valeurs initiales. Appelé une fois au premier `attached`. |
| `updateLocal(recipe)` | `(draft: Draft<TLocal>) => void` | `protected` | Mutation Immer. Déclenche callbacks N1 + re-projection N2/N3 si état changé. |
| `get local` | `Readonly<TLocal>` | `protected` | Lecture de l'état courant (frozen). |
| `onLocal{Key}Updated` | `(update: TLocalUpdate<TLocal[K]>) => void` | optionnel | Callback N1 par clé. Appelé si la clé a changé. Auto-découvert (convention `onXXX`, D12). |

### Sémantique de mutation

| Aspect | Comportement |
|--------|-------------|
| **No-op** | Si l'état n'a pas changé (patches vides), aucune re-projection n'est déclenchée. |
| **Batch** | Un seul appel à `updateLocal()` = une seule re-projection, quelle que soit le nombre de clés modifiées. |
| **Synchrone** | `updateLocal()` est synchrone. L'état est à jour immédiatement après l'appel. La re-projection est planifiée (microtask). |
| **Erreur dans recipe** | Immer rollback — état inchangé. Erreur remontée comme `MutationError` (ADR-0002), mais sans metas causales (pas de correlationId). |
| **Metas** | Aucune — pas de correlationId, pas de causationId, pas de hop. Le localState n'a pas de cause externe traçable. |
| **DevTools** | Le localState N'EST PAS dans `app.snapshot()` (état volatile). En mode `debug: true`, les mutations localState sont logguées dans la console avec le nom de la View et les clés modifiées. |

### Cycle de vie

| Phase | Comportement |
|-------|-------------|
| `created` | localState non initialisé |
| `wired` | localState non initialisé |
| `attached` | `get localState()` est appelé → état initial frozen stocké. `this.local` est accessible. |
| `detached` | localState nettoyé (référence supprimée). `this.local` n'est plus accessible. |
| `destroyed` | GC libère la mémoire |

> Un état `detached` → `attached` (re-montage par le Composer) **réinitialise**
> le localState en rappelant `get localState()`. Le localState ne survit pas
> au cycle detach/attach (I42.5).

### Re-projection — Mécanisme dual

La mutation du localState déclenche deux mécanismes complémentaires :

```
updateLocal(recipe)
  → Immer produce(oldState, recipe)
  → patches vides ?
    ├── OUI → no-op (ni callback, ni re-projection)
    └── NON → changedKeys = extraire les clés des patches
              │
              ├── N1 path (synchrone) :
              │   pour chaque clé K dans changedKeys
              │     if view.onLocal{K}Updated exists
              │     → appeler avec TLocalUpdate<TLocal[K]>
              │       { actual: newState[K], previous: oldState[K] }
              │
              └── N2/N3 path (microtask) :
                  injecter { local: changedPartial } dans le pipeline selector
                  → chaque template avec select() filtre via data.local?.xxx
                  → si données changées (shallow equal) → template.project()
```

> **Ordre** : les callbacks N1 sont appelés **synchronement** (comme les callbacks Entity per-key).
> La re-projection N2/N3 est planifiée en **microtask** (comme pour les Events Channel).
> Un callback N1 peut donc lire `this.local` à jour immédiatement.

### Pipeline interne framework

```typescript
// INTERNE FRAMEWORK — appelé après updateLocal()
function onLocalStateChanged<TLocal extends TJsonSerializable>(
  view: View<any, TLocal>,
  oldState: Readonly<TLocal>,
  newState: Readonly<TLocal>,
  changedKeys: (keyof TLocal & string)[]
): void {
  // ── N1 path : callbacks granulaires (synchrone) ──
  for (const key of changedKeys) {
    const handlerName = `onLocal${capitalize(key)}Updated` as const;
    // NOTE : `as any` ci-dessous est un cast framework-interne justifié.
    // Le nom du handler est calculé dynamiquement depuis les clés du localState
    // (template literal). TypeScript ne peut pas vérifier statiquement l'existence
    // du handler sur l'instance à ce stade. La sécurité de type est assurée :
    // - Au compile-time par TLocalKeyHandlers<TLocal> (RFC-0002 §10)
    // - Au bootstrap par vérification d'existence du handler (fail-fast, ADR-0004)
    if (typeof (view as any)[handlerName] === 'function') {
      (view as any)[handlerName]({
        actual: newState[key],
        previous: oldState[key],
      } satisfies TLocalUpdate<TLocal[typeof key]>);
    }
  }

  // ── N2/N3 path : pipeline selector/template (microtask) ──
  const templates = view.templates;
  if (!templates) return;

  const changedPartial: Partial<TLocal> = {};
  for (const key of changedKeys) {
    changedPartial[key] = newState[key];
  }

  const namespacedData = { local: changedPartial };

  queueMicrotask(() => {
    for (const [uiKey, binding] of Object.entries(templates)) {
      if (!binding?.select) continue;

      const data = binding.select(namespacedData);
      if (data === undefined) continue;
      if (shallowEqual(view._dataCache[uiKey], data)) continue;

      view._dataCache[uiKey] = data;
      binding.template.project(view.nodes[uiKey], data);
    }
  });
}
```

Le localState est accessible dans les templates sous le préfixe `local.` :

```pug
//- Template PugX
div.wizard
  h2= `Étape ${local.currentStep + 1}`
  if local.validationErrors.length > 0
    ul.errors
      each error in local.validationErrors
        li= error
```

### Accès dans les templates

| Source de données | Préfixe dans le template | Provenance |
|-------------------|--------------------------|------------|
| Events `listen` (domain state) | `{namespace}.{key}` | Channel → `any` → selectors |
| localState | `local.{key}` | `this.local` interne — namespace réservé (I57) |
| Params (configuration) | `params.{key}` | `get params()` (D34) — immutable |

---

## Conséquences

### Sur le framework

| Impact | Description |
|--------|-------------|
| **Entity** | Pas d'impact — le localState n'est PAS une Entity au sens du framework (pas de namespace, pas de Channel). |
| **View / Behavior** | Nouveau generic `TLocal` optionnel. Nouvelles méthodes `updateLocal()` et `get local`. Callbacks optionnels `onLocal{Key}Updated(TLocalUpdate<T>)` auto-découverts. |
| **PDR** | Le pipeline de projection doit accepter `local.*` comme source de données via `{ local: changedPartial }` dans `NamespacedData`. |
| **Bootstrap** | Validation que le namespace `local` n'est pas utilisé par un Channel développeur. Détection erreur : `[Bonsai] Reserved namespace 'local'`. |
| **Immer** | Réutilisation de la même dépendance Immer que pour Entity.mutate(). Pas de coût supplémentaire. |
| **DevTools** | En mode debug, les mutations localState sont logguées (clés, old/new). Pas dans le snapshot. |
| **Tests** | Le localState étant `protected`, les tests unitaires y accèdent via un helper ou une sous-classe de test (pattern habituel). |

### Sur les documents

| Document | Impact |
|----------|--------|
| RFC-0001-composants §7, §8 | Arbre de décision Q1→Q2 ajouté (fait). Référence à cet ADR. |
| RFC-0001-invariants-decisions | Ajouter **I57** (namespace `local` réservé). I42 reste inchangé. D33/D37 référencent cet ADR. |
| RFC-0002-api-contrats-typage | Ajouter `updateLocal`, `get local`, `get localState`, `TLocalUpdate<T>`, `TLocalKeyHandlers<TLocal>` dans les types View et Behavior. |
| RFC-0002-entity | Aucun — le localState n'est pas une Entity. |
| RFC-0003-rendu-avance §7.4 | Enrichir `NamespacedData` avec `local?: Partial<TLocal>`. Documenter le pipeline localState dans §7.5. |

### Sur les invariants

| Invariant | Impact |
|-----------|--------|
| I42 | **Confirmé** — le mécanisme implémente les 5 contraintes sans exception. |
| I30 | **Confirmé** — le localState n'est pas un domain state. I30 continue de bannir le domain state de la View. |
| I5 | **Confirmé** — le localState n'est pas une Entity, pas de violation. |
| **I57** | **Nouveau** — le namespace `local` est réservé par le framework pour le mécanisme localState. Aucun Channel développeur ne peut utiliser ce namespace. Détecté au bootstrap. |

---

## Alternatives rejetées explicitement

### Pas de Channel framework avec namespace `local`

Il a été envisagé de créer un **Channel** framework avec namespace `local` (comme `router`). Rejeté :

- Le Router est un namespace réservé parce que c'est une **Feature spécialisée** — il a une Entity, émet des Events, répond à des Requests. Il s'inscrit dans le modèle Feature.
- Le localState ne s'inscrit PAS dans le modèle Feature. Créer un Channel violerait I42.3 et I42.4.

> **Distinction cruciale** : le namespace `local` est adopté comme **data key** dans `NamespacedData`
> (I57) — pas comme Channel. C'est une clé dans l'objet passé aux selectors, pas un Channel
> enregistré dans Radio. Pas de Channel, pas de violation.

### Pas de callbacks comme mécanisme UNIQUE de réactivité

Les callbacks `onLocal{Key}Updated` comme **seul** mécanisme (Option B pure) sont rejetés :

- Pour N2/N3, la re-projection automatique via template suffit — un callback qui ne fait que re-projeter = bruit.
- Un callback dans la View qui prend des décisions métier = violation de I13.

> **Distinction cruciale** : les callbacks sont **adoptés** comme complément optionnel pour N1
> dans l'Option A enrichie. Le rejet porte sur le pattern « callbacks = seul mécanisme ».

### Pas de `request` sur le localState

Le localState n'a pas de mécanisme request/reply. Si un Behavior ou une autre View a besoin de cette donnée, elle doit migrer vers Feature + Entity (critère de migration I42).

### Signature positionnelle `(prev, next)` pour les callbacks

La signature Entity `(prev: T, next: T, patches: Patch[])` utilise des arguments positionnels
parce que la Feature gère 3 concerns distincts (prev, next, patches). Le localState n'a pas de
patches. Avec 2 positionnels uniquement, le destructuring est préférable :

```typescript
// ❌ Positionnels — le développeur qui ne veut que 'actual' est forcé d'écrire (_prev, next)
onLocalIsOpenUpdated(_prev: boolean, next: boolean) {
  this.getUI('panel').toggleClass('open', next);
}

// ✅ Objet nommé — destructuring sélectif
onLocalIsOpenUpdated({ actual }: TLocalUpdate<boolean>) {
  this.getUI('panel').toggleClass('open', actual);
}
```

L'asymétrie avec la signature Entity est **documentée et justifiée** : pas de patches = pas de 3ème concern = objet nommé plus ergonomique.

---

## Références

- [I42 — State local de présentation](../rfc/reference/invariants.md)
- [I57 — Namespace `local` réservé](../rfc/reference/invariants.md)
- [D33 — State local autorisé dans la View](../rfc/reference/invariants.md)
- [D37 — Behavior localState](../rfc/reference/invariants.md)
- [ADR-0001 — Entity mutation pattern](ADR-0001-entity-diff-notification-strategy.md)
- [RFC-0001-composants §7 — Arbre de décision](../rfc/2-architecture/README.md)
- [RFC-0003 §2.1 — Niveaux N1/N2/N3](../rfc/5-rendu.md)
- [RFC-0003 §7.4 — NamespacedData](../rfc/5-rendu.md)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-25 | Création (Proposed) — 3 options documentées, Option A retenue |
| 2026-03-25 | Enrichissement Option A — mécanisme dual N1 (callbacks `TLocalUpdate<T>`) / N2-N3 (selector `data.local`). Namespace `local` réservé (I57). Rejet de l'Option B affiné (rejeté comme mécanisme unique, adopté pour N1). Signature `TLocalUpdate<T>` avec `{ actual, previous }`. |
| 2026-03-25 | **🟢 Accepted** — Décision validée. Option A enrichie (dual N1/N2-N3) avec `TLocalUpdate<T>`, callbacks per-key N1, selectors `data.local` N2/N3, I57 (namespace `local` réservé). |
