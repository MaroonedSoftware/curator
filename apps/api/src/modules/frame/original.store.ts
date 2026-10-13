import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Thumbnail } from '@curator/frame';
import { normalizeContentId } from './content.id.js';

/** An original as it was uploaded: the same shape the TV uses for thumbnails. */
export type Original = Thumbnail;

const FILE_TYPES = ['jpg', 'png'] as const;

/** A kept original's file name: `<contentId>.<jpg|png>`. Temporary files (`….tmp`) don't match. */
const ORIGINAL_FILE = /^(.+)\.(?:jpg|png)$/;

/** An image's fingerprint: the SHA-256 of its bytes, in hex. Only byte-identical images share one. */
export const fingerprintOf = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

/** One TV's originals. Content ids are trusted to be filename-safe (the routes allow only `[A-Za-z0-9_-]`). */
export interface TvOriginals {
    save(contentId: string, fileType: string, data: Buffer): Promise<void>;
    get(contentId: string): Promise<Original | undefined>;
    delete(contentId: string): Promise<void>;
    /** The content ids (normalized) of the kept originals with this {@link fingerprintOf}. */
    withFingerprint(fingerprint: string): Promise<string[]>;
}

/**
 * Uploaded images kept on disk as `<rootDir>/<tvId>/<contentId>.<jpg|png>`, since the TV offers no
 * way to fetch a full image back. Files are named by {@link normalizeContentId}.
 *
 * Each TV's fingerprints are worked out from its files the first time they are asked for, then
 * kept in step as originals are saved and deleted, so a restart costs one pass over the files.
 */
export class OriginalStore {
    /** By TV id: each kept original's fingerprint, by normalized content id. */
    private readonly fingerprints = new Map<string, Promise<Map<string, string>>>();

    constructor(private readonly rootDir: string) {}

    forTv(tvId: string): TvOriginals {
        const dir = join(this.rootDir, tvId);
        const pathOf = (contentId: string, fileType: string) => join(dir, `${normalizeContentId(contentId)}.${fileType}`);
        const fingerprints = this.fingerprints;
        const index = () => {
            let loaded = fingerprints.get(tvId);
            if (!loaded) {
                loaded = fingerprintFiles(dir);
                // A failed pass is forgotten, so the next ask tries again.
                loaded.catch(() => fingerprints.delete(tvId));
                fingerprints.set(tvId, loaded);
            }
            return loaded;
        };
        /** Keeps a pass already made in step; a pass not yet made will read the files as they are. */
        const update = async (change: (byId: Map<string, string>) => void) => {
            const loaded = fingerprints.get(tvId);
            if (loaded) change(await loaded);
        };

        return {
            async save(contentId, fileType, data) {
                await mkdir(dir, { recursive: true });
                const path = pathOf(contentId, fileType);
                // Written aside and renamed in, so a crash never leaves a truncated original behind.
                const tmp = `${path}.${randomUUID()}.tmp`;
                try {
                    await writeFile(tmp, data);
                    await rename(tmp, path);
                } catch (error) {
                    await rm(tmp, { force: true });
                    throw error;
                }
                await update(byId => byId.set(normalizeContentId(contentId), fingerprintOf(data)));
            },

            async get(contentId) {
                for (const fileType of FILE_TYPES) {
                    try {
                        return { data: await readFile(pathOf(contentId, fileType)), fileType };
                    } catch (error) {
                        if (!isNotFound(error)) throw error;
                    }
                }
                return undefined;
            },

            async delete(contentId) {
                await Promise.all(FILE_TYPES.map(fileType => rm(pathOf(contentId, fileType), { force: true })));
                await update(byId => byId.delete(normalizeContentId(contentId)));
            },

            async withFingerprint(fingerprint) {
                return [...(await index()).entries()].filter(([, candidate]) => candidate === fingerprint).map(([contentId]) => contentId);
            },
        };
    }
}

/** Fingerprints every original in `dir`, by normalized content id. A TV with none yet has no directory. */
async function fingerprintFiles(dir: string): Promise<Map<string, string>> {
    let names: string[];
    try {
        names = await readdir(dir);
    } catch (error) {
        if (isNotFound(error)) return new Map();
        throw error;
    }
    const byId = new Map<string, string>();
    for (const name of names) {
        const contentId = ORIGINAL_FILE.exec(name)?.[1];
        if (contentId) {
            byId.set(normalizeContentId(contentId), fingerprintOf(await readFile(join(dir, name))));
        }
    }
    return byId;
}

function isNotFound(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}
