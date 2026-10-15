import { ActionIcon, Anchor, Badge, Card, Group, Menu, Stack, Text } from '@mantine/core';
import { IconDots, IconPencil, IconRotate, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { normalizeContentId, tvApi, type Album } from '../../api/api.client';
import { artListOptions } from '../../api/tv.queries';
import { useTv } from '../../tvs/tv.context';
import { AlbumCollage } from './album.collage';

interface AlbumCardProps {
    album: Album;
    /** Whether the TV rotates through this album. */
    rotating: boolean;
    onRotate: () => void;
    onRename: () => void;
    onDelete: () => void;
}

const pieces = (count: number) => (count === 1 ? '1 piece' : `${count} pieces`);

/** One album: its cover, name and size, with what can be done to it. */
export function AlbumCard({ album, rotating, onRotate, onRename, onDelete }: AlbumCardProps) {
    const tv = useTv();
    const navigate = useNavigate();
    const href = `/tvs/${tv.id}/albums/${album.id}`;
    const art = useQuery(artListOptions(tv.id));
    // Albums keep MY-F0001 where newer firmware lists MY_F0001, and the TV only finds a thumbnail by its own spelling.
    const onTv = new Map((art.data ?? []).map(item => [normalizeContentId(item.contentId), item.contentId]));

    return (
        <Card withBorder padding="xs" data-testid="album-card">
            <Card.Section>
                <AlbumCollage
                    srcs={album.previewContentIds.map(id => tvApi(tv.id).thumbnailUrl(onTv.get(id) ?? id))}
                    alt={album.name}
                    onOpen={() => void navigate({ to: href })}
                />
            </Card.Section>
            <Group justify="space-between" wrap="nowrap" mt="xs" gap="xs">
                <Stack gap={0} style={{ minWidth: 0 }}>
                    <Anchor component={Link} to={href} fw={500} c="inherit" truncate>
                        {album.name}
                    </Anchor>
                    <Group gap={6} wrap="nowrap">
                        <Text size="xs" c="dimmed">
                            {pieces(album.pieceCount)}
                        </Text>
                        {rotating && (
                            <Badge size="sm" variant="filled">
                                Rotating
                            </Badge>
                        )}
                    </Group>
                </Stack>
                <Menu position="bottom-end" withinPortal={false}>
                    <Menu.Target>
                        <ActionIcon variant="subtle" aria-label={`Actions for ${album.name}`}>
                            <IconDots size={18} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item leftSection={<IconRotate size={16} />} onClick={onRotate}>
                            {rotating ? 'Change rotation' : 'Rotate on TV'}
                        </Menu.Item>
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
