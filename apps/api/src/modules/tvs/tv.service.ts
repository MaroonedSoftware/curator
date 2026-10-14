import { randomUUID } from 'node:crypto';
import { MemoryTokenStore } from '@curator/frame';
import { httpError } from '@maroonedsoftware/errors';
import type { Logger } from '@maroonedsoftware/logger';
import { FrameService } from '../frame/frame.service.js';
import type { FrameClientFactory, FrameClientRegistry } from '../frame/frame.client.registry.js';
import type { OriginalStore } from '../frame/original.store.js';
import { errorText } from '../../logging/error.text.js';
import type { TvRepository, TvRow } from './tv.repository.js';

export interface ConnectTv {
    host: string;
    port: number;
    /** What to call it. Defaults to the name the TV reports. */
    name?: string;
}

/** Postgres's unique_violation, for a TV stored by a concurrent connect. */
const isUniqueViolation = (error: unknown) => typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

/** The TVs curator manages, and the way to reach each one. */
export class TvService {
    constructor(
        private readonly tvs: TvRepository,
        private readonly clients: FrameClientRegistry,
        private readonly createClient: FrameClientFactory,
        private readonly originals: OriginalStore,
        private readonly logger: Logger,
    ) {}

    /**
     * Adds a TV: checks the address is a Frame, pairs with it (which shows a prompt on the TV that
     * someone must accept, so this can take up to the client's pairing timeout), and stores it with
     * the token it issued. 409 for a TV already stored at that address, 422 for a TV that isn't a
     * Frame, and the usual TV errors (503 unreachable, 502 pairing refused) otherwise.
     */
    async connect({ host, port, name }: ConnectTv): Promise<TvRow> {
        const existing = await this.tvs.findByAddress(host, port);
        if (existing) {
            throw httpError(409).withDetails({ reason: `${existing.name} is already added at ${host}:${port}`, tvId: existing.id });
        }

        const id = randomUUID();
        const tokens = new MemoryTokenStore();
        // A client of its own, with the token kept in memory: there is no row to keep it in until pairing succeeds.
        const client = this.createClient({ id, host, port }, tokens);
        this.logger.info('tvs: pairing; accept the prompt on the TV', { host, port });
        try {
            const frame = new FrameService(client);
            const device = await frame.deviceInfo();
            if (!device.frameTvSupport) {
                throw httpError(422).withDetails({ reason: `${device.name ?? host} is a Samsung TV, but not a Frame`, model: device.model });
            }
            // The first art request opens the channel, which is what asks the TV to trust us.
            await frame.apiVersion();

            const tv = await this.tvs.create({
                id,
                name: name ?? device.name ?? device.model ?? 'Frame TV',
                host,
                port,
                model: device.model,
                token: await tokens.load(),
            });
            this.logger.info('tvs: added', { tvId: tv.id, name: tv.name, host, port, model: tv.model });
            return tv;
        } catch (error) {
            this.logger.warn('tvs: could not add a TV', { host, port, error: errorText(error) });
            if (isUniqueViolation(error)) {
                throw httpError(409).withDetails({ reason: `a TV is already added at ${host}:${port}` });
            }
            throw error;
        } finally {
            // The registry builds the TV's long-lived client, with its token kept in the row, on first use.
            await client.close();
        }
    }

    list(): Promise<TvRow[]> {
        return this.tvs.list();
    }

    get(id: string): Promise<TvRow> {
        return this.tvs.get(id);
    }

    rename(id: string, name: string): Promise<TvRow> {
        return this.tvs.rename(id, name);
    }

    /**
     * Forgets the TV and drops its connection. The TV itself keeps its art, and its kept originals stay
     * on disk as a backup. Resolves false if there was no such TV.
     */
    async remove(id: string): Promise<boolean> {
        const removed = await this.tvs.delete(id);
        await this.clients.remove(id);
        return removed;
    }

    /** The TV's own endpoints, through its client. 404 for a TV that isn't there. */
    async frameFor(id: string): Promise<FrameService> {
        const tv = await this.tvs.get(id);
        return new FrameService(this.clients.clientFor(tv), this.clients.thumbnailsFor(tv), {
            store: this.originals.forTv(tv.id),
            logger: this.logger,
        });
    }
}
