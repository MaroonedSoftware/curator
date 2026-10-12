import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, tvApi } from './api.client';
import { describeError } from './api.error';
import { queryKeys } from './query.keys';

/** Every failed write surfaces the same way: a red notification in the API's terms. */
export const notifyFailure = (error: unknown) => {
    const { title, message } = describeError(error);
    notifications.show({ color: 'red', title, message });
};

/**
 * Turns art mode on or off. The TV doesn't confirm the write, so the switch moves at once and the
 * real state is read back afterwards.
 */
export function useSetArtMode(tvId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (on: boolean) => tvApi(tvId).setArtMode(on),
        onMutate: async on => {
            await queryClient.cancelQueries({ queryKey: queryKeys.artMode(tvId) });
            const previous = queryClient.getQueryData<boolean>(queryKeys.artMode(tvId));
            queryClient.setQueryData(queryKeys.artMode(tvId), on);
            return { previous };
        },
        onError: (error, _on, context) => {
            queryClient.setQueryData(queryKeys.artMode(tvId), context?.previous);
            notifyFailure(error);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.artMode(tvId) }),
    });
}

/** Puts an artwork on screen (and the TV into art mode, unless `show` is false). */
export function useSelectArt(tvId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contentId, show, category }: { contentId: string; show?: boolean; category?: string }) =>
            tvApi(tvId).selectArt(contentId, { show, category }),
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.artMode(tvId) });
        },
    });
}

export function useDeleteArt(tvId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (contentId: string) => tvApi(tvId).deleteArt(contentId),
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.allArt(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt(tvId) });
        },
    });
}

export function useChangeMatte(tvId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contentId, matte, portraitMatte }: { contentId: string; matte: string; portraitMatte?: string }) =>
            tvApi(tvId).changeMatte(contentId, matte, portraitMatte),
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.allArt(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt(tvId) });
        },
    });
}

/** Uploads an image, then puts it on screen if asked. Resolves with the TV's content id. */
export function useUploadArt(tvId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ image, matte, portraitMatte, show }: { image: File; matte: string; portraitMatte: string; show: boolean }) => {
            const contentId = await tvApi(tvId).uploadArt(image, { matte, portraitMatte });
            if (show) {
                await tvApi(tvId).selectArt(contentId, { show: true, category: Category.MyPhotos });
            }
            return contentId;
        },
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.allArt(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt(tvId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.artMode(tvId) });
        },
    });
}
