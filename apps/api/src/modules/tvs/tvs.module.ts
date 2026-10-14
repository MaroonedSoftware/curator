import { resolve } from 'node:path';
import { format } from 'node:util';
import { SamsungFrameClient } from '@curator/frame';
import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Logger } from '@maroonedsoftware/logger';
import { Kysely } from 'kysely';
import { parseApiConfig } from '../../server/api.config.js';
import { API_ROOT } from '../../server/load.config.js';
import type { DB } from '../data/db.js';
import { FrameClientFactoryToken, FrameClientRegistry, type FrameClientFactory } from '../frame/frame.client.registry.js';
import { OriginalStore } from '../frame/original.store.js';
import { ThumbnailCache } from '../frame/thumbnail.cache.js';
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
                const factory: FrameClientFactory = (tv, tokenStore) => {
                    // The client logs printf-style; each line is formatted here, so the file gets the
                    // whole sentence, and tagged with the TV it came from.
                    const meta = { tvId: tv.id, host: tv.host };
                    const line = (msg: string, args: unknown[]) => `frame: ${format(msg, ...args)}`;
                    return new SamsungFrameClient({
                        host: tv.host,
                        port: tv.port,
                        name: frame.clientName,
                        tokenStore,
                        logger: {
                            // The client logs every wire frame at debug, so it reaches the log only when asked for.
                            debug: frame.debug ? (msg, ...args) => logger.debug(line(msg, args), meta) : () => {},
                            info: (msg, ...args) => logger.info(line(msg, args), meta),
                            warn: (msg, ...args) => logger.warn(line(msg, args), meta),
                        },
                    });
                };
                return factory;
            })
            .asSingleton();

        registry
            .register(FrameClientRegistry)
            .useFactory(container => {
                const tvs = container.get(TvRepository);
                return new FrameClientRegistry(
                    container.get(FrameClientFactoryToken),
                    container.get(Logger),
                    tvId => new DbTokenStore(tvs, tvId),
                    new ThumbnailCache(frame.thumbnailCacheMegabytes * 1024 * 1024),
                );
            })
            .asSingleton();

        registry
            .register(OriginalStore)
            .useFactory(() => new OriginalStore(resolve(API_ROOT, frame.originalsDir)))
            .asSingleton();

        registry
            .register(TvService)
            .useFactory(
                container =>
                    new TvService(
                        container.get(TvRepository),
                        container.get(FrameClientRegistry),
                        container.get(FrameClientFactoryToken),
                        container.get(OriginalStore),
                        container.get(Logger),
                    ),
            )
            .asSingleton();
    },
    shutdown: async container => {
        await container.get(FrameClientRegistry).closeAll();
    },
};
