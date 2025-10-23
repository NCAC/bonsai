# ADR-0014 : SSR hydration strategy

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-24 |
| **Décideurs** | @ncac |
| **RFC liée** | RFC-0002 §7.2, §9.4, §9.4.7, §12.4 · RFC-0003 §5.3, §6, §7.5 |

---

## Contexte

Bonsai repose sur la **Projection DOM Réactive** (D19) : le DOM **préexiste** — rendu
par un serveur (SSR), un CMS ou un fichier HTML statique — et les Views projettent des
données sur ce DOM existant via des mutations chirurgicales, sans VDOM, sans diff d'arbre.

Ce postulat fondateur est déjà ancré dans le corpus :

| Référence | Ce qu'elle spécifie |
|-----------|---------------------|
| **D19** (PDR) | *« Le DOM préexiste (SSR/CMS/statique) »* — hypothèse fondatrice |
| **I31** | Le `rootElement` DOIT exister au `onAttach()` ; si un élément correspondant au sélecteur existe dans le slot (SSR), il est **réutilisé** |
| **D30** | Fallback SPA : si l'élément n'existe pas et qu'un descripteur objet est fourni, le framework **crée** l'élément |
| **§9.4.7** (bootstrap) | Étape 1 : *« DOM serveur existe (SSR/CMS/statique) »* |
| **§12.4** étape 5a | *« SI trouvé (SSR) → `el` = élément existant »* |
| **§9.4.6** Mode C | *« Le DOM serveur est la source de vérité structurelle »* |
| **RFC-0003** `setup()` | *« Localise les nœuds dynamiques dans le conteneur existant (SSR/hydratation) »* |
| **RFC-0003** `create()` | *« Crée le DOM complet (mode SPA, pas de SSR) »* |

**Problème** : ces mentions sont **éparpillées** et ne forment pas un contrat unifié.
Il manque un arbitrage formel sur :

1. **Détection du mode** — Comment le framework sait-il s'il est en SSR ou en SPA ?
2. **Transfert d'état** — Les Entities doivent-elles être pré-peuplées depuis le serveur ou re-fetchées au bootstrap ?
3. **Intégrité structurelle** — Quelle validation garantit que le DOM serveur est compatible avec les déclarations des Views ?
4. **Listes SSR** — Comment `ProjectionList` hydrate-t-elle une `<ul>` déjà rendue avec N items ?

---

## Contraintes

Les contraintes suivantes sont **non négociables** — elles découlent des invariants existants :

- **C1 (I31)** : Au `onAttach()`, le `rootElement` DOIT exister dans le DOM. Le framework ne tolère aucune View sans ancrage.
- **C2 (I39)** : La View accède au DOM **exclusivement** via `getUI(key)` fournie par le framework. Les sélecteurs CSS de `params.uiElements` sont résolus **par le framework** — la View ne fait aucun `querySelector` elle-même. Note : les data-attributes de réconciliation (`data-item-id`, `data-key`) sont gérés par le framework/template (`ProjectionList`), pas par l'API View.
- **C3 (I40)** : Le scope DOM d'une View est son `rootElement` en excluant les sous-arbres des slots. Valable en SSR comme en SPA.
- **C4 (I41)** : Chaque `@ui` a une source de mutation unique. Un nœud couvert par un template est mis à jour exclusivement via `template.project()`.
- **C5 (D19)** : Pas de VDOM, pas de diff d'arbre. Le framework mute chirurgicalement le DOM existant.
- **C6 (I22, D10)** : Le state d'une Entity est `JsonSerializable`. La relation namespace ↔ Feature ↔ Entity est 1:1:1.
- **C7 (D30)** : En mode SPA (élément absent), le framework PEUT créer l'élément si un descripteur objet est fourni. Ce mécanisme est le **fallback**, pas le cas nominal.
- **C8** : L'API framework reste **identique** quel que soit le mode (SSR ou SPA). Le développeur écrit le même code View/Feature — la détection est transparente.

---

## Options considérées

### Option A — Hydratation structurelle pure (setup() seul)

**Description** : Le mécanisme existant suffit. `setup()` localise les nœuds dynamiques
dans le DOM par `querySelector` dans le scope du conteneur. Pas de state sérialisé —
les Features re-fetchent leurs données au bootstrap via des Commands. Le framework
détecte le mode SSR vs SPA par la **présence ou absence** du `rootElement` dans le DOM
(logique déjà spécifiée dans §12.4 étape 5a/5b).

```
┌─────────────── SSR (cas nominal D19) ──────────────────┐
│                                                         │
│  1. Serveur rend le HTML complet (structure + contenu)  │
│  2. Client charge le bundle JS                         │
│  3. Application.start() → bootstrap                    │
│  4. Pour chaque View :                                 │
│     4a. querySelector(rootElement) → TROUVÉ → el       │
│     4b. getUI() résout les sélecteurs dans el          │
│     4c. templates.setup(container) → localise nœuds    │
│     4d. ProjectionList.setup() → map existante par     │
│         keyAttr (data-item-id / data-key)              │
│  5. Features : onAttach() → trigger Commands de fetch  │
│  6. Réponses → Entity peuplée → Events → projection   │
│     (re-projection sur DOM identique = no-op visuel)   │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────── SPA (fallback D30) ─────────────────────┐
│                                                         │
│  1. HTML minimal (<body> quasi vide)                   │
│  2. Client charge le bundle JS                         │
│  3. Application.start() → bootstrap                    │
│  4. Pour chaque View :                                 │
│     4a. querySelector(rootElement) → NON TROUVÉ        │
│     4b. rootElement est un descripteur objet → CREATE  │
│     4c. templates.create(data) → DOM complet           │
│     4d. ProjectionList crée les items via itemCreate() │
│  5. Features : idem SSR                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Détection du mode** — implicite, par nœud :

```typescript
// INTERNE FRAMEWORK — dans attachView(), déjà spécifié §12.4
const el = slot.querySelector(resolvedParams.rootElement);

if (el) {
  // ── Mode SSR : élément trouvé, on l'adopte ──
  view.el = el;
  // setup() localise les nœuds dynamiques dans le DOM existant
  view.nodes = template.setup(el);
} else if (isElementDescriptor(resolvedParams.rootElement)) {
  // ── Mode SPA : élément absent, on le crée (D30) ──
  view.el = createElement(resolvedParams.rootElement);
  slot.appendChild(view.el);
  // create() génère le DOM complet
  view.nodes = template.create(initialData);
} else {
  // ── Erreur : sélecteur string strict, élément absent ──
  throw new BonsaiError(`I31: rootElement "${resolvedParams.rootElement}" not found`);
}
```

**Hydratation des listes** — `ProjectionList.setup()` scanne les enfants existants :

```typescript
// INTERNE — dans ProjectionList constructor, mode SSR
setup(container: HTMLElement): void {
  // Scanner les enfants existants par keyAttr (data-item-id, data-key)
  for (const child of container.children) {
    const key = (child as HTMLElement).dataset[this.keyAttrName];
    if (key) {
      const itemNodes = this.options.itemSetup(child as HTMLElement);
      this.itemNodesMap.set(key, { el: child as HTMLElement, nodes: itemNodes });
    }
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Zéro concept nouveau — tout est déjà spécifié dans le corpus | - Double fetch : le serveur a les données, le client les re-demande |
| + API View identique SSR/SPA — transparence totale | - Flash potentiel : entre le bootstrap et le retour du fetch, le DOM peut être stale |
| + Aucune surface d'attaque XSS (pas de JSON inline) | - Latence perçue sur les données dynamiques (listes, compteurs) |
| + Serveur stateless — pas besoin de sérialiser l'arbre Entity | - Inefficace si le serveur avait déjà toutes les données |
| + `setup()` est O(n) avec n = nœuds `@ui` dans le scope — rapide | - Pas de garantie formelle que le DOM serveur match les sélecteurs |

---

### Option B — Hydratation avec state sérialisé

**Description** : Le serveur rend le HTML **et** sérialise l'état des Entities dans un
bloc `<script type="application/json">`. Au bootstrap, le framework désérialise cet
état et **pré-peuple** les Entities avant le `onAttach()` des Views. Résultat : pas de
fetch initial, pas de flash, la première projection est un no-op garanti (données identiques).

```html
<!-- Rendu serveur : HTML + state sérialisé -->
<div id="cart-view">
  <ul class="Cart-items">
    <li data-item-id="p1"><span class="name">Widget</span><span class="qty">3</span></li>
  </ul>
  <span class="Cart-total">42 €</span>
</div>

<!-- State sérialisé pour Bonsai -->
<script id="__BONSAI_STATE__" type="application/json">
{
  "cart": { "items": [{ "id": "p1", "name": "Widget", "quantity": 3 }], "total": 42 },
  "auth": { "user": { "name": "Alice" }, "isLoggedIn": true }
}
</script>
```

**Séquence de bootstrap modifiée** :

```
┌───────────── BOOTSTRAP (Option B) ──────────────────────┐
│                                                          │
│  1. DOM serveur existe (HTML + <script> state)           │
│  2. Framework lit #__BONSAI_STATE__ → parse JSON         │
│  3. Pour chaque namespace dans le state :                │
│     3a. Feature correspondante trouvée → Entity.hydrate  │
│     3b. Feature non trouvée → warning (mode debug)       │
│  4. Foundation/Composer crée les Views (D34)             │
│  5. Pour chaque View :                                   │
│     5a. rootElement trouvé → mode SSR (setup)            │
│     5b. Entity déjà peuplée → première projection       │
│         = no-op (DOM serveur ≡ données)                  │
│  6. Features : onAttach() → pas de fetch initial         │
│     (Entities déjà peuplées)                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**API côté Feature** — méthode `hydrate()` :

```typescript
// ── Contrat Entity : méthode d'hydratation ──

abstract class Entity<TStructure extends JsonSerializable> {
  /**
   * Peuple l'Entity depuis un state sérialisé (SSR).
   * Appelée par le framework AVANT onAttach().
   * Ne déclenche PAS de notifications (pas d'Event émis).
   * 
   * @param serializedState — state JSON depuis __BONSAI_STATE__[namespace]
   */
  hydrate(serializedState: TStructure): void {
    // Immer-based : remplace le draft complet
    this._state = serializedState;
  }
}
```

**Contrat `__BONSAI_STATE__`** :

```typescript
/**
 * Structure du bloc de state sérialisé.
 * Clé = namespace Feature (I21, I22).
 * Valeur = TEntityStructure sérialisée (D10 — JsonSerializable).
 */
type TBonsaiSerializedState = Record<string, JsonSerializable>;

// Validation au bootstrap (mode debug) :
// - Chaque clé DOIT correspondre à un namespace Feature déclaré
// - Chaque valeur DOIT être parsable en JSON valide
// - Aucune clé ne peut être 'router' (namespace réservé, I28)
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Zéro fetch initial — Entities pré-peuplées | - Surface d'attaque XSS : JSON inline dans le HTML |
| + Zéro flash — première projection = no-op garanti | - Duplication : données dans le HTML **et** dans le JSON |
| + Time-to-interactive minimal | - Taille du HTML augmente (payload JSON) |
| + Le serveur contrôle l'état initial | - Nouveau concept (`hydrate()`, `__BONSAI_STATE__`) |
| + Compatible avec le protocole existant (Entity + namespace) | - Stale data si le bloc JSON n'est pas synchronisé avec le HTML |
| | - Le serveur doit connaître la structure des Entities |

---

### Option C — Hydratation islands (progressive)

**Description** : Approche hybride inspirée d'Astro Islands. Le HTML serveur est traité
comme **100% statique par défaut**. Seules les zones déclarées dans `get templates()`
(Mode C — fragments `@ui`) sont hydratées au bootstrap. Le reste du DOM n'est **jamais**
touché par le framework. Le state peut être sérialisé **par island** (granulaire) au lieu
d'un bloc global.

```
┌──────────── Page HTML serveur ──────────────────────┐
│                                                      │
│  <header>  ← 100% statique, jamais touché            │
│  <nav>     ← 100% statique                          │
│                                                      │
│  <main id="product-view">                            │
│    <h1 class="title">Widget Pro</h1>  ← statique    │
│    ┌──────────────────────────────────┐               │
│    │ <div class="ProductView-price"> │  ← Island 1  │
│    │   42 €                          │    (Mode C)   │
│    │ </div>                          │               │
│    └──────────────────────────────────┘               │
│    ┌──────────────────────────────────┐               │
│    │ <ul class="ProductView-reviews">│  ← Island 2  │
│    │   <li data-item-id="r1">...</li>│    (Mode C)   │
│    │ </ul>                           │               │
│    └──────────────────────────────────┘               │
│    <footer> ← statique                              │
│  </main>                                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**La View ne déclare que les zones interactives** :

```typescript
class ProductView extends View<[Product.Channel, Review.Channel], TProductViewUI> {
  get params() {
    return {
      rootElement: '#product-view',
      uiElements: {
        price:   '.ProductView-price',
        reviews: '.ProductView-reviews',
        title:   '.title',            // Statique — Mode A (lecture seule)
      },
    };
  }

  get templates() {
    return {
      // Seuls price et reviews sont des islands hydratées
      price: {
        template: PriceTemplate,
        select: (data: NamespacedData) => data.product?.price,
      },
      reviews: {
        template: ReviewsTemplate,
        select: (data: NamespacedData) => data.review?.items,
      },
      // title n'a PAS de template → Mode A → getUI('title') retourne TProjectionRead
      // (lecture seule — le serveur l'a rendu, on ne le touche pas)
    };
  }
}
```

**State par island** (optionnel) :

```html
<!-- State granulaire — un bloc par island -->
<div class="ProductView-price" data-bonsai-state='{"amount":42,"currency":"EUR"}'>
  42 €
</div>
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Hydratation minimale — seules les zones interactives sont traitées | - Granularité du state plus complexe à gérer côté serveur |
| + Parfait pour Mode C (déjà spécifié dans RFC-0002) | - Ne couvre pas le Mode B (template root) |
| + Compatible avec les CMS/SSG (Markdown → HTML statique) | - Deux mécanismes de state (global vs par-island) |
| + Performance maximale — le framework ignore 80% du DOM | - Plus complexe pour le développeur serveur |
| + `data-bonsai-state` sur un élément = localité totale | - Concept `data-bonsai-state` nouveau et non standard |

---

## Analyse comparative

| Critère | Option A | Option B | Option C |
|---------|----------|----------|----------|
| **Performance** (TTI) | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Complexité framework** | ⭐⭐⭐ (rien à ajouter) | ⭐⭐ (hydrate, state block) | ⭐ (state granulaire) |
| **Complexité serveur** | ⭐⭐⭐ (rend le HTML, c'est tout) | ⭐⭐ (rend HTML + sérialise state) | ⭐ (rend HTML + state par island) |
| **DX développeur** | ⭐⭐⭐ (transparente) | ⭐⭐ (nouveau concept hydrate) | ⭐⭐ (penser en islands) |
| **Sécurité** | ⭐⭐⭐ (pas de JSON inline) | ⭐ (XSS JSON inline) | ⭐⭐ (JSON inline limité) |
| **Type-safety** | ⭐⭐⭐ (rien de nouveau) | ⭐⭐ (TBonsaiSerializedState) | ⭐ (state inline non typé) |
| **Cohérence corpus** | ⭐⭐⭐ (déjà spécifié) | ⭐⭐ (extension naturelle) | ⭐ (concepts nouveaux) |
| **Maintenabilité** | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Intégrité DOM-state** | ⭐ (non garantie) | ⭐⭐⭐ (state = source) | ⭐⭐ (partielle) |

---

## Décision

Nous choisissons **Option A — Hydratation structurelle pure** comme stratégie par défaut,
avec une **extension opt-in** inspirée de l'Option B pour les cas où le double-fetch est
inacceptable.

### Justification principale

1. **Cohérence avec le corpus existant** — L'Option A est **déjà intégralement spécifiée**
   dans RFC-0002 §12.4 (étapes 5a/5b) et RFC-0003 §5.3 (`setup()` / `create()`). Il n'y a
   **rien à inventer** — seulement à formaliser ce qui est éparpillé. Bonsai n'invente pas
   de nouveaux concepts quand les existants suffisent.

2. **Philosophie PDR** — D19 pose que *« le DOM préexiste »*. La conséquence logique :
   le DOM est la source de vérité structurelle, pas un blob JSON sérialisé. `setup()`
   **parcourt** le DOM existant et en extrait les références — c'est de l'hydratation
   par construction.

3. **Zéro surface d'attaque** — Pas de JSON inline dans le HTML = pas de vecteur XSS
   supplémentaire. Le contenu du DOM est déjà échappé par le serveur.

4. **Simplicité** — Le développeur n'a rien à apprendre de nouveau. Le même code View
   fonctionne en SSR et en SPA. Le même `get templates()` alimente `setup()` (SSR) ou
   `create()` (SPA). Le mode est détecté **par le framework, par nœud, automatiquement**.

5. **Le « double-fetch » est un faux problème dans 90% des cas** — La première projection
   après le fetch est un no-op visuel si les données n'ont pas changé côté serveur (ce qui
   est le cas nominal : le HTML a été rendu il y a quelques millisecondes). Le framework
   compare via `shallowEqual` avant de muter (RFC-0003 §7.5) — zéro mutation DOM inutile.

### Extension opt-in : `TBootstrapOptions.serverState`

Pour les cas où le double-fetch est inacceptable (données coûteuses à re-charger, latence
réseau élevée, offline-first), une **extension opt-in** est prévue :

```typescript
// ── Dans Application.start() ──

interface TBootstrapOptions {
  /** Activer la validation des déclarations au bootstrap (défaut : true) */
  validateAtBootstrap: boolean;

  /**
   * State initial sérialisé par le serveur.
   * Clé = namespace Feature (I21, I22).
   * Valeur = TEntityStructure sérialisée (D10 — JsonSerializable).
   *
   * Si fourni, le framework pré-peuple les Entities AVANT onAttach().
   * Aucun Event n'est émis pendant l'hydratation (silent populate).
   *
   * @default undefined — les Features re-fetchent au bootstrap
   */
  serverState?: Record<string, JsonSerializable>;
}

// ── Usage côté développeur ──

const app = new Application({ features: [CartFeature, AuthFeature] });

// Option A pure — pas de serverState
app.start();

// Avec serverState opt-in — le serveur fournit le state
app.start({
  serverState: JSON.parse(
    document.getElementById('__BONSAI_STATE__')?.textContent ?? '{}'
  ),
});
```

**Contrat de `serverState`** :

```typescript
// Le framework itère sur serverState et peuple les Entities :
for (const [namespace, state] of Object.entries(serverState)) {
  const feature = featureRegistry.get(namespace);
  if (!feature) {
    // Mode debug : warning — namespace inconnu ignoré
    console.warn(`[Bonsai] serverState: unknown namespace "${namespace}", ignored`);
    continue;
  }
  // Peuplement silencieux — pas de notifications, pas d'Events
  feature.entity.populateFromServer(state as TEntityStructure);
}
// PUIS : bootstrap normal (attachView, onAttach, etc.)
```

> **Note architecturale** : `serverState` vit dans `TBootstrapOptions`, **pas** dans le
> DOM (`<script>` inline). C'est le **développeur** qui décide comment l'injecter (JSON
> inline, fetch, localStorage, etc.). Le framework ne lit jamais le DOM pour trouver du
> state — cohérent avec I39 (accès DOM via getUI uniquement, pas de querySelector ad hoc).

### Rejet de l'Option B (state sérialisé obligatoire)

- Le framework lirait du JSON dans le DOM de manière ad hoc → violation de l'esprit de I39
- Introduit un couplage serveur ↔ structure Entity que D19 évite délibérément
- Surface XSS supplémentaire sans bénéfice proportionnel
- Le `serverState` opt-in dans `TBootstrapOptions` offre le même bénéfice sans les inconvénients

### Rejet de l'Option C (islands progressive)

- Complexité excessive pour un gain marginal : le Mode C **est déjà** une forme d'islands (seuls les `@ui` avec template sont réactifs, le reste est statique)
- `data-bonsai-state` par élément crée un couplage HTML ↔ TypeScript non typé
- L'approche n'apporte rien au-delà de ce que Mode C + Option A fournissent déjà

---

## Conséquences

### Positives

- ✅ **Zéro concept nouveau** pour l'Option A pure — tout est déjà spécifié, il suffit de formaliser
- ✅ **API identique SSR/SPA** — le développeur écrit le même code, le framework détecte le mode par nœud
- ✅ **`serverState` opt-in** — les cas avancés sont couverts sans complexifier le cas nominal
- ✅ **`setup()` est l'hydratation** — pas de phase « hydration » séparée, c'est le bootstrap normal
- ✅ **`create()` est le fallback SPA** — pas de mode « SPA » séparé, c'est la même séquence avec un branchement
- ✅ **`ProjectionList.setup()`** mappe les items existants par `keyAttr` — l'hydratation des listes est déjà spécifiée

### Négatives (acceptées)

- ⚠️ **Double-fetch en Option A pure** — les Features re-demandent les données au bootstrap. Accepté car : (a) la première projection est un no-op visuel (`shallowEqual`), (b) le `serverState` opt-in couvre les cas critiques, (c) le serveur peut être un cache local (Service Worker)
- ⚠️ **Pas de garantie formelle DOM ↔ sélecteurs** — si le HTML serveur ne correspond pas aux sélecteurs `uiElements`, l'erreur est runtime (I31). Accepté car : (a) c'est un bug serveur, pas un problème framework, (b) le mode debug valide les sélecteurs au bootstrap

### Risques identifiés

- 🔶 **Incohérence DOM serveur / sélecteurs View** — mitigation : validation au bootstrap (mode debug) + tests E2E serveur/client
- 🔶 **Stale data entre SSR et premier fetch** — mitigation : `shallowEqual` empêche toute mutation DOM inutile ; si les données ont changé, la projection met à jour immédiatement
- 🔶 **`serverState` mal typé** — mitigation : validation runtime en mode debug (chaque namespace doit correspondre à une Feature déclarée, I21/I22)

---

## Formalisation : contrat d'hydratation unifié

### Règle H1 — Détection du mode par nœud

Le framework détecte le mode **individuellement pour chaque View**, pas globalement pour
l'application. Une même application peut avoir des Views en mode SSR et d'autres en mode
SPA simultanément.

```
querySelector(rootElement) dans le scope du slot :
  ├─ TROUVÉ     → Mode SSR : adopter l'élément, setup()
  ├─ NON TROUVÉ + descripteur objet → Mode SPA : créer, create()
  └─ NON TROUVÉ + string strict     → ERREUR (I31)
```

### Règle H2 — `setup()` est l'hydratation

La fonction `setup()` du template compilé (RFC-0003 §5.3) **est** la procédure d'hydratation.
Elle n'a pas de cas spécial SSR — elle localise toujours les nœuds dynamiques dans le
conteneur fourni, que ce conteneur vienne du serveur ou ait été créé par `create()`.

### Règle H3 — `ProjectionList` hydrate par `keyAttr`

En mode SSR, `ProjectionList` scanne les enfants existants du conteneur et les indexe
par l'attribut déclaré dans `keyAttr` (`data-item-id`, `data-key`). Les items déjà
présents dans le DOM sont adoptés — pas recréés. Les items absents du DOM mais présents
dans les données seront créés par `itemCreate()` lors du premier `reconcile()`.

### Règle H4 — Première projection = no-op visuel garanti

Si les données n'ont pas changé entre le rendu serveur et la première projection client,
le garde-fou `shallowEqual` (RFC-0003 §7.5) empêche toute mutation DOM. Le framework
ne détruit pas et ne recrée pas le DOM serveur — il le réutilise tel quel.

### Règle H5 — `serverState` est le seul mécanisme de state sérialisé

Le framework ne lit **jamais** le DOM pour en extraire du state applicatif. Si le serveur
souhaite transférer l'état des Entities, il utilise `TBootstrapOptions.serverState`.
Le framework peuple les Entities **silencieusement** (sans émettre d'Events) avant le
premier `onAttach()`.

---

## Actions de suivi

- [x] Ajouter les règles H1–H5 comme section normative dans RFC-0002 §9.4 (ou en annexe dédiée) — ✅ H1–H5 inlinées dans RFC-0003 (R11 audit)
- [x] Documenter `TBootstrapOptions.serverState` dans RFC-0002 §7.2 (API de bootstrap) — ✅ §7.1 enrichi
- [x] Ajouter `populateFromServer(state)` dans le contrat Entity (RFC-0002-entity) — ✅ §1 et §7 enrichis
- [x] Vérifier que RFC-0003 `setup()` et `create()` sont cohérents avec H1–H4 — ✅ Vérifié
- [ ] Ajouter un test E2E : bootstrap SSR (DOM pré-rendu) → hydratation → projection identique
- [ ] Ajouter un test E2E : bootstrap SPA (DOM vide) → création → projection initiale
- [ ] Envisager un futur ADR pour le rendu côté serveur (comment le serveur génère le HTML compatible Bonsai)

---

## Références

- [RFC-0002 §9.4 — Projection DOM Réactive](../rfc/6-transversal/conventions-typage.md) — D19, I31, Modes A/B/C
- [RFC-0002 §9.4.7 — Flux d'exécution complet](../rfc/6-transversal/conventions-typage.md) — Bootstrap SSR étape 1
- [RFC-0002 §12.4 — Séquence d'attachement](../rfc/6-transversal/conventions-typage.md) — Étapes 5a/5b
- [RFC-0003 §5.3 — Génération de code](../rfc/5-rendu.md) — `setup()`, `project()`, `create()`
- [RFC-0003 §6 — API ProjectionList](../rfc/5-rendu.md) — `keyAttr`, reconcile
- [RFC-0003 §7.5 — Auto-branchement](../rfc/5-rendu.md) — `shallowEqual` garde-fou
- [RFC-0001-invariants-decisions](../rfc/reference/invariants.md) — I31, I39, I40, I41, D19, D30

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-24 | Création (Proposed) — formalisation du contrat SSR éparpillé dans RFC-0002/RFC-0003 |
| 2026-03-24 | Accepté — Option A (hydratation structurelle pure) retenue |
