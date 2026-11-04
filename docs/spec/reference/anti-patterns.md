# Anti-patterns

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (4 novembre 2026).** La colonne « Détection » distingue ce que le compilateur ou le noyau refusent aujourd'hui de ce qui reste affaire de revue. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Les patterns explicitement INTERDITS dans Bonsai**

[← Retour à l'index](../README.md) · [Invariants](invariants.md) · [ADR](../../adr/README.md)

---

Les anti-patterns sont les patterns **explicitement INTERDITS** dans Bonsai.
Pour chaque anti-pattern : description, danger, invariant violé, alternative correcte,
et **détection** (compile-time, bootstrap ou runtime).

> **Convention de détection** :
>
> - `[Compile]` — erreur TypeScript avant l'exécution. Zéro coût runtime.
> - `[Bootstrap]` — erreur levée au démarrage (`app.start()`). Bloque l'application si non corrigée.
> - `[Runtime]` — refus du noyau pendant l'exécution (`TransportError`, code stable) : l'unité de l'auteur échoue et est défaite (G7), l'échec est écrit dans la trace avec son contexte causal.
> - `[Code review]` — pattern non détectable mécaniquement en v1. À enforcer par convention et outillage de lint.

---

## Table des matières

1. [Smart View](#-smart-view)
2. [Cross-domain Trigger](#-cross-domain-trigger)
3. [Cross-domain Emit](#-cross-domain-emit)
4. [Double Handler](#-double-handler)
5. [Entity leaking](#-entity-leaking)
6. [God Feature](#-god-feature)
7. [Meta-driven logic](#-meta-driven-logic)
8. [Root Direct Access](#-root-direct-access)
9. [Undeclared Channel Usage](#-undeclared-channel-usage)
10. [Stateful View / Stateful Behavior](#-stateful-view--stateful-behavior-domain-state-ou-state-ad-hoc)
11. [Excessive View Inheritance](#-excessive-view-inheritance)
12. [Async Query Handler](#-async-query-handler)
13. [Async in Concrete Layer](#-async-in-concrete-layer)

---

### ❌ Smart View

**Description** : View qui orchestre le métier (reçoit un Event → adresse une Command).

**Pourquoi c'est dangereux** : La View devient un orchestrateur implicite, la causalité métier y transite.

**Viole** : I13, D18

**Détection** : `[Compile]` + `[Runtime]` — le contexte d'un handler d'Event (`TEventContext`) n'a pas de `trigger` : l'appel ne compile pas. Un contournement (`as any`) est refusé par le noyau (`NOT_AUTHORIZED`) : seule une admission indépendante d'un fait du DOM donne le droit de commander (D18, C.4). Reste `[Code review]` : une décision métier prise dans le handler d'un fait (calcul, branchement sur l'état du domaine) avant la Command.

**Alternative** : La View reçoit des Events pour projeter (`getUI`), et commande depuis le handler d'un fait du DOM. La décision métier est dans la Feature.

---

### ❌ Cross-domain Trigger

**Description** : Feature A qui envoie un Command (trigger) sur le Channel de Feature B.

**Pourquoi c'est interdit** :

- Une Feature n'adresse jamais de Command : son contexte n'a pas de `trigger` (D17, I25)
- Les Features communiquent via emit (Events) + listen, jamais via Commands
- Crée un couplage impératif entre Features
- Détruit l'autonomie chorégraphique

**Viole** : I25, ADR-01

**Détection** : `[Compile]` + `[Runtime]` — `TFeatureContext` n'a pas de `trigger` ; un contournement est refusé par le noyau (`NOT_AUTHORIZED` : une Feature n'est pas un composant de l'interface).

**Alternative** : Feature A émet un Event (emit) sur son propre Channel, Feature B écoute cet Event (listen) et réagit de manière autonome.

---

### ❌ Cross-domain Emit

**Description** : Feature A qui émet un Event (emit) sur le Channel de Feature B.

**Pourquoi c'est interdit** :

- Viole I1 (emit uniquement sur son propre Channel)
- Usurpe l'identité d'une autre Feature
- Rend le graphe causal incohérent

**Viole** : I1

**Détection** : `[Compile]` + `[Runtime]` — `ctx.emit()` n'accepte que les clés de `TChannel['events']` du Channel propre, et le noyau émet toujours sur le Channel de l'auteur : un Event absent de son token est refusé (`UNDECLARED_MESSAGE`, D16), une émission sans Channel propre aussi (`NOT_OWNER`).

**Alternative** : Feature A émet sur SON propre Channel, Feature B écoute si elle le souhaite.

---

### ❌ Double Handler

**Description** : Plusieurs Features qui réagissent au même Command.

**Pourquoi c'est dangereux** : Un Command a par définition un seul handler (la Feature propriétaire). Deux handlers = ambiguïté sur qui traite.

**Viole** : I10

**Détection** : `[Compile]` + `[Bootstrap]` — impossible par construction : une Command appartient au Channel d'une seule Feature (un namespace = une Feature, I21), et son handler est la méthode `on{Cmd}Command`, unique par nom. Deux Channels vivants du même namespace dans une racine sont refusés (`DUPLICATE_NAMESPACE`) ; un manifest littéral ne peut pas porter deux fois la même clé (TS1117).

**Alternative** : Un seul handler par Command. Si plusieurs composants doivent réagir, utiliser un Event (1:N) au lieu d'un Command (1:1).

---

### ❌ Entity leaking

**Description** : Entity accessible en dehors de sa Feature propriétaire.

**Pourquoi c'est dangereux** :

- Brise l'encapsulation
- Permet des mutations non contrôlées
- Rend impossible la traçabilité des changements

**Viole** : I6

**Détection** : `[Compile]` + `[Runtime]` — `entity` est un getter `protected` de la Feature : tout accès externe produit `TS2445`. Les types `View`, `Composer` n'ont pas de propriété `entity`. À l'exécution, `entity.state` n'est lisible que pendant un handler de la Feature, et l'état n'est modifiable que par `ctx.mutate`. Preuves : `tests/types/strate-0/encapsulation.types.test.ts`, `tests/unit/domain/feature.test.ts`.

**Alternative** : La Feature expose son état par ses handlers de Query (C4) ; les consommateurs l'interrogent par `ctx.query` (C5).

---

### ❌ God Feature

**Description** : Feature fourre-tout qui gère trop de responsabilités.

**Pourquoi c'est dangereux** :

- Viole le principe de responsabilité unique
- Rend les tests impossibles
- Crée un point de couplage central

**Détection** : `[Code review]` — pas de critère mécanique v1. Indicateurs : nombre de Commands > 10, nombre d'écoutes croisées > 5, couverture de test difficile.

**Alternative** : Découper en plusieurs Features avec des responsabilités claires (voir Bonsai Style Guide).

---

### ❌ Meta-driven logic

**Description** : Logique métier qui branche sur les metas (origin, hop, correlationId).

**Pourquoi c'est dangereux** :

- Les metas sont pour la traçabilité, pas pour la logique métier
- Crée des comportements imprévisibles
- Casse le principe de découplage

**Viole** : principe de traçabilité des metas (cf. [metas.md](../2-architecture/metas.md) — ⏳ cible strate 1b, non livré)

**Détection** : `[Code review]` — le contexte causal est créé par le noyau (G8) et n'est pas encore exposé au code applicatif (`ctx.metas`, strate 1b, ADR-04). Quand il le sera, tout branchement (`if (metas.origin…)`) dans la logique métier sera un signal d'alarme.

**Alternative** : La logique métier branche sur le payload du message, jamais sur les metas.

---

### ❌ Root Direct Access

**Description** : Accéder à la racine du noyau (`Root`, `@bonsai/kernel`) depuis du code applicatif pour adresser, écouter ou interroger un Channel au lieu de le déclarer dans la définition du composant.

**Pourquoi c'est dangereux** :

- Couplages cachés dans l'implémentation, invisibles dans la définition
- Impossible de vérifier les invariants à la compilation
- Le composant contourne les contrôles du noyau sur les Channels déclarés (A3, D16)
- Le graphe de communication n'est pas lisible statiquement

**Viole** : I14, I15, I16

**Détection** : `[Compile]` — `Root` n'est pas exporté par `@bonsai/core`, seule surface applicative : `import { Root } from "@bonsai/core"` produit `TS2305` (« Module '"@bonsai/core"' has no exported member 'Root' »). `Root` est exporté par `@bonsai/kernel` pour l'usage inter-packages du framework, et l'importer depuis du code applicatif viole la convention d'import (cf. [distribution.md §4](../2-architecture/distribution.md#4-topologie-des-packages-adr-28)) — `[Code review]`. Preuve : `tests/types/strate-0/encapsulation.types.test.ts`.

**Alternative** : Déclarer les Channels externes dans `get listens()`/`get queries()` (Feature, ADR-09) ou dans `get features()` (View, Composer, ADR-14), et passer par le contexte du handler.

---

### ❌ Undeclared Channel Usage

**Description** : Utiliser un Channel dans le corps d'un composant sans l'avoir déclaré dans sa définition (`get listens()`/`get queries()` pour une Feature, `get features()` pour une View ou un Composer).

**Pourquoi c'est dangereux** :

- Dépendance invisible → couplage implicite
- Le composant semble autonome mais ne l'est pas
- Impossible à détecter sans exécuter le code

**Viole** : I14, I16, I70

**Détection** : `[Compile + Bootstrap]` partielle — compile : `ctx.trigger()`/`ctx.query()` d'une View ou d'un Composer n'acceptent qu'une clé référencée par `get features()` (I77) ; ⚠️ `ctx.query()` d'une Feature accepte **n'importe quel** `TChannelToken` (I79) et le noyau ne compare pas encore l'appel à `get queries()` : un Channel non déclaré y passe (I17, partiel). Bootstrap (Phase 0c) : si `listens`/`queries` référence un namespace absent du manifest, `Application.start()` lève une `BonsaiNamespaceError` — message réel (`packages/application/src/bonsai-application.ts`) : `Feature "{ownNs}" declares unknown channel "{ref}". Known namespaces: {...}` — pas le message générique montré dans les versions antérieures de cette entrée.

**Alternative** : Toujours déclarer le Channel dans `get listens()`/`get queries()`/`get features()`.

---

### ❌ Stateful View / Stateful Behavior (domain state ou state ad hoc)

**Description** : View ou Behavior qui maintient un **domain state** local ou un **state ad hoc** non déclaré via le mécanisme framework (`this.isOpen`, `this.selectedIndex`, `this.data`). Cela inclut toute propriété mutable posée directement sur la classe sans passer par le mécanisme `localState` du framework.

**Pourquoi c'est interdit** :

- Le **domain state** (données métier, données partagées) dans une View crée une concurrence d'états avec les Entities
- Un state **ad hoc** (propriété `this.xxx` classique) est invisible, non réactif, non typé par le framework — impossible à tracer, tester ou migrer
- Un autre composant _pourrait_ avoir besoin de cette donnée (analytics, persistance, dépendances inter-composants)
- Détruit le flux unidirectionnel si le state est du domain state

**Viole** : I6, I30

**Alternative** :

- **Donnée partagée / domain state** → Créer une Feature dédiée (ex: `ModalUiFeature`, `SliderUiFeature`). La View trigger un Command, la Feature modifie son Entity, la View écoute l'Event et se met à jour.
- **Donnée purement locale à la View** → Utiliser le mécanisme **`localState`** du framework (I42, ADR-17) : déclaratif, typé, réactif, encapsulé, non-broadcastable. **Jamais** de `this.xxx = value` ad hoc.

> **⚠️ Critère de migration** : si un localState doit être observé par un autre composant (autre View, Behavior, Feature), il **DOIT** être migré vers Feature + Entity. Le localState est strictement intra-View.

**Détection** : `[Code review]` — `localState` est une cible strate 2a ([ADR-17](../../adr/ADR-17-local-state.md)) ; aucun garde-fou contre les propriétés `this.xxx` ad hoc n'existe. Une propriété mutable de View n'est pas journalisée : l'échec d'une unité ne la restaure pas (G7 ne la couvre pas).

---

### ❌ Excessive View Inheritance

**Description** : Créer des sous-classes de View pour des variations mineures (layout, config) au lieu d'utiliser les mécanismes prévus : View + options (ADR-21) pour la réutilisation d'un même composant, Behavior (ADR-21) pour l'ajout de capacités orthogonales.

> ⚠️ **« View + options » est partiellement livré** : un Composer passe des
> **paramètres de création** à une View (`{ view, key, params }` dans
> `TComposition`, lus par `this.params` dans un handler) ; la surcharge des
> `uiElements` ou d'autres options de la View par le Composer (ADR-21) reste
> une cible strate 2.

**Pourquoi c'est dangereux** :

- Prolifération de classes pour des différences cosmétiques
- Hiérarchie d'héritage fragile — une modification dans la classe parent casse les enfants
- Mélange de logiques de configuration et de logiques métier
- Rend les Behaviors inutilisables (un Behavior ne peut pas connaître la hiérarchie)

**Viole** : ADR-21

**Détection** : `[Code review]` — pas de mécanisme mécanique v1. Indicateurs : chaine d'héritage > 2 niveaux entre Views, sous-classes de View sans override de template.

**Alternative** : Utiliser l'algorithme de décision ADR-21 :

- Q0 : Sert de base de composition → View
- Q1 : Même View, contexte différent → View + options
- Q2 : Capacité orthogonale → Behavior
- Q3/Q4 : Altération template principal → seul cas légitime d'héritage

---

### ❌ Async Query Handler

**Description** : Un handler de Query (`on{Name}Query`) qui effectue un appel asynchrone (`fetch`, `await`, `Promise`) pour construire sa réponse.

**Pourquoi c'est interdit** :

- Une Query est une **lecture synchrone d'un état déjà matérialisé** (G5) : elle ne rééchantillonne pas l'hôte (C.5). Si le handler a besoin d'être async, l'état n'est pas encore dans l'Entity — problème d'ordre de démarrage (C.1), pas de sémantique de Query
- Détruit la sémantique du tri-lane : `trigger()` = `void`, `emit()` = `void`, `query()` = `T` (immédiat)
- Un handler de Query est en lecture seule (A3.g) : il ne peut produire aucun effet

**Viole** : ADR-02, G5, I29, I64

**Détection** : `[Compile]` + `[Runtime]` partiels — marquer le handler `async` change son retour en `Promise<T>`, ce qui viole la signature exigée par `implements TFeatureCallbacks<…>` → `TS2416`. À l'exécution, un résultat de `fetch` utilisé plus tard ne peut plus rien faire : le contexte est hors de son unité (`NO_UNIT`, A5.a). Un `fetch()` lancé sans être attendu reste `[Code review]`.

**Alternative** : Charger la donnée par une opération de la Feature dont le résultat revient comme un message (⏳ adaptateurs d'opérations, D7), la stocker dans l'Entity, puis la Query lit l'état synchrone.

```typescript
// ❌ Anti-pattern : fetch dans le handler de Query — TS2416 (async → Promise<T>)
async onTotalQuery(_params: null, _ctx: TFeatureQueryContext): Promise<number> {
  const response = await fetch("/api/cart/total");
  return response.json();
}

// ✅ Pattern correct : la donnée est déjà dans l'Entity
onTotalQuery(_params: null, _ctx: TFeatureQueryContext): number {
  return this.entity.state.total; // lecture synchrone
}
```

---

### ❌ Async in Concrete Layer

**Description** : View, Behavior, Foundation ou Composer qui exécute directement du code asynchrone (`fetch()`, `async/await`, `Promise`, `setTimeout`, `setInterval`, `XMLHttpRequest`, `WebSocket.send()`).

**Pourquoi c'est interdit** :

- La couche concrète **projette** un état et **émet des intentions** — elle ne produit pas de side-effects
- L'async crée un état implicite (pending/resolved/rejected) non traçable par le framework
- Détruit le flux unidirectionnel : la View devient un acteur autonome au lieu d'un projecteur passif
- Rend impossible la traçabilité causale (metas) : un `fetch` dans une View n'a pas de chaîne causale
- Le résultat du `fetch` ne peut pas transiter par le Channel system — l'état résultant est invisible pour le reste de l'application

**Viole** : ADR-02 (conséquences 1 et 2), A5.a, I13, I30

**Détection** : `[Runtime]` partiel + `[Code review]` — un contexte, `getUI` ou `params` utilisé après son unité (callback de `fetch`, de `setTimeout`) est refusé (`NO_UNIT`, A5.a) : rien de ce que fait le callback n'atteint le modèle. Le lancement lui-même n'est pas détectable au compile-time. Enforçable par :

- Convention d'équipe et code review
- Règle ESLint custom (future) : détecter `fetch`, `async`, `await`, `new Promise`, `setTimeout`, `setInterval` dans les fichiers `*.view.ts`, `*.behavior.ts`, `*.foundation.ts`, `*.composer.ts`

**Alternative** : La View commande (`ctx.trigger`) depuis le handler du fait ; la Feature décide, mute son Entity, émet un Event ; la View projette à la réception. Une opération réellement asynchrone de l'hôte (requête, minuterie) relève d'un adaptateur dont le résultat revient comme un message corrélé (D7, C.4 ; ⏳ non livré hors historique).

```typescript
// ❌ Anti-pattern : fetch dans une View
class ServiceListView extends View<TServiceListViewContract> {
  async onRefreshButtonClick(_fact: TFact): Promise<void> {
    const response = await fetch('/api/services'); // ⚠️ async dans une View !
    const services = await response.json();
    this.renderServices(services); // ⚠️ mutation directe sans Entity !
  }
}

// ✅ Pattern correct : une Command depuis le handler du fait — clé plate (I80)
class ServiceListView extends View<TServiceListViewContract> {
  onRefreshButtonClick(_fact: TFact, ctx: TFactContext<TServiceListViewContract>): void {
    ctx.trigger("services:refresh", null);
    // la View projettera à la réception de l'Event services:listLoaded
  }
}
```

> **Cas limites tolérés** : les transitions CSS ne sont pas concernées — elles relèvent du rendu visuel, pas de la logique. Les callbacks d'animation d'ADR-22 (`onBeforeEnter`, `onAfterLeave`…) sont une cible strate 1c.

---

## Références

- [Invariants](invariants.md) — les règles formelles
- [ADR](../../adr/README.md) — le contexte des choix
