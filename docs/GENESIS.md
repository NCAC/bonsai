# 🌱 Genèse de Bonsai

> Comment un développeur qui comblait des trous dans des définitions TypeScript
> s'est retrouvé, sans s'en rendre compte, à créer un framework.

---

## Il était une fois…

Il y a dix ans, vers 2016, le paysage frontend était en pleine effervescence.
React montait en puissance, porté par Facebook et une communauté grandissante.
Angular — dans sa première version — dominait l'entreprise. Les frameworks
se multipliaient, chacun promettant d'être _le_ bon choix.

Un développeur regardait tout cela avec un mélange de curiosité et de méfiance.

React ? L'idée de mélanger du HTML dans du JavaScript — ce JSX qui ressemblait
à un crime contre la séparation des préoccupations — ne lui plaisait pas du tout.
Peut-être était-ce l'approche « fonction pure » qui le dérangeait, cette obsession
de tout rendre immutable et fonctionnel au détriment de la structure. Quelque chose
d'intuitif le retenait.

Angular v1 ? Il avait essayé. Sincèrement essayé. Mais l'usine à gaz des directives,
le two-way binding magique, les `$scope.$apply()` et les cycles de digest l'avaient
convaincu que ce n'était pas pour lui. Trop de magie, pas assez de transparence.

Et puis il y avait **Backbone.js**. Petit. Simple. Structurant sans être envahissant.
Et surtout, il y avait **Marionette.js** — cette surcouche élégante qui apportait
à Backbone ce qui lui manquait : une architecture applicative, une gestion des vues
et des régions, une architecture événementielle avec Backbone.Radio. 7 000 étoiles
sur GitHub, 349 contributeurs, maintenu par des gens comme Paul Falgout, Sam Saccone,
Jason Laster.

Le choix était fait. Marionette, parce que ça semblait _naturel_. Pas de magie.
De l'événementiel. Du structurel. Du code qui ressemblait à ce qu'il faisait
réellement.

---

## La révélation TypeScript

Puis vint une formation TypeScript. Et tout changea.

Ce n'était pas juste « du JavaScript avec des types ». C'était une façon
fondamentalement différente de penser le code. Les erreurs compile-time plutôt
que runtime. Les interfaces comme contrats. L'autocomplétion qui devenait
de la documentation vivante. Le refactoring sans peur.

Après cette formation, impossible de revenir en arrière. Le JavaScript « nu »
était devenu insuffisant — chaque `any` implicite, chaque propriété mal nommée,
chaque callback sans signature était désormais une source d'inconfort.

Naturellement, le réflexe fut d'aller chercher les définitions de types pour
Backbone et Marionette. Elles existaient, sur DefinitelyTyped. `@types/backbone`
et `@types/backbone.marionette`. Des gens avaient fait le travail.

Sauf que… le travail était incomplet.

---

## Le terrier du lapin

Les définitions avaient des trous. Des méthodes non typées. Des signatures
approximatives. Des generics manquants. Pour `backbone`, les fondations étaient
là mais certaines subtilités de l'API n'étaient pas couvertes. Pour
`backbone.marionette`, c'était plus lacunaire encore — les Behaviors, le Radio,
les CollectionViews complexes n'étaient que partiellement typés.

Qu'à cela ne tienne : combler les lacunes, écrire les types manquants,
corriger les signatures.

Ça a commencé comme ça. Innocemment. Un fichier `.d.ts` par-ci, un generic
par-là. Puis un type utilitaire pour mieux capturer le polymorphisme des vues.
Puis un autre pour les événements. Puis un wrapper typé pour Radio.

Et sans s'en rendre compte, les « corrections de types » se sont transformées
en _réécriture_. Le code original de Backbone et Marionette, avec ses dépendances
sur jQuery, Underscore et une chaîne de prototypes JavaScript classique, ne se
prêtait pas naturellement au TypeScript strict. Écrire des types _justes_
impliquait souvent de repenser l'API.

Toutes les dépendances de Backbone furent internalisées — jQuery, Underscore,
la gestion DOM — remplacées par du code TypeScript natif. Un nouveau composant
apparut : le **Manager**, qui prenait en charge l'orchestration que ni les Views
ni les Modèles ne géraient proprement. Le Manager deviendrait, bien plus tard,
l'ancêtre de ce que Bonsai appelle aujourd'hui la **Feature**.

---

## marionext — la première vie

Le résultat fut publié sur npm sous le nom de
[**marionext**](https://www.npmjs.com/package/marionext) :

> _marionext is a front-end framework strongly based on marionette._
> _All the dependencies (backbone, underscore and jQuery) have been removed_
> _and all is included in the code base. It's written in TypeScript._

Version 1.0.0. MIT. 378 kB décompressés. Un monorepo de packages :
`@ncac/marionext-event`, `@ncac/marionext-view`, `@ncac/marionext-entity`,
`@ncac/marionext-behavior`, `@ncac/marionext-manager`, `@ncac/marionext-region`,
`@ncac/marionext-dom`, `@ncac/marionext-vdom`…

C'était encore du Marionette dans l'esprit — mais du Marionette entièrement
réécrit en TypeScript, débarrassé de ses dépendances historiques, avec un typage
qui commençait à devenir sérieux. Les patterns CRTP (F-bounded polymorphism)
apparaissaient déjà : `View<PageView, TPageViewParams>`. Le type consolidé
`TViewParams` regroupait UI, Behaviors, Options en un seul endroit.

Puis l'accident. Le repository GitHub fut malencontreusement supprimé.

Le package npm restait, orphelin — un témoignage figé d'une première vie.
Mais le code source, l'historique des commits, les branches de travail :
disparus.

---

## Le reboot

Au lieu de tenter de reconstruire ce qui avait été perdu, ce fut l'occasion
de tout repenser. De repartir d'une page blanche, avec les leçons apprises.

C'est à cette période que la connaissance de **Redux** devint un révélateur.
Non pas pour adopter Redux — son approche fonctionnelle pure n'était pas
la bonne fit — mais pour ce qu'il _enseignait_ sur l'architecture :

- Le **flux unidirectionnel** : une action entre, un état sort, les vues
  se mettent à jour. Pas de cycles, pas d'ambiguïté sur la direction des données.
- L'**état centralisé** : une source de vérité unique pour l'état de l'application,
  pas des modèles dispersés qui se synchronisent entre eux.
- La **prévisibilité** : si l'on connaît l'état et l'action, on connaît
  le prochain état. Pas d'effets de bord cachés.

Ces principes, combinés à l'héritage structurel de Marionette — ses régions,
ses vues composées, son architecture événementielle — formaient les fondations
de quelque chose de nouveau.

Plus le prototype avançait, plus il divergeait de Backbone.Marionette.
Les Modèles devenaient des **Entities** — avec un `mutate()` unique inspiré
d'Immer, pas des `set()`/`get()` hérités de Backbone. Les Régions devenaient
des **Composers** — orchestrateurs de vues, pas simplement des conteneurs DOM.
Le Radio de Backbone devenait un système de **Channels tri-lane** — Commands,
Events, Requests — avec un typage strict par namespace. Le Manager devenait
la **Feature** — le composant central, unique détenteur de son Entity.

À un moment, la réalité s'imposa : ce n'était plus un fork de Marionette.
Ce n'était plus un wrapper typé. C'était un **framework**.

Il lui fallait un nom.

---

## Bonsai

Un bonsaï est un arbre qui prend sa forme par une taille patiente,
des contraintes assumées et un soin méticuleux. Chaque branche a sa raison
d'être. Rien n'est laissé au hasard. La forme finale est le résultat
de choix délibérés, pas d'une croissance anarchique.

C'est exactement ce que ce framework cherche à être : une architecture
où chaque composant a sa place, chaque frontière est explicite, chaque
décision est documentée. Opinionated et assumé. Pas de « on pourrait
aussi faire autrement » — des choix forts, tracés dans des ADRs, défendus
par des invariants.

Le type EST la documentation. Le compilateur EST le gardien. L'IDE EST
le guide.

**Bonsai** — un framework taillé avec soin.

---

## Remerciements

Bonsai n'existerait pas sans les épaules de géants sur lesquelles il se tient.

### Backbone.js & Marionette.js

Merci à [Jeremy Ashkenas](https://github.com/jashkenas) pour Backbone.js —
la preuve qu'un framework peut être petit, élégant et structurant sans être
envahissant.

Merci à l'équipe [Marionette.js](https://github.com/marionettejs/backbone.marionette)
— Paul Falgout, Sam Saccone, Jason Laster, James Smith, Scott Walton et les
349 contributeurs — pour avoir donné à Backbone l'architecture applicative
qui lui manquait. L'héritage de Marionette vit dans chaque composant de Bonsai :
les Views, les Behaviors, les Regions devenues Composers, les Channels.

### Les typeurs de DefinitelyTyped

C'est par eux que tout a commencé. Sans leurs définitions TypeScript
— même incomplètes — le réflexe de typer Marionette ne serait peut-être
jamais venu. Combler leurs lacunes a été le premier pas vers la réécriture,
puis vers marionext, puis vers Bonsai.

**`@types/backbone`** — merci à :
[Boris Yankov](https://github.com/borisyankov),
[Natan Vivo](https://github.com/nvivo),
[kenjiru](https://github.com/kenjiru),
[J. Joe Koullas](https://github.com/jjoekoullas),
[Julian Gonggrijp](https://github.com/jgonggrijp),
[Kyle Scully](https://github.com/zieka),
[Robert Kesterson](https://github.com/rkesters),
[Bulat Khasanov](https://github.com/khasanovbi).

**`@types/backbone.marionette`** — merci à :
[Zeeshan Hamid](https://github.com/zhamid),
[Natan Vivo](https://github.com/nvivo),
[Sven Tschui](https://github.com/sventschui),
[Volker Nauruhn](https://github.com/razorness),
[Ard Timmerman](https://github.com/confususs),
[J. Joe Koullas](https://github.com/jjoekoullas),
[Julian Gonggrijp](https://github.com/jgonggrijp).

Un clin d'œil particulier à **Natan Vivo**, **J. Joe Koullas** et
**Julian Gonggrijp** qui ont contribué aux définitions des _deux_ packages
— backbone et marionette. Ce sont eux qui ont maintenu le pont TypeScript
sur lequel tout ce projet a commencé à traverser.

### Redux

Merci à [Dan Abramov](https://github.com/gaearon) et
[Andrew Clark](https://github.com/acdlite) pour Redux.
Bonsai n'utilise pas Redux, mais ses principes — flux unidirectionnel,
état prévisible, actions comme source de vérité — ont profondément
influencé l'architecture : le flux `View → Command → Feature → Event → Views`,
l'Entity unique par Feature, le `mutate()` comme seul point de mutation.

### TypeScript

Merci à [Anders Hejlsberg](https://github.com/AHejlsberg) et l'équipe
TypeScript de Microsoft. Bonsai est né du moment où un développeur
a découvert que les types n'étaient pas une contrainte mais une
_libération_. Le type system de TypeScript — ses generics contraints,
ses conditional types, ses template literals, son inférence — n'est pas
un outil de Bonsai : c'est son **langage de spécification**.

---

_Le code de marionext v1 vit encore sur [npm](https://www.npmjs.com/package/marionext),
vestige figé d'une première vie. Le prototype v2 repose dans
[marionext-legacy](../marionext-legacy/), mémoire de travail d'une exploration
qui n'a jamais cessé d'avancer — jusqu'à devenir Bonsai._
