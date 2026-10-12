import { useState } from 'react';
import { ActionIcon, Anchor, Badge, Button, Card, Group, Menu, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconDots, IconPencil, IconPlayerPlay, IconRotate, IconTrash, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { normalizeContentId, tvApi, type ArtItem } from '../../api/api.client';
import { useRemoveFromAlbum } from '../../api/album.mutations';
import { albumOptions, rotationOptions } from '../../api/album.queries';
import { useSelectArt } from '../../api/tv.mutations';
import { artListOptions, currentArtOptions } from '../../api/tv.queries';
import { useTv } from '../../tvs/tv.context';
import { ArtThumbnail } from '../library/art.thumbnail';
import { ErrorAlert } from '../shared/error.alert';
import { AlbumNameModal } from './album.name.modal';
import { DeleteAlbumModal } from './delete.album.modal';
import { RotationModal } from './rotation.modal';

/** One album's pieces, in album order. A piece deleted from the TV stays listed, marked, until it is removed. */
export function AlbumPage({ albumId }: { albumId: string }) {
    const tv = useTv();
    const navigate = useNavigate();
    const album = useQuery(albumOptions(tv.id, albumId));
    const rotation = useQuery(rotationOptions(tv.id));
    const rotating = rotation.data?.albumId === albumId;
    const art = useQuery(artListOptions(tv.id));
    const current = useQuery(currentArtOptions(tv.id));
    const selectArt = useSelectArt(tv.id);
    const removeFromAlbum = useRemoveFromAlbum(tv.id);
    const [dialog, setDialog] = useState<'rotate' | 'rename' | 'delete'>();

    /** The TV's pieces by normalized id, so MY_F0001 on the TV matches MY-F0001 in the album. */
    const onTv = new Map<string, ArtItem>((art.data ?? []).map(item => [normalizeContentId(item.contentId), item]));
    const onScreen = current.data?.contentId !== undefined ? normalizeContentId(current.data.contentId) : undefined;

    return (
        <Stack>
            <Anchor component={Link} to={`/tvs/${tv.id}/albums`} size="sm">
                <Group gap={4}>
                    <IconArrowLeft size={14} /> Albums
                </Group>
            </Anchor>

            {album.isError && <ErrorAlert error={album.error} />}
            {album.isPending && <Skeleton h={200} />}
            {album.isSuccess && (
                <>
                    <Group justify="space-between">
                        <Group gap="xs">
                            <Title order={2}>{album.data.name}</Title>
                            {rotating && <Badge variant="filled">Rotating</Badge>}
                        </Group>
                        <Group gap="xs">
                            <Button leftSection={<IconRotate size={16} />} onClick={() => setDialog('rotate')}>
                                {rotating ? 'Change rotation' : 'Rotate on TV'}
                            </Button>
                            <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setDialog('rename')}>
                                Rename
                            </Button>
                            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={() => setDialog('delete')}>
                                Delete
                            </Button>
                        </Group>
                    </Group>

                    {art.isError && <ErrorAlert error={art.error} />}
                    {album.data.contentIds.length === 0 && (
                        <Text c="dimmed">
                            Nothing in this album yet. Add pieces from the{' '}
                            <Anchor component={Link} to={`/tvs/${tv.id}/library`}>
                                library
                            </Anchor>{' '}
                            with their Albums action.
                        </Text>
                    )}
                    {album.data.contentIds.length > 0 && (
                        <SimpleGrid cols={{ base: 2, sm: 3, lg: 4, xl: 5 }} spacing="md">
                            {album.data.contentIds.map(contentId => {
                                const item = onTv.get(contentId);
                                const missing = art.isSuccess && !item;
                                return (
                                    <Card key={contentId} withBorder padding="xs" data-testid="album-piece">
                                        <Card.Section>
                                            <ArtThumbnail
                                                src={missing ? undefined : tvApi(tv.id).thumbnailUrl(item?.contentId ?? contentId)}
                                                alt={contentId}
                                            />
                                        </Card.Section>
                                        <Group justify="space-between" wrap="nowrap" mt="xs" gap="xs">
                                            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                                                <Text ff="monospace" size="sm" truncate>
                                                    {contentId}
                                                </Text>
                                                {onScreen === contentId && (
                                                    <Badge size="sm" variant="filled">
                                                        On screen
                                                    </Badge>
                                                )}
                                                {missing && (
                                                    <Badge size="sm" color="gray" variant="light">
                                                        Not on the TV
                                                    </Badge>
                                                )}
                                            </Group>
                                            <Menu position="bottom-end" withinPortal={false}>
                                                <Menu.Target>
                                                    <ActionIcon variant="subtle" aria-label={`Actions for ${contentId}`}>
                                                        <IconDots size={18} />
                                                    </ActionIcon>
                                                </Menu.Target>
                                                <Menu.Dropdown>
                                                    {item && (
                                                        <Menu.Item
                                                            leftSection={<IconPlayerPlay size={16} />}
                                                            onClick={() => selectArt.mutate({ contentId: item.contentId, category: item.categoryId })}
                                                        >
                                                            Show on TV
                                                        </Menu.Item>
                                                    )}
                                                    <Menu.Item
                                                        leftSection={<IconX size={16} />}
                                                        onClick={() => removeFromAlbum.mutate({ albumId, contentId })}
                                                    >
                                                        Remove from album
                                                    </Menu.Item>
                                                </Menu.Dropdown>
                                            </Menu>
                                        </Group>
                                    </Card>
                                );
                            })}
                        </SimpleGrid>
                    )}

                    {dialog === 'rotate' && <RotationModal albumId={albumId} onClose={() => setDialog(undefined)} />}
                    {dialog === 'rename' && <AlbumNameModal album={album.data} onClose={() => setDialog(undefined)} />}
                    {dialog === 'delete' && (
                        <DeleteAlbumModal
                            album={album.data}
                            onClose={() => setDialog(undefined)}
                            onDeleted={() => void navigate({ to: '/tvs/$tvId/albums', params: { tvId: tv.id } })}
                        />
                    )}
                </>
            )}
        </Stack>
    );
}
