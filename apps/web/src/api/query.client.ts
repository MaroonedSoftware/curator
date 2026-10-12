import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api.client';

/**
 * Retry a failed query once, unless the API said the request itself was wrong (a 4xx): the TV
 * often drops the first request after waking, and a second one usually lands.
 */
export const retryOnce = (failureCount: number, error: unknown) => !(error instanceof ApiError && error.status < 500) && failureCount < 1;

/** The app's QueryClient. A factory, so each test gets a clean cache. */
export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 10_000,
                retry: retryOnce,
                // The TV's state also changes from its own remote, so coming back to the tab rechecks it.
                refetchOnWindowFocus: true,
            },
            mutations: { retry: false },
        },
    });
}
