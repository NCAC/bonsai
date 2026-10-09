# ADR-19 — `rootElement` : sélecteur CSS fourni par le Composer

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I31, I32, I34 |
| **Livré** | ⚠️ partiel — la View résout son `rootElement` dans tout le document, pas dans le slot ; la création si absent n'existe que pour le slot du Composer ; le parseur ignore la balise et ne garde qu'une classe |
| **Spec** | [composer.md](../spec/4-couche-concrete/composer.md) · [view.md](../spec/4-couche-concrete/view.md) |

## Contexte

Une View doit savoir sur quel élément se monter. Déclaré par la View, cet
emplacement la lie à un contexte unique et entre en conflit avec le Composer
qui décide où elle va. Accepter à la fois `Element`, `string` et un descripteur
objet multiplie les chemins, et le cas SSR (élément déjà là) comme SPA (élément
à créer) doit suivre un seul algorithme.

## Décision

**Le `rootElement` est toujours un sélecteur CSS `string`, fourni exclusivement
par le Composer** dans `TResolveResult` (I31). La View ne le déclare pas.

```ts
return { view: CartView, rootElement: "aside.CartWidget[data-variant='compact']" };
```

Algorithme au montage, dans le scope du slot du Composer :

1. `querySelector(sélecteur)` trouve un élément → il est réutilisé (SSR, îlots) ;
2. sinon le framework **parse le sélecteur** et crée l'élément
   (`"form#login.Auth"` → `<form id="login" class="Auth">`) — le Composer reste
   décideur pur, il n'écrit rien.

Règles :

- La View peut altérer son `rootElement` en **N1**, jamais le détruire ni le remplacer (I32).
- Le `rootElement` est un **descendant** de `<body>`, jamais `<body>` lui-même (I34 ; vérifié au `mount()`).
- La même View se monte dans des contextes différents avec des sélecteurs différents (réutilisation, ADR-21).

## Alternatives rejetées

- **`rootElement` dans les paramètres de la View** — dualité View/Composer, défaut jamais utilisé.
- **`Element | string | descripteur { selector, tagName, attrs }`** — trois formes pour une information qu'un sélecteur encode déjà.
- **Le Composer crée l'élément** — viole I35.
- **La View crée son élément** — la View ne gère pas son cycle de vie (ADR-16).
- **Erreur stricte si absent** — interdit le mode SPA sans HTML préalable.

## Conséquences

- Un seul chemin pour SSR, SPA et hybride.
- **Écarts livrés** : `View.mount()` fait `document.querySelector(rootSelector)` — un sélecteur qui existe ailleurs dans la page est pris, et un élément absent donne `el = null` puis un `TypeError` (pas une erreur framework), au `mount()` si une clé UI déclare des événements, sinon au premier `getUI()` ; `#createElementFromSelector` crée toujours un `<div>`, garde la première classe seulement.
