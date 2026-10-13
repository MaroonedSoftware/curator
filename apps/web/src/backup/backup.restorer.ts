import { ApiError, normalizeContentId, tvApi } from '../api/api.client';
import type { BackupTv, OpenedBackup } from './backup.reader';

/** How far a restore has got: uploading images, then filling albums. */
export interface RestoreProgress {
    step: 'images' | 'albums';
    done: number;
    total: number;
}

/** What a restore did. Failures are reported here rather than thrown, so one bad image never stops the rest. */
export interface RestoreSummary {
    /** Images the TV took as new pieces. */
    uploaded: number;
    /** Images the TV already had, which weren't sent again. */
    alreadyOnTv: number;
    /** Images that failed, by the content id they had when backed up, with why. */
    failed: { contentId: string; reason: string }[];
    albumsCreated: number;
    /** Albums the TV already had by that name, which the backup's pieces were added to. */
    albumsMerged: number;
    /** Album pieces left out: uploads with no image in the backup that the TV doesn't have either. */
    piecesLeftOut: number;
    rotationRestored: boolean;
}

/** As the API takes them in one request. */
const MAX_PIECES_PER_ADD = 500;

const reasonOf = (error: unknown) =>
    error instanceof ApiError ? (error.reason ?? error.message) : error instanceof Error ? error.message : String(error);

/**
 * Restores one backed-up TV onto the stored TV `tvId`, through the same endpoints the app uses. A
 * re-upload gets a new content id, so each image is uploaded first, with its mattes, and albums and
 * the rotation are rebuilt with the new ids. An album the TV already has by that name gets the
 * backup's pieces added to it. Restoring twice is harmless: the API recognises an image the TV
 * already has, and a piece already in an album keeps its place.
 *
 * Rejects when the TV's art list can't be read (the TV is off, say), before anything changes, or when
 * an album or the rotation can't be written. A failed image is only counted in the summary.
 */
export async function restoreTv(
    tvId: string,
    tv: BackupTv,
    backup: OpenedBackup,
    onProgress?: (progress: RestoreProgress) => void,
): Promise<RestoreSummary> {
    const client = tvApi(tvId);
    const onTv = new Set((await client.listArt()).map(item => normalizeContentId(item.contentId)));
    const summary: RestoreSummary = {
        uploaded: 0,
        alreadyOnTv: 0,
        failed: [],
        albumsCreated: 0,
        albumsMerged: 0,
        piecesLeftOut: 0,
        rotationRestored: false,
    };

    /** The backup's content ids, by what they are on this TV now. */
    const restored = new Map<string, string>();
    const images = tv.pieces.filter(piece => piece.file !== undefined);
    for (const [i, piece] of images.entries()) {
        onProgress?.({ step: 'images', done: i, total: images.length });
        try {
            const uploaded = await client.uploadArt(backup.image(piece.file!), { matte: piece.matte, portraitMatte: piece.portraitMatte });
            restored.set(piece.contentId, normalizeContentId(uploaded.contentId));
            if (uploaded.duplicate) summary.alreadyOnTv++;
            else summary.uploaded++;
        } catch (error) {
            summary.failed.push({ contentId: piece.contentId, reason: reasonOf(error) });
        }
    }
    // A piece with no image is kept only if this TV has it: an Art Store piece, or the same TV restored.
    const resolve = (contentId: string) => restored.get(contentId) ?? (onTv.has(contentId) ? contentId : undefined);

    const existing = new Map((await client.albums()).map(album => [album.name.toLowerCase(), album.id]));
    const albumIds = new Map<string, string>();
    for (const [i, album] of tv.albums.entries()) {
        onProgress?.({ step: 'albums', done: i, total: tv.albums.length });
        let albumId = existing.get(album.name.toLowerCase());
        if (albumId) {
            summary.albumsMerged++;
        } else {
            albumId = (await client.createAlbum(album.name)).id;
            summary.albumsCreated++;
        }
        albumIds.set(album.name.toLowerCase(), albumId);

        const resolved = album.contentIds.map(resolve);
        summary.piecesLeftOut += resolved.filter(id => id === undefined).length;
        // Two backed-up pieces can be one piece on this TV, when their images were the same.
        const contentIds = [...new Set(resolved.filter((id): id is string => id !== undefined))];
        for (let start = 0; start < contentIds.length; start += MAX_PIECES_PER_ADD) {
            await client.addToAlbum(albumId, contentIds.slice(start, start + MAX_PIECES_PER_ADD));
        }
    }

    const rotation = tv.rotation;
    const rotationAlbumId = rotation && albumIds.get(rotation.albumName.toLowerCase());
    if (rotation && rotationAlbumId) {
        await client.setRotation({ albumId: rotationAlbumId, intervalMinutes: rotation.intervalMinutes, shuffle: rotation.shuffle });
        summary.rotationRestored = true;
    }
    return summary;
}
