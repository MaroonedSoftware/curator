import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Kysely } from 'kysely';
import type { DB } from '../data/db.js';
import { AlbumRepository } from './album.repository.js';

/** Albums of each TV's pieces. Registered after TvsModule, since albums belong to stored TVs. */
export const AlbumsModule: ServerKitModule = {
    name: 'Albums',
    setup: async registry => {
        registry
            .register(AlbumRepository)
            .useFactory(container => new AlbumRepository(container.get(Kysely<DB>)))
            .asSingleton();
    },
};
