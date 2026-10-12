import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { EmptyUpdateRewriteDialect, KyselyDefaultPlugins, KyselyPgTypeOverrides, KyselyPool } from '@maroonedsoftware/kysely';
import { Logger } from '@maroonedsoftware/logger';
import { Kysely, type LogEvent } from 'kysely';
import { parseApiConfig } from '../../server/api.config.js';
import type { DB } from './db.js';

/**
 * Postgres, through Kysely. The pool connects lazily, so the API boots before the database is up
 * and a request that needs it fails rather than the process.
 */
export const DataModule: ServerKitModule = {
    name: 'Data',
    setup: async (registry, config) => {
        const { database } = parseApiConfig(config);
        registry
            .register(Kysely<DB>)
            .useFactory(container => {
                const logger = container.get(Logger);
                const pool = new KyselyPool({
                    host: database.host,
                    port: database.port,
                    user: database.user,
                    password: database.password,
                    database: database.name,
                    max: database.pool.max,
                    connectionTimeoutMillis: database.pool.connectionTimeoutMs,
                    types: KyselyPgTypeOverrides,
                });
                pool.on('error', error => logger.error(error));
                return new Kysely<DB>({
                    dialect: new EmptyUpdateRewriteDialect({ pool }, logger),
                    plugins: KyselyDefaultPlugins,
                    log: (event: LogEvent) => {
                        if (event.level === 'error') {
                            logger.error(event.error);
                        }
                    },
                });
            })
            .asSingleton();
    },
    shutdown: async container => {
        await container.get(Kysely<DB>).destroy();
    },
};
