# Guide Pratique — Formulaires dans Bonsai

> **Comment gérer la saisie, la validation et la soumission de formulaires
> dans l'architecture Bonsai : 4 patterns, 1 arbre de décision.**

[← Retour aux guides](../README.md)

> **⚠ État du guide (2026-09-16, audit doc)** — Les Patterns A, C et D
> (localState de View, Entity + wizard, validation asynchrone) sont réécrits
> selon le **pattern modulaire courant** (ADR-0039 manifest applicatif,
> ADR-0040 `static readonly channel`, ADR-0042 `TFeatureContract`/`TUIContract`/
> `TUIElements`, ADR-0046 `implements TFeatureCallbacks`) — ils compilent
> contre l'API livrée en strate 1a.
>
> Le **Pattern B (FormBehavior)** reste partiellement anticipé : `Behavior`
> n'est pas encore implémentée en `packages/` (livraison prévue Strate 2,
> ADR-0028). Le code montré suit le pattern modulaire cible documenté dans
> [behavior.md §4.3](../rfc/4-couche-concrete/behavior.md#43-contactformbehavior----formulaire-reutilisable-adr-0009)
> (identique à View par I83), mais **n'a pas encore de classe `Behavior`
> réelle à étendre** — à revalider à la livraison de la Strate 2.

---

| Champ          | Valeur                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR source** | [ADR-0009 — Forms Pattern](../adr/ADR-0009-forms-pattern.md)                                                                                               |
| **Pré-requis** | [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) (mutate), [ADR-0015](../adr/ADR-0015-local-state-mechanism.md) (localState), [behavior.md](../rfc/4-couche-concrete/behavior.md) (Behavior — statut anticipé Strate 2), [ADR-0016](../adr/ADR-0016-metas-handler-signature.md) (metas) |
| **Créé le**    | 2026-04-01                                                                                                                                                 |

---

## TL;DR

| Situation                                      | Pattern                             | Où vit l'état de saisie                  |
| ---------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| Formulaire simple (contact, login, newsletter) | **localState dans la View**         | View (`updateLocal`)                     |
| Formulaire réutilisable (adresse sur 3 pages)  | **FormBehavior**                    | Behavior (`updateLocal`)                 |
| Wizard multi-step (checkout)                   | **Entity + localState par étape**   | View (saisie) + Entity (étapes validées) |
| Recherche / filtres live                       | **localState + debounce + Command** | View (debounce) + Feature (requête)      |

> **Règle fondamentale** : l'état de saisie (valeurs, touched, errors, isSubmitting) est
> de l'**état de présentation transitoire** (I30, I42). Seule la **soumission finale**
> produit une Command qui franchit la frontière View → Feature.

---

## Table des matières

1. [Arbre de décision](#1-arbre-de-décision)
2. [Pattern A — Formulaire simple (localState)](#2-pattern-a--formulaire-simple-localstate)
3. [Pattern B — Formulaire réutilisable (FormBehavior)](#3-pattern-b--formulaire-réutilisable-formbehavior)
4. [Pattern C — Wizard multi-step (Entity + localState)](#4-pattern-c--wizard-multi-step-entity--localstate)
5. [Pattern D — Validation différée (Request Channel)](#5-pattern-d--validation-différée-request-channel)
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

### Étape 1 — Contrat Channel et Feature

Le Channel est **minimal** : seule la soumission est un Command. Aucun message pour la saisie en cours.

```typescript
import { Feature, type TFeatureCallbacks, type TMessageMetas } from "@bonsai/feature";
import { type TChannelToken } from "@bonsai/event";
import { Entity } from "@bonsai/entity";

// ─── Contrat Channel (ADR-0040) ──────────────────────────────────────────────

type TNewsletterDef = {
  readonly commands: { subscribe: { email: string } };
  readonly events: { subscribed: { email: string } };
  readonly requests: {};
};

// ─── Entity ───────────────────────────────────────────────────────────────

type TNewsletterState = {
  subscribers: Array<{ email: string; subscribedAt: number }>;
};

class NewsletterEntity extends Entity<TNewsletterState> {
  protected defineInitialState(): TNewsletterState {
    return { subscribers: [] };
  }
}

// ─── Feature ──────────────────────────────────────────────────────────────
// La Feature ne voit que la soumission. Pas de `updateField`, pas de `touchField`.

const newsletterListens = [] as const; // aucun Channel externe écouté ici

class NewsletterFeature
  extends Feature<NewsletterEntity, TNewsletterDef, "newsletter">
  implements TFeatureCallbacks<TNewsletterDef, typeof newsletterListens>
{
  // static — I73, identifie la CLASSE, consommable sans instance.
  static readonly channel: TChannelToken<TNewsletterDef, "newsletter"> = {
    namespace: "newsletter"
  };

  // abstract get d'INSTANCE — I93.
  get listens() { return newsletterListens; }
  get queries() { return [] as const; }

  protected get Entity() { return NewsletterEntity; }

  onSubscribeCommand(payload: { email: string }, metas: TMessageMetas): void {
    this.entity.mutate("newsletter:subscribe", { payload, metas }, (draft) => {
      draft.subscribers.push({
        email: payload.email,
        subscribedAt: Date.now()
      });
    });
    this.emit("subscribed", { email: payload.email }, { metas });
  }
}
```

### Étape 2 — View avec localState

```typescript
import {
  View, ui,
  type TViewContract, type TViewCallbacks,
  type TUIContract, type TUIElements,
  type TLocalUpdate
} from "@bonsai/view";
import type { TFeatureContract } from "@bonsai/feature";
import type { TJsonSerializable } from "@bonsai/entity";
import { NewsletterFeature } from "./newsletter.feature";

// ─── Module 1 — TFeatureContract ─────────────────────────────────────────

const newsletterViewFeatures = {
  newsletter: {
    feature:  NewsletterFeature,
    listens:  ["subscribed"] as const,
    triggers: ["subscribe"]  as const,
    requests: []             as const
  }
} satisfies TFeatureContract;

// ─── Module 2 — TUIContract ───────────────────────────────────────────────

const newsletterViewUiEvents = {
  emailInput:  ui<HTMLInputElement>()(["input"]),
  submitBtn:   ui<HTMLButtonElement>()(["click"]),
  errorMsg:    ui<HTMLSpanElement>()([]),
  successMsg:  ui<HTMLDivElement>()([])
} satisfies TUIContract;

// ─── Module 3 — TUIElements ───────────────────────────────────────────────

const newsletterViewUiElements = {
  emailInput:  "[data-ui='emailInput']",
  submitBtn:   "[data-ui='submitBtn']",
  errorMsg:    "[data-ui='errorMsg']",
  successMsg:  "[data-ui='successMsg']"
} satisfies TUIElements<typeof newsletterViewUiEvents>;

type TNewsletterViewContract = TViewContract<
  typeof newsletterViewFeatures,
  typeof newsletterViewUiEvents
>;

// ─── localState (ADR-0015) ────────────────────────────────────────────────

type TNewsletterLocal = TJsonSerializable & {
  email: string;
  error: string | null;
  isSubmitted: boolean;
};

class NewsletterView
  extends View<TNewsletterViewContract, TNewsletterLocal>
  implements TViewCallbacks<TNewsletterViewContract>
{
  get features()   { return newsletterViewFeatures;   }
  get uiEvents()   { return newsletterViewUiEvents;   }
  get uiElements() { return newsletterViewUiElements; }

  protected get localState(): TNewsletterLocal {
    return { email: "", error: null, isSubmitted: false };
  }

  // ── D48 UI — handlers imposés par uiEvents ────────────────────────────

  onEmailInputInput(e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    this.updateLocal((draft) => {
      draft.email = value;
      draft.error =
        value.length > 0 && !value.includes("@") ? "Email invalide" : null;
    });
  }

  onSubmitBtnClick(): void {
    const email = this.local.email;
    if (!email.includes("@")) {
      this.updateLocal((draft) => {
        draft.error = "Email invalide";
      });
      return;
    }
    // ✅ Seule la soumission franchit la frontière — clé flat namespacée (I80)
    this.trigger("newsletter:subscribe", { email });
  }

  // ── N1 callbacks — feedback synchrone ─────────────────────────────────

  onLocalErrorUpdated(update: TLocalUpdate<string | null>): void {
    this.getUI("errorMsg").text(update.actual ?? "");
    this.getUI("emailInput").toggleClass("is-invalid", update.actual !== null);
  }

  onLocalIsSubmittedUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI("successMsg").visible(update.actual);
  }

  // ── D12 channel — handler imposé par newsletter.listens: ["subscribed"] ─

  onNewsletterSubscribedEvent(payload: { email: string }): void {
    this.updateLocal((draft) => {
      draft.isSubmitted = true;
    });
  }
}
```

### Points clés

- **Zéro round-trip** pour la saisie — `updateLocal()` est synchrone
- **N1 callbacks** (`onLocalErrorUpdated`, `onLocalIsSubmittedUpdated`) assurent le feedback immédiat
- **`getUI().text()`, `.toggleClass()`, `.visible()`** — pas de `.prop()`, pas de `querySelector`
- **Le Channel ne contient aucun message lié à la saisie** — overhead minimal
- **Enforcement compile-time** : `implements TFeatureCallbacks<…>` (Feature) et `implements TViewCallbacks<…>` (View) imposent tous les handlers ci-dessus — un handler manquant est `TS2515`/`TS2420`, pas une erreur runtime

---

## 3. Pattern B — Formulaire réutilisable (FormBehavior)

> **Quand** : le même formulaire (adresse, identité, paiement) apparaît sur plusieurs pages.
>
> ⚠ **Anticipé — Strate 2** : `Behavior` n'existe pas encore dans `packages/`
> (cf. [behavior.md](../rfc/4-couche-concrete/behavior.md), statut « RFC
> anticipée »). Le pattern modulaire ci-dessous suit la cible documentée
> (identique à View par I83 : `features`/`uiEvents`/`uiElements` + `implements
> TBehaviorCallbacks<TBC>`) mais **ne compile pas encore** contre une classe
> `Behavior` réelle. À revalider mot pour mot à la livraison.

### Étape 1 — Créer le Behavior

Le Behavior encapsule le module `uiEvents` du formulaire, le localState, la validation et les N1 callbacks. Il ne trigger jamais de Channel lui-même (I44) — il délègue via callback.

```typescript
import {
  Behavior, ui,
  type TBehaviorContract, type TBehaviorCallbacks,
  type TUIContract, type TUIElements,
  type TLocalUpdate
} from "@bonsai/behavior"; // anticipé — package pas encore livré
import type { TFeatureContract } from "@bonsai/feature";
import type { TJsonSerializable } from "@bonsai/entity";

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

// ─── Module 1 — aucune Feature consommée directement (délégation par callback) ─

const contactFormBehaviorFeatures = {} satisfies TFeatureContract;

// ─── Module 2 — TUIContract ────────────────────────────────────────────────

const contactFormBehaviorUiEvents = {
  nameField:    ui<HTMLInputElement>()(["input", "blur"]),
  emailField:   ui<HTMLInputElement>()(["input", "blur"]),
  messageField: ui<HTMLTextAreaElement>()(["input", "blur"]),
  submitBtn:    ui<HTMLButtonElement>()(["click"]),
  nameError:    ui<HTMLSpanElement>()([]),
  emailError:   ui<HTMLSpanElement>()([]),
  messageError: ui<HTMLSpanElement>()([])
} satisfies TUIContract;

// ─── Module 3 — TUIElements ────────────────────────────────────────────────
// Les clés doivent être uniques face à celles de la View hôte (I43).

const contactFormBehaviorUiElements = {
  nameField:    "[data-ui='contactNameField']",
  emailField:   "[data-ui='contactEmailField']",
  messageField: "[data-ui='contactMessageField']",
  submitBtn:    "[data-ui='contactSubmitBtn']",
  nameError:    "[data-ui='contactNameError']",
  emailError:   "[data-ui='contactEmailError']",
  messageError: "[data-ui='contactMessageError']"
} satisfies TUIElements<typeof contactFormBehaviorUiEvents>;

type TContactFormBehaviorContract = TBehaviorContract<
  typeof contactFormBehaviorFeatures,
  typeof contactFormBehaviorUiEvents
>;

class ContactFormBehavior
  extends Behavior<TContactFormBehaviorContract, TFormLocal<TContactFields>>
  implements TBehaviorCallbacks<TContactFormBehaviorContract>
{
  private readonly validators: Record<
    keyof TContactFields,
    (v: string) => string | null
  >;
  private readonly onValidSubmit: (values: TContactFields) => void;

  constructor(config: {
    validators: Record<keyof TContactFields, (v: string) => string | null>;
    onValidSubmit: (values: TContactFields) => void;
  }) {
    super();
    this.validators = config.validators;
    this.onValidSubmit = config.onValidSubmit;
  }

  get features()   { return contactFormBehaviorFeatures;   }
  get uiEvents()   { return contactFormBehaviorUiEvents;   }
  get uiElements() { return contactFormBehaviorUiElements; }

  protected get localState(): TFormLocal<TContactFields> {
    return {
      values: { name: "", email: "", message: "" },
      touched: { name: false, email: false, message: false },
      errors: { name: null, email: null, message: null },
      isSubmitting: false
    };
  }

  // ── D48 UI — handlers imposés par uiEvents ────────────────────────────

  onNameFieldInput(e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    this.updateLocal((draft) => {
      draft.values.name = value;
      draft.errors.name = this.validators.name(value);
    });
  }

  onNameFieldBlur(): void {
    this.updateLocal((draft) => {
      draft.touched.name = true;
    });
  }

  onEmailFieldInput(e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    this.updateLocal((draft) => {
      draft.values.email = value;
      draft.errors.email = this.validators.email(value);
    });
  }

  onEmailFieldBlur(): void {
    this.updateLocal((draft) => {
      draft.touched.email = true;
    });
  }

  onMessageFieldInput(e: Event): void {
    const value = (e.currentTarget as HTMLTextAreaElement).value;
    this.updateLocal((draft) => {
      draft.values.message = value;
      draft.errors.message = this.validators.message(value);
    });
  }

  onMessageFieldBlur(): void {
    this.updateLocal((draft) => {
      draft.touched.message = true;
    });
  }

  onSubmitBtnClick(): void {
    const values = this.local.values;
    const errors = {
      name: this.validators.name(values.name),
      email: this.validators.email(values.email),
      message: this.validators.message(values.message)
    };
    const hasErrors = Object.values(errors).some((e) => e !== null);

    this.updateLocal((draft) => {
      draft.errors = errors;
      draft.touched = { name: true, email: true, message: true };
    });

    if (!hasErrors) {
      this.updateLocal((draft) => {
        draft.isSubmitting = true;
      });
      this.onValidSubmit({ ...values });
    }
  }

  // N1 callbacks

  onLocalErrorsUpdated(
    update: TLocalUpdate<Record<keyof TContactFields, string | null>>
  ): void {
    const errors = update.actual;
    const touched = this.local.touched;

    this.getUI("nameError").text(
      touched.name && errors.name ? errors.name : ""
    );
    this.getUI("emailError").text(
      touched.email && errors.email ? errors.email : ""
    );
    this.getUI("messageError").text(
      touched.message && errors.message ? errors.message : ""
    );

    this.getUI("nameField").toggleClass(
      "is-invalid",
      touched.name && errors.name !== null
    );
    this.getUI("emailField").toggleClass(
      "is-invalid",
      touched.email && errors.email !== null
    );
    this.getUI("messageField").toggleClass(
      "is-invalid",
      touched.message && errors.message !== null
    );
  }

  onLocalIsSubmittingUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI("submitBtn").attr("disabled", String(update.actual));
    this.getUI("submitBtn").text(update.actual ? "Envoi…" : "Envoyer");
  }
}
```

### Étape 2 — Brancher dans la View hôte

```typescript
import { View, type TViewContract, type TViewCallbacks, type TUIContract, type TUIElements } from "@bonsai/view";
import type { TFeatureContract } from "@bonsai/feature";
import { ContactFeature } from "./contact.feature";
import { ContactFormBehavior } from "./ContactFormBehavior.behavior";

const contactPageViewFeatures = {
  contact: {
    feature:  ContactFeature,
    listens:  []                as const,
    triggers: ["submitContact"] as const,
    requests: []                as const
  }
} satisfies TFeatureContract;

const contactPageViewUiEvents = {
  pageTitle:  ui<HTMLHeadingElement>()([]),
  successMsg: ui<HTMLDivElement>()([])
} satisfies TUIContract;

const contactPageViewUiElements = {
  pageTitle:  "[data-ui='pageTitle']",
  successMsg: "[data-ui='successMsg']"
} satisfies TUIElements<typeof contactPageViewUiEvents>;

type TContactPageViewContract = TViewContract<
  typeof contactPageViewFeatures,
  typeof contactPageViewUiEvents
>;

class ContactPageView
  extends View<TContactPageViewContract>
  implements TViewCallbacks<TContactPageViewContract>
{
  get features()   { return contactPageViewFeatures;   }
  get uiEvents()   { return contactPageViewUiEvents;   }
  get uiElements() { return contactPageViewUiElements; }

  get behaviors() {
    return [
      new ContactFormBehavior({
        validators: {
          name: (v) => (v.length < 2 ? "Nom trop court" : null),
          email: (v) => (!v.includes("@") ? "Email invalide" : null),
          message: (v) => (v.length < 10 ? "Message trop court" : null)
        },
        onValidSubmit: (values) => {
          // La View fait le trigger — seule elle a accès au Channel
          this.trigger("contact:submitContact", values);
        }
      })
    ];
  }
}
```

### Points clés

- Le **Behavior ne trigger jamais de Channel** (I44) — il délègue via callback
- Les **clés `uiElements` du Behavior** (`nameField`, `emailField`, etc.) ne doivent pas collisionner avec celles de la View hôte (I43)
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
│    "checkout:           │     │    "checkout:           │
│     completeShipping")  │     │     completePayment")   │
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
// Contrat Channel Checkout (ADR-0040) — Entity stocke les étapes validées

type TCheckoutState = {
  currentStep: number;
  steps: {
    shipping: { address: string; city: string; zip: string } | null;
    payment: { method: "card" | "paypal"; cardLast4: string | null } | null;
    confirmation: { accepted: boolean } | null;
  };
  isComplete: boolean;
};

type TCheckoutDef = {
  readonly commands: {
    completeShipping: { address: string; city: string; zip: string };
    completePayment: { method: "card" | "paypal"; cardLast4: string | null };
    confirmOrder: void;
    goToStep: { step: number };
  };
  readonly events: {
    stepCompleted: { step: number };
    orderConfirmed: void;
  };
  readonly requests: {
    checkoutState: { params: void; result: TCheckoutState };
  };
};
```

```typescript
// ShippingStepView — localState pour la saisie, Command pour valider l'étape

import { View, ui, type TViewContract, type TViewCallbacks, type TUIContract, type TUIElements, type TLocalUpdate } from "@bonsai/view";
import type { TFeatureContract } from "@bonsai/feature";
import type { TJsonSerializable } from "@bonsai/entity";
import { CheckoutFeature } from "./checkout.feature";

const shippingStepViewFeatures = {
  checkout: {
    feature:  CheckoutFeature,
    listens:  []                    as const,
    triggers: ["completeShipping"]  as const,
    requests: []                    as const
  }
} satisfies TFeatureContract;

const shippingStepViewUiEvents = {
  addressField: ui<HTMLInputElement>()(["input"]),
  cityField:    ui<HTMLInputElement>()(["input"]),
  zipField:     ui<HTMLInputElement>()(["input"]),
  nextBtn:      ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;

const shippingStepViewUiElements = {
  addressField: "[data-ui='addressField']",
  cityField:    "[data-ui='cityField']",
  zipField:     "[data-ui='zipField']",
  nextBtn:      "[data-ui='nextBtn']"
} satisfies TUIElements<typeof shippingStepViewUiEvents>;

type TShippingStepViewContract = TViewContract<
  typeof shippingStepViewFeatures,
  typeof shippingStepViewUiEvents
>;

type TShippingLocal = TJsonSerializable & {
  values: { address: string; city: string; zip: string };
  errors: Record<"address" | "city" | "zip", string | null>;
  touched: Record<"address" | "city" | "zip", boolean>;
};

class ShippingStepView
  extends View<TShippingStepViewContract, TShippingLocal>
  implements TViewCallbacks<TShippingStepViewContract>
{
  get features()   { return shippingStepViewFeatures;   }
  get uiEvents()   { return shippingStepViewUiEvents;   }
  get uiElements() { return shippingStepViewUiElements; }

  protected get localState(): TShippingLocal {
    return {
      values: { address: "", city: "", zip: "" },
      errors: { address: null, city: null, zip: null },
      touched: { address: false, city: false, zip: false }
    };
  }

  // ... D48 handlers (onAddressFieldInput, ...), N1 callbacks (identiques au Pattern A) ...
  onAddressFieldInput(e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    this.updateLocal((draft) => { draft.values.address = value; });
  }
  onCityFieldInput(e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    this.updateLocal((draft) => { draft.values.city = value; });
  }
  onZipFieldInput(e: Event): void {
    const value = (e.currentTarget as HTMLInputElement).value;
    this.updateLocal((draft) => { draft.values.zip = value; });
  }

  onNextBtnClick(): void {
    const { values } = this.local;
    const errors = {
      address: values.address.length === 0 ? "Adresse requise" : null,
      city: values.city.length === 0 ? "Ville requise" : null,
      zip: values.zip.length === 0 ? "Code postal requis" : null
    };
    const hasErrors = Object.values(errors).some((e) => e !== null);

    if (!hasErrors) {
      // ✅ L'étape validée franchit la frontière → Command → Entity
      this.trigger("checkout:completeShipping", { ...values });
    } else {
      this.updateLocal((draft) => {
        draft.errors = errors;
        draft.touched = { address: true, city: true, zip: true };
      });
    }
  }
}
```

### Points clés

- L'**Entity stocke les étapes validées** — observable dans les DevTools, retour en arrière possible
- Chaque **View d'étape** est autonome avec son propre localState — détruit au detach (I42.5)
- Le **Composer** gère l'affichage conditionnel des étapes (résolution dynamique)

---

## 5. Pattern D — Validation différée (Request Channel)

> **Quand** : vérifier l'unicité d'un username contre l'état d'une Entity, valider un code postal contre une liste connue, etc.
>
> ⚠ **`this.request()` est synchrone** (ADR-0023, I29) — il retourne
> `T | null`, jamais une `Promise`. Il ne fait donc **pas** d'appel réseau ;
> il interroge une Feature déjà chargée en mémoire (state Entity, table de
> référence). Pour une vérification qui appelle réellement une API externe,
> le round-trip async doit être géré par la Feature elle-même (hors Request
> Channel) — non couvert par ce guide.

Combinable avec n'importe quel pattern (A, B ou C). Seul le **debounce** est
asynchrone ; l'appel `this.request()` qu'il déclenche est synchrone.

```typescript
// Dans la View (ou le Behavior)
private usernameCheckTimer: ReturnType<typeof setTimeout> | null = null;

onUsernameInputInput(e: Event): void {
  const value = (e.currentTarget as HTMLInputElement).value;
  this.updateLocal(draft => {
    draft.values.username = value;
    draft.errors.username = value.length < 3 ? 'Min. 3 caractères' : null;
  });

  // Debounce 300ms — seul ce délai est asynchrone, pas l'appel this.request()
  if (this.usernameCheckTimer) clearTimeout(this.usernameCheckTimer);
  if (value.length >= 3) {
    this.usernameCheckTimer = setTimeout(() => {
      this.checkUsernameAvailability(value);
    }, 300);
  }
}

private checkUsernameAvailability(username: string): void {
  // ✅ Request Channel — clé flat "ns:req" nominale (I80, convention communication.md), synchrone (ADR-0023, I29)
  const isAvailable = this.request('registration:usernameAvailable', { username });

  this.updateLocal(draft => {
    if (isAvailable === false && draft.values.username === username) {
      draft.errors.username = 'Ce nom est déjà pris';
    }
  });
}
```

### Points clés

- **Debounce côté View** — la Feature ne reçoit pas une requête par frappe
- **`this.request("ns:req", params)`** retourne `T | null` **synchrone** — typé depuis `TFlatRequests<F>` (le contrat `features`), jamais une `Promise` (ADR-0023, I29)
- **Guard `draft.values.username === username`** — évite d'écraser si l'utilisateur a continué à taper pendant le debounce
- Pas de spinner « en attente réseau » possible ici — la latence perçue est uniquement celle du debounce, pas d'une requête HTTP

---

## 6. Anti-patterns

| ❌ Interdit                                          | ✅ Correct                                                                | Raison             |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| `this.entity.state.values[field] = value`            | `this.entity.mutate('ns:update', { payload, metas }, draft => { ... })`  | ADR-0001           |
| `get uiEvents() { return { 'input @ui.x': 'onX' } }` | Module `uiEvents: TUIContract` + auto-discovery `on{Key}{Event}` (I48/I88) | ADR-0042           |
| `this.trigger('ns:cmd', payload)` sans `features` déclarant `ns` | `this.trigger("ns:cmd", payload)` avec `ns` référencé dans `get features()` | I87, I80           |
| `this.getUI('btn').prop('disabled', true)`           | `this.getUI('btn').attr('disabled', 'true')`                              | I41                |
| `document.querySelector('.x')`                       | `this.getUI('x')`                                                         | I39                |
| `onSubmitCommand(payload) { }`                       | `onSubmitCommand(payload: void, metas: TMessageMetas): void { }`          | ADR-0016           |
| État `touched`/`errors` dans l'Entity                | `localState` dans la View/Behavior                                        | I30, I42, ADR-0009 |
| `static readonly namespace = …`                      | `static readonly channel: TChannelToken<TDef, NS>` (ADR-0040)             | I68                |

---

## 7. Checklist formulaire

Avant de merger un formulaire dans Bonsai, vérifier :

- [ ] **Pattern choisi** selon l'arbre de décision (§1)
- [ ] **`uiEvents` complet** — tous les inputs, boutons, zones d'erreur déclarés via `ui<TEl>()(events)`, avec `uiElements` en 1:1 (T3, T4)
- [ ] **`implements TFeatureCallbacks<…>` / `TViewCallbacks<…>` / `TBehaviorCallbacks<…>`** — pas de handler manquant (erreur compile, pas runtime)
- [ ] **localState typé** — `TJsonSerializable`, `get localState()` retourne l'état initial
- [ ] **N1 callbacks** — `onLocal{Key}Updated` pour le feedback synchrone (erreurs, disabled, texte)
- [ ] **Soumission via `trigger("ns:cmd", payload)`** — clé flat namespacée (I80), jamais de token Channel exposé
- [ ] **Feature handler avec metas** — `(payload, metas: TMessageMetas)`
- [ ] **Entity mutation via `mutate("ns:intent", { payload, metas }, recipe)`** — Immer draft, intent nommé
- [ ] **Pas de `.prop()`** — utiliser `.attr()`, `.text()`, `.toggleClass()`, `.visible()`
- [ ] **Pas de `querySelector` brut** — tout via `getUI(key)`
- [ ] **Validation async debounced** si nécessaire (§5)
- [ ] **Clés `uiElements` du Behavior** ne collisionnent pas avec la View hôte (I43)

---

## Références

- [ADR-0009 — Forms Pattern](../adr/ADR-0009-forms-pattern.md) — décision architecturale complète
- [feature.md](../rfc/3-couche-abstraite/feature.md) — pattern modulaire Feature courant (ADR-0046)
- [view.md §2](../rfc/4-couche-concrete/view.md#2-pattern-modulaire-adr-0042) — pattern modulaire View courant (ADR-0042)
- [behavior.md §4.3](../rfc/4-couche-concrete/behavior.md#43-contactformbehavior----formulaire-reutilisable-adr-0009) — cible Behavior anticipée (Strate 2)
- [ADR-0001](../adr/ADR-0001-entity-diff-notification-strategy.md) — Entity mutation unique `mutate()`
- [ADR-0015](../adr/ADR-0015-local-state-mechanism.md) — Mécanisme localState View & Behavior
- [ADR-0007](../adr/ADR-0007-behavior-contract.md) — Contrat Behavior historique (⚪ Superseded → pattern modulaire ADR-0042)
- [ADR-0016](../adr/ADR-0016-metas-handler-signature.md) — Signature metas explicite
