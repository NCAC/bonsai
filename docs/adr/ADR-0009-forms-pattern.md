# ADR-0009 : Pattern Formulaires dans Bonsai

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-01 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0002](../rfc/6-transversal/conventions-typage.md) |
| **ADRs liées** | [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) (mutate), [ADR-0007](ADR-0007-behavior-contract.md) (Behavior), [ADR-0015](ADR-0015-local-state-mechanism.md) (localState), [ADR-0016](ADR-0016-metas-handler-signature.md) (metas), [ADR-0005](ADR-0005-meta-lifecycle.md) (meta lifecycle) |

---

## Contexte

Les formulaires sont un cas d'usage omniprésent qui combine **saisie utilisateur**, **validation**, **état transitoire** (touched, dirty, errors) et **soumission vers le domaine**. Dans l'architecture Bonsai, ils posent une question fondamentale :

**Où vit l'état du formulaire ?**

L'état d'un formulaire a une nature hybride :
- **Pré-soumission** : état UI transitoire (valeurs saisies, champs touchés, erreurs de validation, mode de soumission) — ne fait pas partie du domaine tant que l'utilisateur n'a pas validé.
- **Post-soumission** : état métier — les valeurs validées deviennent du domain state géré par une Entity.

Cette dualité crée une tension avec les invariants Bonsai :
- **I30** : la View ne possède **aucun domain state** — elle est une projection pure.
- **I42** : la View **peut** déclarer un state local de présentation (D33) — typé, réactif, encapsulé, non-broadcastable.
- **I6** : seule la Feature (via Entity.mutate()) peut modifier le domain state.
- **ADR-0001** : toute mutation Entity passe par `mutate(intent, params?, recipe)` avec Immer.

Depuis la rédaction initiale de cet ADR, plusieurs décisions clés ont été formalisées et changent fondamentalement le paysage :

| Décision | Impact sur les formulaires |
|----------|---------------------------|
| **ADR-0001** (mutate) | Plus de méthodes nommées sur Entity — `mutate()` unique avec Immer |
| **ADR-0015** (localState) | La View a maintenant un mécanisme formel pour l'état UI transitoire |
| **ADR-0007** (Behavior) | Plugin UI réutilisable avec TUIMap propre, localState, Channels |
| **D48** (auto-discovery) | Plus de `get uiEvents()` — handlers auto-dérivés de TUIMap |
| **D35** (TUIMap) | `getUI(key)` → `TProjectionNode` / `TProjectionRead`, pas de `.prop()` |
| **ADR-0016** (metas) | `(payload, metas)` explicite dans les handlers Feature |
| **I41** (source unique) | `getUI()` → `.attr()`, `.text()`, `.toggleClass()`, `.visible()` |

---

## Contraintes

### Non-négociables

| # | Contrainte | Source |
|---|-----------|--------|
| C1 | L'état du formulaire pré-soumission est un **état UI transitoire**, pas du domain state | I30 |
| C2 | La soumission du formulaire produit une **Command** vers la Feature | I1, I10 |
| C3 | Toute mutation Entity passe par `mutate(intent, params?, recipe)` | ADR-0001 |
| C4 | La View ne possède aucun domain state | I30 |
| C5 | Le localState est typé, réactif, encapsulé, non-broadcastable, détruit au detach | I42, ADR-0015 |
| C6 | `getUI(key)` est le seul accès DOM — pas de `querySelector` brut | I39 |
| C7 | `TUIMap` contraint les types d'éléments HTML et les événements autorisés | D35 |
| C8 | Pas de `get uiEvents()` — auto-discovery `on${Key}${Event}` | D48 |
| C9 | Le trigger utilise un **channel token** : `this.trigger(Ns.channel, 'cmd', payload)` | RFC-0002 §9.3 |
| C10 | Les handlers Feature reçoivent `(payload, metas)` explicitement | ADR-0016, I54 |
| C11 | TEntityStructure est jsonifiable — `TJsonSerializable` (D10) | RFC-0002-entity §2 |

### Souhaitables

| # | Contrainte | Motivation |
|---|-----------|-----------|
| S1 | Validation synchrone sans round-trip Feature | UX réactive (feedback < 16ms) |
| S2 | Support de la validation asynchrone (unicité email, etc.) via Request Channel | Cas d'usage courant |
| S3 | Pattern réutilisable entre formulaires similaires | DRY, Behavior pattern |
| S4 | Compatible avec les templates Pug et la PDR | Rendu déclaratif |
| S5 | Pas de dépendance externe (pas de Formik, pas de react-hook-form) | Autonomie framework |

---

## Options considérées

### Option A — Formulaire piloté par Entity

L'état complet du formulaire (valeurs, touched, errors) vit dans l'Entity de la Feature. Chaque saisie utilisateur déclenche une Command qui mute l'Entity.

#### Architecture

```
View (saisie) → trigger(Command) → Feature → entity.mutate() → Event → View (projection)
```

#### Code TypeScript

```typescript
// ── Namespace et Channel ──

export namespace ContactForm {
  export type State = TEntityStructure & {
    values: { name: string; email: string; message: string };
    touched: { name: boolean; email: boolean; message: boolean };
    errors: { name: string | null; email: string | null; message: string | null };
    isSubmitting: boolean;
  };

  export type Channel = TChannelDefinition & {
    readonly namespace: 'contactForm';

    readonly commands: {
      updateField: { field: keyof State['values']; value: string };
      touchField: { field: keyof State['values'] };
      submit: void;
    };

    readonly events: {
      submitted: { name: string; email: string; message: string };
      validationFailed: { errors: State['errors'] };
    };

    readonly requests: {
      formState: { params: void; result: State };
    };
  };

  export const channel: unique symbol = Symbol('contactForm');
}
```

```typescript
// ── Entity ──

class ContactFormEntity extends Entity<ContactForm.State> {
  protected get initialState(): ContactForm.State {
    return {
      values: { name: '', email: '', message: '' },
      touched: { name: false, email: false, message: false },
      errors: { name: null, email: null, message: null },
      isSubmitting: false,
    };
  }

  // Query methods
  getValues(): ContactForm.State['values'] {
    return this.state.values;
  }

  getErrors(): ContactForm.State['errors'] {
    return this.state.errors;
  }

  isValid(): boolean {
    return Object.values(this.state.errors).every(e => e === null);
  }
}
```

```typescript
// ── Feature ──

class ContactFormFeature extends Feature<ContactForm.State, ContactForm.Channel> {
  static readonly namespace = ContactForm.channel;

  onUpdateFieldCommand(
    payload: { field: keyof ContactForm.State['values']; value: string },
    metas: TMessageMetas
  ): void {
    this.entity.mutate(
      'contactForm:updateField',
      { payload, metas },
      draft => {
        draft.values[payload.field] = payload.value;
        // Validation synchrone inline
        draft.errors[payload.field] = this.validateField(payload.field, payload.value);
      }
    );
  }

  onTouchFieldCommand(
    payload: { field: keyof ContactForm.State['values'] },
    metas: TMessageMetas
  ): void {
    this.entity.mutate(
      'contactForm:touchField',
      { payload, metas },
      draft => {
        draft.touched[payload.field] = true;
      }
    );
  }

  onSubmitCommand(payload: void, metas: TMessageMetas): void {
    const values = this.entity.getValues();
    const errors = this.validateAll(values);
    const hasErrors = Object.values(errors).some(e => e !== null);

    if (hasErrors) {
      this.entity.mutate('contactForm:validationFailed', { metas }, draft => {
        draft.errors = errors;
        draft.touched = { name: true, email: true, message: true };
      });
      this.emit('validationFailed', { errors }, { metas });
      return;
    }

    this.entity.mutate('contactForm:submitting', { metas }, draft => {
      draft.isSubmitting = true;
    });

    this.emit('submitted', values, { metas });
  }

  // ── Validation privée ──

  private validateField(field: string, value: string): string | null {
    switch (field) {
      case 'name': return value.length < 2 ? 'Nom trop court' : null;
      case 'email': return !value.includes('@') ? 'Email invalide' : null;
      case 'message': return value.length < 10 ? 'Message trop court' : null;
      default: return null;
    }
  }

  private validateAll(values: ContactForm.State['values']): ContactForm.State['errors'] {
    return {
      name: this.validateField('name', values.name),
      email: this.validateField('email', values.email),
      message: this.validateField('message', values.message),
    };
  }
}
```

```typescript
// ── View ──

type TContactFormUI = TUIMap<{
  nameInput:    { el: HTMLInputElement;  event: ['input', 'blur'] };
  emailInput:   { el: HTMLInputElement;  event: ['input', 'blur'] };
  messageInput: { el: HTMLTextAreaElement; event: ['input', 'blur'] };
  submitBtn:    { el: HTMLButtonElement; event: ['click'] };
  nameError:    { el: HTMLSpanElement;   event: [] };
  emailError:   { el: HTMLSpanElement;   event: [] };
  messageError: { el: HTMLSpanElement;   event: [] };
}>;

class ContactFormView extends View<
  [ContactForm.Channel],
  TContactFormUI
> {
  static readonly listen  = [ContactForm.channel] as const;
  static readonly trigger = [ContactForm.channel] as const;

  get params() {
    return {
      rootElement: '#contact-form-view',
      uiElements: {
        nameInput:    '.ContactForm-nameInput',
        emailInput:   '.ContactForm-emailInput',
        messageInput: '.ContactForm-messageInput',
        submitBtn:    '.ContactForm-submitBtn',
        nameError:    '.ContactForm-nameError',
        emailError:   '.ContactForm-emailError',
        messageError: '.ContactForm-messageError',
      },
    };
  }

  // D48 — handlers auto-découverts depuis TUIMap
  // on${Capitalize<Key>}${Capitalize<Event>}

  onNameInputInput(e: TUIEventFor<TContactFormUI, 'nameInput', 'input'>): void {
    this.trigger(ContactForm.channel, 'updateField', {
      field: 'name',
      value: e.currentTarget.value,
    });
  }

  onNameInputBlur(e: TUIEventFor<TContactFormUI, 'nameInput', 'blur'>): void {
    this.trigger(ContactForm.channel, 'touchField', { field: 'name' });
  }

  onEmailInputInput(e: TUIEventFor<TContactFormUI, 'emailInput', 'input'>): void {
    this.trigger(ContactForm.channel, 'updateField', {
      field: 'email',
      value: e.currentTarget.value,
    });
  }

  onEmailInputBlur(e: TUIEventFor<TContactFormUI, 'emailInput', 'blur'>): void {
    this.trigger(ContactForm.channel, 'touchField', { field: 'email' });
  }

  onMessageInputInput(e: TUIEventFor<TContactFormUI, 'messageInput', 'input'>): void {
    this.trigger(ContactForm.channel, 'updateField', {
      field: 'message',
      value: e.currentTarget.value,
    });
  }

  onMessageInputBlur(e: TUIEventFor<TContactFormUI, 'messageInput', 'blur'>): void {
    this.trigger(ContactForm.channel, 'touchField', { field: 'message' });
  }

  onSubmitBtnClick(e: TUIEventFor<TContactFormUI, 'submitBtn', 'click'>): void {
    this.trigger(ContactForm.channel, 'submit', undefined);
  }
}
```

#### Avantages / Inconvénients

| ✅ Avantages | ❌ Inconvénients |
|-------------|-----------------|
| Domain state centralisé, sérialisable, historisable | **Chaque frappe clavier = Command → mutate()** — overhead pour de l'état transitoire |
| DevTools : l'état du formulaire est visible dans l'Entity | L'Entity contient des données UI (`touched`, `errors`) qui ne sont pas du domaine |
| Undo/redo natif (via inversePatches Immer) | **Latence perceptible** sur des formulaires complexes (round-trip View→Feature→Entity→View) |
| Validation centralisée dans la Feature | Violation de l'esprit de **I30** : `touched`/`errors` sont de l'état de présentation, pas du domaine |
| Pattern uniforme pour tous les formulaires | Sur-ingénierie pour un formulaire de contact simple |

---

### Option B — Formulaire en localState pur (ADR-0015)

L'état du formulaire vit entièrement dans le **localState** de la View. La Feature ne voit que la soumission finale.

#### Architecture

```
View (saisie) → updateLocal() → View (projection N1/N2)
View (submit) → trigger(Command) → Feature → entity.mutate()
```

#### Code TypeScript

```typescript
// ── Namespace et Channel — minimal ──

export namespace Contact {
  export type State = TEntityStructure & {
    submissions: Array<{
      name: string;
      email: string;
      message: string;
      submittedAt: number;
    }>;
  };

  export type Channel = TChannelDefinition & {
    readonly namespace: 'contact';

    readonly commands: {
      submitContact: { name: string; email: string; message: string };
    };

    readonly events: {
      contactSubmitted: { name: string; email: string; message: string };
    };

    readonly requests: {};
  };

  export const channel: unique symbol = Symbol('contact');
}
```

```typescript
// ── Feature — ne voit que la soumission ──

class ContactFeature extends Feature<Contact.State, Contact.Channel> {
  static readonly namespace = Contact.channel;

  onSubmitContactCommand(
    payload: { name: string; email: string; message: string },
    metas: TMessageMetas
  ): void {
    this.entity.mutate(
      'contact:submitContact',
      { payload, metas },
      draft => {
        draft.submissions.push({
          ...payload,
          submittedAt: Date.now(),
        });
      }
    );
    this.emit('contactSubmitted', payload, { metas });
  }
}
```

```typescript
// ── View avec localState ──

type TFormValues = {
  name: string;
  email: string;
  message: string;
};

type TFormErrors = {
  name: string | null;
  email: string | null;
  message: string | null;
};

type TContactFormLocal = TJsonSerializable & {
  values: TFormValues;
  touched: Record<keyof TFormValues, boolean>;
  errors: TFormErrors;
  isSubmitting: boolean;
};

type TContactFormUI = TUIMap<{
  nameInput:    { el: HTMLInputElement;   event: ['input', 'blur'] };
  emailInput:   { el: HTMLInputElement;   event: ['input', 'blur'] };
  messageInput: { el: HTMLTextAreaElement; event: ['input', 'blur'] };
  submitBtn:    { el: HTMLButtonElement;  event: ['click'] };
  nameError:    { el: HTMLSpanElement;    event: [] };
  emailError:   { el: HTMLSpanElement;    event: [] };
  messageError: { el: HTMLSpanElement;    event: [] };
  form:         { el: HTMLFormElement;    event: [] };
}>;

class ContactFormView extends View<
  [Contact.Channel],
  TContactFormUI,
  { rootElement: string; uiElements: TUIElements<TContactFormUI> },
  TContactFormLocal  // ← 4e générique = localState
> {
  static readonly trigger = [Contact.channel] as const;

  get params() {
    return {
      rootElement: '#contact-form-view',
      uiElements: {
        nameInput:    '.ContactForm-nameInput',
        emailInput:   '.ContactForm-emailInput',
        messageInput: '.ContactForm-messageInput',
        submitBtn:    '.ContactForm-submitBtn',
        nameError:    '.ContactForm-nameError',
        emailError:   '.ContactForm-emailError',
        messageError: '.ContactForm-messageError',
        form:         '.ContactForm',
      },
    };
  }

  // ── localState (ADR-0015) ──

  protected get localState(): TContactFormLocal {
    return {
      values: { name: '', email: '', message: '' },
      touched: { name: false, email: false, message: false },
      errors: { name: null, email: null, message: null },
      isSubmitting: false,
    };
  }

  // ── UI Event handlers (D48 auto-discovery) ──

  onNameInputInput(e: TUIEventFor<TContactFormUI, 'nameInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.name = value;
      draft.errors.name = this.validateField('name', value);
    });
  }

  onNameInputBlur(): void {
    this.updateLocal(draft => { draft.touched.name = true; });
  }

  onEmailInputInput(e: TUIEventFor<TContactFormUI, 'emailInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.email = value;
      draft.errors.email = this.validateField('email', value);
    });
  }

  onEmailInputBlur(): void {
    this.updateLocal(draft => { draft.touched.email = true; });
  }

  onMessageInputInput(e: TUIEventFor<TContactFormUI, 'messageInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.message = value;
      draft.errors.message = this.validateField('message', value);
    });
  }

  onMessageInputBlur(): void {
    this.updateLocal(draft => { draft.touched.message = true; });
  }

  onSubmitBtnClick(): void {
    // Toucher tous les champs + valider
    const values = this.local.values;
    const errors: TFormErrors = {
      name: this.validateField('name', values.name),
      email: this.validateField('email', values.email),
      message: this.validateField('message', values.message),
    };
    const hasErrors = Object.values(errors).some(e => e !== null);

    this.updateLocal(draft => {
      draft.touched = { name: true, email: true, message: true };
      draft.errors = errors;
    });

    if (!hasErrors) {
      this.updateLocal(draft => { draft.isSubmitting = true; });
      // Seule la soumission finale franchit la frontière View → Feature
      this.trigger(Contact.channel, 'submitContact', { ...values });
    }
  }

  // ── Callbacks N1 — réactivité synchrone (ADR-0015) ──

  onLocalErrorsUpdated(update: TLocalUpdate<TFormErrors>): void {
    const errors = update.actual;
    const touched = this.local.touched;

    this.getUI('nameError').text(touched.name && errors.name ? errors.name : '');
    this.getUI('emailError').text(touched.email && errors.email ? errors.email : '');
    this.getUI('messageError').text(touched.message && errors.message ? errors.message : '');

    this.getUI('nameInput').toggleClass('is-invalid', touched.name && errors.name !== null);
    this.getUI('emailInput').toggleClass('is-invalid', touched.email && errors.email !== null);
    this.getUI('messageInput').toggleClass('is-invalid', touched.message && errors.message !== null);
  }

  onLocalIsSubmittingUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI('submitBtn').attr('disabled', String(update.actual));
    this.getUI('submitBtn').text(update.actual ? 'Envoi…' : 'Envoyer');
  }

  // ── Validation locale ──

  private validateField(field: keyof TFormValues, value: string): string | null {
    switch (field) {
      case 'name': return value.length < 2 ? 'Nom trop court (min. 2 car.)' : null;
      case 'email': return !value.includes('@') ? 'Email invalide' : null;
      case 'message': return value.length < 10 ? 'Message trop court (min. 10 car.)' : null;
      default: return null;
    }
  }
}
```

#### Avantages / Inconvénients

| ✅ Avantages | ❌ Inconvénients |
|-------------|-----------------|
| **Zéro round-trip** : updateLocal() est synchrone, feedback immédiat | L'état de saisie n'apparaît pas dans l'Entity (pas de time-travel sur la saisie) |
| Respecte I30 : le domain state n'est peuplé qu'à la soumission | Validation dupliquée si la Feature doit aussi valider (défense en profondeur) |
| Le Channel est minimal — seule la soumission transite | **Non réutilisable** : la validation est locale à cette View |
| Conforme à ADR-0015 — dual N1/N2-N3, Immer, typed | Le localState est détruit au detach (I42.5) — pas de persistance brouillon |
| Pattern simple pour les formulaires courts | Les formulaires multi-step sont plus complexes (localState partagé impossible — C5) |

---

### Option C — FormBehavior réutilisable (ADR-0007)

La logique de formulaire est encapsulée dans un **Behavior** réutilisable. Le Behavior gère le localState du formulaire, la validation, et expose des méthodes à la View hôte via le pattern Behavior.

#### Architecture

```
View (saisie) → Behavior.handleInput() → Behavior.updateLocal() → N1 callbacks
View (submit) → Behavior.handleSubmit() → View.trigger(Command) → Feature
```

#### Code TypeScript

```typescript
// ── FormBehavior générique ──

/**
 * TFormBehaviorConfig — configuration d'un FormBehavior.
 * Le générique TFields contraint les noms et types des champs du formulaire.
 */
type TFormBehaviorConfig<TFields extends Record<string, string>> = {
  /** Validateurs synchrones par champ — retournent null si valide */
  validators: {
    [K in keyof TFields]?: (value: TFields[K]) => string | null;
  };
  /** Callback appelé quand le formulaire est soumis avec des données valides */
  onValidSubmit: (values: TFields) => void;
};

/**
 * TFormLocal — state local générique d'un formulaire.
 * Paramétré par les champs du formulaire.
 */
type TFormLocal<TFields extends Record<string, string>> = TJsonSerializable & {
  values: TFields;
  touched: Record<keyof TFields, boolean>;
  errors: Record<keyof TFields, string | null>;
  isSubmitting: boolean;
  submitCount: number;
};
```

```typescript
// ── Behavior concret (par formulaire) ──

type TContactFields = {
  name: string;
  email: string;
  message: string;
};

type TContactFormBehaviorUI = TUIMap<{
  nameField:    { el: HTMLInputElement;   event: ['input', 'blur'] };
  emailField:   { el: HTMLInputElement;   event: ['input', 'blur'] };
  messageField: { el: HTMLTextAreaElement; event: ['input', 'blur'] };
  submitBtn:    { el: HTMLButtonElement;  event: ['click'] };
  nameError:    { el: HTMLSpanElement;    event: [] };
  emailError:   { el: HTMLSpanElement;    event: [] };
  messageError: { el: HTMLSpanElement;    event: [] };
}>;

class ContactFormBehavior extends Behavior<
  [],                        // Pas de Channel propre — le Behavior délègue à la View
  TContactFormBehaviorUI,
  TFormLocal<TContactFields> // localState
> {
  private config: TFormBehaviorConfig<TContactFields>;

  constructor(config: TFormBehaviorConfig<TContactFields>) {
    super();
    this.config = config;
  }

  protected get localState(): TFormLocal<TContactFields> {
    return {
      values: { name: '', email: '', message: '' },
      touched: { name: false, email: false, message: false },
      errors: { name: null, email: null, message: null },
      isSubmitting: false,
      submitCount: 0,
    };
  }

  // ── D48 auto-discovery sur TContactFormBehaviorUI ──

  onNameFieldInput(e: TUIEventFor<TContactFormBehaviorUI, 'nameField', 'input'>): void {
    this.handleFieldInput('name', e.currentTarget.value);
  }

  onNameFieldBlur(): void {
    this.handleFieldBlur('name');
  }

  onEmailFieldInput(e: TUIEventFor<TContactFormBehaviorUI, 'emailField', 'input'>): void {
    this.handleFieldInput('email', e.currentTarget.value);
  }

  onEmailFieldBlur(): void {
    this.handleFieldBlur('email');
  }

  onMessageFieldInput(e: TUIEventFor<TContactFormBehaviorUI, 'messageField', 'input'>): void {
    this.handleFieldInput('message', e.currentTarget.value);
  }

  onMessageFieldBlur(): void {
    this.handleFieldBlur('message');
  }

  onSubmitBtnClick(): void {
    this.handleSubmit();
  }

  // ── Logique de formulaire ──

  private handleFieldInput(field: keyof TContactFields, value: string): void {
    this.updateLocal(draft => {
      draft.values[field] = value;
      const validator = this.config.validators[field];
      if (validator) {
        draft.errors[field] = validator(value);
      }
    });
  }

  private handleFieldBlur(field: keyof TContactFields): void {
    this.updateLocal(draft => {
      draft.touched[field] = true;
    });
  }

  private handleSubmit(): void {
    const values = this.local.values;
    const errors = {} as Record<keyof TContactFields, string | null>;
    let hasErrors = false;

    for (const field of Object.keys(values) as Array<keyof TContactFields>) {
      const validator = this.config.validators[field];
      errors[field] = validator ? validator(values[field]) : null;
      if (errors[field] !== null) hasErrors = true;
    }

    this.updateLocal(draft => {
      draft.errors = errors;
      draft.submitCount += 1;
      // Toucher tous les champs
      for (const field of Object.keys(draft.touched)) {
        (draft.touched as Record<string, boolean>)[field] = true;
      }
    });

    if (!hasErrors) {
      this.updateLocal(draft => { draft.isSubmitting = true; });
      this.config.onValidSubmit({ ...values });
    }
  }

  // ── N1 callbacks — projection synchrone ──

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

```typescript
// ── View hôte — délègue au Behavior ──

type TContactPageUI = TUIMap<{
  // Clés propres de la View (non gérées par le Behavior)
  pageTitle: { el: HTMLHeadingElement; event: [] };
  successMsg: { el: HTMLDivElement; event: [] };
}>;

class ContactPageView extends View<
  [Contact.Channel],
  TContactPageUI
> {
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
          // La View fait le trigger — elle seule a accès au Channel
          this.trigger(Contact.channel, 'submitContact', values);
        },
      }),
    ];
  }

  // ── Réaction aux Events domaine ──

  onContactContactSubmittedEvent(
    payload: { name: string; email: string; message: string },
    metas: TMessageMetas
  ): void {
    this.getUI('successMsg').text(`Merci ${payload.name}, votre message a été envoyé !`);
    this.getUI('successMsg').visible(true);
  }
}
```

#### Avantages / Inconvénients

| ✅ Avantages | ❌ Inconvénients |
|-------------|-----------------|
| **Réutilisable** : le Behavior encapsule la logique de formulaire | Plus de code structurel (Behavior + View hôte) |
| **Testable isolément** — le Behavior a son propre TUIMap et localState | Le Behavior ne peut pas `trigger()` un Channel directement (I44) — callback vers la View |
| Conforme ADR-0007 : Behavior = plugin UI avec TUIMap propre, localState, D48 | Les clés TUIMap du Behavior ne doivent pas collisionner avec celles de la View (I43) |
| Séparation claire : logique formulaire dans le Behavior, logique domaine dans la Feature | Pattern plus avancé — courbe d'apprentissage |
| Le même FormBehavior peut servir sur plusieurs pages avec des configs différentes | Composition limitée : un Behavior ne peut pas contenir d'autres Behaviors |

---

### Option D — Hybride : localState + soumission Entity (recommandé)

Combine les **Options B et C** selon la complexité du formulaire :

| Complexité | Pattern | Justification |
|-----------|---------|---------------|
| **Simple** (contact, newsletter, login) | localState dans la View (Option B) | Overhead minimal, code localisé |
| **Réutilisable** (formulaire d'adresse sur 3 pages) | FormBehavior (Option C) | DRY, testable isolément |
| **Complexe** (wizard multi-step, checkout) | localState + Entity pour les étapes validées | Les étapes validées deviennent du domain state |
| **Temps-réel** (recherche, filtres live) | localState pour le debounce, Command pour la requête | Pas de round-trip Entity par frappe |

#### Règles de décision

```
Le formulaire est-il affiché sur plusieurs pages ?
├── OUI → FormBehavior (Option C)
└── NON → L'état de saisie a-t-il une valeur métier ?
          ├── OUI → Entity (Option A) — rare (éditeur de document, wizard)
          └── NON → localState dans la View (Option B)
```

#### Formulaire simple — Pattern localState (complet)

```typescript
// ── Namespace minimal : seule la soumission est un Command ──

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

```typescript
// ── View avec localState ──

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
    // Soumission → Command vers la Feature
    this.trigger(Newsletter.channel, 'subscribe', { email });
  }

  // ── N1 callbacks ──

  onLocalErrorUpdated(update: TLocalUpdate<string | null>): void {
    this.getUI('errorMsg').text(update.actual ?? '');
    this.getUI('emailInput').toggleClass('is-invalid', update.actual !== null);
  }

  onLocalIsSubmittedUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI('successMsg').visible(update.actual);
  }

  // ── Event handler : confirmation de soumission ──

  onNewsletterSubscribedEvent(
    payload: { email: string },
    metas: TMessageMetas
  ): void {
    this.updateLocal(draft => { draft.isSubmitted = true; });
  }
}
```

#### Formulaire avec validation asynchrone — Pattern Request

```typescript
// ── Channel avec Request pour validation async ──

export namespace Registration {
  export type State = TEntityStructure & {
    users: Array<{ username: string; email: string; registeredAt: number }>;
  };

  export type Channel = TChannelDefinition & {
    readonly namespace: 'registration';
    readonly commands: {
      register: { username: string; email: string; password: string };
    };
    readonly events: {
      registered: { username: string };
      registrationFailed: { reason: string };
    };
    readonly requests: {
      isUsernameAvailable: { params: { username: string }; result: boolean };
    };
  };

  export const channel: unique symbol = Symbol('registration');
}
```

```typescript
// ── View avec validation async via Request ──

type TRegFormLocal = TJsonSerializable & {
  values: { username: string; email: string; password: string };
  errors: { username: string | null; email: string | null; password: string | null };
  touched: { username: boolean; email: boolean; password: boolean };
  usernameChecking: boolean;
};

type TRegFormUI = TUIMap<{
  usernameInput:  { el: HTMLInputElement;  event: ['input', 'blur'] };
  emailInput:     { el: HTMLInputElement;  event: ['input', 'blur'] };
  passwordInput:  { el: HTMLInputElement;  event: ['input', 'blur'] };
  submitBtn:      { el: HTMLButtonElement; event: ['click'] };
  usernameError:  { el: HTMLSpanElement;   event: [] };
  emailError:     { el: HTMLSpanElement;   event: [] };
  passwordError:  { el: HTMLSpanElement;   event: [] };
  usernameSpinner: { el: HTMLSpanElement;  event: [] };
}>;

class RegistrationView extends View<
  [Registration.Channel],
  TRegFormUI,
  { rootElement: string; uiElements: TUIElements<TRegFormUI> },
  TRegFormLocal
> {
  static readonly trigger  = [Registration.channel] as const;
  static readonly listen   = [Registration.channel] as const;
  static readonly request  = [Registration.channel] as const;

  get params() {
    return {
      rootElement: '#registration-form',
      uiElements: {
        usernameInput:   '.RegForm-usernameInput',
        emailInput:      '.RegForm-emailInput',
        passwordInput:   '.RegForm-passwordInput',
        submitBtn:       '.RegForm-submitBtn',
        usernameError:   '.RegForm-usernameError',
        emailError:      '.RegForm-emailError',
        passwordError:   '.RegForm-passwordError',
        usernameSpinner: '.RegForm-usernameSpinner',
      },
    };
  }

  protected get localState(): TRegFormLocal {
    return {
      values: { username: '', email: '', password: '' },
      errors: { username: null, email: null, password: null },
      touched: { username: false, email: false, password: false },
      usernameChecking: false,
    };
  }

  // Timer pour debounce
  private usernameCheckTimer: ReturnType<typeof setTimeout> | null = null;

  // ── D48 handlers ──

  onUsernameInputInput(e: TUIEventFor<TRegFormUI, 'usernameInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.username = value;
      draft.errors.username = value.length < 3 ? 'Min. 3 caractères' : null;
    });

    // Debounce la vérification d'unicité (300ms)
    if (this.usernameCheckTimer) clearTimeout(this.usernameCheckTimer);
    if (value.length >= 3) {
      this.usernameCheckTimer = setTimeout(() => {
        this.checkUsernameAvailability(value);
      }, 300);
    }
  }

  onUsernameInputBlur(): void {
    this.updateLocal(draft => { draft.touched.username = true; });
  }

  onEmailInputInput(e: TUIEventFor<TRegFormUI, 'emailInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.email = value;
      draft.errors.email = !value.includes('@') ? 'Email invalide' : null;
    });
  }

  onEmailInputBlur(): void {
    this.updateLocal(draft => { draft.touched.email = true; });
  }

  onPasswordInputInput(e: TUIEventFor<TRegFormUI, 'passwordInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.password = value;
      draft.errors.password = value.length < 8 ? 'Min. 8 caractères' : null;
    });
  }

  onPasswordInputBlur(): void {
    this.updateLocal(draft => { draft.touched.password = true; });
  }

  onSubmitBtnClick(): void {
    const { values, errors } = this.local;
    const hasErrors = Object.values(errors).some(e => e !== null);

    this.updateLocal(draft => {
      draft.touched = { username: true, email: true, password: true };
    });

    if (!hasErrors && !this.local.usernameChecking) {
      this.trigger(Registration.channel, 'register', { ...values });
    }
  }

  // ── Validation asynchrone via Request Channel ──

  private async checkUsernameAvailability(username: string): Promise<void> {
    this.updateLocal(draft => { draft.usernameChecking = true; });

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

  // ── N1 callbacks ──

  onLocalErrorsUpdated(update: TLocalUpdate<TRegFormLocal['errors']>): void {
    const errors = update.actual;
    const touched = this.local.touched;

    this.getUI('usernameError').text(touched.username && errors.username ? errors.username : '');
    this.getUI('emailError').text(touched.email && errors.email ? errors.email : '');
    this.getUI('passwordError').text(touched.password && errors.password ? errors.password : '');

    this.getUI('usernameInput').toggleClass('is-invalid', touched.username && errors.username !== null);
    this.getUI('emailInput').toggleClass('is-invalid', touched.email && errors.email !== null);
    this.getUI('passwordInput').toggleClass('is-invalid', touched.password && errors.password !== null);
  }

  onLocalUsernameCheckingUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI('usernameSpinner').visible(update.actual);
  }

  // ── Event handlers domaine ──

  onRegistrationRegisteredEvent(payload: { username: string }, metas: TMessageMetas): void {
    // Redirection ou message de succès
  }

  onRegistrationRegistrationFailedEvent(payload: { reason: string }, metas: TMessageMetas): void {
    this.updateLocal(draft => {
      draft.errors.username = payload.reason;
    });
  }
}
```

#### Wizard multi-step — Pattern Entity + localState

```typescript
// ── Chaque étape validée persiste dans l'Entity ──

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
// ── Feature Checkout ──

class CheckoutFeature extends Feature<Checkout.State, Checkout.Channel> {
  static readonly namespace = Checkout.channel;

  onCompleteShippingCommand(
    payload: { address: string; city: string; zip: string },
    metas: TMessageMetas
  ): void {
    this.entity.mutate(
      'checkout:completeShipping',
      { payload, metas },
      draft => {
        draft.steps.shipping = payload;
        draft.currentStep = 2;
      }
    );
    this.emit('stepCompleted', { step: 1 }, { metas });
  }

  onCompletePaymentCommand(
    payload: { method: 'card' | 'paypal'; cardLast4: string | null },
    metas: TMessageMetas
  ): void {
    this.entity.mutate(
      'checkout:completePayment',
      { payload, metas },
      draft => {
        draft.steps.payment = payload;
        draft.currentStep = 3;
      }
    );
    this.emit('stepCompleted', { step: 2 }, { metas });
  }

  onConfirmOrderCommand(payload: void, metas: TMessageMetas): void {
    this.entity.mutate(
      'checkout:confirmOrder',
      { metas },
      draft => {
        draft.steps.confirmation = { accepted: true };
        draft.isComplete = true;
      }
    );
    this.emit('orderConfirmed', undefined, { metas });
  }

  onGoToStepCommand(payload: { step: number }, metas: TMessageMetas): void {
    this.entity.mutate('checkout:goToStep', { metas }, draft => {
      draft.currentStep = payload.step;
    });
  }
}
```

```typescript
// ── ShippingStepView — localState pour la saisie, Command pour valider l'étape ──

type TShippingLocal = TJsonSerializable & {
  values: { address: string; city: string; zip: string };
  errors: { address: string | null; city: string | null; zip: string | null };
  touched: { address: boolean; city: boolean; zip: boolean };
};

type TShippingUI = TUIMap<{
  addressInput: { el: HTMLInputElement;  event: ['input', 'blur'] };
  cityInput:    { el: HTMLInputElement;  event: ['input', 'blur'] };
  zipInput:     { el: HTMLInputElement;  event: ['input', 'blur'] };
  nextBtn:      { el: HTMLButtonElement; event: ['click'] };
  addressError: { el: HTMLSpanElement;   event: [] };
  cityError:    { el: HTMLSpanElement;   event: [] };
  zipError:     { el: HTMLSpanElement;   event: [] };
}>;

class ShippingStepView extends View<
  [Checkout.Channel],
  TShippingUI,
  { rootElement: string; uiElements: TUIElements<TShippingUI> },
  TShippingLocal
> {
  static readonly trigger = [Checkout.channel] as const;

  get params() {
    return {
      rootElement: '#checkout-shipping',
      uiElements: {
        addressInput: '.Shipping-addressInput',
        cityInput:    '.Shipping-cityInput',
        zipInput:     '.Shipping-zipInput',
        nextBtn:      '.Shipping-nextBtn',
        addressError: '.Shipping-addressError',
        cityError:    '.Shipping-cityError',
        zipError:     '.Shipping-zipError',
      },
    };
  }

  protected get localState(): TShippingLocal {
    return {
      values: { address: '', city: '', zip: '' },
      errors: { address: null, city: null, zip: null },
      touched: { address: false, city: false, zip: false },
    };
  }

  // ── D48 handlers (pattern identique aux exemples précédents) ──

  onAddressInputInput(e: TUIEventFor<TShippingUI, 'addressInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.address = value;
      draft.errors.address = value.length < 5 ? 'Adresse trop courte' : null;
    });
  }

  onAddressInputBlur(): void {
    this.updateLocal(draft => { draft.touched.address = true; });
  }

  onCityInputInput(e: TUIEventFor<TShippingUI, 'cityInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.city = value;
      draft.errors.city = value.length < 2 ? 'Ville requise' : null;
    });
  }

  onCityInputBlur(): void {
    this.updateLocal(draft => { draft.touched.city = true; });
  }

  onZipInputInput(e: TUIEventFor<TShippingUI, 'zipInput', 'input'>): void {
    const value = e.currentTarget.value;
    this.updateLocal(draft => {
      draft.values.zip = value;
      draft.errors.zip = !/^\d{5}$/.test(value) ? 'Code postal invalide (5 chiffres)' : null;
    });
  }

  onZipInputBlur(): void {
    this.updateLocal(draft => { draft.touched.zip = true; });
  }

  onNextBtnClick(): void {
    const { values } = this.local;
    const errors = {
      address: values.address.length < 5 ? 'Adresse trop courte' : null,
      city: values.city.length < 2 ? 'Ville requise' : null,
      zip: !/^\d{5}$/.test(values.zip) ? 'Code postal invalide' : null,
    };
    const hasErrors = Object.values(errors).some(e => e !== null);

    this.updateLocal(draft => {
      draft.errors = errors;
      draft.touched = { address: true, city: true, zip: true };
    });

    if (!hasErrors) {
      // L'étape validée franchit la frontière → Command → Entity
      this.trigger(Checkout.channel, 'completeShipping', { ...values });
    }
  }

  // ── N1 callbacks ──

  onLocalErrorsUpdated(update: TLocalUpdate<TShippingLocal['errors']>): void {
    const errors = update.actual;
    const touched = this.local.touched;

    this.getUI('addressError').text(touched.address && errors.address ? errors.address : '');
    this.getUI('cityError').text(touched.city && errors.city ? errors.city : '');
    this.getUI('zipError').text(touched.zip && errors.zip ? errors.zip : '');

    this.getUI('addressInput').toggleClass('is-invalid', touched.address && errors.address !== null);
    this.getUI('cityInput').toggleClass('is-invalid', touched.city && errors.city !== null);
    this.getUI('zipInput').toggleClass('is-invalid', touched.zip && errors.zip !== null);
  }
}
```

---

## Analyse comparative

| Critère | A — Entity | B — localState | C — FormBehavior | D — Hybride |
|---------|-----------|---------------|-----------------|-------------|
| **Performance** | ⭐⭐ (round-trip par frappe) | ⭐⭐⭐⭐⭐ (synchrone) | ⭐⭐⭐⭐⭐ (synchrone) | ⭐⭐⭐⭐⭐ |
| **Type-safety** | ⭐⭐⭐⭐ (Channel typé) | ⭐⭐⭐⭐ (localState typé) | ⭐⭐⭐⭐⭐ (config typée) | ⭐⭐⭐⭐⭐ |
| **Réutilisabilité** | ⭐⭐ (Feature entière) | ⭐⭐ (View unique) | ⭐⭐⭐⭐⭐ (Behavior plug) | ⭐⭐⭐⭐ |
| **Simplicité** | ⭐⭐ (beaucoup de code) | ⭐⭐⭐⭐⭐ (tout dans la View) | ⭐⭐⭐ (Behavior + View) | ⭐⭐⭐⭐ |
| **Conformité I30** | ⭐⭐ (état UI dans Entity) | ⭐⭐⭐⭐⭐ (conforme) | ⭐⭐⭐⭐⭐ (conforme) | ⭐⭐⭐⭐⭐ |
| **Observabilité** | ⭐⭐⭐⭐⭐ (DevTools) | ⭐⭐⭐ (local seulement) | ⭐⭐⭐ (local seulement) | ⭐⭐⭐⭐ |
| **Maintenabilité** | ⭐⭐⭐ (dispersé) | ⭐⭐⭐⭐ (localisé) | ⭐⭐⭐⭐⭐ (encapsulé) | ⭐⭐⭐⭐⭐ |
| **Wizard multi-step** | ⭐⭐⭐⭐⭐ (natif) | ⭐⭐ (localState non partageable) | ⭐⭐⭐ (limité) | ⭐⭐⭐⭐⭐ |
| **DX** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## Décision

### Option D — Hybride (recommandé)

L'**Option D** est recommandée car elle offre le meilleur compromis entre simplicité, performance et couverture des cas d'usage :

1. **Formulaires simples** (80% des cas) → **localState dans la View** (Option B) :
   - Aucun overhead de Channel pour la saisie en cours
   - Feedback immédiat (synchrone) via callbacks N1
   - Le domain state n'est peuplé qu'à la soumission finale
   - Conforme à I30 : `touched`/`errors`/`values` sont de l'état de présentation transitoire

2. **Formulaires réutilisables** → **FormBehavior** (Option C) :
   - Un formulaire d'adresse utilisé sur 3 pages = un seul Behavior
   - La validation est encapsulée et testable isolément
   - La View hôte ne voit que le callback `onValidSubmit`

3. **Formulaires complexes multi-step** → **Entity + localState** par étape :
   - Chaque étape utilise le localState pour la saisie
   - La validation de l'étape produit une Command qui persiste dans l'Entity
   - L'Entity conserve la progression et permet le retour en arrière
   - Les DevTools montrent l'avancement du wizard

### Rejet des autres options

- **Option A pure** : rejetée car elle traite des données UI transitoires (`touched`, `errors`, `isSubmitting`) comme du domain state, en violation de l'esprit de I30. De plus, chaque frappe clavier génère un round-trip View→Feature→Entity→View, avec un overhead injustifié pour de l'état de présentation.

- **Option B pure** : viable pour les formulaires simples, mais ne couvre pas la réutilisabilité (S3) ni les wizards multi-step.

- **Option C pure** : viable pour les formulaires réutilisables, mais ajoute un overhead structurel inutile pour un formulaire simple affiché une seule fois.

---

## Anti-patterns

### ❌ Mutation directe du state Entity

```typescript
// ❌ INTERDIT — violation ADR-0001
onUpdateFieldCommand(payload) {
  this.entity.state.values[payload.field] = payload.value;
}

// ✅ CORRECT — mutation via mutate() avec Immer draft
onUpdateFieldCommand(payload, metas) {
  this.entity.mutate('form:updateField', { payload, metas }, draft => {
    draft.values[payload.field] = payload.value;
  });
}
```

### ❌ get uiEvents() (supprimé par D48)

```typescript
// ❌ INTERDIT — D48 a supprimé ce pattern
get uiEvents() {
  return {
    'input @ui.nameInput': 'onNameInput',
    'click @ui.submitBtn': 'onSubmit',
  };
}

// ✅ CORRECT — D48 auto-discovery depuis TUIMap
// Le framework dérive onNameInputInput, onSubmitBtnClick depuis :
type TUI = TUIMap<{
  nameInput: { el: HTMLInputElement; event: ['input'] };
  submitBtn: { el: HTMLButtonElement; event: ['click'] };
}>;
```

### ❌ trigger sans channel token

```typescript
// ❌ INTERDIT — namespace-qualified string
this.trigger('contactForm:updateField', { field: 'name', value });

// ✅ CORRECT — channel token (symbol) en premier argument
this.trigger(ContactForm.channel, 'updateField', { field: 'name', value });
```

### ❌ getUI().prop() (n'existe pas)

```typescript
// ❌ INTERDIT — .prop() n'existe pas sur TProjectionNode/TProjectionRead
this.getUI('submitBtn').prop('disabled', true);

// ✅ CORRECT — .attr() pour les attributs HTML
this.getUI('submitBtn').attr('disabled', 'true');
// ✅ CORRECT — .toggleClass() pour les classes CSS
this.getUI('nameInput').toggleClass('is-invalid', true);
// ✅ CORRECT — .text() pour le contenu texte
this.getUI('errorMsg').text('Champ requis');
// ✅ CORRECT — .visible() pour la visibilité
this.getUI('successMsg').visible(true);
```

### ❌ querySelector brut

```typescript
// ❌ INTERDIT — I39
const input = document.querySelector('.my-input') as HTMLInputElement;

// ✅ CORRECT — toujours via getUI()
const projectionNode = this.getUI('myInput');
```

### ❌ Metas omises dans les handlers Feature

```typescript
// ❌ INTERDIT — ADR-0016 exige (payload, metas)
onSubmitCommand(payload) { ... }

// ✅ CORRECT
onSubmitCommand(payload: void, metas: TMessageMetas): void { ... }
```

---

## Conséquences

### Impact sur le code

| Élément | Impact |
|---------|--------|
| **Views avec formulaires simples** | Utilisent `localState` (ADR-0015) — `updateLocal()`, callbacks N1, `getUI()` |
| **Formulaires réutilisables** | Encapsulés dans un `Behavior` (ADR-0007) avec TUIMap propre |
| **Features recevant des soumissions** | Handlers `(payload, metas)` (ADR-0016), `entity.mutate()` (ADR-0001) |
| **Wizards multi-step** | Hybride : localState par étape + Entity pour la progression |

### Impact sur les RFC

| Document | Impact |
|----------|--------|
| **RFC-0002 §9.1** (localState) | Ajouter une note mentionnant les formulaires comme cas d'usage typique |
| **RFC-0002 §10** (Behavior) | Mentionner `FormBehavior` comme exemple canonique de Behavior |
| **RFC-0002-entity §4** | Aucun — `mutate()` reste le seul pattern de mutation (conforme ADR-0001) |

### Impact sur les invariants

Aucun nouvel invariant requis. Ce pattern respecte intégralement :
- **I30** (View sans domain state), **I42** (localState 5 contraintes), **I39** (getUI seul accès DOM)
- **I43** (TUIMap Behavior non-collision), **I44** (Behavior ne touche pas le DOM View)
- **I41** (source unique de mutation @ui), **I54** (metas explicites)

### Actions

| # | Action | Priorité |
|---|--------|----------|
| A1 | Ajouter un exemple `FormBehavior` dans RFC-0002 §10.4 | P2 |
| A2 | Ajouter une note « formulaires » dans RFC-0002 §9.1 (localState) | P3 |
| A3 | Écrire un guide pratique `docs/guides/FORMS-GUIDE.md` avec les 4 patterns | P3 |
| A4 | Implémenter un `ContactFormView` dans le sandbox pour valider le pattern | P2 |
| A5 | ~~Passer cet ADR à **Accepted** après validation du prototype sandbox~~ | ✅ |

---

## Historique

| Date | Changement |
|------|-----------|
| 2026-03-18 | Création initiale — 4 options (Entity/FormController/View local/Hybrid) |
| 2026-04-01 | **Réécriture complète** — alignement sur ADR-0001 (mutate), ADR-0015 (localState), D36/D38 (ex-ADR-0007, Behavior ⚪ Superseded), D48 (auto-discovery), ADR-0016 (metas), I41 (TProjectionNode API). Suppression Option B (FormController) obsolète. Ajout Option C (FormBehavior). Tous les exemples réécrits avec les API actuelles. |
| 2026-04-01 | Passage à 🟢 **Accepted** — prototype sandbox validé. |
