import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTvTestServer } from '../test.server.js';

describe('albums', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('albums').execute();
    });

    afterAll(async () => {
        await server.close();
    });

    const inject = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, payload?: object) =>
        server.app.inject({ method, url: `${server.base}${path}`, payload });

    const createAlbum = async (name: string): Promise<string> => (await inject('POST', '/albums', { name })).json().id;

    it('POST /albums creates an album, trimming its name', async () => {
        const response = await inject('POST', '/albums', { name: '  Halloween ' });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            id: expect.any(String),
            name: 'Halloween',
            pieceCount: 0,
            previewContentIds: [],
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
        });
    });

    it('POST /albums refuses a blank name with 400 and a taken one with 409', async () => {
        await createAlbum('Halloween');

        expect((await inject('POST', '/albums', { name: '   ' })).statusCode).toBe(400);
        expect((await inject('POST', '/albums', { name: 'halloween' })).statusCode).toBe(409);
    });

    it('GET /albums lists the TV’s albums by name', async () => {
        await createAlbum('Halloween');
        await createAlbum('Christmas');

        const response = await inject('GET', '/albums');

        expect(response.statusCode).toBe(200);
        expect(response.json().items.map((a: { name: string }) => a.name)).toEqual(['Christmas', 'Halloween']);
    });

    it('PUT /albums/:albumId/pieces adds pieces and GET /albums/:albumId lists them in order', async () => {
        const id = await createAlbum('Halloween');

        expect((await inject('PUT', `/albums/${id}/pieces`, { contentIds: ['MY_F0002', 'SAM-S0001'] })).statusCode).toBe(204);
        expect((await inject('PUT', `/albums/${id}/pieces`, { contentIds: ['MY-F0002', 'MY-F0003'] })).statusCode).toBe(204);

        expect((await inject('GET', `/albums/${id}`)).json()).toMatchObject({
            id,
            name: 'Halloween',
            pieceCount: 3,
            coverContentId: 'MY-F0002',
            contentIds: ['MY-F0002', 'SAM-S0001', 'MY-F0003'],
        });
    });

    it('PUT /albums/:albumId/pieces refuses an empty list or a malformed id', async () => {
        const id = await createAlbum('Halloween');

        expect((await inject('PUT', `/albums/${id}/pieces`, { contentIds: [] })).statusCode).toBe(400);
        expect((await inject('PUT', `/albums/${id}/pieces`, { contentIds: ['../etc'] })).statusCode).toBe(400);
    });

    it('DELETE /albums/:albumId/pieces/:contentId removes a piece, 404 when it was not there', async () => {
        const id = await createAlbum('Halloween');
        await inject('PUT', `/albums/${id}/pieces`, { contentIds: ['MY-F0001', 'MY-F0002'] });

        expect((await inject('DELETE', `/albums/${id}/pieces/MY-F0001`)).statusCode).toBe(204);
        expect((await inject('DELETE', `/albums/${id}/pieces/MY-F0001`)).statusCode).toBe(404);
        expect((await inject('GET', `/albums/${id}`)).json().contentIds).toEqual(['MY-F0002']);
    });

    it('PATCH /albums/:albumId renames, 409 for a taken name', async () => {
        const id = await createAlbum('Halloween');
        await createAlbum('Christmas');

        expect((await inject('PATCH', `/albums/${id}`, { name: 'Spooky' })).json()).toMatchObject({ id, name: 'Spooky' });
        expect((await inject('PATCH', `/albums/${id}`, { name: 'Christmas' })).statusCode).toBe(409);
    });

    it('DELETE /albums/:albumId deletes, 404 the second time', async () => {
        const id = await createAlbum('Halloween');

        expect((await inject('DELETE', `/albums/${id}`)).statusCode).toBe(204);
        expect((await inject('DELETE', `/albums/${id}`)).statusCode).toBe(404);
        expect((await inject('GET', `/albums/${id}`)).statusCode).toBe(404);
    });

    it('answers 404 for an album of another TV, and for an unknown TV', async () => {
        const id = await createAlbum('Halloween');
        const other = await server.addTv({ name: 'Bedroom' });

        expect((await server.app.inject({ method: 'GET', url: `/tvs/${other.id}/albums/${id}` })).statusCode).toBe(404);
        expect((await server.app.inject({ method: 'GET', url: `/tvs/${other.id}/albums` })).json()).toEqual({ items: [] });
        expect((await server.app.inject({ method: 'GET', url: '/tvs/6f1c2b9e-0000-4000-8000-000000000000/albums' })).statusCode).toBe(404);
        expect(
            (await server.app.inject({ method: 'POST', url: '/tvs/6f1c2b9e-0000-4000-8000-000000000000/albums', payload: { name: 'X' } })).statusCode,
        ).toBe(404);
    });

    it('answers 400 for a malformed album id', async () => {
        expect((await inject('GET', '/albums/not-a-uuid')).statusCode).toBe(400);
    });
});
