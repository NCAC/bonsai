/**
 * Accès de test à l'Entity d'une Feature.
 *
 * `Feature.entity` est `protected` (I5, I6) : aucun code applicatif ne peut y
 * accéder. Les tests unitaires qui observent l'état après un Command passent
 * par ce helper — cast structurel explicite, réservé à `tests/`.
 */

import type { Entity, TJsonSerializable } from "@bonsai/entity";
import type { TChannelDefinition } from "@bonsai/event";
import type { Feature } from "@bonsai/feature";

export function entityOf<TEntity extends Entity<TJsonSerializable>>(
  feature: Feature<TEntity, TChannelDefinition, string>
): TEntity {
  return (feature as unknown as { entity: TEntity }).entity;
}
