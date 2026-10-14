import { httpError } from '@maroonedsoftware/errors';
import type { Logger } from '@maroonedsoftware/logger';
import { normalizeContentId } from '../frame/content.id.js';
import { type ListedArt, MY_PHOTOS, type Uploaded } from '../frame/frame.service.js';
import type { TvService } from '../tvs/tv.service.js';
import type { AlbumRepository } from './album.repository.js';
import type { RotationRepository } from './rotation.repository.js';
import { errorText } from '../../logging/error.text.js';

/** Uploads are ours to replace: anything in My Photos, or with an upload's id. The Art Store's pieces can't be deleted. */
const isUpload = (item: ListedArt) => item.categoryIds.includes(MY_PHOTOS) || /^MY[-_]F/.test(item.contentId);

const text = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined);

/**
 * Swaps a piece's image. The TV can't overwrite one in place, so the new image is uploaded with the
 * old piece's mattes, takes the old piece's place in every album and in the rotation, goes on
 * screen if the old one was there, and the old piece is deleted.
 */
export class ArtReplacer {
    constructor(
        private readonly tvs: TvService,
        private readonly albums: AlbumRepository,
        private readonly rotations: RotationRepository,
        private readonly logger: Logger,
    ) {}

    /**
     * Resolves with the piece now standing in for `contentId`, as {@link FrameService.upload} answers
     * it: `duplicate` when the TV already had the new image. 404 for a piece the TV doesn't have, 422
     * for one that isn't an upload. Failing to delete the old piece is only logged: by then the new
     * one has taken its place, and a retry would upload it again.
     */
    async replace(tvId: string, contentId: string, image: Buffer, fileType: 'jpg' | 'png'): Promise<Uploaded> {
        const frame = await this.tvs.frameFor(tvId);
        const old = (await frame.list()).find(item => normalizeContentId(item.contentId) === normalizeContentId(contentId));
        if (!old) {
            throw httpError(404).withDetails({ reason: `the TV has no piece ${contentId}` });
        }
        if (!isUpload(old)) {
            throw httpError(422).withDetails({ reason: `${old.contentId} is from the Art Store; only uploads can be replaced` });
        }
        const onScreen = (await frame.current()).contentId;

        const uploaded = await frame.upload(image, { fileType, matte: text(old.raw.matte_id), portraitMatte: text(old.raw.portrait_matte_id) });
        const [from, to] = [normalizeContentId(old.contentId), normalizeContentId(uploaded.contentId)];
        if (from === to) {
            // The same image again: there is nothing to swap.
            return uploaded;
        }

        await this.albums.replacePiece(tvId, from, to);
        await this.rotations.replacePiece(tvId, from, to);
        if (onScreen !== undefined && normalizeContentId(onScreen) === from) {
            // As the rotation does: a TV only repaints for `show`, which also switches it into art mode, so
            // show the new piece when art mode is already on, and otherwise only select it.
            await frame.select(uploaded.contentId, { show: await frame.getArtMode(), category: MY_PHOTOS });
        }
        try {
            await frame.delete(old.contentId);
        } catch (error) {
            this.logger.warn('replace: replaced a piece, but could not delete the old one', {
                tvId,
                from: old.contentId,
                to: uploaded.contentId,
                error: errorText(error),
            });
        }
        return uploaded;
    }
}
