import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, NumberInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconRadar, IconPlugConnected } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ConnectTv, DiscoveredTv } from '../../api/api.client';
import { useConnectTv } from '../../api/tvs.mutations';
import { discoveredTvsOptions } from '../../api/tvs.queries';
import { ErrorAlert } from '../shared/error.alert';

const DEFAULT_PORT = 8002;

/** Adding a TV: find it on the network or type its address, then accept the prompt on it. */
export function ConnectTvPanel() {
    const discovered = useQuery({ ...discoveredTvsOptions(), enabled: false });
    const connect = useConnectTv();
    const [host, setHost] = useState('');
    const [port, setPort] = useState<number | string>(DEFAULT_PORT);
    const [name, setName] = useState('');
    const [connecting, setConnecting] = useState<string>();

    const start = (tv: ConnectTv, label: string) => {
        setConnecting(label);
        connect.mutate(tv, {
            onSuccess: () => {
                setHost('');
                setName('');
                setPort(DEFAULT_PORT);
            },
        });
    };

    const submitManual = () => {
        const trimmedHost = host.trim();
        start({ host: trimmedHost, port: Number(port) || DEFAULT_PORT, name: name.trim() || undefined }, trimmedHost);
    };

    return (
        <Stack>
            <Title order={3}>Add a TV</Title>

            {connect.isPending && (
                <Alert color="blue" variant="light" title={`Pairing with ${connecting}`} icon={<Loader size="sm" />}>
                    Accept the prompt on the TV with its remote. If no prompt appears, check the TV is on and in art mode or showing TV.
                </Alert>
            )}
            {connect.isError && <ErrorAlert error={connect.error} />}
            {connect.isSuccess && (
                <Alert color="teal" variant="light" title="Added">
                    {connect.data.name} is ready.
                </Alert>
            )}

            <Card withBorder>
                <Stack>
                    <Group justify="space-between">
                        <div>
                            <Text fw={600}>On your network</Text>
                            <Text size="sm" c="dimmed">
                                Looks for Frame TVs for a few seconds.
                            </Text>
                        </div>
                        <Button
                            variant="light"
                            leftSection={<IconRadar size={16} />}
                            loading={discovered.isFetching}
                            onClick={() => void discovered.refetch()}
                        >
                            {discovered.data ? 'Search again' : 'Search'}
                        </Button>
                    </Group>
                    {discovered.isError && <ErrorAlert error={discovered.error} />}
                    {discovered.isSuccess && discovered.data.length === 0 && (
                        <Text size="sm" c="dimmed">
                            No Frame TVs answered. Check the TV is on, or add it by address below.
                        </Text>
                    )}
                    {discovered.data?.map(tv => (
                        <DiscoveredRow
                            key={`${tv.host}:${tv.port}`}
                            tv={tv}
                            disabled={connect.isPending}
                            onConnect={() => start({ host: tv.host, port: tv.port }, tv.name ?? tv.host)}
                        />
                    ))}
                </Stack>
            </Card>

            <Card withBorder>
                <form
                    onSubmit={event => {
                        event.preventDefault();
                        submitManual();
                    }}
                >
                    <Stack>
                        <div>
                            <Text fw={600}>By address</Text>
                            <Text size="sm" c="dimmed">
                                The TV’s IP address, from its network settings or your router.
                            </Text>
                        </div>
                        <Group grow align="flex-start">
                            <TextInput
                                label="Address"
                                placeholder="192.168.1.50"
                                value={host}
                                onChange={event => setHost(event.currentTarget.value)}
                                required
                            />
                            <NumberInput label="Port" value={port} onChange={setPort} min={1} max={65535} allowDecimal={false} />
                        </Group>
                        <TextInput
                            label="Name"
                            placeholder="The name the TV reports"
                            value={name}
                            onChange={event => setName(event.currentTarget.value)}
                            maxLength={60}
                        />
                        <Group justify="flex-end">
                            <Button
                                type="submit"
                                leftSection={<IconPlugConnected size={16} />}
                                disabled={host.trim().length === 0 || connect.isPending}
                            >
                                Connect
                            </Button>
                        </Group>
                    </Stack>
                </form>
            </Card>
        </Stack>
    );
}

function DiscoveredRow({ tv, disabled, onConnect }: { tv: DiscoveredTv; disabled: boolean; onConnect: () => void }) {
    return (
        <Group justify="space-between" wrap="nowrap">
            <div>
                <Text>{tv.name ?? 'Frame TV'}</Text>
                <Text size="sm" c="dimmed">
                    <Text span ff="monospace">
                        {tv.host}
                    </Text>
                    {tv.model ? ` · ${tv.model}` : ''}
                </Text>
            </div>
            {tv.tvId ? (
                <Badge variant="light" color="gray">
                    Added
                </Badge>
            ) : (
                <Button size="xs" onClick={onConnect} disabled={disabled} aria-label={`Connect ${tv.name ?? tv.host}`}>
                    Connect
                </Button>
            )}
        </Group>
    );
}
