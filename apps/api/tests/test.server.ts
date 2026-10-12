import { AppConfig } from '@maroonedsoftware/appconfig';
import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { ConsoleLogger, type Logger } from '@maroonedsoftware/logger';
import { FrameClientToken } from '../src/modules/frame/frame.tokens.js';
import { modules } from '../src/modules/modules.js';
import { buildServer } from '../src/server/setup.server.js';
import { FakeFrameClient } from './fake.frame.client.js';

/** A logger that drops everything, so test output is only the tests. */
export const silentLogger: Logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, trace: () => {} };

/** Config for a test server. The TV host is never dialled: the client is replaced by a fake. */
export const testConfig = (overrides: Record<string, unknown> = {}) =>
    new AppConfig({ server: { port: 0, corsOrigins: 'http://localhost:14102' }, tv: { host: '192.0.2.1' }, ...overrides });

/**
 * Builds the real server without listening, for `app.inject()`, with a {@link FakeFrameClient} in
 * place of the TV. `close` runs the module shutdown hooks, as `builder.start`'s shutdown would.
 * TEST_LOG=1 shows the server's own log, which is where a 500's cause is.
 */
export const createTestServer = async (overrides: Record<string, unknown> = {}) => {
    const tv = new FakeFrameClient();
    const fakeTv: ServerKitModule = {
        name: 'FakeTv',
        setup: async registry => {
            registry.remove(FrameClientToken);
            registry.register(FrameClientToken).useInstance(tv);
        },
    };
    const testModules = [...modules, fakeTv];
    const { builder, container } = await buildServer(testConfig(overrides), process.env.TEST_LOG ? new ConsoleLogger() : silentLogger, testModules);
    await builder.app.ready();

    const close = async () => {
        await builder.app.close();
        for (const module of testModules) {
            await module.shutdown?.(container);
        }
    };
    return { app: builder.app, container, tv, close };
};
