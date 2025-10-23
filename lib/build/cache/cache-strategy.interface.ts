// Interface commune pour les stratégies de cache du build Bonsai
// Permet d'unifier l'utilisation des caches library et package

export interface ICacheStrategy<T = any> {
  /**
   * Vérifie si le cache est valide pour la cible donnée (package ou library)
   * @param target Infos sur le package ou la librairie
   * @returns true si le cache est valide, false sinon
   */
  isValid(target: T): Promise<boolean>;

  /**
   * Récupère les artefacts du cache (si valides)
   * @param target Infos sur le package ou la librairie
   * @returns true si récupération réussie, false sinon
   */
  read(target: T): Promise<boolean>;

  /**
   * Écrit les artefacts dans le cache
   * @param target Infos sur le package ou la librairie
   * @returns true si écriture réussie, false sinon
   */
  write(target: T): Promise<boolean>;

  /**
   * Vide le cache pour la cible donnée
   * @param target Infos sur le package ou la librairie
   */
  clear(target: T): Promise<void>;
}
