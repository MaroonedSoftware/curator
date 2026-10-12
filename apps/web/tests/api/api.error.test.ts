import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/api/api.client';
import { describeError } from '../../src/api/api.error';

describe('describeError', () => {
    it.each([
        [503, 'The TV is unreachable'],
        [504, 'The TV didn’t answer'],
        [502, 'The TV refused the request'],
        [422, 'The TV rejected that'],
        [400, 'Request failed (400)'],
    ])('titles a %i as "%s"', (status, title) => {
        expect(describeError(new ApiError(status, 'x', { reason: 'why' })).title).toBe(title);
    });

    it('carries the API’s reason', () => {
        expect(describeError(new ApiError(422, 'Unprocessable Entity', { reason: 'change_matte failed' })).message).toBe('change_matte failed');
    });

    it('treats anything that is not an ApiError as the API being down', () => {
        expect(describeError(new TypeError('Failed to fetch')).title).toBe('The API is unreachable');
    });
});
