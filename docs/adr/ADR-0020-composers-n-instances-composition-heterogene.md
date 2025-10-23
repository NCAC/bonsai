# ADR-0020 : Sémantique N-instances Composer & composition dynamique hétérogène (CDH — périmètre réduit)

> **Comment permettre à un Composer de gérer N Views hétérogènes dans un scope DOM fixe, et quelle est la sémantique exacte de `get composers()` quand un sélecteur `uiElements` matche plusieurs éléments DOM ?**

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-01 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0002 §9 Composer](../rfc/6-transversal/conventions-typage.md#9-composer), [RFC-0001-composants](../rfc/2-architecture/README.md) |
| **Invariants impactés** | I35 (nuancé), I37 (révisé), I40 (renforcé), D21, D24 |
| **ADRs liées** | ADR-0001 (entity mutation), ADR-0010 (bootstrap order), ADR-0019 (Mode ESM), ADR-0021 (monde ouvert) |
| **Supersède** | I37 partiel (0/1 View → 0/N Views dans scope fixe) |

> ### Statut normatif
> Ce document est **normatif** pour le contrat du Composer et la sémantique de `get composers()`.
> En cas de divergence avec `reflexion-composition-dynamique-heterogene.md`, **ce document prévaut**.
> La RFC-0002 §9 est mise à jour en conséquence.

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Options considérées](#options-considérées)
   - [Option A — `resolve()` N-Views, sémantique querySelectorAll sur uiElements](#option-a--resolve-n-views-sémantique-queryselectorall-sur-uielements)
   - [Option B — `async get composers()` côté View](#option-b--async-get-composers-côté-view)
   - [Option C — CollectionComposer dédié](#option-c--collectioncomposer-dédié)
4. [Analyse comparative](#analyse-comparative)
5. [Décision](#décision)
6. [Spécifications normatives](#spécifications-normatives)
   - [6.1 Sémantique querySelectorAll sur `uiElements`](#61-sémantique-queryselectorall-sur-uielements)
   - [6.2 `TResolveResult` révisé — `rootElement` dédié](#62-tresolveresult-révisé--rootelement-dédié)
   - [6.3 `resolve()` unifié — retour étendu](#63-resolve-unifié--retour-étendu)
   - [6.4 Invariant d'immutabilité du scope Composer](#64-invariant-dimmutabilité-du-scope-composer)
   - [6.5 Périmètre réel de la CDH](#65-périmètre-réel-de-la-cdh)
7. [Exemples normatifs](#exemples-normatifs)
8. [Impact sur les invariants](#impact-sur-les-invariants)
9. [Conséquences](#conséquences)
10. [Historique](#historique)

---

## Contexte

### Le problème de la composition hétérogène

L'invariant I37 actuel énonce : *« Un Composer gère toujours 0 ou 1 View dans un slot. »* Les slots sont déclarés statiquement dans `get composers()` de la View. Ce modèle couvre les compositions statiques mais pas les cas où la structure UI est déterminée au runtime.

Les applications réelles (CMS, back-offices, dashboards configurables) présentent des cas tels que :

- Un formulaire CMS dont les champs « complexes » (WYSIWYG, média, paragraphes) nécessitent des Views distinctes, dont la liste dépend du bundle de contenu — non connu au compile-time
- Un dashboard dont les widgets sont configurés par l'utilisateur
- Un layout builder dont les blocs de page sont composés dynamiquement

### La révélation : le cas CMS est déjà résolu

La réflexion architecturale (2026-03-31) a révélé un fait décisif : **le cas le plus courant de composition hétérogène est déjà résolu par la sémantique `querySelectorAll` de `uiElements`**, sans nécessiter de mécanisme CDH spécifique.

Un formulaire Drupal rendu en SSR produit :

```html
<form class="node-form">
  <div data-field-type="editorjs" data-field-id="field_body">...</div>
  <div data-field-type="editorjs" data-field-id="field_excerpt">...</div>
  <div data-field-type="media"    data-field-id="field_image">...</div>
</form>
```

Avec `uiElements: { editorJsSlot: '[data-field-type="editorjs"]' }` et `composers: { editorJsSlot: EditorJsComposer }`, le framework peut instancier **2 `EditorJsComposers`** — un pour chaque élément matché — sans aucun mécanisme CDH.

Ce document formalise cette sémantique et précise le périmètre résiduel de la CDH « vraie ».

---

## Contraintes

| # | Contrainte | Justification |
|---|-----------|---------------|
| **C1** | **I36 absolu** — View ne compose jamais | Pilier non négociable de la séparation des responsabilités |
| **C2** | **D21** — le Composer est le seul décideur d'instanciation | Aucune autre entité ne crée de View |
| **C3** | **D24** — pas de CollectionComposer | Un Composer classique révisé couvre le cas N-Views hétérogènes |
| **C4** | **I35 nuancé** — le Composer peut lire le DOM de son scope, pas l'écrire | Le Composer fait `querySelector` dans son scope ; il ne crée ni ne mute d'éléments |
| **C5** | **Scope immutable** — le scope d'un Composer ne migre jamais vers un autre élément DOM | Découvert au cours de la réflexion (§4 du document source) |
| **C6** | **Rétrocompatibilité D30** — `rootElement: string` continue de fonctionner | Les Composers SPA existants ne changent pas |

---

## Options considérées

### Option A — `resolve()` N-Views, sémantique `querySelectorAll` sur `uiElements`

**Description** : deux mécanismes complémentaires :

1. **Sémantique `querySelectorAll`** : une clé dans `uiElements` est résolue par `querySelectorAll` (0/1/N éléments). Si la clé est aussi dans `get composers()`, le framework instancie N Composers — un par élément matché.

2. **`resolve()` étendu** : un Composer peut retourner `TResolveResult | TResolveResult[] | null`. Un retour tableau signifie N Views hétérogènes dans le scope, chacune avec son `rootElement` et ses `options`.

Ces deux mécanismes sont orthogonaux et peuvent être utilisés séparément ou ensemble.

```typescript
// ── Mécanisme 1 : N Composers via querySelectorAll sémantique ──
// La View déclare; le framework instancie N instances

type TNodeEditFormViewUI = TUIMap<{
  formHeader:   HTMLDivElement;
  editorJsSlot: HTMLDivElement;   // matche N éléments via querySelectorAll
  mediaSlot:    HTMLDivElement;
}>;

class NodeEditFormView extends View<TNodeEditFormViewUI> {
  get uiElements(): TUIElements<TNodeEditFormViewUI> {
    return {
      formHeader:   '.node-form__header',
      editorJsSlot: '[data-field-type="editorjs"]',  // → querySelectorAll
      mediaSlot:    '[data-field-type="media"]',      // → querySelectorAll
    };
  }

  get composers(): TComposersMap<TNodeEditFormViewUI> {
    return {
      editorJsSlot: EditorJsComposer,  // N instances — une par élément matché
      mediaSlot:    MediaFieldComposer, // N instances — une par élément matché
    };
  }
}
// → Pour le HTML SSR avec 2 champs EditorJS + 1 champ Media :
//   → 2 EditorJsComposers instanciés
//   → 1 MediaFieldComposer instancié
// → Type-safe compile-time, zéro CDH, zéro BonsaiRegistry
```

```typescript
// ── Mécanisme 2 : resolve() N-Views dans un seul Composer ──
// Le Composer scanne son scope et retourne plusieurs TResolveResult

class NodeEditFormComposer extends Composer {
  static readonly request = [NodeEditForm.channel] as const;

  resolve(): TResolveResult[] | null {
    // Lecture DOM (I35 nuancé — lecture seule dans son scope)
    const mountPoints = this.slot.querySelectorAll('[data-field-type]');
    if (mountPoints.length === 0) return null;

    const results: TResolveResult[] = [];
    for (const el of mountPoints) {
      const viewClass = this.resolveViewForType(el.getAttribute('data-field-type'));
      if (viewClass) {
        results.push({ view: viewClass, rootElement: el });
      }
    }
    return results;
  }

  private resolveViewForType(type: string | null): typeof View | null {
    // Map locale — imports explicites, compile-time (QO-CDH-4 stabilisé)
    switch (type) {
      case 'editorjs':    return EditorJsView;
      case 'media':       return MediaPickerView;
      case 'paragraphs':  return ParagraphsView;
      default:            return null;
    }
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Aucun nouveau concept** — sémantique CSS querySelectorAll bien comprise | - Mécanisme 1 : comportement N-instances à documenter explicitement |
| + Type-safe compile-time pour le Mécanisme 1 | - Mécanisme 2 : I35 nuancé à formaliser (lecture DOM autorisée) |
| + Rétrocompatible — Composers existants non impactés | - `rootElement: Element` est un ajout à `TResolveResult` |
| + Mécanismes orthogonaux — utilisables séparément | |
| + D21 strict — le Composer reste le seul décideur | |
| + Couvre la quasi-totalité des cas CDH supposés | |

---

### Option B — `async get composers()` côté View

**Description** : rendre `get composers()` dans la View asynchrone, permettant à la View de faire un `request()` sur son Channel pour construire la map `{ slot → Composer }` dynamiquement.

```typescript
// ❌ Approche explorée puis écartée
class NodeEditFormView extends View {
  async get composers() {
    const fields = await this.request('nodeEditForm', 'fields');
    return Object.fromEntries(
      fields.map(f => [`field_${f.name}`, resolveComposerForType(f.type)])
    );
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + I37 préservé (chaque Composer reste 1:1) | - **I36 violé** — la View fait le mapping `type → Composer` = décision de composition |
| + I35 préservé — pas d'accès DOM Composer | - **Bootstrap async** — change fondamentalement ADR-0010 |
| | - View devient data-aware (fait un `request()`) |
| | - Wrong level of abstraction — la View ne doit pas raisonner |
| | - Problème œuf/poule : clés `composers` doivent matcher `uiElements`, qui dépendent du DOM, qui n'existe qu'après le rendu |

> **Rejetée** — violer I36 pour préserver I37 est un mauvais arbitrage. I36 est absolu (C1).

---

### Option C — CollectionComposer dédié

**Description** : créer un `CollectionComposer` spécialisé pour les listes de compositions hétérogènes.

```typescript
// ❌ Explicitement rejeté par D24
class ParagraphsCollectionComposer extends CollectionComposer {
  resolveItem(item: TParagraphItem): typeof View | null { /* ... */ }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Séparation claire | - **D24 violé** — décision architecturale existante |
| + Pattern familier (Collection) | - Crée une asymétrie — pourquoi Composer/CollectionComposer mais pas View/CollectionView ? |
| | - L'Option A couvre le même périmètre sans nouveau concept |

> **Rejetée** — D24 est une décision existante. Le problème est résolu par l'Option A sans introduction d'un type dédié.

---

## Analyse comparative

| Critère | Option A (querySelectorAll + resolve N) | Option B (async composers) | Option C (CollectionComposer) |
|---------|----------------------------------------|---------------------------|-------------------------------|
| **I36 respecté** | ✅ | ❌ | ✅ |
| **D21 respecté** | ✅ | ✅ partiel (View fait le mapping) | ✅ |
| **D24 respecté** | ✅ | ✅ | ❌ |
| **Rétrocompatibilité** | ⭐⭐⭐ | ⭐ (async bootstrap) | ⭐⭐ |
| **Type-safety** | ⭐⭐⭐ (mécanisme 1) / ⭐⭐ (mécanisme 2) | ⭐⭐ | ⭐⭐⭐ |
| **Nouveaux concepts** | Aucun | Bootstrap async | CollectionComposer |
| **Couverture des cas CDH** | ⭐⭐⭐ (90%+ des cas réels) | ⭐⭐ | ⭐⭐ |
| **DX** | ⭐⭐⭐ — CSS selectors familiers | ⭐ — bootstrap async complexe | ⭐⭐ — pattern connu |

---

## Décision

**Option A retenue — sémantique `querySelectorAll` sur `uiElements` + `resolve()` étendu.**

### Justification

L'Option A est la seule qui respecte tous les invariants absolus (I36, D21, D24) sans introduire de nouveaux concepts. La sémantique `querySelectorAll` est une extension naturelle du comportement existant — les développeurs connaissent déjà CSS `querySelectorAll`. Le `resolve()` étendu est un ajout minime à l'interface existante.

L'insight décisif est que **le cas CDH typique (composition typée par attribut DOM) n'est pas un cas CDH** : c'est la sémantique TUIMap normale, étendue aux N-instances. La CDH « vraie » — cas résiduel — est spécifiée en §6.5.

### Périmètre de cette décision

Cette ADR couvre :
- ✅ Sémantique `querySelectorAll` de `uiElements` → N Composers
- ✅ `TResolveResult` révisé (`rootElement: Element | string` dédié)
- ✅ `resolve()` étendu (`TResolveResult | TResolveResult[] | null`)
- ✅ Invariant d'immutabilité du scope Composer
- ✅ I35 nuancé (lecture DOM autorisée dans le scope)
- ✅ I37 révisé (0/N Views hétérogènes dans scope fixe)
- ✅ Périmètre CDH résiduel (cas non couverts par les deux mécanismes ci-dessus)
- ❌ Monde ouvert / plateforme → ADR-0021
- ❌ Late registration → ADR-0021
- ❌ Mode ESM et BonsaiRegistry → ADR-0019

---

## Spécifications normatives

### 6.1 Sémantique querySelectorAll sur `uiElements`

> **Règle** : un sélecteur CSS dans `uiElements` est résolu par `querySelectorAll` sur le scope de la View — il peut donc matcher **0, 1 ou N éléments DOM**.

```typescript
/**
 * TUIElements — sémantique querySelectorAll.
 *
 * Chaque valeur est un sélecteur CSS résolu par querySelectorAll(selector)
 * dans le scope de la View. Le résultat peut être une NodeList de 0, 1 ou N éléments.
 *
 * Comportements selon l'usage de la clé :
 *
 * ── Clé dans uiEvents ──
 *   La délégation d'événements s'applique à TOUS les éléments matchés.
 *   Ex: { productItem: '.Products-item' } → écoute les clics sur tous les items.
 *
 * ── Clé dans get composers() ──
 *   Le framework instancie N Composers — un par élément matché.
 *   Ex: { editorJsSlot: '[data-field-type="editorjs"]' } → 2 éléments → 2 EditorJsComposers.
 *   Chaque instance reçoit son élément propre comme rootElement de son scope.
 *
 * ── Clé utilisée via getUI() ──
 *   Retourne le premier élément matché (querySelector, comportement historique).
 *   Pour accéder à N éléments : utiliser getUI(key).all() → HTMLElement[].
 *
 * Overridable par les options du Composer (D34).
 */
type TUIElements<TUI extends TUIMap<any>> = {
  [K in keyof TUI]: string; // sélecteur CSS, résolu par querySelectorAll
};
```

**Conséquence sur `get composers()`** :

```typescript
// ── Règle ──
// Si uiElements[key] matche N éléments DOM et que key est dans composers[key],
// alors le framework instancie N instances de composers[key].
// Chaque instance reçoit comme scope l'élément DOM correspondant.

// Exemple — 2 éléments matchés → 2 instances
class NodeEditFormView extends View<TNodeEditFormViewUI> {
  get uiElements() {
    return {
      editorJsSlot: '[data-field-type="editorjs"]',
      // HTML contient: <div data-field-type="editorjs" data-field-id="field_body">
      //                <div data-field-type="editorjs" data-field-id="field_excerpt">
      // → querySelectorAll('[data-field-type="editorjs"]') → 2 éléments
    };
  }

  get composers() {
    return {
      editorJsSlot: EditorJsComposer,
      // → Framework instancie 2 EditorJsComposers
      //   - Instance 1 : scope = <div data-field-id="field_body">
      //   - Instance 2 : scope = <div data-field-id="field_excerpt">
    };
  }
}
```

**Ce que ce mécanisme n'est PAS de la composition cachée** :

| Aspect | Vérification |
|--------|-------------|
| `TUIMap` est compile-time | ✅ — le type est déclaré statiquement dans la View |
| `uiElements` est résolu au bootstrap | ✅ — `querySelectorAll` au moment de l'attachement View |
| `composers` est compile-time | ✅ — `{ editorJsSlot: EditorJsComposer }` est statique |
| La logique de composition est dans le Composer | ✅ — D21 respecté |
| La View reste aveugle au runtime | ✅ — elle ne sait pas combien d'éléments existent |

---

### 6.2 `TResolveResult` révisé — `rootElement` dédié

`rootElement` sort de `options` pour devenir un champ de premier niveau de `TResolveResult`. Cela reflète le fait que le Composer est désormais responsable de la résolution de l'élément (I35 nuancé).

```typescript
/**
 * Résultat d'une résolution Composer.
 *
 * Évolution par rapport à la version initiale :
 * - rootElement est un champ dédié (ne fait plus partie de options)
 * - rootElement accepte Element (résolu par le Composer) ou string (résolu par le framework)
 *
 * @param view       Constructeur de la View à instancier
 * @param rootElement
 *   - Element → le Composer a trouvé et résolu l'élément dans son scope (cas SSR, CDH)
 *               Le framework valide : slot.contains(el) avant d'attacher.
 *   - string  → sélecteur CSS, le framework résout via slot.querySelector(selector).
 *               Si absent et rootElement est un objet descripteur → framework crée l'élément (D30).
 * @param options   Paramètres supplémentaires passés à la View (D34)
 */
type TResolveResult<V extends typeof View = typeof View> = {
  readonly view: V;
  readonly rootElement: Element | string;
  readonly options?: Partial<ExtractViewParams<V>>;
};
```

**Qui résout le `rootElement` ?**

| Cas | `rootElement` | Qui résout | Quand |
|-----|---------------|-----------|-------|
| Composer dynamique (SSR, CDH) | `Element` | **Composer** — `this.slot.querySelector(...)` | Dans `resolve()` |
| Composer SPA classique | `string` | **Framework** — `slot.querySelector(selector)` | Après `resolve()` |
| SPA, élément absent (D30) | `string` (descripteur objet) | **Framework** — crée l'élément | Après `resolve()` si absent |

> **Invariant** : le Composer **ne crée jamais** d'élément DOM (I35 — même nuancé). Si `rootElement` est un `Element`, cet élément **préexiste** dans le scope.

---

### 6.3 `resolve()` unifié — retour étendu

```typescript
/**
 * resolve() — méthode principale du Composer.
 *
 * Signatures acceptées (union) :
 *   TResolveResult | null         → Composer classique (0/1 View) — inchangé
 *   TResolveResult[] | null       → Composer dynamique (0/N Views hétérogènes)
 *   TResolveResult | TResolveResult[] | null  → forme générale
 *
 * Pas de resolveAll() distinct — resolve() couvre les deux cas.
 *
 * Le framework traite les deux uniformément :
 * - null       → pas de View à monter (scope vide ou condition non remplie)
 * - résultat   → diff avec l'état précédent → detach obsolètes, attach nouveaux
 *
 * Réactivité :
 * - resolve() est appelé au bootstrap puis à chaque Event déclaré dans onXxxEvent()
 * - Le framework diff le résultat précédent vs le nouveau
 * - Les Views dont le rootElement a disparu → detach + destroy
 * - Les nouvelles entrées → instantiation + attach
 * - Les Views inchangées (même rootElement, même constructeur) → pas de cycle
 */
abstract resolve(): TResolveResult | TResolveResult[] | null;
```

**Comportement du framework lors du diff** :

```
resolve() retourne R'                    État précédent R
  ──────────────────────────────────────────────────────
  Pour chaque résultat r dans R' :
    Si r.rootElement ∈ R (même élément, même viewClass) → pas de cycle (View existante conservée)
    Si r.rootElement ∈ R (même élément, viewClass différente) → detach + destroy ancienne, attach nouvelle
    Si r.rootElement ∉ R (nouvel élément) → instanciation + attach
  Pour chaque r dans R \ R' :
    Si rootElement disparu du DOM → cleanup (le DOM a fait le travail)
    Si rootElement toujours dans le DOM → detach + destroy
```

---

### 6.4 Invariant d'immutabilité du scope Composer

> **Invariant I-nouveau (candidat) — Scope Composer immutable** :
>
> Le scope DOM d'un Composer (son élément racine) est assigné une seule fois au bootstrap
> et ne change jamais. Il existe exactement 3 états :
>
> ```
> assigné → vivant    (scope dans le DOM, Composer actif)
>         → suspendu  (scope retiré du DOM, Views détachées proprement)
>         → détruit   (Composer libéré — irréversible)
> ```
>
> Il n'existe **aucun** scénario de migration de scope. Un Composer « déplacé » dans le DOM
> est en réalité une destruction + re-création. Le nouveau Composer reçoit le nouvel élément
> comme scope ; l'ancien Composer est détruit.

**Propriétés dérivées** :

| Propriété | Statut |
|-----------|--------|
| Le scope est immutable — assigné une fois, jamais déplacé | ✅ Invariant |
| Le Composer ne crée pas son scope — il le reçoit | ✅ Cohérent avec I35 |
| La View contrôle l'existence du slot (markup), pas son contenu | ✅ Cohérent avec I36 |
| La disparition du scope = cleanup total des Views gérées | ✅ Mécanique automatique |
| Le sous-arbre d'un slot Composer est **exclu** du rendu de la View déclarante | ✅ Extension de I40 |

**Intégrité DOM du slot Composer** — la View peut conserver ou détruire l'élément slot,
mais elle ne peut **jamais modifier la structure interne** du sous-arbre d'un slot Composer vivant :

| Action de la View sur un slot Composer vivant | Autorisé ? |
|------------------------------------------------|-----------|
| Conserver l'élément slot tel quel | ✅ |
| Détruire l'élément slot (re-rendu qui ne le recrée pas) | ✅ — lifecycle normal |
| Modifier les attributs de l'élément slot lui-même | ✅ — l'élément reste dans le N1 scope |
| Ajouter des enfants dans le sous-arbre du slot | ❌ — domaine exclusif du Composer |
| Retirer des enfants dans le sous-arbre du slot | ❌ — idem |
| Modifier structurellement les enfants du slot | ❌ — idem |

---

### 6.5 Périmètre réel de la CDH

> **La composition hétérogène typée par attribut DOM n'est PAS de la CDH** — c'est la sémantique TUIMap + N-instances (§6.1). Le périmètre de la CDH « vraie » est réduit à deux cas résiduels.

**Cas 1 — DOM sans information de type** :

Le DOM ne contient pas d'attribut permettant au Composer de déterminer quelle View instancier sans information externe. Le Composer doit croiser l'information DOM (identifiant de l'élément) avec une information Channel (quel type correspond à cet identifiant).

```typescript
// Ex: DOM rendu sans data-field-type → le Composer doit demander au Channel
class NodeEditFormComposer extends Composer {
  static readonly request = [NodeEditForm.channel] as const;

  resolve(): TResolveResult[] | null {
    // Pas d'attribut type dans le DOM → le Channel connaît la structure
    const fieldDescriptors = this.request(NodeEditForm.channel, 'getFieldDescriptors');

    return fieldDescriptors
      .map(descriptor => {
        const el = this.slot.querySelector(`[data-field-id="${descriptor.id}"]`);
        const viewClass = this.resolveViewForType(descriptor.type); // map locale
        if (!el || !viewClass) return null;
        return { view: viewClass, rootElement: el };
      })
      .filter(Boolean) as TResolveResult[];
  }
}
```

**Cas 2 — Monde ouvert (plateforme)** :

Le Composer ne peut pas avoir d'imports statiques car les types de Views sont fournis par des modules tiers inconnus au compile-time. Ce cas est couvert par **ADR-0021** (`BonsaiRegistry` comme délégation contrôlée). D21 est respecté : le Composer consulte le registry mais **reste le décideur**.

> Les deux cas résiduels ne nécessitent pas de nouveau mécanisme au-delà de ce document (cas 1) et d'ADR-0021 (cas 2). La CDH n'a pas de mécanisme dédié — elle est couverte par la combinaison de `resolve()` étendu, de la sémantique N-instances, et d'ADR-0021 pour le monde ouvert.

---

## Exemples normatifs

### Pattern 1 — Composition hétérogène typée par attribut (cas le plus courant)

```html
<!-- DOM SSR — les attributs portent le type -->
<form class="node-form">
  <div data-field-type="editorjs" data-field-id="field_body">...</div>
  <div data-field-type="editorjs" data-field-id="field_excerpt">...</div>
  <div data-field-type="media"    data-field-id="field_image">...</div>
</form>
```

```typescript
// ── TUIMap — compile-time ──
type TNodeEditFormViewUI = TUIMap<{
  formActions:  HTMLDivElement;
  editorJsSlot: HTMLDivElement;  // matche N éléments
  mediaSlot:    HTMLDivElement;  // matche N éléments
}>;

// ── View — aveugle au contenu ──
class NodeEditFormView extends View<TNodeEditFormViewUI> {
  get uiElements(): TUIElements<TNodeEditFormViewUI> {
    return {
      formActions:  '.node-form__actions',
      editorJsSlot: '[data-field-type="editorjs"]',
      mediaSlot:    '[data-field-type="media"]',
    };
  }

  get composers(): TComposersMap<TNodeEditFormViewUI> {
    return {
      editorJsSlot: EditorJsComposer,   // → 2 instances
      mediaSlot:    MediaFieldComposer, // → 1 instance
    };
  }
}

// ── Résultat au bootstrap ──
// querySelectorAll('[data-field-type="editorjs"]') → 2 éléments
// → 2 EditorJsComposers instanciés, chacun avec son élément DOM propre
// querySelectorAll('[data-field-type="media"]') → 1 élément
// → 1 MediaFieldComposer instancié
```

### Pattern 2 — Composer dynamique avec scan DOM (CDH cas 1 — DOM sans type)

```typescript
class NodeEditFormComposer extends Composer {
  static readonly request = [NodeEditForm.channel] as const;

  resolve(): TResolveResult[] | null {
    // Lecture DOM (I35 nuancé — lecture seule dans son scope)
    const mountPoints = this.slot.querySelectorAll('[data-field-id]');
    if (mountPoints.length === 0) return null;

    // Croisement DOM × Channel pour obtenir les types
    const fieldTypes = this.request(NodeEditForm.channel, 'getFieldTypes');
    // → Map<fieldId, fieldType> retournée par la Feature

    const results: TResolveResult[] = [];
    for (const el of mountPoints) {
      const fieldId = el.getAttribute('data-field-id')!;
      const fieldType = fieldTypes.get(fieldId);
      const viewClass = this.resolveViewForType(fieldType);
      if (viewClass) {
        results.push({ view: viewClass, rootElement: el });
      }
    }
    return results;
  }

    // Map locale — imports explicites au compile-time (QO-CDH-4 stabilisé)
  private resolveViewForType(type: string | undefined): typeof View | null {
    switch (type) {
      case 'editorjs':    return EditorJsView;
      case 'media':       return MediaPickerView;
      case 'paragraphs':  return ParagraphsView;
      default:            return null;
    }
  }

  // Réactivité — re-résolution sur Event
  onNodeEditFormFieldsChangedEvent(): void {
    // Le framework re-appelle resolve() automatiquement
    // Diff → detach obsolètes, attach nouveaux
  }
}
```

### Anti-pattern — Scan DOM dans `get composers()` de la View

```typescript
// ❌ INTERDIT — scan DOM dans get composers()
class BadNodeEditFormView extends View {
  get composers() {
    // ❌ this.el n'est pas encore résolu au moment du bootstrap
    // ❌ La View fait de la composition (I36 violé)
    // ❌ Le résultat dépend du DOM runtime (non prédictible au compile-time)
    return Object.fromEntries(
      [...this.el.querySelectorAll('[data-field-type]')].map(el => [
        el.getAttribute('data-field-id'),
        this.resolveComposerForType(el.getAttribute('data-field-type')),
      ])
    );
  }
}
// → this.el n'existe pas encore au moment où get composers() est appelé
// → Même si ça fonctionnait : la View décide quelle Vue instancier (I36 violé)
// → Utilisez le Pattern 1 ou le Pattern 2 ci-dessus
```

---

## Impact sur les invariants

| Invariant | Avant | Après | Nature |
|-----------|-------|-------|--------|
| **I35** — Composer accès DOM | « Aucun droit DOM » | « Aucune **écriture** DOM. Lecture du scope autorisée. Le Composer résout le `rootElement` par `querySelector`. » | 🟡 Nuancé |
| **I36** — View ne compose jamais | Inchangé | Inchangé — confirmé et renforcé | ❄️ Inchangé |
| **I37** — Composer 0/1 View | « 0 ou 1 View par slot » | « 0/N Views hétérogènes dans un scope fixe via `resolve()` étendu » | 🔴 Révisé |
| **D21** — Composer décideur pur | Inchangé | Inchangé — D21 est compatible avec le retour tableau | ❄️ Inchangé |
| **D24** — Pas de CollectionComposer | Inchangé | Inchangé — un Composer classique couvre le cas N-Views | ❄️ Inchangé |
| **D30** — Framework crée rootElement si absent | Inchangé | Inchangé — s'applique quand `rootElement` est un `string` | ❄️ Inchangé |
| **I40** — Scope DOM exclusif | Inchangé | Renforcé — le sous-arbre d'un slot Composer est exclu du rendu View ; deux garde-fous (Mode C compile-time, Mode B runtime) | 🟡 Renforcé |
| **I-nouveau** — Scope Composer immutable | Absent | Ajouté — 3 états : vivant/suspendu/détruit ; pas de migration | 🆕 Nouveau |

---

## Conséquences

### Fichiers impactés

| Fichier | Impact |
|---------|--------|
| [RFC-0002 §9.4 TUIElements](../rfc/6-transversal/conventions-typage.md) | Sémantique querySelectorAll (0/1/N) — ✅ Déjà mis à jour |
| [RFC-0002 §9.6 `get composers()`](../rfc/6-transversal/conventions-typage.md) | Sémantique N-instances (une instance par élément matché) |
| [RFC-0002 §12.1–12.3 Composer, `TResolveResult`, `resolve()`](../rfc/6-transversal/conventions-typage.md) | `TResolveResult` révisé + retour `TResolveResult[]` |
| [RFC-0002 §12.4 Séquence d'attachement](../rfc/6-transversal/conventions-typage.md) | Étape 5 — Composer résout `rootElement: Element` ; framework valide `slot.contains(el)` |
| [RFC-0001-invariants-decisions](../rfc/reference/invariants.md) | I35 nuancé, I37 révisé, I40 renforcé, I-nouveau scope immutable |
| [FRAMEWORK-STYLE-GUIDE §4.7](../guides/FRAMEWORK-STYLE-GUIDE.md) | Pattern composition hétérogène typée par attribut — ✅ Déjà ajouté |

### Nouveaux invariants à ajouter dans RFC-0001-invariants-decisions

1. **I35 nuancé** : « Aucune écriture DOM dans le scope. Lecture (querySelector, getAttribute) autorisée. »
2. **I37 révisé** : « 0/N Views hétérogènes dans un scope fixe via `resolve()` étendu. »
3. **I-nouveau — Scope Composer immutable** : « Le scope DOM d'un Composer est assigné une fois et ne migre jamais. États : vivant → suspendu → détruit (irréversible). »

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-01 | Création — issu de `reflexion-composition-dynamique-heterogene.md` §3–§11. Formalise les décisions stabilisées lors de la réflexion du 2026-03-30/31. |
| 2026-04-01 | 🟢 **Accepted** — corrections A1–A4 (§9.7→§12.1–12.3, QO-CDH-4 harmonisé, Source retirée, §1.7→§4.7). Propagation downstream (RFC-0002 §9.6/§12, RFC-0001-invariants-decisions) planifiée comme tâches de suivi. |
