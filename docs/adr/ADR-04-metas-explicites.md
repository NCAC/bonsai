# ADR-04 — Contexte causal établi par le noyau, lu par le handler via `ctx.cause`

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I7, I8, I9, I54 |
| **Livré** | ✅ — `Root` établit le contexte causal de chaque message (qualification de l'origine, parent unique, profondeur, G8) et borne la profondeur (`causalBound`, D9) ; strate 1b : `ctx.cause` dans les contextes de Feature, de View et du Composer (`resolve`), contexte joint au `TEntityEvent` et aux erreurs du noyau, `metas` libre de `ctx.mutate` retiré |
| **Spec** | [metas.md](../spec/2-architecture/metas.md) · théorie G8, C.4, D9 |

## Contexte

En chorégraphie (ADR-01), une action de l'utilisateur déclenche une cascade
Command → Event → Event… à travers plusieurs Features. Sans contexte causal,
impossible de relier un effet à sa cause, de borner une boucle, de décider si
une réaction a le droit de commander (D18), ou d'alimenter DevTools et rejeu.
La théorie tranche qui l'établit : l'infrastructure, jamais le code applicatif
(A5.b, G8). Reste à fixer comment le handler le lit.

## Décision

**Le noyau établit le contexte** de chaque message (G8) ; le code applicatif ne
le fabrique, ne le choisit ni ne le remplace (I8, I54).

- **Origine** : démarrage, fait indépendant (origine spontanée) ou antécédent inconnu, qualifiée par le protocole du monde fermé (C.4).
- **Continuation** : tout message soumis par un handler a exactement un parent, la délivrance qui l'a déclenché (I7).
- **Profondeur** : chaque continuation l'incrémente ; au-delà de `causalBound`, le message n'est pas soumis (I9, D9).

**Le contexte voyage par le paramètre explicite du handler** (`ctx`), propre à
son unité de validation : tout ce qui est soumis par `ctx` lui est rattaché.
**Le handler le lit par `ctx.cause`**, un `TCausalContext` figé, présent dans
tous les contextes de handler (Command, Event, Query, fait du DOM) et dans celui du `resolve` du Composer. Aucune API
n'accepte de contexte venant de l'application.

```ts
onAddItemCommand(payload: TAddItem, ctx: TFeatureContext<TCartDef, CartEntity>): void {
  ctx.cause; // { id, parentId, originId, originKind, depth } — lecture seule
  ctx.mutate("addItem", (d) => { d.items.push(payload.item); }); // TEntityEvent.context = ctx.cause
  ctx.emit("itemAdded", { item: payload.item });                // parent : cette délivrance
}
```

Le contexte est aussi **joint par le noyau** au `TEntityEvent` (`context`) et
aux erreurs qu'il lève pendant une unité (`TransportError`, `InvariantError` :
champ `context`, `cause` étant la propriété standard `Error.cause`). Une erreur
levée par le code applicatif n'est pas modifiée : son contexte figure dans
l'entrée `unit-failed` de la trace (ADR-05).

## Alternatives rejetées

- **Contexte implicite global** (`this.currentMetas`) — faux dès que deux traitements s'entrelacent ; contraire à « Explicit > Implicit ».
- **Metas forgées par le développeur** (`usr-` / `sys-`, `metas` libre de `ctx.mutate`) — chaîne falsifiable ; un rôle ou un appel de `trigger()` n'établit pas l'indépendance d'un fait.
- **Propagation manuelle `emit(name, payload, { metas })`** — un oubli coupe la chaîne ou crée une origine, ce que G8 interdit ; `ctx` porte déjà le contexte.
- **Type opaque non constructible** — aucune API ne consomme le contexte : rien à protéger, et un type opaque ne prouve rien à lui seul (metas.md §4).
- **Nom `ctx.metas`** — vocabulaire historique ; la théorie parle de contexte causal, et le noyau le nomme déjà `cause`.
- **Compteur `hop` et constante `MAX_HOPS`** — remplacés par la profondeur causale et la borne du Manifest (D9).

## Conséquences

- La causalité tient aussi pour les relais et les résultats corrélés (C.4) : c'est elle qui décide du droit de commander (D18, `NOT_AUTHORIZED`).
- Un handler `async` perd son contexte après le premier `await` : l'unité est close (`NO_UNIT`). Un résultat asynchrone revient par un nouveau message.
- Changement cassant : `TMutationParams.metas` et `TEntityEvent.metas` disparaissent ; `TEntityEvent.context` est obligatoire.
- Le contexte est une donnée de trace et de diagnostic : il n'ouvre aucun droit et ne se transmet à aucune API.
