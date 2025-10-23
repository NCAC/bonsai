/**
 * Helpers de test Bonsai — Création d'application de test
 *
 * Fournit des factories pour monter une Application Bonsai minimale
 * dans un contexte de test, avec des Feature/View/Entity de test.
 *
 * Ces helpers sont internes au framework (pas les helpers publics d'ADR-0006).
 * Ils servent à prouver les invariants architecturaux.
 */

// ============================================================================
// NOTE TDD : ces imports vont échouer tant que l'API Bonsai n'est pas implémentée.
// C'est volontaire — les tests sont rouges, on implémente jusqu'au vert.
// ============================================================================

// Les imports seront activés au fur et à mesure de l'implémentation.
// Pour l'instant, ce fichier documente l'API attendue.

/*
import { Application } from "@core/bonsai";
import { Feature } from "@core/bonsai";
import { Entity } from "@core/bonsai";
import { View } from "@core/bonsai";
import { Composer } from "@core/bonsai";
import { Foundation } from "@core/bonsai";
*/

/**
 * Crée une Application de test minimale avec une seule Feature.
 * Utile pour les tests d'intégration et E2E strate 0.
 *
 * L'implémentation viendra quand les classes existeront.
 */
export function createMinimalTestApp() {
  // TODO: implémenter quand Application, Feature, Entity, View, Composer existent
  throw new Error(
    "createMinimalTestApp() not yet implemented — waiting for Strate 0 classes"
  );
}
