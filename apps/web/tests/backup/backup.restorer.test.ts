import { describe, expect, it } from 'vitest';
import { readBackup } from '../../src/backup/backup.reader';
import { restoreTv, type RestoreProgress } from '../../src/backup/backup.restorer';
import { errorResponse, fakeApi, jsonResponse, noContent, TV_BASE, TV } from '../fake.api';
import { backupTv, backupZip } from './backup.fixture';

const album = (id: string, name: string) => ({ id, name, pieceCount: 0, createdAt: '', updatedAt: '' });

describe('restoreTv', () => {
    const tv = backupTv({
        pieces: [
            { contentId: 'SAM-S0001', categoryIds: ['MY-C0008'] },
            { contentId: 'MY-F0001', file: 'tvs/old/art/MY-F0001.jpg', matte: 'shadowbox_polar', portraitMatte: 'none', categoryIds: ['MY-C0002'] },
            { contentId: 'MY-F0002', file: 'tvs/old/art/MY-F0002.png', categoryIds: ['MY-C0002'] },
            { contentId: 'MY-F0009', categoryIds: ['MY-C0002'] },
        ],
        albums: [
            { name: 'Halloween', contentIds: ['MY-F0001', 'SAM-S0001', 'MY-F0009', 'MY-F0002'] },
            { name: 'Favourites', contentIds: ['MY-F0001'] },
        ],
        rotation: { albumName: 'Halloween', intervalMinutes: 15, shuffle: false },
    });
    const files = { 'tvs/old/art/MY-F0001.jpg': new Uint8Array([0xff, 0xd8, 1]), 'tvs/old/art/MY-F0002.png': new Uint8Array([0x89, 2]) };

    it('uploads each image with its mattes, then rebuilds the albums and rotation with the TV’s new ids', async () => {
        const requests = fakeApi({
            [`GET ${TV_BASE}/art`]: () =>
                jsonResponse({ items: [{ contentId: 'SAM-S0001', categoryId: 'MY-C0008', categoryIds: ['MY-C0008'], raw: {} }] }),
            [`POST ${TV_BASE}/art`]: request =>
                request.headers.get('content-type') === 'image/png'
                    ? errorResponse(503, 'Service Unavailable', { reason: 'the TV did not answer' })
                    : jsonResponse({ contentId: 'MY_F0042', duplicate: false }, 201),
            [`GET ${TV_BASE}/albums`]: () => jsonResponse({ items: [album('fav', 'favourites')] }),
            [`POST ${TV_BASE}/albums`]: () => jsonResponse(album('new', 'Halloween'), 201),
            [`PUT ${TV_BASE}/albums/new/pieces`]: noContent,
            [`PUT ${TV_BASE}/albums/fav/pieces`]: noContent,
            [`PUT ${TV_BASE}/rotation`]: () => jsonResponse({}),
        });
        const progress: RestoreProgress[] = [];

        const summary = await restoreTv(TV.id, tv, await readBackup(backupZip([tv], files)), p => progress.push(p));

        expect(summary).toEqual({
            uploaded: 1,
            alreadyOnTv: 0,
            failed: [{ contentId: 'MY-F0002', reason: 'the TV did not answer' }],
            albumsCreated: 1,
            albumsMerged: 1,
            piecesLeftOut: 2,
            rotationRestored: true,
        });
        const upload = requests.find(request => request.method === 'POST' && request.path === `${TV_BASE}/art`)!;
        expect(Object.fromEntries(upload.search)).toEqual({ matte: 'shadowbox_polar', portraitMatte: 'none' });
        expect(upload.headers.get('content-type')).toBe('image/jpeg');
        expect(
            requests.filter(request => request.method !== 'GET' && request.path !== `${TV_BASE}/art`).map(r => [r.method, r.path, r.body]),
        ).toEqual([
            ['POST', `${TV_BASE}/albums`, { name: 'Halloween' }],
            ['PUT', `${TV_BASE}/albums/new/pieces`, { contentIds: ['MY-F0042', 'SAM-S0001'] }],
            ['PUT', `${TV_BASE}/albums/fav/pieces`, { contentIds: ['MY-F0042'] }],
            ['PUT', `${TV_BASE}/rotation`, { albumId: 'new', intervalMinutes: 15, shuffle: false }],
        ]);
        expect(progress).toEqual([
            { step: 'images', done: 0, total: 2 },
            { step: 'images', done: 1, total: 2 },
            { step: 'albums', done: 0, total: 2 },
            { step: 'albums', done: 1, total: 2 },
        ]);
    });

    it('counts images the TV already had, and keeps pieces without an image that the TV still has', async () => {
        const requests = fakeApi({
            [`GET ${TV_BASE}/art`]: () =>
                jsonResponse({ items: [{ contentId: 'MY_F0009', categoryId: 'MY-C0002', categoryIds: ['MY-C0002'], raw: {} }] }),
            [`POST ${TV_BASE}/art`]: () => jsonResponse({ contentId: 'MY-F0001', duplicate: true }),
            [`GET ${TV_BASE}/albums`]: () => jsonResponse({ items: [album('hal', 'Halloween'), album('fav', 'Favourites')] }),
            [`PUT ${TV_BASE}/albums/hal/pieces`]: noContent,
            [`PUT ${TV_BASE}/albums/fav/pieces`]: noContent,
            [`PUT ${TV_BASE}/rotation`]: () => jsonResponse({}),
        });

        const summary = await restoreTv(TV.id, tv, await readBackup(backupZip([tv], files)));

        expect(summary).toMatchObject({ uploaded: 0, alreadyOnTv: 2, albumsCreated: 0, albumsMerged: 2, piecesLeftOut: 1 });
        expect(requests.find(request => request.path === `${TV_BASE}/albums/hal/pieces`)?.body).toEqual({ contentIds: ['MY-F0001', 'MY-F0009'] });
    });

    it('changes nothing when the TV’s art can’t be listed', async () => {
        const requests = fakeApi({ [`GET ${TV_BASE}/art`]: () => errorResponse(503, 'Service Unavailable', { reason: 'the TV is off' }) });

        await expect(restoreTv(TV.id, tv, await readBackup(backupZip([tv], files)))).rejects.toThrow();
        expect(requests).toHaveLength(1);
    });
});
