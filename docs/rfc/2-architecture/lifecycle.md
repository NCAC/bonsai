# Cycle de vie des composants

> **Persistants vs volatils, nettoyage déterministe, garanties framework**

[← Retour à l'architecture](README.md) · [← State](state.md)

---

> ### ⏳ Périmètre d'implémentation (ADR-0028)
>
> Ce document décrit le **contrat cible** du cycle de vie. Les éléments suivants ne sont **pas encore implémentés** :
>
> | Élément | Strate cible | Sections concernées |
> | ------- | ------------ | ------------------- |
> | `Application.stop()`, shutdown ordonné, `Feature.onDestroy()` | Strate 1 | §3 (Shutdown) |
> | Bootstrap asynchrone (`onInit()` retournant une `Promise` attendue) | Strate 1 | §3 |
> | `View.onDetach()` et nettoyage déterministe (désabonnements Channel et DOM) | Strate 1c | §2, §4 |
> | Cascade de destruction Composer → View → Composer enfant | Strate 1d | §2 |
> | Hooks Behavior | Strate 2b | §4 |
>
> **Périmètre effectif livré** : `Feature.onInit()` **synchrone** appelé en Phase 3 ; `View.onAttach()` appelé à la fin de `mount()` ; `Foundation.onAttach()` appelé après l'attachement des Composers racines (`onDetach()` déclaré mais jamais invoqué). Quand un Composer détache une View, il **libère seulement sa référence** : les listeners Channel et DOM de la View ne sont pas retirés.

## 1. Deux catégories de composants

### Composants persistants (couche abstraite)

| Composant | Durée de vie | Destruction | Nettoyage |
|-----------|-------------|-------------|-----------|
| **Feature** | Application entière | Jamais (sauf hot-reload) | N/A |
| **Entity** | Application entière (via Feature) | Jamais (sauf hot-reload) | N/A |
| **Channel** | Application entière (via Feature) | Jamais | N/A |
| **Radio** | Application entière (singleton) | Jamais | N/A |
| **Application** | Application entière (singleton) | Jamais | N/A |
| **Router** | Application entière (singleton) | Jamais | N/A |

> **D4 — Cycle de vie passif** : les composants persistants ne sont **ni
> montés ni démontés à répétition** comme les composants volatils — pas de
> cycle attach/detach déclenché par la navigation. `Feature.onInit()` **est**
> appelé, mais une seule fois, à la fin de `bootstrap()` (Phase 3, I56) — ce
> n'est pas « aucun hook », c'est un hook **appelé exactement une fois dans
> la vie de l'application**, jamais en réponse à un événement runtime.
> `onDestroy()` n'existe pas dans le code livré (cible strate 1, cf. bandeau
> de périmètre en tête de document).

### Composants volatils (couche concrète)

| Composant | Durée de vie | Destruction | Nettoyage |
|-----------|-------------|-------------|-----------|
| **Foundation** | Lié à l'Application | Fermeture de l'Application | Déterministe par le framework |
| **Composer** | Mount → Unmount (via Foundation/Composer parent) | Retrait du DOM parent | Déterministe par le framework |
| **View** | Mount → Unmount (via Composer) | Retrait du Composer | Déterministe par le framework |
| **Behavior** | Mount → Unmount (via View parent) | Retrait de la View parent | Déterministe par le framework |

> **Exception — Foundation** : bien que faisant partie de la couche concrète,
> Foundation a un cycle de vie **lié à l'Application**. Il est créé au bootstrap
> et persiste jusqu'à la fermeture de l'application. C'est la seule exception
> parmi les composants de la couche concrète.

> Les autres composants volatils (Composer, View, Behavior) **naissent et meurent**
> au rythme des interactions utilisateur (navigation, ouverture de modale, etc.).

---

## 2. Nettoyage déterministe

Le framework garantit un **nettoyage automatique et complet** à la destruction d'un composant volatil :

| Ressource nettoyée | Mécanisme |
|--------------------|-----------|
| Event listeners DOM | Désabonnement automatique |
| Subscriptions Channel (listen) | Désabonnement automatique |
| Timers / Intervals | Annulation automatique |
| Références enfants | Cascade de destruction (Foundation → Composers → Views → Behaviors) |

### Cinq règles de nettoyage

1. **Cascade descendante** : détruire un Composer détruit toutes ses Views et leurs Behaviors
2. **Aucune référence pendante** : après destruction, aucun listener ne reste actif
3. **Pas de cleanup manuel** : le développeur ne gère jamais `removeEventListener()` ou `unsubscribe()`
4. **Destruction synchrone** : le nettoyage se fait en une seule passe, sans `setTimeout`
5. **Idempotent** : détruire deux fois un composant déjà détruit est un no-op

> Le développeur Bonsai n'écrit **jamais** de code de nettoyage.
> Le framework gère 100% du cycle de vie des ressources via
> la hiérarchie de composition (Foundation → Composer → View → Behavior).

---

## 3. Bootstrap

> Résumé de [ADR-0010](../../adr/ADR-0010-bootstrap-order.md). Table de phases
> détaillée (strate 0 réelle **et** contrat cible 6 phases) → [application.md §2–§3](../3-couche-abstraite/application.md).
> **Ne pas dupliquer la table de phases ici** — une description indépendante
> a par le passé divergé du code réel ; ce document ne porte que les
> garanties de haut niveau, la table détaillée vit dans un seul endroit.

Le démarrage de l'application suit un ordre **strict et déterministe**. Il n'y
a plus de `register()` explicite depuis [ADR-0039](../../adr/ADR-0039-namespace-authority-and-uniqueness.md) —
les Features sont déclarées par le **manifest applicatif** passé au constructeur
d'`Application`, et instanciées/câblées par `start()` :

| Étape (résumé) | Garantie |
|-------|----------|
| Validation + instanciation des Features (manifest, ctor inerte — I94) | La couche abstraite est **complètement câblée** avant toute instanciation concrète |
| `onInit()` de chaque Feature | Séquentiel, dans l'ordre du manifest — **synchrone** : `onInit(): void` ne retourne rien à attendre, `bootstrap()` n'attend aucune `Promise` (un `onInit()` async serait ignoré, pas attendu — cible non tranchée pour un futur support async) |
| Foundation → Composers → Views | Les Views sont créées **après** que toutes les Entities ont leur état initial |

> **Invariant de séquence** : aucune View ne peut envoyer de `trigger()` avant
> que le `bootstrap()` de sa Feature cible ait câblé ses handlers. Le bootstrap
> le garantit par construction — `Feature` ne porte pas d'état `active` nommé
> (pas de machine à états, cf. [feature.md §8.1](../3-couche-abstraite/feature.md#81-machine-à-états-de-la-feature--cible--non-livrée)) : seul un booléen interne `#bootstrapped` existe.

### Shutdown

```
Phase 1  detach()        Détacher toutes les Views/Behaviors (cascade descendante)
Phase 2  destroy()       Appeler onDestroy() sur chaque Feature (ordre inverse)
Phase 3  cleanup()       Radio vide les registres, déréférence les Channels
```

> L'ordre de destruction est **l'inverse** de l'ordre d'enregistrement.

---

## 4. Hooks de lifecycle — composants concrets

### View

| Hook | Quand | Usage typique | État |
|------|-------|---------------|------|
| `onAttach()` | View montée dans le DOM, Channels câblés | Setup initial, première projection | ✅ livré |
| `onDetach()` | View retirée du DOM | Nettoyage automatique par le framework | ⏳ **n'existe pas** sur `View` (ni déclaré ni invoqué) — un Composer qui détache une View ne fait que libérer sa référence (cf. bandeau de périmètre) |

### Behavior

| Hook | Quand | Usage typique | État |
|------|-------|---------------|------|
| `onAttach()` | Behavior attaché à sa View hôte | Initialisation du comportement | ⏳ package `@bonsai/behavior` non livré (cible strate 2) |
| `onDetach()` | View hôte détruite | Nettoyage automatique | ⏳ idem |

### Composer

| Hook | Quand | Usage typique |
|------|-------|---------------|
| `resolve(event)` | Appelé avec l'Event déclencheur (ou `null` au premier montage) pour décider quelle View instancier | Logique de sélection pure |

> Les Composers n'ont **aucun hook lifecycle** (ADR-0025) : ni `onMount()`, ni `onUnmount()`,
> ni `onAttach()`, ni `onDetach()`. Leur unique point d'entrée est `resolve(event)` (ADR-0027).
> Les handlers `onXxxEvent` n'existent pas sur le Composer — l'Event est passé en argument
> de `resolve()`. Le Composer est un **décideur pur** sans state local.
> Création au bootstrap ou par la View parente, destruction en cascade.

---

## Lecture suivante

→ [Metas et tracabilite](metas.md) — traçabilité des messages, ULID, propagation
