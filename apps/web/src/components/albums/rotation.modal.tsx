import { useState } from 'react';
import { Button, Group, Modal, Select, Stack, Switch, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSetRotation } from '../../api/album.mutations';
import { albumsOptions, rotationOptions } from '../../api/album.queries';
import { INTERVALS, intervalLabel } from '../../api/rotation.labels';
import { useTv } from '../../tvs/tv.context';

/** Sets the album the TV rotates through, how often and in what order. Starts from the current rotation, if any. */
export function RotationModal({ albumId, onClose }: { albumId?: string; onClose: () => void }) {
    const tv = useTv();
    const albums = useQuery(albumsOptions(tv.id));
    const rotation = useQuery(rotationOptions(tv.id));
    const setRotation = useSetRotation(tv.id);
    const [album, setAlbum] = useState(albumId ?? rotation.data?.albumId);
    const [intervalMinutes, setIntervalMinutes] = useState(rotation.data?.intervalMinutes ?? 30);
    const [shuffle, setShuffle] = useState(rotation.data?.shuffle ?? true);
    const intervals = INTERVALS.includes(intervalMinutes) ? INTERVALS : [...INTERVALS, intervalMinutes].sort((a, b) => a - b);

    return (
        <Modal opened onClose={onClose} title="Rotate an album">
            <form
                onSubmit={event => {
                    event.preventDefault();
                    if (album) setRotation.mutate({ albumId: album, intervalMinutes, shuffle }, { onSuccess: onClose });
                }}
            >
                <Stack>
                    <Text size="sm" c="dimmed">
                        The TV shows a new piece from the album on this schedule, without switching into art mode.
                    </Text>
                    <Select
                        label="Album"
                        placeholder="Choose an album"
                        data={(albums.data ?? []).map(candidate => ({ value: candidate.id, label: candidate.name }))}
                        value={album ?? null}
                        onChange={value => setAlbum(value ?? undefined)}
                        allowDeselect={false}
                        comboboxProps={{ withinPortal: false }}
                    />
                    <Select
                        label="Change every"
                        data={intervals.map(minutes => ({ value: String(minutes), label: intervalLabel(minutes) }))}
                        value={String(intervalMinutes)}
                        onChange={value => value && setIntervalMinutes(Number(value))}
                        allowDeselect={false}
                        comboboxProps={{ withinPortal: false }}
                    />
                    <Switch
                        label="Shuffle"
                        description={shuffle ? 'A random piece each time.' : 'The album’s order, from the top.'}
                        checked={shuffle}
                        onChange={event => setShuffle(event.currentTarget.checked)}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={setRotation.isPending} disabled={!album}>
                            Rotate
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}
