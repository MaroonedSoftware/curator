import { httpError } from '@maroonedsoftware/errors';
import { sql, type Kysely, type Selectable } from 'kysely';
import type { Albums, DB } from '../data/db.js';
import { normalizeContentId } from '../frame/content.id.js';

/** A row of `albums`, with how many pieces it holds and the first of them. */
export type AlbumRow = Selectable<Albums> & {
    pieceCount: number;
    /** The album's first piece, to show as its cover. Absent for an empty album. */
    coverContentId?: string;
};

/** Postgres's unique_violation: here, an album name already used on that TV. */
const isUniqueViolation = (error: unknown) => typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

const notFound = (id: string) => httpError(404).withDetails({ reason: `no album with id ${id}` });
const nameTaken = (name: string) => httpError(409).withDetails({ reason: `there is already an album called ${name}` });

/**
 * Reads and writes `albums` and `album_pieces`. Every album is read through its TV, so an album id
 * from another TV answers 404 just as an unknown one does. Content ids are stored normalized.
 */
export class AlbumRepository {
    constructor(private readonly db: Kysely<DB>) {}

    private summaries(tvId: string) {
        return this.db
            .selectFrom('albums')
            .selectAll('albums')
            .select(eb => [
                eb
                    .selectFrom('albumPieces')
                    .whereRef('albumPieces.albumId', '=', 'albums.id')
                    .select(sql<number>`count(*)::int`.as('n'))
                    .as('pieceCount'),
                eb
                    .selectFrom('albumPieces')
                    .whereRef('albumPieces.albumId', '=', 'albums.id')
                    .select('contentId')
                    .orderBy('position')
                    .limit(1)
                    .as('coverContentId'),
            ])
            .where('albums.tvId', '=', tvId);
    }

    async list(tvId: string): Promise<AlbumRow[]> {
        const rows = await this.summaries(tvId)
            .orderBy(sql`lower(albums.name)`)
            .orderBy('albums.id')
            .execute();
        return rows.map(toAlbumRow);
    }

    async get(tvId: string, id: string): Promise<AlbumRow> {
        const row = await this.summaries(tvId).where('albums.id', '=', id).executeTakeFirst();
        if (!row) {
            throw notFound(id);
        }
        return toAlbumRow(row);
    }

    /** 409 when the TV already has an album by that name, in any case. */
    async create(tvId: string, name: string): Promise<AlbumRow> {
        try {
            const { id } = await this.db.insertInto('albums').values({ tvId, name }).returning('id').executeTakeFirstOrThrow();
            return await this.get(tvId, id);
        } catch (error) {
            throw isUniqueViolation(error) ? nameTaken(name) : error;
        }
    }

    async rename(tvId: string, id: string, name: string): Promise<AlbumRow> {
        try {
            const updated = await this.db
                .updateTable('albums')
                .set({ name, updatedAt: sql`now()` })
                .where('id', '=', id)
                .where('tvId', '=', tvId)
                .executeTakeFirst();
            if (updated.numUpdatedRows === 0n) {
                throw notFound(id);
            }
        } catch (error) {
            throw isUniqueViolation(error) ? nameTaken(name) : error;
        }
        return this.get(tvId, id);
    }

    /** Resolves false when the TV has no such album. Its pieces go with it. */
    async delete(tvId: string, id: string): Promise<boolean> {
        const result = await this.db.deleteFrom('albums').where('id', '=', id).where('tvId', '=', tvId).executeTakeFirst();
        return result.numDeletedRows > 0n;
    }

    /** The album's content ids, in album order. */
    async pieces(tvId: string, id: string): Promise<string[]> {
        await this.get(tvId, id);
        const rows = await this.db.selectFrom('albumPieces').select('contentId').where('albumId', '=', id).orderBy('position').execute();
        return rows.map(row => row.contentId);
    }

    /** Appends pieces in the order given. A piece already in the album keeps its place. */
    async addPieces(tvId: string, id: string, contentIds: string[]): Promise<void> {
        await this.get(tvId, id);
        const ids = [...new Set(contentIds.map(normalizeContentId))];
        if (ids.length === 0) {
            return;
        }
        await this.db.transaction().execute(async trx => {
            // Locks the album so two concurrent adds don't hand out the same positions.
            await trx.selectFrom('albums').select('id').where('id', '=', id).forUpdate().execute();
            const { last } = await trx
                .selectFrom('albumPieces')
                .select(sql<number>`coalesce(max(position), -1)::int`.as('last'))
                .where('albumId', '=', id)
                .executeTakeFirstOrThrow();
            await trx
                .insertInto('albumPieces')
                .values(ids.map((contentId, i) => ({ albumId: id, contentId, position: last + 1 + i })))
                .onConflict(oc => oc.columns(['albumId', 'contentId']).doNothing())
                .execute();
            await trx
                .updateTable('albums')
                .set({ updatedAt: sql`now()` })
                .where('id', '=', id)
                .execute();
        });
    }

    /**
     * Points every album of the TV that holds `oldId` at `newId` instead, in the same place. An album
     * already holding `newId` just loses `oldId`, since a piece is in an album at most once.
     */
    async replacePiece(tvId: string, oldId: string, newId: string): Promise<void> {
        const [from, to] = [normalizeContentId(oldId), normalizeContentId(newId)];
        if (from === to) return;
        await this.db.transaction().execute(async trx => {
            const albumsOfTv = trx.selectFrom('albums').select('id').where('tvId', '=', tvId);
            const holdingNew = trx.selectFrom('albumPieces').select('albumId').where('contentId', '=', to);
            await trx
                .deleteFrom('albumPieces')
                .where('contentId', '=', from)
                .where('albumId', 'in', albumsOfTv)
                .where('albumId', 'in', holdingNew)
                .execute();
            await trx.updateTable('albumPieces').set({ contentId: to }).where('contentId', '=', from).where('albumId', 'in', albumsOfTv).execute();
        });
    }

    /** Resolves false when the piece was not in the album. */
    async removePiece(tvId: string, id: string, contentId: string): Promise<boolean> {
        await this.get(tvId, id);
        const result = await this.db
            .deleteFrom('albumPieces')
            .where('albumId', '=', id)
            .where('contentId', '=', normalizeContentId(contentId))
            .executeTakeFirst();
        return result.numDeletedRows > 0n;
    }
}

const toAlbumRow = ({
    pieceCount,
    coverContentId,
    ...album
}: Selectable<Albums> & { pieceCount: number | null; coverContentId: string | null }): AlbumRow => ({
    ...album,
    pieceCount: pieceCount ?? 0,
    coverContentId: coverContentId ?? undefined,
});
