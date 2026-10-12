import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Thumbnail } from '@curator/frame';
import { normalizeContentId } from './content.id.js';

/** An original as it was uploaded: the same shape the TV uses for thumbnails. */
export type Original = Thumbnail;

const FILE_TYPES = ['jpg', 'png'] as const;

/** One TV's originals. Content ids are trusted to be filename-safe (the routes allow only `[A-Za-z0-9_-]`). */
export interface TvOriginals {
    save(contentId: string, fileType: string, data: Buffer): Promise<void>;
    get(contentId: string): Promise<Original | undefined>;
    delete(contentId: string): Promise<void>;
}

/**
 * Uploaded images kept on disk as `<rootDir>/<tvId>/<contentId>.<jpg|png>`, since the TV offers no
 * way to fetch a full image back. Files are named by {@link normalizeContentId}.
 */
export class OriginalStore {
    constructor(private readonly rootDir: string) {}

    forTv(tvId: string): TvOriginals {
        const dir = join(this.rootDir, tvId);
        const pathOf = (contentId: string, fileType: string) => join(dir, `${normalizeContentId(contentId)}.${fileType}`);

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
            },
        };
    }
}

function isNotFound(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}
