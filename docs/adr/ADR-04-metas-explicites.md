# ADR-04 — Contexte causal établi par le noyau, porté par le contexte du handler

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I7, I8, I9, I54 |
| **Livré** | ⚠️ partiel — `Root` établit le contexte causal de chaque message (qualification de l'origine, parent unique, profondeur, G8) et borne la profondeur (`causalBound`, D9) · ⏳ strate 1b : contexte lisible par les handlers et joint aux erreurs ; `ctx.mutate` accepte encore un `metas` libre et optionnel (`Record<string, unknown>`), recopié dans le `TEntityEvent` |
| **Spec** | [metas.md](../spec/2-architecture/metas.md) · théorie G8, C.4, D9 |

## Contexte

En chorégraphie (ADR-01), une action de l'utilisateur déclenche une cascade
Command → Event → Event… à travers plusieurs Features. Sans contexte causal,
impossible de relier un effet à sa cause, de borner une boucle, de décider si
une réaction a le droit de commander (D18), ou d'alimenter DevTools et rejeu.
La question : qui établit ce contexte, et comment voyage-t-il ?

## Décision

**Le noyau établit le contexte** de chaque message (G8) ; le code applicatif ne
le fabrique ni ne le remplace (I8, I54).

- **Origine** : démarrage, fait indépendant (origine spontanée) ou antécédent inconnu, qualifiée par le protocole du monde fermé (C.4), jamais par un préfixe choisi par l'application.
- **Continuation** : tout message soumis par un handler a exactement un parent, la délivrance qui l'a déclenché (I7).
- **Profondeur** : chaque continuation l'incrémente ; au-delà de `causalBound`, le message n'est pas délivré (I9, D9).

**Le contexte voyage par le paramètre explicite du handler** (`ctx`), propre à
son unité de validation. Tout ce qui est soumis par `ctx` lui est rattaché : la
propagation est explicite par construction, et un oubli ne peut pas couper la
chaîne.

```ts
onAddItemCommand(payload: TAddItem, ctx: TFeatureContext<TCartDef, CartEntity>): void {
  ctx.mutate("addItem", (d) => { d.items.push(payload.item); });
  ctx.emit("itemAdded", { item: payload.item });   // parent : cette délivrance, profondeur + 1
}
```

**Cible (strate 1b)** : le handler lit ce contexte (`ctx.metas`, type opaque
non constructible) pour le tracer ou le joindre à une erreur (ADR-05), sans
pouvoir le modifier.

## Alternatives rejetées

- **Contexte implicite global** (`this.currentMetas`) — faux dès que deux traitements s'entrelacent ; contraire à « Explicit > Implicit ».
- **Metas forgées par le développeur** (`usr-` / `sys-`) — chaîne falsifiable ; un rôle ou un appel de `trigger()` n'établit pas l'indépendance d'un fait.
- **Propagation manuelle `emit(name, payload, { metas })`** (décision initiale) — un oubli coupe la chaîne ou crée une origine, ce que G8 interdit ; `ctx` porte déjà le contexte.
- **Compteur `hop` et constante `MAX_HOPS`** — remplacés par la profondeur causale et la borne du Manifest (D9).

## Conséquences

- La causalité tient aussi pour les relais et les résultats corrélés (C.4) : c'est elle qui décide du droit de commander (D18, `NOT_AUTHORIZED`).
- Un handler `async` perd son contexte après le premier `await` : l'unité est close (`NO_UNIT`). Un résultat asynchrone revient par un nouveau message.
- Les erreurs (ADR-05) et la trace porteront le contexte du message fautif ; la trace le porte déjà.
- Le `metas` libre de `ctx.mutate` devra disparaître au profit du contexte établi.
