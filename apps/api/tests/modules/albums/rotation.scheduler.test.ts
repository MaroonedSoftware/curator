import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RotationRepository } from '../../../src/modules/albums/rotation.repository.js';
import { RotationScheduler } from '../../../src/modules/albums/rotation.scheduler.js';
import type { RotationService } from '../../../src/modules/albums/rotation.service.js';
import { silentLogger } from '../../test.server.js';

/** A scheduler over fakes: `due` is what the repository reports, and `advance` is the service's. */
function scheduler(due: string[], advance: (tvId: string) => Promise<string>) {
    const clock = { now: 0 };
    const advanced: string[] = [];
    const rotations = { due: async () => due } as unknown as RotationRepository;
    const service = {
        advance: (tvId: string) => {
            advanced.push(tvId);
            return advance(tvId);
        },
    } as unknown as RotationService;
    return { scheduler: new RotationScheduler(rotations, service, silentLogger, 60_000, 300_000, () => clock.now), advanced, clock };
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
});
