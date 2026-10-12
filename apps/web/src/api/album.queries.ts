import { queryOptions } from '@tanstack/react-query';
import { tvApi } from './api.client';
import { queryKeys } from './query.keys';

export const albumsOptions = (tvId: string) => queryOptions({ queryKey: queryKeys.albums(tvId), queryFn: () => tvApi(tvId).albums() });

export const albumOptions = (tvId: string, albumId: string) =>
    queryOptions({ queryKey: queryKeys.album(tvId, albumId), queryFn: () => tvApi(tvId).album(albumId) });

/**
 * The album the TV rotates through: `data` is undefined when it isn't rotating. Query data can't be
 * undefined, so the answer is cached wrapped and unwrapped by `select`.
 */
export const rotationOptions = (tvId: string) =>
    queryOptions({
        queryKey: queryKeys.rotation(tvId),
        queryFn: async () => ({ rotation: await tvApi(tvId).rotation() }),
        select: data => data.rotation,
    });
