# ADR-03 — Sémantique runtime du Channel

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I10, I11, I27, I65, I66 |
| **Livré** | ⚠️ partiel — lanes livrées ; `ErrorReporter` (I65), rejet avant `start()` (I66) et nettoyage au démontage ⏳ |
| **Spec** | [communication.md](../spec/2-architecture/communication.md) |

## Contexte

Le typage (ADR-14) élimine la plupart des erreurs de contrat à la compilation :
handler manquant, payload incorrect, Channel non déclaré. Restent les cas que le
compilateur ne voit pas : contournement du typage, chargement paresseux (ADR-27),
exceptions dans les handlers, ordre et nettoyage des abonnements.

## Décision

| Situation | Comportement |
| --- | --- |
| Second `handle()` ou `reply()` pour le même message | `DuplicateHandlerError` au bootstrap (I10) |
| `trigger()` sans handler | `NoHandlerError`, en dev comme en prod |
| `emit()` sans listener | silencieux : un fait sans observateur est valide |
| Listener qui throw | `ListenerError` journalisée ; les listeners suivants s'exécutent |
| `request()` sans replier | `null` (ADR-02) |
| Replier qui throw | `null` ; l'erreur n'est **jamais silencieuse** : journalisée, puis remontée à un `ErrorReporter` injectable (I65) |
| Ordre des listeners | séquentiel, dans l'ordre d'abonnement, synchrone |
| Replay | aucun : un nouveau listener ne reçoit pas les Events passés |
| Nettoyage | automatique : le framework désabonne au démontage du composant, jamais le développeur |

Après chaque `emit()`, le Channel diffuse aussi l'événement technique `any`
(`{ event, changes }`), consommé par la souscription des Views (ADR-26).

**`start()` est la frontière de confiance** (I66). Avant, aucune garantie ; après,
les garanties compile-time contournables sont revérifiées. Un message envoyé avant
`start()` doit être rejeté.

Implémentation interne : un `RxJS.Subject` par event. Le choix de bibliothèque
n'est pas exposé.

## Alternatives rejetées

- **Comportement « no handler » configurable** (`throw` / `warn` / `silent`) — ajoute un réglage sans cas d'usage : un Command sans handler est toujours un bug.
- **Timeout de Request** — sans objet depuis la Request synchrone (ADR-02).
- **Listeners parallèles** ou **priorités de listener** — ordre imprévisible, ou couplage entre listeners qui devraient s'ignorer.
- **Replay des Events** — les Events sont fire-and-forget ; l'état durable vit dans l'Entity.

## Conséquences

- Un listener défaillant ne casse pas la chorégraphie, mais l'erreur est visible.
- ⚠️ Aujourd'hui les erreurs de replier et de listener ne passent que par `console.error` : l'`ErrorReporter` et le mode strict (throw en test) restent à livrer.
- ⚠️ **Fuite connue** : `Composer#detachCurrent()` libère la référence à la View, mais ne désabonne ni ses listeners Channel (`ch.listen`) ni ses listeners DOM, et n'appelle pas `onDetach()`. Une View remplacée continue de réagir aux Events.
