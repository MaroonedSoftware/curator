import { unzipSync } from 'fflate';

/**
 * `manifest.json` in a backup zip, as `GET /backup` writes it (see the API's backup.manifest.ts).
 * Content ids are normalized (`MY-F0001`).
 */
export interface BackupManifest {
    format: 'curator-backup';
    version: 1;
    createdAt: string;
    tvs: BackupTv[];
}

export interface BackupTv {
    /** The TV's id when it was backed up. */
    id: string;
    name: string;
    model?: string;
    /** False when the TV couldn't be reached as it was backed up, so its pieces have no mattes. */
    listedByTv: boolean;
    pieces: BackupPiece[];
    albums: { name: string; contentIds: string[] }[];
    rotation?: { albumName: string; intervalMinutes: number; shuffle: boolean };
}

export interface BackupPiece {
    contentId: string;
    /** The original's path in the zip. Absent for a piece curator kept no original of. */
    file?: string;
    matte?: string;
    portraitMatte?: string;
    categoryIds: string[];
}

/** A backup zip, opened: its manifest, and each image read out only when it is asked for. */
export interface OpenedBackup {
    manifest: BackupManifest;
    /** The image at a piece's `file`. Throws if the zip doesn't hold it. */
    image(file: string): Blob;
}

/** Thrown for a file that isn't a curator backup, or one this version can't read. */
export class BackupFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BackupFormatError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Opens a backup zip. The zip is held in memory once; each image is copied out of it as it is
 * restored, so a large backup never sits in memory twice over.
 */
export async function readBackup(file: Blob): Promise<OpenedBackup> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entry = (name: string): Uint8Array | undefined => {
        try {
            return unzipSync(bytes, { filter: candidate => candidate.name === name })[name];
        } catch {
            throw new BackupFormatError('That file isn’t a zip.');
        }
    };

    const raw = entry('manifest.json');
    if (!raw) {
        throw new BackupFormatError('That zip isn’t a curator backup: it has no manifest.json.');
    }
    let manifest: unknown;
    try {
        manifest = JSON.parse(new TextDecoder().decode(raw));
    } catch {
        throw new BackupFormatError('The backup’s manifest.json isn’t valid JSON.');
    }
    if (!isRecord(manifest) || manifest.format !== 'curator-backup' || !Array.isArray(manifest.tvs)) {
        throw new BackupFormatError('That zip isn’t a curator backup.');
    }
    if (manifest.version !== 1) {
        throw new BackupFormatError(`That backup is version ${String(manifest.version)}, which this version of curator can’t read.`);
    }

    return {
        manifest: manifest as unknown as BackupManifest,
        image(path) {
            const data = entry(path);
            if (!data) {
                throw new BackupFormatError(`The backup is missing ${path}.`);
            }
            return new Blob([data as Uint8Array<ArrayBuffer>], { type: path.endsWith('.png') ? 'image/png' : 'image/jpeg' });
        },
    };
}
