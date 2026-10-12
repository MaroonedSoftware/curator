import { FrameConnectionError } from '@curator/frame';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestServer } from '../test.server.js';

describe('tvs', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('tvs').execute();
        server.tvs.clear();
    });

    afterAll(async () => {
        await server.close();
    });

    it('GET /tvs lists stored TVs, oldest first, without their tokens', async () => {
        const living = await server.addTv({ name: 'Living Room', host: '192.168.1.50', model: 'QE55LS03B' });
        const bedroom = await server.addTv({ name: 'Bedroom', host: '192.168.1.60', token: undefined });

        const response = await server.app.inject({ method: 'GET', url: '/tvs' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            items: [
                {
                    id: living.id,
                    name: 'Living Room',
                    host: '192.168.1.50',
                    port: 8002,
                    model: 'QE55LS03B',
                    paired: true,
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                },
                {
                    id: bedroom.id,
                    name: 'Bedroom',
                    host: '192.168.1.60',
                    port: 8002,
                    paired: false,
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                },
            ],
        });
        expect(response.body).not.toContain('paired-token');
    });

    it('GET /tvs/:tvId answers one TV, 404 for an unknown id and 400 for a malformed one', async () => {
        const tv = await server.addTv();

        expect((await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}` })).json()).toMatchObject({ id: tv.id, name: 'Living Room' });
        expect((await server.app.inject({ method: 'GET', url: '/tvs/6f1c2b9e-0000-4000-8000-000000000000' })).statusCode).toBe(404);
        expect((await server.app.inject({ method: 'GET', url: '/tvs/not-a-uuid' })).statusCode).toBe(400);
    });

    it('PATCH /tvs/:tvId renames a TV, trimming the name', async () => {
        const tv = await server.addTv();

        const response = await server.app.inject({ method: 'PATCH', url: `/tvs/${tv.id}`, payload: { name: '  Hallway  ' } });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ id: tv.id, name: 'Hallway' });
        expect(new Date(response.json().updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(response.json().createdAt).getTime());
    });

    it('PATCH /tvs/:tvId refuses a blank name', async () => {
        const tv = await server.addTv();

        const response = await server.app.inject({ method: 'PATCH', url: `/tvs/${tv.id}`, payload: { name: '   ' } });

        expect(response.statusCode).toBe(400);
    });

    it('DELETE /tvs/:tvId forgets the TV and closes its connection', async () => {
        const tv = await server.addTv();
        await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}/art-mode` });
        const client = server.tvs.get(tv.id)!.client;

        const response = await server.app.inject({ method: 'DELETE', url: `/tvs/${tv.id}` });

        expect(response.statusCode).toBe(204);
        expect(client.closed).toBe(true);
        expect((await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}` })).statusCode).toBe(404);
        expect((await server.app.inject({ method: 'DELETE', url: `/tvs/${tv.id}` })).statusCode).toBe(404);
    });
});

describe('a TV’s own endpoints', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('tvs').execute();
        server.tvs.clear();
    });

    afterAll(async () => {
        await server.close();
    });

    it('reach the TV the path names, one client per TV, kept between requests', async () => {
        const living = await server.addTv({ name: 'Living Room', host: '192.168.1.50' });
        const bedroom = await server.addTv({ name: 'Bedroom', host: '192.168.1.60', port: 8001 });

        await server.app.inject({ method: 'PUT', url: `/tvs/${bedroom.id}/art-mode`, payload: { on: false } });
        const living1 = await server.app.inject({ method: 'GET', url: `/tvs/${living.id}/art-mode` });
        const bedroom1 = await server.app.inject({ method: 'GET', url: `/tvs/${bedroom.id}/art-mode` });

        expect(living1.json()).toEqual({ on: true });
        expect(bedroom1.json()).toEqual({ on: false });
        expect(server.tvs.get(bedroom.id)?.address).toEqual({ id: bedroom.id, host: '192.168.1.60', port: 8001 });
        expect(server.tvs.get(bedroom.id)?.client.calls.map(call => call.method)).toEqual(['setArtMode', 'getArtMode']);
    });

    it('cover every TV route: device, version, art, current, select, matte, delete and upload', async () => {
        const tv = await server.addTv();
        const base = `/tvs/${tv.id}`;
        const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

        const statuses = [
            (await server.app.inject({ method: 'GET', url: `${base}/device` })).statusCode,
            (await server.app.inject({ method: 'GET', url: `${base}/api-version` })).statusCode,
            (await server.app.inject({ method: 'GET', url: `${base}/art?category=MY-C0002` })).statusCode,
            (await server.app.inject({ method: 'GET', url: `${base}/art/current` })).statusCode,
            (await server.app.inject({ method: 'PUT', url: `${base}/art/current`, payload: { contentId: 'MY-F0001' } })).statusCode,
            (await server.app.inject({ method: 'PUT', url: `${base}/art/MY-F0001/matte`, payload: { matte: 'none' } })).statusCode,
            (await server.app.inject({ method: 'DELETE', url: `${base}/art/MY-F0001` })).statusCode,
            (await server.app.inject({ method: 'POST', url: `${base}/art`, headers: { 'content-type': 'image/jpeg' }, payload: jpeg })).statusCode,
        ];

        expect(statuses).toEqual([200, 200, 200, 200, 204, 204, 204, 201]);
        expect(server.tvs.get(tv.id)?.client.calls.map(call => call.method)).toEqual([
            'deviceInfo',
            'apiVersion',
            'list',
            'current',
            'select',
            'changeMatte',
            'delete',
            'upload',
        ]);
    });

    it('answer 404 for a TV that isn’t stored, before reading an upload', async () => {
        const response = await server.app.inject({
            method: 'POST',
            url: '/tvs/6f1c2b9e-0000-4000-8000-000000000000/art',
            headers: { 'content-type': 'image/jpeg' },
            payload: Buffer.from([0xff, 0xd8]),
        });

        expect(response.statusCode).toBe(404);
        expect(server.tvs.size).toBe(0);
    });

    it('answer 400 for a malformed TV id', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tvs/not-a-uuid/art-mode' });

        expect(response.statusCode).toBe(400);
    });

    it('map that TV’s failures to HTTP as before', async () => {
        const tv = await server.addTv();
        await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}/art-mode` });
        server.tvs.get(tv.id)!.client.failNext = new FrameConnectionError('cannot reach TV');

        const response = await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}/art` });

        expect(response.statusCode).toBe(503);
    });

    it('keep the token the TV issues in that TV’s row', async () => {
        const tv = await server.addTv({ token: undefined });
        await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}/art-mode` });
        const { tokenStore } = server.tvs.get(tv.id)!;

        await expect(tokenStore.load()).resolves.toBeUndefined();
        await tokenStore.save('fresh-token');

        await expect(tokenStore.load()).resolves.toBe('fresh-token');
        expect((await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}` })).json()).toMatchObject({ paired: true });
    });
});
