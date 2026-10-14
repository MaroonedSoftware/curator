import { bodyParserPlugin, corsPlugin, errorPlugin, serverKitContextPlugin, type ServerKitPlugin } from '@maroonedsoftware/fastify';
import { zodPlugin } from '@maroonedsoftware/fastify/zod';
import type { Container } from 'injectkit';
import { tracePlugin } from '../logging/trace.plugin.js';
import type { ApiConfig } from './api.config.js';

/**
 * The plugin stack, in order: errors outermost, then the request context every later step reads,
 * the trace the log stamps on each request's lines, body parsing, CORS, and the zod compilers routes declare their schemas with.
 *
 * There is no authentication step. The API is meant for the home network the TV sits on.
 */
export const setupPlugins = (container: Container, config: ApiConfig): ServerKitPlugin[] => {
    const origins = config.server.corsOrigins
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0);

    return [
        errorPlugin(container),
        serverKitContextPlugin(container),
        tracePlugin(),
        bodyParserPlugin(),
        corsPlugin({ origin: origins }),
        zodPlugin(),
    ];
};
