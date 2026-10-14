import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which piece of work the code running now belongs to: one HTTP request, or one TV's rotation
 * advance. The log file stamps it on every line, so the lines of one request can be pulled out from
 * among everything else the server was doing at that moment.
 *
 * Ambient rather than passed, because the code that logs (the frame client, a repository) sits
 * several calls below anything that knows which request it is serving. A description of work, never
 * an input to it: nothing may branch on `currentTrace()`, and code outside any trace (startup, a
 * test) just answers `undefined`.
 */
export interface Trace {
    /** The request's id (echoed as `x-request-id`), or a fresh one for work the server starts itself. */
    id: string;
    /** What the work is, for a reader scanning the file: `GET /tvs/:tvId/art`, or `rotation`. */
    kind: string;
}

const traces = new AsyncLocalStorage<Trace>();

/** Runs `fn` as part of `trace`. Everything it awaits answers the same trace. */
export const runInTrace = <T>(trace: Trace, fn: () => T): T => traces.run(trace, fn);

/** The work running now, or `undefined` outside any. */
export const currentTrace = (): Trace | undefined => traces.getStore();
