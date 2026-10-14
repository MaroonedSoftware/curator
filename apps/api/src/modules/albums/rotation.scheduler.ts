import { IsHttpError } from '@maroonedsoftware/errors';
import type { Logger } from '@maroonedsoftware/logger';
import type { RotationRepository } from './rotation.repository.js';
import type { RotationService } from './rotation.service.js';

/**
 * Checks every `tickMs` for TVs whose next piece is due and advances them. A TV that fails (off,
 * unreachable, nothing of its album left on it) is left alone for `retryMs` rather than retried
 * every tick. One TV's slow call never holds up another's, nor is a TV advanced twice at once.
 *
 * A failing TV is logged once, as a warning, when it starts failing, and again when it comes back;
 * the retries in between only log at debug. An HTTP error (the TV's own failures, or a 404 or 409
 * from the rotation) logs as its one-line reason; anything else logs whole, since it is a bug.
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
        this.timer = setInterval(() => void this.tick(), this.tickMs);
        // A server with nothing else to do may still exit.
        this.timer.unref();
        void this.tick();
    }

    /** Stops ticking, and waits for any advance in flight. */
    async stop(): Promise<void> {
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
            this.logger.error('rotation: could not read the due rotations', error);
            return;
        }
        const now = this.now();
        const started = due.filter(tvId => !this.running.has(tvId) && (this.retryAt.get(tvId) ?? 0) <= now).map(tvId => this.advance(tvId));
        await Promise.allSettled(started);
    }

    private advance(tvId: string): Promise<void> {
        const run = this.service
            .advance(tvId)
            .then(contentId => {
                const recovered = this.retryAt.delete(tvId);
                this.logger.info(`rotation: TV ${tvId} ${recovered ? 'is back and ' : ''}now shows ${contentId}`);
            })
            .catch((error: unknown) => {
                const failing = this.retryAt.has(tvId);
                this.retryAt.set(tvId, this.now() + this.retryMs);
                const retry = `retrying in ${Math.round(this.retryMs / 1000)}s`;
                if (failing) {
                    this.logger.debug(`rotation: TV ${tvId} still could not advance (${reasonOf(error)}), ${retry}`);
                } else if (IsHttpError(error)) {
                    this.logger.warn(`rotation: could not advance TV ${tvId} (${reasonOf(error)}), ${retry}`);
                } else {
                    this.logger.warn(`rotation: could not advance TV ${tvId}, ${retry}`, error);
                }
            })
            .finally(() => this.running.delete(tvId));
        this.running.set(tvId, run);
        return run;
    }
}

/** An error's one-line reason: an HTTP error's `details.reason` when it has one, else its message. */
const reasonOf = (error: unknown): string => {
    const reason = IsHttpError(error) ? error.details?.reason : undefined;
    if (typeof reason === 'string') return reason;
    return error instanceof Error ? error.message : String(error);
};
