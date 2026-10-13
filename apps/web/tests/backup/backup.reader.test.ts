import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { BackupFormatError, readBackup } from '../../src/backup/backup.reader';
import { backupTv, backupZip } from './backup.fixture';

describe('readBackup', () => {
    it('reads the manifest, and each image when asked, typed by its extension', async () => {
        const tv = backupTv({ pieces: [{ contentId: 'MY-F0001', file: 'tvs/a/art/MY-F0001.png', categoryIds: [] }] });

        const backup = await readBackup(backupZip([tv], { 'tvs/a/art/MY-F0001.png': new Uint8Array([1, 2, 3]) }));

        expect(backup.manifest.tvs).toEqual([tv]);
        const image = backup.image('tvs/a/art/MY-F0001.png');
        expect(image.type).toBe('image/png');
        expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
        expect(() => backup.image('tvs/a/art/MY-F0002.jpg')).toThrow('The backup is missing tvs/a/art/MY-F0002.jpg.');
    });

    it('refuses a file that isn’t a zip, a zip without a manifest, and another kind of manifest', async () => {
        await expect(readBackup(new File(['hello'], 'notes.txt'))).rejects.toThrow(BackupFormatError);
        await expect(readBackup(new File([zipSync({ 'a.txt': strToU8('a') }) as Uint8Array<ArrayBuffer>], 'a.zip'))).rejects.toThrow(
            'it has no manifest.json',
        );
        await expect(readBackup(backupZip([], {}, { format: 'something-else' as 'curator-backup' }))).rejects.toThrow('isn’t a curator backup');
    });

    it('refuses a version it can’t read', async () => {
        await expect(readBackup(backupZip([], {}, { version: 2 as 1 }))).rejects.toThrow('version 2');
    });
});
