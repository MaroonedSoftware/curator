import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ArtItem } from '../../api/api.client';
import { useDeleteArt } from '../../api/tv.mutations';

/** Deleting removes the image from the TV for good, so it asks first. */
export function DeleteModal({ item, onClose }: { item: ArtItem; onClose: () => void }) {
    const deleteArt = useDeleteArt();

    return (
        <Modal opened onClose={onClose} title="Delete from the TV?">
            <Stack>
                <Text>
                    <Text span ff="monospace">
                        {item.contentId}
                    </Text>{' '}
                    will be removed from the TV. This can’t be undone.
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button color="red" loading={deleteArt.isPending} onClick={() => deleteArt.mutate(item.contentId, { onSuccess: onClose })}>
                        Delete
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
