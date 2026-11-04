# ADR-18 — Composer : décideur pur, `resolve(ctx)`, composition par clé

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I20, I35, I36, I37 |
| **Livré** | ✅ `resolve(ctx)`, réconciliation par clé, composition imbriquée, cascade de destruction (lot M6.2) · ⚠️ une View dont l'élément n'a pas pu être créé reste vivante ; `params` non typés par la View visée |
| **Spec** | [composer.md](../spec/4-couche-concrete/composer.md) · théorie D11, D12 |

## Contexte

Quelqu'un doit décider **quelles** Views afficher **où**, et changer d'avis quand
l'application évolue. Si la View parente décide, rendu et orchestration se
mélangent ; si l'Application décide, la configuration devient centrale et
rigide. Le décideur ne doit ni posséder de présentation ni accumuler d'état.

## Décision

**Le Composer est un décideur pur** attaché au contenu d'un slot que son parent
(Foundation ou View) lui attribue : `Composer = catalogue de Views + resolve(ctx)`.

```ts
class MainComposer extends Composer<TMainContract> {
  get features() { return mainFeatures; }   // listens + queries, pas de triggers (D12)
  get views()    { return mainViews; }      // catalogue fini : { cart: CartView, product: ProductView }
  resolve(ctx: TComposeContext<TMainContract>): TComposition<TMainContract> {
    const route = ctx.query("router:currentRoute", null);
    return route.path === "/cart" ? [{ view: "cart", key: "cart" }] : [];
  }
}
```

1. **Seuls Foundation et Composers créent, remplacent ou détruisent** (I20) : la Foundation et la View créent des Composers, le Composer crée des Views ; une View ne compose jamais de View (I36, D11).
2. **`resolve(ctx)` est l'unique décision** : calculée à l'initialisation puis à chaque Event déclaré, à partir des seules Queries. Elle rend la composition ordonnée `{ view, key, params? }[]`, jamais l'Event déclencheur.
3. **Aucune présentation** (I35, précisé par D12) : il ne modifie son contenu que pour attribuer ou restituer les parts de ses Views ; il n'adresse aucune Command et n'émet rien.
4. **Réconciliation par le framework, par clé** : même clé et même View → instance conservée ; sinon création ou destruction ; l'ordre suit la composition. Tout cela appartient à l'unité qui la produit (G7).
5. **Un seul type de Composer, 0..N Views hétérogènes** (I37) ; détruire une View détruit ses descendants de bas en haut et restitue sa part.

## Alternatives rejetées

- **La View parente décide** — mélange rendu et composition.
- **Configuration de composition dans l'Application** — centralisation rigide.
- **`resolve(event)` avec l'Event déclencheur** (strate 0) — invite à décider sur un message plutôt que sur l'état ; la Query relit l'état validé.
- **Handlers `onXxxEvent`, état local, hooks `onMount`/`onUnmount`** — magie et état dupliqué pour une décision qu'on peut recalculer.
- **`rootElement` choisi par le Composer** — la part est attribuée par le slot ; le noyau crée l'élément (ADR-19).
- **`CollectionComposer` distinct** — un type de plus pour ce qu'une composition ordonnée couvre.

## Conséquences

- C'est le composant le plus simple à tester : une fonction pure des Queries vers une composition.
- Les listes homogènes de données relèvent de `ProjectionList` (ADR-23), pas du Composer.
- Retirer une View dont l'élément n'a pas pu être créé se décide par un nouveau message, à partir du résultat corrélé (C.3).
