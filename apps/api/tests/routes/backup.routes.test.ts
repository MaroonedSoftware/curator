import { randomBytes, randomUUID } from 'node:crypto';
import { unzipSync } from 'fflate';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlbumRepository } from '../../src/modules/albums/album.repository.js';
import { RotationRepository } from '../../src/modules/albums/rotation.repository.js';
import type { BackupManifest } from '../../src/modules/backup/backup.manifest.js';
import { FrameClientRegistry } from '../../src/modules/frame/frame.client.registry.js';
import { createTvTestServer } from '../test.server.js';
import type { FakeFrameClient } from '../fake.frame.client.js';

const uniqueJpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(16)]);

describe('backups', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;
    let albums: AlbumRepository;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
        albums = server.container.get(AlbumRepository);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('albums').execute();
        await server.db.deleteFrom('tvs').where('id', '!=', server.tvId).execute();
        server.tv.art.clear();
        server.tv.art.set('SAM-S0001', { contentId: 'SAM-S0001', categoryId: 'MY-C0008', raw: {} });
        server.tv.failOn.clear();
    });

    afterAll(async () => {
        await server.close();
    });

    const upload = async (tvBase: string, image: Buffer, query = '') =>
        (
            await server.app.inject({
                method: 'POST',
                url: `${tvBase}/art${query}`,
                headers: { 'content-type': 'image/jpeg' },
                payload: image,
            })
        ).json().contentId as string;

    const unzip = (payload: Buffer) => {
        const files = unzipSync(new Uint8Array(payload));
        const manifest = JSON.parse(Buffer.from(files['manifest.json']!).toString()) as BackupManifest;
        return { files, manifest };
    };

    it('GET /tvs/:tvId/backup zips the TV’s originals with a manifest of its pieces, albums and rotation', async () => {
        const image = uniqueJpeg();
        const uploaded = await upload(server.base, image, '?matte=shadowbox_polar&portraitMatte=none');
        const halloween = await albums.create(server.tvId, 'Halloween');
        await albums.addPieces(server.tvId, halloween.id, [uploaded, 'SAM-S0001']);
        await server.container.get(RotationRepository).set(server.tvId, { albumId: halloween.id, intervalMinutes: 15, shuffle: false });

        const response = await server.app.inject({ method: 'GET', url: `${server.base}/backup` });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/zip');
        expect(response.headers['content-disposition']).toMatch(/^attachment; filename="curator-backup-living-room-\d{4}-\d{2}-\d{2}\.zip"$/);
        const { files, manifest } = unzip(response.rawPayload);
        const file = `tvs/${server.tvId}/art/${uploaded}.jpg`;
        expect(Buffer.from(files[file]!)).toEqual(image);
        expect(manifest).toEqual({
            format: 'curator-backup',
            version: 1,
            createdAt: expect.any(String),
            tvs: [
                {
                    id: server.tvId,
                    name: 'Living Room',
                    listedByTv: true,
                    pieces: [
                        { contentId: 'SAM-S0001', categoryIds: ['MY-C0008'] },
                        { contentId: uploaded, file, matte: 'shadowbox_polar', categoryIds: ['MY-C0002'] },
                    ],
                    albums: [{ name: 'Halloween', contentIds: [uploaded, 'SAM-S0001'] }],
                    rotation: { albumName: 'Halloween', intervalMinutes: 15, shuffle: false },
                },
            ],
        });
    });

    it('GET /backup zips every TV, each under its own id', async () => {
        const other = await server.addTv({ name: 'Bedroom' });
        const otherTv = server.container.get(FrameClientRegistry).clientFor(other) as FakeFrameClient;
        otherTv.art.clear();
        const mine = await upload(server.base, uniqueJpeg());
        const theirs = await upload(`/tvs/${other.id}`, uniqueJpeg());

        const response = await server.app.inject({ method: 'GET', url: '/backup' });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-disposition']).toMatch(/^attachment; filename="curator-backup-\d{4}-\d{2}-\d{2}\.zip"$/);
        const { files, manifest } = unzip(response.rawPayload);
        expect(manifest.tvs.map(tv => tv.name)).toEqual(['Living Room', 'Bedroom']);
        expect(Object.keys(files).sort()).toEqual(
            [`tvs/${other.id}/art/${theirs}.jpg`, `tvs/${server.tvId}/art/${mine}.jpg`, 'manifest.json'].sort(),
        );
    });

    it('backs up a TV it can’t reach from its albums and kept originals, without mattes', async () => {
        const uploaded = await upload(server.base, uniqueJpeg());
        const album = await albums.create(server.tvId, 'Favourites');
        await albums.addPieces(server.tvId, album.id, ['SAM-S0002']);
        server.tv.failOn.set('list', new Error('connect ETIMEDOUT'));

        const { files, manifest } = unzip((await server.app.inject({ method: 'GET', url: `${server.base}/backup` })).rawPayload);

        expect(manifest.tvs[0]).toMatchObject({
            listedByTv: false,
            pieces: [
                { contentId: 'SAM-S0002', categoryIds: [] },
                { contentId: uploaded, file: `tvs/${server.tvId}/art/${uploaded}.jpg`, categoryIds: [] },
            ],
        });
        expect(files[`tvs/${server.tvId}/art/${uploaded}.jpg`]).toBeDefined();
    });

    it('answers 404 for a TV that isn’t stored, and 400 for a malformed id', async () => {
        expect((await server.app.inject({ method: 'GET', url: `/tvs/${randomUUID()}/backup` })).statusCode).toBe(404);
        expect((await server.app.inject({ method: 'GET', url: '/tvs/nope/backup' })).statusCode).toBe(400);
    });
});
