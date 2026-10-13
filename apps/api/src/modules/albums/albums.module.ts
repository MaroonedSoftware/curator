import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Logger } from '@maroonedsoftware/logger';
import { Kysely } from 'kysely';
import { parseApiConfig } from '../../server/api.config.js';
import type { DB } from '../data/db.js';
import { TvService } from '../tvs/tv.service.js';
import { AlbumRepository } from './album.repository.js';
import { ArtReplacer } from './art.replacer.js';
import { RotationRepository } from './rotation.repository.js';
import { RotationScheduler } from './rotation.scheduler.js';
import { RotationService } from './rotation.service.js';

/**
 * Albums of each TV's pieces, and the one each TV rotates through. Registered after TvsModule, since
 * albums belong to stored TVs. The rotation scheduler starts once the server is ready, so a server
 * built only for tests never rotates on its own.
 */
export const AlbumsModule: ServerKitModule = {
    name: 'Albums',
    setup: async (registry, config) => {
        const { rotation } = parseApiConfig(config);

        registry
            .register(AlbumRepository)
            .useFactory(container => new AlbumRepository(container.get(Kysely<DB>)))
            .asSingleton();

        registry
            .register(RotationRepository)
            .useFactory(container => new RotationRepository(container.get(Kysely<DB>)))
            .asSingleton();

        registry
            .register(RotationService)
            .useFactory(container => new RotationService(container.get(RotationRepository), container.get(AlbumRepository), container.get(TvService)))
            .asSingleton();

        registry
            .register(ArtReplacer)
            .useFactory(
                container =>
                    new ArtReplacer(
                        container.get(TvService),
                        container.get(AlbumRepository),
                        container.get(RotationRepository),
                        container.get(Logger),
                    ),
            )
            .asSingleton();

        registry
            .register(RotationScheduler)
            .useFactory(
                container =>
                    new RotationScheduler(
                        container.get(RotationRepository),
                        container.get(RotationService),
                        container.get(Logger),
                        rotation.tickSeconds * 1000,
                        rotation.retrySeconds * 1000,
                    ),
            )
            .asSingleton();
    },
    ready: async (container, signal) => {
        const scheduler = container.get(RotationScheduler);
        scheduler.start();
        // Shutdown hooks run in module order, after the database's, so ticking stops as soon as shutdown begins.
        signal.addEventListener('abort', () => void scheduler.stop(), { once: true });
    },
    shutdown: async container => {
        await container.get(RotationScheduler).stop();
    },
};
