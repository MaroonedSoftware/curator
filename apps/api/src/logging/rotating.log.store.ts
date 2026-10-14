import { appendFileSync, mkdirSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createStream, type RotatingFileStream } from 'rotating-file-stream';

/** The file the API's log is written to, inside the store's directory. */
export const API_LOG_FILENAME = 'api.log';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Severity order, for the minimum-level filter on {@link RotatingLogStore.tail}. */
export const LEVEL_ORDER: Record<LogLevel, number> = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };

/** Meta keys whose value is written as `***`. */
const REDACT_KEY_PATTERN = /token|secret|password|authorization|api[_-]?key|credential/i;
/** A bearer token inside an otherwise harmless value. */
const BEARER_TOKEN_PATTERN = /Bearer\s+\S+/gi;
/** A written line: timestamp, level, and the rest. */
const LINE_PATTERN = /^(\S+)\s+(\S+)\s+([\s\S]*)$/;

/** One line, read back. */
export interface LogEntry {
    /** ISO 8601 with milliseconds, or `''` for a line that did not parse (a partial write, say). */
    ts: string;
    /** Lower-case level, or `''` for a line that did not parse. */
    level: string;
    /** The message and its `| key=value ...` tail, as written. */
    text: string;
}

export interface RotatingLogStoreOptions {
    /** The directory `api.log` and its rotated segments live in. */
    dir: string;
    /** Rotate once the active file reaches this many bytes. */
    maxBytes: number;
    /** Rotated segments kept besides the active file. */
    maxFiles: number;
    /** Cap, in characters, on one rendered meta value. */
    maxValueChars: number;
    /** Cap, in bytes, on a whole line. */
    maxLineBytes: number;
}

/**
 * The API's log on disk: one line per entry, rotated by size, with credentials redacted, so the log
 * can be read after the fact (and from the web app) rather than only from the terminal that ran it.
 *
 * Built in `startServer` before the container exists, so it is a plain class with no DI. `append`
 * never throws: a log sink that can take the server down is worse than none. Rotation and write
 * ordering are `rotating-file-stream`'s; this formats, redacts, and reads lines back.
 */
export class RotatingLogStore {
    private readonly dir: string;
    private stream?: RotatingFileStream;
    private warned = false;
    private closed = false;

    constructor(private readonly options: RotatingLogStoreOptions) {
        this.dir = resolve(options.dir);
    }

    /** Formats and appends one entry. Never throws. */
    append(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
        try {
            const line = formatLine(level, message, meta, this.options.maxValueChars, this.options.maxLineBytes);
            if (this.closed) {
                // The server's own last lines ('Server closed') arrive after LoggingModule closes the
                // store. A synchronous append keeps them without reopening a stream nothing would end.
                this.appendSync(line);
                return;
            }
            this.openStream().write(`${line}\n`);
        } catch (error) {
            this.warnOnce('could not append a log line', error);
        }
    }

    /**
     * The newest `limit` entries at or above `level`, newest first. Reads segments newest first and
     * stops once it has enough, so a short tail never reads the whole history.
     */
    async tail(options: { limit: number; level?: LogLevel }): Promise<LogEntry[]> {
        const minSeverity = options.level === undefined ? undefined : LEVEL_ORDER[options.level];
        const entries: LogEntry[] = [];
        for (const segment of (await segmentsByMtime(this.dir)).reverse()) {
            if (entries.length >= options.limit) break;
            const raw = await readFile(segment, 'utf8').catch(() => '');
            const lines = raw.split('\n').filter(line => line.length > 0);
            for (let i = lines.length - 1; i >= 0 && entries.length < options.limit; i--) {
                const entry = parseLine(lines[i]!);
                if (minSeverity !== undefined && (LEVEL_ORDER[entry.level as LogLevel] ?? -1) < minSeverity) continue;
                entries.push(entry);
            }
        }
        return entries;
    }

    /** Flushes and ends the stream. Safe to call twice. */
    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        const stream = this.stream;
        this.stream = undefined;
        if (stream === undefined) return;
        await new Promise<void>(done => {
            stream.once('close', done);
            stream.once('error', () => done());
            stream.end();
        });
    }

    private openStream(): RotatingFileStream {
        if (this.stream !== undefined) return this.stream;
        const stream = createStream(API_LOG_FILENAME, { path: this.dir, size: `${this.options.maxBytes}B`, maxFiles: this.options.maxFiles });
        // Unhandled, a stream 'error' (a full disk) is an uncaught exception. Drop the stream so the
        // next line tries a fresh one.
        stream.on('error', error => {
            this.warnOnce('the log file could not be written', error);
            if (this.stream === stream) this.stream = undefined;
        });
        this.stream = stream;
        return stream;
    }

    private appendSync(line: string): void {
        mkdirSync(this.dir, { recursive: true });
        appendFileSync(join(this.dir, API_LOG_FILENAME), `${line}\n`);
    }

    /** Says so on stderr, once: the log cannot report its own failure. */
    private warnOnce(what: string, error: unknown): void {
        if (this.warned) return;
        this.warned = true;
        console.warn(`[log] ${what}`, error);
    }
}

/**
 * The log's segments, oldest first by mtime: the active file and the rotated ones, which
 * `rotating-file-stream` names with a timestamp prefix. Its history file (`api.log.txt`, a list of
 * the rotated names) sits alongside and is not a segment. A missing directory is empty.
 */
async function segmentsByMtime(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const stamped = await Promise.all(
        entries
            .filter(entry => entry.isFile() && entry.name.endsWith(API_LOG_FILENAME))
            .map(async entry => {
                const path = join(dir, entry.name);
                const stats = await stat(path).catch(() => undefined);
                return stats === undefined ? undefined : { path, mtimeMs: stats.mtimeMs };
            }),
    );
    return stamped
        .filter(entry => entry !== undefined)
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map(entry => entry.path);
}

/** `<ISO ts> <LEVEL> <message> | key=value ...`, newlines escaped so one entry is always one line. */
export function formatLine(
    level: LogLevel,
    message: string,
    meta: Record<string, unknown> | undefined,
    maxValueChars: number,
    maxLineBytes: number,
): string {
    let line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5, ' ')} ${escapeNewlines(message)}`;
    const rendered = meta === undefined ? '' : renderMeta(meta, maxValueChars);
    if (rendered.length > 0) line += ` | ${rendered}`;
    return truncateBytes(line, maxLineBytes);
}

function renderMeta(meta: Record<string, unknown>, maxValueChars: number): string {
    return Object.entries(meta)
        .map(([key, value]) => `${key}=${REDACT_KEY_PATTERN.test(key) ? '***' : renderValue(value, maxValueChars)}`)
        .join(' ');
}

function renderValue(value: unknown, maxValueChars: number): string {
    const rendered = escapeNewlines(stringify(value).replace(BEARER_TOKEN_PATTERN, 'Bearer ***'));
    return rendered.length <= maxValueChars ? rendered : `${rendered.slice(0, maxValueChars)}…`;
}

function stringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === undefined || value === null || typeof value !== 'object') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function escapeNewlines(value: string): string {
    return value.replace(/\r\n|\r|\n/g, '\\n');
}

function truncateBytes(line: string, maxBytes: number): string {
    if (Buffer.byteLength(line, 'utf8') <= maxBytes) return line;
    const marker = '…';
    const budget = Math.max(0, maxBytes - Buffer.byteLength(marker, 'utf8'));
    return `${Buffer.from(line, 'utf8').subarray(0, budget).toString('utf8')}${marker}`;
}

/** A line that doesn't match (a partial write) is still shown, whole, rather than dropped. */
function parseLine(line: string): LogEntry {
    const match = LINE_PATTERN.exec(line);
    if (match === null) return { ts: '', level: '', text: line };
    const [, ts = '', level = '', text = ''] = match;
    return { ts, level: level.toLowerCase(), text };
}
