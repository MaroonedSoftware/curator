import { FrameConnectionError, FrameUnauthorizedError } from '@curator/frame';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestServer } from '../test.server.js';

describe('POST /tvs', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('tvs').execute();
        server.tvs.clear();
        server.built.length = 0;
        server.prepareTvs(() => {});
    });

    afterAll(async () => {
        await server.close();
    });

    it('checks the TV is a Frame, pairs with it, and stores it with the token it issued', async () => {
        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: '192.168.1.50' } });

        expect(response.statusCode).toBe(201);
        const tv = response.json();
        expect(tv).toMatchObject({ name: 'Living Room', host: '192.168.1.50', port: 8002, model: 'QE55LS03B', paired: true });
        expect(server.built[0]?.calls.map(call => call.method)).toEqual(['deviceInfo', 'apiVersion']);
        expect(server.built[0]?.closed).toBe(true);
        const row = await server.db.selectFrom('tvs').selectAll().where('id', '=', tv.id).executeTakeFirstOrThrow();
        expect(row.token).toBe('issued-token');
    });

    it('takes a name and a port', async () => {
        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: 'frame.local', port: 8001, name: 'Hallway' } });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toMatchObject({ name: 'Hallway', host: 'frame.local', port: 8001 });
    });

    it('reaches the stored TV afterwards through a client of its own', async () => {
        const tv = (await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: '192.168.1.50' } })).json();

        const response = await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}/art-mode` });

        expect(response.statusCode).toBe(200);
        expect(server.built).toHaveLength(2);
        expect(server.built[1]?.closed).toBe(false);
    });

    it('stores a TV that issued no token as unpaired', async () => {
        server.prepareTvs(client => {
            client.issuedToken = undefined;
        });

        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: '192.168.1.50' } });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toMatchObject({ paired: false });
    });

    it('answers 409, naming the TV, for an address already added', async () => {
        const existing = await server.addTv({ name: 'Living Room', host: '192.168.1.50' });

        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: '192.168.1.50' } });

        expect(response.statusCode).toBe(409);
        expect(response.json().details).toMatchObject({ tvId: existing.id });
        expect(server.built).toEqual([]);
    });

    it('answers 422 for a Samsung TV that is not a Frame, storing nothing', async () => {
        server.prepareTvs(client => {
            client.device = { ...client.device, name: 'Kitchen', frameTvSupport: false };
        });

        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: '192.168.1.70' } });

        expect(response.statusCode).toBe(422);
        expect(response.json().details.reason).toBe('Kitchen is a Samsung TV, but not a Frame');
        expect(await server.db.selectFrom('tvs').selectAll().execute()).toEqual([]);
        expect(server.built[0]?.closed).toBe(true);
    });

    it('answers 503 for an address nothing answers on', async () => {
        server.prepareTvs(client => {
            client.failOn.set('deviceInfo', new FrameConnectionError('cannot reach TV at https://192.168.1.99:8002/api/v2/'));
        });

        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: '192.168.1.99' } });

        expect(response.statusCode).toBe(503);
        expect(await server.db.selectFrom('tvs').selectAll().execute()).toEqual([]);
    });

    it('answers 502 when nobody accepts the pairing prompt, storing nothing', async () => {
        server.prepareTvs(client => {
            client.failOn.set('apiVersion', new FrameUnauthorizedError('pairing was not accepted'));
        });

        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload: { host: '192.168.1.50' } });

        expect(response.statusCode).toBe(502);
        expect(response.json().details.reason).toMatch(/Accept the pairing prompt on the TV/);
        expect(await server.db.selectFrom('tvs').selectAll().execute()).toEqual([]);
        expect(server.built[0]?.closed).toBe(true);
    });

    it.each([
        ['a URL', { host: 'http://192.168.1.50' }],
        ['an empty host', { host: '' }],
        ['a port out of range', { host: '192.168.1.50', port: 70000 }],
        ['a blank name', { host: '192.168.1.50', name: '  ' }],
    ])('refuses %s', async (_name, payload) => {
        const response = await server.app.inject({ method: 'POST', url: '/tvs', payload });

        expect(response.statusCode).toBe(400);
        expect(server.built).toEqual([]);
    });
});
