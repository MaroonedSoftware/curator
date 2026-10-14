import type { Logger } from '@maroonedsoftware/logger';
import type { LogLevel, RotatingLogStore } from './rotating.log.store.js';
import { currentTrace } from './trace.context.js';

/**
 * Writes every line to both another {@link Logger} (stdout, unchanged) and the {@link RotatingLogStore},
 * so the log can be read after the fact. No level gate: every level reaches both.
 *
 * The file's copy also carries the current trace (the request or rotation it belongs to). Stdout's
 * doesn't: someone watching live is already following one thing, and an id on every line is noise.
 */
export class CuratorLogger implements Logger {
    constructor(
        private readonly inner: Logger,
        private readonly store: RotatingLogStore,
    ) {}

    error(message: unknown, ...optionalParams: unknown[]): void {
        this.inner.error(message, ...optionalParams);
        this.append('error', message, optionalParams);
    }

    warn(message: unknown, ...optionalParams: unknown[]): void {
        this.inner.warn(message, ...optionalParams);
        this.append('warn', message, optionalParams);
    }

    info(message: unknown, ...optionalParams: unknown[]): void {
        this.inner.info(message, ...optionalParams);
        this.append('info', message, optionalParams);
    }

    debug(message: unknown, ...optionalParams: unknown[]): void {
        this.inner.debug(message, ...optionalParams);
        this.append('debug', message, optionalParams);
    }

    trace(message: unknown, ...optionalParams: unknown[]): void {
        this.inner.trace(message, ...optionalParams);
        this.append('trace', message, optionalParams);
    }

    /**
     * Writes one line, keeping what the caller passed. The convention is `('area: sentence', { meta })`,
     * but the file defends itself against the rest: an `Error` as the message keeps its name and the
     * app's own stack frames, an `Error` as the second argument becomes `error=`, and any other object
     * is JSON rather than `[object Object]`.
     */
    private append(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
        const meta = withTrace(metaFrom(optionalParams[0]));

        if (typeof message === 'string') {
            this.store.append(level, message, meta);
        } else if (message instanceof Error) {
            const stack = appFrames(message.stack);
            this.store.append(level, message.message, { ...meta, errorName: message.name, ...(stack === undefined ? {} : { stack }) });
        } else {
            this.store.append(level, describe(message), meta);
        }
    }
}

/** Adds the current trace's id, unless the caller set `trace` or there is no trace. */
function withTrace(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    const trace = currentTrace();
    if (trace === undefined || (meta !== undefined && 'trace' in meta)) return meta;
    return { ...meta, trace: trace.id };
}

/** The second argument as meta: a plain object as is, an Error as `error` and its stack, anything else dropped. */
function metaFrom(value: unknown): Record<string, unknown> | undefined {
    if (value instanceof Error) {
        const stack = appFrames(value.stack);
        return { error: `${value.name}: ${value.message}`, ...(stack === undefined ? {} : { stack }) };
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return { ...(value as Record<string, unknown>) };
    return undefined;
}

/**
 * The frames of a stack that name the app's own code. A raw stack is mostly framework frames, and
 * the store truncates long values, so the call site would otherwise be cut off. An all-vendor stack
 * keeps its first few frames, since something beats nothing.
 */
export function appFrames(stack: string | undefined, limit = 6): string | undefined {
    if (stack === undefined) return undefined;
    const frames = stack
        .split('\n')
        .slice(1)
        .map(line => line.trim())
        .filter(line => line.startsWith('at '));
    if (frames.length === 0) return undefined;
    const own = frames.filter(line => !line.includes('node_modules') && !line.includes('node:internal'));
    return (own.length > 0 ? own : frames).slice(0, limit).join(' <- ');
}

/** JSON where it can be, `String()` where it can't (circular, BigInt). */
function describe(value: unknown): string {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}
