# ADR-0010 : Bootstrap Order & Dependencies

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-18 |
| **Décideurs** | @ncac |
| **RFC liée** | RFC-0001 §5.1 |

---

## Contexte

Le démarrage de l'application Bonsai implique plusieurs composants qui doivent être initialisés dans un ordre précis. La RFC-0001 §5.1 mentionne ce sujet mais ne spécifie pas l'ordre exact ni les dépendances.

### Questions clés

1. Dans quel ordre les composants démarrent-ils ?
2. Comment gérer les dépendances entre composants ?
3. Comment gérer les dépendances async (API, config distante) ?
4. Comment gérer les erreurs au démarrage ?
5. Comment permettre l'injection de dépendances ?

---

## Contraintes

### Architecturales

- **10 composants** : Channel, Radio, Entity, Feature, View, Behavior, Projection, Composer, Template, Config
- **Channels** : Doivent être prêts avant les Features/Views
- **Radio** : Singleton, point central
- **Config** : Potentiellement async (fetch distant)

### Runtime

- Démarrage rapide (< 100ms pour le bootstrap core)
- Erreurs claires si dépendance manquante
- Support SSR potentiel (pas de globals)

---

## Options considérées

### Option A — Bootstrap impératif

**Description** : L'application est démarrée via des appels séquentiels explicites.

```typescript
// main.ts
import { createRadio, createChannel, createFeature } from '@bonsai/core';
import { CartFeature } from '@cart/cart.feature';
import { CartView } from '@cart/cart.view';

async function bootstrap() {
  // 1. Config (potentiellement async)
  const config = await fetchConfig();
  
  // 2. Radio (singleton)
  const radio = createRadio();
  
  // 3. Channels
  const cartChannel = createChannel<CartMessages>('cart');
  radio.register(cartChannel);
  
  // 4. Entities
  const cartEntity = new CartEntity();
  
  // 5. Features
  const cartFeature = createFeature(CartFeature, {
    channels: { cart: cartChannel },
    entities: { cart: cartEntity }
  });
  
  // 6. Views
  const cartView = createView(CartView, {
    el: document.querySelector('#cart'),
    channels: { cart: cartChannel }
  });
  
  // 7. Start
  radio.start();
}

bootstrap().catch(console.error);
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Explicite, pas de magie | - **Très verbeux** |
| + Ordre visible | - Risque d'oubli |
| + Flexible | - Pas de DI automatique |

---

### Option B — Bootstrap déclaratif avec container

**Description** : Un container gère les dépendances et l'ordre.

```typescript
// app.module.ts
export const AppModule = createModule({
  config: () => fetchConfig(),
  
  channels: {
    cart: createChannel<CartMessages>('cart'),
    user: createChannel<UserMessages>('user')
  },
  
  entities: {
    cart: CartEntity,
    user: UserEntity
  },
  
  features: [
    CartFeature,
    UserFeature
  ],
  
  views: {
    '#cart': CartView,
    '#user-panel': UserPanelView
  }
});

// main.ts
import { bootstrap } from '@bonsai/core';
import { AppModule } from './app.module';

bootstrap(AppModule, document.body);
```

```typescript
// Framework bootstrap
async function bootstrap(module: Module, root: Element) {
  // Phase 1: Config
  const config = await module.config?.();
  
  // Phase 2: Infrastructure
  const radio = createRadio();
  const channels = resolveChannels(module.channels);
  channels.forEach(ch => radio.register(ch));
  
  // Phase 3: State
  const entities = resolveEntities(module.entities);
  
  // Phase 4: Logic
  const features = resolveFeatures(module.features, { channels, entities });
  
  // Phase 5: UI
  const views = resolveViews(module.views, root, { channels });
  
  // Phase 6: Start
  radio.start();
  
  return { radio, channels, entities, features, views };
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Déclaratif | - Magie (résolution auto) |
| + Moins de boilerplate | - Erreurs potentiellement obscures |
| + DI automatique | - Moins flexible |

---

### Option C — Bootstrap par phases explicites (recommandé)

**Description** : Phases clairement définies, exécution automatique mais ordre visible.

```typescript
// app.bootstrap.ts
import { BonsaiApp } from '@bonsai/core';

export const app = new BonsaiApp({
  name: 'MyApp',
  debug: __DEV__
});

// Phase 1: Configuration
app.phase('config', async () => {
  return await fetchConfig('/api/config');
});

// Phase 2: Channels
app.phase('channels', () => ({
  cart: createChannel<CartMessages>('cart'),
  user: createChannel<UserMessages>('user'),
  ui: createChannel<UIMessages>('ui')
}));

// Phase 3: Entities
app.phase('entities', () => ({
  cart: new CartEntity(),
  user: new UserEntity()
}));

// Phase 4: Features
app.phase('features', ({ channels, entities }) => [
  new CartFeature({ 
    channel: channels.cart, 
    entity: entities.cart 
  }),
  new UserFeature({ 
    channel: channels.user, 
    entity: entities.user 
  })
]);

// Phase 5: Views (après DOM ready)
app.phase('views', ({ channels }, root) => ({
  cart: new CartView({
    el: root.querySelector('#cart')!,
    channel: channels.cart
  }),
  userPanel: new UserPanelView({
    el: root.querySelector('#user-panel')!,
    channel: channels.user
  })
}));

// main.ts
import { app } from './app.bootstrap';

document.addEventListener('DOMContentLoaded', () => {
  app.start(document.body).then(() => {
    console.log('App started');
  }).catch(err => {
    console.error('Bootstrap failed:', err);
    // Afficher UI d'erreur
  });
});
```

### API BonsaiApp

```typescript
class BonsaiApp {
  constructor(options: AppOptions);
  
  // Enregistre une phase
  phase<K extends PhaseKey>(
    name: K,
    factory: PhaseFactory<K>
  ): this;
  
  // Démarre l'application
  async start(root: Element): Promise<TAppContext>;
  
  // Arrête proprement
  async stop(): Promise<void>;
  
  // Accès au contexte (après start)
  get context(): TAppContext;
}

type TAppContext = {
  config: AppConfig;
  channels: ChannelRegistry;
  entities: EntityRegistry;
  features: Feature[];
  views: ViewRegistry;
  radio: Radio;
}

// Phases prédéfinies (ordre garanti)
type PhaseKey = 'config' | 'channels' | 'entities' | 'features' | 'views' | 'start';
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Phases explicites | - Un peu plus de structure |
| + Ordre garanti | - Phases prédéfinies |
| + Async supporté | |
| + Contexte typé | |
| + Erreurs claires | |

---

### Option D — Lazy bootstrap (à la demande)

**Description** : Les composants sont créés à la demande, pas au démarrage.

```typescript
// Définitions lazy
const cartChannel = lazyChannel<CartMessages>('cart');
const cartEntity = lazyEntity(CartEntity);
const cartFeature = lazyFeature(CartFeature, {
  deps: [cartChannel, cartEntity]
});

// Utilisation
function showCart() {
  // Crée le channel, entity, feature si pas encore fait
  const feature = cartFeature.get();
  const view = new CartView({ channel: cartChannel.get() });
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Démarrage ultra-rapide | - Complexité |
| + Code splitting | - Ordre non garanti |
| + Pay-as-you-go | - Debugging difficile |

---

## Analyse comparative

| Critère | A (Impératif) | B (Container) | C (Phases) | D (Lazy) |
|---------|--------------|---------------|------------|----------|
| **Clarté** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Boilerplate** | ⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Flexibilité** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Erreurs claires** | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐ |
| **Testabilité** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **SSR compatible** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |

---

## Décision

**🟢 Acceptée** — Option C (Bootstrap par phases)

### Justification

1. **Phases explicites** : ordre de démarrage visible et compréhensible
2. **Async natif** : config distante, lazy loading supportés
3. **Typage fort** : chaque phase reçoit le contexte des phases précédentes
4. **Erreurs claires** : si une phase échoue, on sait laquelle
5. **Testable** : chaque phase peut être testée isolément

---

## Ordre de bootstrap

```
┌─────────────────────────────────────────────────────────┐
│                    BOOTSTRAP SEQUENCE                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Phase 1: CONFIG                                        │
│  ├─ Fetch remote config (if any)                        │
│  ├─ Merge with local defaults                           │
│  └─ Validate config schema                              │
│           │                                              │
│           ▼                                              │
│  Phase 2: CHANNELS                                      │
│  ├─ Create all channels                                 │
│  ├─ Register with Radio singleton                       │
│  └─ Setup debug listeners (__DEV__)                     │
│           │                                              │
│           ▼                                              │
│  Phase 3: ENTITIES                                      │
│  ├─ Create entities with initial state                  │
│  ├─ Restore from storage (if persistence)               │
│  └─ Setup change listeners                              │
│           │                                              │
│           ▼                                              │
│  Phase 4: FEATURES                                      │
│  ├─ Create features with channel/entity refs            │
│  ├─ Setup message handlers                              │
│  └─ Initialize feature state                            │
│           │                                              │
│           ▼                                              │
│  Phase 5: VIEWS (after DOM ready)                       │
│  ├─ Query DOM for mount points                          │
│  ├─ Create views with channel refs                      │
│  ├─ Attach behaviors                                    │
│  ├─ Create composers                                    │
│  └─ Initial render                                      │
│           │                                              │
│           ▼                                              │
│  Phase 6: START                                         │
│  ├─ Enable message flow                                 │
│  ├─ Trigger initial data fetch                          │
│  └─ App ready                                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Dépendances entre composants

```
                    ┌──────────┐
                    │  Config  │
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │  Radio   │ (singleton)
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │Channel A│    │Channel B│    │Channel C│
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │Entity A │    │Entity B │    │Entity C │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
                        ▼
                  ┌──────────┐
                  │ Features │ (peuvent accéder N channels/entities)
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
                  │  Views   │ (dans le DOM)
                  └────┬─────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌─────────┐  ┌──────────┐  ┌──────────┐
    │Behaviors│  │ Composers│  │Projections│
    └─────────┘  └──────────┘  └──────────┘
```

---

## Gestion des erreurs

```typescript
class BonsaiApp {
  async start(root: Element): Promise<TAppContext> {
    try {
      // Phase 1
      this.context.config = await this.runPhase('config');
    } catch (err) {
      throw new BootstrapError('config', err);
    }
    
    try {
      // Phase 2
      this.context.channels = await this.runPhase('channels');
    } catch (err) {
      throw new BootstrapError('channels', err);
    }
    
    // ... autres phases
    
    return this.context;
  }
}

class BootstrapError extends Error {
  constructor(
    public phase: PhaseKey,
    public cause: Error
  ) {
    super(`Bootstrap failed at phase "${phase}": ${cause.message}`);
    this.name = 'BootstrapError';
  }
}

// Usage
app.start(document.body).catch(err => {
  if (err instanceof BootstrapError) {
    console.error(`Failed at: ${err.phase}`);
    showErrorUI(err.phase, err.cause);
  }
});
```

---

## Shutdown propre

```typescript
class BonsaiApp {
  async stop(): Promise<void> {
    // Ordre inverse du démarrage
    
    // 1. Détacher les views
    for (const view of this.context.views) {
      await view.detach();
    }
    
    // 2. Arrêter les features
    for (const feature of this.context.features) {
      await feature.dispose();
    }
    
    // 3. Désinscrire les channels
    for (const channel of this.context.channels) {
      this.context.radio.unregister(channel);
    }
    
    // 4. Reset radio
    this.context.radio.stop();
    
    // 5. Clear entities
    for (const entity of this.context.entities) {
      entity.reset();
    }
    
    this.isRunning = false;
  }
}

// Usage : hot reload, tests, SPA navigation
window.addEventListener('beforeunload', () => app.stop());
```

---

## Injection de dépendances

```typescript
// Pas de DI framework complexe, juste des factories typées

app.phase('features', ({ channels, entities, config }) => {
  // Injection explicite via closure
  return [
    new CartFeature({
      channel: channels.cart,
      entity: entities.cart,
      apiBaseUrl: config.apiBaseUrl
    }),
    new UserFeature({
      channel: channels.user,
      entity: entities.user,
      authConfig: config.auth
    })
  ];
});
```

---

## Conséquences

### Positives

- ✅ Ordre de démarrage explicite et garanti
- ✅ Dépendances visibles (pas de magie)
- ✅ Async natif (config distante OK)
- ✅ Erreurs localisées par phase
- ✅ Shutdown propre
- ✅ Testable phase par phase

### Négatives (acceptées)

- ⚠️ Plus structuré que `import` direct — mais nécessaire pour l'ordre
- ⚠️ Phases prédéfinies — flexibilité via hooks si besoin

---

## Extensions futures

### Hooks de phase

```typescript
app.beforePhase('views', async (context) => {
  // Attendre que le DOM soit prêt
  await domReady();
});

app.afterPhase('features', (context) => {
  // Logging, analytics
  analytics.track('features_loaded');
});
```

### Modules lazy

```typescript
// Pour le code splitting
app.lazyPhase('adminFeatures', async ({ channels }) => {
  const { AdminFeature } = await import('@admin/admin.feature');
  return [new AdminFeature({ channel: channels.admin })];
});
```

---

## Actions de suivi

- [ ] Implémenter `BonsaiApp` class
- [ ] Implémenter `BootstrapError`
- [ ] Documenter séquence dans QUICK-START.md
- [ ] Exemple complet d'application
- [ ] Tests : bootstrap, shutdown, erreurs

---

## Références

- [Angular Bootstrap](https://angular.io/guide/bootstrapping)
- [NestJS Module System](https://docs.nestjs.com/modules)
- [Vue createApp](https://vuejs.org/api/application.html#createapp)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-18 | Création (Proposed) — Phases recommandé |
| 2026-03-23 | Accepté — Option C retenue (bootstrap par phases explicites) |
| 2026-04-01 | Note de compatibilité ADR-0019 : le Mode ESM Modulaire ajoute une **pré-étape** `BonsaiRegistry.collect() → app.register() × N` **avant** `app.start()`. Les phases 1–6 restent intactes. Voir ADR-0019 §7 pour le détail. |
