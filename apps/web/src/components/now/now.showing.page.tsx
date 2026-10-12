import { ActionIcon, Badge, Card, Group, Skeleton, Stack, Switch, Table, Text, Title, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { categoryLabel } from '../../api/category.labels';
import { useSetArtMode } from '../../api/tv.mutations';
import { artModeOptions, currentArtOptions } from '../../api/tv.queries';
import { useTv } from '../../tvs/tv.context';
import { ErrorAlert } from '../shared/error.alert';
import { RotationCard } from './rotation.card';

const matteOf = (raw: Record<string, unknown>): string | undefined => (typeof raw.matte_id === 'string' ? raw.matte_id : undefined);

/** The artwork on screen, whether the TV is showing art at all, and the album it rotates through. */
export function NowShowingPage() {
    const tv = useTv();
    const current = useQuery(currentArtOptions(tv.id));
    const artMode = useQuery(artModeOptions(tv.id));
    const setArtMode = useSetArtMode(tv.id);

    const refresh = () => {
        void current.refetch();
        void artMode.refetch();
    };

    return (
        <Stack maw={640}>
            <Group justify="space-between">
                <Title order={2}>Now showing on {tv.name}</Title>
                <Tooltip label="Ask the TV again">
                    <ActionIcon variant="subtle" aria-label="Refresh" onClick={refresh} loading={current.isFetching || artMode.isFetching}>
                        <IconRefresh size={18} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            {(current.isError || artMode.isError) && <ErrorAlert error={current.error ?? artMode.error} />}

            {artMode.isSuccess && (
                <Card withBorder>
                    <Switch
                        size="md"
                        label="Art mode"
                        description={artMode.data ? 'The TV is showing art.' : 'The TV is showing television, not art.'}
                        checked={artMode.data}
                        disabled={setArtMode.isPending}
                        onChange={event => setArtMode.mutate(event.currentTarget.checked)}
                    />
                </Card>
            )}

            <RotationCard />

            {current.isPending && <Skeleton h={140} />}
            {current.isSuccess && (
                <Card withBorder>
                    <Group justify="space-between" mb="sm">
                        <Text fw={600} ff="monospace">
                            {current.data.contentId ?? 'Nothing selected'}
                        </Text>
                        {/* The TV often leaves the category out of this reply. */}
                        {current.data.categoryId && <Badge variant="light">{categoryLabel(current.data.categoryId)}</Badge>}
                    </Group>
                    <Table variant="vertical" withTableBorder={false}>
                        <Table.Tbody>
                            <Table.Tr>
                                <Table.Th w={180}>Matte</Table.Th>
                                <Table.Td>{matteOf(current.data.raw) ?? 'Unknown'}</Table.Td>
                            </Table.Tr>
                        </Table.Tbody>
                    </Table>
                </Card>
            )}
        </Stack>
    );
}
