import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlbumRepository } from '../../src/modules/albums/album.repository.js';
import { RotationRepository } from '../../src/modules/albums/rotation.repository.js';
import { createTvTestServer } from '../test.server.js';

describe('rotation', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;
    let halloween: string;
    let christmas: string;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('albums').execute();
        const albums = server.container.get(AlbumRepository);
        halloween = (await albums.create(server.tvId, 'Halloween')).id;
        christmas = (await albums.create(server.tvId, 'Christmas')).id;
    });

    afterAll(async () => {
        await server.close();
    });

    const inject = (method: 'GET' | 'PUT' | 'DELETE', payload?: object) => server.app.inject({ method, url: `${server.base}/rotation`, payload });

    it('GET /rotation answers 204 when the TV isn’t rotating', async () => {
        expect((await inject('GET')).statusCode).toBe(204);
    });

    it('PUT /rotation starts a rotation with the defaults, due at once', async () => {
        const response = await inject('PUT', { albumId: halloween });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ albumId: halloween, albumName: 'Halloween', intervalMinutes: 30, shuffle: true });
        expect((await inject('GET')).json()).toEqual(response.json());
    });

    it('PUT /rotation changes the interval and order, keeping what it leaves out', async () => {
        await inject('PUT', { albumId: halloween, intervalMinutes: 5 });

        expect((await inject('PUT', { albumId: halloween, shuffle: false })).json()).toMatchObject({ intervalMinutes: 5, shuffle: false });
    });

    it('keeps its progress for the same album and starts afresh for another', async () => {
        await inject('PUT', { albumId: halloween, intervalMinutes: 10 });
        await server.container.get(RotationRepository).recordRotation(server.tvId, 'MY-F0001');

        const same = (await inject('PUT', { albumId: halloween, intervalMinutes: 15 })).json();
        expect(same).toMatchObject({ lastContentId: 'MY-F0001', lastRotatedAt: expect.any(String), nextRotationAt: expect.any(String) });
        expect(Date.parse(same.nextRotationAt) - Date.parse(same.lastRotatedAt)).toBe(15 * 60_000);

        const other = (await inject('PUT', { albumId: christmas })).json();
        expect(other).toEqual({ albumId: christmas, albumName: 'Christmas', intervalMinutes: 15, shuffle: true });
    });

    it('PUT /rotation refuses another TV’s album with 422 and a bad interval with 400', async () => {
        const other = await server.addTv({ name: 'Bedroom' });
        const theirs = (await server.container.get(AlbumRepository).create(other.id, 'Theirs')).id;

        expect((await inject('PUT', { albumId: theirs })).statusCode).toBe(422);
        expect((await inject('PUT', { albumId: halloween, intervalMinutes: 0 })).statusCode).toBe(400);
        expect((await inject('PUT', { albumId: halloween, intervalMinutes: 1441 })).statusCode).toBe(400);
    });

    it('DELETE /rotation stops it, 404 when there was none', async () => {
        await inject('PUT', { albumId: halloween });

        expect((await inject('DELETE')).statusCode).toBe(204);
        expect((await inject('DELETE')).statusCode).toBe(404);
        expect((await inject('GET')).statusCode).toBe(204);
    });

    it('stops when its album is deleted', async () => {
        await inject('PUT', { albumId: halloween });

        await server.app.inject({ method: 'DELETE', url: `${server.base}/albums/${halloween}` });

        expect((await inject('GET')).statusCode).toBe(204);
    });

    it('POST /rotation/advance shows the next piece now', async () => {
        await server.container.get(AlbumRepository).addPieces(server.tvId, halloween, ['MY-F0001']);
        await inject('PUT', { albumId: halloween });

        const response = await server.app.inject({ method: 'POST', url: `${server.base}/rotation/advance` });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ contentId: 'MY-F0001' });
        expect(server.tv.current_).toBe('MY-F0001');
        expect((await inject('GET')).json()).toMatchObject({ lastContentId: 'MY-F0001', nextRotationAt: expect.any(String) });
    });

    it('POST /rotation/advance answers 404 when not rotating and 409 when nothing in the album is on the TV', async () => {
        expect((await server.app.inject({ method: 'POST', url: `${server.base}/rotation/advance` })).statusCode).toBe(404);

        await inject('PUT', { albumId: christmas });

        expect((await server.app.inject({ method: 'POST', url: `${server.base}/rotation/advance` })).statusCode).toBe(409);
    });

    it('answers 404 for an unknown TV', async () => {
        expect((await server.app.inject({ method: 'GET', url: '/tvs/6f1c2b9e-0000-4000-8000-000000000000/rotation' })).statusCode).toBe(404);
    });
});
