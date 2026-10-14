import fastifyStatic from '@fastify/static';
import type { FastifyPluginAsync } from 'fastify';

/** Vite names every file under `assets/` by its content hash, so a cached copy never goes stale. */
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * The built web app, from `dir`, for running the API and the UI as one process on one origin (the
 * Docker image). Registered without the route prefix, so it owns everything the API does not.
 *
 * A GET for a path that names no file answers `index.html`, because the web app routes on the
 * client: a deep link or a reload on `/tvs/3` must load the app, not 404. Two kinds of path are left
 * to the ordinary 404 instead: anything under `apiPrefix`, so an unknown endpoint still answers JSON,
 * and anything whose last segment has an extension, so a missing script is not answered with HTML.
 */
export const webRoutes =
    (dir: string, apiPrefix: string): FastifyPluginAsync =>
    async app => {
        await app.register(fastifyStatic, {
            root: dir,
            // One route per file found at startup, rather than a wildcard, so the fallback below can
            // own the wildcard. The build is fixed for the life of the process.
            wildcard: false,
            cacheControl: false,
            setHeaders: (reply, path) => {
                reply.header('cache-control', path.includes('/assets/') ? IMMUTABLE : 'no-cache');
            },
        });

        app.get('/*', async (request, reply) => {
            const path = request.url.split('?')[0] ?? '/';
            const underApi = apiPrefix !== '' && (path === apiPrefix || path.startsWith(`${apiPrefix}/`));
            const lastSegment = path.slice(path.lastIndexOf('/') + 1);
            if (underApi || lastSegment.includes('.')) {
                return reply.callNotFound();
            }
            return reply.sendFile('index.html');
        });
    };
