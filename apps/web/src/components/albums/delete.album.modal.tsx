import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { Album } from '../../api/api.client';
import { useDeleteAlbum } from '../../api/album.mutations';
import { useTv } from '../../tvs/tv.context';

/** Deleting an album leaves its pieces on the TV. */
export function DeleteAlbumModal({ album, onClose, onDeleted }: { album: Album; onClose: () => void; onDeleted?: () => void }) {
    const tv = useTv();
    const remove = useDeleteAlbum(tv.id);

    return (
        <Modal opened onClose={onClose} title={`Delete ${album.name}?`}>
            <Stack>
                <Text>The album goes, but its pieces stay on the TV and in any other album.</Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        color="red"
                        loading={remove.isPending}
                        onClick={() =>
                            remove.mutate(album.id, {
                                onSuccess: () => {
                                    onClose();
                                    onDeleted?.();
                                },
                            })
                        }
                    >
                        Delete
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
