import { FrameConnectionError, FrameError, FrameRequestError, FrameTimeoutError, FrameUnauthorizedError } from '@curator/frame';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTvTestServer } from '../test.server.js';

describe('a TV’s read endpoints', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
    });

    beforeEach(() => {
        server.tv.calls.length = 0;
    });

    afterAll(async () => {
        await server.close();
    });

    it('GET …/device answers the device info', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/device` });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            model: 'QE55LS03B',
            name: 'Living Room',
            frameTvSupport: true,
            powerOn: true,
            raw: { device: { modelName: 'QE55LS03B' } },
        });
    });

    it('GET …/api-version answers the art API version', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/api-version` });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ version: '4.3.4.0' });
    });

    it('GET …/art lists every category when none is given', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art` });

        expect(response.statusCode).toBe(200);
        expect(response.json().items.map((item: { contentId: string }) => item.contentId)).toEqual(['SAM-S0001', 'MY-F0001']);
        expect(server.tv.calls).toEqual([{ method: 'list', args: [undefined] }]);
    });

    it('GET …/art?category= passes the category through', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art?category=MY-C0002` });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            items: [
                {
                    contentId: 'MY-F0001',
                    categoryId: 'MY-C0002',
                    categoryIds: ['MY-C0002'],
                    raw: { content_id: 'MY-F0001', category_id: 'MY-C0002', matte_id: 'none' },
                },
            ],
        });
    });

    it('GET …/art lists a piece once, with every category the TV lists it under', async () => {
        // As a 2025 Frame does: an upload under My Photos and MY-C0008, and twice under MY-C0008.
        const entry = (categoryId: string, slideshow: string) => ({
            contentId: 'MY_F0019',
            categoryId,
            raw: { content_id: 'MY_F0019', category_id: categoryId, slideshow },
        });
        server.tv.extraListEntries.push(entry('MY-C0008', 'true'), entry('MY-C0008', 'false'), entry('MY-C0002', 'false'));

        const all = (await server.app.inject({ method: 'GET', url: `${server.base}/art` })).json().items;
        const other = (await server.app.inject({ method: 'GET', url: `${server.base}/art?category=MY-C0008` })).json().items;
        server.tv.extraListEntries.length = 0;

        expect(all.map((item: { contentId: string }) => item.contentId)).toEqual(['SAM-S0001', 'MY-F0001', 'MY_F0019']);
        expect(all[2]).toMatchObject({ categoryId: 'MY-C0008', categoryIds: ['MY-C0008', 'MY-C0002'], raw: { slideshow: 'true' } });
        expect(other.map((item: { contentId: string }) => item.contentId)).toEqual(['SAM-S0001', 'MY_F0019']);
    });

    it('GET …/art rejects an empty category', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art?category=` });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('GET …/art/current answers the artwork on screen', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art/current` });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            contentId: 'SAM-S0001',
            categoryId: 'MY-C0008',
            raw: { content_id: 'SAM-S0001', category_id: 'MY-C0008', matte_id: 'none' },
        });
    });

    it('GET …/art-mode answers whether art mode is on', async () => {
        server.tv.artMode = false;

        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art-mode` });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ on: false });
        server.tv.artMode = true;
    });
});

describe('a TV’s write endpoints', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
    });

    beforeEach(() => {
        server.tv.calls.length = 0;
    });

    afterAll(async () => {
        await server.close();
    });

    it('PUT …/art/current selects the artwork', async () => {
        const response = await server.app.inject({
            method: 'PUT',
            url: `${server.base}/art/current`,
            payload: { contentId: 'MY-F0001', show: false },
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe('');
        expect(server.tv.calls).toEqual([{ method: 'select', args: ['MY-F0001', { show: false }] }]);
        expect(server.tv.current_).toBe('MY-F0001');
    });

    it('PUT …/art/current rejects a body without a content id', async () => {
        const response = await server.app.inject({ method: 'PUT', url: `${server.base}/art/current`, payload: { show: true } });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('PUT …/art/current answers 411 when the body is missing', async () => {
        const response = await server.app.inject({ method: 'PUT', url: `${server.base}/art/current` });

        expect(response.statusCode).toBe(411);
        expect(server.tv.calls).toEqual([]);
    });

    it('DELETE …/art/:contentId deletes the artwork', async () => {
        server.tv.art.set('MY-F0099', { contentId: 'MY-F0099', categoryId: 'MY-C0002', raw: {} });

        const response = await server.app.inject({ method: 'DELETE', url: `${server.base}/art/MY-F0099` });

        expect(response.statusCode).toBe(204);
        expect(server.tv.calls).toEqual([{ method: 'delete', args: ['MY-F0099'] }]);
        expect(server.tv.art.has('MY-F0099')).toBe(false);
    });

    it('DELETE …/art/:contentId rejects a malformed content id', async () => {
        const response = await server.app.inject({ method: 'DELETE', url: `${server.base}/art/MY-F0001%20OR%201` });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('PUT …/art/:contentId/matte changes the matte', async () => {
        const response = await server.app.inject({
            method: 'PUT',
            url: `${server.base}/art/MY-F0001/matte`,
            payload: { matte: 'shadowbox_polar', portraitMatte: 'modern_apricot' },
        });

        expect(response.statusCode).toBe(204);
        expect(server.tv.calls).toEqual([{ method: 'changeMatte', args: ['MY-F0001', 'shadowbox_polar', 'modern_apricot'] }]);
    });

    it('PUT …/art/:contentId/matte rejects a malformed matte', async () => {
        const response = await server.app.inject({ method: 'PUT', url: `${server.base}/art/MY-F0001/matte`, payload: { matte: 'Shadow Box' } });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('PUT …/art-mode turns art mode off and on', async () => {
        const off = await server.app.inject({ method: 'PUT', url: `${server.base}/art-mode`, payload: { on: false } });
        expect(off.statusCode).toBe(204);
        expect(server.tv.artMode).toBe(false);

        const on = await server.app.inject({ method: 'PUT', url: `${server.base}/art-mode`, payload: { on: true } });
        expect(on.statusCode).toBe(204);
        expect(server.tv.artMode).toBe(true);
    });

    it('PUT …/art-mode rejects a non-boolean', async () => {
        const response = await server.app.inject({ method: 'PUT', url: `${server.base}/art-mode`, payload: { on: 'yes' } });

        expect(response.statusCode).toBe(400);
    });

    it('answers a write to an unreachable TV with 503', async () => {
        server.tv.failNext = new FrameConnectionError('cannot reach TV');

        const response = await server.app.inject({ method: 'PUT', url: `${server.base}/art-mode`, payload: { on: true } });

        expect(response.statusCode).toBe(503);
    });
});

describe('uploading to a TV', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
    });

    beforeEach(() => {
        server.tv.calls.length = 0;
    });

    afterAll(async () => {
        await server.close();
    });

    it('POST …/art uploads a JPEG and answers its content id', async () => {
        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/jpeg' },
            payload: jpeg,
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({ contentId: 'MY-F0003' });
        expect(server.tv.calls).toEqual([{ method: 'upload', args: [jpeg, { fileType: 'jpg' }] }]);
    });

    it('POST …/art passes a PNG and its mattes through', async () => {
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art?matte=shadowbox_polar&portraitMatte=none`,
            headers: { 'content-type': 'image/png' },
            payload: png,
        });

        expect(response.statusCode).toBe(201);
        expect(server.tv.calls).toEqual([{ method: 'upload', args: [png, { fileType: 'png', matte: 'shadowbox_polar', portraitMatte: 'none' }] }]);
    });

    it('POST …/art accepts an image over Fastify’s default 1MB body limit', async () => {
        const big = Buffer.alloc(5 * 1024 * 1024, 0xff);

        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/jpeg' },
            payload: big,
        });

        expect(response.statusCode).toBe(201);
        expect((server.tv.calls[0]?.args[0] as Buffer).length).toBe(big.length);
    });

    it('POST …/art answers 413 above 20MB', async () => {
        const huge = Buffer.alloc(20 * 1024 * 1024 + 1);

        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/jpeg' },
            payload: huge,
        });

        expect(response.statusCode).toBe(413);
        expect(server.tv.calls).toEqual([]);
    });

    it('POST …/art answers 415 for anything but JPEG or PNG', async () => {
        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/gif' },
            payload: Buffer.from('GIF89a'),
        });

        expect(response.statusCode).toBe(415);
        expect(server.tv.calls).toEqual([]);
    });

    it('POST …/art answers 411 without a body', async () => {
        const response = await server.app.inject({ method: 'POST', url: `${server.base}/art` });

        expect(response.statusCode).toBe(411);
    });

    it('POST …/art answers 411 for an empty image', async () => {
        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/jpeg' },
            payload: Buffer.alloc(0),
        });

        expect(response.statusCode).toBe(411);
        expect(server.tv.calls).toEqual([]);
    });

    it('POST …/art rejects a malformed matte', async () => {
        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art?matte=Shadow%20Box`,
            headers: { 'content-type': 'image/jpeg' },
            payload: jpeg,
        });

        expect(response.statusCode).toBe(400);
        expect(server.tv.calls).toEqual([]);
    });

    it('answers an upload the TV never acknowledged with 504', async () => {
        server.tv.failNext = new FrameTimeoutError('send_image', 15000);

        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/jpeg' },
            payload: jpeg,
        });

        expect(response.statusCode).toBe(504);
    });
});

describe('keeping uploaded originals', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const tvDir = () => join(server.originalsDir, server.tvId);
    const exists = (path: string) =>
        stat(path).then(
            () => true,
            () => false,
        );
    const upload = async () => {
        const response = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/jpeg' },
            payload: jpeg,
        });
        expect(response.statusCode).toBe(201);
        return response.json().contentId as string;
    };

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
    });

    afterAll(async () => {
        await server.close();
    });

    it('POST …/art keeps the image on disk under the TV', async () => {
        const contentId = await upload();

        expect(await readFile(join(tvDir(), `${contentId}.jpg`))).toEqual(jpeg);
    });

    it('DELETE …/art/:contentId deletes the kept original too', async () => {
        const contentId = await upload();

        const response = await server.app.inject({ method: 'DELETE', url: `${server.base}/art/${contentId}` });

        expect(response.statusCode).toBe(204);
        expect(await exists(join(tvDir(), `${contentId}.jpg`))).toBe(false);
    });

    it('POST …/art still answers the content id when the original cannot be kept', async () => {
        // A file where the TV's directory belongs makes every write fail.
        await rm(tvDir(), { recursive: true, force: true });
        await writeFile(tvDir(), '');
        try {
            const response = await server.app.inject({
                method: 'POST',
                url: `${server.base}/art`,
                headers: { 'content-type': 'image/jpeg' },
                payload: jpeg,
            });

            expect(response.statusCode).toBe(201);
            expect(response.json().contentId).toMatch(/^MY-F/);
        } finally {
            await rm(tvDir(), { force: true });
        }
    });

    it('GET …/art/:contentId/original answers the kept image, named for download', async () => {
        const contentId = await upload();

        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art/${contentId}/original` });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('image/jpeg');
        expect(response.headers['cache-control']).toContain('immutable');
        expect(response.headers['content-disposition']).toBe(`inline; filename="${contentId}.jpg"`);
        expect(response.rawPayload).toEqual(jpeg);
    });

    it('GET …/art/:contentId/original finds an upload under either of its id forms', async () => {
        const contentId = await upload();

        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art/${contentId.replace('-', '_')}/original` });

        expect(response.statusCode).toBe(200);
        expect(response.rawPayload).toEqual(jpeg);
    });

    it('GET …/art/:contentId/original answers 404 for a piece not uploaded through curator', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art/SAM-S0001/original` });

        expect(response.statusCode).toBe(404);
    });

    it('HEAD …/art/:contentId/original says whether an original is kept', async () => {
        const contentId = await upload();

        expect((await server.app.inject({ method: 'HEAD', url: `${server.base}/art/${contentId}/original` })).statusCode).toBe(200);
        expect((await server.app.inject({ method: 'HEAD', url: `${server.base}/art/MY-F9999/original` })).statusCode).toBe(404);
    });

    it('DELETE /tvs/:tvId leaves the TV’s originals in place', async () => {
        const contentId = await upload();

        expect((await server.app.inject({ method: 'DELETE', url: `/tvs/${server.tvId}` })).statusCode).toBe(204);

        expect(await exists(join(tvDir(), `${contentId}.jpg`))).toBe(true);
    });
});

describe('a TV’s failures', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
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

        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art` });

        expect(response.statusCode).toBe(status);
        expect(response.json()).toMatchObject({ statusCode: status, details });
    });

    it('answers anything else as an opaque 500', async () => {
        server.tv.failNext = new Error('boom');

        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art` });

        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ statusCode: 500, message: 'Internal Server Error' });
    });
});

describe('a TV’s thumbnails', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
    });

    beforeEach(() => {
        server.tv.calls.length = 0;
    });

    afterAll(async () => {
        await server.close();
    });

    it('GET …/art/:contentId/thumbnail answers the image, cacheable by the browser', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art/MY-F0001/thumbnail` });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('image/jpeg');
        expect(response.headers['cache-control']).toContain('immutable');
        expect(response.rawPayload.toString()).toBe('thumb:MY-F0001');
    });

    it('asks the TV once for a page’s worth of thumbnails requested together, then serves them from memory', async () => {
        const ids = ['SAM-S0001', 'MY-F0001'];
        const first = await Promise.all(ids.map(id => server.app.inject({ method: 'GET', url: `${server.base}/art/${id}/thumbnail` })));
        const again = await server.app.inject({ method: 'GET', url: `${server.base}/art/SAM-S0001/thumbnail` });

        expect(first.map(response => response.statusCode)).toEqual([200, 200]);
        expect(again.statusCode).toBe(200);
        const fetched = server.tv.calls.filter(call => call.method === 'thumbnails').flatMap(call => call.args[0] as string[]);
        // MY-F0001 was cached by the previous test; only SAM-S0001 reaches the TV, once.
        expect(fetched).toEqual(['SAM-S0001']);
    });

    it('answers 404 for a piece the TV has no thumbnail for', async () => {
        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art/MY-F9999/thumbnail` });

        expect(response.statusCode).toBe(404);
    });

    it('answers 503 when the TV is unreachable', async () => {
        server.tv.failNext = new FrameConnectionError('cannot reach TV');

        const response = await server.app.inject({ method: 'GET', url: `${server.base}/art/MY-F0001%2Fx/thumbnail` });
        const unreachable = await server.app.inject({ method: 'GET', url: `${server.base}/art/MY-F0002/thumbnail` });

        expect(response.statusCode).toBe(400);
        expect(unreachable.statusCode).toBe(503);
    });
});
