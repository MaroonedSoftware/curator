import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ConnectTv } from './api.client';
import { queryKeys } from './query.keys';
import { notifyFailure } from './tv.mutations';

/** Pairs with a TV and stores it. Errors are left to the caller, which shows them beside the form. */
export function useConnectTv() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (tv: ConnectTv) => api.connectTv(tv),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.tvs, exact: true });
            void queryClient.invalidateQueries({ queryKey: queryKeys.discoveredTvs });
        },
    });
}

export function useRenameTv() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tvId, name }: { tvId: string; name: string }) => api.renameTv(tvId, name),
        onError: notifyFailure,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tvs, exact: true }),
    });
}

export function useRemoveTv() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (tvId: string) => api.removeTv(tvId),
        onError: notifyFailure,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.tvs, exact: true });
            void queryClient.invalidateQueries({ queryKey: queryKeys.discoveredTvs });
        },
    });
}
