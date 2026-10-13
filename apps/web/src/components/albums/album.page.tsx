import { useState } from 'react';
import { ActionIcon, Anchor, Badge, Button, Card, Group, Menu, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconDots, IconPencil, IconPlayerPlay, IconReplace, IconRotate, IconTrash, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { isUpload, normalizeContentId, tvApi, type ArtItem } from '../../api/api.client';
import { useRemoveFromAlbum } from '../../api/album.mutations';
import { albumOptions, rotationOptions } from '../../api/album.queries';
import { useSelectArt } from '../../api/tv.mutations';
import { artListOptions, currentArtOptions } from '../../api/tv.queries';
import { carriesFiles, sortDropped } from '../../api/upload.limits';
import { useTv } from '../../tvs/tv.context';
import { ArtThumbnail } from '../library/art.thumbnail';
import { ReplaceModal } from '../library/replace.modal';
import { ErrorAlert } from '../shared/error.alert';
import { AlbumDropzone, useAlbumUpload } from './album.dropzone';
import { AlbumNameModal } from './album.name.modal';
import { DeleteAlbumModal } from './delete.album.modal';
import { RotationModal } from './rotation.modal';

/**
 * One album's pieces, in album order. A piece deleted from the TV stays listed, marked, until it is
 * removed. Images dropped anywhere on the page go into the album; one dropped onto an upload's card
 * replaces that piece's image instead, once confirmed.
 */
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
    const upload = useAlbumUpload(albumId, album.data?.name ?? 'the album');
    /** The piece whose image is being replaced, and the file dropped onto it, if it came that way. */
    const [replacing, setReplacing] = useState<{ contentId: string; file?: File }>();
    /** The card a file is being dragged over. */
    const [dragOver, setDragOver] = useState<string>();

    /** The TV's pieces by normalized id, so MY_F0001 on the TV matches MY-F0001 in the album. */
    const onTv = new Map<string, ArtItem>((art.data ?? []).map(item => [normalizeContentId(item.contentId), item]));
    const onScreen = current.data?.contentId !== undefined ? normalizeContentId(current.data.contentId) : undefined;

    const replaceTarget = (item: ArtItem | undefined, contentId: string) => ({
        onDragOver: (event: React.DragEvent) => {
            if (!item || !isUpload(item) || !carriesFiles(event.dataTransfer)) return;
            event.preventDefault();
            event.stopPropagation();
            setDragOver(contentId);
        },
        onDragLeave: (event: React.DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(undefined);
        },
        onDrop: (event: React.DragEvent) => {
            if (!item || !isUpload(item) || !carriesFiles(event.dataTransfer)) return;
            event.preventDefault();
            event.stopPropagation();
            setDragOver(undefined);
            const { images, rejections } = sortDropped([...event.dataTransfer.files]);
            upload.setRejections(rejections);
            if (images[0]) setReplacing({ contentId: item.contentId, file: images[0] });
        },
    });

    return (
        <Stack
            mih="70vh"
            onDragOver={event => carriesFiles(event.dataTransfer) && event.preventDefault()}
            onDrop={event => {
                // The strip and the cards take their own drops; a drop anywhere else adds to the album.
                if (event.defaultPrevented || !carriesFiles(event.dataTransfer) || !album.isSuccess || upload.isPending) return;
                event.preventDefault();
                upload.drop([...event.dataTransfer.files]);
            }}
        >
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

                    <AlbumDropzone upload={upload} />

                    {art.isError && <ErrorAlert error={art.error} />}
                    {album.data.contentIds.length === 0 && (
                        <Text c="dimmed">
                            Nothing in this album yet. Drop images above, or add pieces from the{' '}
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
                                    <Card
                                        key={contentId}
                                        withBorder
                                        padding="xs"
                                        data-testid="album-piece"
                                        {...replaceTarget(item, contentId)}
                                        style={dragOver === contentId ? { outline: '2px dashed var(--mantine-primary-color-filled)' } : undefined}
                                    >
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
                                                    {item && isUpload(item) && (
                                                        <Menu.Item
                                                            leftSection={<IconReplace size={16} />}
                                                            onClick={() => setReplacing({ contentId: item.contentId })}
                                                        >
                                                            Replace image…
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

                    {replacing && <ReplaceModal contentId={replacing.contentId} file={replacing.file} onClose={() => setReplacing(undefined)} />}
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
