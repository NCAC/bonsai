# Avis 2 (indépendant) — réorganisation documentaire et workflow

> Rédigé sans relecture de l'avis-1 au moment de l'analyse : preuves reprises
> directement du RFC et du dépôt (`docs/`, `lib/check-adr-tested-status.ts`,
> `tests/`). Comparaison avec l'avis-1 en fin de document.

## Avis d'ensemble

**Cohérent, faisable, mais le RFC sous-estime ce qui existe déjà.** Une bonne
partie de ce qu'il propose comme nouveauté (traçabilité preuve↔test, séparation
décidé/livré, zone d'exploration non normative) est déjà en place, sous une
forme plus riche que l'exemple de contrat donné en §5. Le vrai travail n'est
pas de créer ces mécanismes mais de **fusionner deux formulations qui les
portent déjà séparément** (`invariants.md` + ligne `Livré` des ADR) sans en
perdre l'information, et de trancher un axe de maturité qui aujourd'hui n'existe
pas encore (voir le cas `5-rendu.md` ci-dessous).

## Ce qui existe déjà et que le RFC réinvente

- **Le format de contrat proposé (§5, `Maturité` / `Preuves` / `Tests` /
  `Implémentation`) est *moins* détaillé que `docs/spec/reference/invariants.md`
  aujourd'hui.** Chaque invariant y porte déjà : un mécanisme de preuve
  (`Compile-time`, `Bootstrap`, `Runtime`, `Code review + Lint`, `Architectural`),
  une criticité (`Bloquante` / `Importante` / `Recommandée`), un état
  (`✅ livré`, `⚠️ partiel`, `⏳ strate N`, `📐 convention`), le point
  d'implémentation, **et** le signal d'erreur exact (message, code TS). Migrer
  vers le format RFC sans reprendre ces colonnes serait une régression
  d'information, pas un gain de lisibilité.
- **Le script cible `check-contract-coverage.ts` (§12) existe déjà** sous le nom
  `lib/check-adr-tested-status.ts` : il extrait les `I<N>` de la ligne « Invariants
  impactés » de chaque ADR, cherche leur citation dans `tests/` par regex
  (`\bI(\d+)\b`), et liste les candidats à la promotion `Accepted → Tested`.
  Il manque la détection de doublons et la vérification bidirectionnelle
  demandées par le RFC, mais c'est une extension du script actuel, pas une
  réécriture.
- **La distinction « décidé mais non livré » vs « pas encore décidé » existe déjà**
  dans `docs/ROADMAP.md` : section « Décidé, reporté après la v1 » (ADR accepté,
  livraison différée) séparée de « Pistes à instruire » (pas d'ADR). C'est
  exactement la distinction que le RFC redemande entre contrat cible et
  workbench — elle est déjà écrite, juste pas nommée pareil.
- **`docs/archive/explorations/` joue déjà le rôle de proto-workbench** : des
  notes de réflexion brutes, non normatives, antérieures à une décision
  (`reflexion-behavior.md`, `réflexion-cross-feature.md`, etc.), actuellement
  archivées après coup. Un `docs/workbench/` *actif* est une bonne idée, mais
  attention à ne pas superposer trois zones d'exploration : workbench, ADR
  `🟡 Proposed` (qui sert déjà ce rôle : voir ADR-12, ADR-26), et
  `archive/explorations`. Le RFC ne dit pas ce qui reste aux ADR `🟡 Proposed`
  une fois le workbench introduit.
- **Une partie de la cible §17 est déjà en place, sans lien avec ce RFC** :
  `docs/pugx/` existe déjà tel que décrit (`spec-2.md`, `syntaxe-spec.md`,
  `development-plan.md`, `BRIEF-AGENT-PUGX.md`), créé par un commit antérieur
  (`docs: add pugx folder`, 5400596). Ce point de la proposition n'est donc
  pas une migration à faire — juste à documenter comme acquis.
- **`CONTRIBUTING.md` est déjà à la racine** (§17) — cohérent avec la cible RFC.
  En revanche `docs/ROADMAP.md` et `docs/GENESIS.md` sont **sous** `docs/`,
  pas à la racine comme le prévoit le RFC pour la roadmap (§17) — à trancher
  explicitement, ce n'est pas neutre pour tous les liens qui pointent vers eux.

## Ce qui manque vraiment (le RFC a raison ici)

- **`docs/guides/` ne correspond pas à la cible RFC.** Le RFC décrit des guides
  *tâche* (« Créer une Feature », « Créer une View », « Écrire un test »,
  « Créer un package »). Les guides actuels (`FRAMEWORK-STYLE-GUIDE.md`,
  `BUILD-CODING-STYLE.md`, `NAMESPACE-MENTAL-MODEL.md`, `TESTING.md`,
  `FORMS-GUIDE.md`) sont des documents de **convention**, pas des tutoriels
  procéduraux. C'est un vrai gap à combler, indépendant de la question des
  contrats.
- **Aucun axe de maturité indépendant du statut de décision n'existe
  aujourd'hui**, et sa nécessité est vérifiable concrètement : `docs/spec/5-rendu.md`
  affiche `Statut : 🟢 Stable`, alors qu'il dépend explicitement d'
  [ADR-26](../adr/ADR-26-souscription-view.md), toujours `🟡 Proposed`, et que
  la majorité de son contenu (strates 1c/1d) est `⏳` selon ADR-31. Le mot
  « Stable » de la spec ne veut donc pas dire la même chose que « Stable » au
  sens où le RFC l'entend pour un contrat. C'est exactement le risque de
  conflation que soulève le RFC en introduisant une maturité par contrat — sauf
  qu'il faut un champ *en plus* du statut ADR, pas à sa place, sous peine de
  reproduire ce même défaut ailleurs.
- **Les identifiants scopés par domaine sont réellement plus lisibles**, mais
  plusieurs invariants sont transversaux par nature (I5 : Views/Behaviors
  n'accèdent jamais à Entity — touche View, Behavior *et* Entity ; I30 : domain
  state — Entity, View, Behavior ; I82/I84 : couple Feature/View). Le RFC ne
  précise pas la règle de rattachement pour ces cas ; sans elle, la migration
  vers des préfixes de domaine va soit dupliquer l'ID sous plusieurs préfixes,
  soit forcer un choix arbitraire de domaine « propriétaire ».

## Coût mécanique de la migration (mesuré, pas estimé)

- 21 ADR portent une ligne « Invariants impactés » à réécrire.
- 20 fichiers de test citent au moins un `I<N>` ; 87 identifiants `I<N>`
  distincts apparaissent au total dans `tests/` + `docs/adr/`.
- Le script de vérification actuel dépend d'un **word-boundary regex sur un
  entier** (`\bI(\d+)\b`) : robuste aujourd'hui, mais tout identifiant
  scopé (`FEA-001`) demandera un nouveau parseur, pas une regex adaptée à la
  marge — à écrire avant de renommer quoi que ce soit (le RFC le dit lui-même
  en §12, dans le bon ordre).
- Rien dans `.github/workflows/regression.yml` n'exécute
  `tsc --noEmit -p tsconfig.test.json` (seul type-check qui couvre
  `packages/` et `tests/`) : une preuve « S » affichée sur un contrat concernant
  ces zones n'est vérifiée qu'à la main aujourd'hui. Avant d'afficher des
  preuves « S » sur les nouveaux contrats, ce point mérite d'être réglé ou au
  moins noté comme limite connue (il l'est déjà, dans ADR-32).

## Trajectoire proposée

1. **Ne pas partir d'un format de contrat vierge.** Prendre les colonnes déjà
   présentes dans `invariants.md` (mécanisme, criticité, état, implémentation,
   signal d'erreur) et les redistribuer dans le format cible du RFC (`Maturité`,
   `Preuves`, `Tests`, `Implémentation`) en vérifiant qu'aucune colonne n'est
   perdue. Ajouter un champ `Ancien ID` en alias permanent, pas transitoire —
   87 citations existantes dans `tests/` et 21 lignes d'ADR pointent vers ces
   numéros ; les invalider casse la traçabilité historique sans bénéfice.
2. **Écrire la règle de rattachement multi-domaine avant de préfixer quoi que
   ce soit** — sinon les ~10 invariants transversaux (I5, I13, I22, I30, I82,
   I84…) bloquent la migration au premier cas réel.
3. **Piloter sur un domaine à forte densité de contrats transversaux** plutôt
   que sur le plus simple : Entity + View (via I5, I30, I82) est un meilleur
   test de la règle de rattachement que Channel + Entity, parce que ça force la
   décision dès le pilote au lieu de la découvrir à l'échelle.
4. **Traiter `docs/guides/` séparément et en parallèle** : le gap ADR/invariants
   et le gap guides-tâche ne partagent pas la même mécanique de preuve ; les
   coupler retarderait le second sans accélérer le premier.
5. **Documenter ce qui est déjà fait** (`docs/pugx/`) au lieu de le remigrer, et
   trancher l'emplacement racine vs `docs/` pour ROADMAP/GENESIS avant de
   toucher aux liens entrants.

## Comparaison avec l'avis-1

**Accord sur le fond** : cohérent, faisable progressivement, pas en big bang ;
le risque central est la troisième formulation d'une même règle ; la maturité
ne doit pas fusionner décision/livraison/preuve (le cas `5-rendu.md` /
ADR-26 confirme indépendamment l'exemple que l'avis-1 donnait) ; les
identifiants transversaux (I97 cité par l'avis-1, I5/I13/I22/I30/I82/I84 trouvés
ici) posent le même problème de rattachement de domaine ; les `I<N>` doivent
migrer avec une correspondance explicite, pas un remplacement textuel.

**Ce que cet avis ajoute** :

- Le script cible et la distinction décidé/non-décidé existent déjà dans le
  dépôt sous d'autres noms (`check-adr-tested-status.ts`, `ROADMAP.md`) —
  l'avis-1 ne le signalait pas explicitement comme *déjà construit*, seulement
  comme « socle exploitable ».
- `docs/pugx/` correspond déjà exactement à la cible du RFC — un point de la
  proposition est un fait acquis, pas une action.
- `docs/guides/` ne correspond *pas* à la cible RFC (guides de convention vs
  guides de tâche) — un gap réel, distinct de la question des contrats, que
  l'avis-1 ne traite pas.
- Chiffres mesurés (21 lignes ADR, 20 fichiers de test, 87 `I<N>` distincts)
  plutôt qu'une estimation qualitative de l'ampleur de la migration.
- Recommandation de piloter sur Entity + View plutôt que Channel + Entity,
  précisément parce que ce couple concentre les invariants transversaux qui
  feront échouer un rattachement de domaine mal spécifié.

**Point sur lequel je nuancerais l'avis-1** : présenter `archive/explorations/`
comme rôle déjà proche du workbench, ce qui pose une question que l'avis-1 ne
soulève pas — avec un workbench actif **et** des ADR `🟡 Proposed`, il faut
dire explicitement ce qui distingue les deux, sinon on recrée la duplication
que le RFC veut supprimer, sous une forme différente.

## Question non tranchée par les deux avis

Le RFC ne dit pas ce que devient une ADR `🟡 Proposed` une fois le workbench
introduit : fusionnée dans le workbench, ou statut ADR conservé en parallèle ?
Les deux avis s'accordent sur le risque, ni l'un ni l'autre ne tranche.
