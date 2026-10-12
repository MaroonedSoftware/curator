import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OriginalStore } from '../../../src/modules/frame/original.store.js';

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
});
