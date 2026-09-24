# ADR-01 — Communication : Channels tri-lane déclaratifs, chorégraphie pure

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I1, I2, I3, I4, I10, I11, I12, I13, I14, I15, I16, I17, I25, I26, I27 |
| **Livré** | ⚠️ partiel — `Feature.request()` accepte tout token, sans contrôle contre `queries` (I14, I16) |
| **Spec** | [communication.md](../spec/2-architecture/communication.md) |

## Contexte

Les composants doivent communiquer sans se connaître, et chaque dépendance de
communication doit être **visible dans la déclaration** du composant, pour être
vérifiable par le compilateur, et non cachée dans son implémentation.

## Décision

**Un Channel par namespace**, porté par la Feature propriétaire, avec trois lanes
de sémantique distincte :

| Lane | Envoi | Réception | Cardinalité | Nature |
| --- | --- | --- | --- | --- |
| Command | `trigger()` — View, Behavior | handler unique de la Feature propriétaire | 1:1 (I10) | intention, **refusable** (I27) |
| Event | `emit()` — Feature propriétaire seule | N listeners | 1:N (I11) | fait accompli, irréfutable |
| Request | `request()` — tout composant déclarant | replier unique de la Feature propriétaire | 1:1 synchrone (ADR-02) | lecture, sans side-effect |

**Les 5 capacités d'une Feature**, et seulement elles :

1. **emit** sur son propre Channel (I1, I12) ;
2. **handle** les Commands de son propre Channel ;
3. **listen** les Events des Channels **déclarés** (I2) ;
4. **reply** sur son propre Channel (I3) ;
5. **request** sur les Channels **déclarés**, en lecture seule (I17).

Les Views et Behaviors peuvent `trigger`, `listen` et `request` sur leurs Channels
déclarés, **jamais `emit`** (I4). La View est un point d'entrée et de projection :
la causalité métier n'y transite pas (I13).

**Chorégraphie pure** : pas de Feature orchestratrice. Chaque Feature réagit de
manière autonome aux Events ; les metas (ADR-04) rendent la chaîne causale traçable.

**Radio est interne** : aucun code applicatif n'y accède (`@bonsai/core` ne
l'exporte pas, I15). Toute interaction passe par une déclaration (I14) ; un accès
non déclaré est une erreur (I16).

## Alternatives rejetées

- **Radio public** (`Radio.channel('cart')` depuis n'importe où) — couplages cachés, invariants non vérifiables à la compilation.
- **`trigger()` unique pour Commands et Events** — confond intention et fait ; empêche la règle « seule la Feature propriétaire diffuse ».
- **Feature orchestratrice (ProcessFeature)** — sous-type privilégié, couplage centralisé.
- **Typologie de Features (Domain / Integration / UI)** — aucune différence structurelle réelle, rigidité inutile.
- **Interdire le request cross-domain** — forcerait chaque Feature à dupliquer le state des autres (cache local désynchronisé).

## Conséquences

- Les frontières sont typées (ADR-14) : `emit` n'existe pas sur View ; un nom de message hors contrat ne compile pas (I76).
- Une Feature expose ce qu'elle veut via ses repliers : le request cross-domain ne viole pas l'encapsulation.
- Un Event émis sans listener est silencieux (valide). Un Command sans handler lève `NoHandlerError` (ADR-03).
