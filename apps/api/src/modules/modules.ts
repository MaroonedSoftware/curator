import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { DataModule } from './data/data.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { FrameModule } from './frame/frame.module.js';
import { TvsModule } from './tvs/tvs.module.js';

/** Every module, in setup order. Shutdown walks the same list. */
export const modules: ServerKitModule[] = [DataModule, FrameModule, TvsModule, DiscoveryModule];
