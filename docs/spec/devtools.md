# DevTools et outils de debug

> 🟠 **Aligné sur la théorie V0.9.5 (4 novembre 2026) ; DevTools non livrés.** Le socle livré est la **trace de la racine** (§3) ; l'API `app.devTools` (§4 à §7) est une cible strate 2c. En cas d'écart, la [théorie](../theorie.md) prévaut ([règle de confiance](../README.md#règle-de-confiance-et-dalignement)).

> **Instrumentation, observabilité et outillage de développement du framework Bonsai**

[← Retour à l'index](README.md)

---

| Élément | État | Sections |
| --- | --- | --- |
| Trace de la racine (`app.root.trace`), option `onTrace`, sortie console en développement (`reportToConsole`, O2) | ✅ livré | §3 |
| Contextes causaux créés par le noyau (G8) | ✅ livré | §3.2 |
| `app.devTools` : registre, Ledger, snapshot/restore, collecte des erreurs | ⏳ strate 2c | §4 à §7 |
| Time-travel, extension navigateur, profiling | ⏳ hors v1 ([roadmap](../ROADMAP.md)) | §8 |

---

## 1. Motivation et position architecturale

> **Principe fondateur** : un framework aussi contraignant que Bonsai —
> invariants stricts, flux unidirectionnel, unités de validation — ne peut
> tenir ses promesses qu'avec une **observabilité de première classe**.

| Problème sans outillage | Ce qu'il faut voir |
| --- | --- |
| Une unité échoue et est défaite (G7) | Quelle unité, quelle erreur, sous quel contexte causal |
| Une chaîne refusée par la borne causale (`CAUSAL_BOUND`, D9) | La chaîne des contextes jusqu'à l'origine |
| Un Event émis mais une View non mise à jour | La délivrance a-t-elle eu lieu, ou a-t-elle été abandonnée (destinataire détruit) ? |
| Une Query en échec | L'unité de l'auteur, son contexte (I65) |
| Un Composer qui ne compose pas la bonne View | Ce que `resolve(ctx)` a rendu, et les effets engagés |
| Une projection sans effet visible | L'effet a-t-il été engagé, a-t-il échoué (élément absent) ? |

L'observabilité est **hors du transport applicatif** (O2) : elle n'admet rien, ne pilote pas la racine, et ne crée aucun message.

---

## 2. Scope v1

| Fonctionnalité | Description | État |
| --- | --- | --- |
| **Trace** | Délivrances, échecs d'unité, abandons, effets engagés, restitutions, unités et vidages longs | ✅ |
| **Sortie console** | Échecs signalés en développement, absente du bundle de production | ✅ |
| **Inspection du registre** | Channels vivants, Commands, Queries et Events déclarés, abonnements | ⏳ |
| **Inspection des Entities** | État courant de chaque Entity, dernière mutation | ⏳ |
| **Chaîne causale** | Reconstruction depuis un contexte causal | ⏳ (les entrées portent déjà leur contexte) |
| **Snapshot / restore** | Export et restauration de l'état des Entities | ⏳ |

---

## 3. Ce qui est livré : la trace de la racine

### 3.1 Entrées

Chaque racine tient une trace (`app.root.trace`, lecture seule) ; chaque entrée est aussi transmise à l'option `onTrace` de l'Application, au moment où elle est écrite.

```typescript
type TTraceEntry =
  | { type: "delivered"; kind: "command" | "event" | "local"; to: string; name: string; context: TCausalContext }
  | { type: "unit-failed"; owner: string; context: TCausalContext; error: unknown }
  | { type: "delivery-abandoned"; reason: string; name: string; context: TCausalContext }
  | { type: "admission-abandoned"; reason: string; name: string }
  | { type: "effects"; report: ReadonlyArray<TEngagementLine> }        // C.3, dans l'ordre réel
  | { type: "long-unit"; owner: string; context: TCausalContext; durationMs: number }   // ADR-35
  | { type: "restitution"; portion: string; container: string; imputedTo: string; endedOwner: string }
  | { type: "long-drain"; units: number; context: TCausalContext; durationMs: number }; // ADR-35
```

Les Queries réussies et les mutations ne sont pas tracées ; une Query en échec l'est, par l'échec de l'unité de son auteur (I65).

### 3.2 Contexte causal

```typescript
type TCausalContext = {
  id: string;
  parentId: string | null;
  originId: string;
  originKind: "startup" | "spontaneous" | "unknown";
  depth: number;
};
```

Le noyau crée et gèle chaque contexte (G8) : le démarrage est une origine (`startup`), une saisie indépendante dans une part aussi (`spontaneous`), une notification non corrélable est d'origine inconnue (`unknown`). `depth` est contrôlée contre `causalBound` (D9). L'exposition de ce contexte au code applicatif (`ctx.metas`) est strate 1b ([metas.md](2-architecture/metas.md)).

### 3.3 Configuration

```typescript
const app = new Application({
  features, foundation: AppFoundation, document,
  onTrace: (entry) => myCollector.push(entry), // ou null : aucune sortie
  causalBound: 50                              // défaut
});
app.start();

// Dans un test
expect(app.root!.trace.filter((t) => t.type === "unit-failed")).toEqual([]);
```

Par défaut, `onTrace` vaut `reportToConsole` en développement (`__DEV__`) : il signale sur la console les échecs que personne ne reçoit. `bonsai.prod.js` ne contient pas ce sink (`tests/integration/bundles-dev-prod.test.ts`). Un sink qui lève est ignoré : il ne peut pas piloter la racine.

> ⚠️ La trace est un tableau qui croît avec l'application ; sa borne (ring buffer) reste à décider avec l'API DevTools.

---

## 4. API d'inspection — cible

```typescript
/** ⏳ Strate 2c. `null` hors développement. */
type TBonsaiDevTools = {
  /** Observe la trace (équivalent d'onTrace, à plusieurs abonnés). */
  onTrace(listener: (entry: TTraceEntry) => void): () => void;
  /** Registre des Channels vivants de la racine. */
  getChannelRegistry(): TChannelRegistryEntry[];
  /** Entrées dont le contexte descend de `contextId`, dans l'ordre. */
  getCausalChain(contextId: string): TTraceEntry[];
  /** État courant de toutes les Entities. */
  getSnapshot(): TApplicationSnapshot;
  /** Restauration de l'état (§7). */
  restoreSnapshot(snapshot: TApplicationSnapshot): void;
};

type TChannelRegistryEntry = {
  readonly namespace: string;
  readonly owner: string;
  readonly commands: readonly string[];   // handlers on{Cmd}Command découverts
  readonly queries: readonly string[];    // handlers on{Name}Query découverts
  readonly events: Record<string, readonly string[]>; // Event → abonnés, dans l'ordre de délivrance
};

type TApplicationSnapshot = {
  readonly entities: Record<string, unknown>; // namespace → état JSON
};
```

> 🧭 **Point d'entrée non tranché** : `app.devTools`, ou des options de
> l'Application. Les noms `app.snapshot()`/`app.restore()` ([view.md](4-couche-concrete/view.md) annexe B)
> et `getSnapshot()`/`restoreSnapshot()` coexistent ; aucun n'est retenu.

Usage visé dans un test d'intégration :

```typescript
const cart = app.devTools!.getChannelRegistry().find((c) => c.namespace === "cart");
expect(cart?.commands).toContain("addItem");
expect(cart?.queries).toContain("total");
```

---

## 5. Erreurs — cible

> **Position architecturale** : les erreurs sont une préoccupation d'infrastructure,
> pas un domaine métier. Pas de Channel `error`, pas de Feature `error`
> ([ADR-05](../adr/ADR-05-propagation-erreurs.md)).

Le canal livré est l'entrée `unit-failed` de la trace : elle porte l'erreur, le composant dont l'unité a échoué et son contexte causal. Une API de collecte (`getErrors()`, filtre par code de `TransportError` ou par invariant) s'appuiera sur elle.

| Type | Exemple | Canal | DevTools |
| --- | --- | --- | --- |
| **Infrastructure** | `TransportError` (`UNKNOWN_TARGET`, `CAUSAL_BOUND`…), `InvariantError`, effet échoué | Trace | ✅ |
| **Applicative** | « Article en rupture de stock » | Event métier (`cart:addItemFailed`), projeté par la View | ❌ c'est de l'état du domaine |

---

## 6. Entities — cible

L'état d'une Entity est détenu par le noyau et gelé : une mutation hors `ctx.mutate` est déjà impossible, il n'y a pas de « mode debug » de gel à ajouter. L'inspection visée :

```typescript
// ⏳ Strate 2c
const snapshot = app.devTools!.getSnapshot();
console.log(snapshot.entities["cart"]);
```

Une observation des mutations (`intent`, `changedKeys`, `patches`) peut reprendre `TEntityEvent` ; elle reste hors du transport (O2).

---

## 7. Snapshot et restore — cible

| Aspect | Exigence |
| --- | --- |
| **Validation** | Structure conforme à chaque `TStructure` (`TJsonSerializable`) |
| **Transaction** | La restauration est une unité de validation : tout ou rien (G7) |
| **Notifications** | Les notifications d'Entity sont délivrées comme après une mutation (I96) |
| **Origine** | Un contexte causal propre, distinct d'une saisie, pour ne donner aucun droit de commander (D18) |

Aucune de ces garanties n'est conçue en détail ; elles bornent la conception.

---

## 8. Extensions post-v1

- **Time-travel** : undo/redo par les `inversePatches` d'Immer ([entity.md](3-couche-abstraite/entity.md)), chaque pas étant une unité.
- **Extension navigateur** : trace en temps réel, chaîne causale interactive, inspecteur d'Entity.
- **Profiling** : durée par handler ; les entrées `long-unit` et `long-drain` (ADR-35) en sont la première forme.

---

## Références croisées

| Document | Concept | Lien DevTools |
| --- | --- | --- |
| [erreurs.md](2-architecture/erreurs.md) | Unité de validation, catégories d'erreurs | Entrées `unit-failed` |
| [metas.md](2-architecture/metas.md) | Contextes causaux | Chaîne causale |
| [entity.md](3-couche-abstraite/entity.md) | `TEntityEvent`, patches | Inspection des mutations |
| [ADR-05](../adr/ADR-05-propagation-erreurs.md) | Propagation des erreurs | §5 |
| [ADR-35](../adr/ADR-35-vidage-file-differee.md) | Vidage synchrone, unités longues | `long-unit`, `long-drain` |
| [ADR-17](../adr/ADR-17-local-state.md) | localState | Hors snapshot (état de présentation) |
