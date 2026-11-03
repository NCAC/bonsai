/**
 * @jest-environment jsdom
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Strate 0 — Suite de non-régression cumulative
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce fichier est le point d'entrée cumulatif pour tous les tests validés
 * de la Strate 0. Chaque PR mergée ajoute ses fichiers de test ici.
 *
 * Objectif : garantir qu'aucun test précédemment validé ne casse lors
 * d'un nouvel incrément (PI).
 *
 * ── Historique des ajouts ──────────────────────────────────────────────
 *
 * | PR   | Date       | Tests ajoutés                                    |
 * |------|------------|--------------------------------------------------|
 * | #2   | 2026-04-17 | channel.basic, radio.singleton                   |
 * | #5   | 2026-04-20 | entity.basic                                     |
 * | #7   | 2026-04-20 | feature.basic (ex feature.core)                  |
 * | #8   | 2026-04-20 | view.basic (ex view.core)                        |
 * | M6.3b | 2026-11-01 | channel.basic, radio.singleton, channel.class, radio.singleton (unit) supprimés avec les classes ; kernel/root.test les remplace |
 * | M6.2 | 2026-11-01 | view.basic, composer.basic, foundation.basic remplacés par domain/{view,composer,foundation}.test |
 * | M6.1 | 2026-11-01 | entity.basic et feature.basic remplacés par       |
 * |      |            | tests/unit/domain/{entity,feature}.test (noyau)  |
 *
 * ── Utilisation ────────────────────────────────────────────────────────
 *
 *   pnpm test:strate-0:regression
 *   npx jest tests/unit/strate-0/strate-0.regression.test.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── PR #2 — Channel tri-lane + Radio : retirés au profit du noyau (lot M6.3b) ──
import "../kernel/root.test";

// ── PR #5 / #7 — Entity et Feature : migrés sur le noyau (lot M6.1) ─────
import "../domain/entity.test";
import "../domain/feature.test";

// ── PR #8 — View, Composer, Foundation : migrés sur le noyau (lot M6.2) ──
import "../domain/view.test";
import "../domain/composer.test";
import "../domain/foundation.test";
