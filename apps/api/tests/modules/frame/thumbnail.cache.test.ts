import { describe, expect, it } from 'vitest';
import { ThumbnailCache } from '../../../src/modules/frame/thumbnail.cache.js';

const thumb = (bytes: number) => ({ data: Buffer.alloc(bytes), fileType: 'jpg' });

describe('ThumbnailCache', () => {
    it('keeps thumbnails per TV and content id', () => {
        const cache = new ThumbnailCache(100);
        cache.set('a', 'MY-F0001', thumb(10));

        expect(cache.get('a', 'MY-F0001')?.data.length).toBe(10);
        expect(cache.get('b', 'MY-F0001')).toBeUndefined();
    });

    it('drops the least recently used once over its byte budget', () => {
        const cache = new ThumbnailCache(100);
        cache.set('a', '1', thumb(40));
        cache.set('a', '2', thumb(40));
        cache.get('a', '1');
        cache.set('a', '3', thumb(40));

        expect(cache.get('a', '2')).toBeUndefined();
        expect(cache.get('a', '1')).toBeDefined();
        expect(cache.size).toEqual({ entries: 2, bytes: 80 });
    });

    it('replaces an entry without double counting, and skips one bigger than the whole budget', () => {
        const cache = new ThumbnailCache(100);
        cache.set('a', '1', thumb(40));
        cache.set('a', '1', thumb(30));
        cache.set('a', 'huge', thumb(101));

        expect(cache.size).toEqual({ entries: 1, bytes: 30 });
    });

    it('forgets a TV', () => {
        const cache = new ThumbnailCache(100);
        cache.set('a', '1', thumb(10));
        cache.set('ab', '1', thumb(10));

        cache.dropTv('a');

        expect(cache.get('a', '1')).toBeUndefined();
        expect(cache.get('ab', '1')).toBeDefined();
    });
});
