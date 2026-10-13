import { useState } from 'react';
import { Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconDownload, IconRestore } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, type Tv } from '../../api/api.client';
import { tvsOptions } from '../../api/tvs.queries';
import { ErrorAlert } from '../shared/error.alert';
import { ConnectTvPanel } from './connect.tv.panel';
import { RemoveTvModal } from './remove.tv.modal';
import { RenameTvModal } from './rename.tv.modal';
import { RestoreBackupModal } from './restore.backup.modal';
import { TvCard } from './tv.card';

type Dialog = { kind: 'rename' | 'remove'; tv: Tv } | { kind: 'restore' };

/** The TVs curator manages, and adding more. */
export function TvsPage() {
    const tvs = useQuery(tvsOptions());
    const [dialog, setDialog] = useState<Dialog>();

    return (
        <Stack maw={720}>
            <Group justify="space-between">
                <Title order={2}>TVs</Title>
                {tvs.isSuccess && tvs.data.length > 0 && (
                    <Group gap="xs">
                        <Button variant="default" leftSection={<IconRestore size={16} />} onClick={() => setDialog({ kind: 'restore' })}>
                            Restore…
                        </Button>
                        <Button component="a" href={api.backupUrl} download variant="light" leftSection={<IconDownload size={16} />}>
                            Back up all TVs
                        </Button>
                    </Group>
                )}
            </Group>
            {tvs.isError && <ErrorAlert error={tvs.error} />}
            {tvs.isPending && <Skeleton h={90} />}
            {tvs.isSuccess && tvs.data.length === 0 && <Text c="dimmed">No TVs yet. Add one below.</Text>}
            {tvs.data?.map(tv => (
                <TvCard key={tv.id} tv={tv} onRename={() => setDialog({ kind: 'rename', tv })} onRemove={() => setDialog({ kind: 'remove', tv })} />
            ))}

            <ConnectTvPanel />

            {dialog?.kind === 'rename' && <RenameTvModal tv={dialog.tv} onClose={() => setDialog(undefined)} />}
            {dialog?.kind === 'remove' && <RemoveTvModal tv={dialog.tv} onClose={() => setDialog(undefined)} />}
            {dialog?.kind === 'restore' && tvs.data && <RestoreBackupModal tvs={tvs.data} onClose={() => setDialog(undefined)} />}
        </Stack>
    );
}
