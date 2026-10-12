import { queryOptions } from '@tanstack/react-query';
import { api } from './api.client';
import { queryKeys } from './query.keys';

export const tvsOptions = () => queryOptions({ queryKey: queryKeys.tvs, queryFn: api.tvs });

export const tvOptions = (tvId: string) => queryOptions({ queryKey: queryKeys.tv(tvId), queryFn: () => api.tv(tvId) });

/** A network search. Never stale on its own and never retried: someone asks for it, and it takes seconds. */
export const discoveredTvsOptions = () =>
    queryOptions({ queryKey: queryKeys.discoveredTvs, queryFn: api.discoverTvs, staleTime: Infinity, retry: false });
