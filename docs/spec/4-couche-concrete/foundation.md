# Foundation -- Point d'ancrage par racine

> **Élément configurable par Manifest, body par défaut, parts attribuées aux Composers ; aucune source globale**

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (lots M6.2 et M6.3, 1er novembre 2026)** pour l'ancre, les slots et la création des Composers. Le choix du périmètre entre plusieurs racines d'un même document reste à vérifier au démarrage (§5). En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

[<- Retour couche concrete](README.md) | [<- Behavior](behavior.md) | [-> Composer](composer.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Foundation, enfant de la racine |
| **Couche** | Concrète ; persistante pendant la vie de sa racine (D1) |
| **Paquet** | `@bonsai/foundation` |
| **Référence normative** | [Théorie](../../theorie.md) : §2.5, C.2–C.3, A0–A2, D3, D7, D11, §16.4 et §16.9 |
| **Historique** | [ADR-20](../../adr/ADR-20-foundation.md), [ADR-07](../../adr/ADR-07-application-bootstrap.md), conservés Accepted sans modification |

## Table des matieres

1. [Classe Foundation](#1-classe-foundation)
2. [Droits d'altération DOM (N1)](#2-droits-daltération-dom-n1)
3. [Composers racines](#3-composers-racines)
   3.bis [Pattern délégation pour composition dynamique](#3bis-pattern-délégation-pour-composition-dynamique-adr-20)
4. [Relation avec Application](#4-relation-avec-application)
5. [Livré et limites](#5-livré-et-limites)

---

## 1. Classe Foundation

Il y a **une Foundation par racine**, non un singleton global au document ou au processus. Elle est enfant de la racine, qui possède son existence. D1 interdit à cette racine de détruire la Foundation pendant sa propre vie ; la Foundation prend fin avec elle.

La Foundation admet **un élément de l'hôte comme ressource distribuable**, par défaut le corps du document (`body`). Le Manifest de chaque racine désigne cet élément et la classe Foundation (§16.9). Ce sont des paramètres déclaratifs : pas une référence DOM transmise dans le Manifest. La syntaxe TypeScript et le nom du champ de configuration restent à concevoir ; aucun nouveau getter ou constructeur n'est défini ici.

Cette admission ne rend pas la Foundation propriétaire du support physique extérieur. Elle produit une ressource du modèle liée à son périmètre, dont elle est propriétaire (A1.b, A2.a, §11.6). Elle en attribue des parts à ses enfants, **qui sont exclusivement des Composers** (D11). Elle ne crée aucune View directement.

Plusieurs racines peuvent coexister dans un document, chacune avec sa Foundation et son Manifest. Leurs éléments admis ne doivent ni se recouvrir ni être imbriqués ; deux racines ne peuvent donc pas prendre toutes deux `body`, ni l'une `body` et l'autre un de ses descendants. La vérification commune au démarrage, notamment de la seconde racine, reste à réaliser ; elle ne protège pas de tout auteur extérieur non coordonné (D3, G6, annexe B.2).

Ni PDR de View, ni template principal, ni rôle de rendu de présentation : la Foundation pose l'ancrage et les premières attributions. La persistance de son existence n'implique pas que sa composition soit théoriquement gelée pour toujours ; voir §3.bis.

### 1.1 Capacités Channel

Le runtime Foundation n'a aujourd'hui ni contrat Channel ni méthodes d'écoute, de Command ou de Query. **En V1, la Foundation n'en a pas** (choix validé le 31 octobre 2026) : elle ne déclare que ses `composers` (§3), et sa composition de premier niveau est fixe. Toute variation, y compris de mise en page, est décidée par un Composer : par exemple, un slot unique dont le Composer choisit entre `LayoutStandardView` et `LayoutPaiementView`, chacune avec ses propres slots. Un second décideur de composition, à côté des Composers, contredirait la règle « une fonction par rôle » (§16).

Une capacité future, au-delà de la V1, devra être déclarée selon D16. La réception éventuelle d'Events d'adaptateurs ne sera **pas** une admission directe de leurs sources hôte. D18 s'applique à toute Command de l'interface : un Event, son relais local ou un résultat d'effet corrélé à cet Event n'ouvre aucun droit de commander ; une Query préalable ne change pas cette restriction. Une observation à antécédent inconnu ne l'ouvre pas davantage.

L'admission du **résultat instrumenté de ses propres effets autorisés**, y compris un bilan d'engagement, est en revanche permise par C.3. Les résultats et traitements locaux doivent être déclarés ; ils visent son occurrence de vie et respectent D9. Cette exception ne donne accès à aucune source générale de l'hôte et ne promet pas que ces mécanismes soient livrés.

---

---

## 2. Droits d'altération DOM (N1)

Le titre N1 conserve un repère historique ; il n'établit plus une exception d'accès général à `html` et `body`.

| Périmètre | Contrat |
| --- | --- |
| Élément admis par la Foundation | Les effets autorisés restent bornés à cette ressource et à sa portion non attribuée ; aucune propriété du support extérieur n'est acquise |
| Attributs de son élément d'ancrage | Les altérations de présentation de niveau N1 restent dans ce périmètre ; si l'ancrage n'est pas `body`, aucun droit sur `body` n'en découle |
| Élément d'un slot | Reste dans le périmètre du parent ; le **contenu** attribué appartient au Composer et est soustrait à l'autorité de la Foundation tant que sa part existe |
| Contenu attribué aux Composers, puis à leurs Views | Ni lecture ni modification directe par la Foundation ; aucun accès fonctionnel aux états des enfants |
| `html`, en-tête, `document`, `window`, titre et sources globales | Aucun accès supplémentaire autorisé : les ressources et sources hors de l'élément admis relèvent des adaptateurs D7 ; les faits de niveau document déclarés suivent D10 |
| Résultat instrumenté d'un effet propre autorisé | Admission locale permise selon C.3, sans abonnement à une source générale |

Le choix de l'élément ne permet pas de contourner D3 en désignant `html`, `document` ou `window` pour récupérer les capacités globales exclues. Une écoute directe du redimensionnement de fenêtre, du défilement global ou d'un raccourci de niveau document n'est pas une responsabilité Foundation. Les anciens exemples fondés sur `window.addEventListener()` et `this.html` sont donc retirés, sans modifier l'ADR historique.

Les effets DOM sont préparés pendant une initialisation ou un traitement autorisé et engagés après validation interne (§2.5). Plusieurs écritures ne deviennent pas atomiques ; engagement et réussite observée sont distincts. Un échec est traité par le protocole de résultat déclaré pour l'occurrence vivante concernée, sans rollback de ce que l'hôte a déjà appliqué (C.3).

---

---

## 3. Composers racines

Un slot est un élément du périmètre admis dont **le contenu** est attribué à un Composer. La Foundation possède l'existence de ce Composer ; l'attribution désigne celui-ci comme propriétaire initial de sa part, sans transférer la propriété d'une ressource existante (A2).

| Obligation | Conséquence |
| --- | --- |
| Enfants exclusivement Composers (D11) | Les Views sont créées et détruites par les Composers, jamais directement par la Foundation |
| Parts disjointes (T7) | Ni chevauchement de slots attribués, ni accès au contenu confié aux enfants |
| Désignation contrôlée de la part | Le Composer reçoit une désignation valable pour cette attribution, pas une référence DOM ni une identité ; résolution contrôlée selon §8.5 et §9.10 |
| Conservation de l'élément du slot | Pour le retirer, la Foundation fait d'abord prendre fin le Composer et son sous-arbre ; le contenu lui est restitué avant retrait |
| Création dans l'unité du créateur | L'initialisation du Composer et des Views qu'il crée est incluse dans cette unité, sans délégation d'autorité ; échec et rollback structurel communs |
| Fin des enfants | Cascade logique de bas en haut, restitutions au propriétaire encore vivant, sans hook applicatif pendant la cascade ; nettoyage physique post-validation |

**API livrée.** La Foundation déclare ses slots comme une View ([Composer §2](composer.md#2-api)) :

```typescript
// ─── View ou Foundation : déclaration des slots ──────────────────────────────
get composers() {
  return {
    main: { slot: "[data-slot='main']", composer: MainComposer },
    side: { slot: "[data-slot='side']", composer: CartPanelComposer },
  } as const;                      // clés de slot disjointes des clés UI
}
```

Chaque entrée désigne exactement un élément de l'élément admis ; une recherche qui ne trouve pas exactement un élément fait échouer l'effet de matérialisation (rapporté dans la trace du noyau, C.3). La déclaration est lue une fois : la liste des slots de la Foundation ne change pas pendant la vie de la racine.



---

---

## 3.bis Pattern délégation pour composition dynamique (ADR-20)

Cette ancre est conservée, notamment pour le lien entrant depuis [I67 historique](../reference/invariants.md). **I67 et ADR-20 décrivent un choix historique de composition Foundation stable, à réexaminer ; ce n'est pas une conséquence théorique de sa persistance.** L'immuabilité du Manifest fixe les enfants déclarés de la racine ; elle ne gèle pas, par déduction, tous les Composers enfants de la Foundation.

La délégation reste un choix de conception utile : un Composer racine décide d'une View de page ; cette View peut avoir des Composers enfants pour les zones dynamiques. La décision et le rendu restent ainsi séparés selon D11. Cette organisation n'autorise ni une View à créer d'autres Views directement, ni un Behavior à devenir parent de composants.

| Sujet | Statut |
| --- | --- |
| Existence Foundation persistante | Décision D1 active ; n'impose pas une liste de Composers éternellement constante |
| Lecture unique de `composers` au démarrage | Livré ; aucune réévaluation automatique |
| Interdiction générale de modifier la composition Foundation (ancien I67) | Choix historique hors de ce lot, à réexaminer ; ne pas le présenter comme théorème V0.9.4 |
| Délégation à une View de page et ses Composers | Principe architectural compatible ; `View.composers` et la cascade correspondante sont livrés (lot M6.2) |
| Évolution des Composers de premier niveau | Exclue en V1 : la Foundation n'a pas de Channel et sa déclaration est lue une fois ; la variation passe par les Composers (§1.1) |

Un getter conditionnel livré ne constitue pas un mécanisme réactif : il n'est lu qu'une fois. L'absence de mécanisme runtime ne doit pas être reformulée comme une interdiction issue des axiomes.

---

---

## 4. Relation avec Application

```typescript
class AppFoundation extends Foundation {
  get composers() {
    return { main: { slot: "[data-region='main']", composer: MainComposer } } as const;
  }
}

new Application({ features, document, foundation: AppFoundation, anchor: "body" });
```

| Étape | Comportement livré |
| --- | --- |
| Paramètres de la racine | Options de l'`Application` : classe `foundation`, `anchor` (sélecteur, `body` par défaut), `document` (requis) |
| Démarrage | Features d'abord (I56), puis adaptateurs, puis Foundation, dans l'unité de démarrage unique ; admissions et messages différés attendent sa clôture |
| Création | La Foundation admet l'ancre comme ressource distribuable (`admitDistributable`) puis crée chaque Composer avec une part `{ resource: ancre, portion: clé, host: slot }` : l'élément du slot est **adopté**, pas créé |
| Slot | Un sélecteur qui ne correspond pas à exactement un élément de l'ancre fait échouer l'effet de matérialisation ; l'erreur figure dans la trace du noyau |
| Fin | Avec la racine ; `Application.stop()` ne retire que les observateurs de l'hôte |

`getter body`, `html`, `onAttach()` et `onDetach()` sont supprimés. La Foundation n'a pas de Channel en V1 (§1.1).

## 5. Livré et limites

| Sujet | État |
| --- | --- |
| `Foundation.composers`, ancre, adoption des slots, création des Composers | Livré (`tests/unit/domain/foundation.test.ts`) |
| Foundation facultative | Oui : I33 suspendu |
| Disjonction des périmètres entre racines d'un même document (B.2) | Non vérifiée au démarrage |
| Slot en échec | Les effets suivants de la même liste sont marqués non tentés (C.3) : les slots déclarés après lui ne sont pas matérialisés, et les Composers et Views déjà créés restent vivants sans élément. Conforme à la théorie ; cette conséquence est signalée, non corrigée |
| Élément d'ancrage déclaré dans un Manifest de modules | Option d'`Application` seulement |
| Évolution de la composition de premier niveau | Exclue en V1 (§3.bis) |

---

## Lecture suivante

→ [composer.md](composer.md) — composition structurelle et résultats propres sous D12 et C.3
→ [Cycle de vie](../2-architecture/lifecycle.md) — existence, cascade, rollback et nettoyage
