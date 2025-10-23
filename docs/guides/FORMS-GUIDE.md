# Guide Pratique — Formulaires dans Bonsai

> **Comment gérer la saisie, la validation et la soumission de formulaires
> dans l'architecture Bonsai : 4 patterns, 1 arbre de décision.**

[← Retour aux guides](../README.md)

---

| Champ | Valeur |
|-------|--------|
| **ADR source** | [ADR-0009 — Forms Pattern](../adr/ADR-0009-forms-pattern.md) |
| **Pré-requis** | ADR-0001 (mutate), ADR-0015 (localState), D36/D38 (Behavior — [RFC-0001-composants §8](../rfc/2-architecture/README.md#8-behavior)), D48, ADR-0016 (metas) |
| **Créé le** | 2026-04-01 |

---

## TL;DR

| Situation | Pattern | Où vit l'état de saisie |
|-----------|---------|------------------------|
| Formulaire simple (contact, login, newsletter) | **localState dans la View** | View (`updateLocal`) |
| Formulaire réutilisable (adresse sur 3 pages) | **FormBehavior** | Behavior (`updateLocal`) |
| Wizard multi-step (checkout) | **Entity + localState par étape** | View (saisie) + Entity (étapes validées) |
| Recherche / filtres live | **localState + debounce + Command** | View (debounce) + Feature (requête) |

> **Règle fondamentale** : l'état de saisie (valeurs, touched, errors, isSubmitting) est
> de l'**état de présentation transitoire** (I30, I42). Seule la **soumission finale**
> produit une Command qui franchit la frontière View → Feature.

---

## Table des matières

1. [Arbre de décision](#1-arbre-de-décision)
2. [Pattern A — Formulaire simple (localState)](#2-pattern-a--formulaire-simple-localstate)
3. [Pattern B — Formulaire réutilisable (FormBehavior)](#3-pattern-b--formulaire-réutilisable-formbehavior)
4. [Pattern C — Wizard multi-step (Entity + localState)](#4-pattern-c--wizard-multi-step-entity--localstate)
5. [Pattern D — Validation asynchrone (Request Channel)](#5-pattern-d--validation-asynchrone-request-channel)
6. [Anti-patterns](#6-anti-patterns)
7. [Checklist formulaire](#7-checklist-formulaire)

---

## 1. Arbre de décision

```
Le formulaire est-il réutilisé sur plusieurs pages ?
├── OUI → Pattern B (FormBehavior)
└── NON
    └── L'état de saisie a-t-il une valeur métier persistante ?
        ├── OUI → Pattern C (Entity + localState par étape)
        │         Exemples : wizard checkout, éditeur de document
        └── NON
            └── Y a-t-il de la validation asynchrone (unicité, API) ?
                ├── OUI → Pattern A + Request Channel (§5)
                └── NON → Pattern A (localState simple)
```

---

## 2. Pattern A — Formulaire simple (localState)

> **Quand** : formulaire de contact, login, newsletter, feedback — affiché une seule fois, pas de réutilisation.

### Étape 1 — Namespace et Channel

Le Channel est **minimal** : seule la soumission est un Command. Aucun message pour la saisie en cours.

```typescript
export namespace Newsletter {
  export type State = TEntityStructure & {
    subscribers: Array<{ email: string; subscribedAt: number }>;
  };

  export type Channel = TChannelDefinition & {
    readonly namespace: 'newsletter';
    readonly commands: {
      subscribe: { email: string };
    };
    readonly events: {
      subscribed: { email: string };
    };
    readonly requests: {};
  };

  export const channel: unique symbol = Symbol('newsletter');
}
```

### Étape 2 — Feature

La Feature ne voit que la soumission. Pas de `updateField`, pas de `touchField`.

```typescript
class NewsletterFeature extends Feature<Newsletter.State, Newsletter.Channel> {
  static readonly namespace = Newsletter.channel;

  onSubscribeCommand(payload: { email: string }, metas: TMessageMetas): void {
    this.entity.mutate(
      'newsletter:subscribe',
      { payload, metas },
      draft => {
        draft.subscribers.push({ email: payload.email, subscribedAt: Date.now() });
      }
    );
    this.emit('subscribed', { email: payload.email }, { metas });
  }
}
```

### Étape 3 — View avec localState

```typescript
type TNewsletterLocal = TJsonSerializable & {
  email: string;
  error: string | null;
  isSubmitted: boolean;
};

type TNewsletterUI = TUIMap<{
  emailInput: { el: HTMLInputElement;  event: ['input'] };
  submitBtn:  { el: HTMLButtonElement; event: ['click'] };
  errorMsg:   { el: HTMLSpanElement;   event: [] };
  successMsg: { el: HTMLDivElement;    event: [] };
}>;

class NewsletterView extends View<
  [Newsletter.Channel],
  TNewsletterUI,
  { rootElement: string; uiElements: TUIElements<TNewsletterUI> },
  TNewsletterLocal
> {
  static readonly trigger = [Newsletter.channel] as const;
  static readonly listen  = [Newsletter.channel] as const;

  get params() {
    return {
      rootElement: '#newsletter-form',
      uiElements: {
        emailInput: '.Newsletter-emailInput',
        submitBtn:  '.Newsletter-submitBtn',
        errorMsg:   '.Newsletter-error',
        successMsg: '.Newsletter-success',
      },
    };
  }

  // ── localState initial (ADR-0015) ──
  protected get localState(): TNewsletterLocal {
    return { email: '', error: null, isSubmitted: false };
  }

  // ── D48 auto-discovery ──

  onEmailInputInput(e: TUIEventFor<TNewsletterUI, 'emailInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.email = value;
      draft.error = value.length > 0 && !value.includes('@')
        ? 'Email invalide'
        : null;
    });
  }

  onSubmitBtnClick(): void {
    const email = this.local.email;
    if (!email.includes('@')) {
      this.updateLocal(draft => { draft.error = 'Email invalide'; });
      return;
    }
    // ✅ Seule la soumission franchit la frontière
    this.trigger(Newsletter.channel, 'subscribe', { email });
  }

  // ── N1 callbacks — feedback synchrone ──

  onLocalErrorUpdated(update: TLocalUpdate<string | null>): void {
    this.getUI('errorMsg').text(update.actual ?? '');
    this.getUI('emailInput').toggleClass('is-invalid', update.actual !== null);
  }

  onLocalIsSubmittedUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI('successMsg').visible(update.actual);
  }

  // ── Event domaine ──

  onNewsletterSubscribedEvent(payload: { email: string }, metas: TMessageMetas): void {
    this.updateLocal(draft => { draft.isSubmitted = true; });
  }
}
```

### Points clés

- **Zéro round-trip** pour la saisie — `updateLocal()` est synchrone
- **N1 callbacks** (`onLocalErrorUpdated`, `onLocalIsSubmittedUpdated`) assurent le feedback immédiat
- **`getUI().text()`, `.toggleClass()`, `.visible()`** — pas de `.prop()`, pas de `querySelector`
- **Le Channel ne contient aucun message lié à la saisie** — overhead minimal

---

## 3. Pattern B — Formulaire réutilisable (FormBehavior)

> **Quand** : le même formulaire (adresse, identité, paiement) apparaît sur plusieurs pages.

### Étape 1 — Créer le Behavior

Le Behavior encapsule le TUIMap du formulaire, le localState, la validation et les N1 callbacks.

```typescript
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

class ContactFormBehavior extends Behavior<
  [],
  TContactFormBehaviorUI,
  TFormLocal<TContactFields>
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

  // D48 — handlers auto-dérivés depuis TContactFormBehaviorUI

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

  // N1 callbacks

  onLocalErrorsUpdated(update: TLocalUpdate<Record<keyof TContactFields, string | null>>): void {
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
    this.getUI('submitBtn').text(update.actual ? 'Envoi…' : 'Envoyer');
  }
}
```

### Étape 2 — Brancher dans la View hôte

```typescript
class ContactPageView extends View<[Contact.Channel], TContactPageUI> {
  static readonly trigger = [Contact.channel] as const;
  static readonly listen  = [Contact.channel] as const;

  get params() {
    return {
      rootElement: '#contact-page',
      uiElements: {
        pageTitle:  '.ContactPage-title',
        successMsg: '.ContactPage-success',
      },
    };
  }

  get behaviors() {
    return [
      new ContactFormBehavior({
        validators: {
          name: (v) => v.length < 2 ? 'Nom trop court' : null,
          email: (v) => !v.includes('@') ? 'Email invalide' : null,
          message: (v) => v.length < 10 ? 'Message trop court' : null,
        },
        onValidSubmit: (values) => {
          // La View fait le trigger — seule elle a accès au Channel
          this.trigger(Contact.channel, 'submitContact', values);
        },
      }),
    ];
  }
}
```

### Points clés

- Le **Behavior ne trigger jamais de Channel** (I44) — il délègue via callback
- Les **clés TUIMap du Behavior** (`nameField`, `emailField`, etc.) ne doivent pas collisionner avec celles de la View (I43)
- Le même `ContactFormBehavior` peut être branché sur `ContactPageView`, `SupportPageView`, `FeedbackModalView` avec des validators différents

---

## 4. Pattern C — Wizard multi-step (Entity + localState)

> **Quand** : checkout, inscription multi-step, assistant de configuration — les étapes validées ont une valeur métier.

### Principe

Chaque **étape** utilise le localState pour la saisie en cours. La **validation de l'étape** produit une Command qui persiste dans l'Entity. L'Entity conserve la progression globale.

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  ShippingStepView       │     │  PaymentStepView        │
│  localState: saisie     │     │  localState: saisie     │
│  ─────────────────────  │     │  ─────────────────────  │
│  ✅ → trigger(          │     │  ✅ → trigger(          │
│    completeShipping)    │     │    completePayment)     │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│  CheckoutFeature                                         │
│  Entity: { currentStep, steps: { shipping, payment } }  │
└─────────────────────────────────────────────────────────┘
```

### Code abrégé (voir ADR-0009 pour le complet)

```typescript
// Namespace Checkout — Entity stocke les étapes validées
export namespace Checkout {
  export type State = TEntityStructure & {
    currentStep: number;
    steps: {
      shipping: { address: string; city: string; zip: string } | null;
      payment: { method: 'card' | 'paypal'; cardLast4: string | null } | null;
      confirmation: { accepted: boolean } | null;
    };
    isComplete: boolean;
  };

  export type Channel = TChannelDefinition & {
    readonly namespace: 'checkout';
    readonly commands: {
      completeShipping: { address: string; city: string; zip: string };
      completePayment: { method: 'card' | 'paypal'; cardLast4: string | null };
      confirmOrder: void;
      goToStep: { step: number };
    };
    readonly events: {
      stepCompleted: { step: number };
      orderConfirmed: void;
    };
    readonly requests: {
      checkoutState: { params: void; result: State };
    };
  };

  export const channel: unique symbol = Symbol('checkout');
}
```

```typescript
// ShippingStepView — localState pour la saisie, Command pour valider l'étape
class ShippingStepView extends View<
  [Checkout.Channel], TShippingUI,
  { rootElement: string; uiElements: TUIElements<TShippingUI> },
  TShippingLocal
> {
  static readonly trigger = [Checkout.channel] as const;

  protected get localState(): TShippingLocal {
    return {
      values: { address: '', city: '', zip: '' },
      errors: { address: null, city: null, zip: null },
      touched: { address: false, city: false, zip: false },
    };
  }

  // ... D48 handlers, N1 callbacks (identiques au Pattern A) ...

  onNextBtnClick(): void {
    const { values } = this.local;
    // Validation complète
    const errors = { /* ... */ };
    const hasErrors = Object.values(errors).some(e => e !== null);

    if (!hasErrors) {
      // ✅ L'étape validée franchit la frontière → Command → Entity
      this.trigger(Checkout.channel, 'completeShipping', { ...values });
    }
  }
}
```

### Points clés

- L'**Entity stocke les étapes validées** — observable dans les DevTools, retour en arrière possible
- Chaque **View d'étape** est autonome avec son propre localState — détruit au detach (I42.5)
- Le **Composer** gère l'affichage conditionnel des étapes (résolution dynamique)

---

## 5. Pattern D — Validation asynchrone (Request Channel)

> **Quand** : vérifier l'unicité d'un username, valider un code postal via API, etc.

Combinable avec n'importe quel pattern (A, B ou C). La validation asynchrone
utilise `this.request()` pour interroger la Feature.

```typescript
// Dans la View (ou le Behavior)
private usernameCheckTimer: ReturnType<typeof setTimeout> | null = null;

onUsernameInputInput(e: TUIEventFor<TRegFormUI, 'usernameInput', 'input'>): void {
  const value = e.currentTarget.value;
  this.updateLocal(draft => {
    draft.values.username = value;
    draft.errors.username = value.length < 3 ? 'Min. 3 caractères' : null;
  });

  // Debounce 300ms avant d'appeler la Feature
  if (this.usernameCheckTimer) clearTimeout(this.usernameCheckTimer);
  if (value.length >= 3) {
    this.usernameCheckTimer = setTimeout(() => {
      this.checkUsernameAvailability(value);
    }, 300);
  }
}

private async checkUsernameAvailability(username: string): Promise<void> {
  this.updateLocal(draft => { draft.usernameChecking = true; });

  // ✅ Request Channel — async, typé, avec metas
  const isAvailable = await this.request(
    Registration.channel, 'isUsernameAvailable', { username }
  );

  this.updateLocal(draft => {
    draft.usernameChecking = false;
    if (!isAvailable && draft.values.username === username) {
      draft.errors.username = 'Ce nom est déjà pris';
    }
  });
}
```

### Points clés

- **Debounce côté View** — la Feature ne reçoit pas une requête par frappe
- **`this.request()`** retourne une `Promise<T>` — typé par le Channel
- **Guard `draft.values.username === username`** — évite d'écraser si l'utilisateur a continué à taper
- Le **spinner** est piloté par un N1 callback sur `usernameChecking`

---

## 6. Anti-patterns

| ❌ Interdit | ✅ Correct | Raison |
|------------|-----------|--------|
| `this.entity.state.values[field] = value` | `this.entity.mutate('form:update', { payload, metas }, draft => { ... })` | ADR-0001 |
| `get uiEvents() { return { 'input @ui.x': 'onX' } }` | D48 auto-discovery depuis TUIMap | D48 |
| `this.trigger('ns:cmd', payload)` | `this.trigger(Ns.channel, 'cmd', payload)` | RFC-0002 §9.3 |
| `this.getUI('btn').prop('disabled', true)` | `this.getUI('btn').attr('disabled', 'true')` | I41 |
| `document.querySelector('.x')` | `this.getUI('x')` | I39 |
| `onSubmitCommand(payload) { }` | `onSubmitCommand(payload: void, metas: TMessageMetas): void { }` | ADR-0016 |
| État `touched`/`errors` dans l'Entity | `localState` dans la View/Behavior | I30, I42, ADR-0009 |

---

## 7. Checklist formulaire

Avant de merger un formulaire dans Bonsai, vérifier :

- [ ] **Pattern choisi** selon l'arbre de décision (§1)
- [ ] **TUIMap complet** — tous les inputs, boutons, zones d'erreur déclarés avec `el` et `event`
- [ ] **D48 respecté** — pas de `get uiEvents()`, handlers nommés `on${Key}${Event}`
- [ ] **localState typé** — `TJsonSerializable`, `get localState()` retourne l'état initial
- [ ] **N1 callbacks** — `onLocal{Key}Updated` pour le feedback synchrone (erreurs, disabled, texte)
- [ ] **Soumission via `trigger()`** — channel token en premier argument
- [ ] **Feature handler avec metas** — `(payload, metas: TMessageMetas)`
- [ ] **Entity mutation via `mutate()`** — Immer draft, intent nommé
- [ ] **Pas de `.prop()`** — utiliser `.attr()`, `.text()`, `.toggleClass()`, `.visible()`
- [ ] **Pas de `querySelector` brut** — tout via `getUI(key)`
- [ ] **Validation async debounced** si nécessaire (§5)
- [ ] **Clés TUIMap Behavior** ne collisionnent pas avec la View hôte (I43)

---

## Références

- [ADR-0009 — Forms Pattern](../adr/ADR-0009-forms-pattern.md) — décision architecturale complète
- [RFC-0002 §9.1](../rfc/6-transversal/conventions-typage.md) — API localState (I42, D33, ADR-0015)
- [RFC-0002 §10.4](../rfc/6-transversal/conventions-typage.md) — Exemples Behavior (ContactFormBehavior)
- [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) — Entity mutation unique `mutate()`
- [ADR-0015](../adr/ADR-0015-local-state-mechanism.md) — Mécanisme localState View & Behavior
- [ADR-0007](../adr/ADR-0007-behavior-contract.md) — Contrat Behavior (⚪ Superseded → D36/D38 dans [RFC-0001-composants §8](../rfc/2-architecture/README.md))
- [ADR-0016](../adr/ADR-0016-metas-handler-signature.md) — Signature metas explicite
