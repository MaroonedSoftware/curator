import type { RotatingLogStore } from './rotating.log.store.js';

/**
 * The process's one {@link RotatingLogStore}. `startServer` builds it before any container exists (the
 * logger must write from the first line of startup), and `LoggingModule` and the `/logs` route reach
 * it here. Two stores on one file would each rotate it on their own count.
 */
let store: RotatingLogStore | undefined;

/** Records the store. `undefined` resets it, for tests: this is module state. */
export const setLogStore = (next: RotatingLogStore | undefined): void => {
    store = next;
};

/** The store, or undefined when the server was built without one (tests). */
export const getLogStore = (): RotatingLogStore | undefined => store;
