import type { Logger } from '@maroonedsoftware/logger';
import { randomUUID } from 'node:crypto';
import { errorText } from '../../logging/error.text.js';
import { runInTrace } from '../../logging/trace.context.js';
import type { RotationRepository } from './rotation.repository.js';
import type { RotationService } from './rotation.service.js';

/**
 * Checks every `tickMs` for TVs whose next piece is due and advances them. A TV that fails (off,
 * unreachable, nothing of its album left on it) is left alone for `retryMs` rather than retried
 * every tick. One TV's slow call never holds up another's, nor is a TV advanced twice at once.
 */
export class RotationScheduler {
    private timer?: NodeJS.Timeout;
    private readonly running = new Map<string, Promise<void>>();
    /** When each failing TV may be tried again. */
    private readonly retryAt = new Map<string, number>();

    constructor(
        private readonly rotations: RotationRepository,
        private readonly service: RotationService,
        private readonly logger: Logger,
        private readonly tickMs: number,
        private readonly retryMs: number,
        private readonly now: () => number = Date.now,
    ) {}

    start(): void {
        this.stop();
        this.logger.info('rotation: started', { tickMs: this.tickMs, retryMs: this.retryMs });
        this.timer = setInterval(() => void this.tick(), this.tickMs);
        // A server with nothing else to do may still exit.
        this.timer.unref();
        void this.tick();
    }

    /** Stops ticking, and waits for any advance in flight. */
    async stop(): Promise<void> {
        if (this.timer !== undefined) this.logger.info('rotation: stopped');
        clearInterval(this.timer);
        this.timer = undefined;
        await Promise.allSettled(this.running.values());
    }

    /** Advances every due TV. Resolves once they have all finished, which only tests wait for. */
    async tick(): Promise<void> {
        let due: string[];
        try {
            due = await this.rotations.due();
        } catch (error) {
            this.logger.error('rotation: could not read the due rotations', { error: errorText(error) });
            return;
        }
        const now = this.now();
        const started = due.filter(tvId => !this.running.has(tvId) && (this.retryAt.get(tvId) ?? 0) <= now).map(tvId => this.advance(tvId));
        await Promise.allSettled(started);
    }

    /** One TV's advance, in a trace of its own so its lines (the frame client's included) can be told apart. */
    private advance(tvId: string): Promise<void> {
        const run = runInTrace({ id: randomUUID().slice(0, 8), kind: 'rotation' }, () =>
            this.service
                .advance(tvId)
                .then(contentId => {
                    this.retryAt.delete(tvId);
                    this.logger.info('rotation: advanced', { tvId, contentId });
                })
                .catch((error: unknown) => {
                    this.retryAt.set(tvId, this.now() + this.retryMs);
                    this.logger.warn('rotation: could not advance; retrying later', { tvId, retryMs: this.retryMs, error: errorText(error) });
                })
                .finally(() => this.running.delete(tvId)),
        );
        this.running.set(tvId, run);
        return run;
    }
}
