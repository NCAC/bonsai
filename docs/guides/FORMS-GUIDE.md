# Guide Pratique — Formulaires dans Bonsai

> **Comment gérer la saisie, la validation et la soumission de formulaires
> dans l'architecture Bonsai : 3 patterns + 1 complément combinable, 1 arbre de décision.**

> 🟠 **Guide cible, écrit avec l'API livrée (4 novembre 2026).** Les exemples
> utilisent les contextes de handler réels (`ctx.mutate`, `ctx.emit`,
> `ctx.trigger`, `ctx.query`, `on{Nom}Query`) et le pattern modulaire
> (ADR-08, ADR-09, ADR-14). Ils **ne s'exécutent pas encore**, pour trois raisons :
>
> 1. **`localState`** (`get localState()`, `updateLocal()`, `this.local`,
>    `onLocal{Key}Updated`, `View<TVC, TLocal>`) n'existe pas : strate 2,
>    [ADR-17](../adr/ADR-17-local-state.md). Les patterns B, C et D en dépendent.
> 2. **Behavior** n'existe pas (`@bonsai/behavior`) : strate 2,
>    [ADR-21](../adr/ADR-21-behavior-reutilisation.md). Le pattern C en dépend.
> 3. **La valeur saisie** : un fait du DOM ne transporte aujourd'hui que
>    `{ type, ui }`, et une View ne lit jamais le DOM (I39). La théorie prévoit
>    que les données d'un fait soient capturées avec lui (C.5) ; ni cette
>    capture ni sa forme ne sont fixées. Les exemples écrivent **`fact.value`**
>    pour cette cible : c'est une notation de ce guide, pas une API.
>
> Ce qui fonctionne déjà : déclarer `ui<HTMLInputElement>()(["input", "blur"])`
> ou `ui<HTMLFormElement>()(["submit"])` (ADR-15), annuler l'action par défaut
> d'un `submit` par déclaration (`ui()(events, { cancelDefault })`, D20),
> commander depuis le handler du fait, projeter le retour du domaine.
> En cas d'écart, la [théorie](../theorie.md) prévaut ([règle de confiance](../README.md#règle-de-confiance-et-dalignement)).

---

| Champ | Valeur |
| ----- | ------- |
| **ADR source** | [ADR-25 — Formulaires](../adr/ADR-25-formulaires.md) |
| **Pré-requis** | [ADR-10](../adr/ADR-10-entity-mutation.md) (mutate), [ADR-17](../adr/ADR-17-local-state.md) (localState, cible), [behavior.md](../spec/4-couche-concrete/behavior.md) (Behavior, cible), [ADR-04](../adr/ADR-04-metas-explicites.md) (contexte causal, `ctx.cause`) |
| **Créé le** | 2026-04-01 |
| **Mis à jour** | 2026-11-04 (API du noyau) |

Chaque scénario porte la lettre du pattern d'ADR-25 dont il découle : **B** =
localState (cas simple), **C** = FormBehavior, **D** = Entity + localState par
étape. Il n'y a pas de pattern A : le formulaire entièrement piloté par une
Entity est rejeté par ADR-25. La **validation différée** (§5) est un complément
combinable avec B, C ou D, sans lettre.

---

## TL;DR

| Situation | Pattern (ADR-25) | Où vit l'état de saisie |
| --- | --- | --- |
| Formulaire simple (contact, login, newsletter) | **B** — localState dans la View | View (`updateLocal`) |
| Formulaire réutilisable (adresse sur 3 pages) | **C** — FormBehavior | Behavior (`updateLocal`) |
| Wizard multi-step (checkout) | **D** — Entity + localState par étape | View (saisie) + Entity (étapes validées) |
| Validation contre le domaine (unicité, référence connue) | _(complément)_ Query synchrone dans le handler de saisie | Feature (état en mémoire) |

> **Règle fondamentale** : l'état de saisie (valeurs, touched, errors, isSubmitting) est
> de l'**état de présentation transitoire** (I30, I42). Seule la **soumission finale**
> produit une Command qui franchit la frontière View → Feature, depuis le handler
> d'un fait du DOM (D18).

---

## Table des matières

1. [Arbre de décision](#1-arbre-de-décision)
2. [Pattern B — Formulaire simple (localState)](#2-pattern-b--formulaire-simple-localstate)
3. [Pattern C — Formulaire réutilisable (FormBehavior)](#3-pattern-c--formulaire-réutilisable-formbehavior)
4. [Pattern D — Wizard multi-step (Entity + localState)](#4-pattern-d--wizard-multi-step-entity--localstate)
5. [Validation contre le domaine — complément combinable](#5-validation-contre-le-domaine--complément-combinable)
6. [Anti-patterns](#6-anti-patterns)
7. [Checklist formulaire](#7-checklist-formulaire)

---

## 1. Arbre de décision

```text
Le formulaire est-il réutilisé sur plusieurs pages ?
├── OUI → Pattern C (FormBehavior)
└── NON
    └── L'état de saisie a-t-il une valeur métier persistante ?
        ├── OUI → Pattern D (Entity + localState par étape)
        │         Exemples : wizard checkout, éditeur de document
        └── NON
            └── Faut-il valider contre l'état du domaine (unicité, référence) ?
                ├── OUI → Pattern B + Query synchrone (§5)
                └── NON → Pattern B (localState simple)
```

---

## 2. Pattern B — Formulaire simple (localState)

> **Quand** : formulaire de contact, login, newsletter, feedback — affiché une seule fois, pas de réutilisation.

### Étape 1 — Contrat Channel et Feature

Le Channel est **minimal** : seule la soumission est une Command. Aucun message pour la saisie en cours. Cette partie s'exécute déjà.

```typescript
import { Entity, Feature, type TChannelToken, type TFeatureCallbacks, type TFeatureContext } from "@bonsai/core";

// ─── Contrat Channel (ADR-14) ──────────────────────────────────────────────

type TNewsletterDef = {
  readonly commands: { subscribe: { email: string } };
  readonly events: { subscribed: { email: string } };
  readonly queries: {};
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

const newsletterListens = [] as const;

class NewsletterFeature
  extends Feature<NewsletterEntity, TNewsletterDef, "newsletter">
  implements TFeatureCallbacks<TNewsletterDef, typeof newsletterListens, NewsletterEntity>
{
  static readonly channel: TChannelToken<TNewsletterDef, "newsletter"> = {
    namespace: "newsletter",
    events: ["subscribed"]
  };

  get listens() { return newsletterListens; }
  get queries() { return [] as const; }

  protected get Entity() { return NewsletterEntity; }

  onSubscribeCommand(payload: { email: string }, ctx: TFeatureContext<TNewsletterDef, NewsletterEntity>): void {
    // Validation métier définitive : une Command dont le handler lève est refusée (I27, G7)
    if (!payload.email.includes("@")) throw new Error("invalid email");
    ctx.mutate("newsletter:subscribe", { payload }, (draft) => {
      draft.subscribers.push({ email: payload.email, subscribedAt: Date.now() });
    });
    ctx.emit("subscribed", { email: payload.email });
  }
}
```

> `Date.now()` dans une recette lit l'hôte : la valeur n'est pas rejouable.
> Une heure lue est une valeur transmise (théorie 3.2) : la passer dans le
> payload quand elle compte.

### Étape 2 — View avec localState (⏳ cible)

```typescript
import {
  View, ui,
  type TViewContract, type TViewCallbacks,
  type TUIContract, type TUIElements,
  type TFact, type TFactContext, type TEventContext,
  type TFeatureContract
} from "@bonsai/core";
import type { TLocalUpdate } from "@bonsai/view"; // ⏳ cible ADR-17
import { NewsletterFeature } from "./newsletter.feature";

// ─── Module 1 — TFeatureContract ─────────────────────────────────────────

const newsletterViewFeatures = {
  newsletter: {
    feature:  NewsletterFeature,
    listens:  ["subscribed"] as const,
    triggers: ["subscribe"]  as const,
    queries:  []             as const
  }
} satisfies TFeatureContract;

// ─── Module 2 — TUIContract ───────────────────────────────────────────────

const newsletterViewUiEvents = {
  emailInput:  ui<HTMLInputElement>()(["input"]),
  form:        ui<HTMLFormElement>()(["submit"], { cancelDefault: ["submit"] }), // D20
  errorMsg:    ui<HTMLSpanElement>()([]),
  successMsg:  ui<HTMLDivElement>()([])
} satisfies TUIContract;

// ─── Module 3 — TUIElements ───────────────────────────────────────────────

const newsletterViewUiElements = {
  emailInput:  "[data-ui='emailInput']",
  form:        "[data-ui='form']",
  errorMsg:    "[data-ui='errorMsg']",
  successMsg:  "[data-ui='successMsg']"
} satisfies TUIElements<typeof newsletterViewUiEvents>;

type TNewsletterViewContract = TViewContract<
  typeof newsletterViewFeatures,
  typeof newsletterViewUiEvents
>;

// ─── localState (⏳ ADR-17) ────────────────────────────────────────────────

type TNewsletterLocal = {
  email: string;
  error: string | null;
  isSubmitted: boolean;
};

class NewsletterView
  extends View<TNewsletterViewContract, TNewsletterLocal> // ⏳ second générique : cible
  implements TViewCallbacks<TNewsletterViewContract>
{
  get features()   { return newsletterViewFeatures;   }
  get uiEvents()   { return newsletterViewUiEvents;   }
  get uiElements() { return newsletterViewUiElements; }

  protected get localState(): TNewsletterLocal {
    return { email: "", error: null, isSubmitted: false };
  }

  // ── I48 UI — handlers imposés par uiEvents ────────────────────────────

  onEmailInputInput(fact: TFact, _ctx: TFactContext<TNewsletterViewContract>): void {
    const value = fact.value; // ⏳ valeur capturée avec le fait (C.5) : notation de ce guide
    this.updateLocal((draft) => {
      draft.email = value;
      draft.error = value.length > 0 && !value.includes("@") ? "Email invalide" : null;
    });
  }

  onFormSubmit(_fact: TFact, ctx: TFactContext<TNewsletterViewContract>): void {
    const email = this.local.email;
    if (!email.includes("@")) {
      this.updateLocal((draft) => { draft.error = "Email invalide"; });
      return;
    }
    // ✅ Seule la soumission franchit la frontière, depuis le handler d'un fait (D18)
    ctx.trigger("newsletter:subscribe", { email });
  }

  // ── Projections de l'état local (⏳ ADR-17) ─────────────────────────────

  onLocalErrorUpdated(update: TLocalUpdate<string | null>): void {
    this.getUI("errorMsg").text(update.actual ?? "");
    this.getUI("emailInput").attr("data-state", update.actual === null ? "valid" : "invalid");
  }

  onLocalIsSubmittedUpdated(update: TLocalUpdate<boolean>): void {
    this.getUI("successMsg").visible(update.actual);
  }

  // ── Event écouté — imposé par newsletter.listens: ["subscribed"] ────────
  // Un handler d'Event projette et interroge ; il ne commande pas (D18).

  onNewsletterSubscribedEvent(_payload: { email: string }, _ctx: TEventContext<TNewsletterViewContract>): void {
    this.updateLocal((draft) => { draft.isSubmitted = true; });
  }
}
```

### Points clés

- **Zéro round-trip** pour la saisie : `updateLocal()` reste dans l'unité du fait
- **L'état d'erreur est un `data-*`**, pas une classe (`is-invalid` est interdit, conventions DOM)
- **`getUI().text()`, `.attr()`, `.visible()`** : pas de `.prop()`, pas de `querySelector` (I39)
- **Le Channel ne contient aucun message lié à la saisie**
- **L'action par défaut du `submit`** est annulée par déclaration (D20), jamais par le handler
- **Compile-time** : `implements TFeatureCallbacks<…>` et `implements TViewCallbacks<…>` imposent tous les handlers ci-dessus

---

## 3. Pattern C — Formulaire réutilisable (FormBehavior)

> **Quand** : le même formulaire (adresse, identité, paiement) apparaît sur plusieurs pages.
>
> ⏳ **Strate 2** : `Behavior` n'existe pas encore (cf. [behavior.md](../spec/4-couche-concrete/behavior.md)).
> Un Behavior n'est pas un composant : il n'a ni existence, ni Channel, ni part propres,
> et ses traitements sont inclus dans l'unité de la View qui le porte. La forme
> ci-dessous suit la cible documentée (identique à View par I83) ; elle sera
> revalidée à la livraison.

### Étape 1 — Créer le Behavior

Le Behavior encapsule le module `uiEvents` du formulaire, l'état local, la validation et ses projections. Ce guide délègue la soumission à la View hôte par un callback qui reçoit le contexte du fait : la Command part toujours du handler d'un fait (D18).

> 🧭 **Choix de ce guide, non imposé** : I44 interdit au Behavior l'accès à sa View
> (`this.view`), pas la déclaration d'un `TFeatureContract` propre. Un Behavior
> qui `trigger()` lui-même reste une alternative à trancher avec ADR-21.

```typescript
import { Behavior, ui, type TBehaviorContract, type TBehaviorCallbacks } from "@bonsai/behavior"; // ⏳ cible
import type { TUIContract, TUIElements, TFact, TFactContext, TFeatureContract } from "@bonsai/core";
import type { TLocalUpdate } from "@bonsai/view"; // ⏳ cible

type TContactFields = { name: string; email: string; message: string };

type TFormLocal<TFields extends Record<string, string>> = {
  values: TFields;
  touched: Record<keyof TFields, boolean>;
  errors: Record<keyof TFields, string | null>;
  isSubmitting: boolean;
};

const contactFormBehaviorFeatures = {} satisfies TFeatureContract;

const contactFormBehaviorUiEvents = {
  nameField:    ui<HTMLInputElement>()(["input", "blur"]),
  emailField:   ui<HTMLInputElement>()(["input", "blur"]),
  messageField: ui<HTMLTextAreaElement>()(["input", "blur"]),
  form:         ui<HTMLFormElement>()(["submit"], { cancelDefault: ["submit"] }),
  nameError:    ui<HTMLSpanElement>()([]),
  emailError:   ui<HTMLSpanElement>()([]),
  messageError: ui<HTMLSpanElement>()([])
} satisfies TUIContract;

// Les clés doivent être uniques face à celles de la View hôte (I43).
const contactFormBehaviorUiElements = {
  nameField:    "[data-ui='contactNameField']",
  emailField:   "[data-ui='contactEmailField']",
  messageField: "[data-ui='contactMessageField']",
  form:         "[data-ui='contactForm']",
  nameError:    "[data-ui='contactNameError']",
  emailError:   "[data-ui='contactEmailError']",
  messageError: "[data-ui='contactMessageError']"
} satisfies TUIElements<typeof contactFormBehaviorUiEvents>;

type TContactFormBehaviorContract = TBehaviorContract<
  typeof contactFormBehaviorFeatures,
  typeof contactFormBehaviorUiEvents
>;

type TContactFormConfig = {
  validators: Record<keyof TContactFields, (v: string) => string | null>;
  onValidSubmit: (values: TContactFields, ctx: TFactContext) => void;
};

class ContactFormBehavior
  extends Behavior<TContactFormBehaviorContract, TFormLocal<TContactFields>>
  implements TBehaviorCallbacks<TContactFormBehaviorContract>
{
  readonly #config: TContactFormConfig;

  constructor(config: TContactFormConfig) {
    super();
    this.#config = config;
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

  #input(field: keyof TContactFields, fact: TFact): void {
    const value = fact.value; // ⏳ valeur capturée avec le fait (C.5)
    this.updateLocal((draft) => {
      draft.values[field] = value;
      draft.errors[field] = this.#config.validators[field](value);
    });
  }

  #blur(field: keyof TContactFields): void {
    this.updateLocal((draft) => { draft.touched[field] = true; });
  }

  onNameFieldInput(fact: TFact): void    { this.#input("name", fact); }
  onNameFieldBlur(): void                { this.#blur("name"); }
  onEmailFieldInput(fact: TFact): void   { this.#input("email", fact); }
  onEmailFieldBlur(): void               { this.#blur("email"); }
  onMessageFieldInput(fact: TFact): void { this.#input("message", fact); }
  onMessageFieldBlur(): void             { this.#blur("message"); }

  onFormSubmit(_fact: TFact, ctx: TFactContext): void {
    const values = this.local.values;
    const { validators } = this.#config;
    const errors = {
      name: validators.name(values.name),
      email: validators.email(values.email),
      message: validators.message(values.message)
    };
    const hasErrors = Object.values(errors).some((e) => e !== null);

    this.updateLocal((draft) => {
      draft.errors = errors;
      draft.touched = { name: true, email: true, message: true };
      draft.isSubmitting = !hasErrors;
    });

    if (!hasErrors) this.#config.onValidSubmit({ ...values }, ctx);
  }

  onLocalErrorsUpdated(update: TLocalUpdate<Record<keyof TContactFields, string | null>>): void {
    const errors = update.actual;
    const touched = this.local.touched;
    for (const field of ["name", "email", "message"] as const) {
      const shown = touched[field] && errors[field] !== null;
      this.getUI(`${field}Error`).text(shown ? errors[field]! : "");
      this.getUI(`${field}Field`).attr("data-state", shown ? "invalid" : "valid");
    }
  }
}
```

### Étape 2 — Brancher dans la View hôte

```typescript
import {
  View, ui,
  type TViewContract, type TViewCallbacks, type TUIContract, type TUIElements,
  type TFeatureContract
} from "@bonsai/core";
import { ContactFeature } from "./contact.feature";
import { ContactFormBehavior } from "./contact-form.behavior";

const contactPageViewFeatures = {
  contact: {
    feature:  ContactFeature,
    listens:  []                as const,
    triggers: ["submitContact"] as const,
    queries:  []                as const
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

  get behaviors() { // ⏳ cible ADR-21
    return [
      new ContactFormBehavior({
        validators: {
          name: (v) => (v.length < 2 ? "Nom trop court" : null),
          email: (v) => (!v.includes("@") ? "Email invalide" : null),
          message: (v) => (v.length < 10 ? "Message trop court" : null)
        },
        // Le contexte est celui du fait admis : la Command part de son unité (D18, A5.a)
        onValidSubmit: (values, ctx) => ctx.trigger("contact:submitContact", values)
      })
    ];
  }
}
```

### Points clés

- La soumission passe par un callback qui reçoit le **contexte du fait** : un contexte n'est utilisable que dans son unité (A5.a, `NO_UNIT` sinon)
- Les **clés `uiElements` du Behavior** ne doivent pas entrer en collision avec celles de la View hôte (I43)
- Le même `ContactFormBehavior` se branche sur plusieurs Views avec des validators différents

---

## 4. Pattern D — Wizard multi-step (Entity + localState)

> **Quand** : checkout, inscription multi-step, assistant de configuration — les étapes validées ont une valeur métier.

### Principe

Chaque **étape** utilise le localState pour la saisie en cours. La **validation de l'étape** produit une Command qui persiste dans l'Entity. L'Entity conserve la progression globale ; le Composer affiche l'étape courante en interrogeant la Feature dans `resolve(ctx)`.

```text
┌─────────────────────────┐     ┌─────────────────────────┐
│  ShippingStepView       │     │  PaymentStepView        │
│  localState: saisie     │     │  localState: saisie     │
│  ─────────────────────  │     │  ─────────────────────  │
│  ✅ → ctx.trigger(      │     │  ✅ → ctx.trigger(      │
│    "checkout:           │     │    "checkout:           │
│     completeShipping")  │     │     completePayment")   │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│  CheckoutFeature                                         │
│  Entity: { currentStep, steps: { shipping, payment } }  │
│  Event stepCompleted → CheckoutComposer.resolve(ctx)     │
└─────────────────────────────────────────────────────────┘
```

### Feature (s'exécute déjà)

```typescript
type TShipping = { address: string; city: string; zip: string };

type TCheckoutState = {
  currentStep: number;
  steps: {
    shipping: TShipping | null;
    payment: { method: "card" | "paypal"; cardLast4: string | null } | null;
  };
};

type TCheckoutDef = {
  readonly commands: {
    completeShipping: TShipping;
    completePayment: { method: "card" | "paypal"; cardLast4: string | null };
  };
  readonly events: { stepCompleted: { step: number } };
  readonly queries: { currentStep: { params: null; result: number } };
};

class CheckoutFeature
  extends Feature<CheckoutEntity, TCheckoutDef, "checkout">
  implements TFeatureCallbacks<TCheckoutDef, readonly [], CheckoutEntity>
{
  static readonly channel: TChannelToken<TCheckoutDef, "checkout"> = {
    namespace: "checkout",
    events: ["stepCompleted"]
  };
  get listens() { return [] as const; }
  get queries() { return [] as const; }
  protected get Entity() { return CheckoutEntity; }

  onCompleteShippingCommand(payload: TShipping, ctx: TFeatureContext<TCheckoutDef, CheckoutEntity>): void {
    ctx.mutate("checkout:completeShipping", { payload }, (draft) => {
      draft.steps.shipping = payload;
      draft.currentStep = 1;
    });
    ctx.emit("stepCompleted", { step: 0 });
  }

  onCompletePaymentCommand(payload: TCheckoutDef["commands"]["completePayment"], ctx: TFeatureContext<TCheckoutDef, CheckoutEntity>): void {
    ctx.mutate("checkout:completePayment", { payload }, (draft) => {
      draft.steps.payment = payload;
      draft.currentStep = 2;
    });
    ctx.emit("stepCompleted", { step: 1 });
  }

  onCurrentStepQuery(_params: null, _ctx: TFeatureQueryContext): number {
    return this.entity.state.currentStep;
  }
}
```

### View d'étape (⏳ cible : localState, valeur du fait)

```typescript
const shippingStepViewFeatures = {
  checkout: {
    feature:  CheckoutFeature,
    listens:  []                   as const,
    triggers: ["completeShipping"] as const,
    queries:  []                   as const
  }
} satisfies TFeatureContract;

const shippingStepViewUiEvents = {
  addressField: ui<HTMLInputElement>()(["input"]),
  cityField:    ui<HTMLInputElement>()(["input"]),
  zipField:     ui<HTMLInputElement>()(["input"]),
  nextBtn:      ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;

class ShippingStepView
  extends View<TShippingStepViewContract, { values: TShipping }> // ⏳ localState
  implements TViewCallbacks<TShippingStepViewContract>
{
  // features / uiEvents / uiElements comme au Pattern B
  protected get localState() {
    return { values: { address: "", city: "", zip: "" } };
  }

  onAddressFieldInput(fact: TFact): void {
    this.updateLocal((draft) => { draft.values.address = fact.value; }); // ⏳ C.5
  }
  onCityFieldInput(fact: TFact): void {
    this.updateLocal((draft) => { draft.values.city = fact.value; });
  }
  onZipFieldInput(fact: TFact): void {
    this.updateLocal((draft) => { draft.values.zip = fact.value; });
  }

  onNextBtnClick(_fact: TFact, ctx: TFactContext<TShippingStepViewContract>): void {
    const { values } = this.local;
    if (Object.values(values).every((v) => v.length > 0)) {
      // ✅ L'étape validée franchit la frontière → Command → Entity
      ctx.trigger("checkout:completeShipping", { ...values });
    }
  }
}
```

### Composer de l'étape courante (s'exécute déjà)

```typescript
const checkoutComposerFeatures = {
  checkout: { feature: CheckoutFeature, listens: ["stepCompleted"] as const, queries: ["currentStep"] as const }
};
const checkoutComposerViews = { shipping: ShippingStepView, payment: PaymentStepView, summary: SummaryView };

class CheckoutComposer extends Composer<TComposerContract<typeof checkoutComposerFeatures, typeof checkoutComposerViews>> {
  get features() { return checkoutComposerFeatures; }
  get views() { return checkoutComposerViews; }

  resolve(ctx: TComposeContext<TCheckoutComposerContract>): TComposition<TCheckoutComposerContract> {
    const step = ctx.query("checkout:currentStep", null);
    const view = (["shipping", "payment", "summary"] as const)[step]!;
    return [{ view, key: view }];
  }
}
```

### Points clés

- L'**Entity stocke les étapes validées** : retour en arrière possible, et un échec de l'unité défait l'étape entière (G7)
- Chaque **View d'étape** a son propre état local, qui disparaît avec elle quand sa clé quitte la composition (I42.5)
- Le **Composer** recalcule la composition à chaque `stepCompleted` : il garde la View dont la clé ne change pas, détruit les autres (I35)

---

## 5. Validation contre le domaine — complément combinable

> **Quand** : vérifier l'unicité d'un username contre l'état d'une Entity, valider un code postal contre une liste connue.

Une Query est **synchrone** (G5) et rend une valeur, jamais une `Promise` ni un
`null` de substitution. Elle lit un état déjà en mémoire : elle se fait
**directement dans le handler du fait de saisie**, sans debounce.

```typescript
onUsernameInputInput(fact: TFact, ctx: TFactContext<TRegistrationViewContract>): void {
  const username = fact.value; // ⏳ C.5
  const available = username.length >= 3 && ctx.query("registration:usernameAvailable", { username });
  this.updateLocal((draft) => { // ⏳ ADR-17
    draft.values.username = username;
    draft.errors.username =
      username.length < 3 ? "Min. 3 caractères" : available ? null : "Ce nom est déjà pris";
  });
}
```

> ❌ **Pas de `setTimeout` dans une View.** Un callback de minuterie s'exécute hors
> de toute unité : son `ctx.query` est refusé (`NO_UNIT`, A5.a). Une minuterie est
> une source de l'hôte : elle doit être admise par un adaptateur (D7), dont le
> résultat revient comme un message (⏳ non livré).
>
> Une vérification qui appelle réellement une API externe n'est pas une Query :
> c'est une opération de la Feature, dont le résultat revient comme un message
> corrélé (C.4). Non couverte par ce guide.

### Points clés

- **`ctx.query("ns:name", params)`** est typé depuis le contrat `features` (`TFlatQueries<F>`)
- **Une Query qui échoue fait échouer l'unité du fait** : ne pas l'entourer d'un `try/catch` (G7, `UNRECOVERABLE`)
- **Pas d'état « en attente réseau »** : la réponse est immédiate

---

## 6. Anti-patterns

| ❌ Interdit | ✅ Correct | Raison |
| --- | --- | --- |
| `this.entity.state.values[field] = value` | `ctx.mutate("ns:update", { payload }, (draft) => { … })` | ADR-10 |
| `this.entity.mutate(…)`, `this.emit(…)`, `this.trigger(…)` | `ctx.mutate`, `ctx.emit`, `ctx.trigger` (contexte du handler) | A3, A5.a |
| `ctx.trigger("ns:cmd", …)` dans un handler d'Event | La Command part du handler d'un fait du DOM | D18 |
| `ctx.trigger("ns:cmd", …)` sans `ns` dans `get features()` | `ns` référencé dans `get features()` avec `triggers: ["cmd"]` | I77, I87 |
| `(e.currentTarget as HTMLInputElement).value` | La valeur capturée avec le fait (⏳ C.5) | I39 |
| `event.preventDefault()` dans le handler | `ui()(["submit"], { cancelDefault: ["submit"] })` | D20 |
| `this.getUI("btn").prop("disabled", true)` | `this.getUI("btn").attr("disabled", "")` | I41 |
| `toggleClass("is-invalid", …)` | `attr("data-state", "invalid")` | conventions DOM |
| `document.querySelector(".x")` | `this.getUI("x")` | I39 |
| `setTimeout(() => ctx.query(…))` | Query synchrone dans le handler du fait | A5.a |
| `onSubmitCommand(payload, metas)` | `onSubmitCommand(payload, ctx)` ; contexte causal lu par `ctx.cause` | ADR-04 |
| État `touched`/`errors` dans l'Entity | `localState` dans la View/Behavior (⏳) | I30, I42, ADR-25 |
| `static readonly namespace = …` | `static readonly channel: TChannelToken<TDef, NS>` | I68 |

---

## 7. Checklist formulaire

- [ ] **Pattern choisi** selon l'arbre de décision (§1)
- [ ] **`uiEvents` complet** : champs, formulaire, zones d'erreur via `ui<TEl>()(events)`, `uiElements` en 1:1
- [ ] **`implements TFeatureCallbacks<…>` / `TViewCallbacks<…>`** : pas de handler manquant (erreur compile)
- [ ] **Soumission par `ctx.trigger("ns:cmd", payload)`** depuis le handler d'un fait (D18)
- [ ] **Action par défaut du `submit` annulée par déclaration** (`cancelDefault`, D20)
- [ ] **Feature** : `onXCommand(payload, ctx)`, mutation par `ctx.mutate("ns:intent", { payload }, recipe)`, validation métier qui lève si la Command doit être refusée
- [ ] **États dynamiques en `data-*`**, projections par `.attr()`, `.text()`, `.visible()`
- [ ] **Aucun accès brut au DOM**, aucune minuterie dans la View
- [ ] **Clés `uiElements` du Behavior** sans collision avec la View hôte (I43)
- [ ] ⏳ **localState typé** et projections `onLocal{Key}Updated` (ADR-17)

---

## Références

- [ADR-25 — Formulaires](../adr/ADR-25-formulaires.md) — décision architecturale
- [feature.md](../spec/3-couche-abstraite/feature.md) — Feature et contextes de handler
- [view.md](../spec/4-couche-concrete/view.md) — View, faits du DOM, projections
- [composer.md](../spec/4-couche-concrete/composer.md) — composition par clé
- [behavior.md](../spec/4-couche-concrete/behavior.md) — Behavior (cible strate 2)
- [ADR-15](../adr/ADR-15-evenements-ui.md) — événements DOM par type d'élément ; D20 pour l'action par défaut
- [ADR-17](../adr/ADR-17-local-state.md) — localState de View et Behavior (cible)
- [ADR-21](../adr/ADR-21-behavior-reutilisation.md) — Behavior et réutilisation (cible)
