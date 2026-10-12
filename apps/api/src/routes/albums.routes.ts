import { httpError } from '@maroonedsoftware/errors';
import type { ZodTypeProvider } from '@maroonedsoftware/fastify/zod';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AlbumRepository, type AlbumRow } from '../modules/albums/album.repository.js';
import { TvRepository } from '../modules/tvs/tv.repository.js';
import { ContentId } from './frame.routes.js';
import { TvIdParams } from './tvs.routes.js';

/** An album, as the API shows it. */
export const Album = z.object({
    id: z.uuid(),
    name: z.string(),
    pieceCount: z.number().int(),
    /** The album's first piece, to show as its cover. Absent for an empty album. */
    coverContentId: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type Album = z.infer<typeof Album>;

export const toAlbum = (row: AlbumRow): Album => ({
    id: row.id,
    name: row.name,
    pieceCount: row.pieceCount,
    coverContentId: row.coverContentId,
    createdAt: row.createdAt.toISO() ?? '',
    updatedAt: row.updatedAt.toISO() ?? '',
});

/** An album with its pieces, in album order. */
const AlbumDetail = Album.extend({ contentIds: z.array(z.string()) });

/** An album's name: trimmed, not blank, short enough to fit a card. */
const AlbumName = z.string().trim().min(1).max(60);

const AlbumParams = TvIdParams.extend({ albumId: z.uuid() });

const AlbumPieceParams = AlbumParams.extend({ contentId: ContentId });

const json = { body: ['application/json'] };

/** Each TV's albums, under `/tvs/:tvId/albums`. An unknown TV answers 404 before anything else. */
export const AlbumsRoutes: FastifyPluginAsync = async instance => {
    const app = instance.withTypeProvider<ZodTypeProvider>();

    // Params are parsed by now, so a malformed id has already been refused with a 400.
    app.addHook('preHandler', async request => {
        await request.container.get(TvRepository).get((request.params as z.infer<typeof TvIdParams>).tvId);
    });

    app.get('/tvs/:tvId/albums', { schema: { params: TvIdParams, response: { 200: z.object({ items: z.array(Album) }) } } }, async request => ({
        items: (await request.container.get(AlbumRepository).list(request.params.tvId)).map(toAlbum),
    }));

    app.post(
        '/tvs/:tvId/albums',
        { config: json, schema: { params: TvIdParams, body: z.object({ name: AlbumName }), response: { 201: Album } } },
        async (request, reply) =>
            reply.status(201).send(toAlbum(await request.container.get(AlbumRepository).create(request.params.tvId, request.body.name))),
    );

    app.get('/tvs/:tvId/albums/:albumId', { schema: { params: AlbumParams, response: { 200: AlbumDetail } } }, async request => {
        const albums = request.container.get(AlbumRepository);
        const { tvId, albumId } = request.params;
        const album = await albums.get(tvId, albumId);
        return { ...toAlbum(album), contentIds: await albums.pieces(tvId, albumId) };
    });

    app.patch(
        '/tvs/:tvId/albums/:albumId',
        { config: json, schema: { params: AlbumParams, body: z.object({ name: AlbumName }), response: { 200: Album } } },
        async request => toAlbum(await request.container.get(AlbumRepository).rename(request.params.tvId, request.params.albumId, request.body.name)),
    );

    app.delete('/tvs/:tvId/albums/:albumId', { schema: { params: AlbumParams } }, async (request, reply) => {
        if (!(await request.container.get(AlbumRepository).delete(request.params.tvId, request.params.albumId))) {
            throw httpError(404).withDetails({ reason: `no album with id ${request.params.albumId}` });
        }
        return reply.status(204).send();
    });

    // Adds to the end of the album. Pieces already in it keep their place, so repeating a call is harmless.
    app.put(
        '/tvs/:tvId/albums/:albumId/pieces',
        { config: json, schema: { params: AlbumParams, body: z.object({ contentIds: z.array(ContentId).min(1).max(500) }) } },
        async (request, reply) => {
            await request.container.get(AlbumRepository).addPieces(request.params.tvId, request.params.albumId, request.body.contentIds);
            return reply.status(204).send();
        },
    );

    app.delete('/tvs/:tvId/albums/:albumId/pieces/:contentId', { schema: { params: AlbumPieceParams } }, async (request, reply) => {
        const { tvId, albumId, contentId } = request.params;
        if (!(await request.container.get(AlbumRepository).removePiece(tvId, albumId, contentId))) {
            throw httpError(404).withDetails({ reason: `${contentId} is not in the album` });
        }
        return reply.status(204).send();
    });
};
