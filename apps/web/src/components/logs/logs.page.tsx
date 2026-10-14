import {
    ActionIcon,
    Badge,
    Card,
    CloseButton,
    Group,
    ScrollArea,
    Select,
    Skeleton,
    Stack,
    Text,
    Title,
    Tooltip,
    UnstyledButton,
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { LogEntry, LogLevel } from '../../api/api.client';
import { logsOptions } from '../../api/logs.queries';
import { ErrorAlert } from '../shared/error.alert';

/** Least severe first, as the filter offers them. */
const LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

const LEVEL_COLOR: Record<LogLevel, string> = { trace: 'gray.5', debug: 'gray.6', info: 'blue.7', warn: 'yellow.8', error: 'red.7' };

/** The `trace=` the API stamps on each line: which request or rotation the line belongs to. */
const TRACE = /(?:^| )trace=(\S+)/;

const time = (ts: string) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });

/**
 * The API's own log, newest first, following along as the server writes it. A line's trace picks
 * out every line of the same request or rotation, which is how one failure is read among the rest.
 */
export function LogsPage() {
    const [level, setLevel] = useState<LogLevel | undefined>();
    const [trace, setTrace] = useState<string | undefined>();
    const logs = useQuery(logsOptions(level));
    const entries = (logs.data ?? []).filter(entry => trace === undefined || TRACE.exec(entry.text)?.[1] === trace);

    return (
        <Stack>
            <Group justify="space-between" align="flex-end">
                <Title order={2}>Logs</Title>
                <Group gap="sm" align="flex-end">
                    {trace !== undefined && (
                        <Badge
                            variant="light"
                            size="lg"
                            rightSection={<CloseButton size="xs" aria-label="Show every trace" onClick={() => setTrace(undefined)} />}
                        >
                            trace {trace}
                        </Badge>
                    )}
                    <Select
                        aria-label="Level"
                        placeholder="Every level"
                        clearable
                        data={LEVELS.map(value => ({ value, label: `${value} and up` }))}
                        value={level ?? null}
                        onChange={value => setLevel((value as LogLevel | null) ?? undefined)}
                        w={160}
                    />
                    <Tooltip label="Refresh">
                        <ActionIcon variant="default" size="lg" aria-label="Refresh" loading={logs.isFetching} onClick={() => void logs.refetch()}>
                            <IconRefresh size={18} stroke={1.5} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>
            {logs.isError && <ErrorAlert error={logs.error} />}
            {logs.isPending && <Skeleton h={480} />}
            {logs.isSuccess && (
                <Card withBorder p={0}>
                    <ScrollArea h="calc(100vh - 200px)" type="auto">
                        {entries.length === 0 ? (
                            <Text c="dimmed" p="md">
                                {logs.data.length === 0 ? 'Nothing logged yet.' : 'No lines match.'}
                            </Text>
                        ) : (
                            <Stack gap={2} p="sm">
                                {entries.map((entry, index) => (
                                    <LogLine key={`${entry.ts}-${index}`} entry={entry} onTrace={setTrace} />
                                ))}
                            </Stack>
                        )}
                    </ScrollArea>
                </Card>
            )}
        </Stack>
    );
}

function LogLine({ entry, onTrace }: { entry: LogEntry; onTrace: (trace: string) => void }) {
    const match = TRACE.exec(entry.text);
    const text = match ? entry.text.slice(0, match.index) + entry.text.slice(match.index + match[0].length) : entry.text;
    return (
        <Text size="xs" ff="monospace" style={{ overflowWrap: 'anywhere' }}>
            {entry.ts && (
                <Text span inherit c="dimmed" title={entry.ts}>
                    {time(entry.ts)}{' '}
                </Text>
            )}
            {entry.level && (
                <Text span inherit fw={600} c={LEVEL_COLOR[entry.level]}>
                    {entry.level.toUpperCase().padEnd(5, ' ')}{' '}
                </Text>
            )}
            {text}
            {match && (
                <>
                    {' '}
                    <UnstyledButton
                        component="span"
                        fz="inherit"
                        ff="inherit"
                        c="blue.7"
                        onClick={() => onTrace(match[1]!)}
                        title="Show only this trace"
                    >
                        trace={match[1]}
                    </UnstyledButton>
                </>
            )}
        </Text>
    );
}
