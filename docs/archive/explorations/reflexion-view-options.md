# Réflexion sur les View options et la réutilisabilité

## Problème 1 — Les Views ne sont pas réutilisables

Dans le design initial, `rootElement` et `uiElements` sont des **abstract getters** sur la classe View. Cela signifie que chaque sous-classe encode en dur ses sélecteurs DOM :

```typescript
class AccountView extends View {
  get rootElement() { return '#account'; }
  get uiElements() { return { submitBtn: '.btn-submit' }; }
}
```

Si un Composer veut utiliser la même `AccountView` dans un contexte différent (autre sélecteur root, autre structure DOM), c'est impossible sans créer une sous-classe — ce qui tue la réutilisabilité.

**Constat** : la View connaît trop son DOM hôte. Elle devrait déclarer ses **besoins** (quels éléments, quels types) et laisser le **Composer** fournir le contexte concret.

## Problème 2 — TUIMap sur-contraint avec `sel`

Le type `TUIMap` original portait un champ `sel: string` (le sélecteur CSS) dans le contrat de type :

```typescript
type TUIMap = {
  submitBtn: { sel: '.btn-submit'; event: ['click'] };
};
```

Problèmes :
- Le sélecteur CSS est une **valeur runtime** encodée dans le **type compile-time** — mélange de niveaux d'abstraction
- Les handlers `onXXXEvent(e)` n'ont aucune information sur le **type d'élément HTML** sous-jacent — `e.currentTarget` est `Element`
- Le Composer ne peut pas substituer les sélecteurs puisqu'ils font partie du type

**Constat** : TUIMap devrait porter le **type d'élément HTML** (`HTMLButtonElement`, `HTMLInputElement`…) plutôt que le sélecteur CSS. Les sélecteurs concrets appartiennent aux **params**.

## Solutions envisagées

### Pour le problème 1

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Options constructeur (passage par le constructeur) | `new AccountView({ rootElement: '#account' })` | Trop lié à l'instanciation, self-referencing generics complexes |
| B. Abstract `get params()` + Composer `options` | La View déclare ses défauts, le Composer peut overrider | ✅ Retenu |
| C. Factory function | `createView(AccountView, { rootElement: '#alt' })` | Perd l'héritage de classe |

### Pour le problème 2

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Garder `sel` dans TUIMap | Statu quo | ❌ Mélange niveaux |
| B. Remplacer `sel` par `el` (HTMLElement type) | TUIMap porte le type d'élément, sélecteur libre dans params | ✅ Retenu |

## Décisions de nommage

- **`params`** = identité de la View (abstract, requis) — `rootElement`, `uiElements`, config custom
- **`options`** = surcharges Composer (optionnel) — `Partial<TParams>`
- Le framework fait un **shallow merge** : `resolvedParams = { ...view.params, ...composerOptions }`
- Les valeurs de params/options sont des **primitives uniquement** (string, boolean, number)

## Bonus — TUIEventFor helper

Avec `el` dans TUIMap, on peut inférer `currentTarget` dans les handlers :

```typescript
type TUIEventFor<TUI, K extends keyof TUI, E extends string> =
  HTMLElementEventMap[E] & { currentTarget: TUI[K]['el'] };
```

Ainsi `onSubmitBtnClick(e)` a automatiquement `e.currentTarget: HTMLButtonElement`.

---

## Conclusion — Décisions D34 et D35 (2025-03-23)

Cette réflexion a abouti aux **décisions D34** et **D35**, formalisées dans les RFCs.

### D34 — View params + Composer options (réutilisabilité)

La View déclare un `abstract get params(): TParams` contenant son identité (rootElement, uiElements, config custom). Le Composer peut fournir un objet `options?: Partial<TParams>` via `resolve()`. Le framework fait un shallow merge au moment de l'attachement :

```typescript
protected readonly resolvedParams: TParams = { ...this.params, ...composerOptions };
```

**Conséquences** :
- `rootElement` et `uiElements` ne sont plus des abstract getters séparés — ils vivent dans `params`
- Une même classe View peut être réutilisée dans différents contextes DOM
- Le contrat de type `TParams extends TViewParams<TUI>` garantit la présence de `rootElement` et `uiElements`
- Le self-referencing generic du prototype antérieur (`TViewParams<V, {…}>`) est remplacé par le type `this` natif de TypeScript

### D35 — TUIMap porte le type d'élément HTML (pas le sélecteur)

`TUIMap` utilise `el: HTMLButtonElement` au lieu de `sel: '.btn-submit'`. Le sélecteur CSS, valeur runtime, est libre dans `params.uiElements` (type `Record<keyof TUI, string>`).

**Conséquences** :
- Les handlers typent automatiquement `currentTarget` grâce à `TUIEventFor<TUI, K, E>`
- Le Composer peut substituer les sélecteurs via `options.uiElements` sans toucher au type
- `getUI(key)` retourne un `TProjectionNode<TUI[K]['el']>` correctement typé

### Références

- [RFC-0001-invariants-decisions.md](../rfc/RFC-0001-invariants-decisions.md) — D34, D35, compteurs D1-D35
- [RFC-0001-architecture-fondamentale.md](../rfc/RFC-0001-architecture-fondamentale.md) — liens mis à jour
- [RFC-0002-api-contrats-typage.md](../rfc/RFC-0002-api-contrats-typage.md) — §9.1, §9.4.2, §9.4.5, §9.4.6, §9.4.7, §12.1-§12.4, §20, glossaire
