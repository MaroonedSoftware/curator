import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestServer } from '../test.server.js';

const INDEX = '<!doctype html><title>curator</title>';
const SCRIPT = 'console.log("curator");';

describe('web app', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;
    let root: string;

    beforeAll(async () => {
        root = await mkdtemp(join(tmpdir(), 'curator-web-'));
        // Under a folder named `assets`, so only the path inside the build may decide what is immutable.
        const dir = join(root, 'assets', 'dist');
        await mkdir(join(dir, 'assets'), { recursive: true });
        await writeFile(join(dir, 'index.html'), INDEX);
        await writeFile(join(dir, 'assets', 'index-abc123.js'), SCRIPT);
        server = await createTestServer(import.meta.url, { server: { port: 0, routePrefix: '/api' }, web: { dir } });
    });

    afterAll(async () => {
        await server.close();
        await rm(root, { recursive: true, force: true });
    });

    it('serves index.html at the root, never cached', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/' });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe(INDEX);
        expect(response.headers['cache-control']).toBe('no-cache');
    });

    it('serves a hashed asset, cached for good', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/assets/index-abc123.js' });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe(SCRIPT);
        expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    });

    it('answers a deep link with index.html, for the client router', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tvs/3?tab=art' });

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe(INDEX);
        expect(response.headers['cache-control']).toBe('no-cache');
    });

    it('still serves the API under its prefix', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/api/health' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ status: 'ok' });
    });

    it('answers an unknown API path with the JSON 404, not the app', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/api/nope' });

        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toMatch(/json/);
    });

    it('answers a missing file with 404, not the app', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/assets/missing.js' });

        expect(response.statusCode).toBe(404);
    });
});
