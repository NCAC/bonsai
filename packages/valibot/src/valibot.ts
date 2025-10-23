// Exporter toutes les fonctionnalités de valibot
// ADR-0022 : Valibot imposé comme unique bibliothèque de validation de Bonsai
import * as ValibotOriginal from "valibot";

// Exposer l'API valibot complète sous un namespace VALIBOT
const VALIBOT = {
  ...ValibotOriginal
};

export { VALIBOT };
export default VALIBOT;
