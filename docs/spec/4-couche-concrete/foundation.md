# Foundation -- Point d'ancrage par racine

> **Élément configurable par Manifest, body par défaut, parts attribuées aux Composers ; aucune source globale**

[<- Retour couche concrete](README.md) | [<- Behavior](behavior.md) | [-> Composer](composer.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Foundation, enfant de la racine |
| **Couche** | Concrète ; persistante pendant la vie de sa racine (D1) |
| **Statut** | Contrat documentaire V0.9.4 ; runtime livré partiel et incompatible sur plusieurs points |
| **Référence normative** | [Théorie](../../theorie.md) : §2.5, §2.7.2–§2.7.3, A0–A2, D3, D7, D11, §16.4 et §16.9 |
| **Historique** | [ADR-20](../../adr/ADR-20-foundation.md), [ADR-07](../../adr/ADR-07-application-bootstrap.md), conservés Accepted sans modification ; leurs choix incompatibles sont à réexaminer |

> ## ⏳ Périmètre d'implémentation
>
> [La classe livrée](../../../packages/foundation/src/bonsai-foundation.ts) utilise toujours `document.body` et `document.documentElement`. Elle expose `body` et `html` comme `HTMLElement` bruts, lit `composers` une fois et attache les Composers dans l'ordre de `Object.entries()`. `onAttach()` est appelé ensuite ; `onDetach()` est déclaré mais n'a pas d'appelant.
>
> **Non livrés** : choix de l'élément dans le Manifest, admission et attribution contrôlées, isolation entre racines, cycle de destruction transactionnel et nettoyage complet. Aucune capacité Channel n'est livrée sur Foundation ; sa forme future n'est pas fixée. Les accès bruts et suggestions d'écoute globale du code ne sont pas des autorisations du contrat cible.

---

## Table des matieres

1. [Classe Foundation](#1-classe-foundation)
2. [Droits d'altération DOM (N1)](#2-droits-daltération-dom-n1)
3. [Composers racines](#3-composers-racines)
   3.bis [Pattern délégation pour composition dynamique](#3bis-pattern-délégation-pour-composition-dynamique-adr-20)
4. [Relation avec Application](#4-relation-avec-application)

---

## 1. Classe Foundation

Il y a **une Foundation par racine**, non un singleton global au document ou au processus. Elle est enfant de la racine, qui possède son existence. D1 interdit à cette racine de détruire la Foundation pendant sa propre vie ; la Foundation prend fin avec elle.

La Foundation admet **un élément de l'hôte comme ressource distribuable**, par défaut le corps du document (`body`). Le Manifest de chaque racine désigne cet élément et la classe Foundation (§16.9). Ce sont des paramètres déclaratifs : pas une référence DOM transmise dans le Manifest. La syntaxe TypeScript et le nom du champ de configuration restent à concevoir ; aucun nouveau getter ou constructeur n'est défini ici.

Cette admission ne rend pas la Foundation propriétaire du support physique extérieur. Elle produit une ressource du modèle liée à son périmètre, dont elle est propriétaire (A1.b, A2.a, §11.6). Elle en attribue des parts à ses enfants, **qui sont exclusivement des Composers** (D11). Elle ne crée aucune View directement.

Plusieurs racines peuvent coexister dans un document, chacune avec sa Foundation et son Manifest. Leurs éléments admis ne doivent ni se recouvrir ni être imbriqués ; deux racines ne peuvent donc pas prendre toutes deux `body`, ni l'une `body` et l'autre un de ses descendants. La vérification commune au démarrage, notamment de la seconde racine, reste à réaliser ; elle ne protège pas de tout auteur extérieur non coordonné (D3, G6, annexe B.2).

Ni PDR de View, ni template principal, ni rôle de rendu de présentation : la Foundation pose l'ancrage et les premières attributions. La persistance de son existence n'implique pas que sa composition soit théoriquement gelée pour toujours ; voir §3.bis.

### 1.1 Capacités Channel

Le runtime Foundation n'a aujourd'hui ni contrat Channel ni méthodes d'écoute, de Command ou de Query. La forme de ces capacités reste à concevoir ; un contrat générique ou un nouveau module de types ne sont pas annoncés ici.

Toute capacité future devra être déclarée selon D16. La réception éventuelle d'Events d'adaptateurs ne sera **pas** une admission directe de leurs sources hôte. D18 s'applique à toute Command de l'interface : un Event, son relais local ou un résultat d'effet corrélé à cet Event n'ouvre aucun droit de commander ; une Query préalable ne change pas cette restriction. Une observation à antécédent inconnu ne l'ouvre pas davantage.

L'admission du **résultat instrumenté de ses propres effets autorisés**, y compris un bilan d'engagement, est en revanche permise par §2.7.3. Les résultats et traitements locaux doivent être déclarés ; ils visent son occurrence de vie et respectent D9. Cette exception ne donne accès à aucune source générale de l'hôte et ne promet pas que ces mécanismes soient livrés.

---

## 2. Droits d'altération DOM (N1)

Le titre N1 conserve un repère historique ; il n'établit plus une exception d'accès général à `html` et `body`.

| Périmètre | Contrat cible |
| --- | --- |
| Élément admis par la Foundation | Les effets autorisés restent bornés à cette ressource et à sa portion non attribuée ; aucune propriété du support extérieur n'est acquise |
| Attributs de son élément d'ancrage | Les altérations de présentation de niveau N1 restent dans ce périmètre ; si l'ancrage n'est pas `body`, aucun droit sur `body` n'en découle |
| Élément d'un slot | Reste dans le périmètre du parent ; le **contenu** attribué appartient au Composer et est soustrait à l'autorité de la Foundation tant que sa part existe |
| Contenu attribué aux Composers, puis à leurs Views | Ni lecture ni modification directe par la Foundation ; aucun accès fonctionnel aux états des enfants |
| `html`, en-tête, `document`, `window`, titre et sources globales | Aucun accès supplémentaire autorisé : les ressources et sources hors de l'élément admis relèvent des adaptateurs D7 ; les faits de niveau document déclarés suivent D10 |
| Résultat instrumenté d'un effet propre autorisé | Admission locale permise selon §2.7.3, sans abonnement à une source générale |

Le choix de l'élément ne permet pas de contourner D3 en désignant `html`, `document` ou `window` pour récupérer les capacités globales exclues. Une écoute directe du redimensionnement de fenêtre, du défilement global ou d'un raccourci de niveau document n'est pas une responsabilité Foundation. Les anciens exemples fondés sur `window.addEventListener()` et `this.html` sont donc retirés, sans modifier l'ADR historique.

Les effets DOM sont préparés pendant une initialisation ou un traitement autorisé et engagés après validation interne (§2.5). Plusieurs écritures ne deviennent pas atomiques ; engagement et réussite observée sont distincts. Un échec est traité par le protocole de résultat déclaré pour l'occurrence vivante concernée, sans rollback de ce que l'hôte a déjà appliqué (§2.7.3).

---

## 3. Composers racines

Un slot est un élément du périmètre admis dont **le contenu** est attribué à un Composer. La Foundation possède l'existence de ce Composer ; l'attribution désigne celui-ci comme propriétaire initial de sa part, sans transférer la propriété d'une ressource existante (A2).

| Obligation cible | Conséquence |
| --- | --- |
| Enfants exclusivement Composers (D11) | Les Views sont créées et détruites par les Composers, jamais directement par la Foundation |
| Parts disjointes (T7) | Ni chevauchement de slots attribués, ni accès au contenu confié aux enfants |
| Désignation contrôlée de la part | Le Composer reçoit une désignation valable pour cette attribution, pas une référence DOM ni une identité ; résolution contrôlée selon §8.5 et §9.10 |
| Conservation de l'élément du slot | Pour le retirer, la Foundation fait d'abord prendre fin le Composer et son sous-arbre ; le contenu lui est restitué avant retrait |
| Création dans l'unité du créateur | L'initialisation du Composer et des Views qu'il crée est incluse dans cette unité, sans délégation d'autorité ; échec et rollback structurel communs |
| Fin des enfants | Cascade logique de bas en haut, restitutions au propriétaire encore vivant, sans hook applicatif pendant la cascade ; nettoyage physique post-validation |

**Livré seulement :** `get composers()` retourne un `Readonly<Record<string, typeof Composer>>`. Ses clés sont des sélecteurs CSS recherchés sous `document.body`, ses valeurs des classes Composer. `attach()` lit ce record une fois et parcourt `Object.entries()` ; pour les clés chaînes non numériques, l'ordre d'insertion est conservé. Ce parcours n'est pas un protocole général de composition dynamique ou de validation des parts.

Dans [le Composer livré](../../../packages/composer/src/bonsai-composer.ts), `attach()` résout le slot sous l'élément parent et crée un élément simplifié s'il manque. Cela ne valide ni la résolution CSS générale, ni la disjonction des parts. Dans [la View livrée](../../../packages/view/src/bonsai-view.ts), `mount()` résout encore son `rootElement` par `document.querySelector()` global, pas sous le slot ; il ne crée pas une racine absente. La conformité des références structurelles n'est donc pas garantie par ces sélecteurs.

---

## 3.bis Pattern délégation pour composition dynamique (ADR-20)

Cette ancre est conservée, notamment pour le lien entrant depuis [I67 historique](../reference/invariants.md). **I67 et ADR-20 décrivent un choix historique de composition Foundation stable, à réexaminer ; ce n'est pas une conséquence théorique de sa persistance.** L'immuabilité du Manifest fixe les enfants déclarés de la racine ; elle ne gèle pas, par déduction, tous les Composers enfants de la Foundation.

La délégation reste un choix de conception utile : un Composer racine décide d'une View de page ; cette View peut avoir des Composers enfants pour les zones dynamiques. La décision et le rendu restent ainsi séparés selon D11. Cette organisation n'autorise ni une View à créer d'autres Views directement, ni un Behavior à devenir parent de composants.

| Sujet | Statut |
| --- | --- |
| Existence Foundation persistante | Décision D1 active ; n'impose pas une liste de Composers éternellement constante |
| Lecture unique de `composers` au bootstrap | Comportement runtime livré ; aucune réévaluation automatique |
| Interdiction générale de modifier la composition Foundation (ancien I67) | Choix historique hors de ce lot, à réexaminer ; ne pas le présenter comme théorème V0.9.4 |
| Délégation à une View de page et ses Composers | Principe architectural compatible ; `View.composers` et la cascade correspondante ne sont pas livrés |
| Évolution contrôlée des Composers de premier niveau | Déclencheurs, droits, déclaration, ordre et API restent à concevoir sous §2.5, A1–A2 et D11 ; aucune nouvelle API promise ici |

Un getter conditionnel livré ne constitue pas un mécanisme réactif : il n'est lu qu'une fois. L'absence de mécanisme runtime ne doit pas être reformulée comme une interdiction issue des axiomes.

---

## 4. Relation avec Application

| Étape | Contrat cible | Observation du livré |
| --- | --- | --- |
| Paramètres de la racine | Manifest propre à la racine, classe Foundation et désignation de son élément, `body` par défaut | [Options Application](../../../packages/application/src/bonsai-application.ts) limitées ici à la classe `foundation` et aux `features` ; aucun champ d'élément Foundation |
| Amorçage | Channels établis, initialisations ordonnées et disponibilité contrôlée avant publication ; admissions et différés attendent la clôture | Features initialisées synchroniquement avant création de la Foundation en phase 4 |
| Création Foundation | Existence créée par la racine, admission du seul élément déclaré, création des Composers et attributions sous une même unité | Constructeur sans argument, capture directe de `document.body` et `document.documentElement`, puis `attach()` |
| Attachement des Composers | Désignations de parts résolues sous contrôle de propriété ; initialisations et effets préparés sous §2.5 | Sélecteurs du record passés au constructeur Composer, puis `attach(body)` et éventuel `View.mount()` |
| Hook historique | Ni permission globale ni preuve de publication transactionnelle | `Foundation.onAttach()` appelé après tous les Composers racines |
| Fin | Fondation et descendants clôturés avec la racine selon le [cycle de vie](../2-architecture/lifecycle.md) ; aucun rollback de l'hôte promis | `onDetach()` jamais appelé, pas de shutdown, références View oubliées sans désabonnement |

L'erreur de second `attach()` est un garde **par instance**, pas la preuve d'un singleton global ou d'une isolation entre Applications. Le singleton `Radio` livré et l'usage de `document.body` empêchent d'inférer la coexistence sûre de plusieurs racines à partir de cette seule classe.

**À concevoir avant de revendiquer la conformité :** forme du paramètre d'élément dans le Manifest, validation des périmètres entre racines, admission et désignations contrôlées, capacités déclarées éventuelles, évolution de composition, rollback structurel, occurrences de vie et nettoyage post-validation. Les getters bruts `html`/`body` et le rôle global des hooks historiques devront être réconciliés avec ces limites ; ce lot ne modifie aucun runtime.

---

## Lecture suivante

→ [composer.md](composer.md) — composition structurelle et résultats propres sous D12 et §2.7.3 ; runtime encore partiel
→ [Cycle de vie](../2-architecture/lifecycle.md) — existence, cascade, rollback et nettoyage
