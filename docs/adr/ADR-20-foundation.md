# ADR-20 — Foundation : `<body>`, `Record` stable, N1 seul

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I33, I67 |
| **Livré** | ⚠️ partiel — la restriction N1 sur `<html>`/`<body>` n'est pas imposée (getters bruts) ; `onDetach()` jamais appelé (pas de shutdown) ; I67 non cité par un test |
| **Spec** | [foundation.md](../spec/4-couche-concrete/foundation.md) |

## Contexte

Aucune View ne peut viser `<body>` (I34) : il faut pourtant un composant qui
couvre `<html>`/`<body>` (classes de thème, écouteurs globaux) et qui pose les
premiers Composers. Plusieurs racines ou pas de racine laissent un trou de
couverture DOM ; une racine dynamique déplace la composition au mauvais endroit.

## Décision

**Une Foundation unique par application** (I33), montée par `Application.start()`
en dernière phase (ADR-07). Elle cible `<body>` et déclare ses Composers racines :

```ts
class AppFoundation extends Foundation {
  get composers() {
    return { "#header": HeaderComposer, "#main": MainComposer } as const;
  }
  onAttach() { this.body.dataset.theme = "light"; }   // N1 uniquement
}
```

1. **`get composers(): Readonly<Record<string, typeof Composer>>`** — clés = sélecteurs CSS dans `<body>`, valeurs = classes Composer. Évalué **une seule fois**, attaché dans l'ordre des clés.
2. **Structurellement stable** (I67) : 3 à 5 zones persistantes. Le dynamisme est délégué à une View qui compose elle-même (`View.composers`, ADR-18).
3. **Droits N1 seulement** sur `<html>` et `<body>` (classes, attributs) ; aucune View n'y a accès.
4. Hooks `onAttach()` / `onDetach()` pour brancher et débrancher les écouteurs globaux.

## Alternatives rejetées

- **Plusieurs racines, ou pas de racine** — trou de couverture de `<html>`/`<body>`.
- **Foundation avec droits N2/N3** — ferait d'elle une View géante.
- **Clés de `composers` arbitraires** — le sélecteur est l'information utile.
- **`Array<{ selector, composer }>`** — suggère un dynamisme inexistant, doublons non détectés (un `Record` littéral lève TS1117).
- **`Map`** — verbeux, sans gain compile-time.

## Conséquences

- La mise en page de premier niveau se lit d'un coup d'œil dans `get composers()`.
- `attach()` appelé deux fois lève une erreur ; l'unicité inter-instances repose sur l'Application.
- **Écarts livrés** : `html`/`body` sont des `HTMLElement` bruts (`protected`), N1 tenu par convention ; `onDetach()` n'a pas d'appelant tant que le shutdown n'existe pas.
