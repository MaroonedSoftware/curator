import type { ArtItem } from '@curator/frame';
import { httpError } from '@maroonedsoftware/errors';
import { normalizeContentId } from '../frame/content.id.js';
import type { TvService } from '../tvs/tv.service.js';
import type { AlbumRepository } from './album.repository.js';
import type { RotationRepository } from './rotation.repository.js';

/** Which of `contentIds` comes up next, given the one shown last. Every id is normalized. */
export const nextPiece = (
    contentIds: string[],
    last: string | undefined,
    shuffle: boolean,
    random: () => number = Math.random,
): string | undefined => {
    if (contentIds.length === 0) {
        return undefined;
    }
    if (shuffle) {
        // Never the same piece twice running, unless it is the only one.
        const others = contentIds.length > 1 ? contentIds.filter(id => id !== last) : contentIds;
        return others[Math.floor(random() * others.length)];
    }
    const index = last === undefined ? -1 : contentIds.indexOf(last);
    return contentIds[(index + 1) % contentIds.length];
};

/** Puts each TV's next album piece on screen. */
export class RotationService {
    constructor(
        private readonly rotations: RotationRepository,
        private readonly albums: AlbumRepository,
        private readonly tvs: TvService,
        private readonly random: () => number = Math.random,
    ) {}

    /**
     * Shows the TV the next piece of its album that is still on it, without switching it into art
     * mode, and resolves with that piece's id as the TV spells it. 404 when the TV isn't rotating,
     * 409 when none of the album's pieces is on the TV; the TV's own failures pass through.
     */
    async advance(tvId: string): Promise<string> {
        const rotation = await this.rotations.get(tvId);
        if (!rotation) {
            throw httpError(404).withDetails({ reason: 'the TV is not rotating' });
        }
        const frame = await this.tvs.frameFor(tvId);
        const onTv = new Map<string, ArtItem>((await frame.list()).map(item => [normalizeContentId(item.contentId), item]));
        // In album order, so an ordered rotation walks the album, skipping pieces since deleted from the TV.
        const candidates = (await this.albums.pieces(tvId, rotation.albumId)).filter(id => onTv.has(id));
        const next = nextPiece(candidates, rotation.lastContentId ?? undefined, rotation.shuffle, this.random);
        const item = next === undefined ? undefined : onTv.get(next);
        if (next === undefined || !item) {
            throw httpError(409).withDetails({ reason: `nothing in ${rotation.albumName} is on the TV` });
        }
        await frame.select(item.contentId, { show: false, category: item.categoryId });
        await this.rotations.recordRotation(tvId, next);
        return item.contentId;
    }
}
