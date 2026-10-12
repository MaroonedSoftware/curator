import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { FrameModule } from './frame/frame.module.js';

/** Every module, in setup order. Shutdown walks the same list. */
export const modules: ServerKitModule[] = [FrameModule];
