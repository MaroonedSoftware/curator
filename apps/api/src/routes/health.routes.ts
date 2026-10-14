import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';

const Health = z.object({ status: z.literal('ok'), uptimeMs: z.number().int(), version: z.string().optional(), revision: z.string().optional() });

/** Stamped into the Docker image at build time (see the Dockerfile). Unset or empty everywhere else. */
const build = {
    version: process.env.BUILD_VERSION || undefined,
    revision: process.env.BUILD_REVISION || undefined,
};

/**
 * Liveness only: answers whether a process is serving on this port. It never touches the TV, which
 * may be asleep. An image also says which release and commit it was built from.
 */
export const HealthRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.get('/health', { schema: { response: { 200: Health } } }, async () => ({
        status: 'ok' as const,
        uptimeMs: Math.round(process.uptime() * 1000),
        ...build,
    }));
};
