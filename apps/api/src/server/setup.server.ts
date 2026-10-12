import 'reflect-metadata';
import type { AppConfig } from '@maroonedsoftware/appconfig';
import { ConsoleLogger, type Logger } from '@maroonedsoftware/logger';
import { ServerKitServerBuilder } from '@maroonedsoftware/fastify';
import type { Container } from 'injectkit';
import { modules } from '../modules/modules.js';
import { routes } from '../routes/routes.js';
import { parseApiConfig } from './api.config.js';
import { setupPlugins } from './setup.plugins.js';

/**
 * Builds the server without listening: the container, the plugin stack and the routes. Tests use
 * this directly and drive it through `builder.app.inject()`.
 */
export const buildServer = async (
    config: AppConfig,
    logger: Logger = new ConsoleLogger(),
): Promise<{ builder: ServerKitServerBuilder; container: Container }> => {
    const apiConfig = parseApiConfig(config);
    const builder = new ServerKitServerBuilder();
    const container = await builder.setup(config, logger, modules);
    builder.setupPlugins(container => setupPlugins(container, apiConfig)).setupRoutes(routes);
    return { builder, container };
};

export const startServer = async (config: AppConfig) => {
    const { builder } = await buildServer(config);
    return await builder.start(parseApiConfig(config).server.port);
};
