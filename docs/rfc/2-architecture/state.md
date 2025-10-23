# State : encapsulation et ownership

> **Entity comme seule forme de state, ownership strict, store logique distribué**

[← Retour à l'architecture](README.md) · [← Communication](communication.md)

---

## 1. Encapsulation de l'Entity (I5, I6, I17)

L'Entity est le **seul conteneur de state** dans Bonsai. Chaque Feature possède exactement une Entity (I22). Aucun autre composant ne peut posséder ou modifier directement du state.

### Cinq propriétés fondamentales

| # | Propriété | Invariant | Conséquence |
|---|-----------|-----------|-------------|
| 1 | **JsonSerializable** | D10 | Le state peut être sérialisé, snapshotté, transmis SSR. Pas de `Date`, `Map`, `Set`, `class` dans le state |
| 2 | **Immuable en surface** | I5 | Toute modification passe par `mutate()` (ADR-0001). Pas d'affectation directe |
| 3 | **Propriété exclusive de la Feature** | I6, I17 | Seule la Feature propriétaire accède à son Entity. Views/Behaviors n'y touchent jamais |
| 4 | **Notificante** | D16 (supersédé ADR-0001) | Chaque `mutate()` produit des patches et des `changedKeys` qui alimentent le cycle réactif |
| 5 | **Typée statiquement** | D10 | La structure est un `TEntityStructure extends TJsonSerializable` — le type EST le contrat |

---

## 2. Matrice d'ownership

| Composant | Lit le state ? | Modifie le state ? | Accès Entity ? |
|-----------|---------------|-------------------|---------------|
| **Feature** | ✅ Via `this.entity.get()` | ✅ Via `this.entity.mutate()` | ✅ Directement — propriétaire |
| **View** | ✅ Indirectement via Request | ❌ Jamais | ❌ Aucun accès |
| **Behavior** | ✅ Indirectement via Request | ❌ Jamais | ❌ Aucun accès |
| **Composer** | ❌ | ❌ | ❌ |
| **Foundation** | ❌ | ❌ | ❌ |

> **Mécanisme d'accès indirect** :
> la View qui a besoin d'une donnée utilise `request(namespace:nomQuery)`.
> La Feature propriétaire répond via un `reply` handler qui consulte
> son Entity et retourne la valeur. La View ne sait pas **où** ni **comment**
> le state est stocké.

---

## 3. Store logique distribué

Bonsai n'a **pas de store global** (D8). Le state de l'application est la **somme logique** de toutes les Entities :

```
Application State = ∑(Feature.Entity)

cart.entity      →  { items: [...], couponCode: null }
user.entity      →  { name: "Alice", preferences: {...} }
inventory.entity →  { stock: Map<string, number> }
```

### Relation 1:1:1

| Concept | Règle | Invariant |
|---------|-------|-----------|
| Un namespace | = une Feature | I21 |
| Une Feature | = une Entity | I22 |
| Donc : un namespace | = une Entity | Transitif |

> **Pas de state partagé** : si deux Features ont besoin de la même donnée,
> l'une **possède** la donnée (source de vérité) et l'autre y accède
> via Request (lecture cross-domain autorisée, D3).

### Avantages du store distribué

- **Isolation** : un bug dans `cart.entity` ne corrompt pas `user.entity`
- **Testabilité** : chaque Feature se teste avec son Entity, sans mock global
- **Sérialisation** : snapshot/restore par namespace, pas monolithique
- **SSR** : chaque Entity se (dé)sérialise indépendamment (D10)

---

## Lecture suivante

→ [Cycle de vie](lifecycle.md) — persistants vs volatils, nettoyage déterministe
