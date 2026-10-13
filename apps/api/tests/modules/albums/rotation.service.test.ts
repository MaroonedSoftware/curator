import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlbumRepository } from '../../../src/modules/albums/album.repository.js';
import { RotationRepository } from '../../../src/modules/albums/rotation.repository.js';
import { nextPiece, RotationService } from '../../../src/modules/albums/rotation.service.js';
import { TvService } from '../../../src/modules/tvs/tv.service.js';
import { createTvTestServer } from '../../test.server.js';

describe('nextPiece', () => {
    it('walks the album in order, wrapping, and starts at the top', () => {
        expect(nextPiece(['A', 'B', 'C'], undefined, false)).toBe('A');
        expect(nextPiece(['A', 'B', 'C'], 'A', false)).toBe('B');
        expect(nextPiece(['A', 'B', 'C'], 'C', false)).toBe('A');
        expect(nextPiece(['A', 'B', 'C'], 'gone', false)).toBe('A');
    });

    it('shuffles without repeating the last piece, unless it is the only one', () => {
        expect(nextPiece(['A', 'B', 'C'], 'A', true, () => 0)).toBe('B');
        expect(nextPiece(['A', 'B', 'C'], 'A', true, () => 0.99)).toBe('C');
        expect(nextPiece(['A'], 'A', true, () => 0.5)).toBe('A');
    });

    it('has nothing for an empty album', () => {
        expect(nextPiece([], undefined, true)).toBeUndefined();
    });
});

describe('RotationService', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;
    let albums: AlbumRepository;
    let rotations: RotationRepository;
    let service: RotationService;
    let albumId: string;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
        albums = server.container.get(AlbumRepository);
        rotations = server.container.get(RotationRepository);
        // Always the first candidate, so a shuffle is predictable.
        service = new RotationService(rotations, albums, server.container.get(TvService), () => 0);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('albums').execute();
        server.tv.calls.length = 0;
        server.tv.artMode = true;
        server.tv.art.set('MY_F0002', { contentId: 'MY_F0002', categoryId: 'MY-C0002', raw: {} });
        albumId = (await albums.create(server.tvId, 'Halloween')).id;
    });

    afterAll(async () => {
        await server.close();
    });

    const selects = () => server.tv.calls.filter(call => call.method === 'select').map(call => call.args);

    it('shows the album’s pieces in order on a TV in art mode, by the TV’s own spelling, and records each', async () => {
        await albums.addPieces(server.tvId, albumId, ['MY-F0001', 'MY-F0002']);
        await rotations.set(server.tvId, { albumId, shuffle: false });

        expect(await service.advance(server.tvId)).toBe('MY-F0001');
        expect(await service.advance(server.tvId)).toBe('MY_F0002');
        expect(await service.advance(server.tvId)).toBe('MY-F0001');

        expect(selects()).toEqual([
            ['MY-F0001', { show: true, category: 'MY-C0002' }],
            ['MY_F0002', { show: true, category: 'MY-C0002' }],
            ['MY-F0001', { show: true, category: 'MY-C0002' }],
        ]);
        expect(await rotations.get(server.tvId)).toMatchObject({ lastContentId: 'MY-F0001', lastRotatedAt: expect.anything() });
    });

    it('only selects the next piece on a TV out of art mode, so it isn’t switched into art mode', async () => {
        await albums.addPieces(server.tvId, albumId, ['MY-F0001']);
        await rotations.set(server.tvId, { albumId });
        server.tv.artMode = false;

        expect(await service.advance(server.tvId)).toBe('MY-F0001');

        expect(selects()).toEqual([['MY-F0001', { show: false, category: 'MY-C0002' }]]);
        expect(server.tv.artMode).toBe(false);
    });

    it('shuffles without showing the same piece twice running', async () => {
        await albums.addPieces(server.tvId, albumId, ['MY-F0001', 'MY-F0002']);
        await rotations.set(server.tvId, { albumId });

        expect(await service.advance(server.tvId)).toBe('MY-F0001');
        expect(await service.advance(server.tvId)).toBe('MY_F0002');
        expect(await service.advance(server.tvId)).toBe('MY-F0001');
    });

    it('skips pieces no longer on the TV', async () => {
        await albums.addPieces(server.tvId, albumId, ['MY-F0099', 'SAM-S0001']);
        await rotations.set(server.tvId, { albumId, shuffle: false });

        expect(await service.advance(server.tvId)).toBe('SAM-S0001');
    });

    it('answers 409 when nothing in the album is on the TV, and 404 when the TV isn’t rotating', async () => {
        await expect(service.advance(server.tvId)).rejects.toMatchObject({ statusCode: 404 });

        await albums.addPieces(server.tvId, albumId, ['MY-F0099']);
        await rotations.set(server.tvId, { albumId });

        await expect(service.advance(server.tvId)).rejects.toMatchObject({ statusCode: 409 });
        expect(selects()).toEqual([]);
    });
});
