import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FrameService } from '../modules/frame/frame.service.js';

const Raw = z.record(z.string(), z.unknown());

const Device = z.object({
    model: z.string().optional(),
    name: z.string().optional(),
    frameTvSupport: z.boolean(),
    powerOn: z.boolean(),
    raw: Raw,
});

const ArtItem = z.object({ contentId: z.string(), categoryId: z.string(), raw: Raw });

const CurrentArt = z.object({ contentId: z.string().optional(), categoryId: z.string().optional(), raw: Raw });

/** The Frame's own endpoints, one route per {@link FrameService} call. */
export const TvRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.get('/tv', { schema: { response: { 200: Device } } }, async request => request.container.get(FrameService).deviceInfo());

    app.get('/tv/api-version', { schema: { response: { 200: z.object({ version: z.string() }) } } }, async request => ({
        version: await request.container.get(FrameService).apiVersion(),
    }));

    app.get(
        '/tv/art',
        {
            schema: {
                // e.g. MY-C0002 for uploads, MY-C0004 favourites, MY-C0008 the Art Store. Omit for everything.
                querystring: z.object({ category: z.string().min(1).optional() }),
                response: { 200: z.object({ items: z.array(ArtItem) }) },
            },
        },
        async request => ({ items: await request.container.get(FrameService).list(request.query.category) }),
    );

    app.get('/tv/art/current', { schema: { response: { 200: CurrentArt } } }, async request => request.container.get(FrameService).current());

    app.get('/tv/art-mode', { schema: { response: { 200: z.object({ on: z.boolean() }) } } }, async request => ({
        on: await request.container.get(FrameService).getArtMode(),
    }));
};
