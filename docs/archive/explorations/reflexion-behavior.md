# Réflexion sur Behavior

## Quels besoins ?

Etendre des Views avec des fonctionnalités réutilisables.

## Principes à définir

Un Behavior peut être branché à *n'importe quelle View* donc elle ne devrait pas avoir de dépendances à une instance particulière de View ou à une dérivation particulière de la classe de base View. A son instanciation, Behavior n'a aucun accès à sa View hôte. En revanche, la View hôte a accès au constructeur de ses Behavior déclarées. C'est donc à View de prévenir les collision de ui

> Différence fondamentale entre View et Behavior : Behavior n'a aucune capacité de définir des slots et des Composers.



## Exemples

1. TrackingBehavior : matche les éléments qui ont un [data-tracking-type] et [data-tracking-value] et envoit les données à un service extérieur - uniquement UIEvents, ne modifie pas le dom

2. IScrollBehavior (cf. iScroll ou better-scroll), altère le dom (sur un élément, wrappe avec un élément overflow), a son propre localState ou pourrait se brancher sur du state applicatif (Channel->Feature->Entity)

3. ???




---



## Questions en suspens

**Q-B1** : oui, peut avoir son propre UIMap. Devrait jeter une erreur si clé concurrente avec sa View "hôte". **Problème** : Behavior n'a aucune connaissance de sa View hôte (en principe elle peut se brancher avec n'importe quelle View). Donc l'erreur devrait être au niveau de la définition de la View

**Q-B2** : Oui elle peut avoir ses propres UIEvents

**Q-B3** : Oui, mais uniquement sur ses propres clés ui (voir **Q-B1** pour régler le problème de collision)

**Q-B4** : Oui — même pattern que la View, convention de nommage identique

**Q-B5** : Behavior ne devrait pas accéder à this.view.el selon moi ; et même a-t-elle besoin (est-ce un bon design) qu'elle puisse accéder à des propriétés de sa View hôte ?

**Q-B5** Elle peut avoir de l'altération **N1** et **N2** uniquement sur les `ui` qu'elle a déclaré 


## Autres points ouverts

Oui, Behavior peut avoir son propre `localState`


---

## Algorithme de décision : View+options vs Behavior vs Héritage

```
Q0 : Est-ce que cette fonctionnalité pourrait servir de BASE 
     pour COMPOSER d'autres Views ?
  └─ OUI → View (c'est un composant à part entière, réutilisable via options)
  └─ NON → Q1

Q1 : Est-ce que je veux réutiliser LA MÊME VIEW dans un contexte différent ?
  └─ OUI → View + options (D34)
  └─ NON → Q2

Q2 : Est-ce que la fonctionnalité est INDÉPENDANTE du rôle de la View ?
     (= elle pourrait s'appliquer à des Views sans rapport entre elles)
  └─ OUI → Behavior
  └─ NON → Q3

Q3 : Est-ce que la fonctionnalité a besoin de son propre TEMPLATE 
     (altération structurelle N2) ?
  └─ OUI, mais seulement sur des îlots ui dédiés → Behavior
  └─ OUI, et elle touche au template principal → Héritage View (sous-classe)
  └─ NON → Q4

Q4 : Est-ce que la fonctionnalité nécessite ses propres CHANNELS 
     (trigger/listen/request indépendants de la View) ?
  └─ OUI → Behavior
  └─ NON → Ça reste dans la View (méthode privée ou helper)
```

### Critères résumés

| Critère | View + options | Behavior | Héritage View |
|---------|---------------|----------|---------------|
| **Nature** | Composant à part entière, config différente | Capacité greffée, orthogonale | Spécialisation du composant |
| **Relation à la View hôte** | C'est la View | Aveugle (n'importe quelle View) | Connaît le parent |
| **Template** | Le même (params changent le contexte) | Mode C uniquement (îlots ui propres) | Peut remplacer le template |
| **Channels** | Les mêmes | Indépendants | Hérités + extensions |
| **Nombre de Views concernées** | 1 classe, N contextes | N classes différentes | 1 hiérarchie |
| **Couplage** | Total (c'est la même View) | Zéro (aveugle) | Partiel (connaît le parent) |

---

## Conclusion — Formalisation

Cette réflexion a abouti aux décisions et invariants suivants, formalisés dans les RFCs :

### Décisions

| ID | Titre | RFC |
|----|-------|-----|
| **D36** | Contrat Behavior — plugin UI réutilisable aveugle | [RFC-0001-invariants-decisions](rfc/RFC-0001-invariants-decisions.md), [RFC-0001-composants §8](rfc/RFC-0001-composants.md), [RFC-0002 §10](rfc/RFC-0002-api-contrats-typage.md) |
| **D37** | Behavior localState — mêmes 5 contraintes I42 que la View | [RFC-0001-invariants-decisions](rfc/RFC-0001-invariants-decisions.md), [RFC-0002 §10.2](rfc/RFC-0002-api-contrats-typage.md) |
| **D38** | Algorithme de décision View+options vs Behavior vs Héritage | [RFC-0001-invariants-decisions](rfc/RFC-0001-invariants-decisions.md), [RFC-0001-composants §8](rfc/RFC-0001-composants.md) |

### Invariants

| ID | Titre | RFC |
|----|-------|-----|
| **I43** | Clés TUIMap Behavior/View sans collision (vérifié au bootstrap) | [RFC-0001-invariants-decisions](rfc/RFC-0001-invariants-decisions.md), [RFC-0002 §10.2](rfc/RFC-0002-api-contrats-typage.md) |
| **I44** | Behavior sans accès à sa View hôte (pas de `this.view`) | [RFC-0001-invariants-decisions](rfc/RFC-0001-invariants-decisions.md), [RFC-0002 §10.1](rfc/RFC-0002-api-contrats-typage.md) |
| **I45** | Behavior : altération N1+N2 sur ses propres clés ui uniquement | [RFC-0001-invariants-decisions](rfc/RFC-0001-invariants-decisions.md), [RFC-0002 §10.2](rfc/RFC-0002-api-contrats-typage.md) |

### Autres mises à jour

- **I42** : mise à jour pour inclure le Behavior (point ouvert fermé)
- **D33** : point ouvert Behavior fermé (D37)
- **Q7** : résolue — contrat Behavior stabilisé
- Anti-pattern **Excessive View Inheritance** ajouté
- **RFC-0001-composants §8** : réécriture complète avec contrat finalisé
- **RFC-0002 §10** : réécriture complète avec classe abstraite, types dédiés, exemples