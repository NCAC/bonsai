# ADR-0043 : Statut `🔵 Tested` — gate de preuve d'architecture dans le cycle de vie ADR

| Champ                   | Valeur |
| ----------------------- | ------ |
| **Statut**              | 🟢 Accepted |
| **Date**                | 2026-05-07 |
| **Décideurs**           | @ncac |
| **RFC liées**           | — (méta-ADR sur le process documentaire) |
| **ADR liées**           | [ADR-0030](ADR-0030-testing-as-architecture-proof.md) (tests = preuve d'architecture), [ADR-0034](ADR-0034-continuous-verification-strategy.md) (vérification continue), [ADR-0033](ADR-0033-git-workflow-versioning-strategy.md) (workflow Git), [ADR-0028](ADR-0028-implementation-phasing-strategy.md) (phasage par strates) |
| **Décisions amendées**  | TEMPLATE ADR — ajout d'un statut `🔵 Tested` ; `docs/adr/README.md` — légende et diagramme de cycle mis à jour ; `.husky/pre-commit` — instrumentation informative ajoutée |
| **Invariants impactés** | — (méta-ADR : pas d'invariants runtime, l'ADR définit lui-même son critère de transition) |

---

## Contexte

ADR-0030 a établi que **les tests sont la preuve exécutable des invariants documentés**. Mais dans le corpus actuel, le statut d'un ADR ne reflète pas si cette preuve existe :

- ADR-0041 et ADR-0042 ont leur code mergé sur `develop` (PR #15 et #16) avec tests verts citant les invariants impactés (I77–I88), mais leur frontmatter reste `🟡 Proposed` ou est passé directement à `🟢 Accepted` sans matérialiser l'étape de validation par les tests.
- Inversement, des ADRs `🟢 Accepted` peuvent décrire des invariants sans test associé — par exemple ADR-0001 (entity diff notification) cite des invariants I1–I6 dont la couverture par les tests strate-0 est partielle.
- Le lecteur n'a aucun moyen de distinguer en un coup d'œil un ADR « décidé sur papier » d'un ADR « éprouvé par la suite de tests ».

Or l'esprit même d'ADR-0030 est de transformer la spécification prose en assertions exécutables. Le statut d'un ADR doit refléter cette progression.

---

## Contraintes

- **C1 — Continuité** : Le statut existant `🟢 Accepted` doit rester valide. Les ADRs déjà figés ne doivent pas être déstabilisés.
- **C2 — Trichotomie testabilité** : Tous les ADRs ne sont pas testables. Trois cas se présentent :
  - ADRs avec invariants explicites (I-IDs listés dans `Invariants impactés`)
  - ADRs sans invariants mais prescrivant une sémantique runtime observable
  - ADRs purement process/structurels (phasage, périmètre, conventions doc, organisation monorepo, i18n) — non testables par essence
- **C3 — Critère vérifiable** : Le passage à `Tested` doit reposer sur un critère mécaniquement vérifiable (au moins partiellement) par un script — sinon le statut redevient déclaratif.
- **C4 — Pas de blocage CI** : L'instrumentation ne doit pas bloquer un commit. Les ADRs sont rédigés avant les tests ; un statut « non Tested » est légitime entre la décision et la couverture.
- **C5 — Pas de conflit avec `Superseded` / `Suspended`** : Un ADR `Tested` peut toujours être `Superseded` plus tard si une nouvelle décision le remplace. `Suspended` s'applique aux ADRs proposés mais bloqués — orthogonal à `Tested`.

---

## Options considérées

### Option A — Statut linéaire (`Proposed → Accepted → Tested`)

**Description** : Ajouter `🔵 Tested` comme état terminal au-dessus d'`🟢 Accepted`. Un ADR progresse linéairement. Les états parallèles `⚪ Superseded` et `🟠 Suspended` restent hors de cette chaîne.

| Avantages | Inconvénients |
|-----------|---------------|
| + Lecture en un coup d'œil — le lecteur sait immédiatement si l'ADR est éprouvé | - Un ADR re-testé après amendement ne peut pas être « re-Accepted » sans churn |
| + Cohérent avec le diagramme `Proposed → Review → Accepted` existant | - Force à choisir un état terminal (pas d'« Accepted-mais-en-cours-de-test ») |
| + Critère unique par ADR (pas de matrice à maintenir) | |

**Cycle** :
```
🟡 Proposed  →  🟢 Accepted  →  🔵 Tested
                     ↓                ↓
                ⚪ Superseded   ⚪ Superseded
                     ↑
                🟠 Suspended (depuis Proposed)
```

---

### Option B — État parallèle (Accepted ⊕ Tested comme dimensions orthogonales)

**Description** : Ajouter un champ `Test status` séparé (par ex. `❌ Untested / ✅ Tested`), distinct du `Statut`. Un ADR Accepted peut être Untested ou Tested.

| Avantages | Inconvénients |
|-----------|---------------|
| + Permet de capter « Accepted sans encore tester » sans churner le statut | - Deux dimensions à lire et à maintenir |
| + N'invalide aucun statut existant | - Rompt la convention « un statut = un état » du TEMPLATE |
| | - Demande un second symbole et un second pipeline de validation |

---

### Option C — Gates par strate (`Tested-S0 / Tested-S1 / Tested-S2`)

**Description** : Émettre un statut Tested différencié selon la strate (ADR-0028). Un ADR peut être `Tested-S0` (couvert par les tests strate 0) sans encore l'être en strate 1.

| Avantages | Inconvénients |
|-----------|---------------|
| + Très précis — capture la couverture progressive prévue par ADR-0028 | - Forte complexité — 4 statuts en plus, matrice de transition |
| + Aligne avec le phasage explicite | - La plupart des ADRs touchent une seule strate — surcharge non justifiée |
| | - L'auteur d'un ADR doit qualifier la strate à chaque check — friction |

---

## Analyse comparative

| Critère                              | Option A (linéaire) | Option B (parallèle) | Option C (par-strate) |
| ------------------------------------ | ------------------- | -------------------- | --------------------- |
| Lisibilité (un coup d'œil)           | ⭐⭐⭐                 | ⭐⭐                   | ⭐                     |
| Cohérence avec convention existante  | ⭐⭐⭐                 | ⭐                    | ⭐⭐                    |
| Coût de maintenance                  | ⭐⭐⭐                 | ⭐⭐                   | ⭐                     |
| Précision sémantique                 | ⭐⭐                  | ⭐⭐⭐                  | ⭐⭐⭐                   |
| Adaptation au workflow réel          | ⭐⭐⭐                 | ⭐⭐                   | ⭐                     |

---

## Décision

Nous choisissons **Option A — Statut linéaire (`Proposed → Accepted → Tested`)**.

1. **Lisibilité** prime : le statut d'un ADR doit se comprendre en un symbole. La trichotomie `Proposed → Accepted → Tested` est immédiate.
2. **Cohérence** avec le TEMPLATE et la convention existante : on étend la chaîne, on n'invente pas de matrice parallèle.
3. **Coût de maintenance** : un seul champ à mettre à jour, un seul critère à vérifier.

Option B est rejetée car le double champ « Statut + Test status » force à scanner deux colonnes pour comprendre l'état de l'ADR, et déstabilise les conventions actuelles. Option C est rejetée car la granularité par-strate est plus fine que ce que le workflow réel requiert : la majorité des ADRs touche une seule strate, et le test cumulatif est suffisant.

### Critère de transition `🟢 Accepted → 🔵 Tested`

Un ADR passe `🔵 Tested` si **toutes** les conditions ci-dessous sont satisfaites :

**(C-Inv)** Si la table en-tête contient une ligne `Invariants impactés` non vide :
chaque ID d'invariant listé est cité explicitement par son token `I<N>` (avec frontière de mot — `\bI<N>\b`) dans **au moins un test exécutable** — soit dans le nom du `describe`/`it`, soit dans un commentaire JSDoc adjacent à l'assertion. La forme `[I<N>]` entre crochets est acceptée comme variante plus disambiguante mais n'est pas requise.

**(C-Sem)** Si la ligne `Invariants impactés` est absente ou vide mais l'ADR prescrit une sémantique runtime observable :
la sémantique prescrite est couverte par au moins un test exécutable. La citation d'un ID n'est pas requise — c'est un critère de jugement, validé par review.

**(C-Proc)** Si l'ADR est purement process/structurel (phasage, périmètre, conventions doc, organisation monorepo, i18n, workflow) :
l'ADR reste `🟢 Accepted` perpétuellement. **C'est son état terminal.** La promotion à `Tested` n'a pas de sens car aucun test ne peut prouver une décision de process.

### Cycle de vie complet

```
🟡 Proposed  ──review──►  🟢 Accepted  ──tests──►  🔵 Tested
                              │                      │
                              ├──nouveau ADR──►  ⚪ Superseded
                              │
                              └──blocage externe──►  🟠 Suspended (rare)
```

`🟠 Suspended` s'applique uniquement à des ADRs `Proposed` bloqués par une dépendance externe non levée.
`⚪ Superseded` peut survenir à n'importe quel stade post-Proposed.

---

## Conséquences

### Positives

- ✅ **Lecture instantanée** de la maturité d'un ADR — le `🔵` signale qu'il est plus qu'un papier.
- ✅ **Pression saine** vers l'écriture de tests citant les invariants : pour atteindre Tested, l'auteur doit instrumenter le code-spec.
- ✅ **Aligne le statut avec ADR-0030** : la spécification exécutable devient un état nommé du document.
- ✅ **Critère mécanique** pour la majorité des ADRs (ceux avec invariants) — vérifiable par script.

### Négatives (acceptées)

- ⚠️ **Effort rétroactif ponctuel** — un sweep de tous les ADRs Accepted pour appliquer le critère. Mitigé : un seul commit (commit 2 de cette branche), résultats stables ensuite.
- ⚠️ **Deux niveaux de critère** (mécanique pour C-Inv, jugement pour C-Sem) — accepté car la trichotomie de testabilité (C2) est intrinsèque au corpus.

### Risques identifiés

- 🔶 **Dérive du critère** — un auteur pourrait citer `I82` dans un commentaire sans réelle assertion. Mitigation : la review humaine reste le filet, et le pre-commit script ne fait que signaler les candidats à promouvoir, pas figer le statut. La forme bracketée `[I<N>]` peut être adoptée localement si une disambiguation supplémentaire devient nécessaire.
- 🔶 **ADRs amendés** — un ADR `🔵 Tested` qui amende ses invariants devra être re-vérifié. Mitigation : convention — quand on amende un ADR Tested, on retombe en `🟢 Accepted` jusqu'à mise à jour des tests, ou on supersède.

---

## Actions de suivi

- [x] Mettre à jour `docs/adr/TEMPLATE.md` — ajouter `🔵 Tested` à la liste des statuts et au tableau Historique.
- [x] Mettre à jour `docs/adr/README.md` — légende, diagramme de processus, règle d'amendement.
- [x] Implémenter `lib/check-adr-tested-status.ts` — script Node/tsx qui parse les ADRs, grep `[IN]` dans `tests/`, et signale les transitions candidates.
- [x] Câbler le script dans `.husky/pre-commit` — appel non-bloquant (`|| true`), purement informatif.
- [ ] **Commit 2 de cette PR** — sweep rétroactif des ADRs Accepted → Tested selon le critère.
- [ ] **Action future** — si la convention bare `I<N>` se révèle insuffisamment précise (faux positifs sur d'autres tokens débutant par `I`), envisager un format plus structuré (ex. `@invariant I82` dans un JSDoc de test, ou bracket `[I82]` systématique).

---

## Références

- [ADR-0030 — Tests comme preuve d'architecture](ADR-0030-testing-as-architecture-proof.md)
- [ADR-0034 — Vérification continue (Husky + CI)](ADR-0034-continuous-verification-strategy.md)
- [ADR-0028 — Phasage par strates](ADR-0028-implementation-phasing-strategy.md)

---

## Historique

| Date       | Changement                                                         |
| ---------- | ------------------------------------------------------------------ |
| 2026-05-07 | Création (Proposed)                                                |
| 2026-05-07 | Accepted — décision validée, critère trichotomique acté            |
