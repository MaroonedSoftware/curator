import { useState } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import type { Tv } from '../../api/api.client';
import { useRenameTv } from '../../api/tvs.mutations';

export function RenameTvModal({ tv, onClose }: { tv: Tv; onClose: () => void }) {
    const [name, setName] = useState(tv.name);
    const rename = useRenameTv();
    const trimmed = name.trim();

    return (
        <Modal opened onClose={onClose} title={`Rename ${tv.name}`}>
            <form
                onSubmit={event => {
                    event.preventDefault();
                    rename.mutate({ tvId: tv.id, name: trimmed }, { onSuccess: onClose });
                }}
            >
                <Stack>
                    <TextInput label="Name" value={name} onChange={event => setName(event.currentTarget.value)} maxLength={60} data-autofocus />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" loading={rename.isPending} disabled={trimmed.length === 0 || trimmed === tv.name}>
                            Save
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}
