import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tvApi, type RotationSetting } from './api.client';
import { describeError } from './api.error';
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

/**
 * Uploads images to the TV one at a time, adding each to the album as soon as the TV has it, so a
 * later failure never loses an earlier image. A failed image is reported and the rest carry on.
 * Resolves with the content ids of the images added. `progress` counts through the batch.
 */
export function useUploadToAlbum(tvId: string, albumId: string) {
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState<{ done: number; total: number }>();
    const mutation = useMutation({
        mutationFn: async (images: File[]) => {
            const added: string[] = [];
            for (const [i, image] of images.entries()) {
                setProgress({ done: i, total: images.length });
                try {
                    const contentId = await tvApi(tvId).uploadArt(image);
                    await tvApi(tvId).addToAlbum(albumId, [contentId]);
                    added.push(contentId);
                } catch (error) {
                    const { message } = describeError(error);
                    notifications.show({ color: 'red', title: `${image.name} wasn’t added`, message });
                }
            }
            return added;
        },
        onSettled: () => {
            setProgress(undefined);
            void queryClient.invalidateQueries({ queryKey: queryKeys.allArt(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.albums(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.rotation(tvId) });
        },
    });
    return { ...mutation, progress };
}
