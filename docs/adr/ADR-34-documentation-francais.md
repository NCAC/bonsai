# ADR-34 — Langues : documentation et commits en français, code en anglais

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — corpus français ✅ ; commits ✅ ; JSDoc et commentaires de `packages/` et `core/` en anglais ✅ ; traductions `-EN.md` limitées aux README ; commentaires de `tests/` et `lib/` encore en français |
| **Spec** | [docs/README.md](../README.md) |

## Contexte

Le corpus (RFC, ADR, guides) est écrit en français : c'est la langue dans
laquelle l'auteur conçoit. Un framework vise pourtant un public
international. Réécrire en anglais coûterait cher et dégraderait la qualité de
conception ; mélanger les langues au hasard rend le corpus illisible.

## Décision

1. **Le français est la langue source** des RFC, ADR et guides ; en cas de divergence, le fichier français fait foi.
2. **Traductions anglaises dérivées**, suffixe `-EN.md`, même nom et même dossier, avec un bandeau de lien croisé dans chaque sens.
3. **Traduction par priorité, jamais d'un brouillon** : README et démarrage rapide, puis spec stable, puis ADR acceptés, puis guides.
4. Une traduction dont la source a changé porte l'en-tête `⚠️ This translation may be out of date` jusqu'à sa mise à jour.
5. **Le code est en anglais** : identifiants, types, messages d'erreur, **JSDoc et commentaires** (`packages/`, `core/`, `lib/`, `tests/`). Le code s'adresse à tout contributeur ; une JSDoc anglaise alimente IntelliSense dans la même langue que l'API.
6. **Les messages de commit sont en français**, au format Conventional Commits (ADR-33) : le type et la portée restent les mots-clés anglais standard (`feat(view):`, `docs(adr):`), la description est en français. L'historique git suit la langue de conception, comme la documentation.

**Format des ADR** : fichier `ADR-NN-titre.md`, 30 à 80 lignes, modèle
[TEMPLATE.md](TEMPLATE.md) : Contexte, Décision, Alternatives rejetées (une
ligne chacune), Conséquences, plus la ligne **Livré**. Le détail normatif vit
dans la spec, pas dans l'ADR.

## Alternatives rejetées

- **Tout réécrire en anglais** — coût prohibitif, perte de qualité de conception.
- **Anglais source, français dérivé** — même perte, et migration d'un corpus entièrement français.
- **Langue libre par document** — corpus incohérent, liens de traduction impossibles à maintenir.
- **Commits en anglais** — rupture avec la langue de conception, pour un historique lu par le seul mainteneur ; le préfixe Conventional Commits suffit à l'outillage.
- **JSDoc en français** — l'API est en anglais : IntelliSense mélangerait deux langues dans la même bulle d'aide.

## Conséquences

- Les invariants, le glossaire et les ADR sont lisibles d'un seul tenant, dans une seule langue.
- **Écart** : `packages/` et `core/` sont traduits ; les commentaires de `tests/` (dont la fixture de la gate E2E) et de `lib/` restent en français. Ils sont traduits au fil de l'eau, et tout nouveau commentaire est écrit en anglais.
- Le hook `commit-msg` ne vérifie que le préfixe Conventional Commits ; la langue de la description relève de la revue.
