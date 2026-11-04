# ADR-35 — Vidage synchrone de la file des messages différés

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted — 1er novembre 2026 |
| **Livré** | ✅ vidage synchrone et mesure des unités et des vidages longs dans la trace (`longUnitMs`, `long-unit`, `long-drain`), dans `Root` (`@bonsai/kernel`), sur lequel reposent toutes les classes de base depuis les lots M6.1 à M6.3 |
| **Spec** | [Théorie](../theorie.md) G5, G7, D8, D9, O1, O2, C.3 ; [rapport du prototype M1](../rapports/prototype-noyau-M1-2026-10-31.md), point R3 |

## Contexte

G5 impose une unité de validation à la fois et la délivrance des messages différés après la fin réussie de l'unité qui les produit. Elle ne dit pas **quand** la file est vidée : d'un trait après chaque admission, ou par tranches qui rendent la main à l'hôte entre deux unités. Le prototype M1 vide la file d'un trait. Une longue chaîne bloque alors le fil de l'hôte, jusqu'à la borne D9 au pire.

L'analyse sur deux cas montre que les chaînes courantes sont courtes (une recherche au fil de la frappe : une demi-douzaine d'unités), et que la lenteur réelle vient d'**une seule unité lourde** : un rendu de liste, une grosse recomposition. Or aucune politique de vidage ne peut couper une unité : G7 l'exige entière, et C.3 engage ses effets avant la délivrance suivante.

## Décision

1. Après une admission ou un démarrage réussi, le noyau délivre **d'un trait** tous les messages différés en attente, une unité après l'autre, dans l'ordre de D8, sans rendre la main à l'hôte. Les faits survenus pendant ce temps sont admis ensuite, dans l'ordre où l'hôte les présente.
2. Le noyau **mesure** la durée de chaque unité, effets compris, et de chaque vidage. Au-delà d'un seuil (50 ms par défaut, la durée d'une tâche longue du navigateur), il l'inscrit dans sa trace technique, avec le contexte causal de l'unité ou de l'origine du vidage (O2).
3. Ce seuil est une option de la racine. Il ne change aucun comportement : il signale.

```ts
const root = new Root({ causalBound: 50, longUnitMs: 50 });
// trace : { type: "long-unit", owner: "catalogView", durationMs: 87, context }
```

## Alternatives rejetées

- **Vidage par tranches** (budget de temps, puis reprise après une tâche ou une microtâche) — aucun gain sur une unité lourde, qu'il ne peut pas couper ; tests asynchrones (`await root.settled()`) ; un fait peut s'intercaler au milieu d'une chaîne selon le temps, si bien que le rejeu (O1) doit enregistrer la position de chaque admission dans la file, pas seulement l'ordre des faits.
- **Limite d'unités par tranche fixée au Manifest** — mêmes coûts dès qu'elle est atteinte, pour un cas rare ; la borne D9 arrête déjà les chaînes sans fin.

| Critère | Synchrone | Par tranches |
| --- | --- | --- |
| Performance perçue | identique sur les chaînes courtes ; bloque sur une chaîne longue | rend la main sur une chaîne longue ; identique sur une unité lourde |
| Complexité | une boucle | ordonnanceur, état « en cours de vidage », reprise |
| DX et tests | assertions synchrones après `admit` | `await` systématique |
| Rejeu (O1) | ordre des faits admis | ordre et position d'admission |
| Type-safety | sans effet | sans effet |

## Conséquences

- Après `admit`, tout est fini : les tests restent synchrones, et le rejeu n'a besoin que de l'ordre des faits.
- Le remède à une unité lourde est dans l'application et l'API, pas dans l'ordonnancement :
  - une liste de N éléments est **projetée par une seule View**, pas instanciée en N Views ou Composers ;
  - la réconciliation par clés conserve les Views existantes plutôt que de les recréer (Composer §1.3) ;
  - le domaine peut ne fournir que la fenêtre visible d'une longue liste (virtualisation) ;
  - un calcul vraiment lourd se découpe en plusieurs messages, donc en plusieurs unités.
- La trace des unités longues désigne l'unité à réécrire.
- Le noyau s'exécute **pendant la propagation** du fait de l'hôte qui l'a déclenché : tout le traitement d'un clic, effets engagés compris, a lieu avant que le navigateur ait fini de propager ce clic (constat du prototype, lot M5). Deux conséquences :
  - le navigateur ignore un `element.click()` imbriqué sur l'élément dont le clic est en cours ; une simulation instrumentée (`simulate`, C.4) passe donc par `dispatchEvent` ;
  - les actions par défaut de l'hôte (soumission d'un formulaire, déplacement du focus, suivi d'un lien) ont lieu **après** les effets engagés. Un effet qui dépend de leur résultat doit attendre un fait ultérieur, admis normalement ; il ne peut pas le supposer acquis. Une View peut déclarer leur annulation par clé (D20) : elle est appliquée à la capture, sans dépendre de ce vidage.
- Un vidage par tranches reste possible plus tard sans toucher à la théorie : G5 ne l'interdit pas. Il demanderait un nouvel ADR remplaçant celui-ci.
