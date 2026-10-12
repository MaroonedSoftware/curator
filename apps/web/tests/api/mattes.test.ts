import { describe, expect, it } from 'vitest';
import { formatMatte, matteLabel, parseMatte } from '../../src/api/mattes';

describe('mattes', () => {
    it.each([
        ['shadowbox_polar', { style: 'shadowbox', colour: 'polar' }],
        ['none', { style: 'none' }],
        [undefined, { style: 'none' }],
        ['flexible', { style: 'flexible' }],
    ])('parses %s', (matte, parts) => {
        expect(parseMatte(matte)).toEqual(parts);
    });

    it('formats a style and colour back into an id, and none as itself', () => {
        expect(formatMatte({ style: 'modern', colour: 'apricot' })).toBe('modern_apricot');
        expect(formatMatte({ style: 'none', colour: 'apricot' })).toBe('none');
    });

    it('labels mattes for people', () => {
        expect(matteLabel('shadowbox_polar')).toBe('Shadowbox, polar');
        expect(matteLabel('none')).toBe('No matte');
        expect(matteLabel(undefined)).toBe('No matte');
    });
});
