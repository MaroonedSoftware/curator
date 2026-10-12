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

/** A TV content id: MY-Fxxxx for uploads, SAM-Sxxxx for the Art Store. */
const ContentId = z.string().regex(/^[A-Za-z0-9_-]+$/, 'not a content id');

const ContentIdParams = z.object({ contentId: ContentId });

/** e.g. "none", "shadowbox_polar", "modern_apricot". Not every matte fits every aspect ratio. */
const Matte = z.string().regex(/^[a-z0-9_]+$/, 'not a matte id');

const json = { body: ['application/json'] };

/** The upload ceiling, matching ServerKit's binary parser. A 4K JPEG is well under it. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const;

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

    app.post(
        '/tv/art',
        {
            bodyLimit: MAX_IMAGE_BYTES,
            config: { body: Object.keys(IMAGE_TYPES) },
            schema: {
                querystring: z.object({ matte: Matte.optional(), portraitMatte: Matte.optional() }),
                response: { 201: z.object({ contentId: z.string() }) },
            },
        },
        async (request, reply) => {
            // The body gate admits only the two image types, and answers 411 for an empty body.
            const mediaType = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() as keyof typeof IMAGE_TYPES;
            const image = request.body as Buffer;
            const contentId = await request.container.get(FrameService).upload(image, { fileType: IMAGE_TYPES[mediaType], ...request.query });
            return reply.status(201).send({ contentId });
        },
    );

    app.put(
        '/tv/art/current',
        {
            config: json,
            schema: {
                body: z.object({
                    contentId: ContentId,
                    /** Switch the TV to art mode to show it. Defaults to true. */
                    show: z.boolean().optional(),
                    category: z.string().min(1).optional(),
                }),
            },
        },
        async (request, reply) => {
            const { contentId, ...opts } = request.body;
            await request.container.get(FrameService).select(contentId, opts);
            return reply.status(204).send();
        },
    );

    app.delete('/tv/art/:contentId', { schema: { params: ContentIdParams } }, async (request, reply) => {
        await request.container.get(FrameService).delete(request.params.contentId);
        return reply.status(204).send();
    });

    app.put(
        '/tv/art/:contentId/matte',
        { config: json, schema: { params: ContentIdParams, body: z.object({ matte: Matte, portraitMatte: Matte.optional() }) } },
        async (request, reply) => {
            await request.container.get(FrameService).changeMatte(request.params.contentId, request.body.matte, request.body.portraitMatte);
            return reply.status(204).send();
        },
    );

    app.put('/tv/art-mode', { config: json, schema: { body: z.object({ on: z.boolean() }) } }, async (request, reply) => {
        await request.container.get(FrameService).setArtMode(request.body.on);
        return reply.status(204).send();
    });
};
