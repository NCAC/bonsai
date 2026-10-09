# Spécifications de la syntaxe PugX

## 1. Introduction
PugX est une extension syntaxique inspirée de Pug, conçue pour améliorer la lisibilité, la modularité et la puissance des templates HTML. Elle intègre des concepts avancés tels que le typage, la validation, les mixins, les blocs conditionnels et les boucles.

---

## 2. Expressions
- `@e(expression)` : Expression échappée (HTML-safe)
- `@r(expression)` : Expression brute (non échappée)
- `#{expression}` : Syntaxe alternative pour interpolation

---

## 3. Blocs de code
- `@code` : Délimite un bloc de code exécutable
- Peut contenir des instructions, des appels de fonctions, des définitions

---

## 4. Mixins et Fonctions
- `@mixin nomMixin(paramètres)` : Déclare un mixin réutilisable
- `@function nomFonction(paramètres)` : Déclare une fonction personnalisée
- Appel : `+nomMixin(args)` ou `nomFonction(args)`

---

## 5. Conditions et Boucles
- `@if(condition)` / `@unless(condition)` : Bloc conditionnel
- `@each Type in collection` : Boucle sur une collection typée
- Supporte `@else` et `@elseif`

---

## 6. Attributs HTML
- Syntaxe compacte : `div(class="container" id="main")`
- Interpolation dans les attributs : `input(value=@e(user.name))`

---

## 7. Balises Inline
- `@[tag.class @e(expression)]` : Génère une balise inline avec contenu dynamique
- Exemple : `@[span.highlight @e(message)]`

---

## 8. Import et Inclusion
- `@use "chemin/fichier.pugx"` : Importe un fichier externe
- `@include "chemin/fragment.pugx"` : Inclut un fragment dans le template

---

## 9. Commentaires
- `@— commentaire —@` : Commentaire ignoré à la compilation
- Peut être utilisé pour documenter le template

---

## 10. Typage et Validation
- Déclaration de type : `@each User in users:User`
- Validation croisée des types et des données
- Supporte les types primitifs et complexes

---

## 11. Grammaire et AST
- La grammaire PugX est formalisée en BNF
- L'AST généré est structuré pour faciliter l'analyse statique et la transformation

---

## 12. Conclusion
PugX propose une syntaxe moderne et typée pour les templates HTML, adaptée aux besoins des développeurs avancés. Elle favorise la réutilisabilité, la sécurité et la clarté du code.
