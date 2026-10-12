import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { Tv } from '../../api/api.client';
import { useRemoveTv } from '../../api/tvs.mutations';

/** Forgetting a TV drops its pairing; adding it again means accepting the prompt again. */
export function RemoveTvModal({ tv, onClose }: { tv: Tv; onClose: () => void }) {
    const remove = useRemoveTv();

    return (
        <Modal opened onClose={onClose} title={`Remove ${tv.name}?`}>
            <Stack>
                <Text>Curator will forget this TV and its pairing. The art on the TV stays where it is. You can add it again later.</Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button color="red" loading={remove.isPending} onClick={() => remove.mutate(tv.id, { onSuccess: onClose })}>
                        Remove
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
