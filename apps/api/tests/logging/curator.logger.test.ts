import { describe, expect, it } from 'vitest';
import { CuratorLogger } from '../../src/logging/curator.logger.js';
import type { RotatingLogStore } from '../../src/logging/rotating.log.store.js';
import { runInTrace } from '../../src/logging/trace.context.js';
import { silentLogger } from '../test.server.js';

/** A logger over a store that records what it was asked to write. */
function logger() {
    const lines: { level: string; message: string; meta?: Record<string, unknown> }[] = [];
    const store = {
        append: (level: string, message: string, meta?: Record<string, unknown>) => lines.push({ level, message, meta }),
    } as unknown as RotatingLogStore;
    const calls: unknown[][] = [];
    const inner = { ...silentLogger, info: (...args: unknown[]) => calls.push(args) };
    return { log: new CuratorLogger(inner, store), lines, calls };
}

describe('CuratorLogger', () => {
    it('writes to both the inner logger, unchanged, and the store', () => {
        const { log, lines, calls } = logger();

        log.info('rotation: advanced', { tvId: 'a' });

        expect(calls).toEqual([['rotation: advanced', { tvId: 'a' }]]);
        expect(lines).toEqual([{ level: 'info', message: 'rotation: advanced', meta: { tvId: 'a' } }]);
    });

    it('keeps an Error message with its name and stack', () => {
        const { log, lines } = logger();

        log.error(new TypeError('boom'));

        expect(lines[0]?.message).toBe('boom');
        expect(lines[0]?.meta?.errorName).toBe('TypeError');
        expect(lines[0]?.meta?.stack).toContain('curator.logger.test.ts');
    });

    it('turns an Error passed as meta into an error field', () => {
        const { log, lines } = logger();

        log.warn('rotation: could not advance', new Error('the TV is off'));

        expect(lines[0]?.meta?.error).toBe('Error: the TV is off');
    });

    it('writes any other object as JSON, never [object Object]', () => {
        const { log, lines } = logger();

        log.warn({ reason: 'odd' });

        expect(lines[0]?.message).toBe('{"reason":"odd"}');
    });

    it('stamps the file copy, not stdout, with the current trace', () => {
        const { log, lines, calls } = logger();

        runInTrace({ id: 'req-1', kind: 'GET /tvs' }, () => log.info('tvs: listed', { count: 2 }));
        log.info('outside');

        expect(calls[0]).toEqual(['tvs: listed', { count: 2 }]);
        expect(lines[0]?.meta).toEqual({ count: 2, trace: 'req-1' });
        expect(lines[1]?.meta).toBeUndefined();
    });
});
