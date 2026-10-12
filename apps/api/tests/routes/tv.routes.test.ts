import { FrameConnectionError, FrameError, FrameRequestError, FrameTimeoutError, FrameUnauthorizedError } from '@curator/frame';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestServer } from '../test.server.js';

describe('tv read routes', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer();
    });

    beforeEach(() => {
        server.tv.calls.length = 0;
    });

    afterAll(async () => {
        await server.close();
    });

    it('GET /tv answers the device info', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tv' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            model: 'QE55LS03B',
            name: 'Living Room',
            frameTvSupport: true,
            powerOn: true,
            raw: { device: { modelName: 'QE55LS03B' } },
        });
    });

    it('GET /tv/api-version answers the art API version', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tv/api-version' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ version: '4.3.4.0' });
    });

    it('GET /tv/art lists every category when none is given', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tv/art' });

        expect(response.statusCode).toBe(200);
        expect(response.json().items.map((item: { contentId: string }) => item.contentId)).toEqual(['SAM-S0001', 'MY-F0001']);
        expect(server.tv.calls).toEqual([{ method: 'list', args: [undefined] }]);
    });

    it('GET /tv/art?category= passes the category through', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tv/art?category=MY-C0002' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            items: [{ contentId: 'MY-F0001', categoryId: 'MY-C0002', raw: { content_id: 'MY-F0001', category_id: 'MY-C0002', matte_id: 'none' } }],
        });
    });

    it('GET /tv/art rejects an empty category', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tv/art?category=' });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('GET /tv/art/current answers the artwork on screen', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tv/art/current' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            contentId: 'SAM-S0001',
            categoryId: 'MY-C0008',
            raw: { content_id: 'SAM-S0001', category_id: 'MY-C0008', matte_id: 'none' },
        });
    });

    it('GET /tv/art-mode answers whether art mode is on', async () => {
        server.tv.artMode = false;

        const response = await server.app.inject({ method: 'GET', url: '/tv/art-mode' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ on: false });
        server.tv.artMode = true;
    });
});

describe('tv errors', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer();
    });

    afterAll(async () => {
        await server.close();
    });

    it.each([
        ['an unreachable TV', new FrameConnectionError('cannot reach TV'), 503, { reason: 'cannot reach TV' }],
        [
            'a request the TV never answered',
            new FrameTimeoutError('get_content_list', 5000),
            504,
            { reason: 'get_content_list timed out after 5000ms', request: 'get_content_list' },
        ],
        [
            'a refused pairing',
            new FrameUnauthorizedError('pairing was not accepted'),
            502,
            { reason: 'pairing was not accepted. Accept the pairing prompt on the TV and retry.' },
        ],
        [
            'a request the TV rejected',
            new FrameRequestError('get_content_list', '-1'),
            422,
            { reason: 'get_content_list failed with error code -1', request: 'get_content_list', errorCode: '-1' },
        ],
        ['a reply the client could not read', new FrameError('bad REST response'), 502, { reason: 'bad REST response' }],
    ])('answers %s with %i', async (_name, error, status, details) => {
        server.tv.failNext = error;

        const response = await server.app.inject({ method: 'GET', url: '/tv/art' });

        expect(response.statusCode).toBe(status);
        expect(response.json()).toMatchObject({ statusCode: status, details });
    });

    it('answers anything else as an opaque 500', async () => {
        server.tv.failNext = new Error('boom');

        const response = await server.app.inject({ method: 'GET', url: '/tv/art' });

        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ statusCode: 500, message: 'Internal Server Error' });
    });
});
