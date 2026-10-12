import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { render, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { routeTree } from '../src/routeTree.gen';
import { theme } from '../src/theme';

/** A cache scoped to one test. Retries are off so a deliberate failure surfaces immediately. */
export function createTestQueryClient(): QueryClient {
    return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
}

/** Renders the whole app at `path`, through the real route tree, and returns the router. */
export function renderApp(path: string, queryClient = createTestQueryClient()): RenderResult & { router: AnyRouter; queryClient: QueryClient } {
    const router = createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory({ initialEntries: [path] }) });
    const result = render(
        <QueryClientProvider client={queryClient}>
            {/* env="test" turns off transitions and portals. */}
            <MantineProvider theme={theme} env="test" forceColorScheme="light">
                <Notifications />
                <RouterProvider router={router} />
            </MantineProvider>
        </QueryClientProvider>,
    );
    return { ...result, router, queryClient };
}

/** A user that types a whole string at once rather than pacing keystrokes on real timers. */
export const setupUser = (options: Parameters<typeof userEvent.setup>[0] = {}): UserEvent => userEvent.setup({ delay: null, ...options });

export { screen, waitFor, within } from '@testing-library/react';
