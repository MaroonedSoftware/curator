import { AppConfig } from '@maroonedsoftware/appconfig';
import { ConsoleLogger, type Logger } from '@maroonedsoftware/logger';
import { buildServer } from '../src/server/setup.server.js';

/** A logger that drops everything, so test output is only the tests. */
export const silentLogger: Logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {}, trace: () => {} };

/** Config for a test server: the committed development defaults, minus anything that reaches the network. */
export const testConfig = (overrides: Record<string, unknown> = {}) =>
    new AppConfig({ server: { port: 0, corsOrigins: 'http://localhost:14102' }, ...overrides });

/**
 * Builds the real server without listening, for `app.inject()`. TEST_LOG=1 shows the server's
 * own log, which is where a 500's cause is.
 */
export const createTestServer = async (overrides: Record<string, unknown> = {}) => {
    const { builder, container } = await buildServer(testConfig(overrides), process.env.TEST_LOG ? new ConsoleLogger() : silentLogger);
    await builder.app.ready();
    return { app: builder.app, container, close: () => builder.app.close() };
};
