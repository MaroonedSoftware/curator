import { useState } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import type { Album } from '../../api/api.client';
import { useCreateAlbum, useRenameAlbum } from '../../api/album.mutations';
import { useTv } from '../../tvs/tv.context';

interface AlbumNameModalProps {
    /** The album to rename. Absent to create one. */
    album?: Album;
    onClose: () => void;
    /** Called with the new album once one is created. */
    onCreated?: (album: Album) => void;
}

/** Names a new album, or renames an existing one. */
export function AlbumNameModal({ album, onClose, onCreated }: AlbumNameModalProps) {
    const tv = useTv();
    const [name, setName] = useState(album?.name ?? '');
    const create = useCreateAlbum(tv.id);
    const rename = useRenameAlbum(tv.id);
    const trimmed = name.trim();

    return (
        <Modal opened onClose={onClose} title={album ? `Rename ${album.name}` : 'New album'}>
            <form
                onSubmit={event => {
                    event.preventDefault();
                    if (album) {
                        rename.mutate({ albumId: album.id, name: trimmed }, { onSuccess: onClose });
                    } else {
                        create.mutate(trimmed, {
                            onSuccess: created => {
                                onCreated?.(created);
                                onClose();
                            },
                        });
                    }
                }}
            >
                <Stack>
                    <TextInput
                        label="Name"
                        placeholder="Halloween"
                        value={name}
                        onChange={event => setName(event.currentTarget.value)}
                        maxLength={60}
                        data-autofocus
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            loading={create.isPending || rename.isPending}
                            disabled={trimmed.length === 0 || trimmed === album?.name}
                        >
                            {album ? 'Save' : 'Create'}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}
