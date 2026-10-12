import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { AppLayout } from '../components/shell/app.layout';

/** What every route can reach. Supplied once in `main.tsx`. */
export interface RouterContext {
    queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
    component: () => (
        <AppLayout>
            <Outlet />
        </AppLayout>
    ),
});
