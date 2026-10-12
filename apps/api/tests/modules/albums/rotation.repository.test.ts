import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlbumRepository } from '../../../src/modules/albums/album.repository.js';
import { RotationRepository } from '../../../src/modules/albums/rotation.repository.js';
import { createTvTestServer } from '../../test.server.js';

describe('RotationRepository', () => {
    let server: Awaited<ReturnType<typeof createTvTestServer>>;
    let rotations: RotationRepository;
    let albumId: string;

    beforeAll(async () => {
        server = await createTvTestServer(import.meta.url);
        rotations = server.container.get(RotationRepository);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('albums').execute();
        albumId = (await server.container.get(AlbumRepository).create(server.tvId, 'Halloween')).id;
    });

    afterAll(async () => {
        await server.close();
    });

    it('reports a rotation due until it first rotates, then again a whole interval later', async () => {
        await rotations.set(server.tvId, { albumId, intervalMinutes: 10 });
        expect(await rotations.due()).toEqual([server.tvId]);

        await rotations.recordRotation(server.tvId, 'MY-F0001');
        expect(await rotations.due()).toEqual([]);

        await server.db
            .updateTable('tvRotations')
            .set({ lastRotatedAt: sql`now() - interval '9 minutes'` })
            .execute();
        expect(await rotations.due()).toEqual([]);

        await server.db
            .updateTable('tvRotations')
            .set({ lastRotatedAt: sql`now() - interval '10 minutes'` })
            .execute();
        expect(await rotations.due()).toEqual([server.tvId]);
    });
});
