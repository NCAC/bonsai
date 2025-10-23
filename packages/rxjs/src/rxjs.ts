// Importer toutes les fonctionnalités de rxjs
import * as RxjsOriginal from "rxjs";
import * as operators from "rxjs/operators";

// Créer un objet qui regroupe toutes les fonctionnalités
const RXJS = {
  ...RxjsOriginal,
  operators
};

// Exporter l'objet RXJS comme export par défaut et nommé
export { RXJS };
export default RXJS;
