import type { Logger } from '@maroonedsoftware/logger';

/**
 * Logs what killed the process before it stops. Node stops exiting on its own once a handler is
 * registered for these, so the handler sends SIGTERM itself: crash-and-restart stays the policy, and
 * the shutdown hooks still run (closing the log file after this line).
 */
export const installCrashHandlers = (logger: Logger): void => {
    process.on('unhandledRejection', error => handleCrash(logger, error));
    process.on('uncaughtException', error => handleCrash(logger, error));
};

/** Exported so a test can call it without raising a real `uncaughtException` under vitest. */
export const handleCrash = (logger: Logger, error: unknown): void => {
    logger.error('api: stopping on an unhandled error', error instanceof Error ? error : { error: String(error) });
    process.exitCode = 1;
    process.kill(process.pid, 'SIGTERM');
};
