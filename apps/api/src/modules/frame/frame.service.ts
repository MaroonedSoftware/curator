import type { ArtItem, DeviceInfo, FrameClient, Thumbnail, UploadOptions } from '@curator/frame';
import { httpError } from '@maroonedsoftware/errors';
import type { Logger } from '@maroonedsoftware/logger';
import type { TvOriginals } from './original.store.js';
import type { ThumbnailBatcher } from './thumbnail.batcher.js';
import { toHttpError } from './frame.http.errors.js';

/** The artwork on screen. `contentId` is absent when the TV did not say. */
/** A piece of art, once, with every category the TV lists it in. */
export interface ListedArt extends ArtItem {
    /** In the order the TV listed them; `categoryId` is the first. */
    categoryIds: string[];
}

/**
 * Folds the TV's list into one entry per piece. Some firmware lists a piece once per category it
 * is in, and sometimes twice in one (a 2025 Frame lists uploads under both MY-C0002 and MY-C0008).
 * The first entry's details are kept.
 */
export function uniqueArt(items: ArtItem[]): ListedArt[] {
    const byId = new Map<string, ListedArt>();
    for (const item of items) {
        const existing = byId.get(item.contentId);
        if (!existing) {
            byId.set(item.contentId, { ...item, categoryIds: [item.categoryId] });
        } else if (!existing.categoryIds.includes(item.categoryId)) {
            existing.categoryIds.push(item.categoryId);
        }
    }
    return [...byId.values()];
}

export interface CurrentArt {
    contentId?: string;
    categoryId?: string;
    raw: Record<string, unknown>;
}

/** Where a TV's uploads are kept, and where to report a failure to keep one. */
export interface KeptOriginals {
    store: TvOriginals;
    logger: Logger;
}

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);

/**
 * The API's view of the TV: the {@link FrameClient} with its errors translated to HTTP errors and
 * its replies shaped for the wire. Routes go through this, never the client directly.
 */
export class FrameService {
    constructor(
        private readonly client: FrameClient,
        /** Absent for a short-lived client, such as the one `POST /tvs` pairs with. */
        private readonly thumbnails?: ThumbnailBatcher,
        /** Absent for the same short-lived clients: they never upload. */
        private readonly originals?: KeptOriginals,
    ) {}

    /** A piece's thumbnail. 404 when the TV has none for it. */
    async thumbnail(contentId: string): Promise<Thumbnail> {
        const batcher = this.thumbnails;
        const thumbnail = batcher
            ? await this.call(() => batcher.get(contentId))
            : (await this.call(() => this.client.thumbnails([contentId]))).get(contentId);
        if (!thumbnail) {
            throw httpError(404).withDetails({ reason: `the TV has no thumbnail for ${contentId}` });
        }
        return thumbnail;
    }

    deviceInfo(): Promise<DeviceInfo> {
        return this.call(() => this.client.deviceInfo());
    }

    apiVersion(): Promise<string> {
        return this.call(() => this.client.apiVersion());
    }

    async list(category?: string): Promise<ListedArt[]> {
        return uniqueArt(await this.call(() => this.client.list(category)));
    }

    async current(): Promise<CurrentArt> {
        const raw = await this.call(() => this.client.current());
        return { contentId: optionalString(raw.content_id), categoryId: optionalString(raw.category_id), raw };
    }

    getArtMode(): Promise<boolean> {
        return this.call(() => this.client.getArtMode());
    }

    /**
     * Resolves with the TV-assigned content id once the TV announces the image, and keeps the image
     * on disk. Failing to keep it is only logged: the TV has the image by then, so an error would
     * invite a retry that puts a second copy on the TV.
     */
    async upload(image: Buffer, opts: UploadOptions & Required<Pick<UploadOptions, 'fileType'>>): Promise<string> {
        const contentId = await this.call(() => this.client.upload(image, opts));
        try {
            await this.originals?.store.save(contentId, opts.fileType, image);
        } catch (error) {
            this.originals?.logger.error(`could not keep the original of ${contentId}`, error);
        }
        return contentId;
    }

    // The writes below are fire-and-forget on the TV's side: they resolve once the request is
    // sent, even if the TV never acknowledges it. Only an unreachable TV fails them.

    select(contentId: string, opts: { show?: boolean; category?: string }): Promise<void> {
        return this.call(() => this.client.select(contentId, opts));
    }

    /** Deletes the piece from the TV, then its kept original. Failing the latter is only logged. */
    async delete(contentId: string): Promise<void> {
        await this.call(() => this.client.delete(contentId));
        try {
            await this.originals?.store.delete(contentId);
        } catch (error) {
            this.originals?.logger.error(`could not delete the original of ${contentId}`, error);
        }
    }

    changeMatte(contentId: string, matte: string, portraitMatte?: string): Promise<void> {
        return this.call(() => this.client.changeMatte(contentId, matte, portraitMatte));
    }

    setArtMode(on: boolean): Promise<void> {
        return this.call(() => this.client.setArtMode(on));
    }

    private async call<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            throw toHttpError(error);
        }
    }
}
