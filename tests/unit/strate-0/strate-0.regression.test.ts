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
 * | #7   | 2026-04-20 | feature.core                                     |
 * | #8   | 2026-04-20 | view.core                                        |
 *
 * ── Utilisation ────────────────────────────────────────────────────────
 *
 *   pnpm test:strate-0:regression
 *   npx jest tests/unit/strate-0/strate-0.regression.test.ts
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── PR #2 — Channel tri-lane + Radio singleton ────────────────────────
import "./channel.basic.test";
import "./radio.singleton.test";

// ── PR #5 — Entity basic (ADR-0001, I6, I46, I51, I52) ───────────────
import "./entity.basic.test";

// ── PR #7 — Feature core (5 capacités, I1, I2, I3, I5, I12, I21, I48) ─
import "./feature.core.test";

// ── PR #8 — View core (ADR-0024, I4, I31, I39, I40, I48, D48) ─────────
import "./view.core.test";
