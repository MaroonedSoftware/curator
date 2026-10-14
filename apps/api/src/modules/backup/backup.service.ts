import type { Readable } from 'node:stream';
import type { Logger } from '@maroonedsoftware/logger';
import type { AlbumRepository } from '../albums/album.repository.js';
import type { RotationRepository } from '../albums/rotation.repository.js';
import { normalizeContentId } from '../frame/content.id.js';
import type { ListedArt } from '../frame/frame.service.js';
import type { OriginalStore } from '../frame/original.store.js';
import type { TvRow } from '../tvs/tv.repository.js';
import type { TvService } from '../tvs/tv.service.js';
import type { BackupManifest, BackupPiece, BackupTv } from './backup.manifest.js';
import { zipStream, type ZipEntry } from './zip.stream.js';
import { errorText } from '../../logging/error.text.js';

const text = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined);

/** A backup ready to download: what to call the file, and its bytes, read as they are sent. */
export interface Backup {
    fileName: string;
    stream: Readable;
}

/**
 * Backs up TVs as a zip: a {@link BackupManifest} of each TV's pieces, albums and rotation, and the
 * original of every piece curator kept one for. Everything but the images is gathered before the
 * zip starts, so a missing TV or a database failure is an error status rather than a broken download.
 */
export class BackupService {
    constructor(
        private readonly tvs: TvService,
        private readonly albums: AlbumRepository,
        private readonly rotations: RotationRepository,
        private readonly originals: OriginalStore,
        private readonly logger: Logger,
    ) {}

    /** Every stored TV. */
    async all(now = new Date()): Promise<Backup> {
        return this.backup(await this.tvs.list(), `curator-backup-${dateOf(now)}.zip`, now);
    }

    /** One TV. 404 for a TV that isn't stored. */
    async one(tvId: string, now = new Date()): Promise<Backup> {
        const tv = await this.tvs.get(tvId);
        return this.backup([tv], `curator-backup-${slugOf(tv.name)}-${dateOf(now)}.zip`, now);
    }

    private async backup(rows: TvRow[], fileName: string, now: Date): Promise<Backup> {
        const tvs: BackupTv[] = [];
        for (const row of rows) {
            tvs.push(await this.describe(row));
        }
        const manifest: BackupManifest = { format: 'curator-backup', version: 1, createdAt: now.toISOString(), tvs };
        return { fileName, stream: zipStream(this.entries(manifest), now) };
    }

    /** The TV's part of the manifest. Each piece's `file` is set here and dropped later if its original can't be read. */
    private async describe(tv: TvRow): Promise<BackupTv> {
        const listed = await this.listArt(tv);
        const albums = await Promise.all(
            (await this.albums.list(tv.id)).map(async album => ({ name: album.name, contentIds: await this.albums.pieces(tv.id, album.id) })),
        );
        const store = this.originals.forTv(tv.id);
        const kept = new Set(await store.contentIds());

        const pieces = new Map<string, BackupPiece>();
        const addPiece = (contentId: string, details: Omit<BackupPiece, 'contentId' | 'file'> = { categoryIds: [] }) => {
            const id = normalizeContentId(contentId);
            if (!pieces.has(id)) pieces.set(id, { contentId: id, ...details });
        };
        // What the TV has, then anything an album holds that it no longer lists. When the TV can't
        // be reached, its kept originals stand in for its list.
        for (const item of listed ?? []) {
            addPiece(item.contentId, {
                matte: text(item.raw.matte_id),
                portraitMatte: text(item.raw.portrait_matte_id),
                categoryIds: item.categoryIds,
            });
        }
        for (const album of albums) album.contentIds.forEach(id => addPiece(id));
        if (!listed) kept.forEach(id => addPiece(id));

        for (const piece of pieces.values()) {
            if (kept.has(piece.contentId)) piece.file = `tvs/${tv.id}/art/${piece.contentId}`;
        }

        const rotation = await this.rotations.get(tv.id);
        return {
            id: tv.id,
            name: tv.name,
            model: tv.model ?? undefined,
            listedByTv: listed !== undefined,
            pieces: [...pieces.values()],
            albums,
            rotation: rotation && { albumName: rotation.albumName, intervalMinutes: rotation.intervalMinutes, shuffle: rotation.shuffle },
        };
    }

    /** The TV's art, or undefined when it can't be reached: a backup is most wanted when something is wrong. */
    private async listArt(tv: TvRow): Promise<ListedArt[] | undefined> {
        try {
            return await (await this.tvs.frameFor(tv.id)).list();
        } catch (error) {
            this.logger.warn('backup: the TV could not be reached; backing up without its art list', { tvId: tv.id, error: errorText(error) });
            return undefined;
        }
    }

    /**
     * The originals, then the manifest, which is written last so it names only the files that made
     * it in. A `file` holds the path without its extension until the original is read.
     */
    private async *entries(manifest: BackupManifest): AsyncGenerator<ZipEntry> {
        for (const tv of manifest.tvs) {
            const store = this.originals.forTv(tv.id);
            for (const piece of tv.pieces) {
                if (!piece.file) continue;
                const original = await store.get(piece.contentId).catch((error: unknown) => {
                    this.logger.warn('backup: could not read an original; leaving its image out', {
                        tvId: tv.id,
                        contentId: piece.contentId,
                        error: errorText(error),
                    });
                    return undefined;
                });
                if (!original) {
                    // Deleted since the manifest was gathered, or unreadable: listed without an image.
                    delete piece.file;
                    continue;
                }
                piece.file = `${piece.file}.${original.fileType}`;
                yield { name: piece.file, data: original.data };
            }
        }
        yield { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, undefined, 2)), compress: true };
    }
}

const dateOf = (date: Date) => date.toISOString().slice(0, 10);

/** A TV's name as it can sit in a file name: "Living Room" is living-room. */
const slugOf = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'tv';
