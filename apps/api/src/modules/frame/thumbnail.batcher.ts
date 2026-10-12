import type { FrameClient, Thumbnail } from '@curator/frame';
import type { ThumbnailCache } from './thumbnail.cache.js';

export interface ThumbnailBatcherOptions {
    /** How long to wait for more requests before asking the TV. */
    windowMs: number;
    /** Ask at once when this many are waiting. */
    maxBatch: number;
}

/**
 * One TV's thumbnails, fetched in batches. A library page asks for dozens at once and the TV
 * answers one request at a time, so ids requested within `windowMs` of each other share one
 * `get_thumbnail_list`. Answers are cached, and a second request for an id already on its way
 * waits for the same answer.
 */
export class ThumbnailBatcher {
    private readonly inFlight = new Map<string, Promise<Thumbnail | undefined>>();
    private waiting = new Map<string, { resolve: (thumbnail: Thumbnail | undefined) => void; reject: (error: unknown) => void }>();
    private timer: NodeJS.Timeout | undefined;

    constructor(
        private readonly tvId: string,
        private readonly client: FrameClient,
        private readonly cache: ThumbnailCache,
        private readonly options: ThumbnailBatcherOptions,
    ) {}

    /** Resolves undefined when the TV has no thumbnail for the id. */
    get(contentId: string): Promise<Thumbnail | undefined> {
        const cached = this.cache.get(this.tvId, contentId);
        if (cached) return Promise.resolve(cached);
        const existing = this.inFlight.get(contentId);
        if (existing) return existing;

        const promise = new Promise<Thumbnail | undefined>((resolve, reject) => this.waiting.set(contentId, { resolve, reject }));
        this.inFlight.set(contentId, promise);
        void promise.catch(() => undefined).finally(() => this.inFlight.delete(contentId));

        if (this.waiting.size >= this.options.maxBatch) {
            this.flush();
        } else {
            this.timer ??= setTimeout(() => this.flush(), this.options.windowMs);
        }
        return promise;
    }

    private flush() {
        clearTimeout(this.timer);
        this.timer = undefined;
        const batch = this.waiting;
        this.waiting = new Map();
        if (batch.size === 0) return;

        this.client.thumbnails([...batch.keys()]).then(
            thumbnails => {
                for (const [contentId, waiter] of batch) {
                    const thumbnail = thumbnails.get(contentId);
                    if (thumbnail) this.cache.set(this.tvId, contentId, thumbnail);
                    waiter.resolve(thumbnail);
                }
            },
            error => {
                for (const waiter of batch.values()) waiter.reject(error);
            },
        );
    }
}
