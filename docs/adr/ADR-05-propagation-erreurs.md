# ADR-05 — Propagation des erreurs : l'unité de validation comme frontière

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I55, I65, I102 |
| **Livré** | ✅ — échec par unité, rollback et trace livrés par `Root` ; racine unique `BonsaiError` (code stable, composant, contexte causal) pour toute erreur levée par le framework |
| **Spec** | [erreurs.md](../spec/2-architecture/erreurs.md) · théorie G7, O2, C.8 |

## Contexte

Une exception peut naître à chaque étage : recette de mutation, handler de
Command ou d'Event, handler de Query, notification d'Entity, projection. Sans
règle, soit une erreur locale abat toute la chorégraphie, soit elle disparaît
silencieusement en laissant un traitement à moitié fait. Il faut aussi qu'un
diagnostic distingue une violation détectée par le framework d'une erreur du
code applicatif.

## Décision

**Une erreur fait échouer l'unité de validation où elle survient, et seulement
elle** (G7). L'unité restaure l'état qu'elle a modifié, abandonne ses créations
et ses messages différés, et n'engage aucun de ses effets. Un handler n'a rien
à rattraper : une Query en échec n'est pas récupérable (`UNRECOVERABLE`).

**Tout échec est signalé dans la trace de la racine** (`unit-failed`, avec son
contexte causal), hors transport applicatif : le signalement ne produit ni
message ni origine (G7, C.8). `onTrace` en est le récepteur unique ; en
développement, `reportToConsole` signale ceux que personne ne reçoit (O2).

**Toute erreur levée par le framework dérive de `BonsaiError`** : un `code`
stable à comparer (code symbolique ou identifiant d'invariant), le composant
concerné, une suggestion éventuelle, et le contexte causal de l'unité où elle
est née (`context`, ADR-04). Sous-classes : `TransportError`, `InvariantError`,
`StartupError`, `ManifestError` (noyau) et `BonsaiNamespaceError` (Manifest).

```ts
onTrace: (entry) => {
  if (entry.type !== "unit-failed") return;
  if (entry.error instanceof BonsaiError) report(entry.error.code, entry.error.context);
  else report("APPLICATION", entry.context);  // erreur du code applicatif, non modifiée
}
```

## Alternatives rejetées

- **Isoler les réactions et journaliser** (`BroadcastError`, `ListenerError`, `null` de Query, strate 0) — valide des traitements à moitié faits.
- **Tout propager jusqu'au fait de l'hôte** — un abonné défaillant annulerait l'émetteur, déjà validé.
- **Type `Result<T>` sur toutes les API** — une erreur de transport n'est pas une valeur métier.
- **Hook `onError()` de Feature ou `ErrorReporter` injectable** — un traitement réagissant à un échec serait un message sans parent établi (G8), ou un moyen de valider ce que G7 a défait ; `onTrace` suffit (I65).
- **Une sous-classe par étage** (`CommandError`, `MutationError`, `RenderError`…) — jamais levées : l'étage est dans la trace (`owner`), le motif dans le `code`.

## Conséquences

- `instanceof BonsaiError` sépare les violations du framework des erreurs applicatives, que le noyau ne modifie pas.
- Un effet déjà appliqué à l'hôte n'est pas annulé ; son échec revient par un nouveau message (G7).
- Un code est un contrat : le renommer est un changement cassant.
- Une réaction applicative à un échec passe par un fait admis (résultat d'effet, C.3), jamais par la trace.
