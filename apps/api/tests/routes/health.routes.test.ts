import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestServer } from '../test.server.js';

describe('health', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
    });

    afterAll(async () => {
        await server.close();
    });

    it('GET /health answers ok with the process uptime', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/health' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ status: 'ok', uptimeMs: expect.any(Number) });
    });

    it('answers 404 for an unknown route', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/nope' });

        expect(response.statusCode).toBe(404);
    });
});

describe('health under a route prefix', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url, { server: { port: 0, routePrefix: '/api' } });
    });

    afterAll(async () => {
        await server.close();
    });

    it('mounts the routes under the prefix', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/api/health' });

        expect(response.statusCode).toBe(200);
    });

    it('no longer answers at the root', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/health' });

        expect(response.statusCode).toBe(404);
    });
});
