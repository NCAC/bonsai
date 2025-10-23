# Bundling TypeScript pour RXJS dans Bonsai : objet plat vs namespace

## Objectif

Garantir que l'import `import { RXJS } from "@bonsai/rxjs"` donne accès à toutes les fonctionnalités publiques de RxJS, **à la fois** en JavaScript (runtime) et en TypeScript (types), avec une correspondance stricte entre l'objet JS et les types.

---

## 1. Approche moderne : **Objet plat exporté**

### JS

```js
export const RXJS = {
  Subject,
  Observable,
  take
  // ...toutes les fonctionnalités publiques
};
```

### TypeScript (d.ts)

```ts
export declare const RXJS: {
  Subject: typeof Subject;
  Observable: typeof Observable;
  take: typeof take;
  // ...
};
// Toutes les déclarations nécessaires (Subject, Observable, etc.) sont à la racine du fichier
```

**Avantages :**

- Alignement parfait entre l'objet JS et le type TypeScript.
- Compatible avec les modules ES modernes, tree-shaking, etc.
- Utilisation naturelle :
  - À l'exécution : `new RXJS.Subject<T>()`
  - En type : `RXJS.Subject<T>`

**Limite :**

- TypeScript ne considère pas `RXJS` comme un namespace. On ne peut pas faire d'import de type implicite (voir plus bas).

---

## 2. Approche classique : **Namespace TypeScript**

### TypeScript (d.ts)

```ts
declare namespace RXJS {
  class Subject<T> { ... }
  // ...
}
export { RXJS };
```

**Avantages :**

- Permet d'utiliser `RXJS.Subject<T>` dans les types **sans** import explicite de chaque type.
- Syntaxe familière pour les utilisateurs de RxJS.

**Limites :**

- Le namespace n'existe pas à l'exécution JS (sauf si on le simule).
- Moins compatible avec les modules ES modernes.
- Risque d'incohérence entre l'objet JS et le namespace TypeScript.

---

## 3. Pourquoi l'objet plat est préférable ?

- C'est le standard des modules ES modernes.
- Permet un tree-shaking efficace.
- Évite les pièges liés aux namespaces TypeScript (qui ne sont qu'une construction de type, pas de runtime).
- Permet une correspondance stricte JS/types.

---

## 4. Problème courant : "Cannot find namespace 'RXJS'"

- Si on utilise un objet plat, TypeScript **n'autorise pas** la syntaxe `RXJS.Subject<T>` dans les types **sauf si** `Subject` est déclaré à la racine du d.ts et exposé dans l'objet RXJS.
- Si on veut utiliser `RXJS.Subject<T>` dans les types, il faut que le d.ts exporte :
  - toutes les entités à la racine (ex : `declare class Subject<T> { ... }`)
  - et un objet RXJS qui les référence (`Subject: typeof Subject`)
- **Mais** : TypeScript ne permet pas d'utiliser `import type { RXJS }` comme un namespace. Il faut importer explicitement les types si on veut les utiliser dans les signatures.

---

## 5. Solution recommandée

- **Exporter un objet plat** en JS **et** en d.ts.
- **Déclarer toutes les entités publiques à la racine du d.ts** (pas de namespace, pas d'import polluant, pas d'export default).
- **Générer un objet RXJS** dans le d.ts qui référence toutes ces entités via `typeof`.
- **Importer explicitement les types** si besoin dans les signatures TypeScript :
  ```ts
  import type { Subject } from "@bonsai/rxjs";
  // ...
  let s: Subject<string>;
  ```
- Utiliser l'objet RXJS à l'exécution :
  ```ts
  import { RXJS } from "@bonsai/rxjs";
  new RXJS.Subject<string>();
  ```

---

## 6. Cas d'usage avancé : compatibilité totale

Si vous souhaitez **absolument** la compatibilité avec la syntaxe `RXJS.Subject<T>` dans les types **sans import explicite**, il faut générer à la fois :

- Un objet plat pour le JS
- Un namespace pour le d.ts

Mais cela complexifie le build, peut créer des incohérences, et n'est pas recommandé dans les modules modernes.

---

## 7. Résumé

- **Objet plat** = moderne, aligné JS/types, tree-shakable, mais nécessite d'importer explicitement les types pour les signatures.
- **Namespace** = legacy, pratique pour les types, mais non aligné avec le runtime JS moderne.
- **Recommandation Bonsai** : objet plat, toutes les entités à la racine du d.ts, import explicite des types si besoin.

---

## 8. Exemple d'import recommandé

```ts
import { RXJS } from "@bonsai/rxjs";
import type { Subject } from "@bonsai/rxjs";

const s: Subject<string> = new RXJS.Subject<string>();
```

---

## 9. Pour aller plus loin

- [TypeScript Handbook - Modules](https://www.typescriptlang.org/docs/handbook/modules.html)
- [TypeScript Handbook - Namespaces](https://www.typescriptlang.org/docs/handbook/namespaces.html)
- [Why not use namespaces? (StackOverflow)](https://stackoverflow.com/questions/30357634/why-shouldnt-i-use-typescript-namespaces)

---

**En résumé :**

- Le build Bonsai v2 est moderne et optimal.
- Il faut juste adapter les usages TypeScript pour importer explicitement les types si besoin.
- L'objet RXJS est utilisable partout, en JS comme en TS, avec une API plate et propre.
