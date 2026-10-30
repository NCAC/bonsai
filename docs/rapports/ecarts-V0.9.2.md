# Bonsai — Écarts entre la théorie et le dépôt (jalon V0.9.2)

*Inventaire consolidé des écarts entre la théorie V0.9.2 et le dépôt : branche `develop` (`1d49cec`) pour le code, branche `feature/documentation-big-bang` (`c93eb74`) pour la spécification et les ADR. La théorie fait autorité : chaque écart se corrige dans le dépôt, jamais dans la théorie. Gravité : **critique** = une garantie ou un axiome est violé à l'exécution ; **important** = une décision n'est pas réalisée ou une garde manque ; **mineur** = formulation de la spécification.*

## 1. Infrastructure de communication (`packages/event`)

| # | Écart | Règle | Gravité | Correction |
| --- | --- | --- | --- | --- |
| X1 | `Channel.trigger()` appelle le traitement directement ; `emit()` délivre de façon synchrone par un `Subject` RxJS. Un traitement s'exécute donc au cours d'un autre. | G5 | critique | File d'attente : un message produit pendant un traitement n'est délivré qu'à la fin de celui-ci. |
| X2 | Aucun ordre de délivrance défini entre messages en attente. | D8 | critique | File « premier produit, premier délivré » ; abonnés dans l'ordre d'abonnement, rang pris à l'émission. |
| X3 | Les messages ne portent aucun contexte causal (I7, I8 en cible). | A5.b, A5.c | critique | Métadonnées causales créées par Bonsai à l'admission, transmises sans modification (G2), capturées pour les faits provoqués. |
| X4 | Pas de compteur de profondeur (I9 en cible). | D9 | important | Profondeur dans le contexte causal ; borne lue dans le Manifest. |
| X5 | Un traitement en erreur laisse ses mutations et ses messages ; l'erreur d'un abonné est seulement journalisée (`ListenerError`). | G7 | critique | Patches d'Entity validés à la fin du traitement, file du traitement vidée en cas d'erreur, signalement avec le contexte causal. |
| X6 | `Radio` est un singleton global : un registre de Channels pour tout l'hôte. | G6 | important | Un registre par racine. |
| X7 | Voie `request`/`reply`, `TRequestResultFor`, ADR-02 « request synchrone » ; un traitement qui échoue rend `null` (I55). | lexique, G7 | important | Renommer en `query` ; distinguer l'échec d'une réponse `null`. |

## 2. Rôles de l'interface utilisateur

| # | Écart | Règle | Gravité | Correction |
| --- | --- | --- | --- | --- |
| X8 | La Foundation altère `<html>` (ancienne D27, aujourd'hui ADR-20 ; I33, I38). | D3, annexe A.1 | important | `<html>` relève de l'adaptateur du document. |
| X9 | La Foundation est toujours `document.body` ; un `rootElement` doit descendre de `<body>` (I34). | D3 | mineur | Élément de la Foundation déclaré au Manifest, `body` par défaut ; refus de deux éléments emboîtés. |
| X10 | `View.mount()` résout son élément par un `document.querySelector()` global. | A3.c, 16.5 | important | Résolution dans la part attribuée par le Composer. |
| X11 | Le Composer détache une View sans la détruire : ses écouteurs restent actifs. | T3, G3 | important | Détruire la View, ce qui rend sa part. |
| X12 | « Réapparition du slot » : le même Composer est relancé ; état « suspendu » (I58). | 16.6 | mineur | Slot retiré : Composer détruit ; slot revenu : nouveau Composer. |
| X13 | Lecture du scope du Composer non restreinte (I35). | A3.c, 6.5 | mineur | Exclure les parts attribuées aux Views. |
| X14 | I35 : le Composer « ne possède aucun nœud ». | 16.6 | mineur | Il est propriétaire du contenu de son slot ; sa seule opération est l'attribution. |
| X15 | Le Behavior est décrit comme un composant doté de « ses propres Channels ». | 16.7 | mineur | Partie de la View ; déclarations reprises par la View. |
| X16 | Une View peut adresser une Command depuis un traitement d'Event. | D18 | important | Le type d'un traitement d'Event n'offre pas `trigger`. |

## 3. Domaine, Manifest et navigation

| # | Écart | Règle | Gravité | Correction |
| --- | --- | --- | --- | --- |
| X17 | Le contrat d'une Feature peut lister des Commands vers d'autres Features. | D17 | important | Contrat de Feature sans `triggers` vers une Feature ; I25 reformulé. |
| X18 | Rien n'empêche une Feature de lister un Channel de l'interface. | A4.b | important | Garde statique par le contrat (D16). |
| X19 | `mutate()` est appelable hors d'un traitement. | A5.a | important | Refus à l'exécution. |
| X20 | Le Router (non livré) appelle `pushState`, offre `back`/`forward`, est instancié hors Manifest, sans `mode`. | D15, D7, D14, A4.b, B.5 | important | Contrat de D15 ; adresse tenue par l'adaptateur historique. |
| X21 | Le Manifest ne porte ni adaptateurs, ni élément de la Foundation, ni sources de niveau document, ni borne causale, ni activation du Router. | 16.9 | important | Étendre la configuration de l'Application. |
| X22 | Aucun adaptateur de l'hôte n'est livré. | D7, annexe B | important | Implémenter le catalogue (`docs/adaptateurs/`). |
| X23 | I66 nomme le démarrage « frontière de confiance ». | 11.7 | mineur | « Phase de démarrage ». |
| X24 | I8 : le contexte d'origine est « créé par l'UI » ; I30 : la View ne porte « aucun domain state ». | A5.c, A4.d | mineur | Reformuler (voir `registre-V0.9.2.md`). |

## 4. Bilan

| Gravité | Nombre |
| --- | --- |
| critique | 4 (X1, X2, X3, X5) |
| important | 13 |
| mineur | 7 |

Les quatre écarts critiques touchent tous le cœur de l'infrastructure de communication : la file de messages (G5, D8), le contexte causal (A5) et l'annulation d'un traitement (G7). Ils se corrigent ensemble, dans `packages/event` et dans la classe de base des Features. Le critère de sortie de la V0.9.2, « aucun écart critique théorie/implémentation », suppose donc ce chantier de code.

Les gardes manquantes et les tests à écrire sont dans `docs/gardes.md` ; le statut de chaque invariant dans `registre-V0.9.2.md`.
