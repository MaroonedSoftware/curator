import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { DataModule } from './data/data.module.js';
import { FrameModule } from './frame/frame.module.js';

/** Every module, in setup order. Shutdown walks the same list. */
export const modules: ServerKitModule[] = [DataModule, FrameModule];
