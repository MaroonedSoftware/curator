import { useState } from 'react';
import { ActionIcon, Badge, Group, Menu, SegmentedControl, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { IconDots, IconFrame, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Category, type ArtItem } from '../../api/api.client';
import { categoryLabel } from '../../api/category.labels';
import { matteLabel } from '../../api/mattes';
import { useSelectArt } from '../../api/tv.mutations';
import { artListOptions, currentArtOptions } from '../../api/tv.queries';
import { useTv } from '../../tvs/tv.context';
import { ErrorAlert } from '../shared/error.alert';
import { DeleteModal } from './delete.modal';
import { MatteModal } from './matte.modal';

export const ALL = 'all';

const FILTERS = [
    { value: ALL, label: 'All' },
    { value: Category.MyPhotos, label: 'My Photos' },
    { value: Category.Favourites, label: 'Favourites' },
    { value: Category.Store, label: 'Art Store' },
];

const matteOf = (item: ArtItem) => (typeof item.raw.matte_id === 'string' ? item.raw.matte_id : undefined);

type Dialog = { kind: 'matte' | 'delete'; item: ArtItem };

/** The TV's artwork, by category, with what can be done to each piece. */
export function LibraryPage({ category, onCategoryChange }: { category: string; onCategoryChange: (category: string) => void }) {
    const tv = useTv();
    const art = useQuery(artListOptions(tv.id, category === ALL ? undefined : category));
    const current = useQuery(currentArtOptions(tv.id));
    const selectArt = useSelectArt(tv.id);
    const [dialog, setDialog] = useState<Dialog>();

    return (
        <Stack>
            <Title order={2}>Library on {tv.name}</Title>
            <SegmentedControl data={FILTERS} value={category} onChange={onCategoryChange} w="fit-content" />

            {art.isError && <ErrorAlert error={art.error} />}
            {art.isPending && <Skeleton h={200} />}
            {art.isSuccess && art.data.length === 0 && (
                <Text c="dimmed">Nothing in {categoryLabel(category === ALL ? undefined : category).toLowerCase()} yet.</Text>
            )}
            {art.isSuccess && art.data.length > 0 && (
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
                                        <Text ff="monospace">{item.contentId}</Text>
                                        {current.data?.contentId === item.contentId && (
                                            <Badge size="sm" variant="filled">
                                                On screen
                                            </Badge>
                                        )}
                                    </Group>
                                </Table.Td>
                                <Table.Td>{categoryLabel(item.categoryId)}</Table.Td>
                                <Table.Td>{matteLabel(matteOf(item))}</Table.Td>
                                <Table.Td>
                                    <Menu position="bottom-end" withinPortal={false}>
                                        <Menu.Target>
                                            <ActionIcon variant="subtle" aria-label={`Actions for ${item.contentId}`}>
                                                <IconDots size={18} />
                                            </ActionIcon>
                                        </Menu.Target>
                                        <Menu.Dropdown>
                                            <Menu.Item
                                                leftSection={<IconPlayerPlay size={16} />}
                                                onClick={() => selectArt.mutate({ contentId: item.contentId, category: item.categoryId })}
                                            >
                                                Show on TV
                                            </Menu.Item>
                                            <Menu.Item leftSection={<IconFrame size={16} />} onClick={() => setDialog({ kind: 'matte', item })}>
                                                Change matte
                                            </Menu.Item>
                                            {/* Only uploads are ours to delete; the Art Store's pieces belong to Samsung. */}
                                            {item.categoryId === Category.MyPhotos && (
                                                <Menu.Item
                                                    color="red"
                                                    leftSection={<IconTrash size={16} />}
                                                    onClick={() => setDialog({ kind: 'delete', item })}
                                                >
                                                    Delete
                                                </Menu.Item>
                                            )}
                                        </Menu.Dropdown>
                                    </Menu>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}

            {dialog?.kind === 'matte' && <MatteModal item={dialog.item} onClose={() => setDialog(undefined)} />}
            {dialog?.kind === 'delete' && <DeleteModal item={dialog.item} onClose={() => setDialog(undefined)} />}
        </Stack>
    );
}
