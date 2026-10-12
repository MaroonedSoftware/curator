import { ActionIcon, Badge, Card, Group, Menu, Stack, Text } from '@mantine/core';
import { IconDeviceTv, IconDots, IconPencil, IconTrash } from '@tabler/icons-react';
import type { Tv } from '../../api/api.client';

interface TvCardProps {
    tv: Tv;
    onRename: () => void;
    onRemove: () => void;
}

/** One stored TV: what it is called, where it is, and whether it is paired. */
export function TvCard({ tv, onRename, onRemove }: TvCardProps) {
    return (
        <Card withBorder>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Group wrap="nowrap" align="flex-start">
                    <IconDeviceTv size={28} stroke={1.5} />
                    <Stack gap={2}>
                        <Text fw={600}>{tv.name}</Text>
                        <Text size="sm" c="dimmed" ff="monospace">
                            {tv.host}:{tv.port}
                        </Text>
                        {tv.model && (
                            <Text size="sm" c="dimmed">
                                {tv.model}
                            </Text>
                        )}
                    </Stack>
                </Group>
                <Group gap="xs" wrap="nowrap">
                    <Badge color={tv.paired ? 'teal' : 'orange'} variant="light">
                        {tv.paired ? 'Paired' : 'Not paired'}
                    </Badge>
                    <Menu position="bottom-end" withinPortal={false}>
                        <Menu.Target>
                            <ActionIcon variant="subtle" aria-label={`Actions for ${tv.name}`}>
                                <IconDots size={18} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item leftSection={<IconPencil size={16} />} onClick={onRename}>
                                Rename
                            </Menu.Item>
                            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onRemove}>
                                Remove
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Group>
        </Card>
    );
}
