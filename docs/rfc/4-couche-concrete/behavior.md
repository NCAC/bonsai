# Behavior -- Plugin UI reutilisable et aveugle

> **Enrichissement DOM sans couplage a la View hote, handlers auto-derives, localState**

[<- Retour couche concrete](README.md) | [<- View](view.md) | [-> Foundation](foundation.md)

---

| Champ | Valeur |
|-------|--------|
| **Composant** | Behavior |
| **Couche** | Concrete (ephemere) |
| **Source**    | Historique : RFC-0002-api-contrats-typage §10 |
| **Statut** | Stable |
| **ADRs liees** | ADR-0007 (contrat Behavior), ADR-0009 (formulaires), ADR-0013 (code reuse), ADR-0015 (localState) |

> Q7 resolu (D36) : le contrat Behavior est **stabilise**.

---

## Table des matieres

1. [Classe abstraite Behavior](#1-classe-abstraite-behavior)
2. [Declarations et API](#2-declarations-et-api)
3. [Cycle de vie](#3-cycle-de-vie)
4. [Exemples](#4-exemples)

---

## 1. Classe abstraite Behavior

Le Behavior est un **plugin UI reutilisable et aveugle** (D36). Il ne connait pas
sa View hote -- pas de `this.view` (I44). Ses 3 parametres de type suivent le meme
pattern que la View :

```typescript
abstract class Behavior<
  TChannels extends readonly TChannelDefinition[],
  TUI extends TUIMap<any>,
  TParams extends TBehaviorParams<TUI> = TBehaviorParams<TUI>
> {
  /** Parametres resolus (selecteurs ui). Pas de rootElement -- le Behavior n'en a pas. */
  protected readonly resolvedParams: TParams;

  /**
   * Resolution des params : contrairement a la View (ou resolvedParams = merge(params, composerOptions)),
   * le Behavior n'a pas de Composer. Donc `resolvedParams === params` (identite directe).
   * Les selecteurs uiElements sont resolus par le framework dans le scope
   * du rootElement de la View hote.
   */

  /** Declarations -- a implementer par le Behavior concret */
  abstract get params(): TParams;
  // PAS de abstract get uiEvents() -- D48 (AUTO-UI-EVENT-DISCOVERY)

  /** Templates Mode C (ilots sur ses propres cles ui) -- optionnel */
  get templates(): TBehaviorTemplates<TUI> { return null; }

  /** Acces type aux elements DOM declares -- scope resolu par le framework */
  protected getUI<K extends keyof TUI>(key: K):
    TProjectionNode<TUI[K]['el']> | TProjectionRead<TUI[K]['el']>;

  /** Hooks cycle de vie */
  protected onAttach(): void;
  protected onDetach(): void;
}
```

> **I30** : le Behavior ne possede **aucun domain state**, comme la View.
> **I42, D37** : le Behavior **PEUT** declarer un state local de presentation
> (memes 5 contraintes que la View).
> **I44** : le Behavior n'a **aucun acces** a sa View hote.

### Types dedies au Behavior

```typescript
/** Params de base du Behavior -- pas de rootElement.
 *  Capacites Channel optionnelles (ADR-0024), uiElements obligatoire. */
type TBehaviorParams<TUI extends TUIMap<any>> = {
  readonly trigger?: readonly TChannelDefinition[];
  readonly listen?:  readonly TChannelDefinition[];
  readonly request?: readonly TChannelDefinition[];
  readonly uiElements: TUIElements<TUI>;
};

/** Templates du Behavior -- Mode C uniquement (ilots sur ses propres cles ui) */
type TBehaviorTemplates<TUI extends TUIMap<any>> =
  | null
  | { [K in keyof TUI]?: TViewTemplateBinding };
```

---

## 2. Declarations et API

### 2.1 TUIMap propre (I43)

Le Behavior declare ses propres cles ui avec le meme pattern que la View (D35) :
`el` = type d'element HTML, `event` = evenements autorises.

```typescript
type TTrackingUI = TUIMap<{
  trackedElement: { el: HTMLElement; event: ['click'] };
}>;
```

> **I43** : les cles TUIMap du Behavior **NE DOIVENT PAS** collisionner avec celles
> de la View hote. Verifie au bootstrap par le framework. La responsabilite est portee
> par la **View** (qui declare ses Behaviors), pas par le Behavior (qui est aveugle).

### 2.2 Auto-discovery des handlers UI (D48)

Meme convention que la View : **pas de `get uiEvents()`** -- le framework auto-derive
les handlers depuis `TUIMap` (D48). Nommage : `on${Capitalize<Key>}${Capitalize<Event>}`.
Les handlers recoivent `TUIEventFor<TUI, K, E>` (D35) :

```typescript
// TTrackingUI declare : trackedElement + ['click']
// -> le framework cherche onTrackedElementClick

onTrackedElementClick(e: TUIEventFor<TTrackingUI, 'trackedElement', 'click'>): void {
  // e.currentTarget: HTMLElement (type)
}
```

### 2.3 Channels independants

Le Behavior declare ses dependances Channel **independamment** de la View,
dans ses `params` (ADR-0024).
Memes primitives : `trigger`, `listen`, `request`. Jamais `emit()` (D7, I4).

```typescript
class TrackingBehavior extends Behavior<[Analytics.Channel], TTrackingUI> {
  get params() {
    return {
      trigger: [Analytics.channel],
      uiElements: { trackedElement: '[data-tracking-type]' },
    } as const;
  }
}
```

> Les couplages Channel du Behavior sont explicites et testables isolement.

### 2.4 Templates Mode C (N2 sur ses propres ui)

Le Behavior peut declarer des templates sur ses propres cles ui, pour de l'alteration
structurelle par ilots (N2). Le Mode B (template root/N3) est **interdit** -- le Behavior
n'a pas de rootElement.

```typescript
// IScrollBehavior : wrappe un element avec un conteneur overflow
get templates() {
  return {
    scrollContainer: { template: scrollContainerTemplate },
  };
}
```

### 2.5 localState (D37, ADR-0015)

Meme mecanisme que la View (I42, ADR-0015). Le Behavior peut declarer un state local de
presentation sous les 5 contraintes : type, reactif, encapsule, non-broadcastable,
detruit au `onDetach()`.

```typescript
abstract class Behavior<
  TChannels extends readonly TChannelDefinition[],
  TUIMap extends TUIMapDefinition = {},
  TLocal extends TJsonSerializable = never
> {
  /** Etat initial -- appele au premier `attached` de la View hote */
  protected get localState(): TLocal { /* @abstract optionnel */ }

  /** Mutation Immer -- declanche dual N1/N2-N3 (identique a View) */
  protected updateLocal(recipe: (draft: Draft<TLocal>) => void): void;

  /** Lecture de l'etat courant (frozen) */
  protected get local(): Readonly<TLocal>;
}
```

> Les callbacks N1 (`onLocal{Key}Updated`) et les selectors N2/N3 (`data.local?.xxx`)
> fonctionnent de maniere identique a la View. Voir [view.md SS7](view.md#7-api-localstate)
> pour la specification complete.

### 2.6 Droits d'alteration DOM (I45)

| Niveau | Autorise | Scope |
|--------|----------|-------|
| **N1** (attributs, classes, text) | Oui | Ses propres cles ui uniquement |
| **N2** (insertion/suppression noeuds) | Oui | Ses propres cles ui uniquement (via templates Mode C) |
| **N3** (remplacement complet rootElement) | Non | Interdit -- pas de rootElement |
| DOM de la View hote | Non | Aucun acces (I44) |

---

## 3. Cycle de vie

Le cycle de vie du Behavior est **lie a celui de sa View hote** :

| Hook | Quand |
|------|-------|
| `onAttach()` | Quand la View hote est attachee au DOM |
| `onDetach()` | Quand la View hote est detachee du DOM |

Le Behavior est instancie avec la View et detruit avec elle.
Il ne survit jamais a sa View hote.
Ces hooks sont des appels directs du framework (L2), pas des Events Channel.

Au `onAttach()`, le framework :
1. Resout les selecteurs `params.uiElements` du Behavior dans le scope du `rootElement` de la View hote
2. Verifie la non-collision des cles ui avec la View (I43)
3. Branche les uiEvents via la delegation d'evenements
4. Initialise le localState si declare

Au `onDetach()`, le framework :
1. Detruit le localState
2. Debranche les uiEvents
3. Nettoie les projections templates

### 3.1 Machine a etats

```
attached -> detached -> [destroyed]
```

| Etat | Entree (declencheur) | Sorties possibles | Hooks disponibles |
|------|----------------------|-------------------|-------------------|
| `attached` | Attache a la View hote apres son `onAttach()` | -> `detached` | `onAttach()` |
| `detached` | Detache quand la View hote recoit `onDetach()` | -> `destroyed` | `onDetach()` |
| `destroyed` | Nettoyage complet | -- (terminal) | -- |

> **Invariants de transition** :
> - Le Behavior est toujours detache **avant** la View hote
> - `localState` (I42, D37) est nettoye au `detached`
> - Aucun Behavior ne peut exister sans View hote

### 3.2 Algorithme de decision (D38) -- Behavior vs View vs Heritage

Quand utiliser un Behavior vs une View+options vs l'heritage :

- **Q0** : Sert de base de composition -> **View**
- **Q1** : Meme View, contexte different -> **View + options** (D34)
- **Q2** : Capacite orthogonale, applicable a des Views sans rapport -> **Behavior**
- **Q3** : Alteration template principal -> **Heritage** (rare, a decourager)
- **Q4** : Channels propres necessaires -> **Behavior** ; sinon -> methode privee

---

## 4. Exemples

### 4.1 TrackingBehavior -- handlers auto-derives (D48), pas d'alteration DOM

```typescript
type TTrackingUI = TUIMap<{
  trackedElement: { el: HTMLElement; event: ['click'] };
  // D48 : le framework auto-derive onTrackedElementClick
}>;

class TrackingBehavior extends Behavior<[Analytics.Channel], TTrackingUI> {
  get params() {
    return {
      trigger: [Analytics.channel],
      uiElements: { trackedElement: '[data-tracking-type]' },
    } as const;
  }

  // Pas de get uiEvents() -- D48 auto-discovery
  // trackedElement + 'click' -> onTrackedElementClick

  onTrackedElementClick(e: TUIEventFor<TTrackingUI, 'trackedElement', 'click'>): void {
    const el = e.currentTarget;
    this.trigger(Analytics.channel, 'trackInteraction', {
      type: el.getAttribute('data-tracking-type'),
      value: el.getAttribute('data-tracking-value')
    });
  }
}
```

### 4.2 IScrollBehavior -- alteration DOM N2, localState, handler auto-derive

```typescript
type TScrollLocalState = {
  scrollPosition: number;
  isScrolling: boolean;
  velocity: number;
};

type TScrollUI = TUIMap<{
  scrollContainer: { el: HTMLDivElement; event: ['scroll'] };
  // D48 : le framework auto-derive onScrollContainerScroll
}>;

class IScrollBehavior extends Behavior<[], TScrollUI, TScrollLocalState> {
  get params() {
    return {
      uiElements: { scrollContainer: '.scroll-wrapper' }
    };
  }

  get templates() {
    return { scrollContainer: scrollWrapperTemplate };
  }

  // localState (D37, I42, ADR-0015)
  protected get localState(): TScrollLocalState {
    return { scrollPosition: 0, isScrolling: false, velocity: 0 };
  }

  // Callback N1 (optionnel) -- mutation DOM directe
  onLocalIsScrollingUpdated({ actual }: TLocalUpdate<boolean>): void {
    this.getUI('scrollContainer').classList.toggle('is-scrolling', actual);
  }

  onScrollContainerScroll(e: TUIEventFor<TScrollUI, 'scrollContainer', 'scroll'>): void {
    const position = e.currentTarget.scrollTop;
    this.updateLocal(draft => {
      draft.velocity = position - draft.scrollPosition;
      draft.scrollPosition = position;
      draft.isScrolling = true;
    });
  }
}
```

### 4.3 ContactFormBehavior -- formulaire reutilisable (ADR-0009)

Un `FormBehavior` encapsule la logique de saisie, validation et feedback
d'un formulaire. Le Behavior gere le localState du formulaire (valeurs,
touched, erreurs) et delegue la soumission a la View hote via un callback.

> **ADR-0009 (Option C)** -- Le FormBehavior est le pattern recommande pour
> les formulaires reutilisables (meme formulaire d'adresse sur 3 pages).
> Pour les formulaires simples affiches une seule fois, le localState
> directement dans la View suffit (ADR-0009, Option B).

```typescript
// -- Types du formulaire --

type TContactFields = {
  name: string;
  email: string;
  message: string;
};

type TFormLocal<TFields extends Record<string, string>> = TJsonSerializable & {
  values: TFields;
  touched: Record<keyof TFields, boolean>;
  errors: Record<keyof TFields, string | null>;
  isSubmitting: boolean;
};

type TContactFormBehaviorUI = TUIMap<{
  nameField:    { el: HTMLInputElement;    event: ['input', 'blur'] };
  emailField:   { el: HTMLInputElement;    event: ['input', 'blur'] };
  messageField: { el: HTMLTextAreaElement;  event: ['input', 'blur'] };
  submitBtn:    { el: HTMLButtonElement;   event: ['click'] };
  nameError:    { el: HTMLSpanElement;     event: [] };
  emailError:   { el: HTMLSpanElement;     event: [] };
  messageError: { el: HTMLSpanElement;     event: [] };
}>;
```

```typescript
// -- Behavior concret --

class ContactFormBehavior extends Behavior<
  [],                                  // Pas de Channel propre
  TContactFormBehaviorUI,
  TFormLocal<TContactFields>           // localState type
> {
  private readonly validators: Record<keyof TContactFields, (v: string) => string | null>;
  private readonly onValidSubmit: (values: TContactFields) => void;

  constructor(config: {
    validators: Record<keyof TContactFields, (v: string) => string | null>;
    onValidSubmit: (values: TContactFields) => void;
  }) {
    super();
    this.validators = config.validators;
    this.onValidSubmit = config.onValidSubmit;
  }

  protected get localState(): TFormLocal<TContactFields> {
    return {
      values: { name: '', email: '', message: '' },
      touched: { name: false, email: false, message: false },
      errors: { name: null, email: null, message: null },
      isSubmitting: false,
    };
  }

  // D48 auto-discovery : nameField + 'input' -> onNameFieldInput

  onNameFieldInput(e: TUIEventFor<TContactFormBehaviorUI, 'nameField', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.name = value;
      draft.errors.name = this.validators.name(value);
    });
  }

  onNameFieldBlur(): void {
    this.updateLocal(draft => { draft.touched.name = true; });
  }

  onEmailFieldInput(e: TUIEventFor<TContactFormBehaviorUI, 'emailField', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.email = value;
      draft.errors.email = this.validators.email(value);
    });
  }

  onEmailFieldBlur(): void {
    this.updateLocal(draft => { draft.touched.email = true; });
  }

  onMessageFieldInput(e: TUIEventFor<TContactFormBehaviorUI, 'messageField', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.message = value;
      draft.errors.message = this.validators.message(value);
    });
  }

  onMessageFieldBlur(): void {
    this.updateLocal(draft => { draft.touched.message = true; });
  }

  onSubmitBtnClick(): void {
    const values = this.local.values;
    const errors = {
      name: this.validators.name(values.name),
      email: this.validators.email(values.email),
      message: this.validators.message(values.message),
    };
    const hasErrors = Object.values(errors).some(e => e !== null);

    this.updateLocal(draft => {
      draft.errors = errors;
      draft.touched = { name: true, email: true, message: true };
    });

    if (!hasErrors) {
      this.updateLocal(draft => { draft.isSubmitting = true; });
      this.onValidSubmit({ ...values });
    }
  }

  // -- N1 callbacks -- projection synchrone --

  onLocalErrorsUpdated(
    update: TLocalUpdate<Record<keyof TContactFields, string | null>>
  ): void {
    const errors = update.actual;
    const touched = this.local.touched;

    this.getUI('nameError').text(touched.name && errors.name ? errors.name : '');
    this.getUI('emailError').text(touched.email && errors.email ? errors.email : '');
    this.getUI('messageError').text(touched.message && errors.message ? errors.message : '');

    this.getUI('nameField').toggleClass('is-invalid', touched.name && errors.name !== null);
    this.getUI('emailField').toggleClass('is-invalid', touched.email && errors.email !== null);
    this.getUI('messageField').toggleClass('is-invalid', touched.message && errors.message !== null);
  }

  onLocalIsSubmittingUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI('submitBtn').attr('disabled', String(update.actual));
    this.getUI('submitBtn').text(update.actual ? 'Envoi...' : 'Envoyer');
  }
}
```

> **Note** : dans cet exemple le Behavior **délègue** le `trigger()` à la View hôte
> via le callback `onValidSubmit`, car c'est la View qui porte la responsabilité métier
> de déclencher la commande. Un Behavior **peut** faire `this.trigger()` directement
> (même primitives que la View : `trigger`, `listen`, `request` — D7, I4),
> mais dans le pattern formulaire la délégation est préférée pour respecter la séparation
> des responsabilités (le Behavior gère le DOM, la View orchestre le métier).

### 4.4 Declaration dans la View hote

```typescript
// Params declares selon ADR-0024 (rootElement fourni par le Composer, ADR-0026)
const contactPageViewParams = {
  listen:     [Contact.channel],
  trigger:    [Contact.channel],
  request:    [],
  uiElements: {
    pageTitle:  '.ContactPage-title',
    successMsg: '.ContactPage-success',
  },
  behaviors:  [],
  options:    {},
} as const satisfies TViewParams<TContactPageUI>;

type TContactPageViewCapabilities = TViewCapabilities<TContactPageUI, typeof contactPageViewParams>;

class ContactPageView extends View<TContactPageViewCapabilities> {
  get params() { return contactPageViewParams; }

  get behaviors() {
    return [
      new ContactFormBehavior({
        validators: {
          name: (v) => v.length < 2 ? 'Nom trop court' : null,
          email: (v) => !v.includes('@') ? 'Email invalide' : null,
          message: (v) => v.length < 10 ? 'Message trop court' : null,
        },
        onValidSubmit: (values) => {
          this.trigger(Contact.channel, 'submitContact', values);
        },
      }),
    ];
  }

  onContactContactSubmittedEvent(
    payload: { name: string; email: string; message: string },
    metas: TMessageMetas
  ): void {
    this.getUI('successMsg').text(`Merci ${payload.name} !`);
    this.getUI('successMsg').visible(true);
  }
}
```

```typescript
// Variante classique -- sans formulaire, avec TrackingBehavior et IScrollBehavior
// Params declares selon ADR-0024 (rootElement fourni par le Composer, ADR-0026)
const productViewParams = {
  listen:     [],
  trigger:    [],
  request:    [],
  uiElements: { title: '.Product-title', price: '.Product-price' },
  behaviors:  [TrackingBehavior, IScrollBehavior],
  options:    {},
} as const satisfies TViewParams<TProductUI>;

type TProductViewCapabilities = TViewCapabilities<TProductUI, typeof productViewParams>;

class ProductView extends View<TProductViewCapabilities> {
  get params() { return productViewParams; }
}
```

---

## Lecture suivante

-> [foundation.md](foundation.md) -- le point d'ancrage DOM unique
-> [view.md SS7](view.md#7-api-localstate) -- specification complete localState
-> [ADR-0009](../../adr/ADR-0009-forms-pattern.md) -- patterns formulaires
