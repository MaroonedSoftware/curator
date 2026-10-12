import { AppConfig } from '@maroonedsoftware/appconfig';
import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { ConsoleLogger, type Logger } from '@maroonedsoftware/logger';
import { FrameClientToken } from '../src/modules/frame/frame.tokens.js';
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
    const fakeTv: ServerKitModule = {
        name: 'FakeTv',
        setup: async registry => {
            registry.remove(FrameClientToken);
            registry.register(FrameClientToken).useInstance(tv);
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
    return { app: builder.app, container, tv, dbName, close };
};
