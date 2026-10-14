import { httpError } from '@maroonedsoftware/errors';
import type { Logger } from '@maroonedsoftware/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RotationRepository } from '../../../src/modules/albums/rotation.repository.js';
import { RotationScheduler } from '../../../src/modules/albums/rotation.scheduler.js';
import type { RotationService } from '../../../src/modules/albums/rotation.service.js';
import { currentTrace } from '../../../src/logging/trace.context.js';
import { silentLogger } from '../../test.server.js';

/** A logger that keeps every line, as `[level, message, ...args]`. */
function recordingLogger() {
    const lines: unknown[][] = [];
    const record =
        (level: string) =>
        (message: unknown, ...args: unknown[]) =>
            lines.push([level, message, ...args]);
    const logger: Logger = { error: record('error'), warn: record('warn'), info: record('info'), debug: record('debug'), trace: record('trace') };
    return { logger, lines };
}

/** A scheduler over fakes: `due` is what the repository reports, and `advance` is the service's. */
function scheduler(due: string[], advance: (tvId: string) => Promise<string>, logger: Logger = silentLogger) {
    const clock = { now: 0 };
    const advanced: string[] = [];
    const rotations = { due: async () => due } as unknown as RotationRepository;
    const service = {
        advance: (tvId: string) => {
            advanced.push(tvId);
            return advance(tvId);
        },
    } as unknown as RotationService;
    return { scheduler: new RotationScheduler(rotations, service, logger, 60_000, 300_000, () => clock.now), advanced, clock };
}

describe('RotationScheduler', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('advances every due TV on each tick', async () => {
        const { scheduler: s, advanced } = scheduler(['a', 'b'], async () => 'MY-F0001');

        await s.tick();

        expect(advanced).toEqual(['a', 'b']);
    });

    it('leaves a TV that failed alone until its retry is due', async () => {
        const {
            scheduler: s,
            advanced,
            clock,
        } = scheduler(['a'], async () => {
            throw new Error('the TV is off');
        });

        await s.tick();
        clock.now = 299_999;
        await s.tick();
        clock.now = 300_000;
        await s.tick();

        expect(advanced).toEqual(['a', 'a']);
    });

    it('advances each TV in a trace of its own, which its log line shares', async () => {
        const traces: (string | undefined)[] = [];
        const logged: (string | undefined)[] = [];
        const rotations = { due: async () => ['a', 'b'] } as unknown as RotationRepository;
        const service = {
            advance: async () => {
                traces.push(currentTrace()?.id);
                return 'MY-F0001';
            },
        } as unknown as RotationService;
        const logger = { ...silentLogger, info: () => logged.push(currentTrace()?.id) };

        await new RotationScheduler(rotations, service, logger, 60_000, 300_000).tick();

        expect(traces).toHaveLength(2);
        expect(new Set(traces).size).toBe(2);
        expect(traces.every(id => id !== undefined)).toBe(true);
        expect(logged).toEqual(traces);
    });

    it('never advances a TV twice at once', async () => {
        let finish: (contentId: string) => void = () => {};
        const { scheduler: s, advanced } = scheduler(['a'], () => new Promise(resolve => (finish = resolve)));

        const first = s.tick();
        await s.tick();
        finish('MY-F0001');
        await first;

        expect(advanced).toEqual(['a']);
    });

    it('ticks at once on start, then every interval, until stopped', async () => {
        vi.useFakeTimers();
        const { scheduler: s, advanced } = scheduler(['a'], async () => 'MY-F0001');

        s.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(advanced).toEqual(['a']);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(advanced).toEqual(['a', 'a']);

        await s.stop();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(advanced).toEqual(['a', 'a']);
    });

    it('warns once, in one line, when a TV becomes unreachable, and says when it is back', async () => {
        const { logger, lines } = recordingLogger();
        let reachable = false;
        const unreachable = httpError(503).withDetails({ reason: 'cannot reach TV at 192.168.1.56:8002' });
        const { scheduler: s, clock } = scheduler(
            ['a'],
            async () => {
                if (!reachable) throw unreachable;
                return 'MY-F0001';
            },
            logger,
        );

        await s.tick();
        clock.now = 300_000;
        await s.tick();
        reachable = true;
        clock.now = 600_000;
        await s.tick();
        await s.tick();

        expect(lines).toEqual([
            [
                'warn',
                'rotation: could not advance; retrying later',
                { tvId: 'a', reason: 'cannot reach TV at 192.168.1.56:8002', retryInSeconds: 300 },
            ],
            [
                'debug',
                'rotation: still could not advance; retrying later',
                { tvId: 'a', reason: 'cannot reach TV at 192.168.1.56:8002', retryInSeconds: 300 },
            ],
            ['info', 'rotation: the TV is back and advanced', { tvId: 'a', contentId: 'MY-F0001' }],
            ['info', 'rotation: advanced', { tvId: 'a', contentId: 'MY-F0001' }],
        ]);
    });

    it('logs an unexpected error with its stack', async () => {
        const { logger, lines } = recordingLogger();
        const bug = new TypeError('undefined is not a function');
        const { scheduler: s } = scheduler(
            ['a'],
            async () => {
                throw bug;
            },
            logger,
        );

        await s.tick();

        expect(lines).toEqual([
            [
                'warn',
                'rotation: could not advance; retrying later',
                {
                    tvId: 'a',
                    error: 'undefined is not a function',
                    retryInSeconds: 300,
                    stack: expect.stringContaining('rotation.scheduler.test.ts'),
                },
            ],
        ]);
    });
});
