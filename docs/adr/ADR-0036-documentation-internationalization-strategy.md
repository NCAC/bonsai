# ADR-0036 : Documentation Internationalization Strategy

| Champ         | Valeur                             |
| ------------- | ---------------------------------- |
| **Statut**    | 🟢 Accepted                        |
| **Date**      | 2026-04-20                         |
| **Décideurs** | @ncac                              |
| **RFC liée**  | — (transversal, toutes RFC et ADR) |

---

## Contexte

Le framework Bonsai est conçu et documenté en **français** par un auteur francophone. L'intégralité du corpus architectural — 10+ RFC, 35+ ADR, guides — est rédigé en français.

Or, pour qu'un framework open-source soit adopté, contribué et critiqué par une audience internationale, la documentation doit être accessible en anglais. Deux enjeux sont en tension :

1. **Qualité de conception** — la réflexion architecturale (RFC, ADR) est plus précise et nuancée dans la langue maternelle de l'auteur. Forcer l'anglais comme langue de rédaction primaire dégrade la qualité des décisions.
2. **Accessibilité internationale** — un développeur anglophone doit pouvoir comprendre l'architecture, les contrats TypeScript et les conventions sans parler français.

### Précédent existant

Le projet a déjà adopté un pattern bilingue à la racine :

- `README.md` (FR) + `README-EN.md` (EN)
- `lib/README.md` (FR) + `lib/README-EN.md` (EN)
- `lib/BUILD.md` (FR) + `lib/BUILD-EN.md` (EN)

Ce pattern fonctionne mais n'a jamais été formalisé ni étendu aux RFC et ADR.

### Déclencheur

Le volume documentaire atteint une masse critique (35+ ADR, 10+ RFC, 5+ guides). Avant d'investir dans la traduction, il faut formaliser la stratégie pour éviter la dette de synchronisation.

---

## Contraintes

- **C1 — Langue de conception** : l'auteur principal pense et conçoit en français. La qualité architecturale ne doit pas être sacrifiée.
- **C2 — Code en anglais** : le code source (noms, JSDoc, types) est déjà en anglais — convention universelle non négociable.
- **C3 — Commits en anglais** : les messages de commit suivent Conventional Commits en anglais (ADR-0033).
- **C4 — Coût de synchronisation** : chaque document traduit doit rester synchronisé avec sa source. Le coût est proportionnel au nombre de documents × fréquence de modification.
- **C5 — Priorité au code** : la traduction est un livrable secondaire — elle ne doit jamais bloquer le développement du framework.

---

## Options considérées

### Option A — Tout en anglais (réécriture)

**Description** : Réécrire tout le corpus en anglais. Le français devient obsolète.

| Avantages                        | Inconvénients                                                     |
| -------------------------------- | ----------------------------------------------------------------- |
| + Une seule version à maintenir  | - Coût de réécriture massif (~35+ documents)                      |
| + Audience internationale native | - Perte de nuance dans la conception architecturale               |
|                                  | - L'auteur pense en FR → traduction mentale permanente → friction |
|                                  | - Les RFC futures seront moins précises                           |

---

### Option B — Français source, anglais dérivé (`*-EN.md`)

**Description** : Le français reste la langue source pour la conception (RFC, ADR, guides). Des traductions anglaises sont produites comme fichiers dérivés avec le suffixe `-EN.md`. Liens croisés en en-tête de chaque fichier.

| Avantages                                               | Inconvénients                                 |
| ------------------------------------------------------- | --------------------------------------------- |
| + Qualité maximale de la réflexion architecturale       | - Deux fichiers par document                  |
| + Pattern déjà en place (README, BUILD)                 | - Coût de synchronisation traduction ↔ source |
| + Traduction incrémentale (documents 🟢 Stable d'abord) | - La traduction peut prendre du retard        |
| + L'auteur reste productif dans sa langue naturelle     |                                               |

**Convention de nommage** :

```
RFC-0001-architecture-fondamentale.md       ← source FR (fait foi)
RFC-0001-architecture-fondamentale-EN.md    ← traduction EN (dérivée)

ADR-0001-entity-diff-notification-strategy.md       ← source FR
ADR-0001-entity-diff-notification-strategy-EN.md    ← traduction EN
```

**En-tête de lien croisé** (dans chaque fichier) :

```markdown
<!-- Fichier FR -->

> 🇬🇧 [English version](RFC-0001-architecture-fondamentale-EN.md)

<!-- Fichier EN -->

> 🇫🇷 [Version française](RFC-0001-architecture-fondamentale.md)
```

---

### Option C — Anglais source, français dérivé

**Description** : Inverser le pattern — tout rédiger en anglais, produire des traductions françaises.

| Avantages                                   | Inconvénients                                      |
| ------------------------------------------- | -------------------------------------------------- |
| + Audience internationale = première classe | - L'auteur conçoit en L2 → perte de précision      |
| + Pattern standard open-source              | - Le corpus existant est en FR → coût de migration |
|                                             | - Friction cognitive permanente pour l'auteur      |

---

## Analyse comparative

| Critère                      | Option A (tout EN) | Option B (FR source) | Option C (EN source) |
| ---------------------------- | ------------------ | -------------------- | -------------------- |
| Qualité conception           | ⭐⭐               | ⭐⭐⭐               | ⭐⭐                 |
| Accessibilité internationale | ⭐⭐⭐             | ⭐⭐                 | ⭐⭐⭐               |
| Coût migration               | ⭐                 | ⭐⭐⭐               | ⭐                   |
| Coût maintenance             | ⭐⭐⭐             | ⭐⭐                 | ⭐⭐                 |
| Productivité auteur          | ⭐                 | ⭐⭐⭐               | ⭐⭐                 |
| Cohérence avec l'existant    | ⭐                 | ⭐⭐⭐               | ⭐                   |

---

## Décision

**Option B — Français source, anglais dérivé.**

### Règles

1. **Le français est la langue source** pour RFC, ADR et guides. Le fichier FR fait foi en cas de divergence.
2. **Le suffixe `-EN.md`** identifie les traductions anglaises. Même nom de base, même répertoire.
3. **Liens croisés obligatoires** : chaque fichier FR doit pointer vers sa version EN (et inversement) via un bandeau en en-tête.
4. **Traduction incrémentale par priorité** :
   - **P0** : README racine, guides d'entrée (QUICK-START) → déjà fait ✅
   - **P1** : RFC 🟢 Stable — architecture fondamentale, composants, invariants
   - **P2** : ADR 🟢 Accepted — décisions clés (ADR-0001, ADR-0033, ADR-0034)
   - **P3** : Guides (BUILD-CODING-STYLE, FRAMEWORK-STYLE-GUIDE)
   - **P4** : RFC 🟡 Draft et ADR 🟡 Proposed — quand ils se stabilisent
5. **Ne jamais traduire un Draft** — attendre la stabilisation (🟢) pour éviter le travail jetable.
6. **Le code reste en anglais** — noms, JSDoc, types, messages d'erreur. Pas de changement.
7. **Les commits restent en anglais** — Conventional Commits (ADR-0033). Pas de changement.
8. **Synchronisation** : quand un fichier FR source est modifié substantiellement, la traduction EN est marquée `⚠️ Out of sync — see FR source` en en-tête jusqu'à mise à jour.

### Marqueur de synchronisation

```markdown
<!-- En-tête d'un fichier EN désynchronisé -->

> ⚠️ **This translation may be out of date.** The French source was updated on YYYY-MM-DD.
> See [Version française](RFC-0001-architecture-fondamentale.md) for the authoritative version.
```

**Option A rejetée** : coût de réécriture prohibitif, perte de qualité de conception — l'auteur ne pense pas en anglais.

**Option C rejetée** : même problème de qualité que A, avec en plus l'incohérence de migrer un corpus 100% FR vers une source EN.

---

## Conséquences

### Positives

- ✅ La réflexion architecturale reste en français — qualité maximale des RFC et ADR
- ✅ L'audience internationale accède aux documents stabilisés en anglais
- ✅ Le pattern `-EN.md` est déjà en place et prouvé (README, BUILD)
- ✅ La traduction est incrémentale — pas de big-bang, pas de blocage

### Négatives (acceptées)

- ⚠️ Deux fichiers par document → volume de fichiers doublé à terme
- ⚠️ Risque de désynchronisation FR ↔ EN — mitigé par le marqueur `⚠️ Out of sync`
- ⚠️ La traduction prend du retard par rapport à la source — accepté, C5 (priorité au code)

### Documents impactés

- `/docs/rfc/README.md` — ajouter note sur la stratégie bilingue
- `/docs/adr/README.md` — ajouter ADR-0036 dans l'index
- Tous les documents 🟢 Stable — à terme, produire les `-EN.md` correspondants

---

## Références

- [ADR-0033](ADR-0033-git-workflow-versioning-strategy.md) — Git workflow (commits en anglais)
- [README.md](../../README.md) / [README-EN.md](../../README-EN.md) — Précédent bilingue existant

---

## Historique

| Date       | Changement                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 2026-04-20 | Création — Accepted. Français source, anglais dérivé (`-EN.md`), traduction incrémentale par priorité. |
