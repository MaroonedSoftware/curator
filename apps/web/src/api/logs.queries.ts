import { queryOptions } from '@tanstack/react-query';
import { api, type LogLevel } from './api.client';
import { queryKeys } from './query.keys';

/** The API's log from `level` up. Read again every few seconds while the page is open, so it follows along. */
export const logsOptions = (level?: LogLevel) =>
    queryOptions({ queryKey: queryKeys.logs(level), queryFn: () => api.logs(level), refetchInterval: 5000 });
