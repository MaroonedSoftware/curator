import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Logger } from '@maroonedsoftware/logger';
import { AlbumRepository } from '../albums/album.repository.js';
import { RotationRepository } from '../albums/rotation.repository.js';
import { OriginalStore } from '../frame/original.store.js';
import { TvService } from '../tvs/tv.service.js';
import { BackupService } from './backup.service.js';

/** Backing up TVs' art, albums and rotations as a zip. Registered after AlbumsModule, whose repositories it reads. */
export const BackupModule: ServerKitModule = {
    name: 'Backup',
    setup: async registry => {
        registry
            .register(BackupService)
            .useFactory(
                container =>
                    new BackupService(
                        container.get(TvService),
                        container.get(AlbumRepository),
                        container.get(RotationRepository),
                        container.get(OriginalStore),
                        container.get(Logger),
                    ),
            )
            .asSingleton();
    },
};
