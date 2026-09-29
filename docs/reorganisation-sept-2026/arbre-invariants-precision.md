 acté : les formulations des principes sont des propositions à discuter.

## Légende

| Marque | Nature | Test |
| --- | --- | --- |
| **P** | Principe | Non substituable : le changer, c'est changer de modèle. |
| `E` | Énoncé | Invariant existant qui formule déjà (tout ou partie) le principe. |
| `C` | Conséquence | Se déduit du principe (et/ou d'autres lignes) : on ne le décide pas, on le vérifie. |
| `D` | Décision | Une réalisation parmi d'autres ; révisable sans toucher au principe. |
| `V` | Vérification | Décrit un *moyen* de garantir une autre ligne, pas une règle nouvelle. |

### Mode de vérification

Chaque invariant porte ⟨mode · état · tests⟩, repris de la matrice de vérification du registre.

- **mode** : `type` compile-time · `boot` bootstrap · `type+boot` les deux · `run` runtime courant · `revue` convention, revue, lint · `—` aucune ligne dans la matrice
- **état** : ✅ livré · ⚠️ partiel · ⏳ cible · 📐 convention · ∅ non renseigné
- **tests** : `T` cité dans un test de type · `R` cité dans un test runtime · `·` jamais cité

`↔ Pn` signale un **second parent** : l'arbre est en réalité un graphe orienté acyclique.

---

## P1 — Souveraineté du domaine

**Le domain state n'existe que dans une Entity ; seule la Feature propriétaire y accède et le modifie.**

- `E` I5 — Views et Behaviors n'accèdent jamais aux Entities ⟨type · ✅ · R T⟩
- `E` I6 — seule une Feature modifie son Entity ⟨type+boot · ✅ · R T⟩
- `C` I30 — View et Behavior sans domain state ↔ P5 ⟨type · ⚠️ · ·⟩
- `C` I63 — schema Entity sans transformation (déduit de I6, et dit comme tel) ⟨revue · ⏳ · ·⟩
- `D` I22 — relation 1:1:1 namespace ↔ Feature ↔ Entity, Entity obligatoire même vide ↔ P8 ⟨type+boot · ✅ · R⟩
- `D` I46 — `TStructure` contraint à `TJsonSerializable` ⟨— · ∅ · R⟩
- `D` I52 — l'Entity expose des méthodes query pures ⟨— · ∅ · R⟩
- `D` I97 — `mutate()` via `Immer.produceWithPatches` ⟨run · ✅ · R⟩
- `D` I51 — notifications Entity auto-découvertes sur la Feature ⟨— · ∅ · R⟩
  - `D` I96 — dispatch détaillé (ordre, isolation des erreurs) — *I51 est un résumé de I96* ⟨boot · ✅ · R⟩
  - `V` I53 — clé de handler inconnue rejetée au bootstrap — *sous-cas de I96* ⟨— · ∅ · ·⟩
  - `D` I98 — ré-entrance en file FIFO, profondeur bornée ↔ P4 ⟨run · ✅ · R⟩

## P2 — Dépendances déclarées

**Un composant n'interagit qu'avec ce qu'il a déclaré statiquement ; il n'existe aucun canal implicite.**

- `E` I14 — tout composant déclare statiquement ses Channels ⟨type+boot · ⚠️ · ·⟩
- `V` I16 — accès à un Channel non déclaré = erreur ⟨type+boot · ⚠️ · ·⟩
- `C` I2 — une Feature écoute les Channels externes qu'elle a déclarés ⟨— · ∅ · R⟩
- `C` I15 — Radio non exposé (un bus ambiant serait un canal non déclaré) ⟨type · ✅ · R T⟩
  - `C` I50 — instance `Channel` interne — *redondant avec I15* ⟨— · ∅ · ·⟩
- `D` I80 — les consommateurs déclarent des classes Feature, jamais des tokens ⟨type · ✅ · R T⟩
- `V` I70 — références externes validées contre le manifest ↔ P8 ⟨boot · ✅ · R⟩

## P3 — Sémantique des trois voies

**Une intention (Command) va à un seul propriétaire, qui peut la refuser ; un fait (Event) est publié par son seul propriétaire vers N abonnés ; une lecture (Request) est sans effet.**

- `E` I10 — Command : un seul handler ⟨boot · ✅ · R⟩
- `E` I11 — Event : N subscribers ⟨— · ∅ · R⟩
- `E` I27 — Command refusable, Event irréfutable ⟨— · ∅ · R⟩
- `C` I1 — une Feature n'émet que sur son propre Channel ⟨type · ✅ · R⟩
  - `C` I12 — pas d'émission sur un Channel étranger — *redondant avec I1* ⟨type · ✅ · R⟩
  - `C` I26 — seule la Feature propriétaire utilise `emit()` — *redondant avec I1* ⟨— · ∅ · R⟩
- `C` I25 — seuls Views/Behaviors utilisent `trigger()` ↔ P5 ⟨— · ∅ · R⟩
- `C` I4 — View/Behavior : trigger, listen, request sur Channels déclarés, jamais `emit()` ↔ P2 ⟨type · ✅ · R⟩
- `C` I13 — la View est entrée (Command) et projection (Event), jamais lieu de causalité métier ↔ P5 ⟨— · ∅ · ·⟩
- `C` I3 — une Feature ne répond que sur son propre Channel ⟨— · ∅ · R⟩
- `C` I17 — `request` en lecture seule ↔ P2 ⟨— · ∅ · R⟩
- `D` I29 — `reply()` synchrone ⟨— · ∅ · R⟩
  - `C` I64 — aucun I/O dans un replier (précise I29) ⟨revue · 📐 · ·⟩
  - `D` I55 — `reply()` ne lève jamais, retourne `null` ⟨— · ∅ · R⟩
    - `D` I65 — erreur de replier reportée via `ErrorReporter` ⟨run · ⚠️ · ·⟩

## P4 — Causalité traçable et bornée

**Toute chaîne de messages est reconstituable jusqu'à l'action d'origine, et sa longueur est bornée.**

- `E` I7 — tout message porte des métadonnées causales complètes ⟨boot · ⏳ · ·⟩
- `C` I8 — `correlationId` créé par l'UI, jamais modifié ⟨run · ⏳ · ·⟩
- `D` I9 — `hop` incrémenté, rejet au-delà de `MAX_HOPS` ⟨run · ⏳ · ·⟩
- `D` I54 — metas créées par le framework, propagées explicitement *(⏳ non livré)* ⟨— · ∅ · ·⟩

## P5 — La View projette, elle ne décide pas

**Le rendu est une projection du domaine : seule la View produit du DOM, et elle ne porte aucun état métier.**

- `E` I18 — monopole du rendu ⟨revue · 📐 · ·⟩
- `C` I30 ↔ P1 (voir plus haut)
- `C` I56 — la couche abstraite est active avant la couche concrète ⟨— · ∅ · R⟩
- `D` I42 — state local de présentation, typé et encapsulé (exception bornée) ⟨type+boot · ⏳ · ·⟩
  - `D` I57 — namespace `local` réservé ↔ P8 ⟨type+boot · ✅ · T⟩

## P6 — Propriété exclusive du DOM

**Chaque nœud DOM a au plus un composant qui peut le muter, et ce partage est fixé au bootstrap.**

> ⚠️ **Aucun invariant existant n'énonce ce principe.** I38 en est le plus proche, mais il mêle la
> règle (exclusivité) et une décision (les niveaux N1/N2/N3).

- `D` I38 — niveaux d'altération N1/N2/N3 par type de composant ⟨— · ∅ · ·⟩
- `D` I33 — Foundation unique, seule à altérer `<html>`/`<body>` ⟨boot · ⚠️ · R⟩
  - `C` I34 — le `rootElement` d'une View est un descendant strict de `<body>` ⟨— · ∅ · R⟩
- `C` I40 — scope d'une View = `rootElement` moins les slots ⟨boot · ⚠️ · R⟩
- `C` I41 — source de mutation unique par clé `@ui` (template **ou** `getUI`) ⟨type · ⏳ · ·⟩
- `C` I43 — clés UI du Behavior disjointes de celles de la View ⟨boot · ⏳ · ·⟩
- `D` I39 — accès DOM de la View exclusivement via `getUI(key)` ⟨type · ⚠️ · R⟩
- `D` I32 — `rootElement` altérable en N1 seulement par la View ⟨— · ∅ · ·⟩
- `D` I31 — `rootElement` = sélecteur fourni par le Composer ⟨boot · ✅ · R⟩
- `D` I35 — le Composer n'écrit jamais dans le DOM ⟨revue · ✅ · R⟩
- `D` I44 — le Behavior n'a aucun accès à sa View hôte ⟨— · ∅ · ·⟩
- `D` I45 — Behavior : N1 et N2 sur ses propres clés, jamais N3 ⟨— · ∅ · ·⟩

## P7 — Cycle de vie hétéronome

**Aucun composant ne décide de sa propre existence : création et destruction viennent d'un niveau supérieur.**

- `E` I19 — la View n'a aucune responsabilité sur son cycle de vie ⟨— · ∅ · ·⟩
- `D` I20 — seuls Foundation et Composers créent, remplacent, détruisent des Views ⟨run · ⚠️ · R⟩
  - `D` I36 — la View ne compose jamais, elle déclare des slots ⟨— · ∅ · R⟩
  - `D` I37 — un seul type de Composer, 0..N Views hétérogènes ⟨run · ✅ · R⟩
  - `D` I58 — scope du Composer fixé au bootstrap (vivant → suspendu → détruit) ⟨boot · ⏳ · ·⟩
- `D` I67 — structure de Foundation stable *(contrat cible)* ⟨type+boot · ⚠️ · ·⟩
- `D` I23 — Application dormante entre bootstrap et shutdown ⟨— · ∅ · R⟩
- `D` I28 — Router : Feature interne instanciée par Application ↔ P8 ⟨— · ∅ · T⟩
- `D` I94 — constructeur de Feature inerte ↔ P9 ⟨boot · ✅ · R⟩

## P8 — Identité par le manifest

**Une Feature n'a d'identité que par sa clé dans un manifest unique.**

- `E` I69 — le manifest est l'unique source de vérité de l'identité ⟨type · ✅ · R⟩
- `C` I68 — pas de `static namespace` sur la classe ⟨type · ✅ · R T⟩
- `C` I72 — `TSelfNS` = clé du manifest ⟨type · ✅ · R T⟩
- `C` I87 — clé de `TFeatureContract` = namespace de la Feature référencée ⟨type · ⚠️ · R T⟩
- `D` I21 — enregistrement obligatoire, clé `camelCase` sans chiffre ⟨type+boot · ✅ · R T⟩
  - `V` I24 — unicité au compile-time, format et cohérence au bootstrap ⟨— · ∅ · R⟩
- `D` I71 — `RESERVED_NAMESPACES` (`local`, `router`) ⟨type+boot · ✅ · R T⟩
- `V` I95 — `TStrictFeatureClass<NS>` sur chaque entrée du manifest ⟨type · ✅ · T⟩

## P9 — Garantie au plus tôt *(méta-principe)*

**Toute règle est garantie par construction au compile-time ; à défaut, vérifiée au bootstrap, frontière de confiance. Rien n'est laissé au runtime courant.**

> P9 ne porte sur aucun concept du modèle : il porte sur la **manière** de garantir P1–P8.
> Presque toutes ses branches ont donc un second parent.

- `E` I66 — le bootstrap est la frontière de confiance ⟨boot · ⏳ · ·⟩
- `C` I75 — aucun `any`/`unknown` dans les signatures publiques ⟨revue · ⚠️ · T⟩
- `C` I76 — messages de Channel typés par `TDef` ↔ P3 ⟨type · ✅ · T⟩
- `C` I77 — `View.trigger()` n'accepte que `"ns:cmd"` typé ↔ P2 ⟨type · ✅ · T⟩
- `C` I78 — `getUI()` n'accepte qu'une clé déclarée ↔ P6 ⟨type · ✅ · T⟩
- `C` I79 — `Feature.request()` n'accepte qu'un token typé ↔ P2 ⟨type · ✅ · R⟩
- `D` I48 — handlers découverts par convention de nom `on<Name>…` ⟨— · ∅ · R⟩
  - `D` I88 — symétrie Contract/Callbacks ⟨revue · 📐 · T⟩
    - `D` I92 — `implements TFeatureCallbacks` obligatoire ⟨type · ✅ · T⟩
    - `D` I82 — `implements TViewCallbacks` obligatoire ⟨type+boot · ✅ · R⟩
      - `C` I84 — `events` non vide ⇒ handler DOM obligatoire ⟨type+boot · ✅ · R T⟩
- `D` I73 — `static readonly channel` sur chaque Feature ⟨type · ✅ · R T⟩
  - `D` I47 — *doublon de I73* ⟨— · ∅ · ·⟩
- `D` I74 — définition du Channel co-localisée dans `.feature.ts` ⟨revue · 📐 · R⟩
  - `D` I49 — *doublon de I74* ⟨— · ∅ · ·⟩
- `D` I93 — `listens`/`queries` en `abstract get` ⟨type · ✅ · R T⟩
- `D` I81 — getters modulaires évalués une fois au `mount()` ⟨boot · ✅ · R⟩
- `D` I83 — pattern modulaire des contrats consommateurs ⟨revue · 📐 · R⟩
- `D` I85 — `ui<TEl>()(events)`, helper officiel ⟨revue · 📐 · R T⟩
  - `D` I86 — `events` toujours présent, tableau ⟨type · ✅ · R T⟩
  - `D` I89 — events restreints à `TEventsFor<TEl>` (pas de `CustomEvent`) ↔ P2 ⟨type · ⚠️ · T⟩
  - `C` I90 — pas de doublon dans `events` ⟨type · ✅ · T⟩
  - `D` I91 — `TEventsFor<TEl>`, table officielle ⟨type · ⚠️ · T⟩

---

## Bilan

| Nature | Nombre |
| --- | --- |
| Principes | 9 (dont P6 sans énoncé existant, P9 méta) |
| Énoncés existants | 11 |
| Conséquences | 30 |
| Décisions | 48 |
| Vérifications | 5 |
| **Total** | **94** |

Redondances : I1 ≈ I12 ≈ I26 · I15 ≈ I50 · I47 = I73 · I49 = I74 · I51 ⊂ I96 · I53 ⊂ I96.

## Nature × vérification

| Nature | mécanique | convention | cible (⏳) | non spécifié | Cités en test |
| --- | --- | --- | --- | --- | --- |
| Énoncés | 5 | 1 | 2 | 3 | 6/11 |
| Conséquences | 15 | 2 | 4 | 9 | 22/30 |
| Décisions | 24 | 5 | 3 | 16 | 36/48 |
| Vérifications | 3 | 0 | 0 | 2 | 3/5 |

*Mécanique* = mode `type`, `boot` ou `run`, livré ou partiel. *Non spécifié* = absent de la matrice.
