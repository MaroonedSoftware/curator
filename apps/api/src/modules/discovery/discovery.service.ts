import { MemoryTokenStore } from '@curator/frame';
import { FrameService } from '../frame/frame.service.js';
import type { FrameClientFactory } from '../frame/frame.client.registry.js';
import type { TvRepository } from '../tvs/tv.repository.js';
import { SAMSUNG_SEARCH_TARGETS, type SsdpSearch } from './ssdp.search.js';

/** A Frame found on the network. `tvId` is set when it is already added. */
export interface DiscoveredTv {
    host: string;
    port: number;
    name?: string;
    model?: string;
    tvId?: string;
}

/** The port discovered TVs are reached on: the TLS port modern Frames want. */
const FRAME_PORT = 8002;

/** Finds Frame TVs on the local network. Nothing is stored; `POST /tvs` adds one. */
export class DiscoveryService {
    constructor(
        private readonly search: SsdpSearch,
        private readonly createClient: FrameClientFactory,
        private readonly tvs: TvRepository,
        private readonly timeoutMs: number,
    ) {}

    /**
     * Asks the network for Samsung TVs, then asks each one whether it is a Frame. A responder that
     * doesn't answer, or isn't a Frame, is left out. Sorted by name.
     */
    async discover(): Promise<DiscoveredTv[]> {
        const responses = await this.search({ searchTargets: SAMSUNG_SEARCH_TARGETS, timeoutMs: this.timeoutMs });
        const hosts = [...new Set(responses.map(response => response.address))];
        const found = await Promise.all(hosts.map(host => this.identify(host)));
        return found.filter((tv): tv is DiscoveredTv => tv !== undefined).sort((a, b) => (a.name ?? a.host).localeCompare(b.name ?? b.host));
    }

    private async identify(host: string): Promise<DiscoveredTv | undefined> {
        const client = this.createClient({ id: `discover:${host}`, host, port: FRAME_PORT }, new MemoryTokenStore());
        try {
            const device = await new FrameService(client).deviceInfo();
            if (!device.frameTvSupport) {
                return undefined;
            }
            const stored = await this.tvs.findByAddress(host, FRAME_PORT);
            return { host, port: FRAME_PORT, name: device.name, model: device.model, tvId: stored?.id };
        } catch {
            return undefined;
        } finally {
            await client.close();
        }
    }
}
