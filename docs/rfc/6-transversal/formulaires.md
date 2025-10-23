# Formulaires

> **4 patterns de formulaire dans Bonsai, du simple au complexe**

[← Retour aux transversaux](../6-transversal/) · [ADR-0009 — détail complet](../../adr/ADR-0009-forms-pattern.md)

---

## Contexte

Les formulaires combinent **saisie utilisateur**, **validation**, **état transitoire** (touched, dirty, errors) et **soumission vers le domaine**. La question clé :

> **Où vit l'état du formulaire ?**

- **Pré-soumission** : état UI transitoire — ne fait pas partie du domaine
- **Post-soumission** : état métier — les valeurs validées deviennent du domain state

---

## Les 4 patterns

### Pattern A — Formulaire piloté par Entity

L'état complet (valeurs, touched, errors) vit dans une Entity dédiée.

```
View (saisie) → trigger(Command) → Feature → entity.mutate() → Event → View (projection)
```

| Avantage | Inconvénient |
|----------|-------------|
| Traçabilité complète | Cérémonie élevée (Feature + Entity + Channel par formulaire) |
| State persistable / restaurable | Chaque frappe = Command + mutate + Event |
| Validation dans la Feature | Over-engineering pour les formulaires simples |

**Quand l'utiliser** : formulaires complexes multi-étapes, formulaires dont l'état doit être partagé entre composants ou persisté.

### Pattern B — Formulaire piloté par localState (recommandé)

L'état pré-soumission vit dans le `localState` de la View (I42, D33). La soumission déclenche une Command.

```
View (saisie) → localState.mutate() → re-projection locale
View (submit) → trigger(Command) → Feature → entity.mutate()
```

| Avantage | Inconvénient |
|----------|-------------|
| Zéro cérémonie (pas de Feature/Entity pour le form) | State non partageable (strictement local) |
| Validation synchrone instantanée | Pas de persistance/restauration |
| Réactivité native via localState | |
| Soumission = un seul Command avec le payload complet | |

**Quand l'utiliser** : la majorité des formulaires (contact, login, recherche, édition inline).

### Pattern C — FormBehavior réutilisable

Un Behavior encapsule la logique de formulaire (touched, dirty, validation). Pluggable sur n'importe quelle View.

```
View + FormBehavior → Behavior gère localState form
View (submit) → trigger(Command) → Feature
```

| Avantage | Inconvénient |
|----------|-------------|
| Réutilisable entre Views | Complexité d'abstraction |
| Séparation View (rendu) / Behavior (logique form) | Le Behavior ne connaît pas la View hôte (I44) |
| DRY pour les patterns récurrents | |

**Quand l'utiliser** : quand plusieurs formulaires partagent la même logique (validation, touched tracking, dirty checking).

### Pattern D — Hybride (localState + Entity)

L'état transitoire (saisie, validation) vit dans le `localState`. Le domain state (valeurs soumises) vit dans l'Entity.

```
View (saisie) → localState → validation locale
View (submit) → trigger(Command) → Feature → entity.mutate() → Event
```

| Avantage | Inconvénient |
|----------|-------------|
| Séparation claire transitoire / domaine | Deux sources d'état à synchroniser |
| Le domain state reste propre (pas de touched/dirty) | |
| La Feature ne voit que des données validées | |

**Quand l'utiliser** : formulaires dont les données soumises alimentent un domain partagé (ex: profil utilisateur, paramètres).

---

## Arbre de décision

```
Q1 : Le state du formulaire doit-il être partagé entre composants ?
  → Oui : Pattern A (Entity)
  → Non :
    Q2 : Plusieurs formulaires partagent-ils la même logique ?
      → Oui : Pattern C (FormBehavior)
      → Non :
        Q3 : Les données soumises alimentent-elles un domain partagé ?
          → Oui : Pattern D (Hybride)
          → Non : Pattern B (localState) ✅ défaut recommandé
```

---

## Invariants respectés

| Invariant | Comment |
|-----------|---------|
| **I30** | Le domain state vit dans l'Entity, jamais dans la View |
| **I42** | Le state local pré-soumission utilise le mécanisme `localState` |
| **I6** | Seule la Feature mute l'Entity (via Command post-soumission) |
| **I44** | Le FormBehavior (Pattern C) n'accède pas à `this.view` |

---

## Référence complète

→ [ADR-0009 — Pattern Formulaires](../../adr/ADR-0009-forms-pattern.md) — exemples de code complets, analyse détaillée des 4 options, comparatif performances.
