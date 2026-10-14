import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setLogStore } from '../../src/logging/log.store.js';
import { RotatingLogStore } from '../../src/logging/rotating.log.store.js';
import { createTestServer } from '../test.server.js';

describe('logs', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;
    let dir: string;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
        dir = await mkdtemp(join(tmpdir(), 'curator-logs-'));
    });

    afterEach(() => {
        setLogStore(undefined);
    });

    afterAll(async () => {
        await server.close();
        await rm(dir, { recursive: true, force: true });
    });

    it('GET /logs answers the newest lines first, from the given level up', async () => {
        const store = new RotatingLogStore({ dir, maxBytes: 1024 * 1024, maxFiles: 1, maxValueChars: 512, maxLineBytes: 8192 });
        setLogStore(store);
        store.append('debug', 'one');
        store.append('warn', 'two', { tvId: 'a' });
        store.append('info', 'three');
        await store.close();

        const all = await server.app.inject({ method: 'GET', url: '/logs?limit=2' });
        const warnings = await server.app.inject({ method: 'GET', url: '/logs?level=warn' });

        expect(all.statusCode).toBe(200);
        expect(all.json().items.map((entry: { text: string }) => entry.text)).toEqual(['three', 'two | tvId=a']);
        expect(warnings.json().items).toEqual([{ ts: expect.any(String), level: 'warn', text: 'two | tvId=a' }]);
    });

    it('answers no lines when the server keeps no log file', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/logs' });

        expect(response.json()).toEqual({ items: [] });
    });

    it('answers 400 for an unknown level', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/logs?level=loud' });

        expect(response.statusCode).toBe(400);
    });
});
