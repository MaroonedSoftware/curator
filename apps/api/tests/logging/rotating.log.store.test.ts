import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_LOG_FILENAME, RotatingLogStore, type RotatingLogStoreOptions } from '../../src/logging/rotating.log.store.js';

describe('RotatingLogStore', () => {
    let dir: string;
    const store = (options: Partial<RotatingLogStoreOptions> = {}) =>
        new RotatingLogStore({ dir, maxBytes: 1024 * 1024, maxFiles: 3, maxValueChars: 512, maxLineBytes: 8192, ...options });

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'curator-log-'));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('writes one line per entry, with its meta', async () => {
        const s = store();
        s.append('info', 'rotation: advanced', { tvId: 'a', contentId: 'MY-F0001' });
        await s.close();

        const text = await readFile(join(dir, API_LOG_FILENAME), 'utf8');
        expect(text).toMatch(/^\S+ INFO {2}rotation: advanced \| tvId=a contentId=MY-F0001\n$/);
    });

    it('redacts credentials by key and bearer tokens inside values', async () => {
        const s = store();
        s.append('info', 'paired', { token: 'abc123', header: 'Bearer xyz', tvId: 'a' });
        await s.close();

        const text = await readFile(join(dir, API_LOG_FILENAME), 'utf8');
        expect(text).toContain('token=*** header=Bearer *** tvId=a');
        expect(text).not.toContain('abc123');
        expect(text).not.toContain('xyz');
    });

    it('keeps a multi-line message on one line and cuts long values short', async () => {
        const s = store({ maxValueChars: 16 });
        s.append('error', 'first\nsecond', { long: 'x'.repeat(100) });
        await s.close();

        const [line] = (await readFile(join(dir, API_LOG_FILENAME), 'utf8')).split('\n');
        expect(line).toContain('first\\nsecond');
        expect(line).toContain(`long=${'x'.repeat(16)}…`);
    });

    it('tails newest first, filtered to a minimum level', async () => {
        const s = store();
        s.append('debug', 'one');
        s.append('warn', 'two');
        s.append('error', 'three');
        s.append('info', 'four');
        await s.close();

        expect((await s.tail({ limit: 10 })).map(entry => entry.text)).toEqual(['four', 'three', 'two', 'one']);
        expect((await s.tail({ limit: 10, level: 'warn' })).map(entry => [entry.level, entry.text])).toEqual([
            ['error', 'three'],
            ['warn', 'two'],
        ]);
        expect(await s.tail({ limit: 1 })).toHaveLength(1);
    });

    it('rotates by size, keeping a bounded number of files', async () => {
        const s = store({ maxBytes: 1024, maxFiles: 2 });
        for (let i = 0; i < 100; i++) {
            s.append('info', `line ${i} ${'x'.repeat(50)}`);
            // Let each write land, so the stream sees the size and rotates.
            await new Promise(done => setImmediate(done));
        }
        await s.close();

        const segments = (await readdir(dir)).filter(name => name.endsWith(API_LOG_FILENAME));
        expect(segments.length).toBeLessThanOrEqual(3);
        const entries = await s.tail({ limit: 1000 });
        expect(entries[0]?.text).toMatch(/^line 99 /);
        // The history file rotating-file-stream keeps beside the log is not read as log lines.
        expect(entries.every(entry => entry.level === 'info')).toBe(true);
    });

    it('still writes after it is closed, for the shutdown tail', async () => {
        const s = store();
        s.append('info', 'before');
        await s.close();
        s.append('info', 'Server closed');

        expect((await s.tail({ limit: 10 })).map(entry => entry.text)).toEqual(['Server closed', 'before']);
    });

    it('reads an empty log when nothing was written', async () => {
        expect(await store({ dir: join(dir, 'missing') }).tail({ limit: 10 })).toEqual([]);
    });
});
