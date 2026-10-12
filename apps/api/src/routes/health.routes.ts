import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';

const Health = z.object({ status: z.literal('ok'), uptimeMs: z.number().int() });

/** Liveness only: answers whether a process is serving on this port. It never touches the TV, which may be asleep. */
export const HealthRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.get('/health', { schema: { response: { 200: Health } } }, async () => ({
        status: 'ok' as const,
        uptimeMs: Math.round(process.uptime() * 1000),
    }));
};
