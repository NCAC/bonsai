# ADR-20 — Foundation : un élément admis, des slots stables, aucun Channel en V1

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I33, I67 |
| **Livré** | ⚠️ partiel — élément admis, slots et création des Composers livrés (lot M6.2) ; la disjonction des éléments admis par deux racines d'un même document n'est pas vérifiée ; I67 n'est cité par aucun test |
| **Spec** | [foundation.md](../spec/4-couche-concrete/foundation.md) · théorie D3, D11 |

## Contexte

Il faut un composant qui ancre l'application dans le document et pose les
premiers Composers. Plusieurs ancres pour une même racine laissent un trou de
couverture ; une ancre dynamique déplace la composition au mauvais endroit.

## Décision

**Une Foundation par racine**, donc par Application, créée par `Application.start()`
après les Features (ADR-07). Elle **admet un élément de l'hôte**, `body` par
défaut (option `anchor`), et en attribue des slots à des Composers, jamais à des
Views (D11) :

```ts
class AppFoundation extends Foundation {
  get composers() {
    return {
      header: { slot: "[data-slot='header']", composer: HeaderComposer },
      main:   { slot: "[data-slot='main']",   composer: MainComposer },
    } as const;
  }
}
```

1. **`get composers()`** — clé de slot → `{ slot, composer }` ; chaque `slot` désigne exactement un élément de l'élément admis. Lu **une seule fois**, au démarrage.
2. **Structurellement stable** (I67) : la composition de premier niveau ne change pas ; toute variation, mise en page comprise, est décidée par un Composer.
3. **Aucun Channel ni hook en V1** : elle n'écoute, ne commande et n'interroge rien ; les écouteurs globaux de l'hôte relèvent des adaptateurs (D7).
4. **Facultative** : sans Foundation, l'Application n'a pas de couche concrète (I33 suspendu).

## Alternatives rejetées

- **Plusieurs ancres pour une racine** — trou de couverture et périmètres qui se recouvrent.
- **Foundation avec template ou droits de rendu** — ferait d'elle une View géante.
- **Getters `html` / `body` et hooks `onAttach` / `onDetach`** (strate 0) — accès brut à l'hôte hors de toute part ; contraire à D3.
- **`Array<{ selector, composer }>`** — suggère un dynamisme inexistant, doublons non détectés (un `Record` littéral lève TS1117).

## Conséquences

- La mise en page de premier niveau se lit d'un coup d'œil dans `get composers()`.
- Un slot introuvable fait échouer sa seule matérialisation, rapportée dans la trace ; les autres slots sont matérialisés.
- Deux racines d'un même document doivent admettre des éléments disjoints ; la vérification au démarrage reste à livrer.
