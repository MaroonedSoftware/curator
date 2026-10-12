import type { FrameClient, TokenStore } from '@curator/frame';
import type { Identifier } from 'injectkit';
import { ThumbnailBatcher, type ThumbnailBatcherOptions } from './thumbnail.batcher.js';
import type { ThumbnailCache } from './thumbnail.cache.js';

/** Where a TV is. Enough to build a client for it. */
export interface TvAddress {
    id: string;
    host: string;
    port: number;
}

/** Builds the client for one TV. The Samsung client in production; a fake in tests. */
export type FrameClientFactory = (tv: TvAddress, tokenStore: TokenStore) => FrameClient;

export const FrameClientFactoryToken: Identifier<FrameClientFactory> = Symbol('FrameClientFactory');

/**
 * One client per TV, built on first use and kept, because a client holds the TV's art channel open
 * and queues requests to it. A TV whose address changed gets a fresh client.
 */
export class FrameClientRegistry {
    private readonly clients = new Map<string, { client: FrameClient; thumbnails: ThumbnailBatcher; host: string; port: number }>();

    constructor(
        private readonly factory: FrameClientFactory,
        private readonly tokenStoreFor: (tvId: string) => TokenStore,
        private readonly thumbnailCache: ThumbnailCache,
        private readonly thumbnailOptions: ThumbnailBatcherOptions = { windowMs: 25, maxBatch: 24 },
    ) {}

    clientFor(tv: TvAddress): FrameClient {
        return this.entryFor(tv).client;
    }

    /** The TV's thumbnails, batched through its client and cached. */
    thumbnailsFor(tv: TvAddress): ThumbnailBatcher {
        return this.entryFor(tv).thumbnails;
    }

    private entryFor(tv: TvAddress) {
        const existing = this.clients.get(tv.id);
        if (existing && existing.host === tv.host && existing.port === tv.port) {
            return existing;
        }
        if (existing) {
            void existing.client.close();
        }
        const client = this.factory({ id: tv.id, host: tv.host, port: tv.port }, this.tokenStoreFor(tv.id));
        const entry = {
            client,
            thumbnails: new ThumbnailBatcher(tv.id, client, this.thumbnailCache, this.thumbnailOptions),
            host: tv.host,
            port: tv.port,
        };
        this.clients.set(tv.id, entry);
        return entry;
    }

    /** Closes and forgets a TV's client, if it has one. */
    async remove(tvId: string): Promise<void> {
        const existing = this.clients.get(tvId);
        this.clients.delete(tvId);
        this.thumbnailCache.dropTv(tvId);
        await existing?.client.close();
    }

    async closeAll(): Promise<void> {
        const clients = [...this.clients.values()];
        this.clients.clear();
        await Promise.all(clients.map(({ client }) => client.close()));
    }
}
