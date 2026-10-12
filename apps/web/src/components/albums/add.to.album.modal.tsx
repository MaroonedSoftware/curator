import { useState } from 'react';
import { Button, Checkbox, Group, Modal, Skeleton, Stack, Text, TextInput } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { normalizeContentId } from '../../api/api.client';
import { useAddToAlbum, useCreateAlbum, useRemoveFromAlbum } from '../../api/album.mutations';
import { albumOptions, albumsOptions } from '../../api/album.queries';
import { useTv } from '../../tvs/tv.context';
import { ErrorAlert } from '../shared/error.alert';

/** Which of the TV's albums hold one piece, ticked on and off as the user goes, with a way to start a new one. */
export function AddToAlbumModal({ contentId, onClose }: { contentId: string; onClose: () => void }) {
    const tv = useTv();
    const albums = useQuery(albumsOptions(tv.id));
    const details = useQueries({ queries: (albums.data ?? []).map(album => albumOptions(tv.id, album.id)) });
    const add = useAddToAlbum(tv.id);
    const remove = useRemoveFromAlbum(tv.id);
    const create = useCreateAlbum(tv.id);
    const [name, setName] = useState('');
    const id = normalizeContentId(contentId);
    const trimmed = name.trim();

    return (
        <Modal opened onClose={onClose} title={`Albums for ${contentId}`}>
            <Stack>
                {albums.isError && <ErrorAlert error={albums.error} />}
                {albums.isPending && <Skeleton h={80} />}
                {albums.isSuccess && albums.data.length === 0 && <Text c="dimmed">No albums yet. Name one below.</Text>}
                {albums.data?.map((album, i) => {
                    const contentIds = details[i]?.data?.contentIds;
                    return (
                        <Checkbox
                            key={album.id}
                            label={album.name}
                            checked={contentIds?.includes(id) ?? false}
                            disabled={contentIds === undefined}
                            onChange={event =>
                                event.currentTarget.checked
                                    ? add.mutate({ albumId: album.id, contentIds: [contentId] })
                                    : remove.mutate({ albumId: album.id, contentId })
                            }
                        />
                    );
                })}
                <form
                    onSubmit={event => {
                        event.preventDefault();
                        create.mutate(trimmed, {
                            onSuccess: created => {
                                setName('');
                                add.mutate({ albumId: created.id, contentIds: [contentId] });
                            },
                        });
                    }}
                >
                    <Group align="flex-end" wrap="nowrap">
                        <TextInput
                            label="New album"
                            placeholder="Halloween"
                            value={name}
                            onChange={event => setName(event.currentTarget.value)}
                            maxLength={60}
                            style={{ flex: 1 }}
                        />
                        <Button
                            type="submit"
                            variant="default"
                            leftSection={<IconPlus size={16} />}
                            loading={create.isPending}
                            disabled={trimmed.length === 0}
                        >
                            Add
                        </Button>
                    </Group>
                </form>
                <Group justify="flex-end">
                    <Button onClick={onClose}>Done</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
