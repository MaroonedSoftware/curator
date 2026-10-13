import { useState } from 'react';
import { Anchor, Badge, Card, Group, SegmentedControl, SimpleGrid, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { IconLayoutGrid, IconList } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Category, isUpload, tvApi, type ArtItem } from '../../api/api.client';
import { categoryLabel } from '../../api/category.labels';
import { matteLabel } from '../../api/mattes';
import { useSelectArt } from '../../api/tv.mutations';
import { artListOptions, currentArtOptions, hasOriginalOptions } from '../../api/tv.queries';
import { useTv } from '../../tvs/tv.context';
import { AddToAlbumModal } from '../albums/add.to.album.modal';
import { ErrorAlert } from '../shared/error.alert';
import { ArtActions } from './art.actions';
import { ArtThumbnail } from './art.thumbnail';
import { ArtViewer } from './art.viewer';
import { CategoryLabels } from './category.labels';
import { DeleteModal } from './delete.modal';
import { MatteModal } from './matte.modal';
import { ReplaceModal } from './replace.modal';

export const ALL = 'all';

export type LibraryView = 'grid' | 'list';

const FILTERS = [
    { value: ALL, label: 'All' },
    { value: Category.MyPhotos, label: 'My Photos' },
    { value: Category.Favourites, label: 'Favourites' },
    { value: Category.Other, label: 'Other' },
];

const VIEWS = [
    {
        value: 'grid',
        label: (
            <Group gap={6} wrap="nowrap">
                <IconLayoutGrid size={16} /> Grid
            </Group>
        ),
    },
    {
        value: 'list',
        label: (
            <Group gap={6} wrap="nowrap">
                <IconList size={16} /> List
            </Group>
        ),
    },
];

const matteOf = (item: ArtItem) => (typeof item.raw.matte_id === 'string' ? item.raw.matte_id : undefined);

type Dialog = { kind: 'matte' | 'albums' | 'replace' | 'delete'; item: ArtItem };

interface LibraryPageProps {
    category: string;
    onCategoryChange: (category: string) => void;
    view: LibraryView;
    onViewChange: (view: LibraryView) => void;
    /** The piece open in the viewer, if any. */
    piece?: string;
    onPieceChange: (piece: string | undefined) => void;
}

/** The TV's artwork, by category, as thumbnails or a list, with what can be done to each piece. */
export function LibraryPage({ category, onCategoryChange, view, onViewChange, piece, onPieceChange }: LibraryPageProps) {
    const tv = useTv();
    const art = useQuery(artListOptions(tv.id, category === ALL ? undefined : category));
    const current = useQuery(currentArtOptions(tv.id));
    const selectArt = useSelectArt(tv.id);
    const [dialog, setDialog] = useState<Dialog>();

    const onScreen = (item: ArtItem) => current.data?.contentId === item.contentId;
    const show = (item: ArtItem) => selectArt.mutate({ contentId: item.contentId, category: item.categoryId });
    const open = art.data?.find(item => item.contentId === piece);
    // Only uploads can have one, so the Art Store's pieces skip the question.
    const hasOriginal = useQuery({ ...hasOriginalOptions(tv.id, open?.contentId ?? ''), enabled: open !== undefined && isUpload(open) });
    const actions = (item: ArtItem) => (
        <ArtActions
            item={item}
            onShow={() => show(item)}
            onChangeMatte={() => setDialog({ kind: 'matte', item })}
            onAddToAlbum={() => setDialog({ kind: 'albums', item })}
            onReplace={() => setDialog({ kind: 'replace', item })}
            onDelete={() => setDialog({ kind: 'delete', item })}
        />
    );
    const onScreenBadge = (
        <Badge size="sm" variant="filled">
            On screen
        </Badge>
    );

    return (
        <Stack>
            <Title order={2}>Library on {tv.name}</Title>
            <Group justify="space-between">
                <SegmentedControl data={FILTERS} value={category} onChange={onCategoryChange} />
                <SegmentedControl aria-label="View" data={VIEWS} value={view} onChange={next => onViewChange(next as LibraryView)} />
            </Group>

            {art.isError && <ErrorAlert error={art.error} />}
            {art.isPending && <Skeleton h={200} />}
            {art.isSuccess && art.data.length === 0 && (
                <Text c="dimmed">Nothing in {categoryLabel(category === ALL ? undefined : category).toLowerCase()} yet.</Text>
            )}

            {art.isSuccess && art.data.length > 0 && view === 'grid' && (
                <SimpleGrid cols={{ base: 2, sm: 3, lg: 4, xl: 5 }} spacing="md">
                    {art.data.map(item => (
                        <Card key={item.contentId} withBorder padding="xs" data-testid="art-card">
                            <Card.Section>
                                <ArtThumbnail
                                    src={tvApi(tv.id).thumbnailUrl(item.contentId)}
                                    alt={item.contentId}
                                    onOpen={() => onPieceChange(item.contentId)}
                                />
                            </Card.Section>
                            <Group justify="space-between" wrap="nowrap" mt="xs" gap="xs">
                                <Stack gap={0} style={{ minWidth: 0 }}>
                                    <Group gap={6} wrap="nowrap">
                                        <Text ff="monospace" size="sm" truncate>
                                            {item.contentId}
                                        </Text>
                                        {onScreen(item) && onScreenBadge}
                                    </Group>
                                    <Text size="xs" c="dimmed" truncate>
                                        {matteLabel(matteOf(item))}
                                    </Text>
                                </Stack>
                                {actions(item)}
                            </Group>
                        </Card>
                    ))}
                </SimpleGrid>
            )}

            {art.isSuccess && art.data.length > 0 && view === 'list' && (
                <Table highlightOnHover verticalSpacing="sm">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Artwork</Table.Th>
                            <Table.Th>Category</Table.Th>
                            <Table.Th>Matte</Table.Th>
                            <Table.Th w={48} />
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {art.data.map(item => (
                            <Table.Tr key={item.contentId}>
                                <Table.Td>
                                    <Group gap="xs">
                                        <Anchor component="button" ff="monospace" c="inherit" onClick={() => onPieceChange(item.contentId)}>
                                            {item.contentId}
                                        </Anchor>
                                        {onScreen(item) && onScreenBadge}
                                    </Group>
                                </Table.Td>
                                <Table.Td>
                                    <CategoryLabels categoryIds={item.categoryIds} />
                                </Table.Td>
                                <Table.Td>{matteLabel(matteOf(item))}</Table.Td>
                                <Table.Td>{actions(item)}</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}

            {open && art.data && (
                <ArtViewer
                    item={open}
                    items={art.data}
                    thumbnailUrl={tvApi(tv.id).thumbnailUrl(open.contentId)}
                    originalUrl={hasOriginal.data ? tvApi(tv.id).originalUrl(open.contentId) : undefined}
                    onScreen={onScreen(open)}
                    onNavigate={onPieceChange}
                    onClose={() => onPieceChange(undefined)}
                    onShow={() => show(open)}
                    onChangeMatte={() => setDialog({ kind: 'matte', item: open })}
                    onAddToAlbum={() => setDialog({ kind: 'albums', item: open })}
                    onReplace={() => setDialog({ kind: 'replace', item: open })}
                    onDelete={() => {
                        // The piece is about to be gone, so the viewer closes rather than showing it.
                        onPieceChange(undefined);
                        setDialog({ kind: 'delete', item: open });
                    }}
                />
            )}
            {dialog?.kind === 'matte' && <MatteModal item={dialog.item} onClose={() => setDialog(undefined)} />}
            {dialog?.kind === 'albums' && <AddToAlbumModal contentId={dialog.item.contentId} onClose={() => setDialog(undefined)} />}
            {dialog?.kind === 'replace' && (
                <ReplaceModal
                    contentId={dialog.item.contentId}
                    onClose={() => setDialog(undefined)}
                    // The old piece is gone, so an open viewer moves to the one standing in for it.
                    onReplaced={next => piece !== undefined && onPieceChange(next)}
                />
            )}
            {dialog?.kind === 'delete' && <DeleteModal item={dialog.item} onClose={() => setDialog(undefined)} />}
        </Stack>
    );
}
