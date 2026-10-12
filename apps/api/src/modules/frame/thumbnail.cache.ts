import type { Thumbnail } from '@curator/frame';

/**
 * Thumbnails kept in memory, least recently used first out once `maxBytes` is passed. A content id
 * names one image for good (re-uploading makes a new id), so an entry never goes stale; only its
 * TV's removal or memory pressure drops it.
 */
export class ThumbnailCache {
    private readonly entries = new Map<string, Thumbnail>();
    private bytes = 0;

    constructor(private readonly maxBytes: number) {}

    get(tvId: string, contentId: string): Thumbnail | undefined {
        const key = `${tvId}:${contentId}`;
        const thumbnail = this.entries.get(key);
        if (thumbnail) {
            // Re-inserting moves it to the back of the Map's order: most recently used.
            this.entries.delete(key);
            this.entries.set(key, thumbnail);
        }
        return thumbnail;
    }

    set(tvId: string, contentId: string, thumbnail: Thumbnail): void {
        if (thumbnail.data.length > this.maxBytes) return;
        const key = `${tvId}:${contentId}`;
        this.delete(key);
        this.entries.set(key, thumbnail);
        this.bytes += thumbnail.data.length;
        for (const oldest of this.entries.keys()) {
            if (this.bytes <= this.maxBytes) break;
            this.delete(oldest);
        }
    }

    /** Forgets every thumbnail of a TV. */
    dropTv(tvId: string): void {
        for (const key of [...this.entries.keys()]) {
            if (key.startsWith(`${tvId}:`)) this.delete(key);
        }
    }

    get size(): { entries: number; bytes: number } {
        return { entries: this.entries.size, bytes: this.bytes };
    }

    private delete(key: string) {
        const existing = this.entries.get(key);
        if (existing) {
            this.bytes -= existing.data.length;
            this.entries.delete(key);
        }
    }
}
