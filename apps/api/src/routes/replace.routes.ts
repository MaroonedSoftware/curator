import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ArtReplacer } from '../modules/albums/art.replacer.js';
import { ContentId, fileTypeOf, IMAGE_TYPES, MAX_IMAGE_BYTES } from './frame.routes.js';
import { storedTvOnly } from './stored.tv.hook.js';
import { TvIdParams } from './tvs.routes.js';

/** Swapping a piece's image, under `/tvs/:tvId/art/:contentId/replace`. An unknown TV answers 404. */
export const ReplaceRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.addHook('preHandler', storedTvOnly);

    // The new image is the body, as for POST …/art. It answers the piece now standing in for the old one.
    app.post(
        '/tvs/:tvId/art/:contentId/replace',
        {
            bodyLimit: MAX_IMAGE_BYTES,
            config: { body: Object.keys(IMAGE_TYPES) },
            schema: {
                params: TvIdParams.extend({ contentId: ContentId }),
                response: { 200: z.object({ contentId: z.string(), duplicate: z.boolean() }) },
            },
        },
        async request =>
            request.container.get(ArtReplacer).replace(request.params.tvId, request.params.contentId, request.body as Buffer, fileTypeOf(request)),
    );
};
