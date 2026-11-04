# ADR-16 — View : part exclusive, `getUI`, niveaux N1/N2/N3

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I30, I38, I39, I40, I41 |
| **Livré** | ⚠️ partiel — N1 seul, en effets préparés (N2/N3 : ADR-22) ; une projection peut encore écrire dans le contenu d'un slot (I40 tenu par revue) |
| **Spec** | [view.md](../spec/4-couche-concrete/view.md) · théorie C.3, D10, D11 |

## Contexte

Sans règle, n'importe quel composant peut écrire dans le DOM, n'importe où :
deux sources de mutation se contredisent, une View écrase le sous-arbre d'une
autre, et un `querySelector` global rend le rendu impossible à raisonner.
Il faut un seul propriétaire par nœud, un périmètre clos et des droits gradués.

## Décision

1. **Part exclusive, cycle de vie passif** : la View écrit dans la part que son
   Composer lui attribue (ADR-19), structurée par son `template` et ses slots.
   Elle ne décide pas de sa propre existence : son Composer la crée et la détruit
   (I20, ADR-18). Ni `mount()` ni hook de cycle de vie.
2. **Aucun domain state** (I30) : ce qui est partagé vit dans une Entity. Seul un
   état *local de présentation* est admis (ADR-17).
3. **Écriture exclusivement par `getUI(key)`** (I39), dans un handler : la clé est
   déclarée dans le contrat UI (ADR-15), le sélecteur dans `uiElements`, résolu
   dans la part. Chaque appel **prépare un effet**, engagé après la validation de
   l'unité (C.3) ; si l'unité échoue, rien n'est écrit (G7).

   ```ts
   onCartItemAddedEvent(p: TItem, ctx: TEventContext<TVC>) {
     this.getUI("total").text(`${p.qty} articles`);   // N1, engagé après validation
     this.getUI("badge").toggleClass("empty", p.qty === 0);
   }
   ```

4. **Scope exclusif** (I40) : la part d'une View **moins** les sous-arbres de ses
   slots, attribués à ses Composers.
5. **Niveaux d'altération** (I38) : **N1** attributs, classes, texte ;
   **N2** insertion/suppression de nœuds dans des îlots déclarés ;
   **N3** template complet de la part. Foundation et Composer : aucun rendu de
   présentation (D12) ; View : N1 à N3 selon son mode de template (ADR-22) ;
   Behavior : N1 et N2 sur ses propres nœuds, jamais N3 (I45, ADR-21).
6. **Source de mutation unique par clé** (I41) : une clé couverte par un template
   n'est mutée que par le template.

## Alternatives rejetées

- **Exposer `querySelector` / l'élément brut** (`el`, `TProjectionNode.element()`, strate 0) — fin du scope, couplage aux sélecteurs, rendu non traçable.
- **Écrire immédiatement dans le DOM** — publierait une unité ensuite annulée.
- **Surveiller les mutations (`MutationObserver`)** — détection tardive, coûteuse, sans prévention.
- **View qui gère son cycle de vie ou compose ses enfants** — mélange rendu et orchestration (ADR-18).
- **Pas de niveaux formalisés** — impossible d'attribuer des droits différents à chaque rôle.

## Conséquences

- `getUI()` lève une erreur sur clé inconnue, sur sélecteur sans élément dans la part, ou hors d'un handler.
- Une View ne lit jamais le document : elle relit l'état par `ctx.query`.
- Une erreur synchrone d'engagement ferme la part de la View : ses écritures suivantes de la même unité sont non tentées, celles des autres Views restent engagées.
