# State : encapsulation et ownership

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lot M6, 4 novembre 2026).** En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Entity comme seule forme d'état du domaine, détenue par le noyau, ownership strict, store logique distribué**

[← Retour à l'architecture](README.md) · [← Communication](communication.md)

---

## 1. Encapsulation de l'Entity (I6, I17)

L'Entity est le **seul conteneur d'état du domaine** dans Bonsai. Chaque Feature possède exactement une Entity (I22). L'état est **détenu par le noyau** (`Root`, théorie §13) : la Feature le lit et le mute depuis ses handlers, rien d'autre n'y accède.

### Cinq propriétés fondamentales

| # | Propriété | Invariant | Conséquence |
| --- | --- | --- | --- |
| 1 | **JsonSerializable** | I46, ADR-10 | L'état peut être capturé par copie (G2), sérialisé, snapshotté. Pas de `Date`, `Map`, `Set`, `class` |
| 2 | **Modifiable par intention seulement** | I97, ADR-10 | Toute modification passe par `ctx.mutate(intent, recipe)` dans un handler de la Feature ; l'état exposé est gelé |
| 3 | **Propriété exclusive de la Feature** | I6 | `this.entity.state` n'est lisible que pendant un handler de la Feature propriétaire ; hors handler, la lecture est refusée. Les autres composants l'observent par une Query (I17) |
| 4 | **Notificante** | I96, I97 | Chaque mutation effective produit patches et `changedKeys`, puis une notification différée (`on<Key>EntityUpdated`, `onAnyEntityUpdated`) |
| 5 | **Transactionnelle** | G7, A4.a | La mutation est journalisée dans l'unité de validation : si l'unité échoue (handler qui lève, invariant violé en fin d'unité), l'état revient exactement à ce qu'il était |

Le type de la structure est le générique `TStructure extends TJsonSerializable` de `Entity<TStructure>` : le type est le contrat.

---

## 2. Matrice d'ownership

| Composant | Lit l'état ? | Modifie l'état ? | Accès à l'Entity ? |
| --- | --- | --- | --- |
| **Feature** | ✅ `this.entity.state`, dans un handler | ✅ `ctx.mutate(intent, recipe)`, dans un handler de Command ou de notification | ✅ propriétaire |
| **View** | ✅ indirectement, `ctx.query("ns:name", params)` | ❌ jamais | ❌ |
| **Composer** | ✅ indirectement, `ctx.query(…)` dans `resolve(ctx)` | ❌ | ❌ |
| **Foundation** | ❌ (pas de Channel ni de Query, V1) | ❌ | ❌ |
| **Behavior** | ⏳ strate 2 : par la View qui le porte | ❌ | ❌ |

Un handler de Query de la Feature reçoit un contexte en lecture seule (`TFeatureQueryContext`) : il lit son Entity et peut interroger d'autres Features, mais une mutation y est refusée (A3.g, 16.2).

> **Mécanisme d'accès indirect** : la View qui a besoin d'une donnée appelle
> `ctx.query("cart:total", null)`. Le noyau délivre la Query, de manière
> synchrone, au handler `onTotalQuery` de la Feature propriétaire, qui
> consulte son Entity et retourne la valeur. La valeur est capturée par copie
> (G2) : la View ne reçoit jamais de référence vers l'état. Une Query en échec
> fait échouer l'unité de l'auteur (G7, ADR-02) ; il n'y a pas de `null` de
> substitution.

---

## 3. Store logique distribué

Bonsai n'a **pas de store global** (conséquence de I21/I22 : un namespace = une Feature = une Entity). L'état de l'application est la **somme logique** des Entities, toutes détenues par la racine du noyau de l'Application :

```text
Application State = ∑(Feature.Entity)

cart.entity      →  { items: [...], couponCode: null }
user.entity      →  { name: "Alice", preferences: {...} }
inventory.entity →  { products: [{ id: "p1", stock: 4 }, ...] }   // pas de Map (ADR-10, §1)
```

Deux Applications ont deux racines : leurs états ne se voient pas (G6).

### Relation 1:1:1

| Concept | Règle | Invariant |
| --- | --- | --- |
| Un namespace | = une Feature | I21 |
| Une Feature | = une Entity | I22 |
| Donc : un namespace | = une Entity | Transitif |

> **Pas d'état partagé** : si deux Features ont besoin de la même donnée,
> l'une **possède** la donnée (source de vérité) et l'autre l'interroge par
> une Query déclarée dans `get queries()` (lecture cross-domain, ADR-01).

### Avantages du store distribué

- **Isolation** : un bug dans `cart.entity` ne corrompt pas `user.entity`
- **Testabilité** : chaque Feature se teste avec son Entity, sans mock global
- **Retour arrière** : l'échec d'une unité ne défait que ce que l'unité a journalisé (G7)
- **Sérialisation** : snapshot/restore par namespace, pas monolithique (⏳ SSR, strate 2)

---

## Lecture suivante

→ [Cycle de vie](lifecycle.md) — persistants vs éphémères, création et destruction par le noyau
