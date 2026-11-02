# @bonsai/kernel

> **Noyau d'exécution du framework Bonsai.**
> Réalisation de l'infrastructure de communication (théorie §13) et du protocole d'exécution (annexe C).

---

## Rôle

`@bonsai/kernel` exécute le modèle d'une racine : il en tient le registre, délivre les messages, valide les unités et engage les effets sur l'hôte. Les classes de base des composants (`Feature`, `Entity`, `View`, `Composer`, `Foundation`, `Application`) s'appuient sur lui ; le développeur d'application ne l'importe jamais.

| Export | Rôle | Visibilité |
| --- | --- | --- |
| **`Root`** | Noyau d'une racine : registre, file différée, unités de validation, Queries, parts, effets, trace | Interne au framework (I15, I80) |
| `capture` | Capture par copie et gel profond des valeurs transmises (G2, C.5) | Interne |
| `TransportError`, `StartupError`, `InvariantError`, `ManifestError` | Erreurs du noyau | Interne |
| `TChannelDefinition`, `TChannelToken`, `TTokenDef`, `TAnyEventPayload` | Types de contrat des Channels | Ré-exportés par `@bonsai/core` (types seulement) |
| Types du noyau (`TComponentSpec`, contextes, entrées de trace…) | Contrats entre le noyau et les classes de base | Interne |
| `describeComponent`, `DESCRIBE` | Description d'un composant pour le noyau | Interne |

## Ce que fait `Root`

| Domaine | Références |
| --- | --- |
| Unités de validation, journal et rollback | 9.13, G7 |
| Délivrance différée, sans réentrance, vidage synchrone | G5, D8, ADR-35 |
| Queries synchrones en lecture seule | G5, A3.g |
| Démarrage depuis un Manifest, ordonné par dépendances initiales | C.1 |
| Contextes causaux et borne de profondeur | G8, D9 |
| Ressources distribuables, parts, désignations, restitutions | 6.5, 8.5, T7, C.7 |
| Effets : préparation, puis engagement après validation | C.3 |
| Admission des faits de l'hôte et droit de Command | D10, C.4, D18 |

Le détail, fichier par fichier, est dans [`src/kernel/README.md`](src/kernel/README.md).

## Structure des fichiers

```text
src/
  bonsai-kernel.ts     ← barrel
  channel-types.ts     ← types de contrat des Channels
  component.ts         ← describeComponent
  kernel/
    root.ts            ← Root
    types.ts           ← types du noyau
    capture.ts         ← capture des valeurs
    errors.ts          ← erreurs du noyau
```

## Dépendances

```text
@bonsai/immer   ← mutations des Entities sur le journal de l'unité (A4.a)
@bonsai/types
```

## Documents normatifs

| Document | Ce qu'il spécifie |
| --- | --- |
| [Théorie](../../docs/theorie.md), §13 et annexe C | Garanties de l'infrastructure de communication et protocole d'exécution |
| [ADR-28](../../docs/adr/ADR-28-monorepo-packages.md) | Topologie des packages |
| [ADR-35](../../docs/adr/ADR-35-vidage-file-differee.md) | Vidage de la file différée |

## Tests

`tests/unit/kernel/` : `root.test.ts` (M1), `entity.test.ts` (M2), `structure.test.ts` (M3), `host.test.ts` (M4, jsdom), `permissions.test.ts` (M5, jsdom).
