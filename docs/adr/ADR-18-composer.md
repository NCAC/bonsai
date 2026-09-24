# ADR-18 — Composer : décideur pur, `resolve(event)`, N instances

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I20, I35, I36, I37 |
| **Livré** | ⚠️ partiel — `resolve()` rend 0 ou 1 View (N instances ⏳) ; pas de `listen`/`request` : rien ne déclenche un re-resolve en application ; `event` typé `unknown` (`TComposerEvent` ⏳) ; la View remplacée n'est pas détruite |
| **Spec** | [composer.md](../spec/4-couche-concrete/composer.md) |

## Contexte

Quelqu'un doit décider **quelle** View afficher **où**, et changer d'avis quand
l'application évolue. Si la View parente décide, rendu et orchestration se
mélangent ; si l'Application décide, la configuration devient centrale et
rigide. Le décideur ne doit ni posséder de DOM ni accumuler d'état.

## Décision

**Le Composer est un décideur pur** attaché à un slot immuable :
`Composer = slot + resolve(event) → décision`.

```ts
class MainComposer extends Composer {
  resolve(event: TComposerEvent<…> | null): TResolveResult | null {
    if (event?.name === "router:routeChanged" && event.payload.page === "cart")
      return { view: CartView, rootElement: ".Cart-root" };
    return { view: HomeView, rootElement: ".Home-root" };
  }
}
```

1. **Seuls Foundation et Composers créent, remplacent ou détruisent des Views** (I20) ; la View ne compose jamais (I36), elle déclare des slots via `get composers()`.
2. **`resolve(event)` est l'unique méthode abstraite** : appelée avec `null` au montage, puis avec l'Event reçu sur ses Channels déclarés (`listen`, `request` en lecture). Pas de handlers `onXxx`, pas de state local, pas de hook `onMount`/`onUnmount`.
3. **Aucune écriture DOM** (I35) ; lecture du scope autorisée pour choisir un `rootElement`.
4. **Diff par le framework** : même View + même `rootElement` → instance conservée ; sinon détache puis attache ; `null` → vide le slot.
5. **Un seul type de Composer, 0/N Views hétérogènes** (I37) : `resolve()` peut rendre un tableau ; la multiplicité des slots suit `querySelectorAll` sur `uiElements`.

## Alternatives rejetées

- **La View parente décide** — mélange rendu et composition.
- **Configuration de composition dans l'Application** — centralisation rigide.
- **Composer avec droits d'écriture DOM** — deux producteurs de DOM.
- **Handlers `onXxxEvent` + pseudo-state local** — magie et état dupliqué pour une décision qu'on peut recalculer.
- **`resolve(event, previous)`** — invite à patcher la décision précédente ; le diff appartient au framework.
- **Hooks `onMount`/`onUnmount`** — aucun cas d'usage, invitation aux side-effects.
- **`CollectionComposer` distinct** — un type de plus pour ce que `TResolveResult[]` couvre.

## Conséquences

- C'est le composant le plus simple à tester : une fonction pure `event → décision`.
- **Écarts livrés** : sans Channels, `performResolve(event)` n'est appelé que par les tests ; `#detachCurrent()` oublie la référence sans démonter la View ni retirer ses listeners (fuite déjà signalée par ADR-03).
- Les listes homogènes de données relèvent de `ProjectionList` (ADR-23), pas du Composer.
