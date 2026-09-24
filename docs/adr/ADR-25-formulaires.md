# ADR-25 — Formulaires : `localState` pendant la saisie, Command à la soumission

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⏳ strate 2 — dépend de `localState` (ADR-17) et de Behavior (ADR-21) |
| **Spec** | [FORMS-GUIDE.md](../guides/FORMS-GUIDE.md) |

## Contexte

L'état d'un formulaire change de nature en cours de route : avant la
soumission, valeurs saisies, champs touchés et erreurs sont de l'état d'UI
transitoire ; après, les valeurs validées deviennent du domain state. Le
mettre entièrement dans une Entity fait un aller-retour View → Feature → View
à chaque frappe ; le laisser entièrement dans la View ne couvre ni la
réutilisation ni les parcours en plusieurs étapes.

## Décision

**Modèle hybride (D), choisi selon le formulaire :**

| Cas | Pattern | Mécanisme |
| --- | --- | --- |
| Formulaire simple (le plus courant) | **B** | `localState` de la View (`values`, `touched`, `errors`) ; validation synchrone locale ; **une Command** à la soumission |
| Formulaire réutilisé sur plusieurs Views | **C** | **FormBehavior** qui encapsule saisie et validation ; l'hôte ne voit que le résultat |
| Parcours multi-étapes | **D** | `localState` par étape ; chaque étape validée est une Command qui persiste dans l'Entity (retour arrière, DevTools) |

```ts
onSubmitBtnClick() {
  const { values, errors } = this.local;
  if (Object.keys(errors).length === 0)
    this.trigger("user:updateProfile", values);   // le domaine ne voit que le résultat validé
}
```

- La validation différée (unicité d'un email…) : debounce dans la View, puis Request **synchrone** vers la Feature qui tient la donnée en mémoire (ADR-02).
- La validation métier définitive reste dans la Feature et le schema de l'Entity (ADR-11) ; la validation locale sert le retour immédiat.
- Aucune dépendance externe (pas de bibliothèque de formulaires).

## Alternatives rejetées

- **A — Tout dans l'Entity** — traite `touched`/`errors` comme du domain state (I30), aller-retour à chaque frappe.
- **B seul** (`localState` partout) — pas de réutilisation, pas de parcours multi-étapes persistant.
- **C seul** (FormBehavior systématique) — structure superflue pour un formulaire affiché une fois.

## Conséquences

- Aucun invariant nouveau : le modèle s'appuie sur I30, I39, I41, I42, I43, I44, I54.
- Les exemples de `FORMS-GUIDE.md` illustrent la cible et ne sont pas exécutables tant que `localState` et Behavior ne sont pas livrés.
