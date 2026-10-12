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

describe('tv write routes', () => {
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

    it('PUT /tv/art/current selects the artwork', async () => {
        const response = await server.app.inject({ method: 'PUT', url: '/tv/art/current', payload: { contentId: 'MY-F0001', show: false } });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe('');
        expect(server.tv.calls).toEqual([{ method: 'select', args: ['MY-F0001', { show: false }] }]);
        expect(server.tv.current_).toBe('MY-F0001');
    });

    it('PUT /tv/art/current rejects a body without a content id', async () => {
        const response = await server.app.inject({ method: 'PUT', url: '/tv/art/current', payload: { show: true } });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('PUT /tv/art/current answers 411 when the body is missing', async () => {
        const response = await server.app.inject({ method: 'PUT', url: '/tv/art/current' });

        expect(response.statusCode).toBe(411);
        expect(server.tv.calls).toEqual([]);
    });

    it('DELETE /tv/art/:contentId deletes the artwork', async () => {
        server.tv.art.set('MY-F0099', { contentId: 'MY-F0099', categoryId: 'MY-C0002', raw: {} });

        const response = await server.app.inject({ method: 'DELETE', url: '/tv/art/MY-F0099' });

        expect(response.statusCode).toBe(204);
        expect(server.tv.calls).toEqual([{ method: 'delete', args: ['MY-F0099'] }]);
        expect(server.tv.art.has('MY-F0099')).toBe(false);
    });

    it('DELETE /tv/art/:contentId rejects a malformed content id', async () => {
        const response = await server.app.inject({ method: 'DELETE', url: '/tv/art/MY-F0001%20OR%201' });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('PUT /tv/art/:contentId/matte changes the matte', async () => {
        const response = await server.app.inject({
            method: 'PUT',
            url: '/tv/art/MY-F0001/matte',
            payload: { matte: 'shadowbox_polar', portraitMatte: 'modern_apricot' },
        });

        expect(response.statusCode).toBe(204);
        expect(server.tv.calls).toEqual([{ method: 'changeMatte', args: ['MY-F0001', 'shadowbox_polar', 'modern_apricot'] }]);
    });

    it('PUT /tv/art/:contentId/matte rejects a malformed matte', async () => {
        const response = await server.app.inject({ method: 'PUT', url: '/tv/art/MY-F0001/matte', payload: { matte: 'Shadow Box' } });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('PUT /tv/art-mode turns art mode off and on', async () => {
        const off = await server.app.inject({ method: 'PUT', url: '/tv/art-mode', payload: { on: false } });
        expect(off.statusCode).toBe(204);
        expect(server.tv.artMode).toBe(false);

        const on = await server.app.inject({ method: 'PUT', url: '/tv/art-mode', payload: { on: true } });
        expect(on.statusCode).toBe(204);
        expect(server.tv.artMode).toBe(true);
    });

    it('PUT /tv/art-mode rejects a non-boolean', async () => {
        const response = await server.app.inject({ method: 'PUT', url: '/tv/art-mode', payload: { on: 'yes' } });

        expect(response.statusCode).toBe(400);
    });

    it('answers a write to an unreachable TV with 503', async () => {
        server.tv.failNext = new FrameConnectionError('cannot reach TV');

        const response = await server.app.inject({ method: 'PUT', url: '/tv/art-mode', payload: { on: true } });

        expect(response.statusCode).toBe(503);
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
