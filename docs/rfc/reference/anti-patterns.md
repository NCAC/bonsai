# Anti-patterns

> **Les patterns explicitement INTERDITS dans Bonsai**

[← Retour à l'index](../README.md) · [Invariants](invariants.md) · [Décisions](decisions.md)

---

Les anti-patterns sont les patterns **explicitement INTERDITS** dans Bonsai.
Pour chaque anti-pattern : description, danger, invariant violé, alternative correcte,
et **détection** (compile-time, bootstrap ou runtime).

> **Convention de détection** :
> - `[Compile]` — erreur TypeScript avant l'exécution. Zéro coût runtime.
> - `[Bootstrap]` — erreur levée au démarrage (`app.start()`). Bloque l'application si non corrigée.
> - `[Runtime]` — erreur ou warning pendant l'exécution, avec contexte causal complet.
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
8. [Radio Direct Access](#-radio-direct-access)
9. [Undeclared Channel Usage](#-undeclared-channel-usage)
10. [Stateful View / Stateful Behavior](#-stateful-view--stateful-behavior-domain-state-ou-state-ad-hoc)
11. [Excessive View Inheritance](#-excessive-view-inheritance)
12. [Async Replier](#-async-replier)
13. [Async in Concrete Layer](#-async-in-concrete-layer)

---

### ❌ Smart View

**Description** : View qui orchestre le métier (écoute Event → déclenche Command cross-domain).

**Pourquoi c'est dangereux** : La View devient un orchestrateur implicite, la causalité métier y transite.

**Viole** : I13

**Détection** : `[Code review]` — le pattern est légal syntaxiquement (une View *peut* listen ET trigger). C'est la sémantique (décision métier dans le handler `listen`) qui est interdite. À enforcer par convention et code review.

**Alternative** : La View écoute des Events pour se mettre à jour (projection pure), elle trigger des Commands sur demande utilisateur. Jamais de logique métier dans la View.

---

### ❌ Cross-domain Trigger

**Description** : Feature A qui envoie un Command (trigger) sur le Channel de Feature B.

**Pourquoi c'est interdit** :
- Les Features ne possèdent pas `trigger()` — seuls les Views/Behaviors l'utilisent (I25)
- Les Features communiquent via emit (Events) + listen, jamais via Commands
- Crée un couplage impératif entre Features
- Détruit l'autonomie chorégraphique

**Viole** : I25, D2

**Détection** : `[Compile]` — `trigger()` n'est pas disponible sur le type `Feature`. Toute tentative génère une erreur TypeScript.

**Alternative** : Feature A émet un Event (emit) sur son propre Channel, Feature B écoute cet Event (listen) et réagit de manière autonome.

---

### ❌ Cross-domain Emit

**Description** : Feature A qui émet un Event (emit) sur le Channel de Feature B.

**Pourquoi c'est interdit** :
- Viole I1 et I12 (emit uniquement sur son propre Channel)
- Usurpe l'identité d'une autre Feature
- Rend le graphe causal incohérent

**Viole** : I1, I12

**Détection** : `[Compile]` — `emit()` est typé par `TChannel` (le Channel propre). Tenter d'émettre un événement non déclaré dans `TChannel['events']` produit une erreur TypeScript.

**Alternative** : Feature A émet sur SON propre Channel, Feature B écoute si elle le souhaite.

---

### ❌ Double Handler

**Description** : Plusieurs Features qui réagissent au même Command.

**Pourquoi c'est dangereux** : Un Command a par définition un seul handler (la Feature propriétaire). Deux handlers = ambiguïté sur qui traite.

**Viole** : I10

**Détection** : `[Bootstrap]` — le registre Command Lane n'accepte qu'un seul handler. Un deuxième enregistrement lève : `[Bonsai] Duplicate command handler for '{namespace}:{command}'`.

**Alternative** : Un seul handler par Command. Si plusieurs composants doivent réagir, utiliser un Event (1:N) au lieu d'un Command (1:1).

---

### ❌ Entity leaking

**Description** : Entity accessible en dehors de sa Feature propriétaire.

**Pourquoi c'est dangereux** :
- Brise l'encapsulation
- Permet des mutations non contrôlées
- Rend impossible la traçabilité des changements

**Viole** : I5, I6

**Détection** : `[Compile]` — `entity` est une propriété `protected` de la Feature et n'est pas accessible depuis l'extérieur. Les types `View`, `Behavior`, `Composer` n'ont pas de propriété `entity`.

**Alternative** : La Feature expose le state via `reply` (C4), les consommateurs utilisent `request` (C5).

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

**Viole** : Principe de traçabilité §10

**Détection** : `[Code review]` — les handlers reçoivent `(payload, metas)` explicitement (ADR-0016), mais les metas servent **exclusivement** à la traçabilité et à la propagation causale. Tout branchement conditionnel (`if (metas.origin...)`, `switch(metas.correlationId)`) dans la logique métier est un signal d'alarme.

**Alternative** : La logique métier branche sur le payload du message, jamais sur les metas. Les metas sont propagées telles quelles via `{ metas }` dans `emit()`, `request()`, `mutate()`.

---

### ❌ Radio Direct Access

**Description** : Accéder à un Channel via `Radio.channel('name')` au lieu de le déclarer dans la définition du composant.

**Pourquoi c'est dangereux** :
- Couplages cachés dans l'implémentation, invisibles dans la définition
- Impossible de vérifier les invariants à la compilation
- Tests nécessitent un Radio complet au lieu des seuls Channels déclarés
- Le graphe de communication n'est pas lisible statiquement

**Viole** : I14, I15, I16

**Détection** : `[Compile]` — `Radio` n'est pas exporté du package framework. `Radio.channel('name')` produit : `Cannot find name 'Radio'`.

**Alternative** : Déclarer `listen`/`trigger`/`request` dans la définition du composant.

---

### ❌ Undeclared Channel Usage

**Description** : Utiliser un Channel dans le corps d'un composant sans l'avoir déclaré dans sa définition (listen, trigger, request).

**Pourquoi c'est dangereux** :
- Dépendance invisible → couplage implicite
- Le composant semble autonome mais ne l'est pas
- Impossible à détecter sans exécuter le code

**Viole** : I14, I16

**Détection** : `[Compile + Bootstrap]` — compile : le type system vérifie que les méthodes `onXXX` correspondent aux Channels déclarés. Bootstrap : `[Bonsai] Undeclared channel usage detected in '{ComponentName}' for namespace '{ns}'`.

**Alternative** : Toujours déclarer le Channel dans la définition.

---

### ❌ Stateful View / Stateful Behavior (domain state ou state ad hoc)

**Description** : View ou Behavior qui maintient un **domain state** local ou un **state ad hoc** non déclaré via le mécanisme framework (`this.isOpen`, `this.selectedIndex`, `this.data`). Cela inclut toute propriété mutable posée directement sur la classe sans passer par le mécanisme `localState` du framework.

**Pourquoi c'est interdit** :
- Le **domain state** (données métier, données partagées) dans une View crée une concurrence d'états avec les Entities
- Un state **ad hoc** (propriété `this.xxx` classique) est invisible, non réactif, non typé par le framework — impossible à tracer, tester ou migrer
- Un autre composant *pourrait* avoir besoin de cette donnée (analytics, persistance, dépendances inter-composants)
- Détruit le flux unidirectionnel si le state est du domain state

**Viole** : I5, I6, I30

**Alternative** :
- **Donnée partagée / domain state** → Créer une Feature dédiée (ex: `ModalUiFeature`, `SliderUiFeature`). La View trigger un Command, la Feature modifie son Entity, la View écoute l'Event et se met à jour.
- **Donnée purement locale à la View** → Utiliser le mécanisme **`localState`** du framework (I42, D33) : déclaratif, typé, réactif, encapsulé, non-broadcastable. **Jamais** de `this.xxx = value` ad hoc.

> **⚠️ Critère de migration** : si un localState doit être observé par un autre composant (autre View, Behavior, Feature), il **DOIT** être migré vers Feature + Entity. Le localState est strictement intra-View.

**Détection** : `[Compile + Bootstrap]` — `localState` via API framework uniquement (I42). Propriétés `this.xxx` ad hoc : compile en mode strict = error sur propriété non déclarée. Bootstrap mode strict : `[Bonsai] Undeclared mutable property '{name}' detected in View '{ViewName}' — use localState API`.

---

### ❌ Excessive View Inheritance

**Description** : Créer des sous-classes de View pour des variations mineures (layout, config) au lieu d'utiliser les mécanismes prévus : View + options (D34) pour la réutilisation d'un même composant, Behavior (D36) pour l'ajout de capacités orthogonales.

**Pourquoi c'est dangereux** :
- Prolifération de classes pour des différences cosmétiques
- Hiérarchie d'héritage fragile — une modification dans la classe parent casse les enfants
- Mélange de logiques de configuration et de logiques métier
- Rend les Behaviors inutilisables (un Behavior ne peut pas connaître la hiérarchie)

**Viole** : D34, D36, D38

**Détection** : `[Code review]` — pas de mécanisme mécanique v1. Indicateurs : chaine d'héritage > 2 niveaux entre Views, sous-classes de View sans override de template.

**Alternative** : Utiliser l'algorithme de décision D38 :
- Q0 : Sert de base de composition → View
- Q1 : Même View, contexte différent → View + options
- Q2 : Capacité orthogonale → Behavior
- Q3/Q4 : Altération template principal → seul cas légitime d'héritage

---

### ❌ Async Replier

**Description** : Un replier (handler `reply`) qui effectue un appel asynchrone (`fetch`, `await`, `Promise`) pour construire sa réponse.

**Pourquoi c'est interdit** :
- Un `request()` est une **lecture synchrone d'un état déjà matérialisé** dans une Entity. Si le replier a besoin d'être async, c'est que l'état n'est pas encore dans l'Entity — problème d'ordre de bootstrap (ADR-0010), pas de sémantique de `request`
- Détruit la sémantique du tri-lane : `trigger()` = `void`, `emit()` = `void`, `request()` = `T` (immédiat)
- Transforme la Request Lane en canal de side-effects déguisé
- Rend les selectors et templates dépendants de `await` inutiles

**Viole** : D9 (révisé par ADR-0023), I55

**Détection** : `[Compile]` — `reply()` est typé avec un retour `T | null` (synchrone). Un handler qui retourne `Promise<T>` produit une erreur TypeScript : `Type 'Promise<T>' is not assignable to type 'T | null'`.

**Alternative** : Pré-charger la donnée via un handler Command (async, fire-and-forget) ou un listener Event, stocker dans l'Entity, puis le replier lit l'état synchrone.

```typescript
// ❌ Anti-pattern : fetch dans le replier
onTotalRequest(payload: void, metas: TMetas): Promise<number> {
  const response = await fetch('/api/cart/total');
  return response.json(); // ⚠️ async dans un replier !
}

// ✅ Pattern correct : donnée déjà dans l'Entity
onTotalRequest(payload: void, metas: TMetas): number | null {
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

**Viole** : ADR-0023 (conséquence 1 et 2), I13, I30

**Détection** : `[Code review]` + `[Lint]` — ce pattern n'est **pas détectable mécaniquement** au compile-time (TypeScript n'interdit pas `fetch()` dans une classe). Enforçable par :
- Convention d'équipe et code review
- Règle ESLint custom (future) : détecter `fetch`, `async`, `await`, `new Promise`, `setTimeout`, `setInterval` dans les fichiers `*.view.ts`, `*.behavior.ts`, `*.foundation.ts`, `*.composer.ts`

**Alternative** : Toute opération async passe par `trigger()` qui délègue à une Feature. La Feature exécute l'async, mute son Entity, émet un Event. La View se met à jour via sa souscription.

```typescript
// ❌ Anti-pattern : fetch dans une View
class ServiceListView extends View {
  async onRefreshButtonClick(event: MouseEvent): Promise<void> {
    const response = await fetch('/api/services'); // ⚠️ async dans une View !
    const services = await response.json();
    this.renderServices(services); // ⚠️ mutation directe sans Entity !
  }
}

// ✅ Pattern correct : délégation via trigger
class ServiceListView extends View {
  onRefreshButtonClick(event: MouseEvent, metas: TMetas): void {
    this.trigger('services:refresh', undefined, { metas });
    // fire-and-forget — la View sera notifiée via l'Event services:listLoaded
  }
}
```

> **Cas limites tolérés** : les animations CSS (transitions, `requestAnimationFrame`) ne sont PAS concernées par cet anti-pattern — elles relèvent du rendu visuel, pas de la logique métier. Les callbacks lifecycle d'animation (D39 : `onBeforeEnter`, `onAfterLeave`, etc.) restent légitimes dans la View.

---

## Références

- [Invariants](invariants.md) — les règles formelles
- [Décisions historiques](decisions.md) — le contexte des choix
