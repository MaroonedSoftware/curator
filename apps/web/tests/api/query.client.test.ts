import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/api/api.client';
import { retryOnce } from '../../src/api/query.client';

describe('retryOnce', () => {
    it('retries a TV or network failure once', () => {
        expect(retryOnce(0, new ApiError(503, 'x'))).toBe(true);
        expect(retryOnce(0, new TypeError('Failed to fetch'))).toBe(true);
        expect(retryOnce(1, new ApiError(503, 'x'))).toBe(false);
    });

    it('never retries a request the API called wrong', () => {
        expect(retryOnce(0, new ApiError(422, 'x'))).toBe(false);
        expect(retryOnce(0, new ApiError(400, 'x'))).toBe(false);
    });
});
