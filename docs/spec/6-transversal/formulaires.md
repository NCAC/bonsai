# Formulaires

> 🟠 **Aligné sur la théorie V0.9.5 (4 novembre 2026) ; patterns non livrés.** Les patterns B, C et D dépendent de `localState` (ADR-17) et de Behavior (ADR-21), strate 2 ; tous attendent que la valeur d'une saisie soit capturée avec le fait du DOM (théorie C.5 ; `TFact` = `{ type, ui, data }`, où `data` ne porte encore que des attributs d'item, ADR-23). Guide pratique : [FORMS-GUIDE](../../guides/FORMS-GUIDE.md). En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **4 patterns de formulaire dans Bonsai, du simple au complexe**

[← Retour aux transversaux](../6-transversal/) · [ADR-25 — détail complet](../../adr/ADR-25-formulaires.md)

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

```text
View (fait de saisie) → ctx.trigger(Command) → Feature → ctx.mutate() → Event → View (projection)
```

| Avantage | Inconvénient |
| --- | --- |
| Traçabilité complète | Cérémonie élevée (Feature + Entity + contrat de Channel par formulaire) |
| State persistable / restaurable | Chaque frappe = Command + mutate + Event |
| Validation dans la Feature | Over-engineering pour les formulaires simples |

**Quand l'utiliser** : formulaires complexes multi-étapes, formulaires dont l'état doit être partagé entre composants ou persisté.

### Pattern B — Formulaire piloté par localState (cas simple le plus fréquent — cf. note sur la recommandation ADR-25 en fin de document)

L'état pré-soumission vit dans le `localState` de la View (I42, ADR-17). La soumission déclenche une Command.

```text
View (fait de saisie) → updateLocal() → re-projection locale
View (fait submit) → ctx.trigger(Command) → Feature → ctx.mutate()
```

| Avantage | Inconvénient |
| --- | --- |
| Zéro cérémonie (pas de Feature/Entity pour le form) | State non partageable (strictement local) |
| Validation synchrone instantanée | Pas de persistance/restauration |
| Réactivité native via localState | |
| Soumission = un seul Command avec le payload complet | |

**Quand l'utiliser** : la majorité des formulaires (contact, login, recherche, édition inline).

### Pattern C — FormBehavior réutilisable

Un Behavior encapsule la logique de formulaire (touched, dirty, validation). Pluggable sur n'importe quelle View.

```text
View + FormBehavior → Behavior gère l'état local du formulaire
View (fait submit) → ctx.trigger(Command) → Feature
```

| Avantage | Inconvénient |
| --- | --- |
| Réutilisable entre Views | Complexité d'abstraction |
| Séparation View (rendu) / Behavior (logique form) | Le Behavior ne connaît pas la View hôte (I44) |
| DRY pour les patterns récurrents | |

**Quand l'utiliser** : quand plusieurs formulaires partagent la même logique (validation, touched tracking, dirty checking).

### Pattern D — Hybride (localState + Entity)

L'état transitoire (saisie, validation) vit dans le `localState`. Le domain state (valeurs soumises) vit dans l'Entity.

```text
View (fait de saisie) → localState → validation locale
View (fait submit) → ctx.trigger(Command) → Feature → ctx.mutate() → Event
```

| Avantage | Inconvénient |
| --- | --- |
| Séparation claire transitoire / domaine | Deux sources d'état à synchroniser |
| Le domain state reste propre (pas de touched/dirty) | |
| La Feature ne voit que des données validées | |

**Quand l'utiliser** : formulaires dont les données soumises alimentent un domain partagé (ex: profil utilisateur, paramètres).

---

## Arbre de décision

```text
Q1 : Le state du formulaire doit-il être partagé entre composants ?
  → Oui : Pattern A (Entity)
  → Non :
    Q2 : Plusieurs formulaires partagent-ils la même logique ?
      → Oui : Pattern C (FormBehavior)
      → Non :
        Q3 : Les données soumises alimentent-elles un domain partagé ?
          → Oui : Pattern D (Hybride)
          → Non : Pattern B (localState) — cas simple, le plus fréquent
```

> **Recommandation ADR-25 : Option D**, pas B. L'arbre ci-dessus décide _quel
> mécanisme_ utiliser cas par cas, mais la décision de l'ADR est que
> l'**approche globale recommandée est le Pattern D** : une combinaison
> contextuelle où le Pattern B gère les formulaires simples, le Pattern C les
> formulaires réutilisables, et l'Entity + localState par étape les wizards —
> **le Pattern A pur est explicitement rejeté** (traite `touched`/`errors`
> comme du domain state, viole l'esprit de I30). Pattern B seul (sans jamais
> passer par C ou l'Entity) reste un choix légitime pour une application qui
> n'a que des formulaires simples, mais ce n'est pas ce que « recommandé »
> désigne dans l'ADR.

---

## Invariants respectés

| Invariant | Comment |
| --- | --- |
| **I30** | Le domain state vit dans l'Entity, jamais dans la View |
| **I42** | Le state local pré-soumission utilise le mécanisme `localState` |
| **I6** | Seule la Feature mute l'Entity (via Command post-soumission) |
| **D18** | La Command part du handler d'un fait du DOM (saisie, soumission), jamais d'un handler d'Event |
| **D20** | L'action par défaut du `submit` est annulée par déclaration (`cancelDefault`), jamais par le handler |
| **I44** | Le FormBehavior (Pattern C) n'accède pas à `this.view` |

---

## Référence complète

→ [ADR-25 — Pattern Formulaires](../../adr/ADR-25-formulaires.md) — exemples de code complets, analyse détaillée des 4 options, comparatif performances.
