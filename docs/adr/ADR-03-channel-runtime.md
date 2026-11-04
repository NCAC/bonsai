# ADR-03 — Sémantique d'exécution des messages

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I10, I11, I27, I65, I66 |
| **Livré** | ⚠️ partiel — unités, file différée, ordre et retrait des abonnements livrés par `Root` ; `ErrorReporter` (I65) ⏳ : les échecs passent par la trace et `reportToConsole` (O2) |
| **Spec** | [communication.md §8](../spec/2-architecture/communication.md#8-sémantique-dexécution) · théorie G5, G7, D8, D9, annexe C |

## Contexte

Le typage (ADR-14) élimine la plupart des erreurs de contrat à la compilation.
Restent les cas que le compilateur ne voit pas : contournement du typage, cible
absente, exception dans un handler, ordre des abonnés, abonnements d'un
composant détruit. Il faut une seule règle d'échec et un ordre déterministe.

## Décision

**La frontière d'échec est l'unité de validation** (G7) : chaque délivrance
s'exécute dans sa propre unité ; si elle échoue, ses mutations, émissions,
créations et Commands préparées sont annulées, et ses effets ne sont pas engagés.

| Situation | Comportement |
| --- | --- |
| Command vers un namespace absent ou un message non déclaré | Échec de l'unité (`UNKNOWN_TARGET`, `UNDECLARED_MESSAGE`) |
| Event sans abonné | Silencieux : un fait sans observateur est valide |
| Handler qui lève | Échec de **sa** unité seulement ; l'unité émettrice, déjà validée, reste |
| Query en échec | Échec de l'unité de l'auteur (ADR-02) |
| Ordre des abonnés | Fixé à l'émission (D8, C.6), stable ; chaque abonné dans sa propre unité |
| Profondeur causale au-delà de `causalBound` | Message non délivré, abandon tracé (D9) |
| Replay | Aucun : un nouvel abonné ne reçoit pas les Events passés |
| Abonnements d'un composant détruit | Retirés avec lui ; une délivrance en file vers lui est abandonnée (G3, C.6) |

Les messages différés (Commands, Events, notifications locales) sont délivrés
**après** la validation de l'unité qui les produit, d'un trait (ADR-35).

**Le démarrage est la frontière de confiance** (I66) : `Application.start()`
revérifie le Manifest avant de créer la racine, et un composant n'existe
qu'après lui ; aucun message ne peut donc précéder `start()`.

Les échecs sont écrits dans la **trace** de la racine (`onTrace`) ; en
développement, `reportToConsole` signale ceux que personne ne reçoit.

## Alternatives rejetées

- **Comportement « sans handler » configurable** (`throw` / `warn` / `silent`) — un Command sans destinataire est toujours un bug.
- **Isoler chaque handler en journalisant son erreur** (`ListenerError`, `null` de Query, strate 0) — valide des traitements à moitié faits ; contraire à G7.
- **Abonnés en parallèle** ou **priorités d'abonné** — ordre imprévisible, ou couplage entre abonnés qui devraient s'ignorer.
- **Replay des Events** — l'état durable vit dans l'Entity.

## Conséquences

- Un abonné défaillant ne casse ni l'émetteur ni les autres abonnés, et l'échec est visible dans la trace.
- Les tests restent synchrones : après une admission, toutes les unités qui en découlent sont terminées.
- L'`ErrorReporter` injectable et le hook `onError()` restent à livrer.
