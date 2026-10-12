import { ActionIcon, Card, Group, Menu, Stack, Text } from '@mantine/core';
import { IconDots, IconPencil, IconTrash } from '@tabler/icons-react';
import { tvApi, type Album } from '../../api/api.client';
import { useTv } from '../../tvs/tv.context';
import { ArtThumbnail } from '../library/art.thumbnail';

interface AlbumCardProps {
    album: Album;
    onRename: () => void;
    onDelete: () => void;
}

const pieces = (count: number) => (count === 1 ? '1 piece' : `${count} pieces`);

/** One album: its cover, name and size, with what can be done to it. */
export function AlbumCard({ album, onRename, onDelete }: AlbumCardProps) {
    const tv = useTv();

    return (
        <Card withBorder padding="xs" data-testid="album-card">
            <Card.Section>
                <ArtThumbnail src={album.coverContentId && tvApi(tv.id).thumbnailUrl(album.coverContentId)} alt={`Cover of ${album.name}`} />
            </Card.Section>
            <Group justify="space-between" wrap="nowrap" mt="xs" gap="xs">
                <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fw={500} truncate>
                        {album.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {pieces(album.pieceCount)}
                    </Text>
                </Stack>
                <Menu position="bottom-end" withinPortal={false}>
                    <Menu.Target>
                        <ActionIcon variant="subtle" aria-label={`Actions for ${album.name}`}>
                            <IconDots size={18} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item leftSection={<IconPencil size={16} />} onClick={onRename}>
                            Rename
                        </Menu.Item>
                        <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
                            Delete
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Group>
        </Card>
    );
}
