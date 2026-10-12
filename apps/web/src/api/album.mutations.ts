import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tvApi, type RotationSetting } from './api.client';
import { queryKeys } from './query.keys';
import { notifyFailure } from './tv.mutations';

/**
 * Every album write refreshes the TV's albums, and with them each album's detail, and the rotation,
 * which names its album and stops when the album is deleted.
 */
function useAlbumMutation<TVariables, TData>(tvId: string, mutationFn: (variables: TVariables) => Promise<TData>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.albums(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.rotation(tvId) });
        },
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

/** Every rotation write refreshes the rotation, and what is on screen, which advancing changes. */
function useRotationMutation<TVariables, TData>(tvId: string, mutationFn: (variables: TVariables) => Promise<TData>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.rotation(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt(tvId) });
        },
    });
}

export const useSetRotation = (tvId: string) => useRotationMutation(tvId, (setting: RotationSetting) => tvApi(tvId).setRotation(setting));

export const useStopRotation = (tvId: string) => useRotationMutation(tvId, () => tvApi(tvId).stopRotation());

export const useAdvanceRotation = (tvId: string) => useRotationMutation(tvId, () => tvApi(tvId).advanceRotation());
