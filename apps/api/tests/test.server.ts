import { AppConfig } from '@maroonedsoftware/appconfig';
import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { ConsoleLogger, type Logger } from '@maroonedsoftware/logger';
import type { TokenStore } from '@curator/frame';
import { Kysely } from 'kysely';
import type { DB } from '../src/modules/data/db.js';
import { FrameClientFactoryToken, type FrameClientFactory, type TvAddress } from '../src/modules/frame/frame.client.registry.js';
import { FrameClientToken } from '../src/modules/frame/frame.tokens.js';
import type { NewTv, TvRow } from '../src/modules/tvs/tv.repository.js';
import { modules } from '../src/modules/modules.js';
import { buildServer } from '../src/server/setup.server.js';
import { FakeFrameClient } from './fake.frame.client.js';
import { createTestDb, dropTestDb, testDbSettings, uniqueDbName } from './test.db.js';

/** A logger that drops everything, so test output is only the tests. */
export const silentLogger: Logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, trace: () => {} };

/** Config for a test server on database `dbName`. The TV host is never dialled: the client is replaced by a fake. */
export const testConfig = (dbName = testDbSettings.bootstrapName, overrides: Record<string, unknown> = {}) =>
    new AppConfig({
        server: { port: 0, corsOrigins: 'http://localhost:14102' },
        database: {
            host: testDbSettings.host,
            port: testDbSettings.port,
            user: testDbSettings.user,
            password: testDbSettings.password,
            name: dbName,
        },
        tv: { host: '192.0.2.1' },
        ...overrides,
    });

/**
 * Builds the real server without listening, for `app.inject()`, on a fresh database cloned for this
 * test file and with a {@link FakeFrameClient} in place of the TV. `close` runs the module shutdown
 * hooks, as `builder.start`'s shutdown would, and drops the database. TEST_LOG=1 shows the server's
 * own log, which is where a 500's cause is.
 */
export const createTestServer = async (testFileUrl: string, overrides: Record<string, unknown> = {}) => {
    const dbName = uniqueDbName(testFileUrl);
    await createTestDb(dbName);
    const tv = new FakeFrameClient();
    /** The fake behind each stored TV, by TV id, built when the API first reaches for that TV. */
    const tvs = new Map<string, { client: FakeFrameClient; address: TvAddress; tokenStore: TokenStore }>();
    /** Every client the factory built, in order, including the short-lived ones `POST /tvs` pairs with. */
    const built: FakeFrameClient[] = [];
    /** Runs on each client as it is built, to set up the TV a test needs before the API reaches it. */
    let prepare: (client: FakeFrameClient) => void = () => {};
    const factory: FrameClientFactory = (address, tokenStore) => {
        const client = new FakeFrameClient(tokenStore);
        prepare(client);
        built.push(client);
        tvs.set(address.id, { client, address, tokenStore });
        return client;
    };
    const prepareTvs = (fn: (client: FakeFrameClient) => void) => {
        prepare = fn;
    };
    const fakeTv: ServerKitModule = {
        name: 'FakeTv',
        setup: async registry => {
            registry.remove(FrameClientToken);
            registry.register(FrameClientToken).useInstance(tv);
            registry.remove(FrameClientFactoryToken);
            registry.register(FrameClientFactoryToken).useInstance(factory);
        },
    };
    const testModules = [...modules, fakeTv];
    const { builder, container } = await buildServer(
        testConfig(dbName, overrides),
        process.env.TEST_LOG ? new ConsoleLogger() : silentLogger,
        testModules,
    );
    await builder.app.ready();

    const close = async () => {
        await builder.app.close();
        for (const module of testModules) {
            await module.shutdown?.(container);
        }
        await dropTestDb(dbName);
    };
    const db: Kysely<DB> = container.get(Kysely<DB>);
    /** Stores a TV directly, as if it had been paired. */
    const addTv = (values: Partial<NewTv> = {}): Promise<TvRow> => {
        const tv: NewTv = {
            name: 'Living Room',
            host: `192.0.2.${10 + Math.floor(Math.random() * 200)}`,
            port: 8002,
            token: 'paired-token',
            ...values,
        };
        return db.insertInto('tvs').values(tv).returningAll().executeTakeFirstOrThrow();
    };

    return { app: builder.app, container, tv, tvs, built, prepareTvs, db, addTv, dbName, close };
};
