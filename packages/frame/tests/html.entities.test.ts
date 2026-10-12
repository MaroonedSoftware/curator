import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../src/html.entities.js';

describe('decodeHtmlEntities', () => {
    it.each([
        ['50&quot; The Frame', '50" The Frame'],
        ['Tom &amp; Jerry&#39;s TV', "Tom & Jerry's TV"],
        ['&lt;b&gt;', '<b>'],
        ['caf&#xe9;', 'café'],
        ['Living Room', 'Living Room'],
        ['&bogus; &#0; &', '&bogus; &#0; &'],
    ])('decodes %s', (input, output) => {
        expect(decodeHtmlEntities(input)).toBe(output);
    });
});
