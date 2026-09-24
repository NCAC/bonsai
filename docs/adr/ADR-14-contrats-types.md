# ADR-14 — Contrats typés : `TChannelDefinition`, Feature unité publique, contrat consommateur modulaire

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I73, I74, I75, I76, I77, I78, I79, I80, I81, I82, I83, I87, I88 |
| **Livré** | ⚠️ partiel — noms de `TFeatureContract` non vérifiés contre le Channel (voir Conséquences) ; I75 sans lint ; pattern appliqué à View seule (Composer, Behavior ⏳) ; override `uiElements` par le Composer ⏳ |
| **Spec** | [communication.md](../spec/2-architecture/communication.md) · [view.md](../spec/4-couche-concrete/view.md) · [conventions-typage.md](../spec/6-transversal/conventions-typage.md) |

## Contexte

« Le type EST le contrat » : un nom de message mal orthographié, un payload
faux ou un handler oublié doivent échouer à la compilation. Il faut aussi
qu'un composant puisse référencer le Channel d'un autre sans instance, sans
Radio public (ADR-01) et sans écrire deux fois la même information (type + valeur).

## Décision

**1. Définition et token, co-localisés dans `namespace.feature.ts`** (I73, I74) :

```ts
type TCartDef = {
  commands: { addItem: { productId: string } };
  events:   { itemAdded: { productId: string } };
  requests: { total: { params: void; result: number } };
};
class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
}
```

`TChannelToken` porte le namespace au runtime et `TDef` en champ fantôme.
`Channel<TDef>` n'accepte que `keyof TDef[lane]` (I76) ; `Feature.request()`
prend un token typé, jamais une string (I79).

**2. La Feature est l'unité publique** (I80) : un consommateur référence
`typeof CartFeature`, jamais un token ni un Channel (`@bonsai/core` n'exporte pas `Channel`).

**3. Contrat consommateur modulaire, value-first** (I81, I83, I87) : la valeur
`as const satisfies` est la source, le type en est dérivé par `typeof`.

```ts
const features = {
  cart: {                                       // Feature-groupé, clé ≡ namespace
    feature:  CartFeature,
    listens:  ["itemAdded"] as const,
    triggers: ["addItem"]   as const,
    requests: []            as const,
  },
} satisfies TFeatureContract;
type TVC = TViewContract<typeof features, typeof uiEvents>;   // uiEvents : ADR-15

class CartView extends View<TVC> implements TViewCallbacks<TVC> {
  get features()   { return features; }        // lus une seule fois au mount
  get uiEvents()   { return uiEvents; }
  get uiElements() { return uiElements; }
  onCartItemAddedEvent(p: { productId: string }) { … }
}
```

`View.trigger("cart:addItem", …)`, `request("ns:req", …)` et `getUI(key)` sont
contraints par ce contrat (I77, I78).

**4. Symétrie Contract/Callbacks** (I82, I88) : tout `T{X}Contract` a son
`T{X}Callbacks` qui dérive les handlers `on*` requis ; un composant concret écrit
toujours la paire `extends X<…>` + `implements T{X}Callbacks<…>`. Côté Feature :
`TFeatureCallbacks<TDef, TListens>` (ADR-09). La View double le contrôle d'un
filet runtime au `mount()` (handler absent → erreur).

## Alternatives rejetées

- **Méthodes génériques libres** (`trigger<T>(name: string, p: T)`) — les noms restent des strings, les fautes de frappe passent.
- **`Channel<TDef>` sans token** — laisse `request()` inter-Features et `View.trigger()` non typés.
- **Token directement dans les consommateurs** (`listen: [Cart.channel]`) — expose le Channel, casse l'encapsulation de la Feature.
- **Contrat groupé par lane** (`{ listen: [...], trigger: [...] }`) — disperse ce qui appartient à une même Feature, multiplie génériques et clauses `implements`.
- **`static readonly` / `abstract readonly` séparés** — pas d'`abstract static` en TS (oubli silencieux) ; fields dispersés, pas de manifeste lisible.
- **Type d'abord, valeur ensuite** — double saisie de la même information.
- **Wrapper `namespace Cart { … }` + `declareChannel()`** — remplacé par le token statique.

## Conséquences

- Une seule déclaration par Feature (`TDef`) ; l'inférence fait le reste chez les consommateurs.
- **Trou connu** : `TFeatureContract` type `listens`/`triggers`/`requests` en `readonly string[]`. Une faute de frappe dans `listens` compile (le handler reçoit `never`, toute signature passe) et échoue en silence au runtime (`Channel.listen` crée le sujet). Dans `triggers`/`requests`, elle n'est détectée qu'à l'appel (payload `never`). Une clé ≠ namespace (I87) n'est rejetée qu'à l'usage.
- La couverture des handlers Feature est compile-time seulement (ADR-09) ; celle de la View a en plus un filet runtime.
- **Écart livré — configuration TypeScript** : aucun `tsconfig` du dépôt n'active `strict`. Sous `strictFunctionTypes`, `Feature<TEntity extends Entity<TJsonSerializable>, …>` rejette toute Entity concrète (variance de `#listeners`) : le contrat compile aujourd'hui uniquement sans `strictFunctionTypes`, y compris la fixture de la gate E2E (le dépôt compile en revanche sous `strictNullChecks`).
- Le suffixe `Event` des handlers de Channel évite la collision avec les handlers DOM `on{Key}{DomEvent}` (ADR-15).
