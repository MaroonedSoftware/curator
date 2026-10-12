import { describe, expect, it } from 'vitest';
import { intervalLabel } from '../../src/api/rotation.labels';

describe('intervalLabel', () => {
    it('names an interval in the largest whole unit', () => {
        expect(intervalLabel(1)).toBe('1 minute');
        expect(intervalLabel(45)).toBe('45 minutes');
        expect(intervalLabel(60)).toBe('1 hour');
        expect(intervalLabel(90)).toBe('90 minutes');
        expect(intervalLabel(360)).toBe('6 hours');
        expect(intervalLabel(1440)).toBe('1 day');
    });
});
