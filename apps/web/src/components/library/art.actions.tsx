import { ActionIcon, Menu } from '@mantine/core';
import { IconAlbum, IconDots, IconFrame, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
import { isUpload, type ArtItem } from '../../api/api.client';

interface ArtActionsProps {
    item: ArtItem;
    onShow: () => void;
    onChangeMatte: () => void;
    onAddToAlbum: () => void;
    onDelete: () => void;
}

/** What can be done to one piece, from the list or the grid. */
export function ArtActions({ item, onShow, onChangeMatte, onAddToAlbum, onDelete }: ArtActionsProps) {
    return (
        <Menu position="bottom-end" withinPortal={false}>
            <Menu.Target>
                <ActionIcon variant="subtle" aria-label={`Actions for ${item.contentId}`}>
                    <IconDots size={18} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item leftSection={<IconPlayerPlay size={16} />} onClick={onShow}>
                    Show on TV
                </Menu.Item>
                <Menu.Item leftSection={<IconFrame size={16} />} onClick={onChangeMatte}>
                    Change matte
                </Menu.Item>
                <Menu.Item leftSection={<IconAlbum size={16} />} onClick={onAddToAlbum}>
                    Albums…
                </Menu.Item>
                {/* Only uploads are ours to delete; the Art Store's pieces belong to Samsung. */}
                {isUpload(item) && (
                    <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
                        Delete
                    </Menu.Item>
                )}
            </Menu.Dropdown>
        </Menu>
    );
}
