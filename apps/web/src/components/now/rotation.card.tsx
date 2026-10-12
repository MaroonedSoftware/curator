import { useState } from 'react';
import { Anchor, Button, Card, Group, Stack, Text } from '@mantine/core';
import { IconPlayerSkipForward, IconPlayerStop, IconRotate } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAdvanceRotation, useStopRotation } from '../../api/album.mutations';
import { rotationOptions } from '../../api/album.queries';
import { intervalLabel } from '../../api/rotation.labels';
import { useTv } from '../../tvs/tv.context';
import { RotationModal } from '../albums/rotation.modal';
import { ErrorAlert } from '../shared/error.alert';

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Which album the TV rotates through, when the next piece comes up, and the controls for it. */
export function RotationCard() {
    const tv = useTv();
    const rotation = useQuery(rotationOptions(tv.id));
    const advance = useAdvanceRotation(tv.id);
    const stop = useStopRotation(tv.id);
    const [editing, setEditing] = useState(false);

    if (rotation.isError) return <ErrorAlert error={rotation.error} />;
    if (!rotation.isSuccess) return undefined;

    return (
        <Card withBorder data-testid="rotation">
            {rotation.data ? (
                <Stack gap="sm">
                    <Group gap="xs">
                        <IconRotate size={18} />
                        <Text>
                            Rotating through{' '}
                            <Anchor component={Link} to={`/tvs/${tv.id}/albums/${rotation.data.albumId}`} fw={600} inherit>
                                {rotation.data.albumName}
                            </Anchor>
                            , {rotation.data.shuffle ? 'shuffled' : 'in order'}, every {intervalLabel(rotation.data.intervalMinutes)}.
                        </Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                        {rotation.data.nextRotationAt ? `Next piece at ${time(rotation.data.nextRotationAt)}.` : 'The first piece is on its way.'}
                    </Text>
                    <Group gap="xs">
                        <Button
                            size="xs"
                            leftSection={<IconPlayerSkipForward size={14} />}
                            loading={advance.isPending}
                            onClick={() => advance.mutate()}
                        >
                            Next
                        </Button>
                        <Button size="xs" variant="default" onClick={() => setEditing(true)}>
                            Change
                        </Button>
                        <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconPlayerStop size={14} />}
                            loading={stop.isPending}
                            onClick={() => stop.mutate()}
                        >
                            Stop
                        </Button>
                    </Group>
                </Stack>
            ) : (
                <Group justify="space-between">
                    <Text c="dimmed">Not rotating. Pick an album, such as Halloween, and the TV cycles through it.</Text>
                    <Button size="xs" variant="default" leftSection={<IconRotate size={14} />} onClick={() => setEditing(true)}>
                        Rotate an album
                    </Button>
                </Group>
            )}
            {editing && <RotationModal onClose={() => setEditing(false)} />}
        </Card>
    );
}
