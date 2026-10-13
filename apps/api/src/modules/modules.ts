import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { AlbumsModule } from './albums/albums.module.js';
import { BackupModule } from './backup/backup.module.js';
import { DataModule } from './data/data.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { TvsModule } from './tvs/tvs.module.js';

/** Every module, in setup order. Shutdown walks the same list. */
export const modules: ServerKitModule[] = [DataModule, TvsModule, AlbumsModule, BackupModule, DiscoveryModule];
