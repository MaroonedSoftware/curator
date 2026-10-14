import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getLogStore } from '../logging/log.store.js';

const LogLevel = z.enum(['trace', 'debug', 'info', 'warn', 'error']);

const LogsQuery = z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(200),
    /** The least severe level to include. */
    level: LogLevel.optional(),
});

const LogEntry = z.object({ ts: z.string(), level: z.string(), text: z.string() });

/**
 * The API's own log, newest first: what the server wrote to `.data/logs/api.log`. Empty when the
 * server runs without a log file (tests). Redacted as it was written, so nothing here is a secret.
 */
export const LogsRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.get('/logs', { schema: { querystring: LogsQuery, response: { 200: z.object({ items: z.array(LogEntry) }) } } }, async request => ({
        items: (await getLogStore()?.tail(request.query)) ?? [],
    }));
};
