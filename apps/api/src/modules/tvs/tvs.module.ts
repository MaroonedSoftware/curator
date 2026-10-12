import { SamsungFrameClient } from '@curator/frame';
import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Logger } from '@maroonedsoftware/logger';
import { Kysely } from 'kysely';
import { parseApiConfig } from '../../server/api.config.js';
import type { DB } from '../data/db.js';
import { FrameClientFactoryToken, FrameClientRegistry, type FrameClientFactory } from '../frame/frame.client.registry.js';
import { DbTokenStore } from './db.token.store.js';
import { TvRepository } from './tv.repository.js';
import { TvService } from './tv.service.js';

/**
 * The TVs in the database, each reached through its own client. Clients connect lazily, so nothing
 * here touches the network. Registered after DataModule, which the repository needs.
 */
export const TvsModule: ServerKitModule = {
    name: 'Tvs',
    setup: async (registry, config) => {
        const { frame } = parseApiConfig(config);

        registry
            .register(TvRepository)
            .useFactory(container => new TvRepository(container.get(Kysely<DB>)))
            .asSingleton();

        registry
            .register(FrameClientFactoryToken)
            .useFactory(container => {
                const logger = container.get(Logger);
                const factory: FrameClientFactory = (tv, tokenStore) =>
                    new SamsungFrameClient({
                        host: tv.host,
                        port: tv.port,
                        name: frame.clientName,
                        tokenStore,
                        logger: {
                            // The client logs every wire frame at debug, so it reaches the log only when asked for.
                            debug: frame.debug ? (msg, ...args) => logger.debug(msg, ...args) : () => {},
                            info: (msg, ...args) => logger.info(msg, ...args),
                            warn: (msg, ...args) => logger.warn(msg, ...args),
                        },
                    });
                return factory;
            })
            .asSingleton();

        registry
            .register(FrameClientRegistry)
            .useFactory(container => {
                const tvs = container.get(TvRepository);
                return new FrameClientRegistry(container.get(FrameClientFactoryToken), tvId => new DbTokenStore(tvs, tvId));
            })
            .asSingleton();

        registry
            .register(TvService)
            .useFactory(container => new TvService(container.get(TvRepository), container.get(FrameClientRegistry)))
            .asSingleton();
    },
    shutdown: async container => {
        await container.get(FrameClientRegistry).closeAll();
    },
};
