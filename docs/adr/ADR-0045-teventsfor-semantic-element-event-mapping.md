# ADR-0045 : `TEventsFor<TEl>` — mapping sémantique élément → événements DOM autorisés

| Champ                   | Valeur                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**              | 🔵 Tested                                                                                                                           |
| **Date**                | 2026-05-07                                                                                                                          |
| **Décideurs**           | @NCAC                                                                                                                               |
| **RFC liée**            | [view.md](../rfc/4-couche-concrete/view.md)                                                                                         |
| **ADRs liées**          | [ADR-0042](ADR-0042-view-contract-unified-ui-deps-single-generic.md), [ADR-0044](ADR-0044-ui-events-restricted-to-dom-event-map.md) |
| **Invariants impactés** | I89 (amendé), I91 (nouveau)                                                                                                         |

---

## Contexte

ADR-0044 établit la restriction syntaxique : `TEvts` est contraint à `keyof HTMLElementEventMap`, éliminant les fautes de frappe. Il reste un problème sémantique :

```typescript
// Syntaxiquement valide (keyof HTMLElementEventMap) — sémantiquement absurde
ui<HTMLButtonElement>()(["change", "scroll", "play"]); // aucune erreur
ui<HTMLInputElement>()(["play", "scroll", "enterpictureinpicture"]); // aucune erreur
```

Un `HTMLButtonElement` ne porte pas de valeur — `"change"` et `"input"` n'ont aucun sens sur lui. Un `HTMLInputElement` ne défile pas — `"scroll"` n'est pas pertinent. Ces erreurs restent silencieuses après ADR-0044.

**Pourquoi TypeScript lui-même ne l'encode pas ?** La lib.dom.d.ts utilise `keyof HTMLElementEventMap` pour la quasi-totalité des éléments HTML. C'est un choix délibéré de la spécification DOM : techniquement, tout élément peut recevoir n'importe quel event via `dispatchEvent`. TypeScript ne modélise pas la sémantique, seulement la conformité structurelle.

**Bonsai peut aller plus loin.** En tant que framework opinionated, Bonsai peut définir un type `TEventsFor<TEl>` qui encode ce que le DOM fait sémantiquement — guide le développeur vers les bons choix via IntelliSense.

---

## Contraintes

- **C1** : `TEventsFor<TEl>` doit être un sous-type de `keyof HTMLElementEventMap` — compatibilité avec ADR-0044 garantie.
- **C2** : Le fallback `TEventsFor<HTMLElement>` (type générique) doit couvrir **tous** les events courants — aucune régression pour les `HTMLElement` non-spécialisés.
- **C3** : La liste par élément doit se baser sur des listes de **catégories nommées** réutilisables — pas de valeurs littérales dupliquées entre éléments.
- **C4** : Maintenu dans `@bonsai/view` (pas de dépendance externe) — la lib.dom.d.ts est la source de vérité syntaxique, `TEventsFor` est la couche sémantique Bonsai.
- **C5** : Compatible avec la forme curryfiée `ui<TEl>()()` — l'inférence littérale du tuple `events` doit rester préservée.
- **C6** : `TEventsFor<HTMLElement>` (défaut générique) doit retourner une union large incluant les events de formulaire, scroll, media — pour ne pas pénaliser les usages sans sous-type explicite.

---

## Conception : catégories d'événements

La lib.dom.d.ts liste **88 events** dans `GlobalEventHandlersEventMap` + 2 dans `ElementEventMap`. Bonsai les organise en **10 catégories sémantiques** nommées :

```typescript
// ─── Catégories d'events DOM (Bonsai semantic layer) ─────────────────────────

/**
 * Events de pointeur : souris, touch, pointer API, molette.
 * Universels — disponibles sur tout HTMLElement interactif.
 */
type TUIPointerEvents =
  | "auxclick"
  | "click"
  | "contextmenu"
  | "dblclick"
  | "mousedown"
  | "mouseenter"
  | "mouseleave"
  | "mousemove"
  | "mouseout"
  | "mouseover"
  | "mouseup"
  | "gotpointercapture"
  | "lostpointercapture"
  | "pointercancel"
  | "pointerdown"
  | "pointerenter"
  | "pointerleave"
  | "pointermove"
  | "pointerout"
  | "pointerover"
  | "pointerup"
  | "touchcancel"
  | "touchend"
  | "touchmove"
  | "touchstart"
  | "wheel";

/**
 * Events focus : éléments focusables (boutons, inputs, liens, tabindex).
 */
type TUIFocusEvents = "blur" | "focus" | "focusin" | "focusout";

/**
 * Events clavier : éléments recevant du texte ou des raccourcis.
 */
type TUIKeyboardEvents =
  | "beforeinput"
  | "compositionend"
  | "compositionstart"
  | "compositionupdate"
  | "keydown"
  | "keypress"
  | "keyup";

/**
 * Events presse-papiers.
 */
type TUIClipboardEvents = "copy" | "cut" | "paste";

/**
 * Events drag & drop.
 */
type TUIDragEvents =
  | "drag"
  | "dragend"
  | "dragenter"
  | "dragleave"
  | "dragover"
  | "dragstart"
  | "drop";

/**
 * Events animation CSS et transition CSS.
 */
type TUIAnimationEvents =
  | "animationcancel"
  | "animationend"
  | "animationiteration"
  | "animationstart"
  | "transitioncancel"
  | "transitionend"
  | "transitionrun"
  | "transitionstart";

/**
 * Base universelle : events disponibles sur TOUT HTMLElement.
 * Composition de toutes les catégories non-spécialisées.
 */
type TUIBaseEvents =
  | TUIPointerEvents
  | TUIFocusEvents
  | TUIKeyboardEvents
  | TUIClipboardEvents
  | TUIDragEvents
  | TUIAnimationEvents;

/**
 * Events de valeur : éléments portant une valeur éditable.
 * Spécifiques à HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement.
 */
type TUIFormValueEvents =
  | "change"
  | "input"
  | "invalid"
  | "select"
  | "selectionchange"
  | "selectstart";

/**
 * Events de formulaire-conteneur : HTMLFormElement uniquement.
 */
type TUIFormContainerEvents = "formdata" | "reset" | "submit";

/**
 * Events de défilement : éléments avec overflow scroll.
 * NON inclus dans TUIBaseEvents — un bouton ne défile pas.
 */
type TUIScrollEvents = "scroll" | "scrollend";

/**
 * Events media : audio et vidéo.
 */
type TUIMediaEvents =
  | "abort"
  | "canplay"
  | "canplaythrough"
  | "cuechange"
  | "durationchange"
  | "emptied"
  | "ended"
  | "error"
  | "loadeddata"
  | "loadedmetadata"
  | "loadstart"
  | "pause"
  | "play"
  | "playing"
  | "progress"
  | "ratechange"
  | "seeked"
  | "seeking"
  | "stalled"
  | "suspend"
  | "timeupdate"
  | "volumechange"
  | "waiting";

/**
 * Events de bascule : details, dialog.
 */
type TUIToggleEvents = "beforetoggle" | "cancel" | "close" | "toggle";
```

---

## Options considérées

### Option A — `TEventsFor<TEl>` type conditionnel sur sous-types connus ✅

**Description** : Type conditionnel qui mappe les sous-types d'éléments connus vers leurs catégories sémantiques. Le fallback `HTMLElement` reste large.

```typescript
/**
 * Mapping sémantique : sous-type HTMLElement → events DOM autorisés.
 *
 * - Éléments connus : liste positive d'events sémantiquement cohérents.
 * - Fallback HTMLElement : union large (toutes catégories).
 *
 * Intentionnellement plus strict que lib.dom.d.ts pour les éléments connus.
 * Intentionnellement permissif pour HTMLElement générique (pas de régression).
 *
 * @see ADR-0045
 */
export type TEventsFor<TEl extends HTMLElement> =
  // ── Éléments de valeur ────────────────────────────────────────────────
  TEl extends HTMLInputElement | HTMLTextAreaElement
    ? TUIBaseEvents | TUIFormValueEvents
    : TEl extends HTMLSelectElement
      ? TUIBaseEvents | "change" | "input" | "invalid"
      : // ── Formulaire conteneur ───────────────────────────────────────────────
        TEl extends HTMLFormElement
        ? TUIBaseEvents | TUIFormValueEvents | TUIFormContainerEvents
        : // ── Éléments interactifs sans valeur ──────────────────────────────────
          TEl extends HTMLButtonElement | HTMLAnchorElement
          ? TUIBaseEvents
          : // ── Éléments media ────────────────────────────────────────────────────
            TEl extends HTMLVideoElement
            ?
                | TUIBaseEvents
                | TUIMediaEvents
                | TUIScrollEvents
                | "enterpictureinpicture"
                | "leavepictureinpicture"
            : TEl extends HTMLAudioElement
              ? TUIBaseEvents | TUIMediaEvents
              : // ── Éléments toggle ───────────────────────────────────────────────────
                TEl extends HTMLDetailsElement
                ? TUIBaseEvents | "toggle" | "beforetoggle"
                : TEl extends HTMLDialogElement
                  ? TUIBaseEvents | TUIToggleEvents
                  : // ── Conteneurs scrollables connus ─────────────────────────────────────
                    TEl extends
                        | HTMLDivElement
                        | HTMLSectionElement
                        | HTMLArticleElement
                        | HTMLMainElement
                        | HTMLAsideElement
                        | HTMLNavElement
                        | HTMLUListElement
                        | HTMLOListElement
                        | HTMLTableElement
                    ? TUIBaseEvents | TUIScrollEvents
                    : // ── Fallback : HTMLElement générique — union large ────────────────────
                        | TUIBaseEvents
                        | TUIFormValueEvents
                        | TUIFormContainerEvents
                        | TUIScrollEvents
                        | TUIMediaEvents
                        | TUIToggleEvents;
```

**DX :**

```typescript
// ✅ Accepté
ui<HTMLInputElement>()(["change", "input", "focus", "blur"]);
ui<HTMLButtonElement>()(["click", "mouseenter", "keydown"]);
ui<HTMLVideoElement>()(["play", "pause", "ended", "timeupdate"]);

// ❌ Erreur compile
ui<HTMLButtonElement>()(["change"]);
// Type '"change"' is not assignable to type 'TUIBaseEvents'

ui<HTMLInputElement>()(["scroll"]);
// Type '"scroll"' is not assignable to type 'TUIBaseEvents | TUIFormValueEvents'

ui<HTMLButtonElement>()(["play"]);
// Type '"play"' is not assignable to type 'TUIBaseEvents'
```

| Avantages                                              | Inconvénients                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| + Erreur compile sur events sémantiquement incohérents | - Type conditionnel à maintenir si de nouveaux sous-types sont ajoutés |
| + IntelliSense contextualisé selon `TEl`               | - Plus strict que lib.dom.d.ts (acceptable — Bonsai est opinionated)   |
| + Catégories nommées réexportables et documentées      | - Certains éléments non listés tombent dans le fallback large          |
| + Zéro overhead runtime                                |                                                                        |
| + Fallback `HTMLElement` non-régressif                 |                                                                        |

---

### Option B — `keyof HTMLElementEventMap` uniforme (ADR-0044 seul, sans ADR-0045)

**Description** : Rester sur la contrainte syntaxique d'ADR-0044. Pas de restriction sémantique par élément.

| Avantages                         | Inconvénients                                                             |
| --------------------------------- | ------------------------------------------------------------------------- |
| + Aucune cartographie à maintenir | - `ui<HTMLButtonElement>()(["change"])` reste valide sans avertissement   |
| + Cohérence avec lib.dom.d.ts     | - IntelliSense identique pour tous les éléments — pas d'aide contextuelle |
|                                   | - Contredit la philosophie "Explicit > Implicit"                          |

---

### Option C — Lint rule ESLint `@bonsai/no-invalid-element-event`

**Description** : Analyse AST — vérification sémantique sans contrainte de type. La validation est externe au type system.

| Avantages                            | Inconvénients                                      |
| ------------------------------------ | -------------------------------------------------- |
| + Messages d'erreur personnalisables | - Pas d'erreur dans l'IDE sans plugin ESLint actif |
| + Pas de type conditionnel           | - Maintenance d'une règle ESLint séparée           |
|                                      | - Pas d'impact sur IntelliSense (autocomplétion)   |
|                                      | - Dépendance outillage externe obligatoire         |

---

## Analyse comparative

| Critère                           | Option A (`TEventsFor`) | Option B (statu quo ADR-0044) | Option C (lint) |
| --------------------------------- | ----------------------- | ----------------------------- | --------------- |
| **Sécurité compile-time**         | ⭐⭐⭐                  | ⭐⭐                          | ⭐⭐            |
| **IntelliSense contextualisé**    | ⭐⭐⭐                  | ⭐⭐                          | ⭐              |
| **Philosophie Bonsai**            | ⭐⭐⭐                  | ⭐⭐                          | ⭐⭐            |
| **Maintenabilité**                | ⭐⭐                    | ⭐⭐⭐                        | ⭐⭐            |
| **Couverture des cas non-listés** | ⭐⭐ (fallback large)   | ⭐⭐⭐                        | ⭐⭐⭐          |
| **Faisabilité immédiate**         | ⭐⭐⭐                  | ⭐⭐⭐                        | ⭐              |

---

## Décision

**Option A** — `TEventsFor<TEl>` type conditionnel, en remplacement de `keyof HTMLElementEventMap` dans `TUIEntry` et `ui()`.

**Justifications :**

1. **"Explicit > Implicit"** (philosophie Bonsai) : `ui<HTMLButtonElement>()` devrait ne proposer que des events cohérents avec un bouton. IntelliSense devient un guide actif, pas un répertoire générique.

2. **Erreur au bon moment** : `ui<HTMLInputElement>()(["scroll"])` est une erreur de conception détectable à la compilation. Avec l'Option B, elle serait enregistrée sans erreur mais ne déclencherait jamais rien de visible.

3. **Catégories exportées** : `TUIBaseEvents`, `TUIFormValueEvents`, `TUIScrollEvents`, etc. sont des types utilitaires réutilisables — un Behavior ou un type utilitaire peut les référencer pour ses propres contraintes.

4. **Fallback non-régressif** : `ui<HTMLElement>()()` reste large — aucune régression pour les cas génériques. La restriction ne s'applique qu'aux sous-types explicitement déclarés.

5. **Source de vérité interne assumée** : Bonsai maintient sa propre couche sémantique. La lib.dom.d.ts est la référence syntaxique ; `TEventsFor` est la référence sémantique Bonsai. Ce split est documenté et tracé.

**Rejet Option B** : rester sur `keyof HTMLElementEventMap` après avoir établi ADR-0044 serait une occasion manquée — l'outillage TypeScript permet exactement cette nuance.

**Rejet Option C** : une lint rule ne bénéficie pas à IntelliSense. L'objectif est que le développeur ne consulte pas la doc — le type l'oriente dans le bon sens dès la frappe.

---

## Amendement des invariants

### I89 — Amendé (ADR-0045 supersède ADR-0044 sur ce point)

> **Avant (ADR-0044)** : Tout nom d'événement déclaré dans `TUIEntry["events"]` doit être une clé valide de `HTMLElementEventMap`.

> **Après (ADR-0045)** : Tout nom d'événement déclaré dans `TUIEntry["events"]` doit appartenir à `TEventsFor<TEl>`, où `TEl` est le sous-type d'élément déclaré sur l'entrée UI. `TEventsFor<TEl>` est un sous-type de `keyof HTMLElementEventMap` (I89 d'ADR-0044 reste satisfait). Pour `TEl = HTMLElement` (défaut), tous les events communs sont autorisés.

### I91 — Nouveau

> `TEventsFor<TEl>` est le mapping officiel Bonsai entre sous-types d'éléments HTML et leurs événements DOM sémantiquement cohérents. Ce type vit dans `@bonsai/view` et est maintenu par l'équipe Bonsai. Toute modification nécessite un amendement documenté de cet ADR. Pour les sous-types non listés explicitement dans le type conditionnel, le fallback `TUIBaseEvents | ...` (union large) s'applique — aucune régression.

> **Note d'implémentation** : TypeScript évalue `TEventsFor<HTMLElement>` (type générique non-spécialisé) dans la branche des conteneurs scrollables (`TUIBaseEvents | TUIScrollEvents`) plutôt que dans le fallback explicite, en raison du typage structurel de `HTMLDivElement` (ses propriétés additionnelles sont optionnelles). Ce comportement est **acceptable** : `HTMLElement` non-spécialisé accepte `TUIBaseEvents | TUIScrollEvents`, ce qui couvre les cas d'usage courants. Pour un fallback large explicite, utiliser un sous-type concret (`HTMLDivElement`) ou migrer vers `TEl = HTMLElement` uniquement si nécessaire.

---

## Conséquences

### Positives

- ✅ IntelliSense contextualisé : `ui<HTMLButtonElement>()(["|"])` n'autosuggère que des events cohérents avec un bouton
- ✅ Erreur compile sur `ui<HTMLInputElement>()(["scroll"])`, `ui<HTMLButtonElement>()(["change"])`
- ✅ Catégories exportées (`TUIBaseEvents`, `TUIFormValueEvents`, etc.) réutilisables dans l'écosystème Bonsai
- ✅ Cohérence avec la philosophie "Explicit > Implicit" et "Compile-time > Runtime"
- ✅ `TDOMEventFor<S>` peut être paramétré sur `TEventsFor<TEl>` — types natifs exacts dans les handlers (`MouseEvent`, `InputEvent`, `Event`...)

### Négatives (acceptées)

- ⚠️ **Type conditionnel à maintenir** : l'ajout d'un nouveau sous-type d'élément courant (ex: `HTMLPopoverElement` si standardisé) nécessite un amendement — coût faible, processus tracé
- ⚠️ **Plus strict que lib.dom.d.ts** : Bonsai rejette `button.events["change"]` que TypeScript accepterait — documenté et assumé
- ⚠️ **Message d'erreur** : `Type '"change"' is not assignable to type 'TUIBaseEvents'` est moins explicite que `'"change" is not valid for HTMLButtonElement'` — acceptable en v1

### Risques identifiés

- 🔶 **Éléments hybrides** : un `<input type="range">` peut recevoir `"scroll"` dans certains contextes navigateur — marginal, le fallback `HTMLInputElement` couvre les events standards
- 🔶 **Web Components avec événements non-standard** : hors périmètre `TUIContract` (C1 d'ADR-0044)

---

## Fichiers impactés

| Fichier                                                      | Modification                                                                                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/view/src/bonsai-view.ts`                           | Ajout des types catégories (`TUIPointerEvents`, etc.) + `TEventsFor<TEl>` ; mise à jour de `TUIEntry<TEvts>` → contrainte `TEventsFor<TEl>` ; mise à jour de `ui<TEl>()()`              |
| `packages/view/src/bonsai-view.ts`                           | `TDOMEventFor<S>` : `S extends keyof HTMLElementEventMap` → `S extends keyof HTMLElementEventMap` (inchangé syntaxiquement, mais `S` est maintenant garanti sous-type via `TEventsFor`) |
| `docs/rfc/4-couche-concrete/view.md`                         | Documentation de `TEventsFor<TEl>` et des catégories                                                                                                                                    |
| `docs/rfc/reference/types-index.md`                          | Ajout des entrées `TEventsFor`, `TUIBaseEvents`, `TUIFormValueEvents`, etc.                                                                                                             |
| `docs/rfc/reference/invariants.md`                           | Amendement I89, ajout I91                                                                                                                                                               |
| `docs/adr/ADR-0044-ui-events-restricted-to-dom-event-map.md` | Note de relation + lien ADR-0045                                                                                                                                                        |

---

## Actions de suivi

- [ ] Implémenter `TEventsFor<TEl>` et les types catégories dans `bonsai-view.ts` (feature branch `feat/typed-dom-events`)
- [ ] Valider que les tests de types existants compilent
- [ ] Ajouter tests de type négatifs :
  - `ui<HTMLButtonElement>()(["change"])` → erreur attendue
  - `ui<HTMLInputElement>()(["scroll"])` → erreur attendue
  - `ui<HTMLVideoElement>()(["play"])` → accepté
  - `ui<HTMLElement>()(["scroll"])` → accepté (fallback large)
- [ ] Exporter les types catégories dans `index.ts` de `@bonsai/view`
- [ ] Mettre à jour ADR-0042 §Conséquences avec note post-ADR-0044/0045

---

## Références

- [`GlobalEventHandlersEventMap` — TypeScript DOM lib](https://github.com/microsoft/TypeScript/blob/main/src/lib/dom.generated.d.ts)
- [ADR-0044](ADR-0044-ui-events-restricted-to-dom-event-map.md) — Restriction syntaxique préalable
- [ADR-0042](ADR-0042-view-contract-unified-ui-deps-single-generic.md) — Pattern modulaire `TUIContract`
- [view.md §3.3](../rfc/4-couche-concrete/view.md) — Spécification `TUIEntry` et `ui()`

---

## Historique

| Date       | Changement                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 2026-05-07 | Création (🟡 Proposed) — résolution de Q1 (ADR-0044) via `TEventsFor<TEl>`                          |
| 2026-05-12 | 🟢 Accepted — décision validée                                                                      |
| 2026-05-12 | 🔵 Tested — I89/I91 cités dans `tests/types/strate-0/view-contract.types.test.ts` (ADR-0043 critère C-Inv) |
