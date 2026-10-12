import { FileTokenStore, SamsungFrameClient } from '@curator/frame';
import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Logger } from '@maroonedsoftware/logger';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseApiConfig } from '../../server/api.config.js';
import { FrameService } from './frame.service.js';
import { FrameClientToken } from './frame.tokens.js';

/** apps/api, whether this runs from src or dist. */
const API_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * The TV. The client connects lazily on first use and reconnects after the TV drops it, so
 * nothing here touches the network: the API boots while the TV is asleep.
 */
export const FrameModule: ServerKitModule = {
    name: 'Frame',
    setup: async (registry, config) => {
        const { tv } = parseApiConfig(config);
        const tokenFile = isAbsolute(tv.tokenFile) ? tv.tokenFile : resolve(API_ROOT, tv.tokenFile);
        registry
            .register(FrameClientToken)
            .useFactory(container => {
                const logger = container.get(Logger);
                return new SamsungFrameClient({
                    host: tv.host,
                    port: tv.port,
                    name: tv.name,
                    tokenStore: new FileTokenStore(tokenFile),
                    logger: {
                        // The client logs every wire frame at debug, so it reaches the log only when asked for.
                        debug: tv.debug ? (msg, ...args) => logger.debug(msg, ...args) : () => {},
                        info: (msg, ...args) => logger.info(msg, ...args),
                        warn: (msg, ...args) => logger.warn(msg, ...args),
                    },
                });
            })
            .asSingleton();
        registry
            .register(FrameService)
            .useFactory(container => new FrameService(container.get(FrameClientToken)))
            .asSingleton();
    },
    shutdown: async container => {
        await container.get(FrameClientToken).close();
    },
};
