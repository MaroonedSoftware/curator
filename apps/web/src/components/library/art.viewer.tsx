import { useEffect } from 'react';
import { ActionIcon, Badge, Button, Group, Image, Modal, Stack, Table, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconFrame, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
import { isUpload, type ArtItem } from '../../api/api.client';
import { artDetails } from '../../api/art.details';
import { matteLabel } from '../../api/mattes';
import { CategoryLabels } from './category.labels';

interface ArtViewerProps {
    item: ArtItem;
    /** The pieces ← and → step through: the current filter, in order. */
    items: ArtItem[];
    thumbnailUrl: string;
    onScreen: boolean;
    onNavigate: (contentId: string) => void;
    onClose: () => void;
    onShow: () => void;
    onChangeMatte: () => void;
    onDelete: () => void;
}

/** The TV's thumbnails are small (384×216 on a 2025 Frame), so it is shown at up to twice that, not stretched to fill the screen. */
const MAX_IMAGE_WIDTH = 768;

/** One piece, larger, with what the TV knows about it and what can be done to it. */
export function ArtViewer({ item, items, thumbnailUrl, onScreen, onNavigate, onClose, onShow, onChangeMatte, onDelete }: ArtViewerProps) {
    const index = items.findIndex(candidate => candidate.contentId === item.contentId);
    const previous = index > 0 ? items[index - 1] : undefined;
    const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined;
    const details = artDetails(item);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
            if (event.key === 'ArrowLeft' && previous) onNavigate(previous.contentId);
            if (event.key === 'ArrowRight' && next) onNavigate(next.contentId);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [previous, next, onNavigate]);

    return (
        <Modal
            opened
            onClose={onClose}
            size={MAX_IMAGE_WIDTH + 64}
            centered
            title={
                <Group gap="xs">
                    <Text ff="monospace" fw={600}>
                        {item.contentId}
                    </Text>
                    {onScreen && (
                        <Badge size="sm" variant="filled">
                            On screen
                        </Badge>
                    )}
                </Group>
            }
        >
            <Stack>
                <Group gap="xs" wrap="nowrap" align="center">
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        aria-label="Previous piece"
                        disabled={!previous}
                        onClick={() => previous && onNavigate(previous.contentId)}
                    >
                        <IconChevronLeft />
                    </ActionIcon>
                    <Image src={thumbnailUrl} alt={item.contentId} fit="contain" maw={MAX_IMAGE_WIDTH} mah="60vh" mx="auto" radius="sm" bg="dark.6" />
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        aria-label="Next piece"
                        disabled={!next}
                        onClick={() => next && onNavigate(next.contentId)}
                    >
                        <IconChevronRight />
                    </ActionIcon>
                </Group>
                {index >= 0 && (
                    <Text size="xs" c="dimmed" ta="center">
                        {index + 1} of {items.length}
                    </Text>
                )}

                <Table variant="vertical" withTableBorder={false} layout="fixed">
                    <Table.Tbody>
                        <Table.Tr>
                            <Table.Th w={160}>Categories</Table.Th>
                            <Table.Td>
                                <CategoryLabels categoryIds={item.categoryIds} />
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>Matte</Table.Th>
                            <Table.Td>
                                {matteLabel(details.matte)}
                                {details.portraitMatte && details.portraitMatte !== details.matte
                                    ? ` · portrait: ${matteLabel(details.portraitMatte)}`
                                    : ''}
                            </Table.Td>
                        </Table.Tr>
                        {details.width && details.height && (
                            <Table.Tr>
                                <Table.Th>Original</Table.Th>
                                <Table.Td>
                                    {details.width} × {details.height}
                                </Table.Td>
                            </Table.Tr>
                        )}
                        {details.date && (
                            <Table.Tr>
                                <Table.Th>Date</Table.Th>
                                <Table.Td>{details.date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>

                <Group justify="flex-end">
                    {isUpload(item) && (
                        <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
                            Delete
                        </Button>
                    )}
                    <Button variant="default" leftSection={<IconFrame size={16} />} onClick={onChangeMatte}>
                        Change matte
                    </Button>
                    <Button leftSection={<IconPlayerPlay size={16} />} onClick={onShow} disabled={onScreen}>
                        {onScreen ? 'On screen' : 'Show on TV'}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
