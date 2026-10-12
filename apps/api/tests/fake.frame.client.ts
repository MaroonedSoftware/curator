import type { ArtItem, DeviceInfo, FrameClient, UploadOptions } from '@curator/frame';

/** An in-memory {@link FrameClient}: the TV's state as plain fields, and every call recorded. */
export class FakeFrameClient implements FrameClient {
    readonly calls: { method: string; args: unknown[] }[] = [];
    readonly art = new Map<string, ArtItem>([
        ['SAM-S0001', { contentId: 'SAM-S0001', categoryId: 'MY-C0008', raw: { content_id: 'SAM-S0001', category_id: 'MY-C0008' } }],
        ['MY-F0001', { contentId: 'MY-F0001', categoryId: 'MY-C0002', raw: { content_id: 'MY-F0001', category_id: 'MY-C0002', matte_id: 'none' } }],
    ]);
    current_ = 'SAM-S0001';
    artMode = true;
    closed = false;
    /** Thrown by the next call, then cleared. */
    failNext?: Error;

    async deviceInfo(): Promise<DeviceInfo> {
        this.record('deviceInfo');
        return { model: 'QE55LS03B', name: 'Living Room', frameTvSupport: true, powerOn: true, raw: { device: { modelName: 'QE55LS03B' } } };
    }

    async apiVersion(): Promise<string> {
        this.record('apiVersion');
        return '4.3.4.0';
    }

    async list(category?: string): Promise<ArtItem[]> {
        this.record('list', category);
        return [...this.art.values()].filter(item => !category || item.categoryId === category);
    }

    async current(): Promise<Record<string, unknown>> {
        this.record('current');
        const item = this.art.get(this.current_);
        return { content_id: this.current_, category_id: item?.categoryId, matte_id: 'none' };
    }

    async upload(image: Buffer, opts?: UploadOptions): Promise<string> {
        this.record('upload', image, opts);
        const contentId = `MY-F${String(this.art.size + 1).padStart(4, '0')}`;
        this.art.set(contentId, {
            contentId,
            categoryId: 'MY-C0002',
            raw: { content_id: contentId, category_id: 'MY-C0002', matte_id: opts?.matte ?? 'none' },
        });
        return contentId;
    }

    async select(contentId: string, opts?: { show?: boolean; category?: string }): Promise<void> {
        this.record('select', contentId, opts);
        this.current_ = contentId;
    }

    async delete(contentIds: string | string[]): Promise<void> {
        this.record('delete', contentIds);
        for (const id of Array.isArray(contentIds) ? contentIds : [contentIds]) {
            this.art.delete(id);
        }
    }

    async changeMatte(contentId: string, matte: string, portraitMatte?: string): Promise<void> {
        this.record('changeMatte', contentId, matte, portraitMatte);
    }

    async getArtMode(): Promise<boolean> {
        this.record('getArtMode');
        return this.artMode;
    }

    async setArtMode(on: boolean): Promise<void> {
        this.record('setArtMode', on);
        this.artMode = on;
    }

    async close(): Promise<void> {
        this.closed = true;
    }

    private record(method: string, ...args: unknown[]) {
        this.calls.push({ method, args });
        const failure = this.failNext;
        if (failure) {
            this.failNext = undefined;
            throw failure;
        }
    }
}
