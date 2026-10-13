import { httpError } from '@maroonedsoftware/errors';
import { normalizeContentId } from '../frame/content.id.js';
import { type ListedArt, MY_PHOTOS } from '../frame/frame.service.js';
import type { TvService } from '../tvs/tv.service.js';
import type { AlbumRepository } from './album.repository.js';
import type { RotationRepository } from './rotation.repository.js';

/** Where a rotation has got to: the piece it showed last, and the pieces it has shown this round. */
export interface RotationProgress {
    last?: string;
    shownThisRound: string[];
}

/** The piece that comes up next, and the pieces shown this round once it has. */
export interface NextPiece {
    contentId: string;
    shownThisRound: string[];
}

/**
 * Which of `contentIds` comes up next. In order, the one after the last, wrapping. Shuffled, a random one not yet
 * shown this round, so every piece comes up once before any comes up again; a new round never opens with the piece
 * that closed the last, unless it is the only one. Pieces added mid-round join it; removed ones drop out. Every id is normalized.
 */
export const nextPiece = (
    contentIds: string[],
    { last, shownThisRound }: RotationProgress,
    shuffle: boolean,
    random: () => number = Math.random,
): NextPiece | undefined => {
    if (contentIds.length === 0) {
        return undefined;
    }
    if (!shuffle) {
        const index = last === undefined ? -1 : contentIds.indexOf(last);
        return { contentId: contentIds[(index + 1) % contentIds.length]!, shownThisRound: [] };
    }
    const shown = new Set(shownThisRound);
    let round = shownThisRound.filter(id => contentIds.includes(id));
    let left = contentIds.filter(id => !shown.has(id));
    if (left.length === 0) {
        round = [];
        left = contentIds.length > 1 ? contentIds.filter(id => id !== last) : contentIds;
    }
    const contentId = left[Math.floor(random() * left.length)]!;
    return { contentId, shownThisRound: [...round, contentId] };
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
     * Shows the TV the next piece of its album that is still on it, and resolves with that piece's id as the TV spells it. 404 when the TV isn't rotating,
     * 409 when none of the album's pieces is on the TV; the TV's own failures pass through.
     */
    async advance(tvId: string): Promise<string> {
        const rotation = await this.rotations.get(tvId);
        if (!rotation) {
            throw httpError(404).withDetails({ reason: 'the TV is not rotating' });
        }
        const frame = await this.tvs.frameFor(tvId);
        const onTv = new Map<string, ListedArt>((await frame.list()).map(item => [normalizeContentId(item.contentId), item]));
        // In album order, so an ordered rotation walks the album, skipping pieces since deleted from the TV.
        const candidates = (await this.albums.pieces(tvId, rotation.albumId)).filter(id => onTv.has(id));
        const progress = { last: rotation.lastContentId ?? undefined, shownThisRound: rotation.shownThisRound };
        const next = nextPiece(candidates, progress, rotation.shuffle, this.random);
        const item = next === undefined ? undefined : onTv.get(next.contentId);
        if (next === undefined || !item) {
            throw httpError(409).withDetails({ reason: `nothing in ${rotation.albumName} is on the TV` });
        }
        // A TV only repaints for `show`, which also switches it into art mode: so show the piece when art
        // mode is already on, and otherwise only select it, ready for when art mode comes back.
        const show = await frame.getArtMode();
        // A 2025 Frame lists uploads under MY-C0008 as well as My Photos, but only selects them from My Photos.
        const category = item.categoryIds.includes(MY_PHOTOS) ? MY_PHOTOS : item.categoryId;
        await frame.select(item.contentId, { show, category });
        await this.rotations.recordRotation(tvId, next.contentId, next.shownThisRound);
        return item.contentId;
    }
}
