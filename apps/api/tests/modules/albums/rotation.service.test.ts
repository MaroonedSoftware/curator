import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlbumRepository } from '../../../src/modules/albums/album.repository.js';
import { RotationRepository } from '../../../src/modules/albums/rotation.repository.js';
import { nextPiece, RotationService } from '../../../src/modules/albums/rotation.service.js';
import { TvService } from '../../../src/modules/tvs/tv.service.js';
import { createTvTestServer } from '../../test.server.js';

describe('nextPiece', () => {
    const ordered = (last?: string) => nextPiece(['A', 'B', 'C'], { last, shownThisRound: [] }, false)?.contentId;

    it('walks the album in order, wrapping, and starts at the top', () => {
        expect(ordered()).toBe('A');
        expect(ordered('A')).toBe('B');
        expect(ordered('C')).toBe('A');
        expect(ordered('gone')).toBe('A');
    });

    it('keeps no round in order', () => {
        expect(nextPiece(['A', 'B'], { last: 'A', shownThisRound: ['A'] }, false)).toEqual({ contentId: 'B', shownThisRound: [] });
    });

    it('shuffles among the pieces not yet shown this round', () => {
        expect(nextPiece(['A', 'B', 'C'], { shownThisRound: [] }, true, () => 0.99)).toEqual({ contentId: 'C', shownThisRound: ['C'] });
        expect(nextPiece(['A', 'B', 'C'], { last: 'C', shownThisRound: ['C'] }, true, () => 0)).toEqual({
            contentId: 'A',
            shownThisRound: ['C', 'A'],
        });
        expect(nextPiece(['A', 'B', 'C'], { last: 'A', shownThisRound: ['C', 'A'] }, true, () => 0.99)).toEqual({
            contentId: 'B',
            shownThisRound: ['C', 'A', 'B'],
        });
    });

    it('shows every piece once per round, whatever the random numbers', () => {
        let progress = { last: undefined as string | undefined, shownThisRound: [] as string[] };
        const shown: string[] = [];
        for (let i = 0; i < 8; i++) {
            const next = nextPiece(['A', 'B', 'C', 'D'], progress, true, () => 0)!;
            shown.push(next.contentId);
            progress = { last: next.contentId, shownThisRound: next.shownThisRound };
        }
        expect(shown.slice(0, 4).sort()).toEqual(['A', 'B', 'C', 'D']);
        expect(shown.slice(4).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('opens a new round with anything but the piece that closed the last, unless it is the only one', () => {
        expect(nextPiece(['A', 'B', 'C'], { last: 'A', shownThisRound: ['B', 'C', 'A'] }, true, () => 0)).toEqual({
            contentId: 'B',
            shownThisRound: ['B'],
        });
        expect(nextPiece(['A'], { last: 'A', shownThisRound: ['A'] }, true, () => 0.5)).toEqual({ contentId: 'A', shownThisRound: ['A'] });
    });

    it('lets pieces added mid-round join it, and drops pieces since removed', () => {
        expect(nextPiece(['A', 'B', 'D'], { last: 'C', shownThisRound: ['A', 'C'] }, true, () => 0.99)).toEqual({
            contentId: 'D',
            shownThisRound: ['A', 'D'],
        });
    });

    it('has nothing for an empty album', () => {
        expect(nextPiece([], { shownThisRound: [] }, true)).toBeUndefined();
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
        server.tv.extraListEntries.length = 0;
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

    it('selects a piece listed under MY-C0008 as well from My Photos, the only category the TV selects it from', async () => {
        // As a 2025 Frame lists an upload: MY-C0008 first, then My Photos.
        server.tv.art.set('MY_F0003', { contentId: 'MY_F0003', categoryId: 'MY-C0008', raw: {} });
        server.tv.extraListEntries.push({ contentId: 'MY_F0003', categoryId: 'MY-C0002', raw: {} });
        await albums.addPieces(server.tvId, albumId, ['MY-F0003']);
        await rotations.set(server.tvId, { albumId });

        expect(await service.advance(server.tvId)).toBe('MY_F0003');

        expect(selects()).toEqual([['MY_F0003', { show: true, category: 'MY-C0002' }]]);
        server.tv.art.delete('MY_F0003');
    });

    it('shuffles without showing the same piece twice running', async () => {
        await albums.addPieces(server.tvId, albumId, ['MY-F0001', 'MY-F0002']);
        await rotations.set(server.tvId, { albumId });

        expect(await service.advance(server.tvId)).toBe('MY-F0001');
        expect(await service.advance(server.tvId)).toBe('MY_F0002');
        expect(await service.advance(server.tvId)).toBe('MY-F0001');
    });

    it('records the pieces shown this round, and starts a new round once every piece has come up', async () => {
        await albums.addPieces(server.tvId, albumId, ['MY-F0001', 'MY-F0002']);
        await rotations.set(server.tvId, { albumId });

        await service.advance(server.tvId);
        expect(await rotations.get(server.tvId)).toMatchObject({ shownThisRound: ['MY-F0001'] });
        await service.advance(server.tvId);
        expect(await rotations.get(server.tvId)).toMatchObject({ shownThisRound: ['MY-F0001', 'MY-F0002'] });
        await service.advance(server.tvId);
        expect(await rotations.get(server.tvId)).toMatchObject({ lastContentId: 'MY-F0001', shownThisRound: ['MY-F0001'] });
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
