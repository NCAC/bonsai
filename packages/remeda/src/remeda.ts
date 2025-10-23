// Importer toutes les fonctionnalités de remeda
import * as RemedaOriginal from "remeda";

// Créer un objet qui regroupe toutes les fonctionnalités
const REMEDA = {
  ...RemedaOriginal
};

// Exporter l'objet REMEDA comme export par défaut et nommé
export { REMEDA };
export default REMEDA;
