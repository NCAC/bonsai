
# Mapping Bonsai ↔ Autres Frameworks JS (État 2026)

Ce document présente une vue synthétique et détaillée du positionnement conceptuel de **Bonsai** par rapport aux principaux frameworks JavaScript modernes :
- React
- Vue
- Angular
- Ember
- Backbone / Marionette
- Svelte
- SolidJS
- Qwik

Il s’appuie sur l’architecture actuelle de Bonsai (Entities, Channels, Features, CQRS, diff interne, rendering granulaire) et décrit comment ces concepts se comparent aux modèles existants.

---
# 1. Vue d’ensemble du positionnement

| Framework | Nature | Similarités avec Bonsai | Différences majeures |
|----------|--------|--------------------------|-----------------------|
| **React** | Bibliothèque UI minimaliste | Unidirectionnel, composant → event → update | Pas de CQRS, pas d’architecture imposée, Virtual DOM obligatoire |
| **Vue** | Framework progressif, MVVM | Templates, réactivité fine | Pas de CQRS, diff VDOM, state local/réactif mais peu structurant |
| **Angular** | Framework enterprise, DI-first | Structure forte, séparation claire | Pas d’architecture événementielle, pas de diff interne, pas de CQRS strict |
| **Ember** | Framework très structuré | Conventions, router-first, séparation forte | Architecture centrée router, pas d’Event/CQRS, pas de diff interne |
| **Backbone/Marionette** | Ancêtre MVC/Events | Simplicité, Views/Behaviors | Pas de flux unifié, événements chaotiques, pas de CQRS |
| **Svelte** | Framework-compilateur | Granularité du rendu | Pas de modèle métier, pas d’event-driven, pas de CQRS |
| **SolidJS** | Fine-grained reactive | Mise à jour ciblée | Pas de separation domain/UI, pas de Commands/Queries |
| **Qwik** | Framework résumable | Causalité, lazy | Pas de CQRS, pas de modèle métier structuré |

---
# 2. Bonsai ↔ React

### Similarités
- Flux **unidirectionnel**.
- Les Views déclenchent des événements intentionnels.

### Différences fondamentales
- Bonsai utilise **Channels** pour transporter Commands/Events → React n’a rien d’équivalent.
- Bonsai impose CQRS → React mélange lecture/écriture dans les composants.
- Bonsai utilise **Entities avec diff interne** → React utilise Virtual DOM + diff global.
- Dans Bonsai, **la View ne re-rend pas** sauf si elle reçoit explicitement un Event.

### Résumé
**Bonsai est React avec un domaine, une causalité et un modèle métier explicites.**

---
# 3. Bonsai ↔ Vue

### Similarités
- Mise à jour **granulaire** de l’UI.
- Templates et separation UI/logique.

### Différences fondamentales
- Bonsai = CQRS + Event-driven.
- Vue = réactivité fine (+ Virtual DOM 2.x / réact réécrit 3.x) mais **pas d’architecture métier claire**.
- VueX/Pinia ≠ Entities/Channels.

### Résumé
**Vue est un framework UI réactif. Bonsai est un framework d’architecture métier.**

---
# 4. Bonsai ↔ Angular

### Similarités
- Architecture imposée.
- Composition Feature-like (services/DI).

### Différences fondamentales
- Angular est **router-first**, Bonsai est **event-first**.
- Angular = components + DI ; Bonsai = Entities + Channels + Features.
- Angular ne possède pas de diff interne, ni CQRS.

### Résumé
**Angular structure l’application. Bonsai structure la logique et la causalité.**

---
# 5. Bonsai ↔ Ember

### Similarités
- Discipline, conventions, structure.
- Séparation View / logique métier.

### Différences fondamentales
- Ember = router-first + templates.
- Bonsai = CQRS + Event-driven + Entities.
- Ember n’a pas la notion de diff interne ni de Channels typés.

### Résumé
**Bonsai est plus proche d’Ember que de React, mais en version événementielle/CQRS.**

---
# 6. Bonsai ↔ Backbone / Marionette

### Similarités
- Views et Behaviors.
- Inspiration directe de l’architecture Marionette.

### Ce que Bonsai corrige
- Élimine le chaos du EventBus global.
- Implique un flux unidirectionnel clair.
- Diff interne → évite les re-renders et updates manuelles.
- Modèle métier structuré (Entities / Features).

### Résumé
**Bonsai est le Backbone moderne qui aurait dû exister.**

---
# 7. Bonsai ↔ Svelte

### Similarités
- Mise à jour d’UI très ciblée.
- Patch DOM minimal.

### Différences majeures
- Svelte = compilateur → DOM direct.
- Bonsai = event → diff → patch ciblé.
- Bonsai conserve une architecture métier, contrairement à Svelte.

### Résumé
**Même efficacité UI, mais Bonsai garde un cadre métier complet.**

---
# 8. Bonsai ↔ SolidJS

### Similarités
- Mise à jour par granularité exacte.
- Pas de re-rendu global.

### Différences majeures
- Solid = graph réactif (signals).
- Bonsai = diff d’Entity + events.
- Solid ne propose pas de séparation métier.

### Résumé
**Solid → granularité UI. Bonsai → granularité métier + UI.**

---
# 9. Bonsai ↔ Qwik

### Similarités
- Causalité explicite.
- Mise à jour localisée.
- Activation “sur demande”.

### Différences majeures
- Qwik = résumabilité (SSR-first).
- Bonsai = SPA event-driven.

### Résumé
**Qwik résout la performance SSR ; Bonsai résout la causalité métier UI-first.**

---
# 10. Résumé final

**Bonsai n’est pas un framework UI : c’est un framework d’architecture métier modernisé.**

Il combine :
- le meilleur des frameworks UI modernes (granularité du rendu),
- les principes d’architecture logicielle avancée (CQRS, event sourcing),
- la simplicité héritée de Backbone,
- la discipline d’Ember et Angular,
- la performance des nouvelles générations Svelte/Solid/Qwik.

Bonsai se positionne donc comme une **brique structurelle**, idéale pour bâtir des SPAs rigoureuses, causales, testables et évolutives.

