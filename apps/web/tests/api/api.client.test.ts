import { describe, expect, it } from 'vitest';
import { api, ApiError } from '../../src/api/api.client';
import { errorResponse, fakeApi, jsonResponse, noContent } from '../fake.api';

describe('api client', () => {
    it('reads through the /api prefix', async () => {
        const requests = fakeApi({ 'GET /tv/art-mode': () => jsonResponse({ on: true }) });

        await expect(api.artMode()).resolves.toBe(true);
        expect(requests).toHaveLength(1);
    });

    it('passes a category as a query parameter and leaves it off when absent', async () => {
        const requests = fakeApi({ 'GET /tv/art': () => jsonResponse({ items: [] }) });

        await api.listArt('MY-C0002');
        await api.listArt();

        expect(requests.map(request => request.search.get('category'))).toEqual(['MY-C0002', null]);
    });

    it('sends writes as JSON and resolves a 204 with nothing', async () => {
        const requests = fakeApi({ 'PUT /tv/art/current': () => noContent() });

        await expect(api.selectArt('MY-F0001', { show: false })).resolves.toBeUndefined();

        expect(requests[0]?.body).toEqual({ contentId: 'MY-F0001', show: false });
        expect(requests[0]?.headers.get('content-type')).toBe('application/json');
    });

    it('escapes a content id in the path', async () => {
        const requests = fakeApi({ 'DELETE /tv/art/MY%2FF0001': () => noContent() });

        await api.deleteArt('MY/F0001');

        expect(requests).toHaveLength(1);
    });

    it('uploads the image as the raw body under its own type, mattes in the query', async () => {
        const requests = fakeApi({ 'POST /tv/art': () => jsonResponse({ contentId: 'MY-F0009' }, 201) });
        const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });

        await expect(api.uploadArt(image, { matte: 'shadowbox_polar' })).resolves.toBe('MY-F0009');

        expect(requests[0]?.headers.get('content-type')).toBe('image/jpeg');
        expect(requests[0]?.search.get('matte')).toBe('shadowbox_polar');
        expect(requests[0]?.search.has('portraitMatte')).toBe(false);
        expect(requests[0]?.body).toBe(image);
    });

    it('turns an error body into an ApiError with its status and reason', async () => {
        fakeApi({ 'GET /tv': () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }) });

        const error = await api.device().catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status: 503, message: 'Service Unavailable', reason: 'cannot reach TV' });
    });

    it('falls back to the status text when the error body is not JSON', async () => {
        fakeApi({ 'GET /tv': () => new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }) });

        await expect(api.device()).rejects.toMatchObject({ status: 502, message: 'Bad Gateway', reason: undefined });
    });
});
