import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlbumRepository } from '../../../src/modules/albums/album.repository.js';
import { createTestServer } from '../../test.server.js';

describe('AlbumRepository', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;
    let albums: AlbumRepository;
    let tvId: string;
    let otherTvId: string;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
        albums = server.container.get(AlbumRepository);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('tvs').execute();
        tvId = (await server.addTv({ host: '192.0.2.1' })).id;
        otherTvId = (await server.addTv({ host: '192.0.2.2', name: 'Bedroom' })).id;
    });

    afterAll(async () => {
        await server.close();
    });

    it('creates an empty album', async () => {
        const album = await albums.create(tvId, 'Halloween');

        expect(album).toMatchObject({ tvId, name: 'Halloween', pieceCount: 0, id: expect.any(String) });
        expect(album.coverContentId).toBeUndefined();
        expect(album.previewContentIds).toEqual([]);
        expect(album.createdAt.isValid).toBe(true);
    });

    it('lists a TV’s albums by name, ignoring case, and not another TV’s', async () => {
        await albums.create(tvId, 'halloween');
        await albums.create(tvId, 'Christmas');
        await albums.create(otherTvId, 'Bedroom only');

        expect((await albums.list(tvId)).map(a => a.name)).toEqual(['Christmas', 'halloween']);
    });

    it('refuses a name the TV already uses, in any case, but allows it on another TV', async () => {
        await albums.create(tvId, 'Halloween');

        await expect(albums.create(tvId, 'HALLOWEEN')).rejects.toMatchObject({ statusCode: 409 });
        await expect(albums.create(otherTvId, 'Halloween')).resolves.toMatchObject({ name: 'Halloween' });
    });

    it('answers 404 for an album read through the wrong TV', async () => {
        const album = await albums.create(tvId, 'Halloween');

        await expect(albums.get(otherTvId, album.id)).rejects.toMatchObject({ statusCode: 404 });
        await expect(albums.rename(otherTvId, album.id, 'Mine')).rejects.toMatchObject({ statusCode: 404 });
        await expect(albums.delete(otherTvId, album.id)).resolves.toBe(false);
        await expect(albums.addPieces(otherTvId, album.id, ['MY-F0001'])).rejects.toMatchObject({ statusCode: 404 });
    });

    it('renames, refusing a name already taken', async () => {
        const album = await albums.create(tvId, 'Halloween');
        await albums.create(tvId, 'Christmas');

        await expect(albums.rename(tvId, album.id, 'Spooky')).resolves.toMatchObject({ name: 'Spooky' });
        await expect(albums.rename(tvId, album.id, 'christmas')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('adds pieces in order, normalized, once each, and keeps an existing piece’s place', async () => {
        const album = await albums.create(tvId, 'Halloween');

        await albums.addPieces(tvId, album.id, ['MY_F0002', 'MY-F0001', 'MY-F0002']);
        await albums.addPieces(tvId, album.id, ['SAM-S0003', 'MY-F0002']);

        expect(await albums.pieces(tvId, album.id)).toEqual(['MY-F0002', 'MY-F0001', 'SAM-S0003']);
        expect(await albums.get(tvId, album.id)).toMatchObject({ pieceCount: 3, coverContentId: 'MY-F0002' });
    });

    it('previews up to four of the album’s pieces', async () => {
        const album = await albums.create(tvId, 'Halloween');
        const ids = ['MY-F0001', 'MY-F0002', 'MY-F0003', 'MY-F0004', 'MY-F0005', 'MY-F0006'];

        await albums.addPieces(tvId, album.id, ids.slice(0, 2));
        expect((await albums.get(tvId, album.id)).previewContentIds.sort()).toEqual(ids.slice(0, 2));

        await albums.addPieces(tvId, album.id, ids.slice(2));
        const { previewContentIds } = await albums.get(tvId, album.id);
        expect(previewContentIds).toHaveLength(4);
        expect(new Set(previewContentIds).size).toBe(4);
        expect(ids).toEqual(expect.arrayContaining(previewContentIds));
    });

    it('lets a piece be in more than one album', async () => {
        const halloween = await albums.create(tvId, 'Halloween');
        const favourites = await albums.create(tvId, 'Favourites');

        await albums.addPieces(tvId, halloween.id, ['MY-F0001']);
        await albums.addPieces(tvId, favourites.id, ['MY-F0001']);

        expect(await albums.pieces(tvId, halloween.id)).toEqual(['MY-F0001']);
        expect(await albums.pieces(tvId, favourites.id)).toEqual(['MY-F0001']);
    });

    it('removes a piece, by either spelling of its id', async () => {
        const album = await albums.create(tvId, 'Halloween');
        await albums.addPieces(tvId, album.id, ['MY-F0001', 'MY-F0002']);

        await expect(albums.removePiece(tvId, album.id, 'MY_F0001')).resolves.toBe(true);
        await expect(albums.removePiece(tvId, album.id, 'MY-F0001')).resolves.toBe(false);
        expect(await albums.pieces(tvId, album.id)).toEqual(['MY-F0002']);
    });

    it('deletes an album with its pieces, and goes when its TV does', async () => {
        const album = await albums.create(tvId, 'Halloween');
        await albums.addPieces(tvId, album.id, ['MY-F0001']);
        await albums.create(otherTvId, 'Bedroom only');

        await expect(albums.delete(tvId, album.id)).resolves.toBe(true);
        expect(await server.db.selectFrom('albumPieces').selectAll().execute()).toEqual([]);

        await server.db.deleteFrom('tvs').where('id', '=', otherTvId).execute();
        expect(await server.db.selectFrom('albums').selectAll().execute()).toEqual([]);
    });

    it('replaces a piece in every album of the TV, in place, dropping it where the album already has the new one', async () => {
        const halloween = await albums.create(tvId, 'Halloween');
        const favourites = await albums.create(tvId, 'Favourites');
        const theirs = await albums.create(otherTvId, 'Theirs');
        await albums.addPieces(tvId, halloween.id, ['MY-F0001', 'MY-F0002']);
        await albums.addPieces(tvId, favourites.id, ['MY-F0003', 'MY-F0001']);
        await albums.addPieces(otherTvId, theirs.id, ['MY-F0001']);

        await albums.replacePiece(tvId, 'MY_F0001', 'MY-F0003');

        expect(await albums.pieces(tvId, halloween.id)).toEqual(['MY-F0003', 'MY-F0002']);
        expect(await albums.pieces(tvId, favourites.id)).toEqual(['MY-F0003']);
        expect(await albums.pieces(otherTvId, theirs.id)).toEqual(['MY-F0001']);
    });
});
