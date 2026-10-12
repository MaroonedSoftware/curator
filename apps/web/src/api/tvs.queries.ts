import { queryOptions } from '@tanstack/react-query';
import { api } from './api.client';
import { queryKeys } from './query.keys';

export const tvsOptions = () => queryOptions({ queryKey: queryKeys.tvs, queryFn: api.tvs });

/** A network search. Never stale on its own and never retried: someone asks for it, and it takes seconds. */
export const discoveredTvsOptions = () =>
    queryOptions({ queryKey: queryKeys.discoveredTvs, queryFn: api.discoverTvs, staleTime: Infinity, retry: false });
