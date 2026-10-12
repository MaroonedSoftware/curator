import { FrameConnectionError } from '@curator/frame';
import { describe, expect, it } from 'vitest';
import { ThumbnailBatcher } from '../../../src/modules/frame/thumbnail.batcher.js';
import { ThumbnailCache } from '../../../src/modules/frame/thumbnail.cache.js';
import { FakeFrameClient } from '../../fake.frame.client.js';

const setup = (maxBatch = 24) => {
    const client = new FakeFrameClient();
    client.art.set('MY-F0002', { contentId: 'MY-F0002', categoryId: 'MY-C0002', raw: {} });
    const batcher = new ThumbnailBatcher('tv', client, new ThumbnailCache(1024 * 1024), { windowMs: 10, maxBatch });
    const requests = () => client.calls.filter(call => call.method === 'thumbnails').map(call => call.args[0]);
    return { client, batcher, requests };
};

describe('ThumbnailBatcher', () => {
    it('asks the TV once for ids requested together', async () => {
        const { batcher, requests } = setup();

        const [a, b, store] = await Promise.all([batcher.get('MY-F0001'), batcher.get('MY-F0002'), batcher.get('SAM-S0001')]);

        expect(a?.data.toString()).toBe('thumb:MY-F0001');
        expect(b?.data.toString()).toBe('thumb:MY-F0002');
        expect(store?.data.toString()).toBe('thumb:SAM-S0001');
        expect(requests()).toEqual([['MY-F0001', 'MY-F0002', 'SAM-S0001']]);
    });

    it('asks once for the same id requested twice, and serves it from the cache afterwards', async () => {
        const { batcher, requests } = setup();

        await Promise.all([batcher.get('MY-F0001'), batcher.get('MY-F0001')]);
        await batcher.get('MY-F0001');

        expect(requests()).toEqual([['MY-F0001']]);
    });

    it('asks at once when a batch is full', async () => {
        const { batcher, requests } = setup(2);

        await Promise.all([batcher.get('MY-F0001'), batcher.get('MY-F0002'), batcher.get('SAM-S0001')]);

        expect(requests()).toEqual([['MY-F0001', 'MY-F0002'], ['SAM-S0001']]);
    });

    it('resolves undefined for an id the TV has no thumbnail for', async () => {
        const { batcher } = setup();

        await expect(batcher.get('MY-F9999')).resolves.toBeUndefined();
    });

    it('fails the whole batch when the TV does, caching nothing', async () => {
        const { client, batcher, requests } = setup();
        client.failNext = new FrameConnectionError('cannot reach TV');

        const results = await Promise.allSettled([batcher.get('MY-F0001'), batcher.get('MY-F0002')]);

        expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
        await expect(batcher.get('MY-F0001')).resolves.toBeDefined();
        expect(requests()).toEqual([['MY-F0001', 'MY-F0002'], ['MY-F0001']]);
    });
});
