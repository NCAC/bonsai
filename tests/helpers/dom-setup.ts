/**
 * Helpers de test Bonsai — Configuration DOM
 *
 * Configure l'environnement DOM pour les tests qui en ont besoin.
 * Les tests unitaires strate 0 de Channel/Entity/Feature n'en ont pas besoin.
 * Les tests de View/Composer/Foundation/E2E en ont besoin.
 *
 * @jest-environment jsdom
 */

/**
 * Nettoie le DOM entre les tests.
 * Appeler dans beforeEach() des tests qui manipulent le DOM.
 */
export function resetDOM(): void {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
}

/**
 * Crée un élément DOM minimal pour servir de rootElement à une View.
 * Insère l'élément dans document.body et retourne le sélecteur CSS.
 */
export function createRootElement(
  tag: string = "div",
  selector: string = "[data-view-root]"
): HTMLElement {
  const el = document.createElement(tag);
  // Parse le selector pour appliquer l'attribut
  const attrMatch = selector.match(/\[([^\]=]+)(?:="([^"]*)")?\]/);
  if (attrMatch) {
    el.setAttribute(attrMatch[1], attrMatch[2] ?? "");
  }
  const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
  if (classMatch) {
    el.classList.add(classMatch[1]);
  }
  const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    el.id = idMatch[1];
  }
  document.body.appendChild(el);
  return el;
}

/**
 * Crée un DOM préexistant simulant du SSR (HTML rendu côté serveur).
 * Utile pour tester la PDR (Projection DOM Réactive) qui s'appuie
 * sur un DOM existant plutôt que créé par JS.
 */
export function createPrerenderedDOM(html: string): void {
  document.body.innerHTML = html;
}
