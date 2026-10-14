import { serverKitPlugin, type ServerKitPlugin } from '@maroonedsoftware/fastify';
import { runInTrace } from './trace.context.js';

/**
 * Runs each request inside its own trace, keyed by its request id, so every line it logs carries it.
 * After `serverKitContextPlugin`, which settles the id. The route's pattern rather than its URL, so a
 * query string never reaches the log.
 */
export const tracePlugin = (): ServerKitPlugin =>
    serverKitPlugin('curator.trace', app => {
        app.addHook('onRequest', (request, _reply, done) => {
            runInTrace({ id: request.id, kind: `${request.method} ${request.routeOptions.url ?? request.url.split('?')[0]}` }, done);
        });
    });
