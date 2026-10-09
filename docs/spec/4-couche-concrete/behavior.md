# Behavior — Plugin UI réutilisable et aveugle

> **Enrichissement DOM sans couplage à la View hôte : contrat modulaire, handlers auto-découverts, localState**

[← Retour couche concrète](README.md) | [← View](view.md) | [→ Foundation](foundation.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Behavior |
| **Couche** | Concrète (éphémère) |
| **Statut** | 🟡 Anticipé |
| **ADR** | [ADR-21](../../adr/ADR-21-behavior-reutilisation.md) (Behavior et réutilisation), [ADR-14](../../adr/ADR-14-contrats-types.md) (contrat modulaire), [ADR-15](../../adr/ADR-15-evenements-ui.md) (événements UI), [ADR-17](../../adr/ADR-17-local-state.md) (localState), [ADR-25](../../adr/ADR-25-formulaires.md) (formulaires) |

> ## ⏳ Périmètre d'implémentation
>
> **Rien n'est livré** : pas de package `@bonsai/behavior` (strate 2b, [ADR-31](../../adr/ADR-31-strates-perimetre-v1.md)).
> Ce document fixe le contrat cible. Il réutilise les types livrés côté View
> (`TFeatureContract`, `TUIContract`, `TUIElements`, `ui<TEl>()`) : la forme
> exacte de `TBehaviorContract` et `TBehaviorCallbacks` sera arrêtée à
> l'implémentation, sur le modèle de `TViewContract` / `TViewCallbacks` (I83, I88).

---

## Table des matières

1. [Contrat](#1-contrat)
2. [Déclarations](#2-déclarations)
3. [Cycle de vie](#3-cycle-de-vie)
4. [Exemples](#4-exemples)

---

## 1. Contrat

Le Behavior est un **plugin UI réutilisable et aveugle** : il ne connaît pas sa
View hôte (I44). Il suit le **pattern modulaire** de la View (I83) :

```typescript
type TBehaviorContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract = TUIContract,
  L extends TJsonSerializable = never             // localState, comme TViewContract
> = { readonly features: F; readonly ui: U; readonly local: L };

abstract class Behavior<TBC extends TBehaviorContract = TBehaviorContract> {
  abstract get features(): TBC["features"];               // Channels propres
  abstract get uiEvents(): TBC["ui"];                     // ses propres clés UI
  abstract get uiElements(): TUIElements<TBC["ui"]>;      // résolus dans le rootElement de l'hôte

  protected getUI<K extends keyof TBC["ui"] & string>(key: K): TProjectionNode<ExtractEl<TBC["ui"][K]>>;
  protected trigger<K extends TFlatTriggers<TBC["features"]>>(key: K, payload: TCommandPayloadFor<TBC["features"], K>): void;
  protected request<K extends TFlatRequests<TBC["features"]>>(key: K, params: TRequestParamsFor<TBC["features"], K>): TRequestResultFor<TBC["features"], K> | null;

  onAttach(): void;
  onDetach(): void;
}
```

Une classe concrète écrit la paire habituelle :
`extends Behavior<TBC>` + `implements TBehaviorCallbacks<TBC>` (I88), qui impose
les handlers Channel `on{NS}{Event}Event` et DOM `on{Key}{DomEvent}`.

| Règle | Invariant |
| --- | --- |
| Aucun **domain state** ; un `localState` de présentation est permis | I30, I42 |
| Aucun accès à la View hôte : ni `this.view`, ni son `el`, ni son `getUI()` | I44 |
| Ses clés UI ne recoupent pas celles de l'hôte (vérifié au montage) | I43 |
| Altération N1 et N2 sur **ses propres** clés UI ; jamais N3, pas de `rootElement` | I45 |
| `trigger`, `listen`, `request` sur ses Channels déclarés ; jamais `emit()` | I4 |

---

## 2. Déclarations

### 2.1 Clés UI propres (I43)

Même module que la View ([ADR-15](../../adr/ADR-15-evenements-ui.md)) :

```typescript
const trackingUiEvents = {
  trackedElement: ui<HTMLElement>()(["click"]),
} satisfies TUIContract;

const trackingUiElements = {
  trackedElement: "[data-tracking-type]",
} satisfies TUIElements<typeof trackingUiEvents>;
```

Les sélecteurs sont résolus dans le `rootElement` de la View hôte. La
non-collision des clés (I43) est vérifiée au montage ; c'est à la **View** qui
déclare ses Behaviors de la garantir.

### 2.2 Handlers auto-découverts

`trackedElement` + `"click"` impose `onTrackedElementClick(e: MouseEvent)`,
exactement comme pour la View (I48, I84).

### 2.3 Channels propres

Le Behavior déclare ses dépendances Channel dans son propre `features`,
indépendamment de la View hôte : ses couplages sont explicites et testables
isolément.

### 2.4 Templates en îlots (N2)

Un Behavior peut déclarer des templates sur **ses** clés UI (mode C, [5-rendu](../5-rendu.md)).
Le mode B (template du `rootElement`) lui est interdit.

### 2.5 localState

Même mécanisme que la View ([view.md §7](view.md#7-api-localstate), ADR-17) :
`get localState()`, `updateLocal(recipe)`, `this.local`, callbacks
`onLocal{Key}Updated`. Détruit au détachement.

---

## 3. Cycle de vie

Le Behavior vit et meurt avec sa View hôte.

| Moment | Le framework… |
| --- | --- |
| Attachement de l'hôte | instancie le Behavior, lit `features`/`uiEvents`/`uiElements` (une fois), vérifie I43, résout les sélecteurs dans le `rootElement` de l'hôte, branche handlers DOM et Channel, initialise le `localState`, appelle `onAttach()` |
| Détachement de l'hôte | appelle `onDetach()`, détruit le `localState`, débranche handlers DOM et Channel, nettoie les projections |

Le Behavior est toujours détaché **avant** sa View hôte.

```text
attached → detached → [destroyed]
```

### 3.1 Behavior, View + options ou héritage ? (ADR-21)

| Question | Réponse |
| --- | --- |
| Q0 — Sert de base de composition ? | **View** |
| Q1 — Même View, contexte différent ? | **View + options** surchargées par le Composer |
| Q2 — Capacité orthogonale, applicable à des Views sans rapport ? | **Behavior** |
| Q3 — Modifie le template principal ? | **Héritage** (rare, découragé) |
| Q4 — A besoin de ses propres Channels ? | **Behavior** ; sinon une méthode privée |

---

## 4. Exemples

### 4.1 TrackingBehavior — handlers auto-découverts, pas d'altération DOM

```typescript
const trackingFeatures = {
  analytics: {
    feature: AnalyticsFeature,
    listens: [] as const,
    triggers: ["trackInteraction"] as const,
    requests: [] as const,
  },
} satisfies TFeatureContract;

type TTrackingContract = TBehaviorContract<typeof trackingFeatures, typeof trackingUiEvents>;

class TrackingBehavior
  extends Behavior<TTrackingContract>
  implements TBehaviorCallbacks<TTrackingContract>
{
  get features()   { return trackingFeatures; }
  get uiEvents()   { return trackingUiEvents; }
  get uiElements() { return trackingUiElements; }

  onTrackedElementClick(e: MouseEvent): void {
    const el = e.currentTarget as HTMLElement;
    this.trigger("analytics:trackInteraction", {
      type: el.dataset.trackingType ?? "",
      value: el.dataset.trackingValue ?? "",
    });
  }
}
```

### 4.2 ScrollBehavior — localState et projection N1

```typescript
const scrollUiEvents = {
  scrollContainer: ui<HTMLDivElement>()(["scroll"]),
} satisfies TUIContract;

type TScrollContract = TBehaviorContract<{}, typeof scrollUiEvents>;

class ScrollBehavior extends Behavior<TScrollContract> implements TBehaviorCallbacks<TScrollContract> {
  get features()   { return {}; }
  get uiEvents()   { return scrollUiEvents; }
  get uiElements() { return { scrollContainer: ".scroll-wrapper" }; }

  protected get localState() {
    return { scrollPosition: 0, velocity: 0, isScrolling: false };
  }

  onScrollContainerScroll(e: Event): void {
    const position = (e.currentTarget as HTMLDivElement).scrollTop;
    this.updateLocal(draft => {
      draft.velocity = position - draft.scrollPosition;
      draft.scrollPosition = position;
      draft.isScrolling = true;
    });
  }

  // N1 : l'état dynamique passe par data-*, jamais par une classe CSS
  onLocalIsScrollingUpdated({ actual }: TLocalUpdate<boolean>): void {
    this.getUI("scrollContainer").attr("data-state", actual ? "scrolling" : "idle");
  }
}
```

### 4.3 ContactFormBehavior — formulaire réutilisable (ADR-25, pattern C)

Le Behavior gère saisie, validation et affichage des erreurs dans son
`localState`, puis **délègue la soumission** à la View hôte par un callback :
c'est la View qui porte la responsabilité métier du Command.

```typescript
const contactUiEvents = {
  nameField:    ui<HTMLInputElement>()(["input", "blur"]),
  emailField:   ui<HTMLInputElement>()(["input", "blur"]),
  submitBtn:    ui<HTMLButtonElement>()(["click"]),
  nameError:    ui<HTMLSpanElement>()([]),
  emailError:   ui<HTMLSpanElement>()([]),
} satisfies TUIContract;

type TContactFields = { name: string; email: string };
type TContactContract = TBehaviorContract<{}, typeof contactUiEvents>;

class ContactFormBehavior
  extends Behavior<TContactContract>
  implements TBehaviorCallbacks<TContactContract>
{
  readonly #validate: (f: TContactFields) => Partial<Record<keyof TContactFields, string>>;
  readonly #onValidSubmit: (values: TContactFields) => void;

  constructor(config: {
    validate: (f: TContactFields) => Partial<Record<keyof TContactFields, string>>;
    onValidSubmit: (values: TContactFields) => void;
  }) {
    super();
    this.#validate = config.validate;
    this.#onValidSubmit = config.onValidSubmit;
  }

  get features()   { return {}; }
  get uiEvents()   { return contactUiEvents; }
  get uiElements() {
    return {
      nameField: "[name=name]", emailField: "[name=email]", submitBtn: "button[type=submit]",
      nameError: ".Field-error--name", emailError: ".Field-error--email",
    };
  }

  protected get localState() {
    return { values: { name: "", email: "" }, errors: {} as Partial<Record<keyof TContactFields, string>>, submitted: false };
  }

  onNameFieldInput(e: Event): void  { this.#set("name", (e.currentTarget as HTMLInputElement).value); }
  onEmailFieldInput(e: Event): void { this.#set("email", (e.currentTarget as HTMLInputElement).value); }
  onNameFieldBlur(): void  { this.#validateAll(); }
  onEmailFieldBlur(): void { this.#validateAll(); }

  onSubmitBtnClick(): void {
    this.#validateAll();
    if (Object.keys(this.local.errors).length === 0) {
      this.updateLocal(d => { d.submitted = true; });
      this.#onValidSubmit({ ...this.local.values });
    }
  }

  onLocalErrorsUpdated({ actual }: TLocalUpdate<Partial<Record<keyof TContactFields, string>>>): void {
    this.getUI("nameError").text(actual.name ?? "");
    this.getUI("emailError").text(actual.email ?? "");
    this.getUI("nameField").attr("aria-invalid", String(Boolean(actual.name)));
    this.getUI("emailField").attr("aria-invalid", String(Boolean(actual.email)));
  }

  #set(field: keyof TContactFields, value: string): void {
    this.updateLocal(d => { d.values[field] = value; });
  }

  #validateAll(): void {
    const errors = this.#validate(this.local.values);
    this.updateLocal(d => { d.errors = errors; });
  }
}
```

La validation peut réutiliser les sous-schemas Valibot de l'Entity cible
plutôt que dupliquer les règles ([ADR-11](../../adr/ADR-11-entity-schema-valibot.md)).

### 4.4 Déclaration dans la View hôte

```typescript
class ContactPageView extends View<TContactPageContract> implements TViewCallbacks<TContactPageContract> {
  get features()   { return contactPageFeatures; }   // contact: triggers submitContact, listens contactSubmitted
  get uiEvents()   { return contactPageUiEvents; }   // successMsg : ui<HTMLParagraphElement>()([])
  get uiElements() { return { successMsg: ".ContactPage-success" }; }

  get behaviors() {
    return [
      TrackingBehavior,
      new ContactFormBehavior({
        validate: ({ name, email }) => ({
          ...(name.length < 2 ? { name: "Nom trop court" } : {}),
          ...(email.includes("@") ? {} : { email: "Email invalide" }),
        }),
        onValidSubmit: values => this.trigger("contact:submitContact", values),
      }),
    ];
  }

  onContactContactSubmittedEvent(payload: { name: string }): void {
    this.getUI("successMsg").text(`Merci ${payload.name} !`);
    this.getUI("successMsg").visible(true);
  }
}
```

`get behaviors()` accepte une classe (instanciée sans argument) ou une instance
déjà configurée.

---

## Lecture suivante

→ [foundation.md](foundation.md) — le point d'ancrage DOM unique
→ [view.md §7](view.md#7-api-localstate) — spécification complète du localState
→ [ADR-25](../../adr/ADR-25-formulaires.md) — patterns de formulaire
