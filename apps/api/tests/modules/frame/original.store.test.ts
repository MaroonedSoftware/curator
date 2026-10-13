import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fingerprintOf, OriginalStore } from '../../../src/modules/frame/original.store.js';

describe('OriginalStore', () => {
    let root: string;
    let store: OriginalStore;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'curator-originals-'));
        store = new OriginalStore(root);
    });

    afterEach(() => rm(root, { recursive: true, force: true }));

    it('reads back what it saved, jpg or png', async () => {
        const tv = store.forTv('a');
        await tv.save('MY-F0001', 'jpg', Buffer.from('jpeg bytes'));
        await tv.save('MY-F0002', 'png', Buffer.from('png bytes'));

        expect(await tv.get('MY-F0001')).toEqual({ data: Buffer.from('jpeg bytes'), fileType: 'jpg' });
        expect(await tv.get('MY-F0002')).toEqual({ data: Buffer.from('png bytes'), fileType: 'png' });
    });

    it('finds MY_F and MY-F as the same piece', async () => {
        const tv = store.forTv('a');
        await tv.save('MY_F0019', 'jpg', Buffer.from('x'));

        expect(await tv.get('MY-F0019')).toBeDefined();
        expect(await readdir(join(root, 'a'))).toEqual(['MY-F0019.jpg']);
    });

    it('keeps each TV to itself', async () => {
        await store.forTv('a').save('MY-F0001', 'jpg', Buffer.from('x'));

        expect(await store.forTv('b').get('MY-F0001')).toBeUndefined();
    });

    it('answers undefined for a piece it never saw', async () => {
        expect(await store.forTv('a').get('MY-F0001')).toBeUndefined();
    });

    it('deletes, and shrugs at deleting what is not there', async () => {
        const tv = store.forTv('a');
        await tv.save('MY-F0001', 'jpg', Buffer.from('x'));

        await tv.delete('MY_F0001');
        await tv.delete('MY-F0002');

        expect(await tv.get('MY-F0001')).toBeUndefined();
    });

    it('leaves no temporary file behind', async () => {
        await store.forTv('a').save('MY-F0001', 'jpg', Buffer.from('x'));

        expect(await readdir(join(root, 'a'))).toEqual(['MY-F0001.jpg']);
    });

    it('finds the originals with an image’s fingerprint, by normalized id, keeping in step with saves and deletes', async () => {
        const tv = store.forTv('a');
        const same = Buffer.from('the same image');
        await tv.save('MY_F0001', 'jpg', same);

        expect(await tv.withFingerprint(fingerprintOf(same))).toEqual(['MY-F0001']);

        await tv.save('MY-F0002', 'png', same);
        await tv.save('MY-F0003', 'jpg', Buffer.from('another image'));
        expect(await tv.withFingerprint(fingerprintOf(same))).toEqual(['MY-F0001', 'MY-F0002']);

        await tv.delete('MY-F0001');
        expect(await tv.withFingerprint(fingerprintOf(same))).toEqual(['MY-F0002']);
        expect(await store.forTv('b').withFingerprint(fingerprintOf(same))).toEqual([]);
    });

    it('fingerprints originals already on disk, as after a restart, ignoring temporary files', async () => {
        await mkdir(join(root, 'a'));
        await writeFile(join(root, 'a', 'MY_F0007.jpg'), 'kept before');
        await writeFile(join(root, 'a', 'MY-F0008.jpg.1234.tmp'), 'kept before');

        expect(await new OriginalStore(root).forTv('a').withFingerprint(fingerprintOf(Buffer.from('kept before')))).toEqual(['MY-F0007']);
    });
});
