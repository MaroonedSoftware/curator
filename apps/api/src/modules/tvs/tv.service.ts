import { FrameService } from '../frame/frame.service.js';
import type { FrameClientRegistry } from '../frame/frame.client.registry.js';
import type { TvRepository, TvRow } from './tv.repository.js';

/** The TVs curator manages, and the way to reach each one. */
export class TvService {
    constructor(
        private readonly tvs: TvRepository,
        private readonly clients: FrameClientRegistry,
    ) {}

    list(): Promise<TvRow[]> {
        return this.tvs.list();
    }

    get(id: string): Promise<TvRow> {
        return this.tvs.get(id);
    }

    rename(id: string, name: string): Promise<TvRow> {
        return this.tvs.rename(id, name);
    }

    /** Forgets the TV and drops its connection. The TV itself keeps its art. Resolves false if there was no such TV. */
    async remove(id: string): Promise<boolean> {
        const removed = await this.tvs.delete(id);
        await this.clients.remove(id);
        return removed;
    }

    /** The TV's own endpoints, through its client. 404 for a TV that isn't there. */
    async frameFor(id: string): Promise<FrameService> {
        const tv = await this.tvs.get(id);
        return new FrameService(this.clients.clientFor(tv));
    }
}
