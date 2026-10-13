/**
 * `manifest.json` at the root of a backup zip. The images sit beside it at each piece's `file`.
 * Content ids are normalized (`MY-F0001`, never `MY_F0001`). Pairing tokens are never included:
 * a restored TV is paired afresh.
 */
export interface BackupManifest {
    format: 'curator-backup';
    version: 1;
    createdAt: string;
    tvs: BackupTv[];
}

export interface BackupTv {
    /** The TV's id when it was backed up, which a restore uses to suggest the same TV. */
    id: string;
    name: string;
    model?: string;
    /** False when the TV couldn't be reached: its pieces then come from its albums and kept originals, without mattes. */
    listedByTv: boolean;
    pieces: BackupPiece[];
    albums: BackupAlbum[];
    rotation?: BackupRotation;
}

export interface BackupPiece {
    contentId: string;
    /** The original's path in the zip. Absent for a piece curator never uploaded (the Art Store's, say): the TV can't give one back. */
    file?: string;
    matte?: string;
    portraitMatte?: string;
    categoryIds: string[];
}

export interface BackupAlbum {
    name: string;
    /** In album order. */
    contentIds: string[];
}

export interface BackupRotation {
    albumName: string;
    intervalMinutes: number;
    shuffle: boolean;
}
