import { describe, expect, it } from 'vitest';
import { api, ApiError, tvApi } from '../../src/api/api.client';
import { errorResponse, fakeApi, jsonResponse, noContent, TV, TV_BASE } from '../fake.api';

describe('api client', () => {
    it('lists, renames and removes TVs at /tvs', async () => {
        const requests = fakeApi({
            'GET /tvs': () => jsonResponse({ items: [TV] }),
            [`PATCH ${TV_BASE}`]: () => jsonResponse({ ...TV, name: 'Lounge' }),
            [`DELETE ${TV_BASE}`]: () => noContent(),
        });

        await expect(api.tvs()).resolves.toEqual([TV]);
        await expect(api.renameTv(TV.id, 'Lounge')).resolves.toMatchObject({ name: 'Lounge' });
        await api.removeTv(TV.id);

        expect(requests.map(request => [request.method, request.body])).toEqual([
            ['GET', undefined],
            ['PATCH', { name: 'Lounge' }],
            ['DELETE', undefined],
        ]);
    });

    it('connects a TV with a JSON body', async () => {
        const requests = fakeApi({ 'POST /tvs': () => jsonResponse(TV, 201) });

        await expect(api.connectTv({ host: '192.168.1.50' })).resolves.toEqual(TV);

        expect(requests[0]?.body).toEqual({ host: '192.168.1.50' });
    });

    it('reads a TV’s endpoints under its id, through the /api prefix', async () => {
        const requests = fakeApi({ [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on: true }) });

        await expect(tvApi(TV.id).artMode()).resolves.toBe(true);
        expect(requests).toHaveLength(1);
    });

    it('passes a category as a query parameter and leaves it off when absent', async () => {
        const requests = fakeApi({ [`GET ${TV_BASE}/art`]: () => jsonResponse({ items: [] }) });

        await tvApi(TV.id).listArt('MY-C0002');
        await tvApi(TV.id).listArt();

        expect(requests.map(request => request.search.get('category'))).toEqual(['MY-C0002', null]);
    });

    it('sends writes as JSON and resolves a 204 with nothing', async () => {
        const requests = fakeApi({ [`PUT ${TV_BASE}/art/current`]: () => noContent() });

        await expect(tvApi(TV.id).selectArt('MY-F0001', { show: false })).resolves.toBeUndefined();

        expect(requests[0]?.body).toEqual({ contentId: 'MY-F0001', show: false });
        expect(requests[0]?.headers.get('content-type')).toBe('application/json');
    });

    it('escapes a content id in the path', async () => {
        const requests = fakeApi({ [`DELETE ${TV_BASE}/art/MY%2FF0001`]: () => noContent() });

        await tvApi(TV.id).deleteArt('MY/F0001');

        expect(requests).toHaveLength(1);
    });

    it('uploads the image as the raw body under its own type, mattes in the query', async () => {
        const requests = fakeApi({ [`POST ${TV_BASE}/art`]: () => jsonResponse({ contentId: 'MY-F0009' }, 201) });
        const image = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });

        await expect(tvApi(TV.id).uploadArt(image, { matte: 'shadowbox_polar' })).resolves.toBe('MY-F0009');

        expect(requests[0]?.headers.get('content-type')).toBe('image/jpeg');
        expect(requests[0]?.search.get('matte')).toBe('shadowbox_polar');
        expect(requests[0]?.search.has('portraitMatte')).toBe(false);
        expect(requests[0]?.body).toBe(image);
    });

    it('turns an error body into an ApiError with its status and reason', async () => {
        fakeApi({ [`GET ${TV_BASE}/device`]: () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }) });

        const error = await tvApi(TV.id)
            .device()
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status: 503, message: 'Service Unavailable', reason: 'cannot reach TV' });
    });

    it('falls back to the status text when the error body is not JSON', async () => {
        fakeApi({ [`GET ${TV_BASE}/device`]: () => new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }) });

        await expect(tvApi(TV.id).device()).rejects.toMatchObject({ status: 502, message: 'Bad Gateway', reason: undefined });
    });
});
