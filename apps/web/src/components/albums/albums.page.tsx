import { useState } from 'react';
import { Button, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { Album } from '../../api/api.client';
import { albumsOptions } from '../../api/album.queries';
import { useTv } from '../../tvs/tv.context';
import { ErrorAlert } from '../shared/error.alert';
import { AlbumCard } from './album.card';
import { AlbumNameModal } from './album.name.modal';
import { DeleteAlbumModal } from './delete.album.modal';

type Dialog = { kind: 'create' } | { kind: 'rename' | 'delete'; album: Album };

/** The TV's albums: named sets of its pieces, such as Halloween or Christmas. */
export function AlbumsPage() {
    const tv = useTv();
    const albums = useQuery(albumsOptions(tv.id));
    const [dialog, setDialog] = useState<Dialog>();
    const close = () => setDialog(undefined);

    return (
        <Stack>
            <Group justify="space-between">
                <Title order={2}>Albums on {tv.name}</Title>
                <Button leftSection={<IconPlus size={16} />} onClick={() => setDialog({ kind: 'create' })}>
                    New album
                </Button>
            </Group>

            {albums.isError && <ErrorAlert error={albums.error} />}
            {albums.isPending && <Skeleton h={200} />}
            {albums.isSuccess && albums.data.length === 0 && (
                <Text c="dimmed">No albums yet. Make one, such as Halloween or Christmas, then add pieces from the library.</Text>
            )}
            {albums.isSuccess && albums.data.length > 0 && (
                <SimpleGrid cols={{ base: 2, sm: 3, lg: 4, xl: 5 }} spacing="md">
                    {albums.data.map(album => (
                        <AlbumCard
                            key={album.id}
                            album={album}
                            onRename={() => setDialog({ kind: 'rename', album })}
                            onDelete={() => setDialog({ kind: 'delete', album })}
                        />
                    ))}
                </SimpleGrid>
            )}

            {dialog?.kind === 'create' && <AlbumNameModal onClose={close} />}
            {dialog?.kind === 'rename' && <AlbumNameModal album={dialog.album} onClose={close} />}
            {dialog?.kind === 'delete' && <DeleteAlbumModal album={dialog.album} onClose={close} />}
        </Stack>
    );
}
