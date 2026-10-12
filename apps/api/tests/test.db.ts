import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { EmptyUpdateRewriteDialect, KyselyDefaultPlugins, KyselyPgTypeOverrides, KyselyPool } from '@maroonedsoftware/kysely';
import { Kysely } from 'kysely';
import type { DB } from '../src/modules/data/db.js';

export const TEMPLATE_DATABASE = 'curator_test_template';

/** The `db-test` service in docker-compose.yml. Override through the environment to use another cluster. */
export const testDbSettings = {
    host: process.env.TEST_DATABASE_HOST ?? 'localhost',
    port: Number(process.env.TEST_DATABASE_PORT ?? 14133),
    user: process.env.TEST_DATABASE_USER ?? 'postgres',
    password: process.env.TEST_DATABASE_PASSWORD ?? 'postgres-test',
    bootstrapName: process.env.TEST_DATABASE_NAME ?? 'curator-test',
};

export const connectionString = (dbName: string) =>
    `postgres://${testDbSettings.user}:${testDbSettings.password}@${testDbSettings.host}:${testDbSettings.port}/${dbName}?sslmode=disable`;

const createPool = (dbName: string, max = 3) => new KyselyPool({ connectionString: connectionString(dbName), types: KyselyPgTypeOverrides, max });

/** A connection to the bootstrap database, for creating and dropping the per-test ones. */
export const createAdminPool = () => createPool(testDbSettings.bootstrapName, 2);

/**
 * A database name unique to this test file and run. The `.test.ts_` infix is what the global
 * teardown sweeps for, so a crashed worker's leftovers are still cleaned up.
 */
export const uniqueDbName = (testFileUrl: string) => `${basename(new URL(testFileUrl).pathname)}_${randomUUID().slice(0, 8)}`;

/** Clones a fresh database from the migrated template. Cloning is cheap; the template holds no data. */
export const createTestDb = async (dbName: string) => {
    const admin = createAdminPool();
    try {
        await admin.query(`create database "${dbName}" template ${TEMPLATE_DATABASE}`);
    } finally {
        await admin.end();
    }
};

export const dropTestDb = async (dbName: string) => {
    const admin = createAdminPool();
    try {
        await admin.query(`drop database if exists "${dbName}" with (force)`);
    } finally {
        await admin.end();
    }
};

/** A Kysely on a test database, for seeding and inspecting rows directly. */
export const createTestKysely = (dbName: string): Kysely<DB> =>
    new Kysely<DB>({ dialect: new EmptyUpdateRewriteDialect({ pool: createPool(dbName) }), plugins: KyselyDefaultPlugins });
