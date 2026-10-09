# ADR-16 — View : scope de rendu exclusif, `getUI`, niveaux N1/N2/N3

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I30, I38, I39, I40, I41 |
| **Livré** | ⚠️ partiel — N1 seul (N2/N3 : ADR-22) ; le scope n'exclut pas encore les slots (pas de `View.composers`) ; `element()` et `el` exposent le nœud brut ; pas de `onDetach` |
| **Spec** | [view.md](../spec/4-couche-concrete/view.md) |

## Contexte

Sans règle, n'importe quel composant peut écrire dans le DOM, n'importe où :
deux sources de mutation se contredisent, une View écrase le sous-arbre d'une
autre, et un `querySelector` global rend le rendu impossible à raisonner.
Il faut un seul propriétaire par nœud, un périmètre clos et des droits gradués.

## Décision

1. **Scope de rendu, cycle de vie passif** : la View est le seul composant qui
   possède un scope de rendu — un `rootElement` qu'elle structure (N3, slots).
   Un Behavior projette lui aussi le domaine, mais seulement sur ses propres clés,
   dans le scope de sa View hôte (I38, ADR-21). La View ne décide pas de sa
   propre existence : la Foundation et les Composers la créent, la remplacent,
   la détruisent (I20, ADR-18).
2. **Aucun domain state** (I30) : ce qui est partagé vit dans une Entity. Seul un
   state *local de présentation* est admis (ADR-17).
3. **Accès DOM exclusivement par `getUI(key)`** (I39) : la clé est déclarée dans
   le contrat UI (ADR-15), le sélecteur dans `uiElements`, la résolution est faite
   par le framework dans le `rootElement`. Le retour est un `TProjectionNode<TEl>` :

   ```ts
   onCartItemAddedEvent(p: TItem) {
     this.getUI("total").text(`${p.qty} articles`);   // N1
     this.getUI("badge").toggleClass("empty", p.qty === 0);
   }
   ```

4. **Scope exclusif** (I40) : le scope d'une View est son `rootElement` **moins**
   les sous-arbres des slots qu'elle déclare pour ses Composers ; un `uiElements`
   qui résout dans un slot est une erreur.
5. **Niveaux d'altération** (I38) : **N1** attributs, classes, texte ;
   **N2** insertion/suppression de nœuds dans des îlots déclarés ;
   **N3** template complet du `rootElement`. Foundation = N1 sur `<html>`/`<body>`,
   Composer = aucune écriture, View = N1 à N3 selon son mode de template (ADR-22),
   Behavior = N1 et N2 sur ses propres nœuds, jamais N3 (I45, ADR-21).
6. **Source de mutation unique par clé** (I41) : une clé couverte par un template
   n'est mutée que par le template (`getUI` rend alors une lecture seule).

## Alternatives rejetées

- **Exposer `querySelector` / accès DOM brut** — fin du scope, couplage aux sélecteurs, rendu non traçable.
- **Surveiller les mutations (`MutationObserver`)** — détection tardive, coûteuse, sans prévention.
- **`TProjectionNode` avec `.node`** — contourne la source de mutation unique.
- **View qui gère son cycle de vie ou compose ses enfants** — mélange rendu et orchestration (ADR-18).
- **Pas de niveaux formalisés** — impossible d'attribuer des droits différents à Foundation, Composer, View, Behavior.

## Conséquences

- `getUI()` lève une erreur sur clé inconnue ou élément introuvable ; la résolution est refaite à chaque appel (pas de cache).
- **Écarts livrés** : `TProjectionNode.element()` et `protected get el()` rendent le nœud brut, ce qui ouvre une porte hors N1 (I39 n'est tenu que par convention) ; sans `View.composers`, aucun slot n'est exclu du scope.
- La View reste montée jusqu'à son remplacement : le Composer ne la démonte pas encore (ADR-18).
