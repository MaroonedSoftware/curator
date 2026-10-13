import { useState } from 'react';
import { Alert, Button, FileInput, Group, Modal, Progress, Select, Stack, Text } from '@mantine/core';
import { IconFileZip } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tv } from '../../api/api.client';
import { describeError } from '../../api/api.error';
import { queryKeys } from '../../api/query.keys';
import { BackupFormatError, readBackup, type BackupTv, type OpenedBackup } from '../../backup/backup.reader';
import { restoreTv, type RestoreProgress, type RestoreSummary } from '../../backup/backup.restorer';

/** What came of restoring one backed-up TV. */
type Outcome = { backupTv: BackupTv; target: Tv } & ({ summary: RestoreSummary } | { error: unknown });

/** Where each backed-up TV goes, by its id in the backup. Unset means it isn't restored. */
type Targets = Record<string, string | undefined>;

/**
 * Where to restore each backed-up TV, to start with: the same TV, if it is still stored; else one
 * with the same name; else, when the backup holds one TV and only one is stored, that one.
 */
export function suggestTargets(backupTvs: BackupTv[], tvs: Tv[]): Targets {
    return Object.fromEntries(
        backupTvs.map(backupTv => {
            const target =
                tvs.find(tv => tv.id === backupTv.id) ??
                tvs.find(tv => tv.name.toLowerCase() === backupTv.name.toLowerCase()) ??
                (backupTvs.length === 1 && tvs.length === 1 ? tvs[0] : undefined);
            return [backupTv.id, target?.id];
        }),
    );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const imagesIn = (tv: BackupTv) => tv.pieces.filter(piece => piece.file !== undefined).length;

/** A summary in a sentence or two, leading with what most people want to know. */
function describeSummary(summary: RestoreSummary): string {
    const parts = [
        `${plural(summary.uploaded, 'image')} uploaded`,
        summary.alreadyOnTv > 0 && `${summary.alreadyOnTv} already on the TV`,
        `${plural(summary.albumsCreated + summary.albumsMerged, 'album')} restored`,
        summary.rotationRestored && 'rotation restored',
    ];
    const notes = [
        summary.failed.length > 0 && `${plural(summary.failed.length, 'image')} failed (${summary.failed.map(f => f.contentId).join(', ')}).`,
        summary.piecesLeftOut > 0 && `${plural(summary.piecesLeftOut, 'album piece')} left out: no image was kept for them.`,
    ];
    return [`${parts.filter(Boolean).join(', ')}.`, ...notes.filter(Boolean)].join(' ');
}

const progressLabel = (name: string, { step, done, total }: RestoreProgress) =>
    step === 'images' ? `${name}: uploading image ${done + 1} of ${total}` : `${name}: restoring album ${done + 1} of ${total}`;

/**
 * Restores a backup zip: each TV in it goes onto a stored TV of the person's choosing, one after
 * another. It can't be closed while a restore runs.
 */
export function RestoreBackupModal({ tvs, onClose }: { tvs: Tv[]; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [backup, setBackup] = useState<OpenedBackup>();
    const [readError, setReadError] = useState<string>();
    const [targets, setTargets] = useState<Targets>({});
    const [progress, setProgress] = useState<{ label: string; value: number }>();

    const restore = useMutation({
        mutationFn: async (opened: OpenedBackup) => {
            const outcomes: Outcome[] = [];
            for (const backupTv of opened.manifest.tvs) {
                const target = tvs.find(tv => tv.id === targets[backupTv.id]);
                if (!target) continue;
                try {
                    const summary = await restoreTv(target.id, backupTv, opened, step =>
                        setProgress({ label: progressLabel(target.name, step), value: step.total ? (100 * step.done) / step.total : 0 }),
                    );
                    outcomes.push({ backupTv, target, summary });
                } catch (error) {
                    outcomes.push({ backupTv, target, error });
                } finally {
                    // Everything about the TV may have changed: its art, albums and rotation.
                    void queryClient.invalidateQueries({ queryKey: queryKeys.tv(target.id) });
                }
            }
            return outcomes;
        },
        onSettled: () => setProgress(undefined),
    });

    const choose = async (chosen: File | null) => {
        setFile(chosen);
        setBackup(undefined);
        setReadError(undefined);
        restore.reset();
        if (!chosen) return;
        try {
            const opened = await readBackup(chosen);
            setBackup(opened);
            setTargets(suggestTargets(opened.manifest.tvs, tvs));
        } catch (error) {
            setReadError(error instanceof BackupFormatError ? error.message : 'That file couldn’t be read.');
        }
    };

    const chosenCount = backup ? backup.manifest.tvs.filter(tv => targets[tv.id] !== undefined).length : 0;
    const options = [{ value: '', label: 'Don’t restore' }, ...tvs.map(tv => ({ value: tv.id, label: tv.name }))];

    return (
        <Modal opened onClose={restore.isPending ? () => {} : onClose} title="Restore a backup" withCloseButton={!restore.isPending} size="lg">
            <Stack>
                <Text size="sm" c="dimmed">
                    Images are uploaded again with their mattes, and albums and rotations are rebuilt around them. An album a TV already has by that
                    name gets the backup’s pieces added to it. Restoring the same backup twice changes nothing.
                </Text>
                <FileInput
                    label="Backup file"
                    placeholder="curator-backup-….zip"
                    accept=".zip,application/zip"
                    leftSection={<IconFileZip size={16} />}
                    value={file}
                    onChange={chosen => void choose(chosen)}
                    disabled={restore.isPending}
                    clearable
                />
                {readError && (
                    <Alert color="red" variant="light">
                        {readError}
                    </Alert>
                )}

                {backup && !restore.isSuccess && (
                    <Stack gap="sm">
                        <Text size="sm">Backed up {new Date(backup.manifest.createdAt).toLocaleString()}. Restore each TV in it onto:</Text>
                        {backup.manifest.tvs.map(backupTv => (
                            <Select
                                key={backupTv.id}
                                label={backupTv.name}
                                description={`${plural(imagesIn(backupTv), 'image')}, ${plural(backupTv.albums.length, 'album')}${backupTv.rotation ? ', a rotation' : ''}`}
                                data={options}
                                value={targets[backupTv.id] ?? ''}
                                onChange={value => setTargets(current => ({ ...current, [backupTv.id]: value || undefined }))}
                                allowDeselect={false}
                                disabled={restore.isPending}
                            />
                        ))}
                    </Stack>
                )}

                {progress && (
                    <Stack gap={4}>
                        <Text size="sm">{progress.label}</Text>
                        <Progress value={progress.value} animated />
                    </Stack>
                )}

                {restore.data?.map(outcome => (
                    <Alert
                        key={outcome.backupTv.id}
                        color={'error' in outcome ? 'red' : outcome.summary.failed.length > 0 ? 'orange' : 'teal'}
                        variant="light"
                        title={`${outcome.backupTv.name} → ${outcome.target.name}`}
                    >
                        {'error' in outcome ? `Not restored. ${describeError(outcome.error).message}` : describeSummary(outcome.summary)}
                    </Alert>
                ))}

                <Group justify="flex-end">
                    {restore.isSuccess ? (
                        <Button onClick={onClose}>Done</Button>
                    ) : (
                        <>
                            <Button variant="default" onClick={onClose} disabled={restore.isPending}>
                                Cancel
                            </Button>
                            <Button onClick={() => backup && restore.mutate(backup)} loading={restore.isPending} disabled={chosenCount === 0}>
                                Restore
                            </Button>
                        </>
                    )}
                </Group>
            </Stack>
        </Modal>
    );
}
