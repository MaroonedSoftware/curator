import { queryOptions } from '@tanstack/react-query';
import { api, tvApi } from './api.client';
import { queryKeys } from './query.keys';

export const healthOptions = () => queryOptions({ queryKey: queryKeys.health, queryFn: api.health });

export const deviceOptions = (tvId: string) => queryOptions({ queryKey: queryKeys.device(tvId), queryFn: () => tvApi(tvId).device() });

export const apiVersionOptions = (tvId: string) =>
    queryOptions({ queryKey: queryKeys.apiVersion(tvId), queryFn: () => tvApi(tvId).apiVersion(), staleTime: Infinity });

export const currentArtOptions = (tvId: string) => queryOptions({ queryKey: queryKeys.currentArt(tvId), queryFn: () => tvApi(tvId).currentArt() });

export const artModeOptions = (tvId: string) => queryOptions({ queryKey: queryKeys.artMode(tvId), queryFn: () => tvApi(tvId).artMode() });

export const artListOptions = (tvId: string, category?: string) =>
    queryOptions({ queryKey: queryKeys.art(tvId, category), queryFn: () => tvApi(tvId).listArt(category) });
