import { Kysely, sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DB } from '../../../src/modules/data/db.js';
import { createTestServer } from '../../test.server.js';

describe('DataModule', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
    });

    afterAll(async () => {
        await server.close();
    });

    it('connects to the migrated database', async () => {
        const db = server.container.get(Kysely<DB>);

        const { rows } = await sql<{ name: string }>`select current_database() as name`.execute(db);

        expect(rows[0]?.name).toBe(server.dbName);
        await expect(db.selectFrom('tvs').selectAll().execute()).resolves.toEqual([]);
    });

    it('stores a TV, generating its id and timestamps, and reads absent columns back as undefined', async () => {
        const db = server.container.get(Kysely<DB>);

        const tv = await db.insertInto('tvs').values({ name: 'Living Room', host: '192.168.1.50' }).returningAll().executeTakeFirstOrThrow();

        expect(tv).toMatchObject({ name: 'Living Room', host: '192.168.1.50', port: 8002, id: expect.any(String) });
        expect(tv.model).toBeUndefined();
        expect(tv.token).toBeUndefined();
        expect(tv.createdAt.isValid).toBe(true);
    });

    it('refuses the same TV twice', async () => {
        const db = server.container.get(Kysely<DB>);
        await db.insertInto('tvs').values({ name: 'Bedroom', host: '192.168.1.60' }).execute();

        await expect(db.insertInto('tvs').values({ name: 'Bedroom again', host: '192.168.1.60' }).execute()).rejects.toThrow(/tvs_host_port_unique/);
    });
});
