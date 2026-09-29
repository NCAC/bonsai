# Prompt de contexte — Réorganisation Bonsai (septembre 2026)

> À transmettre tel quel à un agent LLM qui reprend le chantier.
> Dernière mise à jour : 29 septembre 2026.

---

## Rôle et mission

Tu reprends un chantier en cours sur le dépôt **Bonsai** (framework front TypeScript, monorepo pnpm,
tests Jest, scripts via `tsx`). L'objectif du mainteneur est de **définir de nouveaux processus de
développement qui produisent à la fois du code testé et validé et de la documentation**, sans
divergence possible entre les deux. Il est prêt à tout réécrire ou repenser si nécessaire.

Réponds en français. Ne réécris pas le code applicatif tant que le nouveau modèle documentaire
n'a pas révélé les écarts réels.

---

## Documents de référence (à lire en premier)

| Fichier | Rôle |
| --- | --- |
| `docs/reorganisation-sept-2026/arbre-invariants.md` | Classement des invariants I1–I98 sous 9 principes. Esquisse non actée. |
| `docs/reorganisation-sept-2026/arbre-invariants-precision.md` | Même arbre + ⟨mode · état · tests⟩ par invariant, et matrice nature × vérification. |
| `docs/reorganisation-sept-2026/reorganisation-documentation-workflow.md` | RFC antérieure (architecture vivante, contrats ENT-001…, workbench, snapshots). **Jugée insuffisante** par le mainteneur ; en conserver les bonnes idées seulement. |
| `docs/invariants/principes.yaml` | **Nouveau.** Les 10 principes, source de vérité. |
| `docs/invariants/P8.yaml` | **Nouveau.** Branche pilote P8, un enregistrement par invariant. |
| `tools/invariants/invariants.ts` | **Nouveau.** Script de validation + génération. |

Les autres esquisses de `docs/reorganisation-sept-2026/` ne satisfont pas le mainteneur :
les deux arbres sont le point de départ retenu.

---

## Le modèle retenu

### Natures

- **P — Principe** : non substituable ; le changer, c'est changer de modèle (rare, explicite, daté).
- **E — Énoncé** : invariant existant qui formule déjà le principe.
- **C — Conséquence** : se déduit ; on ne la décide pas, on la vérifie.
- **D — Décision** : une réalisation parmi d'autres, révisable sans toucher au principe.
  Doit porter un champ `pourquoi`, **qui remplace l'ADR**.
- **V — Vérification** : un moyen de garantir une autre ligne, pas une règle nouvelle.

Le graphe est un DAG : `parents[0]` = parent principal, les suivants = seconds parents (`↔ Pn`).

### Les 10 principes

1. **P1** Souveraineté du domaine — le domain state n'existe que dans une Entity ; seule sa Feature y accède.
2. **P2** Dépendances déclarées — aucun canal implicite.
3. **P3** Sémantique des trois voies — Command (1 propriétaire, refusable), Event (N abonnés), Request (sans effet).
4. **P4** Causalité traçable et bornée.
5. **P5** La View projette, elle ne décide pas.
6. **P6** Propriété exclusive du DOM — ⚠️ aucun invariant existant ne l'énonce (I38 mêle règle et décision N1/N2/N3).
7. **P7** Cycle de vie hétéronome.
8. **P8** Identité par le manifest.
9. **P9** Garantie au plus tôt (méta-principe) — ❓ tension non arbitrée avec les invariants
   en mode `run` (I8, I9, I20, I37, I65, I97, I98).
10. **P10** Une responsabilité, un rôle (méta-principe) — explique pourquoi les rôles sont
    distincts ; énoncé I100 (table rôle → responsabilité), second parent des décisions qu'il
    justifie (I22, I23, I35, I36, I44, I45, I63, I67).

### Vérification : trois axes distincts, à ne jamais confondre

- **mode** : `type` · `boot` · `type+boot` · `run` · `revue`
- **état** : `livre` ✅ · `partiel` ⚠️ · `cible` ⏳ · `convention` 📐 · `~` non qualifié
- **tests** : citation détectée dans un test de type (`T`) ou runtime (`R`)

Règles clés : *cible ≠ livré* ; *être cité dans un test ≠ être prouvé* (le test doit passer en CI).

### Redondances identifiées (à fusionner, un ID conservé + alias)

Toutes traitées. Fusionnées : I1 = I12 = I26 (`P3.yaml`) · I15 = I50 (`P2.yaml`) · I21 = I24
(`P8.yaml`) · I73 = I47 · I74 = I49 (`P9.yaml`). Conservées distinctes (inclusion) : I51 ⊂ I96 · I53 ⊂ I96.

---

## Processus de développement cible

1. **Diff d'arbre** : quelles lignes le changement ajoute, modifie ou fait passer de ⏳ à ✅.
2. **Tests** écrits en citant ces identifiants.
3. **Code.**
4. **CI verte** : suite Jest + `pnpm invariants:check` (registre cohérent, arbre généré à jour).

Les idées immatures restent dans un workbench non normatif ; elles n'entrent dans le registre
qu'au stade `D` avec l'état `cible`. La documentation par composant (Feature, View…) sera une
**vue générée**, jamais la source.

---

## État d'avancement

### Fait

- `principes.yaml` : les 10 principes (+ `meta` pour P9 et P10, `question-ouverte` pour P9).
- `P10.yaml` : I100 (E). Écart relevé : aucun invariant n'énonce qu'une Entity ne porte aucune
  logique métier. L'arbre généré liste sous chaque principe ses rattachements en second parent.
- `P1.yaml` à `P7.yaml` : migrés depuis `arbre-invariants-precision.md` (67 lignes avec P8).
  - Fusions : I12 et I26 dans I1 (P3), I50 dans I15 (P2). I51/I53 restent distincts de I96
    (relation d'inclusion ⊂, pas de doublon).
  - Écarts esquisse ↔ matrice `invariants.md` tranchés en faveur de la matrice : I31 et I37
    passent de ✅ à ⚠️ partiel.
  - `pourquoi` des décisions : rédigés à partir des ADR cités dans `invariants.md`, **à relire
    par le mainteneur** ; I9, I46, I52, I54, I55 restent « À compléter » (justification introuvable
    dans les sources lues — I46–I56 sont définis dans `conventions-typage.md`).
  - P6 n'a toujours aucun énoncé (E).
- `P8.yaml` : I69 (E), I68/I72/I87 (C), I21/I71 (D), I95 (V).
  - I24 fusionné dans I21 (`alias: [I24]`) — même garantie (unicité/format des clés, `type+boot`), aucune distinction retenue. Le script compte désormais les citations d'un alias pour la ligne canonique.
  - `pourquoi` de I21 et I71 = brouillons « À compléter », **à rédiger par le mainteneur**.
- `tools/invariants/invariants.ts` :
  - valide le schéma (IDs, doublons, parents existants, `pourquoi` obligatoire sur `D`, enums) ;
  - détecte les citations `I<n>` dans `*.test.ts` / `*.test-d.ts` sous `tests/`, `packages/`, `core/` ;
  - **erreur bloquante** si `etat: livre` (hors mode `revue`) sans aucun test qui cite l'ID ;
  - génère `docs/invariants/generated/arbre.md` (branches non migrées signalées) ;
  - `--check` échoue si le fichier généré n'est pas à jour.
- `package.json` : scripts `invariants` et `invariants:check`.

### Pas encore fait / non vérifié

- Le script vérifie les citations, **pas** que les tests passent (la CI lance Jest avant lui).
- Faux positifs possibles de la regex `\bI\d+\b` (aucun constaté à ce jour).

---

## Prochaines étapes

1. ✅ `pnpm invariants` lancé — script propre (0 erreur), 4 avertissements attendus.
   Seul écart notable : I69 (`mode: type`) n'est cité que par un test runtime, aucun
   test de type ne le cite nommément (ses enfants I68/I72/I87 le sont).
2. ✅ I24 arbitré : fusionné dans I21 (`alias: [I24]`, cf. `P8.yaml`). Reste à faire
   rédiger les `pourquoi` de I21/I71 par le mainteneur.
3. ✅ `invariants:check` branché en CI (`.github/workflows/regression.yml`, étape
   « Invariants registry », après la suite Jest complète).
4. ✅ P1 → P7 migrés (0 erreur). **Reste : traiter les 24 lignes ∅** (prouver, déclasser en
   convention, ou supprimer) :
   - ✅ les 16 lignes citées par un test sont qualifiées d'après le code et le contenu des tests
     (commentaire YAML sur chaque cas non évident). Partiels : I17 (request non contrôlé contre
     `queries`), I27 (refus d'un Command non testé), I28 (aucun Router, seule la réservation
     existe), I36 (slots non livrés, citation d'en-tête seulement). I52 déclassé en convention.
   - ✅ les 8 lignes jamais citées sont qualifiées : I53 livré (prouvé sans citation, champ
     `preuves`) ; I13, I32 déclassés en convention (aucun mécanisme) ; I19, I38 partiels ;
     I44, I45 (pas de package Behavior), I54 (metas, strate 1b) en cible. Plus aucune ligne ∅.
   - Le script compte désormais `preuves` comme une citation et vérifie que le fichier existe.
   - 6 lignes en mode `type` sans test de type (I1, I4, I23, I25, I46, I69) : preuve runtime
     ou structurelle seulement.
   - ✅ P9 migré (`P9.yaml`), I47 fusionné dans I73, I49 dans I74. Registre complet : 88 lignes,
     9 branches, tous les invariants I1–I98 présents (ligne ou alias) sauf I59–I62, réservés
     sans attribution. 7 avertissements « mode type sans test de type » (I1, I4, I23, I25, I46,
     I69, I79).
5. ✅ P6 réécrit : exclusivité de propriété par scopes disjoints, fixés au montage (et non au
   bootstrap). Nouvel énoncé I99 (scope explicite attribué d'en haut) ; les droits par rôle sont
   rangés sous I38 ; I58 déplacé de P7 vers P6 (second parent I20). Le Behavior garde N2 sur ses
   propres nœuds. Reste : arbitrer P9.
6. Ensuite seulement : générer les vues par composant, puis orienter la réécriture du code
   sur les écarts ⚠️/⏳ révélés.

## À éviter

- Réécrire le code avant que le registre n'ait révélé les écarts.
- Renuméroter en ENT-001/FEA-001… pendant la transition (cosmétique, coûteux).
- Maintenir des vues à la main : tout ce qui est dérivé doit être généré.
- Organiser la documentation normative par composant plutôt que par principe.
