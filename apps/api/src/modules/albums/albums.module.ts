import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Kysely } from 'kysely';
import type { DB } from '../data/db.js';
import { AlbumRepository } from './album.repository.js';
import { RotationRepository } from './rotation.repository.js';

/** Albums of each TV's pieces, and the one each TV rotates through. Registered after TvsModule, since albums belong to stored TVs. */
export const AlbumsModule: ServerKitModule = {
    name: 'Albums',
    setup: async registry => {
        registry
            .register(AlbumRepository)
            .useFactory(container => new AlbumRepository(container.get(Kysely<DB>)))
            .asSingleton();

        registry
            .register(RotationRepository)
            .useFactory(container => new RotationRepository(container.get(Kysely<DB>)))
            .asSingleton();
    },
};
