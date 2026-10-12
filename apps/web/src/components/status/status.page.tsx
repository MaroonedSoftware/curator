import { Badge, Card, Group, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiVersionOptions, deviceOptions } from '../../api/tv.queries';
import { ErrorAlert } from '../shared/error.alert';

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

/** What the API knows about the TV. */
export function StatusPage() {
    const device = useQuery(deviceOptions());
    const version = useQuery({ ...apiVersionOptions(), enabled: device.isSuccess });

    return (
        <Stack maw={640}>
            <Title order={2}>Status</Title>
            {device.isError && <ErrorAlert error={device.error} />}
            {device.isPending && <Skeleton h={160} />}
            {device.isSuccess && (
                <Card withBorder>
                    <Group justify="space-between" mb="sm">
                        <Text fw={600}>{device.data.name ?? 'Frame TV'}</Text>
                        <Badge color={device.data.powerOn ? 'teal' : 'gray'} variant="light">
                            {device.data.powerOn ? 'On' : 'Standby'}
                        </Badge>
                    </Group>
                    <Table variant="vertical" withTableBorder={false}>
                        <Table.Tbody>
                            <Table.Tr>
                                <Table.Th w={180}>Model</Table.Th>
                                <Table.Td>{device.data.model ?? 'Unknown'}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Th>Frame support</Table.Th>
                                <Table.Td>{yesNo(device.data.frameTvSupport)}</Table.Td>
                            </Table.Tr>
                            <Table.Tr>
                                <Table.Th>Art API version</Table.Th>
                                <Table.Td>{version.isSuccess ? version.data : version.isError ? 'Unavailable' : '…'}</Table.Td>
                            </Table.Tr>
                        </Table.Tbody>
                    </Table>
                </Card>
            )}
        </Stack>
    );
}
