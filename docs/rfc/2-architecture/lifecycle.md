# Cycle de vie des composants

> **Persistants vs volatils, nettoyage déterministe, garanties framework**

[← Retour à l'architecture](README.md) · [← State](state.md)

---

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

> **D4 — Cycle de vie passif** : les composants persistants n'ont pas
> de lifecycle "actif" (pas de `onInit`/`onDestroy` appelés dynamiquement).
> Ils sont créés au bootstrap et vivent jusqu'à la fermeture.

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

## 3. Bootstrap — 6 phases

> Résumé de [ADR-0010](../../adr/ADR-0010-bootstrap-order.md).

Le démarrage de l'application suit un ordre **strict et déterministe** :

```
Phase 1  register()      Enregistrer les Features (namespace, Entity, Channel)
Phase 2  validate()      Vérifier l'unicité des namespaces (I21), pas de collision
Phase 3  wire()          Radio résout les déclarations, câble les Channels
Phase 4  init()          Appeler onInit() sur chaque Feature (séquentiel, async OK)
Phase 5  foundation()    Créer la Foundation, résoudre les Composers racines
Phase 6  mount()         Créer les Views/Behaviors initiaux, attacher au DOM
```

| Phase | Garantie |
|-------|----------|
| 1–3 | La couche abstraite est **complètement câblée** avant toute instanciation concrète |
| 4 | Chaque `onInit()` peut faire un fetch async — le bootstrap attend la résolution |
| 5–6 | Les Views sont créées **après** que toutes les Entities ont leur état initial |

> **Invariant de séquence** : aucune View ne peut envoyer de `trigger()` avant
> que toutes les Features soient en état `active`. Le bootstrap le garantit
> par construction.

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

| Hook | Quand | Usage typique |
|------|-------|---------------|
| `onAttach()` | View montée dans le DOM, Channels câblés | Setup initial, première projection |
| `onDetach()` | View retirée du DOM | Nettoyage automatique par le framework |

### Behavior

| Hook | Quand | Usage typique |
|------|-------|---------------|
| `onAttach()` | Behavior attaché à sa View hôte | Initialisation du comportement |
| `onDetach()` | View hôte détruite | Nettoyage automatique |

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
