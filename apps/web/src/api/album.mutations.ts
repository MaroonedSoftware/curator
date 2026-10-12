import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tvApi } from './api.client';
import { queryKeys } from './query.keys';
import { notifyFailure } from './tv.mutations';

/** Every album write refreshes the TV's albums, and with them each album's detail. */
function useAlbumMutation<TVariables, TData>(tvId: string, mutationFn: (variables: TVariables) => Promise<TData>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onError: notifyFailure,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.albums(tvId) }),
    });
}

/** Resolves with the new album. */
export const useCreateAlbum = (tvId: string) => useAlbumMutation(tvId, (name: string) => tvApi(tvId).createAlbum(name));

export const useRenameAlbum = (tvId: string) =>
    useAlbumMutation(tvId, ({ albumId, name }: { albumId: string; name: string }) => tvApi(tvId).renameAlbum(albumId, name));

export const useDeleteAlbum = (tvId: string) => useAlbumMutation(tvId, (albumId: string) => tvApi(tvId).deleteAlbum(albumId));

export const useAddToAlbum = (tvId: string) =>
    useAlbumMutation(tvId, ({ albumId, contentIds }: { albumId: string; contentIds: string[] }) => tvApi(tvId).addToAlbum(albumId, contentIds));

export const useRemoveFromAlbum = (tvId: string) =>
    useAlbumMutation(tvId, ({ albumId, contentId }: { albumId: string; contentId: string }) => tvApi(tvId).removeFromAlbum(albumId, contentId));
