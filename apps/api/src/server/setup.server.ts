import 'reflect-metadata';
import type { AppConfig } from '@maroonedsoftware/appconfig';
import { ConsoleLogger, type Logger } from '@maroonedsoftware/logger';
import { ServerKitServerBuilder, type ServerKitModule } from '@maroonedsoftware/fastify';
import type { Container } from 'injectkit';
import { resolve } from 'node:path';
import { CuratorLogger } from '../logging/curator.logger.js';
import { setLogStore } from '../logging/log.store.js';
import { RotatingLogStore } from '../logging/rotating.log.store.js';
import { modules as defaultModules } from '../modules/modules.js';
import { routes } from '../routes/routes.js';
import { parseApiConfig } from './api.config.js';
import { installCrashHandlers } from './crash.handlers.js';
import { API_ROOT } from './load.config.js';
import { parserMappings } from './parser.mappings.js';
import { setupPlugins } from './setup.plugins.js';

/**
 * Builds the server without listening: the container, the plugin stack and the routes. Tests use
 * this directly and drive it through `builder.app.inject()`, appending a module to `modules` to
 * replace a registration (the TV, say) with a fake.
 */
export const buildServer = async (
    config: AppConfig,
    logger: Logger = new ConsoleLogger(),
    modules: ServerKitModule[] = defaultModules,
): Promise<{ builder: ServerKitServerBuilder; container: Container }> => {
    const apiConfig = parseApiConfig(config);
    const builder = new ServerKitServerBuilder();
    const container = await builder.setup(config, logger, modules, parserMappings);
    builder.setupPlugins(container => setupPlugins(container, apiConfig)).setupRoutes(routes);
    return { builder, container };
};

/** Builds the server with its log written to stdout and the rotating file, and listens. */
export const startServer = async (config: AppConfig) => {
    const apiConfig = parseApiConfig(config);
    const { dir, ...limits } = apiConfig.log;
    const store = new RotatingLogStore({ dir: resolve(API_ROOT, dir), ...limits });
    setLogStore(store);
    const logger = new CuratorLogger(new ConsoleLogger(), store);
    installCrashHandlers(logger);

    const { builder } = await buildServer(config, logger);
    return await builder.start(apiConfig.server.port);
};
