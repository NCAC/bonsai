# ADR-01 — Communication : Channels à trois voies déclaratifs, chorégraphie pure

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I1, I2, I3, I4, I10, I11, I13, I14, I15, I16, I17, I25, I27 |
| **Livré** | ⚠️ partiel — le `ctx.query` d'une Feature n'est pas contrôlé contre ses `queries` : elle peut interroger un jeton qu'elle n'a pas déclaré (I14, I17) |
| **Spec** | [communication.md](../spec/2-architecture/communication.md) |

## Contexte

Les composants doivent communiquer sans se connaître, et chaque dépendance de
communication doit être **visible dans la déclaration** du composant, pour être
vérifiable par le compilateur, et non cachée dans son implémentation.

## Décision

**Un Channel par namespace**, porté par la Feature propriétaire, avec trois voies
de sémantique distincte :

| Voie | Envoi | Réception | Cardinalité | Nature |
| --- | --- | --- | --- | --- |
| Command | `ctx.trigger()` — View, Behavior, depuis un fait de l'hôte (D18) | `on{Nom}Command` de la Feature propriétaire | 1:1 (I10) | intention, **refusable** (I27) |
| Event | `ctx.emit()` — Feature propriétaire seule | N abonnés présents à l'émission (D8) | 1:N (I11) | fait accompli |
| Query | `ctx.query()` — tout composant déclarant | `on{Nom}Query` de la Feature propriétaire | 1:1 synchrone (ADR-02) | lecture, sans effet (A3.g) |

**Les capacités d'une Feature**, et seulement elles : émettre sur son propre
Channel (I1), traiter ses Commands, écouter les Events des Channels **déclarés**
en `listens` (I2), répondre à ses Queries (I3), interroger les Channels déclarés
en `queries`, en lecture seule (I17). Elle n'adresse **aucune** Command (D17).

Les Views et Behaviors commandent, écoutent et interrogent leurs Features
déclarées, **jamais `emit`** (I4). La View est un point d'entrée et de
projection : la causalité métier n'y transite pas (I13).

**Chorégraphie pure** : pas de Feature orchestratrice. Chaque Feature réagit de
manière autonome aux Events des autres.

**L'acheminement est interne** : la racine du noyau (`Root`, `@bonsai/kernel`,
une par Application) transporte les messages ; aucun code applicatif n'y accède
(`@bonsai/core` ne l'exporte pas, I15). Toute interaction passe par une
déclaration (I14) ; un message hors contrat fait échouer l'unité (I16,
`UNDECLARED_MESSAGE`).

```ts
onAddItemCommand(payload: TCartItem, ctx: TFeatureContext<TCartDef, CartEntity>): void {
  ctx.mutate("addItem", (draft) => { draft.items.push(payload); });
  ctx.emit("itemAdded", { item: payload });   // délivré après validation de l'unité (G5)
}
```

## Alternatives rejetées

- **Bus public** (accès à n'importe quel Channel depuis n'importe où) — couplages cachés, invariants non vérifiables à la compilation.
- **Une seule méthode pour Commands et Events** — confond intention et fait ; empêche la règle « seule la Feature propriétaire diffuse ».
- **Feature orchestratrice (ProcessFeature)** — sous-type privilégié, couplage centralisé.
- **Typologie de Features (Domain / Integration / UI)** — aucune différence structurelle réelle, rigidité inutile.
- **Interdire la Query entre domaines** — forcerait chaque Feature à dupliquer l'état des autres (cache local désynchronisé).

## Conséquences

- Les frontières sont typées (ADR-14) : `emit` n'existe pas sur une View ; un nom de message hors contrat ne compile pas (I76).
- Une Feature expose ce qu'elle veut par ses Queries : la lecture entre domaines ne viole pas l'encapsulation.
- Un Event sans abonné est silencieux (valide). Un Command vers une cible absente ou non déclarée fait échouer l'unité (ADR-03).
