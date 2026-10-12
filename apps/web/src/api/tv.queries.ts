import { queryOptions } from '@tanstack/react-query';
import { api } from './api.client';
import { queryKeys } from './query.keys';

export const healthOptions = () => queryOptions({ queryKey: queryKeys.health, queryFn: api.health });

export const deviceOptions = () => queryOptions({ queryKey: queryKeys.device, queryFn: api.device });

export const apiVersionOptions = () => queryOptions({ queryKey: queryKeys.apiVersion, queryFn: api.apiVersion, staleTime: Infinity });

export const currentArtOptions = () => queryOptions({ queryKey: queryKeys.currentArt, queryFn: api.currentArt });

export const artModeOptions = () => queryOptions({ queryKey: queryKeys.artMode, queryFn: api.artMode });

export const artListOptions = (category?: string) => queryOptions({ queryKey: queryKeys.art(category), queryFn: () => api.listArt(category) });
