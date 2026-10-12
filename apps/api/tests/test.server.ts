import { AppConfig } from '@maroonedsoftware/appconfig';
import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { ConsoleLogger, type Logger } from '@maroonedsoftware/logger';
import type { TokenStore } from '@curator/frame';
import { Kysely } from 'kysely';
import type { DB } from '../src/modules/data/db.js';
import { FrameClientFactoryToken, FrameClientRegistry, type FrameClientFactory, type TvAddress } from '../src/modules/frame/frame.client.registry.js';
import type { NewTv, TvRow } from '../src/modules/tvs/tv.repository.js';
import { SsdpSearchToken, type SsdpResponse, type SsdpSearch } from '../src/modules/discovery/ssdp.search.js';
import { modules } from '../src/modules/modules.js';
import { buildServer } from '../src/server/setup.server.js';
import { FakeFrameClient } from './fake.frame.client.js';
import { createTestDb, dropTestDb, testDbSettings, uniqueDbName } from './test.db.js';

/** A logger that drops everything, so test output is only the tests. */
export const silentLogger: Logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, trace: () => {} };

/** Config for a test server on database `dbName`. */
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
        ...overrides,
    });

/**
 * Builds the real server without listening, for `app.inject()`, on a fresh database cloned for this
 * test file, with a {@link FakeFrameClient} in place of every TV. `close` runs the module shutdown
 * hooks, as `builder.start`'s shutdown would, and drops the database. TEST_LOG=1 shows the server's
 * own log, which is where a 500's cause is.
 */
export const createTestServer = async (testFileUrl: string, overrides: Record<string, unknown> = {}) => {
    const dbName = uniqueDbName(testFileUrl);
    await createTestDb(dbName);
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
    /** What the network answers to an SSDP search. Nothing, unless a test says otherwise. */
    const ssdp: { responses: SsdpResponse[]; searches: Parameters<SsdpSearch>[0][] } = { responses: [], searches: [] };
    const search: SsdpSearch = async options => {
        ssdp.searches.push(options);
        return ssdp.responses;
    };
    const fakeTv: ServerKitModule = {
        name: 'FakeTv',
        setup: async registry => {
            registry.remove(FrameClientFactoryToken);
            registry.register(FrameClientFactoryToken).useInstance(factory);
            registry.remove(SsdpSearchToken);
            registry.register(SsdpSearchToken).useValue(search);
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

    return { app: builder.app, container, tvs, built, prepareTvs, ssdp, db, addTv, dbName, close };
};

/**
 * A test server with one stored TV, for exercising that TV's endpoints: `base` is its `/tvs/:tvId`
 * and `tv` the fake behind it.
 */
export const createTvTestServer = async (testFileUrl: string, overrides: Record<string, unknown> = {}) => {
    const server = await createTestServer(testFileUrl, overrides);
    const stored = await server.addTv();
    const tv = server.container.get(FrameClientRegistry).clientFor(stored) as FakeFrameClient;
    return { ...server, tv, base: `/tvs/${stored.id}` };
};
