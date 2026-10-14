import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { getLogStore } from './log.store.js';

/**
 * Closes the log file at shutdown. It has no setup: the store is built in `startServer`, before the
 * container. First in `modules.ts`, so it shuts down last and every other module's shutdown lines
 * are flushed before the file closes.
 */
export const LoggingModule: ServerKitModule = {
    name: 'Logging',
    shutdown: async () => {
        await getLogStore()?.close();
    },
};
