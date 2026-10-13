import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlbumRepository } from '../../src/modules/albums/album.repository.js';
import { RotationRepository } from '../../src/modules/albums/rotation.repository.js';
import { createTvTestServer } from '../test.server.js';

const uniqueJpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(16)]);

describe('replacing a piece’s image', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;
    let albums: AlbumRepository;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
        albums = server.container.get(AlbumRepository);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('albums').execute();
        // An upload with a matte, on screen, and a piece from the Art Store; the next upload is MY-F0003.
        server.tv.art.clear();
        server.tv.art.set('SAM-S0001', { contentId: 'SAM-S0001', categoryId: 'MY-C0008', raw: {} });
        server.tv.art.set('MY_F0001', {
            contentId: 'MY_F0001',
            categoryId: 'MY-C0002',
            raw: { matte_id: 'shadowbox_polar', portrait_matte_id: 'flexible_apricot' },
        });
        server.tv.current_ = 'MY_F0001';
        server.tv.calls.length = 0;
    });

    afterAll(async () => {
        await server.close();
    });

    const replace = (contentId: string, image: Buffer, type = 'image/jpeg') =>
        server.app.inject({ method: 'POST', url: `${server.base}/art/${contentId}/replace`, headers: { 'content-type': type }, payload: image });

    it('uploads the new image with the old mattes, puts it in the old one’s place everywhere, and deletes the old one', async () => {
        const halloween = (await albums.create(server.tvId, 'Halloween')).id;
        const favourites = (await albums.create(server.tvId, 'Favourites')).id;
        await albums.addPieces(server.tvId, halloween, ['SAM-S0001', 'MY-F0001', 'MY-F0099']);
        await albums.addPieces(server.tvId, favourites, ['MY-F0001']);
        const rotations = server.container.get(RotationRepository);
        await rotations.set(server.tvId, { albumId: halloween });
        await rotations.recordRotation(server.tvId, 'MY-F0001');
        const image = uniqueJpeg();

        const response = await replace('MY-F0001', image);

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ contentId: 'MY-F0003', duplicate: false });
        expect(await albums.pieces(server.tvId, halloween)).toEqual(['SAM-S0001', 'MY-F0003', 'MY-F0099']);
        expect(await albums.pieces(server.tvId, favourites)).toEqual(['MY-F0003']);
        expect((await rotations.get(server.tvId))?.lastContentId).toBe('MY-F0003');
        expect(server.tv.calls.filter(call => !['list', 'current', 'getArtMode'].includes(call.method))).toEqual([
            { method: 'upload', args: [image, { fileType: 'jpg', matte: 'shadowbox_polar', portraitMatte: 'flexible_apricot' }] },
            { method: 'select', args: ['MY-F0003', { show: true, category: 'MY-C0002' }] },
            { method: 'delete', args: ['MY_F0001'] },
        ]);
        expect(server.tv.art.has('MY_F0001')).toBe(false);
    });

    it('only selects the new piece, without switching into art mode, when the TV is showing television', async () => {
        server.tv.artMode = false;
        try {
            await replace('MY-F0001', uniqueJpeg());
        } finally {
            server.tv.artMode = true;
        }

        expect(server.tv.calls.find(call => call.method === 'select')?.args).toEqual(['MY-F0003', { show: false, category: 'MY-C0002' }]);
    });

    it('leaves the screen alone when the old piece wasn’t on it', async () => {
        server.tv.current_ = 'SAM-S0001';

        await replace('MY-F0001', uniqueJpeg());

        expect(server.tv.calls.map(call => call.method)).not.toContain('select');
    });

    it('changes nothing when the new image is the old one again', async () => {
        const image = uniqueJpeg();
        const first = await server.app.inject({
            method: 'POST',
            url: `${server.base}/art`,
            headers: { 'content-type': 'image/jpeg' },
            payload: image,
        });
        const contentId = first.json().contentId as string;
        server.tv.calls.length = 0;

        const response = await replace(contentId, image);

        expect(response.json()).toEqual({ contentId, duplicate: true });
        expect(server.tv.calls.map(call => call.method)).not.toContain('delete');
        expect(server.tv.art.has(contentId)).toBe(true);
    });

    it('refuses a piece from the Art Store with 422, and one the TV doesn’t have with 404, uploading nothing', async () => {
        expect((await replace('SAM-S0001', uniqueJpeg())).statusCode).toBe(422);
        expect((await replace('MY-F0042', uniqueJpeg())).statusCode).toBe(404);
        expect(server.tv.calls.map(call => call.method)).not.toContain('upload');
    });

    it('refuses anything but a JPEG or PNG with 415', async () => {
        expect((await replace('MY-F0001', Buffer.from('hello'), 'text/plain')).statusCode).toBe(415);
    });
});
