import { bodyParserPlugin, corsPlugin, errorPlugin, serverKitContextPlugin, type ServerKitPlugin } from '@maroonedsoftware/fastify';
import { zodPlugin } from '@maroonedsoftware/fastify/zod';
import type { Container } from 'injectkit';
import type { ApiConfig } from './api.config.js';

/**
 * The plugin stack, in order: errors outermost, then the request context every later step reads,
 * body parsing, CORS, and the zod compilers routes declare their schemas with.
 *
 * There is no authentication step. The API is meant for the home network the TV sits on.
 */
export const setupPlugins = (container: Container, config: ApiConfig): ServerKitPlugin[] => {
    const origins = config.server.corsOrigins
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0);

    return [errorPlugin(container), serverKitContextPlugin(container), bodyParserPlugin(), corsPlugin({ origin: origins }), zodPlugin()];
};
