# Avis sur la réorganisation documentaire et le workflow — septembre 2026

## Avis d’ensemble

**La direction est cohérente et la refonte est faisable**, à condition de la traiter comme une migration de la source normative, et non comme un simple déplacement de fichiers. Le gain attendu est de pouvoir répondre plus vite à la question : « Qu’est-ce qui est vrai, livré et vérifié aujourd’hui ? » Le risque principal serait de créer, pendant la transition, une troisième formulation des mêmes règles à côté de la spec et des invariants.

Analyse documentaire uniquement : aucun fichier du projet n’a été modifié pour établir cet avis et aucun test n’a été exécuté.

## Cohérence avec l’existant

- **La proposition prolonge une évolution déjà engagée.** Les 34 ADR de l’index sont désormais « vivants » : ils sont réécrits en place et Git conserve l’historique. La spec décrit également le contrat en vigueur. Le problème n’est donc pas tant une chaîne d’ADR supersedés qu’une connaissance répartie entre spec, ADR, invariants et état de livraison ([index ADR](../adr/README.md), [règles de la spec](../spec/README.md)).
- **Une « architecture vivante » comme source normative unique exige une bascule explicite d’autorité.** Aujourd’hui, la spec est la source des contrats et, en cas de contradiction provisoire, l’ADR fait foi ([index documentaire](../README.md), [règles de préséance](../spec/README.md)). Copier les contrats dans de nouvelles pages sans retirer ou déclasser les anciennes formulations augmenterait précisément la dette à réduire.
- **La maturité ne doit pas confondre trois questions :** une règle est-elle décidée, implémentée, prouvée ? La [spec de rendu](../spec/5-rendu.md) se dit stable et normative alors que presque tous ses mécanismes restent à implémenter ; l’articulation des souscriptions de View est toujours ouverte ([ADR-26](../adr/ADR-26-souscription-view.md)). Mieux vaut des champs distincts qu’un parcours unique « exploratoire → stable ». Un contrat « retiré » relève plutôt de l’historique que de l’architecture courante.
- **Les préfixes par domaine sont plus lisibles, mais ne remplacent pas mécaniquement les invariants.** Certaines règles sont transversales, par exemple l’ownership Feature–Entity ; d’autres regroupent plusieurs assertions dans une seule entrée, comme I97 ([registre et matrice des invariants](../spec/reference/invariants.md)). Définir un domaine propriétaire principal, permettre les renvois depuis d’autres domaines et scinder les règles trop composites avant d’attribuer leurs preuves. Prévoir explicitement Router, Radio, rendu et distribution dans la taxonomie.
- **Workbench et snapshots ont leur place.** Ils peuvent accueillir les questions réellement ouvertes et résumer les strates closes. Vider systématiquement le journal de conception pourrait toutefois effacer des motivations qui ne méritent pas un snapshot : mieux vaut le solder ou l’archiver sélectivement. Conserver la distinction déjà présente dans la [roadmap](../ROADMAP.md) entre décisions reportées et pistes non décidées.

## Faisabilité et coût réel

**Faisable progressivement ; déconseillé en « big bang ».** Le socle existe : pages par composant, index thématique des invariants, matrice indiquant phase, mécanisme et état, tests organisés par strate ([index de la spec](../spec/README.md), [matrice](../spec/reference/invariants.md), [guide de test](../guides/TESTING.md)). Une première page de contrats peut donc être construite à partir de matière existante.

Les difficultés concernent surtout la traçabilité et les garanties annoncées :

1. Les identifiants `I<N>` sont cités dans les ADR et les tests ; I46–I56 sont définis dans un autre document et I59–I62 sont réservés. La migration demande une correspondance ancien → nouveau, notamment si une règle est scindée, plutôt qu’un remplacement textuel global ([index thématique](../spec/README.md), [registre](../spec/reference/invariants.md)).
2. Le [vérificateur actuel](../../lib/check-adr-tested-status.ts) lit les ADR, extrait leurs invariants et cherche leurs citations textuelles dans les tests. Il est informatif, toujours non bloquant, et une citation ne prouve pas la pertinence du test. Le futur contrôle devra au minimum vérifier les définitions, les doublons et les références dans les deux sens ; la qualité des assertions restera une affaire de revue humaine.
3. Une preuve statique « S » n’est solide que si le contrôle TypeScript concerné est exécuté. Or la [CI actuelle](../../.github/workflows/regression.yml) lance le type-check principal et Jest, pas la commande distincte qui vérifie les tests de types et leurs `@ts-expect-error` ([limite documentée](../adr/ADR-32-tests-preuve-architecture.md)). C’est un préalable important avant d’afficher certains contrats comme statiquement prouvés.
4. Les déplacements concerneront aussi les liens, les guides, le [guide de contribution](../../CONTRIBUTING.md) et les points d’entrée. La proposition prévoit notamment une roadmap à la racine alors que la roadmap actuelle est [sous docs](../ROADMAP.md) ; le guide de contribution prescrit encore de citer `I<N>`.

## Trajectoire recommandée

1. **Définir le modèle avant de déplacer les textes :** pour chaque contrat, identifiant, énoncé, domaine propriétaire, décision prise ou non, livraison (`livré` / `partiel` / `cible`), preuves réellement exécutées, références au code et aux tests, ancien identifiant `I<N>` éventuel.
2. **Faire un pilote sur deux domaines livrés**, par exemple Channel et Entity. Migrer quelques règles précises, vérifier qu’une seule formulation reste normative et mesurer si la lecture devient réellement plus simple.
3. **Construire le registre et son contrôle avant de renommer les citations** ; conserver temporairement les anciens identifiants comme alias. Générer l’index à partir des pages, sans en faire une seconde source éditable.
4. **Migrer séparément le non-livré et l’indécis.** Un contrat cible peut rester décrit comme tel ; une question comme celle de l’ADR-26 va au workbench sans être présentée comme garantie. Conserver le phasage des strates 0, 1a, 1b–1d et 2 ([ADR-31](../adr/ADR-31-strates-perimetre-v1.md)).
5. **Basculer les points d’entrée et archiver l’ancien normatif en dernier**, après vérification des liens et de la couverture. Cela évite une période où personne ne sait quelle page fait foi.

**Arbitrage proposé :** commencer par une architecture vivante pilote, pas par la réorganisation intégrale de l’arborescence. Si le pilote réduit effectivement le nombre de lieux à consulter sans masquer les écarts code–contrat, la refonte complète devient raisonnable.

## Questions à trancher

1. L’architecture courante doit-elle décrire uniquement les garanties livrées, ou également les contrats cibles décidés mais non implémentés, clairement distingués ?
2. Faut-il remplacer à terme les `I<N>` ou les conserver comme alias permanents afin de préserver les références historiques ?
