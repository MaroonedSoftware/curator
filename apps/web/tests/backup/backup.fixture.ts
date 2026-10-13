import { strToU8, zipSync } from 'fflate';
import type { BackupManifest, BackupTv } from '../../src/backup/backup.reader';

/** A backed-up TV, with whatever a test overrides. */
export const backupTv = (overrides: Partial<BackupTv> = {}): BackupTv => ({
    id: '99999999-9999-4999-8999-999999999999',
    name: 'Old Living Room',
    listedByTv: true,
    pieces: [],
    albums: [],
    ...overrides,
});

/** A backup zip holding `tvs`, and `files` beside the manifest. */
export const backupZip = (tvs: BackupTv[], files: Record<string, Uint8Array> = {}, manifest: Partial<BackupManifest> = {}): File => {
    const full: BackupManifest = { format: 'curator-backup', version: 1, createdAt: '2026-10-13T09:00:00.000Z', tvs, ...manifest };
    const zip = zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(full)) });
    return new File([zip as Uint8Array<ArrayBuffer>], 'curator-backup.zip', { type: 'application/zip' });
};
