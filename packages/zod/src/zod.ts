// Importer toutes les fonctionnalités de zod
import * as ZodOriginal from "zod";

// Créer un objet qui regroupe toutes les fonctionnalités
const ZOD = {
  ...ZodOriginal
};

// Exporter l'objet ZOD comme export par défaut et nommé
export { ZOD };
export default ZOD;
