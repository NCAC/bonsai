# Traçabilité et metadonnees causales

> **Déclenchements observables, qualifications d’origine, propagation explicite et borne des segments connus**

[← Retour à l’architecture](README.md) · [← Cycle de vie](lifecycle.md)

> **Statut normatif — V0.9.4, lot 2, 30 octobre 2026.** La [théorie validée](../../theorie.md), notamment C.2–C.4, §9.11, §10, G8 et D9/D18/D19, fait autorité. Ce document décline les contrats du [registre P4](../../invariants/P4.yaml) et les permissions du [registre P3](../../invariants/P3.yaml). Les obligations déjà fixées ne sont pas remises en discussion par les choix de représentation restant ouverts. Les anciens exemples sont conservés dans git ; ils ne sont plus un contrat cible admissible lorsqu’ils coupent ou inventent un lien causal.
>
> **État de réalisation (lots M1 à M6, 1er novembre 2026).** Le noyau (`Root`) établit le contexte causal de chaque message : qualification de l’origine (démarrage, spontanée, inconnue) selon le protocole du monde fermé (C.4), parent unique, profondeur bornée par `causalBound` (D9), droit de commander contrôlé (D18, `NOT_AUTHORIZED`) ; il voyage par le contexte `ctx` du handler ([ADR-04](../../adr/ADR-04-metas-explicites.md)). **Strate 1b (4 novembre 2026)** : les handlers de Feature et de View le lisent par `ctx.cause` (`TCausalContext` gelé) ; le noyau le joint au `TEntityEvent` (`context`) et à ses propres erreurs (`context`) ; le `metas` libre de `ctx.mutate` est retiré. Au registre, I7, I8, I9, I13 et I54 sont livrés.

## 1. Structure des metas

**I7 — Tout message porte le contexte de son déclenchement observable.** Commands, Queries, Events et locaux sont concernés. Une réponse de Query n’est pas un message : elle ne crée ni contexte propre ni nouveau déclencheur.

| Situation | Information exigée par le contrat |
| --- | --- |
| Origine de démarrage | Qualification démarrage, établie par l’infrastructure de communication. |
| Origine spontanée | Indépendance établie selon le protocole de source, sans parent inventé. |
| Origine d’observation | Antécédent inconnu explicite ; absence de parent ne vaut pas preuve d’indépendance. |
| Continuation | Un seul parent de déclenchement établi ; qualification et liens connus conservés. |

Le contexte représente le déclenchement de l’exécution, pas toutes les dépendances historiques des valeurs lues. Lire un état issu d’autres traitements ne fusionne pas leurs origines. Une trace ne doit promettre ni causalité physique exhaustive ni instantané global.

Les champs historiques `messageId`, `correlationId`, `causationId`, `hop`, `origin` et `timestamp` ne constituent pas à eux seuls cette garantie. La structure livrée est `TCausalContext` (`@bonsai/kernel`), gelée par le noyau :

| Champ | Contenu |
| --- | --- |
| `id` | Identifiant du message (ou de la Query). |
| `parentId` | Parent de déclenchement ; `null` pour une origine. |
| `originId` | Identifiant de l’origine de la chaîne. |
| `originKind` | `"startup"`, `"spontaneous"` ou `"unknown"` (C.4). |
| `depth` | Nombre de continuations depuis l’origine (D9) ; origine = 0. |

## 2. Génération des IDs — ULID

**Un identifiant ne prouve aucun lien causal.** Le choix historique ULID de l’[ADR-04](../../adr/ADR-04-metas-explicites.md) peut être conservé comme mécanisme compatible, sous réserve de sa spécification de réalisation ; il n’est pas imposé par la théorie et n’est pas livré.

L’ordre d’un identifiant ou d’un horodatage ne permet de déduire ni le parent d’un fait ni l’ordre de délivrance. D8 fixe cet ordre ; G8 et le protocole de source établissent la corrélation. Proximité temporelle, égalité de valeur, dernier effet demandé et seul indicateur `isTrusted` ne constituent pas des preuves de parenté.

## 3. Préfixes `correlationId` — `usr-` et `sys-`

**I8 — La qualification d’origine relève de l’infrastructure, pas d’un préfixe choisi par l’application.** La distinction historique `usr-`/`sys-` ne représente pas suffisamment le contrat V0.9.4. Un nom de rôle, un événement DOM ou un appel de `trigger()` n’établit pas à lui seul l’indépendance d’un fait.

| Admission selon le protocole déclaré | Qualification obligatoire |
| --- | --- |
| Résultat instrumenté relié sans ambiguïté à une opération déterminée | Continuation du déclencheur conservé. |
| Fait dont le protocole établit l’absence d’antécédent dans le périmètre observé | Origine spontanée. |
| Notification sans antécédent unique ni indépendance établissables | Origine d’observation à antécédent inconnu. |

Le démarrage est établi séparément par G8. Le code applicatif ne choisit aucune de ces qualifications. Un lien connu ne peut être effacé pour créer une origine inconnue ; une origine inconnue ne peut être renommée spontanée pour autoriser une Command.

Dans le profil navigateur, une notification générale de défilement, redimensionnement, focus ou environnement sans identifiant d’opération reste inconnue, sauf protocole établissant corrélation ou indépendance. Le résultat corrélé d’une opération et une notification générale de l’hôte sont deux occurrences distinctes ; le premier ne prouve pas la cause de la seconde.

## 4. Propagation explicite des metas

**I54 — L’infrastructure établit et dérive les métadonnées ; le code applicatif les reçoit et les propage explicitement, sans les fabriquer ni les remplacer.** Ce choix de propagation conserve la partie compatible de l’ADR-04. Il ne prescrit pas encore les signatures publiques ni le stockage interne de l’infrastructure.

Une omission de contexte ne crée jamais implicitement une nouvelle origine. Une réémission, un relais local ou un callback corrélé continue son déclenchement ; leur forme d’enveloppe ne blanchit pas la chaîne. Un type opaque peut aider le compilateur, mais ne prouve seul ni l’authenticité runtime ni la durée de conservation.

### Lecture par `ctx.cause`

**Le handler reçoit `(payload, ctx)` ; `ctx.cause` est le contexte de la délivrance, en lecture seule** ([ADR-04](../../adr/ADR-04-metas-explicites.md)). Tout ce que le handler soumet par `ctx` (`emit`, `trigger`, `query`, `mutate`) est rattaché à ce contexte par le noyau : la propagation est explicite par le paramètre, sans qu’aucune API n’accepte un contexte fourni par l’application. Une signature historique `(payload, metas)` ou `emit(name, payload, { metas })` est donc écartée.

### Decisions rejetees

**Les alternatives déjà exclues par G8 ne sont plus des choix admissibles.**

| Comportement rejeté | Violation |
| --- | --- |
| Nouvelle origine à chaque `trigger()` ou après un oubli de métadonnées | Effacement possible d’un lien connu et remise à zéro de la profondeur. |
| Contexte fabriqué ou parent choisi par le code applicatif | Qualification et rattachement réservés à l’infrastructure. |
| Type opaque considéré comme preuve complète | Contrôle d’origine, conservation et durée de vie non établis par le typage seul. |
| D19 utilisé pour fusionner ou choisir arbitrairement plusieurs parents | V1 sélectionne une notification déjà contextualisée, sans fusion de déclencheurs. |

### Création de nouvelle correlation (cas système)

**Un callback instrumenté continue l’opération qui l’a armé.** Réponse réseau, expiration de minuterie et résultat propre d’un effet conservent leur rattachement. Ils ne deviennent pas des origines système à chaque rappel. Le contexte de démarrage est, lui, établi par l’infrastructure selon G8.

## 5. Cycle de vie des metas

**G8 et C.2 — Le contexte d’une opération corrélable est conservé jusqu’au résultat attendu, à l’annulation ou à la clôture de son occurrence de vie, même après un échec.** Une opération répétitive le conserve jusqu’à son annulation ou à cette clôture.

| Transition | Règle de conservation |
| --- | --- |
| Traitement produisant un message | Le message continue son déclencheur, avec un parent établi hors origine. |
| Query imbriquée puis retour | Le traitement consulté reste en lecture seule ; le contexte de l’auteur est restitué, non remplacé par celui de la cible. |
| Message émis reçu par plusieurs composants | Les branches continuent le même Event ; le nombre d’abonnés n’ajoute pas de profondeur. |
| Minuterie répétitive armée une fois | Les expirations sont sœurs, rattachées à cet armement. |
| Réarmement dans une réaction | Le nouvel armement continue cette réaction et peut conduire à atteindre D9. |
| Résultat d’effet après validation | Continuation corrélée, visant l’occurrence vivante concernée ; ni transfert au créateur ni réveil d’un remplaçant. |
| Sélection D19 | Conservation du contexte et de la qualification de la notification retenue, y compris inconnue. |

Une destruction validée clôt les occurrences concernées ; un callback tardif est écarté avant admission. Une destruction provisoire attend l’issue de l’unité : son annulation conserve la même occurrence, sans nouvelle création. Ces contrôles ne sont pas réalisés par le simple maintien d’un `correlationId` dans une closure.

## 6. Garde-fous mecaniques

**I9 — La borne du Manifest est commune à la racine et contrôlée avant toute soumission au transport.** Elle concerne Commands, Queries, Events et locaux. Les branches d’un Event sont contrôlées avant toute réservation ; le nombre d’abonnés n’incrémente pas leur profondeur. Le contrôle D9 n’est pas reporté à la délivrance d’un message accepté.

| Point du refus D9 | Conséquence obligatoire |
| --- | --- |
| Pendant un traitement ou une initialisation | Erreur de transport propagée selon G7 ; échec de l’unité extérieure, rollback interne, abandon des différés et aucun engagement de ses effets préparés. Une récupération locale ne permet pas de valider l’unité. |
| Au préambule d’une admission, notamment résultat post-validation | Aucun traitement applicatif ; occurrence abandonnée et signalée techniquement, sans révoquer une unité validée ni annuler ses effets passés. |

Le signalement technique est hors transport applicatif ; il ne crée ni message ni origine pour contourner la borne. La valeur de la borne vient du Manifest (§16.9) ; le nom de propriété public, sa représentation numérique et son éventuelle valeur par défaut restent à spécifier. Le point normatif de configuration n’est donc plus une question ouverte.

La borne limite **la profondeur des segments connus**, pas la largeur, le travail total, la terminaison ou les boucles physiques traversant une coupure non corrélable. Un segment d’observation inconnue ne peut être créé arbitrairement pour repartir à zéro. La FIFO et la profondeur de notification Entity d’I98 ne réalisent pas cette garde de transport.

## 7. API d'implementation

**Les mécanismes doivent satisfaire les contrats ci-dessus avant d’être présentés comme une API conforme.** Réalisation livrée : `ctx.cause` dans les contextes de handler (ADR-04), `TEntityEvent.context`, champ `context` de toute `BonsaiError` levée pendant une unité ou une Query (ADR-05) — l’erreur la plus interne gagne, une erreur levée par le code applicatif n’est pas modifiée et son contexte figure dans l’entrée `unit-failed` de la trace.

### 7.1 Création au point d'entree

**Le point de qualification est l’admission contrôlée, pas chaque appel de `trigger()`.** Le protocole de source fixe l’unité de notification et sa corrélation. La capture technique ne mute pas l’état applicatif ; le traitement local intègre ensuite l’observation. Une propagation entre écouteurs ne constitue pas un nouveau fait.

### 7.2 Dérivation des metas enfant

**Une continuation conserve un parent établi et ne change pas la qualification pour gagner une permission.** Toute Command de l’interface doit être vérifiée selon I13/D18 : fait admis d’indépendance établie ou continuation corrélée déjà autorisée, dans les limites du rôle.

- ✅ Une View dans une réaction autorisée consulte le domaine, puis adresse une Command : le retour de Query conserve sa permission.
- ❌ Un Event, son relais local ou le résultat d’un effet qu’il a provoqué déclenche une Command de l’interface : aucun de ces passages n’accorde cette permission.
- ❌ Une observation inconnue devient un clic supposé indépendant ou une nouvelle origine système : ni parenté ni permission ne peuvent être inventées.

Le traitement de Query reste lui-même en lecture seule. La réponse n’est pas un déclencheur autonome. Un Composer n’adresse jamais de Command, même lors d’un résultat propre instrumenté ; les autres restrictions de rôle restent cumulatives.

### 7.3 Invariants API des metas

**Le registre est la source opérationnelle ; les états suivants ne sont pas des preuves de livraison.**

| ID | Obligation | État |
| --- | --- | --- |
| I7 | Contexte de chaque message et local, parent hors origine et qualification explicite. | `livre`, `run` |
| I8 | Qualification contrôlée et sincérité des liens, y compris sélection D19. | `livre`, `run` |
| I9 | Borne à la soumission et conséquences distinctes des refus. | `livre`, `run` |
| I54 | Établissement, propagation explicite, conservation et restitution du contexte. | `livre`, `run` |
| I13 | Permission dynamique D18 dans toute l’interface. | `livre`, `run` |
| I25 | Capacités selon les parties ; Feature vers adaptateur domaine permise, pas vers autre Feature ; Behavior imputé à View et Composer sans Command. | `partiel`, `run` |

Pour I25, le domaine n’adresse rien à un adaptateur de l’interface et n’en reçoit rien (A4.b). Les capacités actuelles de View et certaines interdictions statiques constituent seulement une réalisation partielle ; le protocole d’adaptateur et les gardes dynamiques restent absents.

## Lecture suivante

→ [Distribution](distribution.md) · [Suivi de migration V0.9.4](../../rapports/migration-invariants-runtime-V0.9.4-2026-10-30.md)
