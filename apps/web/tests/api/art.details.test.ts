import { describe, expect, it } from 'vitest';
import { artDetails, parseImageDate } from '../../src/api/art.details';

describe('art details', () => {
    it('reads the TV’s EXIF-style image date', () => {
        expect(parseImageDate('2026:03:17 13:29:37')).toEqual(new Date(2026, 2, 17, 13, 29, 37));
        expect(parseImageDate('2026:03:17')).toEqual(new Date(2026, 2, 17));
        expect(parseImageDate('yesterday')).toBeUndefined();
        expect(parseImageDate(undefined)).toBeUndefined();
    });

    it('takes what the raw entry gives, and leaves out what it doesn’t', () => {
        const raw = { matte_id: 'none', portrait_matte_id: 'shadowbox_black', width: 3840, height: '2160', image_date: '2026:03:17 13:29:37' };

        expect(artDetails({ contentId: 'MY_F0019', categoryId: 'MY-C0002', categoryIds: ['MY-C0002'], raw })).toEqual({
            matte: 'none',
            portraitMatte: 'shadowbox_black',
            width: 3840,
            height: 2160,
            date: new Date(2026, 2, 17, 13, 29, 37),
        });
        expect(artDetails({ contentId: 'SAM-S0001', categoryId: 'MY-C0008', categoryIds: ['MY-C0008'], raw: { width: 0 } })).toEqual({
            matte: undefined,
            portraitMatte: undefined,
            width: undefined,
            height: undefined,
            date: undefined,
        });
    });
});
