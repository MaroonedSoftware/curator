import { httpError } from '@maroonedsoftware/errors';
import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AlbumRepository } from '../modules/albums/album.repository.js';
import { RotationRepository, type RotationRow } from '../modules/albums/rotation.repository.js';
import { storedTvOnly } from './stored.tv.hook.js';
import { TvIdParams } from './tvs.routes.js';

/** The album a TV cycles through, as the API shows it. */
export const Rotation = z.object({
    albumId: z.uuid(),
    albumName: z.string(),
    intervalMinutes: z.number().int(),
    shuffle: z.boolean(),
    /** What the rotation last put on screen. Absent until it first rotates. */
    lastContentId: z.string().optional(),
    lastRotatedAt: z.string().optional(),
    /** When the next piece is due. Absent when it is due now: a new rotation starts at once. */
    nextRotationAt: z.string().optional(),
});

export type Rotation = z.infer<typeof Rotation>;

export const toRotation = (row: RotationRow): Rotation => ({
    albumId: row.albumId,
    albumName: row.albumName,
    intervalMinutes: row.intervalMinutes,
    shuffle: row.shuffle,
    lastContentId: row.lastContentId ?? undefined,
    lastRotatedAt: row.lastRotatedAt?.toISO() ?? undefined,
    nextRotationAt: row.lastRotatedAt?.plus({ minutes: row.intervalMinutes }).toISO() ?? undefined,
});

const RotationSetting = z.object({
    albumId: z.uuid(),
    /** A day at most. */
    intervalMinutes: z.number().int().min(1).max(1440).optional(),
    shuffle: z.boolean().optional(),
});

const json = { body: ['application/json'] };

/** Which album each TV rotates through, under `/tvs/:tvId/rotation`. An unknown TV answers 404. */
export const RotationRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    app.addHook('preHandler', storedTvOnly);

    // 204 when the TV isn't rotating.
    app.get('/tvs/:tvId/rotation', { schema: { params: TvIdParams, response: { 200: Rotation, 204: z.null() } } }, async (request, reply) => {
        const row = await request.container.get(RotationRepository).get(request.params.tvId);
        return row ? toRotation(row) : reply.status(204).send(null);
    });

    app.put(
        '/tvs/:tvId/rotation',
        { config: json, schema: { params: TvIdParams, body: RotationSetting, response: { 200: Rotation } } },
        async request => {
            const { tvId } = request.params;
            // The album is named in the body, not the path, so one the TV doesn't have is a 422 rather than a 404.
            await request.container
                .get(AlbumRepository)
                .get(tvId, request.body.albumId)
                .catch((error: unknown) => {
                    throw (error as { statusCode?: unknown }).statusCode === 404
                        ? httpError(422).withDetails({ reason: `the TV has no album with id ${request.body.albumId}` })
                        : error;
                });
            return toRotation(await request.container.get(RotationRepository).set(tvId, request.body));
        },
    );

    app.delete('/tvs/:tvId/rotation', { schema: { params: TvIdParams } }, async (request, reply) => {
        if (!(await request.container.get(RotationRepository).clear(request.params.tvId))) {
            throw httpError(404).withDetails({ reason: 'the TV is not rotating' });
        }
        return reply.status(204).send();
    });
};
