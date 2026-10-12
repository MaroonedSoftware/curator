import type { ArtItem, DeviceInfo, FrameClient } from '@curator/frame';
import { toHttpError } from './frame.http.errors.js';

/** The artwork on screen. `contentId` is absent when the TV did not say. */
export interface CurrentArt {
    contentId?: string;
    categoryId?: string;
    raw: Record<string, unknown>;
}

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);

/**
 * The API's view of the TV: the {@link FrameClient} with its errors translated to HTTP errors and
 * its replies shaped for the wire. Routes go through this, never the client directly.
 */
export class FrameService {
    constructor(private readonly client: FrameClient) {}

    deviceInfo(): Promise<DeviceInfo> {
        return this.call(() => this.client.deviceInfo());
    }

    apiVersion(): Promise<string> {
        return this.call(() => this.client.apiVersion());
    }

    list(category?: string): Promise<ArtItem[]> {
        return this.call(() => this.client.list(category));
    }

    async current(): Promise<CurrentArt> {
        const raw = await this.call(() => this.client.current());
        return { contentId: optionalString(raw.content_id), categoryId: optionalString(raw.category_id), raw };
    }

    getArtMode(): Promise<boolean> {
        return this.call(() => this.client.getArtMode());
    }

    private async call<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            throw toHttpError(error);
        }
    }
}
