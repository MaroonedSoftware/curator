import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api.client';
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
export function useSetArtMode() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.setArtMode,
        onMutate: async on => {
            await queryClient.cancelQueries({ queryKey: queryKeys.artMode });
            const previous = queryClient.getQueryData<boolean>(queryKeys.artMode);
            queryClient.setQueryData(queryKeys.artMode, on);
            return { previous };
        },
        onError: (error, _on, context) => {
            queryClient.setQueryData(queryKeys.artMode, context?.previous);
            notifyFailure(error);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.artMode }),
    });
}

/** Puts an artwork on screen (and the TV into art mode, unless `show` is false). */
export function useSelectArt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contentId, show, category }: { contentId: string; show?: boolean; category?: string }) =>
            api.selectArt(contentId, { show, category }),
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt });
            void queryClient.invalidateQueries({ queryKey: queryKeys.artMode });
        },
    });
}

export function useDeleteArt() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (contentId: string) => api.deleteArt(contentId),
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.allArt });
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt });
        },
    });
}

export function useChangeMatte() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contentId, matte, portraitMatte }: { contentId: string; matte: string; portraitMatte?: string }) =>
            api.changeMatte(contentId, matte, portraitMatte),
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.allArt });
            void queryClient.invalidateQueries({ queryKey: queryKeys.currentArt });
        },
    });
}
