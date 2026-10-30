# Bonsai — Obligations et gardes

*Table de conformité du §19 de la théorie (jalon V0.9.1). Chaque obligation que la théorie impose au code applicatif, clause d'axiome ou décision, y reçoit une garde au niveau le plus précoce possible, ou la justification de son absence. Les colonnes « Invariants » renvoient au registre `docs/invariants/` ; les tests sont nommés par leur cas, à écrire dans `tests/`. Une garde n'est jamais la source d'une règle : en cas d'écart, la théorie fait autorité.*

Niveaux : **construction** (la violation ne s'écrit pas), **statique** (refusée avant exécution), **démarrage** (refusée avant le premier message), **exécution** (détectée et signalée avec son contexte causal), **aucune** (garde impossible, justifiée).

## 1. Obligations du code applicatif

| Règle | Énoncé | Niveau | Garde | Invariants | Test |
| --- | --- | --- | --- | --- | --- |
| A0.c | Tout ce qu'on peut connaître ou changer d'un composant est son existence ou une ressource dont il est propriét… | construction | Les composants n'exposent aucune propriété publique hors de leur contrat ; aucune instance n'est remise à un autre composant | I6, I39 | types : `@ts-expect-error` sur l'accès à un champ d'une autre instance |
| A1.a | Toute ressource du modèle a exactement un propriétaire. | construction | Chaque ressource est créée par un seul composant fourni (Entity par sa Feature, part par son parent) | I6, I22 | types : une Entity sans Feature ne se construit pas |
| A1.b | Un composant n'exécute d'opération exclusive que sur une ressource dont il est propriétaire. | construction | Aucune API n'expose les ressources d'un autre composant (Entity, DOM d'une part) | I6, I39, I78 | types : `@ts-expect-error` sur `otherFeature.entity` ; `getUI` hors contrat |
| A2.a | Le composant qui crée ou admet une ressource en est le propriétaire initial, sauf pour une part d'une ressourc… | construction | Identités attribuées par la racine d'après le Manifest ; namespace injecté, jamais choisi | I68, I69, I72 | types : `static namespace` refusé ; démarrage : namespace absent du Manifest |
| A2.b | Toute ressource distribuable est créée par une racine, admise depuis l'hôte, ou bien est une part d'une ressou… | construction | Seule la racine crée l'espace des identités ; seules la Foundation et les Composers attribuent des parts | I69, I31 | types : pas d'API de création d'espace |
| A2.c | Le propriétaire d'une ressource demeure le même jusqu'à la destruction de celle-ci. | statique | Aucune API ne transfère un état ; paramètres et charges sérialisables, donc copiés | I46 | types : charge non sérialisable refusée |
| A2.d | Le propriétaire d'une ressource distribuable n'en attribue de part qu'à ses enfants. Une part ne prend fin qu'… | démarrage | Scope d'une View attribué par son parent, non extensible ; retrait d'un slot après destruction de son Composer | I99, I40, I31 | démarrage : `rootElement` hors du slot refusé ; exécution : retrait d'un slot habité |
| A3.a | Toute interaction fonctionnelle passe exclusivement par un message adressé à un Channel ou émis sur un Channel… | construction | Pas de bus ambiant ; interactions par les méthodes typées de la classe de base seulement | I15, I76 | types : Radio non exporté |
| A3.b | Tout Channel est distingué par une identité dont son propriétaire est propriétaire. | construction | Channel créé par Bonsai à partir de l'identité attribuée | I15, I73 | types : pas de constructeur de Channel public |
| A3.c | Toute référence utilisée par un composant est une référence structurelle. | construction | Aucune référence vers un autre composant ou une part étrangère n'est exposée | I39, I44 | types : `this.view` absent d'un Behavior |
| A3.d | Les paramètres de création ne contiennent aucune référence. | statique | Paramètres de création et charges de messages typés sérialisables (`TJsonSerializable`) | I46 | types : élément du DOM dans un paramètre refusé |
| A3.e | Seul le propriétaire d'un Channel traite les messages adressés à ce Channel, et seul il émet sur ce Channel. | construction | `emit` lié au Channel propre ; un seul traitement dérivé par message (D16) | I1, I10, I3 | types : `emit` sur un autre Channel ; exécution : `DuplicateHandlerError` |
| A3.f | Tout message est adressé à un Channel, émis sur un Channel, ou local. | construction | Les messages ne se construisent que par `trigger`, `emit` ou le message local | I54 | types : pas de constructeur de message public |
| A3.g | Le traitement d'un message adressé qui rend une réponse n'exécute aucune opération exclusive. | statique | Le traitement d'une Query n'a pas accès à `mutate()` et ne rend pas de `Promise` | I17, I64 | types : `mutate` dans un traitement de Query ; retour `Promise` refusé |
| A3.h | Un composant n'émet d'information que sur une ressource dont il est propriétaire. | aucune | Impossible : l'origine d'une information émise n'est pas observable. Revue de code ; la charge d'un Event typée sur l'état de l'Entity limite les écarts | — | — |
| A4.a | Les invariants métier sont satisfaits à l'issue de chaque traitement, en présence ou en l'absence d'interface … | exécution | Validation de l'Entity par son schéma à l'issue de chaque traitement ; en cas d'échec, G7 annule | I63 | exécution : traitement qui laisse un total incohérent, annulé et signalé |
| A4.b | Aucun composant du domaine n'adresse de message à un Channel dont le propriétaire appartient à l'interface uti… | statique | Le contrat d'une Feature ne peut lister aucun Channel de l'interface (D16) | I2, I77 | types : Feature qui écoute `document:shortcut` |
| A4.c | Seul le domaine échange des informations métier avec les systèmes extérieurs. | statique | Règle de lint : aucun appel réseau dans le code d'une View, d'un Composer ou d'un Behavior. Justification du niveau : TypeScript ne distingue pas les appels réseau | I13 | lint : `fetch` dans une View signalé |
| A4.d | Toute information métier contenue dans une ressource de l'interface utilisateur provient d'un message émis par… | aucune | Partielle : la View n'écrit l'information métier qu'en traitement d'un Event ou d'une réponse (D16) ; la provenance d'une valeur n'est pas observable. Revue | I13, I30 | — |
| A4.e | Un Channel dont le propriétaire appartient au domaine ne prend fin qu'avec la racine. | construction | Aucune API de destruction d'une Feature ou d'un adaptateur du domaine | I23 | types : `feature.destroy` absent |
| A5.a | Tout changement d'état résulte du traitement d'un message. | exécution | `mutate()` et `updateLocal()` refusés hors d'un traitement | I94, I98 | exécution : `mutate` dans un `.then()` refusé |
| A5.b | Tout message porte un contexte causal. | construction | Contexte causal créé et transmis par Bonsai | I7, I54 | types : métadonnées non constructibles |
| A5.c | Un fait de l'hôte ou d'un système extérieur n'entre dans le modèle que par un message, produit par le composan… | construction | Admission par les classes de base (View, adaptateurs) ; contexte des faits provoqués capturé à l'appel | I8, I54 | exécution : réponse réseau rattachée à la Command d'origine |
| A5.d | Un fait de l'hôte ou d'un système extérieur est admis par un seul composant. | démarrage | Refus d'une View qui écoute une source déclarée globale (D10) ; périmètres disjoints (B.2) | — | démarrage : View écoutant Ctrl+K déclaré |
| D1 | Enfants de la racine | construction | Seule l'Application crée Features, Foundation et adaptateurs | I23, I56 | types : pas de création de Feature hors Manifest |
| D2 | Pérennité de l'Entity | construction | Aucune API de destruction d'une Entity ; réinitialiser passe par `mutate` | I22 | types : `entity.destroy` absent |
| D3 | Élément de la Foundation | démarrage | Élément de la Foundation résolu au démarrage ; éléments de deux racines non emboîtés | I33, I34 | démarrage : deux Foundations emboîtées |
| D4 | Une Feature, une Entity | statique | Une Entity par Feature dans le type de la Feature | I22 | types : Feature sans Entity |
| D6 | Interface non adressable | construction | Ni View ni Composer n'ont d'identité ni de Channel | I4 | types : `emit` absent d'une View |
| D7 | Adaptateurs de l'hôte | statique | Accès direct à une API de l'hôte hors des éléments admis par les Foundations et hors B.6 signalé (lint, outils de développement) ; sources du catalogue réservées aux adaptateurs | — | lint : `window.addEventListener('resize')` dans une View |
| D9 | Borne causale | exécution | Compteur de profondeur : message au-delà de la borne rejeté et signalé | I9 | exécution : boucle `cart`/`promo` arrêtée |
| D10 | Admission par la cible | démarrage | Sources de niveau document déclarées au Manifest ; View qui les écoute refusée | — | démarrage : conflit de raccourci |
| D11 | Composition réservée | construction | La View n'a aucune API de création de View ; seuls Foundation et Composers en ont | I19, I20, I36 | types : `new View()` dans une View |
| D12 | Décideur pur | construction | Le type du Composer n'offre ni écriture du DOM, ni gestionnaire d'événement, ni `trigger`, ni état local | I35, I38 | types : `trigger` absent du Composer |
| D13 | Behavior aveugle | statique | Behavior sans accès à sa View ; clés disjointes de celles de la View | I43, I44, I45 | types : clé partagée refusée |
| D14 | Enfants de la racine déclarés | démarrage | Manifest lu une fois ; namespaces référencés validés ; statique si le Manifest est écrit d'un seul tenant | I21, I69, I70, I95 | démarrage : Command vers un namespace inconnu |
| D15 | Navigation fournie | démarrage | Namespace `router` réservé ; Router activé par le Manifest | I28, I71 | types : clé `router` dans le Manifest applicatif refusée |
| D16 | Contrats déclarés | statique | `implements T{Composant}Callbacks` : un traitement par message ou fait déclaré, et aucun autre | I14, I16, I48, I82, I84, I88, I92 | types : handler manquant ou en trop |
| D17 | Chorégraphie du domaine | construction | Le contrat d'une Feature ne peut déclarer de Command vers une autre Feature | I25 | types : `trigger` vers une Feature depuis une Feature |
| D18 | L'interface relaie, elle n'enchaîne pas | statique | Dans une View, le type d'un traitement d'Event ou de réponse n'offre pas `trigger` (D16) | I13 | types : `trigger` dans `onCartItemAddedEvent` refusé |
| B.2 | Périmètres disjoints ; une par hôte | démarrage | Périmètres disjoints ; adaptateurs « un par hôte » activés par une seule racine | — | démarrage : deux préfixes qui se recouvrent |
| B.4 | Opérations réservées et points d'extension | construction | Opérations réservées de l'adaptateur non surchargeables (méthodes finales ou privées) | — | types : surcharge de l'admission refusée |
| B.5 | Projection sur différence | construction | Projection réalisée par l'adaptateur fourni, seulement sur différence | — | exécution : retour arrière sans entrée ajoutée ; redirection en remplacement |

A0.a, A0.b et A0.d délimitent le modèle sans contraindre le code applicatif ; ils n'appellent pas de garde. Les décisions D5 (retirée) et D8 (réalisée par l'infrastructure) n'imposent rien au code applicatif.

## 2. Garanties de Bonsai

Les garanties et D8 ne contraignent pas le code applicatif : elles engagent l'implémentation de Bonsai. Elles ne reçoivent pas de garde, mais un test de conformité de l'infrastructure.

| Garantie | Ce qui est vérifié | Test de conformité |
| --- | --- | --- |
| G1 | délivrance au seul propriétaire ou aux seuls abonnés | scénario positif et négatif dans `tests/conformite/g1` |
| G2 | message, contexte et réponse inchangés | scénario positif et négatif dans `tests/conformite/g2` |
| G3 | rien n'est délivré pour un Channel détruit | scénario positif et négatif dans `tests/conformite/g3` |
| G4 | l'infrastructure n'est propriétaire de rien | scénario positif et négatif dans `tests/conformite/g4` |
| G5 | un traitement à la fois ; une Query seule en cours de traitement | scénario positif et négatif dans `tests/conformite/g5` |
| G6 | aucun message entre racines | scénario positif et négatif dans `tests/conformite/g6` |
| G7 | un traitement en échec est sans effet | scénario positif et négatif dans `tests/conformite/g7` |
| D8 | ordre de délivrance : ordre de production, puis ordre des abonnements | scénario positif et négatif dans `tests/conformite/d8` |

## 3. Bilan

| Niveau | Obligations |
| --- | --- |
| construction | 21 |
| statique | 10 |
| démarrage | 7 |
| exécution | 3 |
| aucune | 2 |

Obligations sans garde possible, et pourquoi :

- **A3.h** : l'origine d'une information émise n'est pas observable par Bonsai. La revue de code et le typage des charges d'Event sur l'état de l'Entity en limitent les écarts.
- **A4.d**, en partie : la provenance d'une valeur affichée n'est pas observable. La garde vérifie seulement que la View n'écrit l'information métier qu'en traitement d'un message (D16).

Niveaux tardifs justifiés :

- **A4.a, A5.a, D9** : les états intermédiaires, le contexte d'exécution d'une mutation et la profondeur d'une chaîne ne sont connus qu'à l'exécution.
- **A4.c, D7** : TypeScript ne distingue pas un appel à l'hôte d'un autre appel ; la garde est une règle de lint, de niveau statique.
- **D14, A5.d, B.2** : un Manifest assemblé à partir de modules ESM n'est complet qu'au démarrage (16.9).
