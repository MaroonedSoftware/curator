import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCrash } from '../../src/server/crash.handlers.js';
import { silentLogger } from '../test.server.js';

describe('handleCrash', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        process.exitCode = undefined;
    });

    it('logs the cause, then stops the process through its shutdown hooks', () => {
        const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
        const error = vi.fn();
        const failure = new Error('boom');

        handleCrash({ ...silentLogger, error }, failure);

        expect(error).toHaveBeenCalledWith('api: stopping on an unhandled error', failure);
        expect(process.exitCode).toBe(1);
        expect(kill).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    });
});
