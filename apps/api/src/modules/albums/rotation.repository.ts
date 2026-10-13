import { sql, type Kysely, type Selectable } from 'kysely';
import type { DB, TvRotations } from '../data/db.js';

/** A row of `tv_rotations`, with the album's name. */
export type RotationRow = Selectable<TvRotations> & { albumName: string };

export interface RotationSetting {
    albumId: string;
    /** Left as it is when absent: 30 for a new rotation. */
    intervalMinutes?: number;
    /** Left as it is when absent: on for a new rotation. */
    shuffle?: boolean;
}

/** Reads and writes `tv_rotations`: which album each TV cycles through, how, and how far it has got. */
export class RotationRepository {
    constructor(private readonly db: Kysely<DB>) {}

    private rows() {
        return this.db
            .selectFrom('tvRotations')
            .innerJoin('albums', 'albums.id', 'tvRotations.albumId')
            .selectAll('tvRotations')
            .select('albums.name as albumName');
    }

    get(tvId: string): Promise<RotationRow | undefined> {
        return this.rows().where('tvRotations.tvId', '=', tvId).executeTakeFirst();
    }

    /**
     * Starts or changes a TV's rotation. The album is trusted to be the TV's. Switching to another
     * album starts it afresh, so its first piece comes up at the next tick.
     */
    async set(tvId: string, { albumId, intervalMinutes, shuffle }: RotationSetting): Promise<RotationRow> {
        await this.db
            .insertInto('tvRotations')
            .values({ tvId, albumId, intervalMinutes, shuffle })
            .onConflict(oc =>
                oc.column('tvId').doUpdateSet(eb => ({
                    albumId: eb.ref('excluded.albumId'),
                    intervalMinutes: intervalMinutes ?? eb.ref('tvRotations.intervalMinutes'),
                    shuffle: shuffle ?? eb.ref('tvRotations.shuffle'),
                    lastContentId: sql`case when tv_rotations.album_id = excluded.album_id then tv_rotations.last_content_id end`,
                    lastRotatedAt: sql`case when tv_rotations.album_id = excluded.album_id then tv_rotations.last_rotated_at end`,
                    shownThisRound: sql`case when tv_rotations.album_id = excluded.album_id then tv_rotations.shown_this_round else '{}' end`,
                    updatedAt: sql`now()`,
                })),
            )
            .execute();
        const row = await this.get(tvId);
        if (!row) {
            throw new Error(`the rotation of TV ${tvId} vanished as it was written`);
        }
        return row;
    }

    /** The TVs whose next piece is due: never rotated yet, or a whole interval since they last did. */
    async due(): Promise<string[]> {
        const rows = await this.db
            .selectFrom('tvRotations')
            .select('tvId')
            .where(eb =>
                eb.or([eb('lastRotatedAt', 'is', null), eb(sql`last_rotated_at + interval_minutes * interval '1 minute'`, '<=', sql`now()`)]),
            )
            .execute();
        return rows.map(row => row.tvId);
    }

    /** Carries the rotation's progress over to a piece that replaced one it showed: as the last piece, and as shown this round. */
    async replacePiece(tvId: string, oldId: string, newId: string): Promise<void> {
        await this.db
            .updateTable('tvRotations')
            .set(eb => ({
                lastContentId: eb.case().when('lastContentId', '=', oldId).then(newId).else(eb.ref('lastContentId')).end(),
                shownThisRound: sql`array_replace(shown_this_round, ${oldId}, ${newId})`,
            }))
            .where('tvId', '=', tvId)
            .execute();
    }

    /** Resolves false when the TV had no rotation. */
    async clear(tvId: string): Promise<boolean> {
        const result = await this.db.deleteFrom('tvRotations').where('tvId', '=', tvId).executeTakeFirst();
        return result.numDeletedRows > 0n;
    }

    /** Notes what the rotation just put on screen, and which pieces have now been shown this round. */
    async recordRotation(tvId: string, contentId: string, shownThisRound: string[]): Promise<void> {
        await this.db
            .updateTable('tvRotations')
            .set({ lastContentId: contentId, lastRotatedAt: sql`now()`, shownThisRound })
            .where('tvId', '=', tvId)
            .execute();
    }
}
