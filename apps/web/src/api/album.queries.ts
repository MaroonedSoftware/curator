import { queryOptions } from '@tanstack/react-query';
import { tvApi } from './api.client';
import { queryKeys } from './query.keys';

export const albumsOptions = (tvId: string) => queryOptions({ queryKey: queryKeys.albums(tvId), queryFn: () => tvApi(tvId).albums() });

export const albumOptions = (tvId: string, albumId: string) =>
    queryOptions({ queryKey: queryKeys.album(tvId, albumId), queryFn: () => tvApi(tvId).album(albumId) });
