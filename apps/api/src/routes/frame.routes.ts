import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { FrameService } from '../modules/frame/frame.service.js';

const Raw = z.record(z.string(), z.unknown());

const Device = z.object({
    model: z.string().optional(),
    name: z.string().optional(),
    frameTvSupport: z.boolean(),
    powerOn: z.boolean(),
    raw: Raw,
});

const ArtItem = z.object({ contentId: z.string(), categoryId: z.string(), categoryIds: z.array(z.string()), raw: Raw });

const CurrentArt = z.object({ contentId: z.string().optional(), categoryId: z.string().optional(), raw: Raw });

/** A TV content id: MY-Fxxxx or MY_Fxxxx for uploads, SAM-Sxxxx for the Art Store. */
export const ContentId = z.string().regex(/^[A-Za-z0-9_-]+$/, 'not a content id');

const ContentIdParams = z.object({ contentId: ContentId });

/** e.g. "none", "shadowbox_polar", "modern_apricot". Not every matte fits every aspect ratio. */
const Matte = z.string().regex(/^[a-z0-9_]+$/, 'not a matte id');

const json = { body: ['application/json'] };

/** The upload ceiling, matching ServerKit's binary parser. A 4K JPEG is well under it. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const;

/** The {@link FrameService} each request resolved in `onRequest`, before its body is read. */
const frames = new WeakMap<FastifyRequest, FrameService>();

/** The TV a request is about. Only routes inside {@link frameRoutes} have one. */
export const frameOf = (request: FastifyRequest): FrameService => {
    const frame = frames.get(request);
    if (!frame) {
        throw new Error(`no TV was resolved for ${request.method} ${request.url}`);
    }
    return frame;
};

/**
 * The Frame's own endpoints, one route per {@link FrameService} call, for whichever TV `resolve`
 * names. Mount it under a prefix: `/tvs/:tvId` for a stored TV. `resolve` runs in `onRequest`, so
 * an unknown TV is refused before an upload's body is read.
 */
export const frameRoutes =
    (resolve: (request: FastifyRequest) => Promise<FrameService> | FrameService): FastifyPluginAsync =>
    async instance => {
        instance.addHook('onRequest', async request => {
            frames.set(request, await resolve(request));
        });
        await instance.register(frameEndpoints);
    };

const frameEndpoints: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.get('/device', { schema: { response: { 200: Device } } }, async request => frameOf(request).deviceInfo());

    app.get('/api-version', { schema: { response: { 200: z.object({ version: z.string() }) } } }, async request => ({
        version: await frameOf(request).apiVersion(),
    }));

    app.get(
        '/art',
        {
            schema: {
                // e.g. MY-C0002 for uploads, MY-C0004 favourites. Omit for everything.
                querystring: z.object({ category: z.string().min(1).optional() }),
                response: { 200: z.object({ items: z.array(ArtItem) }) },
            },
        },
        async request => ({ items: await frameOf(request).list(request.query.category) }),
    );

    app.get('/art/:contentId/thumbnail', { schema: { params: ContentIdParams } }, async (request, reply) => {
        const thumbnail = await frameOf(request).thumbnail(request.params.contentId);
        // A content id names one image for good, so the browser may keep it.
        return reply
            .type(thumbnail.fileType === 'png' ? 'image/png' : 'image/jpeg')
            .header('cache-control', 'private, max-age=604800, immutable')
            .send(thumbnail.data);
    });

    app.get('/art/:contentId/original', { schema: { params: ContentIdParams } }, async (request, reply) => {
        const { contentId } = request.params;
        const original = await frameOf(request).original(contentId);
        return reply
            .type(original.fileType === 'png' ? 'image/png' : 'image/jpeg')
            .header('cache-control', 'private, max-age=604800, immutable')
            .header('content-disposition', `inline; filename="${contentId}.${original.fileType}"`)
            .send(original.data);
    });

    app.get('/art/current', { schema: { response: { 200: CurrentArt } } }, async request => frameOf(request).current());

    app.get('/art-mode', { schema: { response: { 200: z.object({ on: z.boolean() }) } } }, async request => ({
        on: await frameOf(request).getArtMode(),
    }));

    app.post(
        '/art',
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
            const contentId = await frameOf(request).upload(image, { fileType: IMAGE_TYPES[mediaType], ...request.query });
            return reply.status(201).send({ contentId });
        },
    );

    app.put(
        '/art/current',
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
            await frameOf(request).select(contentId, opts);
            return reply.status(204).send();
        },
    );

    app.delete('/art/:contentId', { schema: { params: ContentIdParams } }, async (request, reply) => {
        await frameOf(request).delete(request.params.contentId);
        return reply.status(204).send();
    });

    app.put(
        '/art/:contentId/matte',
        { config: json, schema: { params: ContentIdParams, body: z.object({ matte: Matte, portraitMatte: Matte.optional() }) } },
        async (request, reply) => {
            await frameOf(request).changeMatte(request.params.contentId, request.body.matte, request.body.portraitMatte);
            return reply.status(204).send();
        },
    );

    app.put('/art-mode', { config: json, schema: { body: z.object({ on: z.boolean() }) } }, async (request, reply) => {
        await frameOf(request).setArtMode(request.body.on);
        return reply.status(204).send();
    });
};
