# Guide — Maintenir les invariants

> Mode d'emploi pour ajouter, modifier, fusionner, supprimer ou renuméroter un
> invariant, commandes comprises. Le modèle (principes, natures, arbre) est
> décrit dans [reorganisation-sept-2026/CONTEXTE-AGENT.md](../reorganisation-sept-2026/CONTEXTE-AGENT.md).

---

## 1. Où vit un invariant

Un invariant apparaît à cinq endroits. **Le registre fait foi** ; les autres
doivent être alignés à la main tant qu'ils ne sont pas générés.

| Lieu | Contenu | Vérifié par | Statut |
| --- | --- | --- | --- |
| `docs/invariants/P*.yaml` | énoncé, nature, parents, mode, état, `pourquoi`, alias, preuves | `pnpm invariants:check` (CI, bloquant) | **source de vérité** |
| `docs/invariants/generated/arbre.md` | vue arborescente du registre | `pnpm invariants:check` | généré — ne jamais éditer |
| `docs/spec/reference/invariants.md` | liste, matrice (mécanisme, message d'erreur), **prochain numéro libre** | rien | copie manuelle |
| `docs/spec/6-transversal/conventions-typage.md` §6 | I46–I56 | rien | copie manuelle |
| ligne **Invariants impactés** d'un ADR | lien décision → invariants | `npx tsx lib/check-adr-tested-status.ts` (informatif) | manuel |
| tests, JSDoc de `packages/`, doc | citations `I<n>` | le registre (tests uniquement) | manuel |

> ⚠️ Toute divergence entre le registre et `invariants.md` est un bug de
> documentation : corriger `invariants.md`, jamais le registre pour « coller »
> à la spec.

---

## 2. Boîte à outils

### Commandes

| Commande | Rôle | Quand |
| --- | --- | --- |
| `pnpm invariants` | valide le registre et régénère `arbre.md` | après toute modification du registre ou d'une citation dans un test |
| `pnpm invariants:check` | idem sans écrire ; échoue si `arbre.md` n'est pas à jour | avant commit (la CI le lance) |
| `pnpm test` | suite Jest complète | après toute modification d'un test |
| `pnpm tsc:check:tests` | type-check de `packages/` et `tests/` (`tsconfig.test.json`) — seul moyen de vérifier les tests de type ; lancé par le pre-commit et la CI | après toute modification d'un test de type ou de `packages/` |
| `npx tsx lib/check-adr-tested-status.ts` | liste les ADR dont chaque invariant impacté est cité en test | après modification d'une ligne **Invariants impactés** |
| `pnpm run build:no-watch` | régénère `core/dist` et `packages/*/dist` (versionnés, ADR-30) | après **toute** modification de `packages/*/src`, même un commentaire |

### Recherches utiles

```bash
# Toutes les références actives à un invariant (hors archives et esquisses)
grep -rnw "I38" --include=*.ts --include=*.md --include=*.yaml . \
  | grep -vE "node_modules|/dist/|docs/archive|docs/reorganisation-sept-2026|\.history"

# Où l'invariant est défini dans le registre
grep -n "^- id: I38$" docs/invariants/P*.yaml

# Qui l'a pour parent (principal ou second)
grep -n "parents:.*\bI38\b" docs/invariants/P*.yaml

# Tests qui le citent (ce que le script compte comme preuve)
grep -rlw "I38" tests packages core --include=*.test.ts --include=*.test-d.ts

# Prochain numéro libre
grep -n "Prochain numéro libre" -A1 docs/spec/reference/invariants.md
```

### Ce que vérifie le script

| Erreur (bloquante) | Avertissement |
| --- | --- |
| identifiant invalide, doublon, alias en collision | `pourquoi` commençant par « À compléter » |
| nature, mode ou état hors des valeurs admises | mode ou état non qualifié (`~`) |
| aucun parent, parent inconnu, énoncé manquant | alias encore cité dans un test |
| décision (`D`) sans `pourquoi` | mode `type` livré sans test de type |
| chemin de `preuves` introuvable | mode `boot`/`run` livré sans test runtime |
| `etat: livre` (hors mode `revue`) sans aucun test qui cite l'ID | |
| `arbre.md` pas à jour (`--check`) | |

**Détection des citations** : toute occurrence de `I<n>` dans un fichier
`*.test.ts(x)` / `*.test-d.ts(x)` sous `tests/`, `packages/`, `core/` compte,
**y compris dans un commentaire**. Un fichier `*.test-d.ts` ou situé sous un
dossier dont le nom contient « type » compte comme test de type (`T`), les
autres comme test runtime (`R`). Être cité ≠ être prouvé : vérifier que le test
asserte réellement la règle.

### Hooks et CI

| Moment | Ce qui tourne |
| --- | --- |
| `commit-msg` | format Conventional Commits : `type(portée)?: message`, types `feat fix docs refactor test chore perf ci build` |
| `pre-commit` | `pnpm tsc --noEmit` (`lib/`), `pnpm tsc:check:tests` (`packages/` + `tests/`), `pnpm test:regression`, contrôle ADR (informatif) |
| `pre-push` | `pnpm test` |
| CI (`.github/workflows/regression.yml`) | `pnpm tsc --noEmit`, `pnpm tsc:check:tests`, `pnpm test:ci`, `pnpm invariants:check` |

---

## 3. Qualifier une ligne

### Champs d'un enregistrement

```yaml
- id: I104                 # I<n>, jamais réutilisé
  nature: D                # E · C · D · V
  parents: [I38, P10]      # le premier = parent principal (position dans l'arbre)
  alias: [I47]             # facultatif : anciens IDs fusionnés ici
  enonce: Une phrase, la règle.
  pourquoi: >              # obligatoire si nature D (remplace l'ADR)
    Pourquoi ce choix plutôt qu'un autre.
  mode: type               # type · boot · type+boot · run · revue · ~
  etat: livre              # livre · partiel · cible · convention · ~
  preuves: [tests/…]       # facultatif : test qui prouve sans citer l'ID
```

Une valeur contenant `:` suivi d'un espace, ou commençant par un backtick, doit
être entre guillemets.

### Nature

| Question | Nature |
| --- | --- |
| La ligne formule-t-elle directement le principe ? | `E` énoncé |
| Se déduit-elle d'une autre ligne, sans choix possible ? | `C` conséquence |
| Est-ce une réalisation parmi d'autres, révisable sans toucher au principe ? | `D` décision — `pourquoi` obligatoire |
| Décrit-elle un **moyen** de garantir une autre ligne ? | `V` vérification |

### Mode (P9 : le plus tôt possible)

| Mode | Garantie |
| --- | --- |
| `type` | le compilateur rejette la violation |
| `boot` | `app.start()` ou `mount()` rejette la violation |
| `type+boot` | compile-time, plus filet runtime pour `as any` / JS pur |
| `run` | seulement pour une garde dynamique (la violation dépend de données d'exécution) — doit échouer dès la première violation (I102) |
| `revue` | aucun mécanisme : revue de code, lint à terme |

### État

| État | Condition |
| --- | --- |
| `livre` ✅ | le mécanisme existe dans le code **et** au moins un test le cite (ou `preuves`) — sauf mode `revue` |
| `partiel` ⚠️ | livré en partie : dire quoi en commentaire YAML |
| `cible` ⏳ | non livré : noter la strate |
| `convention` 📐 | aucun mécanisme automatique (en général avec `mode: revue`) |

**Règle** : on qualifie d'après le **code**, pas d'après la spec ou un ADR. Un
commentaire YAML justifie tout cas non évident.

### Fichier

Une ligne va dans le fichier du principe auquel mène sa chaîne de parents
principaux (`parents[0]`). Exemple : parent principal `I101`, lui-même sous
`I100` sous `P10` → `P10.yaml`. Le script ne contrôle pas le fichier, seulement
les parents : respecter la règle pour que le fichier reste lisible.

---

## 4. Procédures

Chaque procédure se termine par la [vérification finale](#5-vérification-finale).

### A. Ajouter un invariant

1. **Réserver le numéro** : lire le prochain numéro libre dans
   `docs/spec/reference/invariants.md`, vérifier qu'il n'est cité nulle part :

   ```bash
   grep -rnw "I104" . --include=*.ts --include=*.md --include=*.yaml | grep -v node_modules
   ```

2. **Écrire la ligne** dans le bon `docs/invariants/P<n>.yaml` (§3), avec
   `pourquoi` si c'est une décision. État honnête : `cible` si rien n'est livré.
3. **Prouver** (si le mécanisme existe) : citer l'ID dans le test qui le vérifie,
   de préférence dans le titre — `it("I104 — …", …)` ou `describe("… [I104]", …)`.
   Test de type : fichier sous `tests/types/`, avec `// @ts-expect-error`.
4. **Régénérer** : `pnpm invariants`, corriger les erreurs.
5. **Aligner la spec** — `docs/spec/reference/invariants.md` :
   - ajouter la ligne dans la liste (colonne « Principe ») ;
   - si le mode est mécanique, ajouter la ligne dans la matrice (phase,
     sévérité, état, mécanisme, message d'erreur attendu) ;
   - incrémenter le **prochain numéro libre**.
6. **Si une décision d'ADR est concernée** : ajouter l'ID à sa ligne
   **Invariants impactés**, puis `npx tsx lib/check-adr-tested-status.ts`.
7. **Si le code est concerné** : citer l'ID dans la JSDoc en anglais (ADR-34),
   puis `pnpm run build:no-watch`.
8. Commit : `docs(invariants): énoncer I104 — …` (ou `feat(…)` si du code change).

### B. Modifier un invariant (énoncé, mode, état, parents)

Cas le plus fréquent : le code a évolué, ou un trou est découvert.

1. Modifier la ligne dans le registre ; justifier en commentaire YAML.
   Passer à `livre` exige un test qui cite l'ID.
2. `pnpm invariants`.
3. Reporter le changement dans `invariants.md` (liste et/ou matrice) et, si la
   ligne relève de I46–I56, dans `conventions-typage.md`.
4. Si l'état change et qu'un ADR cite l'ID : mettre à jour sa ligne **Livré**.
5. Chercher les autres mentions (§2, « Toutes les références actives ») : une
   doc qui décrit l'ancienne règle est à corriger.

> Changer de parent principal peut déplacer la ligne vers un autre fichier
> `P<n>.yaml` : déplacer l'enregistrement et laisser un commentaire de renvoi
> dans l'ancien fichier (`# I58 : déclaré dans P6.yaml sous I99`).

### C. Remplacer un invariant par un autre (fusion)

L'ancien ID devient un **alias** du nouveau ; il n'est jamais réutilisé.

1. **Vérifier que c'est une vraie redondance** : même règle, même mécanisme.
   Si l'ancien mêle deux règles, répartir ses citations entre plusieurs
   canoniques (précédent : I26, dont la moitié « 1:N » relève d'I11).
2. **Registre** : supprimer l'enregistrement de l'ancien ; sur le canonique,
   ajouter `alias: [Ixx]`, élargir l'énoncé si besoin, commenter la fusion.
   Si l'ancien servait de parent, reporter ses enfants sur le canonique :

   ```bash
   grep -n "parents:.*\bI24\b" docs/invariants/P*.yaml   # doit être vide à la fin
   ```

3. **Retirer les citations** partout hors archives et esquisses :

   ```bash
   # Lister
   grep -rnlw "I24" --include=*.ts --include=*.md . \
     | grep -vE "node_modules|/dist/|docs/archive|docs/reorganisation-sept-2026|docs/invariants/|\.history"
   # Remplacer (GNU sed), fichier par fichier après lecture
   sed -i 's/\bI24\b/I21/g' <fichiers>
   # Repérer les doublons créés : « I21, I21 », « I21/I21 », « I21 et I21 »
   # (ID en clair : pas de référence arrière \1, refusée par ugrep)
   grep -rnE "\bI21\b[,/ ]+(et )?I21\b" --include=*.ts --include=*.md . | grep -v node_modules
   # Deux lignes pour le même ID dans un en-tête de test ou de JSDoc : relire les en-têtes
   ```

   Relire chaque remplacement : une liste peut devenir « I21, I21 », un en-tête
   de test peut avoir deux lignes pour le même ID, un énoncé peut devenir
   absurde (« cohérent avec I6 et I6 »).
4. **Spec** : remplacer la ligne de l'ancien (liste et matrice) par un renvoi,
   et marquer le canonique « (absorbe Ixx) » :

   ```markdown
   | **I24** | *Fusionné dans I21* — identifiant conservé comme alias ([registre](../../invariants/P8.yaml)) | — |
   | **I24** | → I21 | — | — | *Fusionné dans I21* — voir la ligne I21 | — |
   ```

   Si la ligne de matrice de l'ancien décrivait un mécanisme absent de celle du
   canonique, le reporter d'abord.
5. **ADR** : remplacer l'ID dans **Invariants impactés**, puis
   `npx tsx lib/check-adr-tested-status.ts`.
6. `pnpm invariants` : aucun avertissement « alias encore cité » ne doit rester.
7. Si `packages/` a changé : `pnpm run build:no-watch`, et vérifier que
   `git diff core/dist packages/*/dist` ne touche que des commentaires.

### D. Supprimer un invariant sans remplaçant

La règle disparaît (abandonnée, ou fausse).

1. Vérifier qu'aucune ligne ne l'a pour parent (sinon les rattacher ailleurs).
2. Supprimer l'enregistrement du registre.
3. Retirer ou reformuler chaque citation (§2) : un test qui le citait prouve
   peut-être autre chose — le rattacher au bon ID ou retirer la citation.
4. Spec : remplacer la ligne par `*Supprimé* — raison en une phrase` ; ne pas
   supprimer la ligne, pour que le numéro reste visiblement pris.
5. ADR : retirer l'ID de **Invariants impactés** ; si la décision elle-même est
   abandonnée, l'ADR disparaît ou part en [roadmap](../ROADMAP.md) (ADR vivants).

### E. Changer le numéro d'un invariant

**À éviter** : un numéro est un identifiant stable, pas un ordre. Si c'est
indispensable (collision, numéro réservé par erreur), c'est une fusion (C) dont
le canonique est le nouveau numéro :

1. Réserver le nouveau numéro (A.1).
2. Renommer `id:` dans le registre et ajouter `alias: [ancien]`.
3. Mettre à jour les parents qui citaient l'ancien :
   `sed -i 's/\bIancien\b/Inouveau/g' docs/invariants/P*.yaml`, puis relire
   (l'`alias` doit garder l'ancien numéro).
4. Suivre C.3 à C.7.

Une renumérotation d'ensemble (numéros continus, préfixes par principe) touche
environ 3 800 références : ne l'envisager qu'en une passe, registre stabilisé,
avec une table de correspondance.

---

## 5. Vérification finale

```bash
pnpm invariants                              # 0 erreur ; lire les avertissements
pnpm test                                    # suite complète
pnpm tsc:check:tests                         # tests de type (packages/ + tests/, aussi en pre-commit et CI)
npx tsx lib/check-adr-tested-status.ts       # si une ligne Invariants impactés a changé
pnpm run build:no-watch                      # si packages/*/src a changé
pnpm invariants:check                        # dernier contrôle, identique à la CI
git status --short                           # n'indexer que les fichiers de l'opération
```

Checklist :

- [ ] le registre et `arbre.md` sont à jour (`invariants:check` vert) ;
- [ ] `invariants.md` (liste, matrice, prochain numéro libre) reflète le registre ;
- [ ] aucune citation d'un ID retiré hors archives ;
- [ ] les ADR concernés (**Invariants impactés**, **Livré**) sont alignés ;
- [ ] `dist/` régénéré si `packages/` a changé ;
- [ ] message de commit en français, format `type(portée): …`.

---

## 6. Pièges connus

- **`arbre.md` pas régénéré** → la CI échoue. Toujours `pnpm invariants` après
  avoir touché un YAML *ou* un test qui cite un ID.
- **Citation ≠ preuve** : un ID dans l'en-tête d'un test compte pour le script
  même si aucun `it` ne vérifie la règle (précédent : I36).
- **Une citation de moins peut casser `livre`** : retirer un ID d'un test peut
  faire échouer `invariants:check` si c'était sa seule preuve.
- **Mode `type` sans test de type** : la preuve est runtime ou structurelle ;
  acceptable, mais l'avertissement le signale.
- **Archives** (`docs/archive/`) et **esquisses** (`docs/reorganisation-sept-2026/`)
  ne se corrigent pas : ce sont des historiques.
- **Commentaires dans `packages/`** : ils changent `dist/` → build obligatoire
  (ADR-30), et JSDoc en anglais (ADR-34).
